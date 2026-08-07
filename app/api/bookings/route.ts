import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { notifyAdmins, notifyUser } from "@/lib/push-notifications";
import { decryptArrivalOtp, encryptArrivalOtp } from "@/lib/arrival-otp";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const privateResponse = <T,>(body: T, init?: ResponseInit) =>
  NextResponse.json(body, {
    ...init,
    headers: {
      ...init?.headers,
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      Vary: "Cookie",
    },
  });

export async function GET() {
  const user = await currentUser();
  if (!user) return privateResponse({ error: "Please log in" }, { status: 401 });

  if (user.role === "CUSTOMER") {
    const result = await sql(
      `SELECT b.id,b.status,b.address,b.amount,b.arrival_otp,b.created_at,b.request_type,
        b.situation,b.preferred_language,b.materials_option,b.latitude,b.longitude,
        b.customer_rating,b.rating_comment,b.rated_at,b.payment_method,b.payment_status,b.payment_confirmed_at,
        s.name AS service_name,pu.name AS pandit_name,p.latitude AS pandit_latitude,
        p.longitude AS pandit_longitude,p.updated_at AS location_updated_at
       FROM pim_v2.bookings b
       JOIN pim_v2.services s ON s.id=b.service_id
       LEFT JOIN pim_v2.users pu ON pu.id=b.pandit_id
       LEFT JOIN pim_v2.pandit_profiles p ON p.user_id=b.pandit_id
       WHERE b.customer_id=$1 ORDER BY b.created_at DESC LIMIT 20`,
      [user.id],
    );
    const bookings = await Promise.all(result.rows.map(async (booking) => ({
      ...booking,
      arrival_otp: await decryptArrivalOtp(String(booking.arrival_otp)).catch(() => "Unavailable"),
    })));
    return privateResponse({ customerId: user.id, bookings });
  }

  if (user.role === "PANDIT") {
    const result = await sql(
      `SELECT b.id,b.status,
        CASE WHEN b.status='REQUESTED' THEN 'Exact address shared after acceptance' ELSE b.address END AS address,
        b.amount,b.created_at,b.request_type,b.situation,b.preferred_language,b.materials_option,
        b.payment_method,b.payment_status,b.payment_confirmed_at,
        CASE WHEN b.status='REQUESTED' THEN NULL ELSE b.latitude END AS customer_latitude,
        CASE WHEN b.status='REQUESTED' THEN NULL ELSE b.longitude END AS customer_longitude,
        s.name AS service_name,cu.name AS customer_name
       FROM pim_v2.bookings b
       JOIN pim_v2.services s ON s.id=b.service_id
       JOIN pim_v2.users cu ON cu.id=b.customer_id
       WHERE b.pandit_id=$1 ORDER BY b.created_at DESC LIMIT 20`,
      [user.id],
    );
    return privateResponse({ panditId: user.id, bookings: result.rows });
  }

  return privateResponse({ bookings: [] });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || user.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Customer login required" }, { status: 401 });
  }

  const body = await request.json() as {
    serviceId?: string;
    address?: string;
    notes?: string;
    latitude?: number;
    longitude?: number;
    requestType?: "PANDIT_SOS" | "NEED_GUIDANCE" | "KNOWN_PUJA";
    situation?: string;
    preferredLanguage?: string;
    materialsOption?: "HAVE_MATERIALS" | "PANDIT_BRINGS" | "NEED_GUIDANCE";
    panditId?: string;
  };
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const preferredLanguage = body.preferredLanguage?.trim();
  if (!body.serviceId || !body.address?.trim() || !body.panditId) {
    return NextResponse.json({ error: "Choose a nearby Pandit and enter the service address" }, { status: 400 });
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: "Allow current GPS location before sending the request" }, { status: 400 });
  }
  if (!preferredLanguage || !["Hindi", "Marathi", "Gujarati", "English", "Sanskrit"].includes(preferredLanguage)) {
    return NextResponse.json({ error: "Choose a supported preferred language" }, { status: 400 });
  }

  const match = await sql<{ id: string; charge: number; name: string; distance_km: string; eta_minutes: number }>(
    `WITH matches AS (
       SELECT u.id,u.name,ps.charge,least(COALESCE(p.service_radius_km,25),25) AS service_radius_km,
         6371 * acos(least(1, greatest(-1,
           cos(radians($2)) * cos(radians(p.latitude)) *
           cos(radians(p.longitude) - radians($3)) +
           sin(radians($2)) * sin(radians(p.latitude))
         ))) AS distance
       FROM pim_v2.pandit_profiles p
       JOIN pim_v2.users u ON u.id=p.user_id
       JOIN pim_v2.pandit_services ps ON ps.pandit_id=p.user_id AND ps.service_id=$1
       WHERE u.id=$4 AND u.id<>$5 AND p.verification_status='APPROVED' AND p.is_online=true
         AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
         AND EXISTS (SELECT 1 FROM unnest(p.languages) listed_language WHERE lower(listed_language)=lower($6))
     )
     SELECT id,name,charge,round(distance::numeric,1)::text AS distance_km,
       greatest(10,round(distance*3)::int+8) AS eta_minutes
     FROM matches WHERE distance <= service_radius_km`,
    [body.serviceId, latitude, longitude, body.panditId, user.id, preferredLanguage],
  );
  const pandit = match.rows[0];
  if (!pandit) {
    return NextResponse.json(
      { error: `This Pandit is unavailable for the selected Puja, ${preferredLanguage} language, or your current location. Choose another matching Pandit.` },
      { status: 409 },
    );
  }

  const requestType = ["PANDIT_SOS", "NEED_GUIDANCE", "KNOWN_PUJA"].includes(body.requestType ?? "")
    ? body.requestType!
    : "NEED_GUIDANCE";
  const materialsOption = ["HAVE_MATERIALS", "PANDIT_BRINGS", "NEED_GUIDANCE"].includes(body.materialsOption ?? "")
    ? body.materialsOption!
    : "NEED_GUIDANCE";
  const otp = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
  const id = crypto.randomUUID();
  await sql(
    `INSERT INTO pim_v2.bookings(
       id,customer_id,pandit_id,service_id,address,latitude,longitude,notes,amount,status,arrival_otp,
       request_type,situation,preferred_language,materials_option
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'REQUESTED',$10,$11,$12,$13,$14)`,
    [
      id, user.id, pandit.id, body.serviceId, body.address.trim().slice(0, 500), latitude, longitude,
      body.notes?.trim().slice(0, 1000) || null, pandit.charge, await encryptArrivalOtp(otp), requestType,
      body.situation?.trim().slice(0, 1200) || null, preferredLanguage, materialsOption,
    ],
  );
  await notifyUser(pandit.id, { title: "New urgent Puja request", body: `${body.serviceId.replaceAll("-", " ")} request is waiting for your response.`, url: "/pandit#pandit-requests", eventType: "BOOKING_REQUESTED" });
  await notifyAdmins({ title: "New Puja request", body: `${pandit.name} received a nearby ${body.serviceId.replaceAll("-", " ")} request.`, url: "/admin#admin-bookings", eventType: "BOOKING_REQUESTED" });
  return NextResponse.json({
    success: true,
    bookingId: id,
    arrivalOtp: otp,
    matchedPandit: { name: pandit.name, distanceKm: pandit.distance_km, etaMinutes: pandit.eta_minutes },
  });
}
