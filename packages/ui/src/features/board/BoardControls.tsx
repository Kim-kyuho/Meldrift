"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import type { BoardSnapshot } from "@meldrift/board-data/board-state";
import ConfirmDialog from "@meldrift/ui/ConfirmDialog";
import type { BoardMenuControls } from "@meldrift/ui/BoardMenu";
import type { BoardStorage } from "./board-storage";
import { useBoardFileTransfer } from "./useBoardFileTransfer";
import { useBoardPersistence } from "./useBoardPersistence";

type BoardControlsProps = Omit<BoardMenuControls, "boardActions"> & {
    storage?: BoardStorage;
    renderMenu: (menu: BoardMenuControls) => ReactNode;
    menuTitle: string;
    snapshot: BoardSnapshot;
    savePaused: boolean;
    canSave: boolean;
    canEdit: boolean;
    canExport: boolean;
    canReplace?: boolean;
    collaborationMenu?: { label: string; open: (snapshot: BoardSnapshot) => void };
    reorderOpen: boolean;
    onReorder: () => void;
    onCompileMarkdown: () => void;
    replaceSnapshot: (snapshot: BoardSnapshot) => void;
    setMessage: (message: string) => void;
};

const skipSave = () => {};

export default function BoardControls({
    storage,
    renderMenu,
    menuTitle,
    snapshot,
    savePaused,
    canSave,
    canEdit,
    canExport,
    canReplace = true,
    collaborationMenu,
    menuOpen,
    setMenuOpen,
    reorderOpen,
    onReorder,
    onCompileMarkdown,
    onAbout,
    replaceSnapshot,
    setMessage,
}: BoardControlsProps) {
    const file = storage?.file;
    const saveAfterReplaceRef = useRef(false);

    // 가져오기·초기화는 보드 전체를 바꾸므로 저장 예약을 기다리지 않고 바뀐 화면을 바로 저장한다.
    const replaceBoard = useCallback((next: BoardSnapshot) => {
        saveAfterReplaceRef.current = true;
        replaceSnapshot(next);
    }, [replaceSnapshot]);

    const {
        importInputRef,
        transferring,
        resetDialogOpen,
        handleExport,
        handleImportClick,
        handleImport,
        handleResetClick,
        handleResetCancel,
        handleResetConfirm,
    } = useBoardFileTransfer({
        file, snapshot, canEdit: canEdit && canReplace, canExport, savePaused, replaceSnapshot: replaceBoard, setMessage,
    });

    const handleSaveError = useCallback((error: unknown) => {
        setMessage(error instanceof Error ? error.message : "The board could not be saved.");
    }, [setMessage]);

    const { flush: flushSave } = useBoardPersistence({
        snapshot,
        savePaused: !storage || !canSave || savePaused,
        onSave: storage?.save ?? skipSave,
        onError: handleSaveError,
        skipInitialSave: storage?.skipInitialSave,
    });

    useEffect(() => {
        if (!saveAfterReplaceRef.current) {
            return;
        }
        saveAfterReplaceRef.current = false;
        void flushSave();
    }, [snapshot, flushSave]);

    const exportBoard = async () => {
        await flushSave();
        await handleExport();
    };

    const actionBlocked = savePaused || transferring;

    return (
        <>
            <input
                ref={importInputRef}
                type="file"
                aria-label="Import board database"
                className="hidden"
                onChange={handleImport}
            />
            {renderMenu({
                title: menuTitle,
                menuOpen,
                setMenuOpen,
                onAbout,
                boardActions: {
                    reorderOpen,
                    exportDisabled: !file || !canExport || actionBlocked,
                    exportPaused: Boolean(file) && savePaused,
                    importDisabled: !file || !canEdit || !canReplace || actionBlocked,
                    resetDisabled: !storage || !canEdit || !canReplace || actionBlocked,
                    onReorder,
                    onExport: exportBoard,
                    onImport: handleImportClick,
                    onCompileMarkdown,
                    onReset: handleResetClick,
                    collaboration: collaborationMenu && {
                        label: collaborationMenu.label,
                        disabled: actionBlocked,
                        onOpen: () => collaborationMenu.open(snapshot),
                    },
                },
            })}
            {resetDialogOpen && (
                <ConfirmDialog
                    title="Reset this board?"
                    message="All cards and drawings on this board will be removed. You can undo this change until you reload the page."
                    onConfirm={handleResetConfirm}
                    onCancel={handleResetCancel}
                />
            )}
        </>
    );
}
