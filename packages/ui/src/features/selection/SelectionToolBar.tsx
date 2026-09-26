"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import ConfirmDialog from "../../shared/ConfirmDialog";
import { CardToolButton, CardToolPortal } from "../../shared/CardToolPortal";

type SelectionToolBarProps = {
    selectedCount: number;
    onDelete: () => void;
};

export default function SelectionToolBar({
    selectedCount,
    onDelete,
}: SelectionToolBarProps) {
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    return (
        <>
            <CardToolPortal>
                <CardToolButton label="Delete selected cards" onClick={() => setDeleteDialogOpen(true)}>
                    <Trash2 />
                </CardToolButton>
            </CardToolPortal>

            {deleteDialogOpen && (
                <ConfirmDialog
                    message={selectedCount === 1 ? "Delete 1 card?" : `Delete ${selectedCount} cards?`}
                    onConfirm={() => {
                        onDelete();
                        setDeleteDialogOpen(false);
                    }}
                    onCancel={() => setDeleteDialogOpen(false)}
                />
            )}
        </>
    );
}
