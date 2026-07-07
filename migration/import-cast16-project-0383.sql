-- =====================================================================
-- Import casting inventory for Project 0383, Cast #16
-- Source: S:\Projects\#3-Releasability\7 Fairfield Pond Lane\
--         12- Submittals\CWE Shop Drawings\_3D\Main House Castings\
--         Main House - Cast 16.pdf  (pages 2-3, Panel Inventory table)
--
-- 26 type/dimension rows · 85 panels total.
-- Color and sealer are left blank (the PDF table does not list them) —
-- set them in the Casting Inventory UI if needed.
-- Existing inventory under Cast #16 is wiped first so re-running is safe.
-- The DO block fails fast if Cast #16 is missing or ambiguous (multiple
-- phases). If the casting lives under a phase, the per-phase uniqueness
-- means there will be exactly one row to match on.
-- =====================================================================

DO $$
DECLARE
    v_casting_id uuid;
    v_count int;
BEGIN
    SELECT count(*) INTO v_count
    FROM project_castings
    WHERE project_number = '0383' AND casting_number = '16';

    IF v_count = 0 THEN
        RAISE EXCEPTION 'No casting #16 found for project 0383';
    ELSIF v_count > 1 THEN
        RAISE EXCEPTION 'Multiple casting #16 rows found for project 0383 (% rows). Specify phase_id manually.', v_count;
    END IF;

    SELECT id INTO v_casting_id
    FROM project_castings
    WHERE project_number = '0383' AND casting_number = '16';

    DELETE FROM casting_inventory WHERE casting_id = v_casting_id;

    INSERT INTO casting_inventory (casting_id, type, width, length, quantity, extras, sort_order) VALUES
        (v_casting_id, '20-C',  '3 5/16"', '20"',  3, 0,  0),
        (v_casting_id, '20-A',  '5 5/16"', '20"',  4, 0,  1),
        (v_casting_id, '20-Y',  '7 5/16"', '20"',  3, 0,  2),
        (v_casting_id, '28-C',  '3 5/16"', '28"',  1, 0,  3),
        (v_casting_id, '28-A',  '5 5/16"', '28"',  2, 0,  4),
        (v_casting_id, '47-C',  '3 5/16"', '47"',  3, 0,  5),
        (v_casting_id, '47-B',  '4 5/16"', '47"',  1, 0,  6),
        (v_casting_id, '47-X',  '5"',      '47"',  1, 0,  7),
        (v_casting_id, '47-A',  '5 5/16"', '47"',  2, 0,  8),
        (v_casting_id, '47-Y',  '7 5/16"', '47"',  2, 0,  9),
        (v_casting_id, '95-C',  '3 5/16"', '95"',  3, 0, 10),
        (v_casting_id, '95-B',  '4 5/16"', '95"',  1, 0, 11),
        (v_casting_id, '95-X',  '5"',      '95"',  1, 0, 12),
        (v_casting_id, '95-A',  '5 5/16"', '95"',  3, 0, 13),
        (v_casting_id, '95-Y',  '7 5/16"', '95"',  2, 0, 14),
        (v_casting_id, '110-C', '3 5/16"', '110"', 4, 0, 15),
        (v_casting_id, '110-A', '5 5/16"', '110"', 4, 0, 16),
        (v_casting_id, '110-Y', '7 5/16"', '110"', 3, 0, 17),
        (v_casting_id, '125-C', '3 5/16"', '125"', 4, 0, 18),
        (v_casting_id, '125-X', '5"',      '125"', 2, 0, 19),
        (v_casting_id, '125-A', '5 5/16"', '125"', 4, 0, 20),
        (v_casting_id, '125-Y', '7 5/16"', '125"', 6, 0, 21),
        (v_casting_id, '125-Z', '8"',      '125"', 1, 0, 22),
        (v_casting_id, '135-C', '3 5/16"', '135"', 9, 0, 23),
        (v_casting_id, '135-A', '5 5/16"', '135"', 8, 0, 24),
        (v_casting_id, '135-Y', '7 5/16"', '135"', 8, 0, 25);

    RAISE NOTICE 'Imported 26 inventory rows (85 panels) into casting %', v_casting_id;
END $$;
