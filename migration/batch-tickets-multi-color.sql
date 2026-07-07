-- =====================================================================
-- batch_tickets: allow multiple tickets per casting (one per color log)
--
-- Before: casting_id UNIQUE -> exactly one batch ticket per casting.
-- After:  one ticket per (casting_id, color_log_id), plus at most one
--         legacy ticket with NULL color_log_id per casting.
--
-- Existing rows are untouched; they keep working as the ticket for
-- whatever color_log_id they already carry (or the NULL-color slot).
--
-- Run in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

-- Drop the one-per-casting constraint (name is the Postgres default for
-- the inline UNIQUE on casting_id).
ALTER TABLE batch_tickets DROP CONSTRAINT IF EXISTS batch_tickets_casting_id_key;

-- One ticket per casting per color log.
CREATE UNIQUE INDEX IF NOT EXISTS batch_tickets_casting_color_key
    ON batch_tickets (casting_id, color_log_id)
    WHERE color_log_id IS NOT NULL;

-- At most one color-less (legacy) ticket per casting.
CREATE UNIQUE INDEX IF NOT EXISTS batch_tickets_casting_nullcolor_key
    ON batch_tickets (casting_id)
    WHERE color_log_id IS NULL;
