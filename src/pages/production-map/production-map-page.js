/**
 * Production Map — where every casting is in the plant, read straight from the weekly. Nothing is moved by hand.
 *
 * Columns = weekly departments in process order (production-map-config.js). A casting sits in the department of its
 * latest weekly day that is today or earlier; ties on the same day go to the department further along. It leaves the
 * map when its last Ship day is past or the job is Shipped / Closed Out, and then shows in the Shipped pop-up for
 * SHIPPED_WINDOW_DAYS. Castings whose first weekly day is still ahead are not shown (counted in the header).
 * Cards are collapsed (job, cast, job number, pieces); click one for the full card; a full column's title opens the
 * whole list. Same look as the Finishing Map (finishing-map.css) with its own column layout (production-map.css).
 */
import { fetchAllTasks } from '../../services/data-service.js';
import { loadAllProjects } from '../../services/projects-service.js';
import { initializeSupabase, registerRefreshHandler, isPortalChange, signalInfo } from '../../services/supabase-service.js';
import { PRODUCTION_DEPARTMENTS, ALWAYS_SHOWN, SHIPPING_DEPARTMENTS, SHIPPED_STATUSES, SHIPPED_WINDOW_DAYS, STALE_AFTER_DAYS } from '../../config/production-map-config.js';
import { DEPARTMENT_COLORS, normalizeDepartmentClass } from '../../config/department-config.js';
import { parseDate, getLocalDateString } from '../../utils/date-utils.js';
import { escapeHtml } from '../../utils/security-utils.js';
import { logger } from '../../utils/logger.js';

const S = {
    castings: new Map(),     // key -> summary
    projects: new Map(),     // project_number -> { project_name, status, pm }
    search: '',
    loading: false,
    expandedKey: null,
    modal: null,             // { kind: 'dept'|'shipped', dept?, filter }
};

const $ = (id) => document.getElementById(id);
const today = () => getLocalDateString(new Date());
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return getLocalDateString(d); };
const fmtDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${Number(m)}/${Number(d)}/${y}`; };
const deptRank = (d) => { const i = PRODUCTION_DEPARTMENTS.indexOf(d); return i === -1 ? -1 : i; };

// ---------------------------------------------------------------- data

/** One summary per casting: every weekly day grouped by department, plus the derived "where is it now". */
function summarise(tasks) {
    const out = new Map();
    const now = today();
    for (const t of tasks || []) {
        const pn = String(t.projectNumber || '').trim();
        const cn = String(t.castingNumber || '').trim();
        if (!pn || !cn || t.isSynthetic) continue;
        const d = parseDate(t.date);
        if (!d) continue;
        const iso = getLocalDateString(d);
        const key = `${pn}|${cn}`;
        let c = out.get(key);
        if (!c) {
            c = { key, projectNumber: pn, castingNumber: cn, sheetName: String(t.project || '').trim(), days: new Map(), inv: null, lastShip: null, next: null, lastDate: null, firstDate: null };
            out.set(key, c);
        }
        if (t.invSummary && !c.inv) c.inv = t.invSummary;
        const dept = t.department;
        if (dept) {
            if (!c.days.has(dept)) c.days.set(dept, []);
            c.days.get(dept).push(iso);
        }
        if (SHIPPING_DEPARTMENTS.includes(dept) && (!c.lastShip || iso > c.lastShip)) c.lastShip = iso;
        if (iso > now && (!c.next || iso < c.next.date)) c.next = { date: iso, department: dept };
        if (!c.lastDate || iso > c.lastDate) c.lastDate = iso;
        if (!c.firstDate || iso < c.firstDate) c.firstDate = iso;
    }
    for (const c of out.values()) {
        for (const list of c.days.values()) list.sort();
        // Where it is: the latest day on or before today; same day in two departments -> the one further along.
        let best = null;
        for (const [dept, list] of c.days) {
            if (deptRank(dept) === -1) continue;              // Batch / Layout / Samples / Facilities… are not production stops
            for (let i = list.length - 1; i >= 0; i--) {
                const iso = list[i];
                if (iso > now) continue;
                if (!best || iso > best.date || (iso === best.date && deptRank(dept) > deptRank(best.dept))) best = { dept, date: iso, dayIndex: i + 1, dayTotal: list.length };
                break;
            }
        }
        c.current = best;                                     // null = nothing has started yet
    }
    return out;
}

function projectOf(pn) { return S.projects.get(pn) || null; }
function jobName(c) {
    const p = projectOf(c.projectNumber);
    if (p && p.project_name) return p.project_name;
    return (c.sheetName || c.projectNumber).replace(/\s*[-–]?\s*cast\s*#?\s*[\w.]+\s*$/i, '').trim() || c.sheetName || c.projectNumber;
}
function shippedOn(c) {
    const now = today();
    if (c.lastShip && c.lastShip < now) return c.lastShip;                 // on its Ship day it still shows in the Ship column
    const p = projectOf(c.projectNumber);
    if (p && SHIPPED_STATUSES.includes(p.status)) return c.lastDate && c.lastDate <= now ? c.lastDate : now;
    return null;
}
const isStale = (c) => !!(c.lastDate && c.lastDate < daysAgo(STALE_AFTER_DAYS));
function matchesSearch(c, q = S.search) {
    return !q || `${jobName(c)} ${c.sheetName} ${c.projectNumber} cast ${c.castingNumber} ${(projectOf(c.projectNumber) || {}).pm || ''}`.toLowerCase().includes(q);
}

/** Columns with their castings, the shipped list, and how many have not started. */
function partition() {
    const byDept = new Map(PRODUCTION_DEPARTMENTS.map(d => [d, []]));
    const shipped = [];
    let notStarted = 0;
    const cutoff = daysAgo(SHIPPED_WINDOW_DAYS);
    for (const c of S.castings.values()) {
        const s = shippedOn(c);
        if (s) { if (s >= cutoff) shipped.push({ c, shippedOn: s }); continue; }
        if (!c.current) { notStarted++; continue; }
        byDept.get(c.current.dept).push(c);
    }
    const byName = (a, b) => jobName(a).localeCompare(jobName(b)) || String(a.castingNumber).localeCompare(String(b.castingNumber), undefined, { numeric: true });
    for (const list of byDept.values()) list.sort(byName);
    shipped.sort((a, b) => b.shippedOn.localeCompare(a.shippedOn) || byName(a.c, b.c));
    return { byDept, shipped, notStarted };
}

// ---------------------------------------------------------------- cards

function cardBodyHtml(c) {
    const p = projectOf(c.projectNumber);
    const inv = c.inv ? `${c.inv.types} types · ${c.inv.pcs} pcs` : '';
    const where = c.current ? `${c.current.dept} day ${c.current.dayIndex} of ${c.current.dayTotal} (${fmtDate(c.current.date)})` : '';
    const next = c.next ? `Next: ${c.next.department} ${fmtDate(c.next.date)}` : (c.lastShip ? `Ship ${fmtDate(c.lastShip)}` : '');
    const staleNote = isStale(c) ? `No weekly days since ${fmtDate(c.lastDate)} — shipped?` : '';
    const trail = [...c.days.entries()].filter(([d]) => deptRank(d) !== -1).sort((a, b) => deptRank(a[0]) - deptRank(b[0]))
        .map(([d, list]) => `${d} ${fmtDate(list[0])}${list.length > 1 ? `–${fmtDate(list[list.length - 1])}` : ''}`).join(' · ');
    return `<div class="fm-card-job">${escapeHtml(jobName(c))}</div>
        <div class="fm-card-cast">Cast ${escapeHtml(c.castingNumber)}<span class="fm-card-pn">${escapeHtml(c.projectNumber)}</span></div>
        ${p && p.pm ? `<div class="fm-card-meta">${escapeHtml(p.pm)}</div>` : ''}
        ${inv ? `<div class="fm-card-meta">${escapeHtml(inv)}</div>` : ''}
        ${where ? `<div class="fm-card-meta fm-card-finish">${escapeHtml(where)}</div>` : ''}
        ${next ? `<div class="fm-card-meta">${escapeHtml(next)}</div>` : ''}
        ${staleNote ? `<div class="fm-card-meta fm-card-stale-note">${escapeHtml(staleNote)}</div>` : ''}
        ${trail ? `<div class="fm-card-meta pm-trail">${escapeHtml(trail)}</div>` : ''}`;
}

function chipHtml(c) {
    const pcs = c.inv && c.inv.pcs != null ? `${c.inv.pcs} pcs` : '';
    const cls = ['fm-chip', S.expandedKey === c.key ? 'fm-chip-open' : '', matchesSearch(c) ? '' : 'fm-card-dim', isStale(c) ? 'fm-card-stale' : ''].filter(Boolean).join(' ');
    return `<div class="${cls}" data-key="${escapeHtml(c.key)}" title="${escapeHtml(c.sheetName || jobName(c))}">
        <span class="fm-chip-job">${escapeHtml(jobName(c))}</span>
        <span class="fm-chip-line"><b>Cast ${escapeHtml(c.castingNumber)}</b><span>${escapeHtml(c.projectNumber)}</span><span>${escapeHtml(pcs)}</span></span>
        ${c.current ? `<span class="pm-chip-day">day ${c.current.dayIndex} of ${c.current.dayTotal}</span>` : ''}
    </div>`;
}

function rowHtml(c, extra = '') {
    const open = S.modal && S.modal.expandedKey === c.key;
    const pcs = c.inv && c.inv.pcs != null ? `${c.inv.pcs} pcs` : '';
    return `<div class="fm-mrow${isStale(c) ? ' fm-card-stale' : ''}${open ? ' fm-mrow-open' : ''}" data-mrow="${escapeHtml(c.key)}">
        <div class="fm-mrow-text" data-expand="${escapeHtml(c.key)}" title="${open ? 'Click to close' : 'Click for the full card'}">
            ${open ? cardBodyHtml(c) : `<div class="fm-card-job">${escapeHtml(jobName(c))} <b>Cast ${escapeHtml(c.castingNumber)}</b> <span class="fm-card-pn">${escapeHtml(c.projectNumber)}</span> <span class="fm-card-meta">${escapeHtml(pcs)}${c.current ? ` · day ${c.current.dayIndex} of ${c.current.dayTotal}` : ''}${extra}</span></div>`}
        </div>
    </div>`;
}

// ---------------------------------------------------------------- render

function deptStyle(dept) {
    const col = DEPARTMENT_COLORS[normalizeDepartmentClass(dept)];
    if (!col) return '';
    return `--pm-col:${col.background};`;
}

function renderMap() {
    const map = $('pm-map');
    const { byDept, shipped, notStarted } = partition();
    const shown = PRODUCTION_DEPARTMENTS.filter(d => ALWAYS_SHOWN.has(d) || byDept.get(d).length);
    if (map.dataset.cols !== shown.join('|')) {
        map.dataset.cols = shown.join('|');
        map.style.setProperty('--pm-cols', String(shown.length));
        map.innerHTML = shown.map(d => `<section class="fm-area pm-col" data-area="${escapeHtml(d)}" style="${deptStyle(d)}">
            <button type="button" class="fm-area-head" data-open-dept="${escapeHtml(d)}" title="See every job in ${escapeHtml(d)}">
                <span class="fm-area-label">${escapeHtml(d)}</span>
                <span class="fm-area-more" data-more="${escapeHtml(d)}"></span>
                <span class="fm-area-count" data-count="${escapeHtml(d)}">0</span>
            </button>
            <div class="fm-cards" data-cards="${escapeHtml(d)}"></div>
        </section>`).join('');
    }
    for (const d of shown) {
        const list = byDept.get(d);
        const box = map.querySelector(`[data-cards="${CSS.escape(d)}"]`);
        if (box) box.innerHTML = list.map(chipHtml).join('');
        const n = map.querySelector(`[data-count="${CSS.escape(d)}"]`);
        if (n) n.textContent = String(list.length);
    }
    $('fm-shipped-count').textContent = String(shipped.length);
    const onMap = [...byDept.values()].reduce((a, l) => a + l.length, 0);
    $('pm-sub').textContent = `${onMap} in production · ${notStarted} scheduled, not started`;
    markOverflow();
    renderPopover();
    if (S.modal) renderModalBody();
}

function markOverflow() {
    for (const area of document.querySelectorAll('.pm-col')) {
        const box = area.querySelector('.fm-cards');
        const more = area.querySelector('.fm-area-more');
        const bottom = box.getBoundingClientRect().bottom;
        let hidden = 0;
        for (const chip of box.children) if (chip.getBoundingClientRect().bottom > bottom + 2) hidden++;
        area.classList.toggle('fm-area-overflow', hidden > 0);
        more.textContent = hidden > 0 ? `+${hidden} more — expand to see all` : '';
    }
}

function renderPopover() {
    let pop = $('fm-popover');
    const key = S.expandedKey;
    const chip = key ? $('pm-map').querySelector(`.fm-chip[data-key="${CSS.escape(key)}"]`) : null;
    const c = key ? S.castings.get(key) : null;
    if (!chip || !c) { if (pop) pop.remove(); if (key) S.expandedKey = null; return; }
    if (!pop) { pop = document.createElement('div'); pop.id = 'fm-popover'; $('fm-app').appendChild(pop); }
    pop.innerHTML = `<div class="fm-card fm-chip-expanded${isStale(c) ? ' fm-card-stale' : ''}" data-key="${escapeHtml(key)}" data-expanded="1" title="Click to close">${cardBodyHtml(c)}</div>`;
    const r = chip.getBoundingClientRect();
    pop.style.left = '0px'; pop.style.top = '0px';
    const w = Math.max(pop.offsetWidth, r.width), h = pop.offsetHeight;
    pop.style.left = Math.max(4, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
    pop.style.top = Math.max(4, Math.min(r.top, window.innerHeight - h - 8)) + 'px';
    pop.style.minWidth = r.width + 'px';
    pop.onmouseleave = () => { if (S.expandedKey === key) { S.expandedKey = null; renderMap(); } };
}

// ---------------------------------------------------------------- pop-ups

function openModal(kind, extra = {}) {
    S.modal = { kind, filter: '', expandedKey: null, ...extra };
    const search = $('fm-modal-search');
    search.value = '';
    search.placeholder = 'Filter by job, cast or PM';
    $('fm-modal').hidden = false;
    renderModalBody();
}
function closeModal() { S.modal = null; $('fm-modal').hidden = true; }

function renderModalBody() {
    if (!S.modal) return;
    const title = $('fm-modal-title');
    const body = $('fm-modal-body');
    const q = S.modal.filter;
    if (S.modal.kind === 'dept') {
        const list = partition().byDept.get(S.modal.dept) || [];
        title.textContent = `${S.modal.dept} — ${list.length} ${list.length === 1 ? 'job' : 'jobs'}`;
        const rows = list.filter(c => matchesSearch(c, q));
        body.innerHTML = rows.length ? rows.map(c => rowHtml(c)).join('') : `<div class="fm-empty">${list.length ? 'No jobs match.' : 'Nothing here.'}</div>`;
    } else {
        const { shipped } = partition();
        title.textContent = `Shipped — last ${SHIPPED_WINDOW_DAYS} days (${shipped.length})`;
        const rows = shipped.filter(({ c }) => matchesSearch(c, q));
        body.innerHTML = rows.length ? rows.map(({ c, shippedOn }) => rowHtml(c, ` · shipped ${fmtDate(shippedOn)}`)).join('') : `<div class="fm-empty">${shipped.length ? 'No jobs match.' : `Nothing shipped in the last ${SHIPPED_WINDOW_DAYS} days.`}</div>`;
    }
    const openRow = body.querySelector('.fm-mrow-open');
    if (openRow) openRow.addEventListener('mouseleave', () => { if (S.modal && S.modal.expandedKey === openRow.dataset.mrow) { S.modal.expandedKey = null; renderModalBody(); } }, { once: true });
}

function notice(text, kind = 'info') {
    const el = $('fm-notice');
    el.hidden = !text;
    el.textContent = text || '';
    el.className = `fm-notice fm-notice-${kind}`;
}

// ---------------------------------------------------------------- loading

async function loadAll({ silent = false } = {}) {
    if (S.loading) return;
    S.loading = true;
    if (!silent) notice('Loading the weekly…');
    try {
        const [tasks, projects] = await Promise.all([
            fetchAllTasks(true),
            loadAllProjects().catch(err => { logger.warn('[production-map] projects failed', err); return []; })
        ]);
        S.projects = new Map((projects || []).map(p => [String(p.project_number || '').trim(), p]));
        S.castings = summarise(tasks);
        notice('');
        renderMap();
        $('fm-updated').textContent = 'Updated ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch (err) {
        logger.error('[production-map] load failed', err);
        notice('Could not load: ' + (err && err.message ? err.message : err), 'error');
    } finally {
        S.loading = false;
    }
}

function wireEvents() {
    $('fm-app').addEventListener('click', (e) => {
        const head = e.target.closest('[data-open-dept]');
        if (head) { S.expandedKey = null; renderMap(); openModal('dept', { dept: head.dataset.openDept }); return; }
        const card = e.target.closest('[data-key]');
        if (card) { S.expandedKey = S.expandedKey === card.dataset.key ? null : card.dataset.key; renderMap(); }
    });
    const modal = $('fm-modal');
    modal.addEventListener('click', (e) => {
        const txt = e.target.closest('[data-expand]');
        if (txt && S.modal) { S.modal.expandedKey = S.modal.expandedKey === txt.dataset.expand ? null : txt.dataset.expand; renderModalBody(); return; }
        if (e.target === modal || e.target.closest('#fm-modal-close')) closeModal();
    });
    $('fm-modal-search').addEventListener('input', (e) => { if (S.modal) { S.modal.filter = e.target.value.trim().toLowerCase(); renderModalBody(); } });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (S.modal) closeModal(); else if (S.expandedKey) { S.expandedKey = null; renderMap(); } } });
    $('fm-search').addEventListener('input', (e) => { S.search = e.target.value.trim().toLowerCase(); renderMap(); });
    $('fm-refresh').addEventListener('click', () => loadAll());
    $('fm-shipped-btn').addEventListener('click', () => openModal('shipped'));
    window.addEventListener('resize', markOverflow);
    // Anything saved anywhere in the portal / weekly: reload (the weekly's manual tasks and inventory feed this page).
    registerRefreshHandler(async (payload, payloads) => {
        const batch = Array.isArray(payloads) && payloads.length ? payloads : [payload];
        const onlyMaps = batch.every(isPortalChange) && batch.every(p => /^finishing_map/.test(signalInfo(p).table || ''));
        if (!onlyMaps) await loadAll({ silent: true });
    });
}

(async function boot() {
    if (document.getElementById('ro-test-count') || document.querySelector('[style*="99999"]')) document.body.classList.add('fm-has-test-bar');
    wireEvents();
    try { await initializeSupabase(); } catch (err) { logger.warn('[production-map] supabase init failed', err); }
    await loadAll();
    if (document.getElementById('ro-test-count')) document.body.classList.add('fm-has-test-bar');
})();

window.__productionMap = { state: S, partition, reload: loadAll };
