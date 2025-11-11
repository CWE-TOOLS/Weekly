-- ============================================================================
-- Migration: Add manual_week_id column to releasability_tracking table
-- ============================================================================
-- Date: 2025-01-10
-- Purpose: Allow projects to be associated with custom-named manual weeks
-- ============================================================================

-- Add manual_week_id column (nullable, references releasability_manual_weeks)
ALTER TABLE releasability_tracking
ADD COLUMN manual_week_id UUID REFERENCES releasability_manual_weeks(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_tracking_manual_week_id ON releasability_tracking(manual_week_id);

-- Add comment for documentation
COMMENT ON COLUMN releasability_tracking.manual_week_id IS 'Optional reference to a manual week divider (when project is grouped under a custom week)';

-- ============================================================================
-- Migration Complete!
-- ============================================================================
-- Note: Projects can now be associated with either:
--   1. A date-based week (week_monday only)
--   2. A manual week (manual_week_id set, week_monday is still required for tracking)
-- ============================================================================
