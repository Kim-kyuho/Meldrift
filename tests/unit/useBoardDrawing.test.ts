import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBoardDrawing } from "@/hooks/useBoardDrawing";
import { defaultPenColor, defaultPenWidth, type BoardStroke } from "@/lib/board-stroke";

const existingStroke: BoardStroke = {
    id: "s1",
    color: defaultPenColor,
    width: defaultPenWidth,
    points: [[0, 0], [10, 10]],
};

const showPermissionMessage = vi.fn();
const setPermissionMessage = vi.fn();
const onPreviewUpdate = vi.fn();

function setup(canEditCard = true, initialStrokes: BoardStroke[] = []) {
    return renderHook(() => useBoardDrawing({
        initialStrokes,
        boardId: 5,
        canEditCard,
        showPermissionMessage,
        setPermissionMessage,
        onPreviewUpdate,
    }));
}

describe("useBoardDrawing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ok: true }),
        }));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("blocks drawing mode when the user cannot edit cards", () => {
        const { result } = setup(false);

        act(() => result.current.handleToggleDrawingMode());

        expect(result.current.drawingMode).toBe(false);
        expect(showPermissionMessage).toHaveBeenCalled();
    });

    it("adds a stroke with the current pen color and width", () => {
        const { result } = setup();

        act(() => result.current.handleToggleDrawingMode());
        act(() => result.current.setPenColor("#e11d48"));
        act(() => result.current.setPenWidth(8));
        act(() => result.current.handleStrokeEnd([[1, 2], [3, 4]]));

        expect(result.current.strokes).toHaveLength(1);
        expect(result.current.strokes[0]).toMatchObject({
            color: "#e11d48",
            width: 8,
            points: [[1, 2], [3, 4]],
        });
    });

    it("ignores a stroke that has fewer than two points", () => {
        const { result } = setup();

        act(() => result.current.handleToggleDrawingMode());
        act(() => result.current.handleStrokeEnd([[1, 2]]));

        expect(result.current.strokes).toHaveLength(0);
    });

    it("saves once when drawing mode turns off after a change", async () => {
        const { result } = setup();

        act(() => result.current.handleToggleDrawingMode());
        act(() => result.current.handleStrokeEnd([[1, 2], [3, 4]]));
        await act(async () => result.current.handleToggleDrawingMode());

        expect(result.current.drawingMode).toBe(false);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith("/api/drawings/5", expect.objectContaining({
            method: "PATCH",
        }));
        expect(onPreviewUpdate).toHaveBeenCalledOnce();
    });

    it("does not save when nothing was drawn", async () => {
        const { result } = setup();

        act(() => result.current.handleToggleDrawingMode());
        await act(async () => result.current.handleToggleDrawingMode());

        expect(fetch).not.toHaveBeenCalled();
    });

    it("undoes the last stroke", () => {
        const { result } = setup(true, [existingStroke]);

        act(() => result.current.handleToggleDrawingMode());
        act(() => result.current.handleStrokeEnd([[1, 2], [3, 4]]));
        act(() => result.current.handleUndoStroke());

        expect(result.current.strokes).toHaveLength(1);
        expect(result.current.strokes[0].id).toBe("s1");
    });

    it("toggles the erase tool", () => {
        const { result } = setup();

        act(() => result.current.handleToggleDrawingMode());
        expect(result.current.drawingTool).toBe("draw");

        act(() => result.current.handleToggleEraseTool());
        expect(result.current.drawingTool).toBe("erase");

        act(() => result.current.handleToggleEraseTool());
        expect(result.current.drawingTool).toBe("draw");
    });

    it("returns to the draw tool when drawing mode turns off", async () => {
        const { result } = setup();

        act(() => result.current.handleToggleDrawingMode());
        act(() => result.current.handleToggleEraseTool());
        await act(async () => result.current.handleToggleDrawingMode());

        expect(result.current.drawingTool).toBe("draw");
    });

    it("erases only the part of a stroke inside the circle", () => {
        const crossing: BoardStroke = {
            id: "s2",
            color: defaultPenColor,
            width: defaultPenWidth,
            points: [[0, 0], [10, 0], [20, 0], [30, 0], [40, 0]],
        };
        const { result } = setup(true, [crossing]);

        act(() => result.current.handleToggleDrawingMode());
        act(() => result.current.handleErase([20, 0], [20, 0], 5));

        expect(result.current.strokes).toHaveLength(2);
        expect(result.current.strokes[0].points).toEqual([[0, 0], [10, 0]]);
        expect(result.current.strokes[1].points).toEqual([[30, 0], [40, 0]]);
    });

    it("saves after erasing when drawing mode turns off", async () => {
        const { result } = setup(true, [existingStroke]);

        act(() => result.current.handleToggleDrawingMode());
        act(() => result.current.handleErase([0, 0], [0, 0], 50));
        await act(async () => result.current.handleToggleDrawingMode());

        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("does not save when the eraser touches nothing", async () => {
        const { result } = setup(true, [existingStroke]);

        act(() => result.current.handleToggleDrawingMode());
        act(() => result.current.handleErase([9999, 9999], [9999, 9999], 5));
        await act(async () => result.current.handleToggleDrawingMode());

        expect(fetch).not.toHaveBeenCalled();
    });

    it("reports a message when saving fails", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: false,
            json: async () => ({ ok: false, message: "Please sign in before editing cards." }),
        }));
        const { result } = setup();

        act(() => result.current.handleToggleDrawingMode());
        act(() => result.current.handleStrokeEnd([[1, 2], [3, 4]]));
        await act(async () => result.current.handleToggleDrawingMode());

        expect(setPermissionMessage).toHaveBeenCalledWith("Please sign in before editing cards.");
        expect(onPreviewUpdate).not.toHaveBeenCalled();
    });
});
