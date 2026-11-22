"use client";

import type { BoardInfo } from "@meldrift/board-data/board-state";
import { useBoardSnapshot } from "@/hooks/useBoardSnapshot";
import BoardClient from "./BoardClient";

type BoardSnapshotClientProps = { board: BoardInfo; editingAllowed: boolean; collaborative?: boolean };

export default function BoardSnapshotClient({ board, editingAllowed, collaborative = false }: BoardSnapshotClientProps) {
    const {
        snapshot,
        status,
        message,
        canEdit,
        save,
        downloadLocal,
        restoreServer,
        serverSaveVersion,
        exportSnapshot,
        readSnapshotFile,
        live,
    } = useBoardSnapshot(board, editingAllowed, collaborative);
    return (
        <>
            {snapshot && (
                <div inert={status === "blocked"}>
                    <BoardClient key={board.boardId} initialSnapshot={snapshot} editingAllowed={canEdit}
                        onSnapshotChange={save} serverSaveVersion={serverSaveVersion}
                        exportSnapshot={exportSnapshot} readSnapshotFile={readSnapshotFile} live={live} />
                </div>
            )}
            {!snapshot || status === "blocked" ? (
                <div className="fixed inset-0 z-90000 flex items-center justify-center bg-white/95 p-6">
                    <div className="max-w-lg space-y-4">
                        <p role="status">{message || "Loading..."}</p>
                        {message && (
                            <div className="flex flex-wrap gap-4">
                                <button onClick={() => void downloadLocal()}>Download local backup</button>
                                <button onClick={() => {
                                    if (window.confirm("Replace local unsaved changes with the server version?")) {
                                        void restoreServer();
                                    }
                                }}>Restore server version</button>
                                <button onClick={() => window.location.reload()}>Reload</button>
                            </div>
                        )}
                    </div>
                </div>
            ) : canEdit && (
                <p
                    role="status"
                    className="pointer-events-none fixed bottom-3 left-24 z-50000 max-w-sm select-none text-xs text-neutral-600"
                    style={{ WebkitTouchCallout: "none" }}
                >
                    {message || ({ saved: "Saved", local: "Saved locally", saving: "Saving...", error: "Server save failed" }[status])}
                </p>
            )}
        </>
    );
}
