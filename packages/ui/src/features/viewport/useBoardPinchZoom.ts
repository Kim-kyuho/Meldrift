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
        let previousOverflow: string | null = null;

        const restoreOverflow = () => {
            if (previousOverflow !== null) {
                boardScrollElement.style.overflow = previousOverflow;
                previousOverflow = null;
            }
        };

        const applyPendingFrame = () => {
            animationFrameRef.current = null;

            const pending = pendingFrameRef.current;
            const pinch = pinchRef.current;
            if (!pending || !pinch || !boardElement) {
                return;
            }

            const translateX = pinch.scrollLeft - pending.scrollLeft;
            const translateY = pinch.scrollTop - pending.scrollTop;
            boardElement.style.transform =
                `translate(${translateX}px, ${translateY}px) scale(${pending.zoom})`;
        };

        const endPinch = () => {
            const pinch = pinchRef.current;
            if (!pinch) {
                return;
            }

            if (animationFrameRef.current !== null) {
                window.cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }

            const pending = pendingFrameRef.current;
            const finalZoom = pending?.zoom ?? pinch.zoom;

            if (boardSizeElement) {
                boardSizeElement.style.width = `${pinch.boardWidth * finalZoom}px`;
                boardSizeElement.style.height = `${pinch.boardHeight * finalZoom}px`;
            }
            if (boardElement) {
                boardElement.style.transform = `scale(${finalZoom})`;
                boardElement.style.willChange = "";
            }
            boardScrollElement.scrollLeft = pending?.scrollLeft ?? pinch.scrollLeft;
            boardScrollElement.scrollTop = pending?.scrollTop ?? pinch.scrollTop;
            restoreOverflow();

            pinchRef.current = null;
            pendingFrameRef.current = null;

            if (finalZoom !== boardZoomRef.current) {
                boardZoomRef.current = finalZoom;
                setBoardZoom(finalZoom);
            }
        };

        const handleTouchStart = (event: TouchEvent) => {
            if (event.touches.length !== 2) {
                endPinch();
                return;
            }
            if (!boardElement || !boardSizeElement || pinchRef.current) {
                return;
            }

            if (event.cancelable) {
                event.preventDefault();
            }
            previousOverflow = boardScrollElement.style.overflow;
            boardScrollElement.style.overflow = "hidden";

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
        boardScrollElement.addEventListener("touchcancel", endPinch);

        return () => {
            if (animationFrameRef.current !== null) {
                window.cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }

            pendingFrameRef.current = null;

            if (boardElement) {
                if (pinchRef.current) {
                    boardElement.style.transform = `scale(${boardZoomRef.current})`;
                    boardScrollElement.scrollLeft = pinchRef.current.scrollLeft;
                    boardScrollElement.scrollTop = pinchRef.current.scrollTop;
                }
                boardElement.style.willChange = "";
            }
            pinchRef.current = null;
            restoreOverflow();

            boardScrollElement.removeEventListener("touchstart", handleTouchStart);
            boardScrollElement.removeEventListener("touchmove", handleTouchMove);
            boardScrollElement.removeEventListener("touchend", handleTouchEnd);
            boardScrollElement.removeEventListener("touchcancel", endPinch);
        };
    }, [boardScrollRef, enabled, maxZoom, minZoom, setBoardZoom]);
}
