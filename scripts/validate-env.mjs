const environment = (process.env.APP_ENV || (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production" ? "production" : "development")).toLowerCase();
const problems = [];
if (!process.env.DATABASE_URL?.trim()) problems.push("DATABASE_URL is required");
if (!new Set(["development", "staging", "production"]).has(environment)) problems.push("APP_ENV must be development, staging or production");
if (environment === "production") {
  const appUrl = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  if (!appUrl.startsWith("https://")) problems.push("APP_URL must use HTTPS in production");
  for (const name of ["OTP_HASH_PEPPER", "SESSION_SECRET", "ARRIVAL_OTP_SECRET"]) {
    const value = process.env[name]?.trim() || "";
    if (value.length < 32 || /replace-with|development|changeme|example/i.test(value)) problems.push(`${name} must be a strong secret of at least 32 characters`);
  }
  if (!process.env.APP_ENV) problems.push("APP_ENV must be explicitly set in production");
  const provider = process.env.OTP_PROVIDER?.trim().toLowerCase();
  if (!provider || provider === "development") problems.push("OTP_PROVIDER must use a real SMS provider in production");
  if (provider === "msg91" && !process.env.SMS_PROVIDER_API_KEY?.trim()) problems.push("SMS_PROVIDER_API_KEY is required for MSG91");
  if (provider === "msg91" && !process.env.SMS_PROVIDER_TEMPLATE_ID?.trim()) problems.push("SMS_PROVIDER_TEMPLATE_ID is required for MSG91");
}
if (problems.length) {
  console.error(`Environment validation failed:\n- ${problems.join("\n- ")}`);
  process.exitCode = 1;
} else console.log(`Environment validation passed for ${environment}.`);
