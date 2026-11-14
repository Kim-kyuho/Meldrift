import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useImageCard, type ImageCardData } from "@meldrift/ui/useImageCard";
import { useMemoCard, type MemoCardData } from "@meldrift/ui/useMemoCard";
import { useMermaidCard, type MermaidCardData } from "@meldrift/ui/useMermaidCard";
import { useTableCard } from "@meldrift/ui/useTableCard";
import type { BoardTable } from "@meldrift/ui/useBoardTables";

function dispatchBoardPress(type: "pointerdown" | "pointerup") {
    const board = document.createElement("div");
    board.className = "board-scroll-layer";
    document.body.appendChild(board);
    board.dispatchEvent(new PointerEvent(type, { bubbles: true }));
    board.remove();
}

const memo: MemoCardData = {
    id: 1, boardId: 5, content: "memo", x: 10.4, y: 20.4, z: 3,
    width: 300, height: 200, color: "#fffadc", sortOrder: 1,
};
const image: ImageCardData = {
    imageId: 2, boardId: 5, url: "https://example.com/image.png", label: "image.png",
    data: null, mimeType: null,
    x: 10, y: 20, z: 4, width: 400, height: 300,
};
const mermaid: MermaidCardData = {
    id: 3, boardId: 5, source: "flowchart LR", x: 10, y: 20, z: 5,
    width: 480, height: 360,
};
const table: BoardTable = {
    id: 4, syncId: "table-4", boardId: 5, source: { columns: [{ id: "c", name: "C" }], rows: [] },
    x: 10, y: 20, z: 6, width: 560, height: 360,
};

describe("카드 훅", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("모든 카드 종류의 드래그·리사이즈 종료 시 위치와 크기를 별도로 전달한다", () => {
        const onGeometryChange = { memo: vi.fn(), image: vi.fn(), mermaid: vi.fn(), table: vi.fn() };
        const common = { isEditing: true, onEditing: vi.fn(), onEditingClear: vi.fn(), onUpdate: vi.fn(), onInsert: vi.fn(), onDelete: vi.fn() };
        const { result } = renderHook(() => ({
            memo: useMemoCard({ memo, isFocused: true, onFocus: vi.fn(), onFocusClear: vi.fn(), ...common, onGeometryChange: onGeometryChange.memo }),
            image: useImageCard({ image, ...common, onGeometryChange: onGeometryChange.image }),
            mermaid: useMermaidCard({ mermaid, ...common, onGeometryChange: onGeometryChange.mermaid }),
            table: useTableCard({ table, ...common, onGeometryChange: onGeometryChange.table }),
        }));
        for (const key of ["memo", "image", "mermaid", "table"] as const) {
            act(() => result.current[key].handleDragStop({} as never, { x: 100, y: 200 } as never));
            expect(onGeometryChange[key]).toHaveBeenLastCalledWith(expect.objectContaining({ x: 100, y: 200 }));
            act(() => result.current[key].handleResizeStop({} as never, "bottomRight", { offsetWidth: 600, offsetHeight: 500 } as never, {} as never, { x: 100, y: 200 }));
            expect(onGeometryChange[key]).toHaveBeenLastCalledWith({ x: 100, y: 200, width: 600, height: 500 });
            expect(onGeometryChange[key]).toHaveBeenCalledTimes(2);
        }
        expect(common.onUpdate).not.toHaveBeenCalled();
        expect(common.onInsert).not.toHaveBeenCalled();
    });

    describe("useMemoCard 동작", () => {
        const setup = (overrides: Partial<Parameters<typeof useMemoCard>[0]> = {}) => {
            const callbacks = {
                onEditing: vi.fn(), onEditingClear: vi.fn(), onFocus: vi.fn(), onFocusClear: vi.fn(),
                onInsert: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(),
            };
            const hook = renderHook(() => useMemoCard({
                memo, isEditing: true, isFocused: true, ...callbacks, ...overrides,
            }));
            return { ...hook, ...callbacks };
        };

        it("즉시 편집 모드로 진입한다", () => {
            const onEditing = vi.fn();
            const { result } = setup({ onEditing });
            act(() => result.current.editMemo());
            expect(onEditing).toHaveBeenCalledOnce();
        });

        it("빈 보드를 누르면 최신 내용과 반올림한 위치·크기를 저장한다", () => {
            const { result, onUpdate, onEditingClear } = setup();
            act(() => result.current.setMemoContent("updated"));
            act(() => result.current.handleDragStop({} as never, { x: 31.6, y: 42.4 } as never));
            act(() => {
                dispatchBoardPress("pointerdown");
                dispatchBoardPress("pointerup");
            });
            expect(onUpdate).toHaveBeenCalledWith(1, 5, "updated", 32, 42, 300, 200, "#fffadc");
            expect(onEditingClear).toHaveBeenCalledOnce();
        });

        it("임시 메모를 삽입하고 삭제를 확정한다", () => {
            const onInsert = vi.fn();
            const onDelete = vi.fn();
            const onEditingClear = vi.fn();
            const { result } = setup({ memo: { ...memo, id: -1 }, onInsert, onDelete, onEditingClear });
            act(() => {
                dispatchBoardPress("pointerdown");
                dispatchBoardPress("pointerup");
            });
            expect(onInsert).toHaveBeenCalled();
            act(() => result.current.openDeleteDialog());
            expect(result.current.deleteDialogOpen).toBe(true);
            act(() => result.current.confirmDelete());
            expect(onDelete).toHaveBeenCalledWith(-1);
            expect(result.current.deleteDialogOpen).toBe(false);
        });
    });

    describe("useImageCard 동작", () => {
        it("저장된 이미지를 저장할 때 최신 드래그 상태를 사용한다", () => {
            const onUpdate = vi.fn();
            const onEditingClear = vi.fn();
            const { result } = renderHook(() => useImageCard({
                image, isEditing: true, onEditing: vi.fn(), onEditingClear,
                onUpdate, onDelete: vi.fn(),
            }));
            act(() => result.current.handleDragStop({} as never, { x: 50.6, y: 60.4 } as never));
            act(() => dispatchBoardPress("pointerup"));
            act(() => vi.runAllTimers());
            expect(onUpdate).toHaveBeenCalledWith(2, 5, 51, 60, 400, 300);
            expect(onEditingClear).toHaveBeenCalledOnce();
        });

        it("식별자로 이미지를 삭제한다", () => {
            const onDelete = vi.fn();
            const { result } = renderHook(() => useImageCard({
                image, isEditing: true, onEditing: vi.fn(), onEditingClear: vi.fn(),
                onUpdate: vi.fn(), onDelete,
            }));
            act(() => result.current.confirmDelete());
            expect(onDelete).toHaveBeenCalledWith(2);
        });
    });

    describe("useMermaidCard 동작", () => {
        it("카드 밖 누르기가 완료되면 현재 소스와 위치·크기를 삽입한다", () => {
            const onInsert = vi.fn();
            const onEditingClear = vi.fn();
            const { result } = renderHook(() => useMermaidCard({
                mermaid: { ...mermaid, id: -3 }, isEditing: true,
                onEditing: vi.fn(), onEditingClear,
                onInsert, onUpdate: vi.fn(), onDelete: vi.fn(),
            }));
            act(() => result.current.setSource("sequenceDiagram"));
            act(() => result.current.handleDragStop({} as never, { x: 21.5, y: 30.5 } as never));
            act(() => {
                dispatchBoardPress("pointerdown");
                dispatchBoardPress("pointerup");
            });
            expect(onInsert).toHaveBeenCalledWith(-3, 5, "sequenceDiagram", 22, 31, 5, 480, 360);
            expect(onEditingClear).toHaveBeenCalledOnce();
        });

        it("누르기가 카드 안에서 시작되면 저장하지 않는다", () => {
            const onUpdate = vi.fn();
            renderHook(() => useMermaidCard({
                mermaid, isEditing: true, onEditing: vi.fn(), onEditingClear: vi.fn(),
                onInsert: vi.fn(), onUpdate, onDelete: vi.fn(),
            }));
            const card = document.createElement("div");
            card.className = "mermaid-rnd-3";
            document.body.appendChild(card);
            card.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
            dispatchBoardPress("pointerup");
            expect(onUpdate).not.toHaveBeenCalled();
        });
    });

    describe("useTableCard 동작", () => {
        it("추가된 행에 필요한 최소 높이보다 작게 줄이거나 저장하지 않는다", () => {
            const onUpdate = vi.fn();
            const { result } = renderHook(() => useTableCard({
                table, isEditing: true, onEditing: vi.fn(), onEditingClear: vi.fn(),
                onInsert: vi.fn(), onUpdate, onDelete: vi.fn(),
            }));
            const source = {
                columns: [{ id: "name", name: "Name" }],
                rows: Array.from({ length: 10 }, (_, index) => ({ id: `row-${index}`, cells: { name: "" } })),
            };
            act(() => result.current.setSource(source));
            act(() => {
                dispatchBoardPress("pointerdown");
                dispatchBoardPress("pointerup");
            });
            expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ source, height: 464 }));

            act(() => result.current.handleResizeStop({} as never, "bottom" as never,
                { offsetWidth: 360, offsetHeight: 128 } as HTMLElement, {} as never, { x: 0, y: 0 }));
            expect(result.current.cardState.height).toBe(464);
        });

        it("저장된 표를 최신 소스와 변경된 위치·크기로 갱신한다", () => {
            const onUpdate = vi.fn();
            const { result } = renderHook(() => useTableCard({
                table, isEditing: true, onEditing: vi.fn(), onEditingClear: vi.fn(),
                onInsert: vi.fn(), onUpdate, onDelete: vi.fn(),
            }));
            const source = { columns: [{ id: "new", name: "New" }], rows: [] };
            act(() => result.current.setSource(source));
            const resized = { offsetWidth: 700, offsetHeight: 450 } as HTMLElement;
            act(() => result.current.handleResizeStop({} as never, "right" as never, resized, {} as never, { x: 25.5, y: 35.5 }));
            act(() => {
                dispatchBoardPress("pointerdown");
                dispatchBoardPress("pointerup");
            });
            expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
                id: 4, source, x: 26, y: 36, width: 700, height: 450,
            }));
        });

        it("확인 대화상자 누르기는 무시하고 명시적으로 삭제를 확정한다", () => {
            const onUpdate = vi.fn();
            const onDelete = vi.fn();
            const onEditingClear = vi.fn();
            const { result } = renderHook(() => useTableCard({
                table, isEditing: true, onEditing: vi.fn(), onEditingClear,
                onInsert: vi.fn(), onUpdate, onDelete,
            }));
            const dialog = document.createElement("div");
            dialog.className = "confirm-dialog";
            document.body.appendChild(dialog);
            dialog.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
            dialog.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
            expect(onUpdate).not.toHaveBeenCalled();

            act(() => result.current.openDeleteDialog());
            act(() => result.current.confirmDelete());
            expect(onDelete).toHaveBeenCalledWith(4);
            expect(onEditingClear).toHaveBeenCalledOnce();
        });
    });
});
