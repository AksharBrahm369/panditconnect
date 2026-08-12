import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { authorizationResponse } from "@/lib/api-auth";
import { recordAdminAction } from "@/lib/admin-audit";
import { notifyUser } from "@/lib/push-notifications";

type ReviewAction = "APPROVE" | "REJECT" | "REQUEST_CHANGES" | "START_REVIEW" | "UPDATE_CHECKLIST";
const checks = ["identityStatus","documentStatus","referenceStatus","knowledgeCheckStatus","bankStatus"] as const;
const databaseChecks: Record<(typeof checks)[number], string> = {
  identityStatus: "identity_status", documentStatus: "document_status", referenceStatus: "reference_status",
  knowledgeCheckStatus: "knowledge_check_status", bankStatus: "bank_status",
};
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const params = new URL(request.url).searchParams;
    const approvedOnly = params.get("scope") === "approved";
    const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
    const limit = Math.min(24, Math.max(4, Number.parseInt(params.get("limit") ?? "12", 10) || 12));
    const offset = (page - 1) * limit;
    if (approvedOnly) {
      const approved = await sql(`SELECT u.id,u.name,u.phone,COALESCE(p.email,u.email) AS email,u.city,u.created_at,u.account_status,u.account_status_reason,u.account_status_changed_at,p.experience_years,p.languages,p.specialities,p.bio,p.base_charge,p.verification_status,p.review_note,p.is_online,p.rating,p.rating_count,p.completed_jobs,COALESCE(array_agg(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL),'{}') AS services,count(*) OVER()::int AS total_count FROM pim_v2.pandit_profiles p JOIN pim_v2.users u ON u.id=p.user_id LEFT JOIN pim_v2.pandit_services ps ON ps.pandit_id=p.user_id LEFT JOIN pim_v2.services s ON s.id=ps.service_id WHERE p.verification_status='APPROVED' GROUP BY u.id,u.name,u.phone,u.email,p.email,u.city,u.created_at,u.account_status,u.account_status_reason,u.account_status_changed_at,p.experience_years,p.languages,p.specialities,p.bio,p.base_charge,p.verification_status,p.review_note,p.is_online,p.rating,p.rating_count,p.completed_jobs ORDER BY CASE u.account_status WHEN 'ACTIVE' THEN 0 WHEN 'RESTRICTED' THEN 1 ELSE 2 END,p.is_online DESC,p.rating DESC,u.name LIMIT $1 OFFSET $2`, [limit, offset]);
      const total = Number(approved.rows[0]?.total_count ?? 0);
      return NextResponse.json({ pandits: approved.rows, page, limit, total, hasMore: offset + approved.rows.length < total }, { headers: { "Cache-Control": "no-store" } });
    }
    const result = await sql(
      `SELECT u.id,u.name,u.phone,u.city,u.created_at,p.email,p.date_of_birth,p.current_address,
       p.experience_years,p.languages,p.specialities,p.bio,p.base_charge,p.service_radius_km,p.payout_method,
       p.bank_account_name,p.bank_ifsc,p.upi_id,p.verification_status,p.review_note,p.submitted_at,
       COALESCE((SELECT json_agg(json_build_object('id',r.id,'name',r.reference_name,'relationship',r.relationship,'organisation',r.temple_or_organisation,'phone',r.phone,'status',r.verification_status,'note',r.verification_note) ORDER BY r.created_at) FROM pim_v2.pandit_references r WHERE r.pandit_id=u.id),'[]') AS references,
       COALESCE((SELECT json_agg(json_build_object('id',d.id,'type',d.document_type,'name',d.original_name,'mimeType',d.mime_type,'size',d.size_bytes,'status',d.review_status,'note',d.review_note) ORDER BY d.uploaded_at DESC) FROM pim_v2.pandit_documents d WHERE d.pandit_id=u.id AND d.document_type<>'VIDEO_INTERVIEW'),'[]') AS documents,
       COALESCE((SELECT json_agg(json_build_object('serviceId',sp.service_id,'serviceName',s.name,'price',sp.price,'enabled',sp.enabled) ORDER BY s.name) FROM pim_v2.pandit_service_pricing sp JOIN pim_v2.services s ON s.id=sp.service_id WHERE sp.pandit_id=u.id),'[]') AS pricing,
       json_build_object('identityStatus',COALESCE(v.identity_status,'PENDING'),'documentStatus',COALESCE(v.document_status,'PENDING'),'referenceStatus',COALESCE(v.reference_status,'PENDING'),'knowledgeCheckStatus',COALESCE(v.knowledge_check_status,'PENDING'),'bankStatus',COALESCE(v.bank_status,'PENDING'),'knowledgeScore',v.knowledge_score,'adminNote',v.admin_note,'identityMethod',v.identity_method,'identityReference',v.identity_reference,'bankMethod',v.bank_method,'bankReference',v.bank_reference,'referenceCheckedAt',v.reference_checked_at) AS review
       FROM pim_v2.pandit_profiles p JOIN pim_v2.users u ON u.id=p.user_id
       LEFT JOIN pim_v2.pandit_verification_reviews v ON v.pandit_id=u.id
       WHERE p.verification_status IN ('SUBMITTED','UNDER_REVIEW','PENDING','INCOMPLETE','CHANGES_REQUESTED','REJECTED')
       ORDER BY CASE p.verification_status WHEN 'SUBMITTED' THEN 0 WHEN 'UNDER_REVIEW' THEN 1 ELSE 2 END,COALESCE(p.submitted_at,u.created_at)
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    const totalResult = await sql<{ total: number }>(`SELECT count(*)::int AS total FROM pim_v2.pandit_profiles WHERE verification_status IN ('SUBMITTED','UNDER_REVIEW','PENDING','INCOMPLETE','CHANGES_REQUESTED','REJECTED')`);
    const total = totalResult.rows[0]?.total ?? 0;
    return NextResponse.json({ pandits: result.rows, page, limit, total, hasMore: offset + result.rows.length < total }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const authResponse = authorizationResponse(error); if (authResponse) return authResponse;
    console.error("Unable to load Pandit review queue", error);
    return NextResponse.json({ error: "Unable to load the review queue" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json() as Record<string, unknown> & { panditId?: string; action?: ReviewAction; note?: string };
    if (!body.panditId || !["APPROVE","REJECT","REQUEST_CHANGES","START_REVIEW","UPDATE_CHECKLIST"].includes(body.action ?? "")) return NextResponse.json({ error: "Choose a valid review action" }, { status: 400 });
    const panditId = body.panditId;
    if (["REJECT","REQUEST_CHANGES"].includes(body.action!) && !body.note?.trim()) return NextResponse.json({ error: "Add a clear decision note" }, { status: 400 });

    if (body.action === "UPDATE_CHECKLIST") {
      const values = checks.map((key) => [key, String(body[key] ?? "PENDING").toUpperCase()] as const);
      if (values.some(([, value]) => !["PENDING","VERIFIED","FAILED"].includes(value))) return NextResponse.json({ error: "Invalid checklist status" }, { status: 400 });
      const score = body.knowledgeScore == null || body.knowledgeScore === "" ? null : Number(body.knowledgeScore);
      if (score != null && (!Number.isInteger(score) || score < 0 || score > 100)) return NextResponse.json({ error: "Knowledge score must be 0 to 100" }, { status: 400 });
      const columns = values.map(([key], index) => `${databaseChecks[key]}=$${index + 3}`).join(",");
      await sql(`INSERT INTO pim_v2.pandit_verification_reviews(pandit_id,reviewed_by) VALUES($1,$2) ON CONFLICT(pandit_id) DO NOTHING`, [panditId, admin.id]);
      const identityMethod=String(body.identityMethod??"").trim().slice(0,120)||null;const identityReference=String(body.identityReference??"").trim().slice(0,200)||null;const bankMethod=String(body.bankMethod??"").trim().slice(0,120)||null;const bankReference=String(body.bankReference??"").trim().slice(0,200)||null;
      if(String(body.identityStatus).toUpperCase()==="VERIFIED"&&(!identityMethod||!identityReference))return NextResponse.json({error:"Record the identity verification method and reference before marking it verified"},{status:400});
      if(String(body.bankStatus).toUpperCase()==="VERIFIED"&&(!bankMethod||!bankReference))return NextResponse.json({error:"Record the bank verification method and reference before marking it verified"},{status:400});
      await sql(`UPDATE pim_v2.pandit_verification_reviews SET ${columns},knowledge_score=$8,admin_note=$9,identity_method=$10,identity_reference=$11,bank_method=$12,bank_reference=$13,reference_checked_at=CASE WHEN $5='VERIFIED' THEN COALESCE(reference_checked_at,now()) ELSE NULL END,reviewed_by=$2,updated_at=now() WHERE pandit_id=$1`,
        [panditId, admin.id, ...values.map(([, value]) => value), score, body.note?.trim() || null,identityMethod,identityReference,bankMethod,bankReference]);
      await sql(`INSERT INTO pim_v2.pandit_verification_events(id,pandit_id,admin_user_id,action,note) VALUES($1,$2,$3,'CHECKLIST_UPDATED',$4)`, [crypto.randomUUID(), panditId, admin.id, body.note?.trim() || null]);
      return NextResponse.json({ success: true });
    }

    if (body.action === "APPROVE") {
      const review = await sql(`SELECT * FROM pim_v2.pandit_verification_reviews WHERE pandit_id=$1`, [panditId]);
      const row = review.rows[0];
      if (!row || [row.identity_status,row.document_status,row.reference_status,row.knowledge_check_status,row.bank_status].some((value) => value !== "VERIFIED")) return NextResponse.json({ error: "Complete and verify every review check before approval" }, { status: 409 });
      await sql(`UPDATE pim_v2.pandit_profiles SET verification_status='APPROVED',review_note=NULL,reviewed_at=now(),is_online=false,updated_at=now() WHERE user_id=$1`, [panditId]);
      await sql(`INSERT INTO pim_v2.pandit_services(pandit_id,service_id,charge) SELECT pandit_id,service_id,price FROM pim_v2.pandit_service_pricing WHERE pandit_id=$1 AND enabled=true ON CONFLICT(pandit_id,service_id) DO UPDATE SET charge=EXCLUDED.charge`, [panditId]);
    } else {
      const status = body.action === "START_REVIEW" ? "UNDER_REVIEW" : body.action === "REJECT" ? "REJECTED" : "CHANGES_REQUESTED";
      await sql(`UPDATE pim_v2.pandit_profiles SET verification_status=$2,review_note=$3,is_online=false,reviewed_at=CASE WHEN $2 IN ('REJECTED','CHANGES_REQUESTED') THEN now() ELSE reviewed_at END,updated_at=now() WHERE user_id=$1`, [panditId, status, body.note?.trim() || null]);
    }
    const eventAction = body.action === "START_REVIEW"
      ? "UNDER_REVIEW"
      : body.action === "APPROVE"
        ? "APPROVED"
        : body.action === "REJECT"
          ? "REJECTED"
          : "CHANGES_REQUESTED";
    await sql(`INSERT INTO pim_v2.pandit_verification_events(id,pandit_id,admin_user_id,action,note) VALUES($1,$2,$3,$4,$5)`, [crypto.randomUUID(), panditId, admin.id, eventAction, body.note?.trim() || null]);
    await recordAdminAction(request, admin.id, `PANDIT_${body.action}`, "PANDIT_PROFILE", panditId, { noteProvided: Boolean(body.note?.trim()) });
    const reviewCopy = body.action === "APPROVE" ? "Congratulations! Your Pandit profile is approved. Open the portal to go online." : body.action === "REJECT" ? `Your Pandit application was not approved.${body.note?.trim() ? ` Reason: ${body.note.trim()}` : " Open your profile for details."}` : body.action === "REQUEST_CHANGES" ? `Admin requested changes to your Pandit profile.${body.note?.trim() ? ` ${body.note.trim()}` : ""}` : "Admin has started reviewing your Pandit application.";
    const reviewTitle = body.action === "APPROVE" ? "Application approved" : body.action === "REJECT" ? "Application not approved" : body.action === "REQUEST_CHANGES" ? "Profile changes required" : "Application review started";
    await notifyUser(panditId, { title: reviewTitle, body: reviewCopy, url: "/pandit", eventType: `PANDIT_${eventAction}` });
    return NextResponse.json({ success: true });
  } catch (error) {
    const authResponse = authorizationResponse(error); if (authResponse) return authResponse;
    console.error("Pandit review action failed", error);
    return NextResponse.json({ error: "Unable to save this review action" }, { status: 500 });
  }
}
