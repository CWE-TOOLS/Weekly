-- =====================================================================
-- Import casting inventory for Project 0383, Cast #18.1 ("18 Remake Part 1")
-- Source: panel list provided by user (mother molds disregarded per user)
--
-- 3 type/dimension rows · 20 panels total.
-- Color and sealer are left blank — set them in the Casting Inventory UI if needed.
-- Existing inventory under Cast #18.1 is wiped first so re-running is safe.
-- The DO block fails fast if Cast #18.1 is missing or ambiguous.
--
-- NOTE: already applied directly via the Supabase REST API on 2026-07-06;
-- this file is the record / re-run script.
-- =====================================================================

DO $$
DECLARE
    v_casting_id uuid;
    v_count int;
BEGIN
    SELECT count(*) INTO v_count
    FROM project_castings
    WHERE project_number = '0383' AND casting_number = '18.1';

    IF v_count = 0 THEN
        RAISE EXCEPTION 'No casting #18.1 found for project 0383';
    ELSIF v_count > 1 THEN
        RAISE EXCEPTION 'Multiple casting #18.1 rows found for project 0383 (% rows). Specify phase_id manually.', v_count;
    END IF;

    SELECT id INTO v_casting_id
    FROM project_castings
    WHERE project_number = '0383' AND casting_number = '18.1';

    DELETE FROM casting_inventory WHERE casting_id = v_casting_id;

    INSERT INTO casting_inventory (casting_id, type, width, length, quantity, extras, sort_order) VALUES
        (v_casting_id, '135-C', '3 5/16"', '135"', 9, 0, 0),
        (v_casting_id, '135-A', '5 5/16"', '135"', 8, 0, 1),
        (v_casting_id, '125-A', '5 5/16"', '125"', 3, 0, 2);

    RAISE NOTICE 'Imported 3 inventory rows (20 panels) into casting %', v_casting_id;
END $$;
