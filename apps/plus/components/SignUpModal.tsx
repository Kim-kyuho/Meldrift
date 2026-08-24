"use client";

import PressableButton from "@/components/PressableButton";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useState } from "react";

type SignUpModalProps = {
    onClose: () => void;
};

export default function SignUpModal({ onClose }: SignUpModalProps) {
    const [errorMessages, setErrorMessages] = useState({
        email: "",
        password: "",
    });
    const [errorFields, setErrorFields] = useState({
        email: false,
        password: false,
        confirmPassword: false,
    });

    const handleSignUp = async(email: string, password: string) => {
        const response = await fetch("/api/signup", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password,
            }),
        });

        if (!response.ok) {
            const data = await response.json();
            setErrorMessages({
                email:
                    data.message === "Email already exists"
                        ? "This email address is already registered."
                        : "This email address could not be registered.",
                password: "",
            });
            setErrorFields({
                email: true,
                password: false,
                confirmPassword: false,
            });
            return;
        }
        onClose();
    };

    const inputClassName = (hasError: boolean) =>
        `mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-sky-500 ${
            hasError ? "border-rose-300 bg-rose-50" : "border-neutral-300"
        }`;

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
                    <h2 className="text-base font-bold">Sign-up</h2>
                    <PressableButton
                        className="p-1"
                        onClick={onClose}
                        aria-label="Close sign-up modal"
                    >
                        <X className="h-4 w-4" />
                    </PressableButton>
                </div>
                <form
                    className="space-y-3"
                    onSubmit={(e) => {
                        e.preventDefault();
	                        
                        const formData = new FormData(e.currentTarget);
                        const email = String(formData.get("email"));
                        const password = String(formData.get("password"));
                        const confirmPassword = String(formData.get("confirmPassword"));
                        const emailInvalid = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
                        const passwordInvalid =
                            password.length < 10 ||
                            !/[A-Za-z]/.test(password) ||
                            !/[0-9]/.test(password);
                        const confirmPasswordInvalid = password !== confirmPassword;
                        const nextErrorMessages = {
                            email: emailInvalid ? "Please enter a valid email address." : "",
                            password:
                                passwordInvalid || confirmPasswordInvalid
                                    ? "Please use a password of at least 10 characters with both letters and numbers, and make sure both passwords match."
                                    : "",
                        };

                        setErrorFields({
                            email: emailInvalid,
                            password: passwordInvalid,
                            confirmPassword: confirmPasswordInvalid,
                        });

                        if (emailInvalid || passwordInvalid || confirmPasswordInvalid) {
                            setErrorMessages(nextErrorMessages);
                            return;
                        }

                        setErrorMessages({
                            email: "",
                            password: "",
                        });
                        handleSignUp(email, password);

                    }}
                >
	                    <label className="block text-sm font-semibold">
	                        Email
	                        <input
	                            className={inputClassName(errorFields.email)}
	                            name="email"
	                            type="email"
	                            autoComplete="email"
                            required
                        />
                    </label>
	                    <label className="block text-sm font-semibold">
	                        Password
	                        <input
	                            className={inputClassName(errorFields.password)}
	                            name="password"
	                            type="password"
	                            autoComplete="new-password"
                            required
                        />
                    </label>
	                    <label className="block text-sm font-semibold">
	                        Confirm password
	                        <input
	                            className={inputClassName(errorFields.confirmPassword)}
	                            autoComplete="new-password"
	                            name="confirmPassword"
	                            type="password"
                            required
                        />
                    </label>
		                    <p className="text-xs leading-5 text-neutral-500">
		                        Your password is stored as a hash, so even the administrator cannot see it.
		                        A one-time administrator approval is required before you can use this service.
		                    </p>
                        {(errorMessages.email || errorMessages.password) && (
                            <div className="space-y-1 text-xs leading-5 text-rose-600">
                                {errorMessages.email && <p>{errorMessages.email}</p>}
                                {errorMessages.password && <p>{errorMessages.password}</p>}
                            </div>
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
                            Sign-up
                        </PressableButton>
                    </div>
                </form>
            </div>
        </>,
        document.body
    );
}
