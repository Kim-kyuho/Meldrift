import { ChangeEvent, useRef, useState } from "react";
import type { BoardSnapshot } from "@/lib/board-state";
import { createEmptyBoardSnapshot } from "@/lib/board-state";
import {
    exportBoardDatabase,
    importBoardDatabase,
    replaceBoardState,
} from "@/lib/browser-db/client";

type UseBoardTransferOptions = {
    exportDisabled: boolean;
    setMessage: (message: string) => void;
    getSnapshot: () => BoardSnapshot;
    replaceSnapshot: (snapshot: BoardSnapshot) => void;
};

const errorMessage = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback;

export function useBoardTransfer({
    exportDisabled,
    setMessage,
    getSnapshot,
    replaceSnapshot,
}: UseBoardTransferOptions) {
    const importInputRef = useRef<HTMLInputElement | null>(null);
    const [transferring, setTransferring] = useState(false);
    const [resetDialogOpen, setResetDialogOpen] = useState(false);

    const handleExport = async () => {
        if (exportDisabled || transferring) {
            return;
        }

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
        if (!exportDisabled && !transferring) {
            importInputRef.current?.click();
        }
    };

    const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file || exportDisabled || transferring) {
            return;
        }

        if (file.size > 50 * 1024 * 1024) {
            setMessage("The SQLite save file must be 50 MiB or smaller.");
            return;
        }

        const confirmed = window.confirm(
            "Importing this save file will replace the current board. Continue?",
        );
        if (!confirmed) {
            return;
        }

        setTransferring(true);
        try {
            const imported = await importBoardDatabase(await file.arrayBuffer());
            replaceSnapshot({ ...imported, board: getSnapshot().board });
        } catch (error) {
            setMessage(errorMessage(error, "The save file could not be imported."));
        } finally {
            setTransferring(false);
        }
    };

    const handleResetClick = () => {
        if (!exportDisabled && !transferring) {
            setResetDialogOpen(true);
        }
    };

    const handleResetCancel = () => setResetDialogOpen(false);

    const handleResetConfirm = () => {
        if (exportDisabled || transferring) {
            return;
        }

        setResetDialogOpen(false);
        setMessage("");
        replaceSnapshot({ ...createEmptyBoardSnapshot(), board: getSnapshot().board });
    };

    return {
        importInputRef,
        transferring,
        resetting: false,
        resetDialogOpen,
        handleExport,
        handleImportClick,
        handleImport,
        handleResetClick,
        handleResetCancel,
        handleResetConfirm,
    };
}
