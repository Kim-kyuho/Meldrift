import { Dispatch, RefObject, SetStateAction, useCallback, useState } from "react";
import {
    getPlanCapacity,
    memoBlocksToHtml,
    planTableToSource,
    layoutArrangement,
    layoutBoardPlan,
    type BoardArrangement,
    type BoardBounds,
    type BoardDeletion,
    type BoardEdit,
    type BoardPlan,
    type GeneratedImage,
} from "@/lib/ai/board-plan";
import type { BoardImage } from "@/hooks/useBoardImages";
import type { BoardMemo } from "@/hooks/useBoardMemos";
import type { BoardMermaid } from "@/hooks/useBoardMermaids";
import type { BoardTable } from "@/hooks/useBoardTables";

export type AiChatMessage = {
    role: "user" | "assistant";
    content: string;
};

export type AiStatus = {
    available: boolean;
    message: string | null;
};

type PendingCards = {
    memoIds: number[];
    mermaidIds: number[];
    tableIds: number[];
};

const emptyPendingCards: PendingCards = { memoIds: [], mermaidIds: [], tableIds: [] };

type MovedCard = { id: number; x: number; y: number; previousX: number; previousY: number };

type PendingMoves = {
    memos: MovedCard[];
    mermaids: MovedCard[];
    tables: MovedCard[];
};

const emptyPendingMoves: PendingMoves = { memos: [], mermaids: [], tables: [] };

type PendingEdits = {
    memos: BoardMemo[];
    mermaids: BoardMermaid[];
    tables: BoardTable[];
};

const emptyPendingEdits: PendingEdits = { memos: [], mermaids: [], tables: [] };

type PendingDeletions = {
    memos: BoardMemo[];
    mermaids: BoardMermaid[];
    tables: BoardTable[];
    images: BoardImage[];
};

const emptyPendingDeletions: PendingDeletions = { memos: [], mermaids: [], tables: [], images: [] };

// 적용 단계마다 명시적으로 넘긴다 - 클로저를 읽으면 같은 tick에 건 setState가 안 보여서
// 연속 편집 시 Discard가 중간 버전으로 돌아갔음
type BoardCards = {
    memos: BoardMemo[];
    mermaids: BoardMermaid[];
    tables: BoardTable[];
    images: BoardImage[];
};

const base64ToFile = (data: string, mimeType: string, name: string) => {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }

    return new File([bytes], name, { type: mimeType });
};

const newColumnGap = 120;

const boardMarginOrigin = 40;

type UseAiAssistantOptions = {
    boardId: number;
    boardWidth: number;
    boardHeight: number;
    boardZoom: number;
    cardLocationRef: RefObject<HTMLDivElement | null>;
    canEditCard: boolean;
    showPermissionMessage: () => void;
    setPermissionMessage: (message: string) => void;
    memos: BoardMemo[];
    mermaids: BoardMermaid[];
    tables: BoardTable[];
    setMemos: Dispatch<SetStateAction<BoardMemo[]>>;
    setMermaids: Dispatch<SetStateAction<BoardMermaid[]>>;
    setTables: Dispatch<SetStateAction<BoardTable[]>>;
    onInsertMemo: (
        tempId: number, boardId: number, content: string,
        x: number, y: number, z: number, width: number, height: number, color: string,
    ) => Promise<void>;
    onInsertMermaid: (
        tempId: number, boardId: number, source: string,
        x: number, y: number, z: number, width: number, height: number,
    ) => Promise<void>;
    onInsertTable: (table: BoardTable) => Promise<void>;
    onUpdateMemo: (
        id: number, boardId: number, content: string,
        x: number, y: number, z: number, width: number, height: number, color: string,
    ) => Promise<void>;
    onUpdateMermaid: (
        id: number, boardId: number, source: string,
        x: number, y: number, z: number, width: number, height: number,
    ) => Promise<void>;
    onUpdateTable: (table: BoardTable) => Promise<void>;
    images: BoardImage[];
    setImages: Dispatch<SetStateAction<BoardImage[]>>;
    onInsertImage: (
        tempId: number, file: File, boardId: number,
        x: number, y: number, z: number, width: number, height: number,
    ) => Promise<void>;
    onDeleteMemo: (id: number) => Promise<void>;
    onDeleteMermaid: (id: number) => Promise<void>;
    onDeleteTable: (id: number) => Promise<void>;
    onDeleteImage: (imageId: number, publicId: string) => Promise<void>;
};

export function useAiAssistant({
    boardId,
    boardWidth,
    boardHeight,
    boardZoom,
    cardLocationRef,
    canEditCard,
    showPermissionMessage,
    setPermissionMessage,
    memos,
    mermaids,
    tables,
    setMemos,
    setMermaids,
    setTables,
    onInsertMemo,
    onInsertMermaid,
    onInsertTable,
    onUpdateMemo,
    onUpdateMermaid,
    onUpdateTable,
    images,
    setImages,
    onInsertImage,
    onDeleteMemo,
    onDeleteMermaid,
    onDeleteTable,
    onDeleteImage,
}: UseAiAssistantOptions) {
    const [aiPanelOpen, setAiPanelOpen] = useState(false);
    const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
    const [messages, setMessages] = useState<AiChatMessage[]>([]);
    const [sending, setSending] = useState(false);
    const [saving, setSaving] = useState(false);
    const [pendingCards, setPendingCards] = useState<PendingCards>(emptyPendingCards);
    const [pendingMoves, setPendingMoves] = useState<PendingMoves>(emptyPendingMoves);
    const [pendingEdits, setPendingEdits] = useState<PendingEdits>(emptyPendingEdits);
    const [pendingDeletions, setPendingDeletions] = useState<PendingDeletions>(emptyPendingDeletions);
    const [pendingImageIds, setPendingImageIds] = useState<number[]>([]);

    const hasPendingCards =
        pendingCards.memoIds.length > 0 ||
        pendingCards.mermaidIds.length > 0 ||
        pendingCards.tableIds.length > 0 ||
        pendingImageIds.length > 0 ||
        pendingMoves.memos.length > 0 ||
        pendingMoves.mermaids.length > 0 ||
        pendingMoves.tables.length > 0 ||
        pendingEdits.memos.length > 0 ||
        pendingEdits.mermaids.length > 0 ||
        pendingEdits.tables.length > 0 ||
        pendingDeletions.memos.length > 0 ||
        pendingDeletions.mermaids.length > 0 ||
        pendingDeletions.tables.length > 0 ||
        pendingDeletions.images.length > 0;

    const boardBounds: BoardBounds = { width: boardWidth, height: boardHeight };

    const refreshAiStatus = useCallback(async () => {
        const response = await fetch("/api/ai/status");
        const data = await response.json();

        if (!data.ok) {
            return null;
        }

        const status: AiStatus = { available: data.available, message: data.message ?? null };
        setAiStatus(status);

        return status;
    }, []);

    const currentCards = (): BoardCards => ({ memos, mermaids, tables, images });

    const commitCards = (cards: BoardCards) => {
        setMemos(cards.memos);
        setMermaids(cards.mermaids);
        setTables(cards.tables);
        setImages(cards.images);
    };

    const clearPending = () => {
        setPendingCards(emptyPendingCards);
        setPendingMoves(emptyPendingMoves);
        setPendingEdits(emptyPendingEdits);
        setPendingDeletions(emptyPendingDeletions);
        setPendingImageIds([]);
    };

    // 순수 함수 - 되돌린 결과를 그대로 다음 단계 base로 넘기기 위함
    const revertPendingCards = (cards: BoardCards): BoardCards => {
        const restore = <T extends { id: number; x: number; y: number }>(list: T[], moves: MovedCard[]) => {
            if (moves.length === 0) {
                return list;
            }
            const moveById = new Map(moves.map((move) => [move.id, move]));

            return list.map((card) => {
                const move = moveById.get(card.id);
                return move ? { ...card, x: move.previousX, y: move.previousY } : card;
            });
        };

        const revert = <T extends { id: number }>(list: T[], previous: T[], removed: T[]) => {
            const previousById = new Map(previous.map((card) => [card.id, card]));
            const reverted = list.map((card) => previousById.get(card.id) ?? card);

            return removed.length > 0 ? [...reverted, ...removed] : reverted;
        };

        cards.images
            .filter((image) => pendingImageIds.includes(image.imageId))
            .forEach((image) => URL.revokeObjectURL(image.secureUrl));

        const keptImages = cards.images.filter((image) => !pendingImageIds.includes(image.imageId));

        return {
            memos: revert(
                restore(cards.memos.filter((memo) => !pendingCards.memoIds.includes(memo.id)), pendingMoves.memos),
                pendingEdits.memos,
                pendingDeletions.memos
            ),
            mermaids: revert(
                restore(
                    cards.mermaids.filter((card) => !pendingCards.mermaidIds.includes(card.id)),
                    pendingMoves.mermaids
                ),
                pendingEdits.mermaids,
                pendingDeletions.mermaids
            ),
            tables: revert(
                restore(
                    cards.tables.filter((card) => !pendingCards.tableIds.includes(card.id)),
                    pendingMoves.tables
                ),
                pendingEdits.tables,
                pendingDeletions.tables
            ),
            images:
                pendingDeletions.images.length > 0 ? [...keptImages, ...pendingDeletions.images] : keptImages,
        };
    };

    const discardPendingCards = () => {
        commitCards(revertPendingCards(currentCards()));
        clearPending();
    };

    const handleToggleAiPanel = async () => {
        if (aiPanelOpen) {
            setAiPanelOpen(false);
            return;
        }

        if (!canEditCard) {
            showPermissionMessage();
            return;
        }

        const status = aiStatus ?? (await refreshAiStatus());

        if (!status?.available) {
            setPermissionMessage(status?.message ?? "The AI assistant is unavailable.");
            return;
        }

        setAiPanelOpen(true);
    };

    const getPlanOrigin = (base: BoardCards) => {
        const rightEdges = [
            ...base.memos.map((memo) => memo.x + memo.width),
            ...base.mermaids.map((mermaid) => mermaid.x + mermaid.width),
            ...base.tables.map((table) => table.x + table.width),
        ];
        const locationElement = cardLocationRef.current;
        const viewportTop = locationElement ? locationElement.scrollTop / boardZoom : 0;

        return {
            x: rightEdges.length > 0 ? Math.max(...rightEdges) + newColumnGap : newColumnGap,
            y: viewportTop + 80,
        };
    };

    const applyPlan = (plan: BoardPlan, base: BoardCards, generatedImages: GeneratedImage[] = []) => {
        const planned = layoutBoardPlan(plan, getPlanOrigin(base), boardBounds, generatedImages);
        // 증가 방향이어야 저장 전에도 메모 탐색 순서가 문서 순서와 같음
        const idBase = -Date.now();
        let idOffset = 0;
        const nextTempId = () => idBase + idOffset++;

        const newMemos: BoardMemo[] = planned.memos.map((memo) => ({
            id: nextTempId(),
            boardId,
            content: memo.content,
            x: memo.x,
            y: memo.y,
            z: 1,
            width: memo.width,
            height: memo.height,
            color: memo.color,
        }));
        const newMermaids: BoardMermaid[] = planned.mermaids.map((mermaid) => ({
            id: nextTempId(),
            boardId,
            source: mermaid.source,
            x: mermaid.x,
            y: mermaid.y,
            z: 1,
            width: mermaid.width,
            height: mermaid.height,
        }));
        const newTables: BoardTable[] = planned.tables.map((table) => ({
            id: nextTempId(),
            boardId,
            source: table.source,
            x: table.x,
            y: table.y,
            z: 1,
            width: table.width,
            height: table.height,
        }));

        const newImages: BoardImage[] = planned.images.map((image, index) => {
            const file = base64ToFile(image.data, image.mimeType, `ai-image-${index + 1}.png`);

            return {
                imageId: nextTempId(),
                boardId,
                publicId: "",
                secureUrl: URL.createObjectURL(file),
                fileName: image.alt,
                file,
                x: image.x,
                y: image.y,
                z: 1,
                width: image.width,
                height: image.height,
            };
        });

        commitCards({
            memos: [...base.memos, ...newMemos],
            mermaids: [...base.mermaids, ...newMermaids],
            tables: [...base.tables, ...newTables],
            images: [...base.images, ...newImages],
        });
        setPendingCards({
            memoIds: newMemos.map((memo) => memo.id),
            mermaidIds: newMermaids.map((mermaid) => mermaid.id),
            tableIds: newTables.map((table) => table.id),
        });
        setPendingImageIds(newImages.map((image) => image.imageId));

        const locationElement = cardLocationRef.current;
        if (locationElement && newMemos[0]) {
            locationElement.scrollTo({
                left: Math.max(0, newMemos[0].x * boardZoom - 120),
                top: Math.max(0, newMemos[0].y * boardZoom - 120),
                behavior: "smooth",
            });
        }

        return { droppedSections: planned.droppedSections, placed: newMemos.length };
    };

    const applyArrangement = (arrangement: BoardArrangement, base: BoardCards) => {
        const arranged = layoutArrangement(
            arrangement,
            { memos: base.memos, mermaids: base.mermaids, tables: base.tables },
            { x: boardMarginOrigin, y: boardMarginOrigin },
            boardBounds
        );

        const toMoves = <T extends { id: number; x: number; y: number }>(
            cards: T[],
            moves: { id: number; x: number; y: number }[]
        ): MovedCard[] => {
            const cardById = new Map(cards.map((card) => [card.id, card]));

            return moves.flatMap((move) => {
                const card = cardById.get(move.id);
                if (!card || (card.x === move.x && card.y === move.y)) {
                    return [];
                }
                return [{ ...move, previousX: card.x, previousY: card.y }];
            });
        };

        const memoMoves = toMoves(base.memos, arranged.memos);
        const mermaidMoves = toMoves(base.mermaids, arranged.mermaids);
        const tableMoves = toMoves(base.tables, arranged.tables);

        const applyMoves = <T extends { id: number; x: number; y: number }>(cards: T[], moves: MovedCard[]) => {
            if (moves.length === 0) {
                return cards;
            }
            const moveById = new Map(moves.map((move) => [move.id, move]));

            return cards.map((card) => {
                const move = moveById.get(card.id);
                return move ? { ...card, x: move.x, y: move.y } : card;
            });
        };

        commitCards({
            memos: applyMoves(base.memos, memoMoves),
            mermaids: applyMoves(base.mermaids, mermaidMoves),
            tables: applyMoves(base.tables, tableMoves),
            images: base.images,
        });
        setPendingMoves({ memos: memoMoves, mermaids: mermaidMoves, tables: tableMoves });

        const locationElement = cardLocationRef.current;
        if (locationElement && arranged.memos[0]) {
            locationElement.scrollTo({
                left: Math.max(0, arranged.memos[0].x * boardZoom - 120),
                top: Math.max(0, arranged.memos[0].y * boardZoom - 120),
                behavior: "smooth",
            });
        }

        return { droppedSections: arranged.droppedSections, moved: memoMoves.length };
    };

    const getBoardSnapshot = () => {
        const stripHtml = (html: string) =>
            html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

        return {
            memos: memos
                .filter((memo) => memo.id > 0)
                .map((memo) => ({ id: memo.id, summary: stripHtml(memo.content).slice(0, 120) || "(empty memo)" })),
            mermaids: mermaids
                .filter((card) => card.id > 0)
                .map((card) => ({ id: card.id, summary: card.source.split("\n")[0].slice(0, 120) })),
            tables: tables
                .filter((card) => card.id > 0)
                .map((card) => ({
                    id: card.id,
                    summary: card.source.columns.map((column) => column.name).join(", ").slice(0, 120),
                })),
            images: images
                .filter((image) => image.imageId > 0)
                .map((image) => ({
                    id: image.imageId,
                    summary: (image.fileName ?? "image").slice(0, 120),
                })),
            capacity: getPlanCapacity(boardBounds),
        };
    };

    const applyEdit = (edit: BoardEdit, base: BoardCards) => {
        const memoEdits = new Map((edit.memos ?? []).map((item) => [item.id, item]));
        const mermaidEdits = new Map((edit.mermaids ?? []).map((item) => [item.id, item]));
        const tableEdits = new Map((edit.tables ?? []).map((item) => [item.id, item]));

        const changedMemos = base.memos.filter((memo) => memoEdits.has(memo.id));
        const changedMermaids = base.mermaids.filter((card) => mermaidEdits.has(card.id));
        const changedTables = base.tables.filter((card) => tableEdits.has(card.id));
        const changedCount = changedMemos.length + changedMermaids.length + changedTables.length;

        if (changedCount === 0) {
            return 0;
        }

        commitCards({
            memos: base.memos.map((memo) => {
                const change = memoEdits.get(memo.id);

                if (!change) {
                    return memo;
                }

                return {
                    ...memo,
                    content: change.blocks ? memoBlocksToHtml(change.blocks) : memo.content,
                    color: change.color ?? memo.color,
                };
            }),
            mermaids: base.mermaids.map((card) => {
                const change = mermaidEdits.get(card.id);
                return change ? { ...card, source: change.source } : card;
            }),
            tables: base.tables.map((card) => {
                const change = tableEdits.get(card.id);
                return change
                    ? { ...card, source: planTableToSource(change.columns, change.rows) }
                    : card;
            }),
            images: base.images,
        });

        // 이미 기록된 카드는 덮지 않음 - 연속 편집에서도 맨 처음 값으로 되돌리기 위함
        setPendingEdits((prev) => {
            const keep = <T extends { id: number }>(previous: T[], candidates: T[]) => {
                const known = new Set(previous.map((card) => card.id));
                return [...previous, ...candidates.filter((card) => !known.has(card.id))];
            };

            return {
                memos: keep(prev.memos, changedMemos),
                mermaids: keep(prev.mermaids, changedMermaids),
                tables: keep(prev.tables, changedTables),
            };
        });

        return changedCount;
    };

    const applyDeletion = (deletion: BoardDeletion, base: BoardCards) => {
        const memoIds = new Set(deletion.memoIds ?? []);
        const mermaidIds = new Set(deletion.mermaidIds ?? []);
        const tableIds = new Set(deletion.tableIds ?? []);
        const imageIds = new Set(deletion.imageIds ?? []);

        const removedMemos = base.memos.filter((memo) => memoIds.has(memo.id));
        const removedMermaids = base.mermaids.filter((card) => mermaidIds.has(card.id));
        const removedTables = base.tables.filter((card) => tableIds.has(card.id));
        // 미저장 이미지는 삭제 대상이 아님
        const removedImages = base.images.filter((image) => imageIds.has(image.imageId) && image.imageId > 0);
        const removedCount =
            removedMemos.length + removedMermaids.length + removedTables.length + removedImages.length;

        if (removedCount === 0) {
            return 0;
        }

        commitCards({
            memos: base.memos.filter((memo) => !memoIds.has(memo.id)),
            mermaids: base.mermaids.filter((card) => !mermaidIds.has(card.id)),
            tables: base.tables.filter((card) => !tableIds.has(card.id)),
            images: base.images.filter((image) => !imageIds.has(image.imageId) || image.imageId < 0),
        });

        setPendingDeletions((prev) => ({
            memos: [...prev.memos, ...removedMemos],
            mermaids: [...prev.mermaids, ...removedMermaids],
            tables: [...prev.tables, ...removedTables],
            images: [...prev.images, ...removedImages],
        }));

        return removedCount;
    };

    const handleSendMessage = async (text: string) => {
        const content = text.trim();

        if (!content || sending) {
            return;
        }

        const nextMessages: AiChatMessage[] = [...messages, { role: "user", content }];
        setMessages(nextMessages);
        setSending(true);

        try {
            const response = await fetch("/api/ai/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    boardId,
                    messages: nextMessages.slice(-20),
                    snapshot: getBoardSnapshot(),
                }),
            });
            const data = await response.json();

            if (!data.ok) {
                setPermissionMessage(data.message ?? "The AI assistant could not respond.");
                setMessages(nextMessages);
                return;
            }

            const notes: string[] = [];

            let base = currentCards();

            if (data.plan || data.arrangement || data.edit || data.deletion) {
                if (hasPendingCards) {
                    base = revertPendingCards(base);
                    commitCards(base);
                    clearPending();
                }
            }

            if (data.plan) {
                const result = applyPlan(data.plan, base, data.images ?? []);
                const requestedImages = data.plan.sections.filter(
                    (section: { attachment?: { type?: string } }) => section.attachment?.type === "image"
                ).length;
                const madeImages = (data.images ?? []).length;

                if (requestedImages > madeImages) {
                    notes.push(`Skipped ${requestedImages - madeImages} image(s) that could not be generated.`);
                }
                if (result.droppedSections > 0) {
                    notes.push(
                        `Could not place ${result.droppedSections} section(s) because the board is full. Clear some space or use a larger board.`
                    );
                }
            }

            if (data.edit) {
                const changed = applyEdit(data.edit, base);

                if (changed === 0) {
                    notes.push("Could not find those cards on this board.");
                }
            }

            if (data.deletion) {
                const removed = applyDeletion(data.deletion, base);

                if (removed === 0) {
                    notes.push("Could not find those cards on this board.");
                }
            }

            if (data.arrangement) {
                const result = applyArrangement(data.arrangement, base);
                if (result.moved === 0) {
                    notes.push("There was nothing to move.");
                }
                if (result.droppedSections > 0) {
                    notes.push(`Left ${result.droppedSections} card(s) in place because the board is full.`);
                }
            }

            setMessages([
                ...nextMessages,
                { role: "assistant", content: [data.reply, ...notes].filter(Boolean).join("\n\n") },
            ]);
        } catch (error) {
            console.error("Error sending AI message:", error);
            setPermissionMessage("The AI assistant could not respond.");
        } finally {
            setSending(false);
        }
    };

    // 메모는 순서대로 저장 - serial ID 순서가 곧 문서 순서
    const handleSavePendingCards = async () => {
        if (!hasPendingCards || saving) {
            return;
        }

        setSaving(true);

        try {
            for (const memoId of pendingCards.memoIds) {
                const memo = memos.find((item) => item.id === memoId);
                if (!memo) {
                    continue;
                }
                await onInsertMemo(
                    memo.id, memo.boardId, memo.content,
                    memo.x, memo.y, memo.z, memo.width, memo.height, memo.color,
                );
            }

            for (const mermaidId of pendingCards.mermaidIds) {
                const mermaid = mermaids.find((item) => item.id === mermaidId);
                if (!mermaid) {
                    continue;
                }
                await onInsertMermaid(
                    mermaid.id, mermaid.boardId, mermaid.source,
                    mermaid.x, mermaid.y, mermaid.z, mermaid.width, mermaid.height,
                );
            }

            for (const tableId of pendingCards.tableIds) {
                const table = tables.find((item) => item.id === tableId);
                if (!table) {
                    continue;
                }
                await onInsertTable(table);
            }

            for (const imageId of pendingImageIds) {
                const image = images.find((item) => item.imageId === imageId);
                if (!image?.file) {
                    continue;
                }
                await onInsertImage(
                    image.imageId, image.file, image.boardId,
                    image.x, image.y, image.z, image.width, image.height,
                );
            }

            for (const previous of pendingEdits.memos) {
                const memo = memos.find((item) => item.id === previous.id);
                if (!memo) {
                    continue;
                }
                await onUpdateMemo(
                    memo.id, memo.boardId, memo.content,
                    memo.x, memo.y, memo.z, memo.width, memo.height, memo.color,
                );
            }

            for (const previous of pendingEdits.mermaids) {
                const mermaid = mermaids.find((item) => item.id === previous.id);
                if (!mermaid) {
                    continue;
                }
                await onUpdateMermaid(
                    mermaid.id, mermaid.boardId, mermaid.source,
                    mermaid.x, mermaid.y, mermaid.z, mermaid.width, mermaid.height,
                );
            }

            for (const previous of pendingEdits.tables) {
                const table = tables.find((item) => item.id === previous.id);
                if (!table) {
                    continue;
                }
                await onUpdateTable(table);
            }

            // 지우기는 마지막 - 앞 단계가 실패해도 원본이 남게
            for (const memo of pendingDeletions.memos) {
                await onDeleteMemo(memo.id);
            }
            for (const mermaid of pendingDeletions.mermaids) {
                await onDeleteMermaid(mermaid.id);
            }
            for (const table of pendingDeletions.tables) {
                await onDeleteTable(table.id);
            }
            for (const image of pendingDeletions.images) {
                await onDeleteImage(image.imageId, image.publicId);
            }

            for (const move of pendingMoves.memos) {
                const memo = memos.find((item) => item.id === move.id);
                if (!memo) {
                    continue;
                }
                await onUpdateMemo(
                    memo.id, memo.boardId, memo.content,
                    move.x, move.y, memo.z, memo.width, memo.height, memo.color,
                );
            }

            for (const move of pendingMoves.mermaids) {
                const mermaid = mermaids.find((item) => item.id === move.id);
                if (!mermaid) {
                    continue;
                }
                await onUpdateMermaid(
                    mermaid.id, mermaid.boardId, mermaid.source,
                    move.x, move.y, mermaid.z, mermaid.width, mermaid.height,
                );
            }

            for (const move of pendingMoves.tables) {
                const table = tables.find((item) => item.id === move.id);
                if (!table) {
                    continue;
                }
                await onUpdateTable({ ...table, x: move.x, y: move.y });
            }

            setPendingCards(emptyPendingCards);
            setPendingMoves(emptyPendingMoves);
            setPendingEdits(emptyPendingEdits);
            setPendingDeletions(emptyPendingDeletions);
            setPendingImageIds([]);
        } finally {
            setSaving(false);
        }
    };

    return {
        aiPanelOpen,
        aiStatus,
        messages,
        sending,
        saving,
        hasPendingCards,
        refreshAiStatus,
        handleToggleAiPanel,
        handleSendMessage,
        handleSavePendingCards,
        discardPendingCards,
    };
}
