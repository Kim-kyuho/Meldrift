import type { TableSource } from "./table-card";

export const cardTypes = ["memo", "image", "mermaid", "table"] as const;
export type CardType = (typeof cardTypes)[number];
export type CardLayerAction = "front" | "back";

export type CardLayer = {
    type: CardType;
    id: number;
    z: number;
};

export const cardTypeOrder: Record<CardType, number> = {
    memo: 0,
    image: 1,
    mermaid: 2,
    table: 3,
};

/** 편집 중인 카드는 z 값과 무관하게 다른 카드 위로 올라와야 한다. */
export const ACTIVE_CARD_Z = 49999;

export const isCardType = (value: unknown): value is CardType =>
    typeof value === "string" && cardTypes.some((type) => type === value);

export const isCardLayerAction = (value: unknown): value is CardLayerAction =>
    value === "front" || value === "back";

/** 카드 종류와 무관하게 공통인 저장 필드. 이미지 카드는 free/plus의 보관 방식이 달라 여기서 다루지 않는다. */
export type CardFrame = {
    id: number;
    boardId: number;
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
};

export type MemoCardData = CardFrame & {
    content: string;
    color: string;
    sortOrder: number;
};

export type MermaidCardData = CardFrame & {
    source: string;
};

export type TableCardData = CardFrame & {
    source: TableSource;
};
