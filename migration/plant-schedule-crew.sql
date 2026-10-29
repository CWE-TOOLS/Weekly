-- =====================================================================
-- Plant Scheduler: who works a scheduled day (2026-10-23)
-- The Task mover gets a Crew section; names are kept on the scheduled day.
-- Run in the Supabase SQL editor. Safe to re-run.
-- =====================================================================
ALTER TABLE plant_schedule ADD COLUMN IF NOT EXISTS crew text[];   -- employee names assigned to that day
