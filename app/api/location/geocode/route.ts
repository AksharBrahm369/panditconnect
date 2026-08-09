import { NextResponse } from "next/server";
import { requireCustomer } from "@/lib/auth";
import { authorizationResponse } from "@/lib/api-auth";
import { applicationUrl } from "@/lib/env";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Result = { lat?: string; lon?: string; display_name?: string };

declare global {
  var __pimV2PostcodeCache: Map<string, { latitude: number; longitude: number; label: string }> | undefined;
}

const cache = globalThis.__pimV2PostcodeCache ?? new Map<string, { latitude: number; longitude: number; label: string }>();
globalThis.__pimV2PostcodeCache = cache;

export async function POST(request: Request) {
  try {
    const user=await requireCustomer();
    await enforceRateLimit(request,"location:geocode",user.id,30,3_600,600);
    const body = await request.json() as { postalCode?: string };
    const postalCode = body.postalCode?.replace(/\D/g, "") ?? "";
    if (!/^[1-9]\d{5}$/.test(postalCode)) {
      return NextResponse.json({ error: "Add a valid 6-digit PIN code to the service address." }, { status: 400 });
    }

    const cached = cache.get(postalCode);
    if (cached) return NextResponse.json({ ...cached, source: "POSTAL_CODE" });

    const endpoint = new URL(process.env.GEOCODING_PROVIDER_URL?.trim() || "https://nominatim.openstreetmap.org/search");
    endpoint.searchParams.set("postalcode", postalCode);
    endpoint.searchParams.set("countrycodes", "in");
    endpoint.searchParams.set("format", "jsonv2");
    endpoint.searchParams.set("limit", "1");

    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        Referer: applicationUrl(),
        "User-Agent": `PanditConnect/1.0 (${applicationUrl()})`,
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error("Geocoding provider unavailable");
    const result = (await response.json() as Result[])[0];
    const latitude = Number(result?.lat);
    const longitude = Number(result?.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: "We could not locate that PIN code. Check it and try again." }, { status: 404 });
    }

    const value = { latitude, longitude, label: result.display_name || `PIN ${postalCode}` };
    cache.set(postalCode, value);
    while (cache.size > 500) cache.delete(cache.keys().next().value!);
    return NextResponse.json({ ...value, source: "POSTAL_CODE" });
  } catch (error) {
    const authResponse = authorizationResponse(error);
    if (authResponse) return authResponse;
    const limited=rateLimitResponse(error);if(limited)return limited;
    return NextResponse.json({ error: "Address location is temporarily unavailable. Try GPS or retry shortly." }, { status: 503 });
  }
}
