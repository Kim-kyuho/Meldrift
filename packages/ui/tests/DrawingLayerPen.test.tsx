import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DrawingLayer from "../src/features/drawing/DrawingLayer";
import { defaultPenColor, defaultPenWidth } from "@meldrift/core/board-stroke";

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

describe("Apple Pencil 획 처리", () => {
    it("이전 pointerup을 놓쳐도 새 획을 시작한다", () => {
        const { layer, onStrokeEnd } = setup();

        fireEvent.pointerDown(layer, pen({ buttons: 1, clientX: 0, clientY: 0 }));
        fireEvent.pointerMove(layer, pen({ buttons: 1, clientX: 10, clientY: 10 }));
        fireEvent.pointerDown(layer, pen({ buttons: 1, clientX: 40, clientY: 40 }));
        fireEvent.pointerMove(layer, pen({ buttons: 1, clientX: 50, clientY: 50 }));
        fireEvent.pointerUp(layer, pen({ buttons: 0 }));

        expect(onStrokeEnd).toHaveBeenCalledTimes(2);
    });

    it("펜이 공중으로 떠오르면 계속 그리지 않고 획을 종료한다", () => {
        const { layer, onStrokeEnd } = setup();

        fireEvent.pointerDown(layer, pen({ buttons: 1, clientX: 0, clientY: 0 }));
        fireEvent.pointerMove(layer, pen({ buttons: 1, clientX: 10, clientY: 10 }));
        fireEvent.pointerMove(layer, pen({ buttons: 0, clientX: 200, clientY: 200 }));

        expect(onStrokeEnd).toHaveBeenCalledTimes(1);
        expect(onStrokeEnd.mock.calls[0][0]).toEqual([[0, 0], [10, 10]]);
    });

    it("Apple Pencil이 버튼 플래그 없이 압력을 보고해도 그리기를 유지한다", () => {
        const { layer, onStrokeEnd } = setup();

        fireEvent.pointerDown(layer, pen({ buttons: 1, pressure: 0.5, clientX: 0, clientY: 0 }));
        fireEvent.pointerMove(layer, pen({ buttons: 0, pressure: 0.5, clientX: 10, clientY: 10 }));
        fireEvent.pointerUp(layer, pen({ buttons: 0, pressure: 0 }));

        expect(onStrokeEnd).toHaveBeenCalledTimes(1);
        expect(onStrokeEnd.mock.calls[0][0]).toEqual([[0, 0], [10, 10]]);
    });

    it("주 포인터가 아닌 펜 포인터의 재접촉을 허용한다", () => {
        const { layer, onStrokeEnd } = setup();

        fireEvent.pointerDown(layer, pen({ isPrimary: false, buttons: 1, pressure: 0.5, clientX: 0, clientY: 0 }));
        fireEvent.pointerMove(layer, pen({ isPrimary: false, buttons: 1, pressure: 0.5, clientX: 10, clientY: 10 }));
        fireEvent.pointerUp(layer, pen({ isPrimary: false, buttons: 0, pressure: 0 }));

        expect(onStrokeEnd).toHaveBeenCalledTimes(1);
        expect(onStrokeEnd.mock.calls[0][0]).toEqual([[0, 0], [10, 10]]);
    });

    it("빠른 재접촉 뒤 포인터 캡처를 잃어도 새 획을 활성 상태로 유지한다", () => {
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

    it("획을 그리는 중에는 두 번째 손가락을 무시한다", () => {
        const { layer, onStrokeEnd } = setup();

        fireEvent.pointerDown(layer, pen({ buttons: 1, clientX: 0, clientY: 0 }));
        fireEvent.pointerDown(layer, { pointerId: 2, pointerType: "touch", isPrimary: false, buttons: 1, clientX: 90, clientY: 90 });
        fireEvent.pointerMove(layer, pen({ buttons: 1, clientX: 10, clientY: 10 }));
        fireEvent.pointerUp(layer, pen({ buttons: 0 }));

        expect(onStrokeEnd).toHaveBeenCalledTimes(1);
        expect(onStrokeEnd.mock.calls[0][0]).toEqual([[0, 0], [10, 10]]);
    });

    it("Apple Pencil을 감지하면 진행 중인 손바닥 획을 버린다", () => {
        const { layer, onStrokeEnd } = setup();

        fireEvent.pointerDown(layer, { pointerId: 2, pointerType: "touch", isPrimary: true, buttons: 1, clientX: 90, clientY: 90 });
        fireEvent.pointerMove(layer, { pointerId: 2, pointerType: "touch", isPrimary: true, buttons: 1, clientX: 100, clientY: 100 });
        fireEvent.pointerDown(layer, pen({ buttons: 1, pressure: 0.5, clientX: 0, clientY: 0 }));
        fireEvent.pointerMove(layer, pen({ buttons: 1, pressure: 0.5, clientX: 10, clientY: 10 }));
        fireEvent.pointerUp(layer, pen({ buttons: 0, pressure: 0 }));

        expect(onStrokeEnd).toHaveBeenCalledTimes(1);
        expect(onStrokeEnd.mock.calls[0][0]).toEqual([[0, 0], [10, 10]]);
    });

    it("Apple Pencil 접촉 중에는 주 터치 입력을 무시한다", () => {
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

    it("Apple Pencil을 떼면 터치 드로잉을 다시 허용한다", () => {
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
