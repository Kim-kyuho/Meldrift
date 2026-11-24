"use client";

import { useState, type FormEvent } from "react";
import { directCollaborationSupported } from "@/lib/peer-live/transport/peer-link";
import RoomActionButton from "./RoomActionButton";
import RoomDialog from "./RoomDialog";

export default function StartRoomDialog({ onStart, onClose }: {
    onStart: (name: string) => Promise<void>;
    onClose: () => void;
}) {
    const [name, setName] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (busy || !name.trim()) {
            return;
        }
        if (!directCollaborationSupported() || !navigator.locks) {
            setError("Open Meldrift over HTTPS or localhost in a current desktop browser to start a room.");
            return;
        }
        setBusy(true);
        setError("");
        try {
            await onStart(name.trim());
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Could not start collaboration.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <RoomDialog title="Start live collaboration" onClose={() => {
            if (!busy) {
                onClose();
            }
        }}>
            <p className="mb-4 text-sm text-neutral-600">Share this board, including its images, with up to seven other people. Keep this tab open while you host.</p>
            <form onSubmit={(event) => void submit(event)} className="space-y-3">
                <label className="block text-sm font-semibold">
                    Your display name
                    <input required maxLength={32} value={name} onChange={(event) => setName(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" />
                </label>
                {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
                <div className="flex justify-end gap-2 pt-2">
                    <RoomActionButton disabled={busy} onClick={onClose}>Cancel</RoomActionButton>
                    <RoomActionButton type="submit" tone="primary" disabled={busy || !name.trim()}>
                        {busy ? "Starting…" : "Start room"}
                    </RoomActionButton>
                </div>
            </form>
        </RoomDialog>
    );
}
