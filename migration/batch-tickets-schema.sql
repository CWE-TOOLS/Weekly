-- =====================================================================
-- batch_tickets schema
-- One row per casting. Pulls scaling data from the project's color_log
-- and project + casting metadata from project_castings/projects.
-- =====================================================================

-- Add casting_date to project_castings for use on the ticket header.
ALTER TABLE project_castings ADD COLUMN IF NOT EXISTS casting_date DATE;

CREATE TABLE IF NOT EXISTS batch_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    casting_id UUID NOT NULL UNIQUE REFERENCES project_castings(id) ON DELETE CASCADE,

    cu_ft NUMERIC,
    face_sq_ft NUMERIC,
    cu_ft_per_250 NUMERIC NOT NULL DEFAULT 4.28,
    pig_reduction NUMERIC NOT NULL DEFAULT 50,
    pig_reduce_first_backup BOOLEAN NOT NULL DEFAULT false,

    batched_by TEXT,
    out_temp TEXT,
    water_temp TEXT,
    notes TEXT,

    -- Manual overrides for batch type assignment.
    -- Shape: [{ batchLbs: number, type: 'face'|'firstBackUp'|'finalBackUp' }, ...]
    batch_assignments JSONB NOT NULL DEFAULT '[]'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Apply Back Up pigment reduction to First Back Up batches as well (existing DBs).
ALTER TABLE batch_tickets
    ADD COLUMN IF NOT EXISTS pig_reduce_first_backup BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS batch_tickets_casting_idx
    ON batch_tickets(casting_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION batch_tickets_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS batch_tickets_updated_at ON batch_tickets;
CREATE TRIGGER batch_tickets_updated_at
    BEFORE UPDATE ON batch_tickets
    FOR EACH ROW EXECUTE FUNCTION batch_tickets_set_updated_at();

-- RLS — match the open policy used by other tables in this project.
ALTER TABLE batch_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on batch_tickets" ON batch_tickets;
CREATE POLICY "Allow all on batch_tickets"
    ON batch_tickets
    FOR ALL
    USING (true)
    WITH CHECK (true);
