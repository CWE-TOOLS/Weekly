/**
 * Finishing & sealing products off the Color Log notes, at the shop rates (2026-11-06).
 *
 * Ported from the Raw Material Estimator (Custom Tools\Raw Material Estimator\index.html, FIN_CAT + finishingFor):
 * the log's finishing and sealing notes decide what is needed, item by item — acid wash, Sure Klean, Super Blue,
 * black buffing pad, #200 and #400 resin pads, epoxy, H-13 sealer. An item the log does not name is not counted.
 * Shop rates set 2026-11-04: acid 20 gal and Sure Klean 2.5 gal per 300 sq ft of face; #200 / #400 pads 2 per
 * 220 sq ft (= 110 sq ft a pad); epoxy two-part kit 150 g hardener + 300 g epoxy per 55 sq ft at 4,200 g a gal;
 * H-13 two-part kit 12 oz part A + 24 oz part B per 220 sq ft per coat, coats off the log ("4 coats"). Gallons and
 * pads round up to whole ones. The Mix Day Totals box shows this under the colour-log notes, before the scrim line.
 * 2026-11-24: "Black Pad" in a note (Fairfield: "Scrub Black Pad") is the black buffing pad too.
 *
 * Products and rates defined in the portal (2026-11-24). User: "super blue is showing up as a product, but ghost
 * shield and black pad is not. can you make it possible to define these products in the portal ... click 'set rate'
 * and then type in value, unit for product, and then value, unit for area ... that definition is stored and any job
 * that uses super blue uses that as the rate ... click on the product to see the rate and redefine ... also a button
 * to 'add missing product'". The definitions are ONE row of plant_schedule_settings, key "finishing_products":
 *   { v: 1, items: [{ id, name, words: [], amount, unit, area, areaUnit, perCoat, at }] }
 * id = a FIN_CAT key (the stored rate replaces the built-in rule; words are extra words that find it in the notes)
 * or "c_…" for a product added in the portal (found by its words, else by its name). Quantity = finished face /
 * area × amount (× the coats of the note when perCoat), rounded up to whole units. Every job reads the same row.
 *
 * @module services/finishing-products
 */

import { initializeSupabase, getSupabaseClient } from './supabase-service.js';
import { logger } from '../utils/logger.js';

export const FIN_CAT = [
    { key: 'acid',      label: 'Acid wash',               re: /acid/i,                                   unit: 'gal',  basis: 'per300', rate: 20,   ruleText: 'shop rate 20 gal per 300 sq ft of face' },
    { key: 'buffpad',   label: 'Black buffing pad',       re: /buff|black\s*pad/i,                       unit: 'pads', basis: 'cover',  rate: null, ruleText: 'sq ft of face one pad does' },
    { key: 'superblue', label: 'Super Blue',              re: /super\s*blue/i,                           unit: 'oz',   basis: 'per300', rate: null, ruleText: 'oz per 300 sq ft of face (the log mixes 2 oz to 1 gal of water)' },
    { key: 'sureklean', label: 'Sure Klean',              re: /sure\s*-?\s*klean/i,                      unit: 'gal',  basis: 'per300', rate: 2.5,  ruleText: 'shop rate 2.5 gal per 300 sq ft of face' },
    { key: 'pad200',    label: 'Resin pad #200 (grind)',  re: /^(?=.*\b200\b)(?=.*(pad|grind|resin))/i,  unit: 'pads', basis: 'cover',  rate: 110,  ruleText: 'shop rate 2 pads per 220 sq ft = 110 sq ft a pad' },
    { key: 'pad400',    label: 'Resin pad #400 (polish)', re: /^(?=.*\b400\b)(?=.*(pad|polish|resin))/i, unit: 'pads', basis: 'cover',  rate: 110,  ruleText: 'shop rate 2 pads per 220 sq ft = 110 sq ft a pad' },
    { key: 'epoxy',     label: 'Epoxy',                   re: /epoxy/i,                                  unit: 'gal',  basis: 'kit',    rate: 55,   kit: [{ name: 'hardener', amt: 150, unit: 'g' }, { name: 'epoxy', amt: 300, unit: 'g' }], gPerGal: 4200, ruleText: 'two-part kit 150 g hardener + 300 g epoxy per 55 sq ft, 4,200 g a gal' },
    { key: 'h13',       label: 'H-13 sealer',             re: /\bh\s*-?\s*13\b/i,                        unit: 'gal',  basis: 'kit',    rate: 220,  kit: [{ name: 'part A', amt: 12, unit: 'oz' }, { name: 'part B', amt: 24, unit: 'oz' }], askCoats: true, ruleText: 'two-part kit 12 oz part A + 24 oz part B per 220 sq ft per coat; coats off the log' },
];

const UNIT_GAL = { gal: 1, oz: 1 / 128, qt: 0.25, pt: 0.125, ml: 1 / 3785.41, l: 1 / 3.78541 };
const AREA_SQFT = { 'sq ft': 1, 'sq yd': 9, 'sq m': 10.7639 };
const UNIT_IDEAS = ['gal', 'qt', 'oz', 'lb', 'pads', 'kits', 'bags', 'each'];

function num(v, d = 0) { const n = Number(v); return Number.isFinite(n) ? n : d; }
function r2(v) { return String(Math.round(num(v) * 100) / 100); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function partGal(p, gPerGal) {
    const u = String(p.unit || '').toLowerCase();
    if (u === 'g' || u === 'gram' || u === 'grams') return num(p.amt) / Math.max(1, num(gPerGal, 4200));
    if (u === 'kg') return num(p.amt) * 1000 / Math.max(1, num(gPerGal, 4200));
    if (u === 'lb' || u === 'lbs') return num(p.amt) * 453.592 / Math.max(1, num(gPerGal, 4200));
    return num(p.amt) * (UNIT_GAL[u] != null ? UNIT_GAL[u] : 1);
}

// ---------------------------------------------------------------- the stored definitions (2026-11-24)
const TABLE = 'plant_schedule_settings';
/** A test copy sets window.__FINISHING_PRODUCTS_KEY so a rate tried there never becomes the shop's rate. */
const storeKey = () => (typeof window !== 'undefined' && window.__FINISHING_PRODUCTS_KEY) || 'finishing_products';
let defs = [];                  // the stored items, see the module comment

function cleanWords(v) {
    const list = Array.isArray(v) ? v : String(v ?? '').split(',');
    const out = [];
    for (const w of list) { const t = String(w ?? '').replace(/\s+/g, ' ').trim(); if (t && !out.some(x => x.toLowerCase() === t.toLowerCase())) out.push(t); }
    return out;
}
function cleanItems(value) {
    const list = Array.isArray(value?.items) ? value.items : [];
    const out = [];
    for (const d of list) {
        if (!d || typeof d !== 'object' || !d.id || out.some(x => x.id === d.id)) continue;
        const builtin = FIN_CAT.some(c => c.key === d.id);
        const name = String(d.name ?? '').replace(/\s+/g, ' ').trim();
        if (!builtin && !name) continue;
        const amount = num(d.amount), area = num(d.area);
        const rated = amount > 0 && area > 0;
        out.push({
            id: String(d.id), name, words: cleanWords(d.words),
            amount: rated ? amount : null, area: rated ? area : null,
            unit: String(d.unit ?? '').trim(), areaUnit: AREA_SQFT[d.areaUnit] ? d.areaUnit : 'sq ft',
            perCoat: !!d.perCoat, at: d.at || null,
        });
    }
    return out;
}
async function client() {
    if (!getSupabaseClient()) await initializeSupabase();
    const c = getSupabaseClient();
    if (!c) throw new Error('no database connection');
    return c;
}
async function readDefs() {
    const c = await client();
    const { data, error } = await c.from(TABLE).select('key, value').eq('key', storeKey());
    if (error) throw error;
    return cleanItems(data && data[0] ? data[0].value : null);
}
/** Read the stored products and rates. A failed read keeps what was read before (the built-in rules still count). */
export async function loadFinishingDefs() {
    try { defs = await readDefs(); } catch (err) { logger.error('[finishing] could not read the stored product rates (non-fatal):', err); }
    return defs;
}
/** Change the stored list: read it fresh, apply, save — so two people defining different products keep both. */
async function saveDefs(change) {
    const list = await readDefs();
    change(list);
    const c = await client();
    const { error } = list.length
        ? await c.from(TABLE).upsert({ key: storeKey(), value: { v: 1, items: list }, updated_at: new Date().toISOString() }, { onConflict: 'key' })
        : await c.from(TABLE).delete().eq('key', storeKey());
    if (error) throw error;
    defs = list;
}

/** Words as typed -> one test for a note segment ("Ghost Shield" also finds "ghost-shield", "GHOSTSHIELD", "ghost shields"). */
function wordsRe(words) {
    const parts = cleanWords(words).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[\s-]+/g, '[\\s-]*'));
    return parts.length ? new RegExp('(^|[^a-z0-9])(' + parts.join('|') + ')', 'i') : null;
}
/** Every product the notes can name: the built-in ones (with their stored rate / extra words) + the ones added in the portal. */
function catalog() {
    const by = new Map(defs.map(d => [d.id, d]));
    const out = FIN_CAT.map(c => {
        const d = by.get(c.key) || null;
        return { ...c, id: c.key, builtin: true, def: d, extraRe: d ? wordsRe(d.words) : null };
    });
    for (const d of defs) {
        if (FIN_CAT.some(c => c.key === d.id)) continue;
        out.push({ key: d.id, id: d.id, label: d.name, re: wordsRe(d.words.length ? d.words : [d.name]), unit: d.unit, builtin: false, def: d });
    }
    return out;
}
const rated = d => !!d && num(d.amount) > 0 && num(d.area) > 0;
const rateText = d => `${r2(d.amount)} ${d.unit} for ${r2(d.area)} ${d.areaUnit}${d.perCoat ? ', per coat' : ''}`;
function noteSegments(logs) {
    const out = [];
    for (const log of logs || []) {
        const text = [log.finishingNotes || log.finishing_notes || '', log.sealingNotes || log.sealing_notes || ''].join('\n');
        for (const seg of text.split(/\s\/\s|\n|;/).map(x => x.trim()).filter(Boolean)) out.push(seg);
    }
    return out;
}

/** Finished-face sq ft of a casting's inventory rows: ff_sq_ft × (quantity + extras), as the scrim line counts it. */
export function faceSqFtOfInventory(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const has = v => v !== null && v !== undefined && v !== '';
    const units = r => (parseInt(r.quantity, 10) || 0) + (parseInt(r.extras, 10) || 0);
    return {
        face: list.reduce((sum, r) => sum + (Number(r.ff_sq_ft) || 0) * units(r), 0),
        partial: list.length > 0 && !list.every(r => has(r.ff_sq_ft)),
    };
}

/** The products the given colour logs' finishing + sealing notes name, with the note segments that named them. */
export function finishingItems(logs) {
    const cat = catalog();
    const found = {};
    for (const seg of noteSegments(logs)) {
        for (const c of cat) {
            if (!(c.re && c.re.test(seg)) && !(c.extraRe && c.extraRe.test(seg))) continue;
            const it = found[c.key] || (found[c.key] = { ...c, notes: [] });
            if (!it.notes.includes(seg)) it.notes.push(seg);
            const m = seg.match(/(\d+)\s*coats?/i);
            if (m) it.coatsNote = num(m[1]);
        }
    }
    return cat.filter(c => found[c.key]).map(c => found[c.key]);
}
/** The note lines no product claims (2026-11-24): offered next to "Add missing product". */
export function finishingUnmatched(logs) {
    const cat = catalog();
    const out = [];
    for (const seg of noteSegments(logs)) {
        if (cat.some(c => (c.re && c.re.test(seg)) || (c.extraRe && c.extraRe.test(seg)))) continue;
        if (/:$/.test(seg)) continue;                              // a heading of the note ("Grind and Fill:"), not a product
        if (!out.some(x => x.toLowerCase() === seg.toLowerCase())) out.push(seg);
    }
    return out;
}

/** The quantity a stored rate gives for `ff` sq ft: { qty, exact, how, coats }. */
function storedQty(d, ff, coatsNote) {
    const per = AREA_SQFT[d.areaUnit] || 1;
    const coats = d.perCoat ? Math.max(1, num(coatsNote, 1)) : 1;
    const exact = ff * coats / (num(d.area) * per) * num(d.amount);
    const areaWord = per === 1 ? `${r2(ff)} sq ft` : `${r2(ff)} sq ft (${r2(ff / per)} ${d.areaUnit})`;
    return {
        qty: Math.ceil(exact - 1e-9), exact, coats,
        how: `${areaWord}${coats > 1 ? ' × ' + coats + ' coats' : ''} / ${r2(d.area)} ${d.areaUnit} × ${r2(d.amount)} ${d.unit} = ${r2(exact)}, rounded up`,
    };
}

/** Quantities for `face` sq ft of finished face: [{ id, label, unit, qty, how, noRate, notes, rateText }]. */
export function finishingRows(logs, face, groups = null) {
    const whole = Math.max(0, num(face));
    // "Job" totals (2026-11-24): groups = one { logs, face } per casting; a product is counted for the face of
    // the castings whose own notes name it, so a colour that is not sealed adds nothing to the sealer.
    const keysOf = groups ? groups.map(g => new Set(finishingItems(g.logs).map(x => x.key))) : null;
    return finishingItems(logs).map(src => {
        const ff = groups ? groups.reduce((sum, g, i) => sum + (keysOf[i].has(src.key) ? Math.max(0, num(g.face)) : 0), 0) : whole;
        const it = { ...src, ff };
        if (rated(it.def)) {                                       // a rate stored in the portal: it replaces the built-in rule
            const s = storedQty(it.def, ff, it.coatsNote);
            return { ...it, unit: it.def.unit, qty: s.qty, how: s.how, parts: [], noRate: false, coats: s.coats, rateText: rateText(it.def), stored: true };
        }
        const rate = num(it.rate);
        const coats = it.askCoats ? Math.max(1, num(it.coatsNote, 1)) : 1;
        let qty = null, how = '', parts = [];
        if (!(rate > 0)) return { ...it, qty: null, how: 'no rate stored yet', noRate: true, coats, rateText: '' };
        if (it.basis === 'kit') {
            const kits = ff * coats / rate;
            parts = (it.kit || []).map(p => ({ ...p, galEach: partGal(p, it.gPerGal), gal: kits * partGal(p, it.gPerGal) }));
            const exact = parts.reduce((a, p) => a + p.gal, 0);
            qty = Math.ceil(exact - 1e-9);
            how = `${r2(ff)} sq ft${coats > 1 ? ' × ' + coats + ' coats' : ''} / ${rate} sq ft per kit = ${r2(kits)} kits; `
                + parts.map(p => `${p.name} ${p.amt} ${p.unit} a kit = ${r2(p.gal)} gal`).join(', ')
                + `; A + B = ${r2(exact)} gal, rounded up`;
        } else if (it.basis === 'per300') {
            qty = ff / 300 * rate;
            how = `${r2(ff)} sq ft / 300 × ${rate}`;
            if (it.unit === 'gal') { how += ` = ${r2(qty)}, rounded up`; qty = Math.ceil(qty - 1e-9); }
            else qty = Math.round(qty * 100) / 100;
        } else {
            qty = ff * coats / rate;
            how = `${r2(ff)} sq ft${coats > 1 ? ' × ' + coats + ' coats' : ''} / ${rate} sq ft per ${it.unit === 'pads' ? 'pad' : 'gal'} = ${r2(qty)}, rounded up`;
            qty = Math.ceil(qty - 1e-9);
        }
        return { ...it, qty, how, parts, noRate: false, coats, rateText: it.ruleText };
    });
}

/**
 * The block for the Mix Day Totals box. Empty string when the logs have no finishing / sealing notes at all.
 * A product name is a button (see or change its rate); "rate not set" comes with "Set rate"; the note lines no
 * product claims are listed with "+ Add missing product" (initFinishingEditor() answers the clicks).
 * @param {Array<Object>} logs - colour logs with finishingNotes / sealingNotes
 * @param {number} face - finished-face sq ft of the casting
 * @param {{cls?: string, partial?: boolean, groups?: Array<{logs: Array<Object>, face: number}>, scope?: string, count?: number}} [opts] -
 *   cls: CSS class prefix ('pp-bt-totals-fin' on the portal, 'totals-fin' on the Jane page); groups + scope ('job' | 'phase')
 *   + count: the totals box is on "Job" (2026-11-24), one group per counted casting, `face` their sum
 */
export function finishingProductsHtml(logs, face, { cls = 'pp-bt-totals-fin', partial = false, groups = null, scope = '', count = 0 } = {}) {
    if (!noteSegments(logs).length) return '';
    ensureStyle();
    const rows = finishingRows(logs, face, groups);
    const scopeText = scope ? ` (the ${scope}, ${count} ${count === 1 ? 'casting' : 'castings'})` : '';
    const missing = finishingUnmatched(logs);
    const ff = Math.max(0, num(face));
    const lines = rows.map(r => {
        const qty = r.noRate
            ? `<span class="${cls}-norate">rate not set</span> <button type="button" class="finp-set" data-finp-edit="${esc(r.id)}">Set rate</button>`
            : `<b>${esc(r2(r.qty))} ${esc(r.unit)}</b>`;
        const tip = r.noRate ? 'No rate yet — click to set it' : `${r.rateText} — click to see or change the rate`;
        const how = r.noRate ? '' : ` <span class="${cls}-how">— ${esc(r.how)}</span>`;
        return `<li class="${cls}-row" data-finp-face="${esc(r2(r.ff))}"><button type="button" class="${cls}-label finp-name" data-finp-edit="${esc(r.id)}" title="${esc(tip)}">${esc(r.label)}</button>: ${qty}${how}<span class="${cls}-note">from the log: “${esc(r.notes.join(' / '))}”</span></li>`;
    }).join('');
    const chips = missing.map(seg => `<button type="button" class="finp-chip" data-finp-add="${esc(seg)}" title="Add this as a product with its rate">“${esc(seg)}”</button>`).join(' ');
    return `<div class="${cls}" data-finp-face="${esc(r2(ff))}" data-finp-scope="${esc(scope)}">
        <div class="${cls}-title">Finishing &amp; sealing products — from the Color Log notes, for ${esc(r2(ff))} sq ft of finished face${esc(scopeText)}${partial ? ' (some inventory rows have no FF sq ft yet)' : ''}</div>
        ${lines ? `<ul class="${cls}-list">${lines}</ul>` : ''}
        <div class="finp-missing">${missing.length ? `<span class="finp-missing-label">Not counted, no product for:</span> ${chips} ` : ''}<button type="button" class="finp-add" data-finp-add="">+ Add missing product</button></div>
        <div class="${cls}-foot">Click a product to see or change its rate. A rate is stored once and used by every job. Quantities are rounded up to whole units.</div>
    </div>`;
}

// ---------------------------------------------------------------- the rate pop-up (2026-11-24)
// Lives here (not in a page) because two pages show the block: the portal's Batch Tickets tab and the Jane Street
// batching page. It is placed next to the clicked product instead of the middle of the window: the Jane page runs
// inside a frame as tall as its content, where "the middle" can be far off screen.

const STYLE = `
.finp-name { font: inherit; font-weight: 600; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline dotted #94a3b8; text-underline-offset: 3px; }
.finp-name:hover { color: #0f766e; text-decoration-color: #0f766e; }
.finp-set, .finp-add, .finp-chip { font: inherit; font-size: 12px; cursor: pointer; border-radius: 999px; padding: 1px 9px; }
.finp-set { border: 1px solid #b45309; background: #fffbeb; color: #92400e; font-weight: 700; }
.finp-set:hover { background: #fef3c7; }
.finp-add { border: 1px solid #0f766e; background: #f0fdfa; color: #0f766e; font-weight: 700; }
.finp-add:hover { background: #ccfbf1; }
.finp-chip { border: 1px dashed #94a3b8; background: #fff; color: #334155; }
.finp-chip:hover { border-color: #0f766e; color: #0f766e; }
.finp-missing { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 5px; align-items: center; font-size: 12px; }
.finp-missing-label { color: #64748b; }
.finp-veil { position: fixed; inset: 0; z-index: 99990; background: rgba(15, 23, 42, .18); }
.finp-pop { position: absolute; z-index: 99991; width: 430px; max-width: calc(100vw - 16px); box-sizing: border-box; background: #fff; color: #0f172a; border: 1px solid #94a3b8; border-radius: 10px; box-shadow: 0 12px 34px rgba(15, 23, 42, .28); padding: 14px 16px; font: 13px/1.4 'Segoe UI', Arial, sans-serif; text-align: left; }
.finp-pop h3 { margin: 0 0 10px; font-size: 15px; }
.finp-pop label { display: block; font-size: 11.5px; font-weight: 700; color: #475569; margin: 8px 0 3px; text-transform: uppercase; letter-spacing: .3px; }
.finp-pop [hidden] { display: none !important; }
.finp-pop input[type="text"], .finp-pop input[type="number"], .finp-pop select { font: inherit; padding: 5px 7px; border: 1px solid #94a3b8; border-radius: 6px; background: #fff; color: #0f172a; box-sizing: border-box; }
.finp-pop .finp-wide { width: 100%; }
.finp-rate { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.finp-rate input[type="number"] { width: 78px; }
.finp-rate input[type="text"] { width: 90px; }
.finp-hint { color: #64748b; font-size: 11.5px; margin-top: 3px; }
.finp-pop label.finp-coat { display: flex; gap: 6px; align-items: flex-start; margin-top: 9px; font-size: 12.5px; text-transform: none; letter-spacing: 0; font-weight: 400; color: #0f172a; }
.finp-built { margin-top: 9px; padding: 6px 8px; background: #f1f5f9; border-radius: 6px; font-size: 12px; color: #334155; }
.finp-preview { margin-top: 9px; padding: 6px 8px; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 6px; font-size: 12.5px; min-height: 18px; }
.finp-err { margin-top: 8px; color: #b91c1c; font-weight: 600; font-size: 12.5px; }
.finp-btns { display: flex; gap: 8px; align-items: center; margin-top: 12px; }
.finp-btns button { font: inherit; font-weight: 700; padding: 6px 13px; border-radius: 7px; cursor: pointer; border: 1px solid #94a3b8; background: #fff; color: #0f172a; }
.finp-btns .finp-save { background: #0f766e; border-color: #0f766e; color: #fff; }
.finp-btns .finp-danger { margin-left: auto; border-color: #fca5a5; color: #b91c1c; font-weight: 600; }
.finp-btns button:disabled { opacity: .55; cursor: default; }
@media print { .finp-missing, .finp-set, .finp-veil, .finp-pop { display: none !important; } .finp-name { text-decoration: none; } }
`;
function ensureStyle() {
    if (typeof document === 'undefined' || document.getElementById('finp-style')) return;
    const st = document.createElement('style');
    st.id = 'finp-style';
    st.textContent = STYLE;
    document.head.appendChild(st);
}

let editorOpts = null;
let popClose = null;

/**
 * Answer the clicks of the block (once per page).
 * @param {{ onChange?: Function, toast?: (msg: string, kind?: string) => void }} opts - onChange: redraw the totals after a save
 */
export function initFinishingEditor(opts = {}) {
    const first = !editorOpts;
    editorOpts = opts;
    if (!first || typeof document === 'undefined') return;
    ensureStyle();
    document.addEventListener('click', (e) => {
        const btn = e.target.closest && e.target.closest('[data-finp-edit], [data-finp-add]');
        if (!btn) return;
        e.preventDefault();
        const face = num(btn.closest('[data-finp-face]')?.dataset.finpFace, 0);
        const scope = btn.closest('[data-finp-scope]')?.dataset.finpScope || '';     // 'job' | 'phase' while the totals box adds up more than the casting
        if (btn.hasAttribute('data-finp-edit')) openPop(btn, { id: btn.getAttribute('data-finp-edit'), face, scope });
        else openPop(btn, { id: null, name: btn.getAttribute('data-finp-add') || '', face, scope });
    });
}

function sayToast(msg, kind = 'success') { try { editorOpts?.toast?.(msg, kind); } catch (err) { /* a toast never blocks a save */ } }
function changed() { try { editorOpts?.onChange?.(); } catch (err) { logger.warn('[finishing] redraw after a rate change failed:', err); } }

/** What the pop-up starts with for a built-in product that has no stored rate: its shop rule, where it is one number. */
function builtinStart(c) {
    if (!(num(c.rate) > 0)) return { amount: '', unit: '', area: '', perCoat: false };          // no rate yet: nothing assumed, the unit is picked
    if (c.basis === 'per300') return { amount: c.rate, unit: c.unit, area: 300, perCoat: false };
    if (c.basis === 'cover') return { amount: 1, unit: c.unit, area: c.rate, perCoat: false };
    return { amount: '', unit: c.unit, area: '', perCoat: !!c.askCoats };          // two-part kit: no single number to show
}

function openPop(anchor, { id, name = '', face = 0, scope = '' }) {
    if (popClose) popClose();
    const what = scope === 'job' || scope === 'phase' ? scope : 'casting';
    const cat = id ? catalog().find(c => c.id === id) : null;
    if (id && !cat) { sayToast('That product is no longer on the list. The page is refreshed.', 'info'); changed(); return; }
    const d = cat?.def || null;
    const builtin = !!cat?.builtin;
    const start = rated(d) ? d : (builtin ? builtinStart(cat) : { amount: '', unit: 'gal', area: '', perCoat: false });
    const kit = builtin && cat.basis === 'kit';
    const otherUnit = !!start.unit && !UNIT_IDEAS.includes(start.unit);        // a unit that is not on the short list: typed
    const title = !cat ? 'Add missing product' : `${cat.label} — rate`;
    const words = d ? d.words.join(', ') : '';
    const veil = document.createElement('div');
    veil.className = 'finp-veil';
    const pop = document.createElement('div');
    pop.className = 'finp-pop';
    pop.setAttribute('role', 'dialog');
    pop.innerHTML = `
        <h3>${esc(title)}</h3>
        ${builtin ? '' : `<label for="finp-name">Product name</label><input type="text" id="finp-name" class="finp-wide" maxlength="60" value="${esc(cat ? cat.label : name)}" placeholder="e.g. Ghost Shield">`}
        <label>Rate</label>
        <div class="finp-rate">
            <input type="number" id="finp-amount" min="0" step="any" value="${esc(start.amount ?? '')}" placeholder="1" aria-label="Amount of product">
            <select id="finp-unit-pick" aria-label="Unit of the product">
                <option value=""${start.unit ? '' : ' selected'}>unit…</option>
                ${UNIT_IDEAS.map(u => `<option${start.unit === u ? ' selected' : ''}>${u}</option>`).join('')}
                <option value="__other"${otherUnit ? ' selected' : ''}>other…</option>
            </select>
            <input type="text" id="finp-unit" maxlength="12" value="${esc(otherUnit ? start.unit : '')}" placeholder="type the unit" aria-label="Unit of the product, typed"${otherUnit ? '' : ' hidden'}>
            <span>for</span>
            <input type="number" id="finp-area" min="0" step="any" value="${esc(start.area ?? '')}" placeholder="300" aria-label="Area">
            <select id="finp-area-unit" aria-label="Unit of the area">${Object.keys(AREA_SQFT).map(u => `<option${(start.areaUnit || 'sq ft') === u ? ' selected' : ''}>${u}</option>`).join('')}</select>
        </div>
        <div class="finp-hint">Example: 1 gal for 300 sq ft of finished face.</div>
        <label class="finp-coat"><input type="checkbox" id="finp-coat"${start.perCoat ? ' checked' : ''}> <span>The rate is for one coat — a note that says “2 coats” doubles it</span></label>
        <label for="finp-words">${builtin ? 'Also found in the notes by (optional)' : 'Found in the Color Log notes by'}</label>
        <input type="text" id="finp-words" class="finp-wide" maxlength="160" value="${esc(words)}" placeholder="${builtin ? 'extra words, e.g. another spelling' : 'the product name — or other words, comma between'}">
        ${builtin && num(cat.rate) > 0 ? `<div class="finp-built">${rated(d) ? 'Stored rate in use. The built-in shop rule was' : 'Built-in shop rule in use'}: ${esc(cat.ruleText)}.${kit && !rated(d) ? ' A rate typed here replaces the two-part kit math.' : ''}</div>` : ''}
        <div class="finp-preview" id="finp-preview"></div>
        <div class="finp-err" id="finp-err" hidden></div>
        <div class="finp-btns">
            <button type="button" class="finp-save" id="finp-save">Save rate</button>
            <button type="button" id="finp-cancel">Cancel</button>
            ${builtin && d ? `<button type="button" class="finp-danger" id="finp-reset" title="Forget the stored rate and extra words of this product">${num(cat.rate) > 0 ? 'Back to the built-in rule' : 'Remove the rate'}</button>` : ''}
            ${!builtin && cat ? '<button type="button" class="finp-danger" id="finp-delete" title="No job counts this product any more">Delete product</button>' : ''}
        </div>`;
    document.body.appendChild(veil);
    document.body.appendChild(pop);
    const $ = sel => pop.querySelector(sel);

    // next to the clicked product; above it when there is no room below (the Jane page's frame ends with its content)
    const r = anchor.getBoundingClientRect();
    const docW = document.documentElement.clientWidth;
    const docH = Math.max(document.documentElement.scrollHeight, document.documentElement.clientHeight);
    const left = Math.max(8, Math.min(r.left + window.scrollX, window.scrollX + docW - pop.offsetWidth - 8));
    let top = r.bottom + window.scrollY + 6;
    if (top + pop.offsetHeight > docH - 8) top = Math.max(8, r.top + window.scrollY - pop.offsetHeight - 6);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
    try { pop.scrollIntoView({ block: 'nearest' }); } catch (err) { /* older browsers */ }

    const unitNow = () => ($('#finp-unit-pick').value === '__other' ? String($('#finp-unit').value || '').trim() : $('#finp-unit-pick').value);
    $('#finp-unit-pick').addEventListener('change', () => {
        const other = $('#finp-unit-pick').value === '__other';
        $('#finp-unit').hidden = !other;
        if (other) $('#finp-unit').focus();
    });
    const read = () => ({
        name: builtin ? cat.label : String($('#finp-name').value || '').replace(/\s+/g, ' ').trim(),
        amount: num($('#finp-amount').value, 0), unit: unitNow(),
        area: num($('#finp-area').value, 0), areaUnit: $('#finp-area-unit').value,
        perCoat: $('#finp-coat').checked, words: cleanWords($('#finp-words').value),
        blankRate: String($('#finp-amount').value).trim() === '' && String($('#finp-area').value).trim() === '',
    });
    const preview = () => {
        const v = read();
        const box = $('#finp-preview');
        if (!(v.amount > 0 && v.area > 0 && v.unit)) { box.textContent = builtin && v.blankRate && num(cat.rate) > 0 ? 'No stored rate: the built-in shop rule is used.' : `Type the rate to see what this ${what} needs.`; return; }
        const s = storedQty(v, face, 1);
        box.innerHTML = `This ${what}, ${esc(r2(face))} sq ft: <b>${esc(String(s.qty))} ${esc(v.unit)}</b> <span style="color:#475569">(${esc(r2(s.exact))}, rounded up${v.perCoat ? '; one coat' : ''})</span>`;
    };
    const fail = (msg) => { const el = $('#finp-err'); el.textContent = msg; el.hidden = false; };
    const busy = (on) => pop.querySelectorAll('button').forEach(b => { b.disabled = on; });
    const close = () => { document.removeEventListener('keydown', onKey, true); veil.remove(); pop.remove(); if (popClose === close) popClose = null; };
    popClose = close;
    const run = async (work, doneMsg) => {
        busy(true);
        try { await work(); close(); sayToast(doneMsg); changed(); }
        catch (err) { logger.error('[finishing] saving a product rate failed:', err); busy(false); fail('Could not save: ' + (err?.message || err) + '. Nothing was changed.'); }
    };
    const save = () => {
        const v = read();
        $('#finp-err').hidden = true;
        if (!builtin && !v.name) return fail('Type the product name.');
        const hasRate = v.amount > 0 && v.area > 0;
        if (!hasRate && !(builtin && v.blankRate)) return fail('Type both numbers of the rate, for example 1 gal for 300 sq ft.');
        if (hasRate && !v.unit) return fail('Pick the unit of the product, for example gal.');
        if (builtin && !hasRate && !v.words.length && !(num(cat.rate) > 0)) return fail('Type both numbers of the rate, for example 1 gal for 300 sq ft.');
        if (builtin && !hasRate && !v.words.length && !d) return close();                       // nothing typed, nothing stored
        if (!builtin) {
            const same = x => String(x).toLowerCase() === v.name.toLowerCase();
            const clash = catalog().find(c => c.id !== cat?.id && same(c.label));
            if (clash) return fail(`“${clash.label}” is already a product. It shows when the notes name it: click it there to change its rate.`);
            const finder = wordsRe(v.words.length ? v.words : [v.name]);
            if (!finder) return fail('Type the words that find this product in the notes.');
        }
        const item = {
            id: cat ? cat.id : 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            name: v.name, words: v.words,
            amount: hasRate ? v.amount : null, area: hasRate ? v.area : null, unit: v.unit, areaUnit: v.areaUnit,
            perCoat: v.perCoat, at: new Date().toISOString(),
        };
        run(() => saveDefs(list => {
            const i = list.findIndex(x => x.id === item.id);
            if (builtin && !hasRate && !item.words.length) { if (i >= 0) list.splice(i, 1); return; }
            if (i >= 0) list[i] = item; else list.push(item);
        }), hasRate ? `${v.name}: ${rateText(item)}. Every job uses this rate now.` : `${v.name}: saved.`);
    };
    const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
        else if (e.key === 'Enter' && pop.contains(e.target) && e.target.tagName === 'INPUT') { e.preventDefault(); save(); }
    };
    document.addEventListener('keydown', onKey, true);
    veil.addEventListener('click', close);
    pop.addEventListener('input', () => { $('#finp-err').hidden = true; preview(); });
    pop.addEventListener('change', () => { $('#finp-err').hidden = true; preview(); });
    $('#finp-save').addEventListener('click', save);
    $('#finp-cancel').addEventListener('click', close);
    $('#finp-reset')?.addEventListener('click', () => run(() => saveDefs(list => { const i = list.findIndex(x => x.id === cat.id); if (i >= 0) list.splice(i, 1); }), num(cat.rate) > 0 ? `${cat.label}: back to the built-in rule.` : `${cat.label}: rate removed.`));
    $('#finp-delete')?.addEventListener('click', () => {
        if (!window.confirm(`Delete the product “${cat.label}”?\n\nNo job will count it any more. You can add it again later.`)) return;
        run(() => saveDefs(list => { const i = list.findIndex(x => x.id === cat.id); if (i >= 0) list.splice(i, 1); }), `${cat.label}: deleted.`);
    });
    preview();
    const focusEl = (!builtin && !$('#finp-name').value) ? $('#finp-name') : $('#finp-amount');
    try { focusEl.focus({ preventScroll: true }); focusEl.select?.(); } catch (err) { /* focus is a convenience */ }
}
