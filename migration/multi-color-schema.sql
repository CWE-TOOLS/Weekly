-- =====================================================================
-- Multi-color support
-- Lets a project carry more than one color log. Today: exactly one
-- non-preset color_log row per project (enforced by color_logs_one_per_project).
-- After this migration: a project can have N color logs, and each
-- component / inventory item / batch ticket carries a color_log_id FK
-- to the specific log it uses.
--
-- Multi-color is opt-in per project via projects.multi_color_enabled
-- (one-way switch, mirrors phases_enabled). Existing projects stay
-- single-color until toggled; their one log + all rows get backfilled
-- below so the FK is populated everywhere from day one.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Project-level flag (one-way toggle, defaults off)
-- ---------------------------------------------------------------------
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS multi_color_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------
-- 2. sort_order on color_logs so the pill strip has a stable ordering
-- ---------------------------------------------------------------------
ALTER TABLE color_logs
    ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------
-- 3. Swap the unique index: one-per-project → (project, name) uniqueness
-- ---------------------------------------------------------------------
-- Today: a project may have at most one non-preset color_log row.
-- After: a project may have many, but no two with the same name.
DROP INDEX IF EXISTS color_logs_one_per_project;

CREATE UNIQUE INDEX IF NOT EXISTS color_logs_project_name_uniq
    ON color_logs(project_number, name)
    WHERE is_preset = FALSE AND project_number IS NOT NULL;

-- ---------------------------------------------------------------------
-- 4. color_log_id FK on every table that ties rows to a color
-- ---------------------------------------------------------------------
-- ON DELETE SET NULL mirrors the phases pattern: deleting a color log
-- unassigns its members rather than cascading. The UI blocks deletion
-- of a log that still has members.

ALTER TABLE casting_components
    ADD COLUMN IF NOT EXISTS color_log_id UUID
    REFERENCES color_logs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS casting_components_color_log_idx
    ON casting_components(color_log_id);

ALTER TABLE casting_inventory
    ADD COLUMN IF NOT EXISTS color_log_id UUID
    REFERENCES color_logs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS casting_inventory_color_log_idx
    ON casting_inventory(color_log_id);

ALTER TABLE batch_tickets
    ADD COLUMN IF NOT EXISTS color_log_id UUID
    REFERENCES color_logs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS batch_tickets_color_log_idx
    ON batch_tickets(color_log_id);

-- ---------------------------------------------------------------------
-- 5. One-shot backfill: every existing row links to its project's
--    one existing non-preset color log
-- ---------------------------------------------------------------------
-- casting_components → resolve project via project_castings
UPDATE casting_components cc
SET color_log_id = cl.id
FROM project_castings pc
JOIN color_logs cl
    ON cl.project_number = pc.project_number
   AND cl.is_preset = FALSE
WHERE cc.casting_id = pc.id
  AND cc.color_log_id IS NULL;

-- casting_inventory → same join
UPDATE casting_inventory ci
SET color_log_id = cl.id
FROM project_castings pc
JOIN color_logs cl
    ON cl.project_number = pc.project_number
   AND cl.is_preset = FALSE
WHERE ci.casting_id = pc.id
  AND ci.color_log_id IS NULL;

-- batch_tickets → same join
UPDATE batch_tickets bt
SET color_log_id = cl.id
FROM project_castings pc
JOIN color_logs cl
    ON cl.project_number = pc.project_number
   AND cl.is_preset = FALSE
WHERE bt.casting_id = pc.id
  AND bt.color_log_id IS NULL;

COMMIT;
