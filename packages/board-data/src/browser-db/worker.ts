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
} from "@meldrift/board-data/board-state";
import type {
    BrowserDbRequest, BrowserDbResponse, SyncMetadata, StoredAsset, StoredBoard, OutboxBatch, OutboxState, RemoteApplied,
} from "./protocol";
import { diffBoardSnapshots, mergeBoardOperations, touchedKeysOf, type BoardOperation } from "../board-delta";
import {
    applyRemotePatch, deferKeys, resolveRemoteOperations, type RemoteAsset, type RemotePatch,
} from "../remote-patch";
import { schemaSql, migrateDatabase, isSupportedVersion, readSnapshot, replaceSnapshot } from "../sqlite-codec";
const exec = (db: Database, sql: string, bind: SqlValue[] = []) => db.exec({ sql, bind });

const requiredTables = ["boards", "memos", "images", "mermaids", "drawings", "tables"];
let browserDatabaseName = "meldrift-free";
let initialBoard: BoardInfo = defaultBoard;
let sync: SyncMetadata = { revision: 0, generation: 0, dirty: false, changedAt: 0 };
let lastSaved: BoardSnapshot | null = null;
// Live: 워커가 반영한 원격 배치. 늦게 도착한 로컬 저장을 이 기록 위에 다시 맞춘다. 새로고침하면 화면과 함께 0부터 시작한다.
const remoteLogLimit = 32;
let remoteSeq = 0;
let remoteLog: { seq: number; patch: RemotePatch }[] = [];
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
                if (value instanceof ArrayBuffer) {
                    resolve(value);
                } else if (value instanceof Uint8Array) {
                    resolve(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer);
                } else {
                    resolve(undefined);
                }
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
    if (!db.pointer) {
        throw new Error("The SQLite database is closed.");
    }
    return sqlite3.capi.sqlite3_js_db_export(db.pointer);
}

function deserializeDatabase(bytes: ArrayBuffer, writable: boolean) {
    const db = new sqlite3.oo1.DB(":memory:");
    if (!db.pointer) {
        throw new Error("The SQLite database could not be created.");
    }

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

function readOutboxRows(where: string, bind: SqlValue[] = []) {
    return database.selectObjects(
        `SELECT claimed, mutation_id, type, sync_id, action, changes, asset FROM outbox WHERE ${where} ORDER BY seq`,
        bind,
    ).map((row) => ({
        claim: Number(row.claimed),
        mutationId: String(row.mutation_id ?? ""),
        operation: {
            type: String(row.type),
            syncId: String(row.sync_id),
            action: String(row.action),
            changes: JSON.parse(String(row.changes)),
            ...(Number(row.asset) === 1 ? { asset: true } : {}),
        } as BoardOperation,
    }));
}

function readOutbox(): OutboxState {
    const batches = new Map<number, OutboxBatch>();
    for (const row of readOutboxRows("claimed != 0")) {
        const batch = batches.get(row.claim)
            ?? { claim: row.claim, mutationId: row.mutationId, operations: [] };
        batch.operations.push(row.operation);
        batches.set(row.claim, batch);
    }
    return {
        pending: readOutboxRows("claimed = 0").map((row) => row.operation),
        claimed: [...batches.values()],
    };
}

function retainClaimedAssets(claim: number) {
    exec(database, `
        INSERT OR REPLACE INTO outbox_assets (asset_id, mime_type, data)
        SELECT i.asset_id, i.mime_type, i.image_data FROM images i
        WHERE i.image_data IS NOT NULL AND i.mime_type IS NOT NULL AND i.asset_id IN (
            SELECT json_extract(changes, '$.assetId') FROM outbox WHERE asset = 1 AND claimed = ?)`,
        [claim]);
}

function releaseUnreferencedAssets() {
    exec(database, `
        DELETE FROM outbox_assets WHERE asset_id NOT IN (
            SELECT json_extract(changes, '$.assetId') FROM outbox
            WHERE asset = 1 AND json_extract(changes, '$.assetId') IS NOT NULL)`);
}

function recordOutbox(generation: number, operations: BoardOperation[]) {
    const pending = readOutboxRows("claimed = 0").map((row) => row.operation);
    const merged = mergeBoardOperations(pending, operations);
    database.transaction(() => {
        exec(database, "DELETE FROM outbox WHERE claimed = 0");
        merged.forEach((operation) => exec(database,
            "INSERT INTO outbox (generation, type, sync_id, action, changes, asset) VALUES (?, ?, ?, ?, ?, ?)",
            [
                generation, operation.type, operation.syncId, operation.action,
                JSON.stringify(operation.changes), operation.asset ? 1 : 0,
            ],
        ));
    });
}

async function persistDatabase() {
    await saveIndexedDbFile(exportDatabase(database));
}

async function persistSync() {
    const storage = await openIndexedDb();
    try {
        await new Promise<void>((resolve, reject) => {
            const transaction = storage.transaction("files", "readwrite");
            transaction.objectStore("files").put(sync, "sync");
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error ?? new Error("Browser sync state could not be saved."));
        });
    } finally {
        storage.close();
    }
}

function outboxKeys() {
    return touchedKeysOf(readOutboxRows("1 = 1").map((row) => row.operation));
}

// 화면이 아직 받지 못한 원격 배치가 있으면, 그 배치를 저장 스냅샷 위에 다시 적용해 되돌림을 막는다.
function rebaseOnRemote(snapshot: BoardSnapshot, appliedSeq: number | undefined) {
    if (appliedSeq === undefined || appliedSeq >= remoteSeq) {
        return snapshot;
    }
    const missing = remoteLog.filter((entry) => entry.seq > appliedSeq);
    if (missing.length === 0 || missing[0].seq !== appliedSeq + 1) {
        console.warn("A local save arrived after too many remote changes; its edits are held back.");
        return lastSaved ?? snapshot;
    }
    return missing.reduce((current, entry) => applyRemotePatch(current, entry.patch), snapshot);
}

async function applyRemote(operations: BoardOperation[], revision: number, assets: Map<string, RemoteAsset>): Promise<RemoteApplied> {
    const base = lastSaved ?? readSnapshot(database, initialBoard.boardId);
    const pending = new Set(outboxKeys());
    if (touchedKeysOf(operations).some((key) => pending.has(key))) {
        throw new Error("Remote changes overlap unsent local changes.");
    }
    const patch = resolveRemoteOperations(base, operations, assets);
    const next = applyRemotePatch(base, patch);
    replaceSnapshot(database, next);
    lastSaved = next;
    remoteSeq += 1;
    remoteLog = [...remoteLog, { seq: remoteSeq, patch }].slice(-remoteLogLimit);
    sync = { ...sync, revision, seeded: true };
    await persistDatabase();
    return { seq: remoteSeq, patch };
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
        if (storedSync) {
            sync = storedSync;
        }
    } finally {
        storage.close();
    }
    database = savedFile
        ? deserializeDatabase(savedFile, true)
        : new sqlite3.oo1.DB(":memory:");
    if (savedFile) {
        migrateDatabase(database);
    } else {
        database.exec(schemaSql);
    }
    exec(database, "INSERT OR IGNORE INTO boards (board_id, title, width, height) VALUES (?, ?, ?, ?)", [
        initialBoard.boardId, initialBoard.title, initialBoard.width, initialBoard.height,
    ]);
    lastSaved = readSnapshot(database, initialBoard.boardId);
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
        if (integrity !== "ok") {
            throw new Error("The SQLite save file failed its integrity check.");
        }

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

async function adoptSnapshot(snapshot: BoardSnapshot, revision: number) {
    replaceSnapshot(database, snapshot);
    exec(database, "DELETE FROM outbox");
    exec(database, "DELETE FROM outbox_assets");
    lastSaved = snapshot;
    // 통째로 바꾼 내용 위에 화면도 새로 마운트되므로 원격 배치 번호를 처음부터 다시 센다.
    remoteSeq = 0;
    remoteLog = [];
    sync = { revision, generation: 0, dirty: false, changedAt: 0, seeded: true };
    await persistDatabase();
    return snapshot;
}

async function importDatabase(bytes: ArrayBuffer, revision = 0) {
    return adoptSnapshot(decodeDatabase(bytes, initialBoard.boardId), revision);
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
        case "replace": {
            if (request.snapshot.board.boardId !== initialBoard.boardId) {
                throw new Error("Board ID mismatch.");
            }
            const previous = lastSaved;
            let incoming = rebaseOnRemote(request.snapshot, request.remoteSeq);
            if (previous && request.deferredKeys && request.deferredKeys.length > 0) {
                incoming = deferKeys(incoming, previous, request.deferredKeys);
            }
            replaceSnapshot(database, incoming);
            if (request.dirty) {
                const generation = sync.generation + 1;
                const operations = previous ? diffBoardSnapshots(previous, incoming) : [];
                if (operations.length > 0) {
                    recordOutbox(generation, operations);
                }
                sync = { ...sync, generation, dirty: true, changedAt: Date.now(), mutationId: crypto.randomUUID() };
            }
            lastSaved = incoming;
            await persistDatabase();
            return undefined;
        }
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
            } finally {
                exported.close();
            }
        }
        case "decode":
            return decodeDatabase(request.bytes, request.expectedBoardId);
        case "import":
            return importDatabase(request.bytes, request.revision);
        case "record": {
            const bytes = exportDatabase(database);
            return { bytes: bytes.slice().buffer as ArrayBuffer, sync: { ...sync } };
        }
        case "acknowledge":
            sync = {
                ...sync, revision: request.revision,
                dirty: sync.generation !== request.generation, seeded: true,
            };
            await persistDatabase();
            return undefined;
        case "asset": {
            const row = database.selectObject(`
                SELECT image_data AS data, mime_type FROM images
                    WHERE asset_id = ? AND image_data IS NOT NULL
                UNION ALL
                SELECT data, mime_type FROM outbox_assets WHERE asset_id = ?
                LIMIT 1`,
                [request.assetId, request.assetId],
            );
            if (!row || !(row.data instanceof Uint8Array)) {
                return null;
            }
            return { data: row.data.slice().buffer as ArrayBuffer, mimeType: String(row.mime_type) };
        }
        case "outbox":
            return readOutbox();
        case "claimOutbox": {
            const claim = Date.now();
            const mutationId = crypto.randomUUID();
            database.transaction(() => {
                exec(database,
                    "UPDATE outbox SET claimed = ?, mutation_id = ? WHERE seq IN (SELECT seq FROM outbox WHERE claimed = 0 ORDER BY seq LIMIT ?)",
                    [claim, mutationId, request.limit],
                );
                retainClaimedAssets(claim);
            });
            await persistDatabase();
            return {
                claim, mutationId,
                operations: readOutboxRows("claimed = ?", [claim]).map((row) => row.operation),
            };
        }
        case "releaseOutbox":
            database.transaction(() => {
                exec(database, "UPDATE outbox SET claimed = 0, mutation_id = '' WHERE claimed = ?", [request.claim]);
                releaseUnreferencedAssets();
            });
            await persistDatabase();
            return undefined;
        case "clearOutbox":
            database.transaction(() => {
                exec(database, "DELETE FROM outbox WHERE claimed = ?", [request.claim]);
                releaseUnreferencedAssets();
            });
            await persistDatabase();
            return undefined;
        case "commitOutbox":
            database.transaction(() => {
                exec(database, "DELETE FROM outbox WHERE claimed = ?", [request.claim]);
                releaseUnreferencedAssets();
            });
            sync = {
                ...sync, revision: request.revision ?? sync.revision,
                dirty: sync.generation !== request.generation, seeded: true,
            };
            await persistDatabase();
            return undefined;
        case "applyRemote":
            return applyRemote(request.operations, request.revision, new Map(request.assets.map((asset) => [
                asset.assetId, { data: new Uint8Array(asset.data), mimeType: asset.mimeType },
            ])));
        case "advanceRevision":
            if (request.revision > sync.revision) {
                sync = { ...sync, revision: request.revision };
                await persistSync();
            }
            return undefined;
        case "pendingKeys":
            return outboxKeys();
        case "resetRemoteLog":
            // 화면을 마운트하기 전에 반영한 원격 배치는 화면의 초기 스냅샷에 이미 들어 있다.
            remoteSeq = 0;
            remoteLog = [];
            return undefined;
        case "seed":
            if (request.snapshot.board.boardId !== initialBoard.boardId) {
                throw new Error("Board ID mismatch.");
            }
            await adoptSnapshot(request.snapshot, request.revision);
            return readSnapshot(database, initialBoard.boardId);
        case "reset":
            await deleteIndexedDbDatabase();
            database.close();
            initialization = null;
            lastSaved = null;
            sync = { revision: 0, generation: 0, dirty: false, changedAt: 0 };
            return undefined;
    }
}

type BoardDbResult =
    | RemoteApplied
    | string[]
    | BoardSnapshot
    | ArrayBuffer
    | StoredBoard
    | OutboxState
    | OutboxBatch
    | StoredAsset
    | null
    | undefined;

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
