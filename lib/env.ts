export type AppEnvironment = "development" | "staging" | "production";

const unsafeSecretMarkers = ["replace-with", "development", "changeme", "example"];

export function appEnvironment(): AppEnvironment {
  const configured = process.env.APP_ENV?.toLowerCase();
  if (configured === "development" || configured === "staging" || configured === "production") return configured;
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production" ? "production" : "development";
}

export function isProductionEnvironment() {
  return appEnvironment() === "production";
}

export function applicationUrl() {
  const configured = process.env.APP_URL?.trim();
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return configured || (vercelHost ? `https://${vercelHost}` : "http://localhost:3000");
}

export function serverSecret(name: "OTP_HASH_PEPPER" | "SESSION_SECRET" | "ARRIVAL_OTP_SECRET") {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (!isProductionEnvironment()) return `local-${name.toLowerCase()}-not-for-production`;
  throw new Error("Server security configuration is incomplete");
}

export function adminPhoneAllowlist() {
  return new Set((process.env.ADMIN_PHONE_ALLOWLIST ?? "").split(",").map((phone) => phone.trim()).filter(Boolean));
}

export function productionConfigurationIssues() {
  const issues: string[] = [];
  if (!process.env.DATABASE_URL?.trim()) issues.push("DATABASE_URL is required");
  const url = applicationUrl();
  if (isProductionEnvironment() && !url.startsWith("https://")) issues.push("APP_URL must use HTTPS in production");
  for (const name of ["OTP_HASH_PEPPER", "SESSION_SECRET", "ARRIVAL_OTP_SECRET"] as const) {
    const value = process.env[name]?.trim() ?? "";
    if (isProductionEnvironment() && (value.length < 32 || unsafeSecretMarkers.some((marker) => value.toLowerCase().includes(marker)))) {
      issues.push(`${name} must be a strong secret of at least 32 characters`);
    }
  }
  if (!process.env.APP_ENV && isProductionEnvironment()) issues.push("APP_ENV should be explicitly set to production");
  if (isProductionEnvironment()) {
    const provider = process.env.OTP_PROVIDER?.trim().toLowerCase();
    if (!provider || provider === "development") issues.push("OTP_PROVIDER must use a real SMS provider in production");
    if (provider === "msg91" && !process.env.SMS_PROVIDER_API_KEY?.trim()) issues.push("SMS_PROVIDER_API_KEY is required for MSG91");
    if (provider === "msg91" && !process.env.SMS_PROVIDER_TEMPLATE_ID?.trim()) issues.push("SMS_PROVIDER_TEMPLATE_ID is required for MSG91");
  }
  return issues;
}

export function assertRuntimeConfiguration() {
  const issues = productionConfigurationIssues();
  if (issues.length) throw new Error("Server security configuration is incomplete");
}
