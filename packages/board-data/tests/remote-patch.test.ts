import { describe, expect, it } from "vitest";
import { diffBoardSnapshots, touchedKeys, touchedKeysOf, type BoardOperation } from "../src/board-delta";
import { createEmptyBoardSnapshot, type BoardMemo, type BoardSnapshot } from "../src/board-state";
import { applyRemotePatch, deferKeys, resolveRemoteOperations } from "../src/remote-patch";

const memo = (overrides: Partial<BoardMemo> = {}): BoardMemo => ({
    id: 1, syncId: "memo-1", boardId: 1, content: "<p>memo</p>",
    x: 0, y: 0, z: 1, width: 300, height: 200, color: "#fffadc", sortOrder: 1,
    ...overrides,
});

const board = (overrides: Partial<BoardSnapshot> = {}): BoardSnapshot => ({ ...createEmptyBoardSnapshot(), ...overrides });
const stroke = (id: string, x = 0) => ({ id, color: "#000", width: 2, points: [[x, 0], [x + 1, 1]] as [number, number][] });
const noAssets = new Map();

describe("touchedKeys", () => {
    it("메모 순서는 순서 키, 나머지 필드는 객체 키로 나눈다", () => {
        const order: BoardOperation = { type: "memo", syncId: "a", action: "update", changes: { sortOrder: 2 } };
        const both: BoardOperation = { type: "memo", syncId: "a", action: "update", changes: { sortOrder: 2, x: 1 } };
        const content: BoardOperation = { type: "memo", syncId: "a", action: "update", changes: { content: "x" } };

        expect(touchedKeys(order)).toEqual(["order:memo"]);
        expect(touchedKeys(both)).toEqual(["order:memo", "memo:a"]);
        expect(touchedKeys(content)).toEqual(["memo:a"]);
    });

    it("새 획은 획 키만, 기존 획 수정·삭제는 지우개 키도 건드린다", () => {
        expect(touchedKeys({ type: "stroke", syncId: "s", action: "create", changes: {} })).toEqual(["stroke:s"]);
        expect(touchedKeys({ type: "stroke", syncId: "s", action: "delete", changes: {} }))
            .toEqual(["stroke:s", "layer:strokes"]);
    });

    it("중복을 없앤 합집합을 돌려준다", () => {
        expect(touchedKeysOf([
            { type: "image", syncId: "i", action: "update", changes: { x: 1 } },
            { type: "image", syncId: "i", action: "update", changes: { y: 1 } },
        ])).toEqual(["image:i"]);
    });
});

describe("resolveRemoteOperations·applyRemotePatch", () => {
    it("기존 카드는 로컬 id를 유지하고 새 카드는 다음 id를 받는다", () => {
        const base = board({ memos: [memo({ id: 4 })] });
        const patch = resolveRemoteOperations(base, [
            { type: "memo", syncId: "memo-1", action: "update", changes: { x: 50 } },
            { type: "memo", syncId: "memo-2", action: "create", changes: { ...memo({ syncId: "memo-2" }), id: undefined } },
        ], noAssets);

        expect(patch.upserts.memos.map((item) => [item.syncId, item.id, item.x])).toEqual([
            ["memo-1", 4, 50],
            ["memo-2", 5, 0],
        ]);
        const next = applyRemotePatch(base, patch);
        expect(next.memos.map((item) => item.syncId)).toEqual(["memo-1", "memo-2"]);
        expect(next.memos[1]).toBe(patch.upserts.memos[1]);
    });

    it("삭제는 컬렉션에서 빼고, 아무것도 바뀌지 않으면 같은 객체를 돌려준다", () => {
        const base = board({ memos: [memo()], strokes: [stroke("s1")] });
        const deleted = applyRemotePatch(base, resolveRemoteOperations(base, [
            { type: "stroke", syncId: "s1", action: "delete", changes: {} },
        ], noAssets));

        expect(deleted.strokes).toEqual([]);
        expect(deleted.memos).toBe(base.memos);
        expect(applyRemotePatch(base, resolveRemoteOperations(base, [], noAssets))).toBe(base);
    });

    it("새 이미지는 내려받은 바이트로 채우고, 바이트가 없으면 실패한다", () => {
        const base = board();
        const changes = { x: 0, y: 0, z: 1, width: 10, height: 10, url: "", label: "a.webp", assetId: "asset-9" };
        const assets = new Map([["asset-9", { data: new Uint8Array([7]), mimeType: "image/webp" }]]);
        const patch = resolveRemoteOperations(base, [
            { type: "image", syncId: "image-9", action: "create", changes, asset: true },
        ], assets);

        expect(patch.upserts.images[0]).toMatchObject({ imageId: 1, assetId: "asset-9", mimeType: "image/webp", url: "" });
        expect(() => resolveRemoteOperations(base, [
            { type: "image", syncId: "image-9", action: "create", changes, asset: true },
        ], noAssets)).toThrow();
    });
});

describe("deferKeys", () => {
    it("미룬 키의 로컬 변경은 직전 저장 값으로 되돌려 diff에서 빠진다", () => {
        const base = board({ memos: [memo(), memo({ id: 2, syncId: "memo-2" })] });
        const local = board({ memos: [memo({ x: 99 }), memo({ id: 2, syncId: "memo-2", x: 5 })] });

        const effective = deferKeys(local, base, ["memo:memo-1"]);

        expect(diffBoardSnapshots(base, effective)).toEqual([
            { type: "memo", syncId: "memo-2", action: "update", changes: { x: 5 } },
        ]);
    });

    it("미룬 키의 삭제와 생성도 기록하지 않는다", () => {
        const base = board({ memos: [memo()] });
        const local = board({ memos: [memo({ id: 3, syncId: "memo-3" })] });

        const effective = deferKeys(local, base, ["memo:memo-1", "memo:memo-3"]);

        expect(effective.memos.map((item) => item.syncId)).toEqual(["memo-1"]);
        expect(diffBoardSnapshots(base, effective)).toEqual([]);
    });

    it("순서 키는 sortOrder만, 지우개 키는 기존 획만 되돌린다", () => {
        const base = board({ memos: [memo()], strokes: [stroke("old")] });
        const local = board({ memos: [memo({ sortOrder: 4, content: "new" })], strokes: [stroke("new", 5)] });

        const effective = deferKeys(local, base, ["order:memo", "layer:strokes"]);

        expect(effective.memos[0]).toMatchObject({ sortOrder: 1, content: "new" });
        expect(effective.strokes.map((item) => item.id)).toEqual(["old", "new"]);
    });

    it("보드 전체 잠금은 모든 로컬 변경을 미룬다", () => {
        const base = board({ memos: [memo()] });
        const local = board({ memos: [] });

        expect(deferKeys(local, base, ["board:*"]).memos).toBe(base.memos);
    });
});
