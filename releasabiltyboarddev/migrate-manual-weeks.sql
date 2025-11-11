-- ============================================================================
-- Migration: Update Manual Weeks Table for Custom Named Week Dividers
-- ============================================================================
-- Date: 2025-01-10
-- Purpose: Replace date-based manual weeks with custom-named week dividers
--          that can be positioned anywhere in the releasability board
-- ============================================================================

-- Step 1: Backup existing table (if it exists) by renaming
-- This allows you to restore data if needed
ALTER TABLE IF EXISTS releasability_manual_weeks
RENAME TO releasability_manual_weeks_backup_old;

-- Step 2: Create new manual weeks table with custom name and position support
CREATE TABLE releasability_manual_weeks (
    -- Primary key: Auto-generated UUID
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Custom name for the week divider (e.g., "Future Projects", "On Hold")
    custom_name TEXT NOT NULL CHECK (char_length(custom_name) >= 1 AND char_length(custom_name) <= 100),

    -- Position in the board (0-based index for ordering)
    -- Lower numbers appear first in the list
    position INTEGER NOT NULL CHECK (position >= 0),

    -- Timestamp when the manual week was created
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Timestamp when the manual week was last updated
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 3: Create indexes for better query performance
CREATE INDEX idx_manual_weeks_position ON releasability_manual_weeks(position);
CREATE INDEX idx_manual_weeks_created_at ON releasability_manual_weeks(created_at DESC);

-- Create unique index on custom_name (case-insensitive)
CREATE UNIQUE INDEX idx_manual_weeks_unique_name ON releasability_manual_weeks(LOWER(custom_name));

-- Step 4: Add comments for documentation
COMMENT ON TABLE releasability_manual_weeks IS 'Custom-named week dividers for the releasability board that can be positioned manually';
COMMENT ON COLUMN releasability_manual_weeks.id IS 'Unique identifier for the manual week';
COMMENT ON COLUMN releasability_manual_weeks.custom_name IS 'Custom display name for the week divider (e.g., "Future Projects")';
COMMENT ON COLUMN releasability_manual_weeks.position IS 'Position index for ordering manual weeks (0-based, lower = earlier)';
COMMENT ON COLUMN releasability_manual_weeks.created_at IS 'Timestamp when the manual week was created';
COMMENT ON COLUMN releasability_manual_weeks.updated_at IS 'Timestamp when the manual week was last modified';

-- Step 5: Enable Row Level Security (RLS) if needed
-- Uncomment the following lines if you use RLS in your project
-- ALTER TABLE releasability_manual_weeks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (adjust as needed for your authentication setup)
-- CREATE POLICY "Allow all authenticated users to read manual weeks"
--     ON releasability_manual_weeks FOR SELECT
--     TO authenticated
--     USING (true);

-- CREATE POLICY "Allow all authenticated users to insert manual weeks"
--     ON releasability_manual_weeks FOR INSERT
--     TO authenticated
--     WITH CHECK (true);

-- CREATE POLICY "Allow all authenticated users to update manual weeks"
--     ON releasability_manual_weeks FOR UPDATE
--     TO authenticated
--     USING (true);

-- CREATE POLICY "Allow all authenticated users to delete manual weeks"
--     ON releasability_manual_weeks FOR DELETE
--     TO authenticated
--     USING (true);

-- Step 6: Create trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_manual_weeks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_manual_weeks_updated_at
    BEFORE UPDATE ON releasability_manual_weeks
    FOR EACH ROW
    EXECUTE FUNCTION update_manual_weeks_updated_at();

-- ============================================================================
-- Optional: Add sample manual weeks for testing
-- ============================================================================
-- Uncomment the following lines to insert test data:

-- INSERT INTO releasability_manual_weeks (custom_name, position) VALUES
--     ('Future Projects', 0),
--     ('On Hold', 1),
--     ('Q1 Goals', 2);

-- ============================================================================
-- Migration Complete!
-- ============================================================================
-- Next steps:
-- 1. Run this SQL in your Supabase SQL editor
-- 2. Verify the new table structure
-- 3. Test the manual week functionality in the application
-- 4. If everything works, you can drop the backup table:
--    DROP TABLE IF EXISTS releasability_manual_weeks_backup_old;
-- ============================================================================
