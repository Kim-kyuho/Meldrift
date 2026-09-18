import { useCallback, useEffect, useRef, useState } from "react";
import { createBoardDatabase, type BoardDatabaseClient } from "@meldrift/board/browser-db/client";
import { type BoardInfo, type BoardSnapshot } from "@meldrift/board/board-state";
import { prepareImageFile } from "@meldrift/board/image-file";
import { SnapshotSync, type SyncStatus } from "@/lib/snapshot-sync";

type State = {
    snapshot: BoardSnapshot | null;
    status: SyncStatus;
    message: string;
    canEdit: boolean;
};

// Route transitions in this tab must finish releasing the previous editor first.
let editorCleanup = Promise.resolve();

export function useBoardSnapshot(board: BoardInfo) {
    const [serverSaveVersion, setServerSaveVersion] = useState(0);
    const [state, setState] = useState<State>({ snapshot: null, status: "saved", message: "", canEdit: false });
    const managerRef = useRef<SnapshotSync | null>(null);
    const databaseRef = useRef<BoardDatabaseClient | null>(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let active = true;
        let blocked = false;
        let renewing = false;
        let releaseLock: (() => void) | undefined;
        let heartbeat: ReturnType<typeof setTimeout> | undefined;
        let database: BoardDatabaseClient | undefined;
        let manager: SnapshotSync | undefined;
        let tabId = "";
        const controller = new AbortController();
        const update = (status: SyncStatus, message = "") => {
            if (blocked && status !== "blocked") return;
            if (active) setState((prev) => ({ ...prev, status, message, canEdit: status === "blocked" ? false : prev.canEdit }));
        };
        const block = (message: string) => {
            blocked = true;
            manager?.stop();
            update("blocked", message);
        };
        const lease = async () => {
            const response = await fetch("/api/editor-lease", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tabId }),
                signal: controller.signal,
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message ?? "The editor session is no longer active.");
            }
        };
        const renew = async () => {
            if (renewing || blocked || !active) return;
            renewing = true;
            try { await lease(); }
            catch (error) {
                if (active) block(error instanceof Error ? error.message : "Editor verification failed.");
                return;
            } finally {
                renewing = false;
            }
            if (active) heartbeat = setTimeout(() => { void renew(); }, 20000);
        };

        async function initialize() {
            await editorCleanup;
            if (!active) return;
            const authResponse = await fetch("/api/me", { signal: controller.signal, cache: "no-store" });
            if (!authResponse.ok) throw new Error("Authentication could not be checked.");
            const { user } = await authResponse.json();
            const canEdit = user?.isApproved === true;
            if (canEdit) {
                if (!navigator.locks) throw new Error("This browser requires HTTPS and Web Locks to edit.");
                const acquired = await new Promise<boolean>((resolve, reject) => {
                    navigator.locks.request(`meldrift-plus-editor:${user.email}`, { ifAvailable: true }, async (lock) => {
                        if (!lock || !active) { resolve(false); return; }
                        await new Promise<void>((release) => { releaseLock = release; resolve(true); });
                    }).catch(reject);
                });
                if (!acquired) throw new Error("This account is already editing in another tab.");
                const tabKey = `meldrift-plus-editor:${user.email}`;
                tabId = sessionStorage.getItem(tabKey) ?? crypto.randomUUID();
                sessionStorage.setItem(tabKey, tabId);
                await lease();
                heartbeat = setTimeout(() => { void renew(); }, 20000);
            }
            if (!active) return;
            database = createBoardDatabase(`meldrift-plus:${encodeURIComponent(user?.email ?? "guest")}:${board.boardId}`, board);
            databaseRef.current = database;
            const local = await database.record();
            const response = await fetch(`/api/boards/${board.boardId}/snapshot`, { signal: controller.signal, cache: "no-store" });
            if (!active) return;
            if (!response.ok) throw new Error("The board snapshot could not be loaded.");
            const revision = Number(response.headers.get("X-Snapshot-Revision") ?? 0);
            const mutationId = response.headers.get("X-Snapshot-Mutation");
            let snapshot: BoardSnapshot;
            if (local.sync.dirty) {
                if (revision === local.sync.revision + 1 && mutationId === local.sync.mutationId) {
                    await database.acknowledge(local.sync.generation, revision);
                } else if (revision !== local.sync.revision) {
                    throw new Error("Local unsaved changes conflict with the server. Download the local backup before restoring the server version.");
                }
                snapshot = await database.load();
            } else if (response.headers.get("Content-Type")?.includes("application/vnd.sqlite3")) {
                snapshot = local.sync.revision === revision && revision > 0
                    ? await database.load()
                    : await database.import(await response.arrayBuffer(), revision);
            } else {
                const data = await response.json();
                snapshot = data.legacy;
                // Existing Cloudinary originals remain untouched until migration succeeds.
                if (canEdit) {
                    snapshot.images = await Promise.all(snapshot.images.map(async (image) => {
                        const response = await fetch(image.url, { signal: controller.signal });
                        if (!response.ok) throw new Error("An existing image could not be migrated.");
                        const blob = await response.blob();
                        const prepared = await prepareImageFile(new File([blob], image.label ?? "image", { type: blob.type }));
                        return { ...image, url: "", data: prepared.data, mimeType: prepared.mimeType };
                    }));
                }
                await database.replace(snapshot, canEdit);
            }
            // Neon owns board metadata even when a local snapshot predates a rename.
            snapshot = { ...snapshot, board };
            if (!active || blocked) { database.close(); return; }
            if (canEdit) {
                manager = new SnapshotSync(database, `/api/boards/${board.boardId}/snapshot`, tabId, update, () => {
                    if (active) setServerSaveVersion((value) => value + 1);
                });
                managerRef.current = manager;
                const pending = await database.record();
                if (pending.sync.dirty) manager.resume(pending.sync.changedAt);
            }
            const pending = await database.record();
            if (active && !blocked) setState({ snapshot, status: pending.sync.dirty ? "local" : "saved", message: "", canEdit });
        }
        void initialize().catch((error) => {
            if (active) block(error instanceof Error ? error.message : "Board initialization failed.");
        });
        const onFocus = () => {
            if (tabId && active) {
                clearTimeout(heartbeat);
                void renew();
            }
        };
        window.addEventListener("focus", onFocus);
        return () => {
            active = false;
            controller.abort();
            clearTimeout(heartbeat);
            window.removeEventListener("focus", onFocus);
            managerRef.current = null;
            databaseRef.current = null;
            const previousCleanup = editorCleanup;
            editorCleanup = (async () => {
                await previousCleanup;
                if (manager) await manager.close();
                else database?.close();
                if (tabId) {
                    await fetch("/api/editor-lease", {
                        method: "DELETE", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ tabId }), keepalive: true,
                        signal: AbortSignal.timeout(5000),
                    }).catch(() => {});
                }
            })().finally(() => { releaseLock?.(); }).catch(() => {});
        };
    }, [board, attempt]);

    const save = useCallback((snapshot: BoardSnapshot) => {
        return managerRef.current?.save(snapshot);
    }, []);
    const exportSnapshot = useCallback(async (snapshot: BoardSnapshot) => {
        if (!databaseRef.current) throw new Error("The board is not ready.");
        return databaseRef.current.encode(snapshot);
    }, []);
    const readSnapshotFile = useCallback(async (bytes: ArrayBuffer) => {
        if (!databaseRef.current) throw new Error("The board is not ready.");
        return databaseRef.current.decode(bytes);
    }, []);
    const downloadLocal = useCallback(async () => {
        const bytes = await databaseRef.current?.export();
        if (!bytes) return;
        const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.sqlite3" }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `board-${board.boardId}-local.sqlite`;
        anchor.click();
        URL.revokeObjectURL(url);
    }, [board.boardId]);
    const restoreServer = useCallback(async () => {
        try {
            if (!databaseRef.current) throw new Error("Open the board in the active editor tab first.");
            const response = await fetch(`/api/boards/${board.boardId}/snapshot`, { cache: "no-store" });
            if (!response.ok || !response.headers.get("Content-Type")?.includes("application/vnd.sqlite3")) {
                throw new Error("No server snapshot is available to restore.");
            }
            await managerRef.current?.pause();
            await databaseRef.current.import(await response.arrayBuffer(), Number(response.headers.get("X-Snapshot-Revision")));
            setState({ snapshot: null, status: "saved", message: "", canEdit: false });
            setAttempt((value) => value + 1);
        } catch (error) {
            setState((prev) => ({ ...prev, message: error instanceof Error ? error.message : "Restore failed." }));
        }
    }, [board.boardId]);
    return { ...state, save, downloadLocal, restoreServer, serverSaveVersion, exportSnapshot, readSnapshotFile };
}
