"use client";

import PressableButton from "./PressableButton";
import { ChevronLeft, ChevronRight } from "lucide-react";

type BoardNavigatorProps = {
    currentMemoNumber: number;
    memoCount: number;
    onPrev: () => void;
    onNext: () => void;
    onMemoNumberChange: (memoNumber: number) => void;
};

export default function BoardNavigator({
    currentMemoNumber,
    memoCount,
    onPrev,
    onNext,
    onMemoNumberChange,
}: BoardNavigatorProps) {
    const handleMemoNumberChange = (input: HTMLInputElement) => {
        const numericValue = input.value.replace(/\D/g, "");
        input.value = numericValue;

        if (!numericValue) return;

        onMemoNumberChange(Number(numericValue));
    };

    return (
        <div className="fixed bottom-20 left-1/2 z-50000 flex -translate-x-1/2 items-center gap-1 rounded-xl bg-white px-3 py-2 text-neutral-900 shadow-md">
            <PressableButton
                variant="menu"
                className="flex h-6 w-6 items-center justify-center px-0 py-0 hover:pl-0"
                aria-label="Previous memo"
                onClick={onPrev}
            >
                <ChevronLeft className="h-5 w-5" />
            </PressableButton>
            <input
                key={currentMemoNumber}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                defaultValue={currentMemoNumber > 0 ? currentMemoNumber : ""}
                onChange={(event) => handleMemoNumberChange(event.currentTarget)}
                aria-label="Memo number"
                className="h-6 w-12 rounded-md bg-neutral-50 text-center text-[16px] font-semibold text-neutral-900 outline-none"
            />
            <span className="min-w-8 text-sm font-semibold text-neutral-500">
                / {memoCount}
            </span>
            <PressableButton
                variant="menu"
                className="flex h-6 w-6 items-center justify-center px-0 py-0 hover:pl-0"
                aria-label="Next memo"
                onClick={onNext}
            >
                <ChevronRight className="h-5 w-5" />
            </PressableButton>
        </div>
    );
}
