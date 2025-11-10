-- Releasability Board - Supabase Table Setup
-- This file creates the releasability_tracking table for storing project tracking statuses
-- Run this SQL in your Supabase SQL Editor to set up the table

-- Create releasability_tracking table
CREATE TABLE IF NOT EXISTS releasability_tracking (
    project TEXT NOT NULL,
    week_monday DATE NOT NULL,
    tracking_status JSONB NOT NULL DEFAULT '{}'::jsonb,
    department TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Composite primary key (project + week combination must be unique)
    PRIMARY KEY (project, week_monday)
);

-- Create index on updated_at for efficient sorting
CREATE INDEX IF NOT EXISTS idx_releasability_tracking_updated_at
    ON releasability_tracking(updated_at DESC);

-- Create index on week_monday for efficient weekly queries
CREATE INDEX IF NOT EXISTS idx_releasability_tracking_week_monday
    ON releasability_tracking(week_monday);

-- Create index on department for filtering
CREATE INDEX IF NOT EXISTS idx_releasability_tracking_department
    ON releasability_tracking(department);

-- Enable Row Level Security
ALTER TABLE releasability_tracking ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your auth requirements)
-- For now, allowing all operations without authentication
-- You may want to restrict this based on your security requirements
CREATE POLICY "Allow all operations on releasability_tracking"
    ON releasability_tracking
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Grant permissions (adjust based on your setup)
-- This grants access to the anonymous and authenticated roles
GRANT ALL ON releasability_tracking TO anon;
GRANT ALL ON releasability_tracking TO authenticated;

-- Add comment to table
COMMENT ON TABLE releasability_tracking IS
    'Stores tracking status data for the Releasability Board. Each row represents a project in a specific week with its tracking status for 20 milestones.';

-- Add comments to columns
COMMENT ON COLUMN releasability_tracking.project IS 'Project name (e.g., "Alpha Project")';
COMMENT ON COLUMN releasability_tracking.week_monday IS 'Monday date of the week (YYYY-MM-DD)';
COMMENT ON COLUMN releasability_tracking.tracking_status IS 'JSON object containing status for each of the 20 tracking items';
COMMENT ON COLUMN releasability_tracking.department IS 'Department associated with the project (optional)';
COMMENT ON COLUMN releasability_tracking.source IS 'Source of the project: "sheets" or "manual"';
COMMENT ON COLUMN releasability_tracking.updated_at IS 'Timestamp of last update';
COMMENT ON COLUMN releasability_tracking.created_at IS 'Timestamp of creation';

-- Example of tracking_status JSON structure:
-- {
--   "Shop Folder Built": "complete",
--   "Sample Approval": "in_progress",
--   "Color Log": "incomplete",
--   ... (all 20 tracking items)
-- }

-- Example insert (for testing):
-- INSERT INTO releasability_tracking (project, week_monday, tracking_status, department, source)
-- VALUES (
--     'Test Project',
--     '2025-11-10',
--     '{"Shop Folder Built": "complete", "Sample Approval": "in_progress"}'::jsonb,
--     'Mill',
--     'manual'
-- );
