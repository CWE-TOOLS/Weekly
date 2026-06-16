-- Project-level target slump (inches of spread) per batch type.
--
-- The batch-ticket slump-test graphic previously hardcoded a 5" target. These three
-- columns let each project set its own target per batch type (Face Mix / First Back Up /
-- FINAL Back Up); the value is applied to every casting's batch tickets in that project.
-- DEFAULT 5 preserves the prior behavior for existing projects.

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS target_slump_face         NUMERIC NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS target_slump_first_backup NUMERIC NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS target_slump_final_backup NUMERIC NOT NULL DEFAULT 5;

COMMENT ON COLUMN projects.target_slump_face IS 'Target slump (inches of spread) for Face Mix batches; drives the batch-ticket slump graphic + Target readout.';
COMMENT ON COLUMN projects.target_slump_first_backup IS 'Target slump (inches) for First Back Up batches.';
COMMENT ON COLUMN projects.target_slump_final_backup IS 'Target slump (inches) for FINAL Back Up batches.';
