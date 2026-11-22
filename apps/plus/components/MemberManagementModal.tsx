"use client";

import { ArrowDown, ArrowUp, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import PressableButton from "@meldrift/ui/PressableButton";
import MemberAccessFields, { memberFieldClass } from "./MemberAccessFields";

type Member = {
    id: number;
    email: string;
    isApproved: boolean;
    role: "user" | "admin";
    createdAt: string;
};
type SortColumn = "email" | "isApproved" | "role" | "createdAt";
type View = { kind: "list" } | { kind: "register" } | { kind: "edit"; member: Member }
    | { kind: "confirm"; step: 1 | 2; members: Member[] };

const columns: { field: SortColumn; label: string }[] = [
    { field: "email", label: "Email" },
    { field: "isApproved", label: "Board authoring" },
    { field: "role", label: "Role" },
    { field: "createdAt", label: "Registered" },
];
const actionClass = "min-h-9 rounded-md px-2.5 text-xs font-semibold sm:min-h-8";
const primaryClass = `${actionClass} bg-sky-600 text-white`;
const dangerClass = `${actionClass} bg-red-600 text-white disabled:opacity-50`;

async function requestMembers(signal?: AbortSignal) {
    const response = await fetch("/api/members", { signal, cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
        throw new Error(data?.message ?? "Members could not be loaded.");
    }
    return data.members as Member[];
}

export default function MemberManagementModal({ currentEmail, onClose }: { currentEmail: string; onClose: () => void }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [emailQuery, setEmailQuery] = useState("");
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [selectedSort, setSort] = useState<{ field: SortColumn; descending: boolean } | null>(null);
    const sort = selectedSort ?? { field: "createdAt", descending: true };
    const [view, setView] = useState<View>({ kind: "list" });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        dialog.current?.showModal();
        const controller = new AbortController();
        void requestMembers(controller.signal).then(setMembers, (error: unknown) => {
            if (!controller.signal.aborted) {
                setMessage(error instanceof Error ? error.message : "Members could not be loaded.");
            }
        }).finally(() => {
            if (!controller.signal.aborted) {
                setLoading(false);
            }
        });
        return () => controller.abort();
    }, []);

    const sortedMembers = [...members].sort((left, right) => {
        const a = left[sort.field];
        const b = right[sort.field];
        const comparison = typeof a === "boolean" ? Number(a) - Number(b) : String(a).localeCompare(String(b));
        return comparison * (sort.descending ? -1 : 1) || left.id - right.id;
    });
    const searchTerm = emailQuery.trim().toLowerCase();
    const visibleMembers = sortedMembers.filter(({ email }) => email.toLowerCase().includes(searchTerm));

    const showList = () => {
        setMessage("");
        setView({ kind: "list" });
    };

    const save = async (method: "POST" | "PATCH" | "DELETE", body: object) => {
        setSaving(true);
        setMessage("");
        try {
            const response = await fetch("/api/members", {
                method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
            });
            const data = await response.json().catch(() => null);
            if (!response.ok || !data?.ok) {
                throw new Error(data?.message ?? "The change could not be saved.");
            }
            showList();
            setSelected(new Set());
            setMembers(await requestMembers());
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "The change could not be saved.");
        } finally {
            setSaving(false);
        }
    };

    const submitMember = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const permissions = { isApproved: form.has("isApproved"), role: form.get("role") };
        if (view.kind === "register") {
            void save("POST", { ...permissions, email: form.get("email"), password: form.get("password") });
        } else if (view.kind === "edit") {
            void save("PATCH", { ...permissions, id: view.member.id });
        }
    };

    return createPortal(
        <dialog ref={dialog} aria-labelledby="manage-members-heading"
            className={`m-auto max-h-[85dvh] rounded-xl bg-white text-neutral-900 shadow-xl backdrop:bg-black/50 ${view.kind === "list"
                ? "w-[min(50rem,calc(100%-2rem))] p-5" : "w-[min(24rem,calc(100%-2rem))] p-4"}`}
            onCancel={(event) => {
                event.preventDefault();
                if (!saving) {
                    onClose();
                }
            }}>
            <div className="mb-3 flex items-center justify-between">
                <h2 id="manage-members-heading" className="text-lg font-bold">
                    {view.kind === "register" ? "Register member" : view.kind === "edit" ? "Edit member"
                        : view.kind === "confirm" ? "Delete members" : "Manage members"}
                </h2>
                <PressableButton aria-label="Close member management" className="grid size-8 place-items-center rounded-md" disabled={saving}
                    onClick={onClose}><X size={16} /></PressableButton>
            </div>
            {message && <p className="mb-3 text-sm font-semibold text-red-700" role="alert">{message}</p>}

            {view.kind === "list" && <>
                <input type="search" aria-label="Search by email" placeholder="Search by email" value={emailQuery}
                    className="mb-3 block w-full max-w-64 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
                    onChange={(event) => setEmailQuery(event.target.value)} />
                {loading ? <p role="status">Loading members…</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-130 border-collapse text-left text-sm">
                            <thead>
                                <tr>
                                    <th scope="col" className="p-2"><span className="sr-only">Select</span></th>
                                    {columns.map(({ field, label }) => (
                                        <th key={field} scope="col" className="p-2"
                                            aria-sort={sort.field !== field ? undefined : sort.descending ? "descending" : "ascending"}>
                                            <button type="button" className="inline-flex items-center gap-1 font-semibold"
                                                onClick={() => setSort((previous) => ({
                                                    field, descending: previous?.field !== field || !previous.descending,
                                                }))}>
                                                {label}
                                                {sort.field === field && (sort.descending
                                                    ? <ArrowDown size={14} aria-hidden="true" /> : <ArrowUp size={14} aria-hidden="true" />)}
                                            </button>
                                        </th>
                                    ))}
                                    <th scope="col" className="p-2">Edit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleMembers.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-2 py-4 text-neutral-600">
                                            {searchTerm ? "No members match this email." : "No members found."}
                                        </td>
                                    </tr>
                                )}
                                {visibleMembers.map((member) => (
                                    <tr key={member.id} className="border-t border-neutral-200">
                                        <td className="p-2">
                                            <input type="checkbox" disabled={member.email === currentEmail || saving}
                                                aria-label={`Select ${member.email}`} checked={selected.has(member.id)}
                                                onChange={(event) => {
                                                    const checked = event.target.checked;
                                                    setSelected((previous) => {
                                                        const next = new Set(previous);
                                                        if (checked) {
                                                            next.add(member.id);
                                                        }
                                                        else {
                                                            next.delete(member.id);
                                                        }
                                                        return next;
                                                    });
                                                }} />
                                        </td>
                                        <td className="break-all p-2">{member.email}</td>
                                        <td className="p-2">{member.isApproved ? "Yes" : "No"}</td>
                                        <td className="p-2">{member.role}</td>
                                        <td className="whitespace-nowrap p-2"><time dateTime={member.createdAt}>{new Date(member.createdAt).toLocaleDateString()}</time></td>
                                        <td className="p-2">
                                            <PressableButton className="min-h-8 rounded-md px-2 text-xs font-medium text-sky-700"
                                                disabled={saving} aria-label={`Edit ${member.email}`} onClick={() => {
                                                setMessage("");
                                                setView({ kind: "edit", member });
                                            }}>Edit</PressableButton>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <div className="mt-4 flex justify-between gap-3">
                    <PressableButton className={primaryClass} disabled={saving} onClick={() => {
                        setMessage("");
                        setView({ kind: "register" });
                    }}>Register member</PressableButton>
                    <PressableButton className={dangerClass} disabled={!selected.size || saving}
                        onClick={() => {
                            setMessage("");
                            setView({ kind: "confirm", step: 1, members: sortedMembers.filter(({ id }) => selected.has(id)) });
                        }}>Delete selected{selected.size > 0 && ` (${selected.size})`}</PressableButton>
                </div>
            </>}

            {(view.kind === "register" || view.kind === "edit") && (
                <form key={view.kind} className="space-y-3 text-sm" onSubmit={submitMember}>
                    {view.kind === "register" ? <>
                        <label className="block">Email
                            <input className={memberFieldClass} type="email" name="email" required maxLength={254} />
                        </label>
                        <label className="block">Initial password
                            <input className={memberFieldClass} type="password" name="password" autoComplete="new-password"
                                required minLength={10} maxLength={256} aria-describedby="initial-password-help" />
                        </label>
                        <p id="initial-password-help" className="text-neutral-600">Use at least 10 characters, including a letter and a number.</p>
                    </> : <p>{view.member.email}</p>}
                    <MemberAccessFields
                        isApproved={view.kind === "edit" && view.member.isApproved}
                        role={view.kind === "edit" ? view.member.role : "user"}
                        lockAdminRole={view.kind === "edit" && view.member.email === currentEmail}
                    />
                    <div className="flex justify-end gap-2">
                        <PressableButton type="button" className={actionClass} disabled={saving} onClick={showList}>Cancel</PressableButton>
                        <PressableButton type="submit" disabled={saving} className={primaryClass}>{saving ? "Saving…" : "Save"}</PressableButton>
                    </div>
                </form>
            )}

            {view.kind === "confirm" && <div className="space-y-3 text-sm">
                {view.step === 1 ? <p>Delete {view.members.length} selected account(s)?</p> : <>
                    <p>These accounts will be permanently removed. Their boards will be kept private.</p>
                    <ul className="ml-5 max-h-48 list-disc overflow-auto break-all">
                        {view.members.map((member) => <li key={member.id}>{member.email}</li>)}
                    </ul>
                </>}
                <div className="flex justify-end gap-2">
                    <PressableButton className={actionClass} disabled={saving} onClick={showList}>Cancel</PressableButton>
                    <PressableButton className={dangerClass} disabled={saving} onClick={() => {
                        if (view.step === 1) {
                            setView({ ...view, step: 2 });
                        }
                        else {
                            void save("DELETE", { ids: view.members.map(({ id }) => id) });
                        }
                    }}>{view.step === 1 ? "Continue" : saving ? "Deleting…" : "Permanently delete"}</PressableButton>
                </div>
            </div>}
        </dialog>, document.body,
    );
}
