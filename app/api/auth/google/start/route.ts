import { NextResponse } from "next/server";
import { createGoogleOAuthState, GOOGLE_OAUTH_COOKIE, GOOGLE_OAUTH_MAX_AGE_SECONDS, googleCodeChallenge, googleOAuthConfig } from "@/lib/google-oauth";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const role = requestUrl.searchParams.get("role")?.toUpperCase() === "PANDIT" ? "PANDIT" : "CUSTOMER";
  try {
    const config = googleOAuthConfig();
    const { oauthState, cookie } = await createGoogleOAuthState(role, requestUrl.searchParams.get("next"));
    const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorizationUrl.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state: oauthState.state,
      nonce: oauthState.nonce,
      code_challenge: await googleCodeChallenge(oauthState.verifier),
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set(GOOGLE_OAUTH_COOKIE, cookie, {
      httpOnly: true,
      secure: requestUrl.protocol === "https:",
      sameSite: "lax",
      path: "/api/auth/google",
      maxAge: GOOGLE_OAUTH_MAX_AGE_SECONDS,
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    console.error("Unable to start Google sign-in", error);
    const login = new URL("/login", request.url);
    login.searchParams.set("role", role.toLowerCase());
    login.searchParams.set("google_error", "Google sign-in is not configured yet. You can continue with mobile OTP.");
    return NextResponse.redirect(login);
  }
}
