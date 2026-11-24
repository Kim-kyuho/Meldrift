import { useEffect, useRef, useState } from "react";
import type { BoardSnapshot } from "@meldrift/board-data/board-state";
import { freeBoardStorage } from "@/lib/board-storage";
import type { HostRoom } from "@/lib/peer-live/host-room";

export function useHostRoom() {
    const [room, setRoom] = useState<HostRoom | null>(null);
    const [startFrom, setStartFrom] = useState<BoardSnapshot | null>(null);
    const [returnedBoard, setReturnedBoard] = useState<BoardSnapshot | null>(null);
    const [panelOpen, setPanelOpen] = useState(false);
    const mounted = useRef(false);
    const activeRoom = useRef<HostRoom | null>(null);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            void activeRoom.current?.end();
        };
    }, []);

    const start = async (name: string) => {
        if (!startFrom || activeRoom.current) {
            return;
        }
        const { HostRoom } = await import("@/lib/peer-live/host-room");
        const opened = await HostRoom.open(name, startFrom, async (board) => {
            await freeBoardStorage.save(board);
        });
        if (!mounted.current) {
            await opened.end();
            return;
        }
        activeRoom.current = opened;
        setRoom(opened);
        setStartFrom(null);
        setPanelOpen(true);
    };

    const manage = (snapshot: BoardSnapshot) => {
        if (room) {
            // A card can have changed just before the menu opened, ahead of the normal save timer.
            if (room.editor.getSnapshot().collaboration.canEdit) {
                void room.editor.save(snapshot).catch(() => {});
            }
            setPanelOpen(true);
        } else {
            setStartFrom(snapshot);
        }
    };

    const finish = async () => {
        if (!room) {
            return;
        }
        await room.editor.idle();
        const saved = await room.end();
        if (!mounted.current) {
            return;
        }
        activeRoom.current = null;
        setReturnedBoard(saved);
        setRoom(null);
        setPanelOpen(false);
    };

    return {
        room, startFrom, returnedBoard, panelOpen, setPanelOpen, start, manage, finish,
        cancelStart: () => setStartFrom(null),
    };
}
