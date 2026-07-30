import { NextResponse } from "next/server";
import { digest, forgetSession, SESSION_COOKIE } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST(request: Request) {
  const token = request.headers.get("cookie")?.match(/pim_v2_session=([^;]+)/)?.[1];
  if (token) {
    await sql(`DELETE FROM pim_v2.sessions WHERE token_hash=$1`, [await digest(token)]);
    await forgetSession(token);
  }
  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
