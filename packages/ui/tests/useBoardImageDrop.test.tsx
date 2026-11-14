import "@testing-library/jest-dom/vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useBoardImageDrop } from "../src/features/board/useBoardImageDrop";
import BoardImageDropOverlay from "../src/features/board/BoardImageDropOverlay";

describe("useBoardImageDrop 동작", () => {
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

    it("중첩 카운터로 드래그 진입과 이탈을 추적한다", () => {
        const { result } = setup();

        expect(result.current.isDraggingOverBoard).toBe(false);

        // 컨테이너에 진입한다.
        act(() => {
            result.current.handleDragEnter({
                preventDefault: vi.fn(),
                dataTransfer: { types: ["Files"] },
            } as never);
        });
        expect(result.current.isDraggingOverBoard).toBe(true);

        // 자식 요소에 진입한다.
        act(() => {
            result.current.handleDragEnter({
                preventDefault: vi.fn(),
                dataTransfer: { types: ["Files"] },
            } as never);
        });
        expect(result.current.isDraggingOverBoard).toBe(true);

        // 자식 요소를 벗어나면 카운터가 1로 줄어들지만 드래그 상태는 유지한다.
        act(() => {
            result.current.handleDragLeave({
                preventDefault: vi.fn(),
            } as never);
        });
        expect(result.current.isDraggingOverBoard).toBe(true);

        // 컨테이너를 벗어나면 카운터가 0이 된다.
        act(() => {
            result.current.handleDragLeave({
                preventDefault: vi.fn(),
            } as never);
        });
        expect(result.current.isDraggingOverBoard).toBe(false);
    });

    it("드래그 중 dropEffect를 설정한다", () => {
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

    it("드롭 시 이미지 파일을 선별하고 줌을 반영한 좌표를 계산한다", async () => {
        const { result, onDropImages } = setup(2); // 줌 배율은 2다.

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
        // 가로 드롭 좌표: (가로 스크롤 100 + 포인터 200) / 2 = 150
        // 세로 드롭 좌표: (세로 스크롤 50 + 포인터 100) / 2 = 75
        expect(onDropImages).toHaveBeenCalledWith([imageFile], { x: 150, y: 75 });
    });

    it("이미지 파일이 없는 드롭은 무시한다", async () => {
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

describe("BoardImageDropOverlay 동작", () => {
    it("isDragging이 거짓이면 아무것도 렌더링하지 않는다", () => {
        const { container } = render(<BoardImageDropOverlay isDragging={false} />);
        expect(container.firstChild).toBeNull();
    });

    it("isDragging이 참이면 안내 메시지가 있는 오버레이를 렌더링한다", () => {
        render(<BoardImageDropOverlay isDragging={true} />);
        expect(screen.getByText("Drop image here to add to board")).toBeInTheDocument();
    });

    it("별도 메시지가 주어지면 해당 메시지를 렌더링한다", () => {
        render(<BoardImageDropOverlay isDragging={true} message="Custom drop message" />);
        expect(screen.getByText("Custom drop message")).toBeInTheDocument();
    });
});
