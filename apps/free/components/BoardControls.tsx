"use client";

import { useCallback, useState } from "react";
import type { BoardControls as BoardControlsProps } from "@meldrift/board/BoardClient";
import ConfirmDialog from "@meldrift/ui/ConfirmDialog";
import { useBoardTransfer } from "@/hooks/useBoardTransfer";
import { useBoardPersistance } from "@/hooks/useBoardPersistance";
import { useBoardShortcuts } from "@/hooks/useBoardShortcuts";
import BoardMenu from "./BoardMenu";
import HelpModal from "./HelpModal";

export default function BoardControls({
    snapshot,
    savePaused,
    setMessage,
    closeOverlays,
    initialHelpOpen,
    ...menu
}: BoardControlsProps & { initialHelpOpen: boolean }) {
    const [helpOpen, setHelpOpen] = useState(initialHelpOpen);
    const openHelp = useCallback(() => {
        closeOverlays();
        setHelpOpen(true);
    }, [closeOverlays]);
    useBoardShortcuts({ onOpenHelp: openHelp });

    const {
        importInputRef,
        transferring,
        resetting,
        resetDialogOpen,
        handleExport,
        handleImportClick,
        handleImport,
        handleResetClick,
        handleResetCancel,
        handleResetConfirm,
    } = useBoardTransfer({
        exportDisabled: savePaused,
        setMessage,
        getSnapshot: () => snapshot,
    });

    useBoardPersistance({ snapshot, savePaused: savePaused || resetting, setMessage });

    return (
        <>
            <input
                ref={importInputRef}
                type="file"
                aria-label="Import board database"
                className="hidden"
                onChange={handleImport}
            />
            <BoardMenu
                {...menu}
                exportDisabled={savePaused}
                transferring={transferring}
                resetting={resetting}
                onExport={handleExport}
                onImport={handleImportClick}
                onReset={handleResetClick}
            />
            {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
            {resetDialogOpen && (
                <ConfirmDialog
                    title="Reset Meldrift Free Edition?"
                    message="Once deleted, your board data cannot be recovered."
                    onConfirm={handleResetConfirm}
                    onCancel={handleResetCancel}
                />
            )}
        </>
    );
}
