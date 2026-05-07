-- =====================================================================
-- project_phases schema + phases_enabled flag + phase_id FKs
-- Backs the optional phasing feature on the Project Portal: when a
-- project enables phases, castings/tracking/shipping/optimizer/batch all
-- become per-phase. Color Log + Cover stay project-wide. Phases are a
-- one-way switch — once on, stays on.
-- =====================================================================

CREATE TABLE IF NOT EXISTS project_phases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_number TEXT NOT NULL,

    phase_name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (project_number, phase_name)
);

CREATE INDEX IF NOT EXISTS project_phases_project_idx
    ON project_phases(project_number);

ALTER TABLE project_phases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on project_phases" ON project_phases;
CREATE POLICY "Allow all on project_phases"
    ON project_phases
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Project-level toggle. Default false; existing projects unaffected.
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS phases_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Phase membership for the tables that become per-phase. Nullable so
-- existing rows (and rows on phases-disabled projects) keep working.
-- ON DELETE SET NULL so deleting a phase unassigns members rather than
-- cascading deletes (the UI blocks delete of phases that still hold data).
ALTER TABLE project_castings
    ADD COLUMN IF NOT EXISTS phase_id UUID
    REFERENCES project_phases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS project_castings_phase_idx
    ON project_castings(phase_id);

ALTER TABLE project_crates
    ADD COLUMN IF NOT EXISTS phase_id UUID
    REFERENCES project_phases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS project_crates_phase_idx
    ON project_crates(phase_id);
