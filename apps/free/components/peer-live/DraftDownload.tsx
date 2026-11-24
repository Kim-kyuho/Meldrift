"use client";

import { useState } from "react";
import type { BoardSnapshot } from "@meldrift/board-data/board-state";
import PressableButton from "@meldrift/ui/PressableButton";

export default function DraftDownload({ board, download }: {
    board: BoardSnapshot;
    download: (snapshot: BoardSnapshot) => Promise<void>;
}) {
    const [dismissed, setDismissed] = useState<BoardSnapshot | null>(null);
    const [error, setError] = useState("");
    if (dismissed === board) {
        return null;
    }

    return (
        <div className="fixed inset-x-3 bottom-24 z-50000 mx-auto flex w-fit flex-wrap items-center gap-2 rounded-xl bg-white p-2 text-sm shadow-lg">
            <p role="status">{error || "Some edits were not saved to the shared board."}</p>
            <PressableButton onClick={() => void download(board).catch(() => setError("The draft could not be downloaded."))}>Download draft</PressableButton>
            <PressableButton onClick={() => setDismissed(board)}>Dismiss</PressableButton>
        </div>
    );
}
