-- Pandit-selected interview method and availability for admin verification.
ALTER TABLE pim_v2.pandit_profiles
  ADD COLUMN IF NOT EXISTS interview_mode text NOT NULL DEFAULT 'LIVE_VIDEO_CALL',
  ADD COLUMN IF NOT EXISTS interview_preferred_at timestamptz,
  ADD COLUMN IF NOT EXISTS interview_alternate_at timestamptz,
  ADD COLUMN IF NOT EXISTS interview_language text,
  ADD COLUMN IF NOT EXISTS interview_note text;

ALTER TABLE pim_v2.pandit_profiles DROP CONSTRAINT IF EXISTS pandit_interview_mode_check;
ALTER TABLE pim_v2.pandit_profiles ADD CONSTRAINT pandit_interview_mode_check
  CHECK (interview_mode IN ('LIVE_VIDEO_CALL','RECORDED_VIDEO'));
