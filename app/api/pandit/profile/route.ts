import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  city: z.string().trim().min(2).max(100).optional(),
  experienceYears: z.number().int().min(0).max(80).optional(),
  languages: z.array(z.string().trim().min(1).max(50)).max(12).optional(),
  specialities: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  bio: z.string().trim().max(1500).optional(),
  baseCharge: z.number().int().min(0).max(1_000_000).optional(),
  isOnline: z.boolean().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  consultationOnline: z.boolean().optional(),
  consultationRate5Min: z.number().int().min(20).max(5000).optional(),
}).strict();

export async function GET() {
  const user = await currentUser();
  if (!user || user.role !== "PANDIT") return NextResponse.json({ error: "Pandit login required" }, { status: 401 });
  const profile = await sql(
    `SELECT u.name,u.city,p.* FROM pim_v2.users u JOIN pim_v2.pandit_profiles p ON p.user_id=u.id WHERE u.id=$1`,
    [user.id],
  );
  return NextResponse.json(
    { profile: profile.rows[0] },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user || user.role !== "PANDIT") return NextResponse.json({ error: "Pandit login required" }, { status: 401 });
  const parsed = profileUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid profile update" }, { status: 400 });
  const body = parsed.data;
  const validCoordinates = Number.isFinite(body.latitude) && Number.isFinite(body.longitude) &&
    body.latitude! >= -90 && body.latitude! <= 90 && body.longitude! >= -180 && body.longitude! <= 180;
  const availabilityKeys = Object.keys(body).every((key) => ["isOnline", "latitude", "longitude"].includes(key));
  const consultationKeys = Object.keys(body).every((key) => ["consultationOnline", "consultationRate5Min"].includes(key));
  if (consultationKeys && typeof body.consultationOnline === "boolean") {
    const rate = Math.min(5000, Math.max(20, Math.floor(Number(body.consultationRate5Min) || 99)));
    const consultation = await sql(
      `UPDATE pim_v2.pandit_profiles
       SET consultation_online=$2,consultation_rate_5min=$3,updated_at=now()
       WHERE user_id=$1 AND ($2=false OR verification_status='APPROVED')
       RETURNING consultation_online,consultation_rate_5min`,
      [user.id, body.consultationOnline, rate],
    );
    if (!consultation.rows[0]) {
      return NextResponse.json({ error: "Admin approval is required before offering live guidance." }, { status: 409 });
    }
    return NextResponse.json({ success: true, profile: consultation.rows[0] });
  }
  if (typeof body.isOnline !== "boolean" && validCoordinates &&
      Object.keys(body).every((key) => ["latitude", "longitude"].includes(key))) {
    const location = await sql(
      `UPDATE pim_v2.pandit_profiles SET latitude=$2,longitude=$3,updated_at=now()
       WHERE user_id=$1 AND is_online=true RETURNING updated_at`,
      [user.id, body.latitude, body.longitude],
    );
    return NextResponse.json({ success: true, tracked: Boolean(location.rows[0]) });
  }
  if (typeof body.isOnline === "boolean" && availabilityKeys) {
    if (body.isOnline && !validCoordinates) {
      return NextResponse.json({ error: "Current GPS location is required before going online" }, { status: 400 });
    }
    const availability = await sql(
      `UPDATE pim_v2.pandit_profiles
       SET is_online=$2,
           latitude=CASE WHEN $2 THEN $3 ELSE latitude END,
           longitude=CASE WHEN $2 THEN $4 ELSE longitude END,
           updated_at=now()
       WHERE user_id=$1 AND ($2=false OR verification_status='APPROVED')
       RETURNING is_online,latitude,longitude`,
      [user.id, body.isOnline, validCoordinates ? body.latitude : null, validCoordinates ? body.longitude : null],
    );
    if (!availability.rows[0]) {
      return NextResponse.json({ error: "Admin approval is required before going online" }, { status: 409 });
    }
    return NextResponse.json({ success: true, isOnline: availability.rows[0].is_online });
  }
  await sql(`UPDATE pim_v2.users SET name=COALESCE($2,name),city=COALESCE($3,city) WHERE id=$1`, [user.id, body.name?.trim() || null, body.city?.trim() || null]);
  await sql(
    `UPDATE pim_v2.pandit_profiles SET
      experience_years=COALESCE($2,experience_years),languages=COALESCE($3,languages),
      specialities=COALESCE($4,specialities),bio=COALESCE($5,bio),base_charge=COALESCE($6,base_charge),
      is_online=COALESCE($7,is_online),
      latitude=COALESCE($8,latitude),longitude=COALESCE($9,longitude),
      verification_status=CASE
        WHEN verification_status IN ('INCOMPLETE','CHANGES_REQUESTED')
          AND COALESCE($2,experience_years)>0
          AND cardinality(COALESCE($3,languages))>0
          AND COALESCE($5,bio)<>''
        THEN 'PENDING'
        ELSE verification_status
      END,
      updated_at=now() WHERE user_id=$1`,
    [user.id, body.experienceYears ?? null, body.languages ?? null, body.specialities ?? null, body.bio?.trim() || null, body.baseCharge ?? null, body.isOnline ?? null, validCoordinates ? body.latitude : null, validCoordinates ? body.longitude : null],
  );
  return NextResponse.json({ success: true });
}
