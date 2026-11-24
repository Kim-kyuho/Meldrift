import { useEffect, useState } from "react";
import type { BoardSnapshot } from "@/lib/board-state";
import { closeBoardState, loadBoardState } from "@/lib/browser-db/client";

export function useBoardLoad() {
    const [initialSnapshot, setInitialSnapshot] = useState<BoardSnapshot | null>(null);
    const [databaseError, setDatabaseError] = useState("");
    const [ownsBoard, setOwnsBoard] = useState(false);

    useEffect(() => {
        let active = true;
        const request = new AbortController();
        let release = () => {};
        const untilUnmount = new Promise<void>((resolve) => {
            release = resolve;
        });
        const load = async (canWrite: boolean) => {
            try {
                const snapshot = await loadBoardState(!canWrite);
                if (!active) {
                    return;
                }
                setOwnsBoard(canWrite);
                setInitialSnapshot(snapshot);
            } catch (error) {
                if (!active) {
                    return;
                }
                setDatabaseError(error instanceof Error ? error.message : "Browser SQLite could not be opened.");
            }
        };
        // A previous mount may still be releasing its lock while React mounts the next view.
        const deadline = window.setTimeout(() => request.abort(), 300);
        void Promise.resolve().then(async () => {
            if (!active) {
                return;
            }
            if (!navigator.locks) {
                await load(true);
                return;
            }
            try {
                await navigator.locks.request("meldrift-free:edit", { signal: request.signal }, () => {
                    clearTimeout(deadline);
                    if (!active) {
                        return;
                    }
                    void load(true);
                    return untilUnmount.then(closeBoardState);
                });
            } catch (error) {
                if (active && request.signal.aborted) {
                    await load(false);
                } else if (active) {
                    setDatabaseError(error instanceof Error ? error.message : "Could not open the Free board.");
                }
            }
        });
        return () => {
            active = false;
            clearTimeout(deadline);
            request.abort();
            release();
        };
    }, []);

    return { initialSnapshot, databaseError, ownsBoard };
}
