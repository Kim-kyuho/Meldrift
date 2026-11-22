type BoardUser = { email: string; role: string; isApproved: boolean };
type BoardVisibility = { ownerId: string; privateFlg: 0 | 1 };

export function canCreateBoard(user: BoardUser | null) {
    return user !== null && (user.role === "admin" || user.isApproved);
}

export function canReadBoard(user: BoardUser | null, board: BoardVisibility) {
    return board.privateFlg === 0 || user?.role === "admin" || user?.email === board.ownerId;
}

export function canEditBoard(user: BoardUser | null, board: BoardVisibility) {
    return user !== null && (user.role === "admin" || (user.isApproved && user.email === board.ownerId));
}
