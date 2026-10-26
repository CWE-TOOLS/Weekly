-- =====================================================================
-- Project Map "dummy mode": saved what-if schedules laid over the weekly
-- (2026-10-26) — project-map.html, Dummy mode
--
-- A dummy is a named set of moves. Nothing in the weekly, the Optimizer or
-- the scheduler changes until a dummy is applied (Apply is a later phase,
-- written with the DOP once the scheduler is the master).
--   project_map_dummies        one row per saved dummy
--   project_map_dummy_moves    one row per moved weekly day:
--                              this casting's <department> day that was on orig_date now sits on new_date
--
-- Run in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS project_map_dummies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    final           BOOLEAN NOT NULL DEFAULT false,
    chain           BOOLEAN NOT NULL DEFAULT true,
    created_by      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_map_dummy_moves (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dummy_id        UUID NOT NULL REFERENCES project_map_dummies(id) ON DELETE CASCADE,
    project_number  TEXT NOT NULL,
    casting_number  TEXT NOT NULL,
    department      TEXT NOT NULL,
    orig_date       DATE NOT NULL,
    new_date        DATE NOT NULL,
    UNIQUE (dummy_id, project_number, casting_number, department, orig_date)
);
CREATE INDEX IF NOT EXISTS project_map_dummy_moves_dummy_idx ON project_map_dummy_moves (dummy_id);

-- Same open policy as the rest of the portal (no logins).
ALTER TABLE project_map_dummies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_map_dummies open" ON project_map_dummies;
CREATE POLICY "project_map_dummies open" ON project_map_dummies FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE project_map_dummy_moves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_map_dummy_moves open" ON project_map_dummy_moves;
CREATE POLICY "project_map_dummy_moves open" ON project_map_dummy_moves FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON project_map_dummies TO anon, authenticated;
GRANT ALL ON project_map_dummy_moves TO anon, authenticated;
