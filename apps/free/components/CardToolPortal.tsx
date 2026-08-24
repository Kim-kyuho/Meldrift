"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";
import { createPortal } from "react-dom";
import PressableButton from "./PressableButton";

export function CardToolPortal({
    children,
    animate = true,
}: {
    children: ReactNode;
    animate?: boolean;
}) {
    const portalTarget = typeof document === "undefined"
        ? null
        : document.getElementById("card-tool-portal");

    if (!portalTarget) {
        return null;
    }

    return createPortal(
        <div className={`${animate ? "toolbar-reveal" : ""} flex flex-col items-end gap-1`}>
            {children}
        </div>,
        portalTarget
    );
}

type CardToolButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    children: ReactNode;
};

export function CardToolButton({
    label,
    children,
    className = "",
    ...props
}: CardToolButtonProps) {
    return (
        <div className="relative">
            <PressableButton
                {...props}
                variant="menu"
                aria-label={label}
                title={label}
                className={`flex h-10 w-10 items-center justify-center px-0 py-0 hover:bg-white/80 hover:pl-0 hover:shadow-sm active:scale-90 active:bg-white active:shadow-inner [&_svg]:h-5 [&_svg]:w-5 ${className}`}
            >
                {children}
            </PressableButton>
        </div>
    );
}
