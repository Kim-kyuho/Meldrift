import { describe, expect, it } from "vitest";
import { compileBoardMarkdown } from "@meldrift/board-data/board-markdown";
import { createEmptyBoardSnapshot, type BoardMemo, type BoardSnapshot } from "@/lib/board-state";

// 문서 순서는 메모의 sortOrder다. 배열 순서(생성 순서)나 좌표가 아니다.

const memo = (id: number, sortOrder: number, text: string): BoardMemo => ({
    id,
    syncId: `memo-${id}`,
    boardId: 1,
    content: `<p>${text}</p>`,
    // 좌표를 순서와 반대로 흩어 놓아, 배치가 문서 순서에 끼어들지 않는지도 함께 본다.
    x: 1000 - id * 100,
    y: 1000 - id * 100,
    z: 1,
    width: 100,
    height: 100,
    color: "#fffadc",
    sortOrder,
});

const snapshotOf = (memos: BoardMemo[]): BoardSnapshot => ({
    ...createEmptyBoardSnapshot(),
    memos,
});

describe("compileBoardMarkdown 문서 순서", () => {
    it("생성 순서가 아니라 메모 순서대로 이어 붙인다", () => {
        const markdown = compileBoardMarkdown(snapshotOf([
            memo(1, 3, "Third"),
            memo(2, 1, "First"),
            memo(3, 2, "Second"),
        ]));

        expect(markdown).toBe("First\n\nSecond\n\nThird");
    });

    it("순서를 바꾸지 않은 보드에서는 생성 순서와 같다", () => {
        const markdown = compileBoardMarkdown(snapshotOf([
            memo(1, 1, "First"),
            memo(2, 2, "Second"),
            memo(3, 3, "Third"),
        ]));

        expect(markdown).toBe("First\n\nSecond\n\nThird");
    });

    it("순서 값이 같으면 id로 가른다", () => {
        const markdown = compileBoardMarkdown(snapshotOf([
            memo(9, 1, "Ninth"),
            memo(4, 1, "Fourth"),
        ]));

        expect(markdown).toBe("Fourth\n\nNinth");
    });

    it("메모와 겹치지 않아도 꼭짓점 중심 반경 50px 안쪽의 카드를 연결하고, 가장 높은 z 카드를 고른다", () => {
        // 메모: (100, 100) ~ (200, 200), 오른쪽 위 꼭짓점은 (200, 100)
        const targetMemo: BoardMemo = {
            id: 1,
            syncId: "memo-1",
            boardId: 1,
            content: "<p>Memo</p>",
            x: 100,
            y: 100,
            z: 1,
            width: 100,
            height: 100,
            color: "#fffadc",
            sortOrder: 1,
        };
        const snapshot: BoardSnapshot = {
            ...createEmptyBoardSnapshot(),
            memos: [targetMemo],
            mermaids: [
                // 오른쪽 위 꼭짓점(200, 100)에서 가로 30px, 세로 40px 떨어진 카드 (거리 = 50px, z = 2)
                {
                    id: 1,
                    syncId: "mermaid-1",
                    boardId: 1,
                    source: "flowchart LR\nLowerZ-->B",
                    x: 230,
                    y: 140,
                    z: 2,
                    width: 100,
                    height: 100,
                },
                // 같은 꼭짓점 반경 50px 안쪽이지만 z가 더 높은 카드 (거리 = 20px, z = 5)
                {
                    id: 2,
                    syncId: "mermaid-2",
                    boardId: 1,
                    source: "flowchart LR\nHigherZ-->B",
                    x: 220,
                    y: 100,
                    z: 5,
                    width: 100,
                    height: 100,
                },
                // 왼쪽 위 꼭짓점(100, 100)에서 51px 떨어진 카드 (연결되지 않아야 함)
                {
                    id: 3,
                    syncId: "mermaid-3",
                    boardId: 1,
                    source: "flowchart LR\nTooFar-->B",
                    x: 0,
                    y: 0,
                    z: 10,
                    width: 49,
                    height: 100,
                },
            ],
        };

        const markdown = compileBoardMarkdown(snapshot);

        expect(markdown).toBe("Memo\n\n```mermaid\nflowchart LR\nHigherZ-->B\n```");
    });
});
