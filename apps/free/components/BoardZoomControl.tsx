"use client";

import { Dispatch, SetStateAction } from "react";
import { Minus, Plus } from "lucide-react";
import PressableButton from "./PressableButton";

type BoardZoomControlProps ={
    boardZoom: number;
    setBoardZoom: Dispatch<SetStateAction<number>>;
}

export default function BoardZoomControl({
    boardZoom,
    setBoardZoom,
}:BoardZoomControlProps){
    const changeZoom = (amount: number) => {
        setBoardZoom((prev) => Math.min(2, Math.max(0.25, Number((prev + amount).toFixed(2)))));
    };

    return(
        <div
            className="board-toolbar fixed bottom-7 right-5 z-50000 flex items-center gap-2"
            style={{
                // 배율 숫자가 선택되면 iPad에서 그 텍스트가 드래그된다
                WebkitTouchCallout: "none",
                WebkitUserSelect: "none",
                userSelect: "none",
            }}
        >
            <PressableButton
                variant="menu"
                className="flex h-8 w-8 items-center justify-center px-0 py-0 hover:pl-0"
                onClick={() => changeZoom(-0.05)}
                aria-label="Zoom out"
            >
                <Minus className="h-4 w-4" />
            </PressableButton>
            <span className="text-xs font-semibold text-neutral-700">
                {Math.round(boardZoom * 100)}%
            </span>
            <PressableButton
                variant="menu"
                className="flex h-8 w-8 items-center justify-center px-0 py-0 hover:pl-0"
                onClick={() => changeZoom(0.05)}
                aria-label="Zoom in"
            >
                <Plus className="h-4 w-4" />
            </PressableButton>
        </div>
    );
}
