import { act, renderHook, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBoardPinchZoom } from "../src/features/viewport/useBoardPinchZoom";

describe("useBoardPinchZoom", () => {
    let viewport: HTMLDivElement;
    let size: HTMLDivElement;
    let board: HTMLDivElement;
    let frames: Map<number, FrameRequestCallback>;

    beforeEach(() => {
        frames = new Map();
        let frameId = 0;
        vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
            frames.set(++frameId, callback);
            return frameId;
        });
        vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
            frames.delete(id);
        });
        viewport = document.createElement("div");
        size = document.createElement("div");
        board = document.createElement("div");
        size.className = "board-size-layer";
        board.className = "meldrift-board";
        viewport.style.overflow = "auto";
        viewport.scrollLeft = 500;
        viewport.scrollTop = 300;
        size.style.width = "3000px";
        size.style.height = "2250px";
        board.style.transform = "scale(0.75)";
        Object.defineProperties(board, {
            offsetWidth: { value: 4000 },
            offsetHeight: { value: 3000 },
        });
        viewport.append(size);
        size.append(board);
        document.body.append(viewport);
    });

    afterEach(() => {
        cleanup();
        viewport.remove();
        vi.restoreAllMocks();
    });

    const touch = (type: string, xs: number[]) => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, "touches", {
            value: xs.map((clientX) => ({ clientX, clientY: 100 })),
        });
        act(() => { viewport.dispatchEvent(event); });
        return event;
    };

    const flushFrame = () => act(() => {
        const callbacks = [...frames.values()];
        frames.clear();
        callbacks.forEach((callback) => callback(0));
    });

    const setup = (options: { minZoom?: number; maxZoom?: number } = {}) => {
        const setBoardZoom = vi.fn();
        const boardScrollRef = { current: viewport };
        const hook = renderHook(({ boardZoom, enabled }) => useBoardPinchZoom({
            ...options,
            boardScrollRef,
            boardZoom,
            setBoardZoom,
            enabled,
        }), { initialProps: { boardZoom: 0.75, enabled: true } });
        return { ...hook, setBoardZoom };
    };

    it("keeps scroll and layout size unchanged while translating and scaling", () => {
        const { setBoardZoom } = setup();
        touch("touchstart", [100, 200]);
        touch("touchmove", [50, 250]);
        flushFrame();

        expect(board.style.transform).toBe("translate(-650px, -400px) scale(1.5)");
        expect(viewport.scrollLeft).toBe(500);
        expect(viewport.scrollTop).toBe(300);
        expect(size.style.width).toBe("3000px");
        expect(size.style.height).toBe("2250px");
        expect(viewport.style.overflow).toBe("hidden");
        expect(setBoardZoom).not.toHaveBeenCalled();

        touch("touchend", []);
        expect(board.style.transform).toBe("scale(1.5)");
        expect(size.style.width).toBe("6000px");
        expect(size.style.height).toBe("4500px");
        expect(viewport.scrollLeft).toBe(1150);
        expect(viewport.scrollTop).toBe(700);
        expect(viewport.style.overflow).toBe("auto");
        expect(setBoardZoom).toHaveBeenCalledExactlyOnceWith(1.5);
    });

    it("commits the latest move even when touch ends before the next frame", () => {
        const { setBoardZoom } = setup();
        touch("touchstart", [100, 200]);
        touch("touchmove", [50, 250]);
        touch("touchend", [50]);

        expect(frames.size).toBe(0);
        expect(board.style.transform).toBe("scale(1.5)");
        expect(viewport.scrollLeft).toBe(1150);
        expect(setBoardZoom).toHaveBeenCalledExactlyOnceWith(1.5);
    });

    it("restores scrolling on cancellation even if two touches remain", () => {
        setup();
        touch("touchstart", [100, 200]);
        touch("touchmove", [50, 250]);
        touch("touchcancel", [50, 250]);

        expect(viewport.style.overflow).toBe("auto");
        expect(board.style.transform).toBe("scale(1.5)");
        expect(board.style.willChange).toBe("");
    });

    it("leaves single-touch panning alone", () => {
        setup();
        const event = touch("touchstart", [100]);

        expect(event.defaultPrevented).toBe(false);
        expect(viewport.style.overflow).toBe("auto");
        expect(board.style.transform).toBe("scale(0.75)");
    });

    it("removes temporary transforms and restores scrolling on unmount", () => {
        const { unmount, setBoardZoom } = setup();
        touch("touchstart", [100, 200]);
        touch("touchmove", [50, 250]);
        flushFrame();
        unmount();

        expect(viewport.style.overflow).toBe("auto");
        expect(board.style.transform).toBe("scale(0.75)");
        expect(viewport.scrollLeft).toBe(500);
        expect(viewport.scrollTop).toBe(300);
        expect(setBoardZoom).not.toHaveBeenCalled();
    });

    it("coalesces moves into one frame and never writes scroll during the pinch", () => {
        const { setBoardZoom } = setup();
        const setLeft = vi.fn();
        const setTop = vi.fn();
        Object.defineProperties(viewport, {
            scrollLeft: { configurable: true, get: () => 500, set: setLeft },
            scrollTop: { configurable: true, get: () => 300, set: setTop },
        });
        touch("touchstart", [100, 200]);
        touch("touchmove", [75, 225]);
        touch("touchmove", [50, 250]);

        expect(frames.size).toBe(1);
        expect(board.style.transform).toBe("scale(0.75)");
        flushFrame();
        expect(board.style.transform).toBe("translate(-650px, -400px) scale(1.5)");
        expect(setLeft).not.toHaveBeenCalled();
        expect(setTop).not.toHaveBeenCalled();
        expect(setBoardZoom).not.toHaveBeenCalled();

        touch("touchend", []);
        expect(setLeft).toHaveBeenCalledExactlyOnceWith(1150);
        expect(setTop).toHaveBeenCalledExactlyOnceWith(700);
    });

    it("uses the committed zoom and position as the next pinch baseline", () => {
        const { rerender, setBoardZoom } = setup();
        touch("touchstart", [100, 200]);
        touch("touchmove", [50, 250]);
        touch("touchend", []);
        rerender({ boardZoom: 1.5, enabled: true });

        touch("touchstart", [50, 250]);
        touch("touchmove", [100, 200]);
        flushFrame();
        expect(board.style.transform).toBe("translate(650px, 400px) scale(0.75)");
        expect(viewport.scrollLeft).toBe(1150);
        expect(viewport.scrollTop).toBe(700);

        touch("touchend", []);
        expect(board.style.transform).toBe("scale(0.75)");
        expect(viewport.scrollLeft).toBe(500);
        expect(viewport.scrollTop).toBe(300);
        expect(size.style.width).toBe("3000px");
        expect(size.style.height).toBe("2250px");
        expect(setBoardZoom.mock.calls).toEqual([[1.5], [0.75]]);
    });

    it("preserves an active gesture across unrelated renders", () => {
        const { rerender } = setup();
        touch("touchstart", [100, 200]);
        touch("touchmove", [50, 250]);
        rerender({ boardZoom: 0.75, enabled: true });
        flushFrame();

        expect(board.style.transform).toBe("translate(-650px, -400px) scale(1.5)");
        expect(viewport.style.overflow).toBe("hidden");
        touch("touchend", []);
        expect(viewport.style.overflow).toBe("auto");
    });

    it("calculates the anchor relative to the viewport, not the screen origin", () => {
        vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({
            x: 50, y: 25, left: 50, top: 25, right: 850, bottom: 625,
            width: 800, height: 600, toJSON: () => ({}),
        });
        setup();
        touch("touchstart", [100, 200]);
        touch("touchmove", [50, 250]);
        flushFrame();

        expect(board.style.transform).toBe("translate(-600px, -375px) scale(1.5)");
        touch("touchend", []);
        expect(viewport.scrollLeft).toBe(1100);
        expect(viewport.scrollTop).toBe(675);
    });

    it.each([
        { xs: [149, 151], zoom: 0.5 },
        { xs: [0, 300], zoom: 1.25 },
    ])("clamps the committed zoom to $zoom", ({ xs, zoom }) => {
        const { setBoardZoom } = setup({ minZoom: 0.5, maxZoom: 1.25 });
        touch("touchstart", [100, 200]);
        touch("touchmove", xs);
        flushFrame();
        touch("touchend", []);

        expect(setBoardZoom).toHaveBeenCalledExactlyOnceWith(zoom);
        expect(board.style.transform).toBe(`scale(${zoom})`);
        expect(size.style.width).toBe(`${4000 * zoom}px`);
        expect(size.style.height).toBe(`${3000 * zoom}px`);
    });

    it("rounds zoom to one percent increments", () => {
        const { setBoardZoom } = setup();
        touch("touchstart", [100, 200]);
        touch("touchmove", [100, 201]);
        touch("touchend", []);

        expect(setBoardZoom).toHaveBeenCalledExactlyOnceWith(0.76);
        expect(board.style.transform).toBe("scale(0.76)");
    });

    it("restores CSS-controlled overflow when ending without movement", () => {
        viewport.style.overflow = "";
        const { setBoardZoom } = setup();
        touch("touchstart", [100, 200]);
        expect(viewport.style.overflow).toBe("hidden");
        touch("touchend", []);

        expect(viewport.style.overflow).toBe("");
        expect(board.style.transform).toBe("scale(0.75)");
        expect(board.style.willChange).toBe("");
        expect(viewport.scrollLeft).toBe(500);
        expect(viewport.scrollTop).toBe(300);
        expect(setBoardZoom).not.toHaveBeenCalled();
    });

    it("cancels a queued frame when disabled and accepts gestures after re-enabling", () => {
        const { rerender, setBoardZoom } = setup();
        touch("touchstart", [100, 200]);
        touch("touchmove", [50, 250]);
        rerender({ boardZoom: 0.75, enabled: false });

        expect(frames.size).toBe(0);
        expect(viewport.style.overflow).toBe("auto");
        expect(board.style.transform).toBe("scale(0.75)");
        expect(touch("touchstart", [100, 200]).defaultPrevented).toBe(false);
        touch("touchmove", [50, 250]);
        expect(frames.size).toBe(0);
        expect(setBoardZoom).not.toHaveBeenCalled();

        rerender({ boardZoom: 0.75, enabled: true });
        touch("touchstart", [100, 200]);
        touch("touchmove", [50, 250]);
        touch("touchend", []);
        expect(setBoardZoom).toHaveBeenCalledExactlyOnceWith(1.5);
    });

    it("does not calculate a scale when the initial touch distance is zero", () => {
        const { setBoardZoom } = setup();
        touch("touchstart", [150, 150]);
        touch("touchmove", [100, 200]);
        expect(frames.size).toBe(0);
        touch("touchend", []);

        expect(board.style.transform).toBe("scale(0.75)");
        expect(viewport.style.overflow).toBe("auto");
        expect(setBoardZoom).not.toHaveBeenCalled();
    });

    it("does not intercept one-finger movement after a cancelled pinch", () => {
        setup();
        touch("touchstart", [100, 200]);
        touch("touchmove", [50, 250]);
        touch("touchcancel", []);

        expect(touch("touchstart", [100]).defaultPrevented).toBe(false);
        expect(touch("touchmove", [150]).defaultPrevented).toBe(false);
        expect(viewport.style.overflow).toBe("auto");
        expect(frames.size).toBe(0);
    });
});
