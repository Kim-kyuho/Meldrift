"use client";

import PressableButton from "@meldrift/ui/PressableButton";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Download, EllipsisIcon, FileText, FolderOpen, Info, ListOrdered, Shredder } from "lucide-react";

export type BoardMenuActions = {
    reorderOpen: boolean;
    exportDisabled: boolean;
    exportPaused: boolean;
    importDisabled: boolean;
    resetDisabled: boolean;
    onReorder: () => void;
    onExport: () => void;
    onImport: () => void;
    onCompileMarkdown: () => void;
    onReset: () => void;
    collaboration?: { label: string; disabled: boolean; onOpen: () => void };
};

export type BoardMenuControls = {
    title?: string;
    menuOpen: boolean;
    setMenuOpen: Dispatch<SetStateAction<boolean>>;
    boardActions?: BoardMenuActions;
    onAbout: () => void;
};

export type BoardMenuProps = BoardMenuControls & {
    brand: ReactNode;
    titleDivider?: boolean;
    compact?: boolean;
    authControls?: ReactNode;
};

export default function BoardMenu({
    brand,
    title,
    titleDivider = false,
    compact = false,
    authControls,
    menuOpen,
    setMenuOpen,
    boardActions,
    onAbout,
}: BoardMenuProps) {
    const runAndClose = (action: () => void) => {
        setMenuOpen(false);
        action();
    };

    return (
        <>
            <div className="fixed left-5 top-5 z-50000 rounded-xl bg-white/75 px-3 py-1.5 shadow-md">
                {brand}
            </div>
            <PressableButton
                aria-label="Open board menu"
                data-tutorial="board-menu-trigger"
                className={`fixed right-5 top-5 z-50000 bg-white/75 shadow-md ${compact ? "grid size-9 place-items-center rounded-lg" : "px-3 py-3"}`}
                onClick={() => setMenuOpen((prev) => !prev)}
            >
                <EllipsisIcon className={compact ? "size-4 text-neutral-900" : "h-5 w-5 text-neutral-900"} />
            </PressableButton>
            {menuOpen && (
                // AI 어시스턴트 버튼이 위로 올라오는 것을 방지하기 위해 z를 한 단계 올림
                <div className={`fixed right-5 z-50001 rounded-xl bg-white/75 shadow-md ${compact
                    ? "top-16 w-48 px-1.5 py-2 text-sm [&_.ui-button-menu]:min-h-8 [&_.ui-button-menu]:px-2.5 [&_.ui-button-menu]:py-1"
                    : "top-17 w-56 px-2 py-3"}`}>
                    {title && <>
                        <div className="px-3 py-2 font-bold text-neutral-900">{title}</div>
                        {titleDivider && <hr className="mx-2 mb-1 border-neutral-200" />}
                    </>}
                    {boardActions && <>
                        {boardActions.collaboration && (
                            <PressableButton
                                variant="menu"
                                disabled={boardActions.collaboration.disabled}
                                className="mb-1 cursor-pointer border border-sky-200 bg-sky-50 font-semibold text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={() => {
                                    setMenuOpen(false);
                                    boardActions.collaboration?.onOpen();
                                }}
                            >
                                {boardActions.collaboration.label}
                            </PressableButton>
                        )}
                        <PressableButton
                            variant="menu"
                            data-tutorial="reorder-memos"
                            title="Change the order memos are numbered in"
                            className="flex items-center gap-2 font-bold text-emerald-600"
                            aria-pressed={boardActions.reorderOpen}
                            onClick={() => runAndClose(boardActions.onReorder)}
                        >
                            <ListOrdered aria-hidden="true" className="h-4 w-4 shrink-0" />
                            Reorder Memos
                        </PressableButton>
                        <PressableButton
                            variant="menu"
                            disabled={boardActions.exportDisabled}
                            title={boardActions.exportPaused
                                ? "Finish the current card, drawing, or assistant changes before exporting."
                                : "Export SQLite save file"}
                            className="flex items-center gap-2 font-bold text-sky-600 disabled:cursor-not-allowed disabled:opacity-35"
                            onClick={() => runAndClose(boardActions.onExport)}
                        >
                            <Download aria-hidden="true" className="h-4 w-4 shrink-0" />
                            Export
                        </PressableButton>
                        <PressableButton
                            variant="menu"
                            disabled={boardActions.importDisabled}
                            className="flex items-center gap-2 font-bold text-indigo-600 disabled:cursor-not-allowed disabled:opacity-35"
                            onClick={() => runAndClose(boardActions.onImport)}
                        >
                            <FolderOpen aria-hidden="true" className="h-4 w-4 shrink-0" />
                            Import
                        </PressableButton>
                        <PressableButton
                            variant="menu"
                            data-tutorial="compile-markdown"
                            className="flex items-center gap-2 font-bold text-pink-500"
                            onClick={() => runAndClose(boardActions.onCompileMarkdown)}
                        >
                            <FileText aria-hidden="true" className="h-4 w-4 shrink-0" />
                            Compile to Markdown
                        </PressableButton>
                        <PressableButton
                            variant="menu"
                            disabled={boardActions.resetDisabled}
                            title="Clear the contents of this board"
                            className="flex items-center gap-2 font-bold text-rose-600 disabled:cursor-not-allowed disabled:opacity-35"
                            onClick={() => runAndClose(boardActions.onReset)}
                        >
                            <Shredder aria-hidden="true" className="h-4 w-4 shrink-0" />
                            Reset
                        </PressableButton>
                        {boardActions.exportPaused && (
                            <p className="px-3 pt-2 text-xs font-semibold text-neutral-500">
                                Finish editing before exporting.
                            </p>
                        )}
                    </>}
                    {authControls}
                    <div className="mt-2 border-t border-neutral-200 pt-2">
                        <PressableButton
                            variant="menu"
                            className="flex items-center gap-2 font-bold text-neutral-700"
                            onClick={() => runAndClose(onAbout)}
                        >
                            <Info aria-hidden="true" className="h-4 w-4 shrink-0" />
                            About
                        </PressableButton>
                    </div>
                </div>
            )}
        </>
    );
}
