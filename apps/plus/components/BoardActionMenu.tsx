"use client";

import { Ref } from "react";
import { Pencil, Trash2, Users } from "lucide-react";
import PressableButton from "@meldrift/ui/PressableButton";

interface BoardActionMenuProps {
    ref?: Ref<HTMLDivElement>;
    onEdit: () => void;
    onShare: () => void;
    onDelete: () => void;
}

export default function BoardActionMenu({
    ref,
    onEdit,
    onShare,
    onDelete,
}: BoardActionMenuProps) {
    return (
        <div
            ref={ref}
            className="absolute right-2 top-11 z-50000 w-32 rounded-md bg-white p-1 text-xs shadow-md"
        >
            <PressableButton variant="menu" className="min-h-8 px-2 py-1" onClick={onEdit}>
                <span className="flex w-full items-center gap-2">
                    <Pencil size={14} />
                    <span>Edit</span>
                </span>
            </PressableButton>
            <PressableButton variant="menu" className="min-h-8 px-2 py-1" onClick={onShare}>
                <span className="flex w-full items-center gap-2">
                    <Users size={14} />
                    <span>Share</span>
                </span>
            </PressableButton>
            <PressableButton variant="menu" className="min-h-8 px-2 py-1" onClick={onDelete}>
                <span className="flex w-full items-center gap-2 text-rose-600">
                    <Trash2 size={14} />
                    <span>Delete</span>
                </span>
            </PressableButton>
        </div>
    );
}
