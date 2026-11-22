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
            className="absolute right-2 top-11 z-50000 rounded-md bg-white px-3.5 py-px shadow-md"
        >
            <PressableButton variant="menu" onClick={onEdit}>
                <span className="flex w-full items-center gap-2">
                    <Pencil className="h-4 w-4" />
                    <span>Edit</span>
                </span>
            </PressableButton>
            <PressableButton variant="menu" onClick={onShare}>
                <span className="flex w-full items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>Share</span>
                </span>
            </PressableButton>
            <PressableButton variant="menu" onClick={onDelete}>
                <span className="flex w-full items-center gap-2 text-rose-600">
                    <Trash2 className="h-4 w-4" />
                    <span>Delete</span>
                </span>
            </PressableButton>
        </div>
    );
}
