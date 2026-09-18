import type { Database, SqlValue } from "@sqlite.org/sqlite-wasm";
import { parseBoardSnapshot, schemaVersion, type BoardSnapshot } from "./board-state";
import { rankMemoOrders } from "@meldrift/core/memo-order";

export const schemaSql = `
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
        sort_order INTEGER NOT NULL DEFAULT 0,
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

export const isSupportedVersion = (version: number) =>
    Number.isInteger(version) && version >= 1 && version <= schemaVersion;

export function migrateDatabase(db: Database) {
    const version = Number(db.selectValue("PRAGMA user_version"));
    if (version === schemaVersion) {
        db.exec(schemaSql);
        return;
    }
    if (!isSupportedVersion(version)) {
        throw new Error(`Unsupported browser database version: ${version}.`);
    }

    db.transaction(() => {
        if (version < 2) {
            exec(db, "ALTER TABLE images ADD COLUMN image_data BLOB");
            exec(db, "ALTER TABLE images ADD COLUMN mime_type TEXT");
        }
        if (version < 3) {
            // 기존 보드는 id 순서가 곧 탐색 순서였다. 그 순서를 그대로 옮겨 담는다.
            exec(db, "ALTER TABLE memos ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0");
            exec(db, "UPDATE memos SET sort_order = id");
        }
        exec(db, `PRAGMA user_version = ${schemaVersion}`);
    });
    db.exec(schemaSql);
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

export function readSnapshot(db: Database, boardId = 1): BoardSnapshot {
    const boardRow = db.selectObject(
        "SELECT board_id, title, width, height FROM boards WHERE board_id = ?",
        [boardId],
    );
    if (!boardRow) throw new Error("The default board is missing from the SQLite file.");

    // 배열 순서는 생성 순서(id)로 유지한다. 화면 순서와 문서 순서는 sort_order가 정한다.
    const memoColumns = new Set(db.selectObjects("PRAGMA table_info(memos)").map((row) => String(row.name)));
    const hasMemoOrderColumn = memoColumns.has("sort_order");
    const memoRows = db.selectObjects(
        hasMemoOrderColumn
            ? "SELECT id, board_id, content, x, y, z, width, height, color, sort_order FROM memos WHERE board_id = ? ORDER BY id"
            : "SELECT id, board_id, content, x, y, z, width, height, color FROM memos WHERE board_id = ? ORDER BY id",
        [boardId],
    );
    const memoOrderById = rankMemoOrders(memoRows.map((row) => ({
        id: numberValue(row.id),
        storedOrder: hasMemoOrderColumn ? numberValue(row.sort_order) : 0,
    })));
    const memos = memoRows.map((row) => ({
        id: numberValue(row.id), boardId: numberValue(row.board_id), content: stringValue(row.content),
        x: numberValue(row.x), y: numberValue(row.y), z: numberValue(row.z),
        width: numberValue(row.width), height: numberValue(row.height), color: stringValue(row.color),
        sortOrder: memoOrderById.get(numberValue(row.id)) ?? 1,
    }));

    const imageColumns = new Set(db.selectObjects("PRAGMA table_info(images)").map((row) => String(row.name)));
    const hasImageBlobColumns = imageColumns.has("image_data") && imageColumns.has("mime_type");
    const images = db.selectObjects(
        hasImageBlobColumns
            ? "SELECT image_id, board_id, url, image_data, mime_type, label, x, y, z, width, height FROM images WHERE board_id = ? ORDER BY image_id"
            : "SELECT image_id, board_id, url, label, x, y, z, width, height FROM images WHERE board_id = ? ORDER BY image_id",
        [boardId],
    ).map((row) => ({
        imageId: numberValue(row.image_id), boardId: numberValue(row.board_id), url: stringValue(row.url),
        data: !hasImageBlobColumns || row.image_data === null ? null : bytesValue(row.image_data),
        mimeType: !hasImageBlobColumns || row.mime_type === null ? null : stringValue(row.mime_type),
        label: row.label === null ? null : stringValue(row.label), x: numberValue(row.x), y: numberValue(row.y),
        z: numberValue(row.z), width: numberValue(row.width), height: numberValue(row.height),
    }));

    const mermaids = db.selectObjects(
        "SELECT mermaid_id, board_id, source, x, y, z, width, height FROM mermaids WHERE board_id = ? ORDER BY mermaid_id",
        [boardId],
    ).map((row) => ({
        id: numberValue(row.mermaid_id), boardId: numberValue(row.board_id), source: stringValue(row.source),
        x: numberValue(row.x), y: numberValue(row.y), z: numberValue(row.z),
        width: numberValue(row.width), height: numberValue(row.height),
    }));

    const tables = db.selectObjects(
        "SELECT table_id, board_id, source, x, y, z, width, height FROM tables WHERE board_id = ? ORDER BY table_id",
        [boardId],
    ).map((row) => ({
        id: numberValue(row.table_id), boardId: numberValue(row.board_id), source: JSON.parse(stringValue(row.source)),
        x: numberValue(row.x), y: numberValue(row.y), z: numberValue(row.z),
        width: numberValue(row.width), height: numberValue(row.height),
    }));

    const drawingRow = db.selectObject("SELECT source FROM drawings WHERE board_id = ?", [boardId]);
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

export function replaceSnapshot(db: Database, value: BoardSnapshot) {
    const snapshot = parseBoardSnapshot(value);
    db.transaction(() => {
        exec(db, "DELETE FROM boards");
        exec(db, "INSERT INTO boards (board_id, title, width, height) VALUES (?, ?, ?, ?)", [
            snapshot.board.boardId, snapshot.board.title, snapshot.board.width, snapshot.board.height,
        ]);
        snapshot.memos.forEach((memo) => exec(db,
            "INSERT INTO memos (id, board_id, content, x, y, z, width, height, color, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                memo.id, memo.boardId, memo.content, memo.x, memo.y, memo.z,
                memo.width, memo.height, memo.color, memo.sortOrder,
            ],
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
