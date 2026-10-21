/**
 * Casting inventory readouts on the weekly cards (2026-10-21): the summary line
 * ("5 types · 142 pcs · 27.52 cu ft · 300.89 ff sq ft") and the pieces per type.
 * Shared by the board card, the project modal card and the print layout.
 */

/** Breakdowns longer than this start collapsed on screen (and are cut on paper). */
export const INV_TYPES_COLLAPSE_AT = 5;

/** "5 types · 142 pcs · 27.52 cu ft · 300.89 ff sq ft" (incomplete totals get a ⚠). */
export function invSummaryLine(inv) {
    if (!inv) return '';
    const warn = (ok) => ok ? '' : ' \u26A0';
    return `${inv.types} ${inv.types === 1 ? 'type' : 'types'} · ${inv.pcs} pcs · ${inv.cuFt} cu ft${warn(inv.cuFtComplete)} · ${inv.ff} ff sq ft${warn(inv.ffComplete)}`;
}

/** Tooltip for an incomplete total. */
export function invSummaryTitle(inv) {
    if (!inv) return '';
    const parts = [];
    if (!inv.cuFtComplete) parts.push('some inventory rows have no cu ft');
    if (!inv.ffComplete) parts.push('some inventory rows have no ff sq ft');
    return parts.length ? parts.join(' · ') + ' — these totals are incomplete' : 'From the portal\'s Casting Inventory (pieces = qty + extras)';
}

/** Wording of the batch-print warning band, or '' when there is nothing to say. */
export function batchPrintText(state) {
    if (state === 'unprinted') return 'BATCH TICKETS NOT PRINTED YET';
    if (state === 'reprint') return 'BATCH TICKETS CHANGED — PRINT AGAIN';
    return '';
}
