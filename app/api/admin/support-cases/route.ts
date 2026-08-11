import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { authorizationResponse } from "@/lib/api-auth";
import { sql } from "@/lib/db";
import { recordAdminAction } from "@/lib/admin-audit";
import { notifyUser } from "@/lib/push-notifications";

export const dynamic = "force-dynamic";
async function adminOrResponse() { try { return { admin: await requireAdmin() }; } catch (error) { return { response: authorizationResponse(error) ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }; } }

export async function GET() {
  const auth = await adminOrResponse(); if (auth.response) return auth.response;
  const result = await sql(`SELECT c.id,c.reporter_id,c.category,c.subject,c.description,c.priority,c.status,c.resolution,c.booking_id,c.created_at,u.name AS reporter_name,u.role AS reporter_role,right(u.phone,4) AS reporter_phone,b.customer_id,b.cancellation_fee,b.cancellation_fee_status FROM pim_v2.support_cases c JOIN pim_v2.users u ON u.id=c.reporter_id LEFT JOIN pim_v2.bookings b ON b.id=c.booking_id ORDER BY CASE c.status WHEN 'OPEN' THEN 0 WHEN 'IN_REVIEW' THEN 1 ELSE 2 END,CASE c.priority WHEN 'URGENT' THEN 0 ELSE 1 END,c.created_at DESC LIMIT 100`);
  return NextResponse.json({ cases: result.rows }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const auth = await adminOrResponse(); if (auth.response) return auth.response;
  const body = await request.json() as { caseId?: string; status?: string; resolution?: string; waiveCancellationFee?: boolean; upholdCancellationFee?: boolean; panditId?: string; accountAction?: "BLOCK"|"UNBLOCK"|"SUSPEND"|"RESTORE" };
  if (body.caseId && ["IN_REVIEW","RESOLVED","CLOSED"].includes(body.status ?? "")) {
    const result = await sql(`UPDATE pim_v2.support_cases SET status=$2,resolution=$3,assigned_admin_id=$4,updated_at=now(),resolved_at=CASE WHEN $2 IN ('RESOLVED','CLOSED') THEN now() ELSE NULL END WHERE id=$1 RETURNING id`, [body.caseId,body.status,body.resolution?.trim().slice(0,2000)||null,auth.admin!.id]);
    if (!result.rows[0]) return NextResponse.json({ error: "Case not found" }, { status: 404 });
    if(body.waiveCancellationFee){const waived=await sql<{customer_id:string}>(`WITH selected AS (SELECT c.category,b.id,b.customer_id,b.cancellation_fee,b.cancellation_fee_status FROM pim_v2.support_cases c JOIN pim_v2.bookings b ON b.id=c.booking_id WHERE c.id=$1 AND b.cancellation_fee_status IN ('OUTSTANDING','DISPUTED')),changed AS (UPDATE pim_v2.bookings b SET cancellation_fee_status='WAIVED' FROM selected s WHERE b.id=s.id RETURNING b.id,b.customer_id),ledger AS (UPDATE pim_v2.account_ledger l SET status='WAIVED',settled_at=now(),note=COALESCE(note,'')||' - Waived by Admin' FROM changed WHERE l.booking_id=changed.id AND l.entry_type IN ('CANCELLATION_FEE','PANDIT_COMPENSATION')),risk AS (UPDATE pim_v2.customer_risk_profiles r SET late_cancellations=greatest(0,r.late_cancellations-1),risk_points=greatest(0,r.risk_points-CASE WHEN s.cancellation_fee>=199 THEN 3 ELSE 2 END),requires_prepayment=greatest(0,r.late_cancellations-1)>=3,restricted_until=CASE WHEN greatest(0,r.late_cancellations-1)>=5 THEN r.restricted_until ELSE NULL END,updated_at=now() FROM selected s WHERE r.user_id=s.customer_id AND s.cancellation_fee_status='OUTSTANDING') SELECT customer_id FROM changed`,[body.caseId]);if(waived.rows[0])await notifyUser(waived.rows[0].customer_id,{title:"Cancellation charge waived",body:"Admin reviewed your case and removed the cancellation balance and related risk marker.",url:"/customer#support",eventType:"CANCELLATION_FEE_WAIVED"});}
    if(body.upholdCancellationFee){const upheld=await sql<{customer_id:string}>(`WITH selected AS (SELECT c.category,b.id AS booking_id,b.customer_id FROM pim_v2.support_cases c JOIN pim_v2.bookings b ON b.id=c.booking_id WHERE c.id=$1 AND b.cancellation_fee_status='DISPUTED'),changed AS (UPDATE pim_v2.bookings b SET cancellation_fee_status='OUTSTANDING' FROM selected s WHERE b.id=s.booking_id RETURNING b.id,b.customer_id),ledger AS (UPDATE pim_v2.account_ledger l SET status=CASE WHEN l.entry_type='CANCELLATION_FEE' THEN 'OUTSTANDING' ELSE l.status END,note=COALESCE(note,'')||' - Upheld by Admin' FROM changed WHERE l.booking_id=changed.id),risk AS (INSERT INTO pim_v2.customer_risk_profiles(user_id,no_shows,risk_points) SELECT customer_id,1,3 FROM selected WHERE category='NO_SHOW' ON CONFLICT(user_id) DO UPDATE SET no_shows=pim_v2.customer_risk_profiles.no_shows+1,risk_points=pim_v2.customer_risk_profiles.risk_points+3,updated_at=now()) SELECT customer_id FROM changed`,[body.caseId]);if(upheld.rows[0])await notifyUser(upheld.rows[0].customer_id,{title:"Cancellation review completed",body:"Admin upheld the cancellation charge after reviewing the report. Contact support if you have new evidence.",url:"/customer#support",eventType:"CANCELLATION_FEE_UPHELD"});}
    await recordAdminAction(request,auth.admin!.id,"SUPPORT_CASE_UPDATED","SUPPORT_CASE",body.caseId,{ status: body.status,waivedCancellationFee:Boolean(body.waiveCancellationFee),upheldCancellationFee:Boolean(body.upholdCancellationFee) });
    return NextResponse.json({ success: true });
  }
  if (body.panditId && body.accountAction) {
    if (!["BLOCK","UNBLOCK","SUSPEND","RESTORE"].includes(body.accountAction)) return NextResponse.json({ error: "Invalid Pandit access action" }, { status: 400 });
    const isBlocking = ["BLOCK","SUSPEND"].includes(body.accountAction);
    const status = isBlocking ? "SUSPENDED" : "ACTIVE";
    const result = await sql(`WITH changed AS (
      UPDATE pim_v2.users SET account_status=$2 WHERE id=$1 AND role='PANDIT' RETURNING id
    ), ended_sessions AS (
      DELETE FROM pim_v2.sessions WHERE user_id IN (SELECT id FROM changed) AND $2='SUSPENDED'
    ), withdrawn_offers AS (
      UPDATE pim_v2.booking_offers SET status='WITHDRAWN',responded_at=now()
      WHERE pandit_id IN (SELECT id FROM changed) AND status='OFFERED' AND $2='SUSPENDED'
    )
    UPDATE pim_v2.pandit_profiles
    SET is_online=false,consultation_online=false,updated_at=now()
    WHERE user_id IN (SELECT id FROM changed)
    RETURNING user_id`, [body.panditId,status]);
    if (!result.rows[0]) return NextResponse.json({ error: "Pandit not found" }, { status: 404 });
    await recordAdminAction(request,auth.admin!.id,isBlocking?"PANDIT_BLOCKED":"PANDIT_UNBLOCKED","PANDIT",body.panditId,{ accountStatus:status });
    await notifyUser(body.panditId, {
      title: isBlocking ? "Pandit account blocked" : "Pandit account restored",
      body: isBlocking ? "An administrator has blocked your Pandit account. You cannot sign in or receive new requests until an administrator unblocks it." : "An administrator has restored your Pandit account. Sign in and switch availability on when you are ready to receive requests.",
      url: isBlocking ? "/" : "/pandit",
      eventType: isBlocking ? "PANDIT_BLOCKED" : "PANDIT_UNBLOCKED",
    });
    return NextResponse.json({ success: true, accountStatus: status });
  }
  return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
}
