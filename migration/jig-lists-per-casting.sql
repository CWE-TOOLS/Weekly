-- Jig Lists: per-casting migration.
-- Converts jig_lists from one-row-per-project (project_number PK) to
-- one-row-per-casting: adds a casting_id FK -> project_castings, replaces the
-- project_number primary key with a surrogate UUID id, and backfills each
-- existing project-level row onto that project's FIRST casting (lowest
-- sort_order, then casting_number). Rows for projects with no castings keep a
-- NULL casting_id — the app treats those as a legacy blob and uses them as the
-- seed when the project's first per-casting jig list is created.
-- project_number stays on every row (still FK -> projects, now indexed) so the
-- tab can bulk-load a whole project in one query.
-- Idempotent so it can be re-run safely.

BEGIN;

-- 1) Link each jig list to a casting. Cascades on casting delete.
ALTER TABLE jig_lists
    ADD COLUMN IF NOT EXISTS casting_id UUID REFERENCES project_castings(id) ON DELETE CASCADE;

-- 2) Surrogate primary key: add + backfill the id column first, then swap the
--    PK off project_number. project_number keeps its NOT NULL and its FK to
--    projects (ON DELETE CASCADE) — only the PK/uniqueness on it goes away, so
--    a project can hold one row per casting.
ALTER TABLE jig_lists ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
UPDATE jig_lists SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE jig_lists ALTER COLUMN id SET NOT NULL;

DO $$
BEGIN
    -- Replace the PK only while it still sits on project_number; once the PK
    -- is on id (re-run), leave it alone.
    IF EXISTS (
        SELECT 1
        FROM information_schema.key_column_usage k
        JOIN information_schema.table_constraints t
          ON t.constraint_name = k.constraint_name AND t.table_name = k.table_name
        WHERE t.table_name = 'jig_lists'
          AND t.constraint_type = 'PRIMARY KEY'
          AND k.column_name = 'project_number'
    ) THEN
        ALTER TABLE jig_lists DROP CONSTRAINT jig_lists_pkey;
        ALTER TABLE jig_lists ADD CONSTRAINT jig_lists_pkey PRIMARY KEY (id);
    END IF;
END $$;

-- 3) One jig list per casting. NULLs allowed — legacy rows for casting-less
--    projects keep casting_id NULL and don't collide.
DO $$
BEGIN
    ALTER TABLE jig_lists ADD CONSTRAINT jig_lists_casting_id_key UNIQUE (casting_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN
    NULL; -- already added on a previous run
END $$;

-- 4) Backfill: attach each legacy project-level row to the project's FIRST
--    casting (lowest sort_order, then casting_number) — but only if the
--    project has castings and that casting doesn't already own a jig list.
--    Anything left over stays NULL (legacy seed blob).
WITH first_casting AS (
    SELECT DISTINCT ON (project_number) project_number, id AS casting_id
    FROM project_castings
    ORDER BY project_number, sort_order ASC NULLS LAST, casting_number ASC
)
UPDATE jig_lists jl
SET casting_id = fc.casting_id
FROM first_casting fc
WHERE jl.casting_id IS NULL
  AND fc.project_number = jl.project_number
  AND NOT EXISTS (
      SELECT 1 FROM jig_lists other WHERE other.casting_id = fc.casting_id
  );

-- 5) project_number lost its PK index — recreate one for the per-project
--    bulk load the Jig List tab runs on activation.
CREATE INDEX IF NOT EXISTS jig_lists_project_number_idx ON jig_lists (project_number);

COMMIT;

-- Nudge PostgREST to refresh its schema cache so the new columns are reachable.
NOTIFY pgrst, 'reload schema';
