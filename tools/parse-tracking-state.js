/**
 * Phase 2 importer: applies produced + crate_id to the auto-generated
 * casting_components for project 0383 casts 1A-11.
 *
 * Match strategy: the tracking sync builds components in inventory sort
 * order, so the Nth panel of a given type within a cast (in CSV row order)
 * corresponds to the Nth casting_components row for (casting_id, type)
 * sorted by sort_order. We use ROW_NUMBER() OVER that partition to look
 * up each component without depending on panel_id padding.
 *
 * Rules (per earlier user direction):
 *   - All non-rejected panels  → produced = TRUE
 *   - Rejected panels          → produced = FALSE (acts as remake flag)
 *   - crate_id from CSV crate # column (NULL when blank)
 *
 * Run: node tools/parse-tracking-state.js > migration/import-state-casts-1a-11-project-0383.sql
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
function isTruthyFlag(v) {
    return String(v || '').trim().toUpperCase() === 'TRUE';
}
function sqlString(v) {
    if (v === null || v === undefined) return 'NULL';
    return `'${String(v).replace(/'/g, "''")}'`;
}

// ---------- Parse ----------
const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
const casts = []; // { castNum, panels: [{ type, rejected, crate }] }
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
        rejected: isTruthyFlag(row[0]),
        crate: clean(row[21])
    });
}

const importCasts = casts.filter(c => c.panels.length > 0);

// ---------- Build legacy_state rows: (cast_num, type, position, produced, crate) ----------
// Position is 1-based: Nth panel of (cast, type) in CSV row order — matches the
// auto-generated component's ROW_NUMBER() over (casting_id, type) by sort_order.
const stateRows = [];
let producedCount = 0, rejectedCount = 0, withCrateCount = 0;
for (const c of importCasts) {
    const counters = new Map();
    for (const p of c.panels) {
        const next = (counters.get(p.type) || 0) + 1;
        counters.set(p.type, next);
        const produced = !p.rejected;
        if (produced) producedCount++; else rejectedCount++;
        if (p.crate) withCrateCount++;
        stateRows.push({
            cast_num: c.castNum,
            type: p.type,
            position: next,
            produced,
            crate: p.crate
        });
    }
}

// ---------- Emit SQL ----------
const out = [];
out.push(`-- =====================================================================`);
out.push(`-- Phase 2: apply produced + crate_id to the auto-generated`);
out.push(`-- casting_components for project ${PROJECT} casts 1A-11.`);
out.push(`--`);
out.push(`-- Match by ROW_NUMBER() OVER (PARTITION BY casting_id, type ORDER BY`);
out.push(`-- sort_order) — the Nth legacy panel of a given type maps to the Nth`);
out.push(`-- auto-generated component for that (casting, type), regardless of`);
out.push(`-- panel_id padding.`);
out.push(`--`);
out.push(`-- Rules:`);
out.push(`--   * non-rejected legacy panel  -> produced = TRUE`);
out.push(`--   * rejected legacy panel      -> produced = FALSE (remake flag)`);
out.push(`--   * crate_id from CSV crate #  (NULL when blank)`);
out.push(`--`);
out.push(`-- Re-runnable. Caveat: any later inventory edit triggers a tracking`);
out.push(`-- resync that wipes + recreates components, losing produced/crate.`);
out.push(`-- Re-run this script after such edits if needed.`);
out.push(`-- =====================================================================`);
out.push(``);
out.push(`DO $$`);
out.push(`DECLARE`);
out.push(`    v_updated int;`);
out.push(`BEGIN`);
out.push(``);
out.push(`    -- One-shot temp table of legacy state, keyed by (cast_num, type, position).`);
out.push(`    CREATE TEMP TABLE legacy_state (`);
out.push(`        cast_num text NOT NULL,`);
out.push(`        type text NOT NULL,`);
out.push(`        position int NOT NULL,`);
out.push(`        produced boolean NOT NULL,`);
out.push(`        crate_number text`);
out.push(`    ) ON COMMIT DROP;`);
out.push(``);
out.push(`    INSERT INTO legacy_state (cast_num, type, position, produced, crate_number) VALUES`);
const valueLines = stateRows.map((r, idx) => {
    const tail = idx === stateRows.length - 1 ? ';' : ',';
    return `        (${sqlString(r.cast_num)}, ${sqlString(r.type)}, ${r.position}, ${r.produced ? 'TRUE' : 'FALSE'}, ${sqlString(r.crate)})${tail}`;
});
out.push(valueLines.join('\n'));

out.push(``);
out.push(`    -- Resolve component positions for the imported casts and apply state.`);
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
out.push(`    SET produced = ls.produced,`);
out.push(`        crate_id = CASE`);
out.push(`            WHEN ls.crate_number IS NULL THEN NULL`);
out.push(`            ELSE (SELECT id FROM project_crates`);
out.push(`                  WHERE project_number = '${PROJECT}'`);
out.push(`                    AND crate_number = ls.crate_number`);
out.push(`                  LIMIT 1)`);
out.push(`        END`);
out.push(`    FROM legacy_state ls`);
out.push(`    JOIN project_castings pc`);
out.push(`        ON pc.project_number = '${PROJECT}'`);
out.push(`       AND pc.casting_number = ls.cast_num`);
out.push(`    JOIN ranked r`);
out.push(`        ON r.casting_id = pc.id`);
out.push(`       AND r.type = ls.type`);
out.push(`       AND r.pos = ls.position`);
out.push(`    WHERE cc.id = r.id;`);
out.push(``);
out.push(`    GET DIAGNOSTICS v_updated = ROW_COUNT;`);
out.push(`    RAISE NOTICE 'Updated % components (% produced, % rejected, % crated in CSV)', v_updated, ${producedCount}, ${rejectedCount}, ${withCrateCount};`);
out.push(``);
out.push(`END $$;`);
out.push(``);

process.stdout.write(out.join('\n'));

// ---------- Summary on stderr ----------
process.stderr.write(`\nPhase 2 — state apply:\n`);
process.stderr.write(`  Total legacy panels: ${stateRows.length}\n`);
process.stderr.write(`  Produced (non-rejected): ${producedCount}\n`);
process.stderr.write(`  Rejected → produced=FALSE: ${rejectedCount}\n`);
process.stderr.write(`  With CSV crate #: ${withCrateCount}\n`);
