import { useCallback, useEffect, useState } from "react";

export type CurrentUser = {
    email: string;
    isApproved: boolean;
    role: string;
};

type UseBoardAuthOptions = {
    initialUser?: CurrentUser | null;
    onSignOutComplete?: () => void;
};

export function useBoardAuth({ initialUser, onSignOutComplete }: UseBoardAuthOptions = {}) {
    const [signInOpen, setSignInOpen] = useState(false);
    const [signUpOpen, setSignUpOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(initialUser ?? null);

    useEffect(() => {
        if (initialUser !== undefined) {
            return;
        }
        const loadCurrentUser = async() => {
            const response = await fetch("/api/me");
            const data = await response.json();

            setCurrentUser(data.user ?? null);
        };

        loadCurrentUser();
    }, [initialUser]);
    
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
