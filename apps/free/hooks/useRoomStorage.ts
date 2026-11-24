import { useEffect, useMemo } from "react";
import type { PeerEditor } from "@/lib/peer-live/board/editor";
import { createRoomStorage } from "@/lib/peer-live/board/storage";

export function useRoomStorage(editor: PeerEditor | undefined) {
    const roomStorage = useMemo(() => editor ? createRoomStorage(editor) : null, [editor]);
    useEffect(() => () => roomStorage?.close(), [roomStorage]);
    return roomStorage;
}
