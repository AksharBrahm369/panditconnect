import { NextResponse } from "next/server";
import { digest, randomToken, rememberSession, SESSION_COOKIE, type AppUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { exchangeGoogleCode, GOOGLE_OAUTH_COOKIE, parseGoogleOAuthState } from "@/lib/google-oauth";

function loginError(request: Request, message: string, role = "customer") {
  const target = new URL("/login", request.url);
  target.searchParams.set("role", role.toLowerCase());
  target.searchParams.set("google_error", message);
  const response = NextResponse.redirect(target);
  response.cookies.set(GOOGLE_OAUTH_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: new URL(request.url).protocol === "https:", path: "/api/auth/google", maxAge: 0 });
  return response;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const cookie = request.headers.get("cookie")?.match(/(?:^|;\s*)pim_google_oauth=([^;]+)/)?.[1];
  const oauthState = await parseGoogleOAuthState(cookie ? decodeURIComponent(cookie) : undefined);
  if (!oauthState || requestUrl.searchParams.get("state") !== oauthState.state) return loginError(request, "Google sign-in session expired. Please try again.");
  if (requestUrl.searchParams.get("error")) return loginError(request, "Google sign-in was cancelled.", oauthState.role);
  const code = requestUrl.searchParams.get("code");
  if (!code) return loginError(request, "Google did not return a sign-in code. Please try again.", oauthState.role);

  try {
    const identity = await exchangeGoogleCode(code, oauthState);
    const emailOwner = await sql<{ google_subject: string | null; role: string }>(
      `SELECT google_subject,role FROM pim_v2.users WHERE lower(email)=lower($1) AND google_subject IS DISTINCT FROM $2 LIMIT 1`,
      [identity.email, identity.subject],
    );
    if (emailOwner.rows[0]) return loginError(request, "This email is already connected to another account. Sign in using its original method or contact support.", oauthState.role);

    const result = await sql<AppUser & { account_status: string }>(
      `INSERT INTO pim_v2.users(id,phone,email,google_subject,auth_provider,role,name,last_login_at)
       VALUES($1,NULL,$2,$3,'GOOGLE',$4,$5,now())
       ON CONFLICT(google_subject) WHERE google_subject IS NOT NULL DO UPDATE
       SET email=EXCLUDED.email,name=COALESCE(pim_v2.users.name,EXCLUDED.name),last_login_at=now()
       RETURNING id,phone,email,role,name,city,account_status`,
      [crypto.randomUUID(), identity.email, identity.subject, oauthState.role, identity.name],
    );
    const user = result.rows[0];
    if (user.role !== oauthState.role) return loginError(request, `This Google account is registered as ${user.role.toLowerCase()}. Select that role to continue.`, oauthState.role);
    const inactivePandit = user.role === "PANDIT" && ["RESTRICTED", "BLOCKED"].includes(user.account_status);
    if (user.account_status !== "ACTIVE" && !inactivePandit) return loginError(request, "This account is unavailable. Contact support to restore access.", oauthState.role);
    if (user.role === "PANDIT") {
      await sql(`INSERT INTO pim_v2.pandit_profiles(user_id,email) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET email=COALESCE(pim_v2.pandit_profiles.email,EXCLUDED.email)`, [user.id, identity.email]);
    } else {
      await sql(`INSERT INTO pim_v2.customer_profiles(user_id,email) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET email=COALESCE(pim_v2.customer_profiles.email,EXCLUDED.email)`, [user.id, identity.email]);
    }

    const token = randomToken();
    await sql(`INSERT INTO pim_v2.sessions(id,user_id,token_hash,session_role,expires_at) VALUES($1,$2,$3,$4,now()+interval '30 days')`, [crypto.randomUUID(), user.id, await digest(token), user.role]);
    if (!inactivePandit) await rememberSession(token, user);
    const response = NextResponse.redirect(new URL(oauthState.next, request.url));
    response.cookies.set(GOOGLE_OAUTH_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: requestUrl.protocol === "https:", path: "/api/auth/google", maxAge: 0 });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "strict",
      secure: requestUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    console.error("Google sign-in callback failed", error);
    return loginError(request, "Google sign-in could not be completed. Please try again or use mobile OTP.", oauthState.role);
  }
}
