"use client";

import { useEffect } from "react";

type BoardShortcut = "1" | "2" | "m" | "i" | "t" | "d";

type Options = {
    enabled: boolean;
    actions: Partial<Record<BoardShortcut, () => void>>;
};

const inputSelector = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), .cm-editor';

function isInput(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest(inputSelector));
}

export function useBoardShortcuts({ enabled, actions }: Options) {
    useEffect(() => {
        if (!enabled) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.repeat || event.isComposing || event.keyCode === 229 ||
                event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
                isInput(event.target) || isInput(document.activeElement) ||
                document.querySelector('[aria-modal="true"], dialog[open]')) {
                return;
            }

            const key = event.key;
            if (key !== "1" && key !== "2" && key !== "m" && key !== "i" && key !== "t" && key !== "d") {
                return;
            }
            const action = actions[key];
            if (!action) {
                return;
            }

            event.preventDefault();
            action();
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [enabled, actions]);
}
