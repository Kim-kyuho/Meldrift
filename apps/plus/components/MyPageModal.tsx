"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PressableButton from "@meldrift/ui/PressableButton";
import type { CurrentUser } from "@/hooks/useBoardAuth";
import MemberAccessFields, { memberFieldClass } from "./MemberAccessFields";

type Props = {
    user: CurrentUser;
    onClose: () => void;
    onWithdrawn: () => void;
};

const actionClass = "min-h-9 rounded-md px-2.5 text-xs font-semibold sm:min-h-8";

export default function MyPageModal({ user, onClose, onWithdrawn }: Props) {
    const dialog = useRef<HTMLDialogElement>(null);
    const [confirming, setConfirming] = useState(false);
    const [withdrawing, setWithdrawing] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        dialog.current?.showModal();
    }, []);

    useEffect(() => {
        if (confirming) {
            dialog.current?.querySelector("button")?.focus();
        }
    }, [confirming]);

    const cancel = () => {
        if (confirming) {
            setConfirming(false);
            setMessage("");
        } else {
            onClose();
        }
    };

    const withdraw = async () => {
        setWithdrawing(true);
        setMessage("");
        try {
            const response = await fetch("/api/me", { method: "DELETE" });
            const data = await response.json().catch(() => null);
            if (!response.ok || !data?.ok) {
                throw new Error(data?.message ?? "Your account could not be deleted.");
            }
            onWithdrawn();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Your account could not be deleted.");
            setWithdrawing(false);
        }
    };

    return createPortal(
        <dialog ref={dialog} aria-labelledby="my-page-heading"
            className="m-auto max-h-[85dvh] w-[min(24rem,calc(100%-2rem))] rounded-xl bg-white p-4 text-neutral-900 shadow-xl backdrop:bg-black/50"
            onCancel={(event) => {
                event.preventDefault();
                if (!withdrawing) {
                    cancel();
                }
            }}>
            <h2 id="my-page-heading" className="mb-3 text-base font-bold">
                {confirming ? "Delete your account?" : "My Page"}
            </h2>
            {message && <p className="mb-3 text-sm font-semibold text-red-700" role="alert">{message}</p>}
            {confirming ? (
                <p className="text-sm">Your account will be permanently deleted. Your boards will be kept private.</p>
            ) : (
                <div className="space-y-3 text-sm">
                    <label className="block">Email
                        <input type="email" className={memberFieldClass} value={user.email} readOnly />
                    </label>
                    <MemberAccessFields isApproved={user.isApproved} role={user.role} readOnly />
                </div>
            )}
            <div className="mt-3 flex justify-end gap-2">
                <PressableButton className={actionClass} disabled={withdrawing} onClick={cancel}>Cancel</PressableButton>
                <PressableButton disabled={withdrawing} className={`${actionClass} bg-red-600 text-white disabled:opacity-50`}
                    onClick={() => {
                        if (confirming) {
                            void withdraw();
                        } else {
                            setConfirming(true);
                        }
                    }}>
                    {withdrawing ? "Deleting…" : confirming ? "Permanently delete" : "Delete account"}
                </PressableButton>
            </div>
        </dialog>, document.body,
    );
}
