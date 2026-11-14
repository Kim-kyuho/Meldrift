import { useSyncExternalStore } from "react";

/** Tailwind md(768px)보다 좁은 화면을 모바일로 본다. */
const mobileQuery = "(max-width: 767px)";

const subscribe = (onChange: () => void) => {
    const media = window.matchMedia(mobileQuery);
    media.addEventListener("change", onChange);

    return () => {
        media.removeEventListener("change", onChange);
    };
};

const getSnapshot = () => window.matchMedia(mobileQuery).matches;

const getServerSnapshot = () => false;

export function useIsMobile() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
