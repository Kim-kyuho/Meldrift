"use client";

import { BringToFront, SendToBack, Trash2 } from "lucide-react";
import { CardToolButton, CardToolPortal } from "../../shared/CardToolPortal";

type ImageToolBarProps = {
    onBringToFront: () => void;
    onSendToBack: () => void;
    layerDisabled?: boolean;
    onDelete: () => void;
};

export default function ImageToolBar({
    onBringToFront,
    onSendToBack,
    onDelete,
    layerDisabled = false,
}: ImageToolBarProps) {
    return (
        <CardToolPortal>
            <CardToolButton label="Bring image to front" onClick={onBringToFront} disabled={layerDisabled}>
                <BringToFront />
            </CardToolButton>
            <CardToolButton label="Send image to back" onClick={onSendToBack} disabled={layerDisabled}>
                <SendToBack />
            </CardToolButton>
            <CardToolButton label="Delete image" onClick={onDelete} className="text-rose-600">
                <Trash2 />
            </CardToolButton>
        </CardToolPortal>
    );
}
