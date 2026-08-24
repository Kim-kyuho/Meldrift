import { RefObject, useState } from "react";

export type BoardMemo = {
    id: number;
    boardId: number;
    content: string;
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
    color: string;
};

type UseBoardMemosOptions = {
    initialMemos: BoardMemo[];
    boardId: number;
    boardZoom: number;
    cardLocationRef: RefObject<HTMLDivElement | null>;
    canEditCard: boolean;
    showPermissionMessage: () => void;
    setPermissionMessage: (message: string) => void;
    onPreviewUpdate: () => void;
};

export function useBoardMemos({
    initialMemos,
    boardId,
    boardZoom,
    cardLocationRef,
    canEditCard,
    showPermissionMessage,
    setPermissionMessage,
    onPreviewUpdate,
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
        if (!canEditCard) {
            showPermissionMessage();
            return;
        }

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
        const response = await fetch("/api/memos", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                boardId, content, x, y, z, width, height, color
            }),
        });

        const data = await response.json();
        if (!response.ok || !data.ok) {
            setPermissionMessage(data.message ?? "You do not have permission to edit cards.");
            return;
        }
        setMemos((prev) =>
            prev.map((memo) =>
                memo.id === tempId ? { ...data.memo, isNew: false } : memo
            )
        );
        onPreviewUpdate();
    };

    const handleUpdateMemo = async (id: number, boardId: number, content: string, x: number, y: number, z: number, width: number, height: number, color: string) => {
        const response = await fetch(`/api/memos/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ boardId, content, x, y, z, width, height, color }),
        });
        const data = await response.json();
        if (!data.ok) {
            setPermissionMessage(data.message ?? "You do not have permission to edit cards.");
            return;
        }
        setMemos((prev) =>
            prev.map((memo) =>
                memo.id === id ? { ...memo, content, x, y, z, width, height, color } : memo
            )
        );
        onPreviewUpdate();
    };

    const handleDeleteMemo = async (id: number) => {
        if (id < 0) {
            setMemos((prev) =>
                prev.filter((memo) => memo.id !== id));
            setEditingMemoId((prev) => prev === id ? null : prev);
            return;
        }

        const response = await fetch(`/api/memos/${id}`, {
            method: "DELETE",
        });
        const data = await response.json();
        if (!data.ok) {
            setPermissionMessage(data.message ?? "You do not have permission to edit cards.");
            return;
        }
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
