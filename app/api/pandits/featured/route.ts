import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { error: "Global Pandit listings are disabled. Ask for GPS access and use nearby matching." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
