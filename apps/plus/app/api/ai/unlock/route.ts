import {
    aiSessionCookieName,
    createAiSessionToken,
    isAiPasswordConfigured,
    verifyAiPassword,
} from "@meldrift/ai/passcode";
import {
    clearFailures,
    getAttemptKey,
    isThrottled,
    maxFailedAttempts,
    recordFailure,
} from "@meldrift/ai/unlock-throttle";
import { NextRequest, NextResponse } from "next/server";
import { getCardPermissionMessage, getCurrentUserFromRequest } from "@/lib/auth/current-user";


const maxPasswordLength = 200;

const sessionCookie = (token: string) => ({
    name: aiSessionCookieName,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
});

export async function POST(request: NextRequest) {
    const currentUser = await getCurrentUserFromRequest(request);
    const permissionMessage = getCardPermissionMessage(currentUser);

    if (permissionMessage || !currentUser) {
        return NextResponse.json(
            { ok: false, message: permissionMessage ?? "Please sign in before editing cards." },
            { status: 403 },
        );
    }

    if (!isAiPasswordConfigured() || !process.env.AI_API_KEY) {
        return NextResponse.json(
            { ok: false, message: "The AI assistant is not configured on this server." },
            { status: 503 },
        );
    }

    const attemptKey = getAttemptKey(request.headers);

    if (isThrottled(attemptKey)) {
        return NextResponse.json(
            { ok: false, message: "Too many failed attempts. Please wait a few minutes and try again." },
            { status: 429 },
        );
    }

    let password: unknown;

    try {
        password = (await request.json())?.password;
    } catch {
        return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 });
    }

    if (typeof password !== "string" || password.length === 0 || password.length > maxPasswordLength) {
        return NextResponse.json({ ok: false, message: "Enter the assistant password." }, { status: 400 });
    }

    if (!verifyAiPassword(password)) {
        const failures = recordFailure(attemptKey);
        const remaining = Math.max(0, maxFailedAttempts - failures);

        return NextResponse.json(
            {
                ok: false,
                message: remaining > 0
                    ? "That password is not correct."
                    : "Too many failed attempts. Please wait a few minutes and try again.",
            },
            { status: 401 },
        );
    }

    clearFailures(attemptKey);

    const response = NextResponse.json({ ok: true });
    response.cookies.set(sessionCookie(createAiSessionToken()));

    return response;
}

export async function DELETE() {
    const response = NextResponse.json({ ok: true });
    response.cookies.set({ ...sessionCookie(""), maxAge: 0 });

    return response;
}
