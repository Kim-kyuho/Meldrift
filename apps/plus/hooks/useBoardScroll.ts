import { PointerEvent as ReactPointerEvent, RefObject, useEffect, useRef, useState } from "react";

type BoardPanState = {
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    pressedAt: number;
    isDragging: boolean;
};

type TextDragScrollState = {
    pointerId: number;
    scrollLeft: number;
    scrollTop: number;
};

type UseBoardScrollOptions = {
    cardEditing: boolean;
    boardScrollRef: RefObject<HTMLDivElement | null>;
};

const isEditableTarget = (target: EventTarget | null) => {
    const targetElement = target instanceof Element ? target : null;

    return Boolean(targetElement?.closest(
        "input, textarea, [contenteditable]:not([contenteditable='false'])"
    ));
};

export function useBoardScroll({ cardEditing, boardScrollRef }: UseBoardScrollOptions) {
    const [boardPanning, setBoardPanning] = useState(false);
    const boardPanRef = useRef<BoardPanState | null>(null);
    const boardPanClearTimerRef = useRef<number | null>(null);
    const textDragScrollRef = useRef<TextDragScrollState | null>(null);
    const keyboardScrollRef = useRef<Omit<TextDragScrollState, "pointerId"> | null>(null);

    const clearBoardPanMode = () => {
        if (boardPanClearTimerRef.current) {
            window.clearTimeout(boardPanClearTimerRef.current);
            boardPanClearTimerRef.current = null;
        }

        delete document.documentElement.dataset.boardPanning;
    };

    const canStartBoardPan = (target: EventTarget | null) => {
        const targetElement = target instanceof Element ? target : null;

        if (!targetElement) {
            return false;
        }

        return !targetElement.closest(
            "[data-editing='true'], [data-drawing-capture='true'], .board-toolbar, .confirm-dialog, button, input, textarea, a, [contenteditable='true']"
        );
    };

    const handleBoardPanStart = (event: ReactPointerEvent<HTMLElement>) => {
        if (event.pointerType !== "mouse" || event.button !== 0) {
            return;
        }

        if (!canStartBoardPan(event.target)) {
            return;
        }

        clearBoardPanMode();
        boardPanRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            scrollLeft: event.currentTarget.scrollLeft,
            scrollTop: event.currentTarget.scrollTop,
            pressedAt: event.timeStamp,
            isDragging: false,
        };
    };

    const handleBoardPanMove = (event: ReactPointerEvent<HTMLElement>) => {
        const panState = boardPanRef.current;

        if (!panState || panState.pointerId !== event.pointerId) {
            return;
        }
        
        if (event.timeStamp - panState.pressedAt < 160) {
            return;
        }

        const deltaX = event.clientX - panState.startX;
        const deltaY = event.clientY - panState.startY;
        const moved = Math.hypot(deltaX, deltaY);

        if (!panState.isDragging) {
            if (moved < 5) {
                return;
            }

            panState.isDragging = true;
            setBoardPanning(true);
            event.currentTarget.setPointerCapture(event.pointerId);
        }

        document.documentElement.dataset.boardPanning = "true";
        event.preventDefault();

        event.currentTarget.scrollLeft = panState.scrollLeft - deltaX;
        event.currentTarget.scrollTop = panState.scrollTop - deltaY;
    };

    const handleBoardPanEnd = (event: ReactPointerEvent<HTMLElement>) => {
        const panState = boardPanRef.current;

        if (!panState || panState.pointerId !== event.pointerId) {
            return;
        }

        boardPanRef.current = null;
        setBoardPanning(false);

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        if (panState.isDragging) {
            boardPanClearTimerRef.current = window.setTimeout(() => {
                clearBoardPanMode();
            }, 160);
            return;
        }

        clearBoardPanMode();
    };

    useEffect(() => {
        return () => {
            if (boardPanClearTimerRef.current) {
                window.clearTimeout(boardPanClearTimerRef.current);
            }

            delete document.documentElement.dataset.boardPanning;
        };
    }, []);

    useEffect(() => {
        const boardScrollElement = boardScrollRef.current;
        if (!cardEditing || !boardScrollElement) {
            textDragScrollRef.current = null;
            return;
        }

        let restoreFrame: number | null = null;
        let keyboardClearTimer: number | null = null;
        const arrowKeys = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
        const restoreBoardScroll = (scrollLeft: number, scrollTop: number) => {
            boardScrollElement.scrollLeft = scrollLeft;
            boardScrollElement.scrollTop = scrollTop;
        };
        const scheduleBoardScrollRestore = (scrollLeft: number, scrollTop: number) => {
            if (restoreFrame !== null) {
                window.cancelAnimationFrame(restoreFrame);
            }

            restoreFrame = window.requestAnimationFrame(() => {
                restoreBoardScroll(scrollLeft, scrollTop);
                restoreFrame = null;
            });
        };

        const handleArrowKey = (event: KeyboardEvent) => {
            if (!arrowKeys.has(event.key)) {
                return;
            }

            const scrollLeft = boardScrollElement.scrollLeft;
            const scrollTop = boardScrollElement.scrollTop;

            keyboardScrollRef.current = { scrollLeft, scrollTop };
            if (keyboardClearTimer !== null) {
                window.clearTimeout(keyboardClearTimer);
            }
            keyboardClearTimer = window.setTimeout(() => {
                keyboardScrollRef.current = null;
                keyboardClearTimer = null;
            }, 160);

            if (!isEditableTarget(event.target)) {
                event.preventDefault();
            }

            scheduleBoardScrollRestore(scrollLeft, scrollTop);
        };

        const handleTextDragStart = (event: PointerEvent) => {
            const targetElement = event.target instanceof Element ? event.target : null;
            if (
                !isEditableTarget(event.target) ||
                !targetElement ||
                !boardScrollElement.contains(targetElement)
            ) {
                return;
            }

            textDragScrollRef.current = {
                pointerId: event.pointerId,
                scrollLeft: boardScrollElement.scrollLeft,
                scrollTop: boardScrollElement.scrollTop,
            };
        };

        const handleBoardScroll = () => {
            const lockedScroll = textDragScrollRef.current ?? keyboardScrollRef.current;
            if (!lockedScroll) {
                return;
            }

            restoreBoardScroll(lockedScroll.scrollLeft, lockedScroll.scrollTop);
        };

        const handleTextDragEnd = (event: PointerEvent) => {
            const textDragScroll = textDragScrollRef.current;
            if (!textDragScroll || textDragScroll.pointerId !== event.pointerId) {
                return;
            }

            scheduleBoardScrollRestore(textDragScroll.scrollLeft, textDragScroll.scrollTop);
            textDragScrollRef.current = null;
        };

        document.addEventListener("keydown", handleArrowKey, true);
        document.addEventListener("pointerdown", handleTextDragStart, true);
        document.addEventListener("pointerup", handleTextDragEnd, true);
        document.addEventListener("pointercancel", handleTextDragEnd, true);
        boardScrollElement.addEventListener("scroll", handleBoardScroll);

        return () => {
            if (restoreFrame !== null) {
                window.cancelAnimationFrame(restoreFrame);
            }
            if (keyboardClearTimer !== null) {
                window.clearTimeout(keyboardClearTimer);
            }

            textDragScrollRef.current = null;
            keyboardScrollRef.current = null;
            document.removeEventListener("keydown", handleArrowKey, true);
            document.removeEventListener("pointerdown", handleTextDragStart, true);
            document.removeEventListener("pointerup", handleTextDragEnd, true);
            document.removeEventListener("pointercancel", handleTextDragEnd, true);
            boardScrollElement.removeEventListener("scroll", handleBoardScroll);
        };
    }, [boardScrollRef, cardEditing]);

    return {
        boardPanning,
        handleBoardPanStart,
        handleBoardPanMove,
        handleBoardPanEnd,
    };
}
