export function requestIp(request: Request) {
  return (request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "unknown").trim().slice(0, 80);
}

export function requestUserAgent(request: Request) {
  return (request.headers.get("user-agent") || "unknown").slice(0, 300);
}
