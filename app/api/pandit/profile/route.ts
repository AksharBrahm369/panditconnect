import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

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
  const body = await request.json() as {
    name?: string; city?: string; experienceYears?: number; languages?: string[]; specialities?: string[];
    bio?: string; baseCharge?: number; isOnline?: boolean; latitude?: number; longitude?: number;
  };
  const validCoordinates = Number.isFinite(body.latitude) && Number.isFinite(body.longitude) &&
    body.latitude! >= -90 && body.latitude! <= 90 && body.longitude! >= -180 && body.longitude! <= 180;
  const availabilityKeys = Object.keys(body).every((key) => ["isOnline", "latitude", "longitude"].includes(key));
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
