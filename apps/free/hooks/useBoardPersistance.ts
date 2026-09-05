import { Dispatch, SetStateAction, useCallback, useEffect, useState } from "react";
import type { BoardStroke } from "@meldrift/core/board-stroke";
import type {
    BoardImage,
    BoardInfo,
    BoardMemo,
    BoardMermaid,
    BoardSnapshot,
    BoardTable,
} from "@/lib/board-state";
import { loadBoardState, replaceBoardState } from "@/lib/browser-db/client";
import { isBoardContentEmpty } from "@/lib/help";

const saveDelayMs = 150;

type UseBoardPersistanceOptions = {
    snapshot: BoardSnapshot;
    savePaused: boolean;
    setCurrentBoard: Dispatch<SetStateAction<BoardInfo>>;
    setMemos: Dispatch<SetStateAction<BoardMemo[]>>;
    setImages: Dispatch<SetStateAction<BoardImage[]>>;
    setMermaids: Dispatch<SetStateAction<BoardMermaid[]>>;
    setTables: Dispatch<SetStateAction<BoardTable[]>>;
    setStrokes: Dispatch<SetStateAction<BoardStroke[]>>;
    onEmptyBoard: () => void;
    setMessage: (message: string) => void;
};

export function useBoardPersistance({
    snapshot,
    savePaused,
    setCurrentBoard,
    setMemos,
    setImages,
    setMermaids,
    setTables,
    setStrokes,
    onEmptyBoard,
    setMessage,
}: UseBoardPersistanceOptions) {
    const [databaseReady, setDatabaseReady] = useState(false);
    const [databaseError, setDatabaseError] = useState("");

    const applySnapshot = useCallback((next: BoardSnapshot) => {
        setCurrentBoard(next.board);
        setMemos(next.memos);
        setImages(next.images);
        setMermaids(next.mermaids);
        setTables(next.tables);
        setStrokes(next.strokes);
    }, [setCurrentBoard, setImages, setMemos, setMermaids, setStrokes, setTables]);

    useEffect(() => {
        let active = true;
        loadBoardState()
            .then((stored) => {
                if (!active) return;
                applySnapshot(stored);
                setDatabaseReady(true);
                if (isBoardContentEmpty(stored)) onEmptyBoard();
            })
            .catch((error: unknown) => {
                if (!active) return;
                setDatabaseError(error instanceof Error ? error.message : "Browser SQLite could not be opened.");
            });
        return () => {
            active = false;
        };
    }, [applySnapshot, onEmptyBoard]);

    useEffect(() => {
        if (!databaseReady || savePaused) return;

        const timeoutId = window.setTimeout(() => {
            replaceBoardState(snapshot).catch((error: unknown) => {
                setMessage(error instanceof Error ? error.message : "The board could not be saved.");
            });
        }, saveDelayMs);
        return () => window.clearTimeout(timeoutId);
    }, [databaseReady, savePaused, setMessage, snapshot]);

    return {
        databaseReady,
        databaseError,
    };
}
