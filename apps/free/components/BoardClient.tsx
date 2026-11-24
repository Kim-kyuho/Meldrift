"use client";

import SharedBoardClient from "@meldrift/ui/BoardClient";
import { useBoardLoad } from "@/hooks/useBoardLoad";
import { freeBoardGuide } from "@/lib/board-guide";
import { freeBoardStorage } from "@/lib/board-storage";
import { useHostRoom } from "@/hooks/useHostRoom";
import { usePeerEditor } from "@/hooks/usePeerEditor";
import { useRoomStorage } from "@/hooks/useRoomStorage";
import BoardMenu from "./BoardMenu";
import HostRoomPanel from "./peer-live/HostRoomPanel";
import StartRoomDialog from "./peer-live/StartRoomDialog";
import DraftDownload from "./peer-live/DraftDownload";

export default function BoardClient({ peerLiveEnabled = false }: { peerLiveEnabled?: boolean }) {
    const { initialSnapshot, databaseError, ownsBoard } = useBoardLoad();
    const host = useHostRoom();
    const editor = host.room?.editor;
    const live = usePeerEditor(editor);
    const liveStorage = useRoomStorage(editor);

    if (databaseError) {
        return (
            <main className="flex h-screen w-screen items-center justify-center bg-neutral-100 p-6">
                <div className="max-w-lg rounded-xl bg-white p-6 shadow-md">
                    <h1 className="text-lg font-bold text-neutral-900">Browser SQLite could not start</h1>
                    <p className="mt-2 text-sm text-neutral-600">{databaseError}</p>
                    <p className="mt-3 text-sm text-neutral-500">
                        Use a current browser with IndexedDB enabled and open this page over HTTPS or localhost.
                    </p>
                </div>
            </main>
        );
    }

    if (!initialSnapshot) {
        return (
            <main className="flex min-h-screen w-full items-center justify-center bg-neutral-100 px-6 py-10 text-center">
                <div className="w-full max-w-xl">
                    <h1 className="text-3xl font-bold text-neutral-900">Meldrift</h1>
                    <p className="mt-4 text-base leading-relaxed text-neutral-700">
                        Meldrift is a canvas-based Markdown compiler. Freely arrange memos,
                        images, tables, and Mermaid diagrams on your board, then compile them into a
                        single Markdown document.
                    </p>
                    <p role="status" className="mt-6 text-sm text-neutral-500">
                        Loading...
                    </p>
                </div>
            </main>
        );
    }

    return (
        <>
            <SharedBoardClient
                key={live ? `live:${live.viewKey}` : "personal"}
                initialSnapshot={live?.initialBoard ?? host.returnedBoard ?? initialSnapshot}
                storage={liveStorage?.storage ?? freeBoardStorage}
                guide={live ? undefined : freeBoardGuide}
                menuTitle="Free Board"
                canEdit={ownsBoard && (!live || live.collaboration.canEdit)}
                permissionMessage={live?.collaboration.lastError || "This board is open for editing in another tab."}
                canReplace={!live}
                assistantEnabled={!live && ownsBoard}
                collaboration={live?.collaboration}
                collaborationMenu={peerLiveEnabled && ownsBoard ? {
                    label: live ? "Manage collaboration" : "Start collaboration",
                    open: host.manage,
                } : undefined}
                renderMenu={(menu) => <BoardMenu {...menu} />}
            />
            {host.startFrom && <StartRoomDialog onStart={host.start} onClose={host.cancelStart} />}
            {host.room && <HostRoomPanel room={host.room} open={host.panelOpen} setOpen={host.setPanelOpen} onFinish={host.finish} />}
            {live?.draft && liveStorage && <DraftDownload board={live.draft} download={liveStorage.downloadDraft} />}
        </>
    );
}
