type BoardUser = { email: string; role: string; isApproved: boolean };
type BoardVisibility = { ownerId: string; privateFlg: 0 | 1 };
export type BoardMemberRole = "editor" | "viewer";

export function canCreateBoard(user: BoardUser | null) {
    return user !== null && (user.role === "admin" || user.isApproved);
}

export function canReadBoard(user: BoardUser | null, board: BoardVisibility, memberRole: BoardMemberRole | null = null) {
    return board.privateFlg === 0 || user?.role === "admin" || user?.email === board.ownerId || memberRole !== null;
}

// 카드·드로잉 편집. 공동 편집자(editor)도 승인된 계정이면 쓸 수 있다.
export function canEditBoard(user: BoardUser | null, board: BoardVisibility, memberRole: BoardMemberRole | null = null) {
    if (user === null) {
        return false;
    }
    if (user.role === "admin") {
        return true;
    }
    return user.isApproved && (user.email === board.ownerId || memberRole === "editor");
}

// 이름 변경·공개 범위·삭제·공동 편집자 관리. 소유자와 관리자만 한다.
export function canManageBoard(user: BoardUser | null, board: BoardVisibility) {
    return user !== null && (user.role === "admin" || (user.isApproved && user.email === board.ownerId));
}
