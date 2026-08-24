import { NextRequest, NextResponse } from "next/server";
import { aiSessionCookieName, isAiPasswordConfigured, verifyAiSessionToken } from "@/lib/ai/passcode";

// 잠금 쿠키가 HttpOnly라 브라우저 JS가 못 읽음 - 잠금 상태는 이 경로로 확인
export async function GET(request: NextRequest) {
    try {
        const configured = Boolean(process.env.AI_API_KEY) && isAiPasswordConfigured();
        const unlocked =
            configured && verifyAiSessionToken(request.cookies.get(aiSessionCookieName)?.value);

        return NextResponse.json({
            ok: true,
            configured,
            unlocked,
            message: configured ? null : "The AI assistant is not configured on this server.",
        });
    } catch (error) {
        console.error("Error fetching AI status:", error);
        return NextResponse.json(
            { ok: false, message: "An error occurred while checking the AI assistant." },
            { status: 500 },
        );
    }
}
