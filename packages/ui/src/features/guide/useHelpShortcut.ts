import { useEffect } from "react";

type UseHelpShortcutOptions = {
    onOpenHelp: () => void;
};

export function useHelpShortcut({ onOpenHelp }: UseHelpShortcutOptions) {
    useEffect(() => {
        const handleHelpShortcut = (event: KeyboardEvent) => {
            const modifierPressed = event.ctrlKey || event.metaKey;
            if (!modifierPressed || !event.shiftKey || event.key.toLowerCase() !== "p") {
                return;
            }
            event.preventDefault();
            onOpenHelp();
        };

        window.addEventListener("keydown", handleHelpShortcut, true);
        return () => window.removeEventListener("keydown", handleHelpShortcut, true);
    }, [onOpenHelp]);
}
