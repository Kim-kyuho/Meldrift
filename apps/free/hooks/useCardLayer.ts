import { Dispatch, SetStateAction } from "react";
import type { BoardImage, BoardMemo, BoardMermaid, BoardTable } from "@/lib/board-state";

export type CardLayerType = "memo" | "image" | "mermaid" | "table";
export type CardLayerAction = "front" | "back";

type CardLayer = {
    type: CardLayerType;
    id: number;
    z: number;
};

type UseCardLayerOptions = {
    memos: BoardMemo[];
    images: BoardImage[];
    mermaids: BoardMermaid[];
    tables: BoardTable[];
    setMemos: Dispatch<SetStateAction<BoardMemo[]>>;
    setImages: Dispatch<SetStateAction<BoardImage[]>>;
    setMermaids: Dispatch<SetStateAction<BoardMermaid[]>>;
    setTables: Dispatch<SetStateAction<BoardTable[]>>;
};

const typeOrder: Record<CardLayerType, number> = { memo: 0, image: 1, mermaid: 2, table: 3 };

export function useCardLayer({
    memos,
    images,
    mermaids,
    tables,
    setMemos,
    setImages,
    setMermaids,
    setTables,
}: UseCardLayerOptions) {
    const applyCardLayers = (cards: CardLayer[]) => {
        const layers = new Map(cards.map((card) => [`${card.type}:${card.id}`, card.z]));
        setMemos((prev) => prev.map((memo) => ({ ...memo, z: layers.get(`memo:${memo.id}`) ?? memo.z })));
        setImages((prev) => prev.map((image) => ({ ...image, z: layers.get(`image:${image.imageId}`) ?? image.z })));
        setMermaids((prev) => prev.map((mermaid) => ({ ...mermaid, z: layers.get(`mermaid:${mermaid.id}`) ?? mermaid.z })));
        setTables((prev) => prev.map((table) => ({ ...table, z: layers.get(`table:${table.id}`) ?? table.z })));
    };

    const handleCardLayer = (type: CardLayerType, id: number, action: CardLayerAction) => {
        if (id < 0) return;

        const cards: CardLayer[] = [
            ...memos.map((memo) => ({ type: "memo" as const, id: memo.id, z: memo.z })),
            ...images.map((image) => ({ type: "image" as const, id: image.imageId, z: image.z })),
            ...mermaids.map((mermaid) => ({ type: "mermaid" as const, id: mermaid.id, z: mermaid.z })),
            ...tables.map((table) => ({ type: "table" as const, id: table.id, z: table.z })),
        ].sort((left, right) => left.z - right.z || typeOrder[left.type] - typeOrder[right.type] || left.id - right.id);

        const targetIndex = cards.findIndex((card) => card.type === type && card.id === id);
        if (targetIndex < 0) return;

        const [target] = cards.splice(targetIndex, 1);
        if (action === "front") cards.push(target);
        else cards.unshift(target);

        applyCardLayers(cards.map((card, index) => ({ ...card, z: index + 1 })));
    };

    return { handleCardLayer };
}
