import { NextResponse } from "next/server";
import { digest, forgetSession, SESSION_COOKIE } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAdminAction } from "@/lib/admin-audit";

export async function POST(request: Request) {
  const token = request.headers.get("cookie")?.match(/pim_v2_session=([^;]+)/)?.[1];
  if (token) {
    const tokenHash = await digest(token);
    const session = await sql<{ user_id: string; role: string }>(
      `SELECT s.user_id,u.role FROM pim_v2.sessions s JOIN pim_v2.users u ON u.id=s.user_id WHERE s.token_hash=$1`,
      [tokenHash],
    );
    if (session.rows[0]?.role === "ADMIN") await recordAdminAction(request, session.rows[0].user_id, "ADMIN_LOGOUT", "SESSION");
    await sql(`DELETE FROM pim_v2.sessions WHERE token_hash=$1`, [tokenHash]);
    await forgetSession(token);
  }
  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
