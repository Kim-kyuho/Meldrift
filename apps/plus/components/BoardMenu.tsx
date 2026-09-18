"use client";

import type { Dispatch, SetStateAction } from "react";
import Image from "next/image";
import Link from "next/link";
import SharedBoardMenu, { type BoardMenuProps as SharedBoardMenuProps } from "@meldrift/ui/BoardMenu";
import PressableButton from "@meldrift/ui/PressableButton";
import type { CurrentUser } from "@/hooks/useBoardAuth";

type BoardMenuProps = {
    menuOpen: boolean;
    currentBoard?: { title: string };
    setMenuOpen: Dispatch<SetStateAction<boolean>>;
    setSignInOpen: Dispatch<SetStateAction<boolean>>;
    setSignUpOpen: Dispatch<SetStateAction<boolean>>;
    currentUser: CurrentUser | null;
    onSignOut: () => void;
    onCompileMarkdown?: () => void;
    reorderOpen?: boolean;
    onReorder?: () => void;
    onAbout: () => void;
    transfer?: Pick<SharedBoardMenuProps,
        "exportDisabled" | "transferring" | "resetting" | "mutationDisabled" |
        "onExport" | "onImport" | "onReset">;
};

const noAction = () => {};

export default function BoardMenu({
    currentBoard, currentUser, setSignInOpen, setSignUpOpen, onSignOut,
    onCompileMarkdown = noAction, onReorder = noAction, reorderOpen = false,
    transfer, ...menu
}: BoardMenuProps) {
    return (
        <SharedBoardMenu
            {...menu}
            title={currentBoard?.title}
            boardActions={Boolean(currentBoard)}
            reorderOpen={reorderOpen}
            onReorder={onReorder}
            onCompileMarkdown={onCompileMarkdown}
            exportDisabled={transfer?.exportDisabled ?? false}
            transferring={transfer?.transferring ?? false}
            resetting={transfer?.resetting ?? false}
            transferDisabled={!currentUser || !transfer}
            mutationDisabled={!currentUser?.isApproved || transfer?.mutationDisabled}
            resetTitle="Clear the contents of this board"
            onExport={transfer?.onExport ?? noAction}
            onImport={transfer?.onImport ?? noAction}
            onReset={transfer?.onReset ?? noAction}
            brand={
                <Link href="/" aria-label="Meldrift home"
                    className="flex items-center gap-1.5 transition duration-300 hover:opacity-75 active:scale-[0.98]"
                    style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}>
                    <Image src="/plus/meldrift-mascot.png" alt="" width={256} height={256} priority className="size-7 shrink-0" />
                    <Image src="/plus/meldrift-wordmark.png" alt="meldrift" width={512} height={127} priority className="h-auto w-21 sm:w-24" />
                    <span className="text-2xl font-bold leading-none text-[#8ecae6]">+</span>
                </Link>
            }
            authControls={
                <div className="mt-2 border-t border-neutral-200 pt-2">
                    {currentUser ? <>
                        <p className="px-3 py-2 text-sm font-semibold text-neutral-800 break-all">
                            [{currentUser.role}]<br />{currentUser.email}
                        </p>
                        <PressableButton variant="menu" className="font-semibold text-red-500"
                            onClick={() => { menu.setMenuOpen(false); onSignOut(); }}>
                            Sign-out
                        </PressableButton>
                    </> : <>
                        <PressableButton variant="menu" className="font-semibold text-sky-600"
                            onClick={() => { menu.setMenuOpen(false); setSignInOpen(true); }}>
                            Sign-in
                        </PressableButton>
                        <PressableButton variant="menu" className="font-semibold text-indigo-500"
                            onClick={() => { menu.setMenuOpen(false); setSignUpOpen(true); }}>
                            Sign-up
                        </PressableButton>
                    </>}
                </div>
            }
        />
    );
}
