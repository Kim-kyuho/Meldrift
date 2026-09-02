import { RefObject, useCallback, useEffect, useRef } from "react";
import { toCanvas } from "html-to-image";
import { boardPreviewSessionKey } from "@/lib/board-preview";

type UseBoardPreviewOptions = {
    boardId: number;
    boardViewportRef: RefObject<HTMLDivElement | null>;
};

const previewUpdateDelay = 500;

// 미리보기는 썸네일이라 라틴 자면만 실어 보낸다. html-to-image는 fontEmbedCSS를 주지 않으면
// 문서의 모든 @font-face를 base64로 SVG 안에 인라인하는데, 한글·일본어·한자 자면까지 넣으면
// 데이터 URL이 수 MB가 되어 이미지 로드 자체가 실패한다. 한글은 시스템 폰트로 떨어진다.
const latinFontFaceRanges = "U+0000";

let latinFontEmbedCSS: Promise<string> | null = null;

const readLatinFontFaceRules = () =>
    Array.from(document.styleSheets).flatMap((sheet) => {
        try {
            return Array.from(sheet.cssRules);
        } catch {
            // 다른 오리진의 스타일시트는 읽을 수 없다. 무시한다.
            return [];
        }
    }).filter((rule): rule is CSSFontFaceRule =>
        rule instanceof CSSFontFaceRule
        && rule.style.getPropertyValue("unicode-range").includes(latinFontFaceRanges));

const toDataUrl = async (url: string) => {
    const response = await fetch(url);
    const blob = await response.blob();

    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Board preview font could not be read."));
        reader.readAsDataURL(blob);
    });
};

const buildLatinFontEmbedCSS = async () => {
    // cssText를 문자열 치환하지 않는다. 브라우저마다 따옴표와 공백을 다르게 정규화한다.
    const faces = await Promise.all(readLatinFontFaceRules().map(async (rule) => {
        const url = /url\(["']?([^"')]+)["']?\)/.exec(rule.style.getPropertyValue("src"))?.[1];
        if (!url) return "";

        try {
            const dataUrl = await toDataUrl(url);

            return [
                "@font-face {",
                `  font-family: ${rule.style.getPropertyValue("font-family")};`,
                `  src: url(${dataUrl}) format("woff2");`,
                `  font-weight: ${rule.style.getPropertyValue("font-weight") || "400"};`,
                `  font-style: ${rule.style.getPropertyValue("font-style") || "normal"};`,
                `  unicode-range: ${rule.style.getPropertyValue("unicode-range")};`,
                "}",
            ].join("\n");
        } catch {
            // 한 자면을 못 읽어도 캡처는 계속한다.
            return "";
        }
    }));

    return faces.filter(Boolean).join("\n\n");
};

const getLatinFontEmbedCSS = () => {
    // 자면은 바뀌지 않으므로 한 번만 만들어 캡처마다 재사용한다.
    latinFontEmbedCSS ??= buildLatinFontEmbedCSS().catch(() => "");

    return latinFontEmbedCSS;
};

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
                    fontEmbedCSS: await getLatinFontEmbedCSS(),
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
