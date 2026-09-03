"use client";

import { useRef, useState } from "react";
import SignInModal from "./SignInModal";
import SignUpModal from "./SignUpModal";
import ImageCard from "./ImageCard";
import MemoCard from "@meldrift/ui/MemoCard";
import BoardMenu from "./BoardMenu";
import BoardToolBar from "./BoardToolBar";
import BoardMessage from "./BoardMessage";
import BoardSearchPanel from "@meldrift/ui/BoardSearchPanel";
import BoardNavigator from "@meldrift/ui/BoardNavigator";
import BoardMarkdownView from "./BoardMarkdownView";
import MemoReorderPanel from "@meldrift/ui/MemoReorderPanel";
import AboutModal from "./AboutModal";
import AiAssistantButton from "@meldrift/ui/AiAssistantButton";
import AiChatPanel from "./AiChatPanel";
import MermaidCard from "@meldrift/ui/MermaidCard";
import TableCard from "@meldrift/ui/TableCard";
import DrawingLayer from "./DrawingLayer";
import DrawingToolBar from "@meldrift/ui/DrawingToolBar";
import type { BoardStroke } from "@meldrift/core/board-stroke";
import { useBoardDrawing } from "@/hooks/useBoardDrawing";
import { useCardLayer } from "@/hooks/useCardLayer";
import { useBoardAuth } from "@/hooks/useBoardAuth";
import { useBoardImages } from "@/hooks/useBoardImages";
import { useBoardMermaids } from "@/hooks/useBoardMermaids";
import { useBoardTables } from "@/hooks/useBoardTables";
import type { TableSource } from "@meldrift/core/table-card";
import { useBoardMemoFocus } from "@meldrift/ui/useBoardMemoFocus";
import { useBoardMemos } from "@/hooks/useBoardMemos";
import { useBoardScroll } from "@meldrift/ui/useBoardScroll";
import { useBoardSearch } from "@meldrift/ui/useBoardSearch";
import { useBoardZoom } from "@meldrift/ui/useBoardZoom";
import { useBoardPinchZoom } from "@meldrift/ui/useBoardPinchZoom";
import { useBoardPreview } from "@/hooks/useBoardPreview";
import { useAiAssistant } from "@/hooks/useAiAssistant";
import { useMemoReorder } from "@/hooks/useMemoReorder";

interface Board {
  boardId: number;
  title: string;
  width: number;
  height: number;
}

interface Image {
    imageId: number;
    boardId: number;
    publicId: string;
    secureUrl: string;
    fileName: string | null;
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
}

interface Memo {
    id: number;
    boardId: number;
    content: string;
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
    color: string;
    sortOrder: number;
}

interface Mermaid {
    id: number;
    boardId: number;
    source: string;
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
}

interface Table {
    id: number;
    boardId: number;
    source: TableSource;
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
}

export default function BoardClient(
  {currentBoard, mappedImages, mappedMemos, mappedMermaids, mappedTables, mappedStrokes}:{currentBoard:Board, mappedImages: Image[], mappedMemos: Memo[], mappedMermaids: Mermaid[], mappedTables: Table[], mappedStrokes: BoardStroke[]}
) {
    const boardWidth = currentBoard.width;
    const boardHeight = currentBoard.height;
    const cardLocationRef = useRef<HTMLDivElement | null>(null);
    const { schedulePreviewUpdate } = useBoardPreview({
        boardId: currentBoard.boardId,
        boardViewportRef: cardLocationRef,
    });
    const [menuOpen, setMenuOpen] = useState(false);
    const [aboutOpen, setAboutOpen] = useState(false);
    const [markdownViewOpen, setMarkdownViewOpen] = useState(false);
    const [boardNavigatorOpen, setBoardNavigatorOpen] = useState(false);
    const [permissionMessage, setPermissionMessage] = useState("");
    const showPermissionMessage = () => {
        setPermissionMessage(
            currentUser
                ? "Your account is waiting for administrator approval."
                : "Please sign in before editing cards."
        );
    };

    const {
        boardZoom,
        setBoardZoom,
    } = useBoardZoom();

    const {
        signInOpen, setSignInOpen,
        signUpOpen, setSignUpOpen,
        currentUser, setCurrentUser,
        canEditCard,
        handleSignOut,
    } = useBoardAuth({
        onSignOutComplete: () => {
            setPermissionMessage("");
            setMemoMessage("");
            setMenuOpen(false);
        },
    });

    const {
        imageInputRef,
        images,
        setImages,
        editingImageId,
        setEditingImageId,
        handleImageUploadClick,
        handleUploadImage,
        handleInsertImage,
        handleUpdateImage,
        handleDeleteImage,
    } = useBoardImages({
        initialImages: mappedImages,
        boardId: currentBoard.boardId,
        boardZoom,
        cardLocationRef,
        canEditCard,
        showPermissionMessage,
        setPermissionMessage,
        onPreviewUpdate: schedulePreviewUpdate,
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
        canEditCard,
        showPermissionMessage,
        setPermissionMessage,
        onPreviewUpdate: schedulePreviewUpdate,
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
        boardId: currentBoard.boardId,
        memos,
        setMemos,
        canEditCard,
        showPermissionMessage,
        setPermissionMessage,
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
        canEditCard,
        cardLocationRef,
        showPermissionMessage,
        setPermissionMessage,
        onPreviewUpdate: schedulePreviewUpdate,
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
        canEditCard,
        cardLocationRef,
        showPermissionMessage,
        setPermissionMessage,
        onPreviewUpdate: schedulePreviewUpdate,
    });

    const {
        aiPanelOpen,
        messages: aiMessages,
        sending: aiSending,
        saving: aiSaving,
        hasPendingCards: hasPendingAiCards,
        handleToggleAiPanel,
        handleSendMessage,
        handleSavePendingCards,
        discardPendingCards,
    } = useAiAssistant({
        boardId: currentBoard.boardId,
        boardWidth,
        boardHeight,
        boardZoom,
        cardLocationRef,
        canEditCard,
        showPermissionMessage,
        setPermissionMessage,
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
        onInsertImage: handleInsertImage,
        onDeleteMemo: handleDeleteMemo,
        onDeleteMermaid: handleDeleteMermaid,
        onDeleteTable: handleDeleteTable,
        onDeleteImage: handleDeleteImage,
    });

    const {
        strokes,
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
        initialStrokes: mappedStrokes,
        boardId: currentBoard.boardId,
        canEditCard,
        showPermissionMessage,
        setPermissionMessage,
        onPreviewUpdate: schedulePreviewUpdate,
    });

    const isEditing =
        editingMemoId !== null ||
        editingImageId !== null ||
        editingMermaidId !== null ||
        editingTableId !== null;

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
    });

    const { handleCardLayer } = useCardLayer({
        boardId: currentBoard.boardId,
        setMemos,
        setImages,
        setMermaids,
        setTables,
        setPermissionMessage,
    });

  return (
    <>
        <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUploadImage}
        />
        <BoardMenu
            menuOpen={menuOpen}
            currentBoard={currentBoard}
            setMenuOpen={setMenuOpen}
            setSignInOpen={setSignInOpen}
            setSignUpOpen={setSignUpOpen}
            onSignOut={handleSignOut}
            currentUser={currentUser}
            onCompileMarkdown={() => setMarkdownViewOpen(true)}
            reorderOpen={reorderOpen}
            onReorder={handleToggleReorderPanel}
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
        {signInOpen && (
            <SignInModal
                onClose={() => setSignInOpen(false)}
                onSignIn={(user) => setCurrentUser(user)}
            />
        )}
        {signUpOpen && (
            <SignUpModal 
                onClose={() => setSignUpOpen(false)} 
            />
        )}
        {markdownViewOpen && (
            <BoardMarkdownView
                boardId={currentBoard.boardId}
                onClose={() => setMarkdownViewOpen(false)}
            />
        )}
        {aboutOpen && (
            <AboutModal onClose={() => setAboutOpen(false)} />
        )}
        <AiAssistantButton
            aiPanelOpen={aiPanelOpen}
            onToggle={handleToggleAiPanel}
        />
        {aiPanelOpen && (
            <AiChatPanel
                messages={aiMessages}
                sending={aiSending}
                saving={aiSaving}
                hasPendingCards={hasPendingAiCards}
                onSend={handleSendMessage}
                onSave={handleSavePendingCards}
                onDiscard={discardPendingCards}
                onClose={handleToggleAiPanel}
            />
        )}
        <BoardMessage
            type="permission"
            message={permissionMessage}
            onDismiss={() => setPermissionMessage("")}
        />
        <BoardMessage
            type="memo"
            message={memoMessage}
            onDismiss={() => setMemoMessage("")}
        />
    
         <main
            className="h-screen w-screen select-none bg-neutral-200"
            onClick={()=>{
                setPermissionMessage("");
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
                            canEdit={canEditCard}
                            isEditing={editingImageId === image.imageId}
                            onEditing={() => {
                                setEditingImageId(image.imageId);
                                setEditingMemoId(null);
                                setEditingMermaidId(null);
                                setEditingTableId(null);
                                setFocusedMemoId(null);
                            }}
                            onEditingClear={() => setEditingImageId(null)}
                            onPermissionDenied={showPermissionMessage}
                            onInsert={handleInsertImage}
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
                            canEdit={canEditCard}
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
                            onPermissionDenied={showPermissionMessage}
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
                            canEdit={canEditCard}
                            isEditing={editingMermaidId === mermaid.id}
                            onEditing={() => {
                                setEditingMermaidId(mermaid.id);
                                setEditingMemoId(null);
                                setEditingImageId(null);
                                setEditingTableId(null);
                                setFocusedMemoId(null);
                            }}
                            onEditingClear={() => setEditingMermaidId(null)}
                            onPermissionDenied={showPermissionMessage}
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
                            canEdit={canEditCard}
                            isEditing={editingTableId === table.id}
                            onEditing={() => {
                                setEditingTableId(table.id);
                                setEditingMemoId(null);
                                setEditingImageId(null);
                                setEditingMermaidId(null);
                                setFocusedMemoId(null);
                            }}
                            onEditingClear={() => setEditingTableId(null)}
                            onPermissionDenied={showPermissionMessage}
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
