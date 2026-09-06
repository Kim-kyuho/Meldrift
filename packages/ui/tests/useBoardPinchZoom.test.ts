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

    const setup = () => {
        const setBoardZoom = vi.fn();
        const hook = renderHook(() => useBoardPinchZoom({
            boardScrollRef: { current: viewport },
            boardZoom: 0.75,
            setBoardZoom,
        }));
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
});
