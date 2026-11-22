"use client";

import PressableButton from "@meldrift/ui/PressableButton";
import { Dispatch, SetStateAction, type ReactNode } from "react";
import { Download, EllipsisIcon, FileText, FolderOpen, Info, ListOrdered, Shredder } from "lucide-react";

export type BoardMenuProps = {
    brand: ReactNode;
    title?: string;
    titleDivider?: boolean;
    boardActions?: boolean;
    compact?: boolean;
    authControls?: ReactNode;
    transferDisabled?: boolean;
    mutationDisabled?: boolean;
    resetTitle?: string;
    menuOpen: boolean;
    setMenuOpen: Dispatch<SetStateAction<boolean>>;
    exportDisabled: boolean;
    transferring: boolean;
    resetting: boolean;
    reorderOpen: boolean;
    onReorder: () => void;
    onExport: () => void;
    onImport: () => void;
    onCompileMarkdown: () => void;
    onReset: () => void;
    onAbout: () => void;
};

export default function BoardMenu({
    brand,
    title,
    titleDivider = false,
    boardActions = true,
    compact = false,
    authControls,
    transferDisabled = false,
    mutationDisabled = false,
    resetTitle = "Delete this browser's Meldrift Free Edition SQLite data",
    menuOpen,
    setMenuOpen,
    exportDisabled,
    transferring,
    resetting,
    reorderOpen,
    onReorder,
    onExport,
    onImport,
    onCompileMarkdown,
    onReset,
    onAbout,
}: BoardMenuProps) {
    const menuTitle = title ?? (boardActions ? "Free Board" : null);
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
                    {menuTitle && <>
                        <div className="px-3 py-2 font-bold text-neutral-900">{menuTitle}</div>
                        {titleDivider && <hr className="mx-2 mb-1 border-neutral-200" />}
                    </>}
                    {boardActions && <>
                    <PressableButton
                        variant="menu"
                        data-tutorial="reorder-memos"
                        title="Change the order memos are numbered in"
                        className="flex items-center gap-2 font-bold text-emerald-600"
                        aria-pressed={reorderOpen}
                        onClick={() => runAndClose(onReorder)}
                    >
                        <ListOrdered aria-hidden="true" className="h-4 w-4 shrink-0" />
                        Reorder Memos
                    </PressableButton>
                    <PressableButton
                        variant="menu"
                        disabled={transferDisabled || exportDisabled || transferring || resetting}
                        title={exportDisabled ? "Finish the current card, drawing, or assistant changes before exporting." : "Export SQLite save file"}
                        className="flex items-center gap-2 font-bold text-sky-600 disabled:cursor-not-allowed disabled:opacity-35"
                        onClick={() => runAndClose(onExport)}
                    >
                        <Download aria-hidden="true" className="h-4 w-4 shrink-0" />
                        Export
                    </PressableButton>
                    <PressableButton
                        variant="menu"
                        disabled={transferDisabled || mutationDisabled || transferring || resetting}
                        className="flex items-center gap-2 font-bold text-indigo-600 disabled:cursor-not-allowed disabled:opacity-35"
                        onClick={() => runAndClose(onImport)}
                    >
                        <FolderOpen aria-hidden="true" className="h-4 w-4 shrink-0" />
                        Import
                    </PressableButton>
                    <PressableButton
                        variant="menu"
                        data-tutorial="compile-markdown"
                        className="flex items-center gap-2 font-bold text-pink-500"
                        onClick={() => runAndClose(onCompileMarkdown)}
                    >
                        <FileText aria-hidden="true" className="h-4 w-4 shrink-0" />
                        Compile to Markdown
                    </PressableButton>
                    <PressableButton
                        variant="menu"
                        disabled={transferDisabled || mutationDisabled || transferring || resetting}
                        title={resetTitle}
                        className="flex items-center gap-2 font-bold text-rose-600 disabled:cursor-not-allowed disabled:opacity-35"
                        onClick={() => runAndClose(onReset)}
                    >
                        <Shredder aria-hidden="true" className="h-4 w-4 shrink-0" />
                        {resetting ? "Resetting..." : "Reset"}
                    </PressableButton>
                    {exportDisabled && (
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
