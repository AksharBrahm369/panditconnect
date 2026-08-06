-- Trusted Pandit onboarding, private document metadata, and auditable verification.
ALTER TABLE pim_v2.pandit_profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS current_address text,
  ADD COLUMN IF NOT EXISTS service_radius_km integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS availability_preference text NOT NULL DEFAULT 'OFFLINE',
  ADD COLUMN IF NOT EXISTS payout_method text,
  ADD COLUMN IF NOT EXISTS bank_account_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_ifsc text,
  ADD COLUMN IF NOT EXISTS upi_id text,
  ADD COLUMN IF NOT EXISTS profile_photo_path text,
  ADD COLUMN IF NOT EXISTS platform_rules_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE pim_v2.pandit_profiles DROP CONSTRAINT IF EXISTS pandit_availability_preference_check;
ALTER TABLE pim_v2.pandit_profiles ADD CONSTRAINT pandit_availability_preference_check
  CHECK (availability_preference IN ('AVAILABLE_AFTER_APPROVAL','OFFLINE'));

CREATE TABLE IF NOT EXISTS pim_v2.pandit_documents (
  id uuid PRIMARY KEY,
  pandit_id uuid NOT NULL REFERENCES pim_v2.users(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('PROFILE_PHOTO','GOVERNMENT_ID','ADDRESS_PROOF','BANK_PROOF','REFERENCE_LETTER','VIDEO_INTERVIEW')),
  storage_path text NOT NULL UNIQUE,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  review_status text NOT NULL DEFAULT 'PENDING' CHECK (review_status IN ('PENDING','VERIFIED','REJECTED')),
  review_note text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE TABLE IF NOT EXISTS pim_v2.pandit_references (
  id uuid PRIMARY KEY,
  pandit_id uuid NOT NULL REFERENCES pim_v2.users(id) ON DELETE CASCADE,
  reference_name text NOT NULL,
  relationship text NOT NULL,
  temple_or_organisation text,
  phone text NOT NULL,
  verification_status text NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING','VERIFIED','UNREACHABLE','REJECTED')),
  verification_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz
);

CREATE TABLE IF NOT EXISTS pim_v2.pandit_service_pricing (
  pandit_id uuid NOT NULL REFERENCES pim_v2.users(id) ON DELETE CASCADE,
  service_id text NOT NULL REFERENCES pim_v2.services(id) ON DELETE CASCADE,
  price integer NOT NULL CHECK (price >= 0 AND price <= 1000000),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pandit_id, service_id)
);

CREATE TABLE IF NOT EXISTS pim_v2.pandit_verification_reviews (
  pandit_id uuid PRIMARY KEY REFERENCES pim_v2.users(id) ON DELETE CASCADE,
  identity_status text NOT NULL DEFAULT 'PENDING',
  document_status text NOT NULL DEFAULT 'PENDING',
  reference_status text NOT NULL DEFAULT 'PENDING',
  video_interview_status text NOT NULL DEFAULT 'PENDING',
  knowledge_check_status text NOT NULL DEFAULT 'PENDING',
  bank_status text NOT NULL DEFAULT 'PENDING',
  video_interview_at timestamptz,
  knowledge_score integer CHECK (knowledge_score BETWEEN 0 AND 100),
  admin_note text,
  reviewed_by uuid REFERENCES pim_v2.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pandit_review_statuses CHECK (
    identity_status IN ('PENDING','VERIFIED','FAILED') AND
    document_status IN ('PENDING','VERIFIED','FAILED') AND
    reference_status IN ('PENDING','VERIFIED','FAILED') AND
    video_interview_status IN ('PENDING','VERIFIED','FAILED') AND
    knowledge_check_status IN ('PENDING','VERIFIED','FAILED') AND
    bank_status IN ('PENDING','VERIFIED','FAILED')
  )
);

CREATE TABLE IF NOT EXISTS pim_v2.pandit_verification_events (
  id uuid PRIMARY KEY,
  pandit_id uuid NOT NULL REFERENCES pim_v2.users(id) ON DELETE CASCADE,
  admin_user_id uuid REFERENCES pim_v2.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','CHANGES_REQUESTED','CHECKLIST_UPDATED')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pandit_documents_owner_idx ON pim_v2.pandit_documents(pandit_id,uploaded_at DESC);
CREATE INDEX IF NOT EXISTS pandit_references_owner_idx ON pim_v2.pandit_references(pandit_id);
CREATE INDEX IF NOT EXISTS pandit_verification_events_idx ON pim_v2.pandit_verification_events(pandit_id,created_at DESC);

-- Supabase Storage bucket stays private. Objects are uploaded/deleted only through
-- the Storage API; the database row establishes limits and allowed file types.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES (
  'pandit-private-documents',
  'pandit-private-documents',
  false,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf','video/mp4']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public=false,
  file_size_limit=EXCLUDED.file_size_limit,
  allowed_mime_types=EXCLUDED.allowed_mime_types;

ALTER TABLE pim_v2.pandit_profiles DROP CONSTRAINT IF EXISTS pandit_verification_status_check;
ALTER TABLE pim_v2.pandit_profiles ADD CONSTRAINT pandit_verification_status_check
  CHECK (verification_status IN ('INCOMPLETE','PENDING','SUBMITTED','UNDER_REVIEW','CHANGES_REQUESTED','APPROVED','REJECTED'));
