"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Loader2, Lock, Send, X } from "lucide-react";
import GeminiIcon from "./GeminiIcon";
import PressableButton from "./PressableButton";
import type { AiChatMessage } from "@/hooks/useAiAssistant";

type AiChatPanelProps = {
    messages: AiChatMessage[];
    sending: boolean;
    saving: boolean;
    hasPendingCards: boolean;
    onSend: (text: string) => void;
    onSave: () => void;
    onDiscard: () => void;
    onLock: () => void;
    onClose: () => void;
};

export default function AiChatPanel({
    messages,
    sending,
    saving,
    hasPendingCards,
    onSend,
    onSave,
    onDiscard,
    onLock,
    onClose,
}: AiChatPanelProps) {
    const [draft, setDraft] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [messages, sending]);

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();

        if (!draft.trim() || sending) {
            return;
        }

        onSend(draft);
        setDraft("");
    };

    return (
        <div
            className="ai-chat-panel fixed bottom-5 left-1/2 z-50000 flex max-h-[60vh] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 flex-col rounded-xl bg-white/95 shadow-lg"
            onPointerDown={(event) => event.stopPropagation()}
        >
            <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3">
                <GeminiIcon className="h-4 w-4 shrink-0 text-neutral-900" />
                <span className="text-sm font-semibold text-neutral-900">AI Assistant</span>
                <div className="ml-auto flex items-center gap-1">
                    <PressableButton
                        className="px-2 py-1"
                        onClick={onLock}
                        type="button"
                        aria-label="Lock AI assistant"
                        title="Lock the assistant and clear this conversation"
                    >
                        <Lock className="h-4 w-4 text-neutral-600" />
                    </PressableButton>
                    <PressableButton
                        className="px-2 py-1"
                        onClick={onClose}
                        type="button"
                        aria-label="Close AI assistant"
                    >
                        <X className="h-4 w-4 text-neutral-600" />
                    </PressableButton>
                </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
                {messages.length === 0 ? (
                    <p className="py-6 text-center text-sm leading-6 text-neutral-400">
                        How can I help?
                    </p>
                ) : (
                    <ul className="flex flex-col gap-3">
                        {messages.map((message, index) => (
                            <li
                                key={index}
                                className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
                            >
                                <span
                                    className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm leading-6 ${
                                        message.role === "user"
                                            ? "bg-sky-500 text-white"
                                            : "bg-neutral-100 text-neutral-900"
                                    }`}
                                >
                                    {message.content}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
                {sending && (
                    <p className="mt-3 flex items-center gap-2 text-xs text-neutral-400">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Thinking...
                    </p>
                )}
            </div>

            {hasPendingCards && (
                <div className="flex items-center gap-2 border-t border-neutral-200 px-4 py-2">
                    <span className="text-xs text-neutral-500">
                        The board stops saving until you decide.
                    </span>
                    <div className="ml-auto flex gap-1">
                        <PressableButton
                            className="px-3 py-1 text-xs font-semibold text-neutral-600"
                            onClick={onDiscard}
                            disabled={saving}
                            type="button"
                        >
                            Discard
                        </PressableButton>
                        <PressableButton
                            className="bg-sky-500 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-400"
                            onClick={onSave}
                            disabled={saving}
                            type="button"
                        >
                            {saving ? "Saving..." : "Save to board"}
                        </PressableButton>
                    </div>
                </div>
            )}

            <form className="flex items-center gap-2 border-t border-neutral-200 px-3 py-2" onSubmit={handleSubmit}>
                <input
                    className="h-9 flex-1 rounded-md bg-neutral-50 px-3 text-sm text-neutral-900 outline-none"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Send a message"
                    aria-label="AI assistant message"
                    disabled={sending}
                />
                <PressableButton
                    className="px-3 py-2"
                    type="submit"
                    disabled={sending || !draft.trim()}
                    aria-label="Send message"
                >
                    <Send className="h-4 w-4 text-sky-500" />
                </PressableButton>
            </form>
        </div>
    );
}
