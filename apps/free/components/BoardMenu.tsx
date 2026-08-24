"use client";

import PressableButton from "./PressableButton";
import { Dispatch, SetStateAction } from "react";
import { Download, EllipsisIcon, FileText, FolderOpen, Info, Shredder } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type BoardMenuProps = {
    menuOpen: boolean;
    setMenuOpen: Dispatch<SetStateAction<boolean>>;
    exportDisabled: boolean;
    transferring: boolean;
    resetting: boolean;
    onExport: () => void;
    onImport: () => void;
    onCompileMarkdown: () => void;
    onReset: () => void;
    onAbout: () => void;
};

export default function BoardMenu({
    menuOpen,
    setMenuOpen,
    exportDisabled,
    transferring,
    resetting,
    onExport,
    onImport,
    onCompileMarkdown,
    onReset,
    onAbout,
}: BoardMenuProps) {
    const runAndClose = (action: () => void) => {
        setMenuOpen(false);
        action();
    };

    return (
        <>
            <div className="fixed left-5 top-5 z-50000 rounded-xl bg-white/75 px-3 py-1.5 shadow-md">
                <Link
                    href="/"
                    aria-label="Meldrift home"
                    className="flex items-center gap-1.5 transition duration-300 hover:opacity-75 active:scale-[0.98]"
                    style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
                >
                    <Image
                        src="/meldrift-mascot.png"
                        alt=""
                        width={256}
                        height={256}
                        priority
                        className="size-7 shrink-0"
                    />
                    <Image
                        src="/meldrift-wordmark.png"
                        alt="meldrift"
                        width={512}
                        height={127}
                        priority
                        className="h-auto w-21 sm:w-24"
                    />
                </Link>
            </div>
            <PressableButton
                aria-label="Open board menu"
                className="fixed right-5 top-5 z-50000 bg-white/75 px-3 py-3 shadow-md"
                onClick={() => setMenuOpen((prev) => !prev)}
            >
                <EllipsisIcon className="h-5 w-5 text-neutral-900" />
            </PressableButton>
            {menuOpen && (
                // AI 어시스턴트 버튼이 위로 올라오는 것을 방지하기 위해 z를 한 단계 올림
                <div className="fixed right-5 top-17 z-50001 w-56 rounded-xl bg-white/75 px-2 py-3 shadow-md">
                    <div className="px-3 py-2 font-bold text-neutral-900">Free Edition</div>
                    <PressableButton
                        variant="menu"
                        disabled={exportDisabled || transferring || resetting}
                        title={exportDisabled ? "Finish the current card, drawing, or assistant changes before exporting." : "Export SQLite save file"}
                        className="flex items-center gap-2 font-bold text-sky-600 disabled:cursor-not-allowed disabled:opacity-35"
                        onClick={() => runAndClose(onExport)}
                    >
                        <Download aria-hidden="true" className="h-4 w-4 shrink-0" />
                        Export
                    </PressableButton>
                    <PressableButton
                        variant="menu"
                        disabled={transferring || resetting}
                        className="flex items-center gap-2 font-bold text-indigo-600 disabled:cursor-not-allowed disabled:opacity-35"
                        onClick={() => runAndClose(onImport)}
                    >
                        <FolderOpen aria-hidden="true" className="h-4 w-4 shrink-0" />
                        Import
                    </PressableButton>
                    <PressableButton
                        variant="menu"
                        className="flex items-center gap-2 font-bold text-pink-500"
                        onClick={() => runAndClose(onCompileMarkdown)}
                    >
                        <FileText aria-hidden="true" className="h-4 w-4 shrink-0" />
                        Compile to Markdown
                    </PressableButton>
                    <PressableButton
                        variant="menu"
                        disabled={transferring || resetting}
                        title="Delete this browser's Meldrift Free Edition SQLite data"
                        className="flex items-center gap-2 font-bold text-rose-600 disabled:cursor-not-allowed disabled:opacity-35"
                        onClick={() => runAndClose(onReset)}
                    >
                        <Shredder aria-hidden="true" className="h-4 w-4 shrink-0" />
                        {resetting ? "Resetting..." : "Reset"}
                    </PressableButton>
                    {exportDisabled && (
                        <p className="px-3 pt-2 text-xs font-semibold text-neutral-500">
                            Finish editing before exporting.
                        </p>
                    )}
                    <div className="mt-2 border-t border-neutral-200 pt-2">
                        <PressableButton
                            variant="menu"
                            className="flex items-center gap-2 font-bold text-neutral-700"
                            onClick={() => runAndClose(onAbout)}
                        >
                            <Info aria-hidden="true" className="h-4 w-4 shrink-0" />
                            About
                        </PressableButton>
                    </div>
                </div>
            )}
        </>
    );
}
