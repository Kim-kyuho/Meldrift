import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CurrentUser } from "@/hooks/useBoardAuth";
import { boardPreviewSessionKey } from "@/lib/board-preview";

export type BoardListBoard = {
    boardId: number;
    title: string;
    width: number;
    height: number;
    previewUrl: string | null;
};

type UseBoardListOptions = {
    boards: BoardListBoard[];
    currentUser: CurrentUser | null;
};

export function useBoardList({ boards, currentUser }: UseBoardListOptions) {
    const router = useRouter();
    const [boardList, setBoardList] = useState(boards);
    const [createBoardOpen, setCreateBoardOpen] = useState(false);
    const [renameBoardOpen, setRenameBoardOpen] = useState(false);
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
        if (currentUser?.role !== "admin") {
            setBoardListMessage("Only administrators can create boards.");
            return;
        }

        setBoardListMessage("");
        setCreateBoardOpen(true);
    };

    const handleBoardRenamed = (boardId: number, title: string) => {
        setRenameBoardOpen(false);
        setBoardList((prev) =>
        prev.map((board) =>
            board.boardId === boardId
                ? { ...board, title }
                : board
        ));
    }

    const handleBoardCreated = (boardId: number) => {
        setCreateBoardOpen(false);
        window.sessionStorage.setItem(boardPreviewSessionKey, String(boardId));
        router.push(`/boards/${boardId}`);
    };
    const openBoardActionMenu = (boardId: number) => {
        if (currentUser?.role !== "admin") {
            setBoardListMessage("Only administrators can delete boards.");
            return;
        }

        setBoardListMessage("");
        setSelectedBoardId(boardId);
        setActionMenuOpen((prev) => selectedBoardId === boardId ? !prev : true);
    };

    const handleBoardClick = (boardId: number, previewMissing: boolean) => {
        setActionMenuOpen(false);

        if (previewMissing) {
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

        setBoardList((prev) => prev.filter((board) => board.boardId !== selectedBoardId));
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
        renameBoardOpen,
        setRenameBoardOpen,
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
        handleBoardRenamed,
        handleBoardClick,
        openBoardActionMenu,
        openDeleteDialog,
        handleDeleteBoard,
        closeDeleteDialog,
    };
}
