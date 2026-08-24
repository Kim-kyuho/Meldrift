import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DrawingLayer from "@/components/DrawingLayer";
import { defaultPenColor, defaultPenWidth } from "@/lib/board-stroke";

function setup() {
    const onStrokeEnd = vi.fn();
    const { container } = render(
        <DrawingLayer
            strokes={[]}
            drawingMode
            drawingTool="draw"
            penColor={defaultPenColor}
            penWidth={defaultPenWidth}
            zoom={1}
            onStrokeEnd={onStrokeEnd}
            onErase={vi.fn()}
        />
    );

    return { layer: container.querySelector("svg")!, onStrokeEnd };
}

const pen = (extra: Record<string, unknown>) => ({ pointerId: 1, pointerType: "pen", isPrimary: true, ...extra });

describe("Apple Pencil stroke handling", () => {
    it("starts a new stroke even when the previous pointerup was missed", () => {
        const { layer, onStrokeEnd } = setup();

        fireEvent.pointerDown(layer, pen({ buttons: 1, clientX: 0, clientY: 0 }));
        fireEvent.pointerMove(layer, pen({ buttons: 1, clientX: 10, clientY: 10 }));
        fireEvent.pointerDown(layer, pen({ buttons: 1, clientX: 40, clientY: 40 }));
        fireEvent.pointerMove(layer, pen({ buttons: 1, clientX: 50, clientY: 50 }));
        fireEvent.pointerUp(layer, pen({ buttons: 0 }));

        expect(onStrokeEnd).toHaveBeenCalledTimes(2);
    });

    it("ends the stroke when the pen lifts into hover instead of drawing on", () => {
        const { layer, onStrokeEnd } = setup();

        fireEvent.pointerDown(layer, pen({ buttons: 1, clientX: 0, clientY: 0 }));
        fireEvent.pointerMove(layer, pen({ buttons: 1, clientX: 10, clientY: 10 }));
        fireEvent.pointerMove(layer, pen({ buttons: 0, clientX: 200, clientY: 200 }));

        expect(onStrokeEnd).toHaveBeenCalledTimes(1);
        expect(onStrokeEnd.mock.calls[0][0]).toEqual([[0, 0], [10, 10]]);
    });

    it("keeps drawing when Apple Pencil reports pressure with no button flag", () => {
        const { layer, onStrokeEnd } = setup();

        fireEvent.pointerDown(layer, pen({ buttons: 1, pressure: 0.5, clientX: 0, clientY: 0 }));
        fireEvent.pointerMove(layer, pen({ buttons: 0, pressure: 0.5, clientX: 10, clientY: 10 }));
        fireEvent.pointerUp(layer, pen({ buttons: 0, pressure: 0 }));

        expect(onStrokeEnd).toHaveBeenCalledTimes(1);
        expect(onStrokeEnd.mock.calls[0][0]).toEqual([[0, 0], [10, 10]]);
    });

    it("accepts a recontact reported as a non-primary pen pointer", () => {
        const { layer, onStrokeEnd } = setup();

        fireEvent.pointerDown(layer, pen({ isPrimary: false, buttons: 1, pressure: 0.5, clientX: 0, clientY: 0 }));
        fireEvent.pointerMove(layer, pen({ isPrimary: false, buttons: 1, pressure: 0.5, clientX: 10, clientY: 10 }));
        fireEvent.pointerUp(layer, pen({ isPrimary: false, buttons: 0, pressure: 0 }));

        expect(onStrokeEnd).toHaveBeenCalledTimes(1);
        expect(onStrokeEnd.mock.calls[0][0]).toEqual([[0, 0], [10, 10]]);
    });

    it("keeps a new stroke active when capture loss follows a quick recontact", () => {
        const { layer, onStrokeEnd } = setup();

        fireEvent.pointerDown(layer, pen({ buttons: 1, pressure: 0.5, clientX: 0, clientY: 0 }));
        fireEvent.pointerMove(layer, pen({ buttons: 1, pressure: 0.5, clientX: 10, clientY: 10 }));
        fireEvent.pointerUp(layer, pen({ buttons: 0, pressure: 0 }));
        fireEvent.pointerDown(layer, pen({ buttons: 1, pressure: 0.5, clientX: 40, clientY: 40 }));
        fireEvent.lostPointerCapture(layer, pen({ buttons: 1, pressure: 0.5 }));
        fireEvent.pointerMove(layer, pen({ buttons: 1, pressure: 0.5, clientX: 50, clientY: 50 }));
        fireEvent.pointerUp(layer, pen({ buttons: 0, pressure: 0 }));

        expect(onStrokeEnd).toHaveBeenCalledTimes(2);
        expect(onStrokeEnd.mock.calls[1][0]).toEqual([[40, 40], [50, 50]]);
    });

    it("ignores a second finger while a stroke is in progress", () => {
        const { layer, onStrokeEnd } = setup();

        fireEvent.pointerDown(layer, pen({ buttons: 1, clientX: 0, clientY: 0 }));
        fireEvent.pointerDown(layer, { pointerId: 2, pointerType: "touch", isPrimary: false, buttons: 1, clientX: 90, clientY: 90 });
        fireEvent.pointerMove(layer, pen({ buttons: 1, clientX: 10, clientY: 10 }));
        fireEvent.pointerUp(layer, pen({ buttons: 0 }));

        expect(onStrokeEnd).toHaveBeenCalledTimes(1);
        expect(onStrokeEnd.mock.calls[0][0]).toEqual([[0, 0], [10, 10]]);
    });

    it("discards an in-progress palm stroke when Apple Pencil is detected", () => {
        const { layer, onStrokeEnd } = setup();

        fireEvent.pointerDown(layer, { pointerId: 2, pointerType: "touch", isPrimary: true, buttons: 1, clientX: 90, clientY: 90 });
        fireEvent.pointerMove(layer, { pointerId: 2, pointerType: "touch", isPrimary: true, buttons: 1, clientX: 100, clientY: 100 });
        fireEvent.pointerDown(layer, pen({ buttons: 1, pressure: 0.5, clientX: 0, clientY: 0 }));
        fireEvent.pointerMove(layer, pen({ buttons: 1, pressure: 0.5, clientX: 10, clientY: 10 }));
        fireEvent.pointerUp(layer, pen({ buttons: 0, pressure: 0 }));

        expect(onStrokeEnd).toHaveBeenCalledTimes(1);
        expect(onStrokeEnd.mock.calls[0][0]).toEqual([[0, 0], [10, 10]]);
    });

    it("ignores primary touch input while Apple Pencil is in contact", () => {
        const { layer, onStrokeEnd } = setup();

        fireEvent.pointerDown(layer, pen({ buttons: 1, pressure: 0.5, clientX: 0, clientY: 0 }));
        fireEvent.pointerDown(layer, { pointerId: 2, pointerType: "touch", isPrimary: true, buttons: 1, clientX: 90, clientY: 90 });
        fireEvent.pointerMove(layer, { pointerId: 2, pointerType: "touch", isPrimary: true, buttons: 1, clientX: 100, clientY: 100 });
        fireEvent.pointerUp(layer, { pointerId: 2, pointerType: "touch", isPrimary: true, buttons: 0 });
        fireEvent.pointerMove(layer, pen({ buttons: 1, pressure: 0.5, clientX: 10, clientY: 10 }));
        fireEvent.pointerUp(layer, pen({ buttons: 0, pressure: 0 }));

        expect(onStrokeEnd).toHaveBeenCalledTimes(1);
        expect(onStrokeEnd.mock.calls[0][0]).toEqual([[0, 0], [10, 10]]);
    });

    it("allows touch drawing again after Apple Pencil lifts", () => {
        const { layer, onStrokeEnd } = setup();

        fireEvent.pointerDown(layer, pen({ buttons: 1, pressure: 0.5, clientX: 0, clientY: 0 }));
        fireEvent.pointerMove(layer, pen({ buttons: 1, pressure: 0.5, clientX: 10, clientY: 10 }));
        fireEvent.pointerUp(layer, pen({ buttons: 0, pressure: 0 }));
        fireEvent.pointerDown(layer, { pointerId: 2, pointerType: "touch", isPrimary: true, buttons: 1, clientX: 90, clientY: 90 });
        fireEvent.pointerMove(layer, { pointerId: 2, pointerType: "touch", isPrimary: true, buttons: 1, clientX: 100, clientY: 100 });
        fireEvent.pointerUp(layer, { pointerId: 2, pointerType: "touch", isPrimary: true, buttons: 0 });

        expect(onStrokeEnd).toHaveBeenCalledTimes(2);
        expect(onStrokeEnd.mock.calls[1][0]).toEqual([[90, 90], [100, 100]]);
    });
});
