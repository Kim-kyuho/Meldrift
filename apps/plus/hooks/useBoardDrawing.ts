import { useBoardDrawing as useSharedBoardDrawing } from "@meldrift/ui/useBoardDrawing";
import type { BoardStroke } from "@meldrift/core/board-stroke";

export type { DrawingTool } from "@meldrift/ui/useBoardDrawing";

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

    return useSharedBoardDrawing({
        initialStrokes,
        canEditCard,
        showPermissionMessage,
        onDrawingModeEnd: (nextStrokes) => void saveStrokes(nextStrokes),
    });
}
