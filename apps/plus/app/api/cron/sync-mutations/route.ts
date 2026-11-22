import { sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const maxDuration = 60;
const syncMutationRetentionDays = 7;

// Vercel Cron이 하루 한 번 부른다(vercel.json). 변경 로그는 놓친 변경 재전송과 겹침 검사용이라 7일만 남긴다.
export async function GET(request: NextRequest) {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        return NextResponse.json({ ok: false, message: "CRON_SECRET is not set." }, { status: 503 });
    }
    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
        return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
    }
    const result = await getDb().execute(sql`
        DELETE FROM sync_mutations
        WHERE created_at < now() - make_interval(days => ${syncMutationRetentionDays})`);
    const deleted = result.rowCount ?? 0;
    console.info("sync_mutations.pruned", { deleted, retentionDays: syncMutationRetentionDays });
    return NextResponse.json({ ok: true, deleted }, { headers: { "Cache-Control": "no-store" } });
}
