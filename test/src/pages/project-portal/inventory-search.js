/**
 * Type search on the Casting Inventory tab (2026-11-16, user request): type part of a type's name and see which
 * castings hold it, with the pieces in each. A click on a casting opens it, scrolls to it and lights up the rows
 * of that type.
 *
 *  - It reads what the tab shows: the castings of the job, or of the phase picked on a phased job.
 *  - Types that are on the type master list but in no casting yet are found too, and say so.
 *  - Nothing is saved or changed: it only looks.
 *
 * @module pages/project-portal/inventory-search
 */

let ctx = null;
let query = '';
let lastScope = null;           // job + phase the box was last drawn for: another one starts with an empty box
const MAX_TYPES = 30;

const norm = (s) => String(s ?? '').trim().toLowerCase();
const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
const esc = (s) => ctx.escapeHtml(String(s ?? ''));
const int = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : 0; };
const plural = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** Every type of the castings on screen: name -> the castings that hold it, in the order of the tab. */
function gather() {
    const byType = new Map();
    const castings = ctx.castings().slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    for (const casting of castings) {
        for (const row of ctx.inventoryOf(casting.id)) {
            const key = norm(row.type);
            if (!key) continue;
            if (!byType.has(key)) byType.set(key, { key, name: String(row.type).trim(), casts: new Map(), onMaster: null, masterQty: null });
            const t = byType.get(key);
            if (!t.casts.has(casting.id)) t.casts.set(casting.id, { casting, qty: 0, extras: 0, remake: 0 });
            const c = t.casts.get(casting.id);
            if (row.remake_of_casting_id) c.remake += int(row.quantity) + int(row.extras);
            else { c.qty += int(row.quantity); c.extras += int(row.extras); }
        }
    }
    const master = ctx.masterEntries();
    if (master.length) {
        for (const t of byType.values()) t.onMaster = false;
        for (const e of master) {
            const key = norm(e.type);
            if (!byType.has(key)) byType.set(key, { key, name: e.type, casts: new Map(), onMaster: true, masterQty: e.qty });
            else { byType.get(key).onMaster = true; byType.get(key).masterQty = e.qty; }
        }
    }
    return [...byType.values()];
}

function castChip(t, c) {
    const bits = [];
    if (c.qty || !c.remake) bits.push(`<b>${c.qty}</b>`);
    if (c.extras) bits.push(`<span class="pp-inv-sr-x">+ ${plural(c.extras, 'extra')}</span>`);
    if (c.remake) bits.push(`<span class="pp-inv-sr-rm">${plural(c.remake, 'remake')}</span>`);
    return `<button type="button" class="pp-inv-sr-cast" data-sr-cast="${esc(c.casting.id)}" data-sr-type="${esc(t.key)}" title="Open Cast ${esc(c.casting.casting_number || '?')} and show its ${esc(t.name)} rows">
        <span class="pp-inv-sr-castname">Cast ${esc(c.casting.casting_number || '?')}</span>${bits.join(' ')}</button>`;
}

function resultHtml(t) {
    const casts = [...t.casts.values()];
    const qty = casts.reduce((n, c) => n + c.qty, 0), extras = casts.reduce((n, c) => n + c.extras, 0), remake = casts.reduce((n, c) => n + c.remake, 0);
    const total = casts.length
        ? `<b>${qty}</b>${extras ? ` + ${plural(extras, 'extra')}` : ''}${remake ? ` + ${plural(remake, 'remake')}` : ''} in ${plural(casts.length, 'casting')}`
        : '';
    const master = t.onMaster === null ? ''
        : t.onMaster ? `<span class="pp-inv-sr-tag pp-inv-sr-on">master list${t.masterQty > 0 ? `: ${t.masterQty}` : ''}</span>`
        : '<span class="pp-inv-sr-tag pp-inv-sr-off">not on master list</span>';
    return `<div class="pp-inv-sr">
        <div class="pp-inv-sr-head"><span class="pp-inv-sr-type">${esc(t.name)}</span><span class="pp-inv-sr-tot">${total}</span>${master}</div>
        <div class="pp-inv-sr-casts">${casts.length ? casts.map(c => castChip(t, c)).join('') : '<span class="pp-inv-sr-none">Not in any casting yet</span>'}</div>
    </div>`;
}

/** Draw the results for what is typed. Called on every keystroke and whenever the castings are redrawn. */
export function renderInventorySearch() {
    const wrap = document.getElementById('pp-inv-search');
    const out = document.getElementById('pp-inv-search-results');
    const clear = document.getElementById('pp-inv-search-clear');
    if (!wrap || !out || !ctx) return;
    const scope = ctx.scopeKey();
    if (scope !== lastScope) {
        lastScope = scope; query = '';
        const input = document.getElementById('pp-inv-search-input');
        if (input) input.value = '';
    }
    const show = ctx.castings().length > 0;
    wrap.hidden = !show;
    if (!show) { out.hidden = true; out.innerHTML = ''; return; }
    const q = norm(query);
    if (clear) clear.hidden = !q;
    if (!q) { out.hidden = true; out.innerHTML = ''; return; }
    const hits = gather().filter(t => t.key.includes(q))
        .sort((a, b) => (b.key.startsWith(q) - a.key.startsWith(q)) || natural(a.name, b.name));
    out.hidden = false;
    out.innerHTML = hits.length
        ? hits.slice(0, MAX_TYPES).map(resultHtml).join('') + (hits.length > MAX_TYPES ? `<p class="pp-inv-sr-more">and ${hits.length - MAX_TYPES} more types: keep typing to narrow it down.</p>` : '')
        : `<p class="pp-inv-sr-more">No type matches “${esc(query.trim())}” in ${ctx.scopeWord()}.</p>`;
}

/** Open the casting, scroll to it and light up its rows of the type for a moment. */
function jumpTo(castingId, typeKey) {
    ctx.openCasting(castingId);
    const card = document.querySelector(`.pp-cast-card[data-casting-id="${CSS.escape(castingId)}"]`);
    if (!card) return;
    const rows = [...card.querySelectorAll('.pp-inv-row[data-inventory-id]')].filter(r => norm(r.querySelector('[data-field="type"]')?.value) === typeKey);
    (rows[0] || card).scrollIntoView({ block: 'center', behavior: 'smooth' });
    card.classList.add('pp-inv-found-card');
    rows.forEach(r => r.classList.add('pp-inv-found'));
    setTimeout(() => { card.classList.remove('pp-inv-found-card'); rows.forEach(r => r.classList.remove('pp-inv-found')); }, 3500);
}

/**
 * Wire the search box once.
 * @param {Object} c page hooks: castings() (those shown on the tab), inventoryOf(id), masterEntries() ([{type, qty}],
 *   empty while the job has no type master list), openCasting(id) (unfold it and redraw), scopeWord(),
 *   scopeKey() (job + phase on screen), escapeHtml
 */
export function initInventorySearch(c) {
    ctx = c;
    const wrap = document.getElementById('pp-inv-search');
    const input = document.getElementById('pp-inv-search-input');
    if (!wrap || !input || wrap.dataset.wired) return;
    wrap.dataset.wired = '1';
    input.addEventListener('input', () => { query = input.value; renderInventorySearch(); });
    input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape' && input.value) { ev.preventDefault(); input.value = ''; query = ''; renderInventorySearch(); }
        if (ev.key === 'Enter') { ev.preventDefault(); wrap.querySelector('.pp-inv-sr-cast')?.click(); }
    });
    wrap.addEventListener('click', (ev) => {
        if (ev.target.closest('#pp-inv-search-clear')) { input.value = ''; query = ''; renderInventorySearch(); input.focus(); return; }
        const chip = ev.target.closest('.pp-inv-sr-cast');
        if (chip) jumpTo(chip.dataset.srCast, chip.dataset.srType);
    });
}
