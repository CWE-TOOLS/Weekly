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
    loadScheduleRange, loadScheduleForCastings, insertScheduleRows, updateScheduleRow, deleteScheduleRow, readyFromSettings,
    deleteCastingSchedule, loadScheduleSettings, saveScheduleSetting, isScheduleMigrationPending
} from '../../services/schedule-service.js?v=20261021-1';
import {
    DEPARTMENTS, DEPT_KEYS, TASKS, tasksForDept, taskForPhase, SETTINGS_DEFAULTS, REVENUE_PER_HOUR, SCHEDULABLE_STATUSES, TEAM_DAY_LIMITS, teamOfDepartment
} from '../../config/scheduler-config.js?v=20261022-2';
import { logger } from '../../utils/logger.js';
import { fetchForProject as fetchStagingNotes, fetchForProjects as fetchStagingForProjects, upsertOne as saveStagingNote } from '../../services/task-descriptions-service.js?v=20261022-2';

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
    invSummary: new Map(),        // castingId -> { types, pcs, sqft, sqftMissing } from the Casting Inventory
    rows: [],                     // plant_schedule rows in the window (+ pinned castings)
    from: '',                     // first day of the month on screen (ISO)
    view: 'grid',                 // 'grid' (castings × days) | 'revenue' (teams × days, $ per week — the sheet's Rev tab)
    search: '',
    unsSearch: '',                // the "Not yet scheduled" panel's own search box
    scheduledIds: new Set(),      // every casting with days anywhere on the scheduler (any month)
    ready: new Map(),             // castingId -> flag: "Ready for scheduling" clicked on the portal's Optimizer Hours tab
    staging: new Map(),           // project_number -> Map("cast|weeklyDept|day" -> { description }) from the portal's Staging tab
    pinned: new Set(),            // castings shown even without rows in the window
    busy: false,
    cascade: false                // moving a task also moves every later task of that casting by the same working days
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
/** A month on screen = every week whose MONDAY falls in that month (user rule 2026-10-20: "October is a 4-week month
 *  with week 1 starting on the 5th"). Weeks never belong to two months, so nothing is counted twice. */
function windowStart() { let d = S.from; while (dow(d) !== 1) d = addDays(d, 1); return d; }
function windowEnd() { let d = lastOfMonth(S.from); while (dow(d) !== 1) d = addDays(d, -1); return addDays(d, 6); }
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
    // the Staging tab's days, task names and hours for every project (the scheduler's primary source since 2026-10-22)
    try { S.staging = await fetchStagingForProjects(nums); } catch (err) { logger.warn('[scheduler] staging load failed', err); }
    // Only castings with a Casting Inventory are offered for scheduling (user rule 2026-10-19).
    S.withInventory = new Set();
    S.invSummary = new Map();
    for (let i = 0; i < ids.length; i += 60) {
        const { data, error } = await client.from('casting_inventory').select('casting_id, quantity, extras, ff_sq_ft').in('casting_id', ids.slice(i, i + 60));
        if (error) throw error;
        for (const r of data || []) {
            S.withInventory.add(r.casting_id);
            // same totals as the portal's casting title block: types = rows, pcs = qty + extras, sq ft = FF sq ft × pcs
            const s = S.invSummary.get(r.casting_id) || { types: 0, pcs: 0, sqft: 0, sqftMissing: 0 };
            const units = (parseInt(r.quantity, 10) || 0) + (parseInt(r.extras, 10) || 0);
            s.types += 1;
            s.pcs += units;
            if (r.ff_sq_ft === null || r.ff_sq_ft === undefined || r.ff_sq_ft === '') s.sqftMissing += 1;
            s.sqft += (Number(r.ff_sq_ft) || 0) * units;
            S.invSummary.set(r.casting_id, s);
        }
    }
}

async function loadRows() {
    const inWindow = await loadScheduleRange(windowStart(), windowEnd());
    const seen = new Set(inWindow.map(r => r.id));
    const extraIds = [...S.pinned];
    const extra = extraIds.length ? await loadScheduleForCastings(extraIds) : [];
    S.rows = inWindow.concat(extra.filter(r => !seen.has(r.id)));
    // which castings are on the scheduler at all, whatever month (so they never show as "not yet scheduled")
    try {
        const { data } = await getSupabaseClient().from('plant_schedule').select('casting_id');
        S.scheduledIds = new Set((data || []).map(r => r.casting_id));
    } catch (_) { S.scheduledIds = new Set(S.rows.map(r => r.casting_id)); }
    // rows saved before the Mill column was split into CNC + Parts (2026-10-19)
    for (const r of S.rows) if (r.department === 'Mill') r.department = r.task === 'CNC' ? 'CNC' : 'Parts';
}

// per-casting helpers
function phasesOf(castingId) { return (S.phasesByCasting.get(castingId) || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)); }
/** The "unit" a scheduled row belongs to: a casting_phases id (previous task list) or 'unit:<cast>|<dept>|<day>' (a staged day). */
function unitOf(r) { return r.phase_id || (String(r.note || '').startsWith('unit:') ? String(r.note).split(' ')[0] : null); }
/** A casting's staged days with hours (Staging tab task + Optimizer Hours per day), one unit each, in team order. */
function stagedUnits(castingId) {
    const c = S.castingById.get(castingId);
    const notes = c && S.staging.get(c.project_number);
    if (!notes) return [];
    const cells = [];
    for (const [key, e] of notes) {
        const [cast, sd, day] = key.split('|');
        if (cast !== String(c.casting_number)) continue;
        const team = teamOfDepartment(sd);
        const hours = Number(e.hours) || 0;
        if (!team || hours <= 0) continue;
        cells.push({ key, team, sd, day: parseInt(day, 10) || 1, hours, taskName: String(e.taskName || '').trim() });
    }
    if (!cells.length) return [];
    cells.sort((a, b) => (DEPT_KEYS.indexOf(a.team) - DEPT_KEYS.indexOf(b.team)) || (a.day - b.day));
    return cells.map(x => {
        const code = x.taskName ? x.taskName.toUpperCase() : (tasksForDept(x.team)[0] || x.team.toUpperCase());
        const known = !!x.taskName && (TASKS[code] || []).includes(x.team);
        return { phase: { id: null, phase_name: `${x.sd} day ${x.day}${x.taskName ? ' · ' + x.taskName.toLowerCase() : ''}`, hours: x.hours }, code, dept: x.team, unmapped: !known, unit: 'unit:' + x.key, staged: true, day: x.day };
    });
}
/** Every unit of work for a casting: the staged days when any carry hours, else the previous task list. */
function mappedPhases(castingId) {
    const staged = stagedUnits(castingId);
    if (staged.length) return staged;
    const list = phasesOf(castingId).filter(p => Number(p.hours) > 0);
    const sealIdx = list.findIndex(p => taskForPhase(p.phase_name).code === 'SEAL');
    return list.map((p, i) => ({ phase: p, ...taskForPhase(p.phase_name, { afterSeal: sealIdx >= 0 && i > sealIdx }), unit: p.id, staged: false }));
}
function rowsOfCasting(castingId) { return S.rows.filter(r => r.casting_id === castingId); }
function castingLabel(c) { return `Cast ${c.casting_number}`; }
/** "3 types · 14 pcs · 49 sq ft" from the casting's Casting Inventory. */
function invSummaryText(castingId) {
    const s = S.invSummary.get(castingId);
    if (!s) return 'no Casting Inventory';
    const sq = Math.round(s.sqft * 10) / 10;
    return `${s.types} ${s.types === 1 ? 'type' : 'types'} · ${s.pcs} pcs · ${sq.toLocaleString('en-US')} sq ft${s.sqftMissing ? ' (incomplete)' : ''}`;
}
function projectLabel(num) { const p = S.projectByNumber.get(num); return p ? `${num} · ${p.project_name || ''}` : num; }

/** Scheduled vs Optimizer hours per phase of a casting (any date). */
function lockReport(castingId) {
    const out = [];
    const rows = rowsOfCasting(castingId);
    for (const m of mappedPhases(castingId)) {
        const sched = rows.filter(r => unitOf(r) === m.unit).reduce((n, r) => n + (Number(r.hours) || 0), 0);
        out.push({ phase: m.phase, code: m.code, dept: m.dept, unmapped: m.unmapped, optimizer: Number(m.phase.hours) || 0, scheduled: Math.round(sched * 100) / 100 });
    }
    return out;
}
function lockOk(report) { return report.every(r => Math.abs(r.scheduled - r.optimizer) < 0.01); }

// ---------------------------------------------------------------------------
// spreading (the default schedule from the Optimizer Hours tab)
// ---------------------------------------------------------------------------
const teamOfStagingDept = teamOfDepartment;
/** How many days each team gets for a casting = the day rows on the portal's Staging tab (task_descriptions,
 *  max day_number per department, departments mapped onto the teams). Map team -> days; a team not listed gets 1. */
async function stagingDaysFor(casting) {
    const notes = await stagingFor(casting.project_number);
    const days = new Map();
    for (const key of notes.keys()) {
        const [cast, sd, day] = key.split('|');
        if (cast !== String(casting.casting_number)) continue;
        const team = teamOfStagingDept(sd);
        const n = parseInt(day, 10) || 0;
        if (team && n > (days.get(team) || 0)) days.set(team, n);
    }
    return days;
}
function stagedDaysOf(stage, dept) { return Math.max(1, (stage && stage.get(dept)) || 1); }

/** Split hours over n days in WHOLE hours, the first day(s) carrying the extra (user rule 2026-10-22):
 *  5 h over 3 days = 2, 2, 1 · 26 h over 4 = 7, 7, 6, 6 · 1 h over 2 = 1, 0. A fractional total keeps its fraction on day 1. */
function evenSplit(hours, n) {
    if (n <= 1) return [hours];
    const whole = Math.floor(hours), extra = Math.round((hours - whole) * 100) / 100;
    const base = Math.floor(whole / n), rem = whole - base * n;
    const out = Array.from({ length: n }, (_, k) => base + (k < rem ? 1 : 0));
    out[0] = Math.round((out[0] + extra) * 100) / 100;
    return out;
}

/**
 * Build the rows for one casting. anchorIso = cast date (the Cast team's block starts there).
 * Phases are grouped into blocks of consecutive phases of the same team; a block takes as many days as the
 * portal's Staging tab lists for that team, and each phase's Optimizer Hours are split evenly over those days
 * (user rule 2026-10-22). Blocks before Cast run back from the cast date, blocks after it run forward.
 */
function planCasting(casting, anchorIso, stage) {
    const mapped = mappedPhases(casting.id);
    if (!mapped.length) return [];
    const blocks = [];
    for (const m of mapped) {
        const last = blocks[blocks.length - 1];
        if (last && last.dept === m.dept) last.phases.push(m); else blocks.push({ dept: m.dept, phases: [m] });
    }
    for (const bl of blocks) { bl.staged = bl.phases.every(m => m.staged); bl.days = bl.staged ? bl.phases.length : stagedDaysOf(stage, bl.dept); }
    const anchor = workingOrNext(anchorIso);
    const out = [];
    const push = (m, date, hours) => out.push({
        project_number: casting.project_number, casting_id: casting.id, phase_id: m.phase.id || null,
        date, department: m.dept, task: m.code, hours, weekend_ok: false,
        note: m.phase.id ? (m.unmapped ? `Unmapped phase "${m.phase.phase_name}" — pick the task` : null)
                         : (m.unmapped ? `${m.unit} Unmapped — pick the task on the Staging tab` : m.unit)
    });
    // Build Crate always lands on a Monday (user rule 2026-10-22) — the next Monday that is not a holiday going
    // forward (the previous one going back); only a manual move puts it elsewhere afterwards
    const toMonday = (d, dir) => {
        let x = d;
        for (let i = 0; i < 40; i++) { if (dow(x) === 1 && !isHoliday(x)) return x; x = addDays(x, dir); }
        return d;
    };
    // lay one block on consecutive working days starting at `start`, going `dir`; returns the far end date
    const lay = (bl, start, dir) => {
        if (bl.phases.some(m => m.code === 'BUILD')) start = toMonday(start, dir);
        const dates = [start];
        for (let k = 1; k < bl.days; k++) dates.push(nextWorking(dates[k - 1], dir));
        if (dir < 0) dates.reverse();                    // day 1 is the earliest date either way
        if (bl.staged) {
            bl.phases.forEach((m, k) => push(m, dates[k], Number(m.phase.hours) || 0));   // one staged day = one scheduled day, hours as entered
        } else {
            for (const m of bl.phases) {
                const split = evenSplit(Number(m.phase.hours) || 0, bl.days);
                dates.forEach((d, k) => { if (split[k] > 0) push(m, d, split[k]); });
            }
        }
        return dir > 0 ? dates[dates.length - 1] : dates[0];
    };
    const castIdx = blocks.findIndex(bl => bl.phases.some(m => m.code === 'CAST'));
    if (castIdx >= 0) {
        let cur = anchor;
        for (let i = castIdx; i < blocks.length; i++) cur = nextWorking(lay(blocks[i], cur, 1), 1);
        cur = nextWorking(anchor, -1);
        for (let i = castIdx - 1; i >= 0; i--) cur = nextWorking(lay(blocks[i], cur, -1), -1);
    } else {
        let cur = anchor;
        for (const bl of blocks) cur = nextWorking(lay(bl, cur, 1), 1);
    }
    return out;
}

async function scheduleCasting(castingId, anchorIso, { replace = false, stage = null } = {}) {
    const c = S.castingById.get(castingId);
    if (!c) return;
    if (!stage) { try { stage = await stagingDaysFor(c); } catch (_) { stage = new Map(); } }
    const plan = planCasting(c, anchorIso, stage);
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
    // team limits: where would the casting land? over-scheduling is allowed after a confirm
    const moved = rows.map(r => { let d = r.date; for (let i = 0; i < Math.abs(n); i++) d = nextWorking(d, Math.sign(n)); return { ...r, date: d }; });
    const span = moved.map(r => r.date).sort();
    const load = await loadTeamLoad(span[0], span[span.length - 1], castingId);
    if (!confirmOverload(overloadsOf(moved, load))) return;
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
    // only castings with days scheduled in this month (user 2026-10-22); what is waiting lives in "Not yet scheduled"
    const withRows = new Set(S.rows.filter(r => days.has(r.date)).map(r => r.casting_id));
    return S.castings.filter(c => {
        if (!withRows.has(c.id)) return false;
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
    // Month Total — like the bottom-right block of the sheet's Rev tab: labels left of the WEEK TOTAL column,
    // values under it, the % of the monthly target beside Total Rev. Counts only the month's own days.
    const mdays = weeks.flat();   // the month's own weeks, Monday to Saturday
    const mRev = sum(mdays, fab), mShip = sum(mdays, d => rev(d, 'Ship')), mTotal = mRev + mShip;
    const mLabor = sum(mdays, d => costOf(d, 'labor')), mMat = sum(mdays, d => costOf(d, 'material')), mSub = sum(mdays, d => costOf(d, 'sub'));
    const mCogs = mLabor + mMat + mSub;
    const target = Number(S.settings.target) || 400000;
    const blanks = '<td></td>'.repeat(5);
    const mrow = (label, value, cls = '', extra = '<td></td>') => `<tr class="${cls}"><td></td>${blanks}<td class="sc-rv-mlabel">${label}</td><td class="sc-rv-mval">${value}</td>${extra}</tr>`;
    html += `<table class="sc-rv-table sc-rv-month"><colgroup><col class="sc-rv-c-label">${'<col class="sc-rv-c-day">'.repeat(7)}<col class="sc-rv-c-extra"></colgroup><tbody>`;
    html += `<tr><td></td>${blanks}<td></td><td class="sc-rv-mhead" title="All ${weeks.length} weeks of ${esc(monthLabel(S.from))}">Month Total</td><td></td></tr>`;
    html += mrow('Rev', money2(mRev));
    html += mrow('', '', '', `<td class="sc-rv-target">TARGET = $<input class="sc-rv-in sc-rv-target-in" data-target value="${esc(target.toLocaleString('en-US'))}" title="Monthly revenue target — click to change (saved for everyone)"></td>`);
    html += mrow('Shipping', money2(mShip));
    html += mrow('Total Rev', money2(mTotal), 'sc-rv-mtotal', `<td class="sc-rv-mpct" title="Total Rev ÷ target">${Math.round(mTotal / target * 100)}%</td>`);
    html += mrow('Labor', money2(mLabor));
    html += mrow('Material', money2(mMat));
    html += mrow('Sub', money2(mSub));
    html += mrow('Total COGS', money2(mCogs), 'sc-rv-mcogs');
    html += `<tr><td></td>${blanks}<td></td>${pctCell(mCogs, mTotal)}<td></td></tr>`;
    html += `</tbody></table><p class="sc-hint">Revenue = scheduled hours × $${REVENUE_PER_HOUR}. Fabrication Revenue is every team except Ship; Net Revenue adds Ship. Type Labor, Material and Subcontractor costs straight into their cells, and the monthly target beside the Month Total (all saved for everyone). A month is every week whose Monday falls in it, so ${esc(monthLabel(S.from))} has ${weeks.length} weeks; the Month Total adds them up.</p></div>`;
    wrap.innerHTML = html;
}

async function saveTargetInput(inp) {
    const v = Math.round(Number(String(inp.value).replace(/[$,\s]/g, '')) || 0);
    if (v <= 0) { toast('Enter the monthly target in dollars.', 'error'); renderRevenue(); return; }
    try { await saveScheduleSetting('target', v); S.settings.target = v; renderRevenue(); toast(`Monthly target set to $${v.toLocaleString('en-US')} for everyone.`); }
    catch (err) { toast('Could not save the target: ' + (err.message || err), 'error'); }
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

/** date -> [{ dept, count, limit, names }] for every team over its castings-per-day limit (whole plant, not just the rows on screen). */
function overLimitDays() {
    const sets = new Map();   // date|dept -> Set(casting_id)
    for (const r of S.rows) {
        if (!TEAM_DAY_LIMITS[r.department] || !(Number(r.hours) > 0 || r.task)) continue;
        const k = `${r.date}|${r.department}`;
        if (!sets.has(k)) sets.set(k, new Set());
        sets.get(k).add(r.casting_id);
    }
    const out = new Map();
    for (const [k, ids] of sets) {
        const [date, dept] = k.split('|');
        const limit = TEAM_DAY_LIMITS[dept];
        if (ids.size <= limit) continue;
        if (!out.has(date)) out.set(date, []);
        out.get(date).push({ dept, count: ids.size, limit, names: [...ids].map(id => { const c = S.castingById.get(id); return c ? `${c.project_number} ${castingLabel(c)}` : 'unknown casting'; }) });
    }
    return out;
}
const deptLabel = (k) => DEPARTMENTS.find(d => d.key === k)?.label || k;
/** Alert wording, e.g. "casting - 3 jobs" (user 2026-10-20). */
const ALERT_NAMES = { CNC: 'CNC', Parts: 'parts', FO: 'form out', Cast: 'casting', DM: 'demold', F: 'finish', Seal: 'seal', Crate: 'crate', Spec: 'special', Ship: 'ship' };
const alertText = (x) => `${ALERT_NAMES[x.dept] || x.dept} - ${x.count} jobs`;

function renderBanner() {
    const b = $('sc-banner');
    if (isScheduleMigrationPending()) {
        b.className = 'sc-banner sc-banner-error';
        b.innerHTML = 'The scheduler tables are not in the database yet. Run <code>migration/plant-schedule.sql</code> in the Supabase SQL editor, then reload this page.';
        b.hidden = false;
        return;
    }
    const msgs = [];
    const days = new Set(windowDays());
    const over = [...overLimitDays()].filter(([d]) => days.has(d)).sort(([a], [b2]) => a.localeCompare(b2));
    if (over.length) msgs.push(`Over the team limit on ${over.length} day${over.length === 1 ? '' : 's'}: ` + over.slice(0, 6).map(([d, list]) => `${shortDay(d)} (${list.map(alertText).join(', ')})`).join('; ') + (over.length > 6 ? '; …' : '') + '. Parts, FO, Cast and DM take 1 casting a day; F, Seal and Spec take 5.');
    const bad = visibleCastings().filter(c => !lockOk(lockReport(c.id)) && rowsOfCasting(c.id).length);
    if (bad.length) msgs.push(`${bad.length} casting${bad.length === 1 ? '' : 's'} on screen no longer match the Optimizer Hours tab (red dot on the row) — open the row menu and regenerate.`);
    if (msgs.length) {
        b.className = 'sc-banner ' + (over.length ? 'sc-banner-error' : 'sc-banner-warn');
        b.innerHTML = msgs.map(m => `<div>${esc(m)}</div>`).join('');
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
    const overByDay = overLimitDays();   // team limits per day (Parts/FO/Cast/DM 1, F/Seal/Spec 5)
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
    let h = '<table class="sc-grid"><thead><tr><th class="sc-label" rowspan="4">Job · Casting</th>';
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
    h += '</tr><tr class="sc-alert-row">';
    // alert row: a team over its castings-per-day limit shows here, above its day, in large type
    for (const d of days) {
        const ov = overByDay.get(d) || [];
        const tip = ov.length ? 'OVER THE TEAM LIMIT\n' + ov.map(x => `${deptLabel(x.dept)}: ${x.count} castings (limit ${x.limit}) — ${x.names.join(', ')}`).join('\n') : '';
        h += `<th class="sc-alert ${ov.length ? 'sc-alert-on' : ''} ${isWeekend(d) ? 'sc-weekend' : ''}" colspan="${DEPT_KEYS.length}"${tip ? ` title="${esc(tip)}"` : ''}>${ov.length ? '&#9888; ' + esc(ov.map(alertText).join(' · ')) : ''}</th>`;
    }
    h += '</tr><tr>';
    for (const d of days) {
        const ov = overByDay.get(d) || [];
        const cls = ['sc-day', isWeekend(d) ? 'sc-weekend' : '', isHoliday(d) ? 'sc-holiday' : '', d === today ? 'sc-today' : '', ov.length ? 'sc-day-over' : ''].join(' ');
        const tip = isHoliday(d) ? 'Holiday — never scheduled' : isWeekend(d) ? 'Weekend — needs an allow' : '';
        h += `<th class="${cls}" colspan="${DEPT_KEYS.length}" title="${esc(tip)}">${esc(shortDay(d))}</th>`;
    }
    h += '</tr><tr>';
    for (const d of days) DEPARTMENTS.forEach((dep, i) => {
        const x = (overByDay.get(d) || []).find(o => o.dept === dep.key);
        h += `<th class="sc-dept ${i === 0 ? 'sc-dept-first' : ''} ${isWeekend(d) ? 'sc-weekend' : ''} ${isHoliday(d) ? 'sc-holiday' : ''} ${x ? 'sc-dept-over' : ''}" data-dept="${dep.key}"${x ? ` title="${esc(`${x.count} castings, limit ${x.limit}: ${x.names.join(', ')}`)}"` : ''}>${dep.label}</th>`;
    });
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
                const drag = rows.length ? ' draggable="true" title="Drag to another day on this row to move it; click to edit"' : '';
                taskTds += `<td class="${cls} sc-trow" ${attrs}${drag}><span class="sc-task">${esc(task)}</span></td>`;
                hourTds += `<td class="${cls} sc-hrow" ${attrs}${drag}><span class="sc-h">${hrs}</span></td>`;
            });
        }
        h += `<tr class="sc-cast-top"><td class="sc-label" rowspan="2" data-cid="${c.id}" title="${esc(tip)}\n\nClick for options"><span class="sc-castnum">${esc(castingLabel(c))}</span><span class="sc-castdate">${c.casting_date ? 'cast ' + esc(shortDay(c.casting_date)) : 'no cast date'}</span>${bad ? '<span class="sc-lock" title="Scheduled hours differ from the Optimizer Hours tab"></span>' : ''}<span class="sc-castinv" title="From the Casting Inventory: types, pieces (qty + extras), finished-face sq ft">${esc(invSummaryText(c.id))}</span></td>${taskTds}</tr>`;
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
    const scheduled = new Set([...S.scheduledIds, ...S.rows.map(r => r.casting_id)]);
    const q = S.search.trim().toLowerCase();
    const uq = S.unsSearch.trim().toLowerCase();
    const matches = (c, s) => {
        const p = S.projectByNumber.get(c.project_number);
        return c.project_number.toLowerCase().includes(s) || (p && (p.project_name || '').toLowerCase().includes(s)) || `cast ${c.casting_number}`.toLowerCase().includes(s);
    };
    // offered only when the PM clicked "Ready for scheduling" on the Optimizer Hours tab AND the casting has a Casting Inventory
    const all = S.castings.filter(c => !scheduled.has(c.id) && S.ready.has(c.id) && S.withInventory.has(c.id));
    const list = all.filter(c => (!q || matches(c, q)) && (!uq || matches(c, uq)));
    const cnt = $('sc-uns-count');
    if (cnt) cnt.textContent = uq || q ? `${list.length} of ${all.length} castings match` : `${all.length} castings waiting`;
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
        if (!unitOf(r)) return '<div class="sc-ed-phase">typed by hand — not tied to the Optimizer Hours</div>';
        const ph = (mappedPhases(cid).find(m => m.unit === unitOf(r)) || {}).phase;
        const all = S.rows.filter(x => unitOf(x) === unitOf(r));
        const tot = all.reduce((n, x) => n + (Number(x.hours) || 0), 0);
        return `<div class="sc-ed-phase">Optimizer Hours: ${esc(ph?.phase_name || '?')} ${fmtH(ph?.hours)} h over ${all.length} day${all.length === 1 ? '' : 's'} (scheduled ${fmtH(tot)} h). Hours come from the portal and can't be changed here — use Roll over to split them with the next day.</div>`;
    };
    // roll-over: split this day's hours with the next working day (the pair always totals what it had)
    const rollPanel = (r) => {
        if (!unitOf(r)) return '';
        const next = nextWorking(r.date, 1);
        const nextRow = S.rows.find(x => unitOf(x) === unitOf(r) && x.date === next && x.department === r.department);
        const total = Math.round(((Number(r.hours) || 0) + (nextRow ? Number(nextRow.hours) || 0 : 0)) * 100) / 100;
        const todayH = nextRow ? Number(r.hours) || 0 : Math.round(total / 2 * 2) / 2;
        return `<div class="sc-roll" data-roll="${r.id}" data-total="${total}" data-next="${next}" hidden>
            <div class="sc-roll-row"><span>${esc(shortDay(r.date))}</span><input type="number" step="0.5" min="0" max="${total}" data-roll-today value="${fmtH(todayH)}"> h</div>
            <div class="sc-roll-row"><span>${esc(shortDay(next))}${nextRow ? '' : ' (new day)'}</span><input type="number" step="0.5" min="0" max="${total}" data-roll-next value="${fmtH(Math.round((total - todayH) * 100) / 100)}"> h</div>
            <div class="sc-roll-total">Together they must stay <strong>${fmtH(total)} h</strong>. Change either day — the other follows.</div>
            <button type="button" class="btn-primary" data-roll-save>Save roll-over</button>
        </div>`;
    };
    let html = `<h4>${rows.length ? 'Task mover' : 'Add a day'}</h4><div class="sc-sub">${esc(projectLabel(c.project_number))} — ${esc(castingLabel(c))} · ${esc(shortDay(date))} · ${esc(DEPARTMENTS.find(d => d.key === dept)?.label || dept)}</div>`;
    if (holiday) html += '<div class="sc-ed-alert">Holiday — nothing can be scheduled on this day. Change the holiday list in Settings if that is wrong.</div>';
    else if (weekend && !weekendAllowed) html += `<div class="sc-ed-alert">Weekend. Work is only scheduled here if someone allows it.<br><button type="button" class="btn-secondary" id="sc-ed-allow">Allow this weekend day for this casting</button></div>`;
    for (const r of rows) {
        const lockedH = unitOf(r) ? ' readonly class="sc-ed-locked" title="Locked to the Optimizer Hours tab in the portal"' : '';
        const rollBtn = unitOf(r) && !holiday ? `<button type="button" class="btn-secondary sc-roll-open" data-roll-open="${r.id}" title="The task did not finish today: carry part of its hours to the next working day">Roll over to next day &#9656;</button>` : '';
        html += `<div class="sc-ed-row" data-id="${r.id}"><select data-task>${opts.map(o => `<option${o === r.task ? ' selected' : ''}>${o}</option>`).join('')}${opts.includes(r.task) ? '' : `<option selected>${esc(r.task)}</option>`}</select><input type="number" step="0.5" min="0" data-hours value="${fmtH(r.hours)}"${lockedH}><button type="button" class="sc-del" data-del title="Remove">&times;</button>${phaseLine(r)}${rollBtn}${rollPanel(r)}</div>`;
    }
    const canEdit = !holiday && (!weekend || weekendAllowed);
    if (canEdit && !rows.length) html += addFormHtml(cid, dept, date);   // adding a day = click an empty cell
    if (rows.length) {
        const nLater = S.rows.filter(r => r.casting_id === cid && r.date > date).length;
        html += `<div class="sc-ed-move">Move these to <input type="date" id="sc-ed-move-date" value="${date}"><button type="button" class="btn-secondary" id="sc-ed-move">Move</button></div>`;
        html += `<label class="sc-ed-cascade"><input type="checkbox" id="sc-ed-cascade"${S.cascade ? ' checked' : ''}${nLater ? '' : ' disabled'}> Cascade: also move every task after this one (${nLater}) by the same number of working days</label>`;
    }
    if (rows.length) html += `<div class="sc-stg" id="sc-stg"><div class="sc-stg-title">Staging note</div><div class="sc-hint">Loading the portal's staging note…</div></div>`;
    html += `<div class="sc-ed-actions"><button type="button" class="btn-secondary" id="sc-ed-cancel">Close</button><div class="right">${canEdit && rows.length ? '<button type="button" class="btn-primary" id="sc-ed-save">Save</button>' : ''}</div></div>`;
    ed.innerHTML = html;
    ed.hidden = false;
    refreshAddForm();
    placeEditor(td);
    if (rows.length) fillStagingSection(cid, dept, date, td);
}

// ---- staging note (the portal's Staging tab, task_descriptions): casting + weekly department + the day's index in that team
const weeklyDeptOf = (dept) => DEPARTMENTS.find(d => d.key === dept)?.weekly || dept;
async function stagingFor(projectNumber) {
    if (!S.staging.has(projectNumber)) S.staging.set(projectNumber, await fetchStagingNotes(projectNumber));
    return S.staging.get(projectNumber);
}
/** This date's day number among the casting's scheduled days in that team (1 = first), over all months. */
async function stagingDayOf(cid, dept, date) {
    const all = S.pinned.has(cid) ? S.rows.filter(r => r.casting_id === cid) : await loadScheduleForCastings([cid]);
    const dates = [...new Set(all.filter(r => r.department === dept).map(r => r.date))].sort();
    const i = dates.indexOf(date);
    return i < 0 ? null : i + 1;
}
async function fillStagingSection(cid, dept, date, td) {
    const box = $('sc-stg');
    if (!box || !editorCtx || editorCtx.cid !== cid || editorCtx.date !== date || editorCtx.dept !== dept) return;
    const c = S.castingById.get(cid);
    try {
        const [notes, dayIdx] = await Promise.all([stagingFor(c.project_number), stagingDayOf(cid, dept, date)]);
        if (!$('sc-stg') || !editorCtx || editorCtx.cid !== cid || editorCtx.date !== date) return;
        let day = dayIdx;
        let wd = weeklyDeptOf(dept);
        let key = `${c.casting_number}|${wd}|${day}`;
        const r0 = S.rows.find(r => r.casting_id === cid && r.date === date && r.department === dept);
        const u0 = r0 && unitOf(r0);
        if (u0 && u0.startsWith('unit:')) { key = u0.slice(5); const parts = key.split('|'); wd = parts[1]; day = parts[2]; }
        if (!notes.has(key)) {   // the Staging tab may have used another spelling for this team ("FormOut", "Mill", "Load" …)
            const alt = [...notes.keys()].find(k => { const [cast, sd, d] = k.split('|'); return cast === String(c.casting_number) && String(d) === String(day) && teamOfStagingDept(sd) === dept; });
            if (alt) { key = alt; wd = alt.split('|')[1]; }
        }
        const cur = (notes.get(key) || {}).description || '';
        const where = `${esc(wd)} day ${day} of ${esc(castLabelShort(c))}`;
        box.innerHTML = `<div class="sc-stg-title">Staging note <small>(${where})</small></div>
            ${cur.trim() ? `<div class="sc-stg-cur">${esc(cur)}</div>` : `<div class="sc-ed-alert">&#9888; No staging note in the portal for ${where}.</div>`}
            <textarea id="sc-stg-text" rows="3" placeholder="Type the updated staging note…" data-key="${esc(key)}" data-day="${day}" data-wd="${esc(wd)}">${esc(cur)}</textarea>
            <div class="sc-stg-actions"><button type="button" class="btn-primary" id="sc-stg-save">Save staging note</button><span class="sc-hint">Saves to the portal's Staging tab and the weekly card.</span></div>`;
        placeEditor(td);
    } catch (err) {
        box.innerHTML = `<div class="sc-stg-title">Staging note</div><div class="sc-ed-alert">Could not load the staging note: ${esc(err.message || err)}</div>`;
    }
}
function castLabelShort(c) { return `Cast ${c.casting_number}`; }
async function saveStagingFromEditor() {
    const ta = $('sc-stg-text');
    if (!ta || !editorCtx) return;
    const c = S.castingById.get(editorCtx.cid);
    const text = ta.value;
    setBusy(true);
    try {
        await saveStagingNote({ projectNumber: c.project_number, castingNumber: c.casting_number, department: ta.dataset.wd, dayNumber: ta.dataset.day, description: text });
        const m = await stagingFor(c.project_number);
        m.set(ta.dataset.key, { ...(m.get(ta.dataset.key) || {}), description: text });
        toast(text.trim() ? `Staging note saved for ${ta.dataset.wd} day ${ta.dataset.day} of ${castLabelShort(c)}` : 'Staging note cleared');
        const td = document.querySelector(`tr.sc-cast-top td.sc-cell[data-cid="${editorCtx.cid}"][data-date="${editorCtx.date}"][data-dept="${editorCtx.dept}"]`);
        if (td) openEditor(td);
    } catch (err) { toast('Could not save the staging note: ' + (err.message || err), 'error'); }
    finally { setBusy(false); }
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
    const others = S.rows.filter(x => unitOf(x) === unitOf(row) && x.id !== row.id).sort((a, b) => b.date.localeCompare(a.date));
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
            if (!unitOf(row) && Math.abs(hours - (Number(row.hours) || 0)) > 0.001) {   // portal hours are never edited here
                if (hours <= 0) await deleteScheduleRow(row.id);
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

/** Split a phase day with the next working day: today keeps todayH, the next day gets the rest of the pair's hours. */
async function saveRollover(rowId, todayH) {
    const row = S.rows.find(r => r.id === rowId);
    if (!row || !unitOf(row)) return;
    const next = nextWorking(row.date, 1);
    const nextRow = S.rows.find(x => unitOf(x) === unitOf(row) && x.date === next && x.department === row.department);
    const total = Math.round(((Number(row.hours) || 0) + (nextRow ? Number(nextRow.hours) || 0 : 0)) * 100) / 100;
    todayH = Math.round((Number(todayH) || 0) * 100) / 100;
    const nextH = Math.round((total - todayH) * 100) / 100;
    if (todayH <= 0 || nextH <= 0) { toast(`Both days need some hours (together ${fmtH(total)} h). To move the whole task, use Move instead.`, 'error'); return; }
    if (!nextRow && TEAM_DAY_LIMITS[row.department]) {
        const load = await loadTeamLoad(next, next, row.casting_id);
        if (!confirmOverload(overloadsOf([{ date: next, department: row.department }], load))) return;
    }
    setBusy(true);
    const __h = await histBegin(`roll over ${String(row.task).toLowerCase()} to ${shortDay(next)}`, [row.casting_id]);
    try {
        await updateScheduleRow(row.id, { hours: todayH });
        if (nextRow) await updateScheduleRow(nextRow.id, { hours: nextH });
        else await insertScheduleRows([{ project_number: row.project_number, casting_id: row.casting_id, phase_id: row.phase_id, date: next, department: row.department, task: row.task, hours: nextH, weekend_ok: false, note: row.phase_id ? `Rolled over from ${shortDay(row.date)}` : row.note }]);
        await histEnd(__h);
        await loadRows();
        render();
        toast(`${String(row.task).toLowerCase()}: ${fmtH(todayH)} h on ${shortDay(row.date)}, ${fmtH(nextH)} h on ${shortDay(next)} (total ${fmtH(total)} h kept)`);
        const td = document.querySelector(`tr.sc-cast-top td.sc-cell[data-cid="${row.casting_id}"][data-date="${row.date}"][data-dept="${row.department}"]`);
        if (td) openEditor(td); else closeEditor();
    } catch (err) { toast('Roll-over failed: ' + (err.message || err), 'error'); }
    finally { setBusy(false); }
}

/** Optimizer Hours tasks of this casting that this team may do — the only things a new day can be. */
function addablePhases(cid, dept) {
    return mappedPhases(cid).filter(m => (TASKS[m.code] || []).includes(dept) || m.dept === dept);
}
function addFormHtml(cid, dept, date) {
    const list = addablePhases(cid, dept);
    if (!list.length) return `<div class="sc-ed-add-none">This casting has no ${esc(deptLabel(dept))} task on the Optimizer Hours tab, so there is nothing to add here. Hours only come from the portal.</div>`;
    const opt = (m) => {
        const days = S.rows.filter(r => unitOf(r) === m.unit).length;
        return `<option value="${esc(m.unit)}">${esc(String(m.code).toLowerCase())} — ${esc(m.phase.phase_name)} (${fmtH(m.phase.hours)} h${days ? `, on ${days} day${days === 1 ? '' : 's'}` : ', not scheduled yet'})</option>`;
    };
    return `<div class="sc-ed-add-wrap"><div class="sc-ed-add-title">Add a day for</div>
        <div class="sc-ed-add"><select id="sc-ed-add-phase">${list.map(opt).join('')}</select><input type="number" id="sc-ed-add-hours" step="0.5" min="0" placeholder="h"><button type="button" class="btn-secondary" id="sc-ed-add">Add</button></div>
        <div id="sc-ed-add-note" class="sc-ed-phase"></div></div>`;
}
/** Fill the hours box with an even share and explain where the hours come from. */
function refreshAddForm() {
    const sel = $('sc-ed-add-phase'), hin = $('sc-ed-add-hours'), note = $('sc-ed-add-note');
    if (!sel || !hin || !note) return;
    const m = mappedPhases(editorCtx.cid).find(x => x.unit === sel.value);
    if (!m) return;
    const total = Number(m.phase.hours) || 0;
    const days = S.rows.filter(r => unitOf(r) === m.unit);
    if (!days.length) {
        hin.value = fmtH(total); hin.readOnly = true;
        note.textContent = `Not scheduled yet: this day gets all ${fmtH(total)} h from the Optimizer Hours tab.`;
    } else {
        hin.readOnly = false;
        if (!hin.dataset.touched) hin.value = fmtH(Math.max(0.5, Math.round(total / (days.length + 1) * 2) / 2));
        note.textContent = `Already on ${days.map(r => shortDay(r.date)).join(', ')}. The hours for this day are taken from those days (in proportion) so the total stays ${fmtH(total)} h.`;
    }
}

async function addEditorEntry() {
    if (!editorCtx) return;
    const sel = $('sc-ed-add-phase');
    if (!sel) return;
    const cid = editorCtx.cid, date = editorCtx.date, dept = editorCtx.dept;
    const m = mappedPhases(cid).find(x => x.unit === sel.value);
    if (!m) { toast('Pick a task first.', 'error'); return; }
    const total = Math.round((Number(m.phase.hours) || 0) * 100) / 100;
    const days = S.rows.filter(r => unitOf(r) === m.unit);
    if (days.some(r => r.date === date && r.department === dept)) { toast('This task is already on this day — use Roll over or Move instead.', 'error'); return; }
    let hours = days.length ? Math.round((Number($('sc-ed-add-hours').value) || 0) * 100) / 100 : total;
    if (days.length && (hours <= 0 || hours >= total)) { toast(`Enter between 0 and ${fmtH(total)} h — the other day${days.length === 1 ? '' : 's'} must keep some hours.`, 'error'); return; }
    // the other days give up the new day's hours in proportion to what they hold, so the phase still totals the portal's hours
    const held = days.reduce((n, r) => n + (Number(r.hours) || 0), 0);
    const plan = days.map(r => ({ row: r, hours: Math.round((Number(r.hours) || 0) * (held - hours) / held * 100) / 100 }));
    if (plan.length) {
        const diff = Math.round(((total - hours) - plan.reduce((n, x) => n + x.hours, 0)) * 100) / 100;
        const big = plan.reduce((a, x) => (x.hours > a.hours ? x : a), plan[0]);
        big.hours = Math.round((big.hours + diff) * 100) / 100;
        if (plan.some(x => x.hours <= 0)) { toast('That would leave another day with no hours — enter fewer hours.', 'error'); return; }
    }
    const c = S.castingById.get(cid);
    const weekend = isWeekend(date);
    if (TEAM_DAY_LIMITS[dept]) {
        const load = await loadTeamLoad(date, date, cid);
        if (!confirmOverload(overloadsOf([{ date, department: dept }], load))) return;
    }
    setBusy(true);
    const __h = await histBegin(`add ${String(m.code).toLowerCase()} on ${shortDay(date)}`, [cid]);
    try {
        for (const x of plan) await updateScheduleRow(x.row.id, { hours: x.hours });
        await insertScheduleRows([{ project_number: c.project_number, casting_id: c.id, phase_id: m.phase.id || null, date, department: dept, task: m.code, hours, weekend_ok: weekend, note: m.phase.id ? null : m.unit }]);
        S.pinned.add(c.id);
        await histEnd(__h);
        await loadRows();
        render();
        toast(plan.length ? `Added ${fmtH(hours)} h of ${String(m.code).toLowerCase()} on ${shortDay(date)}; the other day${plan.length === 1 ? '' : 's'} now ${plan.length === 1 ? 'has' : 'have'} ${plan.map(x => fmtH(x.hours) + ' h').join(', ')} (total ${fmtH(total)} h)` : `Added ${String(m.code).toLowerCase()} with all ${fmtH(total)} h on ${shortDay(date)}`);
        const td = document.querySelector(`tr.sc-cast-top td.sc-cell[data-cid="${c.id}"][data-date="${date}"][data-dept="${dept}"]`);
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
    if (alert) { alert.outerHTML = addFormHtml(editorCtx.cid, editorCtx.dept, editorCtx.date); refreshAddForm(); }
}

/** Working days from one date to another (signed); a weekend target counts as the next working day. */
function workingOffset(from, to) {
    if (to === from) return 0;
    const dir = to > from ? 1 : -1;
    let d = from, n = 0;
    for (let i = 0; i < 500; i++) { d = nextWorking(d, dir); n += dir; if (dir > 0 ? d >= to : d <= to) break; }
    return n;
}
function stepWorking(d, n) { for (let i = 0; i < Math.abs(n); i++) d = nextWorking(d, Math.sign(n)); return d; }

/** Move one casting's task(s) in one team column from one day to another (Move button and drag-and-drop).
 *  cascade: every task of that casting dated after the moved one moves by the same number of working days. */
async function moveCellEntries(cid, fromDate, dept, to, cascade = false) {
    if (!to || to === fromDate) return false;
    if (isHoliday(to)) { toast(`${shortDay(to)} is a holiday — nothing can be scheduled there.`, 'error'); return false; }
    if (isWeekend(to) && !window.confirm(`${shortDay(to)} is a weekend. Allow it for these entries?`)) return false;
    const rows = S.rows.filter(r => r.casting_id === cid && r.date === fromDate && r.department === dept);
    if (!rows.length) return false;
    const n = workingOffset(fromDate, to);
    const later = cascade ? S.rows.filter(r => r.casting_id === cid && r.date > fromDate).map(r => ({ row: r, date: stepWorking(r.date, n) })) : [];
    // a cascade that pushes tasks over a weekend asks whether any of them should land on that Saturday instead
    const satChoices = saturdayChoices(later);
    if (satChoices.length) {
        const picked = await askSaturdays(satChoices);
        if (picked === null) return false;
        picked.forEach(i => { satChoices[i].x.date = satChoices[i].sat; satChoices[i].x.sat = true; });
    }
    const landing = [{ date: to, department: dept }, ...later.map(x => ({ date: x.date, department: x.row.department }))];
    if (landing.some(x => TEAM_DAY_LIMITS[x.department])) {
        const span = landing.map(x => x.date).sort();
        const load = await loadTeamLoad(span[0], span[span.length - 1], cid);
        if (!confirmOverload(overloadsOf(landing, load))) return false;
    }
    setBusy(true);
    const label = `move ${rows.map(r => r.task).join('+').toLowerCase()} to ${shortDay(to)}${later.length ? ` + ${later.length} later task${later.length === 1 ? '' : 's'}` : ''}`;
    const __h = await histBegin(label, [cid]);
    try {
        for (const r of rows) await updateScheduleRow(r.id, { date: to, weekend_ok: isWeekend(to) ? true : r.weekend_ok });
        for (const x of later) await updateScheduleRow(x.row.id, { date: x.date, weekend_ok: x.sat ? true : (isWeekend(x.date) ? x.row.weekend_ok : false) });
        await histEnd(__h);
        await loadRows();
        render();
        toast(later.length ? `Moved to ${shortDay(to)} and cascaded ${later.length} later task${later.length === 1 ? '' : 's'} by ${n > 0 ? '+' : ''}${n} working day${Math.abs(n) === 1 ? '' : 's'}` : `Moved to ${shortDay(to)}`);
        return true;
    } catch (err) { toast('Move failed: ' + (err.message || err), 'error'); return false; }
    finally { setBusy(false); }
}
/** Cascaded tasks that jump over a Saturday: the Saturday they could land on instead. */
function saturdayChoices(later) {
    const out = [];
    for (const x of later) {
        const from = x.row.date, to = x.date;
        if (to > from) {
            const sat = addDays(to, -((dow(to) + 1) % 7));          // the Saturday just before the new day
            if (dow(sat) === 6 && sat > from && !isHoliday(sat) && nextWorking(sat, 1) === to) out.push({ x, sat });
        } else if (to < from) {
            const sat = addDays(to, (6 - dow(to) + 7) % 7);         // the Saturday just after the new day
            if (dow(sat) === 6 && sat < from && !isHoliday(sat) && nextWorking(sat, -1) === to) out.push({ x, sat });
        }
    }
    return out;
}
/** Ask which of those tasks should land on the Saturday. Resolves to a Set of indexes, or null = cancel the move. */
function askSaturdays(choices) {
    return new Promise((resolve) => {
        const box = document.createElement('div');
        box.className = 'sc-panel-backdrop';
        box.id = 'sc-satq';
        box.innerHTML = `<div class="sc-panel sc-panel-sm" role="dialog" aria-modal="true">
            <div class="sc-panel-head"><h2>Land a task on a Saturday?</h2><button type="button" class="sc-x" data-act="cancel">&times;</button></div>
            <div class="sc-panel-body">
                <p class="sc-hint">This cascade pushes ${choices.length === 1 ? 'a task' : 'these tasks'} over a weekend. Tick any you would like to land on the Saturday instead (it is marked as an allowed weekend day). Leave them unticked to keep the weekday.</p>
                ${choices.map((c, i) => `<label class="sc-choice"><input type="checkbox" data-i="${i}"> <span><strong>${esc(String(c.x.row.task).toLowerCase())}</strong> (${esc(deptLabel(c.x.row.department))}): <strong>${esc(shortDay(c.sat))}</strong> instead of ${esc(shortDay(c.x.date))}</span></label>`).join('')}
            </div>
            <div class="sc-panel-foot"><button type="button" class="btn-secondary" data-act="cancel">Cancel the move</button><button type="button" class="btn-primary" data-act="ok">Move</button></div>
        </div>`;
        document.body.appendChild(box);
        box.addEventListener('click', (e) => {
            const act = e.target.closest('[data-act]')?.dataset.act;
            if (!act) return;
            const picked = act === 'ok' ? new Set([...box.querySelectorAll('input[data-i]:checked')].map(el => Number(el.dataset.i))) : null;
            box.remove();
            resolve(picked);
        });
    });
}
function setCascade(on) {
    S.cascade = !!on;
    const hc = $('sc-cascade'); if (hc) hc.checked = S.cascade;
    const ec = $('sc-ed-cascade'); if (ec) ec.checked = S.cascade;
    try { localStorage.setItem('sc-cascade', S.cascade ? '1' : '0'); } catch (_) { /* ignore */ }
}
async function moveEditorEntries() {
    if (!editorCtx) return;
    const ctx = editorCtx;
    if (await moveCellEntries(ctx.cid, ctx.date, ctx.dept, $('sc-ed-move-date').value, !!$('sc-ed-cascade')?.checked)) closeEditor();
}

// ---- drag a task to another day on the same casting's row (it keeps its team column)
let dragCtx = null;   // { cid, date, dept }
function dropTargetFor(td) {
    if (!dragCtx || !td || td.dataset.cid !== dragCtx.cid) return null;
    return document.querySelector(`tr.sc-cast-top td.sc-cell[data-cid="${dragCtx.cid}"][data-date="${td.dataset.date}"][data-dept="${dragCtx.dept}"]`);
}
function clearDropMarks() { document.querySelectorAll('.sc-drop-target, .sc-drop-target-h').forEach(el => el.classList.remove('sc-drop-target', 'sc-drop-target-h')); }
function markDrop(td) {
    clearDropMarks();
    const top = dropTargetFor(td);
    if (!top) return;
    top.classList.add('sc-drop-target');
    const bottom = document.querySelector(`tr.sc-cast-bottom td.sc-cell[data-cid="${dragCtx.cid}"][data-date="${td.dataset.date}"][data-dept="${dragCtx.dept}"]`);
    if (bottom) bottom.classList.add('sc-drop-target-h');
}
function wireDrag(wrap) {
    wrap.addEventListener('dragstart', (e) => {
        const td = e.target.closest && e.target.closest('td.sc-cell.sc-has');
        if (!td || S.busy) { e.preventDefault(); return; }
        dragCtx = { cid: td.dataset.cid, date: td.dataset.date, dept: td.dataset.dept };
        closeEditor();
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', `${dragCtx.dept} ${dragCtx.date}`); } catch (_) { /* ignore */ }
        document.querySelectorAll(`td.sc-cell[data-cid="${dragCtx.cid}"][data-date="${dragCtx.date}"][data-dept="${dragCtx.dept}"]`).forEach(el => el.classList.add('sc-dragging'));
    });
    wrap.addEventListener('dragover', (e) => {
        const td = e.target.closest && e.target.closest('td.sc-cell');
        if (!dragCtx || !td || td.dataset.cid !== dragCtx.cid) return;   // only the same casting's row accepts the drop
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        markDrop(td);
    });
    wrap.addEventListener('dragleave', (e) => { if (!wrap.contains(e.relatedTarget)) clearDropMarks(); });
    wrap.addEventListener('drop', async (e) => {
        const td = e.target.closest && e.target.closest('td.sc-cell');
        if (!dragCtx || !td || td.dataset.cid !== dragCtx.cid) return;
        e.preventDefault();
        const ctx = dragCtx, to = td.dataset.date;
        dragCtx = null;
        clearDropMarks();
        document.querySelectorAll('.sc-dragging').forEach(el => el.classList.remove('sc-dragging'));
        if (to !== ctx.date) await moveCellEntries(ctx.cid, ctx.date, ctx.dept, to, S.cascade || e.shiftKey);   // Shift while dropping = cascade too
    });
    wrap.addEventListener('dragend', () => {
        dragCtx = null;
        clearDropMarks();
        document.querySelectorAll('.sc-dragging').forEach(el => el.classList.remove('sc-dragging'));
    });
}

async function deleteEditorEntry(id) {
    const row = S.rows.find(r => r.id === id);
    if (!row) return;
    if (unitOf(row)) {
        const others = S.rows.filter(x => unitOf(x) === unitOf(row) && x.id !== id).sort((a, b) => b.date.localeCompare(a.date));
        if (!others.length) { toast('This is the phase\'s only day — its hours are locked to the Optimizer Hours tab. Move it instead, or remove the whole casting from the row menu.', 'error'); return; }
        if (!window.confirm(`Remove this day? Its ${fmtH(row.hours)} h move to the phase's last other day so the Optimizer Hours total stays locked.`)) return;
    }
    setBusy(true);
    const __h = await histBegin('remove day', [editorCtx.cid]);
    try {
        if (unitOf(row)) { const err = await changePhaseDayHours(row, 0); if (err) { toast(err, 'error'); return; } }
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
// cast day choice — team limits are a warning, not a block (user 2026-10-20: "I just want to be prompted")
// ---------------------------------------------------------------------------
function whoCasts(castingId) {
    const c = S.castingById.get(castingId);
    return c ? `${c.project_number} ${castingLabel(c)}` : 'another casting';
}
/** date|dept -> Set(casting_id) for the limited teams, from the database, leaving one casting out. */
async function loadTeamLoad(fromIso, toIso, excludeCastingId) {
    const rows = await loadScheduleRange(fromIso, toIso);
    const m = new Map();
    for (const r of rows) {
        if (r.casting_id === excludeCastingId || !TEAM_DAY_LIMITS[r.department]) continue;
        const k = `${r.date}|${r.department}`;
        if (!m.has(k)) m.set(k, new Set());
        m.get(k).add(r.casting_id);
    }
    return m;
}
/** Which team-days would go over their limit if these rows (one casting's) were added. */
function overloadsOf(rows, load) {
    const seen = new Set(), out = [];
    for (const r of rows) {
        const lim = TEAM_DAY_LIMITS[r.department];
        if (!lim) continue;
        const k = `${r.date}|${r.department}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const others = load.get(k) || new Set();
        if (others.size + 1 > lim) out.push({ date: r.date, dept: r.department, count: others.size + 1, limit: lim, names: [...others].map(whoCasts) });
    }
    return out.sort((x, y) => x.date.localeCompare(y.date));
}
function overloadLines(list) {
    return list.map(x => `${shortDay(x.date)} ${deptLabel(x.dept)}: ${x.count} castings (limit ${x.limit})${x.names.length ? ' — with ' + x.names.join(', ') : ''}`);
}
/** Ask before over-scheduling; true = go ahead. */
function confirmOverload(list) {
    if (!list.length) return true;
    const lines = overloadLines(list.slice(0, 12)).join('\n') + (list.length > 12 ? `\n… and ${list.length - 12} more` : '');
    return window.confirm(`This will OVER-SCHEDULE ${list.length} team-day${list.length === 1 ? '' : 's'}:\n\n${lines}\n\nParts, FO, Cast and DM take 1 casting a day; F, Seal and Spec take 5.\n\nOK = over-schedule anyway.   Cancel = go back.`);
}
/** First working day on/after `from` where the whole casting fits without putting any team over its limit. */
function nextFreeCastDay(c, load, from, stage) {
    let d = workingOrNext(from);
    for (let i = 0; i < 400; i++) {
        if (!overloadsOf(planCasting(c, d, stage), load).length) return d;
        d = nextWorking(d, 1);
    }
    return workingOrNext(from);
}
let schedCtx = null;   // { cid, replace, load, next }
async function openScheduleDialog(castingId, { replace = false } = {}) {
    const c = S.castingById.get(castingId);
    if (!c) return;
    setBusy(true);
    let load, stage;
    try { [load, stage] = await Promise.all([loadTeamLoad(addDays(todayIso(), -90), addDays(todayIso(), 400), castingId), stagingDaysFor(c)]); }
    catch (err) { toast('Could not read the grid: ' + (err.message || err), 'error'); setBusy(false); return; }
    finally { setBusy(false); }
    const next = nextFreeCastDay(c, load, todayIso(), stage);
    schedCtx = { cid: castingId, replace, load, next, stage };
    // what the Staging tab says: days per team for this casting
    const units = mappedPhases(castingId);
    const teamsUsed = [...new Set(units.map(m => m.dept))];
    const fromStaged = units.length && units[0].staged;
    const stagedLine = teamsUsed.map(d => `${deptLabel(d)} ${fromStaged ? units.filter(m => m.dept === d).length : stagedDaysOf(stage, d)}`).join(' · ');
    const noStaging = fromStaged ? [] : teamsUsed.filter(d => !stage.get(d));
    const own = c.casting_date || '';
    const box = $('sc-sched');
    box.innerHTML = `<div class="sc-panel sc-panel-sm" role="dialog" aria-modal="true">
        <div class="sc-panel-head"><h2>${replace ? 'Regenerate' : 'Schedule'} ${esc(castingLabel(c))} — ${esc(projectLabel(c.project_number))}</h2><button type="button" class="sc-x" data-close>&times;</button></div>
        <div class="sc-panel-body">
            <p class="sc-hint">Would you like to schedule on the next available cast day, or choose a cast day? Cast date on the job: ${own ? esc(shortDay(own)) + ' (Castings tab)' : 'none on the Castings tab'}.</p>
            <p class="sc-hint"><strong>Days per team from the Staging tab:</strong> ${esc(stagedLine)}.${noStaging.length ? ` <span class="sc-stg-warn">&#9888; No staging days for ${esc(noStaging.map(deptLabel).join(', '))} — those get 1 day each.</span>` : ''} ${fromStaged ? 'Each day carries the hours entered on the Optimizer Hours tab.' : 'This casting still uses its previous task list: each team\'s hours are split over its days.'}</p>
            <label class="sc-choice"><input type="radio" name="sc-cast-mode" value="next" checked> <strong>Next available cast day:</strong> ${esc(shortDay(next))} <small class="sc-hint">(no team over its limit)</small></label>
            <label class="sc-choice"><input type="radio" name="sc-cast-mode" value="pick"> <strong>Choose a cast day:</strong> <input type="date" id="sc-cast-pick" value="${esc(own || next)}"></label>
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
        note.classList.remove('sc-note-warn');
        if (!d) { note.textContent = ''; return; }
        if (isHoliday(d)) { note.textContent = `${shortDay(d)} is a holiday — nothing is scheduled on holidays.`; note.classList.add('sc-note-warn'); return; }
        const over = overloadsOf(planCasting(c, d, stage), load);
        if (over.length) {
            note.classList.add('sc-note-warn');
            note.innerHTML = `&#9888; This over-schedules ${over.length} team-day${over.length === 1 ? '' : 's'}: ` + esc(overloadLines(over.slice(0, 4)).join('; ')) + (over.length > 4 ? '; …' : '') + '. You will be asked to confirm.';
            return;
        }
        note.textContent = isWeekend(d)
            ? `${shortDay(d)} is a weekend — the Cast day moves to the next working day unless you allow the weekend on the grid afterwards.`
            : `Cast on ${shortDay(d)}; earlier phases run back from it, later ones forward. No team goes over its limit.`;
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
    if (!confirmOverload(overloadsOf(planCasting(c, d, schedCtx.stage), schedCtx.load))) return;
    const ctx = schedCtx;
    box.hidden = true; schedCtx = null;
    await scheduleCasting(ctx.cid, d, { replace: ctx.replace, stage: ctx.stage });
}

// ---------------------------------------------------------------------------
// settings
// ---------------------------------------------------------------------------
function openSettings() {
    $('sc-holidays').value = (S.settings.holidays || []).join('\n');
    $('sc-settings').hidden = false;
}
async function saveSettings() {
    const holidays = $('sc-holidays').value.split(/\r?\n/).map(s => s.trim()).filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s)).sort();
    setBusy(true);
    try {
        await saveScheduleSetting('holidays', holidays);
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
    $('sc-grid-wrap').addEventListener('change', (e) => {
        const inp = e.target.closest('input[data-cost]'); if (inp) { saveCostInput(inp); return; }
        const tg = e.target.closest('input[data-target]'); if (tg) saveTargetInput(tg);
    });
    $('sc-grid-wrap').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('input[data-cost], input[data-target]')) e.target.blur(); });
    $('sc-view-toggle').addEventListener('click', () => { S.view = S.view === 'revenue' ? 'grid' : 'revenue'; closeEditor(); render(); });
    $('sc-show-weekends').addEventListener('change', (e) => { S.settings.showWeekends = !!e.target.checked; try { localStorage.setItem('sc-weekends', S.settings.showWeekends ? '1' : '0'); } catch (_) { /* ignore */ } render(); });
    $('sc-search').addEventListener('input', (e) => { S.search = e.target.value; render(); });
    $('sc-uns-search').addEventListener('input', (e) => { S.unsSearch = e.target.value; renderUnscheduled(); });
    $('sc-settings-btn').addEventListener('click', openSettings);
    $('sc-sched').addEventListener('click', (e) => {
        if (e.target.closest('[data-close]') || e.target === $('sc-sched')) { $('sc-sched').hidden = true; schedCtx = null; return; }
        if (e.target.id === 'sc-cast-go' && !S.busy) confirmScheduleDialog();
    });
    $('sc-cascade').addEventListener('change', (e) => setCascade(e.target.checked));
    $('sc-editor').addEventListener('change', (e) => { if (e.target.id === 'sc-ed-cascade') setCascade(e.target.checked); });
    $('sc-editor').addEventListener('change', (e) => { if (e.target.id === 'sc-ed-add-phase') { const h = $('sc-ed-add-hours'); if (h) delete h.dataset.touched; refreshAddForm(); } });
    $('sc-editor').addEventListener('input', (e) => {
        if (e.target.id === 'sc-ed-add-hours') e.target.dataset.touched = '1';
        const panel = e.target.closest('.sc-roll');
        if (!panel) return;
        const total = Number(panel.dataset.total) || 0;
        const clamp = (v) => Math.min(total, Math.max(0, Math.round((Number(v) || 0) * 100) / 100));
        if (e.target.matches('[data-roll-today]')) panel.querySelector('[data-roll-next]').value = fmtH(Math.round((total - clamp(e.target.value)) * 100) / 100);
        if (e.target.matches('[data-roll-next]')) panel.querySelector('[data-roll-today]').value = fmtH(Math.round((total - clamp(e.target.value)) * 100) / 100);
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

    wireDrag($('sc-grid-wrap'));
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
        if (t.id === 'sc-stg-save') { await saveStagingFromEditor(); return; }
        const ro = t.closest('[data-roll-open]');
        if (ro) { const pnl = $('sc-editor').querySelector(`.sc-roll[data-roll="${ro.dataset.rollOpen}"]`); if (pnl) { pnl.hidden = !pnl.hidden; placeEditor(document.querySelector(`td.sc-cell[data-cid="${editorCtx.cid}"][data-date="${editorCtx.date}"][data-dept="${editorCtx.dept}"]`) || ro); } return; }
        if (t.closest('[data-roll-save]')) { const pnl = t.closest('.sc-roll'); await saveRollover(pnl.dataset.roll, pnl.querySelector('[data-roll-today]').value); return; }
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
        if (tables.has('task_descriptions')) { try { S.staging = await fetchStagingForProjects(S.projects.map(p => p.project_number)); } catch (err) { logger.warn('[scheduler] staging reload failed', err); } }
        if (tables.has('plant_schedule_settings')) {
            try { const saved = await loadScheduleSettings(); S.ready = readyFromSettings(saved); if (Number(saved.target) > 0) S.settings.target = Number(saved.target); if (saved.costs) S.settings.costs = saved.costs; }
            catch (err) { logger.warn('[scheduler] reload settings failed', err); }
        }
        if (tables.has('plant_schedule') || tables.has('plant_schedule_settings') || tables.has('casting_phases') || tables.has('project_castings') || tables.has('task_descriptions')) {
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
    try { setCascade(localStorage.getItem('sc-cascade') === '1'); } catch (_) { /* ignore */ }
    try {
        await initializeSupabase();
        const saved = await loadScheduleSettings();
        if (Array.isArray(saved.holidays)) S.settings.holidays = saved.holidays;
        if (saved.costs && typeof saved.costs === 'object') S.settings.costs = saved.costs;
        if (Number(saved.target) > 0) S.settings.target = Number(saved.target);
        S.ready = readyFromSettings(saved);
        await loadBase();
        await loadRows();
        render();
    } catch (err) {
        logger.error('[scheduler] init failed', err);
        $('sc-grid-wrap').innerHTML = `<div class="sc-loading">Could not load: ${esc(err.message || err)}</div>`;
    }
}

// debugging hooks (read-only use from the console)
window.__scheduler = { S, planCasting, stagingDaysFor, lockReport, mappedPhases, nextWorking, undo, redo, HIST };

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
