import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";

export async function GET() {
  const user = await currentUser();
  return NextResponse.json(
    user ? { authenticated: true, role: user.role } : { authenticated: false },
    { headers: { "Cache-Control": "private, no-store, max-age=0, must-revalidate", Vary: "Cookie" } },
  );
}
