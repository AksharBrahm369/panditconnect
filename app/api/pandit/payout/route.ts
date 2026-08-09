import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizationResponse } from "@/lib/api-auth";
import { requirePandit } from "@/lib/auth";
import { sql } from "@/lib/db";
import { notifyAdmins } from "@/lib/push-notifications";
import { encryptSensitive } from "@/lib/sensitive-data";

export const dynamic = "force-dynamic";
const schema = z.object({
  payoutMethod: z.enum(["UPI", "BANK"]),
  upiId: z.string().trim().max(100).default(""),
  bankAccountName: z.string().trim().max(120).default(""),
  bankAccountNumber: z.string().trim().regex(/^\d{0,30}$/).default(""),
  bankIfsc: z.string().trim().max(20).default(""),
}).strict();

export async function GET() {
  try {
    const user = await requirePandit();
    const result = await sql(`SELECT p.payout_method,p.upi_id,p.bank_account_name,p.bank_ifsc,(p.bank_account_number IS NOT NULL) AS has_bank_account,COALESCE(v.bank_status,'PENDING') AS bank_status FROM pim_v2.pandit_profiles p LEFT JOIN pim_v2.pandit_verification_reviews v ON v.pandit_id=p.user_id WHERE p.user_id=$1`, [user.id]);
    if (!result.rows[0]) return NextResponse.json({ error: "Complete Pandit onboarding first" }, { status: 409 });
    const history=await sql(`SELECT i.id,i.gross_amount,i.commission_amount,i.net_amount,i.status,i.reconciliation_reference,i.failure_reason,i.paid_at,s.name AS service_name,b.completed_at FROM pim_v2.payout_items i LEFT JOIN pim_v2.bookings b ON b.id=i.booking_id LEFT JOIN pim_v2.services s ON s.id=b.service_id WHERE i.pandit_id=$1 ORDER BY COALESCE(i.paid_at,b.completed_at) DESC LIMIT 50`,[user.id]);
    return NextResponse.json({ payout: result.rows[0],history:history.rows }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authorizationResponse(error) ?? NextResponse.json({ error: "Unable to load payout settings" }, { status: 500 }); }
}

export async function PUT(request: Request) {
  try {
    const user = await requirePandit();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check payout details" }, { status: 400 });
    const value = parsed.data;
    if (value.payoutMethod === "UPI" && !/^[\w.-]+@[\w.-]+$/.test(value.upiId)) return NextResponse.json({ error: "Enter a valid UPI ID" }, { status: 400 });
    const existing = await sql<{ has_bank_account: boolean }>(`SELECT bank_account_number IS NOT NULL AS has_bank_account FROM pim_v2.pandit_profiles WHERE user_id=$1`, [user.id]);
    if (!existing.rows[0]) return NextResponse.json({ error: "Complete Pandit onboarding first" }, { status: 409 });
    if (value.payoutMethod === "BANK" && (!value.bankAccountName || !value.bankIfsc || (!value.bankAccountNumber && !existing.rows[0].has_bank_account))) return NextResponse.json({ error: "Complete account holder, account number and IFSC" }, { status: 400 });
    const encrypted = value.bankAccountNumber ? await encryptSensitive(value.bankAccountNumber) : null;
    await sql(`WITH updated AS (
      UPDATE pim_v2.pandit_profiles SET payout_method=$2,upi_id=CASE WHEN $2='UPI' THEN $3 ELSE NULL END,bank_account_name=CASE WHEN $2='BANK' THEN $4 ELSE NULL END,bank_account_number=CASE WHEN $2='UPI' THEN NULL WHEN $5::text IS NULL THEN bank_account_number ELSE $5 END,bank_ifsc=CASE WHEN $2='BANK' THEN $6 ELSE NULL END,updated_at=now() WHERE user_id=$1 RETURNING user_id
    ) INSERT INTO pim_v2.pandit_verification_reviews(pandit_id,bank_status) SELECT user_id,'PENDING' FROM updated ON CONFLICT(pandit_id) DO UPDATE SET bank_status='PENDING',updated_at=now()`, [user.id,value.payoutMethod,value.upiId||null,value.bankAccountName||null,encrypted,value.bankIfsc||null]);
    await notifyAdmins({ title: "Pandit payout details changed", body: `${user.name ?? "A Pandit"} updated private payout information. Please verify it before enabling payouts.`, url: "/admin#admin-pandits", eventType: "PANDIT_PAYOUT_UPDATED" });
    return NextResponse.json({ success: true });
  } catch (error) { return authorizationResponse(error) ?? NextResponse.json({ error: "Unable to save payout settings" }, { status: 500 }); }
}
