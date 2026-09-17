"use client";

import { useEffect, useRef } from "react";
import SharedBoardClient, { type BoardControls } from "@meldrift/board/BoardClient";
import type { BoardSnapshot } from "@meldrift/board/board-state";
import { useBoardAuth } from "@/hooks/useBoardAuth";
import { useBoardPreview } from "@/hooks/useBoardPreview";
import BoardMenu from "./BoardMenu";
import SignInModal from "./SignInModal";
import SignUpModal from "./SignUpModal";

type BoardClientProps = {
    initialSnapshot: BoardSnapshot;
    editingAllowed: boolean;
    onSnapshotChange: (snapshot: BoardSnapshot) => void;
    serverSaveVersion: number;
};

function SnapshotPersistence({ snapshot, savePaused, canEdit, onSnapshotChange }: {
    snapshot: BoardSnapshot;
    savePaused: boolean;
    canEdit: boolean;
    onSnapshotChange: (snapshot: BoardSnapshot) => void;
}) {
    const lastSavedRef = useRef(snapshot);

    useEffect(() => {
        if (!canEdit || savePaused || snapshot === lastSavedRef.current) return;
        lastSavedRef.current = snapshot;
        onSnapshotChange(snapshot);
    }, [snapshot, canEdit, savePaused, onSnapshotChange]);

    return null;
}

export default function BoardClient({
    initialSnapshot,
    editingAllowed,
    onSnapshotChange,
    serverSaveVersion,
}: BoardClientProps) {
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const {
        signInOpen, setSignInOpen,
        signUpOpen, setSignUpOpen,
        currentUser, setCurrentUser,
        canEditCard,
        handleSignOut,
    } = useBoardAuth({
        onSignOutComplete: () => window.location.reload(),
    });
    const canEdit = canEditCard && editingAllowed;
    const { schedulePreviewUpdate } = useBoardPreview({
        boardId: initialSnapshot.board.boardId,
        boardViewportRef: viewportRef,
    });

    useEffect(() => {
        if (serverSaveVersion > 0 && canEdit) schedulePreviewUpdate();
    }, [serverSaveVersion, canEdit, schedulePreviewUpdate]);

    const renderControls = (controls: BoardControls) => (
        <>
            <SnapshotPersistence
                snapshot={controls.snapshot}
                savePaused={controls.savePaused}
                canEdit={canEdit}
                onSnapshotChange={onSnapshotChange}
            />
            <BoardMenu
                menuOpen={controls.menuOpen}
                currentBoard={controls.snapshot.board}
                setMenuOpen={controls.setMenuOpen}
                setSignInOpen={setSignInOpen}
                setSignUpOpen={setSignUpOpen}
                onSignOut={handleSignOut}
                currentUser={currentUser}
                onCompileMarkdown={controls.onCompileMarkdown}
                reorderOpen={controls.reorderOpen}
                onReorder={controls.onReorder}
                onAbout={controls.onAbout}
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

    return (
        <SharedBoardClient
            initialSnapshot={initialSnapshot}
            canEdit={canEdit}
            permissionMessage={currentUser
                ? "Your account is waiting for administrator approval."
                : "Please sign in before editing cards."}
            viewportRef={viewportRef}
            renderControls={renderControls}
        />
    );
}
