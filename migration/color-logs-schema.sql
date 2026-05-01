-- =====================================================================
-- color_logs schema
-- One row per project, plus reusable presets (project_number IS NULL).
-- Ingredient lists are stored as JSONB to mirror the form shape exactly.
-- =====================================================================

CREATE TABLE IF NOT EXISTS color_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_number TEXT REFERENCES projects(project_number) ON DELETE CASCADE,

    is_preset BOOLEAN NOT NULL DEFAULT FALSE,
    preset_name TEXT,

    name TEXT NOT NULL DEFAULT '',
    log_date DATE,
    made_by TEXT,
    temperature TEXT,
    project_text TEXT,
    is_standard BOOLEAN NOT NULL DEFAULT TRUE,
    cement_type TEXT NOT NULL DEFAULT 'white',
    cast_method TEXT NOT NULL DEFAULT 'sprayUp',

    base_ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
    additives       JSONB NOT NULL DEFAULT '[]'::jsonb,
    aggregates      JSONB NOT NULL DEFAULT '[]'::jsonb,
    pigments        JSONB NOT NULL DEFAULT '[]'::jsonb,
    grout_type      JSONB NOT NULL DEFAULT '[]'::jsonb,
    fill_coat       JSONB NOT NULL DEFAULT '[]'::jsonb,

    finishing_notes TEXT DEFAULT '',
    sealing_notes   TEXT DEFAULT '',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- A preset has no project; a non-preset must have one.
    CONSTRAINT color_logs_preset_xor_project CHECK (
        (is_preset = TRUE  AND project_number IS NULL) OR
        (is_preset = FALSE AND project_number IS NOT NULL)
    )
);

-- One non-preset log per project (multiple presets allowed).
CREATE UNIQUE INDEX IF NOT EXISTS color_logs_one_per_project
    ON color_logs(project_number)
    WHERE is_preset = FALSE AND project_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS color_logs_preset_idx
    ON color_logs(is_preset, preset_name)
    WHERE is_preset = TRUE;

-- updated_at trigger
CREATE OR REPLACE FUNCTION color_logs_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS color_logs_updated_at ON color_logs;
CREATE TRIGGER color_logs_updated_at
    BEFORE UPDATE ON color_logs
    FOR EACH ROW EXECUTE FUNCTION color_logs_set_updated_at();

-- RLS — match the open policy used by other tables in this project.
ALTER TABLE color_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on color_logs" ON color_logs;
CREATE POLICY "Allow all on color_logs"
    ON color_logs
    FOR ALL
    USING (true)
    WITH CHECK (true);
