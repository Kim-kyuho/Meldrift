"use client";

import { useState } from "react";
import type { CollaborationLock, CollaborationPeer, CollaborationStatus } from "./types";

type PresenceBarProps = {
    status: CollaborationStatus;
    lastError?: string;
    peers: CollaborationPeer[];
    locks: CollaborationLock[];
    selfLocks: number;
};

type PeerGroup = {
    id: string;
    email: string | null;
    color: string;
    self: boolean;
    role: CollaborationPeer["role"];
    tabs: number;
    clientIds: string[];
};

const statusLabel: Record<CollaborationStatus, string> = {
    connecting: "Connecting to live collaboration",
    open: "Live collaboration connected",
    reconnecting: "Reconnecting – editing paused",
    unavailable: "Live collaboration unavailable – editing as a standard board",
    idle: "Paused after 10 minutes without activity – move the mouse to reconnect",
    offline: "Live collaboration is off",
};

const statusColor: Record<CollaborationStatus, string> = {
    connecting: "bg-amber-400",
    open: "bg-emerald-500",
    reconnecting: "bg-amber-400",
    unavailable: "bg-rose-400",
    idle: "bg-sky-400",
    offline: "bg-neutral-400",
};

function groupPeers(peers: CollaborationPeer[]) {
    const groups = new Map<string, PeerGroup>();
    for (const peer of peers) {
        if (peer.role === "guest") {
            continue;
        }
        const id = peer.userId === null ? peer.clientId : `user:${peer.userId}`;
        const group = groups.get(id);
        if (group) {
            group.tabs += 1;
            group.clientIds.push(peer.clientId);
            group.self ||= peer.self;
            continue;
        }
        groups.set(id, {
            id, email: peer.email, color: peer.color, self: peer.self, role: peer.role, tabs: 1, clientIds: [peer.clientId],
        });
    }
    return [...groups.values()].sort((left, right) => Number(right.self) - Number(left.self));
}

function activityOf(group: PeerGroup, locks: CollaborationLock[], selfLocks: number) {
    const held = locks.filter((lock) => group.clientIds.includes(lock.clientId));
    if (held.some((lock) => lock.saving)) {
        return "Saving";
    }
    if (held.some((lock) => lock.intent === "edit")) {
        return "Editing";
    }
    if (held.length > 0 || (group.self && selfLocks > 0)) {
        return "Moving";
    }
    return group.role === "viewer" ? "Viewing (read only)" : "Viewing";
}

const initialOf = (email: string | null) => (email?.trim()[0] ?? "?").toUpperCase();

export default function PresenceBar({ status, lastError = "", peers, locks, selfLocks }: PresenceBarProps) {
    const [open, setOpen] = useState(false);
    const groups = groupPeers(peers);
    const guests = peers.filter((peer) => peer.role === "guest" && !peer.self).length;
    const visible = groups.slice(0, 4);
    const hidden = groups.length - visible.length;

    return (
        <div className="fixed right-20 top-5 z-50000">
            <button
                type="button"
                aria-label={`${statusLabel[status]}. ${groups.length} people on this board.`}
                aria-expanded={open}
                className="flex h-11 items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                onClick={() => setOpen((value) => !value)}
            >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusColor[status]}`} title={statusLabel[status]} />
                <span className="flex -space-x-2">
                    {visible.map((group) => (
                        <span
                            key={group.id}
                            title={group.email ?? "Member"}
                            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white max-sm:[&:nth-child(n+3)]:hidden"
                            style={{ backgroundColor: group.color }}
                        >
                            {initialOf(group.email)}
                        </span>
                    ))}
                </span>
                {(hidden > 0 || guests > 0) && (
                    <span className="text-xs font-semibold text-neutral-700">+{hidden + guests}</span>
                )}
            </button>
            {open && (
                <div className="absolute right-0 top-13 w-72 max-w-[calc(100vw-2rem)] rounded-xl bg-white/95 p-3 text-sm shadow-lg">
                    <p className="mb-2 text-xs text-neutral-600">{statusLabel[status]}</p>
                    {status !== "open" && lastError && (
                        <p role="alert" className="mb-2 break-words rounded-md bg-amber-50 p-2 text-xs text-amber-900">{lastError}</p>
                    )}
                    <ul className="space-y-2">
                        {groups.map((group) => (
                            <li key={group.id} className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium text-neutral-900" title={group.email ?? undefined}>
                                        {group.email ?? "Member"}{group.self ? " (you)" : ""}
                                    </span>
                                    <span className="block text-xs text-neutral-600">
                                        {activityOf(group, locks, selfLocks)}{group.tabs > 1 ? ` · ${group.tabs} tabs` : ""}
                                    </span>
                                </span>
                            </li>
                        ))}
                        {guests > 0 && (
                            <li className="text-xs text-neutral-600">{guests} guest{guests > 1 ? "s" : ""} viewing</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}
