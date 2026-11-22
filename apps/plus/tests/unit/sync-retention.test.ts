import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cron/sync-mutations/route";

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: () => ({ execute: mocks.execute }) }));

const call = (authorization?: string) => GET(new NextRequest("http://localhost/plus/api/cron/sync-mutations", {
    headers: authorization ? { authorization } : {},
}));

describe("변경 로그 보관 정리 Cron", () => {
    beforeEach(() => {
        mocks.execute.mockResolvedValue({ rowCount: 3, rows: [] });
        vi.stubEnv("CRON_SECRET", "cron-secret");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("CRON_SECRET 없이는 실행하지 않는다", async () => {
        vi.stubEnv("CRON_SECRET", "");
        expect((await call("Bearer cron-secret")).status).toBe(503);
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it("비밀값이 다르면 거절한다", async () => {
        expect((await call("Bearer wrong")).status).toBe(401);
        expect((await call()).status).toBe(401);
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it("7일 지난 변경 로그를 지운다", async () => {
        const response = await call("Bearer cron-secret");

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ ok: true, deleted: 3 });
        const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[0][0] as SQL);
        expect(query.sql).toContain("DELETE FROM sync_mutations");
        expect(query.sql).toContain("make_interval(days =>");
        expect(query.params).toEqual([7]);
    });
});
