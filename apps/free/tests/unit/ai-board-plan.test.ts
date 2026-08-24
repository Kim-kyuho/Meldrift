import { describe, expect, it } from "vitest";
import {
    attachmentOverlap,
    layoutModes,
    boardDeletionSchema,
    boardEditSchema,
    boardPlanSchema,
    estimateMemoHeight,
    getPlanCapacity,
    layoutArrangement,
    layoutBoardPlan,
    maxMemoHeight,
    memoBlocksToHtml,
    memoWidth,
    minMemoHeight,
    planTableToSource,
    type BoardPlan,
    type PlannedBoard,
} from "@/lib/ai/board-plan";

type Rect = { x: number; y: number; width: number; height: number };

// 테스트 기본 보드. Meldrift가 제공하는 가장 큰 보드 크기다.
const largeBoard = { width: 7680, height: 4320 };

// app/api/boards/[boardId]/markdown/route.ts의 SQL 접점 판정과 같은 조건.
// 카드가 꼭짓점을 "엄격히" 포함해야 한다.
const containsCorner = (card: Rect, corner: { x: number; y: number }) =>
    card.x < corner.x &&
    corner.x < card.x + card.width &&
    card.y < corner.y &&
    corner.y < card.y + card.height;

const getMemoCorners = (memo: Rect) => [
    { x: memo.x, y: memo.y },
    { x: memo.x + memo.width, y: memo.y },
    { x: memo.x, y: memo.y + memo.height },
    { x: memo.x + memo.width, y: memo.y + memo.height },
];

const getAttachmentCards = (planned: PlannedBoard): Rect[] => [
    ...planned.mermaids,
    ...planned.tables,
];

describe("memoBlocksToHtml", () => {
    it("converts each block type to TipTap compatible markup", () => {
        const html = memoBlocksToHtml([
            { type: "heading", level: 2, text: "Overview" },
            { type: "paragraph", text: "First line" },
            { type: "bulletList", items: ["a", "b"] },
            { type: "orderedList", items: ["one"] },
            { type: "codeBlock", text: "const a = 1;" },
            { type: "blockquote", text: "quoted" },
        ]);

        expect(html).toContain("<h2>Overview</h2>");
        expect(html).toContain("<p>First line</p>");
        expect(html).toContain("<ul><li><p>a</p></li><li><p>b</p></li></ul>");
        expect(html).toContain("<ol><li><p>one</p></li></ol>");
        expect(html).toContain("<pre><code>const a = 1;</code></pre>");
        expect(html).toContain("<blockquote><p>quoted</p></blockquote>");
    });

    it("escapes model supplied markup so memo rendering cannot inject nodes", () => {
        const html = memoBlocksToHtml([
            { type: "paragraph", text: `<img src=x onerror="alert(1)">` },
            { type: "heading", level: 1, text: "<script>alert(1)</script>" },
            { type: "codeBlock", text: "</code></pre><script>alert(1)</script>" },
        ]);

        expect(html).not.toContain("<img");
        expect(html).not.toContain("<script>");
        expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
        expect(html).toContain("&lt;script&gt;");
    });

    it("keeps line breaks inside a paragraph as hard breaks", () => {
        expect(memoBlocksToHtml([{ type: "paragraph", text: "a\nb" }])).toBe("<p>a<br>b</p>");
    });
});

describe("estimateMemoHeight", () => {
    it("stays within the configured bounds", () => {
        const short = estimateMemoHeight([{ type: "paragraph", text: "hi" }]);
        const huge = estimateMemoHeight([
            { type: "bulletList", items: Array.from({ length: 200 }, () => "a long bullet item text") },
        ]);

        expect(short).toBe(minMemoHeight);
        expect(huge).toBe(maxMemoHeight);
    });

    it("grows vertically as content grows", () => {
        const heights = [1, 5, 15, 30].map((count) =>
            estimateMemoHeight([
                { type: "bulletList", items: Array.from({ length: count }, () => "bullet item") },
            ])
        );

        heights.slice(1).forEach((height, index) => {
            expect(height).toBeGreaterThanOrEqual(heights[index]);
        });
        expect(heights.at(-1)).toBeGreaterThan(heights[0]);
    });

    // 한글은 반각 글자의 두 배 폭을 쓴다. 글자 수만 세면 카드 밖으로 넘친다.
    it("reserves more height for wide characters than for latin text", () => {
        const latin = estimateMemoHeight([{ type: "paragraph", text: "a".repeat(200) }]);
        const korean = estimateMemoHeight([{ type: "paragraph", text: "가".repeat(200) }]);

        expect(korean).toBeGreaterThan(latin);
    });

    it("counts explicit line breaks as separate lines", () => {
        const single = estimateMemoHeight([{ type: "paragraph", text: "one line" }]);
        const multi = estimateMemoHeight([{ type: "paragraph", text: "a\nb\nc\nd\ne\nf\ng\nh" }]);

        expect(multi).toBeGreaterThan(single);
    });

    it("gives headings more height than a paragraph of the same text", () => {
        const paragraph = estimateMemoHeight([{ type: "paragraph", text: "제목으로 쓸 문장" }]);
        const heading = estimateMemoHeight([{ type: "heading", level: 1, text: "제목으로 쓸 문장" }]);

        expect(heading).toBeGreaterThanOrEqual(paragraph);
    });
});

describe("memo card sizing", () => {
    it("keeps memo width at the 400 maximum", () => {
        expect(memoWidth).toBe(400);
    });

    it("allows memos to grow well past the old fixed height", () => {
        expect(maxMemoHeight).toBeGreaterThan(minMemoHeight * 2);
    });
});

describe("planTableToSource", () => {
    it("maps rows onto generated column ids and pads missing cells", () => {
        const source = planTableToSource(["Name", "Role"], [["Kyu", "Owner"], ["Solo"]]);

        expect(source.columns.map((column) => column.name)).toEqual(["Name", "Role"]);
        expect(source.rows).toHaveLength(2);

        const [nameColumn, roleColumn] = source.columns;
        expect(source.rows[0].cells[nameColumn.id]).toBe("Kyu");
        expect(source.rows[0].cells[roleColumn.id]).toBe("Owner");
        expect(source.rows[1].cells[roleColumn.id]).toBe("");
    });

    it("gives every column and row a distinct id", () => {
        const source = planTableToSource(["A", "B"], [["1", "2"], ["3", "4"]]);
        const ids = [...source.columns.map((c) => c.id), ...source.rows.map((r) => r.id)];

        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe("layoutBoardPlan", () => {
    const plan: BoardPlan = {
        sections: [
            {
                blocks: [{ type: "heading", level: 1, text: "Architecture" }],
                attachment: { type: "mermaid", source: "flowchart LR\nA-->B" },
            },
            {
                blocks: [{ type: "paragraph", text: "No attachment here" }],
            },
            {
                blocks: [{ type: "paragraph", text: "Comparison" }],
                attachment: { type: "table", columns: ["Option", "Cost"], rows: [["A", "low"]] },
            },
            {
                blocks: [{ type: "bulletList", items: ["one", "two", "three"] }],
                attachment: { type: "mermaid", source: "sequenceDiagram\nA->>B: hi" },
            },
        ],
    };

    it("creates one memo per section in order", () => {
        const planned = layoutBoardPlan(plan, { x: 0, y: 0 }, largeBoard);

        expect(planned.memos).toHaveLength(4);
        expect(planned.mermaids).toHaveLength(2);
        expect(planned.tables).toHaveLength(1);
        expect(planned.memos[0].content).toContain("Architecture");
    });

    it("never places a card at a negative coordinate", () => {
        const planned = layoutBoardPlan(plan, { x: 0, y: 0 }, largeBoard);

        [...planned.memos, ...getAttachmentCards(planned)].forEach((card) => {
            expect(card.x).toBeGreaterThanOrEqual(0);
            expect(card.y).toBeGreaterThanOrEqual(0);
        });
    });

    it("stacks memos in a single column with increasing y", () => {
        const planned = layoutBoardPlan(plan, { x: 40, y: 60 }, largeBoard);

        planned.memos.forEach((memo) => expect(memo.x).toBe(40));
        planned.memos.slice(1).forEach((memo, index) => {
            expect(memo.y).toBeGreaterThan(planned.memos[index].y + planned.memos[index].height);
        });
    });

    it("attaches each card to exactly one memo, at that memo's top-right corner", () => {
        const planned = layoutBoardPlan(plan, { x: 0, y: 0 }, largeBoard);
        // 첨부가 있는 섹션의 인덱스와, 배치된 카드 순서를 맞춰 확인한다.
        const attachedMemoIndexes = [0, 2, 3];
        const cards = [planned.mermaids[0], planned.tables[0], planned.mermaids[1]];

        cards.forEach((card, index) => {
            const ownerIndex = attachedMemoIndexes[index];

            planned.memos.forEach((memo, memoIndex) => {
                const matchedCorners = getMemoCorners(memo).filter((corner) =>
                    containsCorner(card, corner)
                );

                if (memoIndex === ownerIndex) {
                    // 자기 메모의 오른쪽 위 꼭짓점은 반드시 포함해야 한다.
                    expect(matchedCorners).toContainEqual({ x: memo.x + memo.width, y: memo.y });
                } else {
                    // 다른 메모의 꼭짓점은 절대 건드리면 안 된다 — 문서 순서가 어긋난다.
                    expect(matchedCorners).toEqual([]);
                }
            });
        });
    });

    it("keeps the overlap smaller than every card dimension so containment is strict", () => {
        const planned = layoutBoardPlan(plan, { x: 0, y: 0 }, largeBoard);

        getAttachmentCards(planned).forEach((card) => {
            expect(card.width).toBeGreaterThan(attachmentOverlap);
            expect(card.height).toBeGreaterThan(attachmentOverlap);
        });
    });

    it("leaves sections without an attachment unattached", () => {
        const planned = layoutBoardPlan(plan, { x: 0, y: 0 }, largeBoard);
        const unattachedMemo = planned.memos[1];

        getAttachmentCards(planned).forEach((card) => {
            getMemoCorners(unattachedMemo).forEach((corner) => {
                expect(containsCorner(card, corner)).toBe(false);
            });
        });
    });

    it("holds the corner contract for a plan where every section has an attachment", () => {
        const densePlan: BoardPlan = {
            sections: Array.from({ length: 12 }, (_, index) => ({
                blocks: [{ type: "paragraph" as const, text: `section ${index}` }],
                attachment:
                    index % 2 === 0
                        ? { type: "mermaid" as const, source: "flowchart LR\nA-->B" }
                        : { type: "table" as const, columns: ["a"], rows: [["1"]] },
            })),
        };
        const planned = layoutBoardPlan(densePlan, { x: 0, y: 0 }, largeBoard);
        const cards = getAttachmentCards(planned);

        // 카드 하나가 정확히 메모 하나에만 걸리는지 전수 확인한다.
        cards.forEach((card) => {
            const owners = planned.memos.filter((memo) =>
                getMemoCorners(memo).some((corner) => containsCorner(card, corner))
            );

            expect(owners).toHaveLength(1);
        });
    });

    it("uses the memo width constant for every memo", () => {
        const planned = layoutBoardPlan(plan, { x: 0, y: 0 }, largeBoard);

        planned.memos.forEach((memo) => expect(memo.width).toBe(memoWidth));
    });
});

describe("boardPlanSchema", () => {
    it("rejects a plan with no sections", () => {
        expect(boardPlanSchema.safeParse({ sections: [] }).success).toBe(false);
    });

    it("rejects a memo colour outside the allowed palette", () => {
        const result = boardPlanSchema.safeParse({
            sections: [{ blocks: [{ type: "paragraph", text: "x" }], color: "#000000" }],
        });

        expect(result.success).toBe(false);
    });

    it("rejects a heading level outside 1-6", () => {
        const result = boardPlanSchema.safeParse({
            sections: [{ blocks: [{ type: "heading", level: 7, text: "x" }] }],
        });

        expect(result.success).toBe(false);
    });

    it("accepts a minimal valid plan", () => {
        const result = boardPlanSchema.safeParse({
            sections: [{ blocks: [{ type: "paragraph", text: "hello" }] }],
        });

        expect(result.success).toBe(true);
    });
});

// 실제로 보드 밖에 카드가 배치되는 버그가 있었다. 아래 테스트가 그 회귀를 막는다.
describe("layoutBoardPlan board bounds", () => {
    const smallBoard = { width: 3840, height: 2160 };

    const makePlan = (count: number): BoardPlan => ({
        sections: Array.from({ length: count }, (_, index) => ({
            blocks: [{ type: "paragraph" as const, text: `section ${index}` }],
            attachment: { type: "table" as const, columns: ["a", "b"], rows: [["1", "2"]] },
        })),
    });

    const allCards = (planned: PlannedBoard): Rect[] => [
        ...planned.memos,
        ...planned.mermaids,
        ...planned.tables,
    ];

    it("keeps every card inside the board for a plan that cannot fit in one column", () => {
        const planned = layoutBoardPlan(makePlan(12), { x: 0, y: 0 }, smallBoard);

        expect(planned.memos.length).toBeGreaterThan(0);
        allCards(planned).forEach((card) => {
            expect(card.x).toBeGreaterThanOrEqual(0);
            expect(card.y).toBeGreaterThanOrEqual(0);
            expect(card.x + card.width).toBeLessThanOrEqual(smallBoard.width);
            expect(card.y + card.height).toBeLessThanOrEqual(smallBoard.height);
        });
    });

    it("wraps into additional columns instead of running off the bottom", () => {
        const planned = layoutBoardPlan(makePlan(8), { x: 0, y: 0 }, smallBoard);
        const columns = new Set(planned.memos.map((memo) => memo.x));

        expect(columns.size).toBeGreaterThan(1);
    });

    it("still attaches each card to exactly one memo after wrapping", () => {
        const planned = layoutBoardPlan(makePlan(10), { x: 0, y: 0 }, smallBoard);

        planned.tables.forEach((card) => {
            const owners = planned.memos.filter((memo) =>
                getMemoCorners(memo).some((corner) => containsCorner(card, corner))
            );

            expect(owners).toHaveLength(1);
        });
    });

    it("clamps an origin that points outside the board back inside", () => {
        const planned = layoutBoardPlan(makePlan(2), { x: 99999, y: 99999 }, smallBoard);

        allCards(planned).forEach((card) => {
            expect(card.x + card.width).toBeLessThanOrEqual(smallBoard.width);
            expect(card.y + card.height).toBeLessThanOrEqual(smallBoard.height);
        });
    });

    it("reports sections it could not place instead of drawing them off board", () => {
        const tinyBoard = { width: 1200, height: 900 };
        const planned = layoutBoardPlan(makePlan(20), { x: 0, y: 0 }, tinyBoard);

        expect(planned.droppedSections).toBeGreaterThan(0);
        expect(planned.memos.length + planned.droppedSections).toBe(20);
        allCards(planned).forEach((card) => {
            expect(card.x + card.width).toBeLessThanOrEqual(tinyBoard.width);
            expect(card.y + card.height).toBeLessThanOrEqual(tinyBoard.height);
        });
    });

    it("drops everything when the board is too small for a single card", () => {
        const planned = layoutBoardPlan(makePlan(3), { x: 0, y: 0 }, { width: 200, height: 200 });

        expect(planned.memos).toHaveLength(0);
        expect(planned.droppedSections).toBe(3);
    });
});

describe("getPlanCapacity", () => {
    it("reports more capacity for a bigger board", () => {
        expect(getPlanCapacity({ width: 7680, height: 4320 })).toBeGreaterThan(
            getPlanCapacity({ width: 3840, height: 2160 })
        );
    });

    it("reports zero for a board that cannot hold a section", () => {
        expect(getPlanCapacity({ width: 200, height: 200 })).toBe(0);
    });
});

describe("layoutArrangement", () => {
    const bounds = { width: 3840, height: 2160 };
    const existing = {
        memos: [
            { id: 1, width: 300, height: 200 },
            { id: 2, width: 300, height: 240 },
            { id: 3, width: 300, height: 200 },
        ],
        mermaids: [{ id: 10, width: 480, height: 360 }],
        tables: [{ id: 20, width: 560, height: 360 }],
    };

    it("moves the referenced cards and keeps the corner contract", () => {
        const arranged = layoutArrangement(
            {
                sections: [
                    { memoId: 2, attachment: { type: "table", cardId: 20 } },
                    { memoId: 1, attachment: { type: "mermaid", cardId: 10 } },
                    { memoId: 3 },
                ],
            },
            existing,
            { x: 40, y: 40 },
            bounds
        );

        expect(arranged.memos.map((memo) => memo.id)).toEqual([2, 1, 3]);
        expect(arranged.tables).toHaveLength(1);
        expect(arranged.mermaids).toHaveLength(1);

        const memoRect = (id: number) => {
            const move = arranged.memos.find((memo) => memo.id === id)!;
            const size = existing.memos.find((memo) => memo.id === id)!;
            return { ...move, width: size.width, height: size.height };
        };
        const tableRect = { ...arranged.tables[0], width: 560, height: 360 };

        // 표는 자기 메모(2번)의 오른쪽 위 꼭짓점만 물어야 한다.
        expect(containsCorner(tableRect, { x: memoRect(2).x + 300, y: memoRect(2).y })).toBe(true);
        [1, 3].forEach((id) => {
            getMemoCorners(memoRect(id)).forEach((corner) => {
                expect(containsCorner(tableRect, corner)).toBe(false);
            });
        });
    });

    it("ignores unknown and duplicated ids", () => {
        const arranged = layoutArrangement(
            {
                sections: [
                    { memoId: 1 },
                    { memoId: 1 },
                    { memoId: 999 },
                    { memoId: 2, attachment: { type: "table", cardId: 999 } },
                ],
            },
            existing,
            { x: 40, y: 40 },
            bounds
        );

        expect(arranged.memos.map((memo) => memo.id)).toEqual([1, 2]);
        expect(arranged.tables).toHaveLength(0);
    });

    it("keeps arranged cards inside the board", () => {
        const many = {
            memos: Array.from({ length: 12 }, (_, index) => ({ id: index + 1, width: 300, height: 200 })),
            mermaids: [],
            tables: [],
        };
        const arranged = layoutArrangement(
            { sections: many.memos.map((memo) => ({ memoId: memo.id })) },
            many,
            { x: 40, y: 40 },
            bounds
        );

        arranged.memos.forEach((move) => {
            expect(move.x).toBeGreaterThanOrEqual(0);
            expect(move.y).toBeGreaterThanOrEqual(0);
            expect(move.x + 300).toBeLessThanOrEqual(bounds.width);
            expect(move.y + 200).toBeLessThanOrEqual(bounds.height);
        });
    });
});

describe("layout modes", () => {
    const board = { width: 7680, height: 4320 };

    const makePlan = (count: number, extra: Partial<BoardPlan> = {}, withParents = false): BoardPlan => ({
        sections: Array.from({ length: count }, (_, index) => ({
            blocks: [{ type: "paragraph" as const, text: `section ${index}` }],
            // 첨부를 섞어야 폭이 다른 카드까지 검증된다.
            attachment:
                index % 3 === 0
                    ? { type: "table" as const, columns: ["a", "b"], rows: [["1", "2"]] }
                    : index % 3 === 1
                        ? { type: "mermaid" as const, source: "flowchart LR\nA-->B" }
                        : undefined,
            ...(withParents && index > 0 ? { parentIndex: Math.floor((index - 1) / 2) } : {}),
        })),
        ...extra,
    });

    const allCards = (planned: PlannedBoard): Rect[] => [
        ...planned.memos,
        ...planned.mermaids,
        ...planned.tables,
    ];

    // 어떤 배치를 써도 아래 두 가지는 반드시 지켜져야 한다.
    const expectContract = (planned: PlannedBoard) => {
        allCards(planned).forEach((card) => {
            expect(card.x).toBeGreaterThanOrEqual(0);
            expect(card.y).toBeGreaterThanOrEqual(0);
            expect(card.x + card.width).toBeLessThanOrEqual(board.width);
            expect(card.y + card.height).toBeLessThanOrEqual(board.height);
        });

        getAttachmentCards(planned).forEach((card) => {
            const owners = planned.memos.filter((memo) =>
                getMemoCorners(memo).some((corner) => containsCorner(card, corner))
            );

            expect(owners).toHaveLength(1);
        });
    };

    layoutModes.forEach((layout) => {
        it(`keeps every card in bounds and attached to one memo (${layout})`, () => {
            const planned = layoutBoardPlan(
                makePlan(12, { layout }, layout === "tree"),
                { x: 0, y: 0 },
                board
            );

            expect(planned.memos.length).toBeGreaterThan(0);
            expectContract(planned);
        });
    });

    it("flows grid sections left to right before wrapping down", () => {
        const planned = layoutBoardPlan(makePlan(6, { layout: "grid" }), { x: 0, y: 0 }, board);

        expect(planned.memos[1].x).toBeGreaterThan(planned.memos[0].x);
        expect(planned.memos[1].y).toBe(planned.memos[0].y);
    });

    it("wraps a grid down when the row is full", () => {
        const narrowBoard = { width: 2200, height: 4320 };
        const planned = layoutBoardPlan(makePlan(6, { layout: "grid" }), { x: 0, y: 0 }, narrowBoard);
        const rows = new Set(planned.memos.map((memo) => memo.y));

        expect(rows.size).toBeGreaterThan(1);
    });

    it("puts tree children to the right of their parent", () => {
        const plan: BoardPlan = {
            layout: "tree",
            sections: [
                { blocks: [{ type: "heading", level: 1, text: "root" }] },
                { blocks: [{ type: "paragraph", text: "child a" }], parentIndex: 0 },
                { blocks: [{ type: "paragraph", text: "child b" }], parentIndex: 0 },
                { blocks: [{ type: "paragraph", text: "grandchild" }], parentIndex: 1 },
            ],
        };
        const planned = layoutBoardPlan(plan, { x: 0, y: 0 }, board);
        const [root, childA, childB, grandchild] = planned.memos;

        expect(childA.x).toBeGreaterThan(root.x);
        expect(childB.x).toBe(childA.x);
        expect(grandchild.x).toBeGreaterThan(childA.x);
        // 형제는 세로로 분리된다.
        expect(childB.y).toBeGreaterThanOrEqual(childA.y + childA.height);
    });

    it("uses less vertical space for a tree than for a single column", () => {
        const bottom = (planned: PlannedBoard) =>
            Math.max(...planned.memos.map((memo) => memo.y + memo.height));

        const tree = layoutBoardPlan(makePlan(9, { layout: "tree" }, true), { x: 0, y: 0 }, board);
        const column = layoutBoardPlan(makePlan(9, { layout: "column" }), { x: 0, y: 0 }, board);

        expect(bottom(tree)).toBeLessThan(bottom(column));
    });

    it("treats a forward or self parentIndex as a root instead of looping", () => {
        const plan: BoardPlan = {
            layout: "tree",
            sections: [
                { blocks: [{ type: "paragraph", text: "a" }], parentIndex: 2 },
                { blocks: [{ type: "paragraph", text: "b" }], parentIndex: 1 },
                { blocks: [{ type: "paragraph", text: "c" }], parentIndex: 0 },
            ],
        };
        const planned = layoutBoardPlan(plan, { x: 0, y: 0 }, board);

        expect(planned.memos).toHaveLength(3);
        expectContract(planned);
    });

    it("defaults to column when no layout is given", () => {
        const planned = layoutBoardPlan(makePlan(4), { x: 40, y: 40 }, board);

        expect(new Set(planned.memos.map((memo) => memo.x)).size).toBe(1);
    });

    it("keeps the contract for an arranged tree of existing cards", () => {
        const existing = {
            memos: Array.from({ length: 7 }, (_, index) => ({ id: index + 1, width: 300, height: 200 })),
            mermaids: [{ id: 100, width: 480, height: 360 }],
            tables: [{ id: 200, width: 560, height: 360 }],
        };
        const arranged = layoutArrangement(
            {
                layout: "tree",
                sections: [
                    { memoId: 1 },
                    { memoId: 2, parentIndex: 0, attachment: { type: "table", cardId: 200 } },
                    { memoId: 3, parentIndex: 0, attachment: { type: "mermaid", cardId: 100 } },
                    { memoId: 4, parentIndex: 1 },
                    { memoId: 5, parentIndex: 1 },
                    { memoId: 6, parentIndex: 2 },
                    { memoId: 7, parentIndex: 2 },
                ],
            },
            existing,
            { x: 40, y: 40 },
            board
        );

        expect(arranged.memos).toHaveLength(7);

        const memoRect = (id: number) => {
            const move = arranged.memos.find((memo) => memo.id === id)!;
            return { ...move, width: 300, height: 200 };
        };
        const tableRect = { ...arranged.tables[0], width: 560, height: 360 };
        const mermaidRect = { ...arranged.mermaids[0], width: 480, height: 360 };

        [tableRect, mermaidRect].forEach((card) => {
            const owners = existing.memos.filter((memo) =>
                getMemoCorners(memoRect(memo.id)).some((corner) => containsCorner(card, corner))
            );

            expect(owners).toHaveLength(1);
        });
    });
});

describe("boardEditSchema", () => {
    it("accepts partial memo edits", () => {
        expect(
            boardEditSchema.safeParse({ memos: [{ id: 3, color: "#e0f2fe" }] }).success
        ).toBe(true);
        expect(
            boardEditSchema.safeParse({
                memos: [{ id: 3, blocks: [{ type: "paragraph", text: "new" }] }],
            }).success
        ).toBe(true);
    });

    it("accepts an empty object because every card type is optional", () => {
        expect(boardEditSchema.safeParse({}).success).toBe(true);
    });

    // 임시 카드(음수 ID)는 아직 서버에 없으므로 고칠 대상이 될 수 없다.
    it("rejects non-positive card ids", () => {
        expect(boardEditSchema.safeParse({ memos: [{ id: -1, color: "#e0f2fe" }] }).success).toBe(false);
        expect(boardEditSchema.safeParse({ mermaids: [{ id: 0, source: "x" }] }).success).toBe(false);
    });

    it("rejects a colour outside the palette", () => {
        expect(boardEditSchema.safeParse({ memos: [{ id: 1, color: "#123456" }] }).success).toBe(false);
    });

    it("rejects an empty mermaid source", () => {
        expect(boardEditSchema.safeParse({ mermaids: [{ id: 1, source: "" }] }).success).toBe(false);
    });
});

describe("boardDeletionSchema", () => {
    it("accepts id lists for every card type", () => {
        const result = boardDeletionSchema.safeParse({
            memoIds: [1, 2],
            mermaidIds: [3],
            tableIds: [4],
            imageIds: [5],
        });

        expect(result.success).toBe(true);
    });

    it("rejects non-positive ids so temporary cards cannot be targeted", () => {
        expect(boardDeletionSchema.safeParse({ memoIds: [-1] }).success).toBe(false);
        expect(boardDeletionSchema.safeParse({ tableIds: [0] }).success).toBe(false);
    });
});

describe("scatter layout", () => {
    // 시드 고정 PRNG. 무작위 배치라도 테스트는 재현 가능해야 한다.
    const mulberry32 = (seed: number) => () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = seed;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const overlaps = (a: Rect, b: Rect) =>
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

    const scatterPlan = (count: number): BoardPlan => ({
        layout: "scatter",
        sections: Array.from({ length: count }, (_, index) => ({
            blocks: [{ type: "paragraph" as const, text: `아이디어 ${index} 내용을 조금 더 길게 적어본다` }],
            attachment:
                index % 3 === 0
                    ? { type: "mermaid" as const, source: "flowchart LR\nA-->B" }
                    : index % 3 === 1
                      ? { type: "table" as const, columns: ["a", "b"], rows: [["1", "2"]] }
                      : undefined,
        })),
    });

    it("is accepted as a layout mode", () => {
        expect(boardPlanSchema.safeParse(scatterPlan(3)).success).toBe(true);
    });

    it("produces different coordinates for different seeds", () => {
        const a = layoutBoardPlan(scatterPlan(6), { x: 0, y: 0 }, largeBoard, mulberry32(1));
        const b = layoutBoardPlan(scatterPlan(6), { x: 0, y: 0 }, largeBoard, mulberry32(999));

        expect(a.memos.map((m) => [m.x, m.y])).not.toEqual(b.memos.map((m) => [m.x, m.y]));
    });

    it("is deterministic for the same seed", () => {
        const a = layoutBoardPlan(scatterPlan(6), { x: 0, y: 0 }, largeBoard, mulberry32(7));
        const b = layoutBoardPlan(scatterPlan(6), { x: 0, y: 0 }, largeBoard, mulberry32(7));

        expect(a.memos).toEqual(b.memos);
    });

    // 핵심 불변식 3개를 여러 시드에서 전수 확인한다.
    it("never overlaps memos, never crosses corners, never leaves the board", () => {
        for (let seed = 0; seed < 60; seed += 1) {
            const planned = layoutBoardPlan(scatterPlan(12), { x: 0, y: 0 }, largeBoard, mulberry32(seed));
            const cards = getAttachmentCards(planned);

            // 1) 메모끼리 겹치지 않는다.
            planned.memos.forEach((memo, index) => {
                planned.memos.slice(index + 1).forEach((other) => {
                    expect(overlaps(memo, other)).toBe(false);
                });
            });

            // 2) 첨부 카드는 정확히 메모 하나에만 걸린다.
            cards.forEach((card) => {
                const owners = planned.memos.filter((memo) =>
                    getMemoCorners(memo).some((corner) => containsCorner(card, corner))
                );

                expect(owners).toHaveLength(1);
            });

            // 3) 모든 카드가 보드 안에 있다.
            [...planned.memos, ...cards].forEach((card) => {
                expect(card.x).toBeGreaterThanOrEqual(0);
                expect(card.y).toBeGreaterThanOrEqual(0);
                expect(card.x + card.width).toBeLessThanOrEqual(largeBoard.width);
                expect(card.y + card.height).toBeLessThanOrEqual(largeBoard.height);
            });
        }
    });

    it("also keeps attachment cards from overlapping each other", () => {
        for (let seed = 0; seed < 30; seed += 1) {
            const planned = layoutBoardPlan(scatterPlan(12), { x: 0, y: 0 }, largeBoard, mulberry32(seed));
            const cards = getAttachmentCards(planned);

            cards.forEach((card, index) => {
                cards.slice(index + 1).forEach((other) => {
                    expect(overlaps(card, other)).toBe(false);
                });
            });
        }
    });

    // 격자에 지터만 주면 행·열이 남아 "삐뚤어진 그리드"가 된다. 좌표가 실제로 흩어져야 한다.
    it("does not line cards up in rows or columns", () => {
        const gridded = layoutBoardPlan({ ...scatterPlan(12), layout: "grid" }, { x: 0, y: 0 }, largeBoard);
        const scattered = layoutBoardPlan(scatterPlan(12), { x: 0, y: 0 }, largeBoard, mulberry32(5));

        const distinct = (values: number[]) => new Set(values).size;

        // grid는 같은 x·y 값이 반복된다. scatter는 거의 모두 달라야 한다.
        expect(distinct(gridded.memos.map((m) => m.y))).toBeLessThan(gridded.memos.length);
        expect(distinct(scattered.memos.map((m) => m.x))).toBe(scattered.memos.length);
        expect(distinct(scattered.memos.map((m) => m.y))).toBe(scattered.memos.length);
    });

    // 카드 순서와 화면 위치의 상관이 끊겨야 진짜 랜덤이다.
    it("breaks the left-to-right relationship between order and position", () => {
        let monotonicRuns = 0;
        const seeds = 40;

        for (let seed = 0; seed < seeds; seed += 1) {
            const planned = layoutBoardPlan(scatterPlan(10), { x: 0, y: 0 }, largeBoard, mulberry32(seed));
            const xs = planned.memos.map((memo) => memo.x);
            const ascending = xs.every((x, index) => index === 0 || x >= xs[index - 1]);

            if (ascending) {
                monotonicRuns += 1;
            }
        }

        // 좌→우 순서대로 놓이는 배치가 대다수면 랜덤이 아니다.
        expect(monotonicRuns).toBeLessThan(seeds / 4);
    });

    it("spreads cards across the whole board, not just one band", () => {
        const planned = layoutBoardPlan(scatterPlan(16), { x: 0, y: 0 }, largeBoard, mulberry32(11));
        const xs = planned.memos.map((memo) => memo.x);
        const ys = planned.memos.map((memo) => memo.y);

        // 한 열/한 행에만 몰려 있지 않은지 본다.
        expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(largeBoard.width / 4);
        expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(largeBoard.height / 4);
    });

    it("still holds the invariants on a board that is nearly full", () => {
        const smallBoard = { width: 1920, height: 1080 };
        const planned = layoutBoardPlan(scatterPlan(24), { x: 0, y: 0 }, smallBoard, mulberry32(42));

        planned.memos.forEach((memo, index) => {
            planned.memos.slice(index + 1).forEach((other) => {
                expect(overlaps(memo, other)).toBe(false);
            });
        });
        [...planned.memos, ...getAttachmentCards(planned)].forEach((card) => {
            expect(card.x + card.width).toBeLessThanOrEqual(smallBoard.width);
            expect(card.y + card.height).toBeLessThanOrEqual(smallBoard.height);
        });
    });
});
