"use client";

import { ButtonHTMLAttributes, useState } from "react";

// 커스텀 버튼 컴포넌트 - 모바일에서 터치 시 눌리는 효과를 적용
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

    // 버튼의 기본 클래스와 눌렸을 때의 클래스 설정(글로벌 CSS에서 커스틈 정의 클래스 사용)
    const baseClassName =
        variant === "menu"
            ? "ui-button-menu"
            : "ui-button";

    // 눌렸을 때의 클래스 설정 - 메뉴 버튼은 약간 덜 눌리는 효과, 일반 버튼은 더 눌리는 효과 적용
    const pressedClassName =
        variant === "menu"
            ? "scale-[0.98] bg-white/90 pl-4 shadow-md"
            : "scale-[0.96] bg-white/80 shadow-lg";
    
    // 버튼 랜더링 - onTouchStart, onTouchEnd, onTouchCancel 이벤트 핸들러를 통해 터치 시 눌리는 효과 적용
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
