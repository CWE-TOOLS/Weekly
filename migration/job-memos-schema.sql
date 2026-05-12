-- Job Memos: per-project timeline log of dated events.
-- One row per memo, sorted newest-first by (memo_date DESC, created_at DESC).
-- Cascades on project delete. Idempotent so it can be re-run safely.

BEGIN;

CREATE TABLE IF NOT EXISTS job_memos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_number  TEXT NOT NULL REFERENCES projects(project_number) ON DELETE CASCADE,
    memo_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    body            TEXT NOT NULL DEFAULT '',
    author          TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_memos_project_date_idx
    ON job_memos(project_number, memo_date DESC, created_at DESC);

ALTER TABLE job_memos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to job_memos" ON job_memos;
CREATE POLICY "Allow all access to job_memos"
    ON job_memos
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- PostgREST role grants. Tables created via the Supabase dashboard get these
-- automatically, but tables created via raw SQL do NOT, which surfaces as a
-- 401 from the REST API even with permissive RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE job_memos TO anon, authenticated;

COMMIT;

-- Nudge PostgREST to refresh its schema cache so the new table is reachable.
NOTIFY pgrst, 'reload schema';
