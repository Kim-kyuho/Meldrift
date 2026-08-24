"use client";

import { Rnd } from "react-rnd";
import { BoardTable } from "@/hooks/useBoardTables";
import { useTableCard } from "@/hooks/useTableCard";
import { ACTIVE_CARD_Z } from "@/lib/zIndex";
import ConfirmDialog from "./ConfirmDialog";
import TableGrid from "./TableGrid";
import TableToolBar from "./TableToolBar";

const TABLE_CARD_MIN_HEIGHT = 128;

type TableCardProps = {
    table: BoardTable;
    zoom: number;
    isEditing: boolean;
    onEditing: () => void;
    onEditingClear: () => void;
    onInsert: (table: BoardTable) => void;
    onUpdate: (table: BoardTable) => void;
    onDelete: (id: number) => void;
    onBringToFront: () => void;
    onSendToBack: () => void;
};

export default function TableCard({
    table,
    zoom,
    isEditing,
    onEditing,
    onEditingClear,
    onInsert,
    onUpdate,
    onDelete,
    onBringToFront,
    onSendToBack,
}: TableCardProps) {
    const {
        source,
        setSource,
        cardState,
        dragHandlePressed,
        setDragHandlePressed,
        deleteDialogOpen,
        editTable,
        handleDoubleTap,
        handleTablePress,
        handleDragStop,
        handleResizeStop,
        openDeleteDialog,
        closeDeleteDialog,
        confirmDelete,
    } = useTableCard({
        table,
        isEditing,
        onEditing,
        onEditingClear,
        onInsert,
        onUpdate,
        onDelete,
    });
    return (
        <>
            <Rnd
                data-editing={isEditing}
                className={`table-rnd-${table.id} select-none rounded-xl ${isEditing ? "card-editing" : ""}`}
                style={{ zIndex: isEditing ? ACTIVE_CARD_Z : table.z }}
                position={{ x: cardState.x, y: cardState.y }}
                size={{ width: cardState.width, height: cardState.height }}
                bounds="parent"
                scale={zoom}
                dragHandleClassName="table-drag-handle"
                disableDragging={!isEditing}
                enableResizing={isEditing}
                minWidth={360}
                minHeight={TABLE_CARD_MIN_HEIGHT}
                onDragStop={handleDragStop}
                onResizeStop={handleResizeStop}
            >
                <div
                    className="relative h-full w-full overflow-hidden rounded-xl"
                    onClick={handleTablePress}
                    onDoubleClick={editTable}
                    onPointerDown={handleDoubleTap}
                >
                    <TableGrid source={source} isEditing={isEditing} onChange={setSource} />

                    {isEditing && (
                        <div
                            className="table-drag-handle absolute bottom-2 left-1/2 z-20 flex h-5 w-24 -translate-x-1/2 cursor-grab items-center justify-center rounded-full active:cursor-grabbing"
                            onPointerDown={() => setDragHandlePressed(true)}
                            onPointerUp={() => setDragHandlePressed(false)}
                            onPointerCancel={() => setDragHandlePressed(false)}
                            onPointerLeave={() => setDragHandlePressed(false)}
                        >
                            <div className={`h-1.5 w-24 rounded-full transition ${dragHandlePressed ? "bg-black/70" : "bg-black/25"}`} />
                        </div>
                    )}

                </div>
            </Rnd>

            {isEditing && (
                <TableToolBar
                    onBringToFront={onBringToFront}
                    onSendToBack={onSendToBack}
                    onDelete={openDeleteDialog}
                />
            )}

            {deleteDialogOpen && (
                <ConfirmDialog
                    message="Delete this table?"
                    onConfirm={confirmDelete}
                    onCancel={closeDeleteDialog}
                />
            )}
        </>
    );
}
