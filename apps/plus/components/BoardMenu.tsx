"use client";

import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import Image from "next/image";
import Link from "next/link";
import SharedBoardMenu, { type BoardMenuControls } from "@meldrift/ui/BoardMenu";
import PressableButton from "@meldrift/ui/PressableButton";
import type { CurrentUser } from "@/hooks/useBoardAuth";
import MyPageModal from "./MyPageModal";

type BoardMenuProps = BoardMenuControls & {
    currentUser: CurrentUser | null;
    setSignInOpen: Dispatch<SetStateAction<boolean>>;
    setSignUpOpen: Dispatch<SetStateAction<boolean>>;
    onSignOut: () => void;
    onManageMembers?: () => void;
};

export default function BoardMenu({
    currentUser, setSignInOpen, setSignUpOpen, onSignOut, onManageMembers, ...menu
}: BoardMenuProps) {
    const [myPageOpen, setMyPageOpen] = useState(false);
    const homeLink = useRef<HTMLAnchorElement>(null);

    return <>
        <SharedBoardMenu
            {...menu}
            title={menu.title ?? "Board List"}
            titleDivider={Boolean(menu.boardActions)}
            compact={!menu.boardActions}
            brand={
                <Link ref={homeLink} href="/" aria-label="Meldrift home"
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
                        <PressableButton variant="menu" onClick={() => { menu.setMenuOpen(false); setMyPageOpen(true); }}>
                            My Page
                        </PressableButton>
                        {currentUser.role === "admin" && onManageMembers && (
                            <PressableButton variant="menu" onClick={() => { menu.setMenuOpen(false); onManageMembers(); }}>
                                Manage Members
                            </PressableButton>
                        )}
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
        {currentUser && myPageOpen && (
            <MyPageModal
                user={currentUser}
                onClose={() => setMyPageOpen(false)}
                onWithdrawn={() => window.location.replace(homeLink.current?.href ?? "/")}
            />
        )}
    </>;
}
