"use client";

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
    type ReactNode,
    type RefObject,
} from "react";
import { GripVertical } from "lucide-react";

const splitRatioStorageKey = "meldrift:markdown-split-ratio";
const defaultSplitRatio = 0.5;
const minSplitRatio = 0.25;
const maxSplitRatio = 0.75;
const minCanvasPaneWidth = 300;
const minMarkdownPaneWidth = 340;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function readStoredRatio(): number {
    if (typeof window === "undefined") {
        return defaultSplitRatio;
    }
    try {
        const raw = window.localStorage.getItem(splitRatioStorageKey);
        if (!raw) {
            return defaultSplitRatio;
        }
        const parsed = Number.parseFloat(raw);
        if (!Number.isFinite(parsed)) {
            return defaultSplitRatio;
        }
        return clamp(parsed, minSplitRatio, maxSplitRatio);
    } catch {
        return defaultSplitRatio;
    }
}

function writeStoredRatio(ratio: number) {
    if (typeof window === "undefined") {
        return;
    }
    try {
        window.localStorage.setItem(splitRatioStorageKey, ratio.toFixed(4));
    } catch {
        // Ignore storage quota / private mode failures.
    }
}

export type BoardSplitLayoutProps = {
    open: boolean;
    compact: boolean;
    scrollRef: RefObject<HTMLDivElement | null>;
    canvas: ReactNode;
    panel: ReactNode;
};

export default function BoardSplitLayout({
    open,
    compact,
    scrollRef,
    canvas,
    panel,
}: BoardSplitLayoutProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const savedScrollRef = useRef<{ left: number; top: number } | null>(null);
    const wasCompactOpenRef = useRef(false);
    const dragPointerIdRef = useRef<number | null>(null);
    const [splitRatio, setSplitRatio] = useState<number>(readStoredRatio);
    const [dragging, setDragging] = useState(false);
    const ratioRef = useRef(splitRatio);

    useEffect(() => {
        ratioRef.current = splitRatio;
    }, [splitRatio]);

    // 스마트폰에서 전체 전환 시 캔버스 스크롤 위치를 저장하고 복귀 시 복원한다.
    useEffect(() => {
        const isCompactOpen = open && compact;
        if (isCompactOpen && !wasCompactOpenRef.current) {
            const scroller = scrollRef.current;
            if (scroller) {
                savedScrollRef.current = {
                    left: scroller.scrollLeft,
                    top: scroller.scrollTop,
                };
            }
        } else if (!isCompactOpen && wasCompactOpenRef.current) {
            const saved = savedScrollRef.current;
            savedScrollRef.current = null;
            if (saved) {
                const frame = window.requestAnimationFrame(() => {
                    const scroller = scrollRef.current;
                    if (scroller) {
                        scroller.scrollLeft = saved.left;
                        scroller.scrollTop = saved.top;
                    }
                });
                wasCompactOpenRef.current = isCompactOpen;
                return () => window.cancelAnimationFrame(frame);
            }
        }
        wasCompactOpenRef.current = isCompactOpen;
    }, [open, compact, scrollRef]);

    const computeClampedRatio = useCallback((rawRatio: number) => {
        const width = containerRef.current?.getBoundingClientRect().width ?? 0;
        if (width <= 0) {
            return clamp(rawRatio, minSplitRatio, maxSplitRatio);
        }
        const effectiveMin = Math.max(minSplitRatio, Math.min(0.45, minCanvasPaneWidth / width));
        const effectiveMax = Math.min(maxSplitRatio, Math.max(0.55, 1 - minMarkdownPaneWidth / width));
        return clamp(rawRatio, effectiveMin, effectiveMax);
    }, []);

    const handleDividerPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }
        event.preventDefault();
        dragPointerIdRef.current = event.pointerId;
        setDragging(true);
        if (typeof event.currentTarget.setPointerCapture === "function") {
            try {
                event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
                // jsdom / unsupported environments ignore capture.
            }
        }
    };

    const handleDividerPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (dragPointerIdRef.current !== event.pointerId) {
            return;
        }
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect || rect.width <= 0) {
            return;
        }
        const raw = (event.clientX - rect.left) / rect.width;
        const next = computeClampedRatio(raw);
        setSplitRatio(next);
    };

    const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (dragPointerIdRef.current !== event.pointerId) {
            return;
        }
        dragPointerIdRef.current = null;
        setDragging(false);
        if (typeof event.currentTarget.hasPointerCapture === "function" && event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        writeStoredRatio(ratioRef.current);
    };

    const handleResetRatio = () => {
        const next = computeClampedRatio(defaultSplitRatio);
        setSplitRatio(next);
        writeStoredRatio(next);
    };

    const handleDividerKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home") {
            return;
        }
        event.preventDefault();
        const next = event.key === "Home"
            ? computeClampedRatio(defaultSplitRatio)
            : computeClampedRatio(ratioRef.current + (event.key === "ArrowLeft" ? -0.05 : 0.05));
        setSplitRatio(next);
        writeStoredRatio(next);
    };

    const isSplitOpen = open && !compact;
    const isCompactOpen = open && compact;

    // 모든 상태(닫힘 / Split / 스마트폰 전환)에서 {canvas}의 React 트리 위치를 동일하게 유지해
    // 캔버스 카드·튜토리얼·스크롤 상태가 언마운트/재마운트되지 않도록 보장한다.
    return (
        <div
            ref={containerRef}
            data-split-layout={isSplitOpen ? "true" : undefined}
            className={
                isSplitOpen
                    ? `flex h-dvh w-screen overflow-hidden bg-neutral-200 ${dragging ? "select-none cursor-col-resize" : ""}`
                    : "relative h-dvh w-screen overflow-hidden"
            }
        >
            <div
                data-split-pane={isSplitOpen ? "canvas" : undefined}
                aria-hidden={isCompactOpen ? true : undefined}
                className={
                    isCompactOpen
                        ? "hidden"
                        : isSplitOpen
                            ? "board-split-canvas-pane relative h-full min-w-0 shrink-0 overflow-hidden"
                            : "relative h-full w-full overflow-hidden"
                }
                style={isSplitOpen ? { width: `${splitRatio * 100}%` } : undefined}
            >
                {canvas}
            </div>
            {isSplitOpen && (
                <div
                    role="separator"
                    aria-label="Resize canvas and Markdown panels"
                    aria-orientation="vertical"
                    aria-valuemin={Math.round(minSplitRatio * 100)}
                    aria-valuemax={Math.round(maxSplitRatio * 100)}
                    aria-valuenow={Math.round(splitRatio * 100)}
                    tabIndex={0}
                    onPointerDown={handleDividerPointerDown}
                    onPointerMove={handleDividerPointerMove}
                    onPointerUp={finishDrag}
                    onPointerCancel={finishDrag}
                    onDoubleClick={handleResetRatio}
                    onKeyDown={handleDividerKeyDown}
                    className={`board-split-divider relative z-20 flex w-3 shrink-0 cursor-col-resize select-none items-center justify-center border-x border-neutral-300/80 transition-colors ${
                        dragging ? "bg-sky-200/80" : "bg-neutral-200/90 hover:bg-neutral-300/90"
                    }`}
                    style={{ touchAction: "none" }}
                    title="Drag to resize panels (double-click to reset)"
                >
                    <span
                        className={`flex h-12 w-5 items-center justify-center rounded-full border bg-white shadow-sm transition-colors ${
                            dragging
                                ? "border-sky-400 text-sky-600"
                                : "border-neutral-300 text-neutral-500 hover:border-neutral-400 hover:text-neutral-700"
                        }`}
                        aria-hidden="true"
                    >
                        <GripVertical className="h-3.5 w-3.5" />
                    </span>
                </div>
            )}
            {open && (
                <div
                    data-split-pane={isCompactOpen ? "markdown-compact" : "markdown"}
                    className={
                        isCompactOpen
                            ? "fixed inset-0 z-50000 flex h-dvh w-screen flex-col overflow-hidden bg-white"
                            : "relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-white"
                    }
                >
                    {panel}
                </div>
            )}
        </div>
    );
}
