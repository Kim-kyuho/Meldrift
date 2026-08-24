"use client";

import { Rnd } from "react-rnd";
import { MermaidCardData, useMermaidCard } from "@/hooks/useMermaidCard";
import { useMermaidRenderer } from "@/hooks/useMermaidRenderer";
import ConfirmDialog from "@/components/ConfirmDialog";
import { ACTIVE_CARD_Z } from "@/lib/zIndex";
import MermaidToolBar from "./MermaidToolBar";

type MermaidCardProps = {
    mermaid: MermaidCardData;
    zoom: number;
    canEdit: boolean;
    isEditing: boolean;
    onEditing: () => void;
    onEditingClear: () => void;
    onPermissionDenied: () => void;
    onUpdate: (
        id: number,
        boardId: number,
        source: string,
        x: number,
        y: number,
        z: number,
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
    onBringToFront: () => void;
    onSendToBack: () => void;
};

export default function MermaidCard({
    mermaid,
    zoom,
    canEdit,
    isEditing,
    onEditing,
    onEditingClear,
    onPermissionDenied,
    onInsert,
    onUpdate,
    onDelete,
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
        handleDoubleTap,
        handleMermaidPress,
        handleDragStop,
        handleResizeStop,
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
    });
    const { svg, renderError } = useMermaidRenderer({
        source,
        mermaidId: mermaid.id,
    });

    return (
        <>
            <Rnd
                data-editing={isEditing}
                className={`mermaid-rnd-${mermaid.id} select-none rounded-xl ${isEditing ? "card-editing" : ""}`}
                style={{
                    zIndex: isEditing ? ACTIVE_CARD_Z : mermaid.z,
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
                minWidth={180}
                minHeight={180}
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
                    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-xl">
                        {isEditing && (
                            <textarea
                                value={source}
                                onChange={(event) => setSource(event.target.value)}
                                className="h-2/5 min-h-24 resize-none border-b border-neutral-200 bg-neutral-50 p-3 font-mono text-base text-neutral-900 outline-none"
                                spellCheck={false}
                            />
                        )}

                        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-3">
                            {renderError ? (
                                <pre className="w-full whitespace-pre-wrap rounded-md bg-rose-50 p-3 text-xs text-rose-700">
                                    {renderError}
                                </pre>
                            ) : svg ? (
                                <div
                                    className="mermaid-rendered h-full w-full"
                                    dangerouslySetInnerHTML={{ __html: svg }}
                                />
                            ) : (
                                <div className="text-sm text-neutral-400">Mermaid source is empty.</div>
                            )}
                        </div>

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
