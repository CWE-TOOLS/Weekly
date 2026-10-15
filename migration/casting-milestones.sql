-- =====================================================================
-- casting_milestones: the portal's automatic Releasability Board columns
-- (2026-10-15)
--
-- One row per casting per milestone ("Batching Sheets", "Labels", ...).
--   status      red | orange | green   (board: incomplete | in progress | complete)
--   locked      only used for the "Casting Inventory" milestone (engineering lock)
--   stamped_at  when the print / tick that set the status happened
--   note        e.g. "Printed before Casting Inventory was final"
--
-- The board reads these rows for its AUTO columns; the portal writes them
-- when something is printed, ticked, locked or changed.
--
-- Run in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS casting_milestones (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_number  TEXT NOT NULL,
    casting_id      UUID NOT NULL REFERENCES project_castings(id) ON DELETE CASCADE,
    milestone       TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'red' CHECK (status IN ('red', 'orange', 'green')),
    locked          BOOLEAN NOT NULL DEFAULT false,
    stamped_at      TIMESTAMPTZ,
    note            TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (casting_id, milestone)
);

CREATE INDEX IF NOT EXISTS idx_casting_milestones_project ON casting_milestones(project_number);
CREATE INDEX IF NOT EXISTS idx_casting_milestones_casting ON casting_milestones(casting_id);

ALTER TABLE casting_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on casting_milestones" ON casting_milestones;
CREATE POLICY "Allow all on casting_milestones"
    ON casting_milestones
    FOR ALL
    USING (true)
    WITH CHECK (true);

GRANT ALL ON casting_milestones TO anon, authenticated;
