import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DrawingLayer from "../src/features/drawing/DrawingLayer";
import type { DrawingTool } from "@meldrift/core/board-stroke";
import { defaultPenColor, defaultPenWidth, type BoardStroke } from "@meldrift/core/board-stroke";

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

describe("드로잉 레이어 포인터 전달", () => {
    it("드로잉 모드가 꺼져 있으면 표시 전용 레이어를 렌더링한다", () => {
        const layer = renderLayer(false, "draw");

        expect(layer.getAttribute("pointer-events")).toBe("none");
        expect(layer.style.pointerEvents).toBe("none");
        expect(layer.style.touchAction).toBe("");
        expect(layer.getAttribute("data-drawing-capture")).toBeNull();
        expect(layer.querySelectorAll("path")).toHaveLength(1);
    });

    it("드로잉 중 입력을 캡처하고 보드 패닝을 막는다", () => {
        const layer = renderLayer(true, "draw");
        const captureLayer = layer.closest("[data-drawing-capture='true']") as HTMLElement;

        expect(captureLayer).not.toBeNull();
        expect(captureLayer.style.pointerEvents).toBe("auto");
        expect(captureLayer.style.touchAction).toBe("none");
        expect(layer.closest(canStartBoardPanSelector)).toBe(captureLayer);
    });

    it("드로잉 포인터 이벤트가 보드 패닝 레이어에 전달되지 않게 한다", () => {
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

    it("iPad의 펜 획 입력이 텍스트를 드래그하지 않도록 선택을 막는다", () => {
        (["draw", "erase"] as const).forEach((tool) => {
            const layer = renderLayer(true, tool);
            const captureLayer = layer.closest("[data-drawing-capture='true']") as HTMLElement;

            expect(captureLayer.style.userSelect).toBe("none");
            expect(captureLayer.style.webkitUserSelect).toBe("none");
        });

        const displayLayer = renderLayer(false, "draw");

        expect(displayLayer.style.userSelect).toBe("none");
    });

    it("지우개 사용 중 입력을 캡처하고 보드 패닝을 막는다", () => {
        const layer = renderLayer(true, "erase");
        const captureLayer = layer.closest("[data-drawing-capture='true']") as HTMLElement;

        expect(captureLayer.style.pointerEvents).toBe("auto");
        expect(captureLayer.style.touchAction).toBe("none");
        expect(layer.closest(canStartBoardPanSelector)).toBe(captureLayer);
    });

    it("드로잉 모드가 꺼져 있으면 포인터 핸들러를 연결하지 않는다", () => {
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

    it("저장된 획을 렌더링하고 지우개 모드에서만 지우개 원을 표시한다", () => {
        const drawLayer = renderLayer(true, "draw");
        expect(drawLayer.querySelectorAll("path")).toHaveLength(1);
        expect(drawLayer.querySelector("path")).toHaveAttribute("stroke-opacity", "0.82");
        expect(renderLayer(true, "draw").querySelector("circle")).toBeNull();
        expect(renderLayer(true, "erase").querySelector("circle")).toBeNull();
    });
});
