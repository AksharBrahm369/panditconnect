import { NextResponse } from "next/server";
import { AuthorizationError } from "./auth";

export function authorizationResponse(error: unknown) {
  if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
  return null;
}
