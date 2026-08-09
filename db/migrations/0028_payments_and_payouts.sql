CREATE TABLE IF NOT EXISTS pim_v2.payment_transactions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES pim_v2.users(id),
  booking_id uuid REFERENCES pim_v2.bookings(id) ON DELETE SET NULL,
  consultation_id uuid REFERENCES pim_v2.consultations(id) ON DELETE SET NULL,
  purpose text NOT NULL CHECK (purpose IN ('SERVICE_PAYMENT','CANCELLATION_FEE','CONSULTATION')),
  amount integer NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR',
  provider text NOT NULL,
  provider_order_id text UNIQUE,
  provider_payment_id text UNIQUE,
  provider_signature text,
  status text NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED','PENDING','CAPTURED','FAILED','REFUND_PENDING','REFUNDED','PARTIALLY_REFUNDED','DISPUTED')),
  idempotency_key text NOT NULL,
  failure_code text,
  failure_description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  captured_at timestamptz,
  UNIQUE(user_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS payment_transaction_status_idx ON pim_v2.payment_transactions(status,created_at);
CREATE INDEX IF NOT EXISTS payment_transaction_booking_idx ON pim_v2.payment_transactions(booking_id,created_at DESC);

CREATE TABLE IF NOT EXISTS pim_v2.payment_webhook_events (
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload_hash text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text,
  PRIMARY KEY(provider,event_id)
);

CREATE TABLE IF NOT EXISTS pim_v2.refunds (
  id uuid PRIMARY KEY,
  payment_transaction_id uuid NOT NULL REFERENCES pim_v2.payment_transactions(id),
  support_case_id uuid REFERENCES pim_v2.support_cases(id) ON DELETE SET NULL,
  amount integer NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED','APPROVED','PROCESSING','COMPLETED','FAILED','REJECTED')),
  provider_refund_id text UNIQUE,
  failure_reason text,
  requested_by uuid REFERENCES pim_v2.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES pim_v2.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS refund_status_idx ON pim_v2.refunds(status,created_at);

CREATE TABLE IF NOT EXISTS pim_v2.payout_batches (
  id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','APPROVED','PROCESSING','COMPLETED','PARTIAL','FAILED','CANCELLED')),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  gross_amount integer NOT NULL DEFAULT 0,
  commission_amount integer NOT NULL DEFAULT 0,
  net_amount integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES pim_v2.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES pim_v2.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS pim_v2.payout_items (
  id uuid PRIMARY KEY,
  batch_id uuid NOT NULL REFERENCES pim_v2.payout_batches(id) ON DELETE CASCADE,
  pandit_id uuid NOT NULL REFERENCES pim_v2.users(id),
  booking_id uuid REFERENCES pim_v2.bookings(id) ON DELETE SET NULL,
  payment_transaction_id uuid REFERENCES pim_v2.payment_transactions(id),
  gross_amount integer NOT NULL,
  commission_amount integer NOT NULL,
  net_amount integer NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','PAID','FAILED','HELD')),
  provider_payout_id text UNIQUE,
  reconciliation_reference text,
  failure_reason text,
  paid_at timestamptz,
  UNIQUE(payment_transaction_id)
);
CREATE INDEX IF NOT EXISTS payout_item_pandit_idx ON pim_v2.payout_items(pandit_id,status);
