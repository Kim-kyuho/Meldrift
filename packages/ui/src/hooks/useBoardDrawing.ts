import { useRef, useState } from "react";
import {
    BoardStroke,
    StrokePoint,
    createStrokeId,
    defaultPenColor,
    defaultPenWidth,
    eraseStrokesAlongPath,
    type DrawingTool,
} from "@meldrift/core/board-stroke";
import { noop } from "../internal/noop";

export type { DrawingTool };

type UseBoardDrawingOptions = {
    initialStrokes: BoardStroke[];
    canEditCard?: boolean;
    showPermissionMessage?: () => void;
    onDrawingModeEnd?: (strokes: BoardStroke[]) => void;
};

export function useBoardDrawing({
    initialStrokes,
    canEditCard = true,
    showPermissionMessage = noop,
    onDrawingModeEnd = noop,
}: UseBoardDrawingOptions) {
    const [strokes, setStrokes] = useState(initialStrokes);
    const [drawingMode, setDrawingMode] = useState(false);
    const [drawingTool, setDrawingTool] = useState<DrawingTool>("draw");
    const [penColor, setPenColor] = useState(defaultPenColor);
    const [penWidth, setPenWidth] = useState(defaultPenWidth);
    const changedRef = useRef(false);

    const handleToggleDrawingMode = () => {
        if (drawingMode) {
            setDrawingMode(false);
            setDrawingTool("draw");

            if (changedRef.current) {
                changedRef.current = false;
                onDrawingModeEnd(strokes);
            }

            return;
        }

        if (!canEditCard) {
            showPermissionMessage();
            return;
        }

        setDrawingMode(true);
        setDrawingTool("draw");
    };

    const handleStrokeEnd = (points: StrokePoint[]) => {
        if (points.length < 2) {
            return;
        }

        changedRef.current = true;
        setStrokes((prev) => [
            ...prev,
            {
                id: createStrokeId(),
                color: penColor,
                width: penWidth,
                points,
            },
        ]);
    };

    const handleErase = (start: StrokePoint, end: StrokePoint, radius: number) => {
        setStrokes((prev) => {
            const nextStrokes = eraseStrokesAlongPath(prev, start, end, radius);

            if (nextStrokes !== prev) {
                changedRef.current = true;
            }

            return nextStrokes;
        });
    };

    const handleUndoStroke = () => {
        if (strokes.length === 0) {
            return;
        }

        changedRef.current = true;
        setStrokes((prev) => prev.slice(0, -1));
    };

    return {
        strokes,
        setStrokes,
        drawingMode,
        drawingTool,
        penColor,
        setPenColor,
        penWidth,
        setPenWidth,
        handleToggleDrawingMode,
        handleToggleEraseTool: () => setDrawingTool((prev) => (prev === "erase" ? "draw" : "erase")),
        handleStrokeEnd,
        handleErase,
        handleUndoStroke,
    };
}
