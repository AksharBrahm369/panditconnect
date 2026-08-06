import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { createPrivateSignedUrl } from "@/lib/supabase-storage";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const result = await sql<{ storage_path: string }>(`SELECT storage_path FROM pim_v2.pandit_documents WHERE id=$1`, [id]);
    if (!result.rows[0]) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    return NextResponse.json({ url: await createPrivateSignedUrl(result.rows[0].storage_path, 300), expiresIn: 300 }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to create private review link", error);
    return NextResponse.json({ error: "Unable to open this private document" }, { status: 500 });
  }
}
