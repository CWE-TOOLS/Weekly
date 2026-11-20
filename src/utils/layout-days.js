/**
 * Cast days of a casting (2026-11-20).
 *
 * A casting the weekly casts over two or more days is laid out day by day on the portal's Casting Layout tab.
 * Which form casts on which day, and the side of each day, is one settings row per casting
 * (plant_schedule_settings, key "layout_days:<castingId>"):
 *
 *   { assign: { "<type>#<n>": 2, ... },   // the n-th form of a type (0-based, in Tracking order) -> its day
 *     sides:  { "2": "A", ... },          // the side of day 2, 3, ... (day 1 = the casting's own side)
 *     rows:   { "<inventory row id>": { "2": 11 } } }   // how many pieces of each Casting Inventory row are on day 2, 3, ...
 *
 * "rows" is what the split MEANS (11 of this row cast on Day 2); "assign" says which pieces those are. The piece keys
 * move when the inventory is edited (a type renamed, rows reordered, a quantity changed in another row of the same
 * type), the row ids do not: wherever the inventory is at hand the split is read through resolveLayoutDays(), which
 * keeps each row's numbers and re-picks the pieces only when it has to.
 *
 * DAY NUMBERS are the Staging tab's day numbers of the casting's Cast cards (castDayDates): Day 2 here is the card
 * that shows the staging note "Cast - Day 2".
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
    let rows = null;
    if (v && typeof v === 'object') {
        for (const [k, d] of Object.entries(v.assign || {})) { const n = parseInt(d, 10); if (n > 1) assign[k] = n; }
        for (const [k, s] of Object.entries(v.sides || {})) { const n = parseInt(k, 10); if (n > 1 && ['A', 'B', 'AB'].includes(s)) sides[String(n)] = s; }
        if (v.rows && typeof v.rows === 'object') {
            rows = {};
            for (const [id, per] of Object.entries(v.rows)) {
                const out = {};
                for (const [d, q] of Object.entries(per || {})) { const dn = parseInt(d, 10), qn = parseInt(q, 10); if (dn > 1 && qn > 0) out[String(dn)] = qn; }
                if (Object.keys(out).length) rows[id] = out;
            }
        }
    }
    return rows ? { assign, sides, rows } : { assign, sides };
}

/** One spelling of a split whatever order its keys come in (the database returns them in its own order). */
export function layoutDaysCanon(cfg) {
    const c = normLayoutDays(cfg);
    const sorted = o => Object.entries(o || {}).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    return JSON.stringify([sorted(c.assign), sorted(c.sides), sorted(c.rows || {}).map(([k, v]) => [k, sorted(v)])]);
}

/** True when nothing is stored: no piece on a later day and no side of a later day. */
export function layoutDaysEmpty(cfg) {
    return !cfg || (!Object.keys(cfg.assign || {}).length && !Object.keys(cfg.sides || {}).length);
}

/** The per-row numbers of a split: { "<inventory row id>": { "2": 11 } }, counted from the pieces. */
export function layoutDayRows(assign, invRows) {
    const rows = {};
    for (const { key, row } of inventoryPieceRows(invRows)) {
        const d = parseInt(assign && assign[key], 10);
        if (!(d > 1) || !row.id) continue;
        if (!rows[row.id]) rows[row.id] = {};
        rows[row.id][String(d)] = (rows[row.id][String(d)] || 0) + 1;
    }
    return rows;
}

/**
 * A stored split read against the casting's inventory as it is NOW. Each row keeps the number of pieces it had on
 * each later day (as many as it still has); the pieces that were on that day stay there, the rest are taken from
 * the end of the row. A split stored without row numbers, or an inventory that is not at hand, is returned as it is.
 */
export function resolveLayoutDays(cfg, invRows) {
    const c = normLayoutDays(cfg);
    if (!c.rows || !invRows || !invRows.length) return c;
    if (!Object.keys(c.rows).length && Object.keys(c.assign).length) return c;   // pieces stored without their row numbers: as stored
    const perRow = new Map();
    for (const { key, row } of inventoryPieceRows(invRows)) {
        if (!perRow.has(row.id)) perRow.set(row.id, []);
        perRow.get(row.id).push(key);
    }
    const assign = {};
    for (const [rowId, keys] of perRow) {
        const want = c.rows[rowId];
        if (!want) continue;
        const free = keys.slice();
        for (const d of Object.keys(want).map(Number).sort((a, b) => a - b)) {
            const n = Math.min(want[String(d)], free.length);
            const pick = free.filter(k => c.assign[k] === d).slice(0, n);
            // the rest from the end of the row: first the pieces no other day of this row has a claim on, then any
            const claimed = k => c.assign[k] > 1 && c.assign[k] !== d && want[String(c.assign[k])] > 0;
            for (let i = free.length - 1; i >= 0 && pick.length < n; i--) if (!pick.includes(free[i]) && !claimed(free[i])) pick.push(free[i]);
            for (let i = free.length - 1; i >= 0 && pick.length < n; i--) if (!pick.includes(free[i])) pick.push(free[i]);
            for (const k of pick) { assign[k] = d; free.splice(free.indexOf(k), 1); }
        }
    }
    return { assign, sides: c.sides, rows: c.rows };
}

/**
 * The cast days of a casting from its Cast cards on the weekly: [{ iso, day }] -> the dates, Day 1 first.
 * `day` is the card's Staging-tab day number: when the cards are numbered 1..n, one date each, Day n here is the
 * card with that staging day, so the pieces and the staging note of a day always sit on the same card. Cards
 * numbered any other way (two cards on one date, a gap) fall back to the dates in order.
 */
export function castDayDates(cards) {
    const list = (cards || []).filter(c => c && c.iso);
    const byDate = [...new Set(list.map(c => c.iso))].sort();
    const byDay = new Map();
    for (const c of list) {
        const n = parseInt(c.day, 10);
        if (!(n >= 1) || (byDay.has(n) && byDay.get(n) !== c.iso)) return byDate;
        byDay.set(n, c.iso);
    }
    if (byDay.size !== byDate.length) return byDate;
    for (let n = 1; n <= byDay.size; n++) if (!byDay.has(n)) return byDate;
    return byDate.map((_, i) => byDay.get(i + 1));
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

/**
 * The inventory rows of ONE cast day of a split casting, as rows the usual totals can be run on: each row carries
 * the pieces it has on that day as its quantity (extras 0); rows with nothing on that day are left out. Batching,
 * the scrim line and the finishing products total these exactly as they total a whole casting.
 */
export function inventoryRowsOfDay(invRows, cfg, nDays, day) {
    const count = new Map();
    for (const { key, row } of inventoryPieceRows(invRows)) {
        if (layoutDayOf(cfg, key, nDays) === day) count.set(row, (count.get(row) || 0) + 1);
    }
    return (invRows || []).filter(r => count.get(r) > 0).map(r => ({ ...r, quantity: count.get(r), extras: 0 }));
}
