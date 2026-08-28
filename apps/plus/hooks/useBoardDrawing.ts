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

export type { DrawingTool };

type UseBoardDrawingOptions = {
    initialStrokes: BoardStroke[];
    boardId: number;
    canEditCard: boolean;
    showPermissionMessage: () => void;
    setPermissionMessage: (message: string) => void;
    onPreviewUpdate: () => void;
};

export function useBoardDrawing({
    initialStrokes,
    boardId,
    canEditCard,
    showPermissionMessage,
    setPermissionMessage,
    onPreviewUpdate,
}: UseBoardDrawingOptions) {
    const [strokes, setStrokes] = useState(initialStrokes);
    const [drawingMode, setDrawingMode] = useState(false);
    const [drawingTool, setDrawingTool] = useState<DrawingTool>("draw");
    const [penColor, setPenColor] = useState(defaultPenColor);
    const [penWidth, setPenWidth] = useState(defaultPenWidth);
    const unsavedRef = useRef(false);

    const saveStrokes = async (nextStrokes: BoardStroke[]) => {
        const response = await fetch(`/api/drawings/${boardId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ strokes: nextStrokes }),
        });
        const data = await response.json();

        if (!response.ok || !data.ok) {
            setPermissionMessage(data.message ?? "Drawing could not be saved.");
            return;
        }

        onPreviewUpdate();
    };

    const handleToggleDrawingMode = () => {
        if (drawingMode) {
            setDrawingMode(false);
            setDrawingTool("draw");

            if (unsavedRef.current) {
                unsavedRef.current = false;
                void saveStrokes(strokes);
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

        unsavedRef.current = true;
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
                unsavedRef.current = true;
            }

            return nextStrokes;
        });
    };

    const handleUndoStroke = () => {
        if (strokes.length === 0) {
            return;
        }

        unsavedRef.current = true;
        setStrokes((prev) => prev.slice(0, -1));
    };

    return {
        strokes,
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
