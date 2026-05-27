-- ============================================================================
-- casting_layout_positions
--
-- Stores manually-adjusted mold positions for the Project Portal's Casting
-- Layout tab. One row per (component, casting area). When a casting+area has
-- any rows here, the layout is rendered from these saved positions instead of
-- the automatic shelf packer. Positions are stored in INCHES in the area's
-- coordinate space (not screen pixels) so they survive viewport rescaling.
-- ============================================================================

CREATE TABLE IF NOT EXISTS casting_layout_positions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id  UUID NOT NULL REFERENCES casting_components(id) ON DELETE CASCADE,
    casting_id    UUID NOT NULL REFERENCES project_castings(id)   ON DELETE CASCADE,
    area          TEXT NOT NULL DEFAULT 'B' CHECK (area IN ('A', 'B')),
    pos_x         NUMERIC NOT NULL,
    pos_y         NUMERIC NOT NULL,
    rotation      SMALLINT NOT NULL DEFAULT 0 CHECK (rotation IN (0, 90)),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT casting_layout_positions_component_area_unique UNIQUE (component_id, area)
);

CREATE INDEX IF NOT EXISTS idx_casting_layout_positions_casting_id
    ON casting_layout_positions(casting_id);
CREATE INDEX IF NOT EXISTS idx_casting_layout_positions_component_id
    ON casting_layout_positions(component_id);

COMMENT ON TABLE  casting_layout_positions             IS 'Manually-placed mold positions for the Casting Layout tab; presence of rows for a casting+area switches that layout from auto-pack to manual.';
COMMENT ON COLUMN casting_layout_positions.component_id IS 'The casting_components row this mold represents.';
COMMENT ON COLUMN casting_layout_positions.casting_id   IS 'Denormalized parent casting, for cheap per-casting lookups.';
COMMENT ON COLUMN casting_layout_positions.area         IS 'Casting area the position applies to: A or B (each area has its own tables).';
COMMENT ON COLUMN casting_layout_positions.pos_x        IS 'Mold top-left X in inches, area coordinate space.';
COMMENT ON COLUMN casting_layout_positions.pos_y        IS 'Mold top-left Y in inches, area coordinate space.';
COMMENT ON COLUMN casting_layout_positions.rotation     IS 'Mold rotation in degrees: 0 = natural width/length, 90 = rotated.';

-- Row-level security: house pattern — open policy, no auth in this project.
ALTER TABLE casting_layout_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on casting_layout_positions" ON casting_layout_positions;
CREATE POLICY "Allow all on casting_layout_positions"
    ON casting_layout_positions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Keep updated_at fresh on every modification.
CREATE OR REPLACE FUNCTION casting_layout_positions_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_casting_layout_positions_updated_at ON casting_layout_positions;
CREATE TRIGGER trigger_casting_layout_positions_updated_at
    BEFORE UPDATE ON casting_layout_positions
    FOR EACH ROW
    EXECUTE FUNCTION casting_layout_positions_set_updated_at();
