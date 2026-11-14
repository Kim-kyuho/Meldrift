import { describe, expect, it } from "vitest";
import {
    createTableItemId,
    defaultTableSource,
    tableSourceSchema,
    tableSourceToMarkdown,
} from "../src/table-card";

describe("tableSourceSchema 동작", () => {
    it("유효한 표 소스를 허용한다", () => {
        expect(tableSourceSchema.safeParse(defaultTableSource).success).toBe(true);
    });

    it("저장된 행 높이를 유지한다", () => {
        const parsed = tableSourceSchema.parse({
            columns: [{ id: "name", name: "Name" }],
            rows: [{ id: "row-1", cells: { name: "Kyu" }, height: 64 }],
        });

        expect(parsed.rows[0].height).toBe(64);
        expect(tableSourceSchema.safeParse({
            columns: [{ id: "name", name: "Name" }],
            rows: [{ id: "row-1", cells: { name: "Kyu" }, height: 0 }],
        }).success).toBe(false);
    });

    it("빈 열 목록과 잘못된 셀 값을 거부한다", () => {
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

describe("createTableItemId 동작", () => {
    it("crypto.randomUUID 없이 고유 식별자를 생성한다", () => {
        const ids = new Set(Array.from({ length: 50 }, () => createTableItemId()));

        expect(ids.size).toBe(50);
    });
});

describe("tableSourceToMarkdown 동작", () => {
    it("열과 행을 GFM 표로 변환한다", () => {
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

    it("파이프 문자를 이스케이프하고 줄바꿈을 변환하며 누락된 셀을 채운다", () => {
        expect(tableSourceToMarkdown({
            columns: [
                { id: "a", name: "A|B" },
                { id: "b", name: "B" },
            ],
            rows: [{ id: "row-1", cells: { a: "first\nsecond|third" } }],
        })).toContain("| first<br>second\\|third |  |");
    });
});
