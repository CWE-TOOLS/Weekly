-- =====================================================================
-- casting_milestones: allow the N/A status (2026-10-16)
-- Used by the Jig List tab's "No jigs" option, which shows N/A on the
-- Releasability Board instead of red / orange / green.
-- Run in the Supabase SQL editor. Safe to re-run.
-- =====================================================================
ALTER TABLE casting_milestones DROP CONSTRAINT IF EXISTS casting_milestones_status_check;
ALTER TABLE casting_milestones ADD CONSTRAINT casting_milestones_status_check CHECK (status IN ('red', 'orange', 'green', 'na'));
