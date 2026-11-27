import { boardMargin, memoWidth, mermaidSize, minMemoHeight } from "@meldrift/core/board-plan";
import { sortMemosByOrder } from "@meldrift/core/memo-order";
import { defaultTableSource, type TableSource } from "@meldrift/core/table-card";
import { buildBoardDocumentSections } from "./board-markdown";
import type { PreparedImage } from "./image-file";
import {
    createAssetId,
    createSyncId,
    type BoardImage,
    type BoardMemo,
    type BoardMermaid,
    type BoardSnapshot,
    type BoardTable,
} from "./board-state";

export const maxAttachmentsPerMemo = 4;

export type DraftAddedTable = {
    memoId: number;
    card: BoardTable;
};

export type DraftAddedMermaid = {
    memoId: number;
    card: BoardMermaid;
};

export type DraftAddedImage = {
    memoId: number;
    card: BoardImage;
};

export type LinearMarkdownDraft = {
    memoHtmlById: Record<number, string>;
    tableSourceById: Record<number, TableSource>;
    mermaidSourceById: Record<number, string>;
    imageLabelById: Record<number, string | null>;
    addedMemos: BoardMemo[];
    addedTables: DraftAddedTable[];
    addedMermaids: DraftAddedMermaid[];
    addedImages: DraftAddedImage[];
    orderedMemoIds: number[] | null;
    autoLayout: boolean;
};

const defaultMemoColor = "#fffadc";
const defaultMermaidSource = `flowchart LR\n    A["Start"] --> B["Mermaid Card"]`;
const linkGap = 24;
const sectionGap = 80;
const columnGap = 80;
const minTableCardWidth = 360;
const tableSelectAndBorderWidth = 42;
const tableColumnMinWidth = 80;
const tableMinCardHeight = 128;
const tableChromeHeight = 94;
const tableRowMinHeight = 37;

type CornerSlot = "TL" | "TR" | "BL" | "BR";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function cornerSlotsForCount(count: number): CornerSlot[] {
    if (count === 1) {
        return ["TR"];
    }
    if (count === 2) {
        return ["TR", "BR"];
    }
    if (count === 3) {
        return ["TR", "BL", "BR"];
    }
    if (count >= 4) {
        return ["TL", "TR", "BL", "BR"];
    }
    return [];
}

export function createEmptyLinearDraft(): LinearMarkdownDraft {
    return {
        memoHtmlById: {},
        tableSourceById: {},
        mermaidSourceById: {},
        imageLabelById: {},
        addedMemos: [],
        addedTables: [],
        addedMermaids: [],
        addedImages: [],
        orderedMemoIds: null,
        autoLayout: false,
    };
}

function getPendingAddedMemos(snapshot: BoardSnapshot, draft: LinearMarkdownDraft): BoardMemo[] {
    if (draft.addedMemos.length === 0) {
        return [];
    }
    const existingSyncIds = new Set(snapshot.memos.map((memo) => memo.syncId));
    return draft.addedMemos.filter((memo) => !existingSyncIds.has(memo.syncId));
}

function getPendingAddedTables(snapshot: BoardSnapshot, draft: LinearMarkdownDraft): DraftAddedTable[] {
    if (draft.addedTables.length === 0) {
        return [];
    }
    const existingSyncIds = new Set(snapshot.tables.map((table) => table.syncId));
    return draft.addedTables.filter((item) => !existingSyncIds.has(item.card.syncId));
}

function getPendingAddedMermaids(snapshot: BoardSnapshot, draft: LinearMarkdownDraft): DraftAddedMermaid[] {
    if (draft.addedMermaids.length === 0) {
        return [];
    }
    const existingSyncIds = new Set(snapshot.mermaids.map((mermaid) => mermaid.syncId));
    return draft.addedMermaids.filter((item) => !existingSyncIds.has(item.card.syncId));
}

function getPendingAddedImages(snapshot: BoardSnapshot, draft: LinearMarkdownDraft): DraftAddedImage[] {
    if (draft.addedImages.length === 0) {
        return [];
    }
    const existingSyncIds = new Set(snapshot.images.map((image) => image.syncId));
    return draft.addedImages.filter((item) => !existingSyncIds.has(item.card.syncId));
}

function getEffectiveMemoOrder(snapshot: BoardSnapshot, draft: LinearMarkdownDraft): number[] {
    const existingIds = sortMemosByOrder(snapshot.memos).map((memo) => memo.id);
    const addedIds = getPendingAddedMemos(snapshot, draft).map((memo) => memo.id);
    const validIds = new Set([...existingIds, ...addedIds]);

    if (!draft.orderedMemoIds) {
        return [...existingIds, ...addedIds];
    }

    const result: number[] = [];
    const seen = new Set<number>();
    for (const id of draft.orderedMemoIds) {
        if (validIds.has(id) && !seen.has(id)) {
            result.push(id);
            seen.add(id);
        }
    }
    for (const id of existingIds) {
        if (!seen.has(id)) {
            result.push(id);
            seen.add(id);
        }
    }
    for (const id of addedIds) {
        if (!seen.has(id)) {
            result.push(id);
            seen.add(id);
        }
    }
    return result;
}

function areArraysEqual(left: number[], right: number[]): boolean {
    if (left.length !== right.length) {
        return false;
    }
    for (let index = 0; index < left.length; index += 1) {
        if (left[index] !== right[index]) {
            return false;
        }
    }
    return true;
}

function getTableMinWidth(source: TableSource): number {
    return Math.max(
        minTableCardWidth,
        tableSelectAndBorderWidth + source.columns.length * tableColumnMinWidth,
    );
}

function getTableMinHeight(source: TableSource): number {
    const rowsHeight = source.rows.reduce(
        (sum, row) => sum + Math.max(row.height ?? tableRowMinHeight, tableRowMinHeight),
        0,
    );
    return Math.max(tableMinCardHeight, tableChromeHeight + rowsHeight);
}

function maxZOf(snapshot: BoardSnapshot, draft: LinearMarkdownDraft): number {
    return Math.max(
        0,
        ...snapshot.memos.map((c) => c.z),
        ...snapshot.tables.map((c) => c.z),
        ...snapshot.mermaids.map((c) => c.z),
        ...snapshot.images.map((c) => c.z),
        ...getPendingAddedMemos(snapshot, draft).map((c) => c.z),
        ...getPendingAddedTables(snapshot, draft).map((c) => c.card.z),
        ...getPendingAddedMermaids(snapshot, draft).map((c) => c.card.z),
        ...getPendingAddedImages(snapshot, draft).map((c) => c.card.z),
    );
}

function countSectionAttachments(
    snapshot: BoardSnapshot,
    draft: LinearMarkdownDraft,
    memoId: number,
): number {
    const baseSections = buildBoardDocumentSections(snapshot).sections;
    const existingCount = baseSections.find((section) => section.memoId === memoId)?.attachments.length ?? 0;
    const addedCount =
        getPendingAddedTables(snapshot, draft).filter((item) => item.memoId === memoId).length
        + getPendingAddedMermaids(snapshot, draft).filter((item) => item.memoId === memoId).length
        + getPendingAddedImages(snapshot, draft).filter((item) => item.memoId === memoId).length;
    return existingCount + addedCount;
}

function hasMemoInDraft(snapshot: BoardSnapshot, draft: LinearMarkdownDraft, memoId: number): boolean {
    return snapshot.memos.some((memo) => memo.id === memoId)
        || getPendingAddedMemos(snapshot, draft).some((memo) => memo.id === memoId);
}

type ReflowAttachmentRef =
    | { kind: "table"; id: number; width: number; height: number }
    | { kind: "mermaid"; id: number; width: number; height: number }
    | { kind: "image"; id: number; width: number; height: number };

/**
 * 문서 순서(effectiveOrder)와 섹션별 첨부 카드(최대 4개)를 기준으로
 * 메모와 첨부 카드가 서로 겹치지 않고 24px(<= 50px) 꼭짓점 연결을 유지하도록 자동 재배치한다.
 */
function relayoutDocumentSections(
    snapshot: BoardSnapshot,
    baseSnapshot: BoardSnapshot,
    draft: LinearMarkdownDraft,
    effectiveOrder: number[],
): BoardSnapshot {
    const baseSections = buildBoardDocumentSections(baseSnapshot).sections;
    const existingAttachmentsByMemo = new Map<number, Array<{ kind: "table" | "mermaid" | "image"; id: number }>>();
    for (const section of baseSections) {
        existingAttachmentsByMemo.set(
            section.memoId,
            section.attachments.map((att) => ({ kind: att.kind, id: att.id })),
        );
    }

    const memoById = new Map(snapshot.memos.map((m) => [m.id, m]));
    const tableById = new Map(snapshot.tables.map((t) => [t.id, t]));
    const mermaidById = new Map(snapshot.mermaids.map((d) => [d.id, d]));
    const imageById = new Map(snapshot.images.map((i) => [i.imageId, i]));

    const pendingTables = getPendingAddedTables(baseSnapshot, draft);
    const pendingMermaids = getPendingAddedMermaids(baseSnapshot, draft);
    const pendingImages = getPendingAddedImages(baseSnapshot, draft);

    const addedAttachmentsByMemo = new Map<number, Array<{ kind: "table" | "mermaid" | "image"; id: number; z: number }>>();
    const pushAdded = (memoId: number, item: { kind: "table" | "mermaid" | "image"; id: number; z: number }) => {
        const list = addedAttachmentsByMemo.get(memoId) ?? [];
        list.push(item);
        addedAttachmentsByMemo.set(memoId, list);
    };
    pendingTables.forEach((item) => pushAdded(item.memoId, { kind: "table", id: item.card.id, z: item.card.z }));
    pendingMermaids.forEach((item) => pushAdded(item.memoId, { kind: "mermaid", id: item.card.id, z: item.card.z }));
    pendingImages.forEach((item) => pushAdded(item.memoId, { kind: "image", id: item.card.imageId, z: item.card.z }));

    const nextMemoGeometry = new Map<number, { x: number; y: number; height: number }>();
    const nextTablePosition = new Map<number, { x: number; y: number }>();
    const nextMermaidPosition = new Map<number, { x: number; y: number }>();
    const nextImagePosition = new Map<number, { x: number; y: number }>();

    const maxX = snapshot.board.width - boardMargin;
    const maxY = snapshot.board.height - boardMargin;

    let columnX = boardMargin;
    let columnWidth = 0;
    let cursorY = boardMargin;

    for (const memoId of effectiveOrder) {
        const memo = memoById.get(memoId);
        if (!memo) {
            continue;
        }

        const existingRefs = existingAttachmentsByMemo.get(memoId) ?? [];
        const addedRefs = (addedAttachmentsByMemo.get(memoId) ?? []).sort((a, b) => a.z - b.z);
        const combinedRefs: ReflowAttachmentRef[] = [];

        for (const ref of [...existingRefs, ...addedRefs]) {
            if (combinedRefs.length >= maxAttachmentsPerMemo) {
                break;
            }
            if (ref.kind === "table") {
                const card = tableById.get(ref.id);
                if (card) {
                    combinedRefs.push({ kind: "table", id: card.id, width: card.width, height: card.height });
                }
            } else if (ref.kind === "mermaid") {
                const card = mermaidById.get(ref.id);
                if (card) {
                    combinedRefs.push({ kind: "mermaid", id: card.id, width: card.width, height: card.height });
                }
            } else {
                const card = imageById.get(ref.id);
                if (card) {
                    combinedRefs.push({ kind: "image", id: card.imageId, width: card.width, height: card.height });
                }
            }
        }

        const slots = cornerSlotsForCount(combinedRefs.length);
        const slotted = combinedRefs.map((ref, index) => ({ ...ref, slot: slots[index] }));
        const tl = slotted.find((item) => item.slot === "TL");
        const tr = slotted.find((item) => item.slot === "TR");
        const bl = slotted.find((item) => item.slot === "BL");
        const br = slotted.find((item) => item.slot === "BR");

        // 상단 첨부(TL/TR)와 하단 첨부(BL/BR)가 세로로 겹치지 않도록 메모 높이를 확보한다.
        let layoutMemoHeight = memo.height;
        if (tr && br) {
            layoutMemoHeight = Math.max(layoutMemoHeight, tr.height + linkGap);
        }
        if (tl && bl) {
            layoutMemoHeight = Math.max(layoutMemoHeight, tl.height + linkGap);
        }

        const leftWidth = Math.max(tl?.width ?? 0, bl?.width ?? 0);
        const leftWing = leftWidth > 0 ? leftWidth + linkGap : 0;
        const rightWidth = Math.max(tr?.width ?? 0, br?.width ?? 0);
        const rightWing = rightWidth > 0 ? rightWidth + linkGap : 0;

        const totalWidth = leftWing + memo.width + rightWing;
        const placedOffsets = slotted.map((item) => {
            if (item.slot === "TL") {
                return { item, offsetX: leftWing - linkGap - item.width, offsetY: 0 };
            }
            if (item.slot === "TR") {
                return { item, offsetX: leftWing + memo.width + linkGap, offsetY: 0 };
            }
            if (item.slot === "BL") {
                return { item, offsetX: leftWing - linkGap - item.width, offsetY: layoutMemoHeight };
            }
            return { item, offsetX: leftWing + memo.width + linkGap, offsetY: layoutMemoHeight };
        });

        const totalHeight = placedOffsets.reduce(
            (bottom, entry) => Math.max(bottom, entry.offsetY + entry.item.height),
            layoutMemoHeight,
        );

        if (cursorY > boardMargin && cursorY + totalHeight > maxY) {
            columnX += columnWidth + columnGap;
            columnWidth = 0;
            cursorY = boardMargin;
        }

        const baseX = Math.round(clamp(columnX, boardMargin, Math.max(boardMargin, maxX - totalWidth)));
        const baseY = Math.round(clamp(cursorY, boardMargin, Math.max(boardMargin, maxY - totalHeight)));

        nextMemoGeometry.set(memoId, {
            x: Math.round(clamp(baseX + leftWing, 0, Math.max(0, snapshot.board.width - memo.width))),
            y: Math.round(clamp(baseY, 0, Math.max(0, snapshot.board.height - layoutMemoHeight))),
            height: Math.round(layoutMemoHeight),
        });

        for (const { item, offsetX, offsetY } of placedOffsets) {
            const x = Math.round(clamp(baseX + offsetX, 0, Math.max(0, snapshot.board.width - item.width)));
            const y = Math.round(clamp(baseY + offsetY, 0, Math.max(0, snapshot.board.height - item.height)));
            if (item.kind === "table") {
                nextTablePosition.set(item.id, { x, y });
            } else if (item.kind === "mermaid") {
                nextMermaidPosition.set(item.id, { x, y });
            } else {
                nextImagePosition.set(item.id, { x, y });
            }
        }

        columnWidth = Math.max(columnWidth, totalWidth);
        cursorY = baseY + totalHeight + sectionGap;
    }

    return {
        ...snapshot,
        memos: snapshot.memos.map((memo) => {
            const geom = nextMemoGeometry.get(memo.id);
            return geom ? { ...memo, x: geom.x, y: geom.y, height: geom.height } : memo;
        }),
        tables: snapshot.tables.map((table) => {
            const pos = nextTablePosition.get(table.id);
            return pos ? { ...table, x: pos.x, y: pos.y } : table;
        }),
        mermaids: snapshot.mermaids.map((mermaid) => {
            const pos = nextMermaidPosition.get(mermaid.id);
            return pos ? { ...mermaid, x: pos.x, y: pos.y } : mermaid;
        }),
        images: snapshot.images.map((image) => {
            const pos = nextImagePosition.get(image.imageId);
            return pos ? { ...image, x: pos.x, y: pos.y } : image;
        }),
    };
}

export function isLinearDraftDirty(snapshot: BoardSnapshot, draft: LinearMarkdownDraft): boolean {
    if (
        getPendingAddedMemos(snapshot, draft).length > 0
        || getPendingAddedTables(snapshot, draft).length > 0
        || getPendingAddedMermaids(snapshot, draft).length > 0
        || getPendingAddedImages(snapshot, draft).length > 0
    ) {
        return true;
    }

    const baseMemoOrder = sortMemosByOrder(snapshot.memos).map((memo) => memo.id);
    if (draft.orderedMemoIds) {
        const effectiveOrder = getEffectiveMemoOrder(snapshot, draft);
        if (!areArraysEqual(baseMemoOrder, effectiveOrder)) {
            return true;
        }
    }

    for (const [idText, html] of Object.entries(draft.memoHtmlById)) {
        const id = Number(idText);
        const existing = snapshot.memos.find((memo) => memo.id === id);
        if (existing && existing.content !== html) {
            return true;
        }
    }

    for (const [idText, source] of Object.entries(draft.tableSourceById)) {
        const id = Number(idText);
        const existing = snapshot.tables.find((table) => table.id === id);
        if (existing && JSON.stringify(existing.source) !== JSON.stringify(source)) {
            return true;
        }
    }

    for (const [idText, source] of Object.entries(draft.mermaidSourceById)) {
        const id = Number(idText);
        const existing = snapshot.mermaids.find((mermaid) => mermaid.id === id);
        if (existing && existing.source !== source) {
            return true;
        }
    }

    for (const [idText, label] of Object.entries(draft.imageLabelById)) {
        const id = Number(idText);
        const existing = snapshot.images.find((image) => image.imageId === id);
        if (existing && (existing.label ?? null) !== (label ?? null)) {
            return true;
        }
    }

    return false;
}

export function updateDraftMemoHtml(
    snapshot: BoardSnapshot,
    draft: LinearMarkdownDraft,
    memoId: number,
    html: string,
): LinearMarkdownDraft {
    const addedIndex = draft.addedMemos.findIndex((memo) => memo.id === memoId);
    if (addedIndex >= 0) {
        const nextAdded = draft.addedMemos.map((memo) =>
            memo.id === memoId ? { ...memo, content: html } : memo,
        );
        return { ...draft, addedMemos: nextAdded };
    }

    const existing = snapshot.memos.find((memo) => memo.id === memoId);
    const nextMemoHtmlById = { ...draft.memoHtmlById };
    if (existing && existing.content === html) {
        delete nextMemoHtmlById[memoId];
    } else {
        nextMemoHtmlById[memoId] = html;
    }
    return { ...draft, memoHtmlById: nextMemoHtmlById };
}

export function updateDraftTableSource(
    snapshot: BoardSnapshot,
    draft: LinearMarkdownDraft,
    tableId: number,
    source: TableSource,
): LinearMarkdownDraft {
    const addedIndex = draft.addedTables.findIndex((item) => item.card.id === tableId);
    if (addedIndex >= 0) {
        const nextAdded = draft.addedTables.map((item) =>
            item.card.id === tableId
                ? {
                    ...item,
                    card: {
                        ...item.card,
                        source,
                        width: Math.max(item.card.width, getTableMinWidth(source)),
                        height: Math.max(item.card.height, getTableMinHeight(source)),
                    },
                }
                : item,
        );
        return { ...draft, addedTables: nextAdded };
    }

    const existing = snapshot.tables.find((table) => table.id === tableId);
    const nextTableSourceById = { ...draft.tableSourceById };
    if (existing && JSON.stringify(existing.source) === JSON.stringify(source)) {
        delete nextTableSourceById[tableId];
    } else {
        nextTableSourceById[tableId] = source;
    }
    return { ...draft, tableSourceById: nextTableSourceById };
}

export function updateDraftMermaidSource(
    snapshot: BoardSnapshot,
    draft: LinearMarkdownDraft,
    mermaidId: number,
    source: string,
): LinearMarkdownDraft {
    const addedIndex = draft.addedMermaids.findIndex((item) => item.card.id === mermaidId);
    if (addedIndex >= 0) {
        const nextAdded = draft.addedMermaids.map((item) =>
            item.card.id === mermaidId
                ? { ...item, card: { ...item.card, source } }
                : item,
        );
        return { ...draft, addedMermaids: nextAdded };
    }

    const existing = snapshot.mermaids.find((mermaid) => mermaid.id === mermaidId);
    const nextMermaidSourceById = { ...draft.mermaidSourceById };
    if (existing && existing.source === source) {
        delete nextMermaidSourceById[mermaidId];
    } else {
        nextMermaidSourceById[mermaidId] = source;
    }
    return { ...draft, mermaidSourceById: nextMermaidSourceById };
}

export function updateDraftImageLabel(
    snapshot: BoardSnapshot,
    draft: LinearMarkdownDraft,
    imageId: number,
    label: string | null,
): LinearMarkdownDraft {
    const addedIndex = draft.addedImages.findIndex((item) => item.card.imageId === imageId);
    if (addedIndex >= 0) {
        const nextAdded = draft.addedImages.map((item) =>
            item.card.imageId === imageId
                ? { ...item, card: { ...item.card, label } }
                : item,
        );
        return { ...draft, addedImages: nextAdded };
    }

    const existing = snapshot.images.find((image) => image.imageId === imageId);
    const nextImageLabelById = { ...draft.imageLabelById };
    if (existing && (existing.label ?? null) === label) {
        delete nextImageLabelById[imageId];
    } else {
        nextImageLabelById[imageId] = label;
    }
    return { ...draft, imageLabelById: nextImageLabelById };
}

export function createDraftMemoSection(
    snapshot: BoardSnapshot,
    draft: LinearMarkdownDraft,
    insertIndex: number,
): { draft: LinearMarkdownDraft; memo: BoardMemo } {
    const currentOrder = getEffectiveMemoOrder(snapshot, draft);
    const clampedIndex = clamp(insertIndex, 0, currentOrder.length);
    const pendingAddedMemos = getPendingAddedMemos(snapshot, draft);

    const minId = Math.min(
        0,
        ...snapshot.memos.map((memo) => memo.id),
        ...pendingAddedMemos.map((memo) => memo.id),
    );
    const tempId = minId - 1;

    const memo: BoardMemo = {
        id: tempId,
        syncId: createSyncId(),
        boardId: snapshot.board.boardId,
        content: "",
        color: defaultMemoColor,
        sortOrder: clampedIndex + 1,
        x: boardMargin,
        y: boardMargin,
        z: maxZOf(snapshot, draft) + 1,
        width: memoWidth,
        height: minMemoHeight,
    };

    const nextOrder = [
        ...currentOrder.slice(0, clampedIndex),
        tempId,
        ...currentOrder.slice(clampedIndex),
    ];

    return {
        memo,
        draft: {
            ...draft,
            addedMemos: [...pendingAddedMemos, memo],
            orderedMemoIds: nextOrder,
            autoLayout: true,
        },
    };
}

export function createDraftTableAttachment(
    snapshot: BoardSnapshot,
    draft: LinearMarkdownDraft,
    memoId: number,
): { draft: LinearMarkdownDraft; table: BoardTable; key: string } | null {
    if (!hasMemoInDraft(snapshot, draft, memoId)) {
        return null;
    }
    if (countSectionAttachments(snapshot, draft, memoId) >= maxAttachmentsPerMemo) {
        return null;
    }

    const source = structuredClone(defaultTableSource);
    const width = getTableMinWidth(source);
    const height = getTableMinHeight(source);
    const pendingAddedTables = getPendingAddedTables(snapshot, draft);
    const tempId = Math.min(
        0,
        ...snapshot.tables.map((table) => table.id),
        ...pendingAddedTables.map((item) => item.card.id),
    ) - 1;

    const syncId = createSyncId();
    const table: BoardTable = {
        id: tempId,
        syncId,
        boardId: snapshot.board.boardId,
        source,
        x: boardMargin,
        y: boardMargin,
        z: maxZOf(snapshot, draft) + 1,
        width,
        height,
    };

    return {
        table,
        key: `table:${syncId}`,
        draft: {
            ...draft,
            addedTables: [...pendingAddedTables, { memoId, card: table }],
            autoLayout: true,
        },
    };
}

export function createDraftMermaidAttachment(
    snapshot: BoardSnapshot,
    draft: LinearMarkdownDraft,
    memoId: number,
): { draft: LinearMarkdownDraft; mermaid: BoardMermaid; key: string } | null {
    if (!hasMemoInDraft(snapshot, draft, memoId)) {
        return null;
    }
    if (countSectionAttachments(snapshot, draft, memoId) >= maxAttachmentsPerMemo) {
        return null;
    }

    const pendingAddedMermaids = getPendingAddedMermaids(snapshot, draft);
    const tempId = Math.min(
        0,
        ...snapshot.mermaids.map((mermaid) => mermaid.id),
        ...pendingAddedMermaids.map((item) => item.card.id),
    ) - 1;

    const syncId = createSyncId();
    const mermaid: BoardMermaid = {
        id: tempId,
        syncId,
        boardId: snapshot.board.boardId,
        source: defaultMermaidSource,
        x: boardMargin,
        y: boardMargin,
        z: maxZOf(snapshot, draft) + 1,
        width: mermaidSize.width,
        height: mermaidSize.height,
    };

    return {
        mermaid,
        key: `mermaid:${syncId}`,
        draft: {
            ...draft,
            addedMermaids: [...pendingAddedMermaids, { memoId, card: mermaid }],
            autoLayout: true,
        },
    };
}

export function createDraftImageAttachment(
    snapshot: BoardSnapshot,
    draft: LinearMarkdownDraft,
    memoId: number,
    prepared: PreparedImage,
): { draft: LinearMarkdownDraft; image: BoardImage; key: string } | null {
    if (!hasMemoInDraft(snapshot, draft, memoId)) {
        return null;
    }
    if (countSectionAttachments(snapshot, draft, memoId) >= maxAttachmentsPerMemo) {
        return null;
    }

    const pendingAddedImages = getPendingAddedImages(snapshot, draft);
    const tempId = Math.min(
        0,
        ...snapshot.images.map((image) => image.imageId),
        ...pendingAddedImages.map((item) => item.card.imageId),
    ) - 1;

    const syncId = createSyncId();
    const image: BoardImage = {
        imageId: tempId,
        syncId,
        assetId: createAssetId(),
        boardId: snapshot.board.boardId,
        url: "",
        data: prepared.data,
        mimeType: prepared.mimeType,
        label: prepared.label,
        x: boardMargin,
        y: boardMargin,
        z: maxZOf(snapshot, draft) + 1,
        width: Math.max(1, Math.round(prepared.width)),
        height: Math.max(1, Math.round(prepared.height)),
    };

    return {
        image,
        key: `image:${syncId}`,
        draft: {
            ...draft,
            addedImages: [...pendingAddedImages, { memoId, card: image }],
            autoLayout: true,
        },
    };
}

export function reorderDraftMemoSections(
    snapshot: BoardSnapshot,
    draft: LinearMarkdownDraft,
    fromIndex: number,
    toIndex: number,
): LinearMarkdownDraft {
    const currentOrder = getEffectiveMemoOrder(snapshot, draft);
    if (
        fromIndex < 0
        || toIndex < 0
        || fromIndex >= currentOrder.length
        || toIndex >= currentOrder.length
        || fromIndex === toIndex
    ) {
        return draft;
    }

    const nextOrder = [...currentOrder];
    const [moved] = nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, moved);

    const pendingAddedMemos = getPendingAddedMemos(snapshot, draft);
    const hasAddedCards =
        pendingAddedMemos.length > 0
        || getPendingAddedTables(snapshot, draft).length > 0
        || getPendingAddedMermaids(snapshot, draft).length > 0
        || getPendingAddedImages(snapshot, draft).length > 0;
    const baseOrder = sortMemosByOrder(snapshot.memos).map((memo) => memo.id);
    const matchesBase = !hasAddedCards && areArraysEqual(baseOrder, nextOrder);

    return {
        ...draft,
        addedMemos: pendingAddedMemos,
        orderedMemoIds: matchesBase ? null : nextOrder,
        autoLayout: !matchesBase,
    };
}

export function applyLinearDraftToSnapshot(
    snapshot: BoardSnapshot,
    draft: LinearMarkdownDraft,
    options: { finalizeIds?: boolean } = {},
): BoardSnapshot {
    if (!isLinearDraftDirty(snapshot, draft)) {
        return snapshot;
    }

    const finalizeIds = options.finalizeIds ?? false;
    const effectiveOrder = getEffectiveMemoOrder(snapshot, draft);
    const orderById = new Map(effectiveOrder.map((id, index) => [id, index + 1]));

    const existingMemos = snapshot.memos.map((memo) => {
        const nextContent = Object.prototype.hasOwnProperty.call(draft.memoHtmlById, memo.id)
            ? draft.memoHtmlById[memo.id]
            : memo.content;
        const nextSortOrder = orderById.get(memo.id) ?? memo.sortOrder;
        if (nextContent === memo.content && nextSortOrder === memo.sortOrder) {
            return memo;
        }
        return {
            ...memo,
            content: nextContent,
            sortOrder: nextSortOrder,
        };
    });

    const pendingMemos = getPendingAddedMemos(snapshot, draft).map((memo) => ({
        ...memo,
        sortOrder: orderById.get(memo.id) ?? memo.sortOrder,
    }));

    const existingTables = snapshot.tables.map((table) => {
        if (!Object.prototype.hasOwnProperty.call(draft.tableSourceById, table.id)) {
            return table;
        }
        const source = draft.tableSourceById[table.id];
        return {
            ...table,
            source,
            width: Math.max(table.width, getTableMinWidth(source)),
            height: Math.max(table.height, getTableMinHeight(source)),
        };
    });

    const pendingTables = getPendingAddedTables(snapshot, draft).map((item) => item.card);

    const existingMermaids = snapshot.mermaids.map((mermaid) => {
        if (!Object.prototype.hasOwnProperty.call(draft.mermaidSourceById, mermaid.id)) {
            return mermaid;
        }
        return {
            ...mermaid,
            source: draft.mermaidSourceById[mermaid.id],
        };
    });

    const pendingMermaids = getPendingAddedMermaids(snapshot, draft).map((item) => item.card);

    const existingImages = snapshot.images.map((image) => {
        if (!Object.prototype.hasOwnProperty.call(draft.imageLabelById, image.imageId)) {
            return image;
        }
        const label = draft.imageLabelById[image.imageId];
        return {
            ...image,
            label: finalizeIds ? label?.trim() || null : label,
        };
    });

    const pendingImages = getPendingAddedImages(snapshot, draft).map(({ card }) =>
        finalizeIds ? { ...card, label: card.label?.trim() || null } : card,
    );

    let merged: BoardSnapshot = {
        ...snapshot,
        memos: [...existingMemos, ...pendingMemos],
        tables: [...existingTables, ...pendingTables],
        mermaids: [...existingMermaids, ...pendingMermaids],
        images: [...existingImages, ...pendingImages],
    };

    if (draft.autoLayout) {
        merged = relayoutDocumentSections(merged, snapshot, draft, effectiveOrder);
    }

    if (!finalizeIds) {
        return merged;
    }

    let nextRealMemoId = Math.max(0, ...snapshot.memos.map((memo) => memo.id)) + 1;
    let nextRealTableId = Math.max(0, ...snapshot.tables.map((table) => table.id)) + 1;
    let nextRealMermaidId = Math.max(0, ...snapshot.mermaids.map((mermaid) => mermaid.id)) + 1;
    let nextRealImageId = Math.max(0, ...snapshot.images.map((image) => image.imageId)) + 1;

    return {
        ...merged,
        memos: merged.memos.map((memo) => (memo.id < 0 ? { ...memo, id: nextRealMemoId++ } : memo)),
        tables: merged.tables.map((table) => (table.id < 0 ? { ...table, id: nextRealTableId++ } : table)),
        mermaids: merged.mermaids.map((mermaid) => (mermaid.id < 0 ? { ...mermaid, id: nextRealMermaidId++ } : mermaid)),
        images: merged.images.map((image) => (image.imageId < 0 ? { ...image, imageId: nextRealImageId++ } : image)),
    };
}
