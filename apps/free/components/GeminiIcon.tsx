// lucide-react에는 Gemini 아이콘이 없어 별 모양 심볼을 인라인 SVG로 둔다.
export default function GeminiIcon({
    className,
    style,
}: {
    className?: string;
    style?: React.CSSProperties;
}) {
    return (
        <svg
            className={className}
            style={style}
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
        >
            <path d="M12 0c0 6.627 5.373 12 12 12-6.627 0-12 5.373-12 12 0-6.627-5.373-12-12-12C6.627 12 12 6.627 12 0Z" />
        </svg>
    );
}
