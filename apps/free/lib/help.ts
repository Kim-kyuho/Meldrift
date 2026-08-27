import type { BoardSnapshot } from "@/lib/board-state";

export const helpMarkdownUrl = "/help/Help_Meldrift.md";

export const getHelpShortcut = (userAgent: string) => {
    const isApplePlatform = /Macintosh|Mac OS X|iPhone|iPad|iPod/i.test(userAgent);
    return isApplePlatform
        ? { label: "⌘ ⇧ H", ariaLabel: "Help shortcut: Command Shift H" }
        : { label: "Ctrl ⇧ H", ariaLabel: "Help shortcut: Control Shift H" };
};

export const isBoardContentEmpty = (snapshot: BoardSnapshot) =>
    snapshot.memos.length === 0 &&
    snapshot.images.length === 0 &&
    snapshot.mermaids.length === 0 &&
    snapshot.tables.length === 0 &&
    snapshot.strokes.length === 0;
