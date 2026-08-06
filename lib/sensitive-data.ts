import { digest } from "./auth";

async function encryptionKey() {
  const secret = process.env.ONBOARDING_DATA_SECRET || process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("ONBOARDING_DATA_SECRET must contain at least 32 characters");
  const hash = await digest(secret);
  const bytes = Uint8Array.from(hash.match(/.{2}/g)!.map((part) => Number.parseInt(part, 16)));
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSensitive(value: string | null | undefined) {
  if (!value) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), new TextEncoder().encode(value));
  return `${Buffer.from(iv).toString("base64url")}.${Buffer.from(encrypted).toString("base64url")}`;
}

export async function decryptSensitive(value: string | null | undefined) {
  if (!value) return null;
  const [iv, encrypted] = value.split(".");
  if (!iv || !encrypted) return null;
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: Buffer.from(iv, "base64url") },
    await encryptionKey(),
    Buffer.from(encrypted, "base64url"),
  );
  return new TextDecoder().decode(decrypted);
}
