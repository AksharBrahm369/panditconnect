-- OPTIONAL AND DESTRUCTIVE. This file is never run by the application.
-- Take a verified backup, review docs/legacy-schema-audit.md, and set the explicit
-- session flag before running manually. RESTRICT prevents dependent objects from
-- being silently removed.
BEGIN;
DO $$
DECLARE legacy record;
BEGIN
  IF current_setting('pim.allow_legacy_cleanup', true) <> 'I_HAVE_A_VERIFIED_BACKUP_AND_APPROVE_DELETION' THEN
    RAISE EXCEPTION 'Legacy cleanup blocked: explicit approval flag is missing.';
  END IF;
  FOR legacy IN
    SELECT tablename FROM pg_tables
    WHERE schemaname='public' AND tablename<>'_prisma_migrations'
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I RESTRICT', legacy.tablename);
  END LOOP;
END $$;
COMMIT;
