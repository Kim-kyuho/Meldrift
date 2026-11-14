import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBoardDrawing } from "@meldrift/ui/useBoardDrawing";
import { defaultPenColor, defaultPenWidth, type BoardStroke } from "@meldrift/core/board-stroke";

const existingStroke: BoardStroke = {
    id: "s1",
    color: defaultPenColor,
    width: defaultPenWidth,
    points: [[0, 0], [10, 10]],
};

function setup(initialStrokes: BoardStroke[] = []) {
    return renderHook(() => useBoardDrawing({
        initialStrokes,
    }));
}

describe("useBoardDrawing 동작", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("현재 펜 색상과 굵기로 획을 추가한다", () => {
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

    it("점이 두 개 미만인 획은 무시한다", () => {
        const { result } = setup();

        act(() => result.current.handleToggleDrawingMode());
        act(() => result.current.handleStrokeEnd([[1, 2]]));

        expect(result.current.strokes).toHaveLength(0);
    });

    it("드로잉 모드를 종료해도 변경된 획을 유지한다", async () => {
        const { result } = setup();

        act(() => result.current.handleToggleDrawingMode());
        act(() => result.current.handleStrokeEnd([[1, 2], [3, 4]]));
        await act(async () => result.current.handleToggleDrawingMode());

        expect(result.current.drawingMode).toBe(false);
        expect(result.current.strokes).toHaveLength(1);
    });

    it("빈 드로잉은 그대로 유지한다", async () => {
        const { result } = setup();

        act(() => result.current.handleToggleDrawingMode());
        await act(async () => result.current.handleToggleDrawingMode());

        expect(result.current.strokes).toEqual([]);
    });

    it("마지막 획을 실행 취소한다", () => {
        const { result } = setup([existingStroke]);

        act(() => result.current.handleToggleDrawingMode());
        act(() => result.current.handleStrokeEnd([[1, 2], [3, 4]]));
        act(() => result.current.handleUndoStroke());

        expect(result.current.strokes).toHaveLength(1);
        expect(result.current.strokes[0].id).toBe("s1");
    });

    it("그리기와 지우개 도구를 전환한다", () => {
        const { result } = setup();

        act(() => result.current.handleToggleDrawingMode());
        expect(result.current.drawingTool).toBe("draw");

        act(() => result.current.handleToggleEraseTool());
        expect(result.current.drawingTool).toBe("erase");

        act(() => result.current.handleToggleEraseTool());
        expect(result.current.drawingTool).toBe("draw");
    });

    it("드로잉 모드를 종료하면 그리기 도구로 돌아간다", async () => {
        const { result } = setup();

        act(() => result.current.handleToggleDrawingMode());
        act(() => result.current.handleToggleEraseTool());
        await act(async () => result.current.handleToggleDrawingMode());

        expect(result.current.drawingTool).toBe("draw");
    });

    it("원 안에 있는 획의 부분만 지운다", () => {
        const crossing: BoardStroke = {
            id: "s2",
            color: defaultPenColor,
            width: defaultPenWidth,
            points: [[0, 0], [10, 0], [20, 0], [30, 0], [40, 0]],
        };
        const { result } = setup([crossing]);

        act(() => result.current.handleToggleDrawingMode());
        act(() => result.current.handleErase([20, 0], [20, 0], 5));

        expect(result.current.strokes).toHaveLength(2);
        expect(result.current.strokes[0].points).toEqual([[0, 0], [10, 0]]);
        expect(result.current.strokes[1].points).toEqual([[30, 0], [40, 0]]);
    });

    it("드로잉 모드를 종료해도 지운 결과를 유지한다", async () => {
        const { result } = setup([existingStroke]);

        act(() => result.current.handleToggleDrawingMode());
        act(() => result.current.handleErase([0, 0], [0, 0], 50));
        await act(async () => result.current.handleToggleDrawingMode());

        expect(result.current.strokes).toEqual([]);
    });

    it("지우개가 아무 획에도 닿지 않으면 획을 변경하지 않는다", async () => {
        const { result } = setup([existingStroke]);

        act(() => result.current.handleToggleDrawingMode());
        act(() => result.current.handleErase([9999, 9999], [9999, 9999], 5));
        await act(async () => result.current.handleToggleDrawingMode());

        expect(result.current.strokes).toEqual([existingStroke]);
    });
});
