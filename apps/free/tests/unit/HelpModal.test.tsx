import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import HelpModal from "@/components/HelpModal";
import { getHelpShortcut, helpMarkdownUrl } from "@/lib/help";

describe("HelpModal 동작", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("다운로드 버튼 없이 도움말 마크다운을 불러오고 Escape 키로 닫는다", async () => {
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
        expect(screen.getByLabelText("Help shortcut: Control Shift P")).toHaveTextContent("Ctrl ⇧ P");
        expect(screen.getByRole("button", { name: "Close Help" })).toHaveClass(
            "border-0",
            "outline-none",
            "focus-visible:outline-none",
        );

        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalledOnce();
    });

    it("Apple 기기에서는 Command 키 표시를 사용한다", () => {
        expect(getHelpShortcut("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toEqual({
            label: "⌘ ⇧ P",
            ariaLabel: "Help shortcut: Command Shift P",
        });
        expect(getHelpShortcut("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toEqual({
            label: "Ctrl ⇧ P",
            ariaLabel: "Help shortcut: Control Shift P",
        });
    });
});
