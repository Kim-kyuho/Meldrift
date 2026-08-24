import type { BoardSnapshot } from "@/lib/board-state";

export type BrowserDbPayload =
    | { type: "load" }
    | { type: "replace"; snapshot: BoardSnapshot }
    | { type: "export" }
    | { type: "import"; bytes: ArrayBuffer }
    | { type: "reset" };

export type BrowserDbRequest = BrowserDbPayload & { id: number };

export type BrowserDbResponse =
    | { id: number; ok: true; value?: BoardSnapshot | ArrayBuffer }
    | { id: number; ok: false; error: string };
