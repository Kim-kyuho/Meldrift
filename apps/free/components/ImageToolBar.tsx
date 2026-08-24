"use client";

import { BringToFront, SendToBack, Trash2 } from "lucide-react";
import { CardToolButton, CardToolPortal } from "./CardToolPortal";

type ImageToolBarProps = {
    onBringToFront: () => void;
    onSendToBack: () => void;
    onDelete: () => void;
};

export default function ImageToolBar({
    onBringToFront,
    onSendToBack,
    onDelete,
}: ImageToolBarProps) {
    return (
        <CardToolPortal>
            <CardToolButton label="Bring image to front" onClick={onBringToFront}>
                <BringToFront />
            </CardToolButton>
            <CardToolButton label="Send image to back" onClick={onSendToBack}>
                <SendToBack />
            </CardToolButton>
            <CardToolButton label="Delete image" onClick={onDelete} className="text-rose-600">
                <Trash2 />
            </CardToolButton>
        </CardToolPortal>
    );
}
