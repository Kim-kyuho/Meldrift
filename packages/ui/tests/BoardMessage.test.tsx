import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BoardMessage from "../src/shared/BoardMessage";

describe("BoardMessage 동작", () => {
    afterEach(() => vi.useRealTimers());

    it("표시된 메시지를 3.5초 후에 닫는다", () => {
        vi.useFakeTimers();
        const onDismiss = vi.fn();
        render(
            <BoardMessage
                variant="toast"
                message="The board could not be saved."
                onDismiss={onDismiss}
            />
        );

        act(() => vi.advanceTimersByTime(3499));
        expect(onDismiss).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(1));
        expect(onDismiss).toHaveBeenCalledOnce();
    });

    it("토스트 위치 지정 없이 인라인 메시지를 렌더링한다", () => {
        render(<BoardMessage variant="inline" message="Invalid title." />);

        const message = screen.getByText("Invalid title.");
        expect(message.tagName).toBe("P");
        expect(message).not.toHaveClass("fixed");
    });
});
