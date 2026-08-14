import { NextResponse } from "next/server";
import { currentUser, digest } from "@/lib/auth";
import { sql } from "@/lib/db";
import { notifyAdmins, notifyUser } from "@/lib/push-notifications";
import { decryptArrivalOtp, encryptArrivalOtp } from "@/lib/arrival-otp";
import { CANCELLATION_POLICY_SNAPSHOT, CANCELLATION_POLICY_VERSION, recordBookingEvent } from "@/lib/booking-risk";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { advanceDueBookingDispatches, startBookingDispatch } from "@/lib/booking-dispatch";
import { isIndianLanguage } from "@/lib/indian-languages";

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
    await advanceDueBookingDispatches(user.id);
    const result = await sql(
      `SELECT b.id,b.status,b.address,b.amount,b.arrival_otp,b.created_at,b.request_type,b.scheduled_at,
        b.situation,b.preferred_language,b.materials_option,b.latitude,b.longitude,
        b.service_id,b.dispatch_status,b.search_radius_km,b.max_search_radius_km,b.travel_surcharge,b.next_expansion_at,
        (SELECT count(*)::int FROM pim_v2.booking_offers active_offer WHERE active_offer.booking_id=b.id AND active_offer.status='OFFERED' AND active_offer.expires_at>now()) AS active_offer_count,
        CASE WHEN b.status='DECLINED' THEN (SELECT count(*)::int
          FROM pim_v2.pandit_profiles available
          JOIN pim_v2.users available_user ON available_user.id=available.user_id AND available_user.account_status='ACTIVE'
          JOIN pim_v2.pandit_services available_service ON available_service.pandit_id=available.user_id AND available_service.service_id=b.service_id
          WHERE available.verification_status='APPROVED'
            AND (b.request_type='SCHEDULED_PUJA' OR available.is_online=true)
            AND available.latitude IS NOT NULL AND available.longitude IS NOT NULL
            AND available.user_id<>b.customer_id
            AND (b.preferred_language IS NULL OR EXISTS(SELECT 1 FROM unnest(available.languages) listed_language WHERE lower(listed_language)=lower(b.preferred_language)))
            AND 6371*acos(least(1,greatest(-1,cos(radians(b.latitude))*cos(radians(available.latitude))*cos(radians(available.longitude)-radians(b.longitude))+sin(radians(b.latitude))*sin(radians(available.latitude)))))<=least(COALESCE(available.service_radius_km,25),25)
            AND ((b.scheduled_at IS NULL AND NOT EXISTS(SELECT 1 FROM pim_v2.bookings busy WHERE busy.pandit_id=available.user_id AND busy.id<>b.id AND busy.status IN ('REQUESTED','ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS')))
              OR (b.scheduled_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pim_v2.bookings busy WHERE busy.pandit_id=available.user_id AND busy.id<>b.id AND busy.scheduled_at BETWEEN b.scheduled_at-interval '3 hours' AND b.scheduled_at+interval '3 hours' AND busy.status IN ('REQUESTED','ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS'))))
        ) ELSE 0 END AS available_now_count,
        b.customer_rating,b.rating_comment,b.rated_at,b.payment_method,b.payment_status,b.payment_confirmed_at,
        b.cancellation_fee,b.cancellation_fee_status,b.cancellation_reason,b.cancelled_at,b.proposed_amount,b.price_change_reason,b.price_change_status,
        s.name AS service_name,pu.name AS pandit_name,
        CASE WHEN b.status IN ('ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS') THEN pu.phone ELSE NULL END AS pandit_phone,
        p.latitude AS pandit_latitude,
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
    const balance=await sql<{outstanding_balance:number}>(`SELECT COALESCE(sum(amount),0)::int AS outstanding_balance FROM pim_v2.account_ledger WHERE user_id=$1 AND entry_type='CANCELLATION_FEE' AND status='OUTSTANDING'`,[user.id]);
    return privateResponse({ customerId: user.id, bookings, account:{outstandingBalance:balance.rows[0]?.outstanding_balance??0} });
  }

  if (user.role === "PANDIT") {
    await advanceDueBookingDispatches();
    const result = await sql(
      `SELECT b.id,b.status,
        CASE WHEN b.status='REQUESTED' THEN 'Exact address shared after acceptance' ELSE b.address END AS address,
        CASE WHEN b.status='REQUESTED' AND offered.pandit_id=$1 THEN offered.service_amount+offered.travel_surcharge ELSE b.amount END AS amount,
        b.created_at,b.request_type,b.scheduled_at,b.situation,b.preferred_language,b.materials_option,
        b.cancellation_reason,b.cancelled_at,b.arrived_at,b.cancellation_fee,b.cancellation_fee_status,b.proposed_amount,b.price_change_reason,b.price_change_status,
        b.payment_method,b.payment_status,b.payment_confirmed_at,b.customer_cash_confirmed_at,b.pandit_cash_confirmed_at,
        CASE WHEN b.status='REQUESTED' THEN NULL ELSE b.latitude END AS customer_latitude,
        CASE WHEN b.status='REQUESTED' THEN NULL ELSE b.longitude END AS customer_longitude,
        s.name AS service_name,cu.name AS customer_name
       FROM pim_v2.bookings b
       JOIN pim_v2.services s ON s.id=b.service_id
       JOIN pim_v2.users cu ON cu.id=b.customer_id
       LEFT JOIN pim_v2.booking_offers offered ON offered.booking_id=b.id AND offered.pandit_id=$1 AND offered.status='OFFERED' AND offered.expires_at>now()
       WHERE b.pandit_id=$1 OR (b.status='REQUESTED' AND offered.pandit_id=$1)
       ORDER BY b.created_at DESC LIMIT 20`,
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
  try { await enforceRateLimit(request,"booking:create",user.id,10,3_600,900); } catch(error) { return rateLimitResponse(error)!; }

  const body = await request.json() as {
    serviceId?: string;
    address?: string;
    postalCode?: string;
    notes?: string;
    latitude?: number;
    longitude?: number;
    requestType?: "PANDIT_SOS" | "NEED_GUIDANCE" | "KNOWN_PUJA" | "SCHEDULED_PUJA";
    scheduledAt?: string;
    situation?: string;
    preferredLanguage?: string;
    materialsOption?: "HAVE_MATERIALS" | "PANDIT_BRINGS" | "NEED_GUIDANCE";
    panditId?: string;
    dispatchMode?: "BROADCAST";
    dispatchMaxRadiusKm?: 5 | 10 | 20 | 40;
    policyAccepted?: boolean;
    policyVersion?: string;
    clientRequestId?: string;
  };
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const preferredLanguage = body.preferredLanguage?.trim();
  const addressPin = body.address?.match(/(?:^|\D)([1-9]\d{2}[\s-]?\d{3})(?!\d)/)?.[1]?.replace(/\D/g, "") ?? "";
  const postalCode = (body.postalCode ?? addressPin).replace(/\D/g, "");
  if (body.policyAccepted !== true || body.policyVersion !== CANCELLATION_POLICY_VERSION) {
    return NextResponse.json({ error: "Review and accept the cancellation policy before booking" }, { status: 400 });
  }
  if(!body.clientRequestId||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.clientRequestId))return NextResponse.json({error:"Booking confirmation expired. Go back and start the request again."},{status:400});
  const isBroadcast = body.dispatchMode === "BROADCAST";
  if (isBroadcast && ![5,10,20,40].includes(Number(body.dispatchMaxRadiusKm))) {
    return NextResponse.json({ error: "Choose a maximum search distance of 5, 10, 20 or 40 km" }, { status: 400 });
  }
  if (!body.serviceId || !body.address?.trim() || (!body.panditId && !isBroadcast)) {
    return NextResponse.json({ error: "Choose a nearby Pandit or start the wider search, then enter the service address" }, { status: 400 });
  }
  if (!/^[1-9]\d{5}$/.test(postalCode)) return NextResponse.json({ error: "Enter a valid 6-digit Indian PIN code for the service address" }, { status: 400 });
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: "Allow current GPS location before sending the request" }, { status: 400 });
  }
  if (!preferredLanguage || !isIndianLanguage(preferredLanguage)) {
    return NextResponse.json({ error: "Choose a supported preferred language" }, { status: 400 });
  }
  const isScheduled = body.requestType === "SCHEDULED_PUJA";
  const scheduledAt = isScheduled ? new Date(body.scheduledAt ?? "") : null;
  const minimumScheduleTime = Date.now() + 2 * 60 * 60 * 1000;
  const maximumScheduleTime = Date.now() + 180 * 24 * 60 * 60 * 1000;
  if (isScheduled && (!scheduledAt || !Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() < minimumScheduleTime || scheduledAt.getTime() > maximumScheduleTime)) {
    return NextResponse.json({ error: "Choose a Puja time at least 2 hours from now and within the next 6 months" }, { status: 400 });
  }
  const accountRisk = await sql<{ outstanding: number; restricted_until: string | null; requires_prepayment: boolean }>(
    `SELECT
       COALESCE((SELECT sum(amount)::int FROM pim_v2.account_ledger WHERE user_id=$1 AND entry_type='CANCELLATION_FEE' AND status='OUTSTANDING'),0) AS outstanding,
       r.restricted_until,COALESCE(r.requires_prepayment,false) AS requires_prepayment
     FROM (SELECT 1) seed LEFT JOIN pim_v2.customer_risk_profiles r ON r.user_id=$1`, [user.id],
  );
  const risk = accountRisk.rows[0];
  if (risk?.outstanding > 0) return NextResponse.json({ error: `Your account has an outstanding cancellation balance of ₹${risk.outstanding}. Contact support to pay or dispute it before booking again.`, code: "OUTSTANDING_BALANCE" }, { status: 409 });
  if (risk?.restricted_until && new Date(risk.restricted_until).getTime() > Date.now()) return NextResponse.json({ error: `Booking is temporarily restricted until ${new Date(risk.restricted_until).toLocaleDateString("en-IN")}. Contact support if this is incorrect.`, code: "ACCOUNT_RESTRICTED" }, { status: 403 });
  if (risk?.requires_prepayment) return NextResponse.json({ error: "This account requires prepaid booking after repeated late cancellations. Online prepayment is not enabled yet; contact support for review.", code: "PREPAYMENT_REQUIRED" }, { status: 409 });
  const overlap = await sql(
    isScheduled
      ? `SELECT 1 FROM pim_v2.bookings WHERE customer_id=$1 AND status IN ('REQUESTED','ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS') AND (scheduled_at IS NULL OR scheduled_at BETWEEN $2::timestamptz - interval '3 hours' AND $2::timestamptz + interval '3 hours') LIMIT 1`
      : `SELECT 1 FROM pim_v2.bookings WHERE customer_id=$1 AND status IN ('REQUESTED','ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS') LIMIT 1`,
    isScheduled ? [user.id,scheduledAt!.toISOString()] : [user.id],
  );
  if (overlap.rows[0]) return NextResponse.json({ error: "You already have an active or overlapping Puja booking. Complete or cancel it before creating another request.", code: "OVERLAPPING_BOOKING" }, { status: 409 });

  const match = isBroadcast ? await sql<{ id: string | null; charge: number; name: string; distance_km: string; eta_minutes: number }>(
    `SELECT NULL::uuid AS id,base_price AS charge,'Nearby approved Pandits'::text AS name,'0'::text AS distance_km,10 AS eta_minutes
     FROM pim_v2.services WHERE id=$1`,
    [body.serviceId],
  ) : await sql<{ id: string; charge: number; name: string; distance_km: string; eta_minutes: number }>(
    `WITH matches AS (
       SELECT u.id,u.name,ps.charge,least(COALESCE(p.service_radius_km,25),25) AS service_radius_km,
         6371 * acos(least(1, greatest(-1,
           cos(radians($2)) * cos(radians(p.latitude)) *
           cos(radians(p.longitude) - radians($3)) +
           sin(radians($2)) * sin(radians(p.latitude))
         ))) AS distance
       FROM pim_v2.pandit_profiles p
       JOIN pim_v2.users u ON u.id=p.user_id AND u.account_status='ACTIVE'
       JOIN pim_v2.pandit_services ps ON ps.pandit_id=p.user_id AND ps.service_id=$1
       WHERE u.id=$4 AND u.id<>$5 AND p.verification_status='APPROVED' AND ($7::boolean OR p.is_online=true)
         AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
         AND EXISTS (SELECT 1 FROM unnest(p.languages) listed_language WHERE lower(listed_language)=lower($6))
         AND (NOT $7::boolean OR NOT EXISTS (
           SELECT 1 FROM pim_v2.bookings busy
           WHERE busy.pandit_id=p.user_id
             AND busy.scheduled_at BETWEEN $8::timestamptz - interval '3 hours' AND $8::timestamptz + interval '3 hours'
             AND busy.status IN ('REQUESTED','ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS')
         ))
     )
     SELECT id,name,charge,round(distance::numeric,1)::text AS distance_km,
       greatest(10,round(distance*3)::int+8) AS eta_minutes
     FROM matches WHERE distance <= service_radius_km`,
    [body.serviceId, latitude, longitude, body.panditId, user.id, preferredLanguage, isScheduled, scheduledAt?.toISOString() ?? null],
  );
  const pandit = match.rows[0];
  if (!pandit) {
    return NextResponse.json(
      { error: isBroadcast ? "This Puja service is unavailable." : `This Pandit is unavailable for the selected Puja, ${preferredLanguage} language, or your current location. Choose another matching Pandit.` },
      { status: 409 },
    );
  }

  const requestType = ["PANDIT_SOS", "NEED_GUIDANCE", "KNOWN_PUJA", "SCHEDULED_PUJA"].includes(body.requestType ?? "")
    ? body.requestType!
    : "NEED_GUIDANCE";
  const materialsOption = ["HAVE_MATERIALS", "PANDIT_BRINGS", "NEED_GUIDANCE"].includes(body.materialsOption ?? "")
    ? body.materialsOption!
    : "NEED_GUIDANCE";
  const otp = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
  const id = crypto.randomUUID();
  let created: { rows: Array<{ id:string }> };
  try {
    created=await sql<{id:string}>(
      `INSERT INTO pim_v2.bookings(
       id,customer_id,pandit_id,service_id,address,latitude,longitude,notes,amount,status,arrival_otp,
       request_type,situation,preferred_language,materials_option,scheduled_at,request_expires_at,
       policy_version,policy_accepted_at,policy_snapshot,policy_ip_hash,policy_device_hash,client_request_id,
       dispatch_status,search_radius_km,max_search_radius_km,next_expansion_at
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'REQUESTED',$10,$11,$12,$13,$14,$15,
       CASE WHEN $21='SEARCHING' THEN NULL ELSE now()+CASE WHEN $11='SCHEDULED_PUJA' THEN interval '24 hours' ELSE interval '5 minutes' END END,
       $16,now(),$17::jsonb,$18,$19,$20,$21,0,$22,CASE WHEN $21='SEARCHING' THEN now() ELSE NULL END)
     ON CONFLICT(customer_id,client_request_id) WHERE client_request_id IS NOT NULL DO NOTHING RETURNING id`,
    [
      id, user.id, pandit.id, body.serviceId, `${body.address.trim().replace(/,?\s*PIN\s*[-:]?\s*[1-9]\d{5}\s*$/i, "")}, PIN ${postalCode}`.slice(0, 500), latitude, longitude,
      body.notes?.trim().slice(0, 1000) || null, pandit.charge, await encryptArrivalOtp(otp), requestType,
      body.situation?.trim().slice(0, 1200) || null, preferredLanguage, materialsOption, scheduledAt?.toISOString() ?? null,
      CANCELLATION_POLICY_VERSION,JSON.stringify(CANCELLATION_POLICY_SNAPSHOT),
      await digest(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"),
      await digest(request.headers.get("user-agent") || "unknown"),
      body.clientRequestId,
      isBroadcast ? "SEARCHING" : "NONE",
      isBroadcast && [5,10,20,40].includes(Number(body.dispatchMaxRadiusKm)) ? Number(body.dispatchMaxRadiusKm) : 0,
      ],
    );
  } catch (error) {
    if ((error as { code?:string }).code === "23505") return NextResponse.json({error:"You already submitted this request or have an overlapping active booking. Check My bookings before trying again.",code:"DUPLICATE_OR_OVERLAPPING_REQUEST"},{status:409});
    throw error;
  }
  if(!created.rows[0])return NextResponse.json({error:"This booking request was already submitted. Check My bookings before trying again.",code:"DUPLICATE_REQUEST"},{status:409});
  await recordBookingEvent({ bookingId:id,actorId:user.id,actorRole:user.role,eventType:isBroadcast?"BOOKING_BROADCAST_STARTED":"BOOKING_CREATED",toStatus:"REQUESTED",metadata:{ requestType,scheduledAt:scheduledAt?.toISOString() ?? null,policyVersion:CANCELLATION_POLICY_VERSION,panditId:pandit.id,amount:pandit.charge,maxRadiusKm:body.dispatchMaxRadiusKm } });
  const scheduleCopy = scheduledAt ? ` for ${scheduledAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}` : "";
  const dispatch = isBroadcast ? await startBookingDispatch(id) : null;
  if (!isBroadcast && pandit.id) await notifyUser(pandit.id, { title: isScheduled ? "New scheduled Puja request" : "New urgent Puja request", body: `${body.serviceId.replaceAll("-", " ")} request${scheduleCopy} is waiting for your response.`, url: "/pandit#pandit-requests", eventType: "BOOKING_REQUESTED" });
  await notifyAdmins({ title: isBroadcast ? "Wider Pandit search started" : "New Puja request", body: isBroadcast ? `A customer approved an automatic nearby search up to ${body.dispatchMaxRadiusKm} km.` : `${pandit.name} received a nearby ${body.serviceId.replaceAll("-", " ")} request.`, url: "/admin#admin-bookings", eventType: "BOOKING_REQUESTED" });
  return NextResponse.json({
    success: true,
    bookingId: id,
    arrivalOtp: otp,
    matchedPandit: isBroadcast ? undefined : { name: pandit.name, distanceKm: pandit.distance_km, etaMinutes: pandit.eta_minutes },
    dispatch,
  });
}
