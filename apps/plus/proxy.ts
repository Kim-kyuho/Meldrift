import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
    if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method)) {
        return NextResponse.json({
            ok: false,
            message: "Card-by-card saving is no longer supported. Reload the board to use snapshot saving.",
        }, { status: 410 });
    }
    return NextResponse.next();
}

export const config = {
    matcher: [
        "/api/memos/:path*", "/api/images/:path*", "/api/mermaids/:path*",
        "/api/tables/:path*", "/api/drawings/:path*", "/api/cards/layer",
    ],
};
