import type { RemotePatch } from "@meldrift/board-data/remote-patch";

export type CollaborationStatus = "connecting" | "open" | "reconnecting" | "unavailable" | "idle" | "offline";
export type CollaborationIntent = "move" | "edit";

type CollaborationIdentity = { email: string | null; displayName?: string };

export const participantName = (person: CollaborationIdentity) => person.displayName ?? person.email;

export type CollaborationPeer = CollaborationIdentity & {
    clientId: string;
    userId: number | null;
    role: "editor" | "viewer" | "guest";
    color: string;
    self: boolean;
};

export type CollaborationLock = CollaborationIdentity & {
    key: string;
    clientId: string;
    intent: CollaborationIntent;
    color: string;
    saving: boolean;
};

export type CollaborationCursor = CollaborationIdentity & { clientId: string; x: number; y: number; color: string };

export type CollaborationTransient = CollaborationIdentity & {
    key: string;
    clientId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
};

export type RemoteBatch = { seq: number; patch: RemotePatch; preserveLocalIds?: boolean };

// offline: 연결이 끊겨 판정하지 못했다. 다른 사람이 쥔 것은 아니다.
export type LockDenial = CollaborationIdentity & { keys: string[]; offline: boolean };

// Plus가 WebSocket·잠금·원격 반영을 묶어 넘기는 계약. 보드 화면은 이 값만 보고 WebSocket은 모른다.
export type BoardCollaboration = {
    status: CollaborationStatus;
    // 마지막 연결 실패 이유. 연결되어 있으면 빈 문자열.
    lastError: string;
    canEdit: boolean;
    selfClientId: string;
    peers: CollaborationPeer[];
    cursors: CollaborationCursor[];
    // 다른 사람이 쥔 잠금. 내 잠금은 들어 있지 않다.
    foreignLocks: ReadonlyMap<string, CollaborationLock>;
    // 지금 내가 쥐고 있는 잠금(해제 대기 포함).
    heldKeys: ReadonlySet<string>;
    transients: CollaborationTransient[];
    // 잠금을 얻고, 직전 주인의 확정 변경까지 반영한 뒤 true. 남이 쥐고 있으면 false.
    acquire: (keys: string[], intent: CollaborationIntent) => Promise<LockDenial | null>;
    // 지금 필요한 키 목록. 새 키는 낙관적으로 잡고, 빠진 키는 저장·전송이 끝난 뒤 푼다.
    syncDesired: (desired: ReadonlyMap<string, CollaborationIntent>) => void;
    onDenied: (listener: (denial: LockDenial) => void) => () => void;
    subscribeRemote: (listener: (batch: RemoteBatch) => void) => () => void;
    publishCursor: (point: { x: number; y: number } | null) => void;
    publishTransients: (items: { key: string; x: number; y: number; width: number; height: number }[]) => void;
};
