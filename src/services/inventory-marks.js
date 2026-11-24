/**
 * Casting Inventory fingerprints for printed milestones (2026-10-30; the pure part of the Project Portal's
 * "printed before the inventory was final" bookkeeping, shared with the weekly's week print).
 *
 * A print made while the Casting Inventory is not final is stamped ORANGE with a hidden marker
 * "[inv:b=<hash>-<rows>;bc=<colour hash>-<n>]" on its milestone row. When engineering presses
 * "Casting Inventory ready", a print whose fields are still as printed turns green; one whose fields moved stays
 * orange. The portal computes the same marks from the same inventory rows.
 *
 * @module services/inventory-marks
 */

export const INV_MARK_RE = /\s*\[inv:([^\]]+)\]$/;
export const EARLY_PRINT_NOTE = 'Printed before Casting Inventory was final';
export const INV_PRINT_FIELDS = {
    'Batching Sheets': ['cu_ft', 'ff_sq_ft', 'color_log_id', 'quantity', 'extras'],
    'Labels':          ['type', 'width', 'length', 'quantity', 'extras'],
    'Final Tracking':  ['type', 'width', 'length', 'quantity', 'extras'],
    'Casting Layout':  ['type', 'width', 'length', 'quantity', 'extras'],
    'Jig List':        ['type', 'width', 'length']
};
export const INV_MARK_KEYS = { 'Batching Sheets': 'b', 'Labels': 'l', 'Final Tracking': 't', 'Casting Layout': 'c', 'Jig List': 'j' };

export function invHash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36); }

/** Fingerprint of the inventory as one print sees it: the sorted set of its rows' relevant fields (row order ignored, rows added/removed counted). */
export function invFingerprintRows(rows, milestone) {
    const fields = INV_PRINT_FIELDS[milestone] || [];
    const list = (rows || []).map(it => fields.map(k => (it[k] === null || it[k] === undefined ? '' : String(it[k]))).join('|'));
    list.sort();
    return invHash(list.join('\n')) + '-' + list.length;
}

/** The colour logs the inventory uses (rows with pieces), order ignored — stored as bc=… so a colour change is always a reprint. */
export function invColourFingerprintRows(rows) {
    const ids = [...new Set((rows || []).filter(r => ((Number(r.quantity) || 0) + (Number(r.extras) || 0)) > 0).map(r => String(r.color_log_id || '')))].sort();
    return invHash(ids.join('|')) + '-' + ids.length;
}

/** Marker body for one early print: its own fingerprint, plus the colour set for the batch tickets. */
export function invEarlyMarksRows(rows, milestone) {
    let m = (INV_MARK_KEYS[milestone] || 'x') + '=' + invFingerprintRows(rows, milestone);
    if (milestone === 'Batching Sheets') m += ';bc=' + invColourFingerprintRows(rows);
    return m;
}

export function withInvMark(note, marks) { return `${note || ''} [inv:${marks}]`; }

/** Colour per type as the Final Tracking sheet shows it (2026-11-24): the set of type + color log pairs, order ignored. */
export function invTypeColourFingerprintRows(rows) {
    const list = [...new Set((rows || []).map(r => String(r.type || '').trim() + '|' + String(r.color_log_id || '')))].sort();
    return invHash(list.join('\n')) + '-' + list.length;
}

/** A marker note with some of its values replaced, added or dropped (null): the new note, or null when nothing
 *  changes or the note carries no marker. */
export function markerWith(note, parts) {
    const m = String(note || '').match(INV_MARK_RE);
    if (!m) return null;
    const list = m[1].split(';').filter(Boolean).map(x => { const i = x.indexOf('='); return i < 0 ? [x, ''] : [x.slice(0, i), x.slice(i + 1)]; });
    let changed = false;
    for (const [k, v] of Object.entries(parts || {})) {
        const i = list.findIndex(x => x[0] === k);
        if (v === null || v === undefined) { if (i >= 0) { list.splice(i, 1); changed = true; } }
        else if (i < 0) { list.push([k, v]); changed = true; }
        else if (list[i][1] !== v) { list[i][1] = v; changed = true; }
    }
    return changed ? withInvMark(String(note).replace(INV_MARK_RE, ''), list.map(x => x.join('=')).join(';')) : null;
}

/**
 * A print made from a FINAL inventory (2026-11-24). The Casting Inventory row's marker holds, per print, the inventory
 * that print was made from. This print now reflects the inventory as it is: its mark becomes the current fingerprint.
 * Returns the row's new note, or null when the mark is already right (the usual case: nothing changed since).
 * Batch tickets also carry the colour set (bc); an older lock judges Final Tracking by that same value, so it is kept
 * apart as fc before it moves. Final Tracking carries the colour per type (tc).
 */
export function printRebase(note, rows, milestone) {
    const key = INV_MARK_KEYS[milestone];
    const m = String(note || '').match(INV_MARK_RE);
    if (!key || !m) return null;
    const get = (k) => { const x = m[1].split(';').find(y => y.startsWith(k + '=')); return x ? x.slice(k.length + 1) : ''; };
    const parts = { [key]: invFingerprintRows(rows, milestone) };
    if (milestone === 'Batching Sheets') {
        const bc = invColourFingerprintRows(rows);
        if (!get('tc') && !get('fc') && get('bc') && get('bc') !== bc) parts.fc = get('bc');
        parts.bc = bc;
    }
    if (milestone === 'Final Tracking') { parts.tc = invTypeColourFingerprintRows(rows); parts.fc = null; }
    return markerWith(note, parts);
}
