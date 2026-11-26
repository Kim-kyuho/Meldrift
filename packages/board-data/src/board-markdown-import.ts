import { compileMarkdown } from "@meldrift/markdown-engine";
import {
    boardMargin,
    maxMemoHeight,
    memoWidth,
    mermaidSize,
    minMemoHeight,
} from "@meldrift/core/board-plan";
import {
    createTableItemId,
    tableSourceSchema,
    type TableSource,
} from "@meldrift/core/table-card";
import {
    createSyncId,
    parseBoardSnapshot,
    type BoardInfo,
    type BoardMemo,
    type BoardMermaid,
    type BoardSnapshot,
    type BoardTable,
} from "./board-state";

export const maxMarkdownImportBytes = 2 * 1024 * 1024;
export const maxImportedSections = 100;
const maxTableColumns = 20;
const maxTableRows = 100;
const defaultMemoColor = "#fffadc";
const linkGap = 24;
const sectionGap = 80;
const columnGap = 80;
const maxAttachmentsPerMemo = 4;

export type ImportedAttachment =
    | { type: "mermaid"; source: string }
    | { type: "table"; source: TableSource };

export type ImportedSection = {
    headingLevel: number | null;
    headingTitle: string;
    markdown: string;
    attachments: ImportedAttachment[];
};

export type MarkdownImportStats = {
    memos: number;
    tables: number;
    mermaids: number;
};

export type MarkdownImportResult = {
    snapshot: BoardSnapshot;
    stats: MarkdownImportStats;
    droppedSections: number;
};

const fenceOpenPattern = /^ {0,3}(`{3,}|~{3,})([^\n]*)$/;
const atxHeadingPattern = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*#*$/;
const wideCharacterPattern = /[\u1100-\u11FF\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60]/;
const headingHeightScale: Record<number, number> = { 1: 2, 2: 1.7, 3: 1.4, 4: 1.2, 5: 1.1, 6: 1 };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function isFenceClose(line: string, markerChar: string, markerLength: number): boolean {
    const trimmed = line.replace(/^ {0,3}/, "");
    if (!trimmed.startsWith(markerChar.repeat(markerLength))) {
        return false;
    }
    let index = 0;
    while (index < trimmed.length && trimmed[index] === markerChar) {
        index += 1;
    }
    return trimmed.slice(index).trim().length === 0;
}

function unescapeTableCell(value: string): string {
    return value
        .trim()
        .replace(/\\\|/g, "|")
        .replace(/<br\s*\/?>/gi, "\n");
}

function splitPipeRow(line: string): string[] | null {
    if (!line.includes("|")) {
        return null;
    }
    const trimmed = line.trim();
    if (!trimmed) {
        return null;
    }
    const cells: string[] = [];
    let current = "";
    let escaped = false;
    for (let index = 0; index < trimmed.length; index += 1) {
        const ch = trimmed[index];
        if (escaped) {
            current += `\\${ch}`;
            escaped = false;
            continue;
        }
        if (ch === "\\") {
            escaped = true;
            continue;
        }
        if (ch === "|") {
            cells.push(current);
            current = "";
            continue;
        }
        current += ch;
    }
    if (escaped) {
        current += "\\";
    }
    cells.push(current);

    if (trimmed.startsWith("|")) {
        cells.shift();
    }
    if (trimmed.endsWith("|") && !trimmed.endsWith("\\|")) {
        cells.pop();
    }
    return cells.length > 0 ? cells : null;
}

function isSeparatorCell(cell: string): boolean {
    return /^:?-{3,}:?$/.test(cell.trim());
}

function isTableSeparatorLine(line: string, expectedColumns: number): boolean {
    const cells = splitPipeRow(line);
    if (!cells || cells.length !== expectedColumns) {
        return false;
    }
    return cells.every(isSeparatorCell);
}

function parseGfmTable(headerCells: string[], bodyLines: string[]): TableSource | null {
    const normalizedHeaders = headerCells
        .slice(0, maxTableColumns)
        .map((cell) => unescapeTableCell(cell));
    if (normalizedHeaders.length === 0) {
        return null;
    }

    const columns = normalizedHeaders.map((name) => ({
        id: createTableItemId(),
        name,
    }));

    const parsedBodyRows = bodyLines
        .slice(0, maxTableRows)
        .map((line) => splitPipeRow(line) ?? [])
        .map((cells) => ({
            id: createTableItemId(),
            cells: Object.fromEntries(
                columns.map((column, index) => [
                    column.id,
                    unescapeTableCell(cells[index] ?? ""),
                ]),
            ),
        }));

    const rows = parsedBodyRows.length > 0
        ? parsedBodyRows
        : [{
            id: createTableItemId(),
            cells: Object.fromEntries(columns.map((column) => [column.id, ""])),
        }];

    const validated = tableSourceSchema.safeParse({ columns, rows });
    return validated.success ? validated.data : null;
}

export function parseMarkdownToSections(markdown: string): ImportedSection[] {
    const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
    const sections: ImportedSection[] = [];

    let headingLevel: number | null = null;
    let headingTitle = "";
    let markdownLines: string[] = [];
    let attachments: ImportedAttachment[] = [];

    const flushSection = () => {
        const joined = markdownLines.join("\n").trim();
        if (joined.length === 0 && attachments.length === 0) {
            return;
        }
        sections.push({
            headingLevel,
            headingTitle,
            markdown: joined,
            attachments,
        });
        headingLevel = null;
        headingTitle = "";
        markdownLines = [];
        attachments = [];
    };

    let index = 0;
    while (index < lines.length) {
        const line = lines[index];

        // 1. Fenced code block (``` or ~~~)
        const openFence = fenceOpenPattern.exec(line);
        if (openFence) {
            const marker = openFence[1];
            const markerChar = marker[0];
            const markerLength = marker.length;
            const infoString = openFence[2].trim();
            const language = infoString.split(/\s+/)[0]?.toLowerCase() ?? "";
            const isMermaid = language === "mermaid";

            const blockBody: string[] = [];
            let cursor = index + 1;
            let closed = false;
            while (cursor < lines.length) {
                if (isFenceClose(lines[cursor], markerChar, markerLength)) {
                    closed = true;
                    break;
                }
                blockBody.push(lines[cursor]);
                cursor += 1;
            }

            if (isMermaid && closed) {
                const mermaidSource = blockBody.join("\n").trim();
                if (mermaidSource.length > 0) {
                    attachments.push({ type: "mermaid", source: mermaidSource });
                }
                index = cursor + 1;
                continue;
            }

            // Keep non-mermaid (or unclosed) fenced blocks intact in the memo markdown.
            const end = closed ? cursor : lines.length - 1;
            for (let copy = index; copy <= end; copy += 1) {
                markdownLines.push(lines[copy]);
            }
            index = end + 1;
            continue;
        }

        // 2. ATX Heading (# ~ ######)
        const headingMatch = atxHeadingPattern.exec(line);
        if (headingMatch) {
            flushSection();
            headingLevel = headingMatch[1].length;
            headingTitle = (headingMatch[2] ?? "").trim();
            markdownLines.push(line);
            index += 1;
            continue;
        }

        // 3. GFM Pipe Table (header + separator + 0..N rows)
        if (index + 1 < lines.length) {
            const headerCells = splitPipeRow(line);
            if (headerCells && isTableSeparatorLine(lines[index + 1], headerCells.length)) {
                const bodyLines: string[] = [];
                let cursor = index + 2;
                while (cursor < lines.length) {
                    const candidate = lines[cursor];
                    if (
                        candidate.trim().length === 0
                        || fenceOpenPattern.test(candidate)
                        || atxHeadingPattern.test(candidate)
                        || !splitPipeRow(candidate)
                    ) {
                        break;
                    }
                    bodyLines.push(candidate);
                    cursor += 1;
                }
                const tableSource = parseGfmTable(headerCells, bodyLines);
                if (tableSource) {
                    attachments.push({ type: "table", source: tableSource });
                    index = cursor;
                    continue;
                }
            }
        }

        // 4. Plain markdown line
        markdownLines.push(line);
        index += 1;
    }

    flushSection();
    return sections;
}

function splitOversizedAttachments(sections: ImportedSection[]): ImportedSection[] {
    const result: ImportedSection[] = [];
    for (const section of sections) {
        if (section.attachments.length <= maxAttachmentsPerMemo) {
            result.push(section);
            continue;
        }
        const totalChunks = Math.ceil(section.attachments.length / maxAttachmentsPerMemo);
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
            const chunk = section.attachments.slice(
                chunkIndex * maxAttachmentsPerMemo,
                (chunkIndex + 1) * maxAttachmentsPerMemo,
            );
            if (chunkIndex === 0) {
                result.push({
                    ...section,
                    attachments: chunk,
                });
                continue;
            }
            const hashes = "#".repeat(section.headingLevel ?? 3);
            const title = section.headingTitle
                ? `${section.headingTitle} (${chunkIndex + 1})`
                : `Continued (${chunkIndex + 1})`;
            result.push({
                headingLevel: section.headingLevel ?? 3,
                headingTitle: title,
                markdown: `${hashes} ${title}`,
                attachments: chunk,
            });
        }
    }
    return result;
}

function visualUnits(text: string): number {
    let total = 0;
    for (const ch of text) {
        total += wideCharacterPattern.test(ch) ? 2 : 1;
    }
    return total;
}

function estimateMemoCardHeight(markdown: string): number {
    if (!markdown.trim()) {
        return minMemoHeight;
    }
    const lines = markdown.split("\n");
    const unitsPerLine = 46;
    let estimatedLines = 0;
    let blockTransitions = 0;
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
            blockTransitions += 1;
            continue;
        }
        const heading = atxHeadingPattern.exec(line);
        if (heading) {
            const scale = headingHeightScale[heading[1].length] ?? 1;
            const body = (heading[2] ?? "").trim();
            estimatedLines += Math.max(1, Math.ceil(visualUnits(body) / Math.max(8, unitsPerLine / scale))) * scale;
            blockTransitions += 1;
            continue;
        }
        estimatedLines += Math.max(1, Math.ceil(visualUnits(line) / (unitsPerLine - 4)));
    }
    const estimated = 40 + estimatedLines * 28 + blockTransitions * 12;
    return clamp(Math.round(estimated), minMemoHeight, maxMemoHeight);
}

function estimateTableCardSize(source: TableSource): { width: number; height: number } {
    const minWidth = Math.max(360, 42 + source.columns.length * 80);
    const minHeight = Math.max(128, 94 + source.rows.length * 37);
    return {
        width: Math.max(minWidth, clamp(source.columns.length * 140, 360, 720)),
        height: Math.max(minHeight, clamp(94 + source.rows.length * 37, 180, 960)),
    };
}

function estimateAttachmentSize(attachment: ImportedAttachment): { width: number; height: number } {
    return attachment.type === "mermaid"
        ? { ...mermaidSize }
        : estimateTableCardSize(attachment.source);
}

type CornerSlot = "TL" | "TR" | "BL" | "BR";

function cornerSlotsForCount(count: number): CornerSlot[] {
    if (count === 1) return ["TR"];
    if (count === 2) return ["TR", "BR"];
    if (count === 3) return ["TR", "BL", "BR"];
    if (count >= 4) return ["TL", "TR", "BL", "BR"];
    return [];
}

type PlacedAttachment = {
    attachment: ImportedAttachment;
    x: number;
    y: number;
    width: number;
    height: number;
};

type SectionLayout = {
    memoWidth: number;
    memoHeight: number;
    memoOffsetX: number;
    totalWidth: number;
    totalHeight: number;
    attachments: Array<{
        attachment: ImportedAttachment;
        offsetX: number;
        offsetY: number;
        width: number;
        height: number;
    }>;
};

function computeSectionLayout(section: ImportedSection): SectionLayout {
    const slots = cornerSlotsForCount(section.attachments.length);
    const sized = section.attachments.map((attachment, index) => ({
        attachment,
        slot: slots[index],
        ...estimateAttachmentSize(attachment),
    }));

    const tl = sized.find((item) => item.slot === "TL");
    const tr = sized.find((item) => item.slot === "TR");
    const bl = sized.find((item) => item.slot === "BL");
    const br = sized.find((item) => item.slot === "BR");

    let height = estimateMemoCardHeight(section.markdown);
    if (tr && br) {
        height = Math.max(height, tr.height + linkGap);
    }
    if (tl && bl) {
        height = Math.max(height, tl.height + linkGap);
    }

    const leftWidth = Math.max(tl?.width ?? 0, bl?.width ?? 0);
    const leftWing = leftWidth > 0 ? leftWidth + linkGap : 0;
    const rightWidth = Math.max(tr?.width ?? 0, br?.width ?? 0);
    const rightWing = rightWidth > 0 ? rightWidth + linkGap : 0;

    const placedAttachments = sized.map((item) => {
        if (item.slot === "TL") {
            return {
                attachment: item.attachment,
                offsetX: leftWing - linkGap - item.width,
                offsetY: 0,
                width: item.width,
                height: item.height,
            };
        }
        if (item.slot === "TR") {
            return {
                attachment: item.attachment,
                offsetX: leftWing + memoWidth + linkGap,
                offsetY: 0,
                width: item.width,
                height: item.height,
            };
        }
        if (item.slot === "BL") {
            return {
                attachment: item.attachment,
                offsetX: leftWing - linkGap - item.width,
                offsetY: height,
                width: item.width,
                height: item.height,
            };
        }
        return {
            attachment: item.attachment,
            offsetX: leftWing + memoWidth + linkGap,
            offsetY: height,
            width: item.width,
            height: item.height,
        };
    });

    const bottomExtent = placedAttachments.reduce(
        (maxY, item) => Math.max(maxY, item.offsetY + item.height),
        height,
    );

    return {
        memoWidth,
        memoHeight: height,
        memoOffsetX: leftWing,
        totalWidth: leftWing + memoWidth + rightWing,
        totalHeight: bottomExtent,
        attachments: placedAttachments,
    };
}

export function importMarkdownToBoard(markdown: string, targetBoard: BoardInfo): MarkdownImportResult {
    const rawSections = parseMarkdownToSections(markdown);
    if (rawSections.length === 0) {
        throw new Error("The Markdown file is empty.");
    }

    const expanded = splitOversizedAttachments(rawSections);
    const limited = expanded.slice(0, maxImportedSections);
    let droppedSections = Math.max(0, expanded.length - limited.length);

    const layouts = limited.map((section) => ({
        section,
        layout: computeSectionLayout(section),
    }));

    const memos: BoardMemo[] = [];
    const tables: BoardTable[] = [];
    const mermaids: BoardMermaid[] = [];

    let columnX = boardMargin;
    let columnWidth = 0;
    let cursorY = boardMargin;
    let nextZ = 1;
    let nextMemoId = 1;
    let nextTableId = 1;
    let nextMermaidId = 1;

    const maxX = targetBoard.width - boardMargin;
    const maxY = targetBoard.height - boardMargin;

    for (const { section, layout } of layouts) {
        if (cursorY > boardMargin && cursorY + layout.totalHeight > maxY) {
            columnX += columnWidth + columnGap;
            columnWidth = 0;
            cursorY = boardMargin;
        }

        if (columnX + layout.totalWidth > maxX || cursorY + layout.totalHeight > maxY) {
            droppedSections += 1;
            continue;
        }

        const memoX = Math.round(columnX + layout.memoOffsetX);
        const memoY = Math.round(cursorY);
        const content = section.markdown ? compileMarkdown(section.markdown) : "";

        memos.push({
            id: nextMemoId,
            syncId: createSyncId(),
            boardId: targetBoard.boardId,
            content,
            color: defaultMemoColor,
            sortOrder: nextMemoId,
            x: memoX,
            y: memoY,
            z: nextZ++,
            width: layout.memoWidth,
            height: layout.memoHeight,
        });
        nextMemoId += 1;

        for (const item of layout.attachments) {
            const placed: PlacedAttachment = {
                attachment: item.attachment,
                x: Math.round(columnX + item.offsetX),
                y: Math.round(cursorY + item.offsetY),
                width: item.width,
                height: item.height,
            };
            if (placed.attachment.type === "table") {
                tables.push({
                    id: nextTableId++,
                    syncId: createSyncId(),
                    boardId: targetBoard.boardId,
                    source: placed.attachment.source,
                    x: placed.x,
                    y: placed.y,
                    z: nextZ++,
                    width: placed.width,
                    height: placed.height,
                });
            } else {
                mermaids.push({
                    id: nextMermaidId++,
                    syncId: createSyncId(),
                    boardId: targetBoard.boardId,
                    source: placed.attachment.source,
                    x: placed.x,
                    y: placed.y,
                    z: nextZ++,
                    width: placed.width,
                    height: placed.height,
                });
            }
        }

        columnWidth = Math.max(columnWidth, layout.totalWidth);
        cursorY += layout.totalHeight + sectionGap;
    }

    if (memos.length === 0) {
        throw new Error("The Markdown content could not fit on this board.");
    }

    const snapshot = parseBoardSnapshot({
        board: targetBoard,
        memos,
        images: [],
        mermaids,
        tables,
        strokes: [],
    });

    return {
        snapshot,
        stats: {
            memos: memos.length,
            tables: tables.length,
            mermaids: mermaids.length,
        },
        droppedSections,
    };
}
