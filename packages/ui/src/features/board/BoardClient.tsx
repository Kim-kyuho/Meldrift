"use client";

import { useEffect, useMemo, useState } from "react";
import type { BoardSnapshot } from "@meldrift/board-data/board-state";
import BoardWorkspace, { type BoardWorkspaceProps } from "./BoardWorkspace";
import { isNewBoardEntry, recordBoardEntry, type BoardGuide } from "../guide/board-guide";
import { createTutorialSandboxSnapshot, type TutorialStepId } from "../guide/tutorial";

type BoardClientProps = Omit<BoardWorkspaceProps, "help" | "tutorial"> & {
    guide?: BoardGuide;
};

type ResumePoint = {
    from: BoardSnapshot;
    snapshot: BoardSnapshot;
};

// 일반 보드와 튜토리얼 샌드박스를 함께 마운트하지 않는다. 전역 단축키와 포털이 겹치기 때문이다.
export default function BoardClient({ guide, ...workspace }: BoardClientProps) {
    const { initialSnapshot, storage, renderMenu } = workspace;
    const boardId = initialSnapshot.board.boardId;
    const [helpAutoOpen] = useState(() => guide !== undefined && isNewBoardEntry(guide, initialSnapshot));
    const [tutorialStep, setTutorialStep] = useState<TutorialStepId | null>(null);
    const [tutorialSnapshot] = useState(createTutorialSandboxSnapshot);
    const [resumePoint, setResumePoint] = useState<ResumePoint | null>(null);

    useEffect(() => {
        if (guide) {
            recordBoardEntry(guide, boardId);
        }
    }, [guide, boardId]);

    // 튜토리얼에서 돌아오면 시작 직전 화면으로 다시 마운트한다. 그 화면이 아직 저장되지 않았을 수 있으므로 첫 저장을 건너뛰지 않는다.
    const resumeStorage = useMemo(() => storage && { ...storage, skipInitialSave: false }, [storage]);

    if (guide && tutorialStep !== null) {
        return (
            <BoardWorkspace
                key="tutorial"
                initialSnapshot={tutorialSnapshot}
                renderMenu={renderMenu}
                tutorial={{
                    guide,
                    step: tutorialStep,
                    onStepChange: setTutorialStep,
                    onExit: () => setTutorialStep(null),
                }}
            />
        );
    }

    const resumed = resumePoint !== null && resumePoint.from === initialSnapshot;

    return (
        <BoardWorkspace
            key="board"
            {...workspace}
            initialSnapshot={resumed ? resumePoint.snapshot : initialSnapshot}
            storage={resumed ? resumeStorage : storage}
            help={guide && {
                guide,
                autoOpen: helpAutoOpen && resumePoint === null,
                onStartTutorial: (currentSnapshot) => {
                    setResumePoint({ from: initialSnapshot, snapshot: currentSnapshot });
                    setTutorialStep(1);
                },
            }}
        />
    );
}
