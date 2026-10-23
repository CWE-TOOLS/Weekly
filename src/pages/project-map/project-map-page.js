/**
 * Project Map — the weekly by department, one screen. Read-only.
 *
 * Views: Day (one date), Week (Mon–Sat, each column broken into weekdays), 4 weeks (broken into Week 1–7, 8–14, 15–21,
 * 22–28 blocks), Month (the weeks that belong to a calendar month, numbered Week 1, 2, 3… like the Releasability Board).
 * A casting appears in a department's column in every break where it has a weekly day in that department.
 * Shipped castings (last Ship day before the view, or job Shipped / Closed Out) sit in the Shipped pop-up for
 * SHIPPED_WINDOW_DAYS. Cards are collapsed; click one for the full card with the casting's trail through the
 * departments (the department it was opened from in bold); a full column's title opens the whole list.
 * The Departments picker (like the weekly's) chooses which columns are shown; the choice is remembered per browser.
 */
import { fetchAllTasks } from '../../services/data-service.js';
import { loadAllProjects } from '../../services/projects-service.js';
import { initializeSupabase, registerRefreshHandler, isPortalChange, signalInfo } from '../../services/supabase-service.js';
import { MAP_DEPARTMENTS, ALWAYS_SHOWN, SHIPPING_DEPARTMENTS, SHIPPED_STATUSES, SHIPPED_WINDOW_DAYS } from '../../config/project-map-config.js';
import { DEPARTMENT_COLORS, normalizeDepartmentClass } from '../../config/department-config.js';
import { parseDate, getLocalDateString, getMonday, getWeekMonth } from '../../utils/date-utils.js';
import { escapeHtml } from '../../utils/security-utils.js';
import { logger } from '../../utils/logger.js';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DEPTS_KEY = 'projectMapDepartments';
const SUNDAY_KEY = 'projectMapSundays';

const S = {
    castings: new Map(),     // key -> summary
    projects: new Map(),     // project_number -> { project_name, status, pm }
    view: 'day',             // 'day' | 'week' | 'month4' | 'month'
    anchor: null,            // 'YYYY-MM-DD': the day shown, a day of the week shown, or a day in the month shown
    depts: null,             // Set of departments to show (null = all)
    sundays: false,          // Week view: show a Sunday band too (the plant is usually closed)
    search: '',
    loading: false,
    expandedKey: null,       // chip opened to the full card: `${key}@${column}@${sectionIndex}`
    modal: null,             // { kind: 'column'|'shipped', column?, filter, expandedKey }
};

const $ = (id) => document.getElementById(id);
const today = () => getLocalDateString(new Date());
const parseIso = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (iso, n) => { const d = parseIso(iso); d.setDate(d.getDate() + n); return getLocalDateString(d); };
const fmtDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${Number(m)}/${Number(d)}/${y}`; };
const fmtShort = (iso) => { const [, m, d] = iso.split('-'); return `${Number(m)}/${Number(d)}`; };
const weekdayOf = (iso) => WEEKDAY[parseIso(iso).getDay()];
const mondayOf = (iso) => getLocalDateString(getMonday(parseIso(iso)));
const deptRank = (d) => MAP_DEPARTMENTS.indexOf(d);

// ---------------------------------------------------------------- the view: its range and its breaks ("sections")

/** The weeks (Mondays) that belong to a calendar month, the way the Releasability Board counts them. */
function monthWeeks(year, month) {
    const out = [];
    let m = getMonday(new Date(year, month, 1));
    for (let i = 0; i < 7; i++) {
        const wm = getWeekMonth(m);
        const wy = m.getFullYear() + (wm < m.getMonth() ? 1 : 0);   // a late-December Monday whose week belongs to January
        if (wm === month && (m.getFullYear() === year || wy === year)) out.push(getLocalDateString(m));
        else if (out.length) break;
        m = new Date(m.getFullYear(), m.getMonth(), m.getDate() + 7);
    }
    return out;
}

/** { start, end, sections: [{ label, sub, start, end }], title } for the current view. */
function viewSpec() {
    const a = S.anchor;
    if (S.view === 'day') {
        return { start: a, end: a, sections: [{ label: '', sub: '', start: a, end: a }], title: `${weekdayOf(a)} ${fmtDate(a)}${a === today() ? ' (today)' : ''}` };
    }
    if (S.view === 'week') {
        const mon = mondayOf(a);
        const days = S.sundays ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4, 5];
        const sections = days.map(i => { const d = addDays(mon, i); return { label: weekdayOf(d), sub: fmtShort(d), start: d, end: d }; });
        const last = addDays(mon, days[days.length - 1]);
        return { start: mon, end: last, sections, title: `Week of ${fmtShort(mon)} – ${fmtShort(last)}${mon === mondayOf(today()) ? ' (this week)' : ''}` };
    }
    if (S.view === 'month4') {
        const mon = mondayOf(a);
        const sections = [0, 1, 2, 3].map(i => { const s = addDays(mon, 7 * i); return { label: `Week ${7 * i + 1}–${7 * i + 7}`, sub: `${fmtShort(s)} – ${fmtShort(addDays(s, 5))}`, start: s, end: addDays(s, 6) }; });
        return { start: mon, end: addDays(mon, 27), sections, title: `4 weeks: ${fmtShort(mon)} – ${fmtShort(addDays(mon, 26))}${mon === mondayOf(today()) ? ' (from this week)' : ''}` };
    }
    // month: the weeks that belong to the month holding the anchor (by the board's rule)
    const d = parseIso(a);
    const wm = getWeekMonth(getMonday(d));
    let year = d.getFullYear();
    if (wm === 0 && d.getMonth() === 11) year += 1;
    if (wm === 11 && d.getMonth() === 0) year -= 1;
    const weeks = monthWeeks(year, wm);
    const sections = weeks.map((s, i) => ({ label: `Week ${i + 1}`, sub: `${fmtShort(s)} – ${fmtShort(addDays(s, 5))}`, start: s, end: addDays(s, 6) }));
    const thisMonth = weeks.includes(mondayOf(today()));
    return { start: weeks[0], end: addDays(weeks[weeks.length - 1], 6), sections, title: `${MONTHS[wm]} ${year}${thisMonth ? ' (this month)' : ''}`, month: wm, year };
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
    for (const c of out.values()) for (const list of c.days.values()) list.sort();
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

/**
 * For the current view: byCol = Map(dept -> sections[] of entries), shipped[].
 * entry = { c, dept, days: [iso in that section], firstIdx, dayIndex, dayTotal }
 */
function partition() {
    const spec = viewSpec();
    const byCol = new Map(MAP_DEPARTMENTS.map(d => [d, spec.sections.map(() => [])]));
    const shipped = [];
    const cutoff = addDays(today(), -SHIPPED_WINDOW_DAYS);
    const byName = (a, b) => jobName(a).localeCompare(jobName(b)) || String(a.castingNumber).localeCompare(String(b.castingNumber), undefined, { numeric: true });
    for (const c of S.castings.values()) {
        const s = shippedOn(c, spec.start);
        if (s) { if (s >= cutoff) shipped.push({ c, shippedOn: s }); continue; }
        for (const [dept, list] of c.days) {
            if (deptRank(dept) === -1) continue;                   // Batch / Layout / Samples / Facilities are not stops
            spec.sections.forEach((sec, i) => {
                const inSec = list.filter(d => d >= sec.start && d <= sec.end);
                if (!inSec.length) return;
                byCol.get(dept)[i].push({ c, dept, days: inSec, firstIdx: list.indexOf(inSec[0]) + 1, dayIndex: list.indexOf(inSec[inSec.length - 1]) + 1, dayTotal: list.length });
            });
        }
    }
    for (const sections of byCol.values()) for (const list of sections) list.sort((a, b) => byName(a.c, b.c));
    shipped.sort((a, b) => b.shippedOn.localeCompare(a.shippedOn) || byName(a.c, b.c));
    return { byCol, shipped, spec };
}

/** Columns to draw. In Day view a ticked department with nothing scheduled that day is hidden too (and listed in a notice). */
function shownDepartments(byCol) {
    const ticked = MAP_DEPARTMENTS.filter(d => (!S.depts || S.depts.has(d)) && (ALWAYS_SHOWN.has(d) || byCol.get(d).some(l => l.length)));
    if (S.view !== 'day') return { shown: ticked, hiddenEmpty: [] };
    const shown = ticked.filter(d => byCol.get(d).some(l => l.length));
    return { shown, hiddenEmpty: ticked.filter(d => !shown.includes(d)) };
}

// ---------------------------------------------------------------- cards

function entryLine(e) {
    const span = e.firstIdx === e.dayIndex ? `day ${e.dayIndex}` : `days ${e.firstIdx}–${e.dayIndex}`;
    if (S.view === 'day') return `${span} of ${e.dayTotal}`;
    return `${e.days.map(weekdayOf).join(' ')} · ${span} of ${e.dayTotal}`;
}

function cardBodyHtml(c, e) {
    const p = projectOf(c.projectNumber);
    const fmtN = (v) => (v == null || isNaN(v)) ? null : Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
    const inv = c.inv ? [`${c.inv.types} types`, `${c.inv.pcs} pcs`, fmtN(c.inv.cuFt) != null ? `${fmtN(c.inv.cuFt)} cu ft${c.inv.cuFtComplete === false ? ' (partial)' : ''}` : null, fmtN(c.inv.ff) != null ? `${fmtN(c.inv.ff)} ff sq ft${c.inv.ffComplete === false ? ' (partial)' : ''}` : null].filter(Boolean).join(' · ') : '';
    const trail = [...c.days.entries()].filter(([d]) => deptRank(d) !== -1).sort((a, b) => deptRank(a[0]) - deptRank(b[0]))
        .map(([d, list]) => {
            const text = escapeHtml(`${d} ${fmtShort(list[0])}${list.length > 1 ? `–${fmtShort(list[list.length - 1])}` : ''}`);
            return e && e.dept === d ? `<b class="pm-trail-here">${text}</b>` : text;
        }).join(' · ');
    return `<div class="fm-card-job">${escapeHtml(jobName(c))}</div>
        <div class="fm-card-cast">Cast ${escapeHtml(c.castingNumber)}<span class="fm-card-pn">${escapeHtml(c.projectNumber)}</span></div>
        ${p && p.pm ? `<div class="fm-card-meta">${escapeHtml(p.pm)}</div>` : ''}
        ${inv ? `<div class="fm-card-meta">${escapeHtml(inv)}</div>` : ''}
        ${e ? `<div class="fm-card-meta fm-card-finish">${escapeHtml(e.dept)}: ${escapeHtml(entryLine(e))}</div>` : ''}
        ${c.lastShip ? `<div class="fm-card-meta">Ship ${fmtDate(c.lastShip)}</div>` : ''}
        ${trail ? `<div class="fm-card-meta pm-trail">${trail}</div>` : ''}`;
}

function chipHtml(e, col, sec) {
    const c = e.c;
    const pcs = c.inv && c.inv.pcs != null ? `${c.inv.pcs} pcs` : '';
    const id = `${c.key}@${col}@${sec}`;
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
            ${open ? cardBodyHtml(c, e.dept ? e : null) : `<div class="fm-card-job">${escapeHtml(jobName(c))} <b>Cast ${escapeHtml(c.castingNumber)}</b> <span class="fm-card-pn">${escapeHtml(c.projectNumber)}</span> <span class="fm-card-meta">${escapeHtml([pcs, e.dept ? entryLine(e) : ''].filter(Boolean).join(' · '))}${extra}</span></div>`}
        </div>
    </div>`;
}

// ---------------------------------------------------------------- render

function colStyle(col) {
    const c = DEPARTMENT_COLORS[normalizeDepartmentClass(col)];
    return c ? `--pm-col:${c.background};` : '';
}

function renderWhen(spec) {
    $('pm-when-label').textContent = spec.title;
    for (const b of document.querySelectorAll('.pm-view-btn')) b.classList.toggle('pm-view-on', b.dataset.view === S.view);
    const sun = $('pm-sunday');
    if (sun) { sun.hidden = S.view !== 'week'; sun.classList.toggle('pm-view-on', S.sundays); sun.setAttribute('aria-pressed', String(S.sundays)); }
}

function renderMap() {
    const map = $('pm-map');
    const { byCol, shipped, spec } = partition();
    const { shown, hiddenEmpty } = shownDepartments(byCol);
    const hiddenEl = $('pm-hidden');
    if (hiddenEl) {
        hiddenEl.hidden = !hiddenEmpty.length;
        hiddenEl.innerHTML = hiddenEmpty.length ? `<span class="pm-hidden-why">Hidden, nothing scheduled ${spec.title.includes('(today)') ? 'today' : 'that day'}:</span> ${hiddenEmpty.map(d => `<span class="pm-hidden-dept" style="${colStyle(d)}">${escapeHtml(d)}</span>`).join('')}` : '';
    }
    if (!shown.length) { map.dataset.layout = ''; map.innerHTML = `<div class="fm-empty pm-none">Nothing scheduled ${S.view === 'day' ? 'that day' : 'in this view'} for the departments you have ticked.</div>`; $('pm-sub').textContent = '0 on the floor'; renderWhen(spec); renderDeptPicker(); renderPopover(); if (S.modal) renderModalBody(); return; }
    const layoutKey = `${S.view}|${spec.start}|${spec.sections.length}|${shown.join('|')}`;   // rebuild when the bands change too
    if (map.dataset.layout !== layoutKey) {
        map.dataset.layout = layoutKey;
        map.style.setProperty('--pm-cols', String(shown.length));
        const last = spec.sections.length - 1;
        map.innerHTML = shown.map((col, k) => `<div class="pm-col" data-col="${escapeHtml(col)}" style="${colStyle(col)}">
            <button type="button" class="fm-area-head pm-cell-head" style="grid-column:${k + 1};grid-row:1" data-open-col="${escapeHtml(col)}" title="See every job in ${escapeHtml(col)}">
                <span class="fm-area-label">${escapeHtml(col)}</span>
                <span class="fm-area-more" data-more="${escapeHtml(col)}"></span>
                <span class="fm-area-count" data-count="${escapeHtml(col)}">0</span>
            </button>${spec.sections.map((sec, i) => `
            <div class="pm-cell${i === last ? ' pm-cell-last' : ''}" style="grid-column:${k + 1};grid-row:${i + 2}" data-cellcol="${escapeHtml(col)}">
                ${sec.label ? `<div class="pm-section-head" data-open-band="${escapeHtml(col)}|${i}" title="See every ${escapeHtml(col)} job in ${escapeHtml(sec.label)}"><span>${escapeHtml(sec.label)}</span><span class="pm-section-sub">${escapeHtml(sec.sub)}</span><span class="pm-section-n" data-secn="${escapeHtml(col)}|${i}"></span></div>` : ''}
                <div class="fm-cards" data-cards="${escapeHtml(col)}|${i}"></div>
            </div>`).join('')}
        </div>`).join('');
    }
    // Row heights: every band the same height (user, 2026-10-23), so the bands read like a calendar.
    map.style.gridTemplateRows = 'auto ' + spec.sections.map(() => 'minmax(0, 1fr)').join(' ');
    map.classList.toggle('pm-banded', spec.sections.length > 1);
    let onFloor = 0;
    for (const col of shown) {
        const sections = byCol.get(col);
        let total = 0;
        sections.forEach((list, i) => {
            total += list.length;
            const box = map.querySelector(`[data-cards="${CSS.escape(col + '|' + i)}"]`);
            if (box) box.innerHTML = list.map(e => chipHtml(e, col, i)).join('');
            const n = map.querySelector(`[data-secn="${CSS.escape(col + '|' + i)}"]`);
            if (n) n.textContent = list.length ? String(list.length) : '';
        });
        onFloor += total;
        const n = map.querySelector(`[data-count="${CSS.escape(col)}"]`);
        if (n) n.textContent = String(total);
    }
    $('fm-shipped-count').textContent = String(shipped.length);
    const unit = { day: 'that day', week: 'that week', month4: 'in those 4 weeks', month: 'that month' }[S.view];
    $('pm-sub').textContent = `${onFloor} on the floor ${unit}`;
    renderWhen(spec);
    renderDeptPicker();
    markOverflow();
    renderPopover();
    if (S.modal) renderModalBody();
}

function markOverflow() {
    for (const colEl of document.querySelectorAll('.pm-col')) {
        let hidden = 0;
        for (const cell of colEl.querySelectorAll('.pm-cell')) {
            const bottom = cell.getBoundingClientRect().bottom;
            for (const chip of cell.querySelectorAll('.fm-chip')) if (chip.getBoundingClientRect().bottom > bottom + 2) hidden++;
        }
        const head = colEl.querySelector('.pm-cell-head');
        head.classList.toggle('fm-area-overflow', hidden > 0);
        head.querySelector('.fm-area-more').textContent = hidden > 0 ? `+${hidden} more — expand to see all` : '';
    }
}

function renderPopover() {
    let pop = $('fm-popover');
    const id = S.expandedKey;
    const chip = id ? $('pm-map').querySelector(`.fm-chip[data-key="${CSS.escape(id)}"]`) : null;
    const [key, col, sec] = id ? id.split('@') : [];
    const c = key ? S.castings.get(key) : null;
    if (!chip || !c) { if (pop) pop.remove(); if (id) S.expandedKey = null; return; }
    const e = ((partition().byCol.get(col) || [])[Number(sec)] || []).find(x => x.c.key === key) || null;
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

// ---------------------------------------------------------------- department picker (like the weekly's)

function renderDeptPicker() {
    const list = $('pm-dept-list');
    if (!list) return;
    list.innerHTML = MAP_DEPARTMENTS.filter(d => ALWAYS_SHOWN.has(d) || d === 'Mill').map(d => `<li><label><input type="checkbox" data-dept="${escapeHtml(d)}"${!S.depts || S.depts.has(d) ? ' checked' : ''}> ${escapeHtml(d)}</label></li>`).join('');
    const n = S.depts ? S.depts.size : null;
    $('pm-dept-label').textContent = n === null ? 'All departments' : n === 0 ? 'No departments' : n === 1 ? [...S.depts][0] : `${n} departments`;
}
function saveDepts() {
    try { localStorage.setItem(DEPTS_KEY, S.depts ? JSON.stringify([...S.depts]) : ''); } catch { /* ignore */ }
}
function loadDepts() {
    try { const raw = localStorage.getItem(DEPTS_KEY); if (raw) S.depts = new Set(JSON.parse(raw)); } catch { S.depts = null; }
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
        const { byCol, spec } = partition();
        const only = S.modal.section;                                        // one band only, or every band of the view
        const sections = (byCol.get(S.modal.column) || []).map((l, i) => only == null || i === only ? l : []);
        const total = sections.reduce((a, l) => a + l.length, 0);
        const bandTitle = only != null && spec.sections[only] ? `${spec.sections[only].label} ${spec.sections[only].sub}` : spec.title;
        title.textContent = `${S.modal.column} — ${total} ${total === 1 ? 'job' : 'jobs'} · ${bandTitle}`;
        const parts = [];
        sections.forEach((list, i) => {
            const rows = list.filter(e => matchesSearch(e.c, q));
            if (!rows.length) return;
            const sec = spec.sections[i];
            if (sec.label) parts.push(`<div class="fm-log-day">${escapeHtml(sec.label)} <span class="pm-section-sub">${escapeHtml(sec.sub)}</span></div>`);
            parts.push(rows.map(e => rowHtml(e)).join(''));
        });
        body.innerHTML = parts.length ? parts.join('') : `<div class="fm-empty">${total ? 'No jobs match.' : 'Nothing here.'}</div>`;
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

/** Does any casting have a weekly day on this date (any production department)? */
function anythingOn(iso) {
    for (const c of S.castings.values()) for (const [dept, list] of c.days) if (deptRank(dept) !== -1 && list.includes(iso)) return true;
    return false;
}

function step(n) {
    if (S.view === 'day') {
        S.anchor = addDays(S.anchor, n);
        // Skip a Sunday only when nothing at all is scheduled on it (or stop on every Sunday when "Include Sundays" is on).
        while (!S.sundays && parseIso(S.anchor).getDay() === 0 && !anythingOn(S.anchor)) S.anchor = addDays(S.anchor, n > 0 ? 1 : -1);
    } else if (S.view === 'week') S.anchor = addDays(S.anchor, 7 * n);
    else if (S.view === 'month4') S.anchor = addDays(S.anchor, 28 * n);
    else {
        const spec = viewSpec();
        const d = new Date(spec.year, spec.month + n, 15);                              // a safe day inside the next / previous month
        S.anchor = getLocalDateString(d);
    }
    S.expandedKey = null;
    renderMap();
}

function wireEvents() {
    $('fm-app').addEventListener('click', (e) => {
        const view = e.target.closest('[data-view]');
        if (view) { S.view = view.dataset.view; S.expandedKey = null; renderMap(); return; }
        if (e.target.closest('#pm-sunday')) { S.sundays = !S.sundays; try { localStorage.setItem(SUNDAY_KEY, S.sundays ? '1' : ''); } catch { /* ignore */ } S.expandedKey = null; renderMap(); return; }
        if (e.target.closest('#pm-dept-btn')) { $('pm-dept-dropdown').classList.toggle('open'); return; }
        if (e.target.closest('#pm-dept-all')) { S.depts = null; saveDepts(); renderMap(); return; }
        if (e.target.closest('#pm-dept-none')) { S.depts = new Set(); saveDepts(); renderMap(); return; }
        if (e.target.closest('#pm-dept-dropdown')) return;
        $('pm-dept-dropdown')?.classList.remove('open');
        const head = e.target.closest('[data-open-col]');
        if (head) { S.expandedKey = null; renderMap(); openModal('column', { column: head.dataset.openCol }); return; }
        const band = e.target.closest('[data-open-band]');
        if (band) { const [column, i] = band.dataset.openBand.split('|'); S.expandedKey = null; renderMap(); openModal('column', { column, section: Number(i) }); return; }
        const card = e.target.closest('[data-key]');
        if (card) { S.expandedKey = S.expandedKey === card.dataset.key ? null : card.dataset.key; renderMap(); return; }
        if (S.expandedKey) { S.expandedKey = null; renderMap(); }   // tap anywhere else closes the open card (touch screens)
    });
    $('pm-dept-list').addEventListener('change', (e) => {
        const box = e.target.closest('input[data-dept]');
        if (!box) return;
        const all = [...$('pm-dept-list').querySelectorAll('input[data-dept]')];
        const chosen = all.filter(b => b.checked).map(b => b.dataset.dept);
        S.depts = chosen.length === all.length ? null : new Set(chosen);
        saveDepts();
        renderMap();
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
        if (e.key === 'Escape') { if (S.modal) closeModal(); else if (S.expandedKey) { S.expandedKey = null; renderMap(); } else $('pm-dept-dropdown')?.classList.remove('open'); }
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
    loadDepts();
    try { S.sundays = !!localStorage.getItem(SUNDAY_KEY); } catch { /* ignore */ }
    if (document.getElementById('ro-test-count') || document.querySelector('[style*="99999"]')) document.body.classList.add('fm-has-test-bar');
    wireEvents();
    renderWhen(viewSpec());
    renderDeptPicker();
    try { await initializeSupabase(); } catch (err) { logger.warn('[project-map] supabase init failed', err); }
    await loadAll();
    if (document.getElementById('ro-test-count')) document.body.classList.add('fm-has-test-bar');
})();

window.__projectMap = { state: S, partition, viewSpec, reload: loadAll };
