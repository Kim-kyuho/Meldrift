import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DrawingLayer from "@/components/DrawingLayer";
import type { DrawingTool } from "@/hooks/useBoardDrawing";
import { defaultPenColor, defaultPenWidth, type BoardStroke } from "@/lib/board-stroke";

const canStartBoardPanSelector =
    "[data-editing='true'], [data-drawing-capture='true'], .board-toolbar, .confirm-dialog, button, input, textarea, a, [contenteditable='true']";

const stroke: BoardStroke = {
    id: "s1",
    color: defaultPenColor,
    width: defaultPenWidth,
    points: [[0, 0], [10, 10], [20, 0]],
};

function renderLayer(drawingMode: boolean, drawingTool: DrawingTool) {
    const { container } = render(
        <DrawingLayer
            strokes={[stroke]}
            drawingMode={drawingMode}
            drawingTool={drawingTool}
            penColor={defaultPenColor}
            penWidth={defaultPenWidth}
            zoom={0.75}
            onStrokeEnd={vi.fn()}
            onErase={vi.fn()}
        />
    );

    return container.querySelector("svg")!;
}

describe("DrawingLayer pointer routing", () => {
    it("renders a display only layer while drawing mode is off", () => {
        const layer = renderLayer(false, "draw");

        expect(layer.getAttribute("pointer-events")).toBe("none");
        expect(layer.style.pointerEvents).toBe("none");
        expect(layer.style.touchAction).toBe("");
        expect(layer.getAttribute("data-drawing-capture")).toBeNull();
        expect(layer.querySelectorAll("path")).toHaveLength(1);
    });

    it("captures input and blocks board panning while drawing", () => {
        const layer = renderLayer(true, "draw");
        const captureLayer = layer.closest("[data-drawing-capture='true']") as HTMLElement;

        expect(captureLayer).not.toBeNull();
        expect(captureLayer.style.pointerEvents).toBe("auto");
        expect(captureLayer.style.touchAction).toBe("none");
        expect(layer.closest(canStartBoardPanSelector)).toBe(captureLayer);
    });

    it("keeps drawing pointer events from reaching the board pan layer", () => {
        const handleBoardPointerDown = vi.fn();
        const { container } = render(
            <div onPointerDown={handleBoardPointerDown}>
                <DrawingLayer
                    strokes={[stroke]}
                    drawingMode
                    drawingTool="draw"
                    penColor={defaultPenColor}
                    penWidth={defaultPenWidth}
                    zoom={0.75}
                    onStrokeEnd={vi.fn()}
                    onErase={vi.fn()}
                />
            </div>
        );

        fireEvent.pointerDown(container.querySelector("svg")!, {
            pointerId: 1,
            pointerType: "touch",
            isPrimary: true,
            buttons: 1,
            clientX: 20,
            clientY: 20,
        });

        expect(handleBoardPointerDown).not.toHaveBeenCalled();
    });

    it("blocks text selection so a pen stroke does not drag text on iPad", () => {
        (["draw", "erase"] as const).forEach((tool) => {
            const layer = renderLayer(true, tool);
            const captureLayer = layer.closest("[data-drawing-capture='true']") as HTMLElement;

            expect(captureLayer.style.userSelect).toBe("none");
            expect(captureLayer.style.webkitUserSelect).toBe("none");
        });

        const displayLayer = renderLayer(false, "draw");

        expect(displayLayer.style.userSelect).toBe("none");
    });

    it("captures input and blocks board panning while erasing", () => {
        const layer = renderLayer(true, "erase");
        const captureLayer = layer.closest("[data-drawing-capture='true']") as HTMLElement;

        expect(captureLayer.style.pointerEvents).toBe("auto");
        expect(captureLayer.style.touchAction).toBe("none");
        expect(layer.closest(canStartBoardPanSelector)).toBe(captureLayer);
    });

    it("attaches no pointer handler while drawing mode is off", () => {
        const onStrokeEnd = vi.fn();
        const onErase = vi.fn();
        const { container } = render(
            <DrawingLayer
                strokes={[stroke]}
                drawingMode={false}
                drawingTool="draw"
                penColor={defaultPenColor}
                penWidth={defaultPenWidth}
                zoom={0.75}
                onStrokeEnd={onStrokeEnd}
                onErase={onErase}
            />
        );
        const layer = container.querySelector("svg")!;

        layer.dispatchEvent(new Event("pointerdown", { bubbles: true }));
        layer.dispatchEvent(new Event("pointerup", { bubbles: true }));

        expect(onStrokeEnd).not.toHaveBeenCalled();
        expect(onErase).not.toHaveBeenCalled();
    });

    it("renders saved strokes and shows the eraser circle only in erase mode", () => {
        const drawLayer = renderLayer(true, "draw");
        expect(drawLayer.querySelectorAll("path")).toHaveLength(1);
        expect(drawLayer.querySelector("path")).toHaveAttribute("stroke-opacity", "0.82");
        expect(renderLayer(true, "draw").querySelector("circle")).toBeNull();
        expect(renderLayer(true, "erase").querySelector("circle")).toBeNull();
    });
});
