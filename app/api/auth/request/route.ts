import { NextResponse } from "next/server";
import { digest, normalizePhone, type Role } from "@/lib/auth";
import { sql } from "@/lib/db";
import { deliverLoginOtp } from "@/lib/sms";
import { isProductionEnvironment, serverSecret } from "@/lib/env";
import { requestIp } from "@/lib/request-security";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { phone?: string; role?: Role };
    const phone = normalizePhone(body.phone ?? "");
    const role = body.role === "PANDIT" ? "PANDIT" : "CUSTOMER";
    const ip = requestIp(request);
    const recent = await sql<{ attempts: number }>(
      `SELECT count(*)::int AS attempts FROM pim_v2.otp_challenges
       WHERE created_at>now()-interval '10 minutes' AND (phone=$1 OR request_ip=$2)`,
      [phone, ip],
    );
    if ((recent.rows[0]?.attempts ?? 0) >= 5) return NextResponse.json({ error: "Too many OTP requests. Please wait before trying again." }, { status: 429 });
    const otp = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
    const pepper = serverSecret("OTP_HASH_PEPPER");
    await sql(
      `INSERT INTO pim_v2.otp_challenges(id,phone,role,otp_hash,expires_at,request_ip)
       VALUES($1,$2,$3,$4,now()+interval '5 minutes',$5)`,
      [crypto.randomUUID(), phone, role, await digest(`${phone}:${otp}:${pepper}`), ip],
    );
    const delivery = await deliverLoginOtp(phone, otp);
    if (isProductionEnvironment() && delivery.development) {
      return NextResponse.json({ error: "SMS verification is temporarily unavailable." }, { status: 503 });
    }
    return NextResponse.json({
      success: true,
      delivery: delivery.delivered ? "sms" : "development",
      ...(!isProductionEnvironment() && delivery.development ? { devOtp: otp } : {}),
    });
  } catch (error) {
    console.error("OTP request failed", error);
    const message = error instanceof Error ? error.message : "Unable to request OTP";
    const connectionFailure = /connection|timeout|ECONNRESET|terminated/i.test(message);
    return NextResponse.json(
      { error: connectionFailure ? "The service was temporarily unavailable. Please try again." : message },
      { status: connectionFailure ? 503 : 400 },
    );
  }
}
