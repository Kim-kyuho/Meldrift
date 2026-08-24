import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type FocusMemo = {
    id: number;
};

export function useBoardMemoFocus(memos: FocusMemo[]) {
    const [memoMessage, setMemoMessage] = useState("");
    const [focusedMemoId, setFocusedMemoId] = useState<number | null>(null);
    const initialMemoFocusRef = useRef(false);

    const sortedMemoIds = useMemo(
        () => memos.map((memo) => memo.id).sort((a, b) => a - b),
        [memos]
    );

    const focusMemoById = useCallback((memoId: number | null) => {
        setMemoMessage("");
        setFocusedMemoId(memoId);
        window.setTimeout(() => {
            document
                .querySelector(`.memo-rnd-${memoId}`)
                ?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                    inline: "center",
                });
        }, 0);
    }, []);

    useEffect(() => {
        if (initialMemoFocusRef.current || sortedMemoIds.length === 0) {
            return;
        }

        initialMemoFocusRef.current = true;
        focusMemoById(sortedMemoIds[0]);
    }, [focusMemoById, sortedMemoIds]);

    const handleFocusPrevMemo = () => {
        if (sortedMemoIds.length === 0) {
            setMemoMessage("No memos exist.");
            return;
        }

        const currentIndex = focusedMemoId === null
            ? -1
            : sortedMemoIds.indexOf(focusedMemoId);

        if (currentIndex === -1) {
            focusMemoById(sortedMemoIds[0]);
            return;
        }

        const prevMemoId = currentIndex > 0
            ? sortedMemoIds[currentIndex - 1]
            : null;

        if (!prevMemoId) {
            setMemoMessage("Prev memo does not exist.");
            return;
        }

        focusMemoById(prevMemoId);
    };

    const handleFocusNextMemo = () => {
        if (sortedMemoIds.length === 0) {
            setMemoMessage("No memo exist.");
            return;
        }

        const currentIndex = focusedMemoId === null
            ? -1
            : sortedMemoIds.indexOf(focusedMemoId);

        if (currentIndex === -1) {
            focusMemoById(sortedMemoIds[0]);
            return;
        }

        const nextMemoId = currentIndex >= 0 && currentIndex < sortedMemoIds.length - 1
            ? sortedMemoIds[currentIndex + 1]
            : null;

        if (!nextMemoId) {
            setMemoMessage("Next memo does not exist.");
            return;
        }

        focusMemoById(nextMemoId);
    };

    const focusMemoByOrder = useCallback((memoNumber: number) => {
        if (
            !Number.isInteger(memoNumber)
            || memoNumber < 1
            || memoNumber > sortedMemoIds.length
        ) {
            setMemoMessage("Memo does not exist.");
            return;
        }

        focusMemoById(sortedMemoIds[memoNumber - 1]);
    }, [focusMemoById, sortedMemoIds]);

    const focusedMemoIndex = focusedMemoId === null
        ? -1
        : sortedMemoIds.indexOf(focusedMemoId);
    const focusedMemoOrder = focusedMemoIndex >= 0 ? focusedMemoIndex + 1 : 0;

    return {
        memoMessage,
        setMemoMessage,
        focusedMemoId,
        setFocusedMemoId,
        focusMemoById,
        focusMemoByOrder,
        focusedMemoOrder,
        memoCount: sortedMemoIds.length,
        handleFocusPrevMemo,
        handleFocusNextMemo,
    };
}
