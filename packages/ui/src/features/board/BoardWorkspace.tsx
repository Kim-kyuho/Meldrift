"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import ImageCard from "@meldrift/ui/ImageCard";
import MemoCard from "@meldrift/ui/MemoCard";
import BoardToolBar from "@meldrift/ui/BoardToolBar";
import BoardMessage from "@meldrift/ui/BoardMessage";
import BoardSearchPanel from "@meldrift/ui/BoardSearchPanel";
import BoardNavigator from "@meldrift/ui/BoardNavigator";
import BoardMarkdownView from "@meldrift/ui/BoardMarkdownView";
import MemoReorderPanel from "@meldrift/ui/MemoReorderPanel";
import AboutModal from "@meldrift/ui/AboutModal";
import type { BoardMenuControls } from "@meldrift/ui/BoardMenu";
import AiAssistantButton from "@meldrift/ui/AiAssistantButton";
import AiChatPanel from "@meldrift/ui/AiChatPanel";
import AiUnlockPanel from "@meldrift/ui/AiUnlockPanel";
import MermaidCard from "@meldrift/ui/MermaidCard";
import TableCard from "@meldrift/ui/TableCard";
import DrawingLayer from "@meldrift/ui/DrawingLayer";
import DrawingToolBar from "@meldrift/ui/DrawingToolBar";
import SelectionLayer from "@meldrift/ui/SelectionLayer";
import SelectionToolBar from "@meldrift/ui/SelectionToolBar";
import { useSelectionPointer } from "@meldrift/ui/useSelectionPointer";
import BoardImageDropOverlay from "@meldrift/ui/BoardImageDropOverlay";
import { useBoardImageDrop } from "@meldrift/ui/useBoardImageDrop";
import { useBoardDrawing } from "@meldrift/ui/useBoardDrawing";
import { useCardLayer } from "@meldrift/ui/useCardLayer";
import { useBoardSelection } from "@meldrift/ui/useBoardSelection";
import { useBoardImages } from "@meldrift/ui/useBoardImages";
import { imageInputAccept } from "@meldrift/board-data/image-file";
import type { BoardSnapshot } from "@meldrift/board-data/board-state";
import { resolveMemoCornerLinks, type CardType, type SelectionRect } from "@meldrift/core/cards";
import { useBoardMermaids } from "@meldrift/ui/useBoardMermaids";
import { useBoardTables } from "@meldrift/ui/useBoardTables";
import { useBoardMemoFocus } from "@meldrift/ui/useBoardMemoFocus";
import { useBoardMemos } from "@meldrift/ui/useBoardMemos";
import { useBoardScroll } from "@meldrift/ui/useBoardScroll";
import { useBoardSearch } from "@meldrift/ui/useBoardSearch";
import { useBoardZoom } from "@meldrift/ui/useBoardZoom";
import { useBoardPinchZoom } from "@meldrift/ui/useBoardPinchZoom";
import { useAiAssistant } from "@meldrift/ui/useAiAssistant";
import { useMemoReorder } from "@meldrift/ui/useMemoReorder";
import { useBoardShortcuts } from "./useBoardShortcuts";
import { useBoardHistory, type BoardContent } from "./useBoardHistory";
import { useBoardPointerActive } from "./useBoardPointerActive";
import BoardHistoryToolbar from "./BoardHistoryToolbar";
import BoardCornerLinksLayer from "./BoardCornerLinksLayer";
import BoardControls from "./BoardControls";
import type { BoardStorage } from "./board-storage";
import HelpOverlay from "../guide/HelpOverlay";
import TutorialGuide, { TutorialLinkZones } from "../guide/TutorialGuide";
import type { BoardHelpOptions, BoardTutorialOptions } from "../guide/board-guide";
import { useIsMobile } from "../../shared/useIsMobile";
import { useCompactViewport } from "../../shared/useCompactViewport";
import BoardSplitLayout from "../markdown/BoardSplitLayout";
import { useLinearMarkdownDraft } from "../markdown/useLinearMarkdownDraft";
import PresenceBar from "../collaboration/PresenceBar";
import CollaborationLayer from "../collaboration/CollaborationLayer";
import { blockedText, useBoardCollaboration } from "../collaboration/useBoardCollaboration";
import { participantName, type BoardCollaboration } from "../collaboration/types";
import {
    boardLockKey, diffBoardSnapshots, memoOrderKey, strokeLayerKey, touchedKeysOf,
} from "@meldrift/board-data/board-delta";
import { tagRemoteSeq } from "@meldrift/board-data/remote-patch";

export type BoardWorkspaceProps = {
    initialSnapshot: BoardSnapshot;
    storage?: BoardStorage;
    canEdit?: boolean;
    canExport?: boolean;
    canReplace?: boolean;
    assistantEnabled?: boolean;
    collaborationMenu?: { label: string; open: (snapshot: BoardSnapshot) => void };
    permissionMessage?: string;
    viewportRef?: RefObject<HTMLDivElement | null>;
    menuTitle?: string;
    renderMenu: (menu: BoardMenuControls) => ReactNode;
    help?: BoardHelpOptions;
    tutorial?: BoardTutorialOptions;
    collaboration?: BoardCollaboration;
};

export default function BoardWorkspace({
    initialSnapshot,
    storage,
    canEdit: canEditProp = true,
    canExport = true,
    canReplace = true,
    assistantEnabled = true,
    collaborationMenu,
    permissionMessage: basePermissionMessage = "Please sign in before editing cards.",
    viewportRef,
    menuTitle,
    renderMenu,
    help,
    tutorial,
    collaboration,
}: BoardWorkspaceProps) {
    // Plus Live: 연결이 끊긴 동안과 누군가 보드 전체를 바꾸는 동안에는 편집을 멈춘다.
    const live = collaboration ?? null;
    const liveEditPaused = live !== null
        && (live.status === "connecting" || live.status === "reconnecting" || live.status === "idle");
    const liveBoardLock = live?.foreignLocks.get(boardLockKey) ?? null;
    const canEditCard = canEditProp && !liveEditPaused && !liveBoardLock;
    let permissionMessage = basePermissionMessage;
    if (canEditProp && liveBoardLock) {
        permissionMessage = blockedText(participantName(liveBoardLock), "replacing");
    } else if (canEditProp && live?.status === "idle") {
        permissionMessage = "Live collaboration paused while you were away. Reconnecting now…";
    } else if (canEditProp && liveEditPaused) {
        permissionMessage = "Connecting to live collaboration. Editing resumes once connected.";
    }
    const {
        board: currentBoard,
        images: mappedImages,
        memos: mappedMemos,
        mermaids: mappedMermaids,
        tables: mappedTables,
        strokes: mappedStrokes,
    } = initialSnapshot;
    const boardWidth = currentBoard.width;
    const boardHeight = currentBoard.height;
    const localViewportRef = useRef<HTMLDivElement | null>(null);
    const boardRef = useRef<HTMLDivElement | null>(null);
    const [appliedRemoteSeq, setAppliedRemoteSeq] = useState(0);
    const cardLocationRef = viewportRef ?? localViewportRef;
    const [menuOpen, setMenuOpen] = useState(false);
    const [aboutOpen, setAboutOpen] = useState(false);
    const [markdownViewOpen, setMarkdownViewOpen] = useState(false);
    const [boardNavigatorOpen, setBoardNavigatorOpen] = useState(false);
    const [boardMessage, setBoardMessage] = useState("");
    const [contentVersion, setContentVersion] = useState(0);
    const [drawingInputActive, setDrawingInputActive] = useState(false);
    const showPermissionMessage = () => {
        setBoardMessage(permissionMessage);
    };

    const closeOverlays = useCallback(() => {
        setMenuOpen(false);
        setAboutOpen(false);
        setMarkdownViewOpen(false);
    }, []);

    const {
        boardZoom,
        setBoardZoom,
    } = useBoardZoom();

    const imagesRef = useRef<BoardSnapshot["images"]>(mappedImages);
    const memosRef = useRef<BoardSnapshot["memos"]>(mappedMemos);
    const mermaidsRef = useRef<BoardSnapshot["mermaids"]>(mappedMermaids);
    const tablesRef = useRef<BoardSnapshot["tables"]>(mappedTables);

    const getTopmostZ = useCallback(() => {
        const allZ = [
            ...memosRef.current.map((m) => m.z),
            ...imagesRef.current.map((i) => i.z),
            ...mermaidsRef.current.map((m) => m.z),
            ...tablesRef.current.map((t) => t.z),
        ];
        return allZ.length > 0 ? Math.max(...allZ) + 1 : 1;
    }, []);

    const {
        imageInputRef,
        images,
        setImages,
        editingImageId,
        uploadingImage,
        setEditingImageId,
        handleImageUploadClick,
        handleUploadImage,
        handleDropImageFiles,
        handleUpdateImage,
        handleDeleteImage,
    } = useBoardImages({
        initialImages: mappedImages,
        boardId: currentBoard.boardId,
        boardZoom,
        cardLocationRef,
        getTopmostZ,
        setMessage: setBoardMessage,
    });

    const {
        memos,
        setMemos,
        editingMemoId,
        setEditingMemoId,
        handleCreateTempMemo,
        handleInsertMemo,
        handleUpdateMemo,
        handleDeleteMemo,
    } = useBoardMemos({
        initialMemos: mappedMemos,
        boardId: currentBoard.boardId,
        boardZoom,
        cardLocationRef,
        getTopmostZ,
    });

    const {
        memoMessage,
        setMemoMessage,
        focusedMemoId,
        setFocusedMemoId,
        focusMemoById,
        focusMemoByOrder,
        focusedMemoOrder,
        memoCount,
        handleFocusPrevMemo,
        handleFocusNextMemo,
    } = useBoardMemoFocus(memos);

    const {
        reorderOpen,
        reorderListRef,
        reorderMemoList,
        draggingMemoId,
        dragOffsetY,
        handleToggleReorderPanel,
        handleCloseReorderPanel,
        handleReorderStart,
        handleRowClick,
    } = useMemoReorder({
        memos,
        setMemos,
        onFocusMemo: focusMemoById,
    });

    const {
        searchBarOpen,
        setSearchBarOpen,
        searchText,
        searchIndex,
        searchResults,
        handleSearchTextChange,
        handleSearchPrev,
        handleSearchNext,
    } = useBoardSearch({
        memos,
        focusMemoById,
        setMemoMessage,
    });

    const {
        mermaids,
        setMermaids,
        editingMermaidId,
        setEditingMermaidId,
        handleCreateTempMermaid,
        handleInsertMermaid,
        handleUpdateMermaid,
        handleDeleteMermaid,
    } = useBoardMermaids({
        initialMermaids: mappedMermaids,
        boardId: currentBoard.boardId,
        boardZoom,
        cardLocationRef,
        getTopmostZ,
    });

    const {
        tables,
        setTables,
        editingTableId,
        setEditingTableId,
        handleCreateTempTable,
        handleInsertTable,
        handleUpdateTable,
        handleDeleteTable,
    } = useBoardTables({
        initialTables: mappedTables,
        boardId: currentBoard.boardId,
        boardZoom,
        cardLocationRef,
        getTopmostZ,
    });

    useEffect(() => {
        imagesRef.current = images;
        memosRef.current = memos;
        mermaidsRef.current = mermaids;
        tablesRef.current = tables;
    }, [images, memos, mermaids, tables]);

    const {
        aiPanelOpen,
        unlocked: aiUnlocked,
        unlocking: aiUnlocking,
        unlockError: aiUnlockError,
        messages: aiMessages,
        sending: aiSending,
        saving: aiSaving,
        hasPendingCards: hasPendingAiCards,
        handleToggleAiPanel,
        handleUnlock: handleAiUnlock,
        handleLock: handleAiLock,
        handleSendMessage,
        handleSavePendingCards,
        discardPendingCards,
    } = useAiAssistant({
        boardId: currentBoard.boardId,
        boardWidth,
        boardHeight,
        boardZoom,
        cardLocationRef,
        canEdit: canEditCard,
        onPermissionDenied: showPermissionMessage,
        setMessage: setBoardMessage,
        memos,
        mermaids,
        tables,
        setMemos,
        setMermaids,
        setTables,
        onInsertMemo: handleInsertMemo,
        onInsertMermaid: handleInsertMermaid,
        onInsertTable: handleInsertTable,
        onUpdateMemo: handleUpdateMemo,
        onUpdateMermaid: handleUpdateMermaid,
        onUpdateTable: handleUpdateTable,
        images,
        setImages,
        onDeleteMemo: handleDeleteMemo,
        onDeleteMermaid: handleDeleteMermaid,
        onDeleteTable: handleDeleteTable,
        onDeleteImage: handleDeleteImage,
    });

    const {
        strokes,
        setStrokes,
        drawingMode,
        drawingTool,
        penColor,
        setPenColor,
        penWidth,
        setPenWidth,
        handleToggleDrawingMode,
        handleToggleEraseTool,
        handleStrokeEnd,
        handleErase,
    } = useBoardDrawing({
        initialStrokes: mappedStrokes,
    });

    const isEditing =
        editingMemoId !== null ||
        editingImageId !== null ||
        editingMermaidId !== null ||
        editingTableId !== null;

    const isMobile = useIsMobile();
    const isCompactViewport = useCompactViewport();
    // 데스크톱 다이어그램 편집 패널은 메모 순서 패널과 같은 자리를 쓰므로, 편집하는 동안 메모 순서 패널을 가린다.
    const mermaidEditorPanelOpen = editingMermaidId !== null && !isMobile;

    const {
        boardPanning,
        handleBoardPanStart,
        handleBoardPanMove,
        handleBoardPanEnd,
    } = useBoardScroll({
        cardEditing: isEditing,
        boardScrollRef: cardLocationRef,
    });

    const {
        isDraggingOverBoard,
        handleDragEnter,
        handleDragOver,
        handleDragLeave,
        handleDrop,
    } = useBoardImageDrop({
        boardScrollRef: cardLocationRef,
        boardZoom,
        onDropImages: async (files, coords) => {
            if (!canEditCard) {
                showPermissionMessage();
                return;
            }
            await handleDropImageFiles(files, coords);
        },
    });
    
    useBoardPinchZoom({
        boardScrollRef: cardLocationRef,
        boardZoom,
        setBoardZoom,
    });

    const { handleCardLayer } = useCardLayer({
        memos, images, mermaids, tables,
        setMemos,
        setImages,
        setMermaids,
        setTables,
    });

    const {
        selectionMode,
        selectedCards,
        selectionBounds,
        clampSelectionOffset,
        handleToggleSelectionMode,
        handleSelectCards,
        handleClearSelection,
        handleMoveSelection,
        handleDeleteSelection,
    } = useBoardSelection({
        boardWidth,
        boardHeight,
        memos, images, mermaids, tables,
        setMemos,
        setImages,
        setMermaids,
        setTables,
        onDeleteMemo: handleDeleteMemo,
        onDeleteImage: handleDeleteImage,
        onDeleteMermaid: handleDeleteMermaid,
        onDeleteTable: handleDeleteTable,
    });

    const {
        marqueeRect,
        selectionOffset,
        handleSelectionPointerDown,
        handleSelectionPointerMove,
        handleSelectionPointerUp,
        handleSelectionPointerCancel,
    } = useSelectionPointer({
        zoom: boardZoom,
        selectionBounds,
        onSelectCards: handleSelectCards,
        onMoveSelection: handleMoveSelection,
        onClearSelection: handleClearSelection,
    });

    const snapshot = useMemo<BoardSnapshot>(
        () => tagRemoteSeq({ board: currentBoard, memos, images, mermaids, tables, strokes }, appliedRemoteSeq),
        [currentBoard, memos, images, mermaids, tables, strokes, appliedRemoteSeq],
    );
    const commitMarkdownDraftRef = useRef<(next: BoardSnapshot, clearDraft: () => void) => Promise<boolean>>(async () => false);
    const linearMarkdown = useLinearMarkdownDraft({
        open: markdownViewOpen,
        canEdit: canEditCard,
        committedSnapshot: snapshot,
        onCommit: (nextSnapshot, clearDraft) => commitMarkdownDraftRef.current(nextSnapshot, clearDraft),
        onClose: () => setMarkdownViewOpen(false),
        onMessage: setBoardMessage,
    });
    const hasPendingMarkdownDraft = linearMarkdown.isDirty;
    const displaySnapshot = linearMarkdown.displaySnapshot;
    const displayMemos = displaySnapshot.memos;
    const displayImages = displaySnapshot.images;
    const displayMermaids = displaySnapshot.mermaids;
    const displayTables = displaySnapshot.tables;

    const selectionActive = selectionMode && !isEditing && !hasPendingAiCards && !hasPendingMarkdownDraft;
    const cardsSelected = selectionActive && selectedCards.length > 0;
    const groupOffset = selectionOffset ? clampSelectionOffset(selectionOffset) : null;
    const selectedCardKeys = useMemo(
        () => new Set(selectedCards.map((card) => `${card.type}:${card.id}`)),
        [selectedCards],
    );
    const groupOffsetOf = useCallback(
        (type: CardType, id: number) =>
            groupOffset && selectedCardKeys.has(`${type}:${id}`) ? groupOffset : undefined,
        [groupOffset, selectedCardKeys],
    );

    const cornerLinks = useMemo(() => resolveMemoCornerLinks(
        displayMemos.map((memo) => {
            const offset = groupOffsetOf("memo", memo.id);
            return {
                id: memo.id,
                sortOrder: memo.sortOrder,
                x: memo.x + (offset?.x ?? 0),
                y: memo.y + (offset?.y ?? 0),
                width: memo.width,
                height: memo.height,
            };
        }),
        [
            ...displayImages.map((image) => {
                const offset = groupOffsetOf("image", image.imageId);
                return {
                    type: "image" as const,
                    id: image.imageId,
                    x: image.x + (offset?.x ?? 0),
                    y: image.y + (offset?.y ?? 0),
                    z: image.z,
                    width: image.width,
                    height: image.height,
                };
            }),
            ...displayMermaids.map((mermaid) => {
                const offset = groupOffsetOf("mermaid", mermaid.id);
                return {
                    type: "mermaid" as const,
                    id: mermaid.id,
                    x: mermaid.x + (offset?.x ?? 0),
                    y: mermaid.y + (offset?.y ?? 0),
                    z: mermaid.z,
                    width: mermaid.width,
                    height: mermaid.height,
                };
            }),
            ...displayTables.map((table) => {
                const offset = groupOffsetOf("table", table.id);
                return {
                    type: "table" as const,
                    id: table.id,
                    x: table.x + (offset?.x ?? 0),
                    y: table.y + (offset?.y ?? 0),
                    z: table.z,
                    width: table.width,
                    height: table.height,
                };
            }),
        ],
    ), [displayMemos, displayImages, displayMermaids, displayTables, groupOffsetOf]);

    const savePaused = isEditing || drawingMode || hasPendingAiCards || hasPendingMarkdownDraft;
    const pointerActive = useBoardPointerActive(cardLocationRef);
    const applyContent = useCallback((next: BoardContent) => {
        setMemos(next.memos);
        setImages(next.images);
        setMermaids(next.mermaids);
        setTables(next.tables);
        setStrokes(next.strokes);
        setContentVersion((version) => version + 1);
        setEditingMemoId(null);
        setEditingImageId(null);
        setEditingMermaidId(null);
        setEditingTableId(null);
        setFocusedMemoId(null);
        handleClearSelection();
    }, [
        setMemos,
        setImages,
        setMermaids,
        setTables,
        setStrokes,
        setEditingMemoId,
        setEditingImageId,
        setEditingMermaidId,
        setEditingTableId,
        setFocusedMemoId,
        handleClearSelection,
    ]);
    const hasDraftCards = memos.some((card) => card.id < 0)
        || mermaids.some((card) => card.id < 0)
        || tables.some((card) => card.id < 0);
    const history = useBoardHistory({
        snapshot,
        paused: pointerActive || drawingInputActive || draggingMemoId !== null || hasDraftCards || hasPendingAiCards || hasPendingMarkdownDraft || aiSending || aiSaving,
        onRestore: applyContent,
    });
    const resetHistory = history.reset;
    const lastInitialSnapshot = useRef(initialSnapshot);
    useEffect(() => {
        if (lastInitialSnapshot.current !== initialSnapshot) {
            lastInitialSnapshot.current = initialSnapshot;
            resetHistory(initialSnapshot);
            applyContent(initialSnapshot);
            setAppliedRemoteSeq(0);
        }
    }, [initialSnapshot, resetHistory, applyContent]);
    const historyBlocked = !canEditCard
        || isEditing
        || pointerActive
        || drawingInputActive
        || draggingMemoId !== null
        || uploadingImage
        || aiSending
        || aiSaving
        || hasPendingAiCards
        || hasPendingMarkdownDraft;
    const restoreHistory = (action: () => void) => {
        if (!historyBlocked && !document.querySelector('[aria-modal="true"], dialog[open]')) {
            action();
        }
    };
    const collab = useBoardCollaboration({
        live,
        memos, images, mermaids, tables, strokes,
        setMemos, setImages, setMermaids, setTables, setStrokes,
        editingIds: { memo: editingMemoId, image: editingImageId, mermaid: editingMermaidId, table: editingTableId },
        selectedCards,
        groupOffset,
        draggingMemoId,
        drawingMode,
        drawingTool,
        zoom: boardZoom,
        boardRef,
        setAppliedRemoteSeq,
        projectRemote: history.projectRemote,
        clearSelection: handleClearSelection,
        setMessage: setBoardMessage,
    });
    useEffect(() => {
        commitMarkdownDraftRef.current = async (nextSnapshot: BoardSnapshot, clearDraft: () => void) => {
            if (!canEditCard) {
                setBoardMessage(permissionMessage);
                return false;
            }
            const keys = touchedKeysOf(diffBoardSnapshots(snapshot, nextSnapshot));
            let committed = false;
            await collab.guard(keys, () => {
                clearDraft();
                applyContent(nextSnapshot);
                committed = true;
            }, "edit");
            return committed;
        };
    }, [canEditCard, permissionMessage, snapshot, collab, applyContent]);
    // 협업 중에는 되돌릴 변경이 건드리는 카드의 잠금을 먼저 얻는다. 남이 편집 중이면 되돌리지 않는다.
    const stepHistory = (direction: "undo" | "redo") => restoreHistory(() => {
        const step = live ? history.peek(direction) : null;
        const run = direction === "undo" ? history.undo : history.redo;
        if (!step) {
            run();
            return;
        }
        const keys = touchedKeysOf(diffBoardSnapshots(
            { board: currentBoard, ...step.from }, { board: currentBoard, ...step.to },
        ));
        void collab.guard(keys, run, "edit");
    });
    const replaceBoardContent = (next: BoardSnapshot) => {
        if (!canEditCard) {
            showPermissionMessage();
            return;
        }
        if (next.board.boardId !== currentBoard.boardId) {
            return;
        }
        void collab.guard([boardLockKey], () => applyContent(next), "edit");
    };
    const undo = () => stepHistory("undo");
    const redo = () => stepHistory("redo");
    const handleGeometryChange = (type: CardType, id: number, geometry: SelectionRect) => {
        if (!canEditCard) {
            return;
        }
        const frame = {
            x: Math.round(geometry.x),
            y: Math.round(geometry.y),
            width: Math.round(geometry.width),
            height: Math.round(geometry.height),
        };
        if (type === "memo") {
            setMemos((previous) => previous.map((card) => card.id === id ? { ...card, ...frame } : card));
        } else if (type === "image") {
            setImages((previous) => previous.map((card) => card.imageId === id ? { ...card, ...frame } : card));
        } else if (type === "mermaid") {
            setMermaids((previous) => previous.map((card) => card.id === id ? { ...card, ...frame } : card));
        } else {
            setTables((previous) => previous.map((card) => card.id === id ? { ...card, ...frame } : card));
        }
    };
    const canEditCanvas = canEditCard && !hasPendingMarkdownDraft;
    const showCanvasBlockedMessage = () => {
        setBoardMessage(
            hasPendingMarkdownDraft
                ? "Apply or discard your Markdown changes first."
                : permissionMessage,
        );
    };
    const withPermission = (action: () => void) => () => {
        if (!canEditCanvas) {
            showCanvasBlockedMessage();
            return;
        }
        action();
    };

    const handleOpenMarkdownView = () => {
        setMenuOpen(false);
        setEditingMemoId(null);
        setEditingImageId(null);
        setEditingMermaidId(null);
        setEditingTableId(null);
        handleClearSelection();
        if (drawingMode) {
            handleToggleDrawingMode();
        }
        setMarkdownViewOpen(true);
    };

    const closeModePanels = () => {
        setSearchBarOpen(false);
        setBoardNavigatorOpen(false);
        setMenuOpen(false);
    };
    const toggleDrawing = withPermission(() => {
        closeModePanels();
        if (selectionMode) {
            handleToggleSelectionMode();
        }
        handleToggleDrawingMode();
    });
    const toggleSelection = withPermission(() => {
        if (!selectionMode && hasPendingAiCards) {
            setBoardMessage("Save or discard the assistant's changes first.");
            return;
        }
        closeModePanels();
        if (drawingMode) {
            handleToggleDrawingMode();
        }
        handleToggleSelectionMode();
    });

    useBoardShortcuts({
        enabled: !isEditing && !menuOpen && !aboutOpen && !markdownViewOpen && !reorderOpen && !aiPanelOpen,
        actions: {
            "1": toggleSelection,
            "2": toggleDrawing,
            ...(!drawingMode && !cardsSelected ? {
                m: withPermission(handleCreateTempMemo),
                i: withPermission(handleImageUploadClick),
                t: withPermission(handleCreateTempTable),
                d: withPermission(handleCreateTempMermaid),
            } : {}),
        },
    });

    let boardCursor = "grab";
    if (selectionActive) {
        boardCursor = "default";
    } else if (boardPanning) {
        boardCursor = "grabbing";
    }

    return (
        <>
            <input
                ref={imageInputRef}
                type="file"
                accept={imageInputAccept}
                aria-label="Upload image"
                className="hidden"
                onChange={handleUploadImage}
            />
            {aboutOpen && (
                <AboutModal onClose={() => setAboutOpen(false)} />
            )}
            <BoardMessage
                variant="toast"
                message={boardMessage}
                onDismiss={() => setBoardMessage("")}
            />
            <BoardMessage
                variant="toast"
                message={memoMessage}
                onDismiss={() => setMemoMessage("")}
            />
            <BoardSplitLayout
                open={markdownViewOpen}
                compact={isCompactViewport}
                scrollRef={cardLocationRef}
                panel={markdownViewOpen ? (
                    <BoardMarkdownView
                        snapshot={displaySnapshot}
                        canEdit={canEditCard}
                        isDirty={linearMarkdown.isDirty}
                        applying={linearMarkdown.applying}
                        closeConfirmOpen={linearMarkdown.closeConfirmOpen}
                        onClose={linearMarkdown.requestClose}
                        onApply={() => { void linearMarkdown.applyDraft(); }}
                        onApplyAndClose={() => { void linearMarkdown.handleApplyAndClose(); }}
                        onDiscardAndClose={linearMarkdown.handleDiscardAndClose}
                        onKeepEditing={linearMarkdown.handleKeepEditing}
                        onEditMemoHtml={linearMarkdown.editMemoHtml}
                        onEditTableSource={linearMarkdown.editTableSource}
                        onEditMermaidSource={linearMarkdown.editMermaidSource}
                        onEditImageLabel={linearMarkdown.editImageLabel}
                        onAddSection={linearMarkdown.addSection}
                        onAddTableToSection={linearMarkdown.addTableToSection}
                        onAddMermaidToSection={linearMarkdown.addMermaidToSection}
                        onAddImageToSection={linearMarkdown.addImageToSection}
                        onReorderSection={linearMarkdown.reorderSection}
                        onFocusMemo={focusMemoById}
                    />
                ) : null}
                canvas={(
                    <>
                        <BoardControls
                            storage={storage}
                            renderMenu={renderMenu}
                            menuTitle={menuTitle ?? currentBoard.title}
                            snapshot={snapshot}
                            savePaused={savePaused}
                            canSave={canEditProp}
                            canEdit={canEditCard}
                            canExport={canExport}
                            canReplace={canReplace}
                            collaborationMenu={collaborationMenu}
                            menuOpen={menuOpen}
                            setMenuOpen={setMenuOpen}
                            reorderOpen={reorderOpen}
                            onReorder={handleToggleReorderPanel}
                            onCompileMarkdown={handleOpenMarkdownView}
                            onAbout={() => setAboutOpen(true)}
                            replaceSnapshot={replaceBoardContent}
                            setMessage={setBoardMessage}
                        />
            {help && (
                <HelpOverlay
                    guide={help.guide}
                    autoOpen={help.autoOpen}
                    launcherAllowed={!menuOpen && !reorderOpen && !isEditing && !markdownViewOpen}
                    closeOverlays={closeOverlays}
                    onStartTutorial={() => help.onStartTutorial(snapshot)}
                />
            )}
            {tutorial && (
                <TutorialGuide
                    tutorial={tutorial}
                    snapshot={snapshot}
                    isEditing={isEditing}
                    markdownViewOpen={markdownViewOpen}
                    boardZoom={boardZoom}
                    cornerLinks={cornerLinks}
                    viewportRef={cardLocationRef}
                    closeOverlays={closeOverlays}
                    replaceSnapshot={replaceBoardContent}
                />
            )}
            {live && (
                <PresenceBar
                    status={live.status}
                    lastError={live.lastError}
                    peers={live.peers}
                    locks={[...live.foreignLocks.values()]}
                    selfLocks={live.heldKeys.size}
                />
            )}
            <BoardHistoryToolbar
                canUndo={history.canUndo && !historyBlocked}
                canRedo={history.canRedo && !historyBlocked}
                onUndo={undo}
                onRedo={redo}
            />
            <BoardToolBar
                cardEditing={isEditing || drawingMode || cardsSelected}
                drawingMode={drawingMode}
                selectionMode={selectionMode}
                searchBarOpen={searchBarOpen}
                boardNavigatorOpen={boardNavigatorOpen}
                boardZoom={boardZoom}
                setBoardZoom={setBoardZoom}
                setMenuOpen={setMenuOpen}
                setSearchBarOpen={setSearchBarOpen}
                setBoardNavigatorOpen={setBoardNavigatorOpen}
                onMemoCreateClick={withPermission(handleCreateTempMemo)}
                onImageUploadClick={withPermission(handleImageUploadClick)}
                onMermaidCreateClick={withPermission(handleCreateTempMermaid)}
                onTableCreateClick={withPermission(handleCreateTempTable)}
                onDrawingToggleClick={toggleDrawing}
                onSelectionToggleClick={toggleSelection}
            />
            {cardsSelected && (
                <SelectionToolBar
                    selectedCount={selectedCards.length}
                    onDelete={() => {
                        const keys = selectedCards.flatMap((card) => {
                            const key = collab.keyOfLocal(card.type, card.id);
                            return key ? [key] : [];
                        });
                        void collab.guard(keys, handleDeleteSelection);
                    }}
                />
            )}
            {drawingMode && (
                <DrawingToolBar
                    drawingTool={drawingTool}
                    penColor={penColor}
                    penWidth={penWidth}
                    onChangeColor={setPenColor}
                    onChangeWidth={setPenWidth}
                    onToggleErase={() => {
                        const lock = collab.foreignLock(strokeLayerKey);
                        if (drawingTool !== "erase" && lock) {
                            collab.blocked(lock);
                            return;
                        }
                        handleToggleEraseTool();
                    }}
                    onUndo={undo}
                    undoDisabled={!history.canUndo || historyBlocked}
                />
            )}
            {searchBarOpen && (
                <BoardSearchPanel
                    searchText={searchText}
                    currentIndex={searchResults.length > 0 ? searchIndex + 1 : 0}
                    searchCount={searchResults.length}
                    onTextChange={handleSearchTextChange}
                    onPrev={handleSearchPrev}
                    onNext={handleSearchNext}
                />
            )}
            {boardNavigatorOpen && (
                <BoardNavigator
                    currentMemoNumber={focusedMemoOrder}
                    memoCount={memoCount}
                    onPrev={handleFocusPrevMemo}
                    onNext={handleFocusNextMemo}
                    onMemoNumberChange={focusMemoByOrder}
                />
            )}
            {reorderOpen && !mermaidEditorPanelOpen && (
                <MemoReorderPanel
                    memos={reorderMemoList}
                    listRef={reorderListRef}
                    draggingMemoId={draggingMemoId}
                    dragOffsetY={dragOffsetY}
                    onDragStart={(event, memoId) => {
                        if (!canEditCanvas) {
                            showCanvasBlockedMessage();
                            return;
                        }
                        const orderLock = collab.foreignLock(memoOrderKey);
                        if (orderLock) {
                            collab.blocked(orderLock);
                            return;
                        }
                        handleReorderStart(event, memoId);
                    }}
                    onRowClick={handleRowClick}
                    onClose={handleCloseReorderPanel}
                />
            )}
            {assistantEnabled && <AiAssistantButton aiPanelOpen={aiPanelOpen} onToggle={handleToggleAiPanel} />}
            {assistantEnabled && aiPanelOpen && (aiUnlocked ? (
                <AiChatPanel
                    messages={aiMessages}
                    sending={aiSending}
                    saving={aiSaving}
                    hasPendingCards={hasPendingAiCards}
                    onSend={handleSendMessage}
                    onSave={handleSavePendingCards}
                    onDiscard={discardPendingCards}
                    onLock={handleAiLock}
                    onClose={handleToggleAiPanel}
                />
            ) : (
                <AiUnlockPanel
                    unlocking={aiUnlocking}
                    errorMessage={aiUnlockError}
                    onUnlock={handleAiUnlock}
                    onClose={handleToggleAiPanel}
                />
            ))}

            <main
                className="h-full w-full select-none bg-neutral-200 relative"
                onClick={() => {
                    setBoardMessage("");
                    setMemoMessage("");
                }}
            >
                <BoardImageDropOverlay isDragging={isDraggingOverBoard} />
                <div
                    ref={cardLocationRef}
                    className="board-scroll-layer h-full w-full overflow-auto"
                    data-selection-active={selectionActive || undefined}
                    onPointerDown={selectionActive ? handleSelectionPointerDown : handleBoardPanStart}
                    onPointerMove={(event) => {
                        collab.handleCursorMove(event);
                        if (selectionActive) {
                            handleSelectionPointerMove(event);
                        } else {
                            handleBoardPanMove(event);
                        }
                    }}
                    onPointerLeave={collab.handleCursorLeave}
                    onPointerUp={selectionActive ? handleSelectionPointerUp : handleBoardPanEnd}
                    onPointerCancel={selectionActive ? handleSelectionPointerCancel : undefined}
                    onDragEnter={handleDragEnter}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <div
                        className="board-size-layer"
                        style={{
                            width: `${boardWidth * boardZoom}px`,
                            height: `${boardHeight * boardZoom}px`,
                        }}
                    >
                        <div
                            ref={boardRef}
                            className="meldrift-board relative bg-white"
                            data-low-zoom={boardZoom <= 0.5 ? "true" : undefined}
                            data-mobile={isMobile ? "true" : undefined}
                            style={{
                                width: `${boardWidth}px`,
                                height: `${boardHeight}px`,
                                transform: `scale(${boardZoom})`,
                                transformOrigin: "top left",
                                backgroundImage: "radial-gradient(#d4d4d8 1px, transparent 1px)",
                                backgroundSize: "24px 24px",
                                WebkitUserSelect: "none",
                                userSelect: "none",
                                WebkitTouchCallout: "none",
                                cursor: boardCursor,
                            }}
                        >
                            {displayImages.map((image) => collab.wrapCard("image", image, `${contentVersion}:${image.imageId}`, (
                                <ImageCard
                                    key={`${contentVersion}:${image.imageId}:${collab.versionOf("image", image.syncId)}`}
                                    image={image}
                                    zoom={boardZoom}
                                    isEditing={editingImageId === image.imageId}
                                    groupOffset={groupOffsetOf("image", image.imageId)}
                                    onEditing={() => {
                                        if (!canEditCanvas) {
                                            showCanvasBlockedMessage();
                                            return;
                                        }
                                        collab.requestEdit("image", image.imageId, () => {
                                            setEditingImageId(image.imageId);
                                            handleClearSelection();
                                            setEditingMemoId(null);
                                            setEditingMermaidId(null);
                                            setEditingTableId(null);
                                            setFocusedMemoId(null);
                                        });
                                    }}
                                    onEditingClear={() => setEditingImageId(null)}
                                    onUpdate={handleUpdateImage}
                                    onGeometryChange={(geometry) => handleGeometryChange("image", image.imageId, geometry)}
                                    onDelete={handleDeleteImage}
                                    onBringToFront={() => handleCardLayer("image", image.imageId, "front")}
                                    onSendToBack={() => handleCardLayer("image", image.imageId, "back")}
                                />
                            )))}
                            {displayMemos.map((memo) => collab.wrapCard("memo", memo, `${contentVersion}:${memo.id}`, (
                                <MemoCard
                                    key={`${contentVersion}:${memo.id}:${collab.versionOf("memo", memo.syncId)}`}
                                    memo={memo}
                                    zoom={boardZoom}
                                    canEdit={canEditCanvas}
                                    isEditing={editingMemoId === memo.id}
                                    isFocused={focusedMemoId === memo.id}
                                    groupOffset={groupOffsetOf("memo", memo.id)}
                                    onFocus={() => setFocusedMemoId(memo.id)}
                                    onFocusClear={() => setFocusedMemoId(null)}
                                    onEditing={() => {
                                        if (!canEditCanvas) {
                                            showCanvasBlockedMessage();
                                            return;
                                        }
                                        collab.requestEdit("memo", memo.id, () => {
                                            setEditingMemoId(memo.id);
                                            handleClearSelection();
                                            setEditingImageId(null);
                                            setEditingMermaidId(null);
                                            setEditingTableId(null);
                                        });
                                    }}
                                    onEditingClear={() => setEditingMemoId(null)}
                                    onPermissionDenied={showCanvasBlockedMessage}
                                    onInsert={handleInsertMemo}
                                    onUpdate={handleUpdateMemo}
                                    onGeometryChange={(geometry) => handleGeometryChange("memo", memo.id, geometry)}
                                    onDelete={handleDeleteMemo}
                                    onBringToFront={() => handleCardLayer("memo", memo.id, "front")}
                                    onSendToBack={() => handleCardLayer("memo", memo.id, "back")}
                                />
                            )))}
                            {displayMermaids.map((mermaid) => collab.wrapCard("mermaid", mermaid, `${contentVersion}:${mermaid.id}`, (
                                <MermaidCard
                                    key={`${contentVersion}:${mermaid.id}:${collab.versionOf("mermaid", mermaid.syncId)}`}
                                    mermaid={mermaid}
                                    zoom={boardZoom}
                                    canEdit={canEditCanvas}
                                    isEditing={editingMermaidId === mermaid.id}
                                    groupOffset={groupOffsetOf("mermaid", mermaid.id)}
                                    onEditing={() => {
                                        if (!canEditCanvas) {
                                            showCanvasBlockedMessage();
                                            return;
                                        }
                                        collab.requestEdit("mermaid", mermaid.id, () => {
                                            setEditingMermaidId(mermaid.id);
                                            handleClearSelection();
                                            setEditingMemoId(null);
                                            setEditingImageId(null);
                                            setEditingTableId(null);
                                            setFocusedMemoId(null);
                                        });
                                    }}
                                    onEditingClear={() => setEditingMermaidId(null)}
                                    onPermissionDenied={showCanvasBlockedMessage}
                                    onInsert={handleInsertMermaid}
                                    onUpdate={handleUpdateMermaid}
                                    onGeometryChange={(geometry) => handleGeometryChange("mermaid", mermaid.id, geometry)}
                                    onDelete={handleDeleteMermaid}
                                    onBringToFront={() => handleCardLayer("mermaid", mermaid.id, "front")}
                                    onSendToBack={() => handleCardLayer("mermaid", mermaid.id, "back")}
                                />
                            )))}
                            {displayTables.map((table) => collab.wrapCard("table", table, `${contentVersion}:${table.id}`, (
                                <TableCard
                                    key={`${contentVersion}:${table.id}:${collab.versionOf("table", table.syncId)}`}
                                    table={table}
                                    zoom={boardZoom}
                                    canEdit={canEditCanvas}
                                    isEditing={editingTableId === table.id}
                                    groupOffset={groupOffsetOf("table", table.id)}
                                    onEditing={() => {
                                        if (!canEditCanvas) {
                                            showCanvasBlockedMessage();
                                            return;
                                        }
                                        collab.requestEdit("table", table.id, () => {
                                            setEditingTableId(table.id);
                                            handleClearSelection();
                                            setEditingMemoId(null);
                                            setEditingImageId(null);
                                            setEditingMermaidId(null);
                                            setFocusedMemoId(null);
                                        });
                                    }}
                                    onEditingClear={() => setEditingTableId(null)}
                                    onPermissionDenied={showCanvasBlockedMessage}
                                    onInsert={handleInsertTable}
                                    onUpdate={handleUpdateTable}
                                    onGeometryChange={(geometry) => handleGeometryChange("table", table.id, geometry)}
                                    onDelete={handleDeleteTable}
                                    onBringToFront={() => handleCardLayer("table", table.id, "front")}
                                    onSendToBack={() => handleCardLayer("table", table.id, "back")}
                                />
                            )))}
                            <BoardCornerLinksLayer links={cornerLinks} />
                            {tutorial?.step === 4 && <TutorialLinkZones memos={displayMemos} />}
                            <DrawingLayer
                                key={`${contentVersion}:${drawingMode ? "drawing-active" : "drawing-inactive"}`}
                                strokes={strokes}
                                drawingMode={drawingMode}
                                drawingTool={drawingTool}
                                penColor={penColor}
                                penWidth={penWidth}
                                zoom={boardZoom}
                                onStrokeEnd={handleStrokeEnd}
                                onErase={handleErase}
                                onInteractionChange={setDrawingInputActive}
                            />
                            {live && (
                                <CollaborationLayer
                                    zoom={boardZoom}
                                    lockedCards={collab.lockedCards}
                                    transients={live.transients}
                                    cursors={live.cursors}
                                    onBlocked={collab.blocked}
                                />
                            )}
                            {selectionActive && (
                                <SelectionLayer
                                    marqueeRect={marqueeRect}
                                    selectionBounds={selectionBounds}
                                    selectionOffset={groupOffset ?? { x: 0, y: 0 }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </main>
                    </>
                )}
            />
        </>
    );
}
