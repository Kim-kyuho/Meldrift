import type { BoardStorage } from "@meldrift/ui/board-storage";
import { decodeBoardDatabase, encodeBoardDatabase, replaceBoardState } from "@/lib/browser-db/client";

const maxSaveFileBytes = 50 * 1024 * 1024;

export const freeBoardStorage: BoardStorage = {
    save: replaceBoardState,
    skipInitialSave: true,
    file: {
        fileName: () => "meldrift-free.sqlite",
        maxImportBytes: maxSaveFileBytes,
        exportFile: encodeBoardDatabase,
        readFile: decodeBoardDatabase,
    },
};
