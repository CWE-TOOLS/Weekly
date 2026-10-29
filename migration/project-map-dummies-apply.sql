-- =====================================================================
-- Project Map dummy mode: APPLY a dummy to the live Plant Scheduler (2026-10-29)
--
-- Three columns on project_map_dummies record an apply, so it can be reversed:
--   applied_at     when the dummy's moves were written into plant_schedule
--   applied_by     initials typed at the confirmation
--   applied_moves  the exact list of scheduler rows moved (row id, from, to, weekend flag before)
--
-- Run in the Supabase SQL editor. Safe to re-run.
-- =====================================================================
ALTER TABLE project_map_dummies ADD COLUMN IF NOT EXISTS applied_at    TIMESTAMPTZ;
ALTER TABLE project_map_dummies ADD COLUMN IF NOT EXISTS applied_by    TEXT;
ALTER TABLE project_map_dummies ADD COLUMN IF NOT EXISTS applied_moves JSONB;
