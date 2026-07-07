-- =====================================================================
-- Import casting inventory for Project 0383, Cast #20
-- Source: panel inventory list provided by user (length, width, qty per type)
--
-- 21 type/dimension rows · 72 panels total.
-- NOTE: This list is identical to Cast #19. If that's unintentional, fix the
-- counts here before running.
--
-- Color and sealer are left blank — set them in the Casting Inventory UI if needed.
-- Existing inventory under Cast #20 is wiped first so re-running is safe.
-- The DO block fails fast if Cast #20 is missing or ambiguous (multiple
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
    WHERE project_number = '0383' AND casting_number = '20';

    IF v_count = 0 THEN
        RAISE EXCEPTION 'No casting #20 found for project 0383';
    ELSIF v_count > 1 THEN
        RAISE EXCEPTION 'Multiple casting #20 rows found for project 0383 (% rows). Specify phase_id manually.', v_count;
    END IF;

    SELECT id INTO v_casting_id
    FROM project_castings
    WHERE project_number = '0383' AND casting_number = '20';

    DELETE FROM casting_inventory WHERE casting_id = v_casting_id;

    INSERT INTO casting_inventory (casting_id, type, width, length, quantity, extras, sort_order) VALUES
        (v_casting_id, '20-C',  '3 5/16"', '20"',  1, 0,  0),
        (v_casting_id, '20-A',  '5 5/16"', '20"',  4, 0,  1),
        (v_casting_id, '20-Y',  '7 5/16"', '20"',  3, 0,  2),
        (v_casting_id, '28-C',  '3 5/16"', '28"',  1, 0,  3),
        (v_casting_id, '47-C',  '3 5/16"', '47"',  2, 0,  4),
        (v_casting_id, '47-A',  '5 5/16"', '47"',  2, 0,  5),
        (v_casting_id, '47-Y',  '7 5/16"', '47"',  2, 0,  6),
        (v_casting_id, '95-C',  '3 5/16"', '95"',  2, 0,  7),
        (v_casting_id, '95-A',  '5 5/16"', '95"',  2, 0,  8),
        (v_casting_id, '95-Y',  '7 5/16"', '95"',  2, 0,  9),
        (v_casting_id, '110-C', '3 5/16"', '110"', 4, 0, 10),
        (v_casting_id, '110-A', '5 5/16"', '110"', 2, 0, 11),
        (v_casting_id, '110-Y', '7 5/16"', '110"', 3, 0, 12),
        (v_casting_id, '125-C', '3 5/16"', '125"', 4, 0, 13),
        (v_casting_id, '125-X', '5"',      '125"', 2, 0, 14),
        (v_casting_id, '125-A', '5 5/16"', '125"', 4, 0, 15),
        (v_casting_id, '125-Y', '7 5/16"', '125"', 6, 0, 16),
        (v_casting_id, '125-Z', '8"',      '125"', 1, 0, 17),
        (v_casting_id, '135-C', '3 5/16"', '135"', 9, 0, 18),
        (v_casting_id, '135-A', '5 5/16"', '135"', 8, 0, 19),
        (v_casting_id, '135-Y', '7 5/16"', '135"', 8, 0, 20);

    RAISE NOTICE 'Imported 21 inventory rows (72 panels) into casting %', v_casting_id;
END $$;
