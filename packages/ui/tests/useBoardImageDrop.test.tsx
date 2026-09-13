import "@testing-library/jest-dom/vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useBoardImageDrop } from "../src/features/board/useBoardImageDrop";
import BoardImageDropOverlay from "../src/features/board/BoardImageDropOverlay";

describe("useBoardImageDrop", () => {
    const setup = (zoom = 1) => {
        const boardScrollRef = createRef<HTMLDivElement>();
        const container = document.createElement("div");
        Object.defineProperties(container, {
            scrollLeft: { configurable: true, value: 100 },
            scrollTop: { configurable: true, value: 50 },
        });
        vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
            left: 20,
            top: 10,
            right: 820,
            bottom: 610,
            width: 800,
            height: 600,
            x: 20,
            y: 10,
            toJSON: () => {},
        });
        boardScrollRef.current = container;

        const onDropImages = vi.fn();
        const hook = renderHook(() => useBoardImageDrop({
            boardScrollRef,
            boardZoom: zoom,
            onDropImages,
        }));

        return { ...hook, onDropImages, boardScrollRef };
    };

    it("tracks drag enter and leave with nested counter logic", () => {
        const { result } = setup();

        expect(result.current.isDraggingOverBoard).toBe(false);

        // Enter container
        act(() => {
            result.current.handleDragEnter({
                preventDefault: vi.fn(),
                dataTransfer: { types: ["Files"] },
            } as never);
        });
        expect(result.current.isDraggingOverBoard).toBe(true);

        // Enter child element
        act(() => {
            result.current.handleDragEnter({
                preventDefault: vi.fn(),
                dataTransfer: { types: ["Files"] },
            } as never);
        });
        expect(result.current.isDraggingOverBoard).toBe(true);

        // Leave child element (counter drops to 1, still dragging)
        act(() => {
            result.current.handleDragLeave({
                preventDefault: vi.fn(),
            } as never);
        });
        expect(result.current.isDraggingOverBoard).toBe(true);

        // Leave container (counter drops to 0)
        act(() => {
            result.current.handleDragLeave({
                preventDefault: vi.fn(),
            } as never);
        });
        expect(result.current.isDraggingOverBoard).toBe(false);
    });

    it("sets dropEffect on drag over", () => {
        const { result } = setup();
        const dataTransfer = { dropEffect: "" };
        const preventDefault = vi.fn();

        act(() => {
            result.current.handleDragOver({
                preventDefault,
                dataTransfer,
            } as never);
        });

        expect(preventDefault).toHaveBeenCalled();
        expect(dataTransfer.dropEffect).toBe("copy");
    });

    it("filters image files and computes zoom-adjusted coordinates on drop", async () => {
        const { result, onDropImages } = setup(2); // zoom = 2

        const imageFile = new File(["data"], "test.png", { type: "image/png" });
        const textFile = new File(["text"], "test.txt", { type: "text/plain" });

        await act(async () => {
            await result.current.handleDrop({
                preventDefault: vi.fn(),
                clientX: 220, // clientX - rect.left (20) = 200
                clientY: 110, // clientY - rect.top (10) = 100
                dataTransfer: {
                    files: [imageFile, textFile],
                },
            } as never);
        });

        expect(result.current.isDraggingOverBoard).toBe(false);
        expect(onDropImages).toHaveBeenCalledOnce();
        // dropX = (scrollLeft(100) + 200) / 2 = 150
        // dropY = (scrollTop(50) + 100) / 2 = 75
        expect(onDropImages).toHaveBeenCalledWith([imageFile], { x: 150, y: 75 });
    });

    it("ignores drop when no image files are present", async () => {
        const { result, onDropImages } = setup();
        const textFile = new File(["text"], "test.txt", { type: "text/plain" });

        await act(async () => {
            await result.current.handleDrop({
                preventDefault: vi.fn(),
                clientX: 100,
                clientY: 100,
                dataTransfer: {
                    files: [textFile],
                },
            } as never);
        });

        expect(onDropImages).not.toHaveBeenCalled();
    });
});

describe("BoardImageDropOverlay", () => {
    it("renders nothing when isDragging is false", () => {
        const { container } = render(<BoardImageDropOverlay isDragging={false} />);
        expect(container.firstChild).toBeNull();
    });

    it("renders overlay with message when isDragging is true", () => {
        render(<BoardImageDropOverlay isDragging={true} />);
        expect(screen.getByText("Drop image here to add to board")).toBeInTheDocument();
    });

    it("renders custom message when provided", () => {
        render(<BoardImageDropOverlay isDragging={true} message="Custom drop message" />);
        expect(screen.getByText("Custom drop message")).toBeInTheDocument();
    });
});
