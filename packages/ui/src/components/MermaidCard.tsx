"use client";

import { lazy, Suspense } from "react";
import { PenTool } from "lucide-react";
import { Rnd } from "react-rnd";
import { noop } from "../internal/noop";
import { MermaidCardData, useMermaidCard } from "../hooks/useMermaidCard";
import { useMermaidRenderer } from "../hooks/useMermaidRenderer";
import ConfirmDialog from "./ConfirmDialog";
import { ACTIVE_CARD_Z } from "@meldrift/core/cards";
import {
    detectMermaidDiagramType,
    getMermaidTemplate,
    hasMermaidHandDrawnLook,
    mermaidDiagramDefinitions,
    toggleMermaidHandDrawnLook,
    type MermaidDiagramType,
} from "@meldrift/core/mermaid-language";
import MermaidToolBar from "./MermaidToolBar";

const MermaidCodeEditor = lazy(() => import("./MermaidCodeEditor"));

type MermaidCardProps = {
    mermaid: MermaidCardData;
    zoom: number;
    /** 권한 개념이 없는 앱은 기본값을 그대로 쓴다. */
    canEdit?: boolean;
    isEditing: boolean;
    onEditing: () => void;
    onEditingClear: () => void;
    onPermissionDenied?: () => void;
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
    canEdit = true,
    isEditing,
    onEditing,
    onEditingClear,
    onPermissionDenied = noop,
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
    const handDrawn = hasMermaidHandDrawnLook(source);

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
                            <div className="flex h-2/5 min-h-24 border-b border-neutral-200 bg-neutral-50">
                                {/* size를 주면 팝업 대신 인라인 목록으로 그려져 높이와 스크롤을 CSS로 잡을 수 있다. */}
                                <select
                                    size={5}
                                    aria-label="Mermaid diagram type"
                                    value={detectMermaidDiagramType(source)}
                                    onChange={(event) => setSource(getMermaidTemplate(event.target.value as MermaidDiagramType))}
                                    className="h-full w-40 min-w-24 overflow-y-auto border-0 border-r border-neutral-200 bg-white text-sm font-semibold text-neutral-700 outline-none"
                                >
                                    {mermaidDiagramDefinitions.map((diagram) => (
                                        <option key={diagram.id} value={diagram.id}>
                                            {diagram.label}
                                        </option>
                                    ))}
                                </select>
                                <Suspense fallback={<div className="min-h-0 min-w-0 flex-1 bg-neutral-50" />}>
                                    <MermaidCodeEditor value={source} onChange={setSource} />
                                </Suspense>
                            </div>
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

                        {isEditing && (
                            <button
                                type="button"
                                aria-label="Hand drawn look"
                                aria-pressed={handDrawn}
                                title="Hand drawn look"
                                onClick={() => setSource(toggleMermaidHandDrawnLook(source))}
                                className={`absolute bottom-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full transition duration-150 ${
                                    handDrawn ? "bg-neutral-900 text-white" : "bg-black/10 text-neutral-500 hover:bg-black/20"
                                }`}
                            >
                                <PenTool className="h-3.5 w-3.5" />
                            </button>
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
