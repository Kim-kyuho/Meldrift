"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import {
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Circle,
    RotateCcw,
    Sparkles,
    X,
} from "lucide-react";
import {
    getTutorialStepMeta,
    tutorialTotalSteps,
    type TutorialStepId,
} from "./tutorial";

export type TutorialChecklistItem = {
    label: string;
    done: boolean;
};

type TutorialOverlayProps = {
    step: TutorialStepId;
    checklist: TutorialChecklistItem[];
    stepCompleted: boolean;
    markdownViewOpen: boolean;
    cornerLinkCount: number;
    memoCount: number;
    onPrev: () => void;
    onNext: () => void;
    onExit: () => void;
    onRestoreShowcase: () => void;
};

function buildHighlightStyles(targets: string[]): string {
    if (targets.length === 0) {
        return "";
    }
    const selectors = targets
        .map((target) => `[data-tutorial="${target}"]`)
        .join(", ");

    return `
        @keyframes meldriftTutorialPaddingGlow {
            0%, 100% {
                background-color: rgba(244, 63, 94, 0.06);
                box-shadow: inset 0 0 8px rgba(244, 63, 94, 0.12);
            }
            50% {
                background-color: rgba(244, 63, 94, 0.24);
                box-shadow: inset 0 0 16px rgba(244, 63, 94, 0.34), 0 0 10px rgba(244, 63, 94, 0.18);
            }
        }
        ${selectors} {
            animation: meldriftTutorialPaddingGlow 1.6s ease-in-out infinite;
            border-radius: 0.75rem;
        }
        @media (prefers-reduced-motion: reduce) {
            ${selectors} {
                animation: none;
                background-color: rgba(244, 63, 94, 0.18);
                box-shadow: inset 0 0 12px rgba(244, 63, 94, 0.28);
            }
        }
    `;
}

function getPreviewBannerCopy(step: TutorialStepId): string {
    if (step === 5) {
        return "Inspect how your Memos and linked cards compile in order. Click the Download button at the top-right of this preview to export Markdown (or a ZIP bundle with images), then close the preview to continue.";
    }
    if (step === 6) {
        return "Check the updated section order inside the preview! Close the preview when you're ready to finish the tutorial.";
    }
    return "This is the compiled Markdown preview for your current sandbox cards. Close the preview whenever you're ready to return to the tutorial step.";
}

export default function TutorialOverlay({
    step,
    checklist,
    stepCompleted,
    markdownViewOpen,
    cornerLinkCount,
    memoCount,
    onPrev,
    onNext,
    onExit,
    onRestoreShowcase,
}: TutorialOverlayProps) {
    const [collapsed, setCollapsed] = useState(false);
    const meta = getTutorialStepMeta(step);
    const highlightCss = buildHighlightStyles(markdownViewOpen ? [] : meta.highlightTargets);
    const isLastStep = step === tutorialTotalSteps;

    if (markdownViewOpen) {
        const previewBanner = (
            <aside
                aria-label="Tutorial Markdown preview guide"
                style={{ zIndex: 60002 }}
                className="board-toolbar fixed bottom-4 left-1/2 w-[min(94vw,36rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-rose-200 bg-white/95 text-neutral-900 shadow-xl backdrop-blur-md"
            >
                <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-rose-500 text-[11px] font-extrabold text-white">
                            {step}
                        </span>
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-rose-600">
                                <Sparkles aria-hidden="true" className="h-3 w-3 shrink-0" />
                                <span className="truncate">{meta.subtitle} · Preview Open</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        <button
                            type="button"
                            aria-label={collapsed ? "Expand tutorial guide" : "Collapse tutorial guide"}
                            onClick={() => setCollapsed((prev) => !prev)}
                            className="inline-flex items-center justify-center rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
                        >
                            {collapsed ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={onExit}
                            aria-label="Exit tutorial"
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 text-xs font-bold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
                        >
                            <X aria-hidden="true" className="h-3.5 w-3.5" />
                            Exit
                        </button>
                    </div>
                </div>
                <div className="h-1 w-full bg-neutral-100">
                    <div
                        className="h-full bg-rose-500 transition-all duration-300"
                        style={{ width: `${(step / tutorialTotalSteps) * 100}%` }}
                    />
                </div>
                {!collapsed && (
                    <p className="px-4 pb-3 pt-2 text-xs leading-relaxed text-neutral-700">
                        {getPreviewBannerCopy(step)}
                    </p>
                )}
            </aside>
        );

        return typeof document !== "undefined"
            ? createPortal(previewBanner, document.body)
            : previewBanner;
    }

    return (
        <>
            {highlightCss && <style>{highlightCss}</style>}
            <aside
                aria-label="Interactive tutorial guide"
                style={{ zIndex: 50002 }}
                className="board-toolbar fixed left-1/2 top-18 w-[min(92vw,31rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-neutral-200/90 bg-white/92 text-neutral-900 shadow-xl backdrop-blur-md sm:top-5"
            >
                <div className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-rose-500 text-xs font-extrabold text-white">
                            {step}
                        </span>
                        <div className="min-w-0">
                            <div className="truncate text-[11px] font-bold uppercase tracking-wide text-rose-600">
                                {meta.subtitle} · Sandbox Mode
                            </div>
                            <h2 className="truncate text-sm font-extrabold text-neutral-900">
                                {meta.title}
                            </h2>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        <button
                            type="button"
                            aria-label={collapsed ? "Expand tutorial guide" : "Collapse tutorial guide"}
                            onClick={() => setCollapsed((prev) => !prev)}
                            className="inline-flex items-center justify-center rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
                        >
                            {collapsed ? (
                                <ChevronDown className="h-4 w-4" />
                            ) : (
                                <ChevronUp className="h-4 w-4" />
                            )}
                        </button>
                        <button
                            type="button"
                            aria-label="Exit tutorial"
                            onClick={onExit}
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 text-xs font-bold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
                        >
                            <X aria-hidden="true" className="h-3.5 w-3.5" />
                            Exit
                        </button>
                    </div>
                </div>

                <div className="h-1 w-full bg-neutral-100">
                    <div
                        className="h-full bg-rose-500 transition-all duration-300"
                        style={{ width: `${(step / tutorialTotalSteps) * 100}%` }}
                    />
                </div>

                {!collapsed && (
                    <div className="space-y-2.5 px-4 pb-3.5 pt-2.5">
                        <p className="text-xs leading-relaxed text-neutral-700">
                            {meta.summary}
                        </p>

                        {step === 1 && (
                            <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-amber-50/90 px-2.5 py-1.5 text-[11px] font-semibold text-amber-900">
                                <span className="text-amber-700">Try Markdown:</span>
                                <code className="rounded bg-white px-1.5 py-0.5 text-neutral-800"># Heading</code>
                                <code className="rounded bg-white px-1.5 py-0.5 text-neutral-800">**bold**</code>
                                <code className="rounded bg-white px-1.5 py-0.5 text-neutral-800">- item</code>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="rounded-xl bg-sky-50/90 px-2.5 py-1.5 text-[11px] font-medium text-sky-900">
                                <strong>Image cards:</strong> Click the Camera button or drag &amp; drop an image file directly onto any board (optional here).
                            </div>
                        )}

                        {step === 4 && (
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-rose-50/80 px-2.5 py-1.5 text-[11px] font-semibold text-rose-900">
                                <span>
                                    Pink rings show the exact <strong>50px corner zone</strong>. Overlapping cards stay linked even when dashed lines hide.
                                </span>
                                <span className="rounded-md bg-white px-2 py-0.5 text-rose-600 shadow-xs">
                                    Active links: {cornerLinkCount}
                                </span>
                            </div>
                        )}

                        {checklist.length > 0 && (
                            <ul className="space-y-1">
                                {checklist.map((item) => (
                                    <li
                                        key={item.label}
                                        className={`flex items-center gap-1.5 text-xs font-semibold ${
                                            item.done ? "text-emerald-700" : "text-neutral-600"
                                        }`}
                                    >
                                        {item.done ? (
                                            <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                        ) : (
                                            <Circle aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-neutral-300" />
                                        )}
                                        <span>{item.label}</span>
                                    </li>
                                ))}
                            </ul>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    disabled={step === 1}
                                    onClick={onPrev}
                                    className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-bold text-neutral-600 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5" />
                                    Back
                                </button>
                                {(step === 3 || step === 4 || (step === 6 && memoCount < 2)) && (
                                    <button
                                        type="button"
                                        onClick={onRestoreShowcase}
                                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-bold text-neutral-600 transition hover:bg-neutral-100"
                                    >
                                        <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
                                        Restore Showcase
                                    </button>
                                )}
                            </div>

                            {isLastStep ? (
                                <button
                                    type="button"
                                    onClick={onExit}
                                    className={`inline-flex items-center gap-1 whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition ${
                                        stepCompleted
                                            ? "bg-emerald-600 hover:bg-emerald-700"
                                            : "bg-neutral-800 hover:bg-neutral-900"
                                    }`}
                                >
                                    {stepCompleted ? "Finish Tutorial" : "Close Tutorial"}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={onNext}
                                    className={`inline-flex items-center gap-1 whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-bold shadow-sm transition ${
                                        stepCompleted
                                            ? "bg-rose-500 text-white hover:bg-rose-600"
                                            : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                                    }`}
                                >
                                    {stepCompleted ? "Next Step" : "Skip Step"}
                                    <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </aside>
        </>
    );
}
