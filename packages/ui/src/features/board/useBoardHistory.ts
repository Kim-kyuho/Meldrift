"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardSnapshot } from "@meldrift/board-data/board-state";
import { applyRemotePatch, type RemotePatch } from "@meldrift/board-data/remote-patch";

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

    // 다른 사람의 확정 변경을 보관 중인 모든 상태에 똑같이 적용한다. 이웃한 상태의 차이에는 내 변경만 남으므로
    // Undo가 남의 변경을 되돌리지 않는다. 화면에 같은 패치를 적용한 뒤에도 새 기록이 생기지 않는다.
    const projectRemote = useCallback((patch: RemotePatch) => {
        const previous = current.current;
        const project = (content: BoardContent) => applyRemotePatch(content, patch);
        update({
            past: previous.past.map(project),
            present: project(previous.present),
            future: previous.future.map(project),
        });
    }, [update]);

    const peek = (direction: "undo" | "redo") => {
        const previous = current.current;
        const target = direction === "undo" ? previous.past[previous.past.length - 1] : previous.future[0];
        return target ? { from: previous.present, to: target } : null;
    };

    return {
        undo,
        redo,
        reset,
        projectRemote,
        peek,
        canUndo: !paused && history.past.length > 0,
        canRedo: !paused && history.future.length > 0,
    };
}
