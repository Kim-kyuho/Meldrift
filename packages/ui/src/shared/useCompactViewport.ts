import { useSyncExternalStore } from "react";

/** 스마트폰(세로 < 768px 또는 가로 소형 터치 화면)을 컴팩트 뷰포트로 본다. */
const compactViewportQuery = "(max-width: 767px), (max-height: 500px) and (pointer: coarse)";

const subscribe = (onChange: () => void) => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return () => {};
    }
    const media = window.matchMedia(compactViewportQuery);
    media.addEventListener("change", onChange);
    return () => {
        media.removeEventListener("change", onChange);
    };
};

const getSnapshot = () => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return false;
    }
    return window.matchMedia(compactViewportQuery).matches;
};

const getServerSnapshot = () => false;

export function useCompactViewport() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
