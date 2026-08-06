import { constantTimeEqual, digest } from "./auth";
import { serverSecret } from "./env";

async function key() {
  const bytes = Uint8Array.from((await digest(serverSecret("ARRIVAL_OTP_SECRET"))).match(/.{2}/g)!.map((part) => Number.parseInt(part, 16)));
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptArrivalOtp(otp: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(otp));
  return `v1.${Buffer.from(iv).toString("base64url")}.${Buffer.from(ciphertext).toString("base64url")}`;
}

export async function decryptArrivalOtp(stored: string) {
  if (/^\d{6}$/.test(stored)) return stored; // Compatibility for bookings created before encryption.
  const [version, iv, ciphertext] = stored.split(".");
  if (version !== "v1" || !iv || !ciphertext) throw new Error("Invalid arrival OTP data");
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: Buffer.from(iv, "base64url") },
    await key(),
    Buffer.from(ciphertext, "base64url"),
  );
  return new TextDecoder().decode(plaintext);
}

export async function verifyArrivalOtp(stored: string, submitted: string) {
  if (!/^\d{6}$/.test(submitted)) return false;
  try { return constantTimeEqual(await decryptArrivalOtp(stored), submitted); }
  catch { return false; }
}
