"use client";

import Link from "next/link";
import SharedBoardClient from "@meldrift/ui/BoardClient";
import BoardMenu from "@/components/BoardMenu";
import { usePeerEditor } from "@/hooks/usePeerEditor";
import { useRoomStorage } from "@/hooks/useRoomStorage";
import type { ParticipantRoom } from "@/lib/peer-live/participant-room";
import DraftDownload from "./DraftDownload";

export default function ParticipantBoard({ room }: { room: ParticipantRoom }) {
    const editor = room.editor;
    const live = usePeerEditor(editor);
    const storage = useRoomStorage(editor);

    if (!live?.initialBoard || !storage) {
        return (
            <main className="grid min-h-dvh place-items-center bg-neutral-50 px-6 text-center">
                <div className="space-y-3">
                    <h1 className="text-xl font-bold">Live collaboration</h1>
                    <p role="status" className="text-neutral-700">{live?.collaboration.lastError || "Connecting to the shared board…"}</p>
                    <Link href="/" className="inline-block text-sm font-semibold text-sky-700">Return to my board</Link>
                </div>
            </main>
        );
    }

    const { collaboration } = live;
    const offline = collaboration.status === "offline";
    return (
        <>
            <SharedBoardClient
                key={live.viewKey}
                initialSnapshot={live.initialBoard}
                storage={storage.storage}
                menuTitle="Shared Free Board"
                canEdit={collaboration.canEdit}
                permissionMessage={collaboration.lastError || "The host approved this seat for viewing only."}
                canReplace={false}
                assistantEnabled={false}
                collaboration={collaboration}
                collaborationMenu={!offline ? { label: "Leave collaboration", open: () => room.leave() } : undefined}
                renderMenu={(menu) => <BoardMenu {...menu} />}
            />
            {(offline || collaboration.status === "reconnecting") && (
                <div className="fixed inset-x-4 top-20 z-50000 mx-auto flex w-fit items-center gap-3 rounded-xl bg-white px-3 py-2 shadow-lg">
                    <p role="status" className="text-sm">{collaboration.lastError}</p>
                    {offline && <Link href="/" className="whitespace-nowrap text-sm font-semibold text-sky-700">My board</Link>}
                </div>
            )}
            {live.draft && <DraftDownload board={live.draft} download={storage.downloadDraft} />}
        </>
    );
}
