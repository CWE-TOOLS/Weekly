-- Jig Lists: per-project state blob for the Jig List tab (ported GFRC Scrim
-- Jig Generator). One row per project; `data` holds the tool's full state
-- object (project info, geometry, depths, panels, cross-section) verbatim,
-- same shape as the tool's .jigs.json export files.
-- Cascades on project delete. Idempotent so it can be re-run safely.

BEGIN;

CREATE TABLE IF NOT EXISTS jig_lists (
    project_number  TEXT PRIMARY KEY REFERENCES projects(project_number) ON DELETE CASCADE,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE jig_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to jig_lists" ON jig_lists;
CREATE POLICY "Allow all access to jig_lists"
    ON jig_lists
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- PostgREST role grants. Tables created via the Supabase dashboard get these
-- automatically, but tables created via raw SQL do NOT, which surfaces as a
-- 401 from the REST API even with permissive RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE jig_lists TO anon, authenticated;

COMMIT;

-- Nudge PostgREST to refresh its schema cache so the new table is reachable.
NOTIFY pgrst, 'reload schema';
