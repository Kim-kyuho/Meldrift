import { describe, expect, it } from "vitest";
import { doCardRectsOverlap, resolveMemoCornerLinks } from "@meldrift/core/cards";
import { buildBoardDocumentSections, compileBoardMarkdown } from "../src/board-markdown";
import {
    applyLinearDraftToSnapshot,
    createDraftImageAttachment,
    createDraftMemoSection,
    createDraftMermaidAttachment,
    createDraftTableAttachment,
    createEmptyLinearDraft,
    isLinearDraftDirty,
    reorderDraftMemoSections,
    updateDraftImageLabel,
    updateDraftMemoHtml,
    updateDraftMermaidSource,
    updateDraftTableSource,
} from "../src/board-markdown-draft";
import { createEmptyBoardSnapshot, type BoardSnapshot } from "../src/board-state";

function makeSnapshot(): BoardSnapshot {
    return {
        ...createEmptyBoardSnapshot(),
        memos: [
            {
                id: 1, syncId: "memo-1", boardId: 1, content: "<h1>First</h1>",
                color: "#fffadc", sortOrder: 1, x: 80, y: 80, z: 1, width: 400, height: 200,
            },
            {
                id: 2, syncId: "memo-2", boardId: 1, content: "<h2>Second</h2>",
                color: "#fffadc", sortOrder: 2, x: 80, y: 400, z: 2, width: 400, height: 200,
            },
        ],
        tables: [
            {
                id: 10, syncId: "table-10", boardId: 1,
                x: 500, y: 80, z: 3, width: 360, height: 180,
                source: {
                    columns: [{ id: "c1", name: "Task" }],
                    rows: [{ id: "r1", cells: { c1: "Draft" } }],
                },
            },
            {
                id: 11, syncId: "table-unlinked", boardId: 1,
                x: 3000, y: 3000, z: 4, width: 360, height: 180,
                source: {
                    columns: [{ id: "c1", name: "Orphan" }],
                    rows: [{ id: "r1", cells: { c1: "Far away" } }],
                },
            },
        ],
        mermaids: [
            {
                id: 20, syncId: "mermaid-20", boardId: 1,
                x: 500, y: 400, z: 5, width: 480, height: 360,
                source: "flowchart LR\n  A --> B",
            },
        ],
        images: [
            {
                imageId: 30, syncId: "image-30", assetId: "asset-30", boardId: 1,
                url: "https://example.com/pic.png", data: null, mimeType: null,
                label: "Original", x: 500, y: 270, z: 6, width: 200, height: 120,
            },
        ],
    };
}

describe("buildBoardDocumentSections", () => {
    it("메모 순서와 50px 꼭짓점 첨부 카드를 섹션 트리로 구성하고 미연결 카드 수를 센다", () => {
        const snapshot = makeSnapshot();
        const { sections, unlinkedCardCount } = buildBoardDocumentSections(snapshot);

        expect(sections).toHaveLength(2);
        expect(sections[0].memoId).toBe(1);
        expect(sections[0].attachments.map((a) => `${a.kind}:${a.id}`)).toEqual(["table:10", "image:30"]);
        expect(sections[1].memoId).toBe(2);
        expect(sections[1].attachments.map((a) => `${a.kind}:${a.id}`)).toEqual(["mermaid:20"]);
        expect(unlinkedCardCount).toBe(1);
    });
});

describe("board-markdown-draft", () => {
    it("메모·표·Mermaid·이미지 캡션 수정과 원복 시 dirty 상태를 정확히 추적한다", () => {
        const snapshot = makeSnapshot();
        let draft = createEmptyLinearDraft();
        expect(isLinearDraftDirty(snapshot, draft)).toBe(false);

        draft = updateDraftMemoHtml(snapshot, draft, 1, "<h1>Updated</h1>");
        expect(isLinearDraftDirty(snapshot, draft)).toBe(true);

        // 원래 값으로 되돌리면 dirty 해제
        draft = updateDraftMemoHtml(snapshot, draft, 1, "<h1>First</h1>");
        expect(isLinearDraftDirty(snapshot, draft)).toBe(false);

        // 4종 카드 동시 수정 + 표 행 증가 시 최소 높이 확장 확인
        const grownTable = {
            columns: [{ id: "c1", name: "Task" }],
            rows: Array.from({ length: 12 }, (_, idx) => ({ id: `r-${idx}`, cells: { c1: `Item ${idx}` } })),
        };
        draft = updateDraftMemoHtml(snapshot, draft, 1, "<h1>Edited</h1>");
        draft = updateDraftTableSource(snapshot, draft, 10, grownTable);
        draft = updateDraftMermaidSource(snapshot, draft, 20, "flowchart TD\n  X --> Y");
        draft = updateDraftImageLabel(snapshot, draft, 30, "Renamed caption");

        const applied = applyLinearDraftToSnapshot(snapshot, draft, { finalizeIds: true });
        expect(applied.memos[0].content).toBe("<h1>Edited</h1>");
        expect(applied.memos[0].x).toBe(80);
        expect(applied.memos[0].y).toBe(80);
        expect(applied.tables[0].source.rows).toHaveLength(12);
        expect(applied.tables[0].height).toBeGreaterThanOrEqual(94 + 12 * 37);
        expect(applied.tables[1].id).toBe(11); // 미연결 카드 유지
        expect(applied.mermaids[0].source).toBe("flowchart TD\n  X --> Y");
        expect(applied.images[0].label).toBe("Renamed caption");
    });

    it("새 섹션을 지정 위치에 삽입해 겹치지 않는 좌표에 배치하고 Apply 시 정식 ID를 부여한다", () => {
        const snapshot = makeSnapshot();
        let draft = createEmptyLinearDraft();

        const created = createDraftMemoSection(snapshot, draft, 1);
        draft = updateDraftMemoHtml(snapshot, created.draft, created.memo.id, "<h2>Inserted</h2>");

        // 프리뷰 단계에서는 음수 임시 ID 유지
        const preview = applyLinearDraftToSnapshot(snapshot, draft, { finalizeIds: false });
        expect(preview.memos).toHaveLength(3);
        const draftMemo = preview.memos.find((m) => m.content === "<h2>Inserted</h2>")!;
        expect(draftMemo.id).toBeLessThan(0);
        expect(draftMemo.sortOrder).toBe(2);

        // 자동 재배치 후 프리뷰의 모든 문서 카드(미연결 table 11 제외)가 서로 겹치지 않는다
        const previewLayoutCards = [
            ...preview.memos,
            ...preview.tables.filter((t) => t.id !== 11),
            ...preview.mermaids,
            ...preview.images,
        ];
        for (let i = 0; i < previewLayoutCards.length; i += 1) {
            for (let j = i + 1; j < previewLayoutCards.length; j += 1) {
                expect(doCardRectsOverlap(previewLayoutCards[i], previewLayoutCards[j])).toBe(false);
            }
        }
        const shiftedSecond = preview.memos.find((m) => m.id === 2)!;
        expect(shiftedSecond.y).toBeGreaterThan(draftMemo.y + draftMemo.height);

        // Apply 확정 시 양수 정식 ID 부여 및 순서 유지
        const finalized = applyLinearDraftToSnapshot(snapshot, draft, { finalizeIds: true });
        const savedMemo = finalized.memos.find((m) => m.content === "<h2>Inserted</h2>")!;
        expect(savedMemo.id).toBeGreaterThan(0);
        expect(savedMemo.sortOrder).toBe(2);
        const compiled = compileBoardMarkdown(finalized);
        expect(compiled.indexOf("# First")).toBeLessThan(compiled.indexOf("## Inserted"));
        expect(compiled.indexOf("## Inserted")).toBeLessThan(compiled.indexOf("## Second"));

        // 이미 커밋된 syncId가 스냅샷에 반영된 직후에는 같은 메모가 중복되지 않는다
        const deduped = applyLinearDraftToSnapshot(finalized, draft, { finalizeIds: false });
        expect(deduped.memos.filter((m) => m.syncId === savedMemo.syncId)).toHaveLength(1);
    });

    it("섹션 순서를 변경하면 첨부 카드가 부모 메모 섹션을 따라 함께 이동한다", () => {
        const snapshot = makeSnapshot();
        let draft = createEmptyLinearDraft();
        draft = reorderDraftMemoSections(snapshot, draft, 1, 0);
        expect(isLinearDraftDirty(snapshot, draft)).toBe(true);

        const reordered = applyLinearDraftToSnapshot(snapshot, draft, { finalizeIds: true });
        const compiled = compileBoardMarkdown(reordered);
        expect(compiled.indexOf("## Second")).toBeLessThan(compiled.indexOf("# First"));
        expect(compiled.indexOf("flowchart LR")).toBeLessThan(compiled.indexOf("| Task |"));

        // 원래 순서로 되돌리면 dirty 해제
        draft = reorderDraftMemoSections(snapshot, draft, 0, 1);
        expect(isLinearDraftDirty(snapshot, draft)).toBe(false);
    });

    it("메모당 표·Mermaid·이미지를 최대 4개까지 추가하고 겹치지 않도록 좌표를 자동 재배치한다", () => {
        const snapshot = makeSnapshot();
        // memo 1은 이미 table 10, image 30 (2개) 보유 → 2개 더 추가 가능, 5번째는 차단
        let draft = createEmptyLinearDraft();

        const addedMermaid = createDraftMermaidAttachment(snapshot, draft, 1);
        expect(addedMermaid).not.toBeNull();
        draft = addedMermaid!.draft;

        const addedImage = createDraftImageAttachment(snapshot, draft, 1, {
            data: new Uint8Array([137, 80, 78, 71]),
            mimeType: "image/png",
            label: "diagram.png",
            width: 300,
            height: 200,
        });
        expect(addedImage).not.toBeNull();
        draft = addedImage!.draft;

        // 5번째 첨부는 차단된다
        expect(createDraftTableAttachment(snapshot, draft, 1)).toBeNull();

        // 새로 추가한 임시 카드도 Apply 전에 수정 가능
        draft = updateDraftMermaidSource(snapshot, draft, addedMermaid!.mermaid.id, "flowchart TD\nM1-->M2");
        draft = updateDraftImageLabel(snapshot, draft, addedImage!.image.imageId, "Updated diagram");

        const finalized = applyLinearDraftToSnapshot(snapshot, draft, { finalizeIds: true });
        expect(finalized.mermaids.every((m) => m.id > 0)).toBe(true);
        expect(finalized.images.every((i) => i.imageId > 0)).toBe(true);

        // 모든 섹션 카드(미연결 table 11 제외)가 서로 겹치지 않고 4개 모두 memo 1에 연결된다
        const sections = buildBoardDocumentSections(finalized).sections;
        expect(sections[0].memoId).toBe(1);
        expect(sections[0].attachments).toHaveLength(4);
        expect(sections[1].memoId).toBe(2);
        expect(sections[1].attachments).toHaveLength(1);

        const layoutCards = [
            ...finalized.memos,
            ...finalized.tables.filter((t) => t.id !== 11),
            ...finalized.mermaids,
            ...finalized.images,
        ];
        for (let i = 0; i < layoutCards.length; i += 1) {
            for (let j = i + 1; j < layoutCards.length; j += 1) {
                expect(doCardRectsOverlap(layoutCards[i], layoutCards[j])).toBe(false);
            }
        }

        const links = resolveMemoCornerLinks(finalized.memos, [
            ...finalized.tables.map((t) => ({ type: "table" as const, id: t.id, x: t.x, y: t.y, z: t.z, width: t.width, height: t.height })),
            ...finalized.mermaids.map((d) => ({ type: "mermaid" as const, id: d.id, x: d.x, y: d.y, z: d.z, width: d.width, height: d.height })),
            ...finalized.images.map((im) => ({ type: "image" as const, id: im.imageId, x: im.x, y: im.y, z: im.z, width: im.width, height: im.height })),
        ]);
        expect(links.filter((link) => link.memoId === 1)).toHaveLength(4);

        // 3·4번째 첨부로 좌측 윙이 생겼으므로 memo 1의 x가 오른쪽으로 자동 이동하고, memo 2는 아래로 밀린다
        const memo1 = finalized.memos.find((m) => m.id === 1)!;
        const memo2 = finalized.memos.find((m) => m.id === 2)!;
        expect(memo1.x).toBeGreaterThan(80);
        expect(memo2.y).toBeGreaterThan(memo1.y + memo1.height);
    });
});
