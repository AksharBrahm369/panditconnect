import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { pujaPreparation } from "@/lib/puja-preparation";

export const dynamic = "force-dynamic";

function period(value: unknown) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const start = typeof item.start === "string" ? item.start : typeof item.start_time === "string" ? item.start_time : null;
  const end = typeof item.end === "string" ? item.end : typeof item.end_time === "string" ? item.end_time : null;
  return start && end ? `${start} - ${end}` : start ?? end;
}

function named(value: unknown) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  return typeof item.name === "string" ? item.name : null;
}

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user || user.role !== "CUSTOMER") return NextResponse.json({ error: "Customer login required" }, { status: 401 });
  try {
    await enforceRateLimit(request, "ritual:preparation", user.id, 30, 3_600, 120);
    const params = new URL(request.url).searchParams;
    const serviceId = params.get("serviceId")?.trim() ?? "";
    const date = params.get("date")?.trim() ?? "";
    const latitude = Number(params.get("lat"));
    const longitude = Number(params.get("lng"));
    if (!/^[a-z0-9-]{2,80}$/i.test(serviceId) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: "Choose a Puja, valid date and current GPS location." }, { status: 400 });
    }
    const guide = pujaPreparation(serviceId);
    const apiKey = process.env.TATHAASTU_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ guide, panchang: null, panchangStatus: "NOT_CONFIGURED", message: "Samagri is ready. Live Panchang needs the free server API key to be configured." });
    }
    const url = new URL("https://api.tathaastuapi.com/v1/panchang");
    url.searchParams.set("date", date);
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("include", "timings");
    const response = await fetch(url, { headers: { "X-API-Key": apiKey, Accept: "application/json" }, signal: AbortSignal.timeout(8_000), next: { revalidate: 21_600 } });
    const raw = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok || !raw) {
      return NextResponse.json({ guide, panchang: null, panchangStatus: "UNAVAILABLE", message: response.status === 429 ? "Panchang free-tier limit is temporarily reached. Please try later." : "Live Panchang is temporarily unavailable. Please confirm the muhurta with your Pandit." });
    }
    const data = (raw.data && typeof raw.data === "object" ? raw.data : raw) as Record<string, unknown>;
    const tithi = data.tithi as Record<string, unknown> | undefined;
    const nakshatra = data.nakshatra as Record<string, unknown> | undefined;
    const timings = (data.timings && typeof data.timings === "object" ? data.timings : {}) as Record<string, unknown>;
    return NextResponse.json({
      guide,
      panchangStatus: "READY",
      panchang: {
        date,
        tithi: named(tithi) ?? "Not returned",
        paksha: typeof tithi?.paksha === "string" ? tithi.paksha : null,
        tithiPeriod: period(tithi?.period),
        nakshatra: named(nakshatra) ?? "Not returned",
        nakshatraPeriod: period(nakshatra?.period),
        yoga: named(data.yoga),
        karana: named(data.karana),
        sunrise: typeof timings.sunrise === "string" ? timings.sunrise : null,
        sunset: typeof timings.sunset === "string" ? timings.sunset : null,
        abhijitMuhurat: period(timings.abhijit_muhurat ?? timings.abhijit),
        brahmaMuhurat: period(timings.brahma_muhurta ?? timings.brahma_muhurat),
        rahuKaal: period(timings.rahu_kaal ?? timings.rahukaal),
        engine: data.engine && typeof data.engine === "object" ? data.engine : null,
      },
      message: "These are location-and-date Panchang calculations, not final approval of a ritual-specific muhurta.",
    }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    const limited = rateLimitResponse(error);
    if (limited) return limited;
    console.error("Ritual preparation lookup failed", error);
    return NextResponse.json({ error: "Unable to prepare the Puja guide right now." }, { status: 500 });
  }
}
