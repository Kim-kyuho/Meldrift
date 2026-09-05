import { useEffect } from "react";

type UseBoardShortcutsOptions = {
    onOpenHelp: () => void;
};

export function useBoardShortcuts({ onOpenHelp }: UseBoardShortcutsOptions) {
    useEffect(() => {
        const handleHelpShortcut = (event: KeyboardEvent) => {
            const modifierPressed = event.ctrlKey || event.metaKey;
            if (!modifierPressed || !event.shiftKey || event.key.toLowerCase() !== "h") return;
            event.preventDefault();
            onOpenHelp();
        };

        window.addEventListener("keydown", handleHelpShortcut, true);
        return () => window.removeEventListener("keydown", handleHelpShortcut, true);
    }, [onOpenHelp]);
}
