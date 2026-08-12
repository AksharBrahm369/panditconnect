import { constantTimeEqual, randomToken, type Role } from "./auth";
import { applicationUrl, serverSecret } from "./env";

export const GOOGLE_OAUTH_COOKIE = "pim_google_oauth";
export const GOOGLE_OAUTH_MAX_AGE_SECONDS = 10 * 60;

export type GoogleOAuthState = {
  state: string;
  nonce: string;
  verifier: string;
  role: Extract<Role, "CUSTOMER" | "PANDIT">;
  next: string;
  createdAt: number;
};

export type GoogleIdentity = {
  subject: string;
  email: string;
  name: string | null;
  picture: string | null;
};

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
function textToBase64Url(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlToText(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

async function hmac(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(serverSecret("SESSION_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

export function googleOAuthConfigured() {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() && process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim());
}

export function googleOAuthConfig() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("Google sign-in is not configured yet");
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() || `${applicationUrl().replace(/\/$/, "")}/api/auth/google/callback`;
  return { clientId, clientSecret, redirectUri };
}

export function safeOAuthNext(role: GoogleOAuthState["role"], value?: string | null) {
  if (role === "CUSTOMER" && value?.startsWith("/customer") && !value.startsWith("//")) return value;
  return role === "PANDIT" ? "/pandit" : "/customer";
}

export async function createGoogleOAuthState(role: GoogleOAuthState["role"], next?: string | null) {
  const oauthState: GoogleOAuthState = {
    state: randomToken(),
    nonce: randomToken(),
    verifier: `${randomToken()}${randomToken()}`,
    role,
    next: safeOAuthNext(role, next),
    createdAt: Date.now(),
  };
  const payload = textToBase64Url(JSON.stringify(oauthState));
  return { oauthState, cookie: `${payload}.${await hmac(payload)}` };
}

export async function parseGoogleOAuthState(cookieValue?: string) {
  if (!cookieValue) return null;
  const [payload, signature, ...extra] = cookieValue.split(".");
  if (!payload || !signature || extra.length || !constantTimeEqual(signature, await hmac(payload))) return null;
  try {
    const state = JSON.parse(base64UrlToText(payload)) as Partial<GoogleOAuthState>;
    if (!state.state || !state.nonce || !state.verifier || !state.role || !state.next || !state.createdAt) return null;
    if (!['CUSTOMER', 'PANDIT'].includes(state.role)) return null;
    if (Date.now() - state.createdAt > GOOGLE_OAUTH_MAX_AGE_SECONDS * 1000 || state.createdAt > Date.now() + 30_000) return null;
    return { ...state, next: safeOAuthNext(state.role, state.next) } as GoogleOAuthState;
  } catch {
    return null;
  }
}

export async function googleCodeChallenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return bytesToBase64Url(new Uint8Array(digest));
}

export async function exchangeGoogleCode(code: string, state: GoogleOAuthState): Promise<GoogleIdentity> {
  const config = googleOAuthConfig();
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
      code_verifier: state.verifier,
    }),
    cache: "no-store",
  });
  const tokenData = await tokenResponse.json() as { id_token?: string; error?: string };
  if (!tokenResponse.ok || !tokenData.id_token) throw new Error(tokenData.error || "Google did not return a valid identity token");

  // Google's tokeninfo endpoint verifies the ID-token signature and lifetime.
  const validationResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenData.id_token)}`, { cache: "no-store" });
  const claims = await validationResponse.json() as Record<string, unknown>;
  if (!validationResponse.ok) throw new Error("Google identity verification failed");
  const issuer = String(claims.iss ?? "");
  const verified = claims.email_verified === true || claims.email_verified === "true";
  if (claims.aud !== config.clientId || !["accounts.google.com", "https://accounts.google.com"].includes(issuer)) throw new Error("Google identity was issued for another application");
  if (claims.nonce !== state.nonce) throw new Error("Google sign-in replay protection failed");
  if (!verified || typeof claims.sub !== "string" || typeof claims.email !== "string") throw new Error("Choose a Google account with a verified email address");
  if (Number(claims.exp ?? 0) <= Math.floor(Date.now() / 1000)) throw new Error("Google sign-in expired. Please try again");
  return {
    subject: claims.sub,
    email: claims.email.trim().toLowerCase(),
    name: typeof claims.name === "string" ? claims.name.trim().slice(0, 120) || null : null,
    picture: typeof claims.picture === "string" ? claims.picture : null,
  };
}
