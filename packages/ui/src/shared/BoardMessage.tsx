"use client";

import { useEffect, useRef } from "react";

type BoardMessageProps = {
    message: string;
    variant: "toast" | "inline";
    onDismiss?: () => void;
};

export default function BoardMessage({ message, variant, onDismiss }: BoardMessageProps) {
    const onDismissRef = useRef(onDismiss);

    useEffect(() => {
        onDismissRef.current = onDismiss;
    }, [onDismiss]);

    useEffect(() => {
        if (!message) {
            return;
        }

        const timer = window.setTimeout(() => {
            onDismissRef.current?.();
        }, 3500);

        return () => window.clearTimeout(timer);
    }, [message]);

    if (!message) {
        return null;
    }

    if (variant === "toast") {
        return (
            <div
                className="fixed left-1/2 top-20 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-rose-600 shadow-md"
                style={{ zIndex: 60 }}
            >
                {message}
            </div>
        );
    }

    return <p className="text-xs leading-5 text-rose-600">{message}</p>;
}
