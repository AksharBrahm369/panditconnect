import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { authorizationResponse } from "@/lib/api-auth";
import { z } from "zod";

const subscriptionSchema = z.object({ endpoint: z.string().url().max(2000), keys: z.object({ p256dh: z.string().min(20).max(500), auth: z.string().min(10).max(500) }) });

export async function POST(request: Request) {
  try {
    const user = await requireUser(); const parsed = subscriptionSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid notification subscription" }, { status: 400 });
    await sql(`INSERT INTO pim_v2.push_subscriptions(id,user_id,endpoint,p256dh,auth,user_agent) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(endpoint) DO UPDATE SET user_id=EXCLUDED.user_id,p256dh=EXCLUDED.p256dh,auth=EXCLUDED.auth,user_agent=EXCLUDED.user_agent,updated_at=now()`, [crypto.randomUUID(), user.id, parsed.data.endpoint, parsed.data.keys.p256dh, parsed.data.keys.auth, request.headers.get("user-agent")?.slice(0,300) ?? null]);
    return NextResponse.json({ success: true });
  } catch (error) { return authorizationResponse(error) ?? NextResponse.json({ error: "Unable to enable notifications" }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try { const user = await requireUser(); const endpoint = String((await request.json() as { endpoint?: string }).endpoint ?? ""); await sql(`DELETE FROM pim_v2.push_subscriptions WHERE user_id=$1 AND endpoint=$2`, [user.id, endpoint]); return NextResponse.json({ success: true }); }
  catch (error) { return authorizationResponse(error) ?? NextResponse.json({ error: "Unable to disable notifications" }, { status: 500 }); }
}
