-- =====================================================================
-- Import casting inventory for Project 0383, Phase 2, Cast #3
-- Source: panel inventory list provided by user (length, width, qty per type)
--
-- 11 type/dimension rows · 80 panels total.
--
-- Color and sealer are left blank — set them in the Casting Inventory UI if needed.
-- Existing inventory under Cast #3 is wiped first so re-running is safe.
-- The DO block fails fast if Cast #3 is missing or ambiguous (multiple
-- phases). If the casting lives under a phase, the per-phase uniqueness
-- means there will be exactly one row to match on.
-- =====================================================================

DO $$
DECLARE
    v_casting_id uuid;
    v_count int;
BEGIN
    -- Scoped to Phase 2 (project_phases.id = ef66ab51-0e47-4639-8297-9e0bd0ed7768)
    -- because Cast #3 also exists under Phase 1 on this project.
    SELECT count(*) INTO v_count
    FROM project_castings
    WHERE project_number = '0383'
      AND casting_number = '3'
      AND phase_id = 'ef66ab51-0e47-4639-8297-9e0bd0ed7768';

    IF v_count = 0 THEN
        RAISE EXCEPTION 'No casting #3 found for project 0383 under Phase 2';
    ELSIF v_count > 1 THEN
        RAISE EXCEPTION 'Multiple casting #3 rows found for project 0383 under Phase 2 (% rows).', v_count;
    END IF;

    SELECT id INTO v_casting_id
    FROM project_castings
    WHERE project_number = '0383'
      AND casting_number = '3'
      AND phase_id = 'ef66ab51-0e47-4639-8297-9e0bd0ed7768';

    DELETE FROM casting_inventory WHERE casting_id = v_casting_id;

    INSERT INTO casting_inventory (casting_id, type, width, length, quantity, extras, sort_order) VALUES
        (v_casting_id, '58-A',  '5 5/16"', '58"',  10, 0,  0),
        (v_casting_id, '64-A',  '5 5/16"', '64"',   2, 0,  1),
        (v_casting_id, '89-A',  '5 5/16"', '89"',  14, 0,  2),
        (v_casting_id, '100-A', '5 5/16"', '100"', 11, 0,  3),
        (v_casting_id, '100-Z', '8"',      '100"',  2, 0,  4),
        (v_casting_id, '110-A', '5 5/16"', '110"',  2, 0,  5),
        (v_casting_id, '122-A', '5 5/16"', '122"', 27, 0,  6),
        (v_casting_id, '122-Z', '8"',      '122"',  2, 0,  7),
        (v_casting_id, '130-A', '5 5/16"', '130"',  4, 0,  8),
        (v_casting_id, '138-A', '5 5/16"', '138"',  1, 0,  9),
        (v_casting_id, '144-A', '5 5/16"', '144"',  5, 0, 10);

    RAISE NOTICE 'Imported 11 inventory rows (80 panels) into casting %', v_casting_id;
END $$;
