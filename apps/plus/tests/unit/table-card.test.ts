import { describe, expect, it } from "vitest";
import {
    createTableItemId,
    defaultTableSource,
    tableSourceSchema,
    tableSourceToMarkdown,
} from "@/lib/table-card";

describe("tableSourceSchema", () => {
    it("accepts a valid table source", () => {
        expect(tableSourceSchema.safeParse(defaultTableSource).success).toBe(true);
    });

    it("rejects empty columns and invalid cell values", () => {
        expect(tableSourceSchema.safeParse({ columns: [], rows: [] }).success).toBe(false);
        expect(tableSourceSchema.safeParse({
            columns: [{ id: "name", name: "Name" }],
            rows: [],
        }).success).toBe(false);
        expect(tableSourceSchema.safeParse({
            columns: [{ id: "name", name: "Name" }],
            rows: [{ id: "row-1", cells: { name: 1 } }],
        }).success).toBe(false);
    });
});

describe("createTableItemId", () => {
    it("creates unique ids without crypto.randomUUID", () => {
        const ids = new Set(Array.from({ length: 50 }, () => createTableItemId()));

        expect(ids.size).toBe(50);
    });
});

describe("tableSourceToMarkdown", () => {
    it("converts columns and rows to a GFM table", () => {
        expect(tableSourceToMarkdown({
            columns: [
                { id: "name", name: "Name" },
                { id: "role", name: "Role" },
            ],
            rows: [{ id: "row-1", cells: { name: "Kyu", role: "Admin" } }],
        })).toBe([
            "| Name | Role |",
            "| --- | --- |",
            "| Kyu | Admin |",
        ].join("\n"));
    });

    it("escapes pipes, converts line breaks, and fills missing cells", () => {
        expect(tableSourceToMarkdown({
            columns: [
                { id: "a", name: "A|B" },
                { id: "b", name: "B" },
            ],
            rows: [{ id: "row-1", cells: { a: "first\nsecond|third" } }],
        })).toContain("| first<br>second\\|third |  |");
    });
});
