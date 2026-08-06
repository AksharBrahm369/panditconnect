import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { createPrivateSignedUrl } from "@/lib/supabase-storage";
import { authorizationResponse } from "@/lib/api-auth";
import { recordAdminAction } from "@/lib/admin-audit";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const result = await sql<{ storage_path: string }>(`SELECT storage_path FROM pim_v2.pandit_documents WHERE id=$1`, [id]);
    if (!result.rows[0]) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    return NextResponse.json({ url: await createPrivateSignedUrl(result.rows[0].storage_path, 300), expiresIn: 300 }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const authResponse = authorizationResponse(error);
    if (authResponse) return authResponse;
    console.error("Unable to create private review link", error);
    return NextResponse.json({ error: "Unable to open this private document" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json() as { status?: "VERIFIED" | "REJECTED"; note?: string };
    if (!body.status || !["VERIFIED", "REJECTED"].includes(body.status)) {
      return NextResponse.json({ error: "Choose Verify or Reject" }, { status: 400 });
    }
    if (body.status === "REJECTED" && !body.note?.trim()) {
      return NextResponse.json({ error: "Explain why this document was rejected" }, { status: 400 });
    }
    const updated = await sql<{ pandit_id: string }>(
      `UPDATE pim_v2.pandit_documents
       SET review_status=$2,review_note=$3,reviewed_at=now()
       WHERE id=$1 RETURNING pandit_id`,
      [id, body.status, body.note?.trim() || null],
    );
    const panditId = updated.rows[0]?.pandit_id;
    if (!panditId) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    const required = await sql<{ document_type: string; review_status: string }>(
      `SELECT DISTINCT ON (document_type) document_type,review_status
       FROM pim_v2.pandit_documents
       WHERE pandit_id=$1 AND document_type IN ('PROFILE_PHOTO','GOVERNMENT_ID','BANK_PROOF')
       ORDER BY document_type,uploaded_at DESC`,
      [panditId],
    );
    const statuses = new Map(required.rows.map((row) => [row.document_type, row.review_status]));
    const requiredTypes = ["PROFILE_PHOTO", "GOVERNMENT_ID", "BANK_PROOF"];
    const documentStatus = requiredTypes.every((type) => statuses.get(type) === "VERIFIED")
      ? "VERIFIED"
      : requiredTypes.some((type) => statuses.get(type) === "REJECTED") ? "FAILED" : "PENDING";
    await sql(
      `INSERT INTO pim_v2.pandit_verification_reviews(pandit_id,document_status,reviewed_by,updated_at)
       VALUES($1,$2,$3,now())
       ON CONFLICT(pandit_id) DO UPDATE SET document_status=EXCLUDED.document_status,
       reviewed_by=EXCLUDED.reviewed_by,updated_at=now()`,
      [panditId, documentStatus, admin.id],
    );
    await sql(
      `INSERT INTO pim_v2.pandit_verification_events(id,pandit_id,admin_user_id,action,note)
       VALUES($1,$2,$3,'CHECKLIST_UPDATED',$4)`,
      [crypto.randomUUID(), panditId, admin.id, `${body.status}: document ${id}`],
    );
    await recordAdminAction(request, admin.id, `PANDIT_DOCUMENT_${body.status}`, "PANDIT_DOCUMENT", id, { panditId });
    return NextResponse.json({ success: true, documentStatus });
  } catch (error) {
    const authResponse = authorizationResponse(error);
    if (authResponse) return authResponse;
    console.error("Unable to review private document", error);
    return NextResponse.json({ error: "Unable to save the document review" }, { status: 500 });
  }
}
