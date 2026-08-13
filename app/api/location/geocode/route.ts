import { NextResponse } from "next/server";
import { requireCustomer } from "@/lib/auth";
import { authorizationResponse } from "@/lib/api-auth";
import { applicationUrl } from "@/lib/env";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Result = { lat?: string; lon?: string; display_name?: string; address?: { postcode?: string } };

declare global {
  var __pimV2PostcodeCache: Map<string, { latitude: number; longitude: number; label: string }> | undefined;
}

const cache = globalThis.__pimV2PostcodeCache ?? new Map<string, { latitude: number; longitude: number; label: string }>();
globalThis.__pimV2PostcodeCache = cache;

export async function POST(request: Request) {
  try {
    const user=await requireCustomer();
    await enforceRateLimit(request,"location:geocode",user.id,30,3_600,600);
    const body = await request.json() as { postalCode?: string; latitude?: number; longitude?: number };
    const postalCode = body.postalCode?.replace(/\D/g, "") ?? "";
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
      const endpoint = new URL(process.env.REVERSE_GEOCODING_PROVIDER_URL?.trim() || "https://nominatim.openstreetmap.org/reverse");
      endpoint.searchParams.set("lat", String(latitude));
      endpoint.searchParams.set("lon", String(longitude));
      endpoint.searchParams.set("format", "jsonv2");
      endpoint.searchParams.set("addressdetails", "1");
      const response = await fetch(endpoint, {
        headers: { Accept: "application/json", Referer: applicationUrl(), "User-Agent": `PanditConnect/1.0 (${applicationUrl()})` },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error("Reverse geocoding provider unavailable");
      const result = await response.json() as Result;
      return NextResponse.json({
        latitude,
        longitude,
        label: result.display_name || "Current GPS location",
        postalCode: result.address?.postcode?.replace(/\D/g, "").slice(0, 6) || null,
        source: "GPS",
      });
    }
    if (!/^[1-9]\d{5}$/.test(postalCode)) {
      return NextResponse.json({ error: "Use your current location or enter a valid 6-digit PIN code." }, { status: 400 });
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
    const resolvedLatitude = Number(result?.lat);
    const resolvedLongitude = Number(result?.lon);
    if (!Number.isFinite(resolvedLatitude) || !Number.isFinite(resolvedLongitude)) {
      return NextResponse.json({ error: "We could not locate that PIN code. Check it and try again." }, { status: 404 });
    }

    const value = { latitude: resolvedLatitude, longitude: resolvedLongitude, label: result.display_name || `PIN ${postalCode}` };
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
