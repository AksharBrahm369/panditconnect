import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("login offers Google sign-in for the selected customer or Pandit role", async () => {
  const login = await read("components/login-form.tsx");
  assert.match(login, /Continue with Google/);
  assert.match(login, /api\/auth\/google\/start\?role=\$\{role\}/);
});

test("Google OAuth uses server flow protections and verified stable identity", async () => {
  const oauth = await read("lib/google-oauth.ts");
  const start = await read("app/api/auth/google/start/route.ts");
  const callback = await read("app/api/auth/google/callback/route.ts");
  assert.match(start, /code_challenge_method: "S256"/);
  assert.match(start, /state: oauthState\.state/);
  assert.match(start, /nonce: oauthState\.nonce/);
  assert.match(oauth, /tokeninfo\?id_token=/);
  assert.match(oauth, /claims\.nonce !== state\.nonce/);
  assert.match(callback, /ON CONFLICT\(google_subject\)/);
  assert.doesNotMatch(callback, /access_token/);
});

test("Google credentials remain server-only and migration stores the Google subject", async () => {
  const migration = await read("db/migrations/0032_google_sign_in.sql");
  const env = await read(".env.example");
  assert.match(migration, /google_subject/);
  assert.match(env, /GOOGLE_OAUTH_CLIENT_SECRET/);
  assert.doesNotMatch(env, /NEXT_PUBLIC_GOOGLE/);
});
