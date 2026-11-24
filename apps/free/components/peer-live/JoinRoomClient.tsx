"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import PressableButton from "@meldrift/ui/PressableButton";
import { tokenSchema } from "@/lib/peer-live/signaling/protocol";
import { ParticipantRoom, storedSeat } from "@/lib/peer-live/participant-room";
import { directCollaborationSupported } from "@/lib/peer-live/transport/peer-link";
import ParticipantBoard from "./ParticipantBoard";

export default function JoinRoomClient({ roomId }: { roomId: string }) {
    const [room, setRoom] = useState<ParticipantRoom | null>(null);
    const [busy, setBusy] = useState(true);
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const [hasInvitation, setHasInvitation] = useState(false);
    const invitation = useRef("");
    const activeRoom = useRef<ParticipantRoom | null>(null);
    const mounted = useRef(false);

    useEffect(() => {
        mounted.current = true;
        let active = true;
        const open = async () => {
            if (!directCollaborationSupported()) {
                throw new Error("Use a current browser over HTTPS to join this board.");
            }
            const key = new URLSearchParams(window.location.hash.slice(1)).get("k");
            if (key && tokenSchema.safeParse(key).success) {
                invitation.current = key;
            }
            if (window.location.hash) {
                window.history.replaceState(window.history.state, "", window.location.pathname);
            }
            setHasInvitation(Boolean(invitation.current));

            const seat = storedSeat(roomId);
            if (seat) {
                const resumed = await ParticipantRoom.resume(roomId, seat);
                if (!active) {
                    resumed.dispose(); return;
                }
                activeRoom.current = resumed;
                setRoom(resumed);
            } else if (!invitation.current) {
                throw new Error("Open the full invitation link to join the board.");
            }
        };
        void Promise.resolve().then(() => {
            if (active) {
                return open();
            }
        }).catch((failure: unknown) => {
            if (active) {
                setError(failure instanceof Error ? failure.message : "This invitation could not be opened.");
            }
        }).finally(() => {
            if (active) {
                setBusy(false);
            }
        });
        return () => {
            active = false;
            mounted.current = false;
            activeRoom.current?.dispose();
            activeRoom.current = null;
        };
    }, [roomId]);

    const join = async (event: FormEvent) => {
        event.preventDefault();
        if (busy || !invitation.current || !name.trim()) {
            return;
        }
        setBusy(true);
        setError("");
        try {
            const joined = await ParticipantRoom.join(roomId, invitation.current, name.trim());
            if (!mounted.current) {
                joined.dispose(); return;
            }
            activeRoom.current = joined;
            setRoom(joined);
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Could not ask to join.");
        } finally {
            setBusy(false);
        }
    };

    if (room) {
        return <ParticipantBoard room={room} />;
    }
    return (
        <main className="grid min-h-dvh place-items-center bg-neutral-50 px-6">
            <section className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm">
                <h1 className="mb-3 text-xl font-bold">Join a shared Meldrift board</h1>
                {error && <p role="alert" className="mb-3 text-sm text-rose-700">{error}</p>}
                {busy && <p role="status" className="mb-3 text-sm">Checking your seat…</p>}
                <form onSubmit={(event) => void join(event)} className="space-y-3">
                    <label className="block text-sm font-semibold">
                        Your display name
                        <input required maxLength={32} disabled={busy} value={name} onChange={(event) => setName(event.target.value)}
                            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" />
                    </label>
                    <PressableButton type="submit" className="font-bold text-sky-700" disabled={busy || !name.trim() || !hasInvitation}>
                        Ask to join
                    </PressableButton>
                </form>
                <Link href="/" className="mt-4 inline-block text-sm text-sky-700">Back to my board</Link>
            </section>
        </main>
    );
}
