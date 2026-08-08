import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { cancellationFee } from "@/lib/booking-risk";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || user.role !== "CUSTOMER") return NextResponse.json({ error: "Customer login required" }, { status: 401 });
  const { id } = await context.params;
  const result = await sql<{ status: string; amount: number; accepted_at: string | null }>(`SELECT status,amount,accepted_at FROM pim_v2.bookings WHERE id=$1 AND customer_id=$2`, [id,user.id]);
  const booking = result.rows[0];
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (!['REQUESTED','ACCEPTED','ON_THE_WAY','ARRIVED'].includes(booking.status)) return NextResponse.json({ error: "This booking can no longer be cancelled online. Contact support." }, { status: 409 });
  return NextResponse.json({ ...cancellationFee(booking.status, booking.amount, booking.accepted_at), status: booking.status }, { headers: { "Cache-Control": "private, no-store" } });
}
