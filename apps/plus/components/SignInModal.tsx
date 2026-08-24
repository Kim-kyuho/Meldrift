"use client";

import PressableButton from "@/components/PressableButton";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useState } from "react";
import { CurrentUser } from "@/hooks/useBoardAuth";

type SignInModalProps = {
    onClose: () => void;
    onSignIn: (user: CurrentUser) => void;
};

export default function SignInModal({ onClose, onSignIn }: SignInModalProps) {
    const [errorMessage, setErrorMessage] = useState("");

    const handleSignIn = async(email: string, password: string) => {
        const response = await fetch("/api/signin", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email,
                password,
            }),
        });
        const data = await response.json();

        if (!data.ok) {
            setErrorMessage(data.message ?? "Sign-in failed.");
            return;
        }

        onSignIn(data.user);
        onClose();
    };

    return createPortal(
        <>
            <div
                className="fixed inset-0 bg-black/50"
                style={{ zIndex: 70 }}
                onClick={onClose}
            />
            <div
                className="fixed left-1/2 top-1/2 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 text-neutral-900 shadow-xl"
                style={{ zIndex: 80 }}
            >
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-base font-bold">Sign-in</h2>
                    <PressableButton
                        className="p-1"
                        onClick={onClose}
                        aria-label="Close sign-in modal"
                    >
                        <X className="h-4 w-4" />
                    </PressableButton>
                </div>
                <form
                    className="space-y-3"
                    onSubmit={(event) => {
                        event.preventDefault();

                        const formData = new FormData(event.currentTarget);
                        const email = String(formData.get("email"));
                        const password = String(formData.get("password"));

                        handleSignIn(email, password);
                    }}
                >
                    <label className="block text-sm font-semibold">
                        Email
                        <input
                            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                        />
                    </label>
                    <label className="block text-sm font-semibold">
                        Password
                        <input
                            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                        />
                    </label>
                    {errorMessage && (
                        <p className="text-xs leading-5 text-rose-600">
                            {errorMessage}
                        </p>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                        <PressableButton
                            className="px-3 py-2 text-sm font-semibold text-neutral-600"
                            type="button"
                            onClick={onClose}
                        >
                            Cancel
                        </PressableButton>
                        <PressableButton
                            className="bg-sky-500 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-400"
                            type="submit"
                        >
                            Sign-in
                        </PressableButton>
                    </div>
                </form>
            </div>
        </>,
        document.body
    );
}
