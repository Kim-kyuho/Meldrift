import { useEffect } from "react";
import type { BoardSnapshot } from "@/lib/board-state";
import { replaceBoardState } from "@/lib/browser-db/client";

const saveDelayMs = 150;

export function useBoardPersistance({ snapshot, savePaused, setMessage }: {
    snapshot: BoardSnapshot;
    savePaused: boolean;
    setMessage: (message: string) => void;
}) {
    useEffect(() => {
        if (savePaused) return;

        const timeoutId = window.setTimeout(() => {
            replaceBoardState(snapshot).catch((error: unknown) => {
                setMessage(error instanceof Error ? error.message : "The board could not be saved.");
            });
        }, saveDelayMs);
        return () => window.clearTimeout(timeoutId);
    }, [savePaused, setMessage, snapshot]);
}
