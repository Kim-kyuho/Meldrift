import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BoardSplitLayout from "../src/features/markdown/BoardSplitLayout";

describe("BoardSplitLayout 동작", () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it("닫혀 있으면 캔버스만 전체 화면으로 렌더링한다", () => {
        const { container } = render(
            <BoardSplitLayout
                open={false}
                compact={false}
                scrollRef={{ current: null }}
                canvas={<div data-testid="canvas">Canvas</div>}
                panel={<div data-testid="panel">Panel</div>}
            />,
        );

        expect(screen.getByTestId("canvas")).toBeInTheDocument();
        expect(screen.queryByTestId("panel")).toBeNull();
        expect(container.querySelector("[data-split-layout]")).toBeNull();
    });

    it("PC·iPad에서 좌우 Split View를 열고 중앙 핸들 자유 드래그와 더블클릭으로 비율을 조절한다", () => {
        const { container } = render(
            <BoardSplitLayout
                open
                compact={false}
                scrollRef={{ current: null }}
                canvas={<div data-testid="canvas">Canvas</div>}
                panel={<div data-testid="panel">Panel</div>}
            />,
        );

        const split = container.querySelector<HTMLElement>("[data-split-layout='true']")!;
        const canvasPane = container.querySelector<HTMLElement>("[data-split-pane='canvas']")!;
        const separator = screen.getByRole("separator", { name: "Resize canvas and Markdown panels" });

        vi.spyOn(split, "getBoundingClientRect").mockReturnValue({
            x: 0, y: 0, left: 0, top: 0, right: 1200, bottom: 800,
            width: 1200, height: 800, toJSON: () => ({}),
        });

        expect(canvasPane.style.width).toBe("50%");

        // 자유 드래그로 65%로 조절
        fireEvent.pointerDown(separator, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 600 });
        fireEvent.pointerMove(separator, { pointerId: 1, pointerType: "mouse", clientX: 780 });
        fireEvent.pointerUp(separator, { pointerId: 1, pointerType: "mouse", clientX: 780 });

        expect(canvasPane.style.width).toBe("65%");
        expect(separator).toHaveAttribute("aria-valuenow", "65");
        expect(window.localStorage.getItem("meldrift:markdown-split-ratio")).toBe("0.6500");

        // 극단 드래그는 최소/최대 비율(25%~75%)로 클램프된다
        fireEvent.pointerDown(separator, { pointerId: 2, pointerType: "mouse", button: 0, clientX: 780 });
        fireEvent.pointerMove(separator, { pointerId: 2, pointerType: "mouse", clientX: 50 });
        fireEvent.pointerUp(separator, { pointerId: 2, pointerType: "mouse", clientX: 50 });
        expect(separator).toHaveAttribute("aria-valuenow", "25");

        // 더블클릭으로 50% 복원
        fireEvent.doubleClick(separator);
        expect(canvasPane.style.width).toBe("50%");
    });

    it("스마트폰(compact)에서는 캔버스를 숨기고 마크다운 편집기를 전체 화면으로 전환하며 스크롤 위치를 복원한다", () => {
        const scroller = document.createElement("div");
        scroller.scrollLeft = 240;
        scroller.scrollTop = 180;
        const scrollRef = { current: scroller };
        const rafCallbacks: FrameRequestCallback[] = [];
        vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
            rafCallbacks.push(cb);
            return rafCallbacks.length;
        });

        const { container, rerender } = render(
            <BoardSplitLayout
                open={false}
                compact
                scrollRef={scrollRef}
                canvas={<div data-testid="canvas">Canvas</div>}
                panel={<div data-testid="panel">Panel</div>}
            />,
        );

        rerender(
            <BoardSplitLayout
                open
                compact
                scrollRef={scrollRef}
                canvas={<div data-testid="canvas">Canvas</div>}
                panel={<div data-testid="panel">Panel</div>}
            />,
        );

        expect(container.querySelector("[data-split-pane='markdown-compact']")).not.toBeNull();
        expect(screen.getByTestId("canvas").parentElement).toHaveClass("hidden");

        scroller.scrollLeft = 0;
        scroller.scrollTop = 0;

        rerender(
            <BoardSplitLayout
                open={false}
                compact
                scrollRef={scrollRef}
                canvas={<div data-testid="canvas">Canvas</div>}
                panel={<div data-testid="panel">Panel</div>}
            />,
        );

        rafCallbacks.forEach((cb) => cb(0));
        expect(scroller.scrollLeft).toBe(240);
        expect(scroller.scrollTop).toBe(180);
    });
});
