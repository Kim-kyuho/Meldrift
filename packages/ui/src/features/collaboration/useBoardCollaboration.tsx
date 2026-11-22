"use client";

import {
    useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
    type Dispatch, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject, type SetStateAction,
} from "react";
import type { BoardStroke } from "@meldrift/core/board-stroke";
import type { CardType, SelectedCard } from "@meldrift/core/cards";
import type { BoardImage, BoardMemo, BoardMermaid, BoardTable } from "@meldrift/board-data/board-state";
import { memoOrderKey, objectKeyOf, strokeLayerKey } from "@meldrift/board-data/board-delta";
import { applyRemotePatch, type BoardCollections, type RemotePatch } from "@meldrift/board-data/remote-patch";
import type { LockedCard } from "./CollaborationLayer";
import { lockActivity } from "./CollaborationLayer";
import type { BoardCollaboration, CollaborationIntent, CollaborationLock, LockDenial } from "./types";

type Collections = {
    memos: BoardMemo[];
    images: BoardImage[];
    mermaids: BoardMermaid[];
    tables: BoardTable[];
    strokes: BoardStroke[];
};

type Setters = {
    setMemos: Dispatch<SetStateAction<BoardMemo[]>>;
    setImages: Dispatch<SetStateAction<BoardImage[]>>;
    setMermaids: Dispatch<SetStateAction<BoardMermaid[]>>;
    setTables: Dispatch<SetStateAction<BoardTable[]>>;
    setStrokes: Dispatch<SetStateAction<BoardStroke[]>>;
};

type Baseline =
    | { kind: "card"; type: CardType; card: BoardMemo | BoardImage | BoardMermaid | BoardTable | null }
    | { kind: "order"; orders: Map<string, number> }
    | { kind: "strokes"; strokes: BoardStroke[] };

type Options = Collections & Setters & {
    live: BoardCollaboration | null;
    editingIds: Record<CardType, number | null>;
    selectedCards: SelectedCard[];
    groupOffset: { x: number; y: number } | null;
    draggingMemoId: number | null;
    drawingMode: boolean;
    drawingTool: string;
    zoom: number;
    boardRef: RefObject<HTMLDivElement | null>;
    setAppliedRemoteSeq: (seq: number) => void;
    projectRemote: (patch: RemotePatch) => void;
    clearSelection: () => void;
    setMessage: (message: string) => void;
};

type AnyCard = BoardMemo | BoardImage | BoardMermaid | BoardTable;

const localIdOf = (type: CardType, card: AnyCard) => type === "image" ? (card as BoardImage).imageId : (card as BoardMemo).id;

const emptyCollections: BoardCollections = { memos: [], images: [], mermaids: [], tables: [], strokes: [] };

function patchOne<K extends keyof BoardCollections>(key: K, items: BoardCollections[K], patch: RemotePatch) {
    return applyRemotePatch({ ...emptyCollections, [key]: items }, patch)[key];
}

export const blockedText = (email: string | null, activity: string) =>
    `${email ?? "Another member"} is ${activity} this. Try again when they finish.`;

const denialText = (denial: LockDenial) => denial.offline
    ? "The live connection was interrupted. Try again in a moment."
    : blockedText(denial.email, "editing");

export function useBoardCollaboration(options: Options) {
    const {
        live, memos, images, mermaids, tables, strokes,
        setMemos, setImages, setMermaids, setTables, setStrokes,
        editingIds, selectedCards, groupOffset, draggingMemoId, drawingMode, drawingTool,
        zoom, boardRef, setAppliedRemoteSeq, projectRemote, clearSelection, setMessage,
    } = options;
    // 협업 객체는 상태가 바뀔 때마다 새로 만들어진다. effect는 런타임마다 고정된 함수만 의존한다.
    const syncDesired = live?.syncDesired;
    const onDenied = live?.onDenied;
    const subscribeRemote = live?.subscribeRemote;
    const publishCursor = live?.publishCursor;
    const publishTransients = live?.publishTransients;
    const [pointerKey, setPointerKey] = useState<string | null>(null);
    const [eraserUsed, setEraserUsed] = useState(false);
    const [remoteVersions, setRemoteVersions] = useState<ReadonlyMap<string, number>>(new Map());
    const baselines = useRef(new Map<string, Baseline>());
    const collectionsRef = useRef<Collections>({ memos, images, mermaids, tables, strokes });
    const heldRef = useRef<ReadonlySet<string>>(new Set());
    const selectedRef = useRef(selectedCards);
    useLayoutEffect(() => {
        collectionsRef.current = { memos, images, mermaids, tables, strokes };
        heldRef.current = live?.heldKeys ?? new Set();
        selectedRef.current = selectedCards;
    });

    const cardsOf = useCallback((type: CardType): AnyCard[] => {
        const current = collectionsRef.current;
        if (type === "memo") {
            return current.memos;
        }
        if (type === "image") {
            return current.images;
        }
        return type === "mermaid" ? current.mermaids : current.tables;
    }, []);

    const keyOfLocal = useCallback((type: CardType, id: number) => {
        if (id < 0) {
            return null;
        }
        const card = cardsOf(type).find((item) => localIdOf(type, item) === id);
        return card ? objectKeyOf(type, card.syncId) : null;
    }, [cardsOf]);

    // 드로잉 모드 동안 한 번이라도 지우개를 썼다면 모드를 끝낼 때까지 기존 획 잠금을 유지한다.
    if (!drawingMode && eraserUsed) {
        setEraserUsed(false);
    } else if (drawingMode && drawingTool === "erase" && !eraserUsed) {
        setEraserUsed(true);
    }

    const renderCards: Record<CardType, AnyCard[]> = { memo: memos, image: images, mermaid: mermaids, table: tables };
    const keyNow = (type: CardType, id: number) => {
        const card = id < 0 ? undefined : renderCards[type].find((item) => localIdOf(type, item) === id);
        return card ? objectKeyOf(type, card.syncId) : null;
    };
    const desired = new Map<string, CollaborationIntent>();
    if (live) {
        if (pointerKey) {
            desired.set(pointerKey, "move");
        }
        if (groupOffset) {
            for (const card of selectedCards) {
                const key = keyNow(card.type, card.id);
                if (key) {
                    desired.set(key, "move");
                }
            }
        }
        for (const type of ["memo", "image", "mermaid", "table"] as const) {
            const id = editingIds[type];
            const key = id === null ? null : keyNow(type, id);
            if (key) {
                desired.set(key, "edit");
            }
        }
        if (draggingMemoId !== null) {
            desired.set(memoOrderKey, "move");
        }
        if (drawingMode && eraserUsed) {
            desired.set(strokeLayerKey, "edit");
        }
    }
    const signature = [...desired].map(([key, intent]) => `${key}=${intent}`).sort().join("|");

    const rememberBaseline = useCallback((key: string) => {
        if (baselines.current.has(key) || heldRef.current.has(key)) {
            return;
        }
        if (key === memoOrderKey) {
            baselines.current.set(key, {
                kind: "order",
                orders: new Map(collectionsRef.current.memos.map((memo) => [memo.syncId, memo.sortOrder])),
            });
            return;
        }
        if (key === strokeLayerKey) {
            baselines.current.set(key, { kind: "strokes", strokes: collectionsRef.current.strokes });
            return;
        }
        const [type, syncId] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
        if (type === "memo" || type === "image" || type === "mermaid" || type === "table") {
            const card = cardsOf(type).find((item) => item.syncId === syncId) ?? null;
            baselines.current.set(key, { kind: "card", type, card });
        }
    }, [cardsOf]);

    useEffect(() => {
        if (!syncDesired) {
            return;
        }
        const next = new Map<string, CollaborationIntent>();
        for (const entry of signature ? signature.split("|") : []) {
            const separator = entry.lastIndexOf("=");
            const key = entry.slice(0, separator);
            next.set(key, entry.slice(separator + 1) as CollaborationIntent);
            rememberBaseline(key);
        }
        syncDesired(next);
    }, [syncDesired, signature, rememberBaseline]);

    // 잠금을 얻은 키의 기준값은 더 필요 없다.
    useEffect(() => {
        for (const key of [...baselines.current.keys()]) {
            if (live?.heldKeys.has(key)) {
                baselines.current.delete(key);
            }
        }
    }, [live?.heldKeys]);

    const bumpVersions = useCallback((keys: string[]) => {
        setRemoteVersions((previous) => {
            const next = new Map(previous);
            for (const key of keys) {
                next.set(key, (next.get(key) ?? 0) + 1);
            }
            return next;
        });
    }, []);

    const restore = useCallback((keys: string[]) => {
        for (const key of keys) {
            const baseline = baselines.current.get(key);
            baselines.current.delete(key);
            if (!baseline) {
                continue;
            }
            if (baseline.kind === "order") {
                setMemos((previous) => previous.map((memo) => {
                    const sortOrder = baseline.orders.get(memo.syncId);
                    return sortOrder === undefined || sortOrder === memo.sortOrder ? memo : { ...memo, sortOrder };
                }));
                continue;
            }
            if (baseline.kind === "strokes") {
                setStrokes(baseline.strokes);
                continue;
            }
            const syncId = key.slice(key.indexOf(":") + 1);
            const replace = <T extends AnyCard>(previous: T[]) => {
                const without = previous.filter((item) => item.syncId !== syncId);
                if (!baseline.card) {
                    return without;
                }
                const index = previous.findIndex((item) => item.syncId === syncId);
                if (index < 0) {
                    return [...without, baseline.card as T];
                }
                return previous.map((item) => item.syncId === syncId ? baseline.card as T : item);
            };
            if (baseline.type === "memo") {
                setMemos(replace);
            } else if (baseline.type === "image") {
                setImages(replace);
            } else if (baseline.type === "mermaid") {
                setMermaids(replace);
            } else {
                setTables(replace);
            }
        }
        bumpVersions(keys);
    }, [bumpVersions, setMemos, setImages, setMermaids, setTables, setStrokes]);

    useEffect(() => {
        if (!onDenied) {
            return;
        }
        return onDenied((denial: LockDenial) => {
            restore(denial.keys);
            setPointerKey((current) => current && denial.keys.includes(current) ? null : current);
            setMessage(denialText(denial));
        });
    }, [onDenied, restore, setMessage]);

    useEffect(() => {
        if (!subscribeRemote) {
            return;
        }
        return subscribeRemote((batch) => {
            setAppliedRemoteSeq(batch.seq);
            projectRemote(batch.patch);
            setMemos((previous) => patchOne("memos", previous, batch.patch));
            setImages((previous) => patchOne("images", previous, batch.patch));
            setMermaids((previous) => patchOne("mermaids", previous, batch.patch));
            setTables((previous) => patchOne("tables", previous, batch.patch));
            setStrokes((previous) => patchOne("strokes", previous, batch.patch));
            // 내가 쥔 카드는 다시 마운트하지 않는다. 끌기 도중의 Rnd 상태를 잃지 않기 위해서다.
            bumpVersions(batch.patch.keys.filter((key) => !heldRef.current.has(key)));
            const deleted = new Set(batch.patch.deletes);
            const selectionHit = selectedRef.current.some((card) => {
                const key = keyOfLocal(card.type, card.id);
                return key !== null && deleted.has(key);
            });
            if (selectionHit) {
                clearSelection();
            }
        });
    }, [subscribeRemote, setAppliedRemoteSeq, projectRemote, setMemos, setImages, setMermaids, setTables, setStrokes,
        bumpVersions, keyOfLocal, clearSelection]);

    // 카드 위에서 시작한 포인터 입력은 그 카드의 잠금이 필요하다. 툴바 포털에서 올라온 이벤트도 여기를 지난다.
    useEffect(() => {
        if (!pointerKey) {
            return;
        }
        const end = () => setPointerKey(null);
        window.addEventListener("pointerup", end);
        window.addEventListener("pointercancel", end);
        window.addEventListener("blur", end);
        return () => {
            window.removeEventListener("pointerup", end);
            window.removeEventListener("pointercancel", end);
            window.removeEventListener("blur", end);
        };
    }, [pointerKey]);

    const toBoardPoint = useCallback((clientX: number, clientY: number) => {
        const rect = boardRef.current?.getBoundingClientRect();
        if (!rect) {
            return null;
        }
        return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom };
    }, [boardRef, zoom]);

    const handleCursorMove = useCallback((event: ReactPointerEvent) => {
        if (!publishCursor || event.pointerType === "touch") {
            return;
        }
        const point = toBoardPoint(event.clientX, event.clientY);
        if (point) {
            publishCursor({ x: Math.round(point.x), y: Math.round(point.y) });
        }
    }, [publishCursor, toBoardPoint]);

    const handleCursorLeave = useCallback(() => {
        publishCursor?.(null);
    }, [publishCursor]);

    // 내가 끄는 카드의 화면 위치를 프레임마다 읽어 보낸다. 카드 컴포넌트는 끄는 중의 좌표를 밖으로 알리지 않는다.
    const pointerHeld = Boolean(live && pointerKey && live.heldKeys.has(pointerKey));
    useEffect(() => {
        if (!publishTransients || !pointerKey || !pointerHeld) {
            return;
        }
        let frame = 0;
        let last = "";
        const read = () => {
            const element = document.querySelector(`[data-live-key="${CSS.escape(pointerKey)}"] .react-draggable`);
            const rect = element?.getBoundingClientRect();
            const origin = rect ? toBoardPoint(rect.left, rect.top) : null;
            if (rect && origin) {
                const item = {
                    key: pointerKey,
                    x: Math.round(origin.x),
                    y: Math.round(origin.y),
                    width: Math.max(1, Math.round(rect.width / zoom)),
                    height: Math.max(1, Math.round(rect.height / zoom)),
                };
                const serialized = `${item.x},${item.y},${item.width},${item.height}`;
                if (serialized !== last) {
                    last = serialized;
                    publishTransients([item]);
                }
            }
            frame = requestAnimationFrame(read);
        };
        frame = requestAnimationFrame(read);
        return () => cancelAnimationFrame(frame);
    }, [publishTransients, pointerKey, pointerHeld, toBoardPoint, zoom]);

    useEffect(() => {
        if (!publishTransients || !groupOffset) {
            return;
        }
        const items = selectedRef.current.flatMap((selected) => {
            const card = cardsOf(selected.type).find((item) => localIdOf(selected.type, item) === selected.id);
            if (!card || !heldRef.current.has(objectKeyOf(selected.type, card.syncId))) {
                return [];
            }
            return [{
                key: objectKeyOf(selected.type, card.syncId),
                x: card.x + groupOffset.x, y: card.y + groupOffset.y, width: card.width, height: card.height,
            }];
        });
        if (items.length > 0) {
            publishTransients(items);
        }
    }, [publishTransients, groupOffset, cardsOf]);

    const blocked = useCallback((lock: CollaborationLock) => {
        setMessage(blockedText(lock.email, lockActivity(lock)));
    }, [setMessage]);

    const guard = useCallback(async (keys: string[], action: () => void, intent: CollaborationIntent = "move") => {
        const unique = [...new Set(keys)];
        if (!live || unique.length === 0) {
            action();
            return;
        }
        const denial = await live.acquire(unique, intent);
        if (denial) {
            setMessage(denialText(denial));
            return;
        }
        action();
    }, [live, setMessage]);

    const requestEdit = useCallback((type: CardType, id: number, start: () => void) => {
        const key = keyOfLocal(type, id);
        if (!key) {
            start();
            return;
        }
        void guard([key], start, "edit");
    }, [guard, keyOfLocal]);

    const versionOf = useCallback((type: CardType, syncId: string) =>
        remoteVersions.get(objectKeyOf(type, syncId)) ?? 0, [remoteVersions]);

    const wrapCard = (type: CardType, card: AnyCard, reactKey: string, node: ReactNode) => {
        if (!live) {
            return node;
        }
        const key = objectKeyOf(type, card.syncId);
        // 카드의 Rnd는 bounds="parent"라 부모 상자를 기준으로 위치를 제한한다. 보드와 같은 크기의 투명한 층으로 감싸
        // 좌표계를 그대로 두고, 포인터는 카드에만 닿게 한다.
        return (
            <div
                key={reactKey}
                data-live-key={key}
                className="pointer-events-none absolute inset-0 *:pointer-events-auto"
                onPointerDownCapture={() => {
                    if (localIdOf(type, card) > 0 && !live.foreignLocks.has(key)) {
                        setPointerKey(key);
                    }
                }}
            >
                {node}
            </div>
        );
    };

    const lockedCards = useMemo<LockedCard[]>(() => {
        if (!live || live.foreignLocks.size === 0) {
            return [];
        }
        const result: LockedCard[] = [];
        const push = (type: CardType, card: AnyCard) => {
            const lock = live.foreignLocks.get(objectKeyOf(type, card.syncId));
            if (lock) {
                result.push({
                    key: lock.key, x: card.x, y: card.y, width: card.width, height: card.height, z: card.z, lock,
                });
            }
        };
        memos.forEach((card) => push("memo", card));
        images.forEach((card) => push("image", card));
        mermaids.forEach((card) => push("mermaid", card));
        tables.forEach((card) => push("table", card));
        return result;
    }, [live, memos, images, mermaids, tables]);

    const foreignLock = (key: string) => live?.foreignLocks.get(key) ?? null;

    return {
        wrapCard,
        versionOf,
        lockedCards,
        blocked,
        guard,
        requestEdit,
        foreignLock,
        handleCursorMove,
        handleCursorLeave,
        keyOfLocal,
    };
}
