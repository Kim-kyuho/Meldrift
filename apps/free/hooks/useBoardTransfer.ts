import { ChangeEvent, useRef, useState } from "react";
import type { BoardSnapshot } from "@/lib/board-state";
import {
    exportBoardDatabase,
    importBoardDatabase,
    replaceBoardState,
    resetBoardDatabase,
} from "@/lib/browser-db/client";

type UseBoardTransferOptions = {
    exportDisabled: boolean;
    setMessage: (message: string) => void;
    getSnapshot: () => BoardSnapshot;
};

const errorMessage = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback;

export function useBoardTransfer({
    exportDisabled,
    setMessage,
    getSnapshot,
}: UseBoardTransferOptions) {
    const importInputRef = useRef<HTMLInputElement | null>(null);
    const [transferring, setTransferring] = useState(false);
    const [resetDialogOpen, setResetDialogOpen] = useState(false);
    const [resetting, setResetting] = useState(false);

    const handleExport = async () => {
        if (exportDisabled || transferring || resetting) return;

        setTransferring(true);
        try {
            await replaceBoardState(getSnapshot());
            const bytes = await exportBoardDatabase();
            const file = new Blob([bytes], { type: "application/vnd.sqlite3" });
            const fileUrl = URL.createObjectURL(file);
            const downloadLink = document.createElement("a");
            downloadLink.href = fileUrl;
            downloadLink.download = "meldrift-free.sqlite";
            document.body.appendChild(downloadLink);
            downloadLink.click();
            downloadLink.remove();
            URL.revokeObjectURL(fileUrl);
        } catch (error) {
            setMessage(errorMessage(error, "The board could not be exported."));
        } finally {
            setTransferring(false);
        }
    };

    const handleImportClick = () => {
        if (!transferring && !resetting) importInputRef.current?.click();
    };

    const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file || resetting) return;

        if (file.size > 50 * 1024 * 1024) {
            setMessage("The SQLite save file must be 50 MiB or smaller.");
            return;
        }

        const confirmed = window.confirm(
            "Importing this save file will replace the current board. Continue?",
        );
        if (!confirmed) return;

        setTransferring(true);
        try {
            await importBoardDatabase(await file.arrayBuffer());
            window.location.reload();
        } catch (error) {
            setMessage(errorMessage(error, "The save file could not be imported."));
        } finally {
            setTransferring(false);
        }
    };

    const handleResetClick = () => {
        if (!transferring && !resetting) setResetDialogOpen(true);
    };

    const handleResetCancel = () => setResetDialogOpen(false);

    const handleResetConfirm = async () => {
        if (transferring || resetting) return;

        setResetDialogOpen(false);
        setResetting(true);
        setMessage("");
        try {
            await resetBoardDatabase();
            window.location.reload();
        } catch (error) {
            setMessage(errorMessage(error, "Meldrift Free Edition browser data could not be reset."));
            setResetting(false);
        }
    };

    return {
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
    };
}
