"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowUp, EllipsisVertical, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import BoardMenu from "./BoardMenu";
import BoardMessage from "@meldrift/ui/BoardMessage";
import SignInModal from "./SignInModal";
import SignUpModal from "./SignUpModal";
import CreateBoardModal from "./CreateBoardModal";
import EditBoardModal from "./EditBoardModal";
import ShareBoardModal from "./ShareBoardModal";
import ConfirmDialog from "@meldrift/ui/ConfirmDialog";
import BoardActionMenu from "./BoardActionMenu";
import AboutModal from "./AboutModal";
import { useBoardAuth, type CurrentUser } from "@/hooks/useBoardAuth";
import { BoardListBoard, useBoardList } from "@/hooks/useBoardList";
import { canCreateBoard } from "@/lib/board-permissions";
import MemberManagementModal from "./MemberManagementModal";

export default function BoardList({ boards, initialUser }: { boards: BoardListBoard[]; initialUser: CurrentUser | null }) {
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);
    const [aboutOpen, setAboutOpen] = useState(false);
    const [membersOpen, setMembersOpen] = useState(false);
    const [shareBoardId, setShareBoardId] = useState<number | null>(null);
    const [sortBy, setSortBy] = useState<"createdAt" | "title">("createdAt");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
    const [failedPreviewIds, setFailedPreviewIds] = useState<Set<number>>(new Set());
    const {
        signInOpen,
        setSignInOpen,
        signUpOpen,
        setSignUpOpen,
        currentUser,
        handleSignOut,
    } = useBoardAuth({
        initialUser,
        onSignOutComplete: () => {
            setMenuOpen(false);
            setMembersOpen(false);
            router.refresh();
        },
    });

    const {
        boardList,
        createBoardOpen,
        setCreateBoardOpen,
        editBoardOpen,
        setEditBoardOpen,
        boardListMessage,
        setBoardListMessage,
        actionMenuOpen,
        selectedBoardId,
        selectedBoardTitle,
        setSelectedBoardTitle,
        deleteDialogOpen,
        menuRef,
        handleCreateBoardClick,
        handleBoardCreated,
        handleBoardEdited,
        handleBoardClick,
        openBoardActionMenu,
        openDeleteDialog,
        handleDeleteBoard,
        closeDeleteDialog,
    } = useBoardList({
        boards,
        currentUser,
    });
    const selectedBoard = boardList.find((board) => board.boardId === selectedBoardId);
    const sortedBoards = [...boardList].sort((left, right) => {
        const comparison = sortBy === "title" ? left.title.localeCompare(right.title)
            : (left.createdAt ?? "").localeCompare(right.createdAt ?? "");
        return comparison * (sortDirection === "asc" ? 1 : -1) || left.boardId - right.boardId;
    });

    return (
        <>
            <BoardMenu
                menuOpen={menuOpen}
                setMenuOpen={setMenuOpen}
                setSignInOpen={setSignInOpen}
                setSignUpOpen={setSignUpOpen}
                currentUser={currentUser}
                onSignOut={handleSignOut}
                onAbout={() => setAboutOpen(true)}
                onManageMembers={() => setMembersOpen(true)}
            />

            {membersOpen && currentUser?.role === "admin" && (
                <MemberManagementModal currentEmail={currentUser.email} onClose={() => setMembersOpen(false)} />
            )}

            {aboutOpen && (
                <AboutModal onClose={() => setAboutOpen(false)} />
            )}

            {signInOpen && (
                <SignInModal
                    onClose={() => setSignInOpen(false)}
                    onSignIn={() => router.refresh()}
                />
            )}

            {signUpOpen && (
                <SignUpModal
                    onClose={() => setSignUpOpen(false)}
                />
            )}

            {createBoardOpen && canCreateBoard(currentUser) && (
                <CreateBoardModal
                    onClose={() => setCreateBoardOpen(false)}
                    onCreated={handleBoardCreated}
                />
            )}

            {shareBoardId !== null && currentUser && (
                <ShareBoardModal boardId={shareBoardId} onClose={() => setShareBoardId(null)} />
            )}

            {editBoardOpen && currentUser && selectedBoard?.canEdit && selectedBoardTitle !== null && (
                <EditBoardModal
                    boardId={selectedBoard.boardId}
                    title={selectedBoardTitle}
                    privateFlg={selectedBoard.privateFlg}
                    collabFlg={selectedBoard.collabFlg}
                    onClose={() => setEditBoardOpen(false)}
                    onSaved={handleBoardEdited}
                />
            )}

            <BoardMessage
                variant="toast"
                message={boardListMessage}
                onDismiss={() => setBoardListMessage("")}
            />

            <main className="min-h-screen bg-neutral-100 px-6 py-24 text-neutral-900"
                onClick={() => {
                    if (boardListMessage) {
                        setBoardListMessage("");
                    }
                }}
            >
                <div className="mx-auto max-w-4xl">
                    <div className="mb-4 flex flex-wrap items-center justify-end gap-2 text-xs">
                        <label htmlFor="board-order">Sort:</label>
                        <select id="board-order" value={sortBy}
                            className="h-8 rounded-md border border-neutral-300 bg-white px-2"
                            onChange={(event) => setSortBy(event.target.value === "title" ? "title" : "createdAt")}>
                            <option value="createdAt">Date created</option>
                            <option value="title">Title</option>
                        </select>
                        <button type="button" className="grid size-8 place-items-center rounded-md border border-neutral-300 bg-white"
                            aria-label={`Sort direction: ${sortDirection === "asc" ? "ascending" : "descending"}`}
                            onClick={() => setSortDirection((current) => current === "asc" ? "desc" : "asc")}>
                            {sortDirection === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                        </button>
                        {canCreateBoard(currentUser) && (
                            <button type="button"
                                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-sky-600 px-2.5 font-semibold text-white hover:bg-sky-700"
                                onClick={handleCreateBoardClick}>
                                <Plus size={14} aria-hidden="true" />
                                New Board
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-5" >
                        {sortedBoards.map((board) => (
                            <div
                                key={board.boardId}
                                className="group relative select-none rounded-lg bg-white shadow-sm ring-1 ring-neutral-200 transition hover:-translate-y-0.5 hover:shadow-md"
                                style={{
                                    WebkitTouchCallout: "none",
                                    WebkitUserSelect: "none",
                                    userSelect: "none",
                                    touchAction: "manipulation",
                                }}
                            >
                                <Link
                                    href={`/boards/${board.boardId}`}
                                    className="block overflow-hidden rounded-lg"
                                    draggable={false}
                                    onClick={() => {
                                        handleBoardClick(
                                            board.boardId,
                                            !board.previewUrl || failedPreviewIds.has(board.boardId),
                                        );
                                    }}
                                >
                                    <div>
                                        <div
                                            className="relative aspect-video overflow-hidden bg-white"
                                            style={{
                                                backgroundImage: "radial-gradient(#d4d4d8 1px, transparent 1px)",
                                                backgroundSize: "12px 12px",
                                            }}
                                        >
                                            {board.previewUrl && !failedPreviewIds.has(board.boardId) && (
                                                <Image
                                                    src={board.previewUrl}
                                                    alt={`${board.title} preview`}
                                                    fill
                                                    unoptimized
                                                    draggable={false}
                                                    sizes="(max-width: 768px) 50vw, 448px"
                                                    className="object-cover"
                                                    onError={() => {
                                                        setFailedPreviewIds((prev) => {
                                                            const next = new Set(prev);
                                                            next.add(board.boardId);
                                                            return next;
                                                        });
                                                    }}
                                                />
                                            )}
                                        </div>
                                        <div className="border-t border-neutral-100 px-3 py-2">
                                            <p className="truncate text-sm font-semibold text-neutral-900">
                                                {board.title}
                                            </p>
                                            {(board.privateFlg === 1 || board.collabFlg === 1) && (
                                                <p className="text-xs text-neutral-600">
                                                    {[board.privateFlg === 1 && "Private", board.collabFlg === 1 && "Live"].filter(Boolean).join(" · ")}
                                                </p>
                                            )}
                                            {currentUser?.role === "admin" && board.ownerEmail && (
                                                <p className="truncate text-xs text-neutral-600" title={board.ownerEmail}>{board.ownerEmail}</p>
                                            )}
                                        </div>
                                    </div>
                                </Link>
                                {currentUser && board.canEdit && <button
                                    type="button"
                                    aria-label="Board actions"
                                    className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-neutral-500 shadow-sm backdrop-blur-sm transition hover:bg-white hover:text-neutral-900 active:scale-95"
                                    onPointerDown={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                    }}
                                    onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        openBoardActionMenu(board.boardId);
                                    }}
                                >
                                    <EllipsisVertical size={16} />
                                </button>}
                                {currentUser && board.canEdit && actionMenuOpen && selectedBoardId === board.boardId && (
                                    <BoardActionMenu
                                        ref={menuRef}
                                        onEdit={() => {
                                            setEditBoardOpen(true);
                                            setSelectedBoardTitle(board.title);

                                        }}
                                        onShare={() => setShareBoardId(board.boardId)}
                                        onDelete={openDeleteDialog}
                                    />
                                )}
                            </div>
                        ))}

                    </div>
                </div>
            </main>
            {deleteDialogOpen && currentUser && selectedBoard?.canEdit && (
                <ConfirmDialog
                    message="Delete this board and all of its contents?"
                    onConfirm={handleDeleteBoard}
                    onCancel={closeDeleteDialog}
                />
            )}
        </>
    );
}
