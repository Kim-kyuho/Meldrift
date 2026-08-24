"use client";

import {
    BoardStroke,
    StrokePoint,
    eraserScreenRadius,
    strokeToPath,
} from "@/lib/board-stroke";
import type { DrawingTool } from "@/hooks/useBoardDrawing";
import { useDrawingPointer } from "@/hooks/useDrawingPointer";
import { ACTIVE_CARD_Z } from "@/lib/zIndex";
import type { PointerEvent as ReactPointerEvent } from "react";

type DrawingLayerProps = {
    strokes: BoardStroke[];
    drawingMode: boolean;
    drawingTool: DrawingTool;
    penColor: string;
    penWidth: number;
    zoom: number;
    onStrokeEnd: (points: StrokePoint[]) => void;
    onErase: (start: StrokePoint, end: StrokePoint, radius: number) => void;
};

const markerStrokeOpacity = 0.82;
const stopPointerPropagation = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
};

function StrokePaths({ strokes }: { strokes: BoardStroke[] }) {
    return (
        <>
            {strokes.map((stroke) => (
                <path
                    key={stroke.id}
                    d={strokeToPath(stroke.points)}
                    stroke={stroke.color}
                    strokeWidth={stroke.width}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeOpacity={markerStrokeOpacity}
                />
            ))}
        </>
    );
}

export default function DrawingLayer({
    strokes,
    drawingMode,
    drawingTool,
    penColor,
    penWidth,
    zoom,
    onStrokeEnd,
    onErase,
}: DrawingLayerProps) {
    const eraserRadius = eraserScreenRadius / zoom;
    const {
        layerRef,
        currentPoints,
        eraserPoint,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handlePointerLeave,
    } = useDrawingPointer({
        drawingTool,
        zoom,
        eraserRadius,
        onStrokeEnd,
        onErase,
    });

    if (!drawingMode) {
        return (
            <svg
                pointerEvents="none"
                aria-hidden="true"
                className="absolute left-0 top-0 h-full w-full"
                style={{
                    zIndex: ACTIVE_CARD_Z - 1,
                    pointerEvents: "none",
                    WebkitTouchCallout: "none",
                    WebkitUserSelect: "none",
                    userSelect: "none",
                }}
            >
                <StrokePaths strokes={strokes} />
            </svg>
        );
    }

    return (
        // 일부 모바일 브라우저에서는 SVG의 touch-action이 안정적으로 적용되지 않아
        // 드로잉 중 보드 패닝이 발생할 수 있으므로 HTML 오버레이로 감싼다.
        <div
            data-drawing-capture="true"
            className="absolute left-0 top-0 h-full w-full"
            style={{
                zIndex: ACTIVE_CARD_Z - 1,
                pointerEvents: "auto",
                touchAction: "none",
                cursor: "crosshair",
                WebkitTouchCallout: "none",
                WebkitUserSelect: "none",
                userSelect: "none",
            }}
            onPointerDown={stopPointerPropagation}
            onPointerMove={stopPointerPropagation}
            onPointerUp={stopPointerPropagation}
            onPointerCancel={stopPointerPropagation}
        >
            <svg
                ref={layerRef}
                className="block h-full w-full"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerLeave={handlePointerLeave}
            >
                <StrokePaths strokes={strokes} />
                {currentPoints.length > 0 && (
                    <path
                        d={strokeToPath(currentPoints)}
                        stroke={penColor}
                        strokeWidth={penWidth}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeOpacity={markerStrokeOpacity}
                    />
                )}
                {drawingTool === "erase" && eraserPoint && (
                    <circle
                        cx={eraserPoint[0]}
                        cy={eraserPoint[1]}
                        r={eraserRadius}
                        fill="#ffffff"
                        stroke="#a3a3a3"
                        strokeWidth={1 / zoom}
                    />
                )}
            </svg>
        </div>
    );
}
