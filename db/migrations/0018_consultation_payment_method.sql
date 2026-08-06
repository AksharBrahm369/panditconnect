ALTER TABLE pim_v2.consultations
  ADD COLUMN IF NOT EXISTS payment_method text;

DO $$ BEGIN
  ALTER TABLE pim_v2.consultations ADD CONSTRAINT consultation_payment_method_check
    CHECK (payment_method IS NULL OR payment_method IN ('CASH','UPI','CARD'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
