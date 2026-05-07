-- =====================================================================
-- casting_phases.description — per-phase free-text notes
-- Backs the collapsible description field on each phase card in the
-- Optimizer Hours tab.
-- =====================================================================

ALTER TABLE casting_phases
    ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
