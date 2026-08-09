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
    risk: { outstanding_balance:number; restricted_customers:number; open_disputes:number };
    funnel: {requests:number;accepted:number;completed:number;cancelled:number;acceptance_rate:number;completion_rate:number;avg_match_minutes:number;push_success_rate:number};
  }>(
    `SELECT
      (SELECT count(*)::int FROM pim_v2.users) AS users,
      (SELECT count(*)::int FROM pim_v2.pandit_profiles WHERE verification_status IN ('PENDING','INCOMPLETE','SUBMITTED','UNDER_REVIEW','CHANGES_REQUESTED','REJECTED')) AS pending_pandits,
      (SELECT count(*)::int FROM pim_v2.pandit_profiles WHERE verification_status='APPROVED') AS approved_pandits,
      (SELECT count(*)::int FROM pim_v2.bookings) AS bookings,
      json_build_object('outstanding_balance',COALESCE((SELECT sum(amount)::int FROM pim_v2.account_ledger WHERE entry_type='CANCELLATION_FEE' AND status='OUTSTANDING'),0),'restricted_customers',(SELECT count(*)::int FROM pim_v2.customer_risk_profiles WHERE restricted_until>now() OR requires_prepayment=true),'open_disputes',(SELECT count(*)::int FROM pim_v2.support_cases WHERE status IN ('OPEN','IN_REVIEW') AND category IN ('BOOKING','NO_SHOW'))) AS risk,
      json_build_object('requests',(SELECT count(*)::int FROM pim_v2.bookings WHERE created_at>now()-interval '30 days'),'accepted',(SELECT count(*)::int FROM pim_v2.bookings WHERE created_at>now()-interval '30 days' AND accepted_at IS NOT NULL),'completed',(SELECT count(*)::int FROM pim_v2.bookings WHERE created_at>now()-interval '30 days' AND status='COMPLETED'),'cancelled',(SELECT count(*)::int FROM pim_v2.bookings WHERE created_at>now()-interval '30 days' AND status IN ('CANCELLED','DECLINED')),'acceptance_rate',COALESCE((SELECT round(100.0*count(*) FILTER(WHERE accepted_at IS NOT NULL)/NULLIF(count(*),0),1) FROM pim_v2.bookings WHERE created_at>now()-interval '30 days'),0),'completion_rate',COALESCE((SELECT round(100.0*count(*) FILTER(WHERE status='COMPLETED')/NULLIF(count(*),0),1) FROM pim_v2.bookings WHERE created_at>now()-interval '30 days'),0),'avg_match_minutes',COALESCE((SELECT round(avg(extract(epoch FROM accepted_at-created_at)/60)::numeric,1) FROM pim_v2.bookings WHERE created_at>now()-interval '30 days' AND accepted_at IS NOT NULL),0),'push_success_rate',COALESCE((SELECT round(100.0*count(*) FILTER(WHERE delivered=true)/NULLIF(count(*),0),1) FROM pim_v2.notification_deliveries WHERE created_at>now()-interval '30 days'),0)) AS funnel,
      COALESCE((
        SELECT json_agg(row_to_json(recent_rows)) FROM (
          SELECT b.id,b.status,b.amount,b.created_at,b.request_type,b.scheduled_at,s.name AS service_name,
            right(cu.phone,4) AS customer_phone,pu.name AS pandit_name
          FROM pim_v2.bookings b
          JOIN pim_v2.services s ON s.id=b.service_id
          JOIN pim_v2.users cu ON cu.id=b.customer_id
          LEFT JOIN pim_v2.users pu ON pu.id=b.pandit_id
          ORDER BY b.created_at DESC LIMIT 8
        ) recent_rows
      ),'[]'::json) AS recent`,
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
      risk: row.risk,
      funnel: row.funnel,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
