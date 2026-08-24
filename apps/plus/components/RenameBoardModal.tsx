"use client";

import PressableButton from "@/components/PressableButton";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useState } from "react";
import BoardMessage from "./BoardMessage";

type RenameBoardModalProps = {
    boardId: number;
    title: string;
    onClose: () => void;
    onRenamed: (boardId: number, title: string) => void;
};


export default function RenameBoardModal({ boardId, title, onClose, onRenamed }: RenameBoardModalProps) {
    const [errorMessage, setErrorMessage] = useState("");

    const handleRenameBoard = async(title: string) => {
        const response = await fetch(`/api/boards/${boardId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                boardId: boardId,
                title: title.trim(),
            }),
        });
        const data = await response.json();

        if (!data.ok) {
            setErrorMessage(data.message ?? "Board could not be renamed.");
            return;
        }

        onRenamed(data.board.boardId, data.board.title);
    };

    return createPortal(
        <>
            <div
                className="fixed inset-0 bg-black/50"
                style={{ zIndex: 70 }}
                onClick={onClose}
            />
            <div
                className="fixed left-1/2 top-1/2 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 text-neutral-900 shadow-xl"
                style={{ zIndex: 80 }}
            >
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-base font-bold">Rename board</h2>
                    <PressableButton
                        className="p-1"
                        onClick={onClose}
                        aria-label="Close rename board modal"
                    >
                        <X className="h-4 w-4" />
                    </PressableButton>
                </div>
                <form
                    className="space-y-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const formData = new FormData(event.currentTarget);
                        const title = String(formData.get("title"));

                        handleRenameBoard(title);
                    }}
                >
                    <label className="block text-sm font-semibold">
                        Title
                        <input
                            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                            name="title"
                            type="text"
                            defaultValue={title}
                            required
                        />
                    </label>

                    <BoardMessage
                        type="error"
                        message={errorMessage}
                        onDismiss={() => setErrorMessage("")}
                    />

                    <div className="flex justify-end gap-2 pt-2">
                        <PressableButton
                            className="px-3 py-2 text-sm font-semibold text-neutral-600"
                            type="button"
                            onClick={onClose}
                        >
                            Cancel
                        </PressableButton>
                        <PressableButton
                            className="bg-sky-500 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-400"
                            type="submit"
                        >
                            Rename
                        </PressableButton>
                    </div>
                </form>
            </div>
        </>,
        document.body
    );
}
