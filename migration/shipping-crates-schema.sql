-- =====================================================================
-- project_crates schema + casting_components.crate_id FK
-- Backs the Shipping tab and the Crate# selector on Tracking rows.
-- One project owns many crates; each casting_component may be assigned
-- to at most one crate (crate_id NULL means "not yet crated").
-- =====================================================================

CREATE TABLE IF NOT EXISTS project_crates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_number TEXT NOT NULL,

    crate_number TEXT NOT NULL,
    weight TEXT,
    dimensions TEXT,
    notes TEXT,

    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (project_number, crate_number)
);

CREATE INDEX IF NOT EXISTS project_crates_project_idx
    ON project_crates(project_number);

ALTER TABLE project_crates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on project_crates" ON project_crates;
CREATE POLICY "Allow all on project_crates"
    ON project_crates
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Component → crate assignment. ON DELETE SET NULL so deleting a crate
-- just unassigns its members rather than cascading deletes.
ALTER TABLE casting_components
    ADD COLUMN IF NOT EXISTS crate_id UUID
    REFERENCES project_crates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS casting_components_crate_idx
    ON casting_components(crate_id);
