import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBoardMemoFocus } from "@meldrift/ui/useBoardMemoFocus";

describe("useBoardMemoFocus 동작", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        Object.defineProperty(Element.prototype, "scrollIntoView", {
            configurable: true,
            value: vi.fn(),
        });
    });

    afterEach(() => vi.useRealTimers());

    it("처음에 순서상 첫 메모에 초점을 맞추고 표시 영역으로 스크롤한다", () => {
        const target = document.createElement("div");
        target.className = "memo-rnd-2";
        document.body.appendChild(target);

        const { result } = renderHook(() =>
            useBoardMemoFocus([{ id: 8, sortOrder: 2 }, { id: 2, sortOrder: 1 }]));
        act(() => vi.runAllTimers());

        expect(result.current.focusedMemoId).toBe(2);
        expect(target.scrollIntoView).toHaveBeenCalledWith({
            behavior: "smooth",
            block: "center",
            inline: "center",
        });
    });

    it("메모 사이를 이동하고 양쪽 경계를 알린다", () => {
        const { result } = renderHook(() =>
            useBoardMemoFocus([{ id: 1, sortOrder: 1 }, { id: 3, sortOrder: 2 }]));
        act(() => vi.runAllTimers());

        act(() => result.current.handleFocusNextMemo());
        expect(result.current.focusedMemoId).toBe(3);
        act(() => result.current.handleFocusNextMemo());
        expect(result.current.memoMessage).toBe("Next memo does not exist.");

        act(() => result.current.handleFocusPrevMemo());
        expect(result.current.focusedMemoId).toBe(1);
        act(() => result.current.handleFocusPrevMemo());
        expect(result.current.memoMessage).toBe("Prev memo does not exist.");
    });

    it("메모가 없는 탐색 상태를 알린다", () => {
        const { result } = renderHook(() => useBoardMemoFocus([]));

        act(() => result.current.handleFocusPrevMemo());
        expect(result.current.memoMessage).toBe("No memos exist.");
        act(() => result.current.handleFocusNextMemo());
        expect(result.current.memoMessage).toBe("No memo exist.");
    });

    it("정렬된 메모 번호로 초점을 이동하고 잘못된 번호를 알린다", () => {
        const { result } = renderHook(() =>
            useBoardMemoFocus([{ id: 8, sortOrder: 3 }, { id: 2, sortOrder: 1 }, { id: 5, sortOrder: 2 }]));
        act(() => vi.runAllTimers());

        act(() => result.current.focusMemoByOrder(2));
        expect(result.current.focusedMemoId).toBe(5);
        expect(result.current.focusedMemoOrder).toBe(2);
        expect(result.current.memoCount).toBe(3);

        act(() => result.current.focusMemoByOrder(4));
        expect(result.current.memoMessage).toBe("Memo does not exist.");
        expect(result.current.focusedMemoId).toBe(5);
    });

    it("식별자가 아니라 메모 순서대로 연번을 부여한다", () => {
        const { result } = renderHook(() =>
            useBoardMemoFocus([{ id: 1, sortOrder: 3 }, { id: 2, sortOrder: 1 }, { id: 3, sortOrder: 2 }]));
        act(() => vi.runAllTimers());

        expect(result.current.focusedMemoId).toBe(2);

        act(() => result.current.focusMemoByOrder(3));
        expect(result.current.focusedMemoId).toBe(1);
    });
});
