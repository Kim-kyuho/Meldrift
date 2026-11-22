import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MemberManagementModal from "@/components/MemberManagementModal";

const admin = { id: 1, email: "admin@example.com", isApproved: true, role: "admin", createdAt: "2026-11-01T00:00:00Z" };
const member = { id: 2, email: "owner@example.com", isApproved: true, role: "user", createdAt: "2026-11-22T00:00:00Z" };

describe("Manage members dialog", () => {
    const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
    beforeEach(() => {
        Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
            configurable: true,
            value(this: HTMLDialogElement) { this.open = true; },
        });
    });

    afterEach(() => {
        if (originalShowModal) {
            Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShowModal);
        }
        else {
            Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
        }
        vi.unstubAllGlobals();
    });

    it("only deletes after both confirmations and does not let the admin select their own account", async () => {
        const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, members: [admin, member] }) });
        vi.stubGlobal("fetch", fetch);
        render(<MemberManagementModal currentEmail={admin.email} onClose={vi.fn()} />);
        expect(await screen.findByRole("checkbox", { name: `Select ${admin.email}` })).toBeDisabled();

        fireEvent.click(screen.getByRole("checkbox", { name: `Select ${member.email}` }));
        fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));
        expect(screen.getByText("Delete 1 selected account(s)?")).toBeVisible();
        expect(fetch).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", { name: "Continue" }));
        expect(screen.getByText(/Their boards will be kept private/)).toBeVisible();
        expect(fetch).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", { name: "Permanently delete" }));
        await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/members", expect.objectContaining({
            method: "DELETE", body: JSON.stringify({ ids: [member.id] }),
        })));
        expect(await screen.findByRole("heading", { name: "Manage members" })).toBeVisible();
    });

    it("starts the first registration-header click in descending order", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true, json: async () => ({ ok: true, members: [admin, member] }),
        }));
        render(<MemberManagementModal currentEmail={admin.email} onClose={vi.fn()} />);
        const registered = await screen.findByRole("button", { name: "Registered" });
        fireEvent.click(registered);
        expect(registered.closest("th")).toHaveAttribute("aria-sort", "descending");
        fireEvent.click(registered);
        expect(registered.closest("th")).toHaveAttribute("aria-sort", "ascending");
    });
});
