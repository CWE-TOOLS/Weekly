-- Casting Inventory: short free-text description per type (2026-11-10).
-- Shown between Type and Width on the Castings tab and printed on the tracking sheet.
alter table casting_inventory add column if not exists description text;
notify pgrst, 'reload schema';
