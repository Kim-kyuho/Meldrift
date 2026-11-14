import { describe, expect, it } from "vitest";
import {
    memoPlainText,
    nextMemoOrder,
    rankMemoOrders,
    reorderMemos,
    sortMemosByOrder,
} from "@meldrift/core/memo-order";

const memo = (id: number, sortOrder: number) => ({ id, sortOrder });

const orderedIds = (memos: { id: number; sortOrder: number }[]) =>
    sortMemosByOrder(memos).map((item) => item.id);

describe("sortMemosByOrder 동작", () => {
    it("원본 배열을 변경하지 않고 메모 순서대로 정렬한다", () => {
        const memos = [memo(1, 3), memo(2, 1), memo(3, 2)];

        expect(orderedIds(memos)).toEqual([2, 3, 1]);
        expect(memos.map((item) => item.id)).toEqual([1, 2, 3]);
    });

    it("메모 순서가 같으면 식별자로 정렬한다", () => {
        expect(orderedIds([memo(9, 1), memo(4, 1)])).toEqual([4, 9]);
    });
});

describe("nextMemoOrder 동작", () => {
    it("가장 큰 순서 값 다음부터 이어간다", () => {
        expect(nextMemoOrder([memo(1, 1), memo(2, 4)])).toBe(5);
    });

    it("빈 보드에서는 1부터 시작한다", () => {
        expect(nextMemoOrder([])).toBe(1);
    });
});

describe("rankMemoOrders 동작", () => {
    const ranked = (rows: { id: number; storedOrder: number }[]) => [...rankMemoOrders(rows).entries()];

    it("순서 열이 없는 구버전 파일은 식별자 순서로 처리한다", () => {
        expect(ranked([
            { id: 7, storedOrder: 0 },
            { id: 2, storedOrder: 0 },
            { id: 5, storedOrder: 0 },
        ])).toEqual([[2, 1], [5, 2], [7, 3]]);
    });

    it("메모 삭제로 생긴 순서의 빈틈을 없앤다", () => {
        expect(ranked([
            { id: 1, storedOrder: 2 },
            { id: 2, storedOrder: 9 },
            { id: 3, storedOrder: 5 },
        ])).toEqual([[1, 1], [3, 2], [2, 3]]);
    });

    it("순서가 같으면 식별자로 정렬해 연번을 일정하게 유지한다", () => {
        expect(ranked([
            { id: 9, storedOrder: 1 },
            { id: 4, storedOrder: 1 },
        ])).toEqual([[4, 1], [9, 2]]);
    });

    it("빈 보드에서는 빈 결과를 반환한다", () => {
        expect(ranked([])).toEqual([]);
    });
});

describe("reorderMemos 동작", () => {
    const memos = [memo(1, 1), memo(2, 2), memo(3, 3), memo(4, 4)];

    it("메모를 앞으로 옮기고 사이에 있는 메모의 순서를 1씩 늘린다", () => {
        const next = reorderMemos(memos, 4, 1);

        expect(orderedIds(next)).toEqual([1, 4, 2, 3]);
        expect(next).toEqual([memo(1, 1), memo(2, 3), memo(3, 4), memo(4, 2)]);
    });

    it("메모를 뒤로 옮기고 사이에 있는 메모의 순서를 1씩 줄인다", () => {
        const next = reorderMemos(memos, 1, 2);

        expect(orderedIds(next)).toEqual([2, 3, 1, 4]);
        expect(next).toEqual([memo(1, 3), memo(2, 1), memo(3, 2), memo(4, 4)]);
    });

    it("문서 순서가 바뀌지 않도록 배열 순서를 유지한다", () => {
        expect(reorderMemos(memos, 4, 0).map((item) => item.id)).toEqual([1, 2, 3, 4]);
    });

    it("순서 값에 빈틈이 있어도 중복 없이 재정렬한다", () => {
        const gapped = [memo(1, 1), memo(2, 3), memo(3, 7)];
        const next = reorderMemos(gapped, 3, 0);

        expect(orderedIds(next)).toEqual([3, 1, 2]);
        expect(new Set(next.map((item) => item.sortOrder)).size).toBe(3);
    });

    it("변경이 없거나 알 수 없는 메모이면 같은 목록을 반환한다", () => {
        expect(reorderMemos(memos, 2, 1)).toBe(memos);
        expect(reorderMemos(memos, 99, 0)).toBe(memos);
        expect(reorderMemos(memos, 1, 4)).toBe(memos);
        expect(reorderMemos(memos, 1, -1)).toBe(memos);
    });
});

describe("memoPlainText 동작", () => {
    it("메모 HTML을 한 줄의 미리보기 텍스트로 변환한다", () => {
        expect(memoPlainText("<h1>Title</h1><p>Body   text</p>")).toBe("Title Body text");
    });

    it("빈 메모이면 빈 문자열을 반환한다", () => {
        expect(memoPlainText("<p></p>")).toBe("");
    });
});
