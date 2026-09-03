import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useBoardSearch } from "../src/hooks/useBoardSearch";

const memos = [
    { id: 1, content: "Alpha memo", sortOrder: 1 },
    { id: 2, content: "Beta alpha", sortOrder: 2 },
    { id: 3, content: "Gamma", sortOrder: 3 },
];

describe("useBoardSearch", () => {
    it("filters case-insensitively and focuses the first match", () => {
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

    it("cycles through next and previous results", () => {
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

    it("walks results in the order the user set, not the order memos were made", () => {
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

    it("reports an empty result set", () => {
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
