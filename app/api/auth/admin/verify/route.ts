import { NextResponse } from "next/server";
import { adminPhoneAllowlist, serverSecret } from "@/lib/env";
import { digest, forgetSession, normalizePhone, randomToken, rememberSession, SESSION_COOKIE, type AppUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAdminAction } from "@/lib/admin-audit";
import { assertOtpVerificationAllowed, otpErrorResponse } from "@/lib/otp-security";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { phone?: string; otp?: string };
    const phone = normalizePhone(body.phone ?? "");
    if (!adminPhoneAllowlist().has(phone)) return NextResponse.json({ error: "Administrator access could not be verified." }, { status: 403 });
    await assertOtpVerificationAllowed(phone);
    const challenge = await sql<{ id: string; otp_hash: string; attempts: number }>(
      `SELECT id,otp_hash,attempts FROM pim_v2.otp_challenges
       WHERE phone=$1 AND role='ADMIN' AND verified_at IS NULL AND expires_at>now()
         AND delivery_status IN ('DEVELOPMENT','SENT')
       ORDER BY created_at DESC LIMIT 1`,
      [phone],
    );
    const latest = challenge.rows[0];
    if (!latest) return NextResponse.json({ error: "OTP expired. Request a new code." }, { status: 400 });
    if (latest.attempts >= 5) return NextResponse.json({ error: "Too many attempts. Request a new code." }, { status: 429 });
    const expected = await digest(`${phone}:${body.otp ?? ""}:${serverSecret("OTP_HASH_PEPPER")}`);
    if (expected !== latest.otp_hash) {
      await sql(`UPDATE pim_v2.otp_challenges SET attempts=attempts+1 WHERE id=$1`, [latest.id]);
      return NextResponse.json({ error: "Incorrect OTP. Check the latest code." }, { status: 400 });
    }
    const userResult = await sql<AppUser>(
      `INSERT INTO pim_v2.users(id,phone,role,last_login_at) VALUES($1,$2,'ADMIN',now())
       ON CONFLICT(phone) DO UPDATE SET role='ADMIN',last_login_at=now()
       RETURNING id,phone,role,name,city`,
      [crypto.randomUUID(), phone],
    );
    const user = userResult.rows[0];
    const previousToken = request.headers.get("cookie")?.match(/(?:^|;\s*)pim_v2_session=([^;]+)/)?.[1];
    if (previousToken) {
      await sql(`DELETE FROM pim_v2.sessions WHERE token_hash=$1`, [await digest(previousToken)]);
      await forgetSession(previousToken);
    }
    const token = randomToken();
    await sql(
      `INSERT INTO pim_v2.sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '8 hours')`,
      [crypto.randomUUID(), user.id, await digest(token)],
    );
    await sql(`UPDATE pim_v2.otp_challenges SET verified_at=now() WHERE id=$1`, [latest.id]);
    await rememberSession(token, user);
    await recordAdminAction(request, user.id, "ADMIN_LOGIN", "SESSION");
    const response = NextResponse.json({ success: true, redirectTo: "/admin" });
    response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
    return response;
  } catch (error) {
    const otpResponse = otpErrorResponse(error);
    if (otpResponse) return otpResponse;
    console.error("Admin OTP verification failed", error);
    return NextResponse.json({ error: "Administrator access could not be verified." }, { status: 500 });
  }
}
