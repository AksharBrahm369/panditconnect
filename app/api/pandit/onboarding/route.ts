import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePandit } from "@/lib/auth";
import { authorizationResponse } from "@/lib/api-auth";
import { sql } from "@/lib/db";
import { encryptSensitive } from "@/lib/sensitive-data";

export const dynamic = "force-dynamic";

const referenceSchema = z.object({
  name: z.string().trim().min(2).max(100),
  relationship: z.string().trim().min(2).max(80),
  organisation: z.string().trim().max(150).optional().default(""),
  phone: z.string().regex(/^\+?[0-9]{10,13}$/),
});

const pricingSchema = z.object({
  serviceId: z.string().min(1).max(80),
  price: z.number().int().min(0).max(1_000_000),
  enabled: z.boolean().default(true),
});

const onboardingSchema = z.object({
  legalName: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(180),
  dateOfBirth: z.string().date(),
  city: z.string().trim().min(2).max(100),
  currentAddress: z.string().trim().min(10).max(500),
  experienceYears: z.number().int().min(0).max(80),
  languages: z.array(z.string().trim().min(1).max(50)).min(1).max(12),
  specialities: z.array(z.string().trim().min(1).max(100)).min(1).max(30),
  bio: z.string().trim().min(30).max(1500),
  serviceRadiusKm: z.number().int().min(1).max(100),
  availabilityPreference: z.enum(["AVAILABLE_AFTER_APPROVAL", "OFFLINE"]),
  payoutMethod: z.enum(["BANK", "UPI"]),
  bankAccountName: z.string().trim().max(120).optional().default(""),
  bankAccountNumber: z.string().trim().max(30).optional().default(""),
  bankIfsc: z.string().trim().max(20).optional().default(""),
  upiId: z.string().trim().max(100).optional().default(""),
  references: z.array(referenceSchema).min(1).max(5),
  pricing: z.array(pricingSchema).min(1).max(100),
  acceptPlatformRules: z.literal(true),
  submit: z.boolean().default(false),
}).superRefine((value, context) => {
  if (value.payoutMethod === "BANK" && (!value.bankAccountName || !value.bankAccountNumber || !value.bankIfsc)) {
    context.addIssue({ code: "custom", path: ["bankAccountNumber"], message: "Complete all bank account fields" });
  }
  if (value.payoutMethod === "UPI" && !/^[\w.-]+@[\w.-]+$/.test(value.upiId)) {
    context.addIssue({ code: "custom", path: ["upiId"], message: "Enter a valid UPI ID" });
  }
});

export async function GET() {
  try {
    const user = await requirePandit();
    const [profile, references, pricing, services, documents, review] = await Promise.all([
      sql(`SELECT u.name,u.phone,u.city,p.* FROM pim_v2.users u JOIN pim_v2.pandit_profiles p ON p.user_id=u.id WHERE u.id=$1`, [user.id]),
      sql(`SELECT id,reference_name,relationship,temple_or_organisation,phone,verification_status,verification_note FROM pim_v2.pandit_references WHERE pandit_id=$1 ORDER BY created_at`, [user.id]),
      sql(`SELECT service_id,price,enabled FROM pim_v2.pandit_service_pricing WHERE pandit_id=$1`, [user.id]),
      sql(`SELECT id,name,description,base_price FROM pim_v2.services WHERE active=true ORDER BY name`),
      sql(`SELECT id,document_type,original_name,mime_type,size_bytes,review_status,review_note,uploaded_at FROM pim_v2.pandit_documents WHERE pandit_id=$1 ORDER BY uploaded_at DESC`, [user.id]),
      sql(`SELECT identity_status,document_status,reference_status,knowledge_check_status,bank_status,knowledge_score,admin_note FROM pim_v2.pandit_verification_reviews WHERE pandit_id=$1`, [user.id]),
    ]);
    return NextResponse.json({ profile: profile.rows[0], references: references.rows, pricing: pricing.rows, services: services.rows, documents: documents.rows, review: review.rows[0] ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const authResponse = authorizationResponse(error);
    if (authResponse) return authResponse;
    console.error("Unable to load Pandit onboarding", error);
    return NextResponse.json({ error: "Unable to load onboarding information" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requirePandit();
    const parsed = onboardingSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the form details" }, { status: 400 });
    const value = parsed.data;
    const birthDate = new Date(`${value.dateOfBirth}T00:00:00Z`);
    const age = Math.floor((Date.now() - birthDate.getTime()) / 31_556_952_000);
    if (age < 18 || age > 90) return NextResponse.json({ error: "Pandits must be between 18 and 90 years old" }, { status: 400 });

    if (value.submit) {
      const requiredDocuments = await sql<{ document_type: string }>(`SELECT DISTINCT document_type FROM pim_v2.pandit_documents WHERE pandit_id=$1`, [user.id]);
      const types = new Set(requiredDocuments.rows.map((row) => row.document_type));
      for (const required of ["PROFILE_PHOTO", "GOVERNMENT_ID", "BANK_PROOF"]) {
        if (!types.has(required)) return NextResponse.json({ error: `Upload the required ${required.replaceAll("_", " ").toLowerCase()} before submitting` }, { status: 400 });
      }
    }

    const encryptedAccount = await encryptSensitive(value.payoutMethod === "BANK" ? value.bankAccountNumber : null);
    await sql(`UPDATE pim_v2.users SET name=$2,city=$3 WHERE id=$1`, [user.id, value.legalName, value.city]);
    await sql(
      `UPDATE pim_v2.pandit_profiles SET email=$2,date_of_birth=$3,current_address=$4,
       experience_years=$5,languages=$6,specialities=$7,bio=$8,service_radius_km=$9,availability_preference=$10,
       payout_method=$11,bank_account_name=$12,bank_account_number=$13,bank_ifsc=$14,upi_id=$15,
       platform_rules_accepted_at=COALESCE(platform_rules_accepted_at,now()),
       verification_status=CASE WHEN $16 THEN 'SUBMITTED' ELSE verification_status END,
       submitted_at=CASE WHEN $16 THEN now() ELSE submitted_at END,is_online=false,updated_at=now()
       WHERE user_id=$1`,
      [user.id, value.email, value.dateOfBirth, value.currentAddress, value.experienceYears, value.languages,
        value.specialities, value.bio, value.serviceRadiusKm, value.availabilityPreference, value.payoutMethod, value.bankAccountName || null,
        encryptedAccount, value.bankIfsc || null, value.payoutMethod === "UPI" ? value.upiId : null, value.submit],
    );
    await sql(`DELETE FROM pim_v2.pandit_references WHERE pandit_id=$1`, [user.id]);
    for (const reference of value.references) {
      await sql(`INSERT INTO pim_v2.pandit_references(id,pandit_id,reference_name,relationship,temple_or_organisation,phone) VALUES($1,$2,$3,$4,$5,$6)`,
        [crypto.randomUUID(), user.id, reference.name, reference.relationship, reference.organisation || null, reference.phone]);
    }
    for (const price of value.pricing) {
      await sql(`INSERT INTO pim_v2.pandit_service_pricing(pandit_id,service_id,price,enabled) VALUES($1,$2,$3,$4)
        ON CONFLICT(pandit_id,service_id) DO UPDATE SET price=EXCLUDED.price,enabled=EXCLUDED.enabled,updated_at=now()`,
        [user.id, price.serviceId, price.price, price.enabled]);
    }
    await sql(`INSERT INTO pim_v2.pandit_verification_reviews(pandit_id) VALUES($1) ON CONFLICT(pandit_id) DO NOTHING`, [user.id]);
    if (value.submit) {
      await sql(`INSERT INTO pim_v2.pandit_verification_events(id,pandit_id,action) VALUES($1,$2,'SUBMITTED')`, [crypto.randomUUID(), user.id]);
    }
    return NextResponse.json({ success: true, status: value.submit ? "SUBMITTED" : "DRAFT" });
  } catch (error) {
    const authResponse = authorizationResponse(error);
    if (authResponse) return authResponse;
    console.error("Unable to save Pandit onboarding", error);
    return NextResponse.json({ error: "Unable to save onboarding information" }, { status: 500 });
  }
}
