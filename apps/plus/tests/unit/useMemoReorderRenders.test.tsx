import { useEffect, useState } from "react";
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMemoReorder } from "@/hooks/useMemoReorder";
import type { BoardMemo } from "@/hooks/useBoardMemos";

// 순서를 소유한 컴포넌트가 몇 번 그려지는지를 센다.
// 낙관적 적용과 서버 응답을 한 act 안에 두면 React가 한 번에 flush해 구분되지 않으므로,
// 응답을 붙잡아 두고 두 단계를 갈라서 센다.

const memo = (id: number, sortOrder: number): BoardMemo => ({
    id,
    boardId: 9,
    content: `<p>memo ${id}</p>`,
    x: 0, y: 0, z: 1, width: 300, height: 200,
    color: "#fffadc",
    sortOrder,
});

type SaveMemoOrder = (memoId: number, targetIndex: number) => Promise<void>;

// 보드의 카드에 해당한다. 부모가 bail out하면 여기까지는 내려오지 않는다.
function Row({ item, onRowRender }: { item: BoardMemo; onRowRender: () => void }) {
    onRowRender();
    return <li>{item.id}</li>;
}

function Harness({ onRender, onRowRender, publish }: {
    onRender: () => void;
    onRowRender: () => void;
    publish: (save: SaveMemoOrder) => void;
}) {
    const [memos, setMemos] = useState<BoardMemo[]>([memo(10, 1), memo(20, 2), memo(30, 3)]);
    const reorder = useMemoReorder({
        boardId: 9,
        memos,
        setMemos,
        canEditCard: true,
        showPermissionMessage: vi.fn(),
        setPermissionMessage: vi.fn(),
        onFocusMemo: vi.fn(),
    });

    useEffect(() => publish(reorder.saveMemoOrder));
    onRender();

    return (
        <ol>
            {reorder.reorderMemoList.map((item) => (
                <Row key={item.id} item={item} onRowRender={onRowRender} />
            ))}
        </ol>
    );
}

function heldFetch(memos: { id: number; sortOrder: number }[]) {
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    vi.stubGlobal("fetch", vi.fn(async () => {
        await held;
        return { ok: true, json: async () => ({ ok: true, memos }) } as Response;
    }));
    return release;
}

async function countRenders(serverMemos: { id: number; sortOrder: number }[]) {
    const release = heldFetch(serverMemos);
    const onRender = vi.fn();
    const onRowRender = vi.fn();
    let saveMemoOrder!: SaveMemoOrder;
    const { container } = render(
        <Harness
            onRender={onRender}
            onRowRender={onRowRender}
            publish={(save) => { saveMemoOrder = save; }}
        />
    );
    const mounted = onRender.mock.calls.length;
    const mountedRows = onRowRender.mock.calls.length;

    // 1단계: 놓는 순간. 응답은 아직 오지 않았다.
    let pending!: Promise<void>;
    await act(async () => { pending = saveMemoOrder(30, 0); });
    const afterDrop = onRender.mock.calls.length;
    const rowsAfterDrop = onRowRender.mock.calls.length;

    // 2단계: 응답 도착.
    await act(async () => { release(); await pending; });
    const afterResponse = onRender.mock.calls.length;
    const rowsAfterResponse = onRowRender.mock.calls.length;

    return {
        drop: afterDrop - mounted,
        response: afterResponse - afterDrop,
        rowsOnDrop: rowsAfterDrop - mountedRows,
        rowsOnResponse: rowsAfterResponse - rowsAfterDrop,
        text: container.textContent,
    };
}

describe("useMemoReorder 렌더 횟수", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("서버가 같은 값을 주면 놓을 때 한 번만 그리고 끝난다", async () => {
        // 30을 맨 앞으로 옮긴 결과와 같은 값.
        const counts = await countRenders([
            { id: 10, sortOrder: 2 }, { id: 20, sortOrder: 3 }, { id: 30, sortOrder: 1 },
        ]);

        expect(counts.drop).toBe(1);
        expect(counts.rowsOnDrop).toBe(3);
        // 소유 컴포넌트는 한 번 더 돌지만, 값이 같으므로 카드까지는 내려가지 않는다.
        expect(counts.response).toBe(1);
        expect(counts.rowsOnResponse).toBe(0);
        expect(counts.text).toBe("301020");
    });

    it("서버가 다른 값을 주면 그때만 한 번 더 그린다", async () => {
        // 다른 기기에서 순서가 바뀌어 화면의 계산과 어긋난 경우.
        const counts = await countRenders([
            { id: 10, sortOrder: 9 }, { id: 20, sortOrder: 8 }, { id: 30, sortOrder: 7 },
        ]);

        expect(counts.drop).toBe(1);
        expect(counts.rowsOnDrop).toBe(3);
        expect(counts.response).toBe(1);
        expect(counts.rowsOnResponse).toBe(3);
        expect(counts.text).toBe("302010");
    });
});
