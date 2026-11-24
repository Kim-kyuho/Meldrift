"use client";

import { useEffect, useRef, type ReactNode } from "react";

export default function RoomDialog({ title, children, onClose }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const element = dialog.current;
        if (element && !element.open) {
            element.showModal();
        }
        return () => element?.close();
    }, []);

    return (
        <dialog
            ref={dialog}
            aria-label={title}
            onCancel={(event) => {
                event.preventDefault(); onClose();
            }}
            className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-5 text-neutral-900 shadow-xl backdrop:bg-neutral-900/30"
        >
            <h2 className="mb-3 text-lg font-bold">{title}</h2>
            {children}
        </dialog>
    );
}
