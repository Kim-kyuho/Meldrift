import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBoardAuth } from "@/hooks/useBoardAuth";

describe("useBoardAuth", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("loads the current user and derives card permission", async () => {
        const user = { email: "kyu@example.com", isApproved: true, role: "admin" };
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            json: vi.fn().mockResolvedValue({ user }),
        }));

        const { result } = renderHook(() => useBoardAuth());

        await waitFor(() => expect(result.current.currentUser).toEqual(user));
        expect(result.current.canEditCard).toBe(true);
    });

    it("clears the user and invokes completion after sign out", async () => {
        const onSignOutComplete = vi.fn();
        vi.stubGlobal("fetch", vi.fn()
            .mockResolvedValueOnce({ json: vi.fn().mockResolvedValue({
                user: { email: "kyu@example.com", isApproved: true, role: "admin" },
            }) })
            .mockResolvedValueOnce({ ok: true }));
        const { result } = renderHook(() => useBoardAuth({ onSignOutComplete }));
        await waitFor(() => expect(result.current.currentUser).not.toBeNull());

        await act(async () => result.current.handleSignOut());

        expect(fetch).toHaveBeenLastCalledWith("/api/signout", { method: "POST" });
        expect(result.current.currentUser).toBeNull();
        expect(onSignOutComplete).toHaveBeenCalledOnce();
    });

    it("keeps the current user when sign out fails", async () => {
        const user = { email: "kyu@example.com", isApproved: true, role: "admin" };
        const onSignOutComplete = vi.fn();
        vi.stubGlobal("fetch", vi.fn()
            .mockResolvedValueOnce({ json: vi.fn().mockResolvedValue({ user }) })
            .mockResolvedValueOnce({ ok: false }));
        const { result } = renderHook(() => useBoardAuth({ onSignOutComplete }));
        await waitFor(() => expect(result.current.currentUser).toEqual(user));

        await act(async () => result.current.handleSignOut());

        expect(result.current.currentUser).toEqual(user);
        expect(onSignOutComplete).not.toHaveBeenCalled();
    });
});
