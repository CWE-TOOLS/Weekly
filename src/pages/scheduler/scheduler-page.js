/**
 * Plant Scheduler page (2026-10-19) — PREVIEW.
 *
 * Replaces the Google-Sheet "Optimizer" grid: castings × days × 10 department columns, two lines
 * per cell (task + hours). Hours come from the portal's Optimizer Hours tab (casting_phases) and
 * are spread over working days; the grid is locked to those hours (a phase always totals exactly
 * what the Optimizer Hours tab says). Weekends need an explicit allow per day; holidays are never
 * used. Rows live in plant_schedule (migration/plant-schedule.sql). Nothing here feeds the weekly.
 *
 * @module pages/scheduler/scheduler-page
 */

import { initializeSupabase, getSupabaseClient, registerRefreshHandler, isPortalChange, isOwnSignal, signalInfo } from '../../services/supabase-service.js';
import { loadAllProjects } from '../../services/projects-service.js';
import { loadAllCastingPhasesForProject } from '../../services/optimizer-hours-service.js';
import {
    loadScheduleRange, loadScheduleForCastings, insertScheduleRows, updateScheduleRow, deleteScheduleRow,
    deleteCastingSchedule, loadScheduleSettings, saveScheduleSetting, isScheduleMigrationPending
} from '../../services/schedule-service.js';
import {
    DEPARTMENTS, DEPT_KEYS, TASKS, tasksForDept, taskForPhase, SETTINGS_DEFAULTS, REVENUE_PER_HOUR, SCHEDULABLE_STATUSES
} from '../../config/scheduler-config.js';
import { logger } from '../../utils/logger.js';

// ---------------------------------------------------------------------------
// state
// ---------------------------------------------------------------------------
const S = {
    settings: { ...SETTINGS_DEFAULTS },
    projects: [],                 // schedulable projects
    projectByNumber: new Map(),
    castings: [],                 // project_castings rows of those projects
    castingById: new Map(),
    phasesByCasting: new Map(),   // castingId -> casting_phases rows (sorted)
    withInventory: new Set(),     // castings that have Casting Inventory rows (the gate for "Not yet scheduled")
    rows: [],                     // plant_schedule rows in the window (+ pinned castings)
    from: '',                     // first day of the month on screen (ISO)
    view: 'grid',                 // 'grid' (castings × days) | 'revenue' (teams × days, $ per week — the sheet's Rev tab)
    search: '',
    pinned: new Set(),            // castings shown even without rows in the window
    busy: false
};
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// dates (local, ISO yyyy-mm-dd)
// ---------------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');
function toIso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function fromIso(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function todayIso() { return toIso(new Date()); }
function addDays(s, n) { const d = fromIso(s); d.setDate(d.getDate() + n); return toIso(d); }
function dow(s) { return fromIso(s).getDay(); }
function isWeekend(s) { const w = dow(s); return w === 0 || w === 6; }
function isHoliday(s) { return (S.settings.holidays || []).includes(s); }
function mondayOf(s) { return addDays(s, -((dow(s) + 6) % 7)); }
function shortDay(s) { const d = fromIso(s); return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`; }
function weekLabel(s) { const d = fromIso(s); return `Week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`; }
/** Next working day in a direction (weekends skipped unless allowed, holidays always skipped). */
function nextWorking(s, dir = 1, allowWeekend = false) {
    let cur = s;
    for (let i = 0; i < 60; i++) {
        cur = addDays(cur, dir);
        if (isHoliday(cur)) continue;
        if (!allowWeekend && isWeekend(cur)) continue;
        return cur;
    }
    return cur;
}
function workingOrNext(s) { return (isHoliday(s) || isWeekend(s)) ? nextWorking(s, 1) : s; }
function firstOfMonth(s) { return s.slice(0, 8) + '01'; }
function lastOfMonth(s) { const d = fromIso(s); return toIso(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
function addMonths(s, n) { const d = fromIso(s); return toIso(new Date(d.getFullYear(), d.getMonth() + n, 1)); }
function monthLabel(s) { return fromIso(s).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }
/** A month on screen is made of FULL weeks: from the Monday of the week holding the 1st to the end of the week holding
 *  the last day — week 1 may start in the previous month, the last week may end in the next (user rule 2026-10-20). */
function firstWeekdayOf(s) { let d = s; while (isWeekend(d)) d = addDays(d, 1); return d; }
function lastWeekdayOf(s) { let d = s; while (isWeekend(d)) d = addDays(d, -1); return d; }
/** Week 1 = the week holding the month's first weekday (Nov 2026 starts Mon 11/2, not the week of Sun 11/1). */
function windowStart() { return mondayOf(firstWeekdayOf(S.from)); }
function windowEnd() { return addDays(mondayOf(lastWeekdayOf(lastOfMonth(S.from))), 6); }
/** The days on screen: Monday to Saturday of every week (Saturday shaded grey as the week break); Sundays when switched on. */
function windowDays() {
    const out = [];
    const end = windowEnd();
    for (let d = windowStart(); d <= end; d = addDays(d, 1)) {
        if (!S.settings.showWeekends && dow(d) === 0) continue;   // Saturdays always shown (shaded); Sundays on request
        out.push(d);
    }
    return out;
}
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
const fmtH = (h) => { const n = Number(h) || 0; return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''); };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------------------
// loading
// ---------------------------------------------------------------------------
async function loadBase() {
    const client = getSupabaseClient();
    const all = await loadAllProjects();
    S.projects = all.filter(p => SCHEDULABLE_STATUSES.includes(p.status));
    S.projectByNumber = new Map(S.projects.map(p => [p.project_number, p]));
    const nums = S.projects.map(p => p.project_number);
    S.castings = [];
    for (let i = 0; i < nums.length; i += 40) {
        const { data, error } = await client.from('project_castings')
            .select('id, project_number, casting_number, casting_date, sort_order, phase_id')
            .in('project_number', nums.slice(i, i + 40));
        if (error) throw error;
        S.castings.push(...(data || []));
    }
    S.castings.sort((a, b) => (a.project_number.localeCompare(b.project_number)) || ((a.sort_order ?? 0) - (b.sort_order ?? 0)) || String(a.casting_number).localeCompare(String(b.casting_number), undefined, { numeric: true }));
    S.castingById = new Map(S.castings.map(c => [c.id, c]));
    const ids = S.castings.map(c => c.id);
    S.phasesByCasting = new Map();
    for (let i = 0; i < ids.length; i += 60) {
        const part = await loadAllCastingPhasesForProject(ids.slice(i, i + 60));
        for (const [k, v] of part) S.phasesByCasting.set(k, v);
    }
    // Only castings with a Casting Inventory are offered for scheduling (user rule 2026-10-19).
    S.withInventory = new Set();
    for (let i = 0; i < ids.length; i += 60) {
        const { data, error } = await client.from('casting_inventory').select('casting_id').in('casting_id', ids.slice(i, i + 60));
        if (error) throw error;
        for (const r of data || []) S.withInventory.add(r.casting_id);
    }
}

async function loadRows() {
    const inWindow = await loadScheduleRange(windowStart(), windowEnd());
    const seen = new Set(inWindow.map(r => r.id));
    const extraIds = [...S.pinned];
    const extra = extraIds.length ? await loadScheduleForCastings(extraIds) : [];
    S.rows = inWindow.concat(extra.filter(r => !seen.has(r.id)));
    // rows saved before the Mill column was split into CNC + Parts (2026-10-19)
    for (const r of S.rows) if (r.department === 'Mill') r.department = r.task === 'PARTS' ? 'Parts' : 'CNC';
}

// per-casting helpers
function phasesOf(castingId) { return (S.phasesByCasting.get(castingId) || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)); }
function mappedPhases(castingId) {
    const list = phasesOf(castingId).filter(p => Number(p.hours) > 0);
    const sealIdx = list.findIndex(p => taskForPhase(p.phase_name).code === 'SEAL');
    return list.map((p, i) => ({ phase: p, ...taskForPhase(p.phase_name, { afterSeal: sealIdx >= 0 && i > sealIdx }) }));
}
function rowsOfCasting(castingId) { return S.rows.filter(r => r.casting_id === castingId); }
function castingLabel(c) { return `Cast ${c.casting_number}`; }
function projectLabel(num) { const p = S.projectByNumber.get(num); return p ? `${num} · ${p.project_name || ''}` : num; }

/** Scheduled vs Optimizer hours per phase of a casting (any date). */
function lockReport(castingId) {
    const out = [];
    const rows = rowsOfCasting(castingId);
    for (const m of mappedPhases(castingId)) {
        const sched = rows.filter(r => r.phase_id === m.phase.id).reduce((n, r) => n + (Number(r.hours) || 0), 0);
        out.push({ phase: m.phase, code: m.code, dept: m.dept, unmapped: m.unmapped, optimizer: Number(m.phase.hours) || 0, scheduled: Math.round(sched * 100) / 100 });
    }
    return out;
}
function lockOk(report) { return report.every(r => Math.abs(r.scheduled - r.optimizer) < 0.01); }

// ---------------------------------------------------------------------------
// spreading (the default schedule from the Optimizer Hours tab)
// ---------------------------------------------------------------------------
function spreadPhase(m, startIso, dir) {
    const hours = Number(m.phase.hours) || 0;
    const perDay = Number((S.settings.dayHours || {})[m.dept]) || 8;
    const n = Math.max(1, Math.ceil(hours / perDay - 1e-9));
    const even = Math.round((hours / n) * 100) / 100;
    const rows = [];
    let cur = startIso;
    for (let k = 0; k < n; k++) {
        const h = k === n - 1 ? Math.round((hours - even * (n - 1)) * 100) / 100 : even;
        rows.push({ date: cur, hours: h });
        if (k < n - 1) cur = nextWorking(cur, dir);
    }
    return { rows, endIso: cur };
}

/** Build the rows for one casting. anchorIso = cast date (Cast phase lands there). */
function planCasting(casting, anchorIso) {
    const mapped = mappedPhases(casting.id);
    if (!mapped.length) return [];
    const castIdx = mapped.findIndex(m => m.code === 'CAST');
    const anchor = workingOrNext(anchorIso);
    const out = [];
    const push = (m, r) => out.push({
        project_number: casting.project_number, casting_id: casting.id, phase_id: m.phase.id,
        date: r.date, department: m.dept, task: m.code, hours: r.hours, weekend_ok: false,
        note: m.unmapped ? `Unmapped phase "${m.phase.phase_name}" — pick the task` : null
    });
    if (castIdx >= 0) {
        let cur = anchor;
        for (let i = castIdx; i < mapped.length; i++) {
            const r = spreadPhase(mapped[i], cur, 1);
            r.rows.forEach(x => push(mapped[i], x));
            cur = nextWorking(r.endIso, 1);
        }
        cur = nextWorking(anchor, -1);
        for (let i = castIdx - 1; i >= 0; i--) {
            const r = spreadPhase(mapped[i], cur, -1);
            r.rows.forEach(x => push(mapped[i], x));
            cur = nextWorking(r.endIso, -1);
        }
    } else {
        let cur = anchor;
        for (const m of mapped) {
            const r = spreadPhase(m, cur, 1);
            r.rows.forEach(x => push(m, x));
            cur = nextWorking(r.endIso, 1);
        }
    }
    return out;
}

async function scheduleCasting(castingId, anchorIso, { replace = false } = {}) {
    const c = S.castingById.get(castingId);
    if (!c) return;
    const plan = planCasting(c, anchorIso);
    if (!plan.length) { toast('This casting has no Optimizer Hours with hours > 0.', 'error'); return; }
    setBusy(true);
    const __h = await histBegin('schedule ' + castingLabel(c), [castingId]);
    try {
        if (replace) await deleteCastingSchedule(castingId, false);
        await insertScheduleRows(plan);
        S.pinned.add(castingId);
        await histEnd(__h);
        await loadRows();
        render();
        const first = plan.reduce((a, r) => r.date < a ? r.date : a, plan[0].date);
        const last = plan.reduce((a, r) => r.date > a ? r.date : a, plan[0].date);
        toast(`${projectLabel(c.project_number)} ${castingLabel(c)}: ${plan.length} days scheduled, ${shortDay(first)} → ${shortDay(last)}`);
    } catch (err) {
        logger.error('[scheduler] scheduleCasting', err);
        toast('Could not save the schedule: ' + (err.message || err), 'error');
    } finally { setBusy(false); }
}

/** Shift every row of a casting by n working days (sign = direction). Weekend-allowed rows keep their allowance but still move to working days. */
async function shiftCasting(castingId, n) {
    const rows = rowsOfCasting(castingId);
    if (!rows.length || !n) return;
    // one casting per day: where would this casting's Cast day(s) land?
    const moved = rows.filter(r => r.department === 'Cast').map(r => { let d = r.date; for (let i = 0; i < Math.abs(n); i++) d = nextWorking(d, Math.sign(n)); return d; });
    if (moved.length) {
        const taken = await takenCastDays(castingId);
        const clash = moved.find(d => taken.has(d));
        if (clash) { toast(`Can't shift: ${shortDay(clash)} already has ${whoCasts(taken.get(clash))}. Castings are one per day.`, 'error'); return; }
    }
    setBusy(true);
    const __h = await histBegin('shift ' + castingLabel(S.castingById.get(castingId) || {}), [castingId]);
    try {
        for (const r of rows) {
            let d = r.date;
            for (let i = 0; i < Math.abs(n); i++) d = nextWorking(d, Math.sign(n));
            await updateScheduleRow(r.id, { date: d });
        }
        await histEnd(__h);
        await loadRows();
        render();
        toast(`Moved ${rows.length} day${rows.length === 1 ? '' : 's'} by ${n > 0 ? '+' : ''}${n} working day${Math.abs(n) === 1 ? '' : 's'}`);
    } catch (err) { toast('Move failed: ' + (err.message || err), 'error'); }
    finally { setBusy(false); }
}

// ---------------------------------------------------------------------------
// rendering
// ---------------------------------------------------------------------------
function visibleCastings() {
    const days = new Set(windowDays());
    const q = S.search.trim().toLowerCase();
    const withRows = new Set(S.rows.filter(r => days.has(r.date)).map(r => r.casting_id));
    return S.castings.filter(c => {
        if (!withRows.has(c.id) && !S.pinned.has(c.id) && !(c.casting_date && days.has(c.casting_date))) return false;
        if (!q) return true;
        const p = S.projectByNumber.get(c.project_number);
        return c.project_number.toLowerCase().includes(q) || (p && (p.project_name || '').toLowerCase().includes(q));
    });
}

function render() {
    const ml = $('sc-month-label'); if (ml) ml.textContent = monthLabel(S.from);
    const vt = $('sc-view-toggle'); if (vt) vt.textContent = S.view === 'revenue' ? 'Schedule' : 'Revenue';
    if (S.view === 'revenue') renderRevenue(); else renderGrid();
    renderUnscheduled();
    renderBanner();
}

// ---------------------------------------------------------------------------
// revenue view — the sheet's "Rev" tab: one block per week, teams × days, hours × $135
// ---------------------------------------------------------------------------
const REV_ROWS = [
    { key: 'CNC',   label: 'CNC' },
    { key: 'Parts', label: 'Parts' },
    { key: 'FO',    label: 'FO' },
    { key: 'Cast',  label: 'Cast' },
    { key: 'DM',    label: 'Demold' },
    { key: 'F',     label: 'Finish' },
    { key: 'Seal',  label: 'Seal' },
    { key: 'Crate', label: 'Crate' },
    { key: 'Spec',  label: 'SPECIALITY' },
    { key: 'Ship',  label: 'Ship' }
];
const COST_ROWS = [
    { key: 'labor',    label: 'Labor Costs' },
    { key: 'material', label: 'Material Costs' },
    { key: 'sub',      label: 'Subcontractor Costs' }
];
const COGS_RED_ABOVE = 0.55;   // the sheet shows 55 %+ in red, below in green
const money2 = (n) => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function revDayHead(s) { const d = fromIso(s); return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]}, ${d.toLocaleDateString('en-US', { month: 'short' })} ${pad(d.getDate())}`; }
function costOf(date, key) { return Number(((S.settings.costs || {})[date] || {})[key]) || 0; }

/** The revenue view — laid out like the Optimizer's "Rev" tab (one block per week, Mon-Sat). */
function renderRevenue() {
    const wrap = $('sc-grid-wrap');
    const first = S.from, last = lastOfMonth(S.from);
    const hours = new Map();   // date|dept -> h
    for (const r of S.rows) {
        const k = `${r.date}|${r.department}`;
        hours.set(k, (hours.get(k) || 0) + (Number(r.hours) || 0));
    }
    const rev = (d, k) => (hours.get(`${d}|${k}`) || 0) * REVENUE_PER_HOUR;
    const fab = (d) => REV_ROWS.filter(r => r.key !== 'Ship').reduce((n, r) => n + rev(d, r.key), 0);
    const net = (d) => fab(d) + rev(d, 'Ship');
    const cogsTotal = (d) => COST_ROWS.reduce((n, c) => n + costOf(d, c.key), 0);
    const pctCell = (cost, netv) => {
        const p = netv > 0 ? cost / netv : 0;
        return `<td class="sc-rv-pct ${p > COGS_RED_ABOVE ? 'sc-rv-bad' : 'sc-rv-good'}">${Math.round(p * 100)}%</td>`;
    };
    const weeks = [];
    for (let m = windowStart(); m <= windowEnd(); m = addDays(m, 7)) weeks.push([0, 1, 2, 3, 4, 5].map(i => addDays(m, i)));
    const inMonth = (d) => d >= first && d <= last;
    const sum = (days, f) => days.reduce((n, d) => n + f(d), 0);

    let html = `<div class="sc-rv"><div class="sc-rv-banner">${esc(monthLabel(S.from))}</div>`;
    weeks.forEach((days, wi) => {
        const dcls = (d) => (isHoliday(d) ? ' sc-rv-hol' : '');
        html += '<table class="sc-rv-table"><colgroup><col class="sc-rv-c-label">' + days.map(() => '<col class="sc-rv-c-day">').join('') + '<col class="sc-rv-c-day"></colgroup>';
        html += `<thead><tr><th class="sc-rv-week">W E E K ${wi + 1}</th>${days.map(d => `<th class="sc-rv-day${dcls(d)}" title="${isHoliday(d) ? 'holiday' : ''}">${esc(revDayHead(d))}</th>`).join('')}<th class="sc-rv-total">WEEK TOTAL</th></tr></thead><tbody>`;
        html += `<tr class="sc-rv-fab"><td class="sc-rv-label">Fabrication Revenue</td>${days.map(d => `<td class="${dcls(d)}">${money2(fab(d))}</td>`).join('')}<td>${money2(sum(days, fab))}</td></tr>`;
        for (const r of REV_ROWS) {
            html += `<tr class="sc-rv-dept" data-dept="${r.key}"><td class="sc-rv-label">${esc(r.label)}</td>${days.map(d => `<td class="${dcls(d)}">${money(rev(d, r.key))}</td>`).join('')}<td>${money(sum(days, d => rev(d, r.key)))}</td></tr>`;
        }
        html += `<tr class="sc-rv-net"><td class="sc-rv-label">NET REVENUE</td>${days.map(d => `<td class="${dcls(d)}">${money2(net(d))}</td>`).join('')}<td>${money2(sum(days, net))}</td></tr>`;
        for (const c of COST_ROWS) {
            html += `<tr class="sc-rv-cost"><td class="sc-rv-label">${c.label}</td>${days.map(d => `<td class="${dcls(d)}"><input class="sc-rv-in" data-cost="${c.key}" data-date="${d}" value="${costOf(d, c.key) ? esc(money2(costOf(d, c.key))) : ''}" placeholder="—" title="Type the ${c.label.toLowerCase()} for ${esc(shortDay(d))}"></td>`).join('')}<td>${money2(sum(days, d => costOf(d, c.key)))}</td></tr>`;
        }
        html += `<tr class="sc-rv-cogs-total"><td class="sc-rv-label">Total COGS</td>${days.map(d => `<td class="${dcls(d)}">${money2(cogsTotal(d))}</td>`).join('')}<td>${money2(sum(days, cogsTotal))}</td></tr>`;
        html += `<tr class="sc-rv-cogs"><td class="sc-rv-label">COGS</td>${days.map(d => pctCell(cogsTotal(d), net(d))).join('')}${pctCell(sum(days, cogsTotal), sum(days, net))}</tr>`;
        html += '</tbody></table>';
    });
    // the month, counting only its own days
    const mdays = []; for (let d = first; d <= last; d = addDays(d, 1)) mdays.push(d);
    html += `<table class="sc-rv-table sc-rv-month"><colgroup><col class="sc-rv-c-label"><col class="sc-rv-c-day"></colgroup><thead><tr><th class="sc-rv-week">${esc(monthLabel(S.from).toUpperCase())}</th><th class="sc-rv-total" title="Counts only the days of ${esc(monthLabel(S.from))} itself, so a week shared with the next or previous month is not counted twice">MONTH TOTAL</th></tr></thead><tbody>`;
    html += `<tr class="sc-rv-fab"><td class="sc-rv-label">Fabrication Revenue</td><td>${money2(sum(mdays, fab))}</td></tr>`;
    for (const r of REV_ROWS) html += `<tr class="sc-rv-dept" data-dept="${r.key}"><td class="sc-rv-label">${esc(r.label)}</td><td>${money(sum(mdays, d => rev(d, r.key)))}</td></tr>`;
    html += `<tr class="sc-rv-net"><td class="sc-rv-label">NET REVENUE</td><td>${money2(sum(mdays, net))}</td></tr>`;
    for (const c of COST_ROWS) html += `<tr class="sc-rv-cost"><td class="sc-rv-label">${c.label}</td><td>${money2(sum(mdays, d => costOf(d, c.key)))}</td></tr>`;
    html += `<tr class="sc-rv-cogs-total"><td class="sc-rv-label">Total COGS</td><td>${money2(sum(mdays, cogsTotal))}</td></tr>`;
    html += `<tr class="sc-rv-cogs"><td class="sc-rv-label">COGS</td>${pctCell(sum(mdays, cogsTotal), sum(mdays, net))}</tr>`;
    html += `</tbody></table><p class="sc-hint">Revenue = scheduled hours × $${REVENUE_PER_HOUR}. Fabrication Revenue is every team except Ship; Net Revenue adds Ship. Type Labor, Material and Subcontractor costs straight into their cells (saved for everyone). Months run in full weeks, Monday to Saturday, so week 1 can start in the previous month and the last week can end in the next. The Month Total counts only ${esc(monthLabel(S.from))}'s own days.</p></div>`;
    wrap.innerHTML = html;
}

async function saveCostInput(inp) {
    const d = inp.dataset.date, k = inp.dataset.cost;
    const v = Math.max(0, Number(String(inp.value).replace(/[$,\s]/g, '')) || 0);
    const costs = { ...(S.settings.costs || {}) };
    costs[d] = { ...(costs[d] || {}), [k]: v };
    if (!v) delete costs[d][k];
    if (!Object.keys(costs[d]).length) delete costs[d];
    try { await saveScheduleSetting('costs', costs); S.settings.costs = costs; renderRevenue(); }
    catch (err) { toast('Could not save the cost: ' + (err.message || err), 'error'); }
}

function renderBanner() {
    const b = $('sc-banner');
    if (isScheduleMigrationPending()) {
        b.className = 'sc-banner sc-banner-error';
        b.innerHTML = 'The scheduler tables are not in the database yet. Run <code>migration/plant-schedule.sql</code> in the Supabase SQL editor, then reload this page.';
        b.hidden = false;
        return;
    }
    const bad = visibleCastings().filter(c => !lockOk(lockReport(c.id)) && rowsOfCasting(c.id).length);
    if (bad.length) {
        b.className = 'sc-banner sc-banner-warn';
        b.textContent = `${bad.length} casting${bad.length === 1 ? '' : 's'} on screen no longer match the Optimizer Hours tab (red dot on the row) — open the row menu and regenerate.`;
        b.hidden = false;
        return;
    }
    b.hidden = true;
}

function renderGrid() {
    const wrap = $('sc-grid-wrap');
    const days = windowDays();
    const today = todayIso();
    const castings = visibleCastings();
    const cellMap = new Map();   // cid|date|dept -> rows
    for (const r of S.rows) {
        const k = `${r.casting_id}|${r.date}|${r.department}`;
        if (!cellMap.has(k)) cellMap.set(k, []);
        cellMap.get(k).push(r);
    }
    const totals = new Map();    // date|dept -> hours (all castings, not only visible)
    const weekHours = new Map(); // monday -> hours
    for (const r of S.rows) {
        const k = `${r.date}|${r.department}`;
        totals.set(k, (totals.get(k) || 0) + (Number(r.hours) || 0));
        const wk = mondayOf(r.date);
        weekHours.set(wk, (weekHours.get(wk) || 0) + (Number(r.hours) || 0));
    }

    // header: weeks / days / departments
    let h = '<table class="sc-grid"><thead><tr><th class="sc-label" rowspan="3">Job · Casting</th>';
    const weeks = [];
    for (const d of days) { const wk = mondayOf(d); if (!weeks.length || weeks[weeks.length - 1].wk !== wk) weeks.push({ wk, days: [] }); weeks[weeks.length - 1].days.push(d); }
    // "Week 1", "Week 2" … centred over the Wednesday (revenue lives in the Revenue view only)
    const nD = DEPT_KEYS.length;
    weeks.forEach((w, wi) => {
        let mid = w.days.findIndex(d => dow(d) === 3);
        if (mid < 0) mid = Math.floor((w.days.length - 1) / 2);
        const before = mid, after = w.days.length - mid - 1;
        if (before) h += `<th class="sc-week sc-week-start" colspan="${before * nD}"></th>`;
        h += `<th class="sc-week sc-week-mid${before ? '' : ' sc-week-start'}" colspan="${nD}" title="Week of ${esc(shortDay(w.wk))}">Week ${wi + 1}</th>`;
        if (after) h += `<th class="sc-week sc-week-end" colspan="${after * nD}"></th>`;
    });
    h += '</tr><tr>';
    for (const d of days) {
        const cls = ['sc-day', isWeekend(d) ? 'sc-weekend' : '', isHoliday(d) ? 'sc-holiday' : '', d === today ? 'sc-today' : ''].join(' ');
        h += `<th class="${cls}" colspan="${DEPT_KEYS.length}" title="${isHoliday(d) ? 'Holiday — never scheduled' : isWeekend(d) ? 'Weekend — needs an allow' : ''}">${esc(shortDay(d))}</th>`;
    }
    h += '</tr><tr>';
    for (const d of days) DEPARTMENTS.forEach((dep, i) => { h += `<th class="sc-dept ${i === 0 ? 'sc-dept-first' : ''} ${isWeekend(d) ? 'sc-weekend' : ''} ${isHoliday(d) ? 'sc-holiday' : ''}" data-dept="${dep.key}">${dep.label}</th>`; });
    h += '</tr></thead><tbody>';

    if (!castings.length) {
        h += `<tr><td class="sc-label">—</td><td colspan="${days.length * DEPT_KEYS.length}" style="padding:12px;color:#6b7280;text-align:left">Nothing scheduled in this window. Use "Not yet scheduled" on the left, or move the window.</td></tr>`;
    }
    let lastProject = null;
    for (const c of castings) {
        if (c.project_number !== lastProject) {
            lastProject = c.project_number;
            h += `<tr class="sc-project"><td class="sc-label" title="${esc(projectLabel(c.project_number))}">${esc(projectLabel(c.project_number))}</td><td colspan="${days.length * DEPT_KEYS.length}"></td></tr>`;
        }
        const report = lockReport(c.id);
        const has = rowsOfCasting(c.id).length > 0;
        const bad = has && !lockOk(report);
        const tip = report.map(r => `${r.phase.phase_name}: ${fmtH(r.scheduled)} / ${fmtH(r.optimizer)} h`).join('\n') || 'No Optimizer Hours';
        // two rows per casting, like the sheet: the task word on top, the hours underneath
        let taskTds = '', hourTds = '';
        for (const d of days) {
            DEPT_KEYS.forEach((dept, i) => {
                const rows = cellMap.get(`${c.id}|${d}|${dept}`) || [];
                const cls = ['sc-cell', i === 0 ? 'sc-dept-first' : '', rows.length ? 'sc-has' : '', isWeekend(d) ? 'sc-weekend' : '', isHoliday(d) ? 'sc-holiday' : '', d === today ? 'sc-today' : '',
                    rows.some(r => /Unmapped/.test(r.note || '')) ? 'sc-unmapped' : '', rows.some(r => r.weekend_ok) ? 'sc-wkok' : ''].filter(Boolean).join(' ');
                let task = '', hrs = '';
                if (rows.length) {
                    task = [...new Set(rows.map(r => r.task))].join('+').toLowerCase();
                    hrs = fmtH(rows.reduce((n, r) => n + (Number(r.hours) || 0), 0));
                }
                const attrs = `data-cid="${c.id}" data-date="${d}" data-dept="${dept}"`;
                taskTds += `<td class="${cls} sc-trow" ${attrs}><span class="sc-task">${esc(task)}</span></td>`;
                hourTds += `<td class="${cls} sc-hrow" ${attrs}><span class="sc-h">${hrs}</span></td>`;
            });
        }
        h += `<tr class="sc-cast-top"><td class="sc-label" rowspan="2" data-cid="${c.id}" title="${esc(tip)}\n\nClick for options"><span class="sc-castnum">${esc(castingLabel(c))}</span><span class="sc-castdate">${c.casting_date ? 'cast ' + esc(shortDay(c.casting_date)) : 'no cast date'}</span>${bad ? '<span class="sc-lock" title="Scheduled hours differ from the Optimizer Hours tab"></span>' : ''}</td>${taskTds}</tr>`;
        h += `<tr class="sc-cast-bottom">${hourTds}</tr>`;
    }
    h += '</tbody><tfoot><tr><td class="sc-label">Hours needed</td>';
    for (const d of days) DEPT_KEYS.forEach((dept, i) => {
        const v = totals.get(`${d}|${dept}`) || 0;
        h += `<td class="${i === 0 ? 'sc-dept-first' : ''}${isWeekend(d) ? ' sc-weekend' : ''}">${v ? fmtH(v) : ''}</td>`;
    });
    h += '</tr></tfoot></table>';
    wrap.innerHTML = h;
}

function renderUnscheduled() {
    const box = $('sc-unscheduled');
    const scheduled = new Set(S.rows.map(r => r.casting_id));
    const q = S.search.trim().toLowerCase();
    const list = S.castings.filter(c => {
        if (scheduled.has(c.id)) return false;
        if (!S.withInventory.has(c.id)) return false;   // no Casting Inventory yet -> not offered
        if (q) { const p = S.projectByNumber.get(c.project_number); if (!(c.project_number.toLowerCase().includes(q) || (p && (p.project_name || '').toLowerCase().includes(q)))) return false; }
        return true;
    });
    // upcoming cast dates first (soonest first), then castings without a date, then past dates (latest first)
    const today = todayIso();
    const rank = (c) => !c.casting_date ? 1 : (c.casting_date >= today ? 0 : 2);
    list.sort((a, b) => rank(a) - rank(b)
        || (rank(a) === 0 ? a.casting_date.localeCompare(b.casting_date) : rank(a) === 2 ? b.casting_date.localeCompare(a.casting_date) : 0)
        || a.project_number.localeCompare(b.project_number));
    if (!list.length) { box.innerHTML = '<div class="sc-uns-empty">Every casting with a Casting Inventory is on the grid.</div>'; return; }
    box.innerHTML = list.slice(0, 80).map(c => {
        const p = S.projectByNumber.get(c.project_number);
        const hrs = mappedPhases(c.id).reduce((n, m) => n + (Number(m.phase.hours) || 0), 0);
        const btn = hrs > 0
            ? `<button type="button" class="btn-primary" data-schedule="${c.id}">Schedule</button>`
            : '<span class="sc-uns-nohrs" title="Enter the hours on the Optimizer Hours tab first">no Optimizer Hours yet</span>';
        return `<div class="sc-uns"><div class="sc-uns-name"><strong>${esc(c.project_number)}</strong> ${esc(castingLabel(c))}<small>${esc(p?.project_name || '')} · ${hrs > 0 ? fmtH(hrs) + ' h' : 'Optimizer Hours empty'}${c.casting_date ? ' · cast ' + esc(shortDay(c.casting_date)) : ' · no cast date'}</small></div>${btn}</div>`;
    }).join('') + (list.length > 80 ? `<div class="sc-uns-empty">…and ${list.length - 80} more (search to narrow)</div>` : '');
}

// ---------------------------------------------------------------------------
// cell editor
// ---------------------------------------------------------------------------
let editorCtx = null;   // { cid, date, dept }

function openEditor(td) {
    const cid = td.dataset.cid, date = td.dataset.date, dept = td.dataset.dept;
    const c = S.castingById.get(cid);
    if (!c) return;
    editorCtx = { cid, date, dept, allowWeekend: false };
    const ed = $('sc-editor');
    const rows = S.rows.filter(r => r.casting_id === cid && r.date === date && r.department === dept);
    const holiday = isHoliday(date), weekend = isWeekend(date);
    const weekendAllowed = rows.some(r => r.weekend_ok);
    const opts = tasksForDept(dept);
    const phaseLine = (r) => {
        if (!r.phase_id) return '<div class="sc-ed-phase">typed by hand — not tied to the Optimizer Hours</div>';
        const ph = phasesOf(cid).find(p => p.id === r.phase_id);
        const all = S.rows.filter(x => x.phase_id === r.phase_id);
        const tot = all.reduce((n, x) => n + (Number(x.hours) || 0), 0);
        return `<div class="sc-ed-phase">Optimizer Hours: ${esc(ph?.phase_name || '?')} ${fmtH(ph?.hours)} h over ${all.length} day${all.length === 1 ? '' : 's'} (scheduled ${fmtH(tot)} h). Changing this day moves the difference to the phase's other days.</div>`;
    };
    let html = `<h4>${esc(projectLabel(c.project_number))} — ${esc(castingLabel(c))}</h4><div class="sc-sub">${esc(shortDay(date))} · ${esc(DEPARTMENTS.find(d => d.key === dept)?.label || dept)}</div>`;
    if (holiday) html += '<div class="sc-ed-alert">Holiday — nothing can be scheduled on this day. Change the holiday list in Settings if that is wrong.</div>';
    else if (weekend && !weekendAllowed) html += `<div class="sc-ed-alert">Weekend. Work is only scheduled here if someone allows it.<br><button type="button" class="btn-secondary" id="sc-ed-allow">Allow this weekend day for this casting</button></div>`;
    for (const r of rows) {
        html += `<div class="sc-ed-row" data-id="${r.id}"><select data-task>${opts.map(o => `<option${o === r.task ? ' selected' : ''}>${o}</option>`).join('')}${opts.includes(r.task) ? '' : `<option selected>${esc(r.task)}</option>`}</select><input type="number" step="0.5" min="0" data-hours value="${fmtH(r.hours)}"><button type="button" class="sc-del" data-del title="Remove">&times;</button>${phaseLine(r)}</div>`;
    }
    const canEdit = !holiday && (!weekend || weekendAllowed);
    if (canEdit) html += `<div class="sc-ed-add"><select id="sc-ed-add-task">${opts.map(o => `<option>${o}</option>`).join('')}</select><input type="number" id="sc-ed-add-hours" step="0.5" min="0" placeholder="hours"><button type="button" class="btn-secondary" id="sc-ed-add">Add</button></div>`;
    if (rows.length) html += `<div class="sc-ed-move">Move these to <input type="date" id="sc-ed-move-date" value="${date}"><button type="button" class="btn-secondary" id="sc-ed-move">Move</button></div>`;
    html += `<div class="sc-ed-actions"><button type="button" class="btn-secondary" id="sc-ed-cancel">Close</button><div class="right">${canEdit && rows.length ? '<button type="button" class="btn-primary" id="sc-ed-save">Save</button>' : ''}</div></div>`;
    ed.innerHTML = html;
    ed.hidden = false;
    placeEditor(td);
}

function placeEditor(anchorEl) {
    const ed = $('sc-editor');
    const r = anchorEl.getBoundingClientRect();
    const w = ed.offsetWidth || 360, hgt = ed.offsetHeight || 200;
    let left = r.left + window.scrollX + 8, top = r.bottom + window.scrollY + 6;
    if (left + w > window.innerWidth - 8) left = Math.max(8, window.innerWidth - w - 8);
    if (r.bottom + hgt > window.innerHeight - 8) top = Math.max(8, r.top + window.scrollY - hgt - 6);
    ed.style.left = left + 'px';
    ed.style.top = top + 'px';
}
function closeEditor() { $('sc-editor').hidden = true; editorCtx = null; }

/** Change a phase-driven day's hours and keep the phase total (the lock). Returns an error string or null. */
async function changePhaseDayHours(row, newHours) {
    const delta = Math.round((newHours - (Number(row.hours) || 0)) * 100) / 100;
    if (!delta) return null;
    const others = S.rows.filter(x => x.phase_id === row.phase_id && x.id !== row.id).sort((a, b) => b.date.localeCompare(a.date));
    if (!others.length) return 'This phase has only this one day, so its hours are locked to the Optimizer Hours tab. Add another day for the phase first, or change the hours on the Optimizer Hours tab.';
    if (delta > 0) {
        // take hours away from the other days, latest first
        let need = delta;
        const plan = [];
        for (const o of others) {
            if (need <= 0) break;
            const take = Math.min(Number(o.hours) || 0, need);
            plan.push({ row: o, hours: Math.round(((Number(o.hours) || 0) - take) * 100) / 100 });
            need = Math.round((need - take) * 100) / 100;
        }
        if (need > 0) return 'Not enough hours on the phase\'s other days to move here. The phase total is locked to the Optimizer Hours tab.';
        for (const p of plan) { if (p.hours <= 0) await deleteScheduleRow(p.row.id); else await updateScheduleRow(p.row.id, { hours: p.hours }); }
    } else {
        const o = others[0];
        await updateScheduleRow(o.id, { hours: Math.round(((Number(o.hours) || 0) - delta) * 100) / 100 });
    }
    if (newHours <= 0) await deleteScheduleRow(row.id); else await updateScheduleRow(row.id, { hours: newHours });
    return null;
}

async function saveEditor() {
    if (!editorCtx) return;
    const ed = $('sc-editor');
    setBusy(true);
    const __h = await histBegin('edit cell', [editorCtx.cid]);
    try {
        for (const line of ed.querySelectorAll('.sc-ed-row')) {
            const row = S.rows.find(r => r.id === line.dataset.id);
            if (!row) continue;
            const task = line.querySelector('[data-task]').value;
            const hours = Math.max(0, Number(line.querySelector('[data-hours]').value) || 0);
            if (task !== row.task) await updateScheduleRow(row.id, { task, note: /Unmapped/.test(row.note || '') ? null : row.note });
            if (Math.abs(hours - (Number(row.hours) || 0)) > 0.001) {
                if (row.phase_id) { const err = await changePhaseDayHours(row, hours); if (err) { toast(err, 'error'); } }
                else if (hours <= 0) await deleteScheduleRow(row.id);
                else await updateScheduleRow(row.id, { hours });
            }
        }
        await histEnd(__h);
        await loadRows();
        render();
        closeEditor();
    } catch (err) { toast('Save failed: ' + (err.message || err), 'error'); }
    finally { setBusy(false); }
}

async function addEditorEntry() {
    if (!editorCtx) return;
    const task = $('sc-ed-add-task').value;
    const hours = Number($('sc-ed-add-hours').value) || 0;
    if (hours <= 0) { toast('Enter the hours first.', 'error'); return; }
    const c = S.castingById.get(editorCtx.cid);
    const weekend = isWeekend(editorCtx.date);
    setBusy(true);
    const __h = await histBegin('add task', [editorCtx.cid]);
    try {
        await insertScheduleRows([{ project_number: c.project_number, casting_id: c.id, phase_id: null, date: editorCtx.date, department: editorCtx.dept, task, hours, weekend_ok: weekend, note: 'Typed by hand' }]);
        S.pinned.add(c.id);
        await histEnd(__h);
        await loadRows();
        render();
        const td = document.querySelector(`td.sc-cell[data-cid="${c.id}"][data-date="${editorCtx.date}"][data-dept="${editorCtx.dept}"]`);
        if (td) openEditor(td); else closeEditor();
    } catch (err) { toast('Add failed: ' + (err.message || err), 'error'); }
    finally { setBusy(false); }
}

async function allowWeekendHere() {
    if (!editorCtx) return;
    const rows = S.rows.filter(r => r.casting_id === editorCtx.cid && r.date === editorCtx.date && r.department === editorCtx.dept);
    setBusy(true);
    const __h = await histBegin('allow weekend', [editorCtx.cid]);
    try {
        for (const r of rows) await updateScheduleRow(r.id, { weekend_ok: true });
        if (!rows.length) {
            // nothing here yet: remember the allowance by reopening in "allowed" mode via a placeholder-free path
            editorCtx.allowWeekend = true;
        }
        await histEnd(__h);
        await loadRows();
        render();
        const td = document.querySelector(`td.sc-cell[data-cid="${editorCtx.cid}"][data-date="${editorCtx.date}"][data-dept="${editorCtx.dept}"]`);
        if (td) { const ctx = editorCtx; openEditor(td); if (!rows.length) { editorCtx.allowWeekend = true; showWeekendAddForm(); } }
        toast('Weekend day allowed — it is marked purple on the grid.', 'info');
    } catch (err) { toast('Could not allow the weekend: ' + (err.message || err), 'error'); }
    finally { setBusy(false); }
}
/** After allowing an empty weekend cell, swap the alert for the add form. */
function showWeekendAddForm() {
    const ed = $('sc-editor');
    const alert = ed.querySelector('.sc-ed-alert');
    if (alert) alert.outerHTML = `<div class="sc-ed-add"><select id="sc-ed-add-task">${tasksForDept(editorCtx.dept).map(o => `<option>${o}</option>`).join('')}</select><input type="number" id="sc-ed-add-hours" step="0.5" min="0" placeholder="hours"><button type="button" class="btn-secondary" id="sc-ed-add">Add</button></div>`;
}

async function moveEditorEntries() {
    if (!editorCtx) return;
    const to = $('sc-ed-move-date').value;
    if (!to || to === editorCtx.date) return;
    if (isHoliday(to)) { toast(`${shortDay(to)} is a holiday — nothing can be scheduled there.`, 'error'); return; }
    if (isWeekend(to) && !window.confirm(`${shortDay(to)} is a weekend. Allow it for these entries?`)) return;
    const rows = S.rows.filter(r => r.casting_id === editorCtx.cid && r.date === editorCtx.date && r.department === editorCtx.dept);
    if (editorCtx.dept === 'Cast') {
        const other = (await loadScheduleRange(to, to)).find(r => r.department === 'Cast' && r.casting_id !== editorCtx.cid);
        if (other) { toast(`${shortDay(to)} already has ${whoCasts(other.casting_id)}. Castings are one per day.`, 'error'); return; }
    }
    setBusy(true);
    const __h = await histBegin('move day', [editorCtx.cid]);
    try {
        for (const r of rows) await updateScheduleRow(r.id, { date: to, weekend_ok: isWeekend(to) ? true : r.weekend_ok });
        await histEnd(__h);
        await loadRows();
        render();
        closeEditor();
        toast(`Moved to ${shortDay(to)}`);
    } catch (err) { toast('Move failed: ' + (err.message || err), 'error'); }
    finally { setBusy(false); }
}

async function deleteEditorEntry(id) {
    const row = S.rows.find(r => r.id === id);
    if (!row) return;
    if (row.phase_id) {
        const others = S.rows.filter(x => x.phase_id === row.phase_id && x.id !== id).sort((a, b) => b.date.localeCompare(a.date));
        if (!others.length) { toast('This is the phase\'s only day — its hours are locked to the Optimizer Hours tab. Move it instead, or remove the whole casting from the row menu.', 'error'); return; }
        if (!window.confirm(`Remove this day? Its ${fmtH(row.hours)} h move to the phase's last other day so the Optimizer Hours total stays locked.`)) return;
    }
    setBusy(true);
    const __h = await histBegin('remove day', [editorCtx.cid]);
    try {
        if (row.phase_id) { const err = await changePhaseDayHours(row, 0); if (err) { toast(err, 'error'); return; } }
        else await deleteScheduleRow(id);
        await histEnd(__h);
        await loadRows();
        render();
        const td = document.querySelector(`td.sc-cell[data-cid="${editorCtx.cid}"][data-date="${editorCtx.date}"][data-dept="${editorCtx.dept}"]`);
        if (td) openEditor(td); else closeEditor();
    } catch (err) { toast('Remove failed: ' + (err.message || err), 'error'); }
    finally { setBusy(false); }
}

// ---------------------------------------------------------------------------
// casting row menu
// ---------------------------------------------------------------------------
function openCastingMenu(td) {
    const cid = td.dataset.cid;
    const c = S.castingById.get(cid);
    if (!c) return;
    editorCtx = { cid, menu: true };
    const report = lockReport(cid);
    const has = rowsOfCasting(cid).length > 0;
    const ed = $('sc-editor');
    ed.innerHTML = `<h4>${esc(projectLabel(c.project_number))} — ${esc(castingLabel(c))}</h4>
        <div class="sc-sub">${c.casting_date ? 'Cast date ' + esc(shortDay(c.casting_date)) : 'No cast date on the Castings tab'} · Optimizer Hours below (scheduled / tab)</div>
        <div class="sc-menu">
            <div class="sc-phases">${report.length ? report.map(r => `<div><span>${esc(r.phase.phase_name)} <small style="color:#6b7280">${esc(r.code)} · ${esc(r.dept)}${r.unmapped ? ' · <b style="color:#c2410c">unmapped</b>' : ''}</small></span><span class="${Math.abs(r.scheduled - r.optimizer) < 0.01 ? 'ok' : 'bad'}">${fmtH(r.scheduled)} / ${fmtH(r.optimizer)} h</span></div>`).join('') : '<div>No phases with hours on the Optimizer Hours tab.</div>'}</div>
            <button type="button" class="btn-primary" id="sc-m-regen">${has ? 'Regenerate from the Optimizer Hours tab' : 'Schedule from the Optimizer Hours tab'}</button>
            ${has ? `<div class="sc-ed-move">Shift the whole casting by <input type="number" id="sc-m-shift" value="1" step="1" style="width:60px"> working day(s) <button type="button" class="btn-secondary" id="sc-m-shift-btn">Shift</button></div>` : ''}
            ${has ? '<button type="button" class="btn-secondary" id="sc-m-remove">Remove this casting from the schedule</button>' : ''}
            <div class="sc-ed-actions"><button type="button" class="btn-secondary" id="sc-ed-cancel">Close</button></div>
        </div>`;
    ed.hidden = false;
    placeEditor(td);
}

function askAnchor(c) {
    const def = c.casting_date || todayIso();
    const v = window.prompt(`Cast date for ${castingLabel(c)} (the Cast phase lands on it; earlier phases run back from it). YYYY-MM-DD:`, def);
    if (v === null) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) { toast('Enter the date as YYYY-MM-DD.', 'error'); return null; }
    return v.trim();
}

// ---------------------------------------------------------------------------
// cast day choice — one casting per day
// ---------------------------------------------------------------------------
/** date -> casting_id of every Cast day on the grid (any job), excluding one casting. */
async function takenCastDays(excludeCastingId) {
    const rows = await loadScheduleRange(addDays(todayIso(), -60), addDays(todayIso(), 365));
    const map = new Map();
    for (const r of rows) if (r.department === 'Cast' && r.casting_id !== excludeCastingId) map.set(r.date, r.casting_id);
    return map;
}
function whoCasts(castingId) {
    const c = S.castingById.get(castingId);
    return c ? `${projectLabel(c.project_number)} ${castingLabel(c)}` : 'another casting';
}
function castDatesOfPlan(plan) { return plan.filter(r => r.department === 'Cast').map(r => r.date); }
/** First working day on/after `from` where this casting's Cast day(s) collide with nobody. */
function nextAvailableCastDay(c, taken, from) {
    let d = workingOrNext(from);
    for (let i = 0; i < 400; i++) {
        const dates = castDatesOfPlan(planCasting(c, d));
        if (!dates.length || !dates.some(x => taken.has(x))) return d;
        d = nextWorking(d, 1);
    }
    return d;
}
let schedCtx = null;   // { cid, replace, taken, next }
async function openScheduleDialog(castingId, { replace = false } = {}) {
    const c = S.castingById.get(castingId);
    if (!c) return;
    setBusy(true);
    let taken;
    try { taken = await takenCastDays(castingId); } catch (err) { toast('Could not read the grid: ' + (err.message || err), 'error'); setBusy(false); return; }
    finally { setBusy(false); }
    const next = nextAvailableCastDay(c, taken, todayIso());
    schedCtx = { cid: castingId, replace, taken, next };
    const own = c.casting_date || '';
    const ownNote = own
        ? (taken.has(own) ? `${esc(shortDay(own))} on the Castings tab — but ${esc(whoCasts(taken.get(own)))} already casts that day`
                          : `${esc(shortDay(own))} on the Castings tab`)
        : 'none on the Castings tab';
    const box = $('sc-sched');
    box.innerHTML = `<div class="sc-panel sc-panel-sm" role="dialog" aria-modal="true">
        <div class="sc-panel-head"><h2>${replace ? 'Regenerate' : 'Schedule'} ${esc(castingLabel(c))} — ${esc(projectLabel(c.project_number))}</h2><button type="button" class="sc-x" data-close>&times;</button></div>
        <div class="sc-panel-body">
            <p class="sc-hint">Would you like to schedule on the next available cast day, or choose a cast day? Castings are one per day. Cast date on the job: ${ownNote}.</p>
            <label class="sc-choice"><input type="radio" name="sc-cast-mode" value="next" checked> <strong>Next available cast day:</strong> ${esc(shortDay(next))}</label>
            <label class="sc-choice"><input type="radio" name="sc-cast-mode" value="pick"> <strong>Choose a cast day:</strong> <input type="date" id="sc-cast-pick" value="${esc(own && !taken.has(own) ? own : next)}"></label>
            <div id="sc-cast-note" class="sc-hint"></div>
        </div>
        <div class="sc-panel-foot"><button type="button" class="btn-secondary" data-close>Cancel</button><button type="button" class="btn-primary" id="sc-cast-go">${replace ? 'Regenerate' : 'Schedule'}</button></div>
    </div>`;
    box.hidden = false;
    const pick = $('sc-cast-pick');
    const note = $('sc-cast-note');
    const check = () => {
        const mode = box.querySelector('input[name="sc-cast-mode"]:checked')?.value;
        const d = mode === 'next' ? next : pick.value;
        if (!d) { note.textContent = ''; return; }
        if (isHoliday(d)) note.textContent = `${shortDay(d)} is a holiday — nothing is scheduled on holidays.`;
        else if (taken.has(d)) note.textContent = `${shortDay(d)} already has ${whoCasts(taken.get(d))}. Castings are one per day — pick another day.`;
        else if (isWeekend(d)) note.textContent = `${shortDay(d)} is a weekend — the Cast day will be moved to the next working day unless you allow the weekend on the grid afterwards.`;
        else note.textContent = `Cast on ${shortDay(d)}; earlier phases run back from it, later ones forward.`;
    };
    pick.addEventListener('input', () => { box.querySelector('input[name="sc-cast-mode"][value="pick"]').checked = true; check(); });
    box.querySelectorAll('input[name="sc-cast-mode"]').forEach(r => r.addEventListener('change', check));
    check();
}
async function confirmScheduleDialog() {
    if (!schedCtx) return;
    const box = $('sc-sched');
    const mode = box.querySelector('input[name="sc-cast-mode"]:checked')?.value;
    const d = mode === 'next' ? schedCtx.next : $('sc-cast-pick').value;
    if (!d) { toast('Pick a cast day first.', 'error'); return; }
    if (isHoliday(d)) { toast(`${shortDay(d)} is a holiday.`, 'error'); return; }
    const c = S.castingById.get(schedCtx.cid);
    const clash = castDatesOfPlan(planCasting(c, d)).find(x => schedCtx.taken.has(x));
    if (clash) { toast(`${shortDay(clash)} already has ${whoCasts(schedCtx.taken.get(clash))}. Castings are one per day.`, 'error'); return; }
    const ctx = schedCtx;
    box.hidden = true; schedCtx = null;
    await scheduleCasting(ctx.cid, d, { replace: ctx.replace });
}

// ---------------------------------------------------------------------------
// settings
// ---------------------------------------------------------------------------
function openSettings() {
    const box = $('sc-dayhours');
    box.innerHTML = DEPARTMENTS.map(d => `<label>${d.label}<input type="number" min="1" step="1" data-dept="${d.key}" value="${Number((S.settings.dayHours || {})[d.key]) || 8}"></label>`).join('');
    $('sc-holidays').value = (S.settings.holidays || []).join('\n');
    $('sc-settings').hidden = false;
}
async function saveSettings() {
    const dayHours = {};
    for (const inp of $('sc-dayhours').querySelectorAll('input')) dayHours[inp.dataset.dept] = Math.max(1, Number(inp.value) || 8);
    const holidays = $('sc-holidays').value.split(/\r?\n/).map(s => s.trim()).filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s)).sort();
    setBusy(true);
    try {
        await saveScheduleSetting('dayHours', dayHours);
        await saveScheduleSetting('holidays', holidays);
        S.settings.dayHours = dayHours;
        S.settings.holidays = holidays;
        $('sc-settings').hidden = true;
        render();
        toast('Settings saved for everyone.');
    } catch (err) { toast('Could not save settings: ' + (err.message || err), 'error'); }
    finally { setBusy(false); }
}

// ---------------------------------------------------------------------------
// undo / redo — each action snapshots the touched castings' rows before and after
// ---------------------------------------------------------------------------
const HIST = { stack: [], idx: -1 };
async function histBegin(label, castingIds) {
    const ids = [...new Set((castingIds || []).filter(Boolean))];
    if (!ids.length) return null;
    return { label, ids, before: await loadScheduleForCastings(ids) };
}
async function histEnd(h) {
    if (!h) return;
    h.after = await loadScheduleForCastings(h.ids);
    HIST.stack.splice(HIST.idx + 1);
    HIST.stack.push(h);
    if (HIST.stack.length > 50) HIST.stack.shift();
    HIST.idx = HIST.stack.length - 1;
    updateHistButtons();
}
async function restoreRows(ids, rows) {
    for (const id of ids) await deleteCastingSchedule(id, true);
    const clean = rows.map(({ id, created_at, updated_at, ...rest }) => rest);
    if (clean.length) await insertScheduleRows(clean);
    for (const id of ids) if (rows.some(r => r.casting_id === id)) S.pinned.add(id);
}
async function undo() {
    if (HIST.idx < 0 || S.busy) return;
    const h = HIST.stack[HIST.idx];
    setBusy(true);
    try { await restoreRows(h.ids, h.before); HIST.idx--; updateHistButtons(); closeEditor(); await loadRows(); render(); toast(`Undone: ${h.label}`, 'info'); }
    catch (err) { toast('Undo failed: ' + (err.message || err), 'error'); }
    finally { setBusy(false); }
}
async function redo() {
    if (HIST.idx >= HIST.stack.length - 1 || S.busy) return;
    const h = HIST.stack[HIST.idx + 1];
    setBusy(true);
    try { await restoreRows(h.ids, h.after); HIST.idx++; updateHistButtons(); closeEditor(); await loadRows(); render(); toast(`Redone: ${h.label}`, 'info'); }
    catch (err) { toast('Redo failed: ' + (err.message || err), 'error'); }
    finally { setBusy(false); }
}
function updateHistButtons() {
    const u = $('sc-undo'), r = $('sc-redo');
    if (!u || !r) return;
    u.disabled = HIST.idx < 0;
    r.disabled = HIST.idx >= HIST.stack.length - 1;
    u.title = HIST.idx >= 0 ? `Undo: ${HIST.stack[HIST.idx].label} (Ctrl+Z)` : 'Nothing to undo';
    r.title = HIST.idx < HIST.stack.length - 1 ? `Redo: ${HIST.stack[HIST.idx + 1].label} (Ctrl+Y)` : 'Nothing to redo';
}

// ---------------------------------------------------------------------------
// misc UI
// ---------------------------------------------------------------------------
let toastTimer = null;
function toast(msg, kind = 'success') {
    const el = $('sc-toast');
    el.textContent = msg;
    el.className = `sc-toast sc-toast-${kind}`;
    el.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, kind === 'error' ? 6000 : 3500);
}
function setBusy(b) { S.busy = b; document.body.style.cursor = b ? 'progress' : ''; }

function wire() {
    $('sc-prev').addEventListener('click', () => { S.from = addMonths(S.from, -1); reloadRows(); });
    $('sc-next').addEventListener('click', () => { S.from = addMonths(S.from, 1); reloadRows(); });
    $('sc-today').addEventListener('click', () => { S.from = firstOfMonth(todayIso()); reloadRows(); });
    $('sc-grid-wrap').addEventListener('change', (e) => { const inp = e.target.closest('input[data-cost]'); if (inp) saveCostInput(inp); });
    $('sc-grid-wrap').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('input[data-cost]')) e.target.blur(); });
    $('sc-view-toggle').addEventListener('click', () => { S.view = S.view === 'revenue' ? 'grid' : 'revenue'; closeEditor(); render(); });
    $('sc-show-weekends').addEventListener('change', (e) => { S.settings.showWeekends = !!e.target.checked; try { localStorage.setItem('sc-weekends', S.settings.showWeekends ? '1' : '0'); } catch (_) { /* ignore */ } render(); });
    $('sc-search').addEventListener('input', (e) => { S.search = e.target.value; render(); });
    $('sc-settings-btn').addEventListener('click', openSettings);
    $('sc-sched').addEventListener('click', (e) => {
        if (e.target.closest('[data-close]') || e.target === $('sc-sched')) { $('sc-sched').hidden = true; schedCtx = null; return; }
        if (e.target.id === 'sc-cast-go' && !S.busy) confirmScheduleDialog();
    });
    $('sc-undo').addEventListener('click', undo);
    $('sc-redo').addEventListener('click', redo);
    document.addEventListener('keydown', (e) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
        if (typing) return;
        if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        else if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    });
    $('sc-settings-save').addEventListener('click', saveSettings);
    $('sc-settings').addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === $('sc-settings')) $('sc-settings').hidden = true; });
    $('sc-print').addEventListener('click', () => window.print());

    $('sc-unscheduled').addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-schedule]');
        if (!btn || S.busy) return;
        const c = S.castingById.get(btn.dataset.schedule);
        if (!c) return;
        await openScheduleDialog(c.id, { replace: false });
    });

    $('sc-grid-wrap').addEventListener('click', (e) => {
        if (S.busy) return;
        const cell = e.target.closest('td.sc-cell');
        if (cell) { openEditor(cell); return; }
        const label = e.target.closest('td.sc-label[data-cid]');
        if (label) { openCastingMenu(label); }
    });

    $('sc-editor').addEventListener('click', async (e) => {
        if (S.busy) return;
        const t = e.target;
        if (t.id === 'sc-ed-cancel') { closeEditor(); return; }
        if (t.id === 'sc-ed-save') { await saveEditor(); return; }
        if (t.id === 'sc-ed-add') { await addEditorEntry(); return; }
        if (t.id === 'sc-ed-allow') { await allowWeekendHere(); return; }
        if (t.id === 'sc-ed-move') { await moveEditorEntries(); return; }
        const del = t.closest('[data-del]');
        if (del) { await deleteEditorEntry(del.closest('.sc-ed-row').dataset.id); return; }
        if (t.id === 'sc-m-regen') {
            const c = S.castingById.get(editorCtx.cid);
            const has = rowsOfCasting(c.id).length > 0;
            if (has && !window.confirm('Replace this casting\'s generated days with a fresh spread from the Optimizer Hours tab? Days you typed by hand stay.')) return;
            closeEditor();
            await openScheduleDialog(c.id, { replace: has });
            return;
        }
        if (t.id === 'sc-m-shift-btn') { const n = Math.trunc(Number($('sc-m-shift').value) || 0); const cid = editorCtx.cid; closeEditor(); await shiftCasting(cid, n); return; }
        if (t.id === 'sc-m-remove') {
            const c = S.castingById.get(editorCtx.cid);
            if (!window.confirm(`Remove every scheduled day of ${castingLabel(c)} (${projectLabel(c.project_number)})?`)) return;
            setBusy(true);
            try { const __h = await histBegin('remove ' + castingLabel(c), [c.id]); await deleteCastingSchedule(c.id, true); await histEnd(__h); S.pinned.delete(c.id); await loadRows(); render(); closeEditor(); toast('Removed from the schedule.'); }
            catch (err) { toast('Remove failed: ' + (err.message || err), 'error'); }
            finally { setBusy(false); }
        }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeEditor(); $('sc-settings').hidden = true; $('sc-sched').hidden = true; schedCtx = null; } });
    document.addEventListener('mousedown', (e) => {
        const ed = $('sc-editor');
        if (ed.hidden) return;
        if (ed.contains(e.target) || e.target.closest('td.sc-cell') || e.target.closest('td.sc-label')) return;
        closeEditor();
    });

    // another scheduler / portal saved: reload quietly
    registerRefreshHandler(async (last, payloads) => {
        const batch = (Array.isArray(payloads) && payloads.length ? payloads : [last]).filter(p => isPortalChange(p) && !isOwnSignal(p));
        const tables = new Set(batch.map(p => signalInfo(p).table));
        if (!tables.size) return;
        if (tables.has('casting_phases') || tables.has('project_castings') || tables.has('projects') || tables.has('casting_inventory')) {
            try { await loadBase(); } catch (err) { logger.warn('[scheduler] reload base failed', err); }
        }
        if (tables.has('plant_schedule') || tables.has('plant_schedule_settings') || tables.has('casting_phases') || tables.has('project_castings')) {
            if (!editorCtx) { try { await loadRows(); render(); toast('Updated by someone else — reloaded', 'info'); } catch (err) { logger.warn('[scheduler] reload rows failed', err); } }
        }
    });
}

async function reloadRows() {
    setBusy(true);
    try { await loadRows(); render(); }
    catch (err) { toast('Load failed: ' + (err.message || err), 'error'); }
    finally { setBusy(false); }
}

async function init() {
    wire();
    S.from = firstOfMonth(todayIso());
    try { S.settings.showWeekends = localStorage.getItem('sc-weekends') === '1'; $('sc-show-weekends').checked = S.settings.showWeekends; } catch (_) { /* ignore */ }
    try {
        await initializeSupabase();
        const saved = await loadScheduleSettings();
        if (saved.dayHours) S.settings.dayHours = { ...SETTINGS_DEFAULTS.dayHours, ...saved.dayHours };
        if (Array.isArray(saved.holidays)) S.settings.holidays = saved.holidays;
        if (saved.costs && typeof saved.costs === 'object') S.settings.costs = saved.costs;
        await loadBase();
        await loadRows();
        render();
    } catch (err) {
        logger.error('[scheduler] init failed', err);
        $('sc-grid-wrap').innerHTML = `<div class="sc-loading">Could not load: ${esc(err.message || err)}</div>`;
    }
}

// debugging hooks (read-only use from the console)
window.__scheduler = { S, planCasting, lockReport, mappedPhases, nextWorking, undo, redo, HIST };

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
