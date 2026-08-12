import { NextResponse } from "next/server";
import { adminPhoneAllowlist, serverSecret } from "@/lib/env";
import { constantTimeEqual, digest, normalizePhone, randomToken, rememberSession, SESSION_COOKIE, type AppUser } from "@/lib/auth";
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
    if (!constantTimeEqual(expected, latest.otp_hash)) {
      await sql(`UPDATE pim_v2.otp_challenges SET attempts=attempts+1 WHERE id=$1`, [latest.id]);
      return NextResponse.json({ error: "Incorrect OTP. Check the latest code." }, { status: 400 });
    }
    const claimed = await sql(`UPDATE pim_v2.otp_challenges SET verified_at=now() WHERE id=$1 AND verified_at IS NULL RETURNING id`, [latest.id]);
    if (!claimed.rows[0]) return NextResponse.json({ error: "This OTP has already been used. Request a new code." }, { status: 409 });
    const userResult = await sql<AppUser>(
      `INSERT INTO pim_v2.users(id,phone,role,last_login_at) VALUES($1,$2,'CUSTOMER',now())
       ON CONFLICT(phone) DO UPDATE SET last_login_at=now()
       RETURNING id,phone,email,role,name,city`,
      [crypto.randomUUID(), phone],
    );
    const user = userResult.rows[0];
    const adminUser: AppUser = { ...user, role: "ADMIN" };
    const token = randomToken();
    await sql(
      `INSERT INTO pim_v2.sessions(id,user_id,token_hash,session_role,expires_at) VALUES($1,$2,$3,'ADMIN',now()+interval '30 days')`,
      [crypto.randomUUID(), user.id, await digest(token)],
    );
    await rememberSession(token, adminUser);
    await recordAdminAction(request, user.id, "ADMIN_LOGIN", "SESSION");
    const response = NextResponse.json({ success: true, redirectTo: "/admin" });
    response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "strict", secure: new URL(request.url).protocol === "https:", path: "/", maxAge: 60 * 60 * 24 * 30 });
    return response;
  } catch (error) {
    const otpResponse = otpErrorResponse(error);
    if (otpResponse) return otpResponse;
    console.error("Admin OTP verification failed", error);
    return NextResponse.json({ error: "Administrator access could not be verified." }, { status: 500 });
  }
}
