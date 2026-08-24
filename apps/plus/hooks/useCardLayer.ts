import { Dispatch, SetStateAction } from "react";
import { BoardImage } from "@/hooks/useBoardImages";
import { BoardMemo } from "@/hooks/useBoardMemos";
import { BoardMermaid } from "@/hooks/useBoardMermaids";
import { BoardTable } from "@/hooks/useBoardTables";

export type CardLayerType = "memo" | "image" | "mermaid" | "table";
export type CardLayerAction = "front" | "back";

type CardLayer = {
    type: CardLayerType;
    id: number;
    z: number;
};

type UseCardLayerOptions = {
    boardId: number;
    setMemos: Dispatch<SetStateAction<BoardMemo[]>>;
    setImages: Dispatch<SetStateAction<BoardImage[]>>;
    setMermaids: Dispatch<SetStateAction<BoardMermaid[]>>;
    setTables: Dispatch<SetStateAction<BoardTable[]>>;
    setPermissionMessage: (message: string) => void;
};

export function useCardLayer({
    boardId,
    setMemos,
    setImages,
    setMermaids,
    setTables,
    setPermissionMessage,
}: UseCardLayerOptions) {
    const applyCardLayers = (cards: CardLayer[]) => {
        const memoLayers = new Map(cards.filter((card) => card.type === "memo").map((card) => [card.id, card.z]));
        const imageLayers = new Map(cards.filter((card) => card.type === "image").map((card) => [card.id, card.z]));
        const mermaidLayers = new Map(cards.filter((card) => card.type === "mermaid").map((card) => [card.id, card.z]));
        const tableLayers = new Map(cards.filter((card) => card.type === "table").map((card) => [card.id, card.z]));

        setMemos((prev) =>
            prev.map((memo) =>
                memoLayers.has(memo.id) ? { ...memo, z: memoLayers.get(memo.id)! } : memo
            )
        );
        setImages((prev) =>
            prev.map((image) =>
                imageLayers.has(image.imageId) ? { ...image, z: imageLayers.get(image.imageId)! } : image
            )
        );
        setMermaids((prev) =>
            prev.map((mermaid) =>
                mermaidLayers.has(mermaid.id) ? { ...mermaid, z: mermaidLayers.get(mermaid.id)! } : mermaid
            )
        );
        setTables((prev) =>
            prev.map((table) =>
                tableLayers.has(table.id) ? { ...table, z: tableLayers.get(table.id)! } : table
            )
        );
    };

    const handleCardLayer = async (type: CardLayerType, id: number, action: CardLayerAction) => {
        if (id < 0) {
            return;
        }

        const response = await fetch("/api/cards/layer", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                boardId,
                type,
                id,
                action,
            }),
        });
        const data = await response.json();

        if (!response.ok || !data.ok) {
            setPermissionMessage(data.message ?? "Card layer could not be updated.");
            return;
        }

        applyCardLayers(data.cards ?? []);
    };

    return {
        handleCardLayer,
    };
}
