import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SelectionRect } from "@meldrift/core/cards";
import { useSelectionPointer } from "../src/features/selection/useSelectionPointer";

type HarnessProps = {
    selectionBounds: SelectionRect | null;
    onSelectCards: (rect: SelectionRect) => void;
    onMoveSelection: (offset: { x: number; y: number }) => void;
    onClearSelection: () => void;
};

function Harness(props: HarnessProps) {
    const {
        marqueeRect,
        handleSelectionPointerDown,
        handleSelectionPointerMove,
        handleSelectionPointerUp,
        handleSelectionPointerCancel,
    } = useSelectionPointer({ zoom: 0.5, ...props });

    return (
        <div
            data-testid="scroll"
            onPointerDown={handleSelectionPointerDown}
            onPointerMove={handleSelectionPointerMove}
            onPointerUp={handleSelectionPointerUp}
            onPointerCancel={handleSelectionPointerCancel}
        >
            <div className="meldrift-board" />
            {marqueeRect && <div data-testid="marquee" />}
        </div>
    );
}

const pointer = (extra: Record<string, unknown>) => ({ pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, ...extra });

function setup(selectionBounds: SelectionRect | null = null) {
    const onSelectCards = vi.fn();
    const onMoveSelection = vi.fn();
    const onClearSelection = vi.fn();
    const view = render(
        <Harness
            selectionBounds={selectionBounds}
            onSelectCards={onSelectCards}
            onMoveSelection={onMoveSelection}
            onClearSelection={onClearSelection}
        />
    );
    const scroll = view.getByTestId("scroll");
    scroll.setPointerCapture = vi.fn();
    scroll.hasPointerCapture = vi.fn(() => false);
    scroll.releasePointerCapture = vi.fn();
    return { ...view, scroll, onSelectCards, onMoveSelection, onClearSelection };
}

describe("useSelectionPointer 동작", () => {
    it("보드 좌표로 선택 사각형을 그리고 놓을 때 선택을 확정한다", () => {
        const state = setup();
        fireEvent.pointerDown(state.scroll, pointer({ clientX: 10, clientY: 20 }));
        fireEvent.pointerMove(state.scroll, pointer({ clientX: 60, clientY: 80 }));
        expect(state.queryByTestId("marquee")).not.toBeNull();
        fireEvent.pointerUp(state.scroll, pointer({ clientX: 60, clientY: 80 }));

        expect(state.onSelectCards).toHaveBeenCalledWith({ x: 20, y: 40, width: 100, height: 120 });
        expect(state.scroll.setPointerCapture).toHaveBeenCalledWith(1);
        expect(state.queryByTestId("marquee")).toBeNull();
    });

    it("선택 영역 안에서 드래그를 시작하면 선택한 카드를 이동한다", () => {
        const state = setup({ x: 0, y: 0, width: 200, height: 200 });
        fireEvent.pointerDown(state.scroll, pointer({ clientX: 10, clientY: 10 }));
        fireEvent.pointerMove(state.scroll, pointer({ clientX: 40, clientY: 25 }));
        fireEvent.pointerUp(state.scroll, pointer({ clientX: 40, clientY: 25 }));

        expect(state.onMoveSelection).toHaveBeenCalledWith({ x: 60, y: 30 });
        expect(state.onSelectCards).not.toHaveBeenCalled();
    });

    it("영역 밖을 누르고 5px 미만으로 움직이면 선택을 해제한다", () => {
        const state = setup({ x: 0, y: 0, width: 20, height: 20 });
        fireEvent.pointerDown(state.scroll, pointer({ clientX: 100, clientY: 100 }));
        fireEvent.pointerMove(state.scroll, pointer({ clientX: 103, clientY: 102 }));
        fireEvent.pointerUp(state.scroll, pointer({ clientX: 103, clientY: 102 }));

        expect(state.onClearSelection).toHaveBeenCalledTimes(1);
        expect(state.scroll.setPointerCapture).not.toHaveBeenCalled();
    });

    it("영역 안을 누른 뒤 드래그하지 않으면 선택을 유지한다", () => {
        const state = setup({ x: 0, y: 0, width: 200, height: 200 });
        fireEvent.pointerDown(state.scroll, pointer({ clientX: 10, clientY: 10 }));
        fireEvent.pointerUp(state.scroll, pointer({ clientX: 10, clientY: 10 }));

        expect(state.onClearSelection).not.toHaveBeenCalled();
        expect(state.onMoveSelection).not.toHaveBeenCalled();
    });

    it("두 번째 터치가 들어오면 선택 사각형을 버린다", () => {
        const state = setup();
        const touch = (pointerId: number, extra: Record<string, unknown>) => pointer({ pointerId, pointerType: "touch", ...extra });
        fireEvent.pointerDown(state.scroll, touch(1, { clientX: 0, clientY: 0 }));
        fireEvent.pointerMove(state.scroll, touch(1, { clientX: 40, clientY: 40 }));
        fireEvent.pointerDown(state.scroll, touch(2, { isPrimary: false, clientX: 80, clientY: 80 }));
        fireEvent.pointerUp(state.scroll, touch(1, { clientX: 40, clientY: 40 }));

        expect(state.queryByTestId("marquee")).toBeNull();
        expect(state.onSelectCards).not.toHaveBeenCalled();
        expect(state.onClearSelection).not.toHaveBeenCalled();
    });
});
