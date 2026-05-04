-- =====================================================================
-- casting_inventory schema
-- Per-casting inventory of component types with quantities. Sister table
-- to casting_components: this tracks "how many of each type" (e.g., 5x L2),
-- whereas casting_components tracks individual panel instances (L2.01,
-- L2.02). Future plan: the tracking sheet pulls from this inventory.
-- =====================================================================

CREATE TABLE IF NOT EXISTS casting_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    casting_id UUID NOT NULL REFERENCES project_castings(id) ON DELETE CASCADE,

    type TEXT,
    width TEXT,
    length TEXT,
    color TEXT,
    sealer TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    cu_ft NUMERIC,
    ff_sq_ft NUMERIC,

    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS casting_inventory_casting_idx
    ON casting_inventory(casting_id);

-- RLS — match the open policy used by other tables in this project.
ALTER TABLE casting_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on casting_inventory" ON casting_inventory;
CREATE POLICY "Allow all on casting_inventory"
    ON casting_inventory
    FOR ALL
    USING (true)
    WITH CHECK (true);
