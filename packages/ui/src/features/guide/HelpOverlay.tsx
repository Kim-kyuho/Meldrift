"use client";

import { useCallback, useState } from "react";
import type { BoardGuide } from "./board-guide";
import HelpCanvasMenu from "./HelpCanvasMenu";
import HelpModal from "./HelpModal";
import { useHelpShortcut } from "./useHelpShortcut";

type HelpOverlayProps = {
    guide: BoardGuide;
    autoOpen: boolean;
    launcherAllowed: boolean;
    closeOverlays: () => void;
    onStartTutorial: () => void;
};

export default function HelpOverlay({
    guide,
    autoOpen,
    launcherAllowed,
    closeOverlays,
    onStartTutorial,
}: HelpOverlayProps) {
    const [helpOpen, setHelpOpen] = useState(autoOpen);
    const [launcherOpen, setLauncherOpen] = useState(false);
    const openHelp = useCallback(() => {
        closeOverlays();
        setLauncherOpen(false);
        setHelpOpen(true);
    }, [closeOverlays]);
    useHelpShortcut({ onOpenHelp: openHelp });

    return (
        <>
            {helpOpen && (
                <HelpModal
                    guide={guide}
                    onClose={() => {
                        setHelpOpen(false);
                        setLauncherOpen(true);
                    }}
                />
            )}
            {launcherOpen && !helpOpen && launcherAllowed && (
                <HelpCanvasMenu
                    onStartTutorial={() => {
                        setLauncherOpen(false);
                        closeOverlays();
                        onStartTutorial();
                    }}
                    onOpenHelp={openHelp}
                    onClose={() => setLauncherOpen(false)}
                />
            )}
        </>
    );
}
