"use client";

import { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { GripVertical, X } from "lucide-react";
import PressableButton from "./PressableButton";
import type { BoardMemo } from "@/lib/board-state";
import { memoPlainText, memoReorderRowHeight, memoReorderVisibleRows } from "@/lib/memo-order";

type MemoReorderPanelProps = {
    memos: BoardMemo[];
    listRef: RefObject<HTMLDivElement | null>;
    draggingMemoId: number | null;
    dragOffsetY: number;
    onDragStart: (event: ReactPointerEvent<HTMLElement>, memoId: number) => void;
    onRowClick: (memoId: number) => void;
    onClose: () => void;
};

export default function MemoReorderPanel({
    memos,
    listRef,
    draggingMemoId,
    dragOffsetY,
    onDragStart,
    onRowClick,
    onClose,
}: MemoReorderPanelProps) {
    return (
        <div className="board-toolbar fixed left-5 top-20 z-50000 w-72 rounded-xl bg-white/75 shadow-md">
            <header className="flex items-center justify-between px-4 pb-1 pt-3">
                <h2 className="font-bold text-neutral-900">Memo Order</h2>
                <PressableButton
                    className="p-1"
                    onClick={onClose}
                    aria-label="Close memo order"
                >
                    <X className="h-4 w-4 text-neutral-900" />
                </PressableButton>
            </header>
            {memos.length === 0 ? (
                <p className="px-4 pb-4 pt-1 text-xs font-semibold text-neutral-500">
                    No memos exist.
                </p>
            ) : (
                <>
                    <div
                        ref={listRef}
                        // 줄 높이의 배수로 잘라야 다음 줄이 반쯤 걸쳐 보이지 않는다.
                        style={{ maxHeight: `${memoReorderRowHeight * memoReorderVisibleRows}px` }}
                        className="overflow-y-auto overflow-x-hidden px-2"
                    >
                        {memos.map((memo, index) => {
                            const dragging = memo.id === draggingMemoId;
                            const preview = memoPlainText(memo.content);

                            return (
                                <div
                                    key={memo.id}
                                    style={{
                                        height: `${memoReorderRowHeight}px`,
                                        ...(dragging
                                            ? {
                                                transform: `translateY(${dragOffsetY}px)`,
                                                position: "relative" as const,
                                                zIndex: 10,
                                            }
                                            : {}),
                                    }}
                                    className={`memo-order-row flex items-center gap-1 rounded-lg px-1 ${
                                        dragging
                                            ? "bg-white shadow-md ring-2 ring-pink-400"
                                            : "transition duration-150 ease-out hover:bg-white/80"
                                    }`}
                                    onClick={() => onRowClick(memo.id)}
                                >
                                    <span
                                        role="button"
                                        tabIndex={-1}
                                        aria-label={`Move memo ${index + 1}`}
                                        className="flex h-7 w-5 shrink-0 cursor-grab items-center justify-center text-neutral-400 active:cursor-grabbing"
                                        // 여기서 시작한 터치만 끌기로 쓰고, 나머지는 목록 스크롤에 남겨 둔다.
                                        style={{ touchAction: "none" }}
                                        onPointerDown={(event) => onDragStart(event, memo.id)}
                                    >
                                        <GripVertical className="h-4 w-4" />
                                    </span>
                                    <span className="w-5 shrink-0 text-center text-xs font-bold text-neutral-400">
                                        {index + 1}
                                    </span>
                                    <span
                                        aria-hidden="true"
                                        className="h-3 w-3 shrink-0 rounded-full border border-black/10"
                                        style={{ backgroundColor: memo.color }}
                                    />
                                    <button
                                        type="button"
                                        className="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-neutral-700"
                                    >
                                        {preview || "(empty memo)"}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                    <p className="px-4 pb-3 pt-1 text-[11px] font-semibold text-neutral-500">
                        Drag the handle to reorder. Tap a row to jump to that memo.
                    </p>
                </>
            )}
        </div>
    );
}
