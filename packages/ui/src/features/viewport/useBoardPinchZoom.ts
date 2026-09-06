import { RefObject, useEffect, useRef } from "react";

type PinchState = {
    distance: number;
    zoom: number;
    offsetX: number;
    offsetY: number;
    scrollLeft: number;
    scrollTop: number;
    boardWidth: number;
    boardHeight: number;
};

type PendingPinchFrame = {
    zoom: number;
    scrollLeft: number;
    scrollTop: number;
    boardWidth: number;
    boardHeight: number;
};

type UseBoardPinchZoomOptions = {
    boardScrollRef: RefObject<HTMLDivElement | null>;
    boardZoom: number;
    setBoardZoom: (zoom: number) => void;
    minZoom?: number;
    maxZoom?: number;
    enabled?: boolean;
};

const touchDistance = (touches: TouchList) =>
    Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY,
    );

const touchMidpoint = (touches: TouchList) => ({
    clientX: (touches[0].clientX + touches[1].clientX) / 2,
    clientY: (touches[0].clientY + touches[1].clientY) / 2,
});

export function useBoardPinchZoom({
    boardScrollRef,
    boardZoom,
    setBoardZoom,
    minZoom = 0.25,
    maxZoom = 2,
    enabled = true,
}: UseBoardPinchZoomOptions) {
    const pinchRef = useRef<PinchState | null>(null);
    const pendingFrameRef = useRef<PendingPinchFrame | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const boardZoomRef = useRef(boardZoom);

    useEffect(() => {
        boardZoomRef.current = boardZoom;
    }, [boardZoom]);

    useEffect(() => {
        const boardScrollElement = boardScrollRef.current;

        if (!enabled || !boardScrollElement) {
            return;
        }

        const boardElement = boardScrollElement.querySelector<HTMLElement>(".meldrift-board");
        const boardSizeElement = boardScrollElement.querySelector<HTMLElement>(".board-size-layer");

        const applyPendingFrame = () => {
            animationFrameRef.current = null;

            const pending = pendingFrameRef.current;
            if (!pending || !boardElement) {
                return;
            }

            boardElement.style.transform = `scale(${pending.zoom})`;

            if (boardSizeElement) {
                boardSizeElement.style.width = `${pending.boardWidth * pending.zoom}px`;
                boardSizeElement.style.height = `${pending.boardHeight * pending.zoom}px`;
            }

            boardScrollElement.scrollLeft = pending.scrollLeft;
            boardScrollElement.scrollTop = pending.scrollTop;
        };

        const endPinch = () => {
            const pinch = pinchRef.current;
            if (!pinch) {
                return;
            }

            if (animationFrameRef.current !== null) {
                window.cancelAnimationFrame(animationFrameRef.current);
                applyPendingFrame();
            }

            const finalZoom = pendingFrameRef.current?.zoom ?? pinch.zoom;

            pinchRef.current = null;
            pendingFrameRef.current = null;

            if (finalZoom !== boardZoomRef.current) {
                boardZoomRef.current = finalZoom;
                setBoardZoom(finalZoom);
            }

            if (boardElement) {
                boardElement.style.willChange = "";
            }
        };

        const handleTouchStart = (event: TouchEvent) => {
            if (event.touches.length !== 2) {
                endPinch();
                return;
            }

            const rect = boardScrollElement.getBoundingClientRect();
            const midpoint = touchMidpoint(event.touches);

            pinchRef.current = {
                distance: touchDistance(event.touches),
                zoom: boardZoomRef.current,
                offsetX: midpoint.clientX - rect.left,
                offsetY: midpoint.clientY - rect.top,
                scrollLeft: boardScrollElement.scrollLeft,
                scrollTop: boardScrollElement.scrollTop,
                boardWidth: boardElement?.offsetWidth ?? 0,
                boardHeight: boardElement?.offsetHeight ?? 0,
            };
            pendingFrameRef.current = null;

            if (boardElement) {
                boardElement.style.willChange = "transform";
            }
        };

        const handleTouchMove = (event: TouchEvent) => {
            const pinch = pinchRef.current;

            if (!pinch || event.touches.length !== 2 || pinch.distance === 0) {
                return;
            }

            event.preventDefault();

            const rawZoom = pinch.zoom * (touchDistance(event.touches) / pinch.distance);

            const nextZoom = Math.min(
                maxZoom,
                Math.max(minZoom, Math.round(rawZoom * 100) / 100),
            );

            const boardX = (pinch.scrollLeft + pinch.offsetX) / pinch.zoom;
            const boardY = (pinch.scrollTop + pinch.offsetY) / pinch.zoom;

            pendingFrameRef.current = {
                zoom: nextZoom,
                scrollLeft: boardX * nextZoom - pinch.offsetX,
                scrollTop: boardY * nextZoom - pinch.offsetY,
                boardWidth: pinch.boardWidth,
                boardHeight: pinch.boardHeight,
            };

            if (animationFrameRef.current === null) {
                animationFrameRef.current = window.requestAnimationFrame(applyPendingFrame);
            }
        };

        const handleTouchEnd = (event: TouchEvent) => {
            if (event.touches.length < 2) {
                endPinch();
            }
        };

        boardScrollElement.addEventListener("touchstart", handleTouchStart, { passive: false });
        boardScrollElement.addEventListener("touchmove", handleTouchMove, { passive: false });
        boardScrollElement.addEventListener("touchend", handleTouchEnd);
        boardScrollElement.addEventListener("touchcancel", handleTouchEnd);

        return () => {
            if (animationFrameRef.current !== null) {
                window.cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }

            pendingFrameRef.current = null;
            pinchRef.current = null;

            if (boardElement) {
                boardElement.style.willChange = "";
            }

            boardScrollElement.removeEventListener("touchstart", handleTouchStart);
            boardScrollElement.removeEventListener("touchmove", handleTouchMove);
            boardScrollElement.removeEventListener("touchend", handleTouchEnd);
            boardScrollElement.removeEventListener("touchcancel", handleTouchEnd);
        };
    }, [boardScrollRef, enabled, maxZoom, minZoom, setBoardZoom]);
}
