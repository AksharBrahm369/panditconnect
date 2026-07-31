import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user || user.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Customer login required" }, { status: 401 });
  }
  const result = await sql(
    `SELECT u.id,u.name,u.city,p.experience_years,p.languages,p.specialities,p.rating,p.rating_count,
       p.completed_jobs,p.consultation_rate_5min
     FROM pim_v2.pandit_profiles p
     JOIN pim_v2.users u ON u.id=p.user_id
     WHERE p.verification_status='APPROVED' AND p.consultation_online=true
     ORDER BY p.rating DESC,p.completed_jobs DESC,u.name`,
  );
  return NextResponse.json(
    { pandits: result.rows },
    { headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } },
  );
}
