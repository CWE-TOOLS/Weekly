-- =====================================================================
-- Add remake attribution columns to casting_inventory and casting_components.
-- When a rejected panel is imported into another casting via the "Import
-- Remakes" flow, the new inventory line carries the source panel_id +
-- source casting UUID. Components inherit these via runTrackingSync.
-- Keyed by panel_id (not component UUID) so attribution survives the
-- DELETE+INSERT cycle runTrackingSync performs on casting_components.
-- =====================================================================

ALTER TABLE casting_inventory
    ADD COLUMN IF NOT EXISTS remake_of_panel_id TEXT NULL;
ALTER TABLE casting_inventory
    ADD COLUMN IF NOT EXISTS remake_of_casting_id UUID NULL
        REFERENCES project_castings(id) ON DELETE SET NULL;

ALTER TABLE casting_components
    ADD COLUMN IF NOT EXISTS remake_of_panel_id TEXT NULL;
ALTER TABLE casting_components
    ADD COLUMN IF NOT EXISTS remake_of_casting_id UUID NULL
        REFERENCES project_castings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_casting_inventory_remake_lookup
    ON casting_inventory(remake_of_casting_id, remake_of_panel_id);
CREATE INDEX IF NOT EXISTS idx_casting_components_remake_lookup
    ON casting_components(remake_of_casting_id, remake_of_panel_id);
