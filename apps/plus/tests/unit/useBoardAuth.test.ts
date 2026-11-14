import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBoardAuth } from "@/hooks/useBoardAuth";

describe("useBoardAuth 동작", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("현재 사용자를 불러오고 카드 권한을 계산한다", async () => {
        const user = { email: "kyu@example.com", isApproved: true, role: "admin" };
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            json: vi.fn().mockResolvedValue({ user }),
        }));

        const { result } = renderHook(() => useBoardAuth());

        await waitFor(() => expect(result.current.currentUser).toEqual(user));
        expect(result.current.canEditCard).toBe(true);
    });

    it("로그아웃 후 사용자를 비우고 완료 콜백을 호출한다", async () => {
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

    it("로그아웃 실패 시 현재 사용자를 유지한다", async () => {
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
