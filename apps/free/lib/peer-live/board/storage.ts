import { createBoardDatabase } from "@meldrift/board-data/browser-db/client";
import { defaultBoard, type BoardSnapshot } from "@meldrift/board-data/board-state";
import type { BoardStorage } from "@meldrift/ui/board-storage";
import type { PeerEditor } from "./editor";
import { maxBoardBytes } from "../transport/packets";

export function createRoomStorage(editor: PeerEditor) {
    const database = createBoardDatabase("meldrift-free:peer-export", defaultBoard);
    const storage: BoardStorage = {
        save: editor.save,
        skipInitialSave: true,
        file: {
            fileName: () => "meldrift-live-board.sqlite",
            maxImportBytes: maxBoardBytes,
            exportFile: async (snapshot) => database.encode(editor.replica.board ?? snapshot),
            readFile: (bytes) => database.decode(bytes, defaultBoard.boardId),
        },
    };

    const downloadDraft = async (snapshot: BoardSnapshot) => {
        const bytes = await database.encode(snapshot);
        const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.sqlite3" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "meldrift-live-draft.sqlite";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1_000);
    };

    return { storage, close: database.close, downloadDraft };
}
