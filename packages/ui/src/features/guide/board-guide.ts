import type { BoardSnapshot } from "@meldrift/board-data/board-state";
import type { TutorialStepId } from "./tutorial";

export type BoardGuide = {
    key: string;
    helpMarkdownUrl: string;
    helpShortcutsUrl: string;
    mascotUrl: string;
};

export type BoardHelpOptions = {
    guide: BoardGuide;
    autoOpen: boolean;
    onStartTutorial: (currentSnapshot: BoardSnapshot) => void;
};

export type BoardTutorialOptions = {
    guide: BoardGuide;
    step: TutorialStepId;
    onStepChange: (step: TutorialStepId) => void;
    onExit: () => void;
};

export const getHelpShortcut = (userAgent: string) => {
    const isApplePlatform = /Macintosh|Mac OS X|iPhone|iPad|iPod/i.test(userAgent);
    return isApplePlatform
        ? { label: "⌘ ⇧ P", ariaLabel: "Help shortcut: Command Shift P" }
        : { label: "Ctrl ⇧ P", ariaLabel: "Help shortcut: Control Shift P" };
};

export const isBoardContentEmpty = (snapshot: BoardSnapshot) =>
    snapshot.memos.length === 0 &&
    snapshot.images.length === 0 &&
    snapshot.mermaids.length === 0 &&
    snapshot.tables.length === 0 &&
    snapshot.strokes.length === 0;

const boardEntryKey = (guide: BoardGuide, boardId: number) => `meldrift:board-entered:${guide.key}:${boardId}`;

// 이 브라우저에서 처음 여는 빈 보드만 새 보드로 본다. 저장소를 쓸 수 없으면 새 보드로 보지 않는다.
export function isNewBoardEntry(guide: BoardGuide, snapshot: BoardSnapshot) {
    if (!isBoardContentEmpty(snapshot)) {
        return false;
    }
    try {
        return window.localStorage.getItem(boardEntryKey(guide, snapshot.board.boardId)) === null;
    } catch {
        return false;
    }
}

export function recordBoardEntry(guide: BoardGuide, boardId: number) {
    try {
        window.localStorage.setItem(boardEntryKey(guide, boardId), "1");
    } catch {
        return;
    }
}
