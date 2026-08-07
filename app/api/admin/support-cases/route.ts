import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { authorizationResponse } from "@/lib/api-auth";
import { sql } from "@/lib/db";
import { recordAdminAction } from "@/lib/admin-audit";

export const dynamic = "force-dynamic";
async function adminOrResponse() { try { return { admin: await requireAdmin() }; } catch (error) { return { response: authorizationResponse(error) ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }; } }

export async function GET() {
  const auth = await adminOrResponse(); if (auth.response) return auth.response;
  const result = await sql(`SELECT c.id,c.category,c.subject,c.description,c.priority,c.status,c.resolution,c.booking_id,c.created_at,u.name AS reporter_name,u.role AS reporter_role,right(u.phone,4) AS reporter_phone FROM pim_v2.support_cases c JOIN pim_v2.users u ON u.id=c.reporter_id ORDER BY CASE c.status WHEN 'OPEN' THEN 0 WHEN 'IN_REVIEW' THEN 1 ELSE 2 END,CASE c.priority WHEN 'URGENT' THEN 0 ELSE 1 END,c.created_at DESC LIMIT 100`);
  return NextResponse.json({ cases: result.rows }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const auth = await adminOrResponse(); if (auth.response) return auth.response;
  const body = await request.json() as { caseId?: string; status?: string; resolution?: string; panditId?: string; accountAction?: "SUSPEND"|"RESTORE" };
  if (body.caseId && ["IN_REVIEW","RESOLVED","CLOSED"].includes(body.status ?? "")) {
    const result = await sql(`UPDATE pim_v2.support_cases SET status=$2,resolution=$3,assigned_admin_id=$4,updated_at=now(),resolved_at=CASE WHEN $2 IN ('RESOLVED','CLOSED') THEN now() ELSE NULL END WHERE id=$1 RETURNING id`, [body.caseId,body.status,body.resolution?.trim().slice(0,2000)||null,auth.admin!.id]);
    if (!result.rows[0]) return NextResponse.json({ error: "Case not found" }, { status: 404 });
    await recordAdminAction(request,auth.admin!.id,"SUPPORT_CASE_UPDATED","SUPPORT_CASE",body.caseId,{ status: body.status });
    return NextResponse.json({ success: true });
  }
  if (body.panditId && body.accountAction) {
    const status = body.accountAction === "SUSPEND" ? "SUSPENDED" : "ACTIVE";
    const result = await sql(`WITH changed AS (UPDATE pim_v2.users SET account_status=$2 WHERE id=$1 AND role='PANDIT' RETURNING id), ended_sessions AS (DELETE FROM pim_v2.sessions WHERE user_id IN (SELECT id FROM changed) AND $2='SUSPENDED') UPDATE pim_v2.pandit_profiles SET is_online=false,consultation_online=false,updated_at=now() WHERE user_id IN (SELECT id FROM changed) RETURNING user_id`, [body.panditId,status]);
    if (!result.rows[0] && status === "SUSPENDED") return NextResponse.json({ error: "Pandit not found" }, { status: 404 });
    await recordAdminAction(request,auth.admin!.id,`PANDIT_${body.accountAction}`,"PANDIT",body.panditId,{});
    return NextResponse.json({ success: true, accountStatus: status });
  }
  return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
}
