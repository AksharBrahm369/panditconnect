import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { authorizationResponse } from "@/lib/api-auth";
import { recordAdminAction } from "@/lib/admin-audit";
import { sql } from "@/lib/db";
import { notifyUser } from "@/lib/push-notifications";
import { deletePrivateObject } from "@/lib/supabase-storage";

type PrivacyAction = "START_REVIEW" | "COMPLETE" | "REJECT";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const result = await sql(
      `SELECT r.id,r.request_type,r.status,r.details,r.resolution,r.requested_at,r.completed_at,
              u.id AS user_id,u.role,u.name,u.phone,u.email,u.account_status
       FROM pim_v2.data_rights_requests r
       JOIN pim_v2.users u ON u.id=r.user_id
       ORDER BY CASE r.status WHEN 'OPEN' THEN 0 WHEN 'IN_REVIEW' THEN 1 ELSE 2 END,r.requested_at DESC
       LIMIT 100`,
    );
    return NextResponse.json({ requests: result.rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return authorizationResponse(error) ?? NextResponse.json({ error: "Unable to load privacy requests" }, { status: 500 });
  }
}

async function removePanditDocuments(userId: string) {
  const documents = await sql<{ storage_path: string }>(`SELECT storage_path FROM pim_v2.pandit_documents WHERE pandit_id=$1`, [userId]);
  const failures: string[] = [];
  for (const document of documents.rows) {
    try { await deletePrivateObject(document.storage_path); } catch { failures.push(document.storage_path); }
  }
  if (failures.length) throw new Error(`Unable to remove ${failures.length} private object(s)`);
  await sql(`DELETE FROM pim_v2.pandit_documents WHERE pandit_id=$1`, [userId]);
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json() as { requestId?: string; action?: PrivacyAction; resolution?: string };
    if (!body.requestId || !body.action || !["START_REVIEW", "COMPLETE", "REJECT"].includes(body.action)) {
      return NextResponse.json({ error: "Choose a valid privacy action" }, { status: 400 });
    }
    if (["COMPLETE", "REJECT"].includes(body.action) && (body.resolution?.trim().length ?? 0) < 5) {
      return NextResponse.json({ error: "Record a clear resolution for the audit trail" }, { status: 400 });
    }
    const found = await sql<{ id:string;user_id:string;request_type:string;status:string }>(
      `SELECT id,user_id,request_type,status FROM pim_v2.data_rights_requests WHERE id=$1 FOR UPDATE`, [body.requestId],
    );
    const item = found.rows[0];
    if (!item) return NextResponse.json({ error: "Privacy request not found" }, { status: 404 });
    if (["COMPLETED", "REJECTED", "CANCELLED"].includes(item.status)) return NextResponse.json({ error: "This request is already closed" }, { status: 409 });

    if (body.action === "START_REVIEW") {
      await sql(`UPDATE pim_v2.data_rights_requests SET status='IN_REVIEW',handled_by=$2 WHERE id=$1`, [item.id, admin.id]);
      await notifyUser(item.user_id, { title: "Privacy request under review", body: "An authorised administrator has started reviewing your request.", url: "/", eventType: "PRIVACY_REQUEST_REVIEW" });
    } else if (body.action === "REJECT") {
      await sql(`UPDATE pim_v2.data_rights_requests SET status='REJECTED',resolution=$2,handled_by=$3,completed_at=now() WHERE id=$1`, [item.id, body.resolution!.trim(), admin.id]);
      if (item.request_type === "ACCOUNT_DELETION") await sql(`UPDATE pim_v2.users SET account_status='ACTIVE' WHERE id=$1 AND account_status='DELETION_REQUESTED'`, [item.user_id]);
      await notifyUser(item.user_id, { title: "Privacy request decision", body: body.resolution!.trim(), url: "/", eventType: "PRIVACY_REQUEST_REJECTED" });
    } else {
      if (item.request_type === "DOCUMENT_DELETION") await removePanditDocuments(item.user_id);
      if (item.request_type === "ACCOUNT_DELETION") {
        const blockers = await sql<{ active:number;balance:number }>(
          `SELECT (SELECT count(*)::int FROM pim_v2.bookings WHERE (customer_id=$1 OR pandit_id=$1) AND status IN ('REQUESTED','ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS')) AS active,
                  (SELECT COALESCE(sum(amount),0)::int FROM pim_v2.account_ledger WHERE user_id=$1 AND status IN ('OUTSTANDING','DISPUTED')) AS balance`, [item.user_id],
        );
        if ((blockers.rows[0]?.active ?? 0) > 0 || (blockers.rows[0]?.balance ?? 0) > 0) return NextResponse.json({ error: "Active services or an unresolved balance still block deletion" }, { status: 409 });
        await removePanditDocuments(item.user_id);
        await Promise.all([
          sql(`DELETE FROM pim_v2.sessions WHERE user_id=$1`,[item.user_id]),
          sql(`DELETE FROM pim_v2.push_subscriptions WHERE user_id=$1`,[item.user_id]),
          sql(`DELETE FROM pim_v2.notification_preferences WHERE user_id=$1`,[item.user_id]),
          sql(`DELETE FROM pim_v2.pandit_profiles WHERE user_id=$1`,[item.user_id]),
          sql(`DELETE FROM pim_v2.customer_profiles WHERE user_id=$1`,[item.user_id]),
        ]);
        await sql(`UPDATE pim_v2.users SET phone='deleted-'||id::text,name='Deleted account',city=NULL,account_status='DELETED',last_login_at=NULL WHERE id=$1`, [item.user_id]);
      }
      await sql(`UPDATE pim_v2.data_rights_requests SET status='COMPLETED',resolution=$2,handled_by=$3,completed_at=now() WHERE id=$1`, [item.id, body.resolution!.trim(), admin.id]);
      if (item.request_type !== "ACCOUNT_DELETION") await notifyUser(item.user_id, { title: "Privacy request completed", body: body.resolution!.trim(), url: "/", eventType: "PRIVACY_REQUEST_COMPLETED" });
    }
    await recordAdminAction(request, admin.id, `PRIVACY_${body.action}`, "DATA_RIGHTS_REQUEST", item.id, { requestType:item.request_type,userId:item.user_id,resolution:body.resolution?.trim() || null });
    return NextResponse.json({ success: true });
  } catch (error) {
    const auth = authorizationResponse(error); if (auth) return auth;
    console.error("Privacy request action failed", error);
    return NextResponse.json({ error: "Unable to complete this privacy action" }, { status: 500 });
  }
}
