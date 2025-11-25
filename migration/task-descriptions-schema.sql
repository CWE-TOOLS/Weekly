-- Task Descriptions Table
-- Stores task descriptions migrated from Google Sheets "Staging - Project Details"
-- This replaces the staging sheet as the source of truth for task descriptions

CREATE TABLE IF NOT EXISTS task_descriptions (
    -- Composite key fields (project, department, day_number uniquely identify a task)
    project TEXT NOT NULL,           -- Exact project name from Google Sheets (NO trimming)
    department TEXT NOT NULL,        -- Department name (e.g., "Mill 1", "Form Out 2")
    day_number TEXT NOT NULL,        -- Day number as text (e.g., "1", "2", "3")

    -- Task description data
    description TEXT,                -- The actual task description (can be NULL/empty)

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Primary key constraint
    PRIMARY KEY (project, department, day_number)
);

-- Index for faster lookups by project (common query pattern)
CREATE INDEX IF NOT EXISTS idx_task_descriptions_project
    ON task_descriptions(project);

-- Index for faster lookups by project and department
CREATE INDEX IF NOT EXISTS idx_task_descriptions_project_dept
    ON task_descriptions(project, department);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_task_descriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function before updates
DROP TRIGGER IF EXISTS task_descriptions_updated_at ON task_descriptions;
CREATE TRIGGER task_descriptions_updated_at
    BEFORE UPDATE ON task_descriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_task_descriptions_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE task_descriptions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for anonymous users (internal tool)
-- Adjust this policy based on your security requirements
DROP POLICY IF EXISTS "Allow all operations on task_descriptions" ON task_descriptions;
CREATE POLICY "Allow all operations on task_descriptions"
    ON task_descriptions
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE task_descriptions IS 'Stores task descriptions for weekly schedule tasks. Migrated from Google Sheets "Staging - Project Details".';
COMMENT ON COLUMN task_descriptions.project IS 'Project name - MUST match exactly from Google Sheets (no trimming/normalization)';
COMMENT ON COLUMN task_descriptions.department IS 'Department name (e.g., Mill 1, Form Out 2, Batch, Layout)';
COMMENT ON COLUMN task_descriptions.day_number IS 'Day number within the project timeline (stored as text)';
COMMENT ON COLUMN task_descriptions.description IS 'Task description text. Can contain HTML for Batch/Layout departments.';
