import { getCardPermissionMessage, getCurrentUserFromRequest } from "@/lib/auth/current-user";
import { NextRequest, NextResponse } from "next/server";

// AI 어시스턴트를 쓸 수 있는 상태인지 알려준다.
// 채팅을 보내기 전에 버튼 단계에서 막기 위한 용도라 키 값 자체는 다루지 않는다.
export async function GET(request: NextRequest) {
    try {
        const currentUser = await getCurrentUserFromRequest(request);
        const permissionMessage = getCardPermissionMessage(currentUser);
        const configured = Boolean(process.env.AI_API_KEY);

        return NextResponse.json({
            ok: true,
            configured,
            available: configured && !permissionMessage,
            message: !configured
                ? "The AI assistant is not configured on this server."
                : permissionMessage,
        });
    } catch (error) {
        console.error("Error fetching AI status:", error);
        return NextResponse.json(
            {
                ok: false,
                message: "An error occurred while checking the AI assistant.",
            },
            { status: 500 },
        );
    }
}
