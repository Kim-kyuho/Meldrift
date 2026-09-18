import { useEffect, useState } from "react";
import type { BoardSnapshot } from "@/lib/board-state";
import { loadBoardState } from "@/lib/browser-db/client";

export function useBoardLoad() {
    const [initialSnapshot, setInitialSnapshot] = useState<BoardSnapshot | null>(null);
    const [databaseError, setDatabaseError] = useState("");

    useEffect(() => {
        let active = true;
        loadBoardState()
            .then((snapshot) => {
                if (active) setInitialSnapshot(snapshot);
            })
            .catch((error: unknown) => {
                if (!active) return;
                setDatabaseError(error instanceof Error ? error.message : "Browser SQLite could not be opened.");
            });
        return () => { active = false; };
    }, []);

    return { initialSnapshot, databaseError };
}
