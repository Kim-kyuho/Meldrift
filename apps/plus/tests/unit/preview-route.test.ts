import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PUT } from "@/app/api/boards/[boardId]/preview/route";
import { boardPreviewUrl } from "@/lib/board-preview";

const mocks = vi.hoisted(() => ({
    user: vi.fn(), permission: vi.fn(), limit: vi.fn(), set: vi.fn(), where: vi.fn(),
    upload: vi.fn(), uploadOptions: vi.fn(),
}));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUserFromRequest: mocks.user, getCardPermissionMessage: mocks.permission }));
vi.mock("@/lib/db", () => ({ getDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: mocks.limit }) }) }),
    update: () => ({ set: (values: unknown) => {
        mocks.set(values);
        return { where: mocks.where };
    } }),
}) }));
vi.mock("cloudinary", () => ({ v2: {
    config: vi.fn(),
    uploader: {
        upload_stream: (options: unknown, callback: (error: unknown, result?: unknown) => void) => {
            mocks.uploadOptions(options);
            return { end: () => mocks.upload().then((result: unknown) => callback(null, result), callback) };
        },
    },
} }));

const context = { params: Promise.resolve({ boardId: "7" }) };
function request() {
    const form = new FormData();
    form.append("file", new File([new Uint8Array(8)], "PreviewIMG.webp", { type: "image/webp" }));
    const next = new NextRequest("http://localhost/api/boards/7/preview", { method: "PUT" });
    vi.spyOn(next, "formData").mockResolvedValue(form);
    return next;
}

describe("preview API", () => {
    beforeEach(() => {
        vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo");
        vi.stubEnv("CLOUDINARY_API_KEY", "key");
        vi.stubEnv("CLOUDINARY_API_SECRET", "secret");
        mocks.user.mockResolvedValue({ id: 5, isApproved: true });
        mocks.permission.mockReturnValue(null);
        mocks.limit.mockResolvedValue([{ boardId: 7 }]);
        mocks.where.mockResolvedValue(undefined);
        mocks.upload.mockResolvedValue({
            public_id: "meldrift/boards/7/PreviewIMG", version: 1790000000,
            secure_url: "https://res.cloudinary.com/demo/image/upload/v1790000000/meldrift/boards/7/PreviewIMG.webp",
            width: 320, height: 180, bytes: 8, format: "webp",
        });
    });

    it("업로드한 version을 보드에 저장해 목록 URL이 바뀌게 한다", async () => {
        const response = await PUT(request(), context);

        expect(response.status).toBe(200);
        expect(mocks.set).toHaveBeenCalledWith({ previewVersion: 1790000000 });
        expect((await response.json()).preview.version).toBe(1790000000);
    });

    it("URL이 업로드마다 바뀌므로 CDN 무효화를 요청하지 않는다", async () => {
        await PUT(request(), context);

        expect(mocks.uploadOptions).toHaveBeenCalledWith(expect.objectContaining({
            folder: "meldrift/boards/7", public_id: "PreviewIMG", overwrite: true,
        }));
        expect(mocks.uploadOptions.mock.calls[0][0]).not.toHaveProperty("invalidate");
    });

    it("업로드가 실패하면 version을 바꾸지 않는다", async () => {
        mocks.upload.mockRejectedValue(new Error("cloudinary down"));
        vi.spyOn(console, "error").mockImplementation(() => {});

        expect((await PUT(request(), context)).status).toBe(500);
        expect(mocks.set).not.toHaveBeenCalled();
    });

    it("편집 권한이 없으면 업로드하지 않는다", async () => {
        mocks.permission.mockReturnValue("Sign in to edit cards.");

        expect((await PUT(request(), context)).status).toBe(403);
        expect(mocks.uploadOptions).not.toHaveBeenCalled();
    });
});

describe("boardPreviewUrl", () => {
    it("version이 있으면 URL에 넣어 업로드마다 새 주소가 된다", () => {
        expect(boardPreviewUrl("demo", 7, 1790000000))
            .toBe("https://res.cloudinary.com/demo/image/upload/v1790000000/meldrift/boards/7/PreviewIMG.webp");
    });

    it("version이 없는 예전 보드는 고정 URL을 쓴다", () => {
        expect(boardPreviewUrl("demo", 7, null))
            .toBe("https://res.cloudinary.com/demo/image/upload/meldrift/boards/7/PreviewIMG.webp");
    });
});
