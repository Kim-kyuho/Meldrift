import { getCardPermissionMessage, getCurrentUserFromRequest } from "@/lib/auth/current-user";
import {
    AssistantUnavailableError,
    runBoardAssistant,
    type AssistantMessage,
    type BoardSnapshot,
} from "@/lib/ai/assistant";
import { NextRequest, NextResponse } from "next/server";

// 카드 여러 장이면 응답이 20초를 넘어 기본 타임아웃으로는 잘림
export const maxDuration = 60;

const maxMessageLength = 4000;
const maxHistoryLength = 20;
const maxSnapshotCards = 200;
const maxSummaryLength = 120;

// 클라이언트가 보낸 목록은 신뢰하지 않음 - 형태와 크기만 통과
const toSnapshotCards = (value: unknown) => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .slice(0, maxSnapshotCards)
        .filter(
            (card): card is { id: number; summary: string } =>
                typeof card === "object" &&
                card !== null &&
                Number.isInteger((card as { id?: unknown }).id) &&
                typeof (card as { summary?: unknown }).summary === "string"
        )
        .map((card) => ({ id: card.id, summary: card.summary.slice(0, maxSummaryLength) }));
};

const isAssistantMessage = (value: unknown): value is AssistantMessage => {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const message = value as Partial<AssistantMessage>;

    return (
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.length > 0 &&
        message.content.length <= maxMessageLength
    );
};

export async function POST(request: NextRequest) {
    try {
        const currentUser = await getCurrentUserFromRequest(request);
        const permissionMessage = getCardPermissionMessage(currentUser);

        if (permissionMessage || !currentUser) {
            return NextResponse.json(
                {
                    ok: false,
                    message: permissionMessage ?? "Please sign in before editing cards.",
                },
                { status: 403 },
            );
        }

        const apiKey = process.env.AI_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "The AI assistant is not configured on this server.",
                },
                { status: 503 },
            );
        }

        const body = await request.json();
        const messages = Array.isArray(body.messages) ? body.messages : [];

        if (messages.length === 0 || messages.length > maxHistoryLength || !messages.every(isAssistantMessage)) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Invalid request body.",
                },
                { status: 400 },
            );
        }

        const snapshot: BoardSnapshot = {
            memos: toSnapshotCards(body.snapshot?.memos),
            mermaids: toSnapshotCards(body.snapshot?.mermaids),
            tables: toSnapshotCards(body.snapshot?.tables),
            images: toSnapshotCards(body.snapshot?.images),
            capacity: Number.isInteger(body.snapshot?.capacity)
                ? Math.max(0, Math.min(64, body.snapshot.capacity))
                : 0,
        };

        const result = await runBoardAssistant(apiKey, messages, snapshot);

        return NextResponse.json({
            ok: true,
            reply: result.reply,
            plan: result.plan,
            arrangement: result.arrangement,
            edit: result.edit,
            deletion: result.deletion,
            images: result.images,
        });
    } catch (error) {
        if (error instanceof AssistantUnavailableError) {
            return NextResponse.json({ ok: false, message: error.message }, { status: 503 });
        }

        console.error("Error running AI assistant:", error);
        return NextResponse.json(
            {
                ok: false,
                message: "The AI assistant could not complete this request.",
            },
            { status: 500 },
        );
    }
}
