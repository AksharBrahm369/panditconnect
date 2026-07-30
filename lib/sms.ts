type Msg91Response = {
  type?: string;
  message?: string;
};

export async function deliverLoginOtp(phone: string, otp: string) {
  const provider = (process.env.OTP_PROVIDER ?? "development").toLowerCase();
  if (provider === "development") return { delivered: false, development: true };
  if (provider !== "msg91") throw new Error(`Unsupported OTP provider: ${provider}`);

  const authKey = process.env.SMS_PROVIDER_API_KEY?.trim();
  const templateId = process.env.SMS_PROVIDER_TEMPLATE_ID?.trim();
  if (!authKey) throw new Error("MSG91 authentication key is not configured");
  if (!templateId) throw new Error("MSG91 OTP Template ID is not configured");

  const params = new URLSearchParams({
    template_id: templateId,
    mobile: phone.replace(/\D/g, ""),
    authkey: authKey,
    otp,
    otp_expiry: "5",
    otp_length: "6",
  });
  const response = await fetch(`https://control.msg91.com/api/v5/otp?${params}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: "{}",
  });
  const raw = await response.text();
  let result: Msg91Response = {};
  try {
    result = JSON.parse(raw) as Msg91Response;
  } catch {
    result = { message: raw };
  }
  if (!response.ok || result.type !== "success") {
    throw new Error(result.message || `MSG91 rejected the request (${response.status})`);
  }
  return { delivered: true, development: false };
}
