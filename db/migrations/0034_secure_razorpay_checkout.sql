ALTER TABLE pim_v2.consultations
  DROP CONSTRAINT IF EXISTS consultations_status_check;

ALTER TABLE pim_v2.consultations
  DROP CONSTRAINT IF EXISTS consultation_status_check;

ALTER TABLE pim_v2.consultations
  ADD CONSTRAINT consultation_status_check
  CHECK (status IN ('AWAITING_PAYMENT','ACTIVE','COMPLETED','CANCELLED'));

CREATE INDEX IF NOT EXISTS consultation_payment_waiting_idx
  ON pim_v2.consultations(customer_id,started_at DESC)
  WHERE status='AWAITING_PAYMENT';
