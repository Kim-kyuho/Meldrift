"use client";

import { Ref } from "react";
import { Pencil,Trash2 } from "lucide-react";
import PressableButton from "./PressableButton";

interface BoardActionMenuProps {
    ref?: Ref<HTMLDivElement>;
    onRename: () => void;
    onDelete: () => void;
}

export default function BoardActionMenu({
    ref,
    onRename,
    onDelete,
}: BoardActionMenuProps) {
    return (
        <div
            ref={ref}
            className="absolute right-2 top-11 z-50000 rounded-md bg-white px-3.5 py-px shadow-md"
        >
            <PressableButton variant="menu" onClick={onRename}>
                <span className="flex w-full items-center gap-2">
                    <Pencil className="h-4 w-4" />
                    <span>Rename</span>
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
