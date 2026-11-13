/**
 * Type master list (2026-11-11) — the job's own list of panel types and how many of each the job needs. It sits on
 * the Casting Inventory tab between the Notes and the "panels in inventory" box.
 *
 *  - Type + Qty are enough; Description, Width, Length, Color, Cu Ft and FF Sq Ft can be filled in later.
 *  - Once the list holds a type, every casting row picks its type from a dropdown (last option: create a type).
 *  - Picking a type fills the row with whatever the master already knows about it.
 *  - A quantity that would take a type past its master total is never saved silently: the PM is asked whether the
 *    surplus becomes extras, whether the master total goes up, or whether to cancel.
 *  - A value changed on the master fills the blank casting rows of that type; rows that already hold another value
 *    are ALWAYS asked about first, listed cast by cast (user rule 2026-11-13: "always ask"). A value changed on a
 *    casting row goes to the master and to the same type in the other castings, as long as those rows held the
 *    old value or nothing. Ready (final) castings are skipped
 *    and named — except for the Description (user rule 2026-11-13): no print's change check reads it, so it goes
 *    to every casting, ready ones included, and never touches a milestone. Sizes, volume, face sq ft and colour
 *    stay frozen in a ready casting until "Make changes" is pressed there.
 *
 *  - The list is always shown sorted by type, like the dropdown (TL-2 before TL-10); a line still being named
 *    waits at the bottom and drops into place when the list is left (user rule 2026-11-13).
 *  - Paste (copied or cut rows) is checked against the totals too: the PM is asked before a paste takes a type
 *    past its total (user rule 2026-11-13). Import Remakes is not: remake rows never count toward a total.
 *
 *  - The list is LOCKED whenever the Casting Inventory opens (user rule 2026-11-13): its boxes and buttons do
 *    nothing until "Unlock to edit" is pressed, and it locks itself again after one minute without work on it.
 *    The lock is this screen's own guard against a stray click or key, nothing is stored. Picking "Create a
 *    type" in a casting, or raising a total from the over-total question, still works while it is locked.
 *
 * A phased job keeps one list PER PHASE (user rule 2026-11-11): the list, its counts, the dropdowns and the values
 * that follow across castings all stay inside the phase picked at the top of the portal.
 *
 * Stored as ONE row of plant_schedule_settings per list: key "type_master:<project number>" — or
 * "type_master:<project number>:<phase id>" on a phased job — value { v: 1, types: [...] }.
 * No table or column was added. Every save re-reads the row and replays this page's own edits on it, so two PMs
 * working on the list at the same time do not wipe each other's lines.
 *
 * @module pages/project-portal/type-master
 */

import { initializeSupabase, getSupabaseClient } from '../../services/supabase-service.js';
import { logger } from '../../utils/logger.js';

const TABLE = 'plant_schedule_settings';
/** The test site keeps its lists under its own key so a trial never becomes a real job's master list. */
const keyFor = (pn) => ((typeof window !== 'undefined' && window.__TYPE_MASTER_PREFIX) || 'type_master:') + pn;
export const TM_NEW = '__tm_new__';
const SYNC_FIELDS = ['description', 'width', 'length', 'color_log_id', 'cu_ft', 'ff_sq_ft'];
const NUM_FIELDS = new Set(['cu_ft', 'ff_sq_ft']);
/** Fields no print depends on (not in INV_PRINT_FIELDS of the page): they follow into ready (final) castings too. */
const FREE_FIELDS = new Set(['description']);
const FIELD_WORDS = { description: 'Description', width: 'Width', length: 'Length', color_log_id: 'Color', cu_ft: 'Cu Ft', ff_sq_ft: 'FF Sq Ft' };
const OPEN_LIMIT = 10;          // longer lists start folded, like a casting with many rows

let ctx = null;
let project = null;
let storeKey = null;            // the settings row of the list on screen (job, or job + phase); null = no list here
let types = [];                 // [{ id, type, qty, description, width, length, color_log_id, cu_ft, ff_sq_ft }]
let loadedOk = false;
let openState = null;           // null = follow OPEN_LIMIT; true / false once the user has clicked the header
let unlocked = false;           // the list is locked until "Unlock to edit" is pressed; locks itself after LOCK_AFTER_MS idle
let lockTimer = null;
const LOCK_AFTER_MS = 60000;
let pendingOps = [];
let saveTimer = null;
let flushing = null;

const norm = (s) => String(s ?? '').trim().toLowerCase();
const blank = (v) => v === null || v === undefined || String(v).trim() === '';
const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
const newId = () => 't' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const esc = (s) => ctx.escapeHtml(String(s ?? ''));
const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
/** Two values the same? Blank = blank, numbers compare as numbers ("1.020" = 1.02), the rest as trimmed text. */
function sameVal(a, b) {
    const sa = String(a ?? '').trim(), sb = String(b ?? '').trim();
    if (sa === sb) return true;
    const na = Number(sa), nb = Number(sb);
    return sa !== '' && sb !== '' && Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}
function parseField(f, raw) {
    const s = String(raw ?? '').trim();
    if (s === '') return null;
    if (NUM_FIELDS.has(f)) { const n = parseFloat(s); return Number.isFinite(n) ? n : null; }
    return s;
}
const qtyOf = (r) => { const n = parseInt(r?.quantity, 10); return Number.isFinite(n) && n > 0 ? n : 0; };
const extrasOf = (r) => { const n = parseInt(r?.extras, 10); return Number.isFinite(n) && n > 0 ? n : 0; };

function cleanEntry(e) {
    const q = parseInt(e?.qty, 10);
    const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
    const txt = (v) => blank(v) ? null : String(v).trim();
    return {
        id: e?.id || newId(), type: blank(e?.type) ? '' : String(e.type).trim(), qty: Number.isFinite(q) && q >= 0 ? q : null,
        description: txt(e?.description), width: txt(e?.width), length: txt(e?.length), color_log_id: txt(e?.color_log_id),
        cu_ft: num(e?.cu_ft), ff_sq_ft: num(e?.ff_sq_ft)
    };
}
const listOf = (value) => (value && Array.isArray(value.types) ? value.types : []).map(cleanEntry);

// ---------------------------------------------------------------- storage

async function client() {
    if (!getSupabaseClient()) await initializeSupabase();
    const c = getSupabaseClient();
    if (!c) throw new Error('no database connection');
    return c;
}
async function readRow(key) {
    const c = await client();
    const { data, error } = await c.from(TABLE).select('key, value').eq('key', key);
    if (error) throw error;
    return listOf(data && data[0] ? data[0].value : null);
}
async function writeRow(key, list) {
    const c = await client();
    const { error } = list.length
        ? await c.from(TABLE).upsert({ key, value: { v: 1, types: list }, updated_at: new Date().toISOString() }, { onConflict: 'key' })
        : await c.from(TABLE).delete().eq('key', key);
    if (error) throw error;
}

/** The scope right now: { suffix, label } for the whole job or one phase of a phased job; null = no phase picked. */
const scopeNow = () => (ctx && project) ? ctx.scope() : null;
const wantedKey = () => { const sc = scopeNow(); return sc ? keyFor(project) + sc.suffix : null; };
const scopeWord = () => (scopeNow()?.suffix ? 'phase' : 'job');

/** Load the list of the job (or of its active phase). Edits of ours that are not saved yet stay on screen. */
export async function loadTypeMaster(pn) {
    project = pn || null;
    const key = wantedKey();
    if (key !== storeKey) {
        if (pendingOps.length && storeKey) flush();          // the list being left: its edits are captured and saved now
        pendingOps = []; openState = null; types = []; loadedOk = false; storeKey = key;
        unlocked = false; clearTimeout(lockTimer); lockTimer = null;      // another job or phase: locked again
    }
    if (!key || pendingOps.length) return;
    try {
        const list = await readRow(key);
        if (key !== storeKey || pendingOps.length) return;
        types = list; loadedOk = true;
    } catch (err) {
        logger.warn('[type-master] load failed:', err);
        if (key === storeKey) { types = []; loadedOk = false; }
    }
}

/** Apply a change here now and replay it on the freshly read row at save time (ops are id-based and repeatable). */
function mutate(op) {
    op(types);
    pendingOps.push(op);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 350);
}
async function flush() {
    clearTimeout(saveTimer); saveTimer = null;
    if (!pendingOps.length || !storeKey) return;
    const key = storeKey, ops = pendingOps, before = flushing;   // captured at once: the list may change under us (phase switch)
    pendingOps = [];
    const p = (async () => {
        if (before) { try { await before; } catch (_) { /* reported there */ } }
        try {
            const fresh = await readRow(key);
            for (const op of ops) op(fresh);
            const keep = fresh.filter(e => !blank(e.type));
            await writeRow(key, keep);
            if (key === storeKey && !pendingOps.length) {
                const unnamed = types.filter(e => blank(e.type) && !keep.some(k => k.id === e.id));
                types = keep.concat(unnamed);
            }
        } catch (err) {
            logger.error('[type-master] save failed:', err);
            if (key === storeKey) pendingOps = ops.concat(pendingOps);
            ctx.toast('The type master list could not be saved: ' + (err.message || err), 'error', 6000);
        }
    })();
    flushing = p;
    try { ctx.trackSave?.(p); } catch (_) { /* optional */ }
    await p;
    if (flushing === p) flushing = null;
}
const opAdd = (entry) => (l) => { if (!l.some(e => e.id === entry.id)) l.push({ ...entry }); };
const opSet = (id, patch, snapshot) => (l) => { const e = l.find(x => x.id === id); if (e) Object.assign(e, patch); else l.push({ ...snapshot, ...patch }); };
const opRemove = (id) => (l) => { const i = l.findIndex(x => x.id === id); if (i !== -1) l.splice(i, 1); };

// ---------------------------------------------------------------- what the castings hold

const named = () => types.filter(e => !blank(e.type));
/** The list as shown: named types sorted like the dropdown, lines still without a name at the bottom. */
const shown = () => named().sort((a, b) => natural(a.type, b.type)).concat(types.filter(e => blank(e.type)));
const findType = (type) => blank(type) ? null : (named().find(e => norm(e.type) === norm(type)) || null);
/** True once the list names at least one type: casting rows then pick their type from it. */
export function typeMasterActive() { return loadedOk && named().length > 0; }
const castingsInOrder = () => ctx.castings().slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

function rowsOfType(type) {
    const out = [], key = norm(type);
    if (!key) return out;
    for (const casting of castingsInOrder()) for (const row of ctx.inventoryOf(casting.id)) if (norm(row.type) === key) out.push({ casting, row });
    return out;
}
/** Pieces of a type in the castings. Remake rows re-cast rejected panels, so they never count toward the total. */
function usage(type, exceptRowId = null) {
    let placed = 0, extras = 0;
    const by = [];
    for (const casting of castingsInOrder()) {
        let p = 0, x = 0;
        for (const row of ctx.inventoryOf(casting.id)) {
            if (norm(row.type) !== norm(type) || row.id === exceptRowId || row.remake_of_casting_id) continue;
            p += qtyOf(row); x += extrasOf(row);
        }
        if (p || x) by.push({ casting, p, x });
        placed += p; extras += x;
    }
    return { placed, extras, by };
}
const byText = (by) => by.map(b => `Cast ${b.casting.casting_number || '?'}: ${b.p}${b.x ? ` + ${plural(b.x, 'extra')}` : ''}`).join(' · ');
/** Types typed in the castings that the list does not name yet. */
function typesNotListed() {
    const out = new Map();
    for (const casting of castingsInOrder()) for (const row of ctx.inventoryOf(casting.id)) {
        const key = norm(row.type);
        if (!key || findType(row.type)) continue;
        if (!out.has(key)) out.set(key, { type: String(row.type).trim(), rows: [] });
        out.get(key).rows.push(row);
    }
    return [...out.values()].sort((a, b) => natural(a.type, b.type));
}
const colorName = (id) => (ctx.colorLogs().find(l => l.id === id)?.name) || '(unnamed color)';
const showVal = (f, v) => blank(v) ? '(blank)' : (f === 'color_log_id' ? colorName(v) : String(v));
/** Distinct values the castings hold for one field of a type (blank rows left out). */
function spread(type, f) {
    const seen = [];
    for (const { casting, row } of rowsOfType(type)) {
        if (blank(row[f])) continue;
        const hit = seen.find(s => sameVal(s.value, row[f]));
        if (hit) hit.casts.add(casting.casting_number || '?'); else seen.push({ value: row[f], casts: new Set([casting.casting_number || '?']) });
    }
    return seen;
}

// ---------------------------------------------------------------- the card

function statusHtml(e) {
    if (blank(e.type)) return '';
    const u = usage(e.type), q = e.qty;
    const tip = u.by.length ? byText(u.by) : 'Not in any casting yet';
    let cls, text;
    if (!(q > 0)) { cls = 'pp-tm-none'; text = `${u.placed} in castings · no total`; }
    else if (u.placed > q) { cls = 'pp-tm-over'; text = `${u.placed} of ${q} · ${u.placed - q} over`; }
    else if (u.placed === q) { cls = 'pp-tm-done'; text = `${q} of ${q} ✓`; }
    else { cls = 'pp-tm-left'; text = `${u.placed} of ${q} · ${q - u.placed} left`; }
    return `<span class="pp-tm-pill ${cls}" title="${esc(tip)}">${esc(text)}</span>${u.extras ? `<span class="pp-tm-x" title="${esc(tip)}">+${plural(u.extras, 'extra')}</span>` : ''}`;
}
/** Placeholder / outline that says when the castings do not agree with the master on a field. */
function fieldNote(e, f) {
    if (blank(e.type)) return { ph: '', title: '', off: false };
    const seen = spread(e.type, f);
    const list = seen.map(s => `${showVal(f, s.value)} (Cast ${[...s.casts].join(', ')})`).join(' · ');
    if (blank(e[f])) return seen.length > 1 ? { ph: 'differs', title: `The castings hold different values: ${list}`, off: false } : { ph: '', title: '', off: false };
    const others = seen.filter(s => !sameVal(s.value, e[f]));
    return others.length ? { ph: '', title: `Some castings hold another value: ${others.map(s => `${showVal(f, s.value)} (Cast ${[...s.casts].join(', ')})`).join(' · ')}`, off: true } : { ph: '', title: '', off: false };
}
function rowHtml(e) {
    const inp = (f, extra, ph) => {
        const n = SYNC_FIELDS.includes(f) ? fieldNote(e, f) : { ph: '', title: '', off: false };
        return `<input ${extra} class="pp-tm-in${n.off ? ' pp-tm-off' : ''}" data-tm-field="${f}" placeholder="${esc(n.ph || ph)}"${n.title ? ` title="${esc(n.title)}"` : ''} value="${esc(e[f] ?? '')}">`;
    };
    const cn = fieldNote(e, 'color_log_id');
    const color = ctx.colorSelectHtml(e.color_log_id, { className: 'pp-tm-in pp-tm-color' + (cn.off ? ' pp-tm-off' : ''), dataAttrs: { 'data-tm-field': 'color_log_id', title: cn.title || 'Color' } });
    return `<div class="pp-tm-row" data-tm-id="${esc(e.id)}">
        <input type="text" class="pp-tm-in pp-tm-type" data-tm-field="type" placeholder="Type" maxlength="40" value="${esc(e.type)}">
        <input type="number" class="pp-tm-in" data-tm-field="qty" min="0" step="1" placeholder="Qty" value="${e.qty ?? ''}">
        ${inp('description', 'type="text" maxlength="120"', 'Description')}
        ${inp('width', 'type="text"', 'Width')}
        ${inp('length', 'type="text"', 'Length')}
        ${color}
        ${inp('cu_ft', 'type="number" step="any" min="0"', '0')}
        ${inp('ff_sq_ft', 'type="number" step="any" min="0"', '0')}
        <span class="pp-tm-status" data-tm-status>${statusHtml(e)}</span>
        <button type="button" class="pp-tm-del" data-tm="del" title="Take this type off the master list (casting rows keep it)" aria-label="Remove type">&times;</button>
    </div>`;
}
function summaryHtml() {
    const list = named();
    if (!list.length) return '<span class="pp-tm-sum">not started</span>';
    let required = 0, placed = 0, over = 0, noTotal = 0;
    for (const e of list) {
        const u = usage(e.type);
        if (e.qty > 0) { required += e.qty; placed += Math.min(u.placed, e.qty); if (u.placed > e.qty) over++; } else noTotal++;
    }
    const left = required - placed;
    const stray = typesNotListed();
    return `<span class="pp-tm-sum">${plural(list.length, 'type')} · <b>${required}</b> required · ${placed} in castings · ${left ? `<b>${left}</b> left to place` : 'all placed'}</span>`
        + (over ? `<span class="pp-tm-flag pp-tm-flag-over">${plural(over, 'type')} over the total</span>` : '')
        + (noTotal ? `<span class="pp-tm-flag">${plural(noTotal, 'type')} without a total</span>` : '')
        + (stray.length ? `<span class="pp-tm-flag" title="${esc(stray.map(s => s.type).join(', '))}">${plural(stray.length, 'type')} in the castings not on this list</span>` : '');
}

/** Draw the card. While someone is typing in it only the counts are refreshed, so the cursor stays put. */
export function renderTypeMaster() {
    const wrap = document.getElementById('pp-type-master');
    if (!wrap || !ctx) return;
    // Another phase (or job) than the list in memory: switch at once, draw when its list has arrived.
    if (wantedKey() !== storeKey) loadTypeMaster(project).then(() => ctx.renderCastings());
    if (!storeKey || !loadedOk) { wrap.hidden = true; wrap.innerHTML = ''; return; }
    wrap.hidden = false;
    if (wrap.contains(document.activeElement) && document.activeElement.matches('[data-tm-field]')) { refreshTypeMasterStatus(); return; }
    const isOpen = openState ?? (types.length <= OPEN_LIMIT);
    const stray = typesNotListed();
    const body = !isOpen ? '' : `
        <div class="pp-tm-body">
            ${types.length ? '' : `<p class="pp-tm-hint">Enter every type of this ${scopeWord()} with the total quantity the ${scopeWord()} needs. <b>Type</b> and <b>Qty</b> are enough: the other boxes can be filled in later, here or in a casting. Once a type is on the list, the castings pick their types from it and a type can no longer go past its total by accident.</p>`}
            ${types.length ? `<div class="pp-tm-row pp-tm-headrow"><span>Type</span><span>Qty</span><span>Description</span><span>Width</span><span>Length</span><span>Color</span><span>Cu Ft</span><span>FF Sq Ft</span><span>In the castings</span><span></span></div>` : ''}
            ${shown().map(rowHtml).join('')}
            <div class="pp-tm-actions">
                <button type="button" class="pp-add-btn pp-tm-add" data-tm="add">+ Add Type</button>
                ${stray.length ? `<button type="button" class="pp-add-btn pp-tm-build" data-tm="build" title="${esc(stray.map(s => s.type).join(', '))}">+ Add the ${plural(stray.length, 'type')} already in the castings</button>` : ''}
                <span class="pp-tm-tip pp-tm-tip-locked">Locked, so a stray click or key changes nothing. Press <b>Unlock to edit</b> at the top right of this box.</span>
                <span class="pp-tm-tip pp-tm-tip-open">The list keeps itself sorted by type. Enter moves down and starts a new line. A list copied from Excel (Type, Qty, Description, Width, Length) can be pasted into a Type box.</span>
            </div>
        </div>`;
    wrap.innerHTML = `
        <div class="pp-tm-card${isOpen ? ' pp-tm-open' : ''}${unlocked ? '' : ' pp-tm-locked'}">
          <div class="pp-tm-top">
            <button type="button" class="pp-tm-head" data-tm="toggle" aria-expanded="${isOpen}">
                <span class="pp-cast-sum-chev" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
                <span class="pp-tm-title">Type master list${scopeNow()?.label ? ` \u00b7 ${esc(scopeNow().label)}` : ''}</span>
                <span class="pp-tm-headsum" data-tm-sum>${summaryHtml()}</span>
            </button>
            <button type="button" class="pp-tm-lock" data-tm="lock" aria-pressed="${!unlocked}" title="${unlocked ? 'Lock the list now. It also locks itself after 1 minute without work on it.' : 'The list is locked against stray clicks. Press to edit it.'}">${unlocked ? '\uD83D\uDD13 Lock' : '\uD83D\uDD12 Locked \u00b7 Unlock to edit'}</button>
          </div>${body}
        </div>`;
    if (!unlocked) wrap.querySelectorAll('.pp-tm-body input, .pp-tm-body select, .pp-tm-body button').forEach(el => { el.disabled = true; });
}

/** Any work on the unlocked list pushes the automatic lock one minute further. */
function touchLock() {
    if (!unlocked) return;
    clearTimeout(lockTimer);
    lockTimer = setTimeout(() => setLocked(true, true), LOCK_AFTER_MS);
}
/** Lock or unlock the list. Locking commits the box being typed in and drops lines that never got a name. */
function setLocked(on, auto = false) {
    clearTimeout(lockTimer); lockTimer = null;
    const wrap = document.getElementById('pp-type-master');
    if (on) {
        if (!unlocked) return;
        // A question of ours is on screen (it belongs to an edit in progress): try again shortly.
        if (auto && document.querySelector('.pp-tm-modal')) { lockTimer = setTimeout(() => setLocked(true, true), 10000); return; }
        if (wrap?.contains(document.activeElement)) document.activeElement.blur();
        for (const e of types.filter(x => blank(x.type))) mutate(opRemove(e.id));
        unlocked = false;
    } else {
        unlocked = true; openState = true;
        touchLock();
    }
    renderTypeMaster();
    if (on && auto && ctx) ctx.toast('The type master list locked itself after 1 minute without work on it.', 'success', 3000);
}
/** Counts, pills and "differs" notes only: nothing that holds the cursor is rebuilt. */
export function refreshTypeMasterStatus() {
    const wrap = document.getElementById('pp-type-master');
    if (!wrap || wrap.hidden || !ctx) return;
    const sum = wrap.querySelector('[data-tm-sum]');
    if (sum) sum.innerHTML = summaryHtml();
    wrap.querySelectorAll('.pp-tm-row[data-tm-id]').forEach(row => {
        const e = types.find(x => x.id === row.dataset.tmId);
        if (!e) return;
        const st = row.querySelector('[data-tm-status]');
        if (st) st.innerHTML = statusHtml(e);
        for (const f of SYNC_FIELDS) {
            const el = row.querySelector(`[data-tm-field="${f}"]`);
            if (!el) continue;
            const n = fieldNote(e, f);
            el.classList.toggle('pp-tm-off', n.off);
            if (n.title) el.title = n.title; else el.removeAttribute('title');
            if (el.tagName === 'INPUT' && !NUM_FIELDS.has(f)) el.placeholder = n.ph || FIELD_WORDS[f];
        }
    });
}
function setMasterDom(id, f, val) {
    const el = document.querySelector(`#pp-type-master .pp-tm-row[data-tm-id="${CSS.escape(id)}"] [data-tm-field="${f}"]`);
    if (el && el !== document.activeElement) el.value = val ?? '';
}
function setRowDom(rowId, f, val) {
    const el = document.querySelector(`.pp-inv-row[data-inventory-id="${CSS.escape(rowId)}"] [data-field="${f}"]`);
    if (el && el !== document.activeElement) { el.value = val ?? ''; if (f === 'description') { if (val) el.title = val; else el.removeAttribute('title'); } }
}

// ---------------------------------------------------------------- pushing a value to the casting rows

/**
 * Write one field on casting rows. Ready (final) castings are left alone and named in the toast — unless the field
 * is one no print depends on (the Description): that one is written everywhere and no milestone is looked at.
 */
async function applyToRows(targets, f, val, what) {
    const skipped = new Set(), touched = new Set();
    let n = 0, failed = 0;
    const free = FREE_FIELDS.has(f);
    const byCasting = new Map();
    for (const { casting, row } of targets) {
        if (!free && ctx.isFinal(casting.id)) { skipped.add(casting.casting_number || '?'); continue; }
        if (!byCasting.has(casting.id)) byCasting.set(casting.id, []);
        byCasting.get(casting.id).push(row);
    }
    // One save per casting (a type can sit on dozens of rows of one casting), not one per row.
    for (const [castingId, rows] of byCasting) {
        const was = rows.map(r => r[f]);
        rows.forEach(r => { r[f] = val; setRowDom(r.id, f, val); });
        try {
            const c = await client();
            for (let i = 0; i < rows.length; i += 80) {
                const { error } = await c.from('casting_inventory').update({ [f]: val }).in('id', rows.slice(i, i + 80).map(r => r.id));
                if (error) throw error;
            }
            touched.add(castingId); n += rows.length;
        } catch (err) {
            rows.forEach((r, i) => { r[f] = was[i]; setRowDom(r.id, f, was[i]); });
            failed += rows.length;
            logger.error('[type-master] rows update failed:', err);
        }
    }
    // A free field changes no count and no print: the milestones are not even asked (a ready casting stays as it is).
    if (!free) for (const id of touched) { try { ctx.afterChange(id); } catch (err) { logger.warn('[type-master] afterChange failed:', err); } }
    const parts = [];
    if (n) parts.push(`${what}: set on ${plural(n, 'row')} in ${plural(touched.size, 'casting')}.`);
    if (failed) parts.push(`${plural(failed, 'row')} could not be saved.`);
    if (skipped.size) parts.push(`Not changed in Cast ${[...skipped].join(', ')}: the inventory there is ready (final). Press "Make changes" on it first.`);
    if (parts.length) ctx.toast(parts.join(' '), (failed || skipped.size) ? 'error' : 'success', (failed || skipped.size) ? 8000 : 3000);
    return n;
}

/**
 * A master box changed. Blank casting rows take the value at once; rows that already hold another value are always
 * asked about first, one line per casting and value (user rule 2026-11-13). Ready (final) castings keep theirs
 * unless the field is a free one (the Description), and the question says so.
 */
async function pushMasterField(e, f, before, val) {
    if (blank(val)) return;
    const fill = [], held = [];
    for (const t of rowsOfType(e.type)) {
        if (sameVal(t.row[f], val)) continue;
        (blank(t.row[f]) ? fill : held).push(t);
    }
    let targets = fill;
    if (held.length) {
        const free = FREE_FIELDS.has(f);
        const groups = new Map();
        for (const d of held) {
            const stays = !free && ctx.isFinal(d.casting.id);
            const k = d.casting.id + '|' + String(d.row[f]).trim();
            if (!groups.has(k)) groups.set(k, { cast: d.casting.casting_number || '?', v: d.row[f], n: 0, stays });
            groups.get(k).n++;
        }
        const all = [...groups.values()];
        const lines = all.slice(0, 12).map(g => `   Cast ${g.cast}: ${showVal(f, g.v)}${g.n > 1 ? ` (${g.n} rows)` : ''}${g.stays ? '   \u2014 ready, stays as it is' : ''}`).join('\n') + (all.length > 12 ? `\n   and ${all.length - 12} more` : '');
        const head = `${e.type}: ${FIELD_WORDS[f]} = ${showVal(f, val)}\n\n${plural(held.length, 'row')} in the castings ${held.length === 1 ? 'holds' : 'hold'} another value:\n${lines}\n\n`;
        if (all.every(g => g.stays)) {
            window.alert(head + `All of them are in ready (final) castings: nothing changes there until "Make changes" is pressed on the casting.`);
        } else if (window.confirm(head + `OK = replace with ${showVal(f, val)}${all.some(g => g.stays) ? ' (ready castings stay as they are until "Make changes" is pressed there)' : ''}\nCancel = leave the castings as they are`)) {
            targets = fill.concat(held);
        }
    }
    if (targets.length) await applyToRows(targets, f, val, `${FIELD_WORDS[f]} of ${e.type}`);
}

/**
 * A casting row's box changed (called when the box is left, not on every keystroke). The master takes the value
 * when it had none or held the old one; the same type in the other castings follows on the same rule.
 */
async function rowFieldCommitted(itemId, castingId, f, beforeRaw, nowRaw) {
    if (!typeMasterActive() || ctx.isFinal(castingId)) return;
    const item = ctx.inventoryOf(castingId).find(i => i.id === itemId);
    const e = item ? findType(item.type) : null;
    if (!e) return;
    const before = parseField(f, beforeRaw), val = parseField(f, nowRaw);
    if (sameVal(before, val)) return;
    if (blank(e[f]) || sameVal(e[f], before)) { mutate(opSet(e.id, { [f]: val }, { ...e })); setMasterDom(e.id, f, val); }
    const targets = rowsOfType(item.type).filter(t => t.row.id !== itemId && !sameVal(t.row[f], val) && (blank(t.row[f]) || sameVal(t.row[f], before)));
    if (targets.length) await applyToRows(targets, f, val, `${FIELD_WORDS[f]} of ${e.type}`);
    refreshTypeMasterStatus();
}

// ---------------------------------------------------------------- editing the master

async function commitMasterField(el) {
    const row = el.closest('.pp-tm-row[data-tm-id]');
    const e = row ? types.find(x => x.id === row.dataset.tmId) : null;
    if (!e) return;
    const f = el.dataset.tmField;
    if (f === 'type') return commitTypeName(e, el);
    const before = e[f];
    let val;
    if (f === 'qty') { const n = parseInt(el.value, 10); val = Number.isFinite(n) && n >= 0 ? n : null; el.value = val ?? ''; }
    else val = parseField(f, el.value);
    if (sameVal(before, val)) return;
    mutate(opSet(e.id, { [f]: val }, { ...e }));
    if (f !== 'qty' && !blank(e.type)) await pushMasterField(e, f, before, val);
    refreshTypeMasterStatus();
}
async function commitTypeName(e, el) {
    const before = e.type, val = el.value.trim();
    if (val === before) return;
    if (!val) { el.value = before; if (before) ctx.toast('To take a type off the list use the × at the end of its line.', 'error', 4000); return; }
    if (types.some(x => x !== e && norm(x.type) === norm(val))) { el.value = before; ctx.toast(`${val} is already on the master list.`, 'error', 4000); return; }
    const rows = before ? rowsOfType(before) : [];
    if (rows.length) {
        const casts = [...new Set(rows.map(r => r.casting))];
        const final = casts.filter(c => ctx.isFinal(c.id));
        if (final.length) { el.value = before; ctx.toast(`${before} cannot be renamed: the inventory of Cast ${final.map(c => c.casting_number).join(', ')} is ready (final). Press "Make changes" there first.`, 'error', 8000); return; }
        if (!window.confirm(`Rename ${before} to ${val} on ${plural(rows.length, 'row')} in ${plural(casts.length, 'casting')}?\n\nPanel numbers on the Tracking tab follow the new name.`)) { el.value = before; return; }
        const mine = new Set(ctx.castings().map(c => c.id));     // a phased job: only this phase's castings are renamed
        if (ctx.editBlocked(casts[0], sim => { for (const [cid, list] of sim.inv) if (mine.has(cid)) for (const r of list) if (norm(r.type) === norm(before)) r.type = val; })) { el.value = before; return; }
        let failed = 0;
        for (const { row } of rows) {
            try { const updated = await ctx.updateItem(row.id, { type: val }); row.type = val; if (updated) Object.assign(row, updated); }
            catch (err) { failed++; logger.error('[type-master] rename failed on a row:', err); }
        }
        for (const c of casts) { try { ctx.afterChange(c.id); } catch (_) { /* keep going */ } }
        try { ctx.syncTracking(); } catch (err) { logger.warn('[type-master] tracking sync failed:', err); }
        ctx.toast(failed ? `${before} renamed, but ${plural(failed, 'row')} could not be saved.` : `${before} is now ${val} in ${plural(casts.length, 'casting')}.`, failed ? 'error' : 'success', 4000);
    }
    mutate(opSet(e.id, { type: val }, { ...e }));
    ctx.renderCastings();          // casting rows switch to / refresh their type dropdown
}
function addBlankRow(focusField = 'type') {
    const entry = cleanEntry({});
    mutate(opAdd(entry));
    openState = true;
    const wrap = document.getElementById('pp-type-master');
    if (document.activeElement && wrap?.contains(document.activeElement)) document.activeElement.blur();
    renderTypeMaster();
    document.querySelector(`#pp-type-master .pp-tm-row[data-tm-id="${CSS.escape(entry.id)}"] [data-tm-field="${focusField}"]`)?.focus();
}
function removeType(id) {
    const e = types.find(x => x.id === id);
    if (!e) return;
    const n = e.type ? rowsOfType(e.type).length : 0;
    if (n && !window.confirm(`Take ${e.type} off the master list?\n\n${plural(n, 'casting row')} keep the type, shown as "not on the master list".`)) return;
    mutate(opRemove(id));
    ctx.renderCastings();
}
/** Every type the castings already hold becomes a line: total = what the castings hold today, values where they agree. */
function buildFromCastings() {
    const stray = typesNotListed();
    if (!stray.length) return;
    const entries = stray.map(s => {
        const e = cleanEntry({ type: s.type });
        const q = s.rows.filter(r => !r.remake_of_casting_id).reduce((n, r) => n + qtyOf(r), 0);
        e.qty = q > 0 ? q : null;
        for (const f of SYNC_FIELDS) { const seen = spread(s.type, f); if (seen.length === 1) e[f] = NUM_FIELDS.has(f) ? Number(seen[0].value) : String(seen[0].value); }
        return e;
    });
    mutate(l => { for (const e of entries) if (!l.some(x => norm(x.type) === norm(e.type))) l.push({ ...e }); });
    openState = true;
    ctx.renderCastings();
    ctx.toast(`${plural(entries.length, 'type')} added from the castings. Check each Qty: it was set to what the castings hold today.`, 'success', 7000);
}
/** A block copied from Excel pasted into a Type box: Type, Qty, Description, Width, Length per line. */
function pasteList(text, intoId) {
    const lines = String(text).replace(/\r/g, '').split('\n').map(l => l.split('\t').map(c => c.trim())).filter(c => c.some(Boolean));
    if (!lines.length) return false;
    if (lines.length > 1 && /^type$/i.test(lines[0][0] || '')) lines.shift();   // a header line
    const adds = [], sets = [];
    for (const c of lines) {
        const type = c[0]; if (!type) continue;
        const q = parseInt(c[1], 10);
        const patch = {};
        if (Number.isFinite(q) && q >= 0) patch.qty = q;
        if (c[2]) patch.description = c[2];
        if (c[3]) patch.width = c[3];
        if (c[4]) patch.length = c[4];
        const hit = findType(type) || adds.find(a => norm(a.type) === norm(type));
        if (hit && adds.includes(hit)) Object.assign(hit, patch);
        else if (hit) sets.push({ id: hit.id, patch, snap: { ...hit } });
        else adds.push({ ...cleanEntry({ type }), ...patch });
    }
    if (!adds.length && !sets.length) return false;
    const target = types.find(x => x.id === intoId);
    mutate(l => {
        if (target && blank(target.type)) { const i = l.findIndex(x => x.id === intoId); if (i !== -1) l.splice(i, 1); }
        for (const s of sets) { const e = l.find(x => x.id === s.id); if (e) Object.assign(e, s.patch); else l.push({ ...s.snap, ...s.patch }); }
        for (const a of adds) if (!l.some(x => norm(x.type) === norm(a.type))) l.push({ ...a });
    });
    if (document.activeElement) document.activeElement.blur();
    ctx.renderCastings();
    ctx.toast(`Pasted: ${plural(adds.length, 'new type')}${sets.length ? `, ${sets.length} updated` : ''}.`, 'success', 4000);
    return true;
}

// ---------------------------------------------------------------- small dialog

function dialog({ title, bodyHtml, buttons, onOpen }) {
    return new Promise(resolve => {
        const ov = document.createElement('div');
        ov.className = 'pp-tm-modal';
        ov.innerHTML = `<div class="pp-tm-dialog" role="dialog" aria-modal="true">
            <h3 class="pp-tm-dialog-title">${title}</h3>
            <div class="pp-tm-dialog-body">${bodyHtml}</div>
            <div class="pp-tm-dialog-btns">${buttons.map((b, i) => `<button type="button" class="pp-tm-btn${b.kind ? ' pp-tm-btn-' + b.kind : ''}" data-i="${i}">${b.label}</button>`).join('')}</div>
        </div>`;
        const done = (value) => { document.removeEventListener('keydown', onKey, true); ov.remove(); resolve(value); };
        const onKey = (ev) => {
            if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); done(null); }
            if (ev.key === 'Enter' && ev.target.matches?.('.pp-tm-dialog input')) { ev.preventDefault(); ov.querySelector('.pp-tm-btn-primary')?.click(); }
        };
        ov.addEventListener('mousedown', (ev) => { if (ev.target === ov) done(null); });
        ov.addEventListener('click', (ev) => {
            const b = ev.target.closest('.pp-tm-btn'); if (!b) return;
            const btn = buttons[Number(b.dataset.i)];
            const out = btn.value instanceof Function ? btn.value(ov) : btn.value;
            if (out !== undefined) done(out);          // a button returns undefined to keep the dialog open (bad input)
        });
        document.addEventListener('keydown', onKey, true);
        document.body.appendChild(ov);
        if (onOpen) onOpen(ov); else ov.querySelector('.pp-tm-btn-primary')?.focus();
    });
}

/** "Create a type…": name + total for the job. Returns the list entry (an existing one when the name is taken). */
async function askNewType() {
    const made = await dialog({
        title: 'Create a type',
        bodyHtml: `<p>The type goes on the master list and can then be picked in every casting.</p>
            <label class="pp-tm-dialog-row"><span>Type</span><input type="text" id="pp-tm-new-type" maxlength="40" autocomplete="off"></label>
            <label class="pp-tm-dialog-row"><span>Total quantity for the ${scopeWord()}</span><input type="number" id="pp-tm-new-qty" min="0" step="1"></label>
            <p class="pp-tm-dialog-note" id="pp-tm-new-note"></p>`,
        buttons: [
            { label: 'Cancel', value: null },
            { label: 'Create', kind: 'primary', value: (ov) => {
                const type = ov.querySelector('#pp-tm-new-type').value.trim();
                const q = parseInt(ov.querySelector('#pp-tm-new-qty').value, 10);
                if (!type) { ov.querySelector('#pp-tm-new-note').textContent = 'Type a name for the type.'; ov.querySelector('#pp-tm-new-type').focus(); return undefined; }
                return { type, qty: Number.isFinite(q) && q >= 0 ? q : null };
            } }
        ],
        onOpen: (ov) => ov.querySelector('#pp-tm-new-type').focus()
    });
    if (!made) return null;
    const hit = findType(made.type);
    if (hit) { ctx.toast(`${hit.type} is already on the master list: picked it.`, 'success', 3500); return hit; }
    const entry = cleanEntry(made);
    mutate(opAdd(entry));
    return entry;
}

/**
 * The over-production check, asked before a casting row's quantity or type is saved.
 * @returns {Promise<{action:'ok'}|{action:'cancel'}|{action:'split', quantity:number, extras:number}>}
 */
export async function typeMasterOverCheck(item, next) {
    if (!typeMasterActive() || item.remake_of_casting_id) return { action: 'ok' };
    const e = findType(next.type);
    if (!e || !(e.qty > 0)) return { action: 'ok' };
    const nextQ = qtyOf(next), prevQ = norm(item.type) === norm(next.type) ? qtyOf(item) : 0;
    if (nextQ <= prevQ) return { action: 'ok' };                  // nothing is being added
    const others = usage(e.type, item.id);
    const total = others.placed + nextQ;
    if (total <= e.qty) return { action: 'ok' };
    const room = Math.max(0, e.qty - others.placed), over = nextQ - room;
    const mine = ctx.castings().find(c => ctx.inventoryOf(c.id).some(r => r.id === item.id));
    const answer = await dialog({
        title: room ? `More ${esc(e.type)} than the ${scopeWord()} needs` : `${esc(e.type)} is already at its total`,
        bodyHtml: `<p>The master list asks for <b>${e.qty}</b> × <b>${esc(e.type)}</b>.</p>
            <p>The other rows already hold <b>${others.placed}</b>${others.by.length ? ` <span class="pp-tm-dialog-dim">(${esc(byText(others.by))})</span>` : ''}.</p>
            <p>This row${mine ? ` in Cast ${esc(mine.casting_number || '?')}` : ''} asks for <b>${nextQ}</b>, which makes <b>${total}</b>: <b class="pp-tm-dialog-over">${over} over</b>.</p>
            <p class="pp-tm-dialog-note">Extras are cast on purpose on top of the total and are numbered TYPE.EXTRA on the Tracking tab.</p>`,
        buttons: [
            { label: 'Cancel', value: 'cancel' },
            { label: `Raise the master total to ${total}`, value: 'raise' },
            { label: room ? `Keep ${room} + make ${over} extra${over === 1 ? '' : 's'}` : (over === 1 ? 'Make it an extra' : `Make all ${over} extras`), kind: 'primary', value: 'split' }
        ]
    });
    if (answer === 'split') return { action: 'split', quantity: room, extras: extrasOf(next) + over };
    if (answer === 'raise') { mutate(opSet(e.id, { qty: total }, { ...e })); setMasterDom(e.id, 'qty', total); return { action: 'ok' }; }
    return { action: 'cancel' };
}

/**
 * The same check for a Paste (copied or cut rows about to be added to a casting): every type the paste would take
 * past its master total is listed and the PM picks: cancel, raise the totals, or paste the surplus as extras.
 * @param {Array<Object>} items the clipboard rows (type, quantity, extras, …) — never changed here
 * @param {Object} [casting] the casting being pasted into (for the wording)
 * @returns {Promise<{action:'cancel'}|{action:'ok', items:Array<Object>, commit?:Function}>} items = the rows to
 *   create; commit (only after "raise the totals") is called by the page once the paste is really going ahead, so
 *   a paste refused by the tracking-mark guard never leaves a raised total behind.
 */
export async function typeMasterPasteCheck(items, casting) {
    if (!typeMasterActive() || !Array.isArray(items) || !items.length) return { action: 'ok', items };
    const pasteQ = (it) => { const n = parseInt(it?.quantity, 10); return Number.isFinite(n) && n >= 0 ? n : 1; };   // a blank quantity is saved as 1
    const adding = new Map();                                    // master entry id -> { e, add }
    for (const it of items) {
        const e = findType(it.type);
        if (!e || !(e.qty > 0)) continue;
        const q = pasteQ(it);
        if (!q) continue;
        if (!adding.has(e.id)) adding.set(e.id, { e, add: 0 });
        adding.get(e.id).add += q;
    }
    const over = [];
    for (const { e, add } of adding.values()) {
        const u = usage(e.type);
        if (u.placed + add > e.qty) over.push({ e, add, placed: u.placed, room: Math.max(0, e.qty - u.placed), total: u.placed + add });
    }
    if (!over.length) return { action: 'ok', items };
    over.sort((a, b) => natural(a.e.type, b.e.type));
    const surplus = over.reduce((n, o) => n + (o.add - o.room), 0);
    const one = over.length === 1;
    const answer = await dialog({
        title: one ? `This paste takes ${esc(over[0].e.type)} past its total` : `This paste takes ${over.length} types past their totals`,
        bodyHtml: `<p>Pasting into Cast ${esc(casting?.casting_number || '?')}:</p>
            ${over.map(o => `<p><b>${esc(o.e.type)}</b>: the master list asks for <b>${o.e.qty}</b>, the castings already hold <b>${o.placed}</b>, the paste adds <b>${o.add}</b>: <b class="pp-tm-dialog-over">${o.total - o.e.qty} over</b>.</p>`).join('')}
            <p class="pp-tm-dialog-note">Extras are cast on purpose on top of the total and are numbered TYPE.EXTRA on the Tracking tab.</p>`,
        buttons: [
            { label: 'Cancel', value: 'cancel' },
            { label: one ? `Raise the master total to ${over[0].total}` : 'Raise the master totals', value: 'raise' },
            { label: `Paste, the ${surplus} over as extra${surplus === 1 ? '' : 's'}`, kind: 'primary', value: 'split' }
        ]
    });
    if (answer === 'raise') {
        return { action: 'ok', items, commit: () => {
            for (const o of over) { mutate(opSet(o.e.id, { qty: o.total }, { ...o.e })); setMasterDom(o.e.id, 'qty', o.total); }
            refreshTypeMasterStatus();
        } };
    }
    if (answer !== 'split') return { action: 'cancel' };
    const room = new Map(over.map(o => [o.e.id, o.room]));
    const out = items.map(it => {
        const e = findType(it.type);
        if (!e || !room.has(e.id)) return it;
        const q = pasteQ(it), keep = Math.min(q, room.get(e.id));
        room.set(e.id, room.get(e.id) - keep);
        return keep === q ? it : { ...it, quantity: keep, extras: extrasOf(it) + (q - keep) };
    });
    return { action: 'ok', items: out };
}

// ---------------------------------------------------------------- the type dropdown of a casting row

/** The Type cell of a casting row once the list is in use; null while the job has no list (plain text box then). */
export function typeCellHtml(item, cls, titleAttr = '') {
    if (!typeMasterActive()) return null;
    const cur = String(item.type || '').trim();
    const list = named().slice().sort((a, b) => natural(a.type, b.type));
    const hit = cur ? list.find(e => norm(e.type) === norm(cur)) : null;
    const opts = [`<option value=""${cur ? '' : ' selected'}>${cur ? '(no type)' : '— Pick type —'}</option>`];
    for (const e of list) { const mine = e === hit, v = mine ? cur : e.type; opts.push(`<option value="${esc(v)}"${mine ? ' selected' : ''}>${esc(v)}</option>`); }
    if (cur && !hit) opts.push(`<option value="${esc(cur)}" selected data-off="1">${esc(cur)}</option>`);
    opts.push(`<option value="${TM_NEW}">+ Create a type…</option>`);
    const off = cur && !hit;
    return `<select class="${cls} pp-inv-type-select${off ? ' pp-inv-type-off' : ''}" data-field="type"${titleAttr || (off ? ` title="${esc(cur)} is not on the type master list"` : '')}>${opts.join('')}</select>`;
}
function longLabel(o) {
    if (o.value === '' || o.value === TM_NEW) return null;
    if (o.dataset.off) return `${o.value} · not on the master list`;
    const e = findType(o.value);
    if (!e || !(e.qty > 0)) return null;
    const left = e.qty - usage(e.type).placed;
    return left > 0 ? `${o.value} · ${left} left of ${e.qty}` : left === 0 ? `${o.value} · all ${e.qty} placed` : `${o.value} · ${-left} over ${e.qty}`;
}
function showLong(sel, on) {
    for (const o of sel.options) {
        if (on) { const long = longLabel(o); if (long) { if (!o.dataset.short) o.dataset.short = o.text; o.text = long; } }
        else if (o.dataset.short) { o.text = o.dataset.short; delete o.dataset.short; }
    }
}
/** A type was chosen on a casting row: create it if asked, fill the row from the master, then save the row. */
async function commitTypePick(sel) {
    clearTimeout(sel._tmTimer); sel._tmTimer = null;
    let row = sel.closest('.pp-inv-row[data-inventory-id]');
    if (!row) return;
    const itemId = row.getAttribute('data-inventory-id'), castingId = row.getAttribute('data-casting-id');
    if (sel.value === (sel.dataset.tmPrev ?? '')) return;
    if (sel.value === TM_NEW) {
        sel.value = sel.dataset.tmPrev ?? '';
        const made = await askNewType();
        if (!made) return;
        ctx.renderCastings();                                        // every dropdown learns the new type
        sel = document.querySelector(`.pp-inv-row[data-inventory-id="${CSS.escape(itemId)}"] select[data-field="type"]`);
        if (!sel || sel.disabled) return;
        row = sel.closest('.pp-inv-row');
        sel.dataset.before = sel.value;
        sel.value = [...sel.options].find(o => norm(o.value) === norm(made.type))?.value ?? sel.value;
    }
    showLong(sel, false);
    // The row takes what the master knows about the new type. A value the row only had because of its PREVIOUS
    // type (it equals that type's master value) is cleared when the new type has none: it was never this type's.
    const e = findType(sel.value), old = findType(sel.dataset.tmPrev);
    if (e) for (const f of SYNC_FIELDS) {
        const el = row.querySelector(`[data-field="${f}"]`);
        if (!el || el.disabled) continue;
        if (!blank(e[f])) el.value = e[f];
        else if (old && old !== e && !blank(old[f]) && sameVal(el.value, old[f]) && f !== 'color_log_id') el.value = '';
        else continue;
        el.dataset.tmBefore = el.value;
    }
    sel.classList.toggle('pp-inv-type-off', !!sel.selectedOptions[0]?.dataset.off);
    try { ctx.recordEdit(sel); } catch (_) { /* marks are optional */ }
    sel.dataset.tmPrev = sel.value;
    ctx.saveRow(itemId, castingId);
}

// ---------------------------------------------------------------- wiring

/**
 * @param {Object} c page hooks: castings() (those of the active phase on a phased job), scope(), inventoryOf(id), colorLogs(), colorSelectHtml(id, opts), isFinal(castingId),
 *   updateItem(rowId, fields), editBlocked(casting, mutate), afterChange(castingId), syncTracking(), renderCastings(),
 *   saveRow(rowId, castingId), recordEdit(el), toast(msg, kind, ms), escapeHtml(s), trackSave(promise)
 */
export function initTypeMaster(c) {
    ctx = c;
    const wrap = document.getElementById('pp-type-master');
    const list = document.getElementById('pp-castings-list');
    if (!wrap || !list || wrap.dataset.tmWired) return;
    wrap.dataset.tmWired = '1';

    wrap.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-tm]');
        if (!b) return;
        const what = b.dataset.tm;
        if (what === 'lock') { setLocked(unlocked); return; }
        if (what !== 'toggle' && !unlocked) return;
        if (what === 'toggle') { openState = !(openState ?? (types.length <= OPEN_LIMIT)); if (wrap.contains(document.activeElement)) document.activeElement.blur(); renderTypeMaster(); }
        else if (what === 'add') addBlankRow();
        else if (what === 'build') buildFromCastings();
        else if (what === 'del') removeType(b.closest('.pp-tm-row')?.dataset.tmId);
    });
    wrap.addEventListener('change', (ev) => { if (ev.target.matches('[data-tm-field]')) commitMasterField(ev.target); });
    for (const kind of ['keydown', 'input', 'change', 'click', 'paste']) wrap.addEventListener(kind, touchLock, true);   // work on the list keeps it open
    // Nothing moves under the cursor while a line is typed; once the cursor has left the list it is put back in order.
    wrap.addEventListener('focusout', (ev) => {
        if (!ev.target.matches?.('[data-tm-field]')) return;
        setTimeout(() => {
            if (wrap.contains(document.activeElement)) return;
            const onScreen = [...wrap.querySelectorAll('.pp-tm-row[data-tm-id]')].map(r => r.dataset.tmId).join('|');
            if (onScreen !== shown().map(e => e.id).join('|')) renderTypeMaster();
        }, 0);
    });
    wrap.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Enter' || ev.shiftKey || ev.ctrlKey || ev.altKey || !ev.target.matches('[data-tm-field]')) return;
        ev.preventDefault();
        const row = ev.target.closest('.pp-tm-row'), f = ev.target.dataset.tmField;
        const next = row.nextElementSibling?.matches?.('.pp-tm-row[data-tm-id]') ? row.nextElementSibling : null;
        if (next) { const t = next.querySelector(`[data-tm-field="${f}"]`); t?.focus(); t?.select?.(); return; }
        ev.target.blur();                                            // commits the box that was being typed in
        const last = types.find(x => x.id === row.dataset.tmId);
        if (last && blank(last.type)) { row.querySelector('[data-tm-field="type"]')?.focus(); return; }
        addBlankRow();
    });
    wrap.addEventListener('paste', (ev) => {
        if (!ev.target.matches('[data-tm-field="type"]')) return;
        const text = ev.clipboardData?.getData('text') || '';
        if (!/[\t\n]/.test(text.trim())) return;                    // a single word: an ordinary paste
        ev.preventDefault();
        pasteList(text, ev.target.closest('.pp-tm-row')?.dataset.tmId);
    });

    // Casting rows: the type dropdown, and boxes whose value follows across the castings.
    const isTypeSel = (el) => el.matches?.('.pp-inv-row[data-inventory-id] select[data-field="type"]');
    const isSyncBox = (el) => el.matches?.('.pp-inv-row[data-inventory-id] [data-field]') && SYNC_FIELDS.includes(el.dataset.field);
    list.addEventListener('focusin', (ev) => {
        if (isTypeSel(ev.target)) { if (ev.target.dataset.tmPrev === undefined) ev.target.dataset.tmPrev = ev.target.value; showLong(ev.target, true); }
        else if (isSyncBox(ev.target)) ev.target.dataset.tmBefore = ev.target.value;
    });
    list.addEventListener('keydown', (ev) => { if (isTypeSel(ev.target)) { ev.target._tmKeyAt = performance.now(); ev.target._tmKey = ev.key; } });
    list.addEventListener('change', (ev) => {
        const el = ev.target;
        if (isTypeSel(el)) {
            // Arrow keys / typing on a closed dropdown change the value at every key: wait until the typing stops.
            const typing = el._tmKeyAt && performance.now() - el._tmKeyAt < 250 && el._tmKey !== 'Enter' && el._tmKey !== 'Tab';
            clearTimeout(el._tmTimer);
            if (typing) el._tmTimer = setTimeout(() => commitTypePick(el), 900); else commitTypePick(el);
            return;
        }
        if (isSyncBox(el) && el.dataset.tmBefore !== undefined) {
            const row = el.closest('.pp-inv-row[data-inventory-id]');
            const before = el.dataset.tmBefore;
            el.dataset.tmBefore = el.value;
            rowFieldCommitted(row.getAttribute('data-inventory-id'), row.getAttribute('data-casting-id'), el.dataset.field, before, el.value);
        }
    });
    list.addEventListener('focusout', (ev) => {
        if (!isTypeSel(ev.target)) return;
        if (ev.target._tmTimer) commitTypePick(ev.target); else showLong(ev.target, false);
    });
}
