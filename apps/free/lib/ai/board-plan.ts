import { z } from "zod";
import { createTableItemId, type TableSource } from "@/lib/table-card";

// AI 어시스턴트가 만들어내는 보드 계획과, 그 계획을 실제 카드 좌표로 배치하는 라이브러리.
//
// AI에게 좌표를 직접 계산시키지 않는다. AI는 "어떤 메모에 어떤 카드가 붙는가"라는 논리 구조만
// 내놓고, 좌표는 이 파일의 배치 함수가 결정한다. Markdown 컴파일이 메모 꼭짓점 포함 여부로
// 카드를 고르기 때문에, 배치가 어긋나면 컴파일 결과가 통째로 달라진다.

export const memoBlockSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("heading"), level: z.number().int().min(1).max(6), text: z.string() }),
    z.object({ type: z.literal("paragraph"), text: z.string() }),
    z.object({ type: z.literal("bulletList"), items: z.array(z.string()).min(1) }),
    z.object({ type: z.literal("orderedList"), items: z.array(z.string()).min(1) }),
    z.object({ type: z.literal("codeBlock"), text: z.string() }),
    z.object({ type: z.literal("blockquote"), text: z.string() }),
]);

export const planTableSchema = z.object({
    columns: z.array(z.string()).min(1).max(8),
    rows: z.array(z.array(z.string())).min(1).max(20),
});

// Free Edition의 AI는 그림을 생성하지 않는다. 사용자가 고른 로컬 이미지만 BLOB으로 저장하므로
// 어시스턴트가 붙일 수 있는 첨부는 Mermaid와 표뿐이다.
export const planAttachmentSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("mermaid"), source: z.string().min(1) }),
    z.object({ type: z.literal("table"), ...planTableSchema.shape }),
]);

// MemoToolBar가 제공하는 색상과 같은 목록으로 제한한다.
export const planMemoColors = [
    "#fffadc",
    "#ffe4ec",
    "#e0f2fe",
    "#dcfce7",
    "#ede9fe",
    "#ffedd5",
    "#ccfbf1",
    "#f1f5f9",
] as const;

export const layoutModes = ["column", "grid", "tree", "scatter"] as const;
export const layoutModeSchema = z.enum(layoutModes);

export const planSectionSchema = z.object({
    blocks: z.array(memoBlockSchema).min(1),
    color: z.enum(planMemoColors).optional(),
    attachment: planAttachmentSchema.optional(),
    /** tree 배치에서만 쓴다. 자기보다 앞선 섹션의 인덱스여야 한다. */
    parentIndex: z.number().int().min(0).optional(),
});

export const boardPlanSchema = z.object({
    layout: layoutModeSchema.optional(),
    sections: z.array(planSectionSchema).min(1).max(24),
});

// 이미 보드에 있는 카드를 다시 배치할 때 쓰는 계획.
export const arrangementSectionSchema = z.object({
    memoId: z.number().int(),
    attachment: z
        .object({
            type: z.enum(["mermaid", "table"]),
            cardId: z.number().int(),
        })
        .optional(),
    /** tree 배치에서만 쓴다. 자기보다 앞선 섹션의 인덱스여야 한다. */
    parentIndex: z.number().int().min(0).optional(),
});

export const boardArrangementSchema = z.object({
    layout: layoutModeSchema.optional(),
    sections: z.array(arrangementSectionSchema).min(1).max(64),
});

// 이미 보드에 있는 카드의 내용을 고칠 때 쓰는 계획. 좌표와 크기는 건드리지 않는다.
export const boardEditSchema = z.object({
    memos: z
        .array(
            z.object({
                id: z.number().int().positive(),
                blocks: z.array(memoBlockSchema).min(1).optional(),
                color: z.enum(planMemoColors).optional(),
            })
        )
        .max(24)
        .optional(),
    mermaids: z
        .array(z.object({ id: z.number().int().positive(), source: z.string().min(1) }))
        .max(24)
        .optional(),
    tables: z
        .array(z.object({ id: z.number().int().positive(), ...planTableSchema.shape }))
        .max(24)
        .optional(),
});

// 카드를 지우는 계획. 저장 전까지는 화면에서만 사라진다.
export const boardDeletionSchema = z.object({
    memoIds: z.array(z.number().int().positive()).max(64).optional(),
    mermaidIds: z.array(z.number().int().positive()).max(64).optional(),
    tableIds: z.array(z.number().int().positive()).max(64).optional(),
    imageIds: z.array(z.number().int().positive()).max(64).optional(),
});

export type MemoBlock = z.infer<typeof memoBlockSchema>;
export type PlanAttachment = z.infer<typeof planAttachmentSchema>;
export type PlanSection = z.infer<typeof planSectionSchema>;
export type BoardPlan = z.infer<typeof boardPlanSchema>;
export type LayoutMode = z.infer<typeof layoutModeSchema>;
export type ArrangementSection = z.infer<typeof arrangementSectionSchema>;
export type BoardArrangement = z.infer<typeof boardArrangementSchema>;
export type BoardEdit = z.infer<typeof boardEditSchema>;
export type BoardDeletion = z.infer<typeof boardDeletionSchema>;

// 배치 상수. 값 사이의 관계가 컴파일 정확성을 좌우하므로 개별로 바꾸지 않는다.
// - attachmentOverlap < 카드 최소 변: 카드가 꼭짓점을 "엄격히" 포함해야 한다.
// - sectionGap > attachmentOverlap: 첨부 카드가 이전 메모의 아래쪽 꼭짓점을 덮으면 안 된다.
// - columnGap > 0: 열이 넘어갈 때 옆 열 메모의 꼭짓점을 덮으면 안 된다.
// 메모는 가로를 400으로 고정하고 내용에 맞춰 세로로 늘린다. 글이 카드 밖으로 넘치면 안 된다.
export const memoWidth = 400;
export const minMemoHeight = 200;
export const maxMemoHeight = 1200;
export const attachmentOverlap = 24;
export const sectionGap = 80;
export const columnGap = 60;
export const boardMargin = 40;
// scatter 배치에서 카드 사이에 항상 남겨둘 최소 간격.
// 겹침 판정을 이 값만큼 부풀려서 하므로, 첨부 카드가 남의 메모 꼭짓점에 닿는 일도 함께 막힌다.
export const scatterMinGap = 24;
export const mermaidSize = { width: 480, height: 360 };
export const tableSize = { width: 560, height: 360 };

export type BoardBounds = { width: number; height: number };

export type PlannedMemo = {
    content: string;
    color: string;
    x: number;
    y: number;
    width: number;
    height: number;
};

export type PlannedMermaid = {
    source: string;
    x: number;
    y: number;
    width: number;
    height: number;
};

export type PlannedTable = {
    source: TableSource;
    x: number;
    y: number;
    width: number;
    height: number;
};

export type PlannedBoard = {
    memos: PlannedMemo[];
    mermaids: PlannedMermaid[];
    tables: PlannedTable[];
    /** 보드에 자리가 없어 배치하지 못하고 버린 섹션 수. */
    droppedSections: number;
};

const escapeHtml = (value: string) =>
    value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");

// 줄바꿈은 TipTap HardBreak과 같은 형태로 바꾼다.
const escapeInline = (value: string) => escapeHtml(value).replace(/\r?\n/g, "<br>");

// AI가 만든 문자열은 절대 HTML로 신뢰하지 않는다. 블록 구조만 받아서 여기서 태그를 만든다
// — 메모 표시 모드가 dangerouslySetInnerHTML을 쓰기 때문에 이 경계가 XSS 방어선이다.
export const memoBlocksToHtml = (blocks: MemoBlock[]) =>
    blocks
        .map((block) => {
            if (block.type === "heading") {
                return `<h${block.level}>${escapeInline(block.text)}</h${block.level}>`;
            }
            if (block.type === "bulletList") {
                const items = block.items.map((item) => `<li><p>${escapeInline(item)}</p></li>`).join("");
                return `<ul>${items}</ul>`;
            }
            if (block.type === "orderedList") {
                const items = block.items.map((item) => `<li><p>${escapeInline(item)}</p></li>`).join("");
                return `<ol>${items}</ol>`;
            }
            if (block.type === "codeBlock") {
                return `<pre><code>${escapeHtml(block.text)}</code></pre>`;
            }
            if (block.type === "blockquote") {
                return `<blockquote><p>${escapeInline(block.text)}</p></blockquote>`;
            }
            return `<p>${escapeInline(block.text)}</p>`;
        })
        .join("");

// 메모 본문 높이 추정용 상수. 실제 렌더 폭(memoWidth - 좌우 패딩)에서 나온 값이다.
// 넘치는 것보다 남는 쪽이 안전하므로 전부 넉넉하게 잡는다.
const memoVerticalPadding = 40;
const memoLineHeight = 28;
const memoBlockGap = 12;
/** 폭 400 카드 한 줄에 들어가는 반각 기준 글자 수. */
const unitsPerLine = 46;

// 한글·한자·가나는 반각 글자의 두 배 폭을 차지한다. 글자 수만 세면 한국어 메모에서 글이 넘친다.
const wideCharacter = /[\u1100-\u11FF\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60]/;

const getVisualUnits = (text: string) =>
    [...text].reduce((total, character) => total + (wideCharacter.test(character) ? 2 : 1), 0);

// 줄바꿈은 그대로 한 줄을 더 쓰고, 긴 줄은 폭에 맞춰 접힌다.
const countWrappedLines = (text: string, capacity: number) =>
    text
        .split(/\r?\n/)
        .reduce((total, line) => total + Math.max(1, Math.ceil(getVisualUnits(line) / capacity)), 0);

// 제목은 글자가 커서 줄 높이도 높고 한 줄에 들어가는 글자도 적다.
const headingScale: Record<number, number> = { 1: 2, 2: 1.7, 3: 1.4, 4: 1.2, 5: 1.1, 6: 1 };

const countBlockLines = (block: MemoBlock) => {
    if (block.type === "bulletList" || block.type === "orderedList") {
        // 불릿 기호와 들여쓰기만큼 한 줄에 들어가는 글자가 줄어든다.
        return block.items.reduce(
            (total, item) => total + countWrappedLines(item, unitsPerLine - 6),
            0
        );
    }
    if (block.type === "codeBlock") {
        return countWrappedLines(block.text, unitsPerLine - 8);
    }
    if (block.type === "heading") {
        const scale = headingScale[block.level] ?? 1;

        return countWrappedLines(block.text, Math.max(8, unitsPerLine / scale)) * scale;
    }
    if (block.type === "blockquote") {
        return countWrappedLines(block.text, unitsPerLine - 6);
    }

    return countWrappedLines(block.text, unitsPerLine);
};

export const estimateMemoHeight = (blocks: MemoBlock[]) => {
    const lines = blocks.reduce((total, block) => total + countBlockLines(block), 0);
    const estimated = memoVerticalPadding + lines * memoLineHeight + blocks.length * memoBlockGap;

    return Math.min(maxMemoHeight, Math.max(minMemoHeight, Math.round(estimated)));
};

export const planTableToSource = (columns: string[], rows: string[][]): TableSource => {
    const tableColumns = columns.map((name) => ({ id: createTableItemId(), name }));

    return {
        columns: tableColumns,
        rows: rows.map((row) => ({
            id: createTableItemId(),
            cells: Object.fromEntries(
                tableColumns.map((column, index) => [column.id, row[index] ?? ""])
            ),
        })),
    };
};

const getAttachmentSize = (attachment: PlanAttachment) =>
    attachment.type === "mermaid" ? mermaidSize : tableSize;

type Size = { width: number; height: number };

type LayoutItem = {
    memo: Size;
    attachment?: Size;
    /** tree 배치에서만 쓴다. */
    parentIndex?: number;
};

type Placement = {
    memo: { x: number; y: number };
    attachment?: { x: number; y: number };
};

/** 자리가 없어 배치하지 못한 항목은 null로 남긴다. */
type PlacementResult = { placements: (Placement | null)[]; droppedCount: number };

// 첨부 카드는 메모 오른쪽 위 꼭짓점에서 attachmentOverlap 만큼 겹치므로,
// 한 섹션이 차지하는 가로 폭은 메모 폭보다 넓다.
const getItemWidth = (item: LayoutItem) =>
    item.attachment ? item.memo.width - attachmentOverlap + item.attachment.width : item.memo.width;

// 메모 y를 기준으로 아래로 뻗는 높이. 첨부는 overlap 만큼 위로 올라가 있다.
const getItemExtent = (item: LayoutItem) =>
    Math.max(item.memo.height, item.attachment ? item.attachment.height - attachmentOverlap : 0);

const toPlacement = (item: LayoutItem, x: number, y: number): Placement => ({
    memo: { x, y },
    attachment: item.attachment
        ? { x: x + item.memo.width - attachmentOverlap, y: y - attachmentOverlap }
        : undefined,
});

type Frame = { minX: number; maxX: number; minY: number; maxY: number };

type Rect = { x: number; y: number; width: number; height: number };

const getFrame = (bounds: BoardBounds, widestItem: number): Frame => ({
    minX: boardMargin,
    maxX: bounds.width - boardMargin - widestItem,
    // 첨부 카드가 메모보다 attachmentOverlap 만큼 위로 올라간다.
    minY: boardMargin + attachmentOverlap,
    maxY: bounds.height - boardMargin,
});

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** 섹션 하나가 실제로 차지하는 사각형. 첨부 카드는 메모보다 위·오른쪽으로 튀어나온다. */
const getItemBox = (item: LayoutItem, x: number, y: number) => ({
    x,
    y: item.attachment ? y - attachmentOverlap : y,
    width: getItemWidth(item),
    height: item.attachment ? getItemExtent(item) + attachmentOverlap : getItemExtent(item),
});

// scatterMinGap 만큼 부풀려서 겹침을 본다. 간격을 두면 첨부 카드가 남의 메모 꼭짓점에
// 닿는 일도 같이 막힌다. 꼭짓점은 메모 경계 위의 점이기 때문이다.
const boxesCollide = (a: Rect, b: Rect) =>
    a.x - scatterMinGap < b.x + b.width &&
    b.x - scatterMinGap < a.x + a.width &&
    a.y - scatterMinGap < b.y + b.height &&
    b.y - scatterMinGap < a.y + a.height;

/**
 * scatter: 보드 안에서 좌표를 실제로 무작위로 뽑는다.
 *
 * 뽑은 자리가 이미 놓인 섹션과 겹치면 다시 뽑는다(거부 샘플링). 정해진 횟수 안에 자리를
 * 못 찾으면 격자를 훑어 빈 곳에 넣고, 그것도 실패하면 그 섹션을 버린다.
 *
 * 격자에 지터만 주는 방식은 칸 순서가 그대로 남아 "삐뚤어진 그리드"로 보인다. 무작위로
 * 뽑아야 행·열이 사라지고 카드 순서와 화면 위치의 상관도 끊긴다.
 */
const placeScatter = (
    items: LayoutItem[],
    frame: Frame,
    bounds: BoardBounds,
    random: () => number
) => {
    const placements: (Placement | null)[] = [];
    const placedBoxes: Rect[] = [];
    let droppedCount = 0;

    const randomAttempts = 80;
    const scanStep = 40;

    // 프레임의 maxX는 가장 넓은 섹션 기준이라 좁은 섹션에는 지나치게 빡빡하다.
    // 섹션별로 실제 폭을 써서 보드 오른쪽 끝까지 활용한다.
    const limitsFor = (item: LayoutItem) => {
        const box = getItemBox(item, 0, 0);

        return {
            minX: frame.minX,
            maxX: bounds.width - boardMargin - box.width,
            minY: frame.minY,
            maxY: bounds.height - boardMargin - getItemExtent(item),
        };
    };

    for (const item of items) {
        const limits = limitsFor(item);

        if (limits.maxX < limits.minX || limits.maxY < limits.minY) {
            placements.push(null);
            droppedCount += 1;
            continue;
        }

        const fits = (x: number, y: number) => {
            const box = getItemBox(item, x, y);

            return !placedBoxes.some((placed) => boxesCollide(box, placed));
        };

        let chosen: { x: number; y: number } | null = null;

        for (let attempt = 0; attempt < randomAttempts && !chosen; attempt += 1) {
            const x = Math.round(limits.minX + random() * (limits.maxX - limits.minX));
            const y = Math.round(limits.minY + random() * (limits.maxY - limits.minY));

            if (fits(x, y)) {
                chosen = { x, y };
            }
        }

        // 무작위로 못 찾으면 격자를 훑는다. 보드가 빽빽할 때도 자리를 놓치지 않는다.
        for (let y = limits.minY; y <= limits.maxY && !chosen; y += scanStep) {
            for (let x = limits.minX; x <= limits.maxX && !chosen; x += scanStep) {
                if (fits(x, y)) {
                    chosen = { x, y };
                }
            }
        }

        if (!chosen) {
            placements.push(null);
            droppedCount += 1;
            continue;
        }

        placedBoxes.push(getItemBox(item, chosen.x, chosen.y));
        placements.push(toPlacement(item, chosen.x, chosen.y));
    }

    return { placements, droppedCount };
};

/**
 * column: 세로로 쌓다가 아래가 막히면 다음 열로 넘어간다. 섹션마다 높이가 달라도 된다.
 */
const placeColumn = (items: LayoutItem[], frame: Frame, pitchX: number, origin: { x: number; y: number }) => {
    const placements: (Placement | null)[] = [];
    let columnX = clamp(Math.round(origin.x), frame.minX, frame.maxX);
    const startY = clamp(Math.round(origin.y), frame.minY, frame.maxY);
    let cursorY = startY;
    let droppedCount = 0;

    for (const item of items) {
        const extent = getItemExtent(item);

        if (cursorY + extent > frame.maxY) {
            columnX += pitchX;
            cursorY = startY;
        }

        if (columnX > frame.maxX || cursorY + extent > frame.maxY) {
            placements.push(null);
            droppedCount += 1;
            continue;
        }

        placements.push(toPlacement(item, columnX, cursorY));
        cursorY += extent + sectionGap;
    }

    return { placements, droppedCount };
};

/**
 * grid: 좌에서 우로 채우고 줄을 바꾼다. 행 높이를 하나로 맞춰야 줄이 어긋나지 않으므로
 * 가장 큰 섹션 높이를 행 간격으로 쓴다.
 */
const placeGrid = (items: LayoutItem[], frame: Frame, pitchX: number) => {
    const placements: (Placement | null)[] = [];
    const rowExtent = items.reduce((tallest, item) => Math.max(tallest, getItemExtent(item)), 0);
    const rowPitch = rowExtent + sectionGap;
    const columnCount = Math.max(1, Math.floor((frame.maxX - frame.minX) / pitchX) + 1);
    let droppedCount = 0;

    items.forEach((item, index) => {
        const x = frame.minX + (index % columnCount) * pitchX;
        const y = frame.minY + Math.floor(index / columnCount) * rowPitch;

        if (x > frame.maxX || y + rowExtent > frame.maxY) {
            placements.push(null);
            droppedCount += 1;
            return;
        }

        placements.push(toPlacement(item, x, y));
    });

    return { placements, droppedCount };
};

/**
 * tree: 깊이를 x축, 형제 순서를 y축으로 쓴다.
 *
 * 잎만 세로 자리를 소비하고 부모는 자식들의 가운데에 놓아, 한 줄로 쌓을 때보다 세로를 덜 쓴다.
 * 같은 깊이끼리 겹치면 아래로 밀어 분리한다. 깊이가 다르면 x가 pitchX 만큼 떨어져 있어
 * 첨부 카드가 다른 깊이의 메모에 닿지 않는다.
 */
const placeTree = (items: LayoutItem[], frame: Frame, pitchX: number) => {
    const childIndexes: number[][] = items.map(() => []);
    const depths: number[] = items.map(() => 0);
    const roots: number[] = [];

    items.forEach((item, index) => {
        // 앞선 섹션만 부모로 인정해 순환을 원천 차단한다.
        const parentIndex = item.parentIndex;
        const hasParent = parentIndex !== undefined && parentIndex >= 0 && parentIndex < index;

        if (hasParent) {
            childIndexes[parentIndex].push(index);
            depths[index] = depths[parentIndex] + 1;
        } else {
            roots.push(index);
        }
    });

    const extents = items.map(getItemExtent);
    const ys: number[] = items.map(() => 0);
    let leafCursor = frame.minY;

    const assignY = (index: number) => {
        const children = childIndexes[index];

        if (children.length === 0) {
            ys[index] = leafCursor;
            leafCursor += extents[index] + sectionGap;
            return;
        }

        children.forEach(assignY);

        const first = children[0];
        const last = children[children.length - 1];
        const childrenMiddle = (ys[first] + ys[last] + extents[last]) / 2;

        ys[index] = Math.max(frame.minY, Math.round(childrenMiddle - extents[index] / 2));
    };

    roots.forEach(assignY);

    // 같은 깊이에서 겹치면 아래로 민다. 부모를 가운데 두면서 생길 수 있는 충돌을 정리한다.
    const byDepth = new Map<number, number[]>();
    depths.forEach((depth, index) => {
        byDepth.set(depth, [...(byDepth.get(depth) ?? []), index]);
    });

    for (const indexes of byDepth.values()) {
        const ordered = [...indexes].sort((a, b) => ys[a] - ys[b]);

        ordered.forEach((index, position) => {
            if (position === 0) {
                return;
            }
            const previous = ordered[position - 1];
            const lowest = ys[previous] + extents[previous] + sectionGap;

            if (ys[index] < lowest) {
                ys[index] = lowest;
            }
        });
    }

    const placements: (Placement | null)[] = [];
    let droppedCount = 0;

    items.forEach((item, index) => {
        const x = frame.minX + depths[index] * pitchX;
        const y = ys[index];

        if (x > frame.maxX || y + extents[index] > frame.maxY) {
            placements.push(null);
            droppedCount += 1;
            return;
        }

        placements.push(toPlacement(item, x, y));
    });

    return { placements, droppedCount };
};

/**
 * 공통 배치 엔진.
 *
 * 첨부 카드는 자기 메모의 오른쪽 위 꼭짓점을 `attachmentOverlap` 만큼 겹쳐 감싼다.
 * 다음 관계가 세 배치 방식 모두에서 컴파일 정확성을 보장한다.
 * - 가로 간격 `pitchX`가 (메모 폭 - 겹침 + 첨부 폭)보다 크므로 첨부 카드가 옆 칸 메모에 닿지 않는다.
 * - `sectionGap > attachmentOverlap`이므로 첨부 카드가 위 칸 메모의 아래 꼭짓점에 닿지 않는다.
 *
 * 보드 밖으로 나가는 카드는 만들지 않는다. 자리가 없으면 그 항목을 배치하지 않고 null로 남긴다.
 */
const placeItems = (
    items: LayoutItem[],
    bounds: BoardBounds,
    origin: { x: number; y: number },
    mode: LayoutMode,
    random: () => number = Math.random
): PlacementResult => {
    // 모든 칸에 같은 간격을 쓰면 칸 사이 침범 검사를 한 번만 하면 된다.
    const widestItem = items.reduce((widest, item) => Math.max(widest, getItemWidth(item)), memoWidth);
    const pitchX = widestItem + columnGap;
    const frame = getFrame(bounds, widestItem);

    if (frame.maxX < frame.minX || frame.maxY < frame.minY) {
        // 보드가 카드 한 장도 못 넣을 만큼 작다.
        return { placements: items.map(() => null), droppedCount: items.length };
    }

    if (mode === "grid") {
        return placeGrid(items, frame, pitchX);
    }
    if (mode === "tree") {
        return placeTree(items, frame, pitchX);
    }
    if (mode === "scatter") {
        return placeScatter(items, frame, bounds, random);
    }

    return placeColumn(items, frame, pitchX, origin);
};

/** 보드 크기로 배치 가능한 최대 섹션 수를 추정한다. 모델에게 알려줄 상한으로 쓴다. */
export const getPlanCapacity = (bounds: BoardBounds) => {
    // 첨부가 있는 섹션을 기준으로 잡아 보수적으로 추정한다.
    const sectionExtent = Math.max(minMemoHeight, tableSize.height - attachmentOverlap);
    const widestItem = memoWidth - attachmentOverlap + tableSize.width;
    const usableHeight = bounds.height - 2 * boardMargin - attachmentOverlap;
    const usableWidth = bounds.width - 2 * boardMargin;

    const perColumn = Math.floor((usableHeight + sectionGap) / (sectionExtent + sectionGap));
    const columns = Math.floor((usableWidth + columnGap) / (widestItem + columnGap));

    return Math.max(0, perColumn * columns);
};

/** 새로 만든 계획을 실제 카드 좌표로 배치한다. */
export const layoutBoardPlan = (
    plan: BoardPlan,
    origin: { x: number; y: number },
    bounds: BoardBounds,
    // scatter 배치에서만 쓴다. 테스트가 결과를 재현할 수 있도록 밖에서 넣을 수 있게 둔다.
    random: () => number = Math.random
): PlannedBoard => {
    const memoHeights = plan.sections.map((section) => estimateMemoHeight(section.blocks));
    const items: LayoutItem[] = plan.sections.map((section, index) => ({
        memo: { width: memoWidth, height: memoHeights[index] },
        attachment: section.attachment ? getAttachmentSize(section.attachment) : undefined,
        parentIndex: section.parentIndex,
    }));

    const { placements, droppedCount } = placeItems(items, bounds, origin, plan.layout ?? "column", random);
    const planned: PlannedBoard = { memos: [], mermaids: [], tables: [], droppedSections: droppedCount };

    placements.forEach((placement, index) => {
        if (!placement) {
            return;
        }
        const section = plan.sections[index];

        planned.memos.push({
            content: memoBlocksToHtml(section.blocks),
            color: section.color ?? planMemoColors[0],
            x: placement.memo.x,
            y: placement.memo.y,
            width: memoWidth,
            height: memoHeights[index],
        });

        if (!section.attachment || !placement.attachment) {
            return;
        }

        const size = getAttachmentSize(section.attachment);

        if (section.attachment.type === "mermaid") {
            planned.mermaids.push({
                source: section.attachment.source,
                x: placement.attachment.x,
                y: placement.attachment.y,
                ...size,
            });
        } else {
            planned.tables.push({
                source: planTableToSource(section.attachment.columns, section.attachment.rows),
                x: placement.attachment.x,
                y: placement.attachment.y,
                ...size,
            });
        }
    });

    return planned;
};

export type ExistingCard = { id: number; width: number; height: number };

export type ExistingCards = {
    memos: ExistingCard[];
    mermaids: ExistingCard[];
    tables: ExistingCard[];
};

export type CardMove = { id: number; x: number; y: number };

export type ArrangedBoard = {
    memos: CardMove[];
    mermaids: CardMove[];
    tables: CardMove[];
    droppedSections: number;
};

/**
 * 이미 보드에 있는 카드를 다시 배치한다.
 *
 * 카드 크기는 사용자가 조절해 둔 현재 값을 그대로 쓰고 좌표만 바꾼다. 존재하지 않는 ID나
 * 중복 ID는 조용히 건너뛴다.
 */
export const layoutArrangement = (
    arrangement: BoardArrangement,
    existing: ExistingCards,
    origin: { x: number; y: number },
    bounds: BoardBounds,
    // scatter 배치에서만 쓴다. 재배치도 같은 배치기를 쓰므로 함께 열어 둔다.
    random: () => number = Math.random
): ArrangedBoard => {
    const memoById = new Map(existing.memos.map((memo) => [memo.id, memo]));
    const mermaidById = new Map(existing.mermaids.map((card) => [card.id, card]));
    const tableById = new Map(existing.tables.map((card) => [card.id, card]));

    const usedMemoIds = new Set<number>();
    const usedCardIds = new Set<string>();

    type ResolvedSection = {
        memo: ExistingCard;
        attachment?: { type: "mermaid" | "table"; card: ExistingCard };
        parentIndex?: number;
    };

    const resolved: ResolvedSection[] = [];
    // 걸러진 섹션 때문에 인덱스가 밀리므로 원래 인덱스를 새 인덱스로 다시 매핑한다.
    const resolvedIndexBySource = new Map<number, number>();

    for (const [sourceIndex, section] of arrangement.sections.entries()) {
        const memo = memoById.get(section.memoId);

        if (!memo || usedMemoIds.has(memo.id)) {
            continue;
        }
        usedMemoIds.add(memo.id);

        let attachment: ResolvedSection["attachment"];

        if (section.attachment) {
            const source = section.attachment.type === "mermaid" ? mermaidById : tableById;
            const card = source.get(section.attachment.cardId);
            const cardKey = `${section.attachment.type}:${section.attachment.cardId}`;

            if (card && !usedCardIds.has(cardKey)) {
                usedCardIds.add(cardKey);
                attachment = { type: section.attachment.type, card };
            }
        }

        resolvedIndexBySource.set(sourceIndex, resolved.length);
        resolved.push({ memo, attachment, parentIndex: section.parentIndex });
    }

    // 부모가 걸러졌으면 루트로 취급한다.
    resolved.forEach((section) => {
        section.parentIndex =
            section.parentIndex === undefined ? undefined : resolvedIndexBySource.get(section.parentIndex);
    });

    const items: LayoutItem[] = resolved.map((section) => ({
        memo: { width: section.memo.width, height: section.memo.height },
        attachment: section.attachment
            ? { width: section.attachment.card.width, height: section.attachment.card.height }
            : undefined,
        parentIndex: section.parentIndex,
    }));

    const { placements, droppedCount } = placeItems(items, bounds, origin, arrangement.layout ?? "column", random);
    const arranged: ArrangedBoard = { memos: [], mermaids: [], tables: [], droppedSections: droppedCount };

    placements.forEach((placement, index) => {
        if (!placement) {
            return;
        }
        const section = resolved[index];

        arranged.memos.push({ id: section.memo.id, x: placement.memo.x, y: placement.memo.y });

        if (!section.attachment || !placement.attachment) {
            return;
        }

        const move = {
            id: section.attachment.card.id,
            x: placement.attachment.x,
            y: placement.attachment.y,
        };

        if (section.attachment.type === "mermaid") {
            arranged.mermaids.push(move);
        } else {
            arranged.tables.push(move);
        }
    });

    return arranged;
};
