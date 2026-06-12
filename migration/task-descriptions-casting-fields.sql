-- Casting-aware task descriptions (non-destructive)
--
-- Lets a task description belong to a specific casting's day so it can be
-- pre-authored from the Project Portal optimizer before the Google-Sheet row
-- exists, and edited from both the optimizer and the weekly card (shared row).
--
-- Strategy: keep ONE table. Casting-aware rows are keyed by
--   (project_number, casting_number, department, day_number)   -- day_number = per-casting index
-- while legacy rows stay keyed by the original
--   (project, department, day_number)                          -- day_number = global index
-- The app reads casting-key-first and falls back to the legacy name key, so
-- existing descriptions keep working untouched and upgrade themselves the next
-- time they are edited. No data is moved or deleted.
--
-- Why the primary key must change: casting-aware rows REUSE day_number per
-- casting, so two castings of one project would both be ('Cast','1') and collide
-- on the legacy PRIMARY KEY (project, department, day_number). Casting-aware rows
-- therefore carry project = NULL; we drop the PK and replace it with a plain
-- UNIQUE INDEX on the same columns. Postgres treats NULLs as distinct in a unique
-- index, so the many project=NULL casting rows never collide there, while the
-- legacy upsert path (ON CONFLICT project,department,day_number) keeps working for
-- real (non-null) project names.
--
-- Safe to run before deploying the new app code: the old code's
-- ON CONFLICT (project, department, day_number) simply targets the new unique
-- index instead of the dropped PK — same columns, same behavior.

-- 1. New columns (casting_side already exists ad hoc in some envs; IF NOT EXISTS makes this idempotent).
ALTER TABLE task_descriptions
    ADD COLUMN IF NOT EXISTS project_number TEXT,
    ADD COLUMN IF NOT EXISTS casting_number TEXT,
    ADD COLUMN IF NOT EXISTS casting_side   TEXT;

-- 2. Drop the legacy PRIMARY KEY first. Postgres will NOT let you remove NOT NULL from
--    a column while it's still part of a primary key, so this must come before step 3.
--    Replace it with an equivalent UNIQUE INDEX so the legacy upsert path
--    (ON CONFLICT project,department,day_number) keeps working — existing rows are
--    already unique on these columns.
ALTER TABLE task_descriptions DROP CONSTRAINT IF EXISTS task_descriptions_pkey;
CREATE UNIQUE INDEX IF NOT EXISTS uq_task_descriptions_legacy
    ON task_descriptions (project, department, day_number);

-- 3. Casting-aware rows have no legacy project name (allowed now that project left the PK).
ALTER TABLE task_descriptions ALTER COLUMN project DROP NOT NULL;

-- 4. Canonical key for casting-aware rows. NON-partial on purpose: a partial unique
--    index (… WHERE project_number IS NOT NULL …) cannot be used as an ON CONFLICT
--    target by the client — PostgREST/supabase-js sends only column names, not the
--    partial predicate, so upserts fail with "no unique or exclusion constraint
--    matching the ON CONFLICT specification". Legacy rows carry project_number = NULL
--    and Postgres treats NULLs as distinct, so they never collide on this index anyway.
CREATE UNIQUE INDEX IF NOT EXISTS uq_task_descriptions_casting
    ON task_descriptions (project_number, casting_number, department, day_number);

-- 5. Fast per-project load for the optimizer.
CREATE INDEX IF NOT EXISTS idx_task_descriptions_pnum
    ON task_descriptions (project_number);

COMMENT ON COLUMN task_descriptions.project_number IS 'Casting-aware rows: project id (Google Sheet col H). NULL for legacy name-keyed rows.';
COMMENT ON COLUMN task_descriptions.casting_number IS 'Casting-aware rows: casting id (Google Sheet col I). NULL for legacy name-keyed rows.';
COMMENT ON COLUMN task_descriptions.day_number IS 'Casting-aware rows: per-casting day index. Legacy rows: global per-(project,department) index.';
