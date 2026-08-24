"use client";

import { BringToFront, SendToBack, Trash2 } from "lucide-react";
import { CardToolButton, CardToolPortal } from "./CardToolPortal";

type MermaidToolBarProps = {
    onBringToFront: () => void;
    onSendToBack: () => void;
    onDelete: () => void;
};

export default function MermaidToolBar({
    onBringToFront,
    onSendToBack,
    onDelete,
}: MermaidToolBarProps) {
    return (
        <CardToolPortal>
            <CardToolButton label="Bring Mermaid to front" onClick={onBringToFront}>
                <BringToFront />
            </CardToolButton>
            <CardToolButton label="Send Mermaid to back" onClick={onSendToBack}>
                <SendToBack />
            </CardToolButton>
            <CardToolButton label="Delete Mermaid" onClick={onDelete} className="text-rose-600">
                <Trash2 />
            </CardToolButton>
        </CardToolPortal>
    );
}
