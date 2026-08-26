import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { GET } from "@/app/api/boards/[boardId]/markdown/route";

// 문서 순서는 메모의 sort_order다. 판정식이 Free Edition의 compileBoardMarkdown과 같아야 한다.

const mocks = vi.hoisted(() => ({
    getDb: vi.fn(),
    execute: vi.fn(),
    limit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: mocks.getDb }));

const params = (boardId: string) => Promise.resolve({ boardId });

const renderedSql = () =>
    new PgDialect().sqlToQuery(mocks.execute.mock.calls[0][0] as SQL).sql.replace(/\s+/g, " ").trim();

describe("GET /api/boards/[boardId]/markdown", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.limit.mockResolvedValue([{ boardId: 7 }]);
        mocks.execute.mockResolvedValue({ rows: [] });
        mocks.getDb.mockReturnValue({
            select: vi.fn(() => ({
                from: vi.fn(() => ({
                    where: vi.fn(() => ({ limit: mocks.limit })),
                })),
            })),
            execute: mocks.execute,
        });
    });

    it("메모를 sort_order 순으로 정렬하고 id로 가른다", async () => {
        const response = await GET(new Request("http://localhost"), { params: params("7") });

        expect(response.status).toBe(200);
        expect(renderedSql()).toContain(
            "ORDER BY memo.memo_sort_order ASC, memo.memo_id ASC, card.corner_order ASC"
        );
    });

    it("정렬에 쓰는 sort_order를 메모 CTE에서 함께 읽는다", async () => {
        await GET(new Request("http://localhost"), { params: params("7") });

        expect(renderedSql()).toContain("sort_order AS memo_sort_order");
    });

    it("메모 꼭짓점을 엄격히 포함하는 카드만 고른다", async () => {
        await GET(new Request("http://localhost"), { params: params("7") });

        const sql = renderedSql();
        expect(sql).toContain("ON card.x < corner.corner_x AND corner.corner_x < card.x + card.width");
        expect(sql).toContain("AND card.y < corner.corner_y AND corner.corner_y < card.y + card.height");
    });

    it("메모를 받은 순서대로 이어 붙인다", async () => {
        mocks.execute.mockResolvedValue({
            rows: [
                { memo_id: 3, memo_content: "<p>First</p>", corner_order: null, card_type: null, card_id: null, card_content: null, card_label: null },
                { memo_id: 1, memo_content: "<p>Second</p>", corner_order: null, card_type: null, card_id: null, card_content: null, card_label: null },
            ],
        });

        const response = await GET(new Request("http://localhost"), { params: params("7") });
        const data = await response.json();

        expect(data.markdown).toBe("First\n\nSecond");
    });

    it("보드가 없으면 404를 돌려준다", async () => {
        mocks.limit.mockResolvedValue([]);

        const response = await GET(new Request("http://localhost"), { params: params("7") });

        expect(response.status).toBe(404);
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it("보드 id가 양의 정수가 아니면 400을 돌려준다", async () => {
        const response = await GET(new Request("http://localhost"), { params: params("0") });

        expect(response.status).toBe(400);
        expect(mocks.getDb).not.toHaveBeenCalled();
    });
});
