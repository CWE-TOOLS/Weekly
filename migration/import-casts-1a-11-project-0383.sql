-- =====================================================================
-- Import legacy tracking sheet into project 0383.
-- Source: 7 Fairfield Full Scope - Tracking Sheets.csv
--
-- Imports casts 1A, 1B, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 into casting_components.
-- Mockup sections (MOCKUP, MOCKUP #2 / CAST #1, CAST #2) are skipped.
-- All imported panels get produced = TRUE (legacy log treated as done).
-- Any panel marked Rejected = TRUE is also copied into Cast 12 with
-- produced = FALSE (a remake queue).
--
-- Crate numbers found in the CSV are written to project_crates
-- (ON CONFLICT DO NOTHING so existing crates are preserved) and components
-- are linked via crate_id.
--
-- Existing casting_components for the touched castings are wiped first so
-- this script is safe to re-run.
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
    v_cast_12 uuid;
    v_count int;
BEGIN
    -- ----- Resolve casting ids (fail fast on missing / ambiguous) -----

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

    SELECT count(*) INTO v_count FROM project_castings
        WHERE project_number = '0383' AND casting_number = '12';
    IF v_count = 0 THEN
        RAISE EXCEPTION 'No casting % found for project 0383', '12';
    ELSIF v_count > 1 THEN
        RAISE EXCEPTION 'Multiple casting % rows for project 0383 (% rows). Specify phase_id.', '12', v_count;
    END IF;
    SELECT id INTO v_cast_12 FROM project_castings
        WHERE project_number = '0383' AND casting_number = '12';

    -- ----- Wipe existing components for all destination castings -----
    DELETE FROM casting_components WHERE casting_id IN (v_cast_1a, v_cast_1b, v_cast_2, v_cast_3, v_cast_4, v_cast_5, v_cast_6, v_cast_7, v_cast_8, v_cast_9, v_cast_10, v_cast_11, v_cast_12);

    -- ----- Upsert crates (skip if already exist) -----
    INSERT INTO project_crates (project_number, crate_number, sort_order)
        SELECT '0383', '1', 0
        WHERE NOT EXISTS (SELECT 1 FROM project_crates WHERE project_number = '0383' AND crate_number = '1');
    INSERT INTO project_crates (project_number, crate_number, sort_order)
        SELECT '0383', '2', 1
        WHERE NOT EXISTS (SELECT 1 FROM project_crates WHERE project_number = '0383' AND crate_number = '2');
    INSERT INTO project_crates (project_number, crate_number, sort_order)
        SELECT '0383', '3', 2
        WHERE NOT EXISTS (SELECT 1 FROM project_crates WHERE project_number = '0383' AND crate_number = '3');
    INSERT INTO project_crates (project_number, crate_number, sort_order)
        SELECT '0383', '5', 3
        WHERE NOT EXISTS (SELECT 1 FROM project_crates WHERE project_number = '0383' AND crate_number = '5');

    -- ----- Insert components per cast -----

    -- Cast 1A (49 panels)
    INSERT INTO casting_components
        (casting_id, type, panel_id, color, sealer, sort_order, produced, crate_id)
    VALUES
        (v_cast_1a, '125-C', '125-C.01', 'CUSTOM', 'GHOST SHIELD', 0, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_1a, '125-C', '125-C.02', 'CUSTOM', 'GHOST SHIELD', 1, TRUE, NULL),
        (v_cast_1a, '125-C', '125-C.03', 'CUSTOM', 'GHOST SHIELD', 2, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_1a, '125-C', '125-C.04', 'CUSTOM', 'GHOST SHIELD', 3, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_1a, '125-C', '125-C.05', 'CUSTOM', 'GHOST SHIELD', 4, TRUE, NULL),
        (v_cast_1a, '125-C', '125-C.06', 'CUSTOM', 'GHOST SHIELD', 5, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_1a, '125-C', '125-C.07', 'CUSTOM', 'GHOST SHIELD', 6, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_1a, '125-C', '125-C.08', 'CUSTOM', 'GHOST SHIELD', 7, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_1a, '125-C', '125-C.09', 'CUSTOM', 'GHOST SHIELD', 8, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_1a, '125-C', '125-C.10', 'CUSTOM', 'GHOST SHIELD', 9, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_1a, '125-C', '125-C.11', 'CUSTOM', 'GHOST SHIELD', 10, TRUE, NULL),
        (v_cast_1a, '125-C', '125-C.12', 'CUSTOM', 'GHOST SHIELD', 11, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_1a, '125-C', '125-C.13', 'CUSTOM', 'GHOST SHIELD', 12, TRUE, NULL),
        (v_cast_1a, '125-C', '125-C.14', 'CUSTOM', 'GHOST SHIELD', 13, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_1a, '125-A', '125-A.01', 'CUSTOM', 'GHOST SHIELD', 14, TRUE, NULL),
        (v_cast_1a, '125-A', '125-A.02', 'CUSTOM', 'GHOST SHIELD', 15, TRUE, NULL),
        (v_cast_1a, '125-A', '125-A.03', 'CUSTOM', 'GHOST SHIELD', 16, TRUE, NULL),
        (v_cast_1a, '125-A', '125-A.04', 'CUSTOM', 'GHOST SHIELD', 17, TRUE, NULL),
        (v_cast_1a, '125-A', '125-A.05', 'CUSTOM', 'GHOST SHIELD', 18, TRUE, NULL),
        (v_cast_1a, '125-A', '125-A.06', 'CUSTOM', 'GHOST SHIELD', 19, TRUE, NULL),
        (v_cast_1a, '125-A', '125-A.07', 'CUSTOM', 'GHOST SHIELD', 20, TRUE, NULL),
        (v_cast_1a, '125-A', '125-A.08', 'CUSTOM', 'GHOST SHIELD', 21, TRUE, NULL),
        (v_cast_1a, '125-A', '125-A.09', 'CUSTOM', 'GHOST SHIELD', 22, TRUE, NULL),
        (v_cast_1a, '125-A', '125-A.10', 'CUSTOM', 'GHOST SHIELD', 23, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_1a, '125-A', '125-A.11', 'CUSTOM', 'GHOST SHIELD', 24, TRUE, NULL),
        (v_cast_1a, '125-A', '125-A.12', 'CUSTOM', 'GHOST SHIELD', 25, TRUE, NULL),
        (v_cast_1a, '125-A', '125-A.13', 'CUSTOM', 'GHOST SHIELD', 26, TRUE, NULL),
        (v_cast_1a, '125-B', '125-B.01', 'CUSTOM', 'GHOST SHIELD', 27, TRUE, NULL),
        (v_cast_1a, '125-B', '125-B.02', 'CUSTOM', 'GHOST SHIELD', 28, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_1a, '125-B', '125-B.03', 'CUSTOM', 'GHOST SHIELD', 29, TRUE, NULL),
        (v_cast_1a, '125-B', '125-B.04', 'CUSTOM', 'GHOST SHIELD', 30, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_1a, '125-B', '125-B.05', 'CUSTOM', 'GHOST SHIELD', 31, TRUE, NULL),
        (v_cast_1a, '125-B', '125-B.06', 'CUSTOM', 'GHOST SHIELD', 32, TRUE, NULL),
        (v_cast_1a, '125-B', '125-B.07', 'CUSTOM', 'GHOST SHIELD', 33, TRUE, NULL),
        (v_cast_1a, '125-B', '125-B.08', 'CUSTOM', 'GHOST SHIELD', 34, TRUE, NULL),
        (v_cast_1a, '110-C', '110-C.01', 'CUSTOM', 'GHOST SHIELD', 35, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1a, '110-C', '110-C.02', 'CUSTOM', 'GHOST SHIELD', 36, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_1a, '110-C', '110-C.03', 'CUSTOM', 'GHOST SHIELD', 37, TRUE, NULL),
        (v_cast_1a, '110-C', '110-C.04', 'CUSTOM', 'GHOST SHIELD', 38, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_1a, '110-C', '110-C.05', 'CUSTOM', 'GHOST SHIELD', 39, TRUE, NULL),
        (v_cast_1a, '110-C', '110-C.06', 'CUSTOM', 'GHOST SHIELD', 40, TRUE, NULL),
        (v_cast_1a, '125-D', '125-D.01', 'CUSTOM', 'GHOST SHIELD', 41, TRUE, NULL),
        (v_cast_1a, '125-D', '125-D.02', 'CUSTOM', 'GHOST SHIELD', 42, TRUE, NULL),
        (v_cast_1a, '125-D', '125-D.03', 'CUSTOM', 'GHOST SHIELD', 43, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_1a, '125-D', '125-D.04', 'CUSTOM', 'GHOST SHIELD', 44, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_1a, '125-D', '125-D.05', 'CUSTOM', 'GHOST SHIELD', 45, TRUE, NULL),
        (v_cast_1a, '125-D', '125-D.06', 'CUSTOM', 'GHOST SHIELD', 46, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_1a, '125-D', '125-D.07', 'CUSTOM', 'GHOST SHIELD', 47, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_1a, '125-D', '125-D.08', 'CUSTOM', 'GHOST SHIELD', 48, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1));

    -- Cast 1B (76 panels)
    INSERT INTO casting_components
        (casting_id, type, panel_id, color, sealer, sort_order, produced, crate_id)
    VALUES
        (v_cast_1b, '125-D', '125-D.09', 'CUSTOM', 'GHOST SHIELD', 0, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_1b, '125-D', '125-D.10', 'CUSTOM', 'GHOST SHIELD', 1, TRUE, NULL),
        (v_cast_1b, '125-X', '125-X.01', 'CUSTOM', 'GHOST SHIELD', 2, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_1b, '125-X', '125-X.02', 'CUSTOM', 'GHOST SHIELD', 3, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_1b, '125-X', '125-X.03', 'CUSTOM', 'GHOST SHIELD', 4, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_1b, '125-X', '125-X.04', 'CUSTOM', 'GHOST SHIELD', 5, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_1b, '125-X', '125-X.05', 'CUSTOM', 'GHOST SHIELD', 6, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_1b, '110-B', '110-B.01', 'CUSTOM', 'GHOST SHIELD', 7, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_1b, '110-B', '110-B.02', 'CUSTOM', 'GHOST SHIELD', 8, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_1b, '110-B', '110-B.03', 'CUSTOM', 'GHOST SHIELD', 9, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_1b, '047-C', '047-C.01', 'CUSTOM', 'GHOST SHIELD', 10, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '095-B', '095-B.01', 'CUSTOM', 'GHOST SHIELD', 11, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_1b, '047-C', '047-C.02', 'CUSTOM', 'GHOST SHIELD', 12, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '095-B', '095-B.02', 'CUSTOM', 'GHOST SHIELD', 13, TRUE, NULL),
        (v_cast_1b, '047-C', '047-C.03', 'CUSTOM', 'GHOST SHIELD', 14, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '095-B', '095-B.03', 'CUSTOM', 'GHOST SHIELD', 15, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_1b, '047-D', '047-D.01', 'CUSTOM', 'GHOST SHIELD', 16, TRUE, NULL),
        (v_cast_1b, '047-D', '047-D.02', 'CUSTOM', 'GHOST SHIELD', 17, TRUE, NULL),
        (v_cast_1b, '095-A', '095-A.01', 'CUSTOM', 'GHOST SHIELD', 18, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '047-D', '047-D.03', 'CUSTOM', 'GHOST SHIELD', 19, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '047-D', '047-D.04', 'CUSTOM', 'GHOST SHIELD', 20, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '095-A', '095-A.02', 'CUSTOM', 'GHOST SHIELD', 21, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '028-C', '028-C.01', 'CUSTOM', 'GHOST SHIELD', 22, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '110-A', '110-A.01', 'CUSTOM', 'GHOST SHIELD', 23, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '028-C', '028-C.02', 'CUSTOM', 'GHOST SHIELD', 24, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '110-A', '110-A.02', 'CUSTOM', 'GHOST SHIELD', 25, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '047-B', '047-B.01', 'CUSTOM', 'GHOST SHIELD', 26, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_1b, '095-X', '095-X.01', 'CUSTOM', 'GHOST SHIELD', 27, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_1b, '047-B', '047-B.02', 'CUSTOM', 'GHOST SHIELD', 28, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_1b, '095-X', '095-X.02', 'CUSTOM', 'GHOST SHIELD', 29, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_1b, '067-C', '067-C.01', 'CUSTOM', 'GHOST SHIELD', 30, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '067-C', '067-C.02', 'CUSTOM', 'GHOST SHIELD', 31, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '067-C', '067-C.03', 'CUSTOM', 'GHOST SHIELD', 32, TRUE, NULL),
        (v_cast_1b, '067-C', '067-C.04', 'CUSTOM', 'GHOST SHIELD', 33, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '095-C', '095-C.01', 'CUSTOM', 'GHOST SHIELD', 34, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '095-C', '095-C.02', 'CUSTOM', 'GHOST SHIELD', 35, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '078-C', '078-C.01', 'CUSTOM', 'GHOST SHIELD', 36, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '078-C', '078-C.02', 'CUSTOM', 'GHOST SHIELD', 37, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '047-C', '047-C.04', 'CUSTOM', 'GHOST SHIELD', 38, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '078-A', '078-A.01', 'CUSTOM', 'GHOST SHIELD', 39, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '047-C', '047-C.05', 'CUSTOM', 'GHOST SHIELD', 40, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '078-A', '078-A.02', 'CUSTOM', 'GHOST SHIELD', 41, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '047-A', '047-A.01', 'CUSTOM', 'GHOST SHIELD', 42, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '095-A', '095-A.03', 'CUSTOM', 'GHOST SHIELD', 43, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '067-A', '067-A.01', 'CUSTOM', 'GHOST SHIELD', 44, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '067-A', '067-A.02', 'CUSTOM', 'GHOST SHIELD', 45, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '047-X', '047-X.01', 'CUSTOM', 'GHOST SHIELD', 46, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_1b, '095-D', '095-D.01', 'CUSTOM', 'GHOST SHIELD', 47, TRUE, NULL),
        (v_cast_1b, '095-D', '095-D.02', 'CUSTOM', 'GHOST SHIELD', 48, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '020-A', '020-A.01', 'CUSTOM', 'GHOST SHIELD', 49, TRUE, NULL),
        (v_cast_1b, '110-D', '110-D.01', 'CUSTOM', 'GHOST SHIELD', 50, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '110-D', '110-D.02', 'CUSTOM', 'GHOST SHIELD', 51, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '028-A', '028-A.01', 'CUSTOM', 'GHOST SHIELD', 52, TRUE, NULL),
        (v_cast_1b, '110-A', '110-A.03', 'CUSTOM', 'GHOST SHIELD', 53, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '028-B', '028-B.01', 'CUSTOM', 'GHOST SHIELD', 54, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_1b, '110-A', '110-A.04', 'CUSTOM', 'GHOST SHIELD', 55, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '047-A', '047-A.02', 'CUSTOM', 'GHOST SHIELD', 56, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '047-A', '047-A.03', 'CUSTOM', 'GHOST SHIELD', 57, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '047-A', '047-A.04', 'CUSTOM', 'GHOST SHIELD', 58, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '020-C', '020-C.01', 'CUSTOM', 'GHOST SHIELD', 59, TRUE, NULL),
        (v_cast_1b, '110-X', '110-X.01', 'CUSTOM', 'GHOST SHIELD', 60, TRUE, NULL),
        (v_cast_1b, '067-B', '067-B.01', 'CUSTOM', 'GHOST SHIELD', 61, TRUE, NULL),
        (v_cast_1b, '067-B', '067-B.02', 'CUSTOM', 'GHOST SHIELD', 62, TRUE, NULL),
        (v_cast_1b, '135-A', '135-A.01', 'CUSTOM', 'GHOST SHIELD', 63, TRUE, NULL),
        (v_cast_1b, '020-D', '020-D.01', 'CUSTOM', 'GHOST SHIELD', 64, TRUE, NULL),
        (v_cast_1b, '020-D', '020-D.02', 'CUSTOM', 'GHOST SHIELD', 65, TRUE, NULL),
        (v_cast_1b, '110-D', '110-D.03', 'CUSTOM', 'GHOST SHIELD', 66, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '110-D', '110-D.04', 'CUSTOM', 'GHOST SHIELD', 67, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '067-D', '067-D.01', 'CUSTOM', 'GHOST SHIELD', 68, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '067-D', '067-D.02', 'CUSTOM', 'GHOST SHIELD', 69, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '067-D', '067-D.03', 'CUSTOM', 'GHOST SHIELD', 70, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '067-D', '067-D.04', 'CUSTOM', 'GHOST SHIELD', 71, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '047-C', '047-C.06', 'CUSTOM', 'GHOST SHIELD', 72, TRUE, NULL),
        (v_cast_1b, '078-D', '078-D.01', 'CUSTOM', 'GHOST SHIELD', 73, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_1b, '078-D', '078-D.02', 'CUSTOM', 'GHOST SHIELD', 74, TRUE, NULL),
        (v_cast_1b, '135-C', '135-C.01', 'CUSTOM', 'GHOST SHIELD', 75, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1));

    -- Cast 2 (118 panels)
    INSERT INTO casting_components
        (casting_id, type, panel_id, color, sealer, sort_order, produced, crate_id)
    VALUES
        (v_cast_2, '125-C', '125-C.15', 'CUSTOM', 'GHOST SHIELD', 0, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-C', '125-C.16', 'CUSTOM', 'GHOST SHIELD', 1, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-C', '125-C.17', 'CUSTOM', 'GHOST SHIELD', 2, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-C', '125-C.18', 'CUSTOM', 'GHOST SHIELD', 3, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-C', '125-C.19', 'CUSTOM', 'GHOST SHIELD', 4, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-C', '125-C.20', 'CUSTOM', 'GHOST SHIELD', 5, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-C', '125-C.21', 'CUSTOM', 'GHOST SHIELD', 6, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-C', '125-C.22', 'CUSTOM', 'GHOST SHIELD', 7, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-C', '125-C.23', 'CUSTOM', 'GHOST SHIELD', 8, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-C', '125-C.24', 'CUSTOM', 'GHOST SHIELD', 9, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-C', '125-C.25', 'CUSTOM', 'GHOST SHIELD', 10, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-C', '125-C.26', 'CUSTOM', 'GHOST SHIELD', 11, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-C', '125-C.27', 'CUSTOM', 'GHOST SHIELD', 12, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-C', '125-C.28', 'CUSTOM', 'GHOST SHIELD', 13, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-C', '125-C.29', 'CUSTOM', 'GHOST SHIELD', 14, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-A', '125-A.14', 'CUSTOM', 'GHOST SHIELD', 15, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-A', '125-A.15', 'CUSTOM', 'GHOST SHIELD', 16, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-A', '125-A.16', 'CUSTOM', 'GHOST SHIELD', 17, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-A', '125-A.17', 'CUSTOM', 'GHOST SHIELD', 18, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-A', '125-A.18', 'CUSTOM', 'GHOST SHIELD', 19, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-A', '125-A.19', 'CUSTOM', 'GHOST SHIELD', 20, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-A', '125-A.20', 'CUSTOM', 'GHOST SHIELD', 21, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-A', '125-A.21', 'CUSTOM', 'GHOST SHIELD', 22, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-A', '125-A.22', 'CUSTOM', 'GHOST SHIELD', 23, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-A', '125-A.23', 'CUSTOM', 'GHOST SHIELD', 24, TRUE, NULL),
        (v_cast_2, '125-A', '125-A.24', 'CUSTOM', 'GHOST SHIELD', 25, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-A', '125-A.25', 'CUSTOM', 'GHOST SHIELD', 26, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-A', '125-A.26', 'CUSTOM', 'GHOST SHIELD', 27, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-B', '125-B.09', 'CUSTOM', 'GHOST SHIELD', 28, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_2, '125-B', '125-B.10', 'CUSTOM', 'GHOST SHIELD', 29, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_2, '125-B', '125-B.11', 'CUSTOM', 'GHOST SHIELD', 30, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_2, '125-B', '125-B.12', 'CUSTOM', 'GHOST SHIELD', 31, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_2, '125-B', '125-B.13', 'CUSTOM', 'GHOST SHIELD', 32, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_2, '125-B', '125-B.14', 'CUSTOM', 'GHOST SHIELD', 33, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_2, '125-B', '125-B.15', 'CUSTOM', 'GHOST SHIELD', 34, TRUE, NULL),
        (v_cast_2, '125-B', '125-B.16', 'CUSTOM', 'GHOST SHIELD', 35, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_2, '125-B', '125-B.17', 'CUSTOM', 'GHOST SHIELD', 36, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_2, '125-B', '125-B.18', 'CUSTOM', 'GHOST SHIELD', 37, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_2, '125-B', '125-B.19', 'CUSTOM', 'GHOST SHIELD', 38, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_2, '125-D', '125-D.11', 'CUSTOM', 'GHOST SHIELD', 39, TRUE, NULL),
        (v_cast_2, '125-D', '125-D.12', 'CUSTOM', 'GHOST SHIELD', 40, TRUE, NULL),
        (v_cast_2, '125-D', '125-D.13', 'CUSTOM', 'GHOST SHIELD', 41, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-D', '125-D.14', 'CUSTOM', 'GHOST SHIELD', 42, TRUE, NULL),
        (v_cast_2, '125-D', '125-D.15', 'CUSTOM', 'GHOST SHIELD', 43, TRUE, NULL),
        (v_cast_2, '125-D', '125-D.16', 'CUSTOM', 'GHOST SHIELD', 44, TRUE, NULL),
        (v_cast_2, '125-D', '125-D.17', 'CUSTOM', 'GHOST SHIELD', 45, TRUE, NULL),
        (v_cast_2, '125-D', '125-D.18', 'CUSTOM', 'GHOST SHIELD', 46, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-D', '125-D.19', 'CUSTOM', 'GHOST SHIELD', 47, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-D', '125-D.20', 'CUSTOM', 'GHOST SHIELD', 48, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-D', '125-D.21', 'CUSTOM', 'GHOST SHIELD', 49, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-D', '125-D.22', 'CUSTOM', 'GHOST SHIELD', 50, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '125-D', '125-D.23', 'CUSTOM', 'GHOST SHIELD', 51, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '125-D', '125-D.24', 'CUSTOM', 'GHOST SHIELD', 52, TRUE, NULL),
        (v_cast_2, '110-C', '110-C.07', 'CUSTOM', 'GHOST SHIELD', 53, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '110-C', '110-C.08', 'CUSTOM', 'GHOST SHIELD', 54, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '110-C', '110-C.09', 'CUSTOM', 'GHOST SHIELD', 55, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '110-C', '110-C.10', 'CUSTOM', 'GHOST SHIELD', 56, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '110-C', '110-C.11', 'CUSTOM', 'GHOST SHIELD', 57, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '110-C', '110-C.12', 'CUSTOM', 'GHOST SHIELD', 58, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-X', '125-X.06', 'CUSTOM', 'GHOST SHIELD', 59, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-X', '125-X.07', 'CUSTOM', 'GHOST SHIELD', 60, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-X', '125-X.08', 'CUSTOM', 'GHOST SHIELD', 61, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-X', '125-X.09', 'CUSTOM', 'GHOST SHIELD', 62, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '125-X', '125-X.10', 'CUSTOM', 'GHOST SHIELD', 63, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '110-B', '110-B.04', 'CUSTOM', 'GHOST SHIELD', 64, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_2, '110-B', '110-B.05', 'CUSTOM', 'GHOST SHIELD', 65, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_2, '110-B', '110-B.06', 'CUSTOM', 'GHOST SHIELD', 66, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_2, '047-C', '047-C.07', 'CUSTOM', 'GHOST SHIELD', 67, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '095-B', '095-B.04', 'CUSTOM', 'GHOST SHIELD', 68, TRUE, NULL),
        (v_cast_2, '047-C', '047-C.08', 'CUSTOM', 'GHOST SHIELD', 69, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '095-B', '095-B.05', 'CUSTOM', 'GHOST SHIELD', 70, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_2, '047-D', '047-D.05', 'CUSTOM', 'GHOST SHIELD', 71, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '047-D', '047-D.06', 'CUSTOM', 'GHOST SHIELD', 72, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '095-A', '095-A.04', 'CUSTOM', 'GHOST SHIELD', 73, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '047-D', '047-D.07', 'CUSTOM', 'GHOST SHIELD', 74, TRUE, NULL),
        (v_cast_2, '047-D', '047-D.08', 'CUSTOM', 'GHOST SHIELD', 75, TRUE, NULL),
        (v_cast_2, '095-A', '095-A.05', 'CUSTOM', 'GHOST SHIELD', 76, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '028-C', '028-C.03', 'CUSTOM', 'GHOST SHIELD', 77, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '110-A', '110-A.05', 'CUSTOM', 'GHOST SHIELD', 78, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '028-C', '028-C.04', 'CUSTOM', 'GHOST SHIELD', 79, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '110-A', '110-A.06', 'CUSTOM', 'GHOST SHIELD', 80, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '047-B', '047-B.03', 'CUSTOM', 'GHOST SHIELD', 81, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_2, '095-X', '095-X.03', 'CUSTOM', 'GHOST SHIELD', 82, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '047-B', '047-B.04', 'CUSTOM', 'GHOST SHIELD', 83, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_2, '095-X', '095-X.04', 'CUSTOM', 'GHOST SHIELD', 84, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '067-C', '067-C.05', 'CUSTOM', 'GHOST SHIELD', 85, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '067-C', '067-C.06', 'CUSTOM', 'GHOST SHIELD', 86, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '067-C', '067-C.07', 'CUSTOM', 'GHOST SHIELD', 87, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '067-C', '067-C.08', 'CUSTOM', 'GHOST SHIELD', 88, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '095-C', '095-C.03', 'CUSTOM', 'GHOST SHIELD', 89, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '095-C', '095-C.04', 'CUSTOM', 'GHOST SHIELD', 90, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '078-C', '078-C.03', 'CUSTOM', 'GHOST SHIELD', 91, TRUE, NULL),
        (v_cast_2, '078-C', '078-C.04', 'CUSTOM', 'GHOST SHIELD', 92, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '047-C', '047-C.09', 'CUSTOM', 'GHOST SHIELD', 93, TRUE, NULL),
        (v_cast_2, '078-A', '078-A.03', 'CUSTOM', 'GHOST SHIELD', 94, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '047-A', '047-A.05', 'CUSTOM', 'GHOST SHIELD', 95, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '095-A', '095-A.06', 'CUSTOM', 'GHOST SHIELD', 96, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '067-A', '067-A.03', 'CUSTOM', 'GHOST SHIELD', 97, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '067-A', '067-A.04', 'CUSTOM', 'GHOST SHIELD', 98, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '047-X', '047-X.02', 'CUSTOM', 'GHOST SHIELD', 99, TRUE, NULL),
        (v_cast_2, '095-D', '095-D.03', 'CUSTOM', 'GHOST SHIELD', 100, TRUE, NULL),
        (v_cast_2, '095-D', '095-D.04', 'CUSTOM', 'GHOST SHIELD', 101, TRUE, NULL),
        (v_cast_2, '020-A', '020-A.02', 'CUSTOM', 'GHOST SHIELD', 102, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '110-D', '110-D.05', 'CUSTOM', 'GHOST SHIELD', 103, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '110-D', '110-D.06', 'CUSTOM', 'GHOST SHIELD', 104, TRUE, NULL),
        (v_cast_2, '028-A', '028-A.02', 'CUSTOM', 'GHOST SHIELD', 105, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '110-A', '110-A.07', 'CUSTOM', 'GHOST SHIELD', 106, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '028-B', '028-B.02', 'CUSTOM', 'GHOST SHIELD', 107, TRUE, NULL),
        (v_cast_2, '110-A', '110-A.08', 'CUSTOM', 'GHOST SHIELD', 108, TRUE, NULL),
        (v_cast_2, '047-A', '047-A.06', 'CUSTOM', 'GHOST SHIELD', 109, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '047-A', '047-A.07', 'CUSTOM', 'GHOST SHIELD', 110, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '047-A', '047-A.08', 'CUSTOM', 'GHOST SHIELD', 111, TRUE, NULL),
        (v_cast_2, '020-C', '020-C.02', 'CUSTOM', 'GHOST SHIELD', 112, TRUE, NULL),
        (v_cast_2, '110-X', '110-X.02', 'CUSTOM', 'GHOST SHIELD', 113, TRUE, NULL),
        (v_cast_2, '020-C', '020-C.03', 'CUSTOM', 'GHOST SHIELD', 114, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_2, '110-X', '110-X.03', 'CUSTOM', 'GHOST SHIELD', 115, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_2, '067-B', '067-B.03', 'CUSTOM', 'GHOST SHIELD', 116, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_2, '067-B', '067-B.04', 'CUSTOM', 'GHOST SHIELD', 117, TRUE, NULL);

    -- Cast 3 (129 panels)
    INSERT INTO casting_components
        (casting_id, type, panel_id, color, sealer, sort_order, produced, crate_id)
    VALUES
        (v_cast_3, '125-C', '125-C.30', 'CUSTOM', 'GHOST SHIELD', 0, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_3, '125-C', '125-C.31', 'CUSTOM', 'GHOST SHIELD', 1, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_3, '125-C', '125-C.32', 'CUSTOM', 'GHOST SHIELD', 2, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_3, '125-C', '125-C.33', 'CUSTOM', 'GHOST SHIELD', 3, TRUE, NULL),
        (v_cast_3, '125-C', '125-C.34', 'CUSTOM', 'GHOST SHIELD', 4, TRUE, NULL),
        (v_cast_3, '125-C', '125-C.35', 'CUSTOM', 'GHOST SHIELD', 5, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_3, '125-C', '125-C.36', 'CUSTOM', 'GHOST SHIELD', 6, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '125-C', '125-C.37', 'CUSTOM', 'GHOST SHIELD', 7, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_3, '125-C', '125-C.38', 'CUSTOM', 'GHOST SHIELD', 8, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_3, '125-C', '125-C.39', 'CUSTOM', 'GHOST SHIELD', 9, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '125-C', '125-C.40', 'CUSTOM', 'GHOST SHIELD', 10, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '125-C', '125-C.41', 'CUSTOM', 'GHOST SHIELD', 11, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_3, '125-C', '125-C.42', 'CUSTOM', 'GHOST SHIELD', 12, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_3, '125-C', '125-C.43', 'CUSTOM', 'GHOST SHIELD', 13, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_3, '125-A', '125-A.27', 'CUSTOM', 'GHOST SHIELD', 14, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '125-A', '125-A.28', 'CUSTOM', 'GHOST SHIELD', 15, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '125-A', '125-A.29', 'CUSTOM', 'GHOST SHIELD', 16, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '125-A', '125-A.30', 'CUSTOM', 'GHOST SHIELD', 17, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '125-A', '125-A.31', 'CUSTOM', 'GHOST SHIELD', 18, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '125-A', '125-A.32', 'CUSTOM', 'GHOST SHIELD', 19, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '125-A', '125-A.33', 'CUSTOM', 'GHOST SHIELD', 20, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '125-A', '125-A.34', 'CUSTOM', 'GHOST SHIELD', 21, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '125-A', '125-A.35', 'CUSTOM', 'GHOST SHIELD', 22, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '125-A', '125-A.36', 'CUSTOM', 'GHOST SHIELD', 23, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '125-A', '125-A.37', 'CUSTOM', 'GHOST SHIELD', 24, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '125-A', '125-A.38', 'CUSTOM', 'GHOST SHIELD', 25, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '125-A', '125-A.39', 'CUSTOM', 'GHOST SHIELD', 26, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '125-B', '125-B.20', 'CUSTOM', 'GHOST SHIELD', 27, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '125-B', '125-B.21', 'CUSTOM', 'GHOST SHIELD', 28, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '125-B', '125-B.22', 'CUSTOM', 'GHOST SHIELD', 29, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '125-B', '125-B.23', 'CUSTOM', 'GHOST SHIELD', 30, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '125-B', '125-B.24', 'CUSTOM', 'GHOST SHIELD', 31, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '125-B', '125-B.25', 'CUSTOM', 'GHOST SHIELD', 32, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '125-B', '125-B.26', 'CUSTOM', 'GHOST SHIELD', 33, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '125-B', '125-B.27', 'CUSTOM', 'GHOST SHIELD', 34, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '110-C', '110-C.13', 'CUSTOM', 'GHOST SHIELD', 35, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '110-C', '110-C.14', 'CUSTOM', 'GHOST SHIELD', 36, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '110-C', '110-C.15', 'CUSTOM', 'GHOST SHIELD', 37, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '110-C', '110-C.16', 'CUSTOM', 'GHOST SHIELD', 38, TRUE, NULL),
        (v_cast_3, '110-C', '110-C.17', 'CUSTOM', 'GHOST SHIELD', 39, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '110-C', '110-C.18', 'CUSTOM', 'GHOST SHIELD', 40, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '125-D', '125-D.25', 'CUSTOM', 'GHOST SHIELD', 41, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_3, '125-D', '125-D.26', 'CUSTOM', 'GHOST SHIELD', 42, TRUE, NULL),
        (v_cast_3, '125-D', '125-D.27', 'CUSTOM', 'GHOST SHIELD', 43, TRUE, NULL),
        (v_cast_3, '125-D', '125-D.28', 'CUSTOM', 'GHOST SHIELD', 44, TRUE, NULL),
        (v_cast_3, '125-D', '125-D.29', 'CUSTOM', 'GHOST SHIELD', 45, TRUE, NULL),
        (v_cast_3, '125-D', '125-D.30', 'CUSTOM', 'GHOST SHIELD', 46, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_3, '125-D', '125-D.31', 'CUSTOM', 'GHOST SHIELD', 47, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_3, '125-D', '125-D.32', 'CUSTOM', 'GHOST SHIELD', 48, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_3, '125-D', '125-D.33', 'CUSTOM', 'GHOST SHIELD', 49, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_3, '125-D', '125-D.34', 'CUSTOM', 'GHOST SHIELD', 50, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_3, '125-X', '125-X.11', 'CUSTOM', 'GHOST SHIELD', 51, TRUE, NULL),
        (v_cast_3, '125-X', '125-X.12', 'CUSTOM', 'GHOST SHIELD', 52, TRUE, NULL),
        (v_cast_3, '125-X', '125-X.13', 'CUSTOM', 'GHOST SHIELD', 53, TRUE, NULL),
        (v_cast_3, '125-X', '125-X.14', 'CUSTOM', 'GHOST SHIELD', 54, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_3, '125-X', '125-X.15', 'CUSTOM', 'GHOST SHIELD', 55, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_3, '110-B', '110-B.07', 'CUSTOM', 'GHOST SHIELD', 56, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '110-B', '110-B.08', 'CUSTOM', 'GHOST SHIELD', 57, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '110-B', '110-B.09', 'CUSTOM', 'GHOST SHIELD', 58, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '047-C', '047-C.10', 'CUSTOM', 'GHOST SHIELD', 59, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '095-B', '095-B.06', 'CUSTOM', 'GHOST SHIELD', 60, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '047-C', '047-C.11', 'CUSTOM', 'GHOST SHIELD', 61, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '095-B', '095-B.07', 'CUSTOM', 'GHOST SHIELD', 62, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '047-D', '047-D.09', 'CUSTOM', 'GHOST SHIELD', 63, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '047-D', '047-D.10', 'CUSTOM', 'GHOST SHIELD', 64, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '095-A', '095-A.07', 'CUSTOM', 'GHOST SHIELD', 65, TRUE, NULL),
        (v_cast_3, '047-D', '047-D.11', 'CUSTOM', 'GHOST SHIELD', 66, TRUE, NULL),
        (v_cast_3, '047-D', '047-D.12', 'CUSTOM', 'GHOST SHIELD', 67, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '095-A', '095-A.08', 'CUSTOM', 'GHOST SHIELD', 68, TRUE, NULL),
        (v_cast_3, '028-C', '028-C.05', 'CUSTOM', 'GHOST SHIELD', 69, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '110-A', '110-A.09', 'CUSTOM', 'GHOST SHIELD', 70, TRUE, NULL),
        (v_cast_3, '028-C', '028-C.06', 'CUSTOM', 'GHOST SHIELD', 71, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '110-A', '110-A.10', 'CUSTOM', 'GHOST SHIELD', 72, TRUE, NULL),
        (v_cast_3, '047-B', '047-B.05', 'CUSTOM', 'GHOST SHIELD', 73, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '095-X', '095-X.05', 'CUSTOM', 'GHOST SHIELD', 74, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_3, '047-B', '047-B.06', 'CUSTOM', 'GHOST SHIELD', 75, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '095-X', '095-X.06', 'CUSTOM', 'GHOST SHIELD', 76, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_3, '067-C', '067-C.09', 'CUSTOM', 'GHOST SHIELD', 77, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '067-C', '067-C.10', 'CUSTOM', 'GHOST SHIELD', 78, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '067-C', '067-C.11', 'CUSTOM', 'GHOST SHIELD', 79, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '067-C', '067-C.12', 'CUSTOM', 'GHOST SHIELD', 80, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '095-C', '095-C.05', 'CUSTOM', 'GHOST SHIELD', 81, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '095-C', '095-C.06', 'CUSTOM', 'GHOST SHIELD', 82, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '078-C', '078-C.05', 'CUSTOM', 'GHOST SHIELD', 83, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '047-C', '047-C.12', 'CUSTOM', 'GHOST SHIELD', 84, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '078-A', '078-A.04', 'CUSTOM', 'GHOST SHIELD', 85, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '047-A', '047-A.09', 'CUSTOM', 'GHOST SHIELD', 86, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '095-A', '095-A.09', 'CUSTOM', 'GHOST SHIELD', 87, TRUE, NULL),
        (v_cast_3, '067-A', '067-A.05', 'CUSTOM', 'GHOST SHIELD', 88, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '067-A', '067-A.06', 'CUSTOM', 'GHOST SHIELD', 89, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '047-X', '047-X.03', 'CUSTOM', 'GHOST SHIELD', 90, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_3, '095-D', '095-D.05', 'CUSTOM', 'GHOST SHIELD', 91, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '095-D', '095-D.06', 'CUSTOM', 'GHOST SHIELD', 92, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '020-A', '020-A.03', 'CUSTOM', 'GHOST SHIELD', 93, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '110-D', '110-D.07', 'CUSTOM', 'GHOST SHIELD', 94, TRUE, NULL),
        (v_cast_3, '110-D', '110-D.08', 'CUSTOM', 'GHOST SHIELD', 95, TRUE, NULL),
        (v_cast_3, '028-A', '028-A.03', 'CUSTOM', 'GHOST SHIELD', 96, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '110-A', '110-A.11', 'CUSTOM', 'GHOST SHIELD', 97, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_3, '028-B', '028-B.03', 'CUSTOM', 'GHOST SHIELD', 98, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '110-A', '110-A.12', 'CUSTOM', 'GHOST SHIELD', 99, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_3, '047-A', '047-A.10', 'CUSTOM', 'GHOST SHIELD', 100, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '047-A', '047-A.11', 'CUSTOM', 'GHOST SHIELD', 101, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '047-A', '047-A.12', 'CUSTOM', 'GHOST SHIELD', 102, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '020-C', '020-C.04', 'CUSTOM', 'GHOST SHIELD', 103, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '110-X', '110-X.04', 'CUSTOM', 'GHOST SHIELD', 104, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_3, '067-B', '067-B.05', 'CUSTOM', 'GHOST SHIELD', 105, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '067-B', '067-B.06', 'CUSTOM', 'GHOST SHIELD', 106, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '135-A', '135-A.02', 'CUSTOM', 'GHOST SHIELD', 107, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_3, '020-D', '020-D.03', 'CUSTOM', 'GHOST SHIELD', 108, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '020-D', '020-D.04', 'CUSTOM', 'GHOST SHIELD', 109, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '110-D', '110-D.09', 'CUSTOM', 'GHOST SHIELD', 110, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '110-D', '110-D.10', 'CUSTOM', 'GHOST SHIELD', 111, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '067-D', '067-D.05', 'CUSTOM', 'GHOST SHIELD', 112, TRUE, NULL),
        (v_cast_3, '067-D', '067-D.06', 'CUSTOM', 'GHOST SHIELD', 113, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '067-D', '067-D.07', 'CUSTOM', 'GHOST SHIELD', 114, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '067-D', '067-D.08', 'CUSTOM', 'GHOST SHIELD', 115, TRUE, NULL),
        (v_cast_3, '047-C', '047-C.13', 'CUSTOM', 'GHOST SHIELD', 116, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '078-D', '078-D.03', 'CUSTOM', 'GHOST SHIELD', 117, TRUE, NULL),
        (v_cast_3, '078-D', '078-D.04', 'CUSTOM', 'GHOST SHIELD', 118, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '135-C', '135-C.02', 'CUSTOM', 'GHOST SHIELD', 119, TRUE, NULL),
        (v_cast_3, '028-D', '028-D.01', 'CUSTOM', 'GHOST SHIELD', 120, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '028-D', '028-D.02', 'CUSTOM', 'GHOST SHIELD', 121, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '110-A', '110-A.13', 'CUSTOM', 'GHOST SHIELD', 122, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_3, '020-B', '020-B.01', 'CUSTOM', 'GHOST SHIELD', 123, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '110-D', '110-D.11', 'CUSTOM', 'GHOST SHIELD', 124, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '110-D', '110-D.12', 'CUSTOM', 'GHOST SHIELD', 125, TRUE, NULL),
        (v_cast_3, '020-B', '020-B.02', 'CUSTOM', 'GHOST SHIELD', 126, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_3, '110-D', '110-D.13', 'CUSTOM', 'GHOST SHIELD', 127, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_3, '110-D', '110-D.14', 'CUSTOM', 'GHOST SHIELD', 128, TRUE, NULL);

    -- Cast 4 (129 panels)
    INSERT INTO casting_components
        (casting_id, type, panel_id, color, sealer, sort_order, produced, crate_id)
    VALUES
        (v_cast_4, '125-C', '125-C.44', 'CUSTOM', 'GHOST SHIELD', 0, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-C', '125-C.45', 'CUSTOM', 'GHOST SHIELD', 1, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-C', '125-C.46', 'CUSTOM', 'GHOST SHIELD', 2, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-C', '125-C.47', 'CUSTOM', 'GHOST SHIELD', 3, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-C', '125-C.48', 'CUSTOM', 'GHOST SHIELD', 4, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-C', '125-C.49', 'CUSTOM', 'GHOST SHIELD', 5, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-C', '125-C.50', 'CUSTOM', 'GHOST SHIELD', 6, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-C', '125-C.51', 'CUSTOM', 'GHOST SHIELD', 7, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-C', '125-C.52', 'CUSTOM', 'GHOST SHIELD', 8, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-C', '125-C.53', 'CUSTOM', 'GHOST SHIELD', 9, TRUE, NULL),
        (v_cast_4, '125-C', '125-C.54', 'CUSTOM', 'GHOST SHIELD', 10, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-C', '125-C.55', 'CUSTOM', 'GHOST SHIELD', 11, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-C', '125-C.56', 'CUSTOM', 'GHOST SHIELD', 12, TRUE, NULL),
        (v_cast_4, '125-C', '125-C.57', 'CUSTOM', 'GHOST SHIELD', 13, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-A', '125-A.40', 'CUSTOM', 'GHOST SHIELD', 14, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-A', '125-A.41', 'CUSTOM', 'GHOST SHIELD', 15, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-A', '125-A.42', 'CUSTOM', 'GHOST SHIELD', 16, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-A', '125-A.43', 'CUSTOM', 'GHOST SHIELD', 17, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-A', '125-A.44', 'CUSTOM', 'GHOST SHIELD', 18, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-A', '125-A.45', 'CUSTOM', 'GHOST SHIELD', 19, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-A', '125-A.46', 'CUSTOM', 'GHOST SHIELD', 20, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-A', '125-A.47', 'CUSTOM', 'GHOST SHIELD', 21, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-A', '125-A.48', 'CUSTOM', 'GHOST SHIELD', 22, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-A', '125-A.49', 'CUSTOM', 'GHOST SHIELD', 23, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-A', '125-A.50', 'CUSTOM', 'GHOST SHIELD', 24, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-A', '125-A.51', 'CUSTOM', 'GHOST SHIELD', 25, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-A', '125-A.52', 'CUSTOM', 'GHOST SHIELD', 26, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-B', '125-B.28', 'CUSTOM', 'GHOST SHIELD', 27, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-B', '125-B.29', 'CUSTOM', 'GHOST SHIELD', 28, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-B', '125-B.30', 'CUSTOM', 'GHOST SHIELD', 29, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-B', '125-B.31', 'CUSTOM', 'GHOST SHIELD', 30, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-B', '125-B.32', 'CUSTOM', 'GHOST SHIELD', 31, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-B', '125-B.33', 'CUSTOM', 'GHOST SHIELD', 32, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-B', '125-B.34', 'CUSTOM', 'GHOST SHIELD', 33, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-B', '125-B.35', 'CUSTOM', 'GHOST SHIELD', 34, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '110-C', '110-C.19', 'CUSTOM', 'GHOST SHIELD', 35, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '110-C', '110-C.20', 'CUSTOM', 'GHOST SHIELD', 36, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '110-C', '110-C.21', 'CUSTOM', 'GHOST SHIELD', 37, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '110-C', '110-C.22', 'CUSTOM', 'GHOST SHIELD', 38, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '110-C', '110-C.23', 'CUSTOM', 'GHOST SHIELD', 39, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '110-C', '110-C.24', 'CUSTOM', 'GHOST SHIELD', 40, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '125-D', '125-D.35', 'CUSTOM', 'GHOST SHIELD', 41, TRUE, NULL),
        (v_cast_4, '125-D', '125-D.36', 'CUSTOM', 'GHOST SHIELD', 42, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '125-D', '125-D.37', 'CUSTOM', 'GHOST SHIELD', 43, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '125-D', '125-D.38', 'CUSTOM', 'GHOST SHIELD', 44, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '125-D', '125-D.39', 'CUSTOM', 'GHOST SHIELD', 45, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '125-D', '125-D.40', 'CUSTOM', 'GHOST SHIELD', 46, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '125-D', '125-D.41', 'CUSTOM', 'GHOST SHIELD', 47, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '125-D', '125-D.42', 'CUSTOM', 'GHOST SHIELD', 48, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '125-D', '125-D.43', 'CUSTOM', 'GHOST SHIELD', 49, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '125-D', '125-D.44', 'CUSTOM', 'GHOST SHIELD', 50, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '125-X', '125-X.16', 'CUSTOM', 'GHOST SHIELD', 51, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '125-X', '125-X.17', 'CUSTOM', 'GHOST SHIELD', 52, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '125-X', '125-X.18', 'CUSTOM', 'GHOST SHIELD', 53, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '125-X', '125-X.19', 'CUSTOM', 'GHOST SHIELD', 54, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '125-X', '125-X.20', 'CUSTOM', 'GHOST SHIELD', 55, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '110-B', '110-B.10', 'CUSTOM', 'GHOST SHIELD', 56, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '110-B', '110-B.11', 'CUSTOM', 'GHOST SHIELD', 57, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '110-B', '110-B.12', 'CUSTOM', 'GHOST SHIELD', 58, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '047-C', '047-C.14', 'CUSTOM', 'GHOST SHIELD', 59, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '095-B', '095-B.08', 'CUSTOM', 'GHOST SHIELD', 60, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '047-C', '047-C.15', 'CUSTOM', 'GHOST SHIELD', 61, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '095-B', '095-B.09', 'CUSTOM', 'GHOST SHIELD', 62, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '047-D', '047-D.13', 'CUSTOM', 'GHOST SHIELD', 63, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '047-D', '047-D.14', 'CUSTOM', 'GHOST SHIELD', 64, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '095-A', '095-A.10', 'CUSTOM', 'GHOST SHIELD', 65, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '047-D', '047-D.15', 'CUSTOM', 'GHOST SHIELD', 66, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '047-D', '047-D.16', 'CUSTOM', 'GHOST SHIELD', 67, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '095-A', '095-A.11', 'CUSTOM', 'GHOST SHIELD', 68, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '028-C', '028-C.07', 'CUSTOM', 'GHOST SHIELD', 69, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '110-A', '110-A.14', 'CUSTOM', 'GHOST SHIELD', 70, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '028-C', '028-C.08', 'CUSTOM', 'GHOST SHIELD', 71, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '110-A', '110-A.15', 'CUSTOM', 'GHOST SHIELD', 72, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '047-B', '047-B.07', 'CUSTOM', 'GHOST SHIELD', 73, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '095-X', '095-X.07', 'CUSTOM', 'GHOST SHIELD', 74, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '047-B', '047-B.08', 'CUSTOM', 'GHOST SHIELD', 75, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '095-X', '095-X.08', 'CUSTOM', 'GHOST SHIELD', 76, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '067-C', '067-C.13', 'CUSTOM', 'GHOST SHIELD', 77, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '067-C', '067-C.14', 'CUSTOM', 'GHOST SHIELD', 78, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '067-C', '067-C.15', 'CUSTOM', 'GHOST SHIELD', 79, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '067-C', '067-C.16', 'CUSTOM', 'GHOST SHIELD', 80, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '095-C', '095-C.07', 'CUSTOM', 'GHOST SHIELD', 81, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '095-C', '095-C.08', 'CUSTOM', 'GHOST SHIELD', 82, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '078-C', '078-C.06', 'CUSTOM', 'GHOST SHIELD', 83, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '047-C', '047-C.16', 'CUSTOM', 'GHOST SHIELD', 84, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '078-A', '078-A.05', 'CUSTOM', 'GHOST SHIELD', 85, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '047-A', '047-A.13', 'CUSTOM', 'GHOST SHIELD', 86, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '095-A', '095-A.12', 'CUSTOM', 'GHOST SHIELD', 87, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '067-A', '067-A.07', 'CUSTOM', 'GHOST SHIELD', 88, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '067-A', '067-A.08', 'CUSTOM', 'GHOST SHIELD', 89, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '047-X', '047-X.04', 'CUSTOM', 'GHOST SHIELD', 90, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '095-D', '095-D.07', 'CUSTOM', 'GHOST SHIELD', 91, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '095-D', '095-D.08', 'CUSTOM', 'GHOST SHIELD', 92, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '020-A', '020-A.04', 'CUSTOM', 'GHOST SHIELD', 93, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '110-D', '110-D.15', 'CUSTOM', 'GHOST SHIELD', 94, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '110-D', '110-D.16', 'CUSTOM', 'GHOST SHIELD', 95, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '028-A', '028-A.04', 'CUSTOM', 'GHOST SHIELD', 96, TRUE, NULL),
        (v_cast_4, '110-A', '110-A.16', 'CUSTOM', 'GHOST SHIELD', 97, TRUE, NULL),
        (v_cast_4, '028-B', '028-B.04', 'CUSTOM', 'GHOST SHIELD', 98, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '110-A', '110-A.17', 'CUSTOM', 'GHOST SHIELD', 99, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '047-A', '047-A.14', 'CUSTOM', 'GHOST SHIELD', 100, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '047-A', '047-A.15', 'CUSTOM', 'GHOST SHIELD', 101, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '047-A', '047-A.16', 'CUSTOM', 'GHOST SHIELD', 102, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '020-C', '020-C.05', 'CUSTOM', 'GHOST SHIELD', 103, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '110-X', '110-X.05', 'CUSTOM', 'GHOST SHIELD', 104, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '067-B', '067-B.07', 'CUSTOM', 'GHOST SHIELD', 105, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '067-B', '067-B.08', 'CUSTOM', 'GHOST SHIELD', 106, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '135-A', '135-A.03', 'CUSTOM', 'GHOST SHIELD', 107, TRUE, NULL),
        (v_cast_4, '020-D', '020-D.05', 'CUSTOM', 'GHOST SHIELD', 108, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '020-D', '020-D.06', 'CUSTOM', 'GHOST SHIELD', 109, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '110-D', '110-D.17', 'CUSTOM', 'GHOST SHIELD', 110, TRUE, NULL),
        (v_cast_4, '110-D', '110-D.18', 'CUSTOM', 'GHOST SHIELD', 111, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '067-D', '067-D.09', 'CUSTOM', 'GHOST SHIELD', 112, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '067-D', '067-D.10', 'CUSTOM', 'GHOST SHIELD', 113, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '067-D', '067-D.11', 'CUSTOM', 'GHOST SHIELD', 114, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '067-D', '067-D.12', 'CUSTOM', 'GHOST SHIELD', 115, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '047-C', '047-C.17', 'CUSTOM', 'GHOST SHIELD', 116, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '078-D', '078-D.05', 'CUSTOM', 'GHOST SHIELD', 117, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '078-D', '078-D.06', 'CUSTOM', 'GHOST SHIELD', 118, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '135-C', '135-C.03', 'CUSTOM', 'GHOST SHIELD', 119, TRUE, NULL),
        (v_cast_4, '028-D', '028-D.03', 'CUSTOM', 'GHOST SHIELD', 120, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '028-D', '028-D.04', 'CUSTOM', 'GHOST SHIELD', 121, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '110-A', '110-A.18', 'CUSTOM', 'GHOST SHIELD', 122, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_4, '020-B', '020-B.03', 'CUSTOM', 'GHOST SHIELD', 123, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '110-D', '110-D.19', 'CUSTOM', 'GHOST SHIELD', 124, TRUE, NULL),
        (v_cast_4, '110-D', '110-D.20', 'CUSTOM', 'GHOST SHIELD', 125, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '020-B', '020-B.04', 'CUSTOM', 'GHOST SHIELD', 126, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_4, '110-D', '110-D.21', 'CUSTOM', 'GHOST SHIELD', 127, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_4, '110-D', '110-D.22', 'CUSTOM', 'GHOST SHIELD', 128, TRUE, NULL);

    -- Cast 5 (125 panels)
    INSERT INTO casting_components
        (casting_id, type, panel_id, color, sealer, sort_order, produced, crate_id)
    VALUES
        (v_cast_5, '125-C', '125-C.58', 'CUSTOM', 'GHOST SHIELD', 0, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-C', '125-C.59', 'CUSTOM', 'GHOST SHIELD', 1, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-C', '125-C.60', 'CUSTOM', 'GHOST SHIELD', 2, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-C', '125-C.61', 'CUSTOM', 'GHOST SHIELD', 3, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-C', '125-C.62', 'CUSTOM', 'GHOST SHIELD', 4, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-C', '125-C.63', 'CUSTOM', 'GHOST SHIELD', 5, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-C', '125-C.64', 'CUSTOM', 'GHOST SHIELD', 6, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-C', '125-C.65', 'CUSTOM', 'GHOST SHIELD', 7, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-C', '125-C.66', 'CUSTOM', 'GHOST SHIELD', 8, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-C', '125-C.67', 'CUSTOM', 'GHOST SHIELD', 9, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-C', '125-C.68', 'CUSTOM', 'GHOST SHIELD', 10, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-C', '125-C.69', 'CUSTOM', 'GHOST SHIELD', 11, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-C', '125-C.70', 'CUSTOM', 'GHOST SHIELD', 12, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-C', '125-C.71', 'CUSTOM', 'GHOST SHIELD', 13, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-A', '125-A.53', 'CUSTOM', 'GHOST SHIELD', 14, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-A', '125-A.54', 'CUSTOM', 'GHOST SHIELD', 15, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-A', '125-A.55', 'CUSTOM', 'GHOST SHIELD', 16, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-A', '125-A.56', 'CUSTOM', 'GHOST SHIELD', 17, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-A', '125-A.57', 'CUSTOM', 'GHOST SHIELD', 18, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-A', '125-A.58', 'CUSTOM', 'GHOST SHIELD', 19, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-A', '125-A.59', 'CUSTOM', 'GHOST SHIELD', 20, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-A', '125-A.60', 'CUSTOM', 'GHOST SHIELD', 21, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-A', '125-A.61', 'CUSTOM', 'GHOST SHIELD', 22, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-A', '125-A.62', 'CUSTOM', 'GHOST SHIELD', 23, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-A', '125-A.63', 'CUSTOM', 'GHOST SHIELD', 24, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-A', '125-A.64', 'CUSTOM', 'GHOST SHIELD', 25, TRUE, NULL),
        (v_cast_5, '125-A', '125-A.65', 'CUSTOM', 'GHOST SHIELD', 26, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-B', '125-B.36', 'CUSTOM', 'GHOST SHIELD', 27, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-B', '125-B.37', 'CUSTOM', 'GHOST SHIELD', 28, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-B', '125-B.38', 'CUSTOM', 'GHOST SHIELD', 29, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-B', '125-B.39', 'CUSTOM', 'GHOST SHIELD', 30, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-B', '125-B.40', 'CUSTOM', 'GHOST SHIELD', 31, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-B', '125-B.41', 'CUSTOM', 'GHOST SHIELD', 32, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-B', '125-B.42', 'CUSTOM', 'GHOST SHIELD', 33, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '110-C', '110-C.25', 'CUSTOM', 'GHOST SHIELD', 34, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '110-C', '110-C.26', 'CUSTOM', 'GHOST SHIELD', 35, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '110-C', '110-C.27', 'CUSTOM', 'GHOST SHIELD', 36, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '110-C', '110-C.28', 'CUSTOM', 'GHOST SHIELD', 37, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '110-C', '110-C.29', 'CUSTOM', 'GHOST SHIELD', 38, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-D', '125-D.45', 'CUSTOM', 'GHOST SHIELD', 39, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-D', '125-D.46', 'CUSTOM', 'GHOST SHIELD', 40, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-D', '125-D.47', 'CUSTOM', 'GHOST SHIELD', 41, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-D', '125-D.48', 'CUSTOM', 'GHOST SHIELD', 42, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-D', '125-D.49', 'CUSTOM', 'GHOST SHIELD', 43, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-D', '125-D.50', 'CUSTOM', 'GHOST SHIELD', 44, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-D', '125-D.51', 'CUSTOM', 'GHOST SHIELD', 45, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-D', '125-D.52', 'CUSTOM', 'GHOST SHIELD', 46, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-X', '125-X.21', 'CUSTOM', 'GHOST SHIELD', 47, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-X', '125-X.22', 'CUSTOM', 'GHOST SHIELD', 48, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-X', '125-X.23', 'CUSTOM', 'GHOST SHIELD', 49, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '125-X', '125-X.24', 'CUSTOM', 'GHOST SHIELD', 50, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '110-B', '110-B.13', 'CUSTOM', 'GHOST SHIELD', 51, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '110-B', '110-B.14', 'CUSTOM', 'GHOST SHIELD', 52, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '110-B', '110-B.15', 'CUSTOM', 'GHOST SHIELD', 53, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '047-C', '047-C.18', 'CUSTOM', 'GHOST SHIELD', 54, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '095-B', '095-B.10', 'CUSTOM', 'GHOST SHIELD', 55, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '047-C', '047-C.19', 'CUSTOM', 'GHOST SHIELD', 56, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '095-B', '095-B.11', 'CUSTOM', 'GHOST SHIELD', 57, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '047-D', '047-D.17', 'CUSTOM', 'GHOST SHIELD', 58, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '047-D', '047-D.18', 'CUSTOM', 'GHOST SHIELD', 59, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '095-A', '095-A.13', 'CUSTOM', 'GHOST SHIELD', 60, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '047-D', '047-D.19', 'CUSTOM', 'GHOST SHIELD', 61, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '047-D', '047-D.20', 'CUSTOM', 'GHOST SHIELD', 62, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '095-A', '095-A.14', 'CUSTOM', 'GHOST SHIELD', 63, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '028-C', '028-C.09', 'CUSTOM', 'GHOST SHIELD', 64, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '110-A', '110-A.19', 'CUSTOM', 'GHOST SHIELD', 65, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '028-C', '028-C.10', 'CUSTOM', 'GHOST SHIELD', 66, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '110-A', '110-A.20', 'CUSTOM', 'GHOST SHIELD', 67, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '047-B', '047-B.09', 'CUSTOM', 'GHOST SHIELD', 68, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '095-X', '095-X.09', 'CUSTOM', 'GHOST SHIELD', 69, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '067-C', '067-C.17', 'CUSTOM', 'GHOST SHIELD', 70, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '067-C', '067-C.18', 'CUSTOM', 'GHOST SHIELD', 71, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '095-C', '095-C.09', 'CUSTOM', 'GHOST SHIELD', 72, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '078-C', '078-C.07', 'CUSTOM', 'GHOST SHIELD', 73, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '047-C', '047-C.20', 'CUSTOM', 'GHOST SHIELD', 74, TRUE, NULL),
        (v_cast_5, '078-A', '078-A.06', 'CUSTOM', 'GHOST SHIELD', 75, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '047-A', '047-A.17', 'CUSTOM', 'GHOST SHIELD', 76, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '095-A', '095-A.15', 'CUSTOM', 'GHOST SHIELD', 77, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '067-A', '067-A.09', 'CUSTOM', 'GHOST SHIELD', 78, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '067-A', '067-A.10', 'CUSTOM', 'GHOST SHIELD', 79, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '047-X', '047-X.05', 'CUSTOM', 'GHOST SHIELD', 80, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '095-D', '095-D.09', 'CUSTOM', 'GHOST SHIELD', 81, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '095-D', '095-D.10', 'CUSTOM', 'GHOST SHIELD', 82, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '020-A', '020-A.05', 'CUSTOM', 'GHOST SHIELD', 83, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '110-D', '110-D.23', 'CUSTOM', 'GHOST SHIELD', 84, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '110-D', '110-D.24', 'CUSTOM', 'GHOST SHIELD', 85, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '028-A', '028-A.05', 'CUSTOM', 'GHOST SHIELD', 86, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '110-A', '110-A.21', 'CUSTOM', 'GHOST SHIELD', 87, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '028-B', '028-B.05', 'CUSTOM', 'GHOST SHIELD', 88, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '110-A', '110-A.22', 'CUSTOM', 'GHOST SHIELD', 89, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '047-A', '047-A.18', 'CUSTOM', 'GHOST SHIELD', 90, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '047-A', '047-A.19', 'CUSTOM', 'GHOST SHIELD', 91, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '047-A', '047-A.20', 'CUSTOM', 'GHOST SHIELD', 92, TRUE, NULL),
        (v_cast_5, '020-C', '020-C.06', 'CUSTOM', 'GHOST SHIELD', 93, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '110-X', '110-X.06', 'CUSTOM', 'GHOST SHIELD', 94, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '067-B', '067-B.09', 'CUSTOM', 'GHOST SHIELD', 95, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '067-B', '067-B.10', 'CUSTOM', 'GHOST SHIELD', 96, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '135-A', '135-A.04', 'CUSTOM', 'GHOST SHIELD', 97, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '020-D', '020-D.07', 'CUSTOM', 'GHOST SHIELD', 98, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '020-D', '020-D.08', 'CUSTOM', 'GHOST SHIELD', 99, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '110-D', '110-D.25', 'CUSTOM', 'GHOST SHIELD', 100, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '110-D', '110-D.26', 'CUSTOM', 'GHOST SHIELD', 101, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '067-D', '067-D.13', 'CUSTOM', 'GHOST SHIELD', 102, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '067-D', '067-D.14', 'CUSTOM', 'GHOST SHIELD', 103, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '067-D', '067-D.15', 'CUSTOM', 'GHOST SHIELD', 104, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '067-D', '067-D.16', 'CUSTOM', 'GHOST SHIELD', 105, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '047-C', '047-C.21', 'CUSTOM', 'GHOST SHIELD', 106, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '078-D', '078-D.07', 'CUSTOM', 'GHOST SHIELD', 107, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '078-D', '078-D.08', 'CUSTOM', 'GHOST SHIELD', 108, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '135-C', '135-C.04', 'CUSTOM', 'GHOST SHIELD', 109, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '047-C', '047-C.22', 'CUSTOM', 'GHOST SHIELD', 110, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '095-C', '095-C.10', 'CUSTOM', 'GHOST SHIELD', 111, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '036-C', '036-C.01', 'CUSTOM', 'GHOST SHIELD', 112, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '095-C', '095-C.11', 'CUSTOM', 'GHOST SHIELD', 113, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '036-C', '036-C.02', 'CUSTOM', 'GHOST SHIELD', 114, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '095-C', '095-C.12', 'CUSTOM', 'GHOST SHIELD', 115, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '036-C', '036-C.03', 'CUSTOM', 'GHOST SHIELD', 116, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '095-C', '095-C.13', 'CUSTOM', 'GHOST SHIELD', 117, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '036-C', '036-C.04', 'CUSTOM', 'GHOST SHIELD', 118, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '095-C', '095-C.14', 'CUSTOM', 'GHOST SHIELD', 119, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '135-B', '135-B.01', 'CUSTOM', 'GHOST SHIELD', 120, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '135-B', '135-B.02', 'CUSTOM', 'GHOST SHIELD', 121, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1)),
        (v_cast_5, '135-B', '135-B.03', 'CUSTOM', 'GHOST SHIELD', 122, TRUE, NULL),
        (v_cast_5, '135-B', '135-B.04', 'CUSTOM', 'GHOST SHIELD', 123, TRUE, NULL),
        (v_cast_5, '078-B', '078-B.01', 'CUSTOM', 'GHOST SHIELD', 124, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '5' LIMIT 1));

    -- Cast 6 (123 panels)
    INSERT INTO casting_components
        (casting_id, type, panel_id, color, sealer, sort_order, produced, crate_id)
    VALUES
        (v_cast_6, '125-C', '125-C.72', 'CUSTOM', 'GHOST SHIELD', 0, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-C', '125-C.73', 'CUSTOM', 'GHOST SHIELD', 1, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-C', '125-C.74', 'CUSTOM', 'GHOST SHIELD', 2, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-C', '125-C.75', 'CUSTOM', 'GHOST SHIELD', 3, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-C', '125-C.76', 'CUSTOM', 'GHOST SHIELD', 4, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-C', '125-C.77', 'CUSTOM', 'GHOST SHIELD', 5, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-C', '125-C.78', 'CUSTOM', 'GHOST SHIELD', 6, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-C', '125-C.79', 'CUSTOM', 'GHOST SHIELD', 7, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-C', '125-C.80', 'CUSTOM', 'GHOST SHIELD', 8, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-C', '125-C.81', 'CUSTOM', 'GHOST SHIELD', 9, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-C', '125-C.82', 'CUSTOM', 'GHOST SHIELD', 10, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-C', '125-C.83', 'CUSTOM', 'GHOST SHIELD', 11, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-C', '125-C.84', 'CUSTOM', 'GHOST SHIELD', 12, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-C', '125-C.85', 'CUSTOM', 'GHOST SHIELD', 13, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-A', '125-A.66', 'CUSTOM', 'GHOST SHIELD', 14, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-A', '125-A.67', 'CUSTOM', 'GHOST SHIELD', 15, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-A', '125-A.68', 'CUSTOM', 'GHOST SHIELD', 16, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-A', '125-A.69', 'CUSTOM', 'GHOST SHIELD', 17, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-A', '125-A.70', 'CUSTOM', 'GHOST SHIELD', 18, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-A', '125-A.71', 'CUSTOM', 'GHOST SHIELD', 19, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-A', '125-A.72', 'CUSTOM', 'GHOST SHIELD', 20, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-A', '125-A.73', 'CUSTOM', 'GHOST SHIELD', 21, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-A', '125-A.74', 'CUSTOM', 'GHOST SHIELD', 22, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-A', '125-A.75', 'CUSTOM', 'GHOST SHIELD', 23, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-A', '125-A.76', 'CUSTOM', 'GHOST SHIELD', 24, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-A', '125-A.77', 'CUSTOM', 'GHOST SHIELD', 25, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-A', '125-A.78', 'CUSTOM', 'GHOST SHIELD', 26, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-B', '125-B.43', 'CUSTOM', 'GHOST SHIELD', 27, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-B', '125-B.44', 'CUSTOM', 'GHOST SHIELD', 28, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-B', '125-B.45', 'CUSTOM', 'GHOST SHIELD', 29, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-B', '125-B.46', 'CUSTOM', 'GHOST SHIELD', 30, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-B', '125-B.47', 'CUSTOM', 'GHOST SHIELD', 31, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-B', '125-B.48', 'CUSTOM', 'GHOST SHIELD', 32, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-B', '125-B.49', 'CUSTOM', 'GHOST SHIELD', 33, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '110-C', '110-C.30', 'CUSTOM', 'GHOST SHIELD', 34, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '110-C', '110-C.31', 'CUSTOM', 'GHOST SHIELD', 35, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '110-C', '110-C.32', 'CUSTOM', 'GHOST SHIELD', 36, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '110-C', '110-C.33', 'CUSTOM', 'GHOST SHIELD', 37, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '110-C', '110-C.34', 'CUSTOM', 'GHOST SHIELD', 38, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '125-D', '125-D.53', 'CUSTOM', 'GHOST SHIELD', 39, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '125-D', '125-D.54', 'CUSTOM', 'GHOST SHIELD', 40, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '125-D', '125-D.55', 'CUSTOM', 'GHOST SHIELD', 41, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '125-D', '125-D.56', 'CUSTOM', 'GHOST SHIELD', 42, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '125-D', '125-D.57', 'CUSTOM', 'GHOST SHIELD', 43, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '125-D', '125-D.58', 'CUSTOM', 'GHOST SHIELD', 44, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '125-D', '125-D.59', 'CUSTOM', 'GHOST SHIELD', 45, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '125-D', '125-D.60', 'CUSTOM', 'GHOST SHIELD', 46, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '125-X', '125-X.25', 'CUSTOM', 'GHOST SHIELD', 47, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '125-X', '125-X.26', 'CUSTOM', 'GHOST SHIELD', 48, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '125-X', '125-X.27', 'CUSTOM', 'GHOST SHIELD', 49, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '125-X', '125-X.28', 'CUSTOM', 'GHOST SHIELD', 50, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '110-B', '110-B.16', 'CUSTOM', 'GHOST SHIELD', 51, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '110-B', '110-B.17', 'CUSTOM', 'GHOST SHIELD', 52, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '110-B', '110-B.18', 'CUSTOM', 'GHOST SHIELD', 53, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '047-C', '047-C.23', 'CUSTOM', 'GHOST SHIELD', 54, TRUE, NULL),
        (v_cast_6, '095-B', '095-B.12', 'CUSTOM', 'GHOST SHIELD', 55, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '047-C', '047-C.24', 'CUSTOM', 'GHOST SHIELD', 56, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '095-B', '095-B.13', 'CUSTOM', 'GHOST SHIELD', 57, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '047-D', '047-D.21', 'CUSTOM', 'GHOST SHIELD', 58, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_6, '047-D', '047-D.22', 'CUSTOM', 'GHOST SHIELD', 59, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_6, '095-A', '095-A.16', 'CUSTOM', 'GHOST SHIELD', 60, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '047-D', '047-D.23', 'CUSTOM', 'GHOST SHIELD', 61, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_6, '047-D', '047-D.24', 'CUSTOM', 'GHOST SHIELD', 62, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_6, '095-A', '095-A.17', 'CUSTOM', 'GHOST SHIELD', 63, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '028-C', '028-C.11', 'CUSTOM', 'GHOST SHIELD', 64, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '110-A', '110-A.23', 'CUSTOM', 'GHOST SHIELD', 65, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '047-B', '047-B.10', 'CUSTOM', 'GHOST SHIELD', 66, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '095-X', '095-X.10', 'CUSTOM', 'GHOST SHIELD', 67, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '067-C', '067-C.19', 'CUSTOM', 'GHOST SHIELD', 68, TRUE, NULL),
        (v_cast_6, '067-C', '067-C.20', 'CUSTOM', 'GHOST SHIELD', 69, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '095-C', '095-C.15', 'CUSTOM', 'GHOST SHIELD', 70, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '078-C', '078-C.08', 'CUSTOM', 'GHOST SHIELD', 71, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '047-C', '047-C.25', 'CUSTOM', 'GHOST SHIELD', 72, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '078-A', '078-A.07', 'CUSTOM', 'GHOST SHIELD', 73, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '047-A', '047-A.21', 'CUSTOM', 'GHOST SHIELD', 74, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '095-A', '095-A.18', 'CUSTOM', 'GHOST SHIELD', 75, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '067-A', '067-A.11', 'CUSTOM', 'GHOST SHIELD', 76, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '067-A', '067-A.12', 'CUSTOM', 'GHOST SHIELD', 77, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '047-X', '047-X.06', 'CUSTOM', 'GHOST SHIELD', 78, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '095-D', '095-D.11', 'CUSTOM', 'GHOST SHIELD', 79, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_6, '095-D', '095-D.12', 'CUSTOM', 'GHOST SHIELD', 80, TRUE, NULL),
        (v_cast_6, '020-A', '020-A.06', 'CUSTOM', 'GHOST SHIELD', 81, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '110-D', '110-D.27', 'CUSTOM', 'GHOST SHIELD', 82, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_6, '110-D', '110-D.28', 'CUSTOM', 'GHOST SHIELD', 83, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_6, '028-A', '028-A.06', 'CUSTOM', 'GHOST SHIELD', 84, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '110-A', '110-A.24', 'CUSTOM', 'GHOST SHIELD', 85, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '028-B', '028-B.06', 'CUSTOM', 'GHOST SHIELD', 86, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '110-A', '110-A.25', 'CUSTOM', 'GHOST SHIELD', 87, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '047-A', '047-A.22', 'CUSTOM', 'GHOST SHIELD', 88, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '047-A', '047-A.23', 'CUSTOM', 'GHOST SHIELD', 89, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '047-A', '047-A.24', 'CUSTOM', 'GHOST SHIELD', 90, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '020-C', '020-C.07', 'CUSTOM', 'GHOST SHIELD', 91, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '110-X', '110-X.07', 'CUSTOM', 'GHOST SHIELD', 92, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '067-B', '067-B.11', 'CUSTOM', 'GHOST SHIELD', 93, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '067-B', '067-B.12', 'CUSTOM', 'GHOST SHIELD', 94, TRUE, NULL),
        (v_cast_6, '135-A', '135-A.05', 'CUSTOM', 'GHOST SHIELD', 95, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '078-B', '078-B.02', 'CUSTOM', 'GHOST SHIELD', 96, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '078-B', '078-B.03', 'CUSTOM', 'GHOST SHIELD', 97, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '078-B', '078-B.04', 'CUSTOM', 'GHOST SHIELD', 98, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '135-D', '135-D.01', 'CUSTOM', 'GHOST SHIELD', 99, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '135-D', '135-D.02', 'CUSTOM', 'GHOST SHIELD', 100, TRUE, NULL),
        (v_cast_6, '135-D', '135-D.03', 'CUSTOM', 'GHOST SHIELD', 101, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '135-D', '135-D.04', 'CUSTOM', 'GHOST SHIELD', 102, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '135-D', '135-D.05', 'CUSTOM', 'GHOST SHIELD', 103, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '135-D', '135-D.06', 'CUSTOM', 'GHOST SHIELD', 104, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '036-D', '036-D.01', 'CUSTOM', 'GHOST SHIELD', 105, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_6, '036-D', '036-D.02', 'CUSTOM', 'GHOST SHIELD', 106, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_6, '095-C', '095-C.16', 'CUSTOM', 'GHOST SHIELD', 107, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '036-D', '036-D.03', 'CUSTOM', 'GHOST SHIELD', 108, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_6, '036-D', '036-D.04', 'CUSTOM', 'GHOST SHIELD', 109, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_6, '095-C', '095-C.17', 'CUSTOM', 'GHOST SHIELD', 110, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '036-D', '036-D.05', 'CUSTOM', 'GHOST SHIELD', 111, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_6, '036-D', '036-D.06', 'CUSTOM', 'GHOST SHIELD', 112, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_6, '095-C', '095-C.32', 'CUSTOM', 'GHOST SHIELD', 113, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_6, '135-X', '135-X.02', 'CUSTOM', 'GHOST SHIELD', 114, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '135-X', '135-X.03', 'CUSTOM', 'GHOST SHIELD', 115, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '135-X', '135-X.04', 'CUSTOM', 'GHOST SHIELD', 116, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '036-C', '036-C.05', 'CUSTOM', 'GHOST SHIELD', 117, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '078-X', '078-X.08', 'CUSTOM', 'GHOST SHIELD', 118, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_6, '036-C', '036-C.06', 'CUSTOM', 'GHOST SHIELD', 119, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_6, '078-X', '078-X.09', 'CUSTOM', 'GHOST SHIELD', 120, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_6, '036-C', '036-C.07', 'CUSTOM', 'GHOST SHIELD', 121, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '3' LIMIT 1)),
        (v_cast_6, '078-X', '078-X.10', 'CUSTOM', 'GHOST SHIELD', 122, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1));

    -- Cast 7 (137 panels)
    INSERT INTO casting_components
        (casting_id, type, panel_id, color, sealer, sort_order, produced, crate_id)
    VALUES
        (v_cast_7, '125-C', '125-C.86', 'CUSTOM', 'GHOST SHIELD', 0, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-C', '125-C.87', 'CUSTOM', 'GHOST SHIELD', 1, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-C', '125-C.88', 'CUSTOM', 'GHOST SHIELD', 2, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-C', '125-C.89', 'CUSTOM', 'GHOST SHIELD', 3, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-C', '125-C.90', 'CUSTOM', 'GHOST SHIELD', 4, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-C', '125-C.91', 'CUSTOM', 'GHOST SHIELD', 5, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-C', '125-C.92', 'CUSTOM', 'GHOST SHIELD', 6, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-C', '125-C.93', 'CUSTOM', 'GHOST SHIELD', 7, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-C', '125-C.94', 'CUSTOM', 'GHOST SHIELD', 8, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-C', '125-C.95', 'CUSTOM', 'GHOST SHIELD', 9, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-C', '125-C.96', 'CUSTOM', 'GHOST SHIELD', 10, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-C', '125-C.97', 'CUSTOM', 'GHOST SHIELD', 11, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-C', '125-C.98', 'CUSTOM', 'GHOST SHIELD', 12, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-A', '125-A.79', 'CUSTOM', 'GHOST SHIELD', 13, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-A', '125-A.80', 'CUSTOM', 'GHOST SHIELD', 14, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-A', '125-A.81', 'CUSTOM', 'GHOST SHIELD', 15, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-A', '125-A.82', 'CUSTOM', 'GHOST SHIELD', 16, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-A', '125-A.83', 'CUSTOM', 'GHOST SHIELD', 17, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-A', '125-A.84', 'CUSTOM', 'GHOST SHIELD', 18, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-A', '125-A.85', 'CUSTOM', 'GHOST SHIELD', 19, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-A', '125-A.86', 'CUSTOM', 'GHOST SHIELD', 20, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-A', '125-A.87', 'CUSTOM', 'GHOST SHIELD', 21, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-A', '125-A.88', 'CUSTOM', 'GHOST SHIELD', 22, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-A', '125-A.89', 'CUSTOM', 'GHOST SHIELD', 23, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-A', '125-A.90', 'CUSTOM', 'GHOST SHIELD', 24, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-B', '125-B.50', 'CUSTOM', 'GHOST SHIELD', 25, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-B', '125-B.51', 'CUSTOM', 'GHOST SHIELD', 26, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-B', '125-B.52', 'CUSTOM', 'GHOST SHIELD', 27, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-B', '125-B.53', 'CUSTOM', 'GHOST SHIELD', 28, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-B', '125-B.54', 'CUSTOM', 'GHOST SHIELD', 29, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-B', '125-B.55', 'CUSTOM', 'GHOST SHIELD', 30, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-B', '125-B.56', 'CUSTOM', 'GHOST SHIELD', 31, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '110-C', '110-C.35', 'CUSTOM', 'GHOST SHIELD', 32, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '110-C', '110-C.36', 'CUSTOM', 'GHOST SHIELD', 33, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '110-C', '110-C.37', 'CUSTOM', 'GHOST SHIELD', 34, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '110-C', '110-C.38', 'CUSTOM', 'GHOST SHIELD', 35, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '110-C', '110-C.39', 'CUSTOM', 'GHOST SHIELD', 36, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-D', '125-D.61', 'CUSTOM', 'GHOST SHIELD', 37, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-D', '125-D.62', 'CUSTOM', 'GHOST SHIELD', 38, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-D', '125-D.63', 'CUSTOM', 'GHOST SHIELD', 39, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-D', '125-D.64', 'CUSTOM', 'GHOST SHIELD', 40, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-D', '125-D.65', 'CUSTOM', 'GHOST SHIELD', 41, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-D', '125-D.66', 'CUSTOM', 'GHOST SHIELD', 42, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-D', '125-D.67', 'CUSTOM', 'GHOST SHIELD', 43, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-D', '125-D.68', 'CUSTOM', 'GHOST SHIELD', 44, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-X', '125-X.29', 'CUSTOM', 'GHOST SHIELD', 45, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-X', '125-X.30', 'CUSTOM', 'GHOST SHIELD', 46, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-X', '125-X.31', 'CUSTOM', 'GHOST SHIELD', 47, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '125-X', '125-X.32', 'CUSTOM', 'GHOST SHIELD', 48, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '110-B', '110-B.19', 'CUSTOM', 'GHOST SHIELD', 49, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '110-B', '110-B.20', 'CUSTOM', 'GHOST SHIELD', 50, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '047-C', '047-C.26', 'CUSTOM', 'GHOST SHIELD', 51, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '095-B', '095-B.14', 'CUSTOM', 'GHOST SHIELD', 52, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '047-C', '047-C.27', 'CUSTOM', 'GHOST SHIELD', 53, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '095-B', '095-B.15', 'CUSTOM', 'GHOST SHIELD', 54, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '047-D', '047-D.25', 'CUSTOM', 'GHOST SHIELD', 55, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '047-D', '047-D.26', 'CUSTOM', 'GHOST SHIELD', 56, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '095-A', '095-A.19', 'CUSTOM', 'GHOST SHIELD', 57, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '047-D', '047-D.27', 'CUSTOM', 'GHOST SHIELD', 58, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '047-D', '047-D.28', 'CUSTOM', 'GHOST SHIELD', 59, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '095-A', '095-A.20', 'CUSTOM', 'GHOST SHIELD', 60, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '028-C', '028-C.12', 'CUSTOM', 'GHOST SHIELD', 61, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '110-A', '110-A.26', 'CUSTOM', 'GHOST SHIELD', 62, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '047-B', '047-B.11', 'CUSTOM', 'GHOST SHIELD', 63, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '095-X', '095-X.11', 'CUSTOM', 'GHOST SHIELD', 64, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '067-C', '067-C.21', 'CUSTOM', 'GHOST SHIELD', 65, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '067-C', '067-C.22', 'CUSTOM', 'GHOST SHIELD', 66, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '095-C', '095-C.18', 'CUSTOM', 'GHOST SHIELD', 67, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '078-C', '078-C.09', 'CUSTOM', 'GHOST SHIELD', 68, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '047-C', '047-C.28', 'CUSTOM', 'GHOST SHIELD', 69, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '078-A', '078-A.08', 'CUSTOM', 'GHOST SHIELD', 70, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '047-A', '047-A.25', 'CUSTOM', 'GHOST SHIELD', 71, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '095-A', '095-A.21', 'CUSTOM', 'GHOST SHIELD', 72, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '067-A', '067-A.13', 'CUSTOM', 'GHOST SHIELD', 73, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '067-A', '067-A.14', 'CUSTOM', 'GHOST SHIELD', 74, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '047-X', '047-X.07', 'CUSTOM', 'GHOST SHIELD', 75, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '095-D', '095-D.13', 'CUSTOM', 'GHOST SHIELD', 76, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '095-D', '095-D.14', 'CUSTOM', 'GHOST SHIELD', 77, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '020-A', '020-A.07', 'CUSTOM', 'GHOST SHIELD', 78, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '110-D', '110-D.29', 'CUSTOM', 'GHOST SHIELD', 79, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '110-D', '110-D.30', 'CUSTOM', 'GHOST SHIELD', 80, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '028-A', '028-A.07', 'CUSTOM', 'GHOST SHIELD', 81, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '110-A', '110-A.27', 'CUSTOM', 'GHOST SHIELD', 82, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '028-B', '028-B.07', 'CUSTOM', 'GHOST SHIELD', 83, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '110-A', '110-A.28', 'CUSTOM', 'GHOST SHIELD', 84, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '047-A', '047-A.26', 'CUSTOM', 'GHOST SHIELD', 85, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '047-A', '047-A.27', 'CUSTOM', 'GHOST SHIELD', 86, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '047-A', '047-A.28', 'CUSTOM', 'GHOST SHIELD', 87, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '020-C', '020-C.08', 'CUSTOM', 'GHOST SHIELD', 88, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '110-X', '110-X.08', 'CUSTOM', 'GHOST SHIELD', 89, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '067-B', '067-B.13', 'CUSTOM', 'GHOST SHIELD', 90, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '067-B', '067-B.14', 'CUSTOM', 'GHOST SHIELD', 91, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '036-C', '036-C.08', 'CUSTOM', 'GHOST SHIELD', 92, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '078-B', '078-B.08', 'CUSTOM', 'GHOST SHIELD', 93, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '036-C', '036-C.09', 'CUSTOM', 'GHOST SHIELD', 94, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '078-B', '078-B.09', 'CUSTOM', 'GHOST SHIELD', 95, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '036-C', '036-C.10', 'CUSTOM', 'GHOST SHIELD', 96, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '078-B', '078-B.10', 'CUSTOM', 'GHOST SHIELD', 97, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '047-B', '047-B.12', 'CUSTOM', 'GHOST SHIELD', 98, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '095-D', '095-D.15', 'CUSTOM', 'GHOST SHIELD', 99, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '095-D', '095-D.16', 'CUSTOM', 'GHOST SHIELD', 100, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '047-B', '047-B.13', 'CUSTOM', 'GHOST SHIELD', 101, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '095-D', '095-D.17', 'CUSTOM', 'GHOST SHIELD', 102, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '095-D', '095-D.18', 'CUSTOM', 'GHOST SHIELD', 103, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '067-X', '067-X.01', 'CUSTOM', 'GHOST SHIELD', 104, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '067-X', '067-X.02', 'CUSTOM', 'GHOST SHIELD', 105, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '067-X', '067-X.03', 'CUSTOM', 'GHOST SHIELD', 106, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '067-X', '067-X.04', 'CUSTOM', 'GHOST SHIELD', 107, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '036-A', '036-A.01', 'CUSTOM', 'GHOST SHIELD', 108, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '095-C', '095-C.19', 'CUSTOM', 'GHOST SHIELD', 109, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '036-A', '036-A.02', 'CUSTOM', 'GHOST SHIELD', 110, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '095-C', '095-C.20', 'CUSTOM', 'GHOST SHIELD', 111, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '036-B', '036-B.01', 'CUSTOM', 'GHOST SHIELD', 112, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '078-X', '078-X.01', 'CUSTOM', 'GHOST SHIELD', 113, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '036-B', '036-B.02', 'CUSTOM', 'GHOST SHIELD', 114, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '078-X', '078-X.02', 'CUSTOM', 'GHOST SHIELD', 115, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '036-B', '036-B.03', 'CUSTOM', 'GHOST SHIELD', 116, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '095-C', '095-C.21', 'CUSTOM', 'GHOST SHIELD', 117, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '036-B', '036-B.04', 'CUSTOM', 'GHOST SHIELD', 118, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '095-C', '095-C.22', 'CUSTOM', 'GHOST SHIELD', 119, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '020-X', '020-X.01', 'CUSTOM', 'GHOST SHIELD', 120, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '110-D', '110-D.31', 'CUSTOM', 'GHOST SHIELD', 121, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '110-D', '110-D.32', 'CUSTOM', 'GHOST SHIELD', 122, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '020-C', '020-C.09', 'CUSTOM', 'GHOST SHIELD', 123, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '110-D', '110-D.33', 'CUSTOM', 'GHOST SHIELD', 124, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '110-D', '110-D.34', 'CUSTOM', 'GHOST SHIELD', 125, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '047-D', '047-D.29', 'CUSTOM', 'GHOST SHIELD', 126, TRUE, NULL),
        (v_cast_7, '047-D', '047-D.30', 'CUSTOM', 'GHOST SHIELD', 127, TRUE, NULL),
        (v_cast_7, '095-D', '095-D.19', 'CUSTOM', 'GHOST SHIELD', 128, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '095-D', '095-D.20', 'CUSTOM', 'GHOST SHIELD', 129, TRUE, NULL),
        (v_cast_7, '110-X', '110-X.09', 'CUSTOM', 'GHOST SHIELD', 130, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '067-A', '067-A.15', 'CUSTOM', 'GHOST SHIELD', 131, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '067-D', '067-D.17', 'CUSTOM', 'GHOST SHIELD', 132, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '067-D', '067-D.18', 'CUSTOM', 'GHOST SHIELD', 133, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '047-B', '047-B.14', 'CUSTOM', 'GHOST SHIELD', 134, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '047-B', '047-B.15', 'CUSTOM', 'GHOST SHIELD', 135, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '2' LIMIT 1)),
        (v_cast_7, '047-B', '047-B.16', 'CUSTOM', 'GHOST SHIELD', 136, TRUE, NULL);

    -- Cast 8 (102 panels)
    INSERT INTO casting_components
        (casting_id, type, panel_id, color, sealer, sort_order, produced, crate_id)
    VALUES
        (v_cast_8, '125-C', '125-C.99', 'CUSTOM', 'GHOST SHIELD', 0, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-C', '125-C.100', 'CUSTOM', 'GHOST SHIELD', 1, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-C', '125-C.101', 'CUSTOM', 'GHOST SHIELD', 2, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-C', '125-C.102', 'CUSTOM', 'GHOST SHIELD', 3, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-C', '125-C.103', 'CUSTOM', 'GHOST SHIELD', 4, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-C', '125-C.104', 'CUSTOM', 'GHOST SHIELD', 5, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-C', '125-C.105', 'CUSTOM', 'GHOST SHIELD', 6, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-C', '125-C.106', 'CUSTOM', 'GHOST SHIELD', 7, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-C', '125-C.107', 'CUSTOM', 'GHOST SHIELD', 8, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-C', '125-C.108', 'CUSTOM', 'GHOST SHIELD', 9, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-C', '125-C.109', 'CUSTOM', 'GHOST SHIELD', 10, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-C', '125-C.110', 'CUSTOM', 'GHOST SHIELD', 11, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-C', '125-C.111', 'CUSTOM', 'GHOST SHIELD', 12, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-A', '125-A.91', 'CUSTOM', 'GHOST SHIELD', 13, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-A', '125-A.92', 'CUSTOM', 'GHOST SHIELD', 14, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-A', '125-A.93', 'CUSTOM', 'GHOST SHIELD', 15, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-A', '125-A.94', 'CUSTOM', 'GHOST SHIELD', 16, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-A', '125-A.95', 'CUSTOM', 'GHOST SHIELD', 17, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-A', '125-A.96', 'CUSTOM', 'GHOST SHIELD', 18, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-A', '125-A.97', 'CUSTOM', 'GHOST SHIELD', 19, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-A', '125-A.98', 'CUSTOM', 'GHOST SHIELD', 20, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-A', '125-A.99', 'CUSTOM', 'GHOST SHIELD', 21, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-A', '125-A.100', 'CUSTOM', 'GHOST SHIELD', 22, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-A', '125-A.101', 'CUSTOM', 'GHOST SHIELD', 23, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-A', '125-A.102', 'CUSTOM', 'GHOST SHIELD', 24, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-B', '125-B.57', 'CUSTOM', 'GHOST SHIELD', 25, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-B', '125-B.58', 'CUSTOM', 'GHOST SHIELD', 26, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-B', '125-B.59', 'CUSTOM', 'GHOST SHIELD', 27, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-B', '125-B.60', 'CUSTOM', 'GHOST SHIELD', 28, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-B', '125-B.61', 'CUSTOM', 'GHOST SHIELD', 29, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-B', '125-B.62', 'CUSTOM', 'GHOST SHIELD', 30, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-B', '125-B.63', 'CUSTOM', 'GHOST SHIELD', 31, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '110-C', '110-C.40', 'CUSTOM', 'GHOST SHIELD', 32, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '110-C', '110-C.41', 'CUSTOM', 'GHOST SHIELD', 33, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '110-C', '110-C.42', 'CUSTOM', 'GHOST SHIELD', 34, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '110-C', '110-C.43', 'CUSTOM', 'GHOST SHIELD', 35, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '110-C', '110-C.44', 'CUSTOM', 'GHOST SHIELD', 36, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-D', '125-D.69', 'CUSTOM', 'GHOST SHIELD', 37, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-D', '125-D.70', 'CUSTOM', 'GHOST SHIELD', 38, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-D', '125-D.71', 'CUSTOM', 'GHOST SHIELD', 39, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-D', '125-D.72', 'CUSTOM', 'GHOST SHIELD', 40, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-D', '125-D.73', 'CUSTOM', 'GHOST SHIELD', 41, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-D', '125-D.74', 'CUSTOM', 'GHOST SHIELD', 42, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-D', '125-D.75', 'CUSTOM', 'GHOST SHIELD', 43, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-D', '125-D.76', 'CUSTOM', 'GHOST SHIELD', 44, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-X', '125-X.33', 'CUSTOM', 'GHOST SHIELD', 45, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-X', '125-X.34', 'CUSTOM', 'GHOST SHIELD', 46, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-X', '125-X.35', 'CUSTOM', 'GHOST SHIELD', 47, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '125-X', '125-X.36', 'CUSTOM', 'GHOST SHIELD', 48, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '110-B', '110-B.21', 'CUSTOM', 'GHOST SHIELD', 49, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '110-B', '110-B.22', 'CUSTOM', 'GHOST SHIELD', 50, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '047-C', '047-C.29', 'CUSTOM', 'GHOST SHIELD', 51, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '095-B', '095-B.16', 'CUSTOM', 'GHOST SHIELD', 52, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '047-C', '047-C.30', 'CUSTOM', 'GHOST SHIELD', 53, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '095-B', '095-B.17', 'CUSTOM', 'GHOST SHIELD', 54, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '047-D', '047-D.31', 'CUSTOM', 'GHOST SHIELD', 55, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '047-D', '047-D.32', 'CUSTOM', 'GHOST SHIELD', 56, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '095-A', '095-A.22', 'CUSTOM', 'GHOST SHIELD', 57, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '028-C', '028-C.13', 'CUSTOM', 'GHOST SHIELD', 58, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '110-A', '110-A.29', 'CUSTOM', 'GHOST SHIELD', 59, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '047-B', '047-B.17', 'CUSTOM', 'GHOST SHIELD', 60, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '095-X', '095-X.12', 'CUSTOM', 'GHOST SHIELD', 61, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '067-C', '067-C.23', 'CUSTOM', 'GHOST SHIELD', 62, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '067-C', '067-C.24', 'CUSTOM', 'GHOST SHIELD', 63, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '095-C', '095-C.23', 'CUSTOM', 'GHOST SHIELD', 64, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '078-C', '078-C.10', 'CUSTOM', 'GHOST SHIELD', 65, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '047-C', '047-C.31', 'CUSTOM', 'GHOST SHIELD', 66, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '078-A', '078-A.09', 'CUSTOM', 'GHOST SHIELD', 67, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '047-A', '047-A.29', 'CUSTOM', 'GHOST SHIELD', 68, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '095-A', '095-A.23', 'CUSTOM', 'GHOST SHIELD', 69, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '067-A', '067-A.16', 'CUSTOM', 'GHOST SHIELD', 70, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '067-A', '067-A.17', 'CUSTOM', 'GHOST SHIELD', 71, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '047-X', '047-X.08', 'CUSTOM', 'GHOST SHIELD', 72, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '095-D', '095-D.21', 'CUSTOM', 'GHOST SHIELD', 73, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '095-D', '095-D.22', 'CUSTOM', 'GHOST SHIELD', 74, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '020-A', '020-A.08', 'CUSTOM', 'GHOST SHIELD', 75, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '110-D', '110-D.35', 'CUSTOM', 'GHOST SHIELD', 76, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '110-D', '110-D.36', 'CUSTOM', 'GHOST SHIELD', 77, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '067-X', '067-X.05', 'CUSTOM', 'GHOST SHIELD', 78, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '067-D', '067-D.19', 'CUSTOM', 'GHOST SHIELD', 79, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '067-D', '067-D.20', 'CUSTOM', 'GHOST SHIELD', 80, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '047-B', '047-B.18', 'CUSTOM', 'GHOST SHIELD', 81, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '095-B', '095-B.18', 'CUSTOM', 'GHOST SHIELD', 82, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '047-C', '047-C.32', 'CUSTOM', 'GHOST SHIELD', 83, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '047-C', '047-C.33', 'CUSTOM', 'GHOST SHIELD', 84, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '047-C', '047-C.34', 'CUSTOM', 'GHOST SHIELD', 85, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '036-A', '036-A.03', 'CUSTOM', 'GHOST SHIELD', 86, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '036-A', '036-A.04', 'CUSTOM', 'GHOST SHIELD', 87, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '036-A', '036-A.05', 'CUSTOM', 'GHOST SHIELD', 88, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '036-A', '036-A.06', 'CUSTOM', 'GHOST SHIELD', 89, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '078-D', '078-D.09', 'CUSTOM', 'GHOST SHIELD', 90, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '078-D', '078-D.10', 'CUSTOM', 'GHOST SHIELD', 91, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '036-D', '036-D.07', 'CUSTOM', 'GHOST SHIELD', 92, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '036-D', '036-D.08', 'CUSTOM', 'GHOST SHIELD', 93, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '078-D', '078-D.11', 'CUSTOM', 'GHOST SHIELD', 94, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '078-D', '078-D.12', 'CUSTOM', 'GHOST SHIELD', 95, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '036-X', '036-X.01', 'CUSTOM', 'GHOST SHIELD', 96, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '078-D', '078-D.13', 'CUSTOM', 'GHOST SHIELD', 97, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '078-D', '078-D.14', 'CUSTOM', 'GHOST SHIELD', 98, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '036-X', '036-X.02', 'CUSTOM', 'GHOST SHIELD', 99, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '095-C', '095-C.24', 'CUSTOM', 'GHOST SHIELD', 100, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_8, '067-C', '067-C.25', 'CUSTOM', 'GHOST SHIELD', 101, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1));

    -- Cast 9 (78 panels)
    INSERT INTO casting_components
        (casting_id, type, panel_id, color, sealer, sort_order, produced, crate_id)
    VALUES
        (v_cast_9, '125-C', '125-C.112', 'CUSTOM', 'GHOST SHIELD', 0, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-C', '125-C.113', 'CUSTOM', 'GHOST SHIELD', 1, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-C', '125-C.114', 'CUSTOM', 'GHOST SHIELD', 2, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-C', '125-C.115', 'CUSTOM', 'GHOST SHIELD', 3, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-C', '125-C.116', 'CUSTOM', 'GHOST SHIELD', 4, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-C', '125-C.117', 'CUSTOM', 'GHOST SHIELD', 5, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-C', '125-C.118', 'CUSTOM', 'GHOST SHIELD', 6, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-C', '125-C.119', 'CUSTOM', 'GHOST SHIELD', 7, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-C', '125-C.120', 'CUSTOM', 'GHOST SHIELD', 8, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-C', '125-C.121', 'CUSTOM', 'GHOST SHIELD', 9, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-C', '125-C.122', 'CUSTOM', 'GHOST SHIELD', 10, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-C', '125-C.123', 'CUSTOM', 'GHOST SHIELD', 11, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-C', '125-C.124', 'CUSTOM', 'GHOST SHIELD', 12, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-A', '125-A.103', 'CUSTOM', 'GHOST SHIELD', 13, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-A', '125-A.104', 'CUSTOM', 'GHOST SHIELD', 14, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-A', '125-A.105', 'CUSTOM', 'GHOST SHIELD', 15, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-A', '125-A.106', 'CUSTOM', 'GHOST SHIELD', 16, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-A', '125-A.107', 'CUSTOM', 'GHOST SHIELD', 17, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-A', '125-A.108', 'CUSTOM', 'GHOST SHIELD', 18, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-A', '125-A.109', 'CUSTOM', 'GHOST SHIELD', 19, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-A', '125-A.110', 'CUSTOM', 'GHOST SHIELD', 20, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-A', '125-A.111', 'CUSTOM', 'GHOST SHIELD', 21, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-A', '125-A.112', 'CUSTOM', 'GHOST SHIELD', 22, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-A', '125-A.113', 'CUSTOM', 'GHOST SHIELD', 23, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-A', '125-A.114', 'CUSTOM', 'GHOST SHIELD', 24, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-B', '125-B.64', 'CUSTOM', 'GHOST SHIELD', 25, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-B', '125-B.65', 'CUSTOM', 'GHOST SHIELD', 26, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-B', '125-B.66', 'CUSTOM', 'GHOST SHIELD', 27, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-B', '125-B.67', 'CUSTOM', 'GHOST SHIELD', 28, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-B', '125-B.68', 'CUSTOM', 'GHOST SHIELD', 29, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-B', '125-B.69', 'CUSTOM', 'GHOST SHIELD', 30, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-B', '125-B.70', 'CUSTOM', 'GHOST SHIELD', 31, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '110-C', '110-C.45', 'CUSTOM', 'GHOST SHIELD', 32, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '110-C', '110-C.46', 'CUSTOM', 'GHOST SHIELD', 33, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '110-C', '110-C.47', 'CUSTOM', 'GHOST SHIELD', 34, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '110-C', '110-C.48', 'CUSTOM', 'GHOST SHIELD', 35, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '110-C', '110-C.49', 'CUSTOM', 'GHOST SHIELD', 36, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-D', '125-D.79', 'CUSTOM', 'GHOST SHIELD', 37, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-D', '125-D.80', 'CUSTOM', 'GHOST SHIELD', 38, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-D', '125-D.81', 'CUSTOM', 'GHOST SHIELD', 39, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-D', '125-D.82', 'CUSTOM', 'GHOST SHIELD', 40, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-D', '125-D.83', 'CUSTOM', 'GHOST SHIELD', 41, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-D', '125-D.84', 'CUSTOM', 'GHOST SHIELD', 42, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-D', '125-D.85', 'CUSTOM', 'GHOST SHIELD', 43, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-D', '125-D.86', 'CUSTOM', 'GHOST SHIELD', 44, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-X', '125-X.37', 'CUSTOM', 'GHOST SHIELD', 45, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-X', '125-X.38', 'CUSTOM', 'GHOST SHIELD', 46, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-X', '125-X.39', 'CUSTOM', 'GHOST SHIELD', 47, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '125-X', '125-X.40', 'CUSTOM', 'GHOST SHIELD', 48, TRUE, NULL),
        (v_cast_9, '110-B', '110-B.23', 'CUSTOM', 'GHOST SHIELD', 49, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '110-B', '110-B.24', 'CUSTOM', 'GHOST SHIELD', 50, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '047-C', '047-C.35', 'CUSTOM', 'GHOST SHIELD', 51, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '095-B', '095-B.19', 'CUSTOM', 'GHOST SHIELD', 52, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '047-C', '047-C.35', 'CUSTOM', 'GHOST SHIELD', 53, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '095-B', '095-B.19', 'CUSTOM', 'GHOST SHIELD', 54, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '047-D', '047-D.33', 'CUSTOM', 'GHOST SHIELD', 55, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '047-D', '047-D.34', 'CUSTOM', 'GHOST SHIELD', 56, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '095-A', '095-A.24', 'CUSTOM', 'GHOST SHIELD', 57, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '028-C', '028-C.14', 'CUSTOM', 'GHOST SHIELD', 58, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '110-A', '110-A.30', 'CUSTOM', 'GHOST SHIELD', 59, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '047-B', '047-B.19', 'CUSTOM', 'GHOST SHIELD', 60, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '095-X', '095-X.13', 'CUSTOM', 'GHOST SHIELD', 61, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '067-C', '067-C.26', 'CUSTOM', 'GHOST SHIELD', 62, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '067-C', '067-C.27', 'CUSTOM', 'GHOST SHIELD', 63, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '095-C', '095-C.25', 'CUSTOM', 'GHOST SHIELD', 64, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '078-C', '078-C.11', 'CUSTOM', 'GHOST SHIELD', 65, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '047-C', '047-C.37', 'CUSTOM', 'GHOST SHIELD', 66, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '078-A', '078-A.10', 'CUSTOM', 'GHOST SHIELD', 67, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '047-A', '047-A.30', 'CUSTOM', 'GHOST SHIELD', 68, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '095-A', '095-A.25', 'CUSTOM', 'GHOST SHIELD', 69, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '067-A', '067-A.18', 'CUSTOM', 'GHOST SHIELD', 70, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '067-A', '067-A.19', 'CUSTOM', 'GHOST SHIELD', 71, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '047-X', '047-X.09', 'CUSTOM', 'GHOST SHIELD', 72, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '095-D', '095-D.23', 'CUSTOM', 'GHOST SHIELD', 73, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '095-D', '095-D.24', 'CUSTOM', 'GHOST SHIELD', 74, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '020-A', '020-A.09', 'CUSTOM', 'GHOST SHIELD', 75, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '110-D', '110-D.37', 'CUSTOM', 'GHOST SHIELD', 76, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1)),
        (v_cast_9, '110-D', '110-D.38', 'CUSTOM', 'GHOST SHIELD', 77, TRUE, (SELECT id FROM project_crates WHERE project_number = '0383' AND crate_number = '1' LIMIT 1));

    -- Cast 10 (75 panels)
    INSERT INTO casting_components
        (casting_id, type, panel_id, color, sealer, sort_order, produced, crate_id)
    VALUES
        (v_cast_10, '125-C', '125-C.125', 'CUSTOM', 'GHOST SHIELD', 0, TRUE, NULL),
        (v_cast_10, '125-C', '125-C.126', 'CUSTOM', 'GHOST SHIELD', 1, TRUE, NULL),
        (v_cast_10, '125-C', '125-C.127', 'CUSTOM', 'GHOST SHIELD', 2, TRUE, NULL),
        (v_cast_10, '125-C', '125-C.128', 'CUSTOM', 'GHOST SHIELD', 3, TRUE, NULL),
        (v_cast_10, '125-C', '125-C.129', 'CUSTOM', 'GHOST SHIELD', 4, TRUE, NULL),
        (v_cast_10, '125-C', '125-C.130', 'CUSTOM', 'GHOST SHIELD', 5, TRUE, NULL),
        (v_cast_10, '125-C', '125-C.131', 'CUSTOM', 'GHOST SHIELD', 6, TRUE, NULL),
        (v_cast_10, '125-C', '125-C.132', 'CUSTOM', 'GHOST SHIELD', 7, TRUE, NULL),
        (v_cast_10, '125-C', '125-C.133', 'CUSTOM', 'GHOST SHIELD', 8, TRUE, NULL),
        (v_cast_10, '125-C', '125-C.134', 'CUSTOM', 'GHOST SHIELD', 9, TRUE, NULL),
        (v_cast_10, '125-C', '125-C.135', 'CUSTOM', 'GHOST SHIELD', 10, TRUE, NULL),
        (v_cast_10, '125-C', '125-C.136', 'CUSTOM', 'GHOST SHIELD', 11, TRUE, NULL),
        (v_cast_10, '125-C', '125-C.137', 'CUSTOM', 'GHOST SHIELD', 12, TRUE, NULL),
        (v_cast_10, '125-A', '125-A.115', 'CUSTOM', 'GHOST SHIELD', 13, TRUE, NULL),
        (v_cast_10, '125-A', '125-A.116', 'CUSTOM', 'GHOST SHIELD', 14, TRUE, NULL),
        (v_cast_10, '125-A', '125-A.117', 'CUSTOM', 'GHOST SHIELD', 15, TRUE, NULL),
        (v_cast_10, '125-A', '125-A.118', 'CUSTOM', 'GHOST SHIELD', 16, TRUE, NULL),
        (v_cast_10, '125-A', '125-A.119', 'CUSTOM', 'GHOST SHIELD', 17, TRUE, NULL),
        (v_cast_10, '125-A', '125-A.120', 'CUSTOM', 'GHOST SHIELD', 18, TRUE, NULL),
        (v_cast_10, '125-A', '125-A.121', 'CUSTOM', 'GHOST SHIELD', 19, TRUE, NULL),
        (v_cast_10, '125-A', '125-A.122', 'CUSTOM', 'GHOST SHIELD', 20, TRUE, NULL),
        (v_cast_10, '125-A', '125-A.123', 'CUSTOM', 'GHOST SHIELD', 21, TRUE, NULL),
        (v_cast_10, '125-A', '125-A.124', 'CUSTOM', 'GHOST SHIELD', 22, TRUE, NULL),
        (v_cast_10, '125-A', '125-A.125', 'CUSTOM', 'GHOST SHIELD', 23, TRUE, NULL),
        (v_cast_10, '125-A', '125-A.126', 'CUSTOM', 'GHOST SHIELD', 24, TRUE, NULL),
        (v_cast_10, '125-B', '125-B.71', 'CUSTOM', 'GHOST SHIELD', 25, TRUE, NULL),
        (v_cast_10, '125-B', '125-B.72', 'CUSTOM', 'GHOST SHIELD', 26, TRUE, NULL),
        (v_cast_10, '125-B', '125-B.73', 'CUSTOM', 'GHOST SHIELD', 27, TRUE, NULL),
        (v_cast_10, '125-B', '125-B.74', 'CUSTOM', 'GHOST SHIELD', 28, TRUE, NULL),
        (v_cast_10, '125-B', '125-B.75', 'CUSTOM', 'GHOST SHIELD', 29, TRUE, NULL),
        (v_cast_10, '125-B', '125-B.76', 'CUSTOM', 'GHOST SHIELD', 30, TRUE, NULL),
        (v_cast_10, '125-B', '125-B.77', 'CUSTOM', 'GHOST SHIELD', 31, TRUE, NULL),
        (v_cast_10, '110-C', '110-C.50', 'CUSTOM', 'GHOST SHIELD', 32, TRUE, NULL),
        (v_cast_10, '110-C', '110-C.51', 'CUSTOM', 'GHOST SHIELD', 33, TRUE, NULL),
        (v_cast_10, '110-C', '110-C.52', 'CUSTOM', 'GHOST SHIELD', 34, TRUE, NULL),
        (v_cast_10, '110-C', '110-C.53', 'CUSTOM', 'GHOST SHIELD', 35, TRUE, NULL),
        (v_cast_10, '110-C', '110-C.54', 'CUSTOM', 'GHOST SHIELD', 36, TRUE, NULL),
        (v_cast_10, '125-D', '125-D.87', 'CUSTOM', 'GHOST SHIELD', 37, TRUE, NULL),
        (v_cast_10, '125-D', '125-D.88', 'CUSTOM', 'GHOST SHIELD', 38, TRUE, NULL),
        (v_cast_10, '125-D', '125-D.89', 'CUSTOM', 'GHOST SHIELD', 39, TRUE, NULL),
        (v_cast_10, '125-D', '125-D.90', 'CUSTOM', 'GHOST SHIELD', 40, TRUE, NULL),
        (v_cast_10, '125-D', '125-D.91', 'CUSTOM', 'GHOST SHIELD', 41, TRUE, NULL),
        (v_cast_10, '125-D', '125-D.92', 'CUSTOM', 'GHOST SHIELD', 42, TRUE, NULL),
        (v_cast_10, '125-D', '125-D.93', 'CUSTOM', 'GHOST SHIELD', 43, TRUE, NULL),
        (v_cast_10, '125-D', '125-D.94', 'CUSTOM', 'GHOST SHIELD', 44, TRUE, NULL),
        (v_cast_10, '125-X', '125-X.41', 'CUSTOM', 'GHOST SHIELD', 45, TRUE, NULL),
        (v_cast_10, '125-X', '125-X.42', 'CUSTOM', 'GHOST SHIELD', 46, TRUE, NULL),
        (v_cast_10, '125-X', '125-X.43', 'CUSTOM', 'GHOST SHIELD', 47, TRUE, NULL),
        (v_cast_10, '125-X', '125-X.44', 'CUSTOM', 'GHOST SHIELD', 48, TRUE, NULL),
        (v_cast_10, '110-B', '110-B.25', 'CUSTOM', 'GHOST SHIELD', 49, TRUE, NULL),
        (v_cast_10, '110-B', '110-B.26', 'CUSTOM', 'GHOST SHIELD', 50, TRUE, NULL),
        (v_cast_10, '047-C', '047-C.38', 'CUSTOM', 'GHOST SHIELD', 51, TRUE, NULL),
        (v_cast_10, '095-B', '095-B.25', 'CUSTOM', 'GHOST SHIELD', 52, TRUE, NULL),
        (v_cast_10, '047-C', '047-C.39', 'CUSTOM', 'GHOST SHIELD', 53, TRUE, NULL),
        (v_cast_10, '095-B', '095-B.26', 'CUSTOM', 'GHOST SHIELD', 54, TRUE, NULL),
        (v_cast_10, '047-D', '047-D.35', 'CUSTOM', 'GHOST SHIELD', 55, TRUE, NULL),
        (v_cast_10, '047-D', '047-D.36', 'CUSTOM', 'GHOST SHIELD', 56, TRUE, NULL),
        (v_cast_10, '095-A', '095-A.26', 'CUSTOM', 'GHOST SHIELD', 57, TRUE, NULL),
        (v_cast_10, '028-C', '028-C.15', 'CUSTOM', 'GHOST SHIELD', 58, TRUE, NULL),
        (v_cast_10, '110-A', '110-A.31', 'CUSTOM', 'GHOST SHIELD', 59, TRUE, NULL),
        (v_cast_10, '047-B', '047-B.22', 'CUSTOM', 'GHOST SHIELD', 60, TRUE, NULL),
        (v_cast_10, '095-X', '095-X.14', 'CUSTOM', 'GHOST SHIELD', 61, TRUE, NULL),
        (v_cast_10, '067-C', '067-C.28', 'CUSTOM', 'GHOST SHIELD', 62, TRUE, NULL),
        (v_cast_10, '067-C', '067-C.29', 'CUSTOM', 'GHOST SHIELD', 63, TRUE, NULL),
        (v_cast_10, '095-C', '095-C.30', 'CUSTOM', 'GHOST SHIELD', 64, TRUE, NULL),
        (v_cast_10, '078-C', '078-C.12', 'CUSTOM', 'GHOST SHIELD', 65, TRUE, NULL),
        (v_cast_10, '047-C', '047-C.40', 'CUSTOM', 'GHOST SHIELD', 66, TRUE, NULL),
        (v_cast_10, '078-A', '078-A.11', 'CUSTOM', 'GHOST SHIELD', 67, TRUE, NULL),
        (v_cast_10, '047-A', '047-A.31', 'CUSTOM', 'GHOST SHIELD', 68, TRUE, NULL),
        (v_cast_10, '095-A', '095-A.27', 'CUSTOM', 'GHOST SHIELD', 69, TRUE, NULL),
        (v_cast_10, '067-A', '067-A.20', 'CUSTOM', 'GHOST SHIELD', 70, TRUE, NULL),
        (v_cast_10, '067-A', '067-A.21', 'CUSTOM', 'GHOST SHIELD', 71, TRUE, NULL),
        (v_cast_10, '047-X', '047-X.10', 'CUSTOM', 'GHOST SHIELD', 72, TRUE, NULL),
        (v_cast_10, '095-D', '095-D.25', 'CUSTOM', 'GHOST SHIELD', 73, TRUE, NULL),
        (v_cast_10, '095-D', '095-D.26', 'CUSTOM', 'GHOST SHIELD', 74, TRUE, NULL);

    -- Cast 11 (75 panels)
    INSERT INTO casting_components
        (casting_id, type, panel_id, color, sealer, sort_order, produced, crate_id)
    VALUES
        (v_cast_11, '125-C', '125-C.138', NULL, NULL, 0, TRUE, NULL),
        (v_cast_11, '125-C', '125-C.139', NULL, NULL, 1, TRUE, NULL),
        (v_cast_11, '125-C', '125-C.140', NULL, NULL, 2, TRUE, NULL),
        (v_cast_11, '125-C', '125-C.141', NULL, NULL, 3, TRUE, NULL),
        (v_cast_11, '125-C', '125-C.142', NULL, NULL, 4, TRUE, NULL),
        (v_cast_11, '125-C', '125-C.143', NULL, NULL, 5, TRUE, NULL),
        (v_cast_11, '125-C', '125-C.144', NULL, NULL, 6, TRUE, NULL),
        (v_cast_11, '125-C', '125-C.145', NULL, NULL, 7, TRUE, NULL),
        (v_cast_11, '125-C', '125-C.146', NULL, NULL, 8, TRUE, NULL),
        (v_cast_11, '125-C', '125-C.147', NULL, NULL, 9, TRUE, NULL),
        (v_cast_11, '125-C', '125-C.148', NULL, NULL, 10, TRUE, NULL),
        (v_cast_11, '125-C', '125-C.149', NULL, NULL, 11, TRUE, NULL),
        (v_cast_11, '125-C', '125-C.150', NULL, NULL, 12, TRUE, NULL),
        (v_cast_11, '125-A', '125-A.127', NULL, NULL, 13, TRUE, NULL),
        (v_cast_11, '125-A', '125-A.128', NULL, NULL, 14, TRUE, NULL),
        (v_cast_11, '125-A', '125-A.129', NULL, NULL, 15, TRUE, NULL),
        (v_cast_11, '125-A', '125-A.130', NULL, NULL, 16, TRUE, NULL),
        (v_cast_11, '125-A', '125-A.131', NULL, NULL, 17, TRUE, NULL),
        (v_cast_11, '125-A', '125-A.132', NULL, NULL, 18, TRUE, NULL),
        (v_cast_11, '125-A', '125-A.133', NULL, NULL, 19, TRUE, NULL),
        (v_cast_11, '125-A', '125-A.134', NULL, NULL, 20, TRUE, NULL),
        (v_cast_11, '125-A', '125-A.135', NULL, NULL, 21, TRUE, NULL),
        (v_cast_11, '125-A', '125-A.136', NULL, NULL, 22, TRUE, NULL),
        (v_cast_11, '125-A', '125-A.137', NULL, NULL, 23, TRUE, NULL),
        (v_cast_11, '125-A', '125-A.138', NULL, NULL, 24, TRUE, NULL),
        (v_cast_11, '125-B', '125-B.78', NULL, NULL, 25, TRUE, NULL),
        (v_cast_11, '125-B', '125-B.79', NULL, NULL, 26, TRUE, NULL),
        (v_cast_11, '125-B', '125-B.80', NULL, NULL, 27, TRUE, NULL),
        (v_cast_11, '125-B', '125-B.81', NULL, NULL, 28, TRUE, NULL),
        (v_cast_11, '125-B', '125-B.82', NULL, NULL, 29, TRUE, NULL),
        (v_cast_11, '125-B', '125-B.83', NULL, NULL, 30, TRUE, NULL),
        (v_cast_11, '125-B', '125-B.84', NULL, NULL, 31, TRUE, NULL),
        (v_cast_11, '110-C', '110-C.55', NULL, NULL, 32, TRUE, NULL),
        (v_cast_11, '110-C', '110-C.56', NULL, NULL, 33, TRUE, NULL),
        (v_cast_11, '110-C', '110-C.57', NULL, NULL, 34, TRUE, NULL),
        (v_cast_11, '110-C', '110-C.58', NULL, NULL, 35, TRUE, NULL),
        (v_cast_11, '110-C', '110-C.59', NULL, NULL, 36, TRUE, NULL),
        (v_cast_11, '125-D', '125-D.95', NULL, NULL, 37, TRUE, NULL),
        (v_cast_11, '125-D', '125-D.96', NULL, NULL, 38, TRUE, NULL),
        (v_cast_11, '125-D', '125-D.97', NULL, NULL, 39, TRUE, NULL),
        (v_cast_11, '125-D', '125-D.98', NULL, NULL, 40, TRUE, NULL),
        (v_cast_11, '125-D', '125-D.99', NULL, NULL, 41, TRUE, NULL),
        (v_cast_11, '125-D', '125-D.100', NULL, NULL, 42, TRUE, NULL),
        (v_cast_11, '125-D', '125-D.101', NULL, NULL, 43, TRUE, NULL),
        (v_cast_11, '125-D', '125-D.102', NULL, NULL, 44, TRUE, NULL),
        (v_cast_11, '125-X', '125-X.45', NULL, NULL, 45, TRUE, NULL),
        (v_cast_11, '125-X', '125-X.46', NULL, NULL, 46, TRUE, NULL),
        (v_cast_11, '125-X', '125-X.47', NULL, NULL, 47, TRUE, NULL),
        (v_cast_11, '125-X', '125-X.48', NULL, NULL, 48, TRUE, NULL),
        (v_cast_11, '110-B', '110-B.27', NULL, NULL, 49, TRUE, NULL),
        (v_cast_11, '110-B', '110-B.28', NULL, NULL, 50, TRUE, NULL),
        (v_cast_11, '95-B', '95-B.27', NULL, NULL, 51, TRUE, NULL),
        (v_cast_11, '47-C', '47-C.41', NULL, NULL, 52, TRUE, NULL),
        (v_cast_11, '95-B', '95-B.28', NULL, NULL, 53, TRUE, NULL),
        (v_cast_11, '47-C', '47-C.42', NULL, NULL, 54, TRUE, NULL),
        (v_cast_11, '95-A', '95-A.29', NULL, NULL, 55, TRUE, NULL),
        (v_cast_11, '47-D', '47-D.37', NULL, NULL, 56, TRUE, NULL),
        (v_cast_11, '47-D', '47-D.38', NULL, NULL, 57, TRUE, NULL),
        (v_cast_11, '110-A', '110-A.32', NULL, NULL, 58, TRUE, NULL),
        (v_cast_11, '28-C', '28-C.16', NULL, NULL, 59, TRUE, NULL),
        (v_cast_11, '95-X', '95-X.15', NULL, NULL, 60, TRUE, NULL),
        (v_cast_11, '47-B', '47-B.23', NULL, NULL, 61, TRUE, NULL),
        (v_cast_11, '67-C', '67-C.30', NULL, NULL, 62, TRUE, NULL),
        (v_cast_11, '67-C', '67-C.31', NULL, NULL, 63, TRUE, NULL),
        (v_cast_11, '95-C', '95-C.31', NULL, NULL, 64, TRUE, NULL),
        (v_cast_11, '78-C', '78-C.13', NULL, NULL, 65, TRUE, NULL),
        (v_cast_11, '78-A', '78-A.12', NULL, NULL, 66, TRUE, NULL),
        (v_cast_11, '47-C', '47-C.43', NULL, NULL, 67, TRUE, NULL),
        (v_cast_11, '95-A', '95-A.30', NULL, NULL, 68, TRUE, NULL),
        (v_cast_11, '47-A', '47-A.32', NULL, NULL, 69, TRUE, NULL),
        (v_cast_11, '67-A', '67-A.22', NULL, NULL, 70, TRUE, NULL),
        (v_cast_11, '67-A', '67-A.23', NULL, NULL, 71, TRUE, NULL),
        (v_cast_11, '95-D', '95-D.27', NULL, NULL, 72, TRUE, NULL),
        (v_cast_11, '95-D', '95-D.28', NULL, NULL, 73, TRUE, NULL),
        (v_cast_11, '47-X', '47-X.11', NULL, NULL, 74, TRUE, NULL);

    -- Cast 12 (0 panels)

    -- ----- Remake queue: rejected panels copied to Cast 12 with produced = FALSE -----
    INSERT INTO casting_components
        (casting_id, type, panel_id, color, sealer, sort_order, produced, crate_id)
    VALUES
        (v_cast_12, '125-C', '125-C.02', 'CUSTOM', 'GHOST SHIELD', 0, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '125-C', '125-C.05', 'CUSTOM', 'GHOST SHIELD', 1, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '125-C', '125-C.11', 'CUSTOM', 'GHOST SHIELD', 2, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '125-C', '125-C.13', 'CUSTOM', 'GHOST SHIELD', 3, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '125-A', '125-A.01', 'CUSTOM', 'GHOST SHIELD', 4, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '125-A', '125-A.02', 'CUSTOM', 'GHOST SHIELD', 5, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '125-A', '125-A.03', 'CUSTOM', 'GHOST SHIELD', 6, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '125-A', '125-A.04', 'CUSTOM', 'GHOST SHIELD', 7, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '125-A', '125-A.05', 'CUSTOM', 'GHOST SHIELD', 8, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '125-A', '125-A.06', 'CUSTOM', 'GHOST SHIELD', 9, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '125-A', '125-A.07', 'CUSTOM', 'GHOST SHIELD', 10, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '125-A', '125-A.08', 'CUSTOM', 'GHOST SHIELD', 11, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '125-A', '125-A.09', 'CUSTOM', 'GHOST SHIELD', 12, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '125-A', '125-A.11', 'CUSTOM', 'GHOST SHIELD', 13, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '125-A', '125-A.12', 'CUSTOM', 'GHOST SHIELD', 14, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '125-A', '125-A.13', 'CUSTOM', 'GHOST SHIELD', 15, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '125-B', '125-B.01', 'CUSTOM', 'GHOST SHIELD', 16, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '125-B', '125-B.03', 'CUSTOM', 'GHOST SHIELD', 17, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '125-B', '125-B.05', 'CUSTOM', 'GHOST SHIELD', 18, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '125-B', '125-B.06', 'CUSTOM', 'GHOST SHIELD', 19, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '125-B', '125-B.07', 'CUSTOM', 'GHOST SHIELD', 20, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '125-B', '125-B.08', 'CUSTOM', 'GHOST SHIELD', 21, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '110-C', '110-C.03', 'CUSTOM', 'GHOST SHIELD', 22, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '110-C', '110-C.05', 'CUSTOM', 'GHOST SHIELD', 23, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '110-C', '110-C.06', 'CUSTOM', 'GHOST SHIELD', 24, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '125-D', '125-D.01', 'CUSTOM', 'GHOST SHIELD', 25, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '125-D', '125-D.02', 'CUSTOM', 'GHOST SHIELD', 26, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '125-D', '125-D.05', 'CUSTOM', 'GHOST SHIELD', 27, FALSE, NULL),  -- from cast 1A
        (v_cast_12, '125-D', '125-D.10', 'CUSTOM', 'GHOST SHIELD', 28, FALSE, NULL),  -- from cast 1B
        (v_cast_12, '095-B', '095-B.02', 'CUSTOM', 'GHOST SHIELD', 29, FALSE, NULL),  -- from cast 1B
        (v_cast_12, '067-C', '067-C.03', 'CUSTOM', 'GHOST SHIELD', 30, FALSE, NULL),  -- from cast 1B
        (v_cast_12, '020-C', '020-C.01', 'CUSTOM', 'GHOST SHIELD', 31, FALSE, NULL),  -- from cast 1B
        (v_cast_12, '110-X', '110-X.01', 'CUSTOM', 'GHOST SHIELD', 32, FALSE, NULL),  -- from cast 1B
        (v_cast_12, '067-B', '067-B.01', 'CUSTOM', 'GHOST SHIELD', 33, FALSE, NULL),  -- from cast 1B
        (v_cast_12, '067-B', '067-B.02', 'CUSTOM', 'GHOST SHIELD', 34, FALSE, NULL),  -- from cast 1B
        (v_cast_12, '135-A', '135-A.01', 'CUSTOM', 'GHOST SHIELD', 35, FALSE, NULL),  -- from cast 1B
        (v_cast_12, '020-D', '020-D.01', 'CUSTOM', 'GHOST SHIELD', 36, FALSE, NULL),  -- from cast 1B
        (v_cast_12, '020-D', '020-D.02', 'CUSTOM', 'GHOST SHIELD', 37, FALSE, NULL),  -- from cast 1B
        (v_cast_12, '047-C', '047-C.06', 'CUSTOM', 'GHOST SHIELD', 38, FALSE, NULL),  -- from cast 1B
        (v_cast_12, '125-A', '125-A.23', 'CUSTOM', 'GHOST SHIELD', 39, FALSE, NULL),  -- from cast 2
        (v_cast_12, '125-B', '125-B.15', 'CUSTOM', 'GHOST SHIELD', 40, FALSE, NULL),  -- from cast 2
        (v_cast_12, '125-D', '125-D.11', 'CUSTOM', 'GHOST SHIELD', 41, FALSE, NULL),  -- from cast 2
        (v_cast_12, '125-D', '125-D.14', 'CUSTOM', 'GHOST SHIELD', 42, FALSE, NULL),  -- from cast 2
        (v_cast_12, '125-D', '125-D.15', 'CUSTOM', 'GHOST SHIELD', 43, FALSE, NULL),  -- from cast 2
        (v_cast_12, '125-D', '125-D.16', 'CUSTOM', 'GHOST SHIELD', 44, FALSE, NULL),  -- from cast 2
        (v_cast_12, '125-D', '125-D.17', 'CUSTOM', 'GHOST SHIELD', 45, FALSE, NULL),  -- from cast 2
        (v_cast_12, '125-D', '125-D.24', 'CUSTOM', 'GHOST SHIELD', 46, FALSE, NULL),  -- from cast 2
        (v_cast_12, '095-B', '095-B.04', 'CUSTOM', 'GHOST SHIELD', 47, FALSE, NULL),  -- from cast 2
        (v_cast_12, '047-D', '047-D.07', 'CUSTOM', 'GHOST SHIELD', 48, FALSE, NULL),  -- from cast 2
        (v_cast_12, '047-D', '047-D.08', 'CUSTOM', 'GHOST SHIELD', 49, FALSE, NULL),  -- from cast 2
        (v_cast_12, '078-C', '078-C.03', 'CUSTOM', 'GHOST SHIELD', 50, FALSE, NULL),  -- from cast 2
        (v_cast_12, '047-C', '047-C.09', 'CUSTOM', 'GHOST SHIELD', 51, FALSE, NULL),  -- from cast 2
        (v_cast_12, '047-X', '047-X.02', 'CUSTOM', 'GHOST SHIELD', 52, FALSE, NULL),  -- from cast 2
        (v_cast_12, '095-D', '095-D.03', 'CUSTOM', 'GHOST SHIELD', 53, FALSE, NULL),  -- from cast 2
        (v_cast_12, '110-D', '110-D.06', 'CUSTOM', 'GHOST SHIELD', 54, FALSE, NULL),  -- from cast 2
        (v_cast_12, '028-B', '028-B.02', 'CUSTOM', 'GHOST SHIELD', 55, FALSE, NULL),  -- from cast 2
        (v_cast_12, '110-A', '110-A.08', 'CUSTOM', 'GHOST SHIELD', 56, FALSE, NULL),  -- from cast 2
        (v_cast_12, '047-A', '047-A.08', 'CUSTOM', 'GHOST SHIELD', 57, FALSE, NULL),  -- from cast 2
        (v_cast_12, '020-C', '020-C.02', 'CUSTOM', 'GHOST SHIELD', 58, FALSE, NULL),  -- from cast 2
        (v_cast_12, '110-X', '110-X.02', 'CUSTOM', 'GHOST SHIELD', 59, FALSE, NULL),  -- from cast 2
        (v_cast_12, '067-B', '067-B.04', 'CUSTOM', 'GHOST SHIELD', 60, FALSE, NULL),  -- from cast 2
        (v_cast_12, '125-C', '125-C.33', 'CUSTOM', 'GHOST SHIELD', 61, FALSE, NULL),  -- from cast 3
        (v_cast_12, '125-C', '125-C.34', 'CUSTOM', 'GHOST SHIELD', 62, FALSE, NULL),  -- from cast 3
        (v_cast_12, '110-C', '110-C.16', 'CUSTOM', 'GHOST SHIELD', 63, FALSE, NULL),  -- from cast 3
        (v_cast_12, '125-D', '125-D.27', 'CUSTOM', 'GHOST SHIELD', 64, FALSE, NULL),  -- from cast 3
        (v_cast_12, '125-D', '125-D.29', 'CUSTOM', 'GHOST SHIELD', 65, FALSE, NULL),  -- from cast 3
        (v_cast_12, '125-X', '125-X.11', 'CUSTOM', 'GHOST SHIELD', 66, FALSE, NULL),  -- from cast 3
        (v_cast_12, '125-X', '125-X.12', 'CUSTOM', 'GHOST SHIELD', 67, FALSE, NULL),  -- from cast 3
        (v_cast_12, '125-X', '125-X.13', 'CUSTOM', 'GHOST SHIELD', 68, FALSE, NULL),  -- from cast 3
        (v_cast_12, '095-A', '095-A.07', 'CUSTOM', 'GHOST SHIELD', 69, FALSE, NULL),  -- from cast 3
        (v_cast_12, '047-D', '047-D.11', 'CUSTOM', 'GHOST SHIELD', 70, FALSE, NULL),  -- from cast 3
        (v_cast_12, '110-A', '110-A.09', 'CUSTOM', 'GHOST SHIELD', 71, FALSE, NULL),  -- from cast 3
        (v_cast_12, '110-A', '110-A.10', 'CUSTOM', 'GHOST SHIELD', 72, FALSE, NULL),  -- from cast 3
        (v_cast_12, '095-A', '095-A.09', 'CUSTOM', 'GHOST SHIELD', 73, FALSE, NULL),  -- from cast 3
        (v_cast_12, '110-D', '110-D.07', 'CUSTOM', 'GHOST SHIELD', 74, FALSE, NULL),  -- from cast 3
        (v_cast_12, '110-D', '110-D.08', 'CUSTOM', 'GHOST SHIELD', 75, FALSE, NULL),  -- from cast 3
        (v_cast_12, '067-D', '067-D.05', 'CUSTOM', 'GHOST SHIELD', 76, FALSE, NULL),  -- from cast 3
        (v_cast_12, '067-D', '067-D.08', 'CUSTOM', 'GHOST SHIELD', 77, FALSE, NULL),  -- from cast 3
        (v_cast_12, '078-D', '078-D.03', 'CUSTOM', 'GHOST SHIELD', 78, FALSE, NULL),  -- from cast 3
        (v_cast_12, '135-C', '135-C.02', 'CUSTOM', 'GHOST SHIELD', 79, FALSE, NULL),  -- from cast 3
        (v_cast_12, '110-D', '110-D.12', 'CUSTOM', 'GHOST SHIELD', 80, FALSE, NULL),  -- from cast 3
        (v_cast_12, '110-D', '110-D.14', 'CUSTOM', 'GHOST SHIELD', 81, FALSE, NULL),  -- from cast 3
        (v_cast_12, '125-C', '125-C.53', 'CUSTOM', 'GHOST SHIELD', 82, FALSE, NULL),  -- from cast 4
        (v_cast_12, '125-C', '125-C.56', 'CUSTOM', 'GHOST SHIELD', 83, FALSE, NULL),  -- from cast 4
        (v_cast_12, '125-D', '125-D.35', 'CUSTOM', 'GHOST SHIELD', 84, FALSE, NULL),  -- from cast 4
        (v_cast_12, '028-A', '028-A.04', 'CUSTOM', 'GHOST SHIELD', 85, FALSE, NULL),  -- from cast 4
        (v_cast_12, '110-A', '110-A.16', 'CUSTOM', 'GHOST SHIELD', 86, FALSE, NULL),  -- from cast 4
        (v_cast_12, '135-A', '135-A.03', 'CUSTOM', 'GHOST SHIELD', 87, FALSE, NULL),  -- from cast 4
        (v_cast_12, '110-D', '110-D.17', 'CUSTOM', 'GHOST SHIELD', 88, FALSE, NULL),  -- from cast 4
        (v_cast_12, '135-C', '135-C.03', 'CUSTOM', 'GHOST SHIELD', 89, FALSE, NULL),  -- from cast 4
        (v_cast_12, '110-D', '110-D.19', 'CUSTOM', 'GHOST SHIELD', 90, FALSE, NULL),  -- from cast 4
        (v_cast_12, '110-D', '110-D.22', 'CUSTOM', 'GHOST SHIELD', 91, FALSE, NULL),  -- from cast 4
        (v_cast_12, '125-A', '125-A.64', 'CUSTOM', 'GHOST SHIELD', 92, FALSE, NULL),  -- from cast 5
        (v_cast_12, '047-C', '047-C.20', 'CUSTOM', 'GHOST SHIELD', 93, FALSE, NULL),  -- from cast 5
        (v_cast_12, '047-A', '047-A.20', 'CUSTOM', 'GHOST SHIELD', 94, FALSE, NULL),  -- from cast 5
        (v_cast_12, '135-B', '135-B.03', 'CUSTOM', 'GHOST SHIELD', 95, FALSE, NULL),  -- from cast 5
        (v_cast_12, '135-B', '135-B.04', 'CUSTOM', 'GHOST SHIELD', 96, FALSE, NULL),  -- from cast 5
        (v_cast_12, '067-C', '067-C.19', 'CUSTOM', 'GHOST SHIELD', 97, FALSE, NULL),  -- from cast 6
        (v_cast_12, '135-D', '135-D.02', 'CUSTOM', 'GHOST SHIELD', 98, FALSE, NULL),  -- from cast 6
        (v_cast_12, '047-D', '047-D.29', 'CUSTOM', 'GHOST SHIELD', 99, FALSE, NULL),  -- from cast 7
        (v_cast_12, '047-D', '047-D.30', 'CUSTOM', 'GHOST SHIELD', 100, FALSE, NULL),  -- from cast 7
        (v_cast_12, '095-D', '095-D.20', 'CUSTOM', 'GHOST SHIELD', 101, FALSE, NULL),  -- from cast 7
        (v_cast_12, '047-B', '047-B.16', 'CUSTOM', 'GHOST SHIELD', 102, FALSE, NULL),  -- from cast 7
        (v_cast_12, '125-X', '125-X.40', 'CUSTOM', 'GHOST SHIELD', 103, FALSE, NULL);  -- from cast 9

    RAISE NOTICE 'Imported % components across % casts (+ % remakes into Cast 12)', 1216, 13, 104;
END $$;
