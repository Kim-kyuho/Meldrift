import { PointerEvent as ReactPointerEvent, useRef, useState } from "react";
import type { SelectionOffset, SelectionRect } from "@meldrift/core/cards";

type UseSelectionPointerOptions = {
    zoom: number;
    selectionBounds: SelectionRect | null;
    onSelectCards: (rect: SelectionRect) => void;
    onMoveSelection: (offset: SelectionOffset) => void;
    onClearSelection: () => void;
};

type SelectionPoint = {
    x: number;
    y: number;
};

type SelectionPress = {
    pointerId: number;
    startClientX: number;
    startClientY: number;
    start: SelectionPoint;
    insideSelection: boolean;
    isDragging: boolean;
};

const toRect = (start: SelectionPoint, end: SelectionPoint): SelectionRect => ({
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
});

const containsPoint = (rect: SelectionRect | null, point: SelectionPoint) => Boolean(
    rect &&
    point.x >= rect.x && point.x <= rect.x + rect.width &&
    point.y >= rect.y && point.y <= rect.y + rect.height
);

export function useSelectionPointer({
    zoom,
    selectionBounds,
    onSelectCards,
    onMoveSelection,
    onClearSelection,
}: UseSelectionPointerOptions) {
    const pressRef = useRef<SelectionPress | null>(null);
    const marqueeRectRef = useRef<SelectionRect | null>(null);
    const selectionOffsetRef = useRef<SelectionOffset | null>(null);
    const [marqueeRect, setMarqueeRect] = useState<SelectionRect | null>(null);
    const [selectionOffset, setSelectionOffset] = useState<SelectionOffset | null>(null);

    const toBoardPoint = (event: ReactPointerEvent<HTMLElement>): SelectionPoint => {
        const boardRect = event.currentTarget.querySelector(".meldrift-board")?.getBoundingClientRect();

        if (!boardRect) {
            return { x: 0, y: 0 };
        }

        return {
            x: (event.clientX - boardRect.left) / zoom,
            y: (event.clientY - boardRect.top) / zoom,
        };
    };

    const discardSelectionInput = (element: HTMLElement) => {
        const press = pressRef.current;
        if (press && element.hasPointerCapture(press.pointerId)) {
            element.releasePointerCapture(press.pointerId);
        }

        pressRef.current = null;
        marqueeRectRef.current = null;
        selectionOffsetRef.current = null;
        setMarqueeRect(null);
        setSelectionOffset(null);
    };

    const handleSelectionPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }

        if (pressRef.current) {
            discardSelectionInput(event.currentTarget);
            return;
        }

        if (!event.isPrimary) {
            return;
        }

        const start = toBoardPoint(event);
        pressRef.current = {
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            start,
            insideSelection: containsPoint(selectionBounds, start),
            isDragging: false,
        };
    };

    const handleSelectionPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
        const press = pressRef.current;

        if (!press || press.pointerId !== event.pointerId) {
            return;
        }

        if (!press.isDragging) {
            const moved = Math.hypot(event.clientX - press.startClientX, event.clientY - press.startClientY);
            if (moved < 5) {
                return;
            }

            press.isDragging = true;
            event.currentTarget.setPointerCapture(event.pointerId);
        }

        event.preventDefault();
        const point = toBoardPoint(event);

        if (press.insideSelection) {
            const offset = { x: point.x - press.start.x, y: point.y - press.start.y };
            selectionOffsetRef.current = offset;
            setSelectionOffset(offset);
            return;
        }

        const rect = toRect(press.start, point);
        marqueeRectRef.current = rect;
        setMarqueeRect(rect);
    };

    const handleSelectionPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
        const press = pressRef.current;

        if (!press || press.pointerId !== event.pointerId) {
            return;
        }

        const offset = selectionOffsetRef.current;
        const rect = marqueeRectRef.current;
        discardSelectionInput(event.currentTarget);

        if (!press.isDragging) {
            if (!press.insideSelection) {
                onClearSelection();
            }
            return;
        }

        if (press.insideSelection) {
            if (offset) onMoveSelection(offset);
            return;
        }

        if (rect) onSelectCards(rect);
    };

    const handleSelectionPointerCancel = (event: ReactPointerEvent<HTMLElement>) => {
        if (pressRef.current?.pointerId !== event.pointerId) {
            return;
        }

        discardSelectionInput(event.currentTarget);
    };

    return {
        marqueeRect,
        selectionOffset,
        handleSelectionPointerDown,
        handleSelectionPointerMove,
        handleSelectionPointerUp,
        handleSelectionPointerCancel,
    };
}
