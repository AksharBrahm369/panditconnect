import { NextResponse } from "next/server";
import { digest, normalizePhone, type Role } from "@/lib/auth";
import { sql } from "@/lib/db";
import { deliverLoginOtp } from "@/lib/sms";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { phone?: string; role?: Role };
    const phone = normalizePhone(body.phone ?? "");
    const role = body.role === "PANDIT" ? "PANDIT" : "CUSTOMER";
    const otp = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
    const pepper = process.env.OTP_HASH_PEPPER ?? "local-development-pepper";
    await sql(
      `INSERT INTO pim_v2.otp_challenges(id,phone,role,otp_hash,expires_at)
       VALUES($1,$2,$3,$4,now()+interval '5 minutes')`,
      [crypto.randomUUID(), phone, role, await digest(`${phone}:${otp}:${pepper}`)],
    );
    const delivery = await deliverLoginOtp(phone, otp);
    return NextResponse.json({
      success: true,
      delivery: delivery.delivered ? "sms" : "development",
      ...(delivery.development ? { devOtp: otp } : {}),
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
