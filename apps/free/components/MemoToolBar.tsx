"use client";

import {
    ArrowLeft,
    Bold,
    BringToFront,
    Code2,
    Heading,
    Heading1,
    Heading2,
    Heading3,
    Heading4,
    Heading5,
    Heading6,
    Highlighter,
    Italic,
    MessageSquareQuote,
    Minus,
    Palette,
    PencilLine,
    Quote,
    SendToBack,
    Strikethrough,
    Trash2,
} from "lucide-react";
import { useMemoToolBar } from "@/hooks/useMemoToolBar";
import { CardToolButton, CardToolPortal } from "./CardToolPortal";

type MemoToolBarProps = {
    onChangeColor: (color: string) => void;
    onHeading: (level: 1 | 2 | 3 | 4 | 5 | 6) => void;
    onBold: () => void;
    onItalic: () => void;
    onStrike: () => void;
    onHorizontalRule: () => void;
    onHighlight: () => void;
    onCodeBlock: () => void;
    onBlockQuote: () => void;
    onBringToFront: () => void;
    onSendToBack: () => void;
    onDelete: () => void;
};

const headingIcons = {
    1: Heading1,
    2: Heading2,
    3: Heading3,
    4: Heading4,
    5: Heading5,
    6: Heading6,
};

export default function MemoToolBar({
    onChangeColor,
    onHeading,
    onBold,
    onItalic,
    onStrike,
    onHorizontalRule,
    onHighlight,
    onCodeBlock,
    onBlockQuote,
    onBringToFront,
    onSendToBack,
    onDelete,
}: MemoToolBarProps) {
    const {
        memoColors,
        headingLevels,
        toolMode,
        openMemoColorMenu,
        openHeadingMenu,
        toggleColorMenu,
        toggleHeadingMenu,
        handleColorSelect,
        handleHeadingSelect,
        openMainTools,
        openFormatTools,
        openBlockTools,
    } = useMemoToolBar({ onChangeColor, onHeading });

    return (
        <CardToolPortal animate={false}>
            <div key={toolMode} className="toolbar-reveal flex flex-col items-end gap-1">
                {toolMode === "main" && (
                    <>
                        <div className="relative">
                            <CardToolButton label="Memo color" onClick={toggleColorMenu}>
                                <Palette />
                            </CardToolButton>
                            {openMemoColorMenu && (
                                <div className="absolute right-full top-0 mr-2 grid w-40 grid-cols-4 place-items-center gap-1.5 rounded-md bg-white p-2 shadow-md">
                                    {memoColors.map((color) => (
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
                        <CardToolButton label="Text formatting" onClick={openFormatTools}>
                            <PencilLine />
                        </CardToolButton>
                        <CardToolButton label="Block formatting" onClick={openBlockTools}>
                            <MessageSquareQuote />
                        </CardToolButton>
                        <CardToolButton label="Bring memo to front" onClick={onBringToFront}>
                            <BringToFront />
                        </CardToolButton>
                        <CardToolButton label="Send memo to back" onClick={onSendToBack}>
                            <SendToBack />
                        </CardToolButton>
                        <CardToolButton label="Delete memo" onClick={onDelete} className="text-rose-600">
                            <Trash2 />
                        </CardToolButton>
                    </>
                )}

                {toolMode === "format" && (
                    <>
                        <CardToolButton label="Back to memo tools" onClick={openMainTools}>
                            <ArrowLeft />
                        </CardToolButton>
                        <div className="relative">
                            <CardToolButton label="Heading" onClick={toggleHeadingMenu}>
                                <Heading />
                            </CardToolButton>
                            {openHeadingMenu && (
                                <div className="absolute right-full top-0 mr-2 flex items-center gap-1 rounded-md bg-white p-1 shadow-md">
                                    {headingLevels.map((heading) => {
                                        const HeadingIcon = headingIcons[heading.value];

                                        return (
                                            <CardToolButton
                                                key={heading.value}
                                                label={heading.name.toUpperCase()}
                                                onClick={() => handleHeadingSelect(heading.value)}
                                            >
                                                <HeadingIcon />
                                            </CardToolButton>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <CardToolButton label="Bold" onClick={onBold}>
                            <Bold />
                        </CardToolButton>
                        <CardToolButton label="Italic" onClick={onItalic}>
                            <Italic />
                        </CardToolButton>
                        <CardToolButton label="Strike" onClick={onStrike}>
                            <Strikethrough />
                        </CardToolButton>
                        <CardToolButton label="Highlight" onClick={onHighlight}>
                            <Highlighter />
                        </CardToolButton>
                    </>
                )}

                {toolMode === "block" && (
                    <>
                        <CardToolButton label="Back to memo tools" onClick={openMainTools}>
                            <ArrowLeft />
                        </CardToolButton>
                        <CardToolButton label="Divider" onClick={onHorizontalRule}>
                            <Minus />
                        </CardToolButton>
                        <CardToolButton label="Code block" onClick={onCodeBlock}>
                            <Code2 />
                        </CardToolButton>
                        <CardToolButton label="Block quote" onClick={onBlockQuote}>
                            <Quote />
                        </CardToolButton>
                    </>
                )}
            </div>
        </CardToolPortal>
    );
}
