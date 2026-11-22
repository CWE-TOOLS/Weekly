/**
 * Finishing & sealing products off the Color Log notes, at the shop rates (2026-11-06).
 *
 * Ported from the Raw Material Estimator (Custom Tools\Raw Material Estimator\index.html, FIN_CAT + finishingFor):
 * the log's finishing and sealing notes decide what is needed, item by item — acid wash, Sure Klean, Super Blue,
 * black buffing pad, #200 and #400 resin pads, epoxy, H-13 sealer. An item the log does not name is not counted.
 * Shop rates set 2026-11-04: acid 20 gal and Sure Klean 2.5 gal per 300 sq ft of face; #200 / #400 pads 2 per
 * 220 sq ft (= 110 sq ft a pad); epoxy two-part kit 150 g hardener + 300 g epoxy per 55 sq ft at 4,200 g a gal;
 * H-13 two-part kit 12 oz part A + 24 oz part B per 220 sq ft per coat, coats off the log ("4 coats"). Gallons and
 * pads round up to whole ones. Super Blue and the buffing pad have no shop rate yet: they are listed with "rate not
 * set". The Mix Day Totals box shows this under the colour-log notes, before the scrim line.
 *
 * @module services/finishing-products
 */

export const FIN_CAT = [
    { key: 'acid',      label: 'Acid wash',               re: /acid/i,                                   unit: 'gal',  basis: 'per300', rate: 20,   ruleText: 'shop rate 20 gal per 300 sq ft of face' },
    { key: 'buffpad',   label: 'Black buffing pad',       re: /buff/i,                                   unit: 'pads', basis: 'cover',  rate: null, ruleText: 'sq ft of face one pad does' },
    { key: 'superblue', label: 'Super Blue',              re: /super\s*blue/i,                           unit: 'oz',   basis: 'per300', rate: null, ruleText: 'oz per 300 sq ft of face (the log mixes 2 oz to 1 gal of water)' },
    { key: 'sureklean', label: 'Sure Klean',              re: /sure\s*-?\s*klean/i,                      unit: 'gal',  basis: 'per300', rate: 2.5,  ruleText: 'shop rate 2.5 gal per 300 sq ft of face' },
    { key: 'pad200',    label: 'Resin pad #200 (grind)',  re: /^(?=.*\b200\b)(?=.*(pad|grind|resin))/i,  unit: 'pads', basis: 'cover',  rate: 110,  ruleText: 'shop rate 2 pads per 220 sq ft = 110 sq ft a pad' },
    { key: 'pad400',    label: 'Resin pad #400 (polish)', re: /^(?=.*\b400\b)(?=.*(pad|polish|resin))/i, unit: 'pads', basis: 'cover',  rate: 110,  ruleText: 'shop rate 2 pads per 220 sq ft = 110 sq ft a pad' },
    { key: 'epoxy',     label: 'Epoxy',                   re: /epoxy/i,                                  unit: 'gal',  basis: 'kit',    rate: 55,   kit: [{ name: 'hardener', amt: 150, unit: 'g' }, { name: 'epoxy', amt: 300, unit: 'g' }], gPerGal: 4200, ruleText: 'two-part kit 150 g hardener + 300 g epoxy per 55 sq ft, 4,200 g a gal' },
    { key: 'h13',       label: 'H-13 sealer',             re: /\bh\s*-?\s*13\b/i,                        unit: 'gal',  basis: 'kit',    rate: 220,  kit: [{ name: 'part A', amt: 12, unit: 'oz' }, { name: 'part B', amt: 24, unit: 'oz' }], askCoats: true, ruleText: 'two-part kit 12 oz part A + 24 oz part B per 220 sq ft per coat; coats off the log' },
];

const UNIT_GAL = { gal: 1, oz: 1 / 128, qt: 0.25, pt: 0.125, ml: 1 / 3785.41, l: 1 / 3.78541 };

function num(v, d = 0) { const n = Number(v); return Number.isFinite(n) ? n : d; }
function r2(v) { return String(Math.round(num(v) * 100) / 100); }
function r4(v) { return String(Math.round(num(v) * 10000) / 10000); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function partGal(p, gPerGal) {
    const u = String(p.unit || '').toLowerCase();
    if (u === 'g' || u === 'gram' || u === 'grams') return num(p.amt) / Math.max(1, num(gPerGal, 4200));
    if (u === 'kg') return num(p.amt) * 1000 / Math.max(1, num(gPerGal, 4200));
    if (u === 'lb' || u === 'lbs') return num(p.amt) * 453.592 / Math.max(1, num(gPerGal, 4200));
    return num(p.amt) * (UNIT_GAL[u] != null ? UNIT_GAL[u] : 1);
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
    const found = {};
    for (const log of logs || []) {
        const text = [log.finishingNotes || log.finishing_notes || '', log.sealingNotes || log.sealing_notes || ''].join('\n');
        const segs = text.split(/\s\/\s|\n|;/).map(x => x.trim()).filter(Boolean);
        for (const seg of segs) {
            for (const c of FIN_CAT) {
                if (!c.re.test(seg)) continue;
                const it = found[c.key] || (found[c.key] = { ...c, notes: [] });
                it.notes.push(seg);
                const m = seg.match(/(\d+)\s*coats?/i);
                if (m) it.coatsNote = num(m[1]);
            }
        }
    }
    return FIN_CAT.filter(c => found[c.key]).map(c => found[c.key]);
}

/** Quantities for `face` sq ft of finished face: [{ label, unit, qty, how, noRate, notes }]. */
export function finishingRows(logs, face) {
    const ff = Math.max(0, num(face));
    return finishingItems(logs).map(it => {
        const rate = num(it.rate);
        const coats = it.askCoats ? Math.max(1, num(it.coatsNote, 1)) : 1;
        let qty = null, how = '', parts = [];
        if (!(rate > 0)) return { ...it, qty: null, how: `rate not set in the shop rules (${it.ruleText}) — ask estimating`, noRate: true, coats };
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
        return { ...it, qty, how, parts, noRate: false, coats };
    });
}

/**
 * The block for the Mix Day Totals box. Empty string when the logs name no known product.
 * @param {Array<Object>} logs - colour logs with finishingNotes / sealingNotes
 * @param {number} face - finished-face sq ft of the casting
 * @param {{cls?: string, partial?: boolean}} [opts] - cls: CSS class prefix ('pp-bt-totals-fin' on the portal, 'totals-fin' on the Jane page)
 */
export function finishingProductsHtml(logs, face, { cls = 'pp-bt-totals-fin', partial = false } = {}) {
    const rows = finishingRows(logs, face);
    if (!rows.length) return '';
    const ff = Math.max(0, num(face));
    const lines = rows.map(r => {
        const qty = r.noRate
            ? `<span class="${cls}-norate">rate not set</span>`
            : `<b>${esc(r2(r.qty))} ${esc(r.unit)}</b>`;
        return `<li class="${cls}-row"><span class="${cls}-label">${esc(r.label)}</span>: ${qty} <span class="${cls}-how">— ${esc(r.how)}</span><span class="${cls}-note">from the log: “${esc(r.notes.join(' / '))}”</span></li>`;
    }).join('');
    return `<div class="${cls}">
        <div class="${cls}-title">Finishing &amp; sealing products — from the Color Log notes at the shop rates, for ${esc(r2(ff))} sq ft of finished face${partial ? ' (some inventory rows have no FF sq ft yet)' : ''}</div>
        <ul class="${cls}-list">${lines}</ul>
        <div class="${cls}-foot">Rates: acid 20 gal and Sure Klean 2.5 gal per 300 sq ft; #200 / #400 pads 110 sq ft a pad; epoxy 150 g + 300 g per 55 sq ft; H-13 12 oz A + 24 oz B per 220 sq ft per coat. Gallons and pads rounded up. Same rules as the Raw Material Estimator.</div>
    </div>`;
}
