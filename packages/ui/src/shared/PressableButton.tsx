"use client";

import { ButtonHTMLAttributes, useState } from "react";

type PressableButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "default" | "menu";
};

export default function PressableButton({
    className = "",
    variant = "default",
    onTouchStart,
    onTouchEnd,
    onTouchCancel,
    children,
    ...props
}: PressableButtonProps) {
    const [pressed, setPressed] = useState(false);

    // ui-button, ui-button-menu는 글로벌 CSS에 정의한 클래스다.
    const baseClassName =
        variant === "menu"
            ? "ui-button-menu"
            : "ui-button";

    const pressedClassName =
        variant === "menu"
            ? "scale-[0.98] bg-white/90 pl-4 shadow-md"
            : "scale-[0.96] bg-white/80 shadow-lg";

    return (
        <button
            {...props}
            className={`${baseClassName} ${pressed ? pressedClassName : ""} ${className}`.trim()}
            onTouchStart={(e) => {
                setPressed(true);
                onTouchStart?.(e);
            }}
            onTouchEnd={(e) => {
                setPressed(false);
                onTouchEnd?.(e);
            }}
            onTouchCancel={(e) => {
                setPressed(false);
                onTouchCancel?.(e);
            }}
        >
            {children}
        </button>
    );
}
