import { RefObject, useCallback, useEffect, useRef } from "react";
import { toCanvas } from "html-to-image";
import { boardPreviewSessionKey } from "@/lib/board-preview";

type UseBoardPreviewOptions = {
    boardId: number;
    boardViewportRef: RefObject<HTMLDivElement | null>;
};

const previewUpdateDelay = 500;

const waitForBoardRender = () =>
    new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => resolve());
        });
    });

const getVisibleBoardImages = (boardViewport: HTMLDivElement) => {
    const viewportRect = boardViewport.getBoundingClientRect();

    return Array.from(boardViewport.querySelectorAll<HTMLImageElement>("[class*='image-rnd-'] img"))
        .filter((image) => {
            const imageRect = image.getBoundingClientRect();

            return imageRect.right > viewportRect.left
                && imageRect.left < viewportRect.right
                && imageRect.bottom > viewportRect.top
                && imageRect.top < viewportRect.bottom;
        });
};

const waitForBoardImages = async (images: HTMLImageElement[]) => {
    await Promise.all(
        images.map(async (image) => {
            try {
                await image.decode();
            } catch {
                return;
            }
        }),
    );
};

const drawBoardImages = (
    canvas: HTMLCanvasElement,
    boardViewport: HTMLDivElement,
    images: HTMLImageElement[],
) => {
    if (images.length === 0) {
        return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Board preview canvas context is unavailable.");
    }

    const viewportRect = boardViewport.getBoundingClientRect();

    images.forEach((image) => {
        if (image.naturalWidth === 0 || image.naturalHeight === 0) {
            return;
        }

        const imageRect = image.getBoundingClientRect();
        const scale = Math.min(
            imageRect.width / image.naturalWidth,
            imageRect.height / image.naturalHeight,
        );
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        const x = imageRect.left - viewportRect.left + (imageRect.width - width) / 2;
        const y = imageRect.top - viewportRect.top + (imageRect.height - height) / 2;

        context.drawImage(image, x, y, width, height);
    });
};

const canvasToWebp = (canvas: HTMLCanvasElement) =>
    new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob);
                    return;
                }

                reject(new Error("Board preview conversion failed."));
            },
            "image/webp",
            0.8,
        );
    });

export function useBoardPreview({ boardId, boardViewportRef }: UseBoardPreviewOptions) {
    const updateTimerRef = useRef<number | null>(null);
    const updateRequestedRef = useRef(false);
    const uploadInProgressRef = useRef(false);

    const uploadPendingPreview = useCallback(async () => {
        if (uploadInProgressRef.current) {
            return;
        }

        uploadInProgressRef.current = true;

        try {
            do {
                updateRequestedRef.current = false;
                await waitForBoardRender();

                const boardViewport = boardViewportRef.current;
                if (!boardViewport || boardViewport.clientWidth === 0 || boardViewport.clientHeight === 0) {
                    return;
                }

                const boardImages = getVisibleBoardImages(boardViewport);
                await waitForBoardImages(boardImages);

                const canvas = await toCanvas(boardViewport, {
                    backgroundColor: "#e5e5e5",
                    pixelRatio: 1,
                    width: boardViewport.clientWidth,
                    height: boardViewport.clientHeight,
                    filter: (node) => !(
                        node instanceof HTMLImageElement
                        && node.closest("[class*='image-rnd-']")
                    ),
                });
                drawBoardImages(canvas, boardViewport, boardImages);
                const previewBlob = await canvasToWebp(canvas);
                const formData = new FormData();
                formData.append("file", previewBlob, "PreviewIMG.webp");

                const response = await fetch(`/api/boards/${boardId}/preview`, {
                    method: "PUT",
                    body: formData,
                });
                const data = await response.json().catch(() => null);

                if (!response.ok || !data?.ok) {
                    throw new Error(data?.message ?? "Board preview could not be updated.");
                }
            } while (updateRequestedRef.current);
        } catch (error) {
            console.error("Error updating board preview:", error);
        } finally {
            uploadInProgressRef.current = false;
        }
    }, [boardId, boardViewportRef]);

    const schedulePreviewUpdate = useCallback(() => {
        updateRequestedRef.current = true;

        if (updateTimerRef.current !== null) {
            window.clearTimeout(updateTimerRef.current);
        }

        updateTimerRef.current = window.setTimeout(() => {
            updateTimerRef.current = null;
            void uploadPendingPreview();
        }, previewUpdateDelay);
    }, [uploadPendingPreview]);

    useEffect(() => {
        if (window.sessionStorage.getItem(boardPreviewSessionKey) !== String(boardId)) {
            return;
        }

        window.sessionStorage.removeItem(boardPreviewSessionKey);
        schedulePreviewUpdate();
    }, [boardId, schedulePreviewUpdate]);

    useEffect(() => {
        return () => {
            if (updateTimerRef.current !== null) {
                window.clearTimeout(updateTimerRef.current);
            }
        };
    }, []);

    return {
        schedulePreviewUpdate,
    };
}
