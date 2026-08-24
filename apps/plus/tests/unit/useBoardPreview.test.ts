import { act, renderHook } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBoardPreview } from "@/hooks/useBoardPreview";
import { boardPreviewSessionKey } from "@/lib/board-preview";

const { toCanvasMock } = vi.hoisted(() => ({
    toCanvasMock: vi.fn(),
}));

const drawImageMock = vi.fn();

vi.mock("html-to-image", () => ({
    toCanvas: toCanvasMock,
}));

const boardViewportRef = createRef<HTMLDivElement>();

describe("useBoardPreview", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        window.sessionStorage.clear();

        const boardViewport = document.createElement("div");
        Object.defineProperties(boardViewport, {
            clientWidth: { configurable: true, value: 1200 },
            clientHeight: { configurable: true, value: 800 },
        });
        boardViewport.getBoundingClientRect = () => ({
            x: 0,
            y: 0,
            top: 0,
            right: 1200,
            bottom: 800,
            left: 0,
            width: 1200,
            height: 800,
            toJSON: () => ({}),
        });
        boardViewportRef.current = boardViewport;

        const canvas = {
            getContext: () => ({ drawImage: drawImageMock }),
            toBlob: (callback: BlobCallback) => {
                callback(new Blob(["preview"], { type: "image/webp" }));
            },
        } as unknown as HTMLCanvasElement;

        toCanvasMock.mockResolvedValue(canvas);
        vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
            window.setTimeout(() => callback(0), 0));
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ok: true }),
        }));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it("combines consecutive update requests into one preview upload", async () => {
        const { result } = renderHook(() => useBoardPreview({
            boardId: 5,
            boardViewportRef,
        }));

        act(() => {
            result.current.schedulePreviewUpdate();
            result.current.schedulePreviewUpdate();
        });
        await act(async () => {
            await vi.runAllTimersAsync();
        });

        expect(toCanvasMock).toHaveBeenCalledOnce();
        expect(fetch).toHaveBeenCalledOnce();
        expect(fetch).toHaveBeenCalledWith("/api/boards/5/preview", expect.objectContaining({
            method: "PUT",
            body: expect.any(FormData),
        }));
    });

    it("uploads the first preview after a newly created board mounts", async () => {
        window.sessionStorage.setItem(boardPreviewSessionKey, "7");

        renderHook(() => useBoardPreview({
            boardId: 7,
            boardViewportRef,
        }));
        await act(async () => {
            await vi.runAllTimersAsync();
        });

        expect(fetch).toHaveBeenCalledWith("/api/boards/7/preview", expect.any(Object));
        expect(window.sessionStorage.getItem(boardPreviewSessionKey)).toBeNull();
    });

    it("decodes board images before capturing the preview", async () => {
        const imageCard = document.createElement("div");
        imageCard.className = "image-rnd-1";
        const image = document.createElement("img");
        const decode = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(image, "decode", { configurable: true, value: decode });
        Object.defineProperties(image, {
            naturalWidth: { configurable: true, value: 200 },
            naturalHeight: { configurable: true, value: 100 },
        });
        image.getBoundingClientRect = () => ({
            x: 100,
            y: 100,
            top: 100,
            right: 300,
            bottom: 200,
            left: 100,
            width: 200,
            height: 100,
            toJSON: () => ({}),
        });
        imageCard.appendChild(image);
        boardViewportRef.current?.appendChild(imageCard);

        const { result } = renderHook(() => useBoardPreview({
            boardId: 8,
            boardViewportRef,
        }));

        act(() => result.current.schedulePreviewUpdate());
        await act(async () => {
            await vi.runAllTimersAsync();
        });

        expect(decode).toHaveBeenCalledOnce();
        expect(decode.mock.invocationCallOrder[0]).toBeLessThan(toCanvasMock.mock.invocationCallOrder[0]);
        expect(drawImageMock).toHaveBeenCalledWith(image, 100, 100, 200, 100);
    });
});
