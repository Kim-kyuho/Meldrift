"use client";

import { Redo2, Undo2 } from "lucide-react";
import PressableButton from "../../shared/PressableButton";

export default function BoardHistoryToolbar({ canUndo, canRedo, onUndo, onRedo }: {
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
}) {
    return (
        <div role="toolbar" aria-label="Board history"
            className="board-toolbar fixed bottom-6 left-1/2 z-50000 flex -translate-x-1/2 gap-1 rounded-md p-1">
            <PressableButton type="button" aria-label="Undo board change" title="Undo" disabled={!canUndo} onClick={onUndo}
                className="flex h-10 w-10 items-center justify-center p-0 text-neutral-900 disabled:opacity-30 disabled:active:scale-100">
                <Undo2 className="h-5 w-5" />
            </PressableButton>
            <PressableButton type="button" aria-label="Redo board change" title="Redo" disabled={!canRedo} onClick={onRedo}
                className="flex h-10 w-10 items-center justify-center p-0 text-neutral-900 disabled:opacity-30 disabled:active:scale-100">
                <Redo2 className="h-5 w-5" />
            </PressableButton>
        </div>
    );
}
