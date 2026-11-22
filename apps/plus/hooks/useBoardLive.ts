import { useMemo, useSyncExternalStore } from "react";
import type {
    BoardCollaboration, CollaborationCursor, CollaborationLock, CollaborationPeer, CollaborationTransient,
} from "@meldrift/ui/collaboration";
import type { LiveRuntime, LiveRuntimeSnapshot } from "@/lib/live/client/runtime";

const subscribeNothing = () => () => {};
const emptySnapshot = () => null;

// Live가 꺼져 있거나(토큰 404) 아직 만들지 않았으면 null을 돌려준다. 그때 보드는 기존처럼 동작한다.
export function useBoardLive(runtime: LiveRuntime | null): BoardCollaboration | undefined {
    const snapshot = useSyncExternalStore<LiveRuntimeSnapshot | null>(
        runtime ? runtime.subscribe : subscribeNothing,
        runtime ? runtime.getSnapshot : emptySnapshot,
        emptySnapshot,
    );

    // 함수는 런타임마다 한 번만 만든다. 화면 쪽 effect가 상태 변화마다 다시 돌지 않게 하기 위해서다.
    const actions = useMemo(() => runtime ? {
        acquire: runtime.acquire.bind(runtime),
        syncDesired: runtime.syncDesired.bind(runtime),
        onDenied: runtime.onDenied.bind(runtime),
        subscribeRemote: runtime.onRemote.bind(runtime),
        publishCursor: runtime.publishCursor.bind(runtime),
        publishTransients: runtime.publishTransients.bind(runtime),
    } satisfies Pick<BoardCollaboration,
        "acquire" | "syncDesired" | "onDenied" | "subscribeRemote" | "publishCursor" | "publishTransients"> : null, [runtime]);

    return useMemo(() => {
        if (!runtime || !snapshot || !actions) {
            return undefined;
        }
        const { session } = snapshot;
        if (session.status === "offline" && session.peers.size === 0) {
            return undefined;
        }
        const clientId = runtime.clientId;
        const peers: CollaborationPeer[] = [...session.peers.values()].map((peer) => ({
            clientId: peer.clientId,
            userId: peer.userId,
            email: peer.email,
            role: peer.role,
            color: peer.color,
            self: peer.clientId === clientId,
        }));
        const peerById = new Map(peers.map((peer) => [peer.clientId, peer]));
        const cursors: CollaborationCursor[] = [...session.cursors].flatMap(([id, point]) => {
            const peer = peerById.get(id);
            return peer && !peer.self ? [{ clientId: id, x: point.x, y: point.y, email: peer.email, color: peer.color }] : [];
        });
        const foreignLocks = new Map<string, CollaborationLock>();
        for (const lock of session.locks.values()) {
            if (lock.clientId !== clientId) {
                foreignLocks.set(lock.key, {
                    key: lock.key, clientId: lock.clientId, email: lock.email, intent: lock.intent, color: lock.color, saving: false,
                });
            }
        }
        const transients: CollaborationTransient[] = [...session.transients.values()].flatMap((item) => {
            const peer = peerById.get(item.clientId);
            if (item.clientId === clientId || !foreignLocks.has(item.key)) {
                return [];
            }
            return [{ ...item, email: peer?.email ?? null, color: peer?.color ?? "#64748b" }];
        });
        return {
            status: session.status,
            lastError: session.lastError,
            canEdit: session.canEdit,
            selfClientId: clientId,
            peers,
            cursors,
            foreignLocks,
            heldKeys: snapshot.held,
            transients,
            ...actions,
        } satisfies BoardCollaboration;
    }, [runtime, snapshot, actions]);
}
