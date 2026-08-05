import { NextResponse } from "next/server";
import { digest, normalizePhone } from "@/lib/auth";
import { adminPhoneAllowlist, isProductionEnvironment, serverSecret } from "@/lib/env";
import { requestIp } from "@/lib/request-security";
import { deliverLoginOtp } from "@/lib/sms";
import { sql } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { phone?: string };
    const phone = normalizePhone(body.phone ?? "");
    if (!adminPhoneAllowlist().has(phone)) return NextResponse.json({ error: "Administrator access could not be verified." }, { status: 403 });
    const ip = requestIp(request);
    const recent = await sql<{ attempts: number }>(
      `SELECT count(*)::int AS attempts FROM pim_v2.otp_challenges
       WHERE created_at>now()-interval '15 minutes' AND (phone=$1 OR request_ip=$2)`,
      [phone, ip],
    );
    if ((recent.rows[0]?.attempts ?? 0) >= 5) return NextResponse.json({ error: "Too many OTP requests. Please wait before trying again." }, { status: 429 });
    const otp = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
    await sql(
      `INSERT INTO pim_v2.otp_challenges(id,phone,role,otp_hash,expires_at,request_ip)
       VALUES($1,$2,'ADMIN',$3,now()+interval '5 minutes',$4)`,
      [crypto.randomUUID(), phone, await digest(`${phone}:${otp}:${serverSecret("OTP_HASH_PEPPER")}`), ip],
    );
    const delivery = await deliverLoginOtp(phone, otp);
    if (isProductionEnvironment() && delivery.development) return NextResponse.json({ error: "SMS verification is temporarily unavailable." }, { status: 503 });
    return NextResponse.json({ success: true, ...(!isProductionEnvironment() && delivery.development ? { devOtp: otp } : {}) });
  } catch (error) {
    console.error("Admin OTP request failed", error);
    return NextResponse.json({ error: "Administrator access could not be verified." }, { status: 500 });
  }
}
