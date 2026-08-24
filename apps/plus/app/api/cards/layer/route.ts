import { getCardPermissionMessage, getCurrentUserFromRequest } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { db_images, db_memos, db_mermaids, db_tables } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

type CardLayerType = "memo" | "image" | "mermaid" | "table";
type CardLayerAction = "front" | "back";

type LayerCard = {
    type: CardLayerType;
    id: number;
    z: number;
};

const normalizeThreshold = 9000;
const typeOrder: Record<CardLayerType, number> = {
    memo: 1,
    image: 2,
    mermaid: 3,
    table: 4,
};

const isCardLayerType = (value: unknown): value is CardLayerType =>
    value === "memo" || value === "image" || value === "mermaid" || value === "table";

const isCardLayerAction = (value: unknown): value is CardLayerAction => value === "front" || value === "back";

const normalizeLayerCards = (cards: LayerCard[]) =>
    [...cards]
        .sort((a, b) => a.z - b.z || typeOrder[a.type] - typeOrder[b.type] || a.id - b.id)
        .map((card, index) => ({
            ...card,
            z: index + 1,
        }));

async function getLayerCards(boardId: number) {
    const db = getDb();

    const [memos, images, mermaids, tables] = await Promise.all([
        db
            .select({
                id: db_memos.id,
                z: db_memos.z,
            })
            .from(db_memos)
            .where(eq(db_memos.boardId, boardId)),
        db
            .select({
                id: db_images.imageId,
                z: db_images.z,
            })
            .from(db_images)
            .where(eq(db_images.boardId, boardId)),
        db
            .select({
                id: db_mermaids.mermaidId,
                z: db_mermaids.z,
            })
            .from(db_mermaids)
            .where(eq(db_mermaids.boardId, boardId)),
        db
            .select({
                id: db_tables.tableId,
                z: db_tables.z,
            })
            .from(db_tables)
            .where(eq(db_tables.boardId, boardId)),
    ]);

    return [
        ...memos.map((memo) => ({
            type: "memo" as const,
            id: memo.id,
            z: memo.z,
        })),
        ...images.map((image) => ({
            type: "image" as const,
            id: image.id,
            z: image.z,
        })),
        ...mermaids.map((mermaid) => ({
            type: "mermaid" as const,
            id: mermaid.id,
            z: mermaid.z,
        })),
        ...tables.map((table) => ({
            type: "table" as const,
            id: table.id,
            z: table.z,
        })),
    ];
}

async function updateCardZ(card: LayerCard) {
    const db = getDb();

    if (card.type === "memo") {
        await db.update(db_memos).set({ z: card.z }).where(eq(db_memos.id, card.id));
        return;
    }

    if (card.type === "image") {
        await db.update(db_images).set({ z: card.z }).where(eq(db_images.imageId, card.id));
        return;
    }

    if (card.type === "mermaid") {
        await db.update(db_mermaids).set({ z: card.z }).where(eq(db_mermaids.mermaidId, card.id));
        return;
    }

    if (card.type === "table") {
        await db.update(db_tables).set({ z: card.z }).where(eq(db_tables.tableId, card.id));
        return;
    }
}

async function bringCardToFront(type: CardLayerType, id: number, z: number) {
    await updateCardZ({ type, id, z });
}

async function sendCardToBack(type: CardLayerType, id: number, boardId: number) {
    const db = getDb();

    await Promise.all([
        type === "memo"
            ? db.update(db_memos).set({ z: 1 }).where(eq(db_memos.id, id))
            : db
                  .update(db_memos)
                  .set({ z: sql`${db_memos.z} + 1` })
                  .where(eq(db_memos.boardId, boardId)),
        type === "image"
            ? db.update(db_images).set({ z: 1 }).where(eq(db_images.imageId, id))
            : db
                  .update(db_images)
                  .set({ z: sql`${db_images.z} + 1` })
                  .where(eq(db_images.boardId, boardId)),
        type === "mermaid"
            ? db.update(db_mermaids).set({ z: 1 }).where(eq(db_mermaids.mermaidId, id))
            : db
                  .update(db_mermaids)
                  .set({ z: sql`${db_mermaids.z} + 1` })
                  .where(eq(db_mermaids.boardId, boardId)),
        type === "table"
            ? db.update(db_tables).set({ z: 1 }).where(eq(db_tables.tableId, id))
            : db
                  .update(db_tables)
                  .set({ z: sql`${db_tables.z} + 1` })
                  .where(eq(db_tables.boardId, boardId)),
    ]);

    if (type === "memo") {
        await db
            .update(db_memos)
            .set({ z: sql`${db_memos.z} + 1` })
            .where(and(eq(db_memos.boardId, boardId), sql`${db_memos.id} <> ${id}`));
        return;
    }

    if (type === "image") {
        await db
            .update(db_images)
            .set({ z: sql`${db_images.z} + 1` })
            .where(and(eq(db_images.boardId, boardId), sql`${db_images.imageId} <> ${id}`));
        return;
    }

    if (type === "mermaid") {
        await db
            .update(db_mermaids)
            .set({ z: sql`${db_mermaids.z} + 1` })
            .where(and(eq(db_mermaids.boardId, boardId), sql`${db_mermaids.mermaidId} <> ${id}`));
        return;
    }

    if (type === "table") {
        await db
            .update(db_tables)
            .set({ z: sql`${db_tables.z} + 1` })
            .where(and(eq(db_tables.boardId, boardId), sql`${db_tables.tableId} <> ${id}`));
        return;
    }
}

async function normalizeCards(cards: LayerCard[]) {
    const normalizedCards = normalizeLayerCards(cards);

    await Promise.all(normalizedCards.map((card) => updateCardZ(card)));

    return normalizedCards;
}

export async function POST(request: NextRequest) {
    try {
        const currentUser = await getCurrentUserFromRequest(request);
        const permissionMessage = getCardPermissionMessage(currentUser);

        if (permissionMessage) {
            return NextResponse.json(
                {
                    ok: false,
                    message: permissionMessage,
                },
                { status: 403 },
            );
        }

        const body = await request.json();
        const boardId = Number(body.boardId);
        const id = Number(body.id);
        const type = body.type;
        const action = body.action;

        if (
            !Number.isInteger(boardId) ||
            boardId <= 0 ||
            !Number.isInteger(id) ||
            id <= 0 ||
            !isCardLayerType(type) ||
            !isCardLayerAction(action)
        ) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Invalid card layer request.",
                },
                { status: 400 },
            );
        }

        const cards = await getLayerCards(boardId);
        const targetCard = cards.find((card) => card.type === type && card.id === id);

        if (!targetCard) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Card does not exist.",
                },
                { status: 404 },
            );
        }

        const maxZ = Math.max(...cards.map((card) => card.z), 1);
        let nextCards: LayerCard[];

        if (action === "front") {
            const nextZ = maxZ + 1;

            await bringCardToFront(type, id, nextZ);
            nextCards = cards.map((card) => (card.type === type && card.id === id ? { ...card, z: nextZ } : card));
        } else {
            await sendCardToBack(type, id, boardId);
            nextCards = cards.map((card) =>
                card.type === type && card.id === id ? { ...card, z: 1 } : { ...card, z: card.z + 1 },
            );
        }

        if (Math.max(...nextCards.map((card) => card.z), 1) >= normalizeThreshold) {
            nextCards = await normalizeCards(nextCards);
        }

        return NextResponse.json({
            ok: true,
            cards: nextCards,
        });
    } catch (error) {
        console.error("Error updating card layer:", error);
        return NextResponse.json(
            {
                ok: false,
                message: "An error occurred while updating the card layer.",
            },
            { status: 500 },
        );
    }
}
