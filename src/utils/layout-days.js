/**
 * Cast days of a casting (2026-11-20).
 *
 * A casting the weekly casts over two or more days is laid out day by day on the portal's Casting Layout tab.
 * Which form casts on which day, and the side of each day, is one settings row per casting
 * (plant_schedule_settings, key "layout_days:<castingId>"):
 *
 *   { assign: { "<type>#<n>": 2, ... },   // the n-th form of a type (0-based, in Tracking order) -> its day
 *     sides:  { "2": "A", ... } }         // the side of day 2, 3, ... (day 1 = the casting's own side)
 *
 * Days are numbers (1 = the first Cast day on the weekly), not dates: when the schedule moves, the split moves
 * with it. Only days 2+ are stored; everything else is on Day 1. A casting with nothing stored is "not split":
 * every screen keeps showing the whole casting on each of its days, as before.
 *
 * Shared by the portal page and the weekly's card data, so both read the split the same way. Pure functions only.
 *
 * @module utils/layout-days
 */

/** Settings key prefix. A test copy sets window.__LAYOUT_DAYS_PREFIX so its splits never become a real job's. */
export const LAYOUT_DAYS_PREFIX = (typeof window !== 'undefined' && window.__LAYOUT_DAYS_PREFIX) || 'layout_days:';

/** A stored value made safe: unknown shapes become "nothing stored". */
export function normLayoutDays(v) {
    const assign = {}, sides = {};
    if (v && typeof v === 'object') {
        for (const [k, d] of Object.entries(v.assign || {})) { const n = parseInt(d, 10); if (n > 1) assign[k] = n; }
        for (const [k, s] of Object.entries(v.sides || {})) { const n = parseInt(k, 10); if (n > 1 && ['A', 'B', 'AB'].includes(s)) sides[String(n)] = s; }
    }
    return { assign, sides };
}

/** The day a form is on. A day the schedule no longer has (the casting went back to fewer days) reads as Day 1. */
export function layoutDayOf(cfg, key, nDays) {
    const d = parseInt(cfg && cfg.assign ? cfg.assign[key] : 0, 10) || 1;
    return d >= 1 && d <= nDays ? d : 1;
}

/** True once at least one form sits on a day after the first. */
export function layoutDaysSplit(cfg, nDays) {
    if (!(nDays > 1) || !cfg || !cfg.assign) return false;
    return Object.values(cfg.assign).some(d => { const n = parseInt(d, 10); return n > 1 && n <= nDays; });
}

/** Side of day n: its own when one is stored, else the casting's. '' = not set. */
export function layoutDaySide(castingSide, cfg, n) {
    const own = n > 1 && cfg && cfg.sides ? cfg.sides[String(n)] : null;
    const s = own || castingSide;
    return ['A', 'B', 'AB'].includes(s) ? s : '';
}

/** "<type>#<n>" for every row, n counted per type in list order (the Tracking panels of a casting). */
export function placeKeys(rows) {
    const seen = new Map();
    return (rows || []).map(r => { const t = r.type || '?'; const n = seen.get(t) || 0; seen.set(t, n + 1); return `${t}#${n}`; });
}

/**
 * One entry per piece of a casting's inventory, in the order Tracking numbers them (per row: the quantity, then
 * the extras), with the same key placeKeys gives the Tracking panels. Used where only the inventory is loaded.
 * @returns {Array<{key: string, row: Object}>}
 */
export function inventoryPieceRows(rows) {
    const out = [], seen = new Map();
    for (const r of rows || []) {
        const q = parseInt(r.quantity, 10);
        const extras = Math.max(0, parseInt(r.extras, 10) || 0);
        const qty = (q === 0 && extras > 0) ? 0 : Math.max(1, q || 1);   // the Tracking rule (a blank quantity is one piece)
        const t = r.type || '?';
        for (let i = 0; i < qty + extras; i++) {
            const n = seen.get(t) || 0;
            seen.set(t, n + 1);
            out.push({ key: `${t}#${n}`, row: r });
        }
    }
    return out;
}
