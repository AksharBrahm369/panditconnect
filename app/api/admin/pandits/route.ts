import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { authorizationResponse } from "@/lib/api-auth";
import { recordAdminAction } from "@/lib/admin-audit";

type ReviewAction = "APPROVE" | "REQUEST_CHANGES";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const approvedOnly = new URL(request.url).searchParams.get("scope") === "approved";
    if (approvedOnly) {
      const approved = await sql(
        `SELECT u.id,u.name,u.phone,u.city,u.created_at,p.experience_years,p.languages,
          p.specialities,p.bio,p.base_charge,p.verification_status,p.review_note,
          p.is_online,p.rating,p.rating_count,p.completed_jobs,
          COALESCE(array_agg(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL),'{}') AS services
         FROM pim_v2.pandit_profiles p
         JOIN pim_v2.users u ON u.id=p.user_id
         LEFT JOIN pim_v2.pandit_services ps ON ps.pandit_id=p.user_id
         LEFT JOIN pim_v2.services s ON s.id=ps.service_id
         WHERE p.verification_status='APPROVED'
         GROUP BY u.id,u.name,u.phone,u.city,u.created_at,p.experience_years,p.languages,
          p.specialities,p.bio,p.base_charge,p.verification_status,p.review_note,
          p.is_online,p.rating,p.rating_count,p.completed_jobs
         ORDER BY p.is_online DESC,p.rating DESC,u.name`,
      );
      return NextResponse.json(
        { pandits: approved.rows },
        { headers: { "Cache-Control": "no-store, max-age=0" } },
      );
    }
    const result = await sql<{
      id: string; name: string | null; phone: string; city: string | null;
      experience_years: number; languages: string[]; specialities: string[];
      bio: string | null; base_charge: number; verification_status: string;
      review_note: string | null; created_at: string;
    }>(
      `SELECT u.id,u.name,u.phone,u.city,u.created_at,p.experience_years,p.languages,
        p.specialities,p.bio,p.base_charge,p.verification_status,p.review_note
       FROM pim_v2.pandit_profiles p
       JOIN pim_v2.users u ON u.id=p.user_id
       WHERE p.verification_status IN ('PENDING','INCOMPLETE','CHANGES_REQUESTED')
       ORDER BY CASE p.verification_status WHEN 'PENDING' THEN 0 ELSE 1 END,u.created_at`,
    );
    return NextResponse.json(
      { pandits: result.rows },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    const authResponse = authorizationResponse(error);
    if (authResponse) return authResponse;
    console.error("Unable to load Pandit review queue", error);
    return NextResponse.json({ error: "Unable to load the review queue" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json() as { panditId?: string; action?: ReviewAction; note?: string };
    if (!body.panditId || !["APPROVE", "REQUEST_CHANGES"].includes(body.action ?? "")) {
      return NextResponse.json({ error: "Choose a valid review action" }, { status: 400 });
    }
    if (body.action === "REQUEST_CHANGES" && !body.note?.trim()) {
      return NextResponse.json({ error: "Explain what the Pandit should update" }, { status: 400 });
    }

    if (body.action === "APPROVE") {
      await sql(
        `UPDATE pim_v2.pandit_profiles SET verification_status='APPROVED',review_note=NULL,
          latitude=COALESCE(latitude,19.082),longitude=COALESCE(longitude,72.910),updated_at=now()
         WHERE user_id=$1`,
        [body.panditId],
      );
      await sql(
        `INSERT INTO pim_v2.pandit_services(pandit_id,service_id,charge)
         SELECT $1,id,GREATEST(base_price,(SELECT base_charge FROM pim_v2.pandit_profiles WHERE user_id=$1))
         FROM pim_v2.services WHERE active=true
         ON CONFLICT(pandit_id,service_id) DO UPDATE SET charge=EXCLUDED.charge`,
        [body.panditId],
      );
      await recordAdminAction(request, admin.id, "PANDIT_APPROVED", "PANDIT_PROFILE", body.panditId);
    } else {
      await sql(
        `UPDATE pim_v2.pandit_profiles
         SET verification_status='CHANGES_REQUESTED',review_note=$2,is_online=false,updated_at=now()
         WHERE user_id=$1`,
        [body.panditId, body.note?.trim()],
      );
      await recordAdminAction(request, admin.id, "PANDIT_CHANGES_REQUESTED", "PANDIT_PROFILE", body.panditId, { noteProvided: true });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const authResponse = authorizationResponse(error);
    if (authResponse) return authResponse;
    console.error("Pandit review action failed", error);
    return NextResponse.json({ error: "Unable to save this review action" }, { status: 500 });
  }
}
