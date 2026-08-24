import { PointerEvent as ReactPointerEvent, useRef, useState } from "react";
import type { DrawingTool } from "@/hooks/useBoardDrawing";
import type { StrokePoint } from "@/lib/board-stroke";

type UseDrawingPointerOptions = {
    drawingTool: DrawingTool;
    zoom: number;
    eraserRadius: number;
    onStrokeEnd: (points: StrokePoint[]) => void;
    onErase: (start: StrokePoint, end: StrokePoint, radius: number) => void;
};

export function useDrawingPointer({
    drawingTool,
    zoom,
    eraserRadius,
    onStrokeEnd,
    onErase,
}: UseDrawingPointerOptions) {
    const layerRef = useRef<SVGSVGElement | null>(null);
    const activePointerRef = useRef<number | null>(null);
    const activePointerTypeRef = useRef<string | null>(null);
    const penContactRef = useRef(false);
    const currentPointsRef = useRef<StrokePoint[]>([]);
    const previousEraserPointRef = useRef<StrokePoint | null>(null);
    const [currentPoints, setCurrentPoints] = useState<StrokePoint[]>([]);
    const [eraserPoint, setEraserPoint] = useState<StrokePoint | null>(null);
    const toBoardPoint = (event: ReactPointerEvent<SVGSVGElement>): StrokePoint => {
        const layerRect = layerRef.current?.getBoundingClientRect();

        if (!layerRect) {
            return [0, 0];
        }

        return [
            (event.clientX - layerRect.left) / zoom,
            (event.clientY - layerRect.top) / zoom,
        ];
    };

    const finishCurrentStroke = () => {
        const points = currentPointsRef.current;
        activePointerRef.current = null;
        activePointerTypeRef.current = null;
        currentPointsRef.current = [];

        if (points.length > 1) {
            onStrokeEnd(points);
        }

        setCurrentPoints([]);
    };

    const discardCurrentInput = () => {
        activePointerRef.current = null;
        activePointerTypeRef.current = null;
        currentPointsRef.current = [];
        previousEraserPointRef.current = null;
        setCurrentPoints([]);
        setEraserPoint(null);
    };

    const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (event.pointerType === "pen") {
            penContactRef.current = true;
        } else if (penContactRef.current || (event.pointerType === "touch" && !event.isPrimary)) {
            return;
        }

        event.preventDefault();

        if (activePointerRef.current !== null) {
            if (event.pointerType === "pen" && activePointerTypeRef.current !== "pen") {
                discardCurrentInput();
            } else {
                finishCurrentStroke();
            }
        }

        const boardPoint = toBoardPoint(event);
        activePointerRef.current = event.pointerId;
        activePointerTypeRef.current = event.pointerType;

        if (drawingTool === "erase") {
            previousEraserPointRef.current = boardPoint;
            setEraserPoint(boardPoint);
            onErase(boardPoint, boardPoint, eraserRadius);
            return;
        }

        currentPointsRef.current = [boardPoint];
        setCurrentPoints([boardPoint]);
    };

    const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (penContactRef.current && event.pointerType !== "pen") {
            return;
        }

        const boardPoint = toBoardPoint(event);
        const pressed = event.buttons !== 0 || (event.pointerType === "pen" && event.pressure > 0);

        if (event.pointerType === "pen" && !pressed) {
            penContactRef.current = false;
        }

        if (drawingTool === "erase") {
            setEraserPoint(boardPoint);

            if (activePointerRef.current === event.pointerId && !pressed) {
                activePointerRef.current = null;
                activePointerTypeRef.current = null;
                previousEraserPointRef.current = null;
                return;
            }

            if (activePointerRef.current === event.pointerId && pressed) {
                const previousPoint = previousEraserPointRef.current ?? boardPoint;
                onErase(previousPoint, boardPoint, eraserRadius);
                previousEraserPointRef.current = boardPoint;
            }

            return;
        }

        if (activePointerRef.current !== event.pointerId) {
            return;
        }

        if (!pressed) {
            finishCurrentStroke();
            return;
        }

        const nextPoints = [...currentPointsRef.current, boardPoint];
        currentPointsRef.current = nextPoints;
        setCurrentPoints(nextPoints);
    };

    const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (event.pointerType === "pen") {
            penContactRef.current = false;
        }

        if (activePointerRef.current !== event.pointerId) {
            return;
        }

        if (drawingTool === "erase") {
            activePointerRef.current = null;
            activePointerTypeRef.current = null;
            previousEraserPointRef.current = null;
            return;
        }

        finishCurrentStroke();
    };

    return {
        layerRef,
        currentPoints,
        eraserPoint,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handlePointerLeave: () => setEraserPoint(null),
    };
}
