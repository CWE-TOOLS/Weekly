/**
 * Phase 1 importer: parses the legacy "7 Fairfield Full Scope - Tracking
 * Sheets.csv" and emits SQL to populate casting_inventory for project 0383
 * casts 1A, 1B, 2..11 (mockups skipped). Aggregates panels by
 * (type, color, sealer) per cast and emits a quantity. Width/length are
 * left NULL — fill from the UI.
 *
 * Tracking auto-sync rebuilds casting_components from this inventory, so
 * a separate phase 2 script will apply produced/crate state by per-type
 * sequential position.
 *
 * Run: node tools/parse-tracking-inventory.js > migration/import-inventory-casts-1a-11-project-0383.sql
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
const casts = []; // { castNum, panels: [{ type, color, sealer }] }
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
        color: clean(row[5]),
        sealer: clean(row[6])
    });
}

// Drop empty Cast 12 (has no panels in CSV — phase 2 may add remakes there separately)
const importCasts = casts.filter(c => c.panels.length > 0);

// ---------- Aggregate per (cast, type, color, sealer) ----------
// Preserve insertion order so sort_order matches CSV row order within a cast.
function aggregate(cast) {
    const map = new Map(); // key -> { type, color, sealer, quantity, sort_order }
    let order = 0;
    for (const p of cast.panels) {
        const key = `${p.type}||${p.color || ''}||${p.sealer || ''}`;
        if (!map.has(key)) {
            map.set(key, { type: p.type, color: p.color, sealer: p.sealer, quantity: 0, sort_order: order++ });
        }
        map.get(key).quantity++;
    }
    return [...map.values()];
}

// ---------- Emit SQL ----------
const out = [];
out.push(`-- =====================================================================`);
out.push(`-- Phase 1: import legacy tracking sheet → casting_inventory.`);
out.push(`-- Project ${PROJECT}, casts ${importCasts.map(c => c.castNum).join(', ')}.`);
out.push(`-- Mockups + empty Cast 12 skipped.`);
out.push(`--`);
out.push(`-- Each row aggregates CSV panels by (type, color, sealer) per cast.`);
out.push(`-- width/length left NULL — fill from the Castings tab.`);
out.push(`--`);
out.push(`-- The Tracking tab's auto-sync will regenerate casting_components from`);
out.push(`-- this inventory. A separate phase 2 script applies produced + crate_id.`);
out.push(`--`);
out.push(`-- Re-runnable: wipes existing casting_inventory for the touched castings.`);
out.push(`-- =====================================================================`);
out.push(``);
out.push(`DO $$`);
out.push(`DECLARE`);
for (const c of importCasts) out.push(`    v_cast_${c.castNum.toLowerCase()} uuid;`);
out.push(`    v_count int;`);
out.push(`BEGIN`);

// Resolve casting ids
for (const c of importCasts) {
    out.push(``);
    out.push(`    SELECT count(*) INTO v_count FROM project_castings`);
    out.push(`        WHERE project_number = '${PROJECT}' AND casting_number = '${c.castNum}';`);
    out.push(`    IF v_count = 0 THEN`);
    out.push(`        RAISE EXCEPTION 'No casting % found for project ${PROJECT}', '${c.castNum}';`);
    out.push(`    ELSIF v_count > 1 THEN`);
    out.push(`        RAISE EXCEPTION 'Multiple casting % rows for project ${PROJECT} (% rows). Specify phase_id.', '${c.castNum}', v_count;`);
    out.push(`    END IF;`);
    out.push(`    SELECT id INTO v_cast_${c.castNum.toLowerCase()} FROM project_castings`);
    out.push(`        WHERE project_number = '${PROJECT}' AND casting_number = '${c.castNum}';`);
}

// Wipe existing inventory
out.push(``);
out.push(`    -- ----- Wipe existing inventory for these castings -----`);
const allVars = importCasts.map(c => `v_cast_${c.castNum.toLowerCase()}`).join(', ');
out.push(`    DELETE FROM casting_inventory WHERE casting_id IN (${allVars});`);

// Per-cast inserts
let totalRows = 0, totalQty = 0;
for (const c of importCasts) {
    const agg = aggregate(c);
    if (agg.length === 0) continue;
    const castQty = agg.reduce((s, r) => s + r.quantity, 0);
    totalRows += agg.length;
    totalQty += castQty;
    out.push(``);
    out.push(`    -- Cast ${c.castNum}: ${agg.length} type rows, ${castQty} panels`);
    out.push(`    INSERT INTO casting_inventory`);
    out.push(`        (casting_id, type, width, length, color, sealer, quantity, extras, sort_order)`);
    out.push(`    VALUES`);
    const lines = agg.map((r, idx) => {
        const tail = idx === agg.length - 1 ? ';' : ',';
        return `        (v_cast_${c.castNum.toLowerCase()}, ${sqlString(r.type)}, NULL, NULL, ${sqlString(r.color)}, ${sqlString(r.sealer)}, ${r.quantity}, 0, ${r.sort_order})${tail}`;
    });
    out.push(lines.join('\n'));
}

out.push(``);
out.push(`    RAISE NOTICE 'Imported % inventory rows (% panels) across % casts', ${totalRows}, ${totalQty}, ${importCasts.length};`);
out.push(`END $$;`);
out.push(``);

process.stdout.write(out.join('\n'));

// ---------- Summary on stderr ----------
process.stderr.write(`\nPhase 1 — casting_inventory:\n`);
for (const c of importCasts) {
    const agg = aggregate(c);
    const qty = agg.reduce((s, r) => s + r.quantity, 0);
    process.stderr.write(`  Cast ${c.castNum}: ${agg.length} type rows, ${qty} panels\n`);
}
process.stderr.write(`Total: ${totalRows} rows / ${totalQty} panels\n`);
