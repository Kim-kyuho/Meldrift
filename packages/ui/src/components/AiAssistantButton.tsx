"use client";

import GeminiIcon from "./GeminiIcon";
import PressableButton from "./PressableButton";

type AiAssistantButtonProps = {
    aiPanelOpen: boolean;
    onToggle: () => void;
};

export default function AiAssistantButton({ aiPanelOpen, onToggle }: AiAssistantButtonProps) {
    return (
        <PressableButton
            className="fixed right-5 top-17 z-50000 bg-white/75 px-3 py-3 shadow-md"
            onClick={onToggle}
            aria-label="Open AI assistant"
            aria-pressed={aiPanelOpen}
        >
            <GeminiIcon
                className="h-5 w-5 text-neutral-900"
                style={aiPanelOpen ? { color: "#ec4899" } : undefined}
            />
        </PressableButton>
    );
}
