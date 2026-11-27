import TurndownService from "turndown";
import { cardTypeOrder, isCardWithinCornerRadius, type CardType } from "@meldrift/core/cards";
import type { BoardSnapshot } from "@meldrift/board-data/board-state";
import { sortMemosByOrder } from "@meldrift/core/memo-order";
import { tableSourceToMarkdown, type TableSource } from "@meldrift/core/table-card";

export type BoardMarkdownImageAsset = {
    path: string;
    data: Uint8Array;
    mimeType: string;
};

export type BoardMarkdownDocument = {
    markdown: string;
    imageAssets: BoardMarkdownImageAsset[];
};

export type BoardDocumentAttachment =
    | {
        kind: "table";
        key: string;
        id: number;
        syncId: string;
        cornerIndex: number;
        source: TableSource;
    }
    | {
        kind: "mermaid";
        key: string;
        id: number;
        syncId: string;
        cornerIndex: number;
        source: string;
    }
    | {
        kind: "image";
        key: string;
        id: number;
        syncId: string;
        cornerIndex: number;
        label: string | null;
        assetPath: string | null;
        url: string;
    };

export type BoardDocumentSection = {
    key: string;
    memoId: number;
    syncId: string;
    sortOrder: number;
    html: string;
    attachments: BoardDocumentAttachment[];
};

export type BoardCompiledDocument = BoardMarkdownDocument & {
    sections: BoardDocumentSection[];
    unlinkedCardCount: number;
};

type BoardCard = {
    // 메모는 문서의 뼈대라 카드 후보가 아니다. 카드 종류가 늘면 여기서 컴파일 에러로 잡힌다.
    type: Exclude<CardType, "memo">;
    id: number;
    syncId: string;
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
    imageAsset: BoardMarkdownImageAsset | null;
    attachment: BoardDocumentAttachment;
};

const turndown = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
});

turndown.addRule("strikethrough", {
    filter: ["del", "s"],
    replacement: (content) => `~~${content}~~`,
});

const escapeImageLabel = (label: string) => label.replaceAll("[", "\\[").replaceAll("]", "\\]");

function renderAttachmentMarkdown(attachment: BoardDocumentAttachment) {
    if (attachment.kind === "image") {
        const src = attachment.assetPath ?? attachment.url;
        return `![${escapeImageLabel(attachment.label?.trim() || "Image")}](${src})`;
    }
    if (attachment.kind === "mermaid") {
        return `\`\`\`mermaid\n${attachment.source.trim()}\n\`\`\``;
    }
    return tableSourceToMarkdown(attachment.source);
}

export function buildBoardDocumentSections(snapshot: BoardSnapshot): {
    sections: BoardDocumentSection[];
    imageAssets: BoardMarkdownImageAsset[];
    unlinkedCardCount: number;
} {
    const cards: BoardCard[] = [
        ...snapshot.images.map((image) => {
            const imageAsset = image.data && image.mimeType
                ? {
                    path: `images/image-${image.imageId}.png`,
                    data: image.data,
                    mimeType: image.mimeType,
                }
                : null;
            const assetPath = imageAsset ? `./${imageAsset.path}` : null;

            return {
                type: "image" as const,
                id: image.imageId,
                syncId: image.syncId,
                x: image.x,
                y: image.y,
                z: image.z,
                width: image.width,
                height: image.height,
                imageAsset,
                attachment: {
                    kind: "image" as const,
                    key: `image:${image.syncId}`,
                    id: image.imageId,
                    syncId: image.syncId,
                    cornerIndex: 0,
                    label: image.label,
                    assetPath,
                    url: image.url,
                },
            };
        }),
        ...snapshot.mermaids.map((mermaid) => ({
            type: "mermaid" as const,
            id: mermaid.id,
            syncId: mermaid.syncId,
            x: mermaid.x,
            y: mermaid.y,
            z: mermaid.z,
            width: mermaid.width,
            height: mermaid.height,
            imageAsset: null,
            attachment: {
                kind: "mermaid" as const,
                key: `mermaid:${mermaid.syncId}`,
                id: mermaid.id,
                syncId: mermaid.syncId,
                cornerIndex: 0,
                source: mermaid.source,
            },
        })),
        ...snapshot.tables.map((table) => ({
            type: "table" as const,
            id: table.id,
            syncId: table.syncId,
            x: table.x,
            y: table.y,
            z: table.z,
            width: table.width,
            height: table.height,
            imageAsset: null,
            attachment: {
                kind: "table" as const,
                key: `table:${table.syncId}`,
                id: table.id,
                syncId: table.syncId,
                cornerIndex: 0,
                source: table.source,
            },
        })),
    ];

    const sections: BoardDocumentSection[] = [];
    const imageAssets: BoardMarkdownImageAsset[] = [];
    const renderedCards = new Set<string>();

    sortMemosByOrder(snapshot.memos).forEach((memo) => {
        const attachments: BoardDocumentAttachment[] = [];
        const corners: [number, number][] = [
            [memo.x, memo.y],
            [memo.x + memo.width, memo.y],
            [memo.x, memo.y + memo.height],
            [memo.x + memo.width, memo.y + memo.height],
        ];

        corners.forEach(([cornerX, cornerY], cornerIndex) => {
            const card = cards
                .filter((candidate) => isCardWithinCornerRadius(candidate, cornerX, cornerY))
                .sort((left, right) =>
                    right.z - left.z
                    || cardTypeOrder[left.type] - cardTypeOrder[right.type]
                    || left.id - right.id)[0];
            if (!card) {
                return;
            }

            const key = `${card.type}:${card.id}`;
            if (renderedCards.has(key)) {
                return;
            }
            renderedCards.add(key);
            attachments.push({ ...card.attachment, cornerIndex });
            if (card.imageAsset) {
                imageAssets.push(card.imageAsset);
            }
        });

        sections.push({
            key: `memo:${memo.syncId}`,
            memoId: memo.id,
            syncId: memo.syncId,
            sortOrder: memo.sortOrder,
            html: memo.content,
            attachments,
        });
    });

    return {
        sections,
        imageAssets,
        unlinkedCardCount: Math.max(0, cards.length - renderedCards.size),
    };
}

export function compileBoardMarkdown(snapshot: BoardSnapshot) {
    return compileBoardMarkdownDocument(snapshot).markdown;
}

export function compileBoardMarkdownDocument(snapshot: BoardSnapshot): BoardCompiledDocument {
    const { sections, imageAssets, unlinkedCardCount } = buildBoardDocumentSections(snapshot);
    const markdownParts: string[] = [];

    sections.forEach((section) => {
        const memoMarkdown = turndown.turndown(section.html).trim();
        if (memoMarkdown) {
            markdownParts.push(memoMarkdown);
        }
        section.attachments.forEach((attachment) => {
            markdownParts.push(renderAttachmentMarkdown(attachment));
        });
    });

    return {
        markdown: markdownParts.filter(Boolean).join("\n\n"),
        imageAssets,
        sections,
        unlinkedCardCount,
    };
}
