import type { BoardStroke } from "@meldrift/core/board-stroke";
import type { BoardImage, BoardMemo, BoardMermaid, BoardSnapshot, BoardTable } from "./board-state";
import {
    boardLockKey, memoOrderKey, objectKeyOf, strokeLayerKey, type BoardOperation,
} from "./board-delta";

export type BoardCollections = Pick<BoardSnapshot, "memos" | "images" | "mermaids" | "tables" | "strokes">;

// 다른 사람의 확정 변경을 로컬 객체로 풀어 둔 것. 같은 객체 참조를 워커·화면·이력이 함께 쓴다.
export type RemotePatch = {
    upserts: {
        memos: BoardMemo[];
        images: BoardImage[];
        mermaids: BoardMermaid[];
        tables: BoardTable[];
        strokes: BoardStroke[];
    };
    deletes: string[];
    keys: string[];
};

export type RemoteAsset = { data: Uint8Array; mimeType: string };

export const emptyRemotePatch = (): RemotePatch => ({
    upserts: { memos: [], images: [], mermaids: [], tables: [], strokes: [] },
    deletes: [],
    keys: [],
});

const nextId = (values: number[]) => values.reduce((highest, value) => Math.max(highest, value), 0) + 1;

export function resolveRemoteOperations(
    base: BoardSnapshot, operations: BoardOperation[], assets: ReadonlyMap<string, RemoteAsset>,
): RemotePatch {
    const patch = emptyRemotePatch();
    const boardId = base.board.boardId;
    const ids = {
        memo: nextId(base.memos.map((memo) => memo.id)),
        image: nextId(base.images.map((image) => image.imageId)),
        mermaid: nextId(base.mermaids.map((mermaid) => mermaid.id)),
        table: nextId(base.tables.map((table) => table.id)),
    };

    for (const operation of operations) {
        const key = objectKeyOf(operation.type, operation.syncId);
        patch.keys.push(key);
        if (operation.action === "delete") {
            patch.deletes.push(key);
            continue;
        }
        const changes = operation.changes;
        if (operation.type === "memo") {
            const existing = base.memos.find((memo) => memo.syncId === operation.syncId);
            const id = existing?.id ?? ids.memo++;
            patch.upserts.memos.push({ ...existing, ...changes, id, boardId, syncId: operation.syncId } as BoardMemo);
        } else if (operation.type === "mermaid") {
            const existing = base.mermaids.find((mermaid) => mermaid.syncId === operation.syncId);
            const id = existing?.id ?? ids.mermaid++;
            patch.upserts.mermaids.push({ ...existing, ...changes, id, boardId, syncId: operation.syncId } as BoardMermaid);
        } else if (operation.type === "table") {
            const existing = base.tables.find((table) => table.syncId === operation.syncId);
            const id = existing?.id ?? ids.table++;
            patch.upserts.tables.push({ ...existing, ...changes, id, boardId, syncId: operation.syncId } as BoardTable);
        } else if (operation.type === "image") {
            const existing = base.images.find((image) => image.syncId === operation.syncId);
            const imageId = existing?.imageId ?? ids.image++;
            const merged = {
                data: null, mimeType: null, url: "", label: null, assetId: "",
                ...existing, ...changes, imageId, boardId, syncId: operation.syncId,
            } as BoardImage;
            const asset = merged.assetId ? assets.get(merged.assetId) : undefined;
            if (asset) {
                merged.data = asset.data;
                merged.mimeType = asset.mimeType;
                merged.url = "";
            } else if (existing && existing.assetId === merged.assetId) {
                merged.data = existing.data;
                merged.mimeType = existing.mimeType;
                merged.url = existing.url;
            } else if (merged.assetId) {
                throw new Error("A shared image could not be downloaded.");
            }
            patch.upserts.images.push(merged);
        } else {
            const existing = base.strokes.find((stroke) => stroke.id === operation.syncId);
            patch.upserts.strokes.push({ ...existing, ...changes, id: operation.syncId } as BoardStroke);
        }
    }
    return patch;
}

function patchCollection<T>(
    items: T[], upserts: T[], deleted: Set<string>, keyOf: (item: T) => string,
): T[] {
    if (upserts.length === 0 && !items.some((item) => deleted.has(keyOf(item)))) {
        return items;
    }
    const replacements = new Map(upserts.map((item) => [keyOf(item), item]));
    const next: T[] = [];
    for (const item of items) {
        const key = keyOf(item);
        if (deleted.has(key)) {
            continue;
        }
        const replacement = replacements.get(key);
        next.push(replacement ?? item);
        replacements.delete(key);
    }
    for (const item of replacements.values()) {
        if (!deleted.has(keyOf(item))) {
            next.push(item);
        }
    }
    return next;
}

const memoKey = (memo: BoardMemo) => objectKeyOf("memo", memo.syncId);
const imageKey = (image: BoardImage) => objectKeyOf("image", image.syncId);
const mermaidKey = (mermaid: BoardMermaid) => objectKeyOf("mermaid", mermaid.syncId);
const tableKey = (table: BoardTable) => objectKeyOf("table", table.syncId);
const strokeKey = (stroke: BoardStroke) => objectKeyOf("stroke", stroke.id);

export function applyRemotePatch<T extends BoardCollections>(content: T, patch: RemotePatch): T {
    const deleted = new Set(patch.deletes);
    const next = {
        ...content,
        memos: patchCollection(content.memos, patch.upserts.memos, deleted, memoKey),
        images: patchCollection(content.images, patch.upserts.images, deleted, imageKey),
        mermaids: patchCollection(content.mermaids, patch.upserts.mermaids, deleted, mermaidKey),
        tables: patchCollection(content.tables, patch.upserts.tables, deleted, tableKey),
        strokes: patchCollection(content.strokes, patch.upserts.strokes, deleted, strokeKey),
    };
    const unchanged = next.memos === content.memos && next.images === content.images
        && next.mermaids === content.mermaids && next.tables === content.tables && next.strokes === content.strokes;
    return unchanged ? content : next;
}

// The display IDs used by the editor can differ from the IDs in the authoritative board.
// Preserve existing IDs and assign a free one if concurrent additions used the same local ID.
export function alignRemoteDisplayIds(content: BoardCollections, patch: RemotePatch): RemotePatch {
    return {
        ...patch,
        upserts: {
            memos: alignIds(content.memos, patch.upserts.memos, (card) => card.id, (card, id) => ({ ...card, id })),
            images: alignIds(content.images, patch.upserts.images, (card) => card.imageId, (card, imageId) => ({ ...card, imageId })),
            mermaids: alignIds(content.mermaids, patch.upserts.mermaids, (card) => card.id, (card, id) => ({ ...card, id })),
            tables: alignIds(content.tables, patch.upserts.tables, (card) => card.id, (card, id) => ({ ...card, id })),
            strokes: patch.upserts.strokes,
        },
    };
}

function alignIds<T extends { syncId: string }>(
    current: T[], incoming: T[], getId: (card: T) => number, setId: (card: T, id: number) => T,
) {
    if (incoming.length === 0) {return incoming;}
    const idsBySyncId = new Map(current.map((card) => [card.syncId, getId(card)]));
    const occupied = new Set(idsBySyncId.values());
    let next = nextId([...occupied]);
    return incoming.map((card) => {
        const incomingId = getId(card);
        const existing = idsBySyncId.get(card.syncId);
        let id = existing ?? incomingId;
        if (existing === undefined && occupied.has(id)) {
            while (occupied.has(next)) {next += 1;}
            id = next++;
        }
        occupied.add(id);
        return id === incomingId ? card : setId(card, id);
    });
}

function deferCollection<T>(next: T[], base: T[], deferred: Set<string>, keyOf: (item: T) => string): T[] {
    const baseByKey = new Map(base.map((item) => [keyOf(item), item]));
    const result: T[] = [];
    const seen = new Set<string>();
    for (const item of next) {
        const key = keyOf(item);
        seen.add(key);
        if (!deferred.has(key)) {
            result.push(item);
            continue;
        }
        const original = baseByKey.get(key);
        if (original) {
            result.push(original);
        }
    }
    for (const item of base) {
        const key = keyOf(item);
        if (deferred.has(key) && !seen.has(key)) {
            result.push(item);
        }
    }
    return result;
}

// 남이 잠갔거나 아직 잠금 응답을 기다리는 키는 로컬 변경을 기록하지 않는다. 직전 저장 값을 그대로 둔다.
// 잠금을 얻은 뒤 다시 저장하면 그때 쌓인 변경이 한꺼번에 기록된다.
export function deferKeys(next: BoardSnapshot, base: BoardSnapshot, keys: Iterable<string>): BoardSnapshot {
    const deferred = new Set(keys);
    if (deferred.size === 0) {
        return next;
    }
    if (deferred.has(boardLockKey)) {
        return { ...base, board: next.board };
    }
    let memos = deferCollection(next.memos, base.memos, deferred, memoKey);
    if (deferred.has(memoOrderKey)) {
        const baseOrder = new Map(base.memos.map((memo) => [memo.syncId, memo.sortOrder]));
        memos = memos.map((memo) => {
            const sortOrder = baseOrder.get(memo.syncId);
            return sortOrder === undefined || sortOrder === memo.sortOrder ? memo : { ...memo, sortOrder };
        });
    }
    let strokes = deferCollection(next.strokes, base.strokes, deferred, strokeKey);
    if (deferred.has(strokeLayerKey)) {
        const existing = new Set(base.strokes.map((stroke) => stroke.id));
        const added = strokes.filter((stroke) => !existing.has(stroke.id));
        strokes = [...base.strokes, ...added];
    }
    return {
        ...next,
        memos,
        images: deferCollection(next.images, base.images, deferred, imageKey),
        mermaids: deferCollection(next.mermaids, base.mermaids, deferred, mermaidKey),
        tables: deferCollection(next.tables, base.tables, deferred, tableKey),
        strokes,
    };
}

export const objectKeysOfContent = (content: BoardCollections) => [
    ...content.memos.map(memoKey),
    ...content.images.map(imageKey),
    ...content.mermaids.map(mermaidKey),
    ...content.tables.map(tableKey),
    ...content.strokes.map(strokeKey),
];

// 저장 요청에 실을 "이 스냅샷이 이미 반영한 원격 배치 번호". 스냅샷 값 자체에는 넣지 않는다.
const remoteSeqTags = new WeakMap<object, number>();

export function tagRemoteSeq<T extends object>(snapshot: T, seq: number) {
    remoteSeqTags.set(snapshot, seq);
    return snapshot;
}

export const remoteSeqOf = (snapshot: object) => remoteSeqTags.get(snapshot);
