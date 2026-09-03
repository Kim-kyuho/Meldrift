"use client";

import PressableButton from "./PressableButton";
import { Dispatch, SetStateAction } from "react";
import { Camera, Check, Compass, Pencil, Search, SquarePen, Table2, Workflow } from "lucide-react";
import BoardZoomControl from "./BoardZoomControl";

type BoardToolBarProps = {
    cardEditing: boolean;
    drawingMode: boolean;
    searchBarOpen: boolean;
    boardNavigatorOpen: boolean;
    boardZoom: number;
    setBoardZoom: Dispatch<SetStateAction<number>>;
    setMenuOpen: Dispatch<SetStateAction<boolean>>;
    setSearchBarOpen: Dispatch<SetStateAction<boolean>>;
    setBoardNavigatorOpen: Dispatch<SetStateAction<boolean>>;
    onMemoCreateClick: () => void;
    onImageUploadClick: () => void;
    onMermaidCreateClick: () => void;
    onTableCreateClick: () => void;
    onDrawingToggleClick: () => void;
};

export default function BoardToolBar({ 
    cardEditing,
    drawingMode,
    searchBarOpen,
    boardNavigatorOpen,
    boardZoom,
    setBoardZoom,
    setMenuOpen,
    setSearchBarOpen,
    setBoardNavigatorOpen,
    onMemoCreateClick,
    onImageUploadClick,
    onMermaidCreateClick,
    onTableCreateClick,
    onDrawingToggleClick,
}: BoardToolBarProps){
    const toolbarButtonClassName = "flex h-10 w-10 items-center justify-center px-0 py-0 hover:pl-0 hover:bg-white/80 hover:shadow-sm active:scale-90 active:bg-white active:shadow-inner";
    const toolbarIconClassName = "h-5 w-5 transition duration-150 ease-out";

    return (
        <>
            {!cardEditing && (
            <div className="board-toolbar toolbar-reveal fixed bottom-16 right-5 z-50000 flex flex-col items-end gap-1">
                <div>
                    <PressableButton
                        variant="menu"
                        className={toolbarButtonClassName}
                        onClick={() => {
                            setSearchBarOpen(false);
                            setBoardNavigatorOpen((prev) => !prev);
                            setMenuOpen(false);
                        }}
                        aria-label="Open memo navigator"
                        aria-pressed={boardNavigatorOpen}
                    >
                        <Compass
                            className={toolbarIconClassName}
                            style={boardNavigatorOpen ? { color: "#ec4899" } : undefined}
                        />
                    </PressableButton>
                </div>
                <div>
                    <PressableButton 
                        variant="menu"
                        className={toolbarButtonClassName}
                        onClick={() => {
                            setMenuOpen(false);
                            setBoardNavigatorOpen(false);
                            setSearchBarOpen(prev => !prev);
                        }}
                        aria-label="Search memos"
                        aria-pressed={searchBarOpen}
                    >
                        <Search
                            className={toolbarIconClassName}
                            style={searchBarOpen ? { color: "#ec4899" } : undefined}
                        />
                    </PressableButton>
                </div>
                <div>
                    <PressableButton 
                        variant="menu"
                        className={toolbarButtonClassName}
                        onClick={() => { 
                            onMemoCreateClick();
                            setMenuOpen(false);
                        }}
                    >
                        <SquarePen className={toolbarIconClassName} />
                    </PressableButton>
                </div>
                <div>
                    <PressableButton 
                        variant="menu"
                        className={toolbarButtonClassName}
                        onClick={() => {
                            onImageUploadClick();
                            setMenuOpen(false);
                        }}
                    >
                        <Camera className={toolbarIconClassName} />
                    </PressableButton>
                </div>
                <div>
                    <PressableButton
                        variant="menu"
                        className={toolbarButtonClassName}
                        onClick={() => {
                            onTableCreateClick();
                            setMenuOpen(false);
                        }}
                    >
                        <Table2 className={toolbarIconClassName} />
                    </PressableButton>
                </div>
                <div>
                    <PressableButton
                        variant="menu"
                        className={toolbarButtonClassName}
                        onClick={() => {
                            onMermaidCreateClick();
                            setMenuOpen(false);
                        }}
                    >
                        <Workflow className={toolbarIconClassName} />
                    </PressableButton>
                </div>
            </div>
            )}
            {(!cardEditing || drawingMode) && (
                <div className="board-toolbar fixed bottom-10 left-10 z-50000">
                    <PressableButton
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-white/80 p-0 text-neutral-900 shadow-md active:scale-90"
                        aria-label={drawingMode ? "Finish drawing" : "Start drawing"}
                        title={drawingMode ? "Finish drawing" : "Start drawing"}
                        onClick={() => {
                            setSearchBarOpen(false);
                            setBoardNavigatorOpen(false);
                            onDrawingToggleClick();
                            setMenuOpen(false);
                        }}
                    >
                        {drawingMode ? <Check className="h-6 w-6" /> : <Pencil className="h-6 w-6" />}
                    </PressableButton>
                </div>
            )}
            <div
                id="card-tool-portal"
                className="board-toolbar fixed bottom-16 right-5 z-50000 flex flex-col items-end gap-1"
            />
            <BoardZoomControl
                boardZoom={boardZoom}
                setBoardZoom={setBoardZoom}
            />
        </>
    );
}
