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
            className="board-toolbar fixed left-4 top-17 z-49999 flex items-center gap-1 rounded-2xl border border-neutral-200/80 bg-white/90 px-1.5 py-1.5 shadow-lg backdrop-blur-sm sm:left-1/2 sm:top-5 sm:-translate-x-1/2 sm:gap-1.5 sm:px-2.5 sm:py-2"
        >
            <button
                type="button"
                onClick={onStartTutorial}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl bg-rose-500 px-2 py-1 text-xs font-bold text-white shadow-sm transition duration-150 hover:bg-rose-600 active:scale-[0.98] sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm"
            >
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                Tutorial
            </button>
            <button
                type="button"
                onClick={onOpenHelp}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl px-2 py-1 text-xs font-bold text-neutral-700 transition duration-150 hover:bg-neutral-100 active:scale-[0.98] sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm"
            >
                <HelpCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                Help
            </button>
            <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl px-2 py-1 text-xs font-bold text-neutral-500 transition duration-150 hover:bg-neutral-100 hover:text-neutral-800 active:scale-[0.98] sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm"
            >
                <X aria-hidden="true" className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                Close (Esc)
            </button>
        </nav>
    );
}
