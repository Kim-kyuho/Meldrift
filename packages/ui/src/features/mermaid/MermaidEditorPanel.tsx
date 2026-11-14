"use client";

import { createPortal } from "react-dom";
import { useId, useState } from "react";
import { ChevronDown, Minus, X } from "lucide-react";
import PressableButton from "../../shared/PressableButton";

type MermaidEditorPanelProps = {
    editorRef: (element: HTMLDivElement | null) => void;
    paletteRef?: (element: HTMLDivElement | null) => void;
    mobile?: boolean;
    onClose: () => void;
};

/** 데스크톱은 왼쪽, 모바일은 화면 하단에 표시하는 다이어그램 편집 패널. */
export default function MermaidEditorPanel({ editorRef, paletteRef, onClose, mobile = false }: MermaidEditorPanelProps) {
    const [collapsed, setCollapsed] = useState(false);
    const bodyId = useId();
    const minimized = !mobile && collapsed;
    const toggleTitle = minimized ? "Expand mermaid editor" : "Minimize mermaid editor";

    return createPortal(
        <section
            aria-label="Mermaid editor"
            className={`board-toolbar mermaid-editor-panel fixed z-50000 flex flex-col overflow-hidden rounded-xl bg-white/95 shadow-md ${mobile
                ? "left-4 right-20 bottom-[max(5rem,env(safe-area-inset-bottom))] max-h-[45dvh]"
                : "left-5 top-20 max-h-[calc(100dvh-7rem)] w-96"}`}
        >
            <header className="flex shrink-0 items-center justify-between px-4 pb-2 pt-3">
                <h2 className="font-bold text-neutral-900">Mermaid Editor</h2>
                <div className="flex shrink-0 items-center gap-1">
                    {!mobile && (
                        <PressableButton
                            className="p-1"
                            onClick={() => setCollapsed((previous) => !previous)}
                            aria-label={toggleTitle}
                            title={toggleTitle}
                            aria-expanded={!minimized}
                            aria-controls={bodyId}
                        >
                            {minimized ? <ChevronDown className="h-4 w-4 text-neutral-900" /> : <Minus className="h-4 w-4 text-neutral-900" />}
                        </PressableButton>
                    )}
                    <PressableButton
                        className="p-1"
                        onClick={onClose}
                        aria-label="Close mermaid editor"
                    >
                        <X className="h-4 w-4 text-neutral-900" />
                    </PressableButton>
                </div>
            </header>
            <div id={bodyId} hidden={minimized} className={minimized ? "hidden" : "flex min-h-0 flex-col"}>
                <div ref={editorRef} className={`${mobile ? "h-60 min-h-24" : "h-72 min-h-32"} shrink border-t border-neutral-200`} />
                {paletteRef && <div ref={paletteRef} className="shrink-0" />}
            </div>
        </section>, document.body
    );
}
