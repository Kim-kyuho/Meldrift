import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import HelpModal from "@/components/HelpModal";
import { getHelpShortcut, helpMarkdownUrl } from "@/lib/help";

describe("HelpModal", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("loads the Help Markdown without a download control and closes with Escape", async () => {
        const onClose = vi.fn();
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            text: () => Promise.resolve([
                "# Welcome to Meldrift!",
                "",
                "![Meldrift help 1](/help/help_1.png)",
            ].join("\n")),
        });
        vi.stubGlobal("fetch", fetchMock);

        render(<HelpModal onClose={onClose} />);

        expect(screen.getByRole("dialog", { name: "Help" })).toBeVisible();
        expect(screen.getByText("Loading Help...")).toBeVisible();
        expect(await screen.findByRole("heading", { name: "Welcome to Meldrift!" })).toBeVisible();
        expect(screen.getByRole("img", { name: "Meldrift help 1" })).toHaveAttribute(
            "src",
            "/help/help_1.png",
        );
        expect(screen.queryByRole("button", { name: /download/i })).not.toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith(helpMarkdownUrl, expect.objectContaining({ signal: expect.any(AbortSignal) }));
        expect(screen.getByLabelText("Help shortcut: Control Shift H")).toHaveTextContent("Ctrl ⇧ H");
        expect(screen.getByRole("button", { name: "Close Help" })).toHaveClass(
            "border-0",
            "outline-none",
            "focus-visible:outline-none",
        );

        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalledOnce();
    });

    it("uses the Command label on Apple platforms", () => {
        expect(getHelpShortcut("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toEqual({
            label: "⌘ ⇧ H",
            ariaLabel: "Help shortcut: Command Shift H",
        });
        expect(getHelpShortcut("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toEqual({
            label: "Ctrl ⇧ H",
            ariaLabel: "Help shortcut: Control Shift H",
        });
    });
});
