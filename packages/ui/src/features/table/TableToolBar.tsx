"use client";

import { BringToFront, SendToBack, Trash2 } from "lucide-react";
import { CardToolButton, CardToolPortal } from "../../shared/CardToolPortal";

type TableToolBarProps = {
    onBringToFront: () => void;
    onSendToBack: () => void;
    layerDisabled?: boolean;
    onDelete: () => void;
};

export default function TableToolBar({
    onBringToFront,
    onSendToBack,
    onDelete,
    layerDisabled = false,
}: TableToolBarProps) {
    return (
        <CardToolPortal>
            <CardToolButton label="Bring table to front" onClick={onBringToFront} disabled={layerDisabled}>
                <BringToFront />
            </CardToolButton>
            <CardToolButton label="Send table to back" onClick={onSendToBack} disabled={layerDisabled}>
                <SendToBack />
            </CardToolButton>
            <CardToolButton label="Delete table" onClick={onDelete} className="text-rose-600">
                <Trash2 />
            </CardToolButton>
        </CardToolPortal>
    );
}
