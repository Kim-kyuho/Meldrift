import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName, type Table } from "drizzle-orm";
import { NextRequest } from "next/server";
import { GET, PUT } from "@/app/api/boards/[boardId]/preview/route";
import { boardPreviewUrl } from "@/lib/board-preview";

const mocks = vi.hoisted(() => ({ user: vi.fn(), rows: vi.fn(), execute: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUserFromRequest: mocks.user }));
vi.mock("@/lib/db", () => ({ getDb: () => ({
    select: () => ({ from: (table: Table) => ({ where: () => ({ limit: () => mocks.rows(getTableName(table)) }) }) }),
    execute: mocks.execute,
}) }));

const context = { params: Promise.resolve({ boardId: "7" }) };
const url = "http://localhost/api/boards/7/preview";
const board = { boardId: 7, ownerId: "owner@example.com", privateFlg: 1, previewVersion: null };
const owner = { id: 5, email: board.ownerId, isApproved: true, role: "user" };

function upload(type = "image/webp") {
    const form = new FormData();
    form.append("file", new File([new Uint8Array(8)], "preview", { type }));
    const request = new NextRequest(url, { method: "PUT" });
    vi.spyOn(request, "formData").mockResolvedValue(form);
    return PUT(request, context);
}

describe("미리보기 API", () => {
    beforeEach(() => {
        vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo");
        mocks.user.mockResolvedValue(owner);
        mocks.rows.mockImplementation((table) => table === "boards" ? [board] : []);
        mocks.execute.mockResolvedValue({ rows: [{ board_id: 7 }] });
    });

    it("stores previews through the authorized board write without returning an external URL", async () => {
        const response = await upload();
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ ok: true });
        expect(mocks.execute).toHaveBeenCalledOnce();
    });

    it("rejects unauthorized uploads and does not read the image body", async () => {
        mocks.user.mockResolvedValue(null);
        const request = new NextRequest(url, { method: "PUT" });
        const read = vi.spyOn(request, "formData");
        expect((await PUT(request, context)).status).toBe(401);
        expect(read).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it("requires board access before reading a private preview", async () => {
        mocks.user.mockResolvedValue(null);
        expect((await GET(new NextRequest(url), context)).status).toBe(404);
        expect(mocks.rows).not.toHaveBeenCalledWith("board_previews");
    });

    it("serves the private owner's preview with no shared cache", async () => {
        mocks.rows.mockImplementation((table) => table === "boards" ? [board]
            : [{ bytes: Buffer.from([1, 2, 3]), mimeType: "image/webp" }]);
        const response = await GET(new NextRequest(url), context);
        expect(response.headers.get("Cache-Control")).toBe("no-store");
        expect(response.headers.get("Content-Type")).toBe("image/webp");
        expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    });

    it("does not redirect a private board to its former public preview", async () => {
        mocks.rows.mockImplementation((table) => table === "boards" ? [{ ...board, previewVersion: 42 }] : []);
        const response = await GET(new NextRequest(url), context);
        expect(response.status).toBe(404);
        expect(response.headers.get("Location")).toBeNull();
    });
});

describe("boardPreviewUrl 동작", () => {
    it("version이 있으면 URL에 넣어 업로드마다 새 주소가 된다", () => {
        expect(boardPreviewUrl("demo", 7, 1790000000))
            .toBe("https://res.cloudinary.com/demo/image/upload/v1790000000/meldrift/boards/7/PreviewIMG.webp");
    });

    it("supports older unversioned URLs", () => {
        expect(boardPreviewUrl("demo", 7, null))
            .toBe("https://res.cloudinary.com/demo/image/upload/meldrift/boards/7/PreviewIMG.webp");
    });
});
