"use client";

import type { CollaborationCursor, CollaborationLock, CollaborationTransient } from "./types";

export type LockedCard = {
    key: string;
    x: number;
    y: number;
    width: number;
    height: number;
    z: number;
    lock: CollaborationLock;
};

type CollaborationLayerProps = {
    zoom: number;
    lockedCards: LockedCard[];
    transients: CollaborationTransient[];
    cursors: CollaborationCursor[];
    onBlocked: (lock: CollaborationLock) => void;
};

const shortName = (email: string | null) => {
    if (!email) {
        return "Someone";
    }
    const local = email.split("@")[0];
    return local.length > 16 ? `${local.slice(0, 15)}…` : local;
};

export const lockActivity = (lock: Pick<CollaborationLock, "intent" | "saving">) => {
    if (lock.saving) {
        return "saving";
    }
    return lock.intent === "edit" ? "editing" : "moving";
};

// 보드 좌표계(줌 적용 전) 안에 그린다. 글자는 줌과 상관없이 같은 크기로 보이도록 역배율을 건다.
export default function CollaborationLayer({ zoom, lockedCards, transients, cursors, onBlocked }: CollaborationLayerProps) {
    const labelScale = `scale(${1 / zoom})`;

    return (
        <>
            {lockedCards.map((card) => (
                <div
                    key={`lock:${card.key}`}
                    data-live-lock={card.key}
                    role="note"
                    aria-label={`${card.lock.email ?? "Another member"} is ${lockActivity(card.lock)} this card`}
                    className="absolute rounded-md"
                    style={{
                        left: card.x,
                        top: card.y,
                        width: card.width,
                        height: card.height,
                        zIndex: card.z,
                        outline: `${2 / zoom}px solid ${card.lock.color}`,
                        cursor: "not-allowed",
                        touchAction: "none",
                    }}
                    onPointerDown={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        onBlocked(card.lock);
                    }}
                    onClick={(event) => event.stopPropagation()}
                    onMouseDown={(event) => event.stopPropagation()}
                    onTouchStart={(event) => event.stopPropagation()}
                    onDoubleClick={(event) => event.stopPropagation()}
                    onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                    }}
                >
                    <span
                        className="absolute bottom-full left-0 mb-1 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-semibold text-white shadow"
                        style={{ backgroundColor: card.lock.color, transform: labelScale, transformOrigin: "bottom left" }}
                        title={card.lock.email ?? undefined}
                    >
                        {shortName(card.lock.email)} · {lockActivity(card.lock)}
                    </span>
                </div>
            ))}
            {transients.map((item) => (
                <div
                    key={`ghost:${item.clientId}:${item.key}`}
                    aria-hidden="true"
                    className="pointer-events-none absolute rounded-md"
                    style={{
                        left: item.x,
                        top: item.y,
                        width: item.width,
                        height: item.height,
                        zIndex: 49000,
                        border: `${2 / zoom}px dashed ${item.color}`,
                        backgroundColor: `${item.color}14`,
                        transition: "left 90ms linear, top 90ms linear, width 90ms linear, height 90ms linear",
                    }}
                />
            ))}
            {cursors.map((cursor) => (
                <div
                    key={`cursor:${cursor.clientId}`}
                    aria-hidden="true"
                    className="pointer-events-none absolute"
                    style={{
                        left: cursor.x,
                        top: cursor.y,
                        zIndex: 49500,
                        transform: labelScale,
                        transformOrigin: "top left",
                        transition: "left 100ms linear, top 100ms linear",
                    }}
                >
                    <svg width="18" height="20" viewBox="0 0 18 20" className="drop-shadow">
                        <path d="M1 1 L1 16 L5.5 12 L8.5 19 L11 18 L8 11 L14 11 Z" fill={cursor.color} stroke="white" strokeWidth="1.5" />
                    </svg>
                    <span
                        className="absolute left-4 top-4 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-semibold text-white shadow"
                        style={{ backgroundColor: cursor.color }}
                    >
                        {shortName(cursor.email)}
                    </span>
                </div>
            ))}
        </>
    );
}
