import { useCallback, useEffect, useState } from "react";

export type CurrentUser = {
    email: string;
    isApproved: boolean;
    role: string;
};

type UseBoardAuthOptions = {
    onSignOutComplete?: () => void;
};

export function useBoardAuth({ onSignOutComplete }: UseBoardAuthOptions = {}) {
    const [signInOpen, setSignInOpen] = useState(false);
    const [signUpOpen, setSignUpOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

    useEffect(() => {
        const loadCurrentUser = async() => {
            const response = await fetch("/api/me");
            const data = await response.json();

            setCurrentUser(data.user ?? null);
        };

        loadCurrentUser();
    }, []);
    
    const handleSignOut = useCallback(async() => {
        const response = await fetch("/api/signout", {
            method: "POST",
        });

        if (!response.ok) {
            return;
        }

        setCurrentUser(null);
        onSignOutComplete?.();
    }, [onSignOutComplete]);

    return {
        signInOpen,
        setSignInOpen,
        signUpOpen,
        setSignUpOpen,
        currentUser,
        setCurrentUser,
        canEditCard: currentUser?.isApproved === true,
        handleSignOut,
    };
}
