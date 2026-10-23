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
/** Message for a casting-linked card whose casting has no inventory pieces ('' when there is nothing to say). */
export function invMissingText(task) {
    if (!task || String(task.projectNumber || '').trim() === '' || String(task.castingNumber || '').trim() === '') return '';
    if (task.invSummary && task.invSummary.pcs > 0) return '';
    if (typeof task.piecesCount === 'number' && task.piecesCount > 0) return '';
    if (task.castingInPortal === undefined) return '';          // portal data did not load: say nothing rather than something wrong
    return task.castingInPortal ? 'NO CASTING INVENTORY YET' : 'CAST NOT FOUND IN THE PORTAL';
}

/** "SPECIAL CONDITION — SIDE A: vertical curing racks" for a Cast card whose casting has one ('' otherwise). */
export function layoutConditionText(task) {
    const c = task && task.layoutCondition;
    if (!c || !c.name) return '';
    return `SPECIAL CONDITION${c.side ? ' \u2014 SIDE ' + (c.side === 'AB' ? 'A + B' : c.side) : ''}: ${c.name}`;
}

/** 'Side A' / 'Side B' / 'Side A + B' for a stored casting side ('' otherwise). */
export function castingSideText(side) {
    if (side === 'A' || side === 'B') return `Side ${side}`;
    if (side === 'AB') return 'Side A + B';
    return '';
}

export function batchPrintText(state) {
    if (state === 'unprinted') return 'BATCH TICKETS NOT PRINTED YET';
    if (state === 'reprint') return 'BATCH TICKETS CHANGED — PRINT AGAIN';
    return '';
}
