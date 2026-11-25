import { describe, expect, it } from "vitest";
import { resolveMemoCornerLinks } from "@meldrift/core/cards";
import { compileBoardMarkdown } from "../src/board-markdown";
import {
    importMarkdownToBoard,
    parseMarkdownToSections,
} from "../src/board-markdown-import";
import { defaultBoard } from "../src/board-state";

describe("parseMarkdownToSections", () => {
    it("splits ATX headings (# ~ ######) into separate sections while ignoring # inside fenced code blocks", () => {
        const md = [
            "Intro paragraph before first heading.",
            "",
            "# Section 1",
            "Body 1",
            "```bash",
            "# This comment is NOT a heading",
            "echo hello",
            "```",
            "",
            "###### Section 6",
            "Deep section",
        ].join("\n");

        const sections = parseMarkdownToSections(md);
        expect(sections).toHaveLength(3);
        expect(sections[0].headingLevel).toBeNull();
        expect(sections[0].markdown).toContain("Intro paragraph");
        expect(sections[1].headingLevel).toBe(1);
        expect(sections[1].markdown).toContain("# This comment is NOT a heading");
        expect(sections[2].headingLevel).toBe(6);
        expect(sections[2].headingTitle).toBe("Section 6");
    });

    it("extracts GFM tables and mermaid blocks as attachments while preserving non-mermaid code blocks", () => {
        const md = [
            "## Architecture",
            "Overview text",
            "",
            "| Name | Value |",
            "| --- | ---: |",
            "| Alpha \\| One | Line1<br>Line2 |",
            "| Beta | Two |",
            "",
            "```mermaid",
            "flowchart LR",
            "  A --> B",
            "```",
            "",
            "```ts",
            "const x = 1;",
            "```",
        ].join("\n");

        const sections = parseMarkdownToSections(md);
        expect(sections).toHaveLength(1);
        expect(sections[0].attachments).toHaveLength(2);

        const table = sections[0].attachments[0];
        expect(table.type).toBe("table");
        if (table.type === "table") {
            expect(table.source.columns.map((c) => c.name)).toEqual(["Name", "Value"]);
            expect(table.source.rows).toHaveLength(2);
            const [col0, col1] = table.source.columns;
            expect(table.source.rows[0].cells[col0.id]).toBe("Alpha | One");
            expect(table.source.rows[0].cells[col1.id]).toBe("Line1\nLine2");
        }

        const mermaid = sections[0].attachments[1];
        expect(mermaid.type).toBe("mermaid");
        if (mermaid.type === "mermaid") {
            expect(mermaid.source).toBe("flowchart LR\n  A --> B");
        }

        expect(sections[0].markdown).toContain("Overview text");
        expect(sections[0].markdown).toContain("const x = 1;");
        expect(sections[0].markdown).not.toContain("Alpha");
        expect(sections[0].markdown).not.toContain("flowchart LR");
    });
});

describe("importMarkdownToBoard", () => {
    it("places table and mermaid cards within 50px memo corners and preserves order on Markdown round-trip", () => {
        const md = [
            "# Overview",
            "First memo summary.",
            "",
            "| Key | Role |",
            "| --- | --- |",
            "| A | First |",
            "",
            "```mermaid",
            "flowchart TD",
            "  Start --> End",
            "```",
            "",
            "## Next Step",
            "Second memo body.",
        ].join("\n");

        const { snapshot, stats, droppedSections } = importMarkdownToBoard(md, defaultBoard);
        expect(droppedSections).toBe(0);
        expect(stats).toEqual({ memos: 2, tables: 1, mermaids: 1 });
        expect(snapshot.memos.map((m) => m.sortOrder)).toEqual([1, 2]);

        const links = resolveMemoCornerLinks(snapshot.memos, [
            ...snapshot.tables.map((t) => ({ type: "table" as const, id: t.id, x: t.x, y: t.y, z: t.z, width: t.width, height: t.height })),
            ...snapshot.mermaids.map((d) => ({ type: "mermaid" as const, id: d.id, x: d.x, y: d.y, z: d.z, width: d.width, height: d.height })),
        ]);
        expect(links).toHaveLength(2);
        expect(links.every((link) => link.memoId === snapshot.memos[0].id)).toBe(true);

        const recompiled = compileBoardMarkdown(snapshot);
        const idxOverview = recompiled.indexOf("# Overview");
        const idxTable = recompiled.indexOf("| Key | Role |");
        const idxMermaid = recompiled.indexOf("```mermaid");
        const idxNext = recompiled.indexOf("## Next Step");
        expect(idxOverview).toBeGreaterThanOrEqual(0);
        expect(idxTable).toBeGreaterThan(idxOverview);
        expect(idxMermaid).toBeGreaterThan(idxTable);
        expect(idxNext).toBeGreaterThan(idxMermaid);
    });

    it("auto-splits sections with more than 4 attachments into continuation memo cards", () => {
        const blocks = [
            "# Heavy Section",
            "```mermaid\nflowchart LR\n  A1 --> B1\n```",
            "```mermaid\nflowchart LR\n  A2 --> B2\n```",
            "```mermaid\nflowchart LR\n  A3 --> B3\n```",
            "```mermaid\nflowchart LR\n  A4 --> B4\n```",
            "```mermaid\nflowchart LR\n  A5 --> B5\n```",
        ].join("\n\n");

        const { snapshot, stats } = importMarkdownToBoard(blocks, defaultBoard);
        expect(stats.memos).toBe(2);
        expect(stats.mermaids).toBe(5);
        expect(snapshot.memos[1].content).toContain("Heavy Section (2)");

        const recompiled = compileBoardMarkdown(snapshot);
        expect(recompiled).toContain("A1 --> B1");
        expect(recompiled).toContain("A5 --> B5");
    });

    it("escapes raw HTML in imported Markdown to prevent XSS", () => {
        const md = "# Safe\n\n<script>alert(1)</script><img src=x onerror=alert(2)>";
        const { snapshot } = importMarkdownToBoard(md, defaultBoard);
        expect(snapshot.memos[0].content).not.toContain("<script>");
        expect(snapshot.memos[0].content).not.toContain("<img");
        expect(snapshot.memos[0].content).toContain("&lt;script&gt;");
    });

    it("throws on empty Markdown input", () => {
        expect(() => importMarkdownToBoard("   \n\t  ", defaultBoard)).toThrow("The Markdown file is empty.");
    });
});
