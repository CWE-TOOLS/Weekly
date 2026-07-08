-- Releasability tracking: make the casting identity phase-aware.
--
-- Why: phased projects (projects.phases_enabled, project_phases) reset cast
-- numbering per phase — e.g. project 0383 has a Cast 2 in phase P1 AND a
-- Cast 2 in phase P2. The board's durable identity was (project_number,
-- casting_number), enforced by releasability_tracking_casting_unique, so the
-- second phase's casting could not get its own row (23505) and both phases'
-- milestone state collapsed onto one row.
--
-- This migration:
--   1. adds a nullable `phase_id UUID` column (references project_phases.id in
--      spirit; no FK so deleting a phase in the portal never breaks tracking
--      history — the app treats a dangling phase_id as un-phased);
--   2. replaces the UNIQUE (project_number, casting_number) constraint with
--      two partial unique indexes so uniqueness is per phase:
--        - (project_number, casting_number)            WHERE phase_id IS NULL
--        - (project_number, casting_number, phase_id)  WHERE phase_id IS NOT NULL
--      NULL project/cast numbers stay distinct, exactly as before.
--
-- Idempotent: every step is guarded. Safe to re-run.
-- Ordering: run this BEFORE (or together with) deploying the matching JS —
-- the new code writes phase_id on every save and errors if the column is
-- missing. The old code ignores the column entirely, so running the SQL first
-- is always safe.

-- 1) The phase column.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'releasability_tracking'
      AND column_name = 'phase_id'
  ) THEN
    ALTER TABLE releasability_tracking
      ADD COLUMN phase_id UUID;
  END IF;
END $$;

-- 2) Drop the phase-blind casting-key UNIQUE (from
--    releasability-tracking-add-casting-key.sql / re-added by
--    releasability-tracking-fix-pk-allow-multi-castings.sql).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.releasability_tracking'::regclass
      AND conname = 'releasability_tracking_casting_unique'
  ) THEN
    ALTER TABLE releasability_tracking
      DROP CONSTRAINT releasability_tracking_casting_unique;
  END IF;
END $$;

-- 3) Phase-aware uniqueness. Un-phased rows keep the old one-row-per-casting
--    guarantee; phased rows are unique per (casting, phase).
CREATE UNIQUE INDEX IF NOT EXISTS idx_releasability_tracking_casting_nophase
  ON releasability_tracking (project_number, casting_number)
  WHERE phase_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_releasability_tracking_casting_phase
  ON releasability_tracking (project_number, casting_number, phase_id)
  WHERE phase_id IS NOT NULL;
