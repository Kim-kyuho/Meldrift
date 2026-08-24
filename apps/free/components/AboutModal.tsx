"use client";

import { useEffect } from "react";
import { BookOpen, ExternalLink, Mail, X } from "lucide-react";
import PressableButton from "./PressableButton";

type AboutModalProps = {
    onClose: () => void;
};

export default function AboutModal({ onClose }: AboutModalProps) {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-60000 flex items-center justify-center bg-black/40 px-4"
            onClick={onClose}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="about-title"
                className="w-full max-w-md rounded-xl bg-white p-5 text-neutral-900 shadow-xl"
                onClick={(event) => event.stopPropagation()}
            >
                <header className="mb-5 flex items-center justify-between">
                    <h2 id="about-title" className="text-lg font-bold">About</h2>
                    <PressableButton
                        autoFocus
                        className="p-1"
                        onClick={onClose}
                        aria-label="Close About"
                    >
                        <X className="h-5 w-5" />
                    </PressableButton>
                </header>
                <div className="space-y-3 text-sm">
                    <a
                        href="mailto:kgh9002@icloud.com"
                        className="flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-neutral-100"
                    >
                        <Mail aria-hidden="true" className="h-4 w-4 shrink-0 text-sky-600" />
                        <span><strong>Email:</strong> kgh9002@icloud.com</span>
                    </a>
                    <a
                        href="https://github.com/Kim-kyuho/"
                        target="_blank"
                        rel="noreferrer noopener"
                        className="flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-neutral-100"
                    >
                        <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0 text-neutral-700" />
                        <span><strong>GitHub:</strong> github.com/Kim-kyuho</span>
                    </a>
                    <a
                        href="https://kyulog.vercel.app"
                        target="_blank"
                        rel="noreferrer noopener"
                        className="flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-neutral-100"
                    >
                        <BookOpen aria-hidden="true" className="h-4 w-4 shrink-0 text-pink-500" />
                        <span><strong>Blog:</strong> kyulog.vercel.app</span>
                    </a>
                </div>
            </section>
        </div>
    );
}
