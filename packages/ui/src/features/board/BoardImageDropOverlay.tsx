export function BoardImageDropOverlay({
    isDragging,
    message = "Drop image here to add to board",
}: {
    isDragging: boolean;
    message?: string;
}) {
    if (!isDragging) return null;

    return (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-indigo-500/10 backdrop-blur-[1px] border-4 border-dashed border-indigo-500/60 m-3 rounded-2xl transition-all">
            <div className="flex items-center gap-2 rounded-xl bg-white/95 px-5 py-3 text-base font-semibold text-indigo-700 shadow-xl border border-indigo-100">
                <span>{message}</span>
            </div>
        </div>
    );
}

export default BoardImageDropOverlay;
