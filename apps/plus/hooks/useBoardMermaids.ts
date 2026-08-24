import { RefObject, useState } from "react";

export type BoardMermaid = {
    id: number;
    boardId: number;
    source: string;
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
};

type UseBoardMermaidsOptions = {
    initialMermaids: BoardMermaid[];
    boardId: number;
    boardZoom: number;
    canEditCard: boolean;
    cardLocationRef: RefObject<HTMLDivElement | null>;
    showPermissionMessage: () => void;
    setPermissionMessage: (message: string) => void;
    onPreviewUpdate: () => void;
};

type BoardPoint = {
    x: number;
    y: number;
};

const defaultMermaidSource = `flowchart LR
    A["Start"] --> B["Mermaid Card"]`;

export function useBoardMermaids({
    initialMermaids,
    boardId,
    boardZoom,
    canEditCard,
    cardLocationRef,
    showPermissionMessage,
    setPermissionMessage,
    onPreviewUpdate,
}: UseBoardMermaidsOptions) {
    const [mermaids, setMermaids] = useState<BoardMermaid[]>(initialMermaids);
    const [editingMermaidId, setEditingMermaidId] = useState<number | null>(null);

    const getMermaidAutoLocation = (): BoardPoint => {
        const locationElement = cardLocationRef.current;
        if (!locationElement) {
            return { x: 0, y: 0 };
        }

        return {
            x: Math.max(0, (locationElement.scrollLeft + locationElement.clientWidth / 2) / boardZoom - 240),
            y: Math.max(0, (locationElement.scrollTop + locationElement.clientHeight / 2) / boardZoom - 180),
        };
    };

    const handleCreateTempMermaid = () => {
        if (!canEditCard) {
            showPermissionMessage();
            return;
        }

        const { x, y } = getMermaidAutoLocation();
        const tempMermaid: BoardMermaid = {
            id: -Date.now(),
            boardId,
            source: defaultMermaidSource,
            x: Math.round(x),
            y: Math.round(y),
            z: 1,
            width: 480,
            height: 360,
        };

        setMermaids((prev) => [...prev, tempMermaid]);
        setEditingMermaidId(tempMermaid.id);
    };

    const handleInsertMermaid = async (
        tempId: number,
        boardId: number,
        source: string,
        x: number,
        y: number,
        z: number,
        width: number,
        height: number,
    ) => {
        const response = await fetch("/api/mermaids", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ boardId, source, x, y, z, width, height }),
        });
        const data = await response.json();

        if (!response.ok || !data.ok) {
            setPermissionMessage(data.message ?? "You do not have permission to edit mermaids.");
            return;
        }

        setMermaids((prev) =>
            prev.map((mermaid) =>
                mermaid.id === tempId
                    ? {
                        id: data.mermaid.mermaidId,
                        boardId: data.mermaid.boardId,
                        source: data.mermaid.source,
                        x: data.mermaid.x,
                        y: data.mermaid.y,
                        z: data.mermaid.z,
                        width: data.mermaid.width,
                        height: data.mermaid.height,
                    }
                    : mermaid
            )
        );
        onPreviewUpdate();
    };

    const handleUpdateMermaid = async (
        id: number,
        boardId: number,
        source: string,
        x: number,
        y: number,
        z: number,
        width: number,
        height: number,
    ) => {
        const response = await fetch(`/api/mermaids/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ boardId, source, x, y, z, width, height }),
        });
        const data = await response.json();

        if (!response.ok || !data.ok) {
            setPermissionMessage(data.message ?? "You do not have permission to edit mermaids.");
            return;
        }

        setMermaids((prev) =>
            prev.map((mermaid) =>
                mermaid.id === id
                    ? { ...mermaid, boardId, source, x, y, z, width, height }
                    : mermaid
            )
        );
        onPreviewUpdate();
    };

    const handleDeleteMermaid = async (id: number) => {
        if (id < 0) {
            setMermaids((prev) => prev.filter((mermaid) => mermaid.id !== id));
            setEditingMermaidId((prev) => prev === id ? null : prev);
            return;
        }

        const response = await fetch(`/api/mermaids/${id}`, {
            method: "DELETE",
        });
        const data = await response.json();

        if (!response.ok || !data.ok) {
            setPermissionMessage(data.message ?? "You do not have permission to delete mermaids.");
            return;
        }

        setMermaids((prev) => prev.filter((mermaid) => mermaid.id !== id));
        setEditingMermaidId((prev) => prev === id ? null : prev);
    };

    return {
        mermaids,
        setMermaids,
        editingMermaidId,
        setEditingMermaidId,
        handleCreateTempMermaid,
        handleInsertMermaid,
        handleUpdateMermaid,
        handleDeleteMermaid,
    };
}
