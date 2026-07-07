/**
 * One-shot importer: parses the legacy "7 Fairfield Full Scope - Tracking
 * Sheets.csv" and emits SQL to populate casting_components for project 0383,
 * casts 1A, 1B, 2..11. Also creates project_crates rows for any crate # seen
 * in the CSV and copies all "Rejected = TRUE" panels into Cast 12 with
 * produced = false (a remake queue).
 *
 * Run: node tools/parse-tracking-import.js > migration/import-casts-1a-11-project-0383.sql
 */

const fs = require('node:fs');
const path = require('node:path');

const CSV_PATH = 'C:\\Users\\mdasilva\\Downloads\\7 Fairfield Full Scope - Tracking Sheets.csv';
const PROJECT = '0383';
const REMAKE_CAST = '12';

// ---------- CSV parser (state machine — handles quoted multi-line fields) ----------
function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else { inQuotes = false; }
            } else {
                field += ch;
            }
        } else {
            if (ch === '"') inQuotes = true;
            else if (ch === ',') { row.push(field); field = ''; }
            else if (ch === '\n' || ch === '\r') {
                if (ch === '\r' && text[i + 1] === '\n') i++;
                row.push(field); field = '';
                rows.push(row); row = [];
            } else {
                field += ch;
            }
        }
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    return rows;
}

// ---------- Cleanup helpers ----------
function clean(s) {
    if (s === undefined || s === null) return null;
    const t = String(s).replace(/\s+/g, ' ').trim();
    return t === '' ? null : t;
}
function cleanType(s) {
    let t = clean(s);
    if (!t) return null;
    // "PANEL 125-C" -> "125-C", but keep "TRIM T1" as-is
    t = t.replace(/^PANEL\s+/i, '');
    return t || null;
}
function isCastSectionRow(row) {
    // Header rows have non-empty cell #2 (label) and cell #3 contains "Pieces"
    const label = (row[2] || '').replace(/\s+/g, ' ').trim();
    const pieces = (row[3] || '').replace(/\s+/g, ' ').trim();
    if (!label || !pieces) return false;
    return /\bPieces?\b/i.test(pieces);
}
function extractCastNum(label) {
    // "(CAST 1A)" -> "1A", "(CAST 11)" -> "11", "MOCKUP #2 CAST #1" -> null (skip)
    const m = label.match(/^\(\s*CAST\s+([0-9]+[A-Z]?)\s*\)$/i);
    return m ? m[1].toUpperCase() : null;
}
function isTruthyFlag(v) {
    return String(v || '').trim().toUpperCase() === 'TRUE';
}

// ---------- Parse ----------
const text = fs.readFileSync(CSV_PATH, 'utf8');
const rows = parseCsv(text);

const casts = []; // { castNum, components: [{ rejected, type, panel_id, color, sealer, crate }] }
let current = null;

for (const row of rows) {
    if (isCastSectionRow(row)) {
        const label = (row[2] || '').replace(/\s+/g, ' ').trim();
        const num = extractCastNum(label);
        if (num) {
            current = { castNum: num, components: [] };
            casts.push(current);
        } else {
            current = null; // mockup section — skip its rows
        }
        continue;
    }
    if (!current) continue;
    // Skip empty / spacer rows
    const type = cleanType(row[2]);
    const panelId = clean(row[3]);
    if (!type && !panelId) continue;
    if (!panelId) continue; // need a panel id to import
    current.components.push({
        rejected: isTruthyFlag(row[0]),
        type: type,
        panel_id: panelId,
        color: clean(row[5]),
        sealer: clean(row[6]),
        crate: clean(row[21])
    });
}

// ---------- Build remake list (Cast 12) ----------
const remakes = [];
for (const c of casts) {
    for (const comp of c.components) {
        if (comp.rejected) {
            remakes.push({
                ...comp,
                source_cast: c.castNum,
                crate: null,        // remakes have no crate yet
                rejected: false     // re-imported panel isn't itself rejected
            });
        }
    }
}

// ---------- Unique crate set ----------
const crateSet = new Set();
for (const c of casts) for (const comp of c.components) if (comp.crate) crateSet.add(comp.crate);
const crateList = [...crateSet].sort((a, b) => {
    const na = parseInt(a, 10), nb = parseInt(b, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return String(a).localeCompare(String(b));
});

// ---------- Emit SQL ----------
function sqlString(v) {
    if (v === null || v === undefined) return 'NULL';
    return `'${String(v).replace(/'/g, "''")}'`;
}

const allDestCasts = [...new Set([...casts.map(c => c.castNum), REMAKE_CAST])];

const out = [];
out.push(`-- =====================================================================`);
out.push(`-- Import legacy tracking sheet into project ${PROJECT}.`);
out.push(`-- Source: 7 Fairfield Full Scope - Tracking Sheets.csv`);
out.push(`--`);
out.push(`-- Imports casts ${casts.map(c => c.castNum).join(', ')} into casting_components.`);
out.push(`-- Mockup sections (MOCKUP, MOCKUP #2 / CAST #1, CAST #2) are skipped.`);
out.push(`-- All imported panels get produced = TRUE (legacy log treated as done).`);
out.push(`-- Any panel marked Rejected = TRUE is also copied into Cast ${REMAKE_CAST} with`);
out.push(`-- produced = FALSE (a remake queue).`);
out.push(`--`);
out.push(`-- Crate numbers found in the CSV are written to project_crates`);
out.push(`-- (ON CONFLICT DO NOTHING so existing crates are preserved) and components`);
out.push(`-- are linked via crate_id.`);
out.push(`--`);
out.push(`-- Existing casting_components for the touched castings are wiped first so`);
out.push(`-- this script is safe to re-run.`);
out.push(`-- =====================================================================`);
out.push(``);
out.push(`DO $$`);
out.push(`DECLARE`);
for (const num of allDestCasts) out.push(`    v_cast_${num.toLowerCase()} uuid;`);
out.push(`    v_count int;`);
out.push(`BEGIN`);
out.push(`    -- ----- Resolve casting ids (fail fast on missing / ambiguous) -----`);
for (const num of allDestCasts) {
    out.push(``);
    out.push(`    SELECT count(*) INTO v_count FROM project_castings`);
    out.push(`        WHERE project_number = '${PROJECT}' AND casting_number = '${num}';`);
    out.push(`    IF v_count = 0 THEN`);
    out.push(`        RAISE EXCEPTION 'No casting % found for project ${PROJECT}', '${num}';`);
    out.push(`    ELSIF v_count > 1 THEN`);
    out.push(`        RAISE EXCEPTION 'Multiple casting % rows for project ${PROJECT} (% rows). Specify phase_id.', '${num}', v_count;`);
    out.push(`    END IF;`);
    out.push(`    SELECT id INTO v_cast_${num.toLowerCase()} FROM project_castings`);
    out.push(`        WHERE project_number = '${PROJECT}' AND casting_number = '${num}';`);
}
out.push(``);
out.push(`    -- ----- Wipe existing components for all destination castings -----`);
const allVars = allDestCasts.map(n => `v_cast_${n.toLowerCase()}`).join(', ');
out.push(`    DELETE FROM casting_components WHERE casting_id IN (${allVars});`);

out.push(``);
out.push(`    -- ----- Upsert crates (skip if already exist) -----`);
let crateOrder = 0;
for (const cn of crateList) {
    out.push(`    INSERT INTO project_crates (project_number, crate_number, sort_order)`);
    out.push(`        SELECT '${PROJECT}', ${sqlString(cn)}, ${crateOrder++}`);
    out.push(`        WHERE NOT EXISTS (SELECT 1 FROM project_crates WHERE project_number = '${PROJECT}' AND crate_number = ${sqlString(cn)});`);
}

out.push(``);
out.push(`    -- ----- Insert components per cast -----`);
for (const c of casts) {
    out.push(``);
    out.push(`    -- Cast ${c.castNum} (${c.components.length} panels)`);
    if (c.components.length === 0) continue;
    out.push(`    INSERT INTO casting_components`);
    out.push(`        (casting_id, type, panel_id, color, sealer, sort_order, produced, crate_id)`);
    out.push(`    VALUES`);
    const lines = c.components.map((comp, idx) => {
        const crateExpr = comp.crate
            ? `(SELECT id FROM project_crates WHERE project_number = '${PROJECT}' AND crate_number = ${sqlString(comp.crate)} LIMIT 1)`
            : `NULL`;
        return `        (v_cast_${c.castNum.toLowerCase()}, ${sqlString(comp.type)}, ${sqlString(comp.panel_id)}, ${sqlString(comp.color)}, ${sqlString(comp.sealer)}, ${idx}, TRUE, ${crateExpr})`;
    });
    out.push(lines.join(',\n') + ';');
}

out.push(``);
out.push(`    -- ----- Remake queue: rejected panels copied to Cast ${REMAKE_CAST} with produced = FALSE -----`);
if (remakes.length === 0) {
    out.push(`    -- (no rejected panels found)`);
} else {
    out.push(`    INSERT INTO casting_components`);
    out.push(`        (casting_id, type, panel_id, color, sealer, sort_order, produced, crate_id)`);
    out.push(`    VALUES`);
    const lines = remakes.map((r, idx) => {
        const tail = idx === remakes.length - 1 ? ';' : ',';
        return `        (v_cast_${REMAKE_CAST.toLowerCase()}, ${sqlString(r.type)}, ${sqlString(r.panel_id)}, ${sqlString(r.color)}, ${sqlString(r.sealer)}, ${idx}, FALSE, NULL)${tail}  -- from cast ${r.source_cast}`;
    });
    out.push(lines.join('\n'));
}

out.push(``);
const totalImported = casts.reduce((sum, c) => sum + c.components.length, 0);
out.push(`    RAISE NOTICE 'Imported % components across % casts (+ % remakes into Cast ${REMAKE_CAST})', ${totalImported}, ${casts.length}, ${remakes.length};`);
out.push(`END $$;`);
out.push(``);

process.stdout.write(out.join('\n'));

// ---------- Summary on stderr ----------
process.stderr.write(`\nParsed ${casts.length} casts:\n`);
for (const c of casts) {
    const rej = c.components.filter(x => x.rejected).length;
    process.stderr.write(`  Cast ${c.castNum}: ${c.components.length} panels (${rej} rejected)\n`);
}
process.stderr.write(`Total: ${casts.reduce((s, c) => s + c.components.length, 0)} components\n`);
process.stderr.write(`Remakes -> Cast ${REMAKE_CAST}: ${remakes.length}\n`);
process.stderr.write(`Unique crates: ${crateList.length} (${crateList.join(', ')})\n`);
