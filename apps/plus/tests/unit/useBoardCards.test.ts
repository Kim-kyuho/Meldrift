import { act, renderHook } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBoardImages, type BoardImage } from "@/hooks/useBoardImages";
import { useBoardMemos, type BoardMemo } from "@/hooks/useBoardMemos";
import { useBoardMermaids, type BoardMermaid } from "@/hooks/useBoardMermaids";
import { useBoardTables, type BoardTable } from "@/hooks/useBoardTables";

const locationRef = createRef<HTMLDivElement>();

function setLocation(scrollLeft = 400, scrollTop = 200, clientWidth = 800, clientHeight = 600) {
    const element = document.createElement("div");
    Object.defineProperties(element, {
        scrollLeft: { configurable: true, value: scrollLeft },
        scrollTop: { configurable: true, value: scrollTop },
        clientWidth: { configurable: true, value: clientWidth },
        clientHeight: { configurable: true, value: clientHeight },
    });
    locationRef.current = element;
}

const memo: BoardMemo = {
    id: 1, boardId: 5, content: "memo", x: 10, y: 20, z: 1,
    width: 300, height: 200, color: "#fffadc",
};
const image: BoardImage = {
    imageId: 2, boardId: 5, publicId: "public", secureUrl: "https://image",
    fileName: "image.png", x: 10, y: 20, z: 2, width: 400, height: 300,
};
const mermaid: BoardMermaid = {
    id: 3, boardId: 5, source: "flowchart LR", x: 10, y: 20, z: 3,
    width: 480, height: 360,
};
const table: BoardTable = {
    id: 4, boardId: 5,
    source: { columns: [{ id: "c", name: "C" }], rows: [] },
    x: 10, y: 20, z: 4, width: 560, height: 360,
};

describe("board card collection hooks", () => {
    beforeEach(() => {
        setLocation();
        vi.spyOn(Date, "now").mockReturnValue(1000);
    });

    afterEach(() => vi.unstubAllGlobals());

    describe("useBoardMemos", () => {
        const setup = (canEditCard = true) => {
            const showPermissionMessage = vi.fn();
            const setPermissionMessage = vi.fn();
            const onPreviewUpdate = vi.fn();
            const hook = renderHook(() => useBoardMemos({
                initialMemos: [memo], boardId: 5, boardZoom: 2, cardLocationRef: locationRef,
                canEditCard, showPermissionMessage, setPermissionMessage, onPreviewUpdate,
            }));
            return { ...hook, showPermissionMessage, setPermissionMessage, onPreviewUpdate };
        };

        it("creates an editable temporary memo in the visible center", () => {
            const { result } = setup();
            act(() => result.current.handleCreateTempMemo());

            expect(result.current.memos[1]).toMatchObject({
                id: -1000, boardId: 5, x: 250, y: 150, width: 300, height: 200,
            });
            expect(result.current.editingMemoId).toBe(-1000);
        });

        it("blocks temporary creation without permission", () => {
            const { result, showPermissionMessage } = setup(false);
            act(() => result.current.handleCreateTempMemo());
            expect(result.current.memos).toEqual([memo]);
            expect(showPermissionMessage).toHaveBeenCalledOnce();
        });

        it("inserts, updates, and deletes persisted memos", async () => {
            const inserted = { ...memo, id: 10, content: "created" };
            vi.stubGlobal("fetch", vi.fn()
                .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ ok: true, memo: inserted }) })
                .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ ok: true }) })
                .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ ok: true }) }));
            const { result, onPreviewUpdate } = setup();
            act(() => result.current.handleCreateTempMemo());

            await act(async () => result.current.handleInsertMemo(-1000, 5, "created", 1, 2, 3, 300, 200, "#fff"));
            expect(result.current.memos.some((item) => item.id === 10)).toBe(true);

            await act(async () => result.current.handleUpdateMemo(10, 5, "updated", 4, 5, 6, 320, 220, "#000"));
            expect(result.current.memos.find((item) => item.id === 10)).toMatchObject({ content: "updated", z: 6 });
            expect(onPreviewUpdate).toHaveBeenCalledTimes(2);

            await act(async () => result.current.handleDeleteMemo(10));
            expect(result.current.memos.some((item) => item.id === 10)).toBe(false);
        });

        it("deletes a temporary memo without a request", async () => {
            const fetchMock = vi.fn();
            vi.stubGlobal("fetch", fetchMock);
            const { result } = setup();
            act(() => result.current.handleCreateTempMemo());
            await act(async () => result.current.handleDeleteMemo(-1000));
            expect(result.current.memos).toEqual([memo]);
            expect(result.current.editingMemoId).toBeNull();
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    describe("useBoardMermaids", () => {
        const setup = () => renderHook(() => useBoardMermaids({
            initialMermaids: [mermaid], boardId: 5, boardZoom: 2, cardLocationRef: locationRef,
            canEditCard: true, showPermissionMessage: vi.fn(), setPermissionMessage: vi.fn(),
            onPreviewUpdate: vi.fn(),
        }));

        it("creates a centered editable Mermaid card", () => {
            const { result } = setup();
            act(() => result.current.handleCreateTempMermaid());
            expect(result.current.mermaids[1]).toMatchObject({ id: -1000, x: 160, y: 70, width: 480, height: 360 });
            expect(result.current.editingMermaidId).toBe(-1000);
        });

        it("maps the API shape when inserting and handles persisted deletion", async () => {
            const apiMermaid = { mermaidId: 30, boardId: 5, source: "A-->B", x: 1, y: 2, z: 3, width: 4, height: 5 };
            vi.stubGlobal("fetch", vi.fn()
                .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ ok: true, mermaid: apiMermaid }) })
                .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ ok: true }) }));
            const { result } = setup();
            act(() => result.current.handleCreateTempMermaid());
            await act(async () => result.current.handleInsertMermaid(-1000, 5, "A-->B", 1, 2, 3, 4, 5));
            expect(result.current.mermaids[1]).toEqual({ id: 30, boardId: 5, source: "A-->B", x: 1, y: 2, z: 3, width: 4, height: 5 });
            await act(async () => result.current.handleDeleteMermaid(30));
            expect(result.current.mermaids.some((item) => item.id === 30)).toBe(false);
        });
    });

    describe("useBoardTables", () => {
        const setup = () => renderHook(() => useBoardTables({
            initialTables: [table], boardId: 5, boardZoom: 2, cardLocationRef: locationRef,
            canEditCard: true, showPermissionMessage: vi.fn(), setPermissionMessage: vi.fn(),
            onPreviewUpdate: vi.fn(),
        }));

        it("creates an independent default table at the visible center", () => {
            const { result } = setup();
            act(() => result.current.handleCreateTempTable());
            expect(result.current.tables[1]).toMatchObject({ id: -1000, x: 120, y: 70, width: 560, height: 360 });
            expect(result.current.tables[1].source).not.toBe(table.source);
            expect(result.current.editingTableId).toBe(-1000);
        });

        it("inserts, updates, and deletes tables", async () => {
            const inserted = { tableId: 40, boardId: 5, source: table.source, x: 1, y: 2, z: 3, width: 4, height: 5 };
            vi.stubGlobal("fetch", vi.fn()
                .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ ok: true, table: inserted }) })
                .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ ok: true }) })
                .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ ok: true }) }));
            const { result } = setup();
            act(() => result.current.handleCreateTempTable());
            await act(async () => result.current.handleInsertTable(result.current.tables[1]));
            expect(result.current.tables[1].id).toBe(40);
            const updated = { ...result.current.tables[1], width: 800 };
            await act(async () => result.current.handleUpdateTable(updated));
            expect(result.current.tables[1].width).toBe(800);
            await act(async () => result.current.handleDeleteTable(40));
            expect(result.current.tables.some((item) => item.id === 40)).toBe(false);
        });
    });

    describe("useBoardImages", () => {
        it("opens the file input only when editing is allowed", () => {
            const allowed = renderHook(() => useBoardImages({
                initialImages: [image], boardId: 5, boardZoom: 2, cardLocationRef: locationRef,
                canEditCard: true, showPermissionMessage: vi.fn(), setPermissionMessage: vi.fn(),
                onPreviewUpdate: vi.fn(),
            }));
            const click = vi.fn();
            allowed.result.current.imageInputRef.current = { click } as unknown as HTMLInputElement;
            act(() => allowed.result.current.handleImageUploadClick());
            expect(click).toHaveBeenCalledOnce();
            allowed.unmount();

            const showPermissionMessage = vi.fn();
            const denied = renderHook(() => useBoardImages({
                initialImages: [image], boardId: 5, boardZoom: 2, cardLocationRef: locationRef,
                canEditCard: false, showPermissionMessage, setPermissionMessage: vi.fn(),
                onPreviewUpdate: vi.fn(),
            }));
            act(() => denied.result.current.handleImageUploadClick());
            expect(showPermissionMessage).toHaveBeenCalledOnce();
        });

        it("updates and deletes a persisted image", async () => {
            vi.stubGlobal("fetch", vi.fn()
                .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ ok: true }) })
                .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ ok: true }) }));
            const { result } = renderHook(() => useBoardImages({
                initialImages: [image], boardId: 5, boardZoom: 2, cardLocationRef: locationRef,
                canEditCard: true, showPermissionMessage: vi.fn(), setPermissionMessage: vi.fn(),
                onPreviewUpdate: vi.fn(),
            }));
            await act(async () => result.current.handleUpdateImage(2, 5, "new-public", "new-url", "new.png", 1, 2, 3, 4, 5));
            expect(result.current.images[0]).toMatchObject({ publicId: "new-public", z: 3, width: 4 });
            await act(async () => result.current.handleDeleteImage(2));
            expect(result.current.images).toEqual([]);
        });
    });
});
