-- Actual Hours
--
-- Records actual labor hours against a planned task from the Weekly Schedule.
-- One row per planned task (composite key); re-entries upsert.
-- planned_hours is snapshotted at entry time so the Project Portal can render
-- Planned vs Actual without re-reading the Google Sheet.

CREATE TABLE IF NOT EXISTS actual_hours (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_date       DATE NOT NULL,
    project_number  TEXT,
    casting_number  TEXT,
    department      TEXT NOT NULL,
    day_number      TEXT,
    planned_hours   TEXT,
    actual_hours    NUMERIC NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (task_date, project_number, casting_number, department, day_number)
);

CREATE INDEX IF NOT EXISTS idx_actual_hours_project
    ON actual_hours (project_number);

CREATE INDEX IF NOT EXISTS idx_actual_hours_date
    ON actual_hours (task_date);

ALTER TABLE actual_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on actual_hours"
    ON actual_hours
    FOR ALL
    USING (true)
    WITH CHECK (true);
