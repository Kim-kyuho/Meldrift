"use client";

import { useState } from "react";
import { Eraser, Minus, Palette, Undo2 } from "lucide-react";
import { penColors, penWidths } from "@/lib/board-stroke";
import type { DrawingTool } from "@/hooks/useBoardDrawing";
import { CardToolButton, CardToolPortal } from "./CardToolPortal";

type DrawingToolBarProps = {
    drawingTool: DrawingTool;
    penColor: string;
    penWidth: number;
    onChangeColor: (color: string) => void;
    onChangeWidth: (width: number) => void;
    onToggleErase: () => void;
    onUndo: () => void;
};

const activeToolColor = "#ec4899";

export default function DrawingToolBar({
    drawingTool,
    penColor,
    penWidth,
    onChangeColor,
    onChangeWidth,
    onToggleErase,
    onUndo,
}: DrawingToolBarProps) {
    const [openColorMenu, setOpenColorMenu] = useState(false);
    const [openWidthMenu, setOpenWidthMenu] = useState(false);

    const toggleColorMenu = () => {
        setOpenColorMenu((prev) => !prev);
        setOpenWidthMenu(false);
    };

    const toggleWidthMenu = () => {
        setOpenWidthMenu((prev) => !prev);
        setOpenColorMenu(false);
    };

    const handleColorSelect = (color: string) => {
        onChangeColor(color);
        setOpenColorMenu(false);
    };

    const handleWidthSelect = (width: number) => {
        onChangeWidth(width);
        setOpenWidthMenu(false);
    };

    const closeMenus = () => {
        setOpenColorMenu(false);
        setOpenWidthMenu(false);
    };

    return (
        <CardToolPortal>
            <CardToolButton label="Undo last stroke" onClick={onUndo}>
                <Undo2 />
            </CardToolButton>
            <div className="relative">
                <CardToolButton label="Pen color" onClick={toggleColorMenu}>
                    <Palette style={{ color: penColor }} />
                </CardToolButton>
                {openColorMenu && (
                    <div className="absolute right-full top-0 mr-2 flex items-center gap-1 rounded-md bg-white p-1 shadow-md">
                        {penColors.map((color) => (
                            <button
                                key={color.value}
                                type="button"
                                aria-label={color.name}
                                title={color.name}
                                className="h-8 w-8 rounded-full border border-neutral-300 transition hover:scale-105 active:scale-95"
                                style={{ backgroundColor: color.value }}
                                onClick={() => handleColorSelect(color.value)}
                            />
                        ))}
                    </div>
                )}
            </div>

            <div className="relative">
                <CardToolButton label="Pen width" onClick={toggleWidthMenu}>
                    <Minus strokeWidth={penWidth} />
                </CardToolButton>
                {openWidthMenu && (
                    <div className="absolute right-full top-0 mr-2 flex items-center gap-1 rounded-md bg-white p-1 shadow-md">
                        {penWidths.map((width) => (
                            <CardToolButton
                                key={width.value}
                                label={width.name}
                                onClick={() => handleWidthSelect(width.value)}
                            >
                                <Minus strokeWidth={width.value} />
                            </CardToolButton>
                        ))}
                    </div>
                )}
            </div>

            <CardToolButton
                label={drawingTool === "erase" ? "Stop erasing" : "Erase"}
                aria-pressed={drawingTool === "erase"}
                onClick={() => {
                    closeMenus();
                    onToggleErase();
                }}
            >
                <Eraser style={drawingTool === "erase" ? { color: activeToolColor } : undefined} />
            </CardToolButton>
        </CardToolPortal>
    );
}
