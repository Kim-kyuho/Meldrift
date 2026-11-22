import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CurrentUser } from "@/hooks/useBoardAuth";
import { boardPreviewSessionKey } from "@/lib/board-preview";
import { canCreateBoard } from "@/lib/board-permissions";

export type BoardListBoard = {
    boardId: number;
    title: string;
    width: number;
    height: number;
    previewUrl: string | null;
    privateFlg: 0 | 1;
    collabFlg: 0 | 1;
    createdAt: string | null;
    ownerEmail: string | null;
    canEdit: boolean;
};

type UseBoardListOptions = {
    boards: BoardListBoard[];
    currentUser: CurrentUser | null;
};

export function useBoardList({ boards, currentUser }: UseBoardListOptions) {
    const router = useRouter();
    const boardList = currentUser ? boards : boards.filter((board) => board.privateFlg === 0);
    const [createBoardOpen, setCreateBoardOpen] = useState(false);
    const [editBoardOpen, setEditBoardOpen] = useState(false);
    const [boardListMessage, setBoardListMessage] = useState("");
    const [actionMenuOpen, setActionMenuOpen] = useState(false);
    const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
    const [selectedBoardTitle, setSelectedBoardTitle] = useState<string | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleClickOutside = (event: PointerEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setActionMenuOpen(false);
            }
        };

        document.addEventListener("pointerdown", handleClickOutside);
        return () => {
            document.removeEventListener("pointerdown", handleClickOutside);
        };
    }, []);

    const handleCreateBoardClick = () => {
        if (!canCreateBoard(currentUser)) {
            setBoardListMessage("You cannot create boards.");
            return;
        }

        setBoardListMessage("");
        setCreateBoardOpen(true);
    };

    const handleBoardEdited = () => {
        setEditBoardOpen(false);
        setActionMenuOpen(false);
        router.refresh();
    }

    const handleBoardCreated = (boardId: number) => {
        setCreateBoardOpen(false);
        window.sessionStorage.setItem(boardPreviewSessionKey, String(boardId));
        router.push(`/boards/${boardId}`);
    };
    const openBoardActionMenu = (boardId: number) => {
        if (!currentUser || !boardList.find((board) => board.boardId === boardId)?.canEdit) {
            setBoardListMessage("You cannot edit this board.");
            return;
        }

        setBoardListMessage("");
        setSelectedBoardId(boardId);
        setActionMenuOpen((prev) => selectedBoardId === boardId ? !prev : true);
    };

    const handleBoardClick = (boardId: number, previewMissing: boolean) => {
        setActionMenuOpen(false);

        if (previewMissing && currentUser && boardList.find((board) => board.boardId === boardId)?.canEdit) {
            window.sessionStorage.setItem(boardPreviewSessionKey, String(boardId));
        }
    };

    const openDeleteDialog = () => {
        setActionMenuOpen(false);
        setDeleteDialogOpen(true);
    };

    const handleDeleteBoard = async () => {
        if (selectedBoardId === null) {
            return;
        }

        const response = await fetch(`/api/boards/${selectedBoardId}`, {
            method: "DELETE",
        });
        const data = await response.json();

        if (!response.ok || !data.ok) {
            setBoardListMessage(data.message ?? "Board could not be deleted.");
            setDeleteDialogOpen(false);
            return;
        }

        setDeleteDialogOpen(false);
        setSelectedBoardId(null);
        router.refresh();
    };

    const closeDeleteDialog = () => {
        setDeleteDialogOpen(false);
    };

    return {
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
    };
}
