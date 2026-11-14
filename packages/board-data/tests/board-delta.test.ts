import { describe, expect, it } from "vitest";
import { diffBoardSnapshots, mergeBoardOperations, type BoardOperation } from "../src/board-delta";
import { createEmptyBoardSnapshot, type BoardImage, type BoardMemo, type BoardSnapshot } from "../src/board-state";

const memo = (overrides: Partial<BoardMemo> = {}): BoardMemo => ({
    id: 1, syncId: "memo-1", boardId: 1, content: "<p>memo</p>",
    x: 0, y: 0, z: 1, width: 300, height: 200, color: "#fffadc", sortOrder: 1,
    ...overrides,
});

const image = (overrides: Partial<BoardImage> = {}): BoardImage => ({
    imageId: 1, syncId: "image-1", assetId: "asset-1", boardId: 1, url: "", data: new Uint8Array([1, 2, 3]),
    mimeType: "image/webp", label: "a.webp", x: 0, y: 0, z: 1, width: 400, height: 300,
    ...overrides,
});

const withMemos = (...memos: BoardMemo[]): BoardSnapshot => ({ ...createEmptyBoardSnapshot(), memos });
const withImages = (...images: BoardImage[]): BoardSnapshot => ({ ...createEmptyBoardSnapshot(), images });

describe("diffBoardSnapshots 동작", () => {
    it("스냅샷이 같으면 변경을 생성하지 않는다", () => {
        const snapshot = withMemos(memo());
        expect(diffBoardSnapshots(snapshot, snapshot)).toEqual([]);
    });

    it("이동한 좌표만 전송한다", () => {
        const before = withMemos(memo());
        const after = withMemos(memo({ x: 120, y: 240 }));

        expect(diffBoardSnapshots(before, after)).toEqual([
            { type: "memo", syncId: "memo-1", action: "update", changes: { x: 120, y: 240 } },
        ]);
    });

    it("생성 시 모든 필드를 전송한다", () => {
        const [operation] = diffBoardSnapshots(createEmptyBoardSnapshot(), withMemos(memo()));

        expect(operation.action).toBe("create");
        expect(operation.changes).toEqual({
            x: 0, y: 0, z: 1, width: 300, height: 200,
            content: "<p>memo</p>", color: "#fffadc", sortOrder: 1,
        });
    });

    it("필드 없이 삭제 작업을 전송한다", () => {
        expect(diffBoardSnapshots(withMemos(memo()), createEmptyBoardSnapshot())).toEqual([
            { type: "memo", syncId: "memo-1", action: "delete", changes: {} },
        ]);
    });

    it("이미지의 위치·크기만 바뀌면 자산 변경으로 표시하지 않는다", () => {
        const bytes = new Uint8Array([1, 2, 3]);
        const before = withImages(image({ data: bytes }));
        const after = withImages(image({ data: bytes, x: 50, width: 200 }));

        expect(diffBoardSnapshots(before, after)).toEqual([
            { type: "image", syncId: "image-1", action: "update", changes: { x: 50, width: 200 } },
        ]);
    });

    it("이미지가 새 바이트를 참조하면 자산 변경으로 표시한다", () => {
        const before = withImages(image());
        const after = withImages(image({ assetId: "asset-2", data: new Uint8Array([9, 9]) }));
        const [operation] = diffBoardSnapshots(before, after);

        expect(operation.asset).toBe(true);
    });

    it("배열 참조가 아니라 자산 식별자로 바이너리를 비교한다", () => {
        const before = withImages(image({ data: new Uint8Array([1, 2, 3]) }));
        const reloaded = withImages(image({ data: new Uint8Array([1, 2, 3]) }));

        expect(diffBoardSnapshots(before, reloaded)).toEqual([]);
    });

    it("표 소스를 값으로 비교하고 변경된 소스를 전달한다", () => {
        const source = { columns: [{ id: "c", name: "C" }], rows: [{ id: "r", cells: { c: "1" } }] };
        const base = { id: 1, syncId: "table-1", boardId: 1, x: 0, y: 0, z: 1, width: 100, height: 100 };
        const tables = (value: typeof source): BoardSnapshot =>
            ({ ...createEmptyBoardSnapshot(), tables: [{ ...base, source: value }] });
        const changed = structuredClone(source);
        changed.rows[0].cells.c = "2";

        expect(diffBoardSnapshots(tables(source), tables(structuredClone(source)))).toEqual([]);
        expect(diffBoardSnapshots(tables(source), tables(changed))).toEqual([
            { type: "table", syncId: "table-1", action: "update", changes: { source: changed } },
        ]);
    });

    it("PostgreSQL jsonb가 반환한 키 순서는 무시한다", () => {
        const source = { columns: [{ id: "c", name: "C" }], rows: [{ id: "r", cells: { c: "1" } }] };
        const reordered = { rows: source.rows, columns: source.columns };
        const base = { id: 1, syncId: "table-1", boardId: 1, x: 0, y: 0, z: 1, width: 100, height: 100 };
        const tables = (value: typeof source): BoardSnapshot =>
            ({ ...createEmptyBoardSnapshot(), tables: [{ ...base, source: value }] });

        expect(JSON.stringify(reordered)).not.toBe(JSON.stringify(source));
        expect(diffBoardSnapshots(tables(source), tables(reordered))).toEqual([]);
    });

    it("복제만 된 획 좌표는 변경으로 취급하지 않는다", () => {
        const stroke = { id: "stroke-1", color: "#000", width: 4, points: [[0, 0], [1, 1]] as [number, number][] };
        const strokes = (value: typeof stroke): BoardSnapshot =>
            ({ ...createEmptyBoardSnapshot(), strokes: [value] });

        expect(diffBoardSnapshots(strokes(stroke), strokes(structuredClone(stroke)))).toEqual([]);
    });

    it("자산 변경 표시 대신 다시 그린 획 좌표를 전달한다", () => {
        const stroke = { id: "stroke-1", color: "#000", width: 4, points: [[0, 0], [1, 1]] as [number, number][] };
        const strokes = (points: [number, number][]): BoardSnapshot =>
            ({ ...createEmptyBoardSnapshot(), strokes: [{ ...stroke, points }] });
        const erased: [number, number][] = [[0, 0], [1, 1], [2, 2]];

        expect(diffBoardSnapshots(strokes(stroke.points), strokes(erased))).toEqual([
            { type: "stroke", syncId: "stroke-1", action: "update", changes: { points: erased } },
        ]);
    });

    it("자산 변경 표시와 함께 새 자산 식별자를 전달한다", () => {
        const before = withImages(image());
        const after = withImages(image({ assetId: "asset-2", data: new Uint8Array([9]) }));

        expect(diffBoardSnapshots(before, after)).toEqual([{
            type: "image", syncId: "image-1", action: "update",
            changes: { assetId: "asset-2" }, asset: true,
        }]);
    });
});

describe("mergeBoardOperations 동작", () => {
    const move = (x: number): BoardOperation =>
        ({ type: "memo", syncId: "memo-1", action: "update", changes: { x } });

    it("반복 이동의 최종 위치만 유지한다", () => {
        expect(mergeBoardOperations([move(10)], [move(80)])).toEqual([move(80)]);
    });

    it("대기 중인 이동 작업에 크기 변경을 합친다", () => {
        const resize: BoardOperation = { type: "memo", syncId: "memo-1", action: "update", changes: { width: 400 } };

        expect(mergeBoardOperations([move(10)], [resize])).toEqual([
            { type: "memo", syncId: "memo-1", action: "update", changes: { x: 10, width: 400 } },
        ]);
    });

    it("대기 중인 생성 작업에 편집 내용을 합친다", () => {
        const create: BoardOperation = {
            type: "memo", syncId: "memo-1", action: "create", changes: { x: 0, content: "" },
        };
        const edit: BoardOperation = {
            type: "memo", syncId: "memo-1", action: "update", changes: { content: "<p>hi</p>" },
        };

        expect(mergeBoardOperations([create], [edit])).toEqual([
            { type: "memo", syncId: "memo-1", action: "create", changes: { x: 0, content: "<p>hi</p>" } },
        ]);
    });

    it("전송 전에 삭제된 생성 작업을 취소한다", () => {
        const create: BoardOperation = { type: "memo", syncId: "memo-1", action: "create", changes: {} };
        const remove: BoardOperation = { type: "memo", syncId: "memo-1", action: "delete", changes: {} };

        expect(mergeBoardOperations([create], [remove])).toEqual([]);
    });

    it("기존 카드를 편집한 뒤 지우면 삭제 작업만 유지한다", () => {
        const remove: BoardOperation = { type: "memo", syncId: "memo-1", action: "delete", changes: {} };

        expect(mergeBoardOperations([move(10)], [remove])).toEqual([remove]);
    });

    it("자산 변경 표시가 설정되면 계속 유지한다", () => {
        const replace: BoardOperation = {
            type: "image", syncId: "image-1", action: "update", changes: {}, asset: true,
        };
        const nudge: BoardOperation = { type: "image", syncId: "image-1", action: "update", changes: { x: 5 } };

        expect(mergeBoardOperations([replace], [nudge])).toEqual([
            { type: "image", syncId: "image-1", action: "update", changes: { x: 5 }, asset: true },
        ]);
    });

    it("관계없는 카드는 변경하지 않는다", () => {
        const other: BoardOperation = { type: "mermaid", syncId: "mermaid-2", action: "update", changes: { z: 3 } };

        expect(mergeBoardOperations([move(10)], [other])).toEqual([move(10), other]);
    });
});
