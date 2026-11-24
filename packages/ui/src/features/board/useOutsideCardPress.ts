import { useEffect, useEffectEvent } from "react";

function isOutsidePress(target: EventTarget | null, cardSelector: string) {
    return target instanceof Element
        && Boolean(target.closest(".board-scroll-layer"))
        && !target.closest(cardSelector)
        && !target.closest(".board-toolbar, .confirm-dialog");
}

export function useOutsideCardPress(
    active: boolean,
    cardSelector: string,
    onRelease: (startedOutside: boolean) => void,
) {
    const isOutside = useEffectEvent((event: PointerEvent) => isOutsidePress(event.target, cardSelector));
    const release = useEffectEvent(onRelease);

    useEffect(() => {
        if (!active) {
            return;
        }
        let startPointer: number | null = null;
        const start = (event: PointerEvent) => {
            startPointer = isOutside(event) ? event.pointerId : null;
        };
        const end = (event: PointerEvent) => {
            const startedOutside = startPointer === event.pointerId;
            startPointer = null;
            if (isOutside(event)) {
                release(startedOutside);
            }
        };
        const cancel = () => { startPointer = null; };

        // Keep both listeners through re-renders caused by presence or board pointer activity.
        document.addEventListener("pointerdown", start);
        document.addEventListener("pointerup", end);
        document.addEventListener("pointercancel", cancel);
        return () => {
            document.removeEventListener("pointerdown", start);
            document.removeEventListener("pointerup", end);
            document.removeEventListener("pointercancel", cancel);
        };
    }, [active]);
}
