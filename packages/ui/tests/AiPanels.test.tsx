import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AiChatPanel from "../src/features/ai/AiChatPanel";
import AiUnlockPanel from "../src/features/ai/AiUnlockPanel";

describe("AiChatPanel", () => {
    it("submits messages and exposes chat actions", () => {
        Object.defineProperty(HTMLElement.prototype, "scrollTo", {
            configurable: true,
            value: vi.fn(),
        });
        const onSend = vi.fn();
        const onSave = vi.fn();
        const onDiscard = vi.fn();
        const onLock = vi.fn();
        const onClose = vi.fn();

        render(
            <AiChatPanel
                messages={[{ role: "assistant", content: "Ready" }]}
                sending={false}
                saving={false}
                hasPendingCards
                onSend={onSend}
                onSave={onSave}
                onDiscard={onDiscard}
                onLock={onLock}
                onClose={onClose}
            />
        );

        fireEvent.change(screen.getByLabelText("AI assistant message"), { target: { value: "Create a memo" } });
        fireEvent.click(screen.getByRole("button", { name: "Send message" }));
        fireEvent.click(screen.getByRole("button", { name: "Save to board" }));
        fireEvent.click(screen.getByRole("button", { name: "Discard" }));
        fireEvent.click(screen.getByRole("button", { name: "Lock AI assistant" }));
        fireEvent.click(screen.getByRole("button", { name: "Close AI assistant" }));

        expect(onSend).toHaveBeenCalledWith("Create a memo");
        expect(onSave).toHaveBeenCalledOnce();
        expect(onDiscard).toHaveBeenCalledOnce();
        expect(onLock).toHaveBeenCalledOnce();
        expect(onClose).toHaveBeenCalledOnce();
    });
});

describe("AiUnlockPanel", () => {
    it("submits the password and clears the input", () => {
        const onUnlock = vi.fn();

        render(
            <AiUnlockPanel
                unlocking={false}
                errorMessage=""
                onUnlock={onUnlock}
                onClose={vi.fn()}
            />
        );

        const input = screen.getByLabelText("Assistant password");
        fireEvent.change(input, { target: { value: "secret" } });
        fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

        expect(onUnlock).toHaveBeenCalledWith("secret");
        expect(input).toHaveValue("");
    });
});
