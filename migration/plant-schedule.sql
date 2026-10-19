-- =====================================================================
-- Plant Scheduler tables (2026-10-19)
-- The scheduler page (scheduler.html) keeps its grid here. It only READS the
-- portal's castings and Optimizer Hours; nothing else in the portal or the
-- weekly reads these tables until the scheduler is finalized.
-- Run in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS plant_schedule (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_number text NOT NULL,
    casting_id     uuid NOT NULL REFERENCES project_castings(id) ON DELETE CASCADE,
    phase_id       uuid REFERENCES casting_phases(id) ON DELETE CASCADE,   -- null = typed by hand
    date           date NOT NULL,
    department     text NOT NULL,          -- Mill | FO | Cast | DM | F | Seal | Crate | Spec | Ship
    task           text NOT NULL,          -- CNC, PARTS, FO, CAST, DM, G/F, GOF, ACID, WASH, TU, SEAL, AZEK, STRIP, BUILD, RACK, DRY, DRILL, PAN, SHIP …
    hours          numeric NOT NULL DEFAULT 0,
    weekend_ok     boolean NOT NULL DEFAULT false,   -- a person allowed this weekend day
    note           text,
    created_at     timestamptz DEFAULT now(),
    updated_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plant_schedule_date_idx    ON plant_schedule (date);
CREATE INDEX IF NOT EXISTS plant_schedule_casting_idx ON plant_schedule (casting_id);
CREATE INDEX IF NOT EXISTS plant_schedule_project_idx ON plant_schedule (project_number);

ALTER TABLE plant_schedule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on plant_schedule" ON plant_schedule;
CREATE POLICY "Allow all on plant_schedule" ON plant_schedule FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON plant_schedule TO anon, authenticated;

CREATE TABLE IF NOT EXISTS plant_schedule_settings (
    key        text PRIMARY KEY,           -- dayHours | holidays | weeks | showWeekends
    value      jsonb NOT NULL,
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE plant_schedule_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on plant_schedule_settings" ON plant_schedule_settings;
CREATE POLICY "Allow all on plant_schedule_settings" ON plant_schedule_settings FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON plant_schedule_settings TO anon, authenticated;
