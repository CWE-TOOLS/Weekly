-- =====================================================================
-- batch_tickets: one ticket per casting, colour AND CAST DAY (2026-11-20)
--
-- A casting the weekly casts over two or more days can be split per cast
-- day on the portal (Casting Inventory "Day" columns). Batching follows:
-- Day 1 and Day 2 each get their own batch ticket.
--
-- Before: one ticket per (casting_id, color_log_id).
-- After:  one ticket per (casting_id, color_log_id, cast_day).
--
-- Every existing row becomes Day 1 (the default), so nothing changes for
-- castings that are not split. The portal as it is today keeps working
-- after this runs (it never sends cast_day, so its tickets are Day 1).
--
-- Run in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

ALTER TABLE batch_tickets
    ADD COLUMN IF NOT EXISTS cast_day integer NOT NULL DEFAULT 1;

-- The new rule first, then drop the old one: there is never a moment without a uniqueness rule.
CREATE UNIQUE INDEX IF NOT EXISTS batch_tickets_casting_color_day_key
    ON batch_tickets (casting_id, color_log_id, cast_day)
    WHERE color_log_id IS NOT NULL;

DROP INDEX IF EXISTS batch_tickets_casting_color_key;

-- (the colour-less legacy rule, batch_tickets_casting_nullcolor_key, stays as it is)
