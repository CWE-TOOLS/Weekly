-- =====================================================================
-- finishing_map: where each casting physically sits once it reaches finishing
-- (2026-10-22) — the portal's "Finishing Map" page (finishing-map.html)
--
-- One row per casting (project_number + casting_number, the weekly's keys).
--   area        tent1 | wetroom | blacktop | large | tent2 | coop1..coop6   (NULL = still in the queue)
--   moved_by    who moved it last (typed name, no login)
--   moved_at    when it was last moved
--   shipped_on  the day the casting left the plant; the card leaves the map and
--               shows in the "Shipped" drawer for 60 days
--
-- Run in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS finishing_map (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_number  TEXT NOT NULL,
    casting_number  TEXT NOT NULL,
    area            TEXT,
    moved_by        TEXT,
    moved_at        TIMESTAMPTZ,
    shipped_on      DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_number, casting_number)
);

CREATE INDEX IF NOT EXISTS finishing_map_area_idx ON finishing_map (area);

-- Same open policy as the rest of the portal (no logins).
ALTER TABLE finishing_map ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "finishing_map open" ON finishing_map;
CREATE POLICY "finishing_map open" ON finishing_map FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON finishing_map TO anon, authenticated;

-- Every move, ship and put-back, newest first in the page's "Log" panel.
CREATE TABLE IF NOT EXISTS finishing_map_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_number  TEXT NOT NULL,
    casting_number  TEXT NOT NULL,
    kind            TEXT NOT NULL CHECK (kind IN ('move', 'shipped', 'put_back')),
    from_area       TEXT,
    to_area         TEXT,
    moved_by        TEXT,
    moved_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS finishing_map_log_time_idx ON finishing_map_log (moved_at DESC);
ALTER TABLE finishing_map_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "finishing_map_log open" ON finishing_map_log;
CREATE POLICY "finishing_map_log open" ON finishing_map_log FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON finishing_map_log TO anon, authenticated;
