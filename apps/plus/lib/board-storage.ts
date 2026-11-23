import { reissueSyncIds, type BoardSnapshot } from "@meldrift/board-data/board-state";
import type { BoardStorage } from "@meldrift/ui/board-storage";
import { maxSnapshotBytes } from "@/lib/snapshot";

type PlusBoardStorageOptions = {
    save: (snapshot: BoardSnapshot) => void | Promise<void>;
    encode: (snapshot: BoardSnapshot) => Promise<ArrayBuffer>;
    decode: (bytes: ArrayBuffer) => Promise<BoardSnapshot>;
};

export function createPlusBoardStorage({ save, encode, decode }: PlusBoardStorageOptions): BoardStorage {
    return {
        save,
        skipInitialSave: true,
        file: {
            fileName: (board) => `meldrift-board-${board.boardId}.sqlite`,
            maxImportBytes: maxSnapshotBytes,
            exportFile: encode,
            readFile: async (bytes) => {
                const imported = await decode(bytes);
                if (imported.images.some((image) => !image.data)) {
                    throw new Error("The save file must include image binaries.");
                }
                return reissueSyncIds(imported);
            },
        },
    };
}
