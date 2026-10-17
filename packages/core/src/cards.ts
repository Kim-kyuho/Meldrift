import { sortMemosByOrder } from "./memo-order";
import type { TableSource } from "./table-card";

export const cardTypes = ["memo", "image", "mermaid", "table"] as const;
export type CardType = (typeof cardTypes)[number];
export type CardLayerAction = "front" | "back";

export type CardLayer = {
    type: CardType;
    id: number;
    z: number;
};

export type SelectedCard = {
    type: CardType;
    id: number;
};

export type SelectionRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type SelectionOffset = {
    x: number;
    y: number;
};

export const cardTypeOrder: Record<CardType, number> = {
    memo: 0,
    image: 1,
    mermaid: 2,
    table: 3,
};

/** 편집 중인 카드는 z 값과 무관하게 다른 카드 위로 올라와야 한다. */
export const ACTIVE_CARD_Z = 49999;

/** 메모 각 꼭짓점을 중심으로 첨부 카드를 연결하는 반경(px). */
export const cornerLinkRadius = 50;

/**
 * 메모 꼭짓점(cornerX, cornerY)을 중심으로 반경 radius 원형 영역과
 * 카드 사각형이 겹치는지(점과 사각형 사이의 최단 거리가 radius 이하인지) 판정한다.
 * 카드가 메모 안쪽(겹침)에 있든 바깥쪽에 떨어져 있든 반경 안이면 연결된다.
 */
export const isCardWithinCornerRadius = (
    card: SelectionRect,
    cornerX: number,
    cornerY: number,
    radius = cornerLinkRadius,
): boolean => {
    const dx = Math.max(0, card.x - cornerX, cornerX - (card.x + card.width));
    const dy = Math.max(0, card.y - cornerY, cornerY - (card.y + card.height));
    return dx * dx + dy * dy <= radius * radius;
};

/** 두 카드 영역이 겹치거나 맞닿아 있는지 판정한다. */
export const doCardRectsOverlap = (left: SelectionRect, right: SelectionRect): boolean =>
    left.x <= right.x + right.width &&
    right.x <= left.x + left.width &&
    left.y <= right.y + right.height &&
    right.y <= left.y + left.height;

/**
 * 메모 꼭짓점(cornerX, cornerY)과 바깥쪽 연결 카드 사각형 위에서
 * 점선 연결선이 닿을 최단 거리 경계점(anchor)을 계산한다.
 */
export const getCardCornerAnchor = (
    card: SelectionRect,
    cornerX: number,
    cornerY: number,
): { x: number; y: number } => ({
    x: Math.min(Math.max(cornerX, card.x), card.x + card.width),
    y: Math.min(Math.max(cornerY, card.y), card.y + card.height),
});

export type CornerLinkableMemo = SelectionRect & {
    id: number;
    sortOrder: number;
};

export type CornerLinkableCard = SelectionRect & {
    type: Exclude<CardType, "memo">;
    id: number;
    z: number;
};

export type MemoCornerLink = {
    memoId: number;
    cornerIndex: number;
    cardType: Exclude<CardType, "memo">;
    cardId: number;
    from: { x: number; y: number };
    to: { x: number; y: number };
};

/**
 * 메모 순서(sortOrder, id)와 꼭짓점 순서(좌상·우상·좌하·우하)에 따라
 * 각 꼭짓점 반경 50px 안에서 z가 가장 높은 카드를 찾아 1회씩 연결하되,
 * 메모와 카드 영역이 겹쳐 있을 때는 점선 표시 대상에서 제외한다.
 */
export function resolveMemoCornerLinks(
    memos: CornerLinkableMemo[],
    cards: CornerLinkableCard[],
    radius = cornerLinkRadius,
): MemoCornerLink[] {
    const links: MemoCornerLink[] = [];
    const linkedCards = new Set<string>();

    sortMemosByOrder(memos).forEach((memo) => {
        const corners: [number, number][] = [
            [memo.x, memo.y],
            [memo.x + memo.width, memo.y],
            [memo.x, memo.y + memo.height],
            [memo.x + memo.width, memo.y + memo.height],
        ];

        corners.forEach(([cornerX, cornerY], cornerIndex) => {
            const card = cards
                .filter((candidate) => isCardWithinCornerRadius(candidate, cornerX, cornerY, radius))
                .sort((left, right) =>
                    right.z - left.z
                    || cardTypeOrder[left.type] - cardTypeOrder[right.type]
                    || left.id - right.id)[0];
            if (!card) {
                return;
            }

            const key = `${card.type}:${card.id}`;
            if (linkedCards.has(key)) {
                return;
            }
            linkedCards.add(key);

            if (doCardRectsOverlap(memo, card)) {
                return;
            }

            links.push({
                memoId: memo.id,
                cornerIndex,
                cardType: card.type,
                cardId: card.id,
                from: { x: cornerX, y: cornerY },
                to: getCardCornerAnchor(card, cornerX, cornerY),
            });
        });
    });

    return links;
}

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
