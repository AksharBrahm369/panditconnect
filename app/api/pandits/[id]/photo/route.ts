import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { createPrivateSignedUrl } from "@/lib/supabase-storage";

export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await sql<{ storage_path: string }>(
    `SELECT d.storage_path
       FROM pim_v2.pandit_profiles p
       JOIN pim_v2.pandit_documents d ON d.pandit_id=p.user_id
      WHERE p.user_id=$1
        AND p.verification_status='APPROVED'
        AND d.document_type='PROFILE_PHOTO'
        AND d.review_status='VERIFIED'
      ORDER BY d.uploaded_at DESC
      LIMIT 1`,
    [id],
  );
  const photo = result.rows[0];
  if (!photo) return NextResponse.json({ error: "Verified profile photograph not found" }, { status: 404 });

  try {
    const signedUrl = await createPrivateSignedUrl(photo.storage_path, 300);
    const response = NextResponse.redirect(signedUrl, 307);
    response.headers.set("Cache-Control", "private, max-age=240");
    return response;
  } catch {
    return NextResponse.json({ error: "Profile photograph is temporarily unavailable" }, { status: 503 });
  }
}
