import { useState } from "react";

export function useMemoToolBar({
    onChangeColor,
    onHeading,
}: {
    onChangeColor?: (color: string) => void;
    onHeading?: (level: 1 | 2 | 3 | 4 | 5 | 6) => void;
}) {
    const [openMemoColorMenu, setOpenMemoColorMenu] = useState(false);
    const [openHeadingMenu, setOpenHeadingMenu] = useState(false);
    const [toolMode, setToolMode] = useState<"main" | "format" | "block">("main");

    const memoColors = [
        { name: "Yellow", value: "#fffadc" },
        { name: "Pink", value: "#ffe4ec" },
        { name: "Blue", value: "#e0f2fe" },
        { name: "Green", value: "#dcfce7" },
        { name: "Lavender", value: "#ede9fe" },
        { name: "Peach", value: "#ffedd5" },
        { name: "Mint", value: "#ccfbf1" },
        { name: "Gray", value: "#f1f5f9" },
    ];

    const headingLevels = [
        { name: "h1", value: 1 },
        { name: "h2", value: 2 },
        { name: "h3", value: 3 },
        { name: "h4", value: 4 },
        { name: "h5", value: 5 },
        { name: "h6", value: 6 },
    ] as const;

    const toggleColorMenu = () => {
        setOpenMemoColorMenu((prev) => !prev);
        setOpenHeadingMenu(false);
    };

    const toggleHeadingMenu = () => {
        setOpenHeadingMenu((prev) => !prev);
        setOpenMemoColorMenu(false);
    };

    const handleColorSelect = (color: string) => {
        onChangeColor?.(color);
        setOpenMemoColorMenu(false);
    };

    const handleHeadingSelect = (level: 1 | 2 | 3 | 4 | 5 | 6) => {
        onHeading?.(level);
        setOpenHeadingMenu(false);
    };

    const changeToolMode = (mode: "main" | "format" | "block") => {
        setOpenMemoColorMenu(false);
        setOpenHeadingMenu(false);
        setToolMode(mode);
    };

    return {
        memoColors,
        headingLevels,
        toolMode,
        openMemoColorMenu,
        openHeadingMenu,
        toggleColorMenu,
        toggleHeadingMenu,
        handleColorSelect,
        handleHeadingSelect,
        openMainTools: () => changeToolMode("main"),
        openFormatTools: () => changeToolMode("format"),
        openBlockTools: () => changeToolMode("block"),
    };
}
