import { afterEach, describe, expect, it, vi } from "vitest";
import {
    fitImageSize,
    imageBytesToPng,
    prepareImageFile,
} from "@meldrift/board-data/image-file";

// Safari는 Canvas WebP 인코더가 없어 PNG로 응답하므로 인코더 맵에
// 요청한 형식별로 실제 반환되는 형식을 지정한다.
function stubBrowserImage(produced: Record<string, string>, alpha = 255) {
    const NativeURL = URL;
    class MockURL extends NativeURL {
        static createObjectURL = vi.fn().mockReturnValue("blob:source");
        static revokeObjectURL = vi.fn();
    }
    class MockImage {
        naturalWidth = 4000;
        naturalHeight = 2000;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        set src(_value: string) {
            queueMicrotask(() => this.onload?.());
        }
    }

    vi.stubGlobal("URL", MockURL);
    vi.stubGlobal("Image", MockImage);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
        clearRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, alpha]) }),
    } as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback, type) => {
        const requested = String(type);
        callback(new Blob([new Uint8Array([1, 2, 3])], { type: produced[requested] ?? requested }));
    });
}

describe("로컬 이미지 준비", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("종횡비를 유지하면서 이미지 크기를 맞춘다", () => {
        expect(fitImageSize(4000, 2000, 1920, 1920)).toEqual({ width: 1920, height: 960 });
        expect(fitImageSize(320, 200, 400, 300)).toEqual({ width: 320, height: 200 });
    });

    it("내보낼 때 저장된 PNG 바이트를 그대로 유지한다", async () => {
        const bytes = new Uint8Array([137, 80, 78, 71]);

        await expect(imageBytesToPng(bytes, "image/png"))
            .resolves.toEqual(bytes);
    });

    it("내보낼 때 저장된 JPEG·WebP 바이트를 PNG로 변환한다", async () => {
        const createObjectURL = vi.fn().mockReturnValue("blob:stored-image");
        const revokeObjectURL = vi.fn();
        const NativeURL = URL;

        class MockURL extends NativeURL {
            static createObjectURL = createObjectURL;
            static revokeObjectURL = revokeObjectURL;
        }
        class MockImage {
            naturalWidth = 640;
            naturalHeight = 480;
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;

            set src(_value: string) {
                queueMicrotask(() => this.onload?.());
            }
        }

        vi.stubGlobal("URL", MockURL);
        vi.stubGlobal("Image", MockImage);
        const drawImage = vi.fn();
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as never);
        vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
            callback(new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }));
        });

        await expect(imageBytesToPng(new Uint8Array([1, 2, 3]), "image/webp"))
            .resolves.toEqual(new Uint8Array([137, 80, 78, 71]));
        expect(drawImage).toHaveBeenCalledWith(expect.any(MockImage), 0, 0);
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:stored-image");
    });

    it("디코딩 전에 지원하지 않는 로컬 이미지 형식을 거부한다", async () => {
        const file = new File(["svg"], "drawing.svg", { type: "image/svg+xml" });
        await expect(prepareImageFile(file)).rejects.toThrow(/JPEG, PNG, or WebP/i);
    });

    it("선택한 이미지의 크기를 조정하고 인코딩한 뒤 바이트를 반환한다", async () => {
        const createObjectURL = vi.fn().mockReturnValue("blob:source");
        const revokeObjectURL = vi.fn();
        const NativeURL = URL;

        class MockURL extends NativeURL {
            static createObjectURL = createObjectURL;
            static revokeObjectURL = revokeObjectURL;
        }
        class MockImage {
            naturalWidth = 4000;
            naturalHeight = 2000;
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;

            set src(_value: string) {
                queueMicrotask(() => this.onload?.());
            }
        }

        vi.stubGlobal("URL", MockURL);
        vi.stubGlobal("Image", MockImage);
        const drawImage = vi.fn();
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
            clearRect: vi.fn(),
            drawImage,
            getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) }),
        } as never);
        vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback, type) => {
            callback(new Blob([new Uint8Array([1, 2, 3])], { type: type ?? "image/webp" }));
        });

        const result = await prepareImageFile(
            new File([new Uint8Array([9, 8, 7])], "photo.png", { type: "image/png" }),
        );

        expect(result).toEqual({
            data: new Uint8Array([1, 2, 3]),
            mimeType: "image/webp",
            label: "photo.png",
            width: 400,
            height: 200,
        });
        expect(drawImage).toHaveBeenCalledWith(expect.any(MockImage), 0, 0, 1920, 960);
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:source");
    });

    it("브라우저가 WebP 요청에 PNG로 응답하면 JPEG로 인코딩한다", async () => {
        stubBrowserImage({ "image/webp": "image/png" });

        const result = await prepareImageFile(
            new File([new Uint8Array([9, 8, 7])], "photo.jpg", { type: "image/jpeg" }),
        );

        expect(result.mimeType).toBe("image/jpeg");
    });

    it("WebP를 지원하지 않고 투명도가 있는 이미지는 PNG를 유지한다", async () => {
        stubBrowserImage({ "image/webp": "image/png" }, 128);

        const result = await prepareImageFile(
            new File([new Uint8Array([9, 8, 7])], "logo.png", { type: "image/png" }),
        );

        expect(result.mimeType).toBe("image/png");
    });
});
