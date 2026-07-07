-- =====================================================================
-- Add a `remake_casting_id` FK on casting_components so that when a
-- panel is rejected, the user can pick which later casting will be used
-- to pour the remake. NULL = no remake target chosen. ON DELETE SET
-- NULL keeps the component addressable if the target casting is later
-- removed.
-- =====================================================================

ALTER TABLE casting_components
    ADD COLUMN IF NOT EXISTS remake_casting_id UUID NULL
        REFERENCES project_castings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_casting_components_remake_casting_id
    ON casting_components(remake_casting_id);
