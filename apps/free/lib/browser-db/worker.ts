/// <reference lib="webworker" />

import sqlite3InitModule, {
    type Database,
    type SqlValue,
    type Sqlite3Static,
} from "@sqlite.org/sqlite-wasm";
import {
    defaultBoard,
    defaultBoardId,
    parseBoardSnapshot,
    schemaVersion,
    type BoardSnapshot,
} from "@/lib/board-state";
import type { BrowserDbRequest, BrowserDbResponse } from "@/lib/browser-db/protocol";

const requiredTables = ["boards", "memos", "images", "mermaids", "drawings", "tables"];
// Keep the pre-rebrand storage key so existing local boards remain accessible.
const browserDatabaseName = "kyuboard-lite";
const workerScope = self as DedicatedWorkerGlobalScope;

let sqlite3: Sqlite3Static;
let database: Database;
let initialization: Promise<void> | null = null;
let operationQueue = Promise.resolve();

const schemaSql = `
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = DELETE;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS boards (
        board_id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        width INTEGER NOT NULL CHECK (width > 0),
        height INTEGER NOT NULL CHECK (height > 0),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS memos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        board_id INTEGER NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        x INTEGER NOT NULL DEFAULT 0,
        y INTEGER NOT NULL DEFAULT 0,
        z INTEGER NOT NULL DEFAULT 1,
        width INTEGER NOT NULL CHECK (width > 0),
        height INTEGER NOT NULL CHECK (height > 0),
        color TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS images (
        image_id INTEGER PRIMARY KEY AUTOINCREMENT,
        board_id INTEGER NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
        url TEXT NOT NULL DEFAULT '',
        image_data BLOB,
        mime_type TEXT,
        label TEXT,
        x INTEGER NOT NULL DEFAULT 0,
        y INTEGER NOT NULL DEFAULT 0,
        z INTEGER NOT NULL DEFAULT 1,
        width INTEGER NOT NULL DEFAULT 400 CHECK (width > 0),
        height INTEGER NOT NULL DEFAULT 300 CHECK (height > 0),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS mermaids (
        mermaid_id INTEGER PRIMARY KEY AUTOINCREMENT,
        board_id INTEGER NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
        source TEXT NOT NULL,
        x INTEGER NOT NULL DEFAULT 0,
        y INTEGER NOT NULL DEFAULT 0,
        z INTEGER NOT NULL DEFAULT 1,
        width INTEGER NOT NULL CHECK (width > 0),
        height INTEGER NOT NULL CHECK (height > 0),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS drawings (
        drawing_id INTEGER PRIMARY KEY AUTOINCREMENT,
        board_id INTEGER NOT NULL UNIQUE REFERENCES boards(board_id) ON DELETE CASCADE,
        source TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(source)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS tables (
        table_id INTEGER PRIMARY KEY AUTOINCREMENT,
        board_id INTEGER NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
        source TEXT NOT NULL CHECK (json_valid(source)),
        x INTEGER NOT NULL DEFAULT 0,
        y INTEGER NOT NULL DEFAULT 0,
        z INTEGER NOT NULL DEFAULT 1,
        width INTEGER NOT NULL CHECK (width > 0),
        height INTEGER NOT NULL CHECK (height > 0),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    PRAGMA user_version = ${schemaVersion};
`;

function exec(db: Database, sql: string, bind: SqlValue[] = []) {
    db.exec({ sql, bind });
}

function migrateDatabase(db: Database) {
    const version = Number(db.selectValue("PRAGMA user_version"));
    if (version === schemaVersion) {
        db.exec(schemaSql);
        return;
    }
    if (version !== 1) {
        throw new Error(`Unsupported browser database version: ${version}.`);
    }

    db.transaction(() => {
        exec(db, "ALTER TABLE images ADD COLUMN image_data BLOB");
        exec(db, "ALTER TABLE images ADD COLUMN mime_type TEXT");
        exec(db, `PRAGMA user_version = ${schemaVersion}`);
    });
    db.exec(schemaSql);
}

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

function numberValue(value: SqlValue) {
    return Number(value);
}

function stringValue(value: SqlValue) {
    return String(value);
}

function bytesValue(value: SqlValue) {
    if (!(value instanceof Uint8Array)) {
        throw new Error("The SQLite file contains invalid image bytes.");
    }

    return new Uint8Array(value);
}

function readSnapshot(db: Database): BoardSnapshot {
    const boardRow = db.selectObject(
        "SELECT board_id, title, width, height FROM boards WHERE board_id = ?",
        [defaultBoardId],
    );
    if (!boardRow) throw new Error("The default board is missing from the SQLite file.");

    const memos = db.selectObjects(
        "SELECT id, board_id, content, x, y, z, width, height, color FROM memos WHERE board_id = ? ORDER BY id",
        [defaultBoardId],
    ).map((row) => ({
        id: numberValue(row.id), boardId: numberValue(row.board_id), content: stringValue(row.content),
        x: numberValue(row.x), y: numberValue(row.y), z: numberValue(row.z),
        width: numberValue(row.width), height: numberValue(row.height), color: stringValue(row.color),
    }));

    const imageColumns = new Set(db.selectObjects("PRAGMA table_info(images)").map((row) => String(row.name)));
    const hasImageBlobColumns = imageColumns.has("image_data") && imageColumns.has("mime_type");
    const images = db.selectObjects(
        hasImageBlobColumns
            ? "SELECT image_id, board_id, url, image_data, mime_type, label, x, y, z, width, height FROM images WHERE board_id = ? ORDER BY image_id"
            : "SELECT image_id, board_id, url, label, x, y, z, width, height FROM images WHERE board_id = ? ORDER BY image_id",
        [defaultBoardId],
    ).map((row) => ({
        imageId: numberValue(row.image_id), boardId: numberValue(row.board_id), url: stringValue(row.url),
        data: !hasImageBlobColumns || row.image_data === null ? null : bytesValue(row.image_data),
        mimeType: !hasImageBlobColumns || row.mime_type === null ? null : stringValue(row.mime_type),
        label: row.label === null ? null : stringValue(row.label), x: numberValue(row.x), y: numberValue(row.y),
        z: numberValue(row.z), width: numberValue(row.width), height: numberValue(row.height),
    }));

    const mermaids = db.selectObjects(
        "SELECT mermaid_id, board_id, source, x, y, z, width, height FROM mermaids WHERE board_id = ? ORDER BY mermaid_id",
        [defaultBoardId],
    ).map((row) => ({
        id: numberValue(row.mermaid_id), boardId: numberValue(row.board_id), source: stringValue(row.source),
        x: numberValue(row.x), y: numberValue(row.y), z: numberValue(row.z),
        width: numberValue(row.width), height: numberValue(row.height),
    }));

    const tables = db.selectObjects(
        "SELECT table_id, board_id, source, x, y, z, width, height FROM tables WHERE board_id = ? ORDER BY table_id",
        [defaultBoardId],
    ).map((row) => ({
        id: numberValue(row.table_id), boardId: numberValue(row.board_id), source: JSON.parse(stringValue(row.source)),
        x: numberValue(row.x), y: numberValue(row.y), z: numberValue(row.z),
        width: numberValue(row.width), height: numberValue(row.height),
    }));

    const drawingRow = db.selectObject("SELECT source FROM drawings WHERE board_id = ?", [defaultBoardId]);
    return parseBoardSnapshot({
        board: {
            boardId: numberValue(boardRow.board_id),
            title: stringValue(boardRow.title),
            width: numberValue(boardRow.width),
            height: numberValue(boardRow.height),
        },
        memos,
        images,
        mermaids,
        tables,
        strokes: drawingRow ? JSON.parse(stringValue(drawingRow.source)) : [],
    });
}

function replaceSnapshot(db: Database, value: BoardSnapshot) {
    const snapshot = parseBoardSnapshot(value);
    db.transaction(() => {
        exec(db, "DELETE FROM boards");
        exec(db, "INSERT INTO boards (board_id, title, width, height) VALUES (?, ?, ?, ?)", [
            snapshot.board.boardId, snapshot.board.title, snapshot.board.width, snapshot.board.height,
        ]);
        snapshot.memos.forEach((memo) => exec(db,
            "INSERT INTO memos (id, board_id, content, x, y, z, width, height, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [memo.id, memo.boardId, memo.content, memo.x, memo.y, memo.z, memo.width, memo.height, memo.color],
        ));
        snapshot.images.forEach((image) => exec(db,
            "INSERT INTO images (image_id, board_id, url, image_data, mime_type, label, x, y, z, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                image.imageId, image.boardId, image.url, image.data, image.mimeType, image.label,
                image.x, image.y, image.z, image.width, image.height,
            ],
        ));
        snapshot.mermaids.forEach((mermaid) => exec(db,
            "INSERT INTO mermaids (mermaid_id, board_id, source, x, y, z, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [mermaid.id, mermaid.boardId, mermaid.source, mermaid.x, mermaid.y, mermaid.z, mermaid.width, mermaid.height],
        ));
        snapshot.tables.forEach((table) => exec(db,
            "INSERT INTO tables (table_id, board_id, source, x, y, z, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [table.id, table.boardId, JSON.stringify(table.source), table.x, table.y, table.z, table.width, table.height],
        ));
        exec(db, "INSERT INTO drawings (drawing_id, board_id, source) VALUES (?, ?, ?)", [
            1, snapshot.board.boardId, JSON.stringify(snapshot.strokes),
        ]);
    });
}

async function initialize() {
    sqlite3 = await sqlite3InitModule();
    const savedFile = await loadIndexedDbFile();
    database = savedFile
        ? deserializeDatabase(savedFile, true)
        : new sqlite3.oo1.DB(":memory:");
    if (savedFile) migrateDatabase(database);
    else database.exec(schemaSql);
    exec(database, "INSERT OR IGNORE INTO boards (board_id, title, width, height) VALUES (?, ?, ?, ?)", [
        defaultBoard.boardId, defaultBoard.title, defaultBoard.width, defaultBoard.height,
    ]);
    await persistDatabase();
}

async function ensureInitialized() {
    initialization ??= initialize();
    return initialization;
}

async function importDatabase(bytes: ArrayBuffer) {
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
        if (version !== 1 && version !== schemaVersion) {
            throw new Error(`Unsupported save file version: ${version}.`);
        }

        const boardCount = Number(imported.selectValue("SELECT count(*) FROM boards"));
        const defaultBoardCount = Number(imported.selectValue(
            "SELECT count(*) FROM boards WHERE board_id = ?",
            [defaultBoardId],
        ));
        if (boardCount !== 1 || defaultBoardCount !== 1) {
            throw new Error("A save file must contain exactly one Meldrift Free Edition board.");
        }

        for (const table of ["memos", "images", "mermaids", "drawings", "tables"]) {
            const unsupportedRows = Number(imported.selectValue(
                `SELECT count(*) FROM ${table} WHERE board_id <> ?`,
                [defaultBoardId],
            ));
            if (unsupportedRows !== 0) {
                throw new Error("The save file contains data for an unsupported board.");
            }
        }

        const snapshot = readSnapshot(imported);
        replaceSnapshot(database, snapshot);
        await persistDatabase();
        return snapshot;
    } finally {
        imported.close();
    }
}

async function handleRequest(request: BrowserDbRequest): Promise<BoardDbResult> {
    await ensureInitialized();
    switch (request.type) {
        case "load":
            return readSnapshot(database);
        case "replace":
            replaceSnapshot(database, request.snapshot);
            await persistDatabase();
            return undefined;
        case "export": {
            const bytes = exportDatabase(database);
            return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
        }
        case "import":
            return importDatabase(request.bytes);
        case "reset":
            await deleteIndexedDbDatabase();
            database.close();
            initialization = null;
            return undefined;
    }
}

type BoardDbResult = BoardSnapshot | ArrayBuffer | undefined;

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
