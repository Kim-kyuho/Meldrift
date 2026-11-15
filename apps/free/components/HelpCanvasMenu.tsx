"use client";

import { useEffect } from "react";
import { HelpCircle, Sparkles, X } from "lucide-react";

type HelpCanvasMenuProps = {
    onStartTutorial: () => void;
    onOpenHelp: () => void;
    onClose: () => void;
};

export default function HelpCanvasMenu({
    onStartTutorial,
    onOpenHelp,
    onClose,
}: HelpCanvasMenuProps) {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    return (
        <nav
            aria-label="Help quick actions"
            className="board-toolbar fixed left-1/2 top-18 z-50002 flex -translate-x-1/2 items-center gap-1.5 rounded-2xl border border-neutral-200/80 bg-white/90 px-2.5 py-2 shadow-lg backdrop-blur-sm sm:top-5"
        >
            <button
                type="button"
                onClick={onStartTutorial}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-rose-500 px-3 py-1.5 text-sm font-bold text-white shadow-sm transition duration-150 hover:bg-rose-600 active:scale-[0.98]"
            >
                <Sparkles aria-hidden="true" className="h-4 w-4 shrink-0" />
                Tutorial
            </button>
            <button
                type="button"
                onClick={onOpenHelp}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-bold text-neutral-700 transition duration-150 hover:bg-neutral-100 active:scale-[0.98]"
            >
                <HelpCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
                Help
            </button>
            <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-bold text-neutral-500 transition duration-150 hover:bg-neutral-100 hover:text-neutral-800 active:scale-[0.98]"
            >
                <X aria-hidden="true" className="h-4 w-4 shrink-0" />
                Close (Esc)
            </button>
        </nav>
    );
}
