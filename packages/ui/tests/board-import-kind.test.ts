import { describe, expect, it } from "vitest";
import { detectBoardImportKind } from "../src/features/board/board-import-kind";

function makeFile(name: string, content: string | Uint8Array, type = "") {
    const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
    const slice = (start = 0, end = bytes.byteLength) => ({
        arrayBuffer: async () => bytes.slice(start, end).buffer,
    }) as Blob;
    return {
        name,
        type,
        slice,
        arrayBuffer: async () => bytes.slice().buffer,
    };
}

describe("detectBoardImportKind", () => {
    it("detects SQLite files by magic header even if named .md", async () => {
        const file = makeFile("fake.md", "SQLite format 3\0extra-bytes", "text/markdown");
        expect(await detectBoardImportKind(file)).toBe("sqlite");
    });

    it("detects Markdown files by extension", async () => {
        expect(await detectBoardImportKind(makeFile("notes.md", "# Hello"))).toBe("markdown");
        expect(await detectBoardImportKind(makeFile("DOC.MARKDOWN", "# Hello"))).toBe("markdown");
    });

    it("detects Markdown files by MIME type", async () => {
        expect(await detectBoardImportKind(makeFile("notes.txt", "# Hello", "text/markdown"))).toBe("markdown");
    });

    it("falls back to sqlite for unknown extensions", async () => {
        expect(await detectBoardImportKind(makeFile("board.sqlite", "not-sqlite"))).toBe("sqlite");
    });
});
