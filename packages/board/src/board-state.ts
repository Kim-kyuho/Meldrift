import { z } from "zod";
import type { MemoCardData, MermaidCardData, TableCardData } from "@meldrift/core/cards";
import { boardStrokesSchema, type BoardStroke } from "@meldrift/core/board-stroke";
import { maxStoredImageBytes, supportedImageMimeTypes } from "@meldrift/board/image-file";
import { tableSourceSchema } from "@meldrift/core/table-card";

export const defaultBoardId = 1;
export const schemaVersion = 3;

export type BoardInfo = {
    boardId: number;
    title: string;
    width: number;
    height: number;
};

export type BoardMemo = MemoCardData;

export type BoardImage = {
    imageId: number;
    boardId: number;
    url: string;
    data: Uint8Array | null;
    mimeType: string | null;
    label: string | null;
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
};

export type BoardMermaid = MermaidCardData;

export type BoardTable = TableCardData;

export type BoardSnapshot = {
    board: BoardInfo;
    memos: BoardMemo[];
    images: BoardImage[];
    mermaids: BoardMermaid[];
    tables: BoardTable[];
    strokes: BoardStroke[];
};

export const defaultBoard: BoardInfo = {
    boardId: defaultBoardId,
    title: "Meldrift Free Board",
    width: 7680,
    height: 4320,
};

export const createEmptyBoardSnapshot = (): BoardSnapshot => ({
    board: { ...defaultBoard },
    memos: [],
    images: [],
    mermaids: [],
    tables: [],
    strokes: [],
});

const positiveInteger = z.number().int().positive();
const integer = z.number().int();
const geometry = {
    x: integer,
    y: integer,
    z: integer,
    width: positiveInteger,
    height: positiveInteger,
};

const boardSchema = z.object({
    boardId: positiveInteger,
    title: z.string().trim().min(1),
    width: positiveInteger,
    height: positiveInteger,
});

const memoSchema = z.object({
    id: positiveInteger,
    boardId: positiveInteger,
    content: z.string(),
    color: z.string().min(1),
    sortOrder: positiveInteger,
    ...geometry,
});

const imageSchema = z.object({
    imageId: positiveInteger,
    boardId: positiveInteger,
    url: z.string(),
    data: z.instanceof(Uint8Array).nullable(),
    mimeType: z.string().nullable(),
    label: z.string().nullable(),
    ...geometry,
}).superRefine((image, context) => {
    if (image.data) {
        if (image.url !== "" || image.data.byteLength < 1 || image.data.byteLength > maxStoredImageBytes) {
            context.addIssue({ code: "custom", message: "Invalid local image data." });
        }
        if (!supportedImageMimeTypes.includes(image.mimeType as (typeof supportedImageMimeTypes)[number])) {
            context.addIssue({ code: "custom", message: "Unsupported local image type." });
        }
        return;
    }

    try {
        const parsedUrl = new URL(image.url);
        if ((parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") || image.mimeType !== null) {
            throw new Error();
        }
    } catch {
        context.addIssue({ code: "custom", message: "Invalid legacy image URL." });
    }
});

const mermaidSchema = z.object({
    id: positiveInteger,
    boardId: positiveInteger,
    source: z.string().trim().min(1),
    ...geometry,
});

const tableSchema = z.object({
    id: positiveInteger,
    boardId: positiveInteger,
    source: tableSourceSchema,
    ...geometry,
});

export const boardSnapshotSchema = z.object({
    board: boardSchema,
    memos: z.array(memoSchema),
    images: z.array(imageSchema),
    mermaids: z.array(mermaidSchema),
    tables: z.array(tableSchema),
    strokes: boardStrokesSchema,
});

export function parseBoardSnapshot(value: unknown): BoardSnapshot {
    const result = boardSnapshotSchema.safeParse(value);
    if (!result.success) {
        throw new Error("The SQLite file contains invalid Meldrift Free Edition data.");
    }
    const snapshot = result.data;
    for (const cards of [snapshot.memos, snapshot.images, snapshot.mermaids, snapshot.tables]) {
        const ids = new Set<number>();
        for (const card of cards) {
            const id = "imageId" in card ? card.imageId : card.id;
            if (card.boardId !== snapshot.board.boardId || ids.has(id)) {
                throw new Error("The snapshot contains mixed boards or duplicate card IDs.");
            }
            ids.add(id);
        }
    }
    return snapshot;
}

export function nextPositiveId(ids: number[]) {
    return Math.max(0, ...ids.filter((id) => id > 0)) + 1;
}
