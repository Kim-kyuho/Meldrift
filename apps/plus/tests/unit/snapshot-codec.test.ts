import { describe, expect, it } from "vitest";
import initSqlJs from "sql.js/dist/sql-asm.js";
import { schemaSql } from "@meldrift/board-data/sqlite-codec";
import { decodeSnapshot } from "@/lib/snapshot-codec";

async function fixture() {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.exec(schemaSql);
    db.run("INSERT INTO boards (board_id, title, width, height) VALUES (7, 'Board', 7680, 4320)");
    return db;
}

describe("서버 SQLite 검증", () => {
    it("보드와 이미지 바이너리를 직렬화한 뒤 복원한다", async () => {
        const db = await fixture();
        db.run("INSERT INTO images (board_id, image_data, mime_type, width, height) VALUES (7, ?, 'image/png', 100, 100)", [new Uint8Array([1, 2, 3])]);
        try {
            const snapshot = await decodeSnapshot(db.export(), 7);
            expect(snapshot.board.boardId).toBe(7);
            expect(Array.from(snapshot.images[0].data!)).toEqual([1, 2, 3]);
        } finally {
            db.close();
        }
    });
    it("보드 식별자 불일치를 거부한다", async () => {
        const db = await fixture();
        try {
            await expect(decodeSnapshot(db.export(), 8)).rejects.toThrow();
        } finally {
            db.close();
        }
    });
    it("여러 보드가 포함된 데이터를 거부한다", async () => {
        const db = await fixture();
        db.run("INSERT INTO boards (board_id, title, width, height) VALUES (8, 'Other', 100, 100)");
        try {
            await expect(decodeSnapshot(db.export(), 7)).rejects.toThrow("one board");
        } finally {
            db.close();
        }
    });
    it("서버 스냅샷에서 URL만 있는 이미지를 거부한다", async () => {
        const db = await fixture();
        db.run("INSERT INTO images (board_id, url) VALUES (7, 'https://example.com/image.png')");
        try {
            await expect(decodeSnapshot(db.export(), 7)).rejects.toThrow("binary data");
        } finally {
            db.close();
        }
    });
    it("형식이 잘못되었거나 크기를 초과한 업로드를 거부한다", async () => {
        await expect(decodeSnapshot(new Uint8Array([1, 2, 3]), 7)).rejects.toThrow("Invalid SQLite");
        await expect(decodeSnapshot(new Uint8Array(4 * 1024 * 1024 + 1), 7)).rejects.toThrow("4 MiB");
    });
});
