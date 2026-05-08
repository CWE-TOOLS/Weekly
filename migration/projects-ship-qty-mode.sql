-- =====================================================================
-- Persist the Shipping tab's "List as quantities" toggle per project.
-- When TRUE the on-screen crate cards and the printed packing list both
-- collapse identical panels into a single "type × count" row instead of
-- listing each panel individually.
-- =====================================================================

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS ship_qty_mode BOOLEAN NOT NULL DEFAULT FALSE;
