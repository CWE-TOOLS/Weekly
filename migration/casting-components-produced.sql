-- =====================================================================
-- Add a `produced` flag to casting_components so the Tracking tab can
-- mark which panels have been cast. Defaulted to false; existing rows
-- backfill to false (i.e. not yet produced) — Production can flip them
-- on as panels come out of the form. Unchecking a row supports the
-- "rejected, needs remake" case without a separate state.
-- =====================================================================

ALTER TABLE casting_components
    ADD COLUMN IF NOT EXISTS produced BOOLEAN NOT NULL DEFAULT false;
