import { digest, type Role } from "@/lib/auth";
import { appEnvironment, serverSecret } from "@/lib/env";
import { sql } from "@/lib/db";
import { requestIp } from "@/lib/request-security";
import { deliverLoginOtp } from "@/lib/sms";

const RESEND_COOLDOWN_SECONDS = 60;
const PHONE_HOURLY_LIMIT = 5;
const PHONE_DAILY_LIMIT = 20;
const IP_HOURLY_LIMIT = 20;
const IP_DAILY_LIMIT = 50;
const PHONE_FAILED_ATTEMPT_LIMIT = 15;

export class OtpRequestError extends Error {
  constructor(message: string, public status: 429 | 503, public retryAfter?: number) { super(message); }
}

function localRequest(request: Request) {
  try {
    const hostname = new URL(request.url).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch { return false; }
}

export function developmentOtpAllowed(request: Request) {
  return appEnvironment() === "development" && localRequest(request);
}

export async function assertOtpVerificationAllowed(phone: string) {
  const result = await sql<{ failures: number }>(
    `SELECT COALESCE(sum(attempts),0)::int AS failures
     FROM pim_v2.otp_challenges
     WHERE phone=$1 AND created_at>now()-interval '24 hours'`,
    [phone],
  );
  if ((result.rows[0]?.failures ?? 0) >= PHONE_FAILED_ATTEMPT_LIMIT) {
    throw new OtpRequestError("Too many incorrect attempts. Please try again tomorrow.", 429, 3600);
  }
}

export async function issueLoginOtp(request: Request, phone: string, role: Role) {
  const ip = requestIp(request);
  await sql(`DELETE FROM pim_v2.otp_challenges WHERE created_at<now()-interval '2 days'`);
  const useIp = ip !== "unknown";
  const usage = await sql<{ phone_hour: number; phone_day: number; ip_hour: number; ip_day: number; seconds_since_last: number | null }>(
    `SELECT
       count(*) FILTER (WHERE phone=$1 AND created_at>now()-interval '1 hour')::int AS phone_hour,
       count(*) FILTER (WHERE phone=$1)::int AS phone_day,
       count(*) FILTER (WHERE $3 AND request_ip=$2 AND created_at>now()-interval '1 hour')::int AS ip_hour,
       count(*) FILTER (WHERE $3 AND request_ip=$2)::int AS ip_day,
       extract(epoch FROM (now()-max(created_at) FILTER (WHERE phone=$1)))::int AS seconds_since_last
     FROM pim_v2.otp_challenges
     WHERE created_at>now()-interval '24 hours' AND (phone=$1 OR ($3 AND request_ip=$2))`,
    [phone, ip, useIp],
  );
  const limits = usage.rows[0];
  const sinceLast = limits?.seconds_since_last;
  if (sinceLast !== null && sinceLast !== undefined && sinceLast < RESEND_COOLDOWN_SECONDS) {
    const retryAfter = RESEND_COOLDOWN_SECONDS - sinceLast;
    throw new OtpRequestError(`Please wait ${retryAfter} seconds before requesting another OTP.`, 429, retryAfter);
  }
  if ((limits?.phone_hour ?? 0) >= PHONE_HOURLY_LIMIT) throw new OtpRequestError("Hourly OTP limit reached. Please try again later.", 429, 3600);
  if ((limits?.phone_day ?? 0) >= PHONE_DAILY_LIMIT) throw new OtpRequestError("Daily OTP limit reached. Please try again tomorrow.", 429, 3600);
  if (useIp && (limits?.ip_hour ?? 0) >= IP_HOURLY_LIMIT) throw new OtpRequestError("Too many OTP requests from this network. Please try again later.", 429, 3600);
  if (useIp && (limits?.ip_day ?? 0) >= IP_DAILY_LIMIT) throw new OtpRequestError("The daily OTP limit for this network has been reached.", 429, 3600);
  await assertOtpVerificationAllowed(phone);

  const otp = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
  const challengeId = crypto.randomUUID();
  await sql(
    `WITH retired AS (
       UPDATE pim_v2.otp_challenges SET expires_at=LEAST(expires_at,now())
       WHERE phone=$1 AND role=$2 AND verified_at IS NULL AND expires_at>now()
     )
     INSERT INTO pim_v2.otp_challenges(id,phone,role,otp_hash,expires_at,request_ip,delivery_status)
     VALUES($3,$1,$2,$4,now()+interval '5 minutes',$5,'PENDING')`,
    [phone, role, challengeId, await digest(`${phone}:${otp}:${serverSecret("OTP_HASH_PEPPER")}`), ip],
  );

  try {
    const delivery = await deliverLoginOtp(phone, otp);
    if (delivery.development && !developmentOtpAllowed(request)) {
      await sql(`UPDATE pim_v2.otp_challenges SET delivery_status='FAILED',expires_at=now() WHERE id=$1`, [challengeId]);
      console.warn("OTP delivery blocked", { provider: "development", environment: appEnvironment() });
      throw new OtpRequestError("SMS verification is unavailable on this website during testing.", 503);
    }
    await sql(`UPDATE pim_v2.otp_challenges SET delivery_status=$2 WHERE id=$1`, [challengeId, delivery.development ? "DEVELOPMENT" : "SENT"]);
    return { devOtp: delivery.development ? otp : undefined, delivery: delivery.development ? "development" : "sms", retryAfter: RESEND_COOLDOWN_SECONDS };
  } catch (error) {
    await sql(`UPDATE pim_v2.otp_challenges SET delivery_status='FAILED',expires_at=now() WHERE id=$1`, [challengeId]);
    if (error instanceof OtpRequestError) throw error;
    console.error("OTP provider delivery failed", { provider: process.env.OTP_PROVIDER ?? "development", category: error instanceof Error ? error.name : "unknown" });
    throw new OtpRequestError("We could not send an OTP right now. Please try again later.", 503, RESEND_COOLDOWN_SECONDS);
  }
}

export function otpErrorResponse(error: unknown) {
  if (!(error instanceof OtpRequestError)) return null;
  return Response.json(
    { error: error.message, retryAfter: error.retryAfter },
    { status: error.status, headers: error.retryAfter ? { "Retry-After": String(error.retryAfter) } : undefined },
  );
}
