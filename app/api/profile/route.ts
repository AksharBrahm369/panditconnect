import { NextResponse } from "next/server";
import { z } from "zod";
import { refreshCurrentSessionUser, requireUser } from "@/lib/auth";
import { authorizationResponse } from "@/lib/api-auth";
import { sql } from "@/lib/db";
import { notifyAdmins } from "@/lib/push-notifications";
import { INDIAN_LANGUAGE_VALUES } from "@/lib/indian-languages";

export const dynamic = "force-dynamic";

const shared = {
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(100),
  email: z.union([z.literal(""), z.string().trim().email().max(180)]),
};
const customerSchema = z.object({
  ...shared,
  defaultAddress: z.string().trim().max(500),
  preferredLanguage: z.enum(INDIAN_LANGUAGE_VALUES),
}).strict();
const servicePriceSchema = z.object({
  serviceId: z.string().trim().min(1).max(80),
  price: z.number().int().min(0).max(1_000_000),
  enabled: z.boolean(),
});
const panditSchema = z.object({
  ...shared,
  currentAddress: z.string().trim().min(10).max(500),
  experienceYears: z.number().int().min(0).max(80),
  languages: z.array(z.enum(INDIAN_LANGUAGE_VALUES)).min(1).max(INDIAN_LANGUAGE_VALUES.length),
  specialities: z.array(z.string().trim().min(1).max(100)).min(1).max(30),
  bio: z.string().trim().min(30).max(1500),
  serviceRadiusKm: z.number().int().min(1).max(25),
  pricing: z.array(servicePriceSchema).min(1).max(100),
}).strict().superRefine((value, context) => {
  if (!value.pricing.some((service) => service.enabled)) context.addIssue({ code: "custom", path: ["pricing"], message: "Enable at least one Puja service" });
  if (new Set(value.pricing.map((service) => service.serviceId)).size !== value.pricing.length) context.addIssue({ code: "custom", path: ["pricing"], message: "Duplicate Puja service pricing is not allowed" });
});

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role === "CUSTOMER") {
      await sql(`INSERT INTO pim_v2.customer_profiles(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`, [user.id]);
      const result = await sql(`SELECT u.name,u.phone,u.email AS account_email,u.auth_provider,u.city,c.email,c.default_address,c.preferred_language FROM pim_v2.users u JOIN pim_v2.customer_profiles c ON c.user_id=u.id WHERE u.id=$1`, [user.id]);
      return NextResponse.json({ role: user.role, profile: result.rows[0] }, { headers: { "Cache-Control": "private, no-store" } });
    }
    if (user.role === "PANDIT") {
      const [result, pricing] = await Promise.all([
        sql(`SELECT u.name,u.phone,u.email AS account_email,u.auth_provider,u.city,p.email,p.current_address,p.experience_years,p.languages,p.specialities,p.bio,p.service_radius_km,p.base_charge,p.verification_status FROM pim_v2.users u JOIN pim_v2.pandit_profiles p ON p.user_id=u.id WHERE u.id=$1`, [user.id]),
        sql(`SELECT s.id AS service_id,s.name,s.description,COALESCE(pp.price,ps.charge,s.base_price) AS price,COALESCE(pp.enabled,ps.pandit_id IS NOT NULL,false) AS enabled FROM pim_v2.services s LEFT JOIN pim_v2.pandit_service_pricing pp ON pp.service_id=s.id AND pp.pandit_id=$1 LEFT JOIN pim_v2.pandit_services ps ON ps.service_id=s.id AND ps.pandit_id=$1 WHERE s.active=true ORDER BY s.name`, [user.id]),
      ]);
      return NextResponse.json({ role: user.role, profile: result.rows[0], pricing: pricing.rows }, { headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "Profile editing is unavailable for this role" }, { status: 403 });
  } catch (error) {
    return authorizationResponse(error) ?? NextResponse.json({ error: "Unable to load profile" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    if (user.role === "CUSTOMER") {
      const parsed = customerSchema.safeParse(await request.json());
      if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check your profile details" }, { status: 400 });
      const value = parsed.data;
      await sql(`WITH updated_user AS (
        UPDATE pim_v2.users SET name=$2,city=$3 WHERE id=$1 RETURNING id
      )
      INSERT INTO pim_v2.customer_profiles(user_id,email,default_address,preferred_language,updated_at)
      SELECT id,$4,$5,$6,now() FROM updated_user
      ON CONFLICT(user_id) DO UPDATE SET email=EXCLUDED.email,default_address=EXCLUDED.default_address,preferred_language=EXCLUDED.preferred_language,updated_at=now()`,
      [user.id,value.name,value.city,value.email||null,value.defaultAddress||null,value.preferredLanguage]);
      await refreshCurrentSessionUser({ ...user, name: value.name, city: value.city });
      return NextResponse.json({ success: true });
    }
    if (user.role === "PANDIT") {
      const parsed = panditSchema.safeParse(await request.json());
      if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check your professional details" }, { status: 400 });
      const value = parsed.data;
      const available = await sql<{ id: string }>(`SELECT id FROM pim_v2.services WHERE active=true AND id=ANY($1::text[])`, [value.pricing.map((service) => service.serviceId)]);
      if (available.rowCount !== value.pricing.length) return NextResponse.json({ error: "One or more Puja services are unavailable" }, { status: 400 });
      const baseCharge = Math.min(...value.pricing.filter((service) => service.enabled).map((service) => service.price));
      const updated = await sql(`WITH updated_user AS (
        UPDATE pim_v2.users SET name=$2,city=$3
        WHERE id=$1 AND EXISTS(SELECT 1 FROM pim_v2.pandit_profiles WHERE user_id=$1)
        RETURNING id
      )
      UPDATE pim_v2.pandit_profiles p SET email=$4,current_address=$5,experience_years=$6,languages=$7,specialities=$8,bio=$9,service_radius_km=$10,base_charge=$11,updated_at=now()
      FROM updated_user u WHERE p.user_id=u.id RETURNING p.user_id`,
      [user.id,value.name,value.city,value.email||null,value.currentAddress,value.experienceYears,value.languages,value.specialities,value.bio,value.serviceRadiusKm,baseCharge]);
      if (!updated.rowCount) return NextResponse.json({ error: "Complete your Pandit onboarding before editing this profile" }, { status: 409 });
      for (const service of value.pricing) {
        await sql(`INSERT INTO pim_v2.pandit_service_pricing(pandit_id,service_id,price,enabled) VALUES($1,$2,$3,$4) ON CONFLICT(pandit_id,service_id) DO UPDATE SET price=EXCLUDED.price,enabled=EXCLUDED.enabled,updated_at=now()`, [user.id,service.serviceId,service.price,service.enabled]);
      }
      await sql(`INSERT INTO pim_v2.pandit_services(pandit_id,service_id,charge) SELECT pandit_id,service_id,price FROM pim_v2.pandit_service_pricing WHERE pandit_id=$1 AND enabled=true AND EXISTS(SELECT 1 FROM pim_v2.pandit_profiles WHERE user_id=$1 AND verification_status='APPROVED') ON CONFLICT(pandit_id,service_id) DO UPDATE SET charge=EXCLUDED.charge`, [user.id]);
      await sql(`DELETE FROM pim_v2.pandit_services ps WHERE ps.pandit_id=$1 AND NOT EXISTS(SELECT 1 FROM pim_v2.pandit_service_pricing pp WHERE pp.pandit_id=$1 AND pp.service_id=ps.service_id AND pp.enabled=true)`, [user.id]);
      await refreshCurrentSessionUser({ ...user, name: value.name, city: value.city });
      await notifyAdmins({ title: "Pandit profile updated", body: `${value.name} updated professional profile information.`, url: "/admin#admin-pandits", eventType: "PANDIT_PROFILE_UPDATED" });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Profile editing is unavailable for this role" }, { status: 403 });
  } catch (error) {
    return authorizationResponse(error) ?? NextResponse.json({ error: "Unable to save profile" }, { status: 500 });
  }
}
