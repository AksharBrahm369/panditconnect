import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { authorizationResponse } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try { await requireAdmin(); } catch (error) {
    const response = authorizationResponse(error);
    if (response) return response;
    throw error;
  }
  const result = await sql<{
    users: number;
    pending_pandits: number;
    approved_pandits: number;
    bookings: number;
    recent: unknown[];
    approved: unknown[];
  }>(
    `SELECT
      (SELECT count(*)::int FROM pim_v2.users) AS users,
      (SELECT count(*)::int FROM pim_v2.pandit_profiles WHERE verification_status IN ('PENDING','INCOMPLETE','SUBMITTED','UNDER_REVIEW','CHANGES_REQUESTED','REJECTED')) AS pending_pandits,
      (SELECT count(*)::int FROM pim_v2.pandit_profiles WHERE verification_status='APPROVED') AS approved_pandits,
      (SELECT count(*)::int FROM pim_v2.bookings) AS bookings,
      COALESCE((
        SELECT json_agg(row_to_json(recent_rows)) FROM (
          SELECT b.id,b.status,b.amount,b.created_at,s.name AS service_name,
            right(cu.phone,4) AS customer_phone,pu.name AS pandit_name
          FROM pim_v2.bookings b
          JOIN pim_v2.services s ON s.id=b.service_id
          JOIN pim_v2.users cu ON cu.id=b.customer_id
          LEFT JOIN pim_v2.users pu ON pu.id=b.pandit_id
          ORDER BY b.created_at DESC LIMIT 8
        ) recent_rows
      ),'[]'::json) AS recent,
      COALESCE((
        SELECT json_agg(row_to_json(approved_rows)) FROM (
          SELECT u.id,u.name,u.phone,u.city,u.created_at,p.experience_years,p.languages,
            p.specialities,p.bio,p.base_charge,p.verification_status,p.is_online,p.rating,p.rating_count,
            p.completed_jobs,COALESCE(array_agg(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL),'{}') AS services
          FROM pim_v2.pandit_profiles p
          JOIN pim_v2.users u ON u.id=p.user_id
          LEFT JOIN pim_v2.pandit_services ps ON ps.pandit_id=p.user_id
          LEFT JOIN pim_v2.services s ON s.id=ps.service_id
          WHERE p.verification_status='APPROVED'
          GROUP BY u.id,u.name,u.phone,u.city,u.created_at,p.experience_years,p.languages,
            p.specialities,p.bio,p.base_charge,p.verification_status,p.is_online,p.rating,p.rating_count,p.completed_jobs
          ORDER BY p.is_online DESC,p.rating DESC,u.name
        ) approved_rows
      ),'[]'::json) AS approved`,
  );
  const row = result.rows[0];
  return NextResponse.json(
    {
      stats: {
        users: row.users,
        pendingPandits: row.pending_pandits,
        approvedPandits: row.approved_pandits,
        bookings: row.bookings,
      },
      recent: row.recent,
      approved: row.approved,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
