"use client";

import PressableButton from "@/components/PressableButton";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useState } from "react";
import BoardMessage from "./BoardMessage";

type CreateBoardModalProps = {
    ownerId: string | null;
    onClose: () => void;
    onCreated: (boardId: number) => void;
};

const boardSizeOptions = [
    { label: "7680 x 4320", width: 7680, height: 4320 },
    { label: "3840 x 2160", width: 3840, height: 2160 },
    { label: "1920 x 1080", width: 1920, height: 1080 },
    { label: "4320 x 7680", width: 4320, height: 7680 },
    { label: "2160 x 3840", width: 2160, height: 3840 },
    { label: "1080 x 1920", width: 1080, height: 1920 },

];

export default function CreateBoardModal({ ownerId, onClose, onCreated }: CreateBoardModalProps) {
    const [errorMessage, setErrorMessage] = useState("");

    const handleCreateBoard = async(title: string, sizeValue: string) => {
        const selectedSize = boardSizeOptions.find((option) => option.label === sizeValue);
        if (!title.trim()) {
            setErrorMessage("Please enter a board title.");
            return;
        }
        if (!selectedSize) {
            setErrorMessage("Please select a board size.");
            return;
        }

        const response = await fetch("/api/boards", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                title: title.trim(),
                width: selectedSize.width,
                height: selectedSize.height,
                ownerId: ownerId,
            }),
        });
        const data = await response.json();

        if (!data.ok) {
            setErrorMessage(data.message ?? "Board could not be created.");
            return;
        }

        onCreated(data.board.boardId);
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
                    <h2 className="text-base font-bold">Create board</h2>
                    <PressableButton
                        className="p-1"
                        onClick={onClose}
                        aria-label="Close create board modal"
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
                        const size = String(formData.get("size"));

                        handleCreateBoard(title, size);
                    }}
                >
                    <label className="block text-sm font-semibold">
                        Title
                        <input
                            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                            name="title"
                            type="text"
                            required
                        />
                    </label>
                    <label className="block text-sm font-semibold">
                        Board size
                        <select
                            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                            name="size"
                            defaultValue="3840 x 2160"
                        >
                            {boardSizeOptions.map((option) => (
                                <option key={option.label} value={option.label}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
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
                            Create
                        </PressableButton>
                    </div>
                </form>
            </div>
        </>,
        document.body
    );
}
