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
