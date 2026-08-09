import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user || user.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Customer login required" }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const limit = Math.min(12, Math.max(4, Number.parseInt(params.get("limit") ?? "6", 10) || 6));
  const offset = (page - 1) * limit;
  const result = await sql(
    `SELECT u.id,u.name,u.city,p.experience_years,p.languages,p.specialities,p.rating,p.rating_count,
       p.completed_jobs,p.consultation_rate_5min,count(*) OVER()::int AS total_count
     FROM pim_v2.pandit_profiles p
     JOIN pim_v2.users u ON u.id=p.user_id
     WHERE p.verification_status='APPROVED' AND p.consultation_online=true
     ORDER BY p.rating DESC,p.completed_jobs DESC,u.name
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  const total = Number(result.rows[0]?.total_count ?? 0);
  return NextResponse.json(
    { pandits: result.rows, page, limit, total, hasMore: offset + result.rows.length < total },
    { headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } },
  );
}
