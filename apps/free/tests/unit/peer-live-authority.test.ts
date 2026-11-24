import { diffBoardSnapshots, memoOrderKey } from "@meldrift/board-data/board-delta";
import { createEmptyBoardSnapshot, type BoardSnapshot } from "@meldrift/board-data/board-state";
import { expect, it, vi } from "vitest";
import { BoardAuthority } from "@/lib/peer-live/board/authority";
import { decodeBoardPacket, type BoardProposal } from "@/lib/peer-live/board/wire";

it("only announces a durable change and retries a failed proposal without committing it twice", async () => {
    const board = createEmptyBoardSnapshot();
    const edited = {
        ...board,
        memos: [{
            id: 1, syncId: "shared-memo", boardId: board.board.boardId, content: "A shared edit",
            x: 20, y: 20, z: 1, width: 240, height: 160, color: "#fffadc", sortOrder: 1,
        }],
    };
    const persist = vi.fn<(_: BoardSnapshot) => Promise<void>>()
        .mockRejectedValueOnce(new Error("Storage unavailable"))
        .mockResolvedValue(undefined);
    const announce = vi.fn();
    const authority = new BoardAuthority(board, persist, announce);
    const editor = { id: "guest", role: "editor" as const };
    const submit = authority.proposalsFrom(editor, () => true);
    const proposal: BoardProposal = {
        kind: "propose", sequence: 1, assets: new Map(),
        change: { baseRevision: 0, mutationId: crypto.randomUUID(), operations: diffBoardSnapshots(board, edited) },
    };
    expect(authority.acquire(editor, [memoOrderKey], "edit")).toEqual({ granted: true, revision: 0 });

    await expect(submit(proposal)).rejects.toThrow("Storage unavailable");
    expect(authority.board).toBe(board);
    expect(authority.revision).toBe(0);
    expect(announce).not.toHaveBeenCalled();

    await Promise.all([submit(proposal), submit(proposal)]);
    expect(authority.board.memos).toEqual(edited.memos);
    expect(authority.revision).toBe(1);
    expect(persist).toHaveBeenCalledTimes(2);
    expect(announce).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ revision: 1, author: editor.id }));
});

it("keeps memo formatting and removes external resources in board messages", async () => {
    const board = createEmptyBoardSnapshot();
    const memo = {
        id: 1, syncId: "shared-memo", boardId: board.board.boardId,
        content: '<p><strong>Shared</strong><img src="https://example.invalid/image.png"><span style="color: blue">memo</span></p>',
        x: 20, y: 20, z: 1, width: 240, height: 160, color: "#fffadc", sortOrder: 1,
    };
    const edited = { ...board, memos: [memo] };
    const safeMemo = '<p><strong>Shared</strong><span style="color: blue">memo</span></p>';

    const snapshot = await decodeBoardPacket({ metadata: { kind: "snapshot", revision: 0, board: edited, assets: [] }, assets: [] });
    expect(snapshot).toMatchObject({ kind: "snapshot", board: { memos: [{ content: safeMemo }] } });

    const change = { baseRevision: 0, mutationId: crypto.randomUUID(), operations: diffBoardSnapshots(board, edited) };
    const proposal = await decodeBoardPacket({ metadata: { kind: "propose", sequence: 1, change, assets: [] }, assets: [] });
    expect(proposal).toMatchObject({ kind: "propose", change: { operations: [{ changes: { content: safeMemo } }] } });
});
