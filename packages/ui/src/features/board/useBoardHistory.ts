"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardSnapshot } from "@meldrift/board-data/board-state";

export type BoardContent = Pick<BoardSnapshot, "memos" | "images" | "mermaids" | "tables" | "strokes">;

type History = { past: BoardContent[]; present: BoardContent; future: BoardContent[] };
const historyLimit = 50;
const contentOf = ({ memos, images, mermaids, tables, strokes }: BoardContent): BoardContent =>
    ({ memos, images, mermaids, tables, strokes });

function shareArray<T extends object>(previous: T[], incoming: T[]): T[] {
    if (previous === incoming) {
        return previous;
    }
    const next = incoming.map((item, index) => {
        const old = previous[index];
        if (old === item) {
            return old;
        }
        const keys = Object.keys(item) as (keyof T)[];
        return old && keys.length === Object.keys(old).length && keys.every((key) => Object.is(old[key], item[key]))
            ? old : item;
    });
    return previous.length === next.length && next.every((item, index) => item === previous[index]) ? previous : next;
}

function shareContent(previous: BoardContent, incoming: BoardContent): BoardContent {
    const next = {
        memos: shareArray(previous.memos, incoming.memos),
        images: shareArray(previous.images, incoming.images),
        mermaids: shareArray(previous.mermaids, incoming.mermaids),
        tables: shareArray(previous.tables, incoming.tables),
        strokes: shareArray(previous.strokes, incoming.strokes),
    };
    return (Object.keys(next) as (keyof BoardContent)[]).every((key) => next[key] === previous[key]) ? previous : next;
}

export function useBoardHistory({ snapshot, paused, onRestore }: {
    snapshot: BoardSnapshot;
    paused: boolean;
    onRestore: (content: BoardContent) => void;
}) {
    const [history, setHistory] = useState<History>(() => ({ past: [], present: contentOf(snapshot), future: [] }));
    const current = useRef(history);
    const update = useCallback((next: History) => {
        current.current = next;
        setHistory(next);
    }, []);

    useEffect(() => {
        if (paused) {
            return;
        }
        const previous = current.current;
        const present = shareContent(previous.present, snapshot);
        if (present !== previous.present) {
            update({ past: [...previous.past, previous.present].slice(-historyLimit), present, future: [] });
        }
    }, [snapshot, paused, update]);

    const undo = () => {
        const previous = current.current;
        if (paused || previous.past.length === 0) {
            return;
        }
        const present = previous.past[previous.past.length - 1];
        update({ past: previous.past.slice(0, -1), present, future: [previous.present, ...previous.future] });
        onRestore(present);
    };
    const redo = () => {
        const previous = current.current;
        if (paused || previous.future.length === 0) {
            return;
        }
        const [present, ...future] = previous.future;
        update({ past: [...previous.past, previous.present].slice(-historyLimit), present, future });
        onRestore(present);
    };
    const reset = useCallback((snapshot: BoardContent) => {
        update({ past: [], present: contentOf(snapshot), future: [] });
    }, [update]);

    return { undo, redo, reset, canUndo: !paused && history.past.length > 0, canRedo: !paused && history.future.length > 0 };
}
