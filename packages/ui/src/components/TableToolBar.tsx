"use client";

import { BringToFront, SendToBack, Trash2 } from "lucide-react";
import { CardToolButton, CardToolPortal } from "./CardToolPortal";

type TableToolBarProps = {
    onBringToFront: () => void;
    onSendToBack: () => void;
    onDelete: () => void;
};

export default function TableToolBar({
    onBringToFront,
    onSendToBack,
    onDelete,
}: TableToolBarProps) {
    return (
        <CardToolPortal>
            <CardToolButton label="Bring table to front" onClick={onBringToFront}>
                <BringToFront />
            </CardToolButton>
            <CardToolButton label="Send table to back" onClick={onSendToBack}>
                <SendToBack />
            </CardToolButton>
            <CardToolButton label="Delete table" onClick={onDelete} className="text-rose-600">
                <Trash2 />
            </CardToolButton>
        </CardToolPortal>
    );
}
