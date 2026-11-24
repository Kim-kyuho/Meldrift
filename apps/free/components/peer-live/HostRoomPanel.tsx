"use client";

import { useState, useSyncExternalStore } from "react";
import PressableButton from "@meldrift/ui/PressableButton";
import type { HostRoom } from "@/lib/peer-live/host-room";
import RoomActionButton from "./RoomActionButton";
import RoomDialog from "./RoomDialog";

export default function HostRoomPanel({ room, open, setOpen, onFinish }: {
    room: HostRoom;
    open: boolean;
    setOpen: (value: boolean) => void;
    onFinish: () => Promise<void>;
}) {
    const view = useSyncExternalStore(room.subscribe, room.getSnapshot, room.getSnapshot);
    const [feedback, setFeedback] = useState("");
    const [busy, setBusy] = useState(false);
    const pending = view.seats.filter(({ state }) => state === "pending");

    const perform = async (task: () => Promise<void>, message = "") => {
        setBusy(true);
        try {
            await task();
            setFeedback(message);
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : "Could not update the room.");
        } finally {
            setBusy(false);
        }
    };

    if (!open) {
        const appearance = view.ended ? "border-neutral-200 bg-white shadow-md" : "attention-glow border-rose-200";
        return pending.length > 0 || view.ended ? (
            <PressableButton
                className={`fixed right-5 top-20 z-50000 min-h-10 min-w-28 whitespace-nowrap border px-3.5 py-1.5 ${appearance}`}
                onClick={() => setOpen(true)}
            >
                {view.ended ? "Live room ended" : `${pending.length} join ${pending.length === 1 ? "request" : "requests"}`}
            </PressableButton>
        ) : null;
    }

    return (
        <RoomDialog title="Live collaboration" onClose={() => setOpen(false)}>
            <div className="space-y-3">
                {view.error && <p role="status" className="text-sm text-amber-800">{view.error}</p>}
                {!view.ended && <>
                    <label className="block text-sm font-semibold">
                        Invitation link
                        <input readOnly value={view.url} onFocus={(event) => event.currentTarget.select()}
                            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" />
                    </label>
                    <div className="flex flex-wrap gap-2">
                        <PressableButton disabled={busy}
                            onClick={() => void perform(() => navigator.clipboard.writeText(view.url), "Link copied.")}>Copy link</PressableButton>
                        <PressableButton disabled={busy}
                            onClick={() => void perform(() => room.rotateInvite(), "A new invitation link is ready.")}>New link</PressableButton>
                    </div>
                    <p className="text-sm text-neutral-600">{view.seats.length + 1} of 8 places reserved, including you.</p>
                    {view.seats.length > 0 && (
                        <ul className="max-h-52 space-y-2 overflow-y-auto" aria-label="Room participants">
                            {view.seats.map((seat) => (
                                <li key={seat.participantId} className="rounded-lg bg-neutral-100 p-2 text-sm">
                                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                        <p className="break-words font-semibold">{seat.name}</p>
                                        {seat.state === "pending" && (
                                            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-neutral-600">Join request</span>
                                        )}
                                    </div>
                                    {seat.state === "pending" ? (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            <RoomActionButton
                                                aria-label="Allow editing" tone="sky" size="compact"
                                                disabled={busy}
                                                onClick={() => room.decide(seat, "editor")}
                                            >
                                                Allow
                                            </RoomActionButton>
                                            <RoomActionButton
                                                aria-label="View only" tone="emerald" size="compact"
                                                disabled={busy}
                                                onClick={() => room.decide(seat, "viewer")}
                                            >
                                                Viewer
                                            </RoomActionButton>
                                            <RoomActionButton
                                                tone="rose" size="compact"
                                                disabled={busy}
                                                onClick={() => room.decide(seat, null)}
                                            >
                                                Decline
                                            </RoomActionButton>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <span className="capitalize text-neutral-600">{seat.state}</span>
                                            <PressableButton disabled={busy}
                                                onClick={() => void perform(() => room.remove(seat.participantId))}>Remove</PressableButton>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </>}
                {feedback && <p role="status" className="text-sm text-neutral-700">{feedback}</p>}
                <div className="flex justify-end gap-2 pt-2">
                    {!view.ended && (
                        <RoomActionButton
                            disabled={busy}
                            onClick={() => void perform(onFinish)}
                        >
                            End room
                        </RoomActionButton>
                    )}
                    <RoomActionButton
                        tone="primary"
                        disabled={busy}
                        onClick={() => view.ended ? void perform(onFinish) : setOpen(false)}
                    >
                        {view.ended ? "Return to board" : "Done"}
                    </RoomActionButton>
                </div>
            </div>
        </RoomDialog>
    );
}
