"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SharedBoardClient, { type BoardControls } from "@meldrift/ui/BoardClient";
import { cornerLinkRadius } from "@meldrift/core/cards";
import { createEmptyBoardSnapshot, type BoardSnapshot } from "@meldrift/board-data/board-state";
import BoardMenu from "./BoardMenu";
import TutorialOverlay, { type TutorialChecklistItem } from "./TutorialOverlay";
import {
    buildTutorialShowcaseSnapshot,
    getMemoOrderKey,
    loadTutorialMascotBytes,
    type TutorialStepId,
} from "@/lib/tutorial";

type TutorialBoardClientProps = {
    onExit: () => void;
};

type TutorialProgressState = {
    step5Compiled: boolean;
    step6BaselineOrder: string;
    step6Reordered: boolean;
    step6Recompiled: boolean;
};

const initialProgress: TutorialProgressState = {
    step5Compiled: false,
    step6BaselineOrder: "",
    step6Reordered: false,
    step6Recompiled: false,
};

const noopAsync = async () => {};

type TutorialSandboxControlsProps = BoardControls & {
    step: TutorialStepId;
    setStep: (step: TutorialStepId) => void;
    viewportRef: React.RefObject<HTMLDivElement | null>;
    mascotBytesRef: React.RefObject<Uint8Array | null>;
    onExit: () => void;
};

function TutorialSandboxControls({
    snapshot,
    isEditing = false,
    markdownViewOpen = false,
    boardZoom = 1,
    cornerLinks = [],
    menuOpen,
    setMenuOpen,
    reorderOpen,
    onReorder,
    onCompileMarkdown,
    onAbout,
    closeOverlays,
    replaceSnapshot,
    step,
    setStep,
    viewportRef,
    mascotBytesRef,
    onExit,
}: TutorialSandboxControlsProps) {
    const [progress, setProgress] = useState<TutorialProgressState>(initialProgress);
    const showcaseInjectedRef = useRef(false);
    const prevStepRef = useRef<TutorialStepId | null>(null);
    const prevSnapshotMemosRef = useRef(snapshot.memos);

    const computeShowcaseOrigin = useCallback(() => {
        const viewport = viewportRef.current;
        const scrollLeft = viewport?.scrollLeft ?? 0;
        const scrollTop = viewport?.scrollTop ?? 0;
        const vw = viewport?.clientWidth ?? 1200;
        const vh = viewport?.clientHeight ?? 800;

        return {
            x: Math.max(80, Math.round(scrollLeft / boardZoom + Math.max(80, vw / boardZoom / 2 - 365))),
            y: Math.max(210, Math.round(scrollTop / boardZoom + Math.max(210, vh / boardZoom / 2 - 220))),
        };
    }, [boardZoom, viewportRef]);

    const injectShowcase = useCallback(() => {
        const showcase = buildTutorialShowcaseSnapshot(
            computeShowcaseOrigin(),
            mascotBytesRef.current,
        );
        replaceSnapshot(showcase);
        prevSnapshotMemosRef.current = showcase.memos;
        setProgress((prev) => ({
            ...prev,
            step6BaselineOrder: getMemoOrderKey(showcase.memos),
            step6Reordered: false,
            step6Recompiled: false,
        }));
    }, [computeShowcaseOrigin, mascotBytesRef, replaceSnapshot]);

    useEffect(() => {
        if (prevStepRef.current === step) {
            return;
        }
        prevStepRef.current = step;

        if (step === 3 && !showcaseInjectedRef.current) {
            showcaseInjectedRef.current = true;
            queueMicrotask(() => {
                injectShowcase();
            });
        }

        if (step === 6) {
            const baselineOrder = getMemoOrderKey(snapshot.memos);
            queueMicrotask(() => {
                setProgress((prev) => ({
                    ...prev,
                    step6BaselineOrder: baselineOrder,
                    step6Reordered: false,
                    step6Recompiled: false,
                }));
            });
        }
    }, [injectShowcase, snapshot.memos, step]);

    useEffect(() => {
        if (step === 5 && markdownViewOpen && !progress.step5Compiled) {
            queueMicrotask(() => {
                setProgress((prev) => ({ ...prev, step5Compiled: true }));
            });
        }
    }, [markdownViewOpen, progress.step5Compiled, step]);

    useEffect(() => {
        if (step !== 6) {
            return;
        }
        const currentOrder = getMemoOrderKey(snapshot.memos);
        const reorderedNow =
            snapshot.memos.length >= 2 &&
            progress.step6BaselineOrder.length > 0 &&
            currentOrder !== progress.step6BaselineOrder;

        if (reorderedNow && !progress.step6Reordered) {
            queueMicrotask(() => {
                setProgress((prev) => ({ ...prev, step6Reordered: true }));
            });
            return;
        }

        if (progress.step6Reordered && markdownViewOpen && !progress.step6Recompiled) {
            queueMicrotask(() => {
                setProgress((prev) => ({ ...prev, step6Recompiled: true }));
            });
        }
    }, [
        markdownViewOpen,
        progress.step6BaselineOrder,
        progress.step6Recompiled,
        progress.step6Reordered,
        snapshot.memos,
        step,
    ]);

    const { checklist, stepCompleted } = useMemo<{
        checklist: TutorialChecklistItem[];
        stepCompleted: boolean;
    }>(() => {
        if (step === 1) {
            const hasMemo = snapshot.memos.length > 0;
            const hasSavedMemo =
                !isEditing &&
                snapshot.memos.some((memo) => memo.id > 0 && memo.content.trim().length > 0);
            return {
                checklist: [
                    { label: "Create a Memo card (Memo button or M)", done: hasMemo },
                    { label: "Write Markdown text & click empty canvas to save", done: hasSavedMemo },
                ],
                stepCompleted: hasMemo && hasSavedMemo,
            };
        }

        if (step === 2) {
            const hasSavedTable = !isEditing && snapshot.tables.some((table) => table.id > 0);
            const hasSavedMermaid = !isEditing && snapshot.mermaids.some((mermaid) => mermaid.id > 0);
            return {
                checklist: [
                    { label: "Create & save a Table card (T)", done: hasSavedTable },
                    { label: "Create & save a Mermaid card (D)", done: hasSavedMermaid },
                ],
                stepCompleted: hasSavedTable && hasSavedMermaid,
            };
        }

        if (step === 3) {
            const ready =
                snapshot.memos.length >= 2 &&
                snapshot.images.length >= 1 &&
                snapshot.tables.length >= 1 &&
                snapshot.mermaids.length >= 1;
            return {
                checklist: [
                    { label: "Showcase Memo, Image, Table & Mermaid cards ready", done: ready },
                ],
                stepCompleted: ready,
            };
        }

        if (step === 4) {
            return {
                checklist: [
                    {
                        label: `Cards within 50px of a Memo corner attach automatically (${cornerLinks.length} linked)`,
                        done: cornerLinks.length > 0,
                    },
                ],
                stepCompleted: true,
            };
        }

        if (step === 5) {
            return {
                checklist: [
                    { label: "Open (...) -> Compile to Markdown and check Download", done: progress.step5Compiled },
                ],
                stepCompleted: progress.step5Compiled,
            };
        }

        return {
            checklist: [
                { label: "Open (...) -> Reorder Memos and swap memo order", done: progress.step6Reordered },
                { label: "Run Compile to Markdown again after reordering", done: progress.step6Recompiled },
            ],
            stepCompleted: progress.step6Reordered && progress.step6Recompiled,
        };
    }, [
        cornerLinks.length,
        isEditing,
        progress.step5Compiled,
        progress.step6Recompiled,
        progress.step6Reordered,
        snapshot.images.length,
        snapshot.memos,
        snapshot.mermaids,
        snapshot.tables,
        step,
    ]);

    const handleExit = useCallback(() => {
        closeOverlays();
        onExit();
    }, [closeOverlays, onExit]);

    return (
        <>
            <BoardMenu
                title={snapshot.board.title}
                menuOpen={menuOpen}
                setMenuOpen={setMenuOpen}
                reorderOpen={reorderOpen}
                exportDisabled={true}
                transferDisabled={true}
                mutationDisabled={true}
                resetting={false}
                transferring={false}
                onReorder={onReorder}
                onExport={noopAsync}
                onImport={noopAsync}
                onCompileMarkdown={onCompileMarkdown}
                onReset={noopAsync}
                onAbout={onAbout}
            />
            <TutorialOverlay
                step={step}
                checklist={checklist}
                stepCompleted={stepCompleted}
                markdownViewOpen={markdownViewOpen}
                cornerLinkCount={cornerLinks.length}
                memoCount={snapshot.memos.length}
                onPrev={() => setStep(Math.max(1, step - 1) as TutorialStepId)}
                onNext={() => setStep(Math.min(6, step + 1) as TutorialStepId)}
                onExit={handleExit}
                onRestoreShowcase={injectShowcase}
            />
        </>
    );
}

export default function TutorialBoardClient({ onExit }: TutorialBoardClientProps) {
    const [step, setStep] = useState<TutorialStepId>(1);
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const mascotBytesRef = useRef<Uint8Array | null>(null);

    const sandboxInitialSnapshot = useMemo<BoardSnapshot>(() => {
        const empty = createEmptyBoardSnapshot();
        return {
            ...empty,
            board: {
                ...empty.board,
                title: "Meldrift Tutorial Sandbox",
            },
        };
    }, []);

    useEffect(() => {
        let active = true;
        void loadTutorialMascotBytes().then((bytes) => {
            if (active) {
                mascotBytesRef.current = bytes;
            }
        });
        return () => {
            active = false;
        };
    }, []);

    return (
        <SharedBoardClient
            initialSnapshot={sandboxInitialSnapshot}
            viewportRef={viewportRef}
            renderControls={(controls) => (
                <TutorialSandboxControls
                    {...controls}
                    step={step}
                    setStep={setStep}
                    viewportRef={viewportRef}
                    mascotBytesRef={mascotBytesRef}
                    onExit={onExit}
                />
            )}
            renderBoardOverlay={({ snapshot }) => {
                if (step !== 4 || snapshot.memos.length === 0) {
                    return null;
                }
                const firstMemo = snapshot.memos[0];
                return (
                    <svg
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                        style={{ zIndex: 45000 }}
                    >
                        {snapshot.memos.map((memo) => {
                            const corners = [
                                { x: memo.x, y: memo.y },
                                { x: memo.x + memo.width, y: memo.y },
                                { x: memo.x, y: memo.y + memo.height },
                                { x: memo.x + memo.width, y: memo.y + memo.height },
                            ];
                            return corners.map((corner, index) => (
                                <circle
                                    key={`${memo.id}-corner-${index}`}
                                    cx={corner.x}
                                    cy={corner.y}
                                    r={cornerLinkRadius}
                                    fill="rgba(244, 63, 94, 0.06)"
                                    stroke="#f43f5e"
                                    strokeOpacity={0.55}
                                    strokeWidth={2}
                                    strokeDasharray="6 4"
                                />
                            ));
                        })}
                        <g transform={`translate(${firstMemo.x + firstMemo.width + 8}, ${firstMemo.y - cornerLinkRadius - 6})`}>
                            <rect
                                x={0}
                                y={0}
                                width={94}
                                height={20}
                                rx={6}
                                fill="#f43f5e"
                            />
                            <text
                                x={47}
                                y={14}
                                textAnchor="middle"
                                fill="#ffffff"
                                fontSize={11}
                                fontWeight={700}
                            >
                                50px Link Zone
                            </text>
                        </g>
                    </svg>
                );
            }}
        />
    );
}
