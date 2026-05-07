-- =====================================================================
-- Widen casting_number + crate_number uniqueness to include phase_id so
-- Phase 1 Cast 1 and Phase 2 Cast 1 (and Phase 1 Crate 1 + Phase 2 Crate 1)
-- can coexist within the same project. NULLS NOT DISTINCT (Postgres 15+)
-- treats NULL as a value, so non-phased projects (phase_id IS NULL on
-- every row) keep enforcing the same uniqueness as before.
-- =====================================================================

ALTER TABLE project_castings
    DROP CONSTRAINT IF EXISTS project_castings_project_number_casting_number_key;

ALTER TABLE project_castings
    ADD CONSTRAINT project_castings_unique_per_phase
    UNIQUE NULLS NOT DISTINCT (project_number, phase_id, casting_number);

ALTER TABLE project_crates
    DROP CONSTRAINT IF EXISTS project_crates_project_number_crate_number_key;

ALTER TABLE project_crates
    ADD CONSTRAINT project_crates_unique_per_phase
    UNIQUE NULLS NOT DISTINCT (project_number, phase_id, crate_number);
