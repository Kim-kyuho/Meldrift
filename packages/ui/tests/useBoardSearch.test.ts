import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useBoardSearch } from "../src/features/board/useBoardSearch";

const memos = [
    { id: 1, content: "Alpha memo", sortOrder: 1 },
    { id: 2, content: "Beta alpha", sortOrder: 2 },
    { id: 3, content: "Gamma", sortOrder: 3 },
];

describe("useBoardSearch 동작", () => {
    it("대소문자를 구분하지 않고 검색해 첫 결과에 초점을 맞춘다", () => {
        const focusMemoById = vi.fn();
        const { result } = renderHook(() => useBoardSearch({
            memos,
            focusMemoById,
            setMemoMessage: vi.fn(),
        }));

        act(() => result.current.handleSearchTextChange(" ALPHA "));

        expect(result.current.searchResults.map((memo) => memo.id)).toEqual([1, 2]);
        expect(focusMemoById).toHaveBeenCalledWith(1);
        expect(result.current.searchIndex).toBe(0);
    });

    it("이전·다음 결과를 순환한다", () => {
        const focusMemoById = vi.fn();
        const { result } = renderHook(() => useBoardSearch({
            memos,
            focusMemoById,
            setMemoMessage: vi.fn(),
        }));

        act(() => result.current.handleSearchTextChange("alpha"));
        act(() => result.current.handleSearchNext());
        expect(result.current.searchIndex).toBe(1);
        expect(focusMemoById).toHaveBeenLastCalledWith(2);

        act(() => result.current.handleSearchNext());
        expect(result.current.searchIndex).toBe(0);
        expect(focusMemoById).toHaveBeenLastCalledWith(1);

        act(() => result.current.handleSearchPrev());
        expect(result.current.searchIndex).toBe(1);
        expect(focusMemoById).toHaveBeenLastCalledWith(2);
    });

    it("메모 생성 순서가 아니라 사용자가 지정한 순서대로 결과를 탐색한다", () => {
        const focusMemoById = vi.fn();
        // 배열 순서(생성 순서)와 사용자가 정한 순서가 어긋난 보드.
        const reordered = [
            { id: 1, content: "Alpha memo", sortOrder: 3 },
            { id: 2, content: "Beta alpha", sortOrder: 1 },
        ];
        const { result } = renderHook(() => useBoardSearch({
            memos: reordered,
            focusMemoById,
            setMemoMessage: vi.fn(),
        }));

        act(() => result.current.handleSearchTextChange("alpha"));

        expect(result.current.searchResults.map((memo) => memo.id)).toEqual([2, 1]);
        expect(focusMemoById).toHaveBeenCalledWith(2);
    });

    it("검색 결과가 없음을 알린다", () => {
        const setMemoMessage = vi.fn();
        const { result } = renderHook(() => useBoardSearch({
            memos,
            focusMemoById: vi.fn(),
            setMemoMessage,
        }));

        act(() => result.current.handleSearchTextChange("missing"));
        act(() => result.current.handleSearchNext());
        act(() => result.current.handleSearchPrev());

        expect(setMemoMessage).toHaveBeenCalledTimes(2);
        expect(setMemoMessage).toHaveBeenCalledWith("No search results.");
    });
});
