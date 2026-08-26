import { describe, expect, it } from "vitest";
import {
    memoPlainText,
    nextMemoOrder,
    rankMemoOrders,
    reorderMemos,
    sortMemosByOrder,
} from "@/lib/memo-order";

const memo = (id: number, sortOrder: number) => ({ id, sortOrder });

const orderedIds = (memos: { id: number; sortOrder: number }[]) =>
    sortMemosByOrder(memos).map((item) => item.id);

describe("sortMemosByOrder", () => {
    it("sorts by order and keeps the input array untouched", () => {
        const memos = [memo(1, 3), memo(2, 1), memo(3, 2)];

        expect(orderedIds(memos)).toEqual([2, 3, 1]);
        expect(memos.map((item) => item.id)).toEqual([1, 2, 3]);
    });

    it("falls back to id when two memos share an order", () => {
        expect(orderedIds([memo(9, 1), memo(4, 1)])).toEqual([4, 9]);
    });
});

describe("nextMemoOrder", () => {
    it("continues after the highest order", () => {
        expect(nextMemoOrder([memo(1, 1), memo(2, 4)])).toBe(5);
    });

    it("starts at 1 on an empty board", () => {
        expect(nextMemoOrder([])).toBe(1);
    });
});

describe("rankMemoOrders", () => {
    const ranked = (rows: { id: number; storedOrder: number }[]) => [...rankMemoOrders(rows).entries()];

    it("falls back to id order when the file predates the order column", () => {
        expect(ranked([
            { id: 7, storedOrder: 0 },
            { id: 2, storedOrder: 0 },
            { id: 5, storedOrder: 0 },
        ])).toEqual([[2, 1], [5, 2], [7, 3]]);
    });

    it("closes gaps left by deleted memos", () => {
        expect(ranked([
            { id: 1, storedOrder: 2 },
            { id: 2, storedOrder: 9 },
            { id: 3, storedOrder: 5 },
        ])).toEqual([[1, 1], [3, 2], [2, 3]]);
    });

    it("breaks ties by id so the numbering never wobbles", () => {
        expect(ranked([
            { id: 9, storedOrder: 1 },
            { id: 4, storedOrder: 1 },
        ])).toEqual([[4, 1], [9, 2]]);
    });

    it("returns nothing for an empty board", () => {
        expect(ranked([])).toEqual([]);
    });
});

describe("reorderMemos", () => {
    const memos = [memo(1, 1), memo(2, 2), memo(3, 3), memo(4, 4)];

    it("gives a memo a smaller order and adds one to the memos in between", () => {
        const next = reorderMemos(memos, 4, 1);

        expect(orderedIds(next)).toEqual([1, 4, 2, 3]);
        expect(next).toEqual([memo(1, 1), memo(2, 3), memo(3, 4), memo(4, 2)]);
    });

    it("gives a memo a larger order and subtracts one from the memos in between", () => {
        const next = reorderMemos(memos, 1, 2);

        expect(orderedIds(next)).toEqual([2, 3, 1, 4]);
        expect(next).toEqual([memo(1, 3), memo(2, 1), memo(3, 2), memo(4, 4)]);
    });

    it("keeps the array order so the document order does not change", () => {
        expect(reorderMemos(memos, 4, 0).map((item) => item.id)).toEqual([1, 2, 3, 4]);
    });

    it("keeps every order unique when the numbers have gaps", () => {
        const gapped = [memo(1, 1), memo(2, 3), memo(3, 7)];
        const next = reorderMemos(gapped, 3, 0);

        expect(orderedIds(next)).toEqual([3, 1, 2]);
        expect(new Set(next.map((item) => item.sortOrder)).size).toBe(3);
    });

    it("returns the same list for a no-op or an unknown memo", () => {
        expect(reorderMemos(memos, 2, 1)).toBe(memos);
        expect(reorderMemos(memos, 99, 0)).toBe(memos);
        expect(reorderMemos(memos, 1, 4)).toBe(memos);
        expect(reorderMemos(memos, 1, -1)).toBe(memos);
    });
});

describe("memoPlainText", () => {
    it("collapses memo HTML into a single preview line", () => {
        expect(memoPlainText("<h1>Title</h1><p>Body   text</p>")).toBe("Title Body text");
    });

    it("returns an empty string for an empty memo", () => {
        expect(memoPlainText("<p></p>")).toBe("");
    });
});
