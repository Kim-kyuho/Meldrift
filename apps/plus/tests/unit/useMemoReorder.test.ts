import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMemoReorder } from "@/hooks/useMemoReorder";
import type { BoardMemo } from "@/hooks/useBoardMemos";

// 놓는 즉시 화면이 바뀌고, 서버 응답은 그 뒤에 맞춘다. 실패하면 순서만 되돌린다.

const memo = (id: number, sortOrder: number): BoardMemo => ({
    id,
    boardId: 9,
    content: `<p>memo ${id}</p>`,
    x: 0, y: 0, z: 1, width: 300, height: 200,
    color: "#fffadc",
    sortOrder,
});

function createStateSetter(initial: BoardMemo[]) {
    let state = initial;
    const versions = [initial];
    const setter = vi.fn((update: React.SetStateAction<BoardMemo[]>) => {
        state = typeof update === "function" ? update(state) : update;
        versions.push(state);
    });
    return { setter, getState: () => state, versions };
}

const orderOf = (memos: BoardMemo[]) =>
    [...memos].sort((a, b) => a.sortOrder - b.sortOrder).map((item) => item.id);

// 응답을 손에 쥐고 있다가 원할 때 흘려보낸다. 그 사이 화면 상태를 확인하기 위함이다.
function deferredFetch(result: unknown, ok = true) {
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const fetchMock = vi.fn(async () => {
        await held;
        return { ok, json: async () => result } as Response;
    });
    return { fetchMock, release };
}

function setup(memos: BoardMemo[], options: Partial<Parameters<typeof useMemoReorder>[0]> = {}) {
    const state = createStateSetter(memos);
    const setPermissionMessage = vi.fn();
    const { result } = renderHook(() => useMemoReorder({
        boardId: 9,
        memos,
        setMemos: state.setter,
        canEditCard: true,
        showPermissionMessage: vi.fn(),
        setPermissionMessage,
        onFocusMemo: vi.fn(),
        ...options,
    }));
    return { result, state, setPermissionMessage };
}

describe("useMemoReorder 순서 저장", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("서버 응답을 기다리지 않고 화면부터 바꾼다", async () => {
        const memos = [memo(10, 1), memo(20, 2), memo(30, 3)];
        const { fetchMock, release } = deferredFetch({
            ok: true,
            memos: [{ id: 10, sortOrder: 2 }, { id: 20, sortOrder: 3 }, { id: 30, sortOrder: 1 }],
        });
        vi.stubGlobal("fetch", fetchMock);
        const { result, state } = setup(memos);

        let pending!: Promise<unknown>;
        await act(async () => {
            pending = result.current.saveMemoOrder(30, 0);
        });

        // 아직 응답이 오지 않았는데도 화면 순서는 이미 바뀌어 있다.
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(orderOf(state.getState())).toEqual([30, 10, 20]);

        await act(async () => {
            release();
            await pending;
        });

        expect(orderOf(state.getState())).toEqual([30, 10, 20]);
    });

    it("서버가 다른 값을 주면 그 값으로 맞춘다", async () => {
        const memos = [memo(10, 1), memo(20, 2)];
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                ok: true,
                memos: [{ id: 10, sortOrder: 7 }, { id: 20, sortOrder: 3 }],
            }),
        }));
        const { result, state } = setup(memos);

        await act(async () => { await result.current.saveMemoOrder(20, 0); });

        expect(state.getState().map((item) => item.sortOrder)).toEqual([7, 3]);
    });

    it("서버 값이 화면과 같으면 상태를 새로 만들지 않는다", async () => {
        const memos = [memo(10, 1), memo(20, 2)];
        // 서버가 낙관적으로 적용한 값과 똑같이 응답하는, 가장 흔한 경우.
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                ok: true,
                memos: [{ id: 10, sortOrder: 2 }, { id: 20, sortOrder: 1 }],
            }),
        }));
        const { result, state } = setup(memos);

        await act(async () => { await result.current.saveMemoOrder(20, 0); });

        // [처음, 낙관적 적용, 서버 응답] - 뒤의 둘이 같은 배열이어야 리렌더가 한 번으로 끝난다.
        expect(state.versions).toHaveLength(3);
        expect(state.versions[2]).toBe(state.versions[1]);
        expect(orderOf(state.getState())).toEqual([20, 10]);
    });

    it("서버가 거절하면 순서를 되돌리고 이유를 알린다", async () => {
        const memos = [memo(10, 1), memo(20, 2), memo(30, 3)];
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: false,
            json: vi.fn().mockResolvedValue({ ok: false, message: "Denied" }),
        }));
        const { result, state, setPermissionMessage } = setup(memos);

        await act(async () => { await result.current.saveMemoOrder(30, 0); });

        expect(orderOf(state.getState())).toEqual([10, 20, 30]);
        expect(setPermissionMessage).toHaveBeenCalledWith("Denied");
    });

    it("요청이 아예 실패해도 순서를 되돌린다", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const memos = [memo(10, 1), memo(20, 2)];
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
        const { result, state, setPermissionMessage } = setup(memos);

        await act(async () => { await result.current.saveMemoOrder(20, 0); });

        expect(orderOf(state.getState())).toEqual([10, 20]);
        expect(setPermissionMessage).toHaveBeenCalledWith("Memo order could not be updated.");
    });

    it("되돌릴 때 순서 말고 다른 값은 건드리지 않는다", async () => {
        const memos = [memo(10, 1), memo(20, 2)];
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: false,
            json: vi.fn().mockResolvedValue({ ok: false, message: "Denied" }),
        }));
        const { result, state } = setup(memos);

        await act(async () => { await result.current.saveMemoOrder(20, 0); });

        expect(state.getState()).toEqual(memos);
    });
});
