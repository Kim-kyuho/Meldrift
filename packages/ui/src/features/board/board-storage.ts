import type { BoardInfo, BoardSnapshot } from "@meldrift/board-data/board-state";

export type BoardFileAdapter = {
    fileName: (board: BoardInfo) => string;
    maxImportBytes: number;
    exportFile: (snapshot: BoardSnapshot) => Promise<ArrayBuffer>;
    readFile: (bytes: ArrayBuffer) => Promise<BoardSnapshot>;
};

export type BoardStorage = {
    save: (snapshot: BoardSnapshot) => void | Promise<void>;
    file?: BoardFileAdapter;
    skipInitialSave?: boolean;
};
