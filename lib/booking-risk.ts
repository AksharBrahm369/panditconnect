import { sql } from "./db";

export const CANCELLATION_POLICY_VERSION = "2026-08-v1";
export const CANCELLATION_POLICY_SNAPSHOT = {
  version: CANCELLATION_POLICY_VERSION,
  requested: { fee: 0, label: "Free before acceptance" },
  acceptedGraceMinutes: 5,
  acceptedAfterGraceFee: 49,
  onTheWayMaximumFee: 99,
  onTheWayPercentage: 20,
  arrivedMaximumFee: 199,
  arrivedPercentage: 30,
  afterStart: "Cancellation unavailable; contact support",
};

export function cancellationFee(status: string, amount: number, acceptedAt?: string | null) {
  if (status === "REQUESTED") return { fee: 0, stage: "BEFORE_ACCEPTANCE", free: true };
  if (status === "ACCEPTED") {
    const graceEndsAt = acceptedAt ? new Date(acceptedAt).getTime() + 5 * 60_000 : Date.now() + 5 * 60_000;
    return Date.now() <= graceEndsAt
      ? { fee: 0, stage: "ACCEPTED_GRACE", free: true, graceEndsAt: new Date(graceEndsAt).toISOString() }
      : { fee: 49, stage: "ACCEPTED_AFTER_GRACE", free: false };
  }
  if (status === "ON_THE_WAY") return { fee: Math.min(99, Math.max(1, Math.round(amount * .2))), stage: "PANDIT_TRAVELLING", free: false };
  if (status === "ARRIVED") return { fee: Math.min(199, Math.max(1, Math.round(amount * .3))), stage: "PANDIT_ARRIVED", free: false };
  return { fee: 0, stage: "NOT_CANCELLABLE", free: false };
}
export async function recordBookingEvent(input: { bookingId: string; actorId?: string | null; actorRole?: string | null; eventType: string; fromStatus?: string | null; toStatus?: string | null; metadata?: Record<string, unknown> }) {
  await sql(
    `INSERT INTO pim_v2.booking_events(id,booking_id,actor_id,actor_role,event_type,from_status,to_status,metadata)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
    [crypto.randomUUID(), input.bookingId, input.actorId ?? null, input.actorRole ?? null, input.eventType, input.fromStatus ?? null, input.toStatus ?? null, JSON.stringify(input.metadata ?? {})],
  );
}
