import { NextResponse } from "next/server";
import { requirePandit } from "@/lib/auth";
import { sql } from "@/lib/db";
import { deletePrivateObject, uploadPrivateObject } from "@/lib/supabase-storage";

export const dynamic = "force-dynamic";
const types = new Set(["PROFILE_PHOTO","GOVERNMENT_ID","ADDRESS_PROOF","BANK_PROOF","REFERENCE_LETTER","VIDEO_INTERVIEW"]);
const mimeTypes = new Set(["image/jpeg","image/png","image/webp","application/pdf","video/mp4"]);

export async function POST(request: Request) {
  let path: string | null = null;
  try {
    const user = await requirePandit();
    const form = await request.formData();
    const file = form.get("file");
    const documentType = String(form.get("documentType") ?? "");
    if (!(file instanceof File) || !types.has(documentType)) return NextResponse.json({ error: "Choose a valid document" }, { status: 400 });
    if (!mimeTypes.has(file.type) || file.size <= 0 || file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Use JPG, PNG, WebP, PDF or MP4 up to 10 MB" }, { status: 400 });
    const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
    const id = crypto.randomUUID();
    path = `${user.id}/${documentType.toLowerCase()}/${id}.${extension}`;
    await uploadPrivateObject(path, file);
    await sql(`INSERT INTO pim_v2.pandit_documents(id,pandit_id,document_type,storage_path,original_name,mime_type,size_bytes) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [id, user.id, documentType, path, file.name.slice(0, 255), file.type, file.size]);
    if (documentType === "PROFILE_PHOTO") await sql(`UPDATE pim_v2.pandit_profiles SET profile_photo_path=$2,updated_at=now() WHERE user_id=$1`, [user.id, path]);
    return NextResponse.json({ success: true, document: { id, document_type: documentType, original_name: file.name, review_status: "PENDING" } });
  } catch (error) {
    if (path) await deletePrivateObject(path).catch(() => undefined);
    console.error("Pandit document upload failed", error);
    return NextResponse.json({ error: "Private document upload is not configured or failed" }, { status: 500 });
  }
}
