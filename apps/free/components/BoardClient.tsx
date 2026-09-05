"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import ImageCard from "./ImageCard";
import AboutModal from "./AboutModal";
import HelpModal from "./HelpModal";
import AiAssistantButton from "@meldrift/ui/AiAssistantButton";
import AiChatPanel from "./AiChatPanel";
import AiUnlockPanel from "./AiUnlockPanel";
import MemoCard from "@meldrift/ui/MemoCard";
import BoardMenu from "./BoardMenu";
import BoardToolBar from "@meldrift/ui/BoardToolBar";
import BoardMessage from "@meldrift/ui/BoardMessage";
import BoardSearchPanel from "@meldrift/ui/BoardSearchPanel";
import BoardNavigator from "@meldrift/ui/BoardNavigator";
import BoardMarkdownView from "./BoardMarkdownView";
import MemoReorderPanel from "@meldrift/ui/MemoReorderPanel";
import MermaidCard from "@meldrift/ui/MermaidCard";
import TableCard from "@meldrift/ui/TableCard";
import DrawingLayer from "@meldrift/ui/DrawingLayer";
import DrawingToolBar from "@meldrift/ui/DrawingToolBar";
import ConfirmDialog from "@meldrift/ui/ConfirmDialog";
import { useBoardDrawing } from "@meldrift/ui/useBoardDrawing";
import { useCardLayer } from "@/hooks/useCardLayer";
import { useBoardImages } from "@/hooks/useBoardImages";
import { useBoardMermaids } from "@/hooks/useBoardMermaids";
import { useBoardTables } from "@/hooks/useBoardTables";
import { useBoardMemoFocus } from "@meldrift/ui/useBoardMemoFocus";
import { useBoardMemos } from "@/hooks/useBoardMemos";
import { useBoardScroll } from "@meldrift/ui/useBoardScroll";
import { useBoardSearch } from "@meldrift/ui/useBoardSearch";
import { useBoardZoom } from "@meldrift/ui/useBoardZoom";
import { useBoardPinchZoom } from "@meldrift/ui/useBoardPinchZoom";
import { useBoardTransfer } from "@/hooks/useBoardTransfer";
import { useBoardPersistance } from "@/hooks/useBoardPersistance";
import { useBoardShortcuts } from "@/hooks/useBoardShortcuts";
import { useMemoReorder } from "@/hooks/useMemoReorder";
import { useAiAssistant } from "@/hooks/useAiAssistant";
import { defaultBoard, type BoardSnapshot } from "@/lib/board-state";
import { imageInputAccept } from "@/lib/image-file";

export default function BoardClient() {
    const [currentBoard, setCurrentBoard] = useState(defaultBoard);
    const boardWidth = currentBoard.width;
    const boardHeight = currentBoard.height;
    const cardLocationRef = useRef<HTMLDivElement | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [aboutOpen, setAboutOpen] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const [markdownViewOpen, setMarkdownViewOpen] = useState(false);
    const [boardNavigatorOpen, setBoardNavigatorOpen] = useState(false);
    const [boardMessage, setBoardMessage] = useState("");

    const openHelp = useCallback(() => {
        setMenuOpen(false);
        setAboutOpen(false);
        setMarkdownViewOpen(false);
        setHelpOpen(true);
    }, []);

    const {
        boardZoom,
        setBoardZoom,
    } = useBoardZoom();

    const {
        imageInputRef,
        images,
        setImages,
        editingImageId,
        setEditingImageId,
        handleImageUploadClick,
        handleUploadImage,
        handleUpdateImage,
        handleDeleteImage,
    } = useBoardImages({
        initialImages: [],
        boardId: currentBoard.boardId,
        boardZoom,
        cardLocationRef,
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
        initialMemos: [],
        boardId: currentBoard.boardId,
        boardZoom,
        cardLocationRef,
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
        initialMermaids: [],
        boardId: currentBoard.boardId,
        boardZoom,
        cardLocationRef,
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
        initialTables: [],
        boardId: currentBoard.boardId,
        boardZoom,
        cardLocationRef,
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
        handleUndoStroke,
    } = useBoardDrawing({
        initialStrokes: [],
    });

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
        handleSendMessage: handleAiSendMessage,
        handleSavePendingCards: handleSaveAiCards,
        discardPendingCards: discardAiCards,
    } = useAiAssistant({
        boardId: currentBoard.boardId,
        boardWidth,
        boardHeight,
        boardZoom,
        cardLocationRef,
        setMessage: setBoardMessage,
        memos,
        mermaids,
        tables,
        images,
        setMemos,
        setMermaids,
        setTables,
        setImages,
        onInsertMemo: handleInsertMemo,
        onInsertMermaid: handleInsertMermaid,
        onInsertTable: handleInsertTable,
        onUpdateMemo: handleUpdateMemo,
        onUpdateMermaid: handleUpdateMermaid,
        onUpdateTable: handleUpdateTable,
        onDeleteMemo: handleDeleteMemo,
        onDeleteMermaid: handleDeleteMermaid,
        onDeleteTable: handleDeleteTable,
        onDeleteImage: handleDeleteImage,
    });

    const isEditing =
        editingMemoId !== null ||
        editingImageId !== null ||
        editingMermaidId !== null ||
        editingTableId !== null;

    const snapshot = useMemo<BoardSnapshot>(() => ({
        board: currentBoard,
        memos,
        images,
        mermaids,
        tables,
        strokes,
    }), [currentBoard, images, memos, mermaids, strokes, tables]);

    useBoardShortcuts({
        onOpenHelp: openHelp,
    });

    const exportDisabled = isEditing || drawingMode || hasPendingAiCards;

    const {
        importInputRef,
        transferring,
        resetting,
        resetDialogOpen,
        handleExport,
        handleImportClick,
        handleImport,
        handleResetClick,
        handleResetCancel,
        handleResetConfirm,
    } = useBoardTransfer({
        exportDisabled,
        setMessage: setBoardMessage,
        getSnapshot: () => snapshot,
    });

    const savePaused = isEditing || drawingMode || hasPendingAiCards || resetting;

    const {
        databaseReady,
        databaseError,
    } = useBoardPersistance({
        snapshot,
        savePaused,
        setCurrentBoard,
        setMemos,
        setImages,
        setMermaids,
        setTables,
        setStrokes,
        onEmptyBoard: openHelp,
        setMessage: setBoardMessage,
    });

    const {
        boardPanning,
        handleBoardPanStart,
        handleBoardPanMove,
        handleBoardPanEnd,
    } = useBoardScroll({
        cardEditing: isEditing,
        boardScrollRef: cardLocationRef,
    });

    useBoardPinchZoom({
        boardScrollRef: cardLocationRef,
        boardZoom,
        setBoardZoom,
        enabled: databaseReady,
    });

    const { handleCardLayer } = useCardLayer({
        memos,
        images,
        mermaids,
        tables,
        setMemos,
        setImages,
        setMermaids,
        setTables,
    });

    if (databaseError) {
        return (
            <main className="flex h-screen w-screen items-center justify-center bg-neutral-100 p-6">
                <div className="max-w-lg rounded-xl bg-white p-6 shadow-md">
                    <h1 className="text-lg font-bold text-neutral-900">Browser SQLite could not start</h1>
                    <p className="mt-2 text-sm text-neutral-600">{databaseError}</p>
                    <p className="mt-3 text-sm text-neutral-500">
                        Use a current browser with IndexedDB enabled and open this page over HTTPS or localhost.
                    </p>
                </div>
            </main>
        );
    }

    if (!databaseReady) {
        return (
            <main className="flex h-screen w-screen items-center justify-center bg-neutral-100 text-sm text-neutral-600">
                Opening browser SQLite...
            </main>
        );
    }

  return (
    <>
        <input
            ref={importInputRef}
            type="file"
            aria-label="Import board database"
            className="hidden"
            onChange={handleImport}
        />
        <input
            ref={imageInputRef}
            type="file"
            accept={imageInputAccept}
            aria-label="Upload image"
            className="hidden"
            onChange={handleUploadImage}
        />
        <BoardMenu
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
            exportDisabled={exportDisabled}
            transferring={transferring}
            resetting={resetting}
            reorderOpen={reorderOpen}
            onReorder={handleToggleReorderPanel}
            onExport={handleExport}
            onImport={handleImportClick}
            onCompileMarkdown={() => setMarkdownViewOpen(true)}
            onReset={handleResetClick}
            onAbout={() => setAboutOpen(true)}
        />
        <BoardToolBar
            cardEditing={isEditing || drawingMode}
            drawingMode={drawingMode}
            searchBarOpen={searchBarOpen}
            boardNavigatorOpen={boardNavigatorOpen}
            boardZoom={boardZoom}
            setBoardZoom={setBoardZoom}
            setMenuOpen={setMenuOpen}
            setSearchBarOpen={setSearchBarOpen}
            setBoardNavigatorOpen={setBoardNavigatorOpen}
            onMemoCreateClick={handleCreateTempMemo}
            onImageUploadClick={handleImageUploadClick}
            onMermaidCreateClick={handleCreateTempMermaid}
            onTableCreateClick={handleCreateTempTable}
            onDrawingToggleClick={handleToggleDrawingMode}
        />
        {drawingMode && (
            <DrawingToolBar
                drawingTool={drawingTool}
                penColor={penColor}
                penWidth={penWidth}
                onChangeColor={setPenColor}
                onChangeWidth={setPenWidth}
                onToggleErase={handleToggleEraseTool}
                onUndo={handleUndoStroke}
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
        {reorderOpen && (
            <MemoReorderPanel
                memos={reorderMemoList}
                listRef={reorderListRef}
                draggingMemoId={draggingMemoId}
                dragOffsetY={dragOffsetY}
                onDragStart={handleReorderStart}
                onRowClick={handleRowClick}
                onClose={handleCloseReorderPanel}
            />
        )}
        {aboutOpen && (
            <AboutModal onClose={() => setAboutOpen(false)} />
        )}
        {helpOpen && (
            <HelpModal onClose={() => setHelpOpen(false)} />
        )}
        {resetDialogOpen && (
            <ConfirmDialog
                title="Reset Meldrift Free Edition?"
                message="Once deleted, your board data cannot be recovered."
                onConfirm={handleResetConfirm}
                onCancel={handleResetCancel}
            />
        )}
        <AiAssistantButton
            aiPanelOpen={aiPanelOpen}
            onToggle={handleToggleAiPanel}
        />
        {aiPanelOpen && (aiUnlocked ? (
            <AiChatPanel
                messages={aiMessages}
                sending={aiSending}
                saving={aiSaving}
                hasPendingCards={hasPendingAiCards}
                onSend={handleAiSendMessage}
                onSave={handleSaveAiCards}
                onDiscard={discardAiCards}
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
        {markdownViewOpen && (
            <BoardMarkdownView
                snapshot={snapshot}
                onClose={() => setMarkdownViewOpen(false)}
            />
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
    
         <main
            className="h-screen w-screen select-none bg-neutral-200"
            onClick={()=>{
                setBoardMessage("");
                setMemoMessage("");
            }}
        >
            <div
                ref={cardLocationRef}
                className="board-scroll-layer h-full w-full overflow-auto"
                onPointerDown={handleBoardPanStart}
                onPointerMove={handleBoardPanMove}
                onPointerUp={handleBoardPanEnd}
            >
                <div
                    className="board-size-layer"
                    style={{
                        width: `${boardWidth * boardZoom}px`,
                        height: `${boardHeight * boardZoom}px`,
                    }}
                >
                    <div
                        className="meldrift-board relative bg-white"
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
                                cursor: boardPanning ? "grabbing" : "grab",
                            }}
                    >
                        {images.map((image) => (
                            <ImageCard
                                key={image.imageId}
                                image={image}
                                zoom={boardZoom}
                                isEditing={editingImageId === image.imageId}
                                onEditing={() => {
                                    setEditingImageId(image.imageId);
                                    setEditingMemoId(null);
                                    setEditingMermaidId(null);
                                    setEditingTableId(null);
                                    setFocusedMemoId(null);
                                }}
                                onEditingClear={() => setEditingImageId(null)}
                                onUpdate={handleUpdateImage}
                                onDelete={handleDeleteImage}
                                onBringToFront={() => handleCardLayer("image", image.imageId, "front")}
                                onSendToBack={() => handleCardLayer("image", image.imageId, "back")}
                            />
                        ))}
                        {memos.map((memo) => (
                            <MemoCard
                                key={memo.id}
                                memo={memo}
                                zoom={boardZoom}
                                isEditing={editingMemoId === memo.id}
                                isFocused={focusedMemoId === memo.id}
                                onFocus={() => setFocusedMemoId(memo.id)}
                                onFocusClear={() => setFocusedMemoId(null)}
                                onEditing={() => {
                                    setEditingMemoId(memo.id);
                                    setEditingImageId(null);
                                    setEditingMermaidId(null);
                                    setEditingTableId(null);
                                }}
                                onEditingClear={() => setEditingMemoId(null)}
                                onInsert={handleInsertMemo}
                                onUpdate={handleUpdateMemo}
                                onDelete={handleDeleteMemo}
                                onBringToFront={() => handleCardLayer("memo", memo.id, "front")}
                                onSendToBack={() => handleCardLayer("memo", memo.id, "back")}
                            />
                        ))}
                        {mermaids.map((mermaid) => (
                            <MermaidCard
                                key={mermaid.id}
                                mermaid={mermaid}
                                zoom={boardZoom}
                                isEditing={editingMermaidId === mermaid.id}
                                onEditing={() => {
                                    setEditingMermaidId(mermaid.id);
                                    setEditingMemoId(null);
                                    setEditingImageId(null);
                                    setEditingTableId(null);
                                    setFocusedMemoId(null);
                                }}
                                onEditingClear={() => setEditingMermaidId(null)}
                                onInsert={handleInsertMermaid}
                                onUpdate={handleUpdateMermaid}
                                onDelete={handleDeleteMermaid}
                                onBringToFront={() => handleCardLayer("mermaid", mermaid.id, "front")}
                                onSendToBack={() => handleCardLayer("mermaid", mermaid.id, "back")}
                            />
                        ))}
                        {tables.map((table) => (
                            <TableCard
                                key={table.id}
                                table={table}
                                zoom={boardZoom}
                                isEditing={editingTableId === table.id}
                                onEditing={() => {
                                    setEditingTableId(table.id);
                                    setEditingMemoId(null);
                                    setEditingImageId(null);
                                    setEditingMermaidId(null);
                                    setFocusedMemoId(null);
                                }}
                                onEditingClear={() => setEditingTableId(null)}
                                onInsert={handleInsertTable}
                                onUpdate={handleUpdateTable}
                                onDelete={handleDeleteTable}
                                onBringToFront={() => handleCardLayer("table", table.id, "front")}
                                onSendToBack={() => handleCardLayer("table", table.id, "back")}
                            />
                        ))}
                        <DrawingLayer
                            key={drawingMode ? "drawing-active" : "drawing-inactive"}
                            strokes={strokes}
                            drawingMode={drawingMode}
                            drawingTool={drawingTool}
                            penColor={penColor}
                            penWidth={penWidth}
                            zoom={boardZoom}
                            onStrokeEnd={handleStrokeEnd}
                            onErase={handleErase}
                        />
                    </div>
                </div>
            </div>
        </main>
    </>
  );
}
