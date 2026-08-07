import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/auth";
import { adminPhoneAllowlist } from "@/lib/env";
import { issueLoginOtp, otpErrorResponse } from "@/lib/otp-security";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { phone?: string };
    const phone = normalizePhone(body.phone ?? "");
    if (!adminPhoneAllowlist().has(phone)) return NextResponse.json({ error: "Administrator access could not be verified." }, { status: 403 });
    const result = await issueLoginOtp(request, phone, "ADMIN");
    return NextResponse.json({ success: true, ...result });
  } catch (error) { 
    const otpResponse = otpErrorResponse(error);
    if (otpResponse) return otpResponse;
    console.error("Admin OTP request failed", error);
    return NextResponse.json({ error: "Administrator access could not be verified." }, { status: 500 });
  }
}
