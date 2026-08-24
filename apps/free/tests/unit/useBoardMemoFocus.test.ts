import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBoardMemoFocus } from "@/hooks/useBoardMemoFocus";

describe("useBoardMemoFocus", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        Object.defineProperty(Element.prototype, "scrollIntoView", {
            configurable: true,
            value: vi.fn(),
        });
    });

    afterEach(() => vi.useRealTimers());

    it("focuses the lowest memo id initially and scrolls it into view", () => {
        const target = document.createElement("div");
        target.className = "memo-rnd-2";
        document.body.appendChild(target);

        const { result } = renderHook(() => useBoardMemoFocus([{ id: 8 }, { id: 2 }]));
        act(() => vi.runAllTimers());

        expect(result.current.focusedMemoId).toBe(2);
        expect(target.scrollIntoView).toHaveBeenCalledWith({
            behavior: "smooth",
            block: "center",
            inline: "center",
        });
    });

    it("moves between memos and reports both boundaries", () => {
        const { result } = renderHook(() => useBoardMemoFocus([{ id: 1 }, { id: 3 }]));
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

    it("reports empty memo navigation", () => {
        const { result } = renderHook(() => useBoardMemoFocus([]));

        act(() => result.current.handleFocusPrevMemo());
        expect(result.current.memoMessage).toBe("No memos exist.");
        act(() => result.current.handleFocusNextMemo());
        expect(result.current.memoMessage).toBe("No memo exist.");
    });

    it("focuses a memo by its sorted number and reports an invalid number", () => {
        const { result } = renderHook(() => useBoardMemoFocus([{ id: 8 }, { id: 2 }, { id: 5 }]));
        act(() => vi.runAllTimers());

        act(() => result.current.focusMemoByOrder(2));
        expect(result.current.focusedMemoId).toBe(5);
        expect(result.current.focusedMemoOrder).toBe(2);
        expect(result.current.memoCount).toBe(3);

        act(() => result.current.focusMemoByOrder(4));
        expect(result.current.memoMessage).toBe("Memo does not exist.");
        expect(result.current.focusedMemoId).toBe(5);
    });
});
