/// <reference lib="webworker" />

import sqlite3InitModule, {
    type Database,
    type SqlValue,
    type Sqlite3Static,
} from "@sqlite.org/sqlite-wasm";
import {
    defaultBoard,
    type BoardInfo,
    type BoardSnapshot,
} from "@meldrift/board/board-state";
import type { BrowserDbRequest, BrowserDbResponse, SyncMetadata, StoredBoard } from "./protocol";
import { schemaSql, migrateDatabase, isSupportedVersion, readSnapshot, replaceSnapshot } from "../sqlite-codec";
const exec = (db: Database, sql: string, bind: SqlValue[] = []) => db.exec({ sql, bind });

const requiredTables = ["boards", "memos", "images", "mermaids", "drawings", "tables"];
let browserDatabaseName = "meldrift-free";
let initialBoard: BoardInfo = defaultBoard;
let sync: SyncMetadata = { revision: 0, generation: 0, dirty: false, changedAt: 0 };
const workerScope = self as DedicatedWorkerGlobalScope;

let sqlite3: Sqlite3Static;
let database: Database;
let initialization: Promise<void> | null = null;
let operationQueue = Promise.resolve();

function openIndexedDb() {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(browserDatabaseName, 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains("files")) {
                request.result.createObjectStore("files");
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB could not be opened."));
    });
}

function deleteIndexedDbDatabase() {
    return new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(browserDatabaseName);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error ?? new Error("Meldrift Free Edition browser data could not be deleted."));
    });
}

async function loadIndexedDbFile() {
    const storage = await openIndexedDb();
    try {
        return await new Promise<ArrayBuffer | undefined>((resolve, reject) => {
            const request = storage.transaction("files", "readonly").objectStore("files").get("database");
            request.onsuccess = () => {
                const value = request.result;
                if (value instanceof ArrayBuffer) resolve(value);
                else if (value instanceof Uint8Array) {
                    resolve(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer);
                } else resolve(undefined);
            };
            request.onerror = () => reject(request.error ?? new Error("Browser database could not be read."));
        });
    } finally {
        storage.close();
    }
}

async function saveIndexedDbFile(bytes: Uint8Array) {
    const storage = await openIndexedDb();
    try {
        await new Promise<void>((resolve, reject) => {
            const transaction = storage.transaction("files", "readwrite");
            transaction.objectStore("files").put(sync, "sync");
            transaction.objectStore("files").put(
                bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
                "database",
            );
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error ?? new Error("Browser database could not be saved."));
            transaction.onabort = () => reject(transaction.error ?? new Error("Browser database save was aborted."));
        });
    } finally {
        storage.close();
    }
}

function exportDatabase(db: Database) {
    if (!db.pointer) throw new Error("The SQLite database is closed.");
    return sqlite3.capi.sqlite3_js_db_export(db.pointer);
}

function deserializeDatabase(bytes: ArrayBuffer, writable: boolean) {
    const db = new sqlite3.oo1.DB(":memory:");
    if (!db.pointer) throw new Error("The SQLite database could not be created.");

    const pointer = sqlite3.wasm.allocFromTypedArray(bytes);
    const flags = sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE |
        (writable ? sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE : sqlite3.capi.SQLITE_DESERIALIZE_READONLY);
    const result = sqlite3.capi.sqlite3_deserialize(
        db.pointer,
        "main",
        pointer,
        bytes.byteLength,
        bytes.byteLength,
        flags,
    );
    if (result !== sqlite3.capi.SQLITE_OK) {
        sqlite3.wasm.dealloc(pointer);
        db.close();
        throw new Error(`SQLite file could not be opened: ${sqlite3.capi.sqlite3_js_rc_str(result)}.`);
    }
    return db;
}

async function persistDatabase() {
    await saveIndexedDbFile(exportDatabase(database));
}

async function initialize() {
    sqlite3 = await sqlite3InitModule();
    const savedFile = await loadIndexedDbFile();
    const storage = await openIndexedDb();
    try {
        const storedSync = await new Promise<SyncMetadata | undefined>((resolve, reject) => {
            const request = storage.transaction("files", "readonly").objectStore("files").get("sync");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        if (storedSync) sync = storedSync;
    } finally {
        storage.close();
    }
    database = savedFile
        ? deserializeDatabase(savedFile, true)
        : new sqlite3.oo1.DB(":memory:");
    if (savedFile) migrateDatabase(database);
    else database.exec(schemaSql);
    exec(database, "INSERT OR IGNORE INTO boards (board_id, title, width, height) VALUES (?, ?, ?, ?)", [
        initialBoard.boardId, initialBoard.title, initialBoard.width, initialBoard.height,
    ]);
    await persistDatabase();
}

async function ensureInitialized() {
    initialization ??= initialize();
    return initialization;
}

function decodeDatabase(bytes: ArrayBuffer, expectedBoardId?: number) {
    if (bytes.byteLength > 50 * 1024 * 1024) {
        throw new Error("The SQLite save file must be 50 MiB or smaller.");
    }
    if (bytes.byteLength < 16 || new TextDecoder().decode(bytes.slice(0, 16)) !== "SQLite format 3\0") {
        throw new Error("The selected file is not a SQLite database.");
    }

    const imported = deserializeDatabase(bytes, false);
    try {
        const integrity = imported.selectValue("PRAGMA integrity_check");
        if (integrity !== "ok") throw new Error("The SQLite save file failed its integrity check.");

        const tableNames = new Set(imported.selectValues(
            "SELECT name FROM sqlite_master WHERE type = 'table'",
        ).map(String));
        if (requiredTables.some((table) => !tableNames.has(table))) {
            throw new Error("The SQLite file is missing Meldrift Free Edition tables.");
        }

        const version = Number(imported.selectValue("PRAGMA user_version"));
        if (!isSupportedVersion(version)) {
            throw new Error(`Unsupported save file version: ${version}.`);
        }

        const boardCount = Number(imported.selectValue("SELECT count(*) FROM boards"));
        const boardId = Number(imported.selectValue("SELECT board_id FROM boards LIMIT 1"));
        if (boardCount !== 1 || (expectedBoardId !== undefined && boardId !== expectedBoardId)) {
            throw new Error("A save file must contain exactly one supported Meldrift board.");
        }

        for (const table of ["memos", "images", "mermaids", "drawings", "tables"]) {
            const unsupportedRows = Number(imported.selectValue(
                `SELECT count(*) FROM ${table} WHERE board_id <> ? OR board_id IS NULL`,
                [boardId],
            ));
            if (unsupportedRows !== 0) {
                throw new Error("The save file contains data for an unsupported board.");
            }
        }

        return readSnapshot(imported, boardId);
    } finally {
        imported.close();
    }
}

async function importDatabase(bytes: ArrayBuffer, revision = 0) {
    const snapshot = decodeDatabase(bytes, initialBoard.boardId);
    replaceSnapshot(database, snapshot);
    sync = { revision, generation: 0, dirty: false, changedAt: 0 };
    await persistDatabase();
    return snapshot;
}

async function handleRequest(request: BrowserDbRequest): Promise<BoardDbResult> {
    if (!initialization) {
        browserDatabaseName = request.storageName;
        initialBoard = request.board;
    }
    if (request.storageName !== browserDatabaseName || request.board.boardId !== initialBoard.boardId) {
        throw new Error("A worker cannot switch its board storage.");
    }
    await ensureInitialized();
    switch (request.type) {
        case "load":
            return readSnapshot(database, initialBoard.boardId);
        case "replace":
            if (request.snapshot.board.boardId !== initialBoard.boardId) throw new Error("Board ID mismatch.");
            replaceSnapshot(database, request.snapshot);
            if (request.dirty) {
                sync = { ...sync, generation: sync.generation + 1, dirty: true, changedAt: Date.now(), mutationId: crypto.randomUUID() };
            }
            await persistDatabase();
            return undefined;
        case "export": {
            const bytes = exportDatabase(database);
            return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
        }
        case "encode": {
            const exported = new sqlite3.oo1.DB(":memory:");
            try {
                exported.exec(schemaSql);
                replaceSnapshot(exported, request.snapshot);
                const bytes = exportDatabase(exported);
                return bytes.slice().buffer as ArrayBuffer;
            } finally { exported.close(); }
        }
        case "decode":
            return decodeDatabase(request.bytes);
        case "import":
            return importDatabase(request.bytes, request.revision);
        case "record": {
            const bytes = exportDatabase(database);
            return { bytes: bytes.slice().buffer as ArrayBuffer, sync: { ...sync } };
        }
        case "acknowledge":
            sync = { ...sync, revision: request.revision, dirty: sync.generation !== request.generation };
            await persistDatabase();
            return undefined;
        case "reset":
            await deleteIndexedDbDatabase();
            database.close();
            initialization = null;
            return undefined;
    }
}

type BoardDbResult = BoardSnapshot | ArrayBuffer | StoredBoard | undefined;

workerScope.addEventListener("message", (event: MessageEvent<BrowserDbRequest>) => {
    const request = event.data;
    operationQueue = operationQueue.then(async () => {
        try {
            const value = await handleRequest(request);
            const response: BrowserDbResponse = { id: request.id, ok: true, value };
            const transfer = value instanceof ArrayBuffer ? [value] : [];
            workerScope.postMessage(response, transfer);
        } catch (error) {
            const response: BrowserDbResponse = {
                id: request.id,
                ok: false,
                error: error instanceof Error ? error.message : "Browser SQLite operation failed.",
            };
            workerScope.postMessage(response);
        }
    });
});

export {};
