/**
 * Casting inventory readouts on the weekly cards (2026-10-21): the summary line
 * ("5 types · 142 pcs · 27.52 cu ft · 300.89 ff sq ft") and the pieces per type.
 * Shared by the board card, the project modal card and the print layout.
 */

/** Breakdowns longer than this start collapsed on screen (and are cut on paper). */
export const INV_TYPES_COLLAPSE_AT = 5;

/** "5 types · 142 pcs · 27.52 cu ft · 300.89 ff sq ft" (incomplete totals get a ⚠). */
/** "DAY 2 OF 2", or "DAYS 2-3 OF 3" when one Demold day carries several cast days. */
function dayWords(day) { return day.to > day.n ? `DAYS ${day.n}-${day.to} OF ${day.of}` : `DAY ${day.n} OF ${day.of}`; }

export function invSummaryLine(inv) {
    if (!inv) return '';
    const warn = (ok) => ok ? '' : ' \u26A0';
    // A casting split over its cast days (portal, Casting Layout tab): the line is this day's share, and says so.
    const day = inv.day ? `${dayWords(inv.day)} · ` : '';
    return `${day}${inv.types} ${inv.types === 1 ? 'type' : 'types'} · ${inv.pcs} pcs · ${inv.cuFt} cu ft${warn(inv.cuFtComplete)} · ${inv.ff} ff sq ft${warn(inv.ffComplete)}`;
}

/** Tooltip for an incomplete total. */
export function invSummaryTitle(inv) {
    if (!inv) return '';
    const parts = [];
    if (!inv.cuFtComplete) parts.push('some inventory rows have no cu ft');
    if (!inv.ffComplete) parts.push('some inventory rows have no ff sq ft');
    const dayNote = inv.day ? ` This cast day only: the casting is split over ${inv.day.of} cast days on the portal's Casting Layout tab.` : '';
    return (parts.length ? parts.join(' · ') + ' — these totals are incomplete' : 'From the portal\'s Casting Inventory (pieces = qty + extras)') + dayNote;
}

/** Wording of the batch-print warning band, or '' when there is nothing to say. */
/** Message for a casting-linked card whose casting has no inventory pieces ('' when there is nothing to say). */
export function invMissingText(task) {
    if (!task || String(task.projectNumber || '').trim() === '' || String(task.castingNumber || '').trim() === '') return '';
    if (task.invSummary && task.invSummary.pcs > 0) return '';
    if (task.invSummary && task.invSummary.day) return `${dayWords(task.invSummary.day)}: ${task.department === 'Demold' ? 'NOTHING WAS CAST ON THAT CAST DAY' : 'NO FORMS ON THIS CAST DAY'}`;   // a split casting with nothing sent to this day
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
