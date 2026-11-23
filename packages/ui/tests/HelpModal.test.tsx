import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@meldrift/diagram-engine", () => ({
    createDiagramRenderer: (container: HTMLElement) => {
        const root = document.createElement("div");
        root.className = "meldrift-diagram-renderer";
        const canvas = document.createElement("div");
        canvas.className = "meldrift-diagram-canvas";
        root.append(canvas);
        container.append(root);
        return {
            element: root,
            getSource: () => "",
            setSource: vi.fn(async () => {}),
            setCursor: vi.fn(),
            destroy: vi.fn(() => root.remove()),
        };
    },
}));

import HelpModal from "../src/features/guide/HelpModal";
import { getHelpShortcut, type BoardGuide } from "../src/features/guide/board-guide";

const guide: BoardGuide = {
    key: "test",
    helpMarkdownUrl: "/help/Help_Meldrift.md",
    helpShortcutsUrl: "/help/Help_Shortcuts.md",
    mascotUrl: "/meldrift-mascot.png",
};
const { helpMarkdownUrl, helpShortcutsUrl } = guide;

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

        render(<HelpModal guide={guide} onClose={onClose} />);

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

    it("Introduce(Mermaid·표)와 Short-cut 탭을 전환해 각각의 마크다운을 렌더링한다", async () => {
        const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url === helpShortcutsUrl) {
                return {
                    ok: true,
                    text: async () => [
                        "# Keyboard Shortcuts",
                        "",
                        "| Key | Action |",
                        "| --- | --- |",
                        "| `m` | Create a Memo card |",
                    ].join("\n"),
                };
            }
            return {
                ok: true,
                text: async () => [
                    "# Welcome to Meldrift!",
                    "",
                    "```mermaid",
                    "flowchart LR",
                    "    A[Memo] --> B[Markdown]",
                    "```",
                    "",
                    "| Card | Key |",
                    "| --- | --- |",
                    "| Memo | `m` |",
                ].join("\n"),
            };
        });
        vi.stubGlobal("fetch", fetchMock);

        render(<HelpModal guide={guide} onClose={vi.fn()} />);

        const introduceTab = screen.getByRole("tab", { name: "Introduce" });
        const shortcutTab = screen.getByRole("tab", { name: "Short-cut" });
        expect(introduceTab).toHaveAttribute("aria-selected", "true");
        expect(shortcutTab).toHaveAttribute("aria-selected", "false");

        expect(await screen.findByRole("heading", { name: "Welcome to Meldrift!" })).toBeVisible();
        await waitFor(() => {
            expect(document.querySelector(".mermaid-diagram-view .meldrift-diagram-renderer")).toBeInTheDocument();
        });
        expect(screen.getByRole("table")).toBeInTheDocument();

        fireEvent.click(shortcutTab);
        expect(shortcutTab).toHaveAttribute("aria-selected", "true");
        expect(await screen.findByRole("heading", { name: "Keyboard Shortcuts" })).toBeVisible();
        expect(screen.getByText("Create a Memo card")).toBeVisible();
        expect(fetchMock).toHaveBeenCalledWith(helpShortcutsUrl, expect.objectContaining({ signal: expect.any(AbortSignal) }));

        fireEvent.click(introduceTab);
        expect(await screen.findByRole("heading", { name: "Welcome to Meldrift!" })).toBeVisible();
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
