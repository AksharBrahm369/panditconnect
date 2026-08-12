import { NextResponse } from "next/server";
import { constantTimeEqual, digest, normalizePhone, randomToken, rememberSession, SESSION_COOKIE, type AppUser, type Role } from "@/lib/auth";
import { sql } from "@/lib/db";
import { serverSecret } from "@/lib/env";
import { assertOtpVerificationAllowed, otpErrorResponse } from "@/lib/otp-security";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { phone?: string; otp?: string; role?: Role };
    const phone = normalizePhone(body.phone ?? "");
    const role = body.role === "PANDIT" ? "PANDIT" : "CUSTOMER";
    await assertOtpVerificationAllowed(phone);
    const challenge = await sql<{ id: string; otp_hash: string; attempts: number }>(
      `SELECT id,otp_hash,attempts FROM pim_v2.otp_challenges
       WHERE phone=$1 AND role=$2 AND verified_at IS NULL AND expires_at>now()
         AND delivery_status IN ('DEVELOPMENT','SENT')
       ORDER BY created_at DESC LIMIT 1`,
      [phone, role],
    );
    const latest = challenge.rows[0];
    if (!latest) return NextResponse.json({ error: "OTP expired. Request a new code." }, { status: 400 });
    if (latest.attempts >= 5) return NextResponse.json({ error: "Too many attempts. Request a new code." }, { status: 429 });
    const pepper = serverSecret("OTP_HASH_PEPPER");
    const expected = await digest(`${phone}:${body.otp ?? ""}:${pepper}`);
    if (!constantTimeEqual(expected, latest.otp_hash)) {
      await sql(`UPDATE pim_v2.otp_challenges SET attempts=attempts+1 WHERE id=$1`, [latest.id]);
      return NextResponse.json({ error: "Incorrect OTP. Check the latest code." }, { status: 400 });
    }
    const claimed = await sql(`UPDATE pim_v2.otp_challenges SET verified_at=now() WHERE id=$1 AND verified_at IS NULL RETURNING id`, [latest.id]);
    if (!claimed.rows[0]) return NextResponse.json({ error: "This OTP has already been used. Request a new code." }, { status: 409 });
    const id = crypto.randomUUID();
    const userResult = await sql<AppUser & { account_status: string }>(
      `INSERT INTO pim_v2.users(id,phone,role,last_login_at) VALUES($1,$2,$3,now())
       ON CONFLICT(phone) DO UPDATE SET role=CASE WHEN pim_v2.users.role='ADMIN' THEN EXCLUDED.role ELSE pim_v2.users.role END,last_login_at=now()
       RETURNING id,phone,email,role,name,city,account_status`,
      [id, phone, role],
    );
    const user = userResult.rows[0];
    if (user.role !== role) return NextResponse.json({ error: `This number is registered as ${user.role.toLowerCase()}.` }, { status: 409 });
    const inactivePandit = role === "PANDIT" && ["RESTRICTED","BLOCKED"].includes(user.account_status);
    if (user.account_status !== "ACTIVE" && !inactivePandit) return NextResponse.json({ error: "This account is unavailable. Contact support to restore access." }, { status: 403 });
    if (role === "PANDIT") {
      await sql(`INSERT INTO pim_v2.pandit_profiles(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`, [user.id]);
    }

    const token = randomToken();
    await sql(
      `INSERT INTO pim_v2.sessions(id,user_id,token_hash,session_role,expires_at)
       VALUES($1,$2,$3,$4,now()+interval '30 days')`,
      [crypto.randomUUID(), user.id, await digest(token), role],
    );
    if (!inactivePandit) await rememberSession(token, user);
    const response = NextResponse.json(
      { success: true, redirectTo: role === "PANDIT" ? "/pandit" : "/customer" },
      { headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } },
    );
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true, sameSite: "strict", secure: new URL(request.url).protocol === "https:", path: "/", maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    const otpResponse = otpErrorResponse(error);
    if (otpResponse) return otpResponse;
    console.error("OTP verification failed", error);
    return NextResponse.json({ error: "Unable to verify OTP. Please try again." }, { status: 500 });
  }
}
