export function paymentsEnabled() {
  const provider = process.env.PAYMENT_PROVIDER?.trim().toLowerCase();
  return Boolean(
    provider &&
    provider !== "development" &&
    process.env.PAYMENT_PROVIDER_KEY_ID?.trim() &&
    process.env.PAYMENT_PROVIDER_KEY_SECRET?.trim(),
  );
}
