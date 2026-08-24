import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAiAssistant } from "@/hooks/useAiAssistant";
import type { BoardMemo } from "@/hooks/useBoardMemos";
import type { BoardMermaid } from "@/hooks/useBoardMermaids";
import type { BoardTable } from "@/hooks/useBoardTables";
import type { BoardImage } from "@/hooks/useBoardImages";

// 훅은 카드 컬렉션을 소유하지 않고 setter를 주입받는다. 테스트에서 그 컬렉션 역할을 대신한다.
function createHarness(initialMemos: BoardMemo[]) {
    const store = {
        memos: initialMemos,
        mermaids: [] as BoardMermaid[],
        tables: [] as BoardTable[],
        images: [] as BoardImage[],
    };

    // React setState와 같은 계약(값 또는 갱신 함수)을 지원한다.
    const makeSetter =
        <K extends keyof typeof store>(key: K) =>
        (next: (typeof store)[K] | ((prev: (typeof store)[K]) => (typeof store)[K])) => {
            store[key] = typeof next === "function" ? (next as (p: unknown) => never)(store[key]) : next;
        };

    const options = {
        boardId: 1,
        boardWidth: 7680,
        boardHeight: 4320,
        boardZoom: 1,
        cardLocationRef: { current: null },
        canEditCard: true,
        showPermissionMessage: vi.fn(),
        setPermissionMessage: vi.fn(),
        get memos() {
            return store.memos;
        },
        get mermaids() {
            return store.mermaids;
        },
        get tables() {
            return store.tables;
        },
        get images() {
            return store.images;
        },
        setMemos: makeSetter("memos"),
        setMermaids: makeSetter("mermaids"),
        setTables: makeSetter("tables"),
        setImages: makeSetter("images"),
        onInsertMemo: vi.fn().mockResolvedValue(undefined),
        onInsertMermaid: vi.fn().mockResolvedValue(undefined),
        onInsertTable: vi.fn().mockResolvedValue(undefined),
        onInsertImage: vi.fn().mockResolvedValue(undefined),
        onUpdateMemo: vi.fn().mockResolvedValue(undefined),
        onUpdateMermaid: vi.fn().mockResolvedValue(undefined),
        onUpdateTable: vi.fn().mockResolvedValue(undefined),
        onDeleteMemo: vi.fn().mockResolvedValue(undefined),
        onDeleteMermaid: vi.fn().mockResolvedValue(undefined),
        onDeleteTable: vi.fn().mockResolvedValue(undefined),
        onDeleteImage: vi.fn().mockResolvedValue(undefined),
    };

    return { store, options };
}

const memoOf = (id: number, content: string): BoardMemo => ({
    id,
    boardId: 1,
    content,
    x: 100,
    y: 100,
    z: 1,
    width: 400,
    height: 200,
    color: "#fffadc",
});

// 채팅 응답을 순서대로 돌려준다.
const stubChat = (payloads: unknown[]) => {
    const fetchMock = vi.fn();

    payloads.forEach((payload) => {
        fetchMock.mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(payload) });
    });

    vi.stubGlobal("fetch", fetchMock);

    return fetchMock;
};

const editReply = (id: number, text: string) => ({
    ok: true,
    reply: "done",
    plan: null,
    arrangement: null,
    edit: { memos: [{ id, blocks: [{ type: "paragraph", text }] }] },
    deletion: null,
    images: [],
});

describe("useAiAssistant edit undo", () => {
    it("reverts a single edit back to the original content", async () => {
        const { store, options } = createHarness([memoOf(7, "<p>original</p>")]);
        stubChat([editReply(7, "first")]);

        const { result, rerender } = renderHook(() => useAiAssistant(options));

        await act(async () => {
            await result.current.handleSendMessage("고쳐줘");
        });
        rerender();

        expect(store.memos[0].content).toBe("<p>first</p>");

        act(() => result.current.discardPendingCards());

        expect(store.memos[0].content).toBe("<p>original</p>");
    });

    /**
     * 회귀 테스트.
     *
     * 같은 카드를 연달아 고칠 때, 두 번째 요청은 먼저 이전 제안을 되돌린 뒤 적용한다.
     * 예전 구현은 되돌린 결과를 클로저에서 읽지 못해 중간 버전("first")을 원본으로 기록했고,
     * Discard가 AI 이전 상태가 아니라 그 중간 버전으로 돌아갔다.
     */
    it("reverts to the pre-AI content after editing the same card twice", async () => {
        const { store, options } = createHarness([memoOf(7, "<p>original</p>")]);
        stubChat([editReply(7, "first"), editReply(7, "second")]);

        const { result, rerender } = renderHook(() => useAiAssistant(options));

        await act(async () => {
            await result.current.handleSendMessage("한 번 고쳐줘");
        });
        rerender();
        expect(store.memos[0].content).toBe("<p>first</p>");

        await act(async () => {
            await result.current.handleSendMessage("다시 고쳐줘");
        });
        rerender();
        expect(store.memos[0].content).toBe("<p>second</p>");

        act(() => result.current.discardPendingCards());

        // 중간 버전이 아니라 맨 처음 내용으로 돌아가야 한다.
        expect(store.memos[0].content).toBe("<p>original</p>");
    });

    it("still reverts correctly after three consecutive edits", async () => {
        const { store, options } = createHarness([memoOf(7, "<p>original</p>")]);
        stubChat([editReply(7, "a"), editReply(7, "b"), editReply(7, "c")]);

        const { result, rerender } = renderHook(() => useAiAssistant(options));

        for (const prompt of ["1", "2", "3"]) {
            await act(async () => {
                await result.current.handleSendMessage(prompt);
            });
            rerender();
        }

        expect(store.memos[0].content).toBe("<p>c</p>");

        act(() => result.current.discardPendingCards());

        expect(store.memos[0].content).toBe("<p>original</p>");
    });

    it("keeps the original when a later request edits a different card", async () => {
        const { store, options } = createHarness([
            memoOf(7, "<p>seven</p>"),
            memoOf(8, "<p>eight</p>"),
        ]);
        stubChat([editReply(7, "seven edited"), editReply(8, "eight edited")]);

        const { result, rerender } = renderHook(() => useAiAssistant(options));

        await act(async () => {
            await result.current.handleSendMessage("7번 고쳐줘");
        });
        rerender();

        await act(async () => {
            await result.current.handleSendMessage("8번 고쳐줘");
        });
        rerender();

        // 두 번째 요청이 7번을 되돌리고 8번만 고친다.
        expect(store.memos[0].content).toBe("<p>seven</p>");
        expect(store.memos[1].content).toBe("<p>eight edited</p>");

        act(() => result.current.discardPendingCards());

        expect(store.memos[0].content).toBe("<p>seven</p>");
        expect(store.memos[1].content).toBe("<p>eight</p>");
    });

    it("restores a deleted card and then reverts a later edit to the original", async () => {
        const { store, options } = createHarness([memoOf(7, "<p>original</p>")]);
        stubChat([
            {
                ok: true,
                reply: "deleted",
                plan: null,
                arrangement: null,
                edit: null,
                deletion: { memoIds: [7] },
                images: [],
            },
            editReply(7, "edited"),
        ]);

        const { result, rerender } = renderHook(() => useAiAssistant(options));

        await act(async () => {
            await result.current.handleSendMessage("지워줘");
        });
        rerender();
        expect(store.memos).toHaveLength(0);

        await act(async () => {
            await result.current.handleSendMessage("아니 고쳐줘");
        });
        rerender();
        // 지운 카드를 되살린 뒤 고쳐야 한다.
        expect(store.memos).toHaveLength(1);
        expect(store.memos[0].content).toBe("<p>edited</p>");

        act(() => result.current.discardPendingCards());

        expect(store.memos[0].content).toBe("<p>original</p>");
    });
});
