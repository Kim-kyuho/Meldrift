import { boardAccess } from "@/lib/board-access";
import { NextResponse } from "next/server";
import { loadSavedBoardSnapshot } from "@/lib/saved-board-snapshot";

export async function GET(request: Request, { params }: { params: Promise<{ boardId: string; imageId: string }> }) {
    const ids = await params;
    const boardId = Number(ids.boardId);
    const imageId = Number(ids.imageId);
    if (![boardId, imageId].every((id) => Number.isSafeInteger(id) && id > 0)) {
        return new NextResponse(null, { status: 404 });
    }
    const gate = await boardAccess(request, boardId);
    if (gate.failure) {
        return gate.failure;
    }
    const snapshot = await loadSavedBoardSnapshot(boardId);
    const image = snapshot?.images.find((image) => image.imageId === imageId);
    if (!image?.data || !image.mimeType) {
        return new NextResponse(null, { status: 404 });
    }
    return new NextResponse(new Uint8Array(image.data), { headers: {
        "Content-Type": image.mimeType,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
}
