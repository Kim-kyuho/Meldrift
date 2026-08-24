import { useRef } from "react";
import { Rnd } from "react-rnd";
import ConfirmDialog from "@/components/ConfirmDialog";
import { MemoCardData, useMemoCard } from "@/hooks/useMemoCard";
import { ACTIVE_CARD_Z } from "@/lib/zIndex";
import MemoEditor from "./MemoEditor";
import type { MemoEditorHandle } from "./MemoEditor";
import MemoToolBar from "./MemoToolBar";

type MemoCardProps = {
    memo: MemoCardData;
    zoom: number;
    isEditing: boolean;
    isFocused: boolean;
    onFocus: () => void;
    onFocusClear: () => void;
    onEditing: () => void;
    onEditingClear: () => void;
    onInsert: (
        tempId: number,
        boardId: number,
        content: string,
        x: number,
        y: number,
        z: number,
        width: number,
        height: number,
        color: string
    ) => void;
    onUpdate: (
        id: number,
        boardId: number,
        content: string,
        x: number,
        y: number,
        z: number,
        width: number,
        height: number,
        color: string
    ) => void;
    onDelete: (id: number) => void;
    onBringToFront: () => void;
    onSendToBack: () => void;
};

// 메모 카드 컴포넌트
export default function MemoCard(props: MemoCardProps) {
    const {
        memo,
        zoom,
        isEditing,
        isFocused,
        onFocus,
        onFocusClear,
        onEditing,
        onEditingClear,
        onInsert,
        onUpdate,
        onDelete,
        onBringToFront,
        onSendToBack,
    } = props;
    const {
        memoColor,
        setMemoColor,
        memoFocusRef,
        memoState,
        memoContent,
        setMemoContent,
        deleteDialogOpen,
        dragHandlePressed,
        setDragHandlePressed,
        editMemo,
        handleDoubleTap,
        handleMemoPress,
        handleDragStop,
        handleResizeStop,
        openDeleteDialog,
        closeDeleteDialog,
        confirmDelete,
    } = useMemoCard({
        memo,
        isEditing,
        isFocused,
        onEditing,
        onEditingClear,
        onFocus,
        onFocusClear,
        onInsert,
        onUpdate,
        onDelete,
    });

    const memoEditorRef = useRef<MemoEditorHandle>(null);

    return (
        <>
            <Rnd 
                data-editing={isEditing}
                className={`memo-rnd-${memo.id} select-none rounded-xl ${isEditing ? "card-editing" : isFocused ? "memo-focused" : ""}`}
                style={{
                    zIndex: isEditing ? ACTIVE_CARD_Z : memo.z,
                }}
                default={{
                    x: memo.x,
                    y: memo.y,
                    width: memo.width ?? 300,
                    height: memo.height ?? 200,
                }}
                position={{
                    x: memoState.x,
                    y: memoState.y,
                }}
                size={{
                    width: memoState.width,
                    height: memoState.height,
                }}
                bounds="parent"
                scale={zoom}
                minWidth={180}
                minHeight={180}
                dragHandleClassName="memo-drag-handle"
                disableDragging={!isEditing}
                enableResizing={isEditing}
                onDragStop={handleDragStop}
                onResizeStop={handleResizeStop}
            >   
                <div
                    className="relative h-full w-full"
                    onClick={handleMemoPress}
                >
                    {isEditing ? (
                        <div
                            className="relative h-full w-full rounded-xl p-4 shadow-xl text-neutral-900"
                            ref={memoFocusRef}
                            tabIndex={-1}
                            style={{
                                backgroundColor: memoColor,
                                cursor: "text",
                            }}
                        >
                            <MemoEditor
                                ref={memoEditorRef}
                                content={memoContent}
                                onChange={setMemoContent}
                            />
                        </div>
                    ) : (
                        <div
                            className="h-full w-full rounded-xl p-4 shadow-md text-neutral-900"
                            style={{
                                backgroundColor: memoColor,
                                WebkitTouchCallout: "none",
                                WebkitUserSelect: "none",
                                userSelect: "none",
                            }}
                            onDoubleClick={editMemo}
                            onPointerDown={handleDoubleTap}
                        >
                            <div
                                className="memo-editor-content"
                                dangerouslySetInnerHTML={{ __html: memoContent }}
                            />
                        </div>
                    )}
                    {isEditing && (
                        <div
                            className="memo-drag-handle absolute bottom-2 left-1/2 z-10 flex h-5 w-24 -translate-x-1/2 cursor-grab items-center justify-center rounded-full active:cursor-grabbing"
                            onPointerDown={() => setDragHandlePressed(true)}
                            onPointerUp={() => setDragHandlePressed(false)}
                            onPointerCancel={() => setDragHandlePressed(false)}
                            onPointerLeave={() => setDragHandlePressed(false)}
                        >
                            <div className={`h-1.5 w-24 rounded-full transition duration-150 ${dragHandlePressed ? "bg-black/70" : "bg-black/25"}`} />
                        </div>
                    )}
                </div>
            </Rnd>

            {isEditing && (
                <MemoToolBar
                    onChangeColor={setMemoColor}
                    onHeading={(level) => memoEditorRef.current?.toggleHeading(level)}
                    onBold={() => memoEditorRef.current?.toggleBold()}
                    onItalic={() => memoEditorRef.current?.toggleItalic()}
                    onStrike={() => memoEditorRef.current?.toggleStrike()}
                    onHorizontalRule={() => memoEditorRef.current?.setHorizontalRule()}
                    onHighlight={() => memoEditorRef.current?.toggleHighlight()}
                    onCodeBlock={() => memoEditorRef.current?.toggleCodeBlock()}
                    onBlockQuote={() => memoEditorRef.current?.toggleBlockQuote()}
                    onBringToFront={onBringToFront}
                    onSendToBack={onSendToBack}
                    onDelete={openDeleteDialog}
                />
            )}
        
            {deleteDialogOpen && (
                <ConfirmDialog
                    message="Delete this memo?"
                    onConfirm={confirmDelete}
                    onCancel={closeDeleteDialog}
                />
            )}
        </>
    );
}
