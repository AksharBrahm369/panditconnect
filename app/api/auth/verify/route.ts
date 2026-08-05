import { NextResponse } from "next/server";
import { digest, forgetSession, normalizePhone, randomToken, rememberSession, SESSION_COOKIE, type AppUser, type Role } from "@/lib/auth";
import { sql } from "@/lib/db";
import { serverSecret } from "@/lib/env";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { phone?: string; otp?: string; role?: Role };
    const phone = normalizePhone(body.phone ?? "");
    const role = body.role === "PANDIT" ? "PANDIT" : "CUSTOMER";
    const challenge = await sql<{ id: string; otp_hash: string; attempts: number }>(
      `SELECT id,otp_hash,attempts FROM pim_v2.otp_challenges
       WHERE phone=$1 AND role=$2 AND verified_at IS NULL AND expires_at>now()
       ORDER BY created_at DESC LIMIT 1`,
      [phone, role],
    );
    const latest = challenge.rows[0];
    if (!latest) return NextResponse.json({ error: "OTP expired. Request a new code." }, { status: 400 });
    if (latest.attempts >= 5) return NextResponse.json({ error: "Too many attempts. Request a new code." }, { status: 429 });
    const pepper = serverSecret("OTP_HASH_PEPPER");
    const expected = await digest(`${phone}:${body.otp ?? ""}:${pepper}`);
    if (expected !== latest.otp_hash) {
      await sql(`UPDATE pim_v2.otp_challenges SET attempts=attempts+1 WHERE id=$1`, [latest.id]);
      return NextResponse.json({ error: "Incorrect OTP. Check the latest code." }, { status: 400 });
    }
    const id = crypto.randomUUID();
    const userResult = await sql<AppUser>(
      `INSERT INTO pim_v2.users(id,phone,role,last_login_at) VALUES($1,$2,$3,now())
       ON CONFLICT(phone) DO UPDATE SET last_login_at=now()
       RETURNING id,phone,role,name,city`,
      [id, phone, role],
    );
    const user = userResult.rows[0];
    if (user.role !== role) return NextResponse.json({ error: `This number is registered as ${user.role.toLowerCase()}.` }, { status: 409 });
    if (role === "PANDIT") {
      await sql(`INSERT INTO pim_v2.pandit_profiles(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`, [user.id]);
    }

    // A browser may verify a second number without explicitly signing out first.
    // Retire that browser's previous session before assigning the new account.
    const previousToken = request.headers.get("cookie")?.match(/(?:^|;\s*)pim_v2_session=([^;]+)/)?.[1];
    if (previousToken) {
      await sql(`DELETE FROM pim_v2.sessions WHERE token_hash=$1`, [await digest(previousToken)]);
      await forgetSession(previousToken);
    }

    const token = randomToken();
    await sql(
      `INSERT INTO pim_v2.sessions(id,user_id,token_hash,expires_at)
       VALUES($1,$2,$3,now()+interval '30 days')`,
      [crypto.randomUUID(), user.id, await digest(token)],
    );
    await rememberSession(token, user);
    await sql(`UPDATE pim_v2.otp_challenges SET verified_at=now() WHERE id=$1`, [latest.id]);
    const response = NextResponse.json(
      { success: true, redirectTo: role === "PANDIT" ? "/pandit" : "/customer" },
      { headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } },
    );
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    console.error("OTP verification failed", error);
    return NextResponse.json({ error: "Unable to verify OTP. Please try again." }, { status: 500 });
  }
}
