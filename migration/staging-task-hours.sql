-- =====================================================================
-- Staging task name + hours (2026-10-22)
-- The portal's Staging tab gets a Task box on every day; the Optimizer
-- Hours tab mirrors Staging and takes the hours per day. The Plant
-- Scheduler reads both. Two new columns, nothing moved or deleted.
-- Run in the Supabase SQL editor. Safe to re-run.
-- =====================================================================
ALTER TABLE task_descriptions ADD COLUMN IF NOT EXISTS task_name text;     -- e.g. ACID, TU, SEAL (one of the team's tasks)
ALTER TABLE task_descriptions ADD COLUMN IF NOT EXISTS hours numeric;      -- Optimizer Hours for that day
