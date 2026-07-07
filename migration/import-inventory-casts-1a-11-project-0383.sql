-- =====================================================================
-- Phase 1: import legacy tracking sheet → casting_inventory.
-- Project 0383, casts 1A, 1B, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11.
-- Mockups + empty Cast 12 skipped.
--
-- Each row aggregates CSV panels by (type, color, sealer) per cast.
-- width/length left NULL — fill from the Castings tab.
--
-- The Tracking tab's auto-sync will regenerate casting_components from
-- this inventory. A separate phase 2 script applies produced + crate_id.
--
-- Re-runnable: wipes existing casting_inventory for the touched castings.
-- =====================================================================

DO $$
DECLARE
    v_cast_1a uuid;
    v_cast_1b uuid;
    v_cast_2 uuid;
    v_cast_3 uuid;
    v_cast_4 uuid;
    v_cast_5 uuid;
    v_cast_6 uuid;
    v_cast_7 uuid;
    v_cast_8 uuid;
    v_cast_9 uuid;
    v_cast_10 uuid;
    v_cast_11 uuid;
    v_count int;
BEGIN

    SELECT count(*) INTO v_count FROM project_castings
        WHERE project_number = '0383' AND casting_number = '1A';
    IF v_count = 0 THEN
        RAISE EXCEPTION 'No casting % found for project 0383', '1A';
    ELSIF v_count > 1 THEN
        RAISE EXCEPTION 'Multiple casting % rows for project 0383 (% rows). Specify phase_id.', '1A', v_count;
    END IF;
    SELECT id INTO v_cast_1a FROM project_castings
        WHERE project_number = '0383' AND casting_number = '1A';

    SELECT count(*) INTO v_count FROM project_castings
        WHERE project_number = '0383' AND casting_number = '1B';
    IF v_count = 0 THEN
        RAISE EXCEPTION 'No casting % found for project 0383', '1B';
    ELSIF v_count > 1 THEN
        RAISE EXCEPTION 'Multiple casting % rows for project 0383 (% rows). Specify phase_id.', '1B', v_count;
    END IF;
    SELECT id INTO v_cast_1b FROM project_castings
        WHERE project_number = '0383' AND casting_number = '1B';

    SELECT count(*) INTO v_count FROM project_castings
        WHERE project_number = '0383' AND casting_number = '2';
    IF v_count = 0 THEN
        RAISE EXCEPTION 'No casting % found for project 0383', '2';
    ELSIF v_count > 1 THEN
        RAISE EXCEPTION 'Multiple casting % rows for project 0383 (% rows). Specify phase_id.', '2', v_count;
    END IF;
    SELECT id INTO v_cast_2 FROM project_castings
        WHERE project_number = '0383' AND casting_number = '2';

    SELECT count(*) INTO v_count FROM project_castings
        WHERE project_number = '0383' AND casting_number = '3';
    IF v_count = 0 THEN
        RAISE EXCEPTION 'No casting % found for project 0383', '3';
    ELSIF v_count > 1 THEN
        RAISE EXCEPTION 'Multiple casting % rows for project 0383 (% rows). Specify phase_id.', '3', v_count;
    END IF;
    SELECT id INTO v_cast_3 FROM project_castings
        WHERE project_number = '0383' AND casting_number = '3';

    SELECT count(*) INTO v_count FROM project_castings
        WHERE project_number = '0383' AND casting_number = '4';
    IF v_count = 0 THEN
        RAISE EXCEPTION 'No casting % found for project 0383', '4';
    ELSIF v_count > 1 THEN
        RAISE EXCEPTION 'Multiple casting % rows for project 0383 (% rows). Specify phase_id.', '4', v_count;
    END IF;
    SELECT id INTO v_cast_4 FROM project_castings
        WHERE project_number = '0383' AND casting_number = '4';

    SELECT count(*) INTO v_count FROM project_castings
        WHERE project_number = '0383' AND casting_number = '5';
    IF v_count = 0 THEN
        RAISE EXCEPTION 'No casting % found for project 0383', '5';
    ELSIF v_count > 1 THEN
        RAISE EXCEPTION 'Multiple casting % rows for project 0383 (% rows). Specify phase_id.', '5', v_count;
    END IF;
    SELECT id INTO v_cast_5 FROM project_castings
        WHERE project_number = '0383' AND casting_number = '5';

    SELECT count(*) INTO v_count FROM project_castings
        WHERE project_number = '0383' AND casting_number = '6';
    IF v_count = 0 THEN
        RAISE EXCEPTION 'No casting % found for project 0383', '6';
    ELSIF v_count > 1 THEN
        RAISE EXCEPTION 'Multiple casting % rows for project 0383 (% rows). Specify phase_id.', '6', v_count;
    END IF;
    SELECT id INTO v_cast_6 FROM project_castings
        WHERE project_number = '0383' AND casting_number = '6';

    SELECT count(*) INTO v_count FROM project_castings
        WHERE project_number = '0383' AND casting_number = '7';
    IF v_count = 0 THEN
        RAISE EXCEPTION 'No casting % found for project 0383', '7';
    ELSIF v_count > 1 THEN
        RAISE EXCEPTION 'Multiple casting % rows for project 0383 (% rows). Specify phase_id.', '7', v_count;
    END IF;
    SELECT id INTO v_cast_7 FROM project_castings
        WHERE project_number = '0383' AND casting_number = '7';

    SELECT count(*) INTO v_count FROM project_castings
        WHERE project_number = '0383' AND casting_number = '8';
    IF v_count = 0 THEN
        RAISE EXCEPTION 'No casting % found for project 0383', '8';
    ELSIF v_count > 1 THEN
        RAISE EXCEPTION 'Multiple casting % rows for project 0383 (% rows). Specify phase_id.', '8', v_count;
    END IF;
    SELECT id INTO v_cast_8 FROM project_castings
        WHERE project_number = '0383' AND casting_number = '8';

    SELECT count(*) INTO v_count FROM project_castings
        WHERE project_number = '0383' AND casting_number = '9';
    IF v_count = 0 THEN
        RAISE EXCEPTION 'No casting % found for project 0383', '9';
    ELSIF v_count > 1 THEN
        RAISE EXCEPTION 'Multiple casting % rows for project 0383 (% rows). Specify phase_id.', '9', v_count;
    END IF;
    SELECT id INTO v_cast_9 FROM project_castings
        WHERE project_number = '0383' AND casting_number = '9';

    SELECT count(*) INTO v_count FROM project_castings
        WHERE project_number = '0383' AND casting_number = '10';
    IF v_count = 0 THEN
        RAISE EXCEPTION 'No casting % found for project 0383', '10';
    ELSIF v_count > 1 THEN
        RAISE EXCEPTION 'Multiple casting % rows for project 0383 (% rows). Specify phase_id.', '10', v_count;
    END IF;
    SELECT id INTO v_cast_10 FROM project_castings
        WHERE project_number = '0383' AND casting_number = '10';

    SELECT count(*) INTO v_count FROM project_castings
        WHERE project_number = '0383' AND casting_number = '11';
    IF v_count = 0 THEN
        RAISE EXCEPTION 'No casting % found for project 0383', '11';
    ELSIF v_count > 1 THEN
        RAISE EXCEPTION 'Multiple casting % rows for project 0383 (% rows). Specify phase_id.', '11', v_count;
    END IF;
    SELECT id INTO v_cast_11 FROM project_castings
        WHERE project_number = '0383' AND casting_number = '11';

    -- ----- Wipe existing inventory for these castings -----
    DELETE FROM casting_inventory WHERE casting_id IN (v_cast_1a, v_cast_1b, v_cast_2, v_cast_3, v_cast_4, v_cast_5, v_cast_6, v_cast_7, v_cast_8, v_cast_9, v_cast_10, v_cast_11);

    -- Cast 1A: 5 type rows, 49 panels
    INSERT INTO casting_inventory
        (casting_id, type, width, length, color, sealer, quantity, extras, sort_order)
    VALUES
        (v_cast_1a, '125-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 14, 0, 0),
        (v_cast_1a, '125-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 13, 0, 1),
        (v_cast_1a, '125-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 8, 0, 2),
        (v_cast_1a, '110-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 6, 0, 3),
        (v_cast_1a, '125-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 8, 0, 4);

    -- Cast 1B: 31 type rows, 76 panels
    INSERT INTO casting_inventory
        (casting_id, type, width, length, color, sealer, quantity, extras, sort_order)
    VALUES
        (v_cast_1b, '125-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 0),
        (v_cast_1b, '125-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 5, 0, 1),
        (v_cast_1b, '110-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 2),
        (v_cast_1b, '047-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 6, 0, 3),
        (v_cast_1b, '095-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 4),
        (v_cast_1b, '047-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 5),
        (v_cast_1b, '095-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 6),
        (v_cast_1b, '028-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 7),
        (v_cast_1b, '110-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 8),
        (v_cast_1b, '047-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 9),
        (v_cast_1b, '095-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 10),
        (v_cast_1b, '067-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 11),
        (v_cast_1b, '095-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 12),
        (v_cast_1b, '078-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 13),
        (v_cast_1b, '078-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 14),
        (v_cast_1b, '047-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 15),
        (v_cast_1b, '067-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 16),
        (v_cast_1b, '047-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 17),
        (v_cast_1b, '095-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 18),
        (v_cast_1b, '020-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 19),
        (v_cast_1b, '110-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 20),
        (v_cast_1b, '028-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 21),
        (v_cast_1b, '028-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 22),
        (v_cast_1b, '020-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 23),
        (v_cast_1b, '110-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 24),
        (v_cast_1b, '067-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 25),
        (v_cast_1b, '135-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 26),
        (v_cast_1b, '020-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 27),
        (v_cast_1b, '067-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 28),
        (v_cast_1b, '078-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 29),
        (v_cast_1b, '135-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 30);

    -- Cast 2: 30 type rows, 118 panels
    INSERT INTO casting_inventory
        (casting_id, type, width, length, color, sealer, quantity, extras, sort_order)
    VALUES
        (v_cast_2, '125-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 15, 0, 0),
        (v_cast_2, '125-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 13, 0, 1),
        (v_cast_2, '125-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 11, 0, 2),
        (v_cast_2, '125-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 14, 0, 3),
        (v_cast_2, '110-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 6, 0, 4),
        (v_cast_2, '125-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 5, 0, 5),
        (v_cast_2, '110-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 6),
        (v_cast_2, '047-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 7),
        (v_cast_2, '095-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 8),
        (v_cast_2, '047-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 9),
        (v_cast_2, '095-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 10),
        (v_cast_2, '028-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 11),
        (v_cast_2, '110-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 12),
        (v_cast_2, '047-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 13),
        (v_cast_2, '095-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 14),
        (v_cast_2, '067-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 15),
        (v_cast_2, '095-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 16),
        (v_cast_2, '078-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 17),
        (v_cast_2, '078-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 18),
        (v_cast_2, '047-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 19),
        (v_cast_2, '067-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 20),
        (v_cast_2, '047-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 21),
        (v_cast_2, '095-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 22),
        (v_cast_2, '020-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 23),
        (v_cast_2, '110-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 24),
        (v_cast_2, '028-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 25),
        (v_cast_2, '028-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 26),
        (v_cast_2, '020-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 27),
        (v_cast_2, '110-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 28),
        (v_cast_2, '067-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 29);

    -- Cast 3: 37 type rows, 129 panels
    INSERT INTO casting_inventory
        (casting_id, type, width, length, color, sealer, quantity, extras, sort_order)
    VALUES
        (v_cast_3, '125-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 14, 0, 0),
        (v_cast_3, '125-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 13, 0, 1),
        (v_cast_3, '125-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 8, 0, 2),
        (v_cast_3, '110-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 6, 0, 3),
        (v_cast_3, '125-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 10, 0, 4),
        (v_cast_3, '125-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 5, 0, 5),
        (v_cast_3, '110-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 6),
        (v_cast_3, '047-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 7),
        (v_cast_3, '095-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 8),
        (v_cast_3, '047-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 9),
        (v_cast_3, '095-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 10),
        (v_cast_3, '028-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 11),
        (v_cast_3, '110-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 5, 0, 12),
        (v_cast_3, '047-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 13),
        (v_cast_3, '095-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 14),
        (v_cast_3, '067-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 15),
        (v_cast_3, '095-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 16),
        (v_cast_3, '078-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 17),
        (v_cast_3, '078-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 18),
        (v_cast_3, '047-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 19),
        (v_cast_3, '067-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 20),
        (v_cast_3, '047-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 21),
        (v_cast_3, '095-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 22),
        (v_cast_3, '020-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 23),
        (v_cast_3, '110-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 8, 0, 24),
        (v_cast_3, '028-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 25),
        (v_cast_3, '028-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 26),
        (v_cast_3, '020-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 27),
        (v_cast_3, '110-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 28),
        (v_cast_3, '067-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 29),
        (v_cast_3, '135-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 30),
        (v_cast_3, '020-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 31),
        (v_cast_3, '067-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 32),
        (v_cast_3, '078-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 33),
        (v_cast_3, '135-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 34),
        (v_cast_3, '028-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 35),
        (v_cast_3, '020-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 36);

    -- Cast 4: 37 type rows, 129 panels
    INSERT INTO casting_inventory
        (casting_id, type, width, length, color, sealer, quantity, extras, sort_order)
    VALUES
        (v_cast_4, '125-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 14, 0, 0),
        (v_cast_4, '125-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 13, 0, 1),
        (v_cast_4, '125-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 8, 0, 2),
        (v_cast_4, '110-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 6, 0, 3),
        (v_cast_4, '125-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 10, 0, 4),
        (v_cast_4, '125-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 5, 0, 5),
        (v_cast_4, '110-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 6),
        (v_cast_4, '047-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 7),
        (v_cast_4, '095-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 8),
        (v_cast_4, '047-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 9),
        (v_cast_4, '095-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 10),
        (v_cast_4, '028-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 11),
        (v_cast_4, '110-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 5, 0, 12),
        (v_cast_4, '047-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 13),
        (v_cast_4, '095-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 14),
        (v_cast_4, '067-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 15),
        (v_cast_4, '095-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 16),
        (v_cast_4, '078-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 17),
        (v_cast_4, '078-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 18),
        (v_cast_4, '047-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 19),
        (v_cast_4, '067-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 20),
        (v_cast_4, '047-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 21),
        (v_cast_4, '095-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 22),
        (v_cast_4, '020-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 23),
        (v_cast_4, '110-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 8, 0, 24),
        (v_cast_4, '028-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 25),
        (v_cast_4, '028-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 26),
        (v_cast_4, '020-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 27),
        (v_cast_4, '110-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 28),
        (v_cast_4, '067-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 29),
        (v_cast_4, '135-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 30),
        (v_cast_4, '020-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 31),
        (v_cast_4, '067-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 32),
        (v_cast_4, '078-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 33),
        (v_cast_4, '135-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 34),
        (v_cast_4, '028-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 35),
        (v_cast_4, '020-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 36);

    -- Cast 5: 38 type rows, 125 panels
    INSERT INTO casting_inventory
        (casting_id, type, width, length, color, sealer, quantity, extras, sort_order)
    VALUES
        (v_cast_5, '125-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 14, 0, 0),
        (v_cast_5, '125-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 13, 0, 1),
        (v_cast_5, '125-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 7, 0, 2),
        (v_cast_5, '110-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 5, 0, 3),
        (v_cast_5, '125-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 8, 0, 4),
        (v_cast_5, '125-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 5),
        (v_cast_5, '110-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 6),
        (v_cast_5, '047-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 5, 0, 7),
        (v_cast_5, '095-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 8),
        (v_cast_5, '047-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 9),
        (v_cast_5, '095-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 10),
        (v_cast_5, '028-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 11),
        (v_cast_5, '110-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 12),
        (v_cast_5, '047-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 13),
        (v_cast_5, '095-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 14),
        (v_cast_5, '067-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 15),
        (v_cast_5, '095-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 6, 0, 16),
        (v_cast_5, '078-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 17),
        (v_cast_5, '078-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 18),
        (v_cast_5, '047-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 19),
        (v_cast_5, '067-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 20),
        (v_cast_5, '047-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 21),
        (v_cast_5, '095-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 22),
        (v_cast_5, '020-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 23),
        (v_cast_5, '110-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 24),
        (v_cast_5, '028-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 25),
        (v_cast_5, '028-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 26),
        (v_cast_5, '020-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 27),
        (v_cast_5, '110-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 28),
        (v_cast_5, '067-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 29),
        (v_cast_5, '135-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 30),
        (v_cast_5, '020-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 31),
        (v_cast_5, '067-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 32),
        (v_cast_5, '078-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 33),
        (v_cast_5, '135-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 34),
        (v_cast_5, '036-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 35),
        (v_cast_5, '135-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 36),
        (v_cast_5, '078-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 37);

    -- Cast 6: 37 type rows, 123 panels
    INSERT INTO casting_inventory
        (casting_id, type, width, length, color, sealer, quantity, extras, sort_order)
    VALUES
        (v_cast_6, '125-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 14, 0, 0),
        (v_cast_6, '125-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 13, 0, 1),
        (v_cast_6, '125-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 7, 0, 2),
        (v_cast_6, '110-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 5, 0, 3),
        (v_cast_6, '125-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 8, 0, 4),
        (v_cast_6, '125-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 5),
        (v_cast_6, '110-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 6),
        (v_cast_6, '047-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 7),
        (v_cast_6, '095-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 8),
        (v_cast_6, '047-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 9),
        (v_cast_6, '095-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 10),
        (v_cast_6, '028-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 11),
        (v_cast_6, '110-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 12),
        (v_cast_6, '047-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 13),
        (v_cast_6, '095-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 14),
        (v_cast_6, '067-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 15),
        (v_cast_6, '095-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 16),
        (v_cast_6, '078-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 17),
        (v_cast_6, '078-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 18),
        (v_cast_6, '047-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 19),
        (v_cast_6, '067-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 20),
        (v_cast_6, '047-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 21),
        (v_cast_6, '095-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 22),
        (v_cast_6, '020-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 23),
        (v_cast_6, '110-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 24),
        (v_cast_6, '028-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 25),
        (v_cast_6, '028-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 26),
        (v_cast_6, '020-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 27),
        (v_cast_6, '110-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 28),
        (v_cast_6, '067-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 29),
        (v_cast_6, '135-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 30),
        (v_cast_6, '078-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 31),
        (v_cast_6, '135-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 6, 0, 32),
        (v_cast_6, '036-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 6, 0, 33),
        (v_cast_6, '135-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 34),
        (v_cast_6, '036-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 35),
        (v_cast_6, '078-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 36);

    -- Cast 7: 38 type rows, 137 panels
    INSERT INTO casting_inventory
        (casting_id, type, width, length, color, sealer, quantity, extras, sort_order)
    VALUES
        (v_cast_7, '125-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 13, 0, 0),
        (v_cast_7, '125-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 12, 0, 1),
        (v_cast_7, '125-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 7, 0, 2),
        (v_cast_7, '110-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 5, 0, 3),
        (v_cast_7, '125-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 8, 0, 4),
        (v_cast_7, '125-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 5),
        (v_cast_7, '110-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 6),
        (v_cast_7, '047-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 7),
        (v_cast_7, '095-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 8),
        (v_cast_7, '047-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 6, 0, 9),
        (v_cast_7, '095-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 10),
        (v_cast_7, '028-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 11),
        (v_cast_7, '110-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 12),
        (v_cast_7, '047-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 6, 0, 13),
        (v_cast_7, '095-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 14),
        (v_cast_7, '067-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 15),
        (v_cast_7, '095-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 5, 0, 16),
        (v_cast_7, '078-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 17),
        (v_cast_7, '078-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 18),
        (v_cast_7, '047-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 19),
        (v_cast_7, '067-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 20),
        (v_cast_7, '047-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 21),
        (v_cast_7, '095-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 8, 0, 22),
        (v_cast_7, '020-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 23),
        (v_cast_7, '110-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 6, 0, 24),
        (v_cast_7, '028-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 25),
        (v_cast_7, '028-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 26),
        (v_cast_7, '020-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 27),
        (v_cast_7, '110-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 28),
        (v_cast_7, '067-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 29),
        (v_cast_7, '036-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 30),
        (v_cast_7, '078-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 31),
        (v_cast_7, '067-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 32),
        (v_cast_7, '036-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 33),
        (v_cast_7, '036-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 34),
        (v_cast_7, '078-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 35),
        (v_cast_7, '020-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 36),
        (v_cast_7, '067-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 37);

    -- Cast 8: 31 type rows, 102 panels
    INSERT INTO casting_inventory
        (casting_id, type, width, length, color, sealer, quantity, extras, sort_order)
    VALUES
        (v_cast_8, '125-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 13, 0, 0),
        (v_cast_8, '125-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 12, 0, 1),
        (v_cast_8, '125-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 7, 0, 2),
        (v_cast_8, '110-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 5, 0, 3),
        (v_cast_8, '125-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 8, 0, 4),
        (v_cast_8, '125-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 5),
        (v_cast_8, '110-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 6),
        (v_cast_8, '047-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 6, 0, 7),
        (v_cast_8, '095-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 8),
        (v_cast_8, '047-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 9),
        (v_cast_8, '095-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 10),
        (v_cast_8, '028-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 11),
        (v_cast_8, '110-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 12),
        (v_cast_8, '047-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 13),
        (v_cast_8, '095-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 14),
        (v_cast_8, '067-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 15),
        (v_cast_8, '095-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 16),
        (v_cast_8, '078-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 17),
        (v_cast_8, '078-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 18),
        (v_cast_8, '047-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 19),
        (v_cast_8, '067-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 20),
        (v_cast_8, '047-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 21),
        (v_cast_8, '095-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 22),
        (v_cast_8, '020-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 23),
        (v_cast_8, '110-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 24),
        (v_cast_8, '067-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 25),
        (v_cast_8, '067-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 26),
        (v_cast_8, '036-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 27),
        (v_cast_8, '078-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 6, 0, 28),
        (v_cast_8, '036-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 29),
        (v_cast_8, '036-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 30);

    -- Cast 9: 25 type rows, 78 panels
    INSERT INTO casting_inventory
        (casting_id, type, width, length, color, sealer, quantity, extras, sort_order)
    VALUES
        (v_cast_9, '125-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 13, 0, 0),
        (v_cast_9, '125-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 12, 0, 1),
        (v_cast_9, '125-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 7, 0, 2),
        (v_cast_9, '110-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 5, 0, 3),
        (v_cast_9, '125-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 8, 0, 4),
        (v_cast_9, '125-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 5),
        (v_cast_9, '110-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 6),
        (v_cast_9, '047-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 7),
        (v_cast_9, '095-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 8),
        (v_cast_9, '047-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 9),
        (v_cast_9, '095-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 10),
        (v_cast_9, '028-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 11),
        (v_cast_9, '110-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 12),
        (v_cast_9, '047-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 13),
        (v_cast_9, '095-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 14),
        (v_cast_9, '067-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 15),
        (v_cast_9, '095-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 16),
        (v_cast_9, '078-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 17),
        (v_cast_9, '078-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 18),
        (v_cast_9, '047-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 19),
        (v_cast_9, '067-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 20),
        (v_cast_9, '047-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 21),
        (v_cast_9, '095-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 22),
        (v_cast_9, '020-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 23),
        (v_cast_9, '110-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 24);

    -- Cast 10: 23 type rows, 75 panels
    INSERT INTO casting_inventory
        (casting_id, type, width, length, color, sealer, quantity, extras, sort_order)
    VALUES
        (v_cast_10, '125-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 13, 0, 0),
        (v_cast_10, '125-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 12, 0, 1),
        (v_cast_10, '125-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 7, 0, 2),
        (v_cast_10, '110-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 5, 0, 3),
        (v_cast_10, '125-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 8, 0, 4),
        (v_cast_10, '125-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 4, 0, 5),
        (v_cast_10, '110-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 6),
        (v_cast_10, '047-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 3, 0, 7),
        (v_cast_10, '095-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 8),
        (v_cast_10, '047-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 9),
        (v_cast_10, '095-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 10),
        (v_cast_10, '028-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 11),
        (v_cast_10, '110-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 12),
        (v_cast_10, '047-B', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 13),
        (v_cast_10, '095-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 14),
        (v_cast_10, '067-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 15),
        (v_cast_10, '095-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 16),
        (v_cast_10, '078-C', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 17),
        (v_cast_10, '078-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 18),
        (v_cast_10, '047-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 19),
        (v_cast_10, '067-A', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 20),
        (v_cast_10, '047-X', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 1, 0, 21),
        (v_cast_10, '095-D', NULL, NULL, 'CUSTOM', 'GHOST SHIELD', 2, 0, 22);

    -- Cast 11: 23 type rows, 75 panels
    INSERT INTO casting_inventory
        (casting_id, type, width, length, color, sealer, quantity, extras, sort_order)
    VALUES
        (v_cast_11, '125-C', NULL, NULL, NULL, NULL, 13, 0, 0),
        (v_cast_11, '125-A', NULL, NULL, NULL, NULL, 12, 0, 1),
        (v_cast_11, '125-B', NULL, NULL, NULL, NULL, 7, 0, 2),
        (v_cast_11, '110-C', NULL, NULL, NULL, NULL, 5, 0, 3),
        (v_cast_11, '125-D', NULL, NULL, NULL, NULL, 8, 0, 4),
        (v_cast_11, '125-X', NULL, NULL, NULL, NULL, 4, 0, 5),
        (v_cast_11, '110-B', NULL, NULL, NULL, NULL, 2, 0, 6),
        (v_cast_11, '95-B', NULL, NULL, NULL, NULL, 2, 0, 7),
        (v_cast_11, '47-C', NULL, NULL, NULL, NULL, 3, 0, 8),
        (v_cast_11, '95-A', NULL, NULL, NULL, NULL, 2, 0, 9),
        (v_cast_11, '47-D', NULL, NULL, NULL, NULL, 2, 0, 10),
        (v_cast_11, '110-A', NULL, NULL, NULL, NULL, 1, 0, 11),
        (v_cast_11, '28-C', NULL, NULL, NULL, NULL, 1, 0, 12),
        (v_cast_11, '95-X', NULL, NULL, NULL, NULL, 1, 0, 13),
        (v_cast_11, '47-B', NULL, NULL, NULL, NULL, 1, 0, 14),
        (v_cast_11, '67-C', NULL, NULL, NULL, NULL, 2, 0, 15),
        (v_cast_11, '95-C', NULL, NULL, NULL, NULL, 1, 0, 16),
        (v_cast_11, '78-C', NULL, NULL, NULL, NULL, 1, 0, 17),
        (v_cast_11, '78-A', NULL, NULL, NULL, NULL, 1, 0, 18),
        (v_cast_11, '47-A', NULL, NULL, NULL, NULL, 1, 0, 19),
        (v_cast_11, '67-A', NULL, NULL, NULL, NULL, 2, 0, 20),
        (v_cast_11, '95-D', NULL, NULL, NULL, NULL, 2, 0, 21),
        (v_cast_11, '47-X', NULL, NULL, NULL, NULL, 1, 0, 22);

    RAISE NOTICE 'Imported % inventory rows (% panels) across % casts', 355, 1216, 12;
END $$;
