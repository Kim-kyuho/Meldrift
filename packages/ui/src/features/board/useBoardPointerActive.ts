import { useEffect, useState, type RefObject } from "react";

export function useBoardPointerActive(viewport: RefObject<HTMLDivElement | null>) {
    const [active, setActive] = useState(false);
    useEffect(() => {
        const pointers = new Set<number>();
        const start = (event: PointerEvent) => {
            if (event.target instanceof Node && viewport.current?.contains(event.target)) {
                pointers.add(event.pointerId);
                setActive(true);
            }
        };
        const end = (event: PointerEvent) => {
            if (pointers.delete(event.pointerId)) {
                setActive(pointers.size > 0);
            }
        };
        const move = (event: PointerEvent) => {
            if ((event.pointerType === "pen" || event.pointerType === "mouse") && event.buttons === 0 && event.pressure === 0) {
                end(event);
            }
        };
        const cancel = () => {
            pointers.clear();
            setActive(false);
        };
        document.addEventListener("pointerdown", start, true);
        window.addEventListener("pointerup", end, true);
        window.addEventListener("pointermove", move, true);
        window.addEventListener("pointercancel", end, true);
        window.addEventListener("blur", cancel);
        return () => {
            document.removeEventListener("pointerdown", start, true);
            window.removeEventListener("pointerup", end, true);
            window.removeEventListener("pointermove", move, true);
            window.removeEventListener("pointercancel", end, true);
            window.removeEventListener("blur", cancel);
        };
    }, [viewport]);
    return active;
}
