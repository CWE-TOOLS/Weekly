/**
 * Reset crate # importer: clears every casting_components.crate_id for
 * project 0383 casts 1A..11, then re-applies crate # from the legacy CSV
 * using the same per-(cast, type) position match as Phase 2.
 *
 * Also emits a cross-check that reports any (cast, type) where the
 * CSV-expected count and the DB-actual component count differ — that's
 * the most likely reason the previous run skipped 1A/1B crates.
 *
 * Run:
 *   node tools/parse-tracking-crates.js > migration/reset-crates-casts-1a-11-project-0383.sql
 */

const fs = require('node:fs');

const CSV_PATH = 'C:\\Users\\mdasilva\\Downloads\\7 Fairfield Full Scope - Tracking Sheets.csv';
const PROJECT = '0383';

// ---------- CSV parser ----------
function parseCsv(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else { inQuotes = false; }
            } else { field += ch; }
        } else {
            if (ch === '"') inQuotes = true;
            else if (ch === ',') { row.push(field); field = ''; }
            else if (ch === '\n' || ch === '\r') {
                if (ch === '\r' && text[i + 1] === '\n') i++;
                row.push(field); field = '';
                rows.push(row); row = [];
            } else { field += ch; }
        }
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    return rows;
}
function clean(s) {
    if (s === undefined || s === null) return null;
    const t = String(s).replace(/\s+/g, ' ').trim();
    return t === '' ? null : t;
}
function cleanType(s) {
    let t = clean(s);
    if (!t) return null;
    return t.replace(/^PANEL\s+/i, '') || null;
}
function isCastSectionRow(row) {
    const label = (row[2] || '').replace(/\s+/g, ' ').trim();
    const pieces = (row[3] || '').replace(/\s+/g, ' ').trim();
    if (!label || !pieces) return false;
    return /\bPieces?\b/i.test(pieces);
}
function extractCastNum(label) {
    const m = label.match(/^\(\s*CAST\s+([0-9]+[A-Z]?)\s*\)$/i);
    return m ? m[1].toUpperCase() : null;
}
function sqlString(v) {
    if (v === null || v === undefined) return 'NULL';
    return `'${String(v).replace(/'/g, "''")}'`;
}

// ---------- Parse ----------
const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
const casts = []; // { castNum, panels: [{ type, crate, panelId }] }
let current = null;

for (const row of rows) {
    if (isCastSectionRow(row)) {
        const num = extractCastNum((row[2] || '').replace(/\s+/g, ' ').trim());
        if (num) { current = { castNum: num, panels: [] }; casts.push(current); }
        else { current = null; }
        continue;
    }
    if (!current) continue;
    const type = cleanType(row[2]);
    const panelId = clean(row[3]);
    if (!type || !panelId) continue;
    current.panels.push({
        type,
        panelId,
        crate: clean(row[21])
    });
}

const importCasts = casts.filter(c => c.panels.length > 0);

// ---------- Build position rows + per-(cast,type) expected counts ----------
const stateRows = [];          // every panel: needed to drive position-match
const expectedCounts = [];     // (cast, type) -> expected count (for cross-check)
let totalCrated = 0;

for (const c of importCasts) {
    const counters = new Map();
    const typeCounts = new Map();
    for (const p of c.panels) {
        const next = (counters.get(p.type) || 0) + 1;
        counters.set(p.type, next);
        typeCounts.set(p.type, (typeCounts.get(p.type) || 0) + 1);
        if (p.crate) totalCrated++;
        stateRows.push({
            cast_num: c.castNum,
            type: p.type,
            position: next,
            crate: p.crate,
            panel_id: p.panelId
        });
    }
    for (const [type, count] of typeCounts) {
        expectedCounts.push({ cast_num: c.castNum, type, expected: count });
    }
}

// Distinct crate numbers seen in CSV (for the existence pre-check).
const csvCrates = [...new Set(stateRows.map(r => r.crate).filter(Boolean))].sort();

// ---------- Emit SQL ----------
const out = [];
out.push(`-- =====================================================================`);
out.push(`-- Reset crate # for project ${PROJECT}, casts 1A..11.`);
out.push(`--`);
out.push(`-- 1. Cross-check: per (cast, type), compare CSV-expected panel count`);
out.push(`--    against the current casting_components count. RAISE NOTICE on`);
out.push(`--    every mismatch. (1A/1B failed last run — this surfaces why.)`);
out.push(`-- 2. CLEAR every crate_id for these castings.`);
out.push(`-- 3. Re-apply crate_id by per-(casting, type) position match`);
out.push(`--    (ROW_NUMBER over sort_order) — same strategy as Phase 2 but`);
out.push(`--    scoped to the crate column only.`);
out.push(`-- 4. Report unmatched legacy rows (CSV had a crate # but no component`);
out.push(`--    received it) and final counts.`);
out.push(`--`);
out.push(`-- Re-runnable. Idempotent w.r.t. crate_id.`);
out.push(`-- =====================================================================`);
out.push(``);
out.push(`DO $$`);
out.push(`DECLARE`);
out.push(`    v_cleared int;`);
out.push(`    v_applied int;`);
out.push(`    v_unmatched int;`);
out.push(`    v_mismatch int;`);
out.push(`    rec RECORD;`);
out.push(`BEGIN`);
out.push(``);
out.push(`    -- ----- 1. Load CSV-expected per-(cast, type) counts -----`);
out.push(`    CREATE TEMP TABLE expected_counts (`);
out.push(`        cast_num text NOT NULL,`);
out.push(`        type text NOT NULL,`);
out.push(`        expected int NOT NULL`);
out.push(`    ) ON COMMIT DROP;`);
out.push(``);
out.push(`    INSERT INTO expected_counts (cast_num, type, expected) VALUES`);
{
    const lines = expectedCounts.map((r, idx) => {
        const tail = idx === expectedCounts.length - 1 ? ';' : ',';
        return `        (${sqlString(r.cast_num)}, ${sqlString(r.type)}, ${r.expected})${tail}`;
    });
    out.push(lines.join('\n'));
}
out.push(``);
out.push(`    -- ----- 2. Cross-check expected vs actual component counts -----`);
out.push(`    v_mismatch := 0;`);
out.push(`    FOR rec IN`);
out.push(`        WITH actual AS (`);
out.push(`            SELECT pc.casting_number AS cast_num, cc.type, COUNT(*) AS actual`);
out.push(`            FROM casting_components cc`);
out.push(`            JOIN project_castings pc ON pc.id = cc.casting_id`);
out.push(`            WHERE pc.project_number = '${PROJECT}'`);
out.push(`              AND pc.casting_number IN (${importCasts.map(c => sqlString(c.castNum)).join(', ')})`);
out.push(`            GROUP BY pc.casting_number, cc.type`);
out.push(`        )`);
out.push(`        SELECT`);
out.push(`            COALESCE(e.cast_num, a.cast_num) AS cast_num,`);
out.push(`            COALESCE(e.type, a.type) AS type,`);
out.push(`            COALESCE(e.expected, 0) AS expected,`);
out.push(`            COALESCE(a.actual, 0) AS actual`);
out.push(`        FROM expected_counts e`);
out.push(`        FULL OUTER JOIN actual a ON a.cast_num = e.cast_num AND a.type = e.type`);
out.push(`        WHERE COALESCE(e.expected, 0) <> COALESCE(a.actual, 0)`);
out.push(`        ORDER BY cast_num, type`);
out.push(`    LOOP`);
out.push(`        v_mismatch := v_mismatch + 1;`);
out.push(`        RAISE NOTICE 'MISMATCH cast=% type=% csv_expected=% db_actual=%',`);
out.push(`            rec.cast_num, rec.type, rec.expected, rec.actual;`);
out.push(`    END LOOP;`);
out.push(`    RAISE NOTICE 'Cross-check: % (cast,type) mismatches', v_mismatch;`);
out.push(``);
out.push(`    -- ----- 3. Verify CSV crate numbers exist in project_crates -----`);
out.push(`    FOR rec IN`);
out.push(`        SELECT c.crate_number`);
out.push(`        FROM (VALUES ${csvCrates.map(n => `(${sqlString(n)})`).join(', ')}) AS c(crate_number)`);
out.push(`        WHERE NOT EXISTS (`);
out.push(`            SELECT 1 FROM project_crates pcr`);
out.push(`            WHERE pcr.project_number = '${PROJECT}' AND pcr.crate_number = c.crate_number`);
out.push(`        )`);
out.push(`    LOOP`);
out.push(`        RAISE WARNING 'Project ${PROJECT} has no crate number % — panels with this crate will end up NULL', rec.crate_number;`);
out.push(`    END LOOP;`);
out.push(``);
out.push(`    -- ----- 4. CLEAR all crate_id for these castings -----`);
out.push(`    UPDATE casting_components cc`);
out.push(`    SET crate_id = NULL`);
out.push(`    FROM project_castings pc`);
out.push(`    WHERE cc.casting_id = pc.id`);
out.push(`      AND pc.project_number = '${PROJECT}'`);
out.push(`      AND pc.casting_number IN (${importCasts.map(c => sqlString(c.castNum)).join(', ')});`);
out.push(`    GET DIAGNOSTICS v_cleared = ROW_COUNT;`);
out.push(`    RAISE NOTICE 'Cleared crate_id on % components', v_cleared;`);
out.push(``);
out.push(`    -- ----- 5. Build legacy crate map (only panels that had a crate # in CSV) -----`);
out.push(`    CREATE TEMP TABLE legacy_crate (`);
out.push(`        cast_num text NOT NULL,`);
out.push(`        type text NOT NULL,`);
out.push(`        position int NOT NULL,`);
out.push(`        crate_number text NOT NULL,`);
out.push(`        legacy_panel_id text`);
out.push(`    ) ON COMMIT DROP;`);
out.push(``);
out.push(`    INSERT INTO legacy_crate (cast_num, type, position, crate_number, legacy_panel_id) VALUES`);
{
    const crated = stateRows.filter(r => r.crate);
    const lines = crated.map((r, idx) => {
        const tail = idx === crated.length - 1 ? ';' : ',';
        return `        (${sqlString(r.cast_num)}, ${sqlString(r.type)}, ${r.position}, ${sqlString(r.crate)}, ${sqlString(r.panel_id)})${tail}`;
    });
    out.push(lines.join('\n'));
}
out.push(``);
out.push(`    -- ----- 6. Apply crate_id via per-(casting, type) position match -----`);
out.push(`    WITH ranked AS (`);
out.push(`        SELECT`);
out.push(`            cc.id,`);
out.push(`            cc.casting_id,`);
out.push(`            cc.type,`);
out.push(`            ROW_NUMBER() OVER (PARTITION BY cc.casting_id, cc.type ORDER BY cc.sort_order ASC) AS pos`);
out.push(`        FROM casting_components cc`);
out.push(`        JOIN project_castings pc ON pc.id = cc.casting_id`);
out.push(`        WHERE pc.project_number = '${PROJECT}'`);
out.push(`          AND pc.casting_number IN (${importCasts.map(c => sqlString(c.castNum)).join(', ')})`);
out.push(`    )`);
out.push(`    UPDATE casting_components cc`);
out.push(`    SET crate_id = (`);
out.push(`        SELECT pcr.id FROM project_crates pcr`);
out.push(`        WHERE pcr.project_number = '${PROJECT}'`);
out.push(`          AND pcr.crate_number = lc.crate_number`);
out.push(`        LIMIT 1`);
out.push(`    )`);
out.push(`    FROM legacy_crate lc`);
out.push(`    JOIN project_castings pc`);
out.push(`        ON pc.project_number = '${PROJECT}'`);
out.push(`       AND pc.casting_number = lc.cast_num`);
out.push(`    JOIN ranked r`);
out.push(`        ON r.casting_id = pc.id`);
out.push(`       AND r.type = lc.type`);
out.push(`       AND r.pos = lc.position`);
out.push(`    WHERE cc.id = r.id;`);
out.push(`    GET DIAGNOSTICS v_applied = ROW_COUNT;`);
out.push(`    RAISE NOTICE 'Applied crate_id to % components (% legacy rows had a crate)', v_applied, ${stateRows.filter(r => r.crate).length};`);
out.push(``);
out.push(`    -- ----- 7. Report unmatched legacy rows (CSV had crate but no component matched) -----`);
out.push(`    v_unmatched := 0;`);
out.push(`    FOR rec IN`);
out.push(`        WITH ranked AS (`);
out.push(`            SELECT cc.id, cc.casting_id, cc.type,`);
out.push(`                ROW_NUMBER() OVER (PARTITION BY cc.casting_id, cc.type ORDER BY cc.sort_order ASC) AS pos`);
out.push(`            FROM casting_components cc`);
out.push(`            JOIN project_castings pc ON pc.id = cc.casting_id`);
out.push(`            WHERE pc.project_number = '${PROJECT}'`);
out.push(`              AND pc.casting_number IN (${importCasts.map(c => sqlString(c.castNum)).join(', ')})`);
out.push(`        )`);
out.push(`        SELECT lc.cast_num, lc.type, lc.position, lc.crate_number, lc.legacy_panel_id`);
out.push(`        FROM legacy_crate lc`);
out.push(`        LEFT JOIN project_castings pc`);
out.push(`            ON pc.project_number = '${PROJECT}' AND pc.casting_number = lc.cast_num`);
out.push(`        LEFT JOIN ranked rk`);
out.push(`            ON rk.casting_id = pc.id AND rk.type = lc.type AND rk.pos = lc.position`);
out.push(`        WHERE rk.id IS NULL`);
out.push(`        ORDER BY lc.cast_num, lc.type, lc.position`);
out.push(`    LOOP`);
out.push(`        v_unmatched := v_unmatched + 1;`);
out.push(`        RAISE NOTICE 'UNMATCHED cast=% type=% pos=% crate=% legacy_panel=%',`);
out.push(`            rec.cast_num, rec.type, rec.position, rec.crate_number, rec.legacy_panel_id;`);
out.push(`    END LOOP;`);
out.push(`    RAISE NOTICE 'Unmatched legacy crate rows: %', v_unmatched;`);
out.push(``);
out.push(`END $$;`);
out.push(``);

process.stdout.write(out.join('\n'));

// ---------- Summary on stderr ----------
process.stderr.write(`\nReset crates — summary:\n`);
process.stderr.write(`  Casts: ${importCasts.map(c => c.castNum).join(', ')}\n`);
process.stderr.write(`  Total panels: ${stateRows.length}\n`);
process.stderr.write(`  Panels with crate # in CSV: ${totalCrated}\n`);
process.stderr.write(`  Distinct CSV crates: ${csvCrates.join(', ')}\n`);
process.stderr.write(`  Per-cast crate counts:\n`);
for (const c of importCasts) {
    const crated = c.panels.filter(p => p.crate).length;
    process.stderr.write(`    Cast ${c.castNum}: ${crated} crated / ${c.panels.length} total\n`);
}
