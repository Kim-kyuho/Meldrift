"use client";

import PressableButton from "@meldrift/ui/PressableButton";
import BoardMessage from "@meldrift/ui/BoardMessage";
import { Trash2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

type MemberRole = "editor" | "viewer";
type BoardMember = { userId: number; email: string; role: MemberRole };

type ShareBoardModalProps = {
    boardId: number;
    onClose: () => void;
};

const fieldClass = "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-sky-500";

export default function ShareBoardModal({ boardId, onClose }: ShareBoardModalProps) {
    const [members, setMembers] = useState<BoardMember[]>([]);
    const [ownerEmail, setOwnerEmail] = useState("");
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const endpoint = `/api/boards/${boardId}/members`;

    useEffect(() => {
        const controller = new AbortController();
        void (async () => {
            try {
                const response = await fetch(endpoint, { signal: controller.signal, cache: "no-store" });
                const data = await response.json();
                if (!data.ok) {
                    setErrorMessage(data.message ?? "Members could not be loaded.");
                    return;
                }
                setOwnerEmail(data.ownerEmail);
                setMembers(data.members);
            } catch (error) {
                if (!controller.signal.aborted) {
                    setErrorMessage(error instanceof Error ? error.message : "Members could not be loaded.");
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        })();
        return () => controller.abort();
    }, [endpoint]);

    const send = async (method: "POST" | "PATCH" | "DELETE", body: object) => {
        setBusy(true);
        setErrorMessage("");
        try {
            const response = await fetch(endpoint, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await response.json();
            if (!data.ok) {
                setErrorMessage(data.message ?? "Sharing could not be changed.");
                return false;
            }
            setMembers(data.members);
            return true;
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Sharing could not be changed.");
            return false;
        } finally {
            setBusy(false);
        }
    };

    return createPortal(
        <>
            <div className="fixed inset-0 bg-black/50" style={{ zIndex: 70 }} onClick={onClose} />
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="share-board-title"
                className="fixed left-1/2 top-1/2 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 text-neutral-900 shadow-xl"
                style={{ zIndex: 80 }}
            >
                <div className="mb-4 flex items-center justify-between">
                    <h2 id="share-board-title" className="text-base font-bold">Share board</h2>
                    <PressableButton className="p-1" onClick={onClose} aria-label="Close share board modal">
                        <X className="h-4 w-4" />
                    </PressableButton>
                </div>
                <form
                    className="mb-4 flex gap-2"
                    onSubmit={async (event) => {
                        event.preventDefault();
                        const form = event.currentTarget;
                        const formData = new FormData(form);
                        const added = await send("POST", {
                            email: String(formData.get("email") ?? ""),
                            role: String(formData.get("role") ?? "editor"),
                        });
                        if (added) {
                            form.reset();
                        }
                    }}
                >
                    <input name="email" type="email" required placeholder="member@example.com"
                        aria-label="Member email" className={fieldClass} />
                    <select name="role" aria-label="Member role" defaultValue="editor"
                        className="rounded-lg border border-neutral-300 px-2 py-2 text-sm">
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                    </select>
                    <PressableButton type="submit" disabled={busy}
                        className="shrink-0 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white">
                        Add
                    </PressableButton>
                </form>
                {loading ? <p role="status" className="text-sm">Loading members…</p> : (
                    <ul className="max-h-72 space-y-2 overflow-y-auto">
                        <li className="flex items-center justify-between gap-3 text-sm">
                            <span className="truncate" title={ownerEmail}>{ownerEmail}</span>
                            <span className="shrink-0 text-xs text-neutral-600">Owner</span>
                        </li>
                        {members.map((member) => (
                            <li key={member.userId} className="flex items-center justify-between gap-3 text-sm">
                                <span className="truncate" title={member.email}>{member.email}</span>
                                <span className="flex shrink-0 items-center gap-1">
                                    <select
                                        aria-label={`Role for ${member.email}`}
                                        value={member.role}
                                        disabled={busy}
                                        className="rounded-md border border-neutral-300 px-1 py-1 text-xs"
                                        onChange={(event) => {
                                            void send("PATCH", { userId: member.userId, role: event.target.value });
                                        }}
                                    >
                                        <option value="editor">Editor</option>
                                        <option value="viewer">Viewer</option>
                                    </select>
                                    <PressableButton
                                        className="p-1 text-rose-600"
                                        disabled={busy}
                                        aria-label={`Remove ${member.email}`}
                                        onClick={() => {
                                            void send("DELETE", { userId: member.userId });
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </PressableButton>
                                </span>
                            </li>
                        ))}
                        {members.length === 0 && (
                            <li className="text-sm text-neutral-600">Only you can open this private board.</li>
                        )}
                    </ul>
                )}
                <BoardMessage variant="inline" message={errorMessage} onDismiss={() => setErrorMessage("")} />
            </div>
        </>,
        document.body,
    );
}
