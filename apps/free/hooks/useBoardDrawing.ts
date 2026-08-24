import { useState } from "react";
import {
    BoardStroke,
    StrokePoint,
    createStrokeId,
    defaultPenColor,
    defaultPenWidth,
    eraseStrokesAlongPath,
} from "@/lib/board-stroke";

export type DrawingTool = "draw" | "erase";

type UseBoardDrawingOptions = {
    initialStrokes: BoardStroke[];
};

export function useBoardDrawing({
    initialStrokes,
}: UseBoardDrawingOptions) {
    const [strokes, setStrokes] = useState(initialStrokes);
    const [drawingMode, setDrawingMode] = useState(false);
    const [drawingTool, setDrawingTool] = useState<DrawingTool>("draw");
    const [penColor, setPenColor] = useState(defaultPenColor);
    const [penWidth, setPenWidth] = useState(defaultPenWidth);
    const handleToggleDrawingMode = () => {
        if (drawingMode) {
            setDrawingMode(false);
            setDrawingTool("draw");

            return;
        }

        setDrawingMode(true);
        setDrawingTool("draw");
    };

    const handleStrokeEnd = (points: StrokePoint[]) => {
        if (points.length < 2) {
            return;
        }

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

            return nextStrokes;
        });
    };

    const handleUndoStroke = () => {
        if (strokes.length === 0) {
            return;
        }

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
