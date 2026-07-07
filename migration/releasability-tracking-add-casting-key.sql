-- Releasability tracking: durable re-key to project# + cast#
--
-- Adds the structured Google Sheet identifiers (project number = col H,
-- cast number = col I) to releasability_tracking and makes the non-null pair
-- unique. The app then keys tracking state on (project_number, casting_number)
-- instead of (project, week_monday), so milestone state survives reschedules
-- AND project renames.
--
-- Additive and non-destructive: existing rows keep all their data (the new
-- columns are NULL until the app backfills them in place on load). NULLs are
-- distinct under a UNIQUE constraint, so legacy un-numbered rows never collide.
--
-- Safe to run before the new JS ships — adding nullable columns does not affect
-- the previously deployed code.

ALTER TABLE releasability_tracking ADD COLUMN IF NOT EXISTS project_number TEXT;
ALTER TABLE releasability_tracking ADD COLUMN IF NOT EXISTS casting_number TEXT;

ALTER TABLE releasability_tracking
  ADD CONSTRAINT releasability_tracking_casting_unique UNIQUE (project_number, casting_number);

-- Optional helper index for casting-key lookups/deletes.
CREATE INDEX IF NOT EXISTS idx_releasability_tracking_casting
  ON releasability_tracking (project_number, casting_number);
