-- 2026-10-23: a casting can be cast on BOTH sides (A + B). Run once in the Supabase SQL editor.
ALTER TABLE project_castings DROP CONSTRAINT IF EXISTS project_castings_casting_side_check;
ALTER TABLE project_castings ADD CONSTRAINT project_castings_casting_side_check CHECK (casting_side IN ('A', 'B', 'AB'));
-- the weekly also stores the side on the Cast day's staging note; allow the same values there
ALTER TABLE task_descriptions DROP CONSTRAINT IF EXISTS task_descriptions_casting_side_check;
ALTER TABLE task_descriptions ADD CONSTRAINT task_descriptions_casting_side_check CHECK (casting_side IS NULL OR casting_side IN ('A', 'B', 'AB'));
