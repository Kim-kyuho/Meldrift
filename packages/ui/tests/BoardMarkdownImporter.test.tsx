import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultBoard } from "@meldrift/board-data/board-state";
import BoardMarkdownImporter from "../src/features/markdown/BoardMarkdownImporter";

function createMarkdownFile(content: string, name = "notes.md", sizeOverride?: number): File {
    const bytes = new TextEncoder().encode(content);
    const file = new File([bytes], name, { type: "text/markdown" });
    Object.defineProperty(file, "arrayBuffer", {
        value: async () => bytes.slice().buffer,
    });
    if (sizeOverride !== undefined) {
        Object.defineProperty(file, "size", { value: sizeOverride });
    }
    return file;
}

describe("BoardMarkdownImporter", () => {
    it("commits immediately without confirm dialog on an empty board", async () => {
        const onCommit = vi.fn();
        const onClose = vi.fn();
        const onMessage = vi.fn();
        const onBusyChange = vi.fn();

        render(
            <BoardMarkdownImporter
                file={createMarkdownFile("# Title\n\nBody\n\n```mermaid\nflowchart LR\n  A --> B\n```")}
                board={defaultBoard}
                hasExistingContent={false}
                disabled={false}
                onBusyChange={onBusyChange}
                onCommit={onCommit}
                onMessage={onMessage}
                onClose={onClose}
            />,
        );

        await waitFor(() => {
            expect(onCommit).toHaveBeenCalledOnce();
        });
        const [snapshot] = onCommit.mock.calls[0];
        expect(snapshot.memos).toHaveLength(1);
        expect(snapshot.mermaids).toHaveLength(1);
        expect(onClose).toHaveBeenCalledOnce();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("shows a ConfirmDialog with summary before replacing a non-empty board", async () => {
        const onCommit = vi.fn();
        const onClose = vi.fn();

        render(
            <BoardMarkdownImporter
                file={createMarkdownFile("# One\n\n| A | B |\n| --- | --- |\n| 1 | 2 |")}
                board={defaultBoard}
                hasExistingContent={true}
                disabled={false}
                onBusyChange={vi.fn()}
                onCommit={onCommit}
                onMessage={vi.fn()}
                onClose={onClose}
            />,
        );

        const dialog = await screen.findByRole("dialog");
        expect(dialog).toHaveTextContent("Import Markdown?");
        expect(dialog).toHaveTextContent("1 memo, 1 table");
        expect(onCommit).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Yes" }));
        expect(onCommit).toHaveBeenCalledOnce();
        expect(onClose).toHaveBeenCalledOnce();
    });

    it("rejects files larger than 2 MiB with an error message", () => {
        const onCommit = vi.fn();
        const onMessage = vi.fn();
        const onClose = vi.fn();

        render(
            <BoardMarkdownImporter
                file={createMarkdownFile("# Huge", "huge.md", 2 * 1024 * 1024 + 1)}
                board={defaultBoard}
                hasExistingContent={false}
                disabled={false}
                onBusyChange={vi.fn()}
                onCommit={onCommit}
                onMessage={onMessage}
                onClose={onClose}
            />,
        );

        expect(onMessage).toHaveBeenCalledWith("The Markdown file must be 2 MiB or smaller.");
        expect(onCommit).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledOnce();
    });
});
