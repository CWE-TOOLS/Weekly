/**
 * Project Map — the weekly by department, one screen. Read-only.
 *
 * Day view: every casting that has a weekly day on the chosen date, in that day's department (a casting with two
 * departments that day shows in both). Week view: every casting with a day in the chosen week (Mon–Sat), in every
 * department it visits that week, with the weekdays listed. The Scheduled column lists castings whose first weekly
 * day is still ahead of the view. Shipped castings (last Ship day before the view, or job Shipped / Closed Out) sit
 * in the Shipped pop-up for SHIPPED_WINDOW_DAYS. Cards are collapsed; click one for the full card with the casting's
 * trail through the departments; a full column's title opens the whole list.
 */
import { fetchAllTasks } from '../../services/data-service.js';
import { loadAllProjects } from '../../services/projects-service.js';
import { initializeSupabase, registerRefreshHandler, isPortalChange, signalInfo } from '../../services/supabase-service.js';
import { MAP_DEPARTMENTS, ALWAYS_SHOWN, SHIPPING_DEPARTMENTS, SHIPPED_STATUSES, SHIPPED_WINDOW_DAYS, SCHEDULED_LOOKAHEAD_DAYS } from '../../config/project-map-config.js';
import { DEPARTMENT_COLORS, normalizeDepartmentClass } from '../../config/department-config.js';
import { parseDate, getLocalDateString, getMonday } from '../../utils/date-utils.js';
import { escapeHtml } from '../../utils/security-utils.js';
import { logger } from '../../utils/logger.js';

const SCHEDULED = '__scheduled';
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const S = {
    castings: new Map(),     // key -> summary
    projects: new Map(),     // project_number -> { project_name, status, pm }
    view: 'day',             // 'day' | 'week'
    anchor: null,            // 'YYYY-MM-DD' the day shown, or any day of the week shown
    search: '',
    loading: false,
    expandedKey: null,       // chip opened to the full card: `${key}@${column}`
    modal: null,             // { kind: 'column'|'shipped', column?, filter, expandedKey }
};

const $ = (id) => document.getElementById(id);
const today = () => getLocalDateString(new Date());
const addDays = (iso, n) => { const d = parseIso(iso); d.setDate(d.getDate() + n); return getLocalDateString(d); };
const parseIso = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${Number(m)}/${Number(d)}/${y}`; };
const fmtShort = (iso) => { const [, m, d] = iso.split('-'); return `${Number(m)}/${Number(d)}`; };
const weekdayOf = (iso) => WEEKDAY[parseIso(iso).getDay()];
const deptRank = (d) => MAP_DEPARTMENTS.indexOf(d);

/** Mon..Sat of the week that holds `iso`. */
function weekRange(iso) {
    const mon = getLocalDateString(getMonday(parseIso(iso)));
    return { start: mon, end: addDays(mon, 5) };
}
function viewRange() {
    return S.view === 'week' ? weekRange(S.anchor) : { start: S.anchor, end: S.anchor };
}

// ---------------------------------------------------------------- data

/** One summary per casting: its weekly days grouped by department. */
function summarise(tasks) {
    const out = new Map();
    for (const t of tasks || []) {
        const pn = String(t.projectNumber || '').trim();
        const cn = String(t.castingNumber || '').trim();
        if (!pn || !cn || t.isSynthetic || !t.department) continue;
        const d = parseDate(t.date);
        if (!d) continue;
        const iso = getLocalDateString(d);
        const key = `${pn}|${cn}`;
        let c = out.get(key);
        if (!c) {
            c = { key, projectNumber: pn, castingNumber: cn, sheetName: String(t.project || '').trim(), days: new Map(), inv: null, lastShip: null, lastDate: null, firstDate: null };
            out.set(key, c);
        }
        if (t.invSummary && !c.inv) c.inv = t.invSummary;
        if (!c.days.has(t.department)) c.days.set(t.department, []);
        c.days.get(t.department).push(iso);
        if (SHIPPING_DEPARTMENTS.includes(t.department) && (!c.lastShip || iso > c.lastShip)) c.lastShip = iso;
        if (!c.lastDate || iso > c.lastDate) c.lastDate = iso;
        if (!c.firstDate || iso < c.firstDate) c.firstDate = iso;
    }
    for (const c of out.values()) for (const list of c.days.values()) { list.sort(); }
    return out;
}

function projectOf(pn) { return S.projects.get(pn) || null; }
function jobName(c) {
    const p = projectOf(c.projectNumber);
    if (p && p.project_name) return p.project_name;
    return (c.sheetName || c.projectNumber).replace(/\s*[-–]?\s*cast\s*#?\s*[\w.]+\s*$/i, '').trim() || c.sheetName || c.projectNumber;
}
/** Shipped before the view's first day? ('YYYY-MM-DD' or null) */
function shippedOn(c, before) {
    if (c.lastShip && c.lastShip < before) return c.lastShip;
    const p = projectOf(c.projectNumber);
    if (p && SHIPPED_STATUSES.includes(p.status)) return c.lastDate && c.lastDate < before ? c.lastDate : before;
    return null;
}
function matchesSearch(c, q = S.search) {
    return !q || `${jobName(c)} ${c.sheetName} ${c.projectNumber} cast ${c.castingNumber} ${(projectOf(c.projectNumber) || {}).pm || ''}`.toLowerCase().includes(q);
}

/** Entries per column for the current view: { c, dept, days: [iso…], dayIndex, dayTotal }. */
function partition() {
    const { start, end } = viewRange();
    const byCol = new Map([[SCHEDULED, []], ...MAP_DEPARTMENTS.map(d => [d, []])]);
    const shipped = [];
    const cutoff = addDays(today(), -SHIPPED_WINDOW_DAYS);
    const lookahead = addDays(end, SCHEDULED_LOOKAHEAD_DAYS);
    const byName = (a, b) => jobName(a).localeCompare(jobName(b)) || String(a.castingNumber).localeCompare(String(b.castingNumber), undefined, { numeric: true });
    for (const c of S.castings.values()) {
        const s = shippedOn(c, start);
        if (s) { if (s >= cutoff) shipped.push({ c, shippedOn: s }); continue; }
        if (c.firstDate > end) {
            if (c.firstDate <= lookahead) {
                const firstDept = [...c.days.entries()].filter(([, l]) => l[0] === c.firstDate).sort((a, b) => deptRank(a[0]) - deptRank(b[0]))[0]?.[0] || '';
                byCol.get(SCHEDULED).push({ c, dept: firstDept, days: [c.firstDate], dayIndex: 0, dayTotal: 0 });
            }
            continue;
        }
        for (const [dept, list] of c.days) {
            if (deptRank(dept) === -1) continue;                   // Batch / Layout / Samples / Facilities are not stops
            const inView = list.filter(d => d >= start && d <= end);
            if (!inView.length) continue;
            const lastIdx = list.indexOf(inView[inView.length - 1]) + 1;
            byCol.get(dept).push({ c, dept, days: inView, dayIndex: lastIdx, dayTotal: list.length, firstIdx: list.indexOf(inView[0]) + 1 });
        }
    }
    for (const [col, list] of byCol) {
        if (col === SCHEDULED) list.sort((a, b) => a.days[0].localeCompare(b.days[0]) || byName(a.c, b.c));
        else list.sort((a, b) => byName(a.c, b.c));
    }
    shipped.sort((a, b) => b.shippedOn.localeCompare(a.shippedOn) || byName(a.c, b.c));
    return { byCol, shipped, start, end };
}

// ---------------------------------------------------------------- cards

function entryLine(e) {
    if (e.dept && e.dayTotal === 0) return `starts ${weekdayOf(e.days[0])} ${fmtShort(e.days[0])}${e.dept ? ' · ' + e.dept : ''}`;
    if (S.view === 'week') {
        const wd = e.days.map(weekdayOf).join(' ');
        const span = e.firstIdx === e.dayIndex ? `day ${e.dayIndex}` : `days ${e.firstIdx}–${e.dayIndex}`;
        return `${wd} · ${span} of ${e.dayTotal}`;
    }
    return `day ${e.dayIndex} of ${e.dayTotal}`;
}

function cardBodyHtml(c, e) {
    const p = projectOf(c.projectNumber);
    const inv = c.inv ? `${c.inv.types} types · ${c.inv.pcs} pcs` : '';
    const trail = [...c.days.entries()].filter(([d]) => deptRank(d) !== -1).sort((a, b) => deptRank(a[0]) - deptRank(b[0]))
        .map(([d, list]) => `${d} ${fmtShort(list[0])}${list.length > 1 ? `–${fmtShort(list[list.length - 1])}` : ''}`).join(' · ');
    return `<div class="fm-card-job">${escapeHtml(jobName(c))}</div>
        <div class="fm-card-cast">Cast ${escapeHtml(c.castingNumber)}<span class="fm-card-pn">${escapeHtml(c.projectNumber)}</span></div>
        ${p && p.pm ? `<div class="fm-card-meta">${escapeHtml(p.pm)}</div>` : ''}
        ${inv ? `<div class="fm-card-meta">${escapeHtml(inv)}</div>` : ''}
        ${e ? `<div class="fm-card-meta fm-card-finish">${escapeHtml(e.dept && e.dayTotal ? e.dept + ': ' : '')}${escapeHtml(entryLine(e))}</div>` : ''}
        ${c.lastShip ? `<div class="fm-card-meta">Ship ${fmtDate(c.lastShip)}</div>` : ''}
        ${trail ? `<div class="fm-card-meta pm-trail">${escapeHtml(trail)}</div>` : ''}`;
}

function chipHtml(e, col) {
    const c = e.c;
    const pcs = c.inv && c.inv.pcs != null ? `${c.inv.pcs} pcs` : '';
    const id = `${c.key}@${col}`;
    const cls = ['fm-chip', S.expandedKey === id ? 'fm-chip-open' : '', matchesSearch(c) ? '' : 'fm-card-dim'].filter(Boolean).join(' ');
    return `<div class="${cls}" data-key="${escapeHtml(id)}" title="${escapeHtml(c.sheetName || jobName(c))}">
        <span class="fm-chip-job">${escapeHtml(jobName(c))}</span>
        <span class="fm-chip-line"><b>Cast ${escapeHtml(c.castingNumber)}</b><span>${escapeHtml(c.projectNumber)}</span><span>${escapeHtml(pcs)}</span></span>
        <span class="pm-chip-day">${escapeHtml(entryLine(e))}</span>
    </div>`;
}

function rowHtml(e, extra = '') {
    const c = e.c;
    const open = S.modal && S.modal.expandedKey === c.key;
    const pcs = c.inv && c.inv.pcs != null ? `${c.inv.pcs} pcs` : '';
    return `<div class="fm-mrow${open ? ' fm-mrow-open' : ''}" data-mrow="${escapeHtml(c.key)}">
        <div class="fm-mrow-text" data-expand="${escapeHtml(c.key)}" title="${open ? 'Click to close' : 'Click for the full card'}">
            ${open ? cardBodyHtml(c, e.dept !== undefined ? e : null) : `<div class="fm-card-job">${escapeHtml(jobName(c))} <b>Cast ${escapeHtml(c.castingNumber)}</b> <span class="fm-card-pn">${escapeHtml(c.projectNumber)}</span> <span class="fm-card-meta">${escapeHtml([pcs, e.dept !== undefined ? entryLine(e) : ''].filter(Boolean).join(' · '))}${extra}</span></div>`}
        </div>
    </div>`;
}

// ---------------------------------------------------------------- render

function colStyle(col) {
    if (col === SCHEDULED) return '--pm-col:#64748b;';
    const c = DEPARTMENT_COLORS[normalizeDepartmentClass(col)];
    return c ? `--pm-col:${c.background};` : '';
}
const colLabel = (col) => col === SCHEDULED ? 'Scheduled' : col;

function renderWhen() {
    const { start, end } = viewRange();
    $('pm-when-label').textContent = S.view === 'week'
        ? `Week of ${fmtShort(start)} – ${fmtShort(end)}${start === weekRange(today()).start ? ' (this week)' : ''}`
        : `${weekdayOf(start)} ${fmtDate(start)}${start === today() ? ' (today)' : ''}`;
    for (const b of document.querySelectorAll('.pm-view-btn')) b.classList.toggle('pm-view-on', b.dataset.view === S.view);
}

function renderMap() {
    const map = $('pm-map');
    const { byCol, shipped } = partition();
    const shown = MAP_DEPARTMENTS.filter(d => ALWAYS_SHOWN.has(d) || byCol.get(d).length);   // the view's arrows replace a Scheduled column
    if (map.dataset.cols !== shown.join('|')) {
        map.dataset.cols = shown.join('|');
        map.style.setProperty('--pm-cols', String(shown.length));
        map.innerHTML = shown.map(col => `<section class="fm-area pm-col${col === SCHEDULED ? ' pm-col-scheduled' : ''}" data-area="${escapeHtml(col)}" style="${colStyle(col)}">
            <button type="button" class="fm-area-head" data-open-col="${escapeHtml(col)}" title="See every job in ${escapeHtml(colLabel(col))}">
                <span class="fm-area-label">${escapeHtml(colLabel(col))}</span>
                <span class="fm-area-more" data-more="${escapeHtml(col)}"></span>
                <span class="fm-area-count" data-count="${escapeHtml(col)}">0</span>
            </button>
            <div class="fm-cards" data-cards="${escapeHtml(col)}"></div>
        </section>`).join('');
    }
    let onFloor = 0;
    for (const col of shown) {
        const list = byCol.get(col);
        if (col !== SCHEDULED) onFloor += list.length;
        const box = map.querySelector(`[data-cards="${CSS.escape(col)}"]`);
        if (box) box.innerHTML = list.map(e => chipHtml(e, col)).join('');
        const n = map.querySelector(`[data-count="${CSS.escape(col)}"]`);
        if (n) n.textContent = String(list.length);
    }
    $('fm-shipped-count').textContent = String(shipped.length);
    $('pm-sub').textContent = `${onFloor} on the floor ${S.view === 'week' ? 'this week' : 'that day'}`;
    renderWhen();
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
    const id = S.expandedKey;
    const chip = id ? $('pm-map').querySelector(`.fm-chip[data-key="${CSS.escape(id)}"]`) : null;
    const [key, col] = id ? id.split('@') : [];
    const c = key ? S.castings.get(key) : null;
    if (!chip || !c) { if (pop) pop.remove(); if (id) S.expandedKey = null; return; }
    const e = (partition().byCol.get(col) || []).find(x => x.c.key === key) || null;
    if (!pop) { pop = document.createElement('div'); pop.id = 'fm-popover'; $('fm-app').appendChild(pop); }
    pop.innerHTML = `<div class="fm-card fm-chip-expanded" data-key="${escapeHtml(id)}" data-expanded="1" title="Click to close">${cardBodyHtml(c, e)}</div>`;
    const r = chip.getBoundingClientRect();
    pop.style.left = '0px'; pop.style.top = '0px';
    const w = Math.max(pop.offsetWidth, r.width), h = pop.offsetHeight;
    pop.style.left = Math.max(4, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
    pop.style.top = Math.max(4, Math.min(r.top, window.innerHeight - h - 8)) + 'px';
    pop.style.minWidth = r.width + 'px';
    pop.onmouseleave = () => { if (S.expandedKey === id) { S.expandedKey = null; renderMap(); } };
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
    if (S.modal.kind === 'column') {
        const list = partition().byCol.get(S.modal.column) || [];
        title.textContent = `${colLabel(S.modal.column)} — ${list.length} ${list.length === 1 ? 'job' : 'jobs'}`;
        const rows = list.filter(e => matchesSearch(e.c, q));
        body.innerHTML = rows.length ? rows.map(e => rowHtml(e)).join('') : `<div class="fm-empty">${list.length ? 'No jobs match.' : 'Nothing here.'}</div>`;
    } else {
        const { shipped } = partition();
        title.textContent = `Shipped — last ${SHIPPED_WINDOW_DAYS} days (${shipped.length})`;
        const rows = shipped.filter(({ c }) => matchesSearch(c, q));
        body.innerHTML = rows.length ? rows.map(({ c, shippedOn }) => rowHtml({ c }, ` · shipped ${fmtDate(shippedOn)}`)).join('') : `<div class="fm-empty">${shipped.length ? 'No jobs match.' : `Nothing shipped in the last ${SHIPPED_WINDOW_DAYS} days.`}</div>`;
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
            loadAllProjects().catch(err => { logger.warn('[project-map] projects failed', err); return []; })
        ]);
        S.projects = new Map((projects || []).map(p => [String(p.project_number || '').trim(), p]));
        S.castings = summarise(tasks);
        notice('');
        renderMap();
        $('fm-updated').textContent = 'Updated ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch (err) {
        logger.error('[project-map] load failed', err);
        notice('Could not load: ' + (err && err.message ? err.message : err), 'error');
    } finally {
        S.loading = false;
    }
}

function step(n) {
    S.anchor = S.view === 'week' ? addDays(S.anchor, 7 * n) : addDays(S.anchor, n);
    if (S.view === 'day') { while (parseIso(S.anchor).getDay() === 0) S.anchor = addDays(S.anchor, n > 0 ? 1 : -1); }   // skip Sundays
    S.expandedKey = null;
    renderMap();
}

function wireEvents() {
    $('fm-app').addEventListener('click', (e) => {
        const view = e.target.closest('[data-view]');
        if (view) { S.view = view.dataset.view; S.expandedKey = null; renderMap(); return; }
        const head = e.target.closest('[data-open-col]');
        if (head) { S.expandedKey = null; renderMap(); openModal('column', { column: head.dataset.openCol }); return; }
        const card = e.target.closest('[data-key]');
        if (card) { S.expandedKey = S.expandedKey === card.dataset.key ? null : card.dataset.key; renderMap(); }
    });
    $('pm-prev').addEventListener('click', () => step(-1));
    $('pm-next').addEventListener('click', () => step(1));
    $('pm-today').addEventListener('click', () => { S.anchor = today(); S.expandedKey = null; renderMap(); });
    const modal = $('fm-modal');
    modal.addEventListener('click', (e) => {
        const txt = e.target.closest('[data-expand]');
        if (txt && S.modal) { S.modal.expandedKey = S.modal.expandedKey === txt.dataset.expand ? null : txt.dataset.expand; renderModalBody(); return; }
        if (e.target === modal || e.target.closest('#fm-modal-close')) closeModal();
    });
    $('fm-modal-search').addEventListener('input', (e) => { if (S.modal) { S.modal.filter = e.target.value.trim().toLowerCase(); renderModalBody(); } });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { if (S.modal) closeModal(); else if (S.expandedKey) { S.expandedKey = null; renderMap(); } }
        if (!S.modal && !e.target.closest('input')) { if (e.key === 'ArrowLeft') step(-1); if (e.key === 'ArrowRight') step(1); }
    });
    $('fm-search').addEventListener('input', (e) => { S.search = e.target.value.trim().toLowerCase(); renderMap(); });
    $('fm-refresh').addEventListener('click', () => loadAll());
    $('fm-shipped-btn').addEventListener('click', () => openModal('shipped'));
    window.addEventListener('resize', markOverflow);
    registerRefreshHandler(async (payload, payloads) => {
        const batch = Array.isArray(payloads) && payloads.length ? payloads : [payload];
        const onlyMaps = batch.every(isPortalChange) && batch.every(p => /^finishing_map/.test(signalInfo(p).table || ''));
        if (!onlyMaps) await loadAll({ silent: true });
    });
}

(async function boot() {
    S.anchor = today();
    if (parseIso(S.anchor).getDay() === 0) S.anchor = addDays(S.anchor, 1);
    if (document.getElementById('ro-test-count') || document.querySelector('[style*="99999"]')) document.body.classList.add('fm-has-test-bar');
    wireEvents();
    renderWhen();
    try { await initializeSupabase(); } catch (err) { logger.warn('[project-map] supabase init failed', err); }
    await loadAll();
    if (document.getElementById('ro-test-count')) document.body.classList.add('fm-has-test-bar');
})();

window.__projectMap = { state: S, partition, reload: loadAll };
