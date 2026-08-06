import { NextResponse } from "next/server";
import { normalizePhone, type Role } from "@/lib/auth";
import { issueLoginOtp, otpErrorResponse } from "@/lib/otp-security";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { phone?: string; role?: Role };
    const phone = normalizePhone(body.phone ?? "");
    const role = body.role === "PANDIT" ? "PANDIT" : "CUSTOMER";
    const result = await issueLoginOtp(request, phone, role);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const otpResponse = otpErrorResponse(error);
    if (otpResponse) return otpResponse;
    console.error("OTP request failed", error);
    const message = error instanceof Error ? error.message : "Unable to request OTP";
    const connectionFailure = /connection|timeout|ECONNRESET|terminated/i.test(message);
    return NextResponse.json(
      { error: connectionFailure ? "The service was temporarily unavailable. Please try again." : message },
      { status: connectionFailure ? 503 : 400 },
    );
  }
}
