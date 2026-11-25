import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
    assignSnapshotToBoard, createEmptyBoardSnapshot, type BoardSnapshot,
} from "@meldrift/board-data/board-state";
import type { BoardFileAdapter } from "./board-storage";

type UseBoardFileTransferOptions = {
    file?: BoardFileAdapter;
    snapshot: BoardSnapshot;
    canEdit: boolean;
    canExport: boolean;
    savePaused: boolean;
    replaceSnapshot: (snapshot: BoardSnapshot) => void;
    setMessage: (message: string) => void;
};

const bytesPerMiB = 1024 * 1024;

const errorMessage = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback;

export function useBoardFileTransfer(options: UseBoardFileTransferOptions) {
    const latest = useRef(options);
    const active = useRef(true);
    const busy = useRef(false);
    const importInputRef = useRef<HTMLInputElement | null>(null);
    const [transferring, setTransferring] = useState(false);
    const [resetDialogOpen, setResetDialogOpen] = useState(false);

    useEffect(() => {
        latest.current = options;
    });

    useEffect(() => {
        active.current = true;
        return () => {
            active.current = false;
        };
    }, []);

    const canModify = () => active.current && latest.current.canEdit && !latest.current.savePaused;

    const reportError = (error: unknown, fallback: string) => {
        if (active.current) {
            latest.current.setMessage(errorMessage(error, fallback));
        }
    };

    const begin = () => {
        busy.current = true;
        setTransferring(true);
    };

    const finish = () => {
        busy.current = false;
        if (active.current) {
            setTransferring(false);
        }
    };

    const handleExport = async () => {
        const { file, canExport, savePaused } = latest.current;
        if (!file || !canExport || savePaused || busy.current) {
            return;
        }
        begin();
        try {
            const snapshot = latest.current.snapshot;
            const bytes = await file.exportFile(snapshot);
            if (!active.current || !latest.current.canExport) {
                return;
            }
            const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.sqlite3" }));
            const link = document.createElement("a");
            link.href = url;
            link.download = file.fileName(snapshot.board);
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch (error) {
            reportError(error, "The board could not be exported.");
        } finally {
            finish();
        }
    };

    const handleImportClick = () => {
        if (latest.current.file && canModify() && !busy.current) {
            importInputRef.current?.click();
        }
    };

    const importSqliteFile = async (selected: File) => {
        const { file } = latest.current;
        if (!file || !canModify() || busy.current) {
            return;
        }
        if (selected.size > file.maxImportBytes) {
            const limit = Math.round(file.maxImportBytes / bytesPerMiB);
            latest.current.setMessage(`The SQLite save file must be ${limit} MiB or smaller.`);
            return;
        }
        begin();
        try {
            const imported = await file.readFile(await selected.arrayBuffer());
            if (!canModify()) {
                return;
            }
            if (!window.confirm("Importing this save file will replace the current board contents. Continue?")) {
                return;
            }
            latest.current.replaceSnapshot(assignSnapshotToBoard(imported, latest.current.snapshot.board));
        } catch (error) {
            reportError(error, "The save file could not be imported.");
        } finally {
            finish();
        }
    };

    const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
        const selected = event.target.files?.[0];
        event.target.value = "";
        if (!selected) {
            return;
        }
        await importSqliteFile(selected);
    };

    const handleResetClick = () => {
        if (canModify() && !busy.current) {
            setResetDialogOpen(true);
        }
    };

    const handleResetCancel = () => {
        setResetDialogOpen(false);
    };

    const handleResetConfirm = () => {
        setResetDialogOpen(false);
        if (!canModify() || busy.current) {
            return;
        }
        latest.current.setMessage("");
        latest.current.replaceSnapshot({ ...createEmptyBoardSnapshot(), board: latest.current.snapshot.board });
    };

    return {
        importInputRef,
        transferring,
        resetDialogOpen,
        handleExport,
        handleImportClick,
        handleImport,
        importSqliteFile,
        handleResetClick,
        handleResetCancel,
        handleResetConfirm,
    };
}
