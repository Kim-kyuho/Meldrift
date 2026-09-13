"use client";

import { BringToFront, SendToBack, Trash2 } from "lucide-react";
import { CardToolButton, CardToolPortal } from "../../shared/CardToolPortal";

type MermaidToolBarProps = {
    onBringToFront: () => void;
    onSendToBack: () => void;
    layerDisabled?: boolean;
    onDelete: () => void;
};

export default function MermaidToolBar({
    onBringToFront,
    onSendToBack,
    onDelete,
    layerDisabled = false,
}: MermaidToolBarProps) {
    return (
        <CardToolPortal>
            <CardToolButton label="Bring Mermaid to front" onClick={onBringToFront} disabled={layerDisabled}>
                <BringToFront />
            </CardToolButton>
            <CardToolButton label="Send Mermaid to back" onClick={onSendToBack} disabled={layerDisabled}>
                <SendToBack />
            </CardToolButton>
            <CardToolButton label="Delete Mermaid" onClick={onDelete} className="text-rose-600">
                <Trash2 />
            </CardToolButton>
        </CardToolPortal>
    );
}
