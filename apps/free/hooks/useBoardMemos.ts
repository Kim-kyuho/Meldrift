import { RefObject, useState } from "react";
import { nextPositiveId, type BoardMemo } from "@/lib/board-state";

export type { BoardMemo } from "@/lib/board-state";

type UseBoardMemosOptions = {
    initialMemos: BoardMemo[];
    boardId: number;
    boardZoom: number;
    cardLocationRef: RefObject<HTMLDivElement | null>;
};

export function useBoardMemos({
    initialMemos,
    boardId,
    boardZoom,
    cardLocationRef,
}: UseBoardMemosOptions) {
    const [memos, setMemos] = useState(initialMemos);
    const [editingMemoId, setEditingMemoId] = useState<number | null>(null);

    const getMemoAutoLocation = () => {
        const locationElement = cardLocationRef.current;
        if (!locationElement) {
            return { x: 0, y: 0 };
        }

        return {
            x: Math.max(0, (locationElement.scrollLeft + locationElement.clientWidth / 2) / boardZoom - 150),
            y: Math.max(0, (locationElement.scrollTop + locationElement.clientHeight / 2) / boardZoom - 100),
        };
    };

    const handleCreateTempMemo = () => {
        const { x, y } = getMemoAutoLocation();
        const tempMemo: BoardMemo = {
            id: -Date.now(),
            boardId,
            content: "",
            x: Math.round(x),
            y: Math.round(y),
            z: 1,
            width: 300,
            height: 200,
            color: "#fffadc",
        };
        setMemos((prev) => [...prev, tempMemo]);
        setEditingMemoId(tempMemo.id);
    };

    const handleInsertMemo = async (tempId: number, boardId: number, content: string, x: number, y: number, z: number, width: number, height: number, color: string) => {
        setMemos((prev) => {
            const id = nextPositiveId(prev.map((memo) => memo.id));
            return prev.map((memo) => memo.id === tempId
                ? { id, boardId, content, x, y, z, width, height, color }
                : memo);
        });
    };

    const handleUpdateMemo = async (id: number, boardId: number, content: string, x: number, y: number, z: number, width: number, height: number, color: string) => {
        setMemos((prev) =>
            prev.map((memo) =>
                memo.id === id ? { ...memo, content, x, y, z, width, height, color } : memo
            )
        );
    };

    const handleDeleteMemo = async (id: number) => {
        setMemos((prev) => prev.filter((memo) => memo.id !== id));
        setEditingMemoId((prev) => prev === id ? null : prev);
    };

    return {
        memos,
        setMemos,
        editingMemoId,
        setEditingMemoId,
        handleCreateTempMemo,
        handleInsertMemo,
        handleUpdateMemo,
        handleDeleteMemo,
    };
}
