import { cookies } from "next/headers";
import { sql } from "./db";

export type Role = "CUSTOMER" | "PANDIT" | "ADMIN";
export type AppUser = { id: string; phone: string; role: Role; name: string | null; city: string | null };
export const SESSION_COOKIE = "pim_v2_session";

export class AuthorizationError extends Error {
  constructor(public status: 401 | 403, message: string) { super(message); }
}

type CachedSession = { user: AppUser; expiresAt: number };

declare global {
  var __pimV2SessionCache: Map<string, CachedSession> | undefined;
}

const sessionCache = globalThis.__pimV2SessionCache ?? new Map<string, CachedSession>();
globalThis.__pimV2SessionCache = sessionCache;

function pruneSessionCache() {
  const now = Date.now();
  for (const [key, value] of sessionCache) {
    if (value.expiresAt <= now) sessionCache.delete(key);
  }
  while (sessionCache.size > 500) {
    const oldest = sessionCache.keys().next().value;
    if (!oldest) break;
    sessionCache.delete(oldest);
  }
}

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(local)) throw new Error("Enter a valid 10-digit Indian mobile number");
  return `+91${local}`;
}

export async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function rememberSession(token: string, user: AppUser) {
  pruneSessionCache();
  sessionCache.set(await digest(token), { user, expiresAt: Date.now() + 60_000 });
}

export async function forgetSession(token: string) {
  sessionCache.delete(await digest(token));
}

export async function currentUser(): Promise<AppUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const tokenHash = await digest(token);
  const cached = sessionCache.get(tokenHash);
  if (cached && cached.expiresAt > Date.now()) return cached.user;
  if (cached) sessionCache.delete(tokenHash);
  const result = await sql<AppUser>(
    `SELECT u.id,u.phone,u.role,u.name,u.city
     FROM pim_v2.sessions s JOIN pim_v2.users u ON u.id=s.user_id
     WHERE s.token_hash=$1 AND s.expires_at > now() LIMIT 1`,
    [tokenHash],
  );
  const user = result.rows[0] ?? null;
  if (user) {
    pruneSessionCache();
    sessionCache.set(tokenHash, { user, expiresAt: Date.now() + 60_000 });
  }
  return user;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new AuthorizationError(401, "Please log in to continue.");
  return user;
}

async function requireRole(role: Role) {
  const user = await requireUser();
  if (user.role !== role) throw new AuthorizationError(403, "You do not have permission to access this page.");
  return user;
}

export const requireCustomer = () => requireRole("CUSTOMER");
export const requirePandit = () => requireRole("PANDIT");
export const requireAdmin = () => requireRole("ADMIN");
