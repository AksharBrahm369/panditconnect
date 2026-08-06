import { NextRequest, NextResponse } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function proxy(request: NextRequest) {
  if (SAFE_METHODS.has(request.method)) return NextResponse.next();

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site" || fetchSite === "same-site") {
    return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403, headers: { Vary: "Sec-Fetch-Site, Origin" } });
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== request.nextUrl.origin) {
        return NextResponse.json({ error: "Untrusted request origin" }, { status: 403, headers: { Vary: "Sec-Fetch-Site, Origin" } });
      }
    } catch {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403, headers: { Vary: "Sec-Fetch-Site, Origin" } });
    }
  }

  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
