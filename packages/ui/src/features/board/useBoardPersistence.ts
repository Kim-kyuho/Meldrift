import { useCallback, useEffect, useRef } from "react";
import type { BoardSnapshot } from "@meldrift/board-data/board-state";

const localSaveDelayMs = 150;

type UseBoardPersistenceOptions = {
    snapshot: BoardSnapshot;
    savePaused: boolean;
    onSave: (snapshot: BoardSnapshot) => void | Promise<void>;
    onError: (error: unknown) => void;
    skipInitialSave?: boolean;
};

export function useBoardPersistence({
    snapshot,
    savePaused,
    onSave,
    onError,
    skipInitialSave = false,
}: UseBoardPersistenceOptions) {
    const lastRequestedRef = useRef<BoardSnapshot | null>(skipInitialSave ? snapshot : null);
    const latest = useRef({ snapshot, savePaused, onSave, onError });

    useEffect(() => {
        latest.current = { snapshot, savePaused, onSave, onError };
    });

    const requestSave = useCallback(async (target: BoardSnapshot) => {
        lastRequestedRef.current = target;
        try {
            await latest.current.onSave(target);
        } catch (error) {
            if (lastRequestedRef.current === target) {
                lastRequestedRef.current = null;
            }
            latest.current.onError(error);
        }
    }, []);

    useEffect(() => {
        if (savePaused || snapshot === lastRequestedRef.current) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            if (lastRequestedRef.current !== snapshot) {
                void requestSave(snapshot);
            }
        }, localSaveDelayMs);

        return () => window.clearTimeout(timeoutId);
    }, [snapshot, savePaused, requestSave]);

    // 예약된 저장을 기다리지 않고 지금 화면 상태를 저장한다. 내보내기처럼 저장 직후 상태가 확정돼야 할 때 쓴다.
    const flush = useCallback(async () => {
        const { snapshot: current, savePaused: paused } = latest.current;
        if (paused || current === lastRequestedRef.current) {
            return;
        }
        await requestSave(current);
    }, [requestSave]);

    return { flush };
}
