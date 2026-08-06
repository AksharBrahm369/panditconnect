import { NextResponse } from "next/server";
import { VAPID_PUBLIC_KEY } from "@/lib/push-config";

export function GET() {
  return NextResponse.json({ vapidPublicKey: VAPID_PUBLIC_KEY }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
