-- 2026-10-22: Side A / Side B is a property of the casting, shared by the portal's Casting Layout tab and the
-- weekly's Cast cards. Run once in the Supabase SQL editor.
ALTER TABLE project_castings
    ADD COLUMN IF NOT EXISTS casting_side text CHECK (casting_side IN ('A', 'B'));

-- Carry over the sides already picked on the weekly (stored per Cast day in task_descriptions).
UPDATE project_castings pc
SET casting_side = td.casting_side
FROM (
    SELECT DISTINCT ON (project_number, casting_number) project_number, casting_number, casting_side
    FROM task_descriptions
    WHERE department = 'Cast' AND casting_side IN ('A', 'B') AND project_number IS NOT NULL AND casting_number IS NOT NULL
    ORDER BY project_number, casting_number, day_number
) td
WHERE td.project_number = pc.project_number AND td.casting_number = pc.casting_number AND pc.casting_side IS NULL;
