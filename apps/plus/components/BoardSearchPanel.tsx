"use client";

import {ChevronUp, ChevronDown} from "lucide-react"

type BoardPanelProps = {
    searchText: string;
    currentIndex: number;
    searchCount: number;
    onTextChange: (query: string) => void;
    onPrev:() => void;
    onNext:() => void;
}

export default function BoardSearchPanel({
    searchText, 
    currentIndex, 
    searchCount, 
    onTextChange, 
    onPrev, 
    onNext
}:BoardPanelProps){
    return(
        <>
            <div className="fixed bottom-20 left-1/2 z-50000 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-md">
                <input
                    value={searchText}
                    onChange={(event) => onTextChange(event.target.value)}
                    className="w-48 bg-transparent text-[16px] text-neutral-900 outline-none"
                    placeholder="Search memos"

                />

                <span className="text-xs text-neutral-500">
                    {currentIndex}/{searchCount}
                </span>

                <button onClick={onPrev}>
                    <ChevronUp />
                </button>

                <button onClick={onNext}>
                    <ChevronDown />
                </button>
            </div>
        </>
    )
}
