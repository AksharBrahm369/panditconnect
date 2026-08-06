import { NextResponse } from "next/server";
import { requirePandit } from "@/lib/auth";
import { authorizationResponse } from "@/lib/api-auth";
import { sql } from "@/lib/db";
import { deletePrivateObject, uploadPrivateObject } from "@/lib/supabase-storage";

export const dynamic = "force-dynamic";
const types = new Set(["PROFILE_PHOTO","GOVERNMENT_ID","ADDRESS_PROOF","BANK_PROOF","REFERENCE_LETTER","VIDEO_INTERVIEW"]);
const documentMimeTypes = new Set(["image/jpeg","image/png","image/webp","application/pdf"]);
const videoMimeTypes = new Set(["video/mp4","video/webm","video/quicktime"]);

export async function POST(request: Request) {
  let path: string | null = null;
  try {
    const user = await requirePandit();
    const form = await request.formData();
    const file = form.get("file");
    const documentType = String(form.get("documentType") ?? "");
    if (!(file instanceof File) || !types.has(documentType)) return NextResponse.json({ error: "Choose a valid document" }, { status: 400 });
    const isVideo = documentType === "VIDEO_INTERVIEW";
    const allowedMime = isVideo ? videoMimeTypes.has(file.type) : documentMimeTypes.has(file.type);
    const sizeLimit = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (!allowedMime || file.size <= 0 || file.size > sizeLimit) {
      return NextResponse.json({ error: isVideo ? "Use an MP4, WebM or MOV video up to 50 MB" : "Use JPG, PNG, WebP or PDF up to 10 MB" }, { status: 400 });
    }
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
    const authResponse = authorizationResponse(error);
    if (authResponse) return authResponse;
    console.error("Pandit document upload failed", error);
    return NextResponse.json({ error: "Private document upload is not configured or failed" }, { status: 500 });
  }
}
