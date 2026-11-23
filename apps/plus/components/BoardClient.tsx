"use client";

import { useEffect, useRef } from "react";
import SharedBoardClient from "@meldrift/ui/BoardClient";
import type { BoardStorage } from "@meldrift/ui/board-storage";
import type { BoardSnapshot } from "@meldrift/board-data/board-state";
import { useBoardAuth } from "@/hooks/useBoardAuth";
import { useBoardPreview } from "@/hooks/useBoardPreview";
import BoardMenu from "./BoardMenu";
import SignInModal from "./SignInModal";
import SignUpModal from "./SignUpModal";
import { canCreateBoard } from "@/lib/board-permissions";
import { plusBoardGuide } from "@/lib/board-guide";
import { useBoardLive } from "@/hooks/useBoardLive";
import type { LiveRuntime } from "@/lib/live/client/runtime";

type BoardClientProps = {
    initialSnapshot: BoardSnapshot;
    editingAllowed: boolean;
    storage: BoardStorage;
    serverSaveVersion: number;
    live?: LiveRuntime | null;
};

export default function BoardClient({
    initialSnapshot,
    editingAllowed,
    storage,
    serverSaveVersion,
    live = null,
}: BoardClientProps) {
    const collaboration = useBoardLive(live);
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const {
        signInOpen, setSignInOpen,
        signUpOpen, setSignUpOpen,
        currentUser, setCurrentUser,
        handleSignOut,
    } = useBoardAuth({
        onSignOutComplete: () => window.location.reload(),
    });
    const canEdit = canCreateBoard(currentUser) && editingAllowed;
    const { schedulePreviewUpdate } = useBoardPreview({
        boardId: initialSnapshot.board.boardId,
        boardViewportRef: viewportRef,
    });

    useEffect(() => {
        if (serverSaveVersion > 0 && canEdit) {
            schedulePreviewUpdate();
        }
    }, [serverSaveVersion, canEdit, schedulePreviewUpdate]);

    return (
        <>
            <SharedBoardClient
                initialSnapshot={initialSnapshot}
                storage={storage}
                guide={plusBoardGuide}
                canEdit={canEdit}
                canExport={Boolean(currentUser)}
                permissionMessage={currentUser
                    ? "You can view this board, but you cannot edit it."
                    : "Please sign in before editing cards."}
                viewportRef={viewportRef}
                renderMenu={(menu) => (
                    <BoardMenu
                        {...menu}
                        currentUser={currentUser}
                        setSignInOpen={setSignInOpen}
                        setSignUpOpen={setSignUpOpen}
                        onSignOut={handleSignOut}
                    />
                )}
                collaboration={collaboration}
            />
            {signInOpen && (
                <SignInModal
                    onClose={() => setSignInOpen(false)}
                    onSignIn={(user) => { setCurrentUser(user); window.location.reload(); }}
                />
            )}
            {signUpOpen && <SignUpModal onClose={() => setSignUpOpen(false)} />}
        </>
    );
}
