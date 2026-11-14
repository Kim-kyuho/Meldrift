"use client";

import { Rnd } from "react-rnd";
import { noop } from "../../internal/noop";
import ConfirmDialog from "../../shared/ConfirmDialog";
import { useIsMobile } from "../../shared/useIsMobile";
import { MermaidCardData, useMermaidCard } from "./useMermaidCard";
import { useMermaidDiagram } from "./useMermaidDiagram";
import { ACTIVE_CARD_Z, type SelectionOffset, type SelectionRect } from "@meldrift/core/cards";
import MermaidEditorPanel from "./MermaidEditorPanel";
import MermaidToolBar from "./MermaidToolBar";
import { mermaidMinSize } from "./mermaid-layout";

type MermaidCardProps = {
    mermaid: MermaidCardData;
    zoom: number;
    /** 권한 개념이 없는 앱은 기본값을 그대로 쓴다. */
    canEdit?: boolean;
    isEditing: boolean;
    groupOffset?: SelectionOffset;
    onEditing: () => void;
    onEditingClear: () => void;
    onPermissionDenied?: () => void;
    onUpdate: (
        id: number,
        boardId: number,
        source: string,
        x: number,
        y: number,
        width: number,
        height: number,
    ) => void;
    onInsert: (
        tempId: number,
        boardId: number,
        source: string,
        x: number,
        y: number,
        z: number,
        width: number,
        height: number,
    ) => void;
    onDelete: (id: number) => void;
    onGeometryChange?: (geometry: SelectionRect) => void;
    onBringToFront: () => void;
    onSendToBack: () => void;
};

export default function MermaidCard({
    mermaid,
    zoom,
    canEdit = true,
    isEditing,
    groupOffset,
    onEditing,
    onEditingClear,
    onPermissionDenied = noop,
    onInsert,
    onUpdate,
    onDelete,
    onGeometryChange,
    onBringToFront,
    onSendToBack,
}: MermaidCardProps) {
    const {
        cardState,
        source,
        setSource,
        deleteDialogOpen,
        dragHandlePressed,
        setDragHandlePressed,
        editMermaid,
        finishEditing,
        handleDoubleTap,
        handleMermaidPress,
        handleDragStop,
        handleResizeStop,
        fitCard,
        openDeleteDialog,
        closeDeleteDialog,
        confirmDelete,
    } = useMermaidCard({
        mermaid,
        canEdit,
        isEditing,
        onEditing,
        onEditingClear,
        onPermissionDenied,
        onInsert,
        onUpdate,
        onDelete,
        onGeometryChange,
    });
    const isMobile = useIsMobile();
    const { setRendererHost, setEditorHost, setPaletteHost } = useMermaidDiagram({
        source,
        isEditing,
        onSourceChange: setSource,
        cardSize: cardState,
        autoFit: isEditing && canEdit,
        fitInitial: mermaid.id < 0,
        onFit: fitCard,
    });

    return (
        <>
            <Rnd
                data-editing={isEditing}
                className={`mermaid-rnd-${mermaid.id} select-none rounded-xl ${isEditing ? "card-editing" : ""}`}
                style={{
                    zIndex: isEditing ? ACTIVE_CARD_Z : mermaid.z,
                    translate: groupOffset ? `${groupOffset.x}px ${groupOffset.y}px` : undefined,
                }}
                default={{
                    x: mermaid.x,
                    y: mermaid.y,
                    width: mermaid.width,
                    height: mermaid.height,
                }}
                position={{
                    x: cardState.x,
                    y: cardState.y,
                }}
                size={{
                    width: cardState.width,
                    height: cardState.height,
                }}
                bounds="parent"
                scale={zoom}
                minWidth={mermaidMinSize}
                minHeight={mermaidMinSize}
                dragHandleClassName="mermaid-drag-handle"
                disableDragging={!isEditing || !canEdit}
                enableResizing={isEditing}
                onDragStop={handleDragStop}
                onResizeStop={handleResizeStop}
            >
                <div
                    className="relative h-full w-full rounded-xl"
                    onClick={handleMermaidPress}
                    onDoubleClick={editMermaid}
                    onPointerDown={handleDoubleTap}
                >
                    <div className="relative flex h-full w-full flex-col rounded-xl">
                        {/* 편집 중이 아니면 그림을 건드리지 않고 카드 선택·편집 시작만 받는다. */}
                        <div ref={setRendererHost} inert={!isEditing} className="mermaid-card-diagram min-h-0 flex-1" />

                        {isEditing && (
                            <div
                                className="mermaid-drag-handle absolute bottom-2 left-1/2 z-10 flex h-5 w-24 -translate-x-1/2 cursor-grab items-center justify-center rounded-full active:cursor-grabbing"
                                onPointerDown={() => setDragHandlePressed(true)}
                                onPointerUp={() => setDragHandlePressed(false)}
                                onPointerCancel={() => setDragHandlePressed(false)}
                                onPointerLeave={() => setDragHandlePressed(false)}
                            >
                                <div className={`h-1.5 w-24 rounded-full transition duration-150 ${dragHandlePressed ? "bg-black/70" : "bg-black/25"}`} />
                            </div>
                        )}
                    </div>
                </div>
            </Rnd>

            {isEditing && (
                <MermaidEditorPanel
                    mobile={isMobile}
                    editorRef={setEditorHost}
                    paletteRef={isMobile ? undefined : setPaletteHost}
                    onClose={finishEditing}
                />
            )}

            {isEditing && (
                <MermaidToolBar
                    onBringToFront={onBringToFront}
                    onSendToBack={onSendToBack}
                    onDelete={openDeleteDialog}
                />
            )}

            {deleteDialogOpen && (
                <ConfirmDialog
                    message="Delete this mermaid?"
                    onConfirm={confirmDelete}
                    onCancel={closeDeleteDialog}
                />
            )}
        </>
    );
}
