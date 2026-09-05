import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BoardMessage from "../src/shared/BoardMessage";

describe("BoardMessage", () => {
    afterEach(() => vi.useRealTimers());

    it("dismisses a visible message after 3.5 seconds", () => {
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

    it("renders inline messages without toast positioning", () => {
        render(<BoardMessage variant="inline" message="Invalid title." />);

        const message = screen.getByText("Invalid title.");
        expect(message.tagName).toBe("P");
        expect(message).not.toHaveClass("fixed");
    });
});
