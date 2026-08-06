import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { authorizationResponse } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const result = await sql(`SELECT id,title,body,url,event_type,read_at,created_at FROM pim_v2.notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30`, [user.id]);
    return NextResponse.json({ notifications: result.rows, unread: result.rows.filter((row) => !row.read_at).length, vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? "" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authorizationResponse(error) ?? NextResponse.json({ error: "Unable to load notifications" }, { status: 500 }); }
}

export async function PATCH() {
  try { const user = await requireUser(); await sql(`UPDATE pim_v2.notifications SET read_at=COALESCE(read_at,now()) WHERE user_id=$1`, [user.id]); return NextResponse.json({ success: true }); }
  catch (error) { return authorizationResponse(error) ?? NextResponse.json({ error: "Unable to update notifications" }, { status: 500 }); }
}
