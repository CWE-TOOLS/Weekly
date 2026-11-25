/**
 * REPAIR KIT on the tracking sheet (2026-11-25).
 *
 * Unlike the other tracking phases (one on/off per JOB), the repair kit is per CASTING: normally off, and switched
 * on by itself for the LAST casting of the job (of the phase, on a phased job). The user's rules:
 *   - the last casting can change (a casting added after it): the tick moves to the new last casting ...
 *   - ... except on a casting whose tracking sheet was already PRINTED with the repair kit and whose cast day is
 *     over: that sheet is out on the floor, so its tick is never taken off by itself;
 *   - a casting printed as last but not cast yet keeps the tick on a reprint only while it is still the last one;
 *   - a tick set BY HAND on any casting stops the automatic tick for that job / phase (the kit is packed there).
 *
 * Stored in the shared settings table, one row per casting that needs one: key "repair_kit:<castingId>",
 * value { manual: 'on' | 'off' (absent = automatic), printed: 'YYYY-MM-DD' (tracking last printed WITH the kit) }.
 * No row = automatic, never printed with the kit. Test copies use their own keys so a try never reaches a real job.
 * @module utils/repair-kit
 */

const TEST_COPY = typeof window !== 'undefined' && typeof location !== 'undefined'
    && (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || /\/Weekly-test\//i.test(location.pathname));
export const REPAIR_KIT_PREFIX = (typeof window !== 'undefined' && window.__REPAIR_KIT_PREFIX) || (TEST_COPY ? 'repair_kit_test:' : 'repair_kit:');
export const REPAIR_KIT_LABEL = 'REPAIR KIT';

/** A stored row as the rules read it. */
export function normRepairKit(v) {
    const manual = v && (v.manual === 'on' || v.manual === 'off') ? v.manual : null;
    const printed = v && /^\d{4}-\d{2}-\d{2}$/.test(String(v.printed || '')) ? String(v.printed) : null;
    return { manual, printed };
}
/** Nothing worth a row. */
export function repairKitEmpty(v) { const n = normRepairKit(v); return !n.manual && !n.printed; }

/**
 * The last casting of a group: the latest cast day; a casting with no cast day yet comes after every scheduled
 * one; ties go to the one further down the portal's list.
 * @param {Array<{id:string, castDate:(string|null)}>} castings one job / phase, in the portal's order
 * @returns {string|null} casting id
 */
export function lastCastingId(castings) {
    let best = null, bestIdx = -1;
    (castings || []).forEach((c, i) => {
        if (!best) { best = c; bestIdx = i; return; }
        const a = c.castDate || '9999-99-99', b = best.castDate || '9999-99-99';
        if (a > b || (a === b && i > bestIdx)) { best = c; bestIdx = i; }
    });
    return best ? best.id : null;
}

/**
 * Where the repair kit is ticked, for every casting of ONE job / phase.
 * @param {Array<{id:string, castDate:(string|null), castOver:boolean}>} castings in the portal's order
 * @param {Map<string,{manual:(string|null), printed:(string|null)}>} rows stored rows by casting id
 * @returns {Map<string,{on:boolean, why:string, auto:boolean, autoWhy:string, manual:(string|null), printed:(string|null), lastId:(string|null), byHandId:(string|null)}>}
 *   why: 'hand-on' | 'hand-off' | 'printed' (printed with the kit and cast: kept) | 'last' | 'by-hand-elsewhere' | 'not-last'
 *   auto / autoWhy: what the automatic rule alone gives this casting (its own hand tick left out)
 */
export function repairKitStates(castings, rows) {
    const list = castings || [];
    const row = (id) => normRepairKit(rows && rows.get(id));
    const lastId = lastCastingId(list);
    const handOn = list.filter(c => row(c.id).manual === 'on').map(c => c.id);
    const out = new Map();
    for (const c of list) {
        const r = row(c.id);
        const elsewhere = handOn.find(id => id !== c.id) || null;
        let auto, autoWhy;
        if (r.printed && c.castOver) { auto = true; autoWhy = 'printed'; }
        else if (elsewhere) { auto = false; autoWhy = 'by-hand-elsewhere'; }
        else if (c.id === lastId) { auto = true; autoWhy = 'last'; }
        else { auto = false; autoWhy = 'not-last'; }
        const on = r.manual ? r.manual === 'on' : auto;
        const why = r.manual === 'on' ? 'hand-on' : r.manual === 'off' ? 'hand-off' : autoWhy;
        out.set(c.id, { on, why, auto, autoWhy, manual: r.manual, printed: r.printed, lastId, byHandId: elsewhere });
    }
    return out;
}

/** A click on the bubble: the row to store. A click that asks for what the automatic rule gives anyway goes back to automatic. */
export function repairKitAfterClick(state) {
    const want = !state.on;
    return { manual: want === state.auto ? null : (want ? 'on' : 'off'), printed: state.printed };
}
/** The tracking sheet was printed: with the kit = remembered (the day it was printed), without = forgotten. */
export function repairKitAfterPrint(state, todayIso) {
    return { manual: state.manual, printed: state.on ? todayIso : null };
}
/** A row as it is stored (null = no row). */
export function repairKitToStore(v) {
    const n = normRepairKit(v);
    if (!n.manual && !n.printed) return null;
    const out = {};
    if (n.manual) out.manual = n.manual;
    if (n.printed) out.printed = n.printed;
    return out;
}
