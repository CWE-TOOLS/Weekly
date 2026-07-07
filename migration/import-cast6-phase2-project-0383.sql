-- =====================================================================
-- Import casting inventory for Project 0383, Phase 2, Cast #6
-- Source: panel inventory list provided by user (length, width, qty per type)
--
-- 8 type/dimension rows · 53 panels total.
--
-- Color and sealer are left blank — set them in the Casting Inventory UI if needed.
-- Existing inventory under Cast #6 (Phase 2) is wiped first so re-running is safe.
-- Lookup is scoped to phase_id so Cast #6 from another phase won't collide.
-- =====================================================================

DO $$
DECLARE
    v_casting_id uuid;
    v_count int;
BEGIN
    -- Scoped to Phase 2 (project_phases.id = ef66ab51-0e47-4639-8297-9e0bd0ed7768)
    -- because Cast #6 also exists under Phase 1 on this project.
    SELECT count(*) INTO v_count
    FROM project_castings
    WHERE project_number = '0383'
      AND casting_number = '6'
      AND phase_id = 'ef66ab51-0e47-4639-8297-9e0bd0ed7768';

    IF v_count = 0 THEN
        RAISE EXCEPTION 'No casting #6 found for project 0383 under Phase 2';
    ELSIF v_count > 1 THEN
        RAISE EXCEPTION 'Multiple casting #6 rows found for project 0383 under Phase 2 (% rows).', v_count;
    END IF;

    SELECT id INTO v_casting_id
    FROM project_castings
    WHERE project_number = '0383'
      AND casting_number = '6'
      AND phase_id = 'ef66ab51-0e47-4639-8297-9e0bd0ed7768';

    DELETE FROM casting_inventory WHERE casting_id = v_casting_id;

    INSERT INTO casting_inventory (casting_id, type, width, length, quantity, extras, sort_order) VALUES
        (v_casting_id, '58-A',  '5 5/16"', '58"',   3, 0, 0),
        (v_casting_id, '64-A',  '5 5/16"', '64"',   1, 0, 1),
        (v_casting_id, '89-A',  '5 5/16"', '89"',  12, 0, 2),
        (v_casting_id, '89-Z',  '8"',      '89"',   1, 0, 3),
        (v_casting_id, '100-A', '5 5/16"', '100"',  7, 0, 4),
        (v_casting_id, '110-Z', '8"',      '110"',  1, 0, 5),
        (v_casting_id, '122-A', '5 5/16"', '122"', 23, 0, 6),
        (v_casting_id, '144-A', '5 5/16"', '144"',  5, 0, 7);

    RAISE NOTICE 'Imported 8 inventory rows (53 panels) into casting %', v_casting_id;
END $$;
