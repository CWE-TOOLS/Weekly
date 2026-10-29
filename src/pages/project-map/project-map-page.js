/**
 * Project Map — the weekly by department, one screen. Read-only, except in Dummy mode.
 *
 * Views: Day (one date), Week (Mon–Sat, each column broken into weekdays), 4 weeks (Week 1–7, 8–14, 15–21, 22–28
 * blocks), Month (the weeks that belong to a calendar month, numbered Week 1, 2, 3… like the Releasability Board).
 * A casting appears in a department's column in every break where it has a weekly day in that department. In Day view
 * a ticked department with nothing scheduled that day is hidden and listed in a notice. Shipped castings (last Ship
 * day before the view, or job Shipped / Closed Out) sit in the Shipped pop-up for SHIPPED_WINDOW_DAYS. Cards are
 * collapsed; click one for the full card with the casting's trail through the departments; a band title opens that
 * band's jobs, the department title the whole view. The Departments picker is remembered per browser.
 *
 * DUMMY MODE (for the DOP): a named what-if laid over the weekly. Drag a card to another day or week band of the same
 * department and the casting's whole block of days in that department slides by that many working days; with "Move
 * chain" on, every later department of that casting slides too. The dummy follows the Plant Scheduler's calendar rules
 * (2026-10-29): days before today never move, holidays are never landed on, a weekend only after a confirm, and working
 * days are Mon–Fri minus holidays. Blocks move whole, so day numbers (and therefore the
 * staging notes keyed by them) travel with the card. Each band shows its hours; a band above the busiest real day or
 * week seen in the last 8 weeks is flagged. Save / Open / Rename / Delete / Final live in project_map_dummies (+ moves).
 * Nothing real changes until a dummy is applied — Apply is a later phase, written with the DOP.
 * CALENDAR (dummy mode only, 2026-10-27): the month as the conference-room whiteboard — rows Week 1, 2, 3…, a cell per
 * day, the day's jobs grouped by department inside the cell; drag a card to any day.
 * TOUCH (2026-10-27): finger drag-and-drop does not exist in browsers, so a card's full view has a "Move" button:
 * tap it, then tap the day (or band) it should start on; Cancel / Esc / tapping anything else lets go. Works with a
 * mouse too. "Full screen" in the header uses the whole display.
 * Views: Day (one date), Week (Mon–Sat, each column broken into weekdays), 4 weeks (broken into Week 1–7, 8–14, 15–21,
 * 22–28 blocks), Month (the weeks that belong to a calendar month, numbered Week 1, 2, 3… like the Releasability Board).
 * A casting appears in a department's column in every break where it has a weekly day in that department.
 * Shipped castings (last Ship day before the view, or job Shipped / Closed Out) sit in the Shipped pop-up for
 * SHIPPED_WINDOW_DAYS. Cards are collapsed; click one for the full card with the casting's trail through the
 * departments (the department it was opened from in bold); a full column's title opens the whole list.
 * The Departments picker (like the weekly's) chooses which columns are shown; the choice is remembered per browser.
 * Loads (2026-10-27): a line that is one clear day (a Week day band, the column title in Day view) shows the finished-face
 * sq ft of its jobs (rounded up), green under S.warn.sqftWarn, orange to S.warn.sqftOver, red from there; lines that span several days
 * (Month week bands, column titles in Week/Month views) show none — the user wants the load per day only.
 * Cast with more than S.warn.castLimit castings on one day gets a red count and the words POTENTIAL RISK on every band
 * head and pop-up heading; the column title carries it only in Day view (user, 2026-10-27: not on the department otherwise).
 * The levels (sq ft orange / red, castings a day) come from the header's Warnings pop-up, saved for everyone (2026-10-29).
 */
import { fetchAllTasks } from '../../services/data-service.js';
import { loadAllProjects } from '../../services/projects-service.js';
import { initializeSupabase, registerRefreshHandler, isPortalChange, signalInfo } from '../../services/supabase-service.js';
import { listDummies, loadDummyMoves, saveDummy, deleteDummy, isDummyMigrationPending } from '../../services/project-map-dummy-service.js';
import { REVENUE_PER_HOUR, DEFAULT_HOLIDAYS } from '../../config/scheduler-config.js';   // the Plant Scheduler's $ per labor hour + its holiday seed
import { loadScheduleSettings, loadSettingRows, setSettingRow } from '../../services/schedule-service.js';    // its monthly revenue target (read only) + the shared Warnings levels
import { MAP_DEPARTMENTS, ALWAYS_SHOWN, SHIPPING_DEPARTMENTS, SHIPPED_STATUSES, SHIPPED_WINDOW_DAYS } from '../../config/project-map-config.js';
import { DEPARTMENT_COLORS, normalizeDepartmentClass } from '../../config/department-config.js';
import { parseDate, getLocalDateString, getMonday, getWeekMonth } from '../../utils/date-utils.js';
import { escapeHtml } from '../../utils/security-utils.js';
import { logger } from '../../utils/logger.js';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DEPTS_KEY = 'projectMapDepartments';
const SUNDAY_KEY = 'projectMapSundays';
const WHO_KEY = 'projectMapDummyBy';
const HOURS_LOOKBACK_DAYS = 56;
// Warning levels (2026-10-29): adjustable from the header's Warnings pop-up and saved for everyone in
// plant_schedule_settings under 'map_warnings'; these are only the defaults (user, 2026-10-27: 300 / 350 / 2).
const WARN_KEY = 'map_warnings';
const WARN_DEFAULTS = Object.freeze({ sqftWarn: 300, sqftOver: 350, castLimit: 2 });   // sq ft: green under sqftWarn, orange to sqftOver, red from there; Cast: more than castLimit castings on one day = POTENTIAL RISK

const S = {
    rawTasks: [],            // the weekly as fetched (never changed by a dummy)
    castings: new Map(),     // key -> summary (with the dummy's moves applied when one is open)
    projects: new Map(),     // project_number -> { project_name, status, pm }
    view: 'day',             // 'day' | 'week' | 'month4' | 'month' | 'calendar' (dummy mode: the month as a day-by-day calendar)
    anchor: null,            // 'YYYY-MM-DD'
    depts: null,             // Set of departments to show (null = all)
    sundays: false,          // Week view: show a Sunday band too
    search: '',
    loading: false,
    expandedKey: null,       // `${key}@${column}@${sectionIndex}`
    modal: null,             // { kind: 'column'|'shipped'|'dummies', column?, section?, filter, expandedKey }
    dummy: null,             // { id, name, final, chain, moves: Map, dirty, undo: [] } while in Dummy mode
    hoursMax: { day: new Map(), week: new Map() },   // busiest real day / week per department in the look-back window
    dragging: null,          // { key, dept, first } while a card is being dragged (dummy mode)
    revTarget: 400000,       // the scheduler's monthly revenue target (plant_schedule_settings 'target'), read when Dummy mode opens
    warn: { ...WARN_DEFAULTS },   // the Warnings levels in force (shared, re-read on every load)
    holidays: new Set(DEFAULT_HOLIDAYS),   // the scheduler's plant holidays (its Settings), read when Dummy mode opens
    picking: null,           // { key, dept, first } after "Move" was tapped on a card: the next tap on a cell drops it there
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
const isSunday = (iso) => parseIso(iso).getDay() === 0;
const fmtH = (h) => (Math.round(h * 10) / 10).toLocaleString('en-US');

// Dummy moves follow the Plant Scheduler's calendar rules (2026-10-29): a working day is Mon–Fri and not a plant
// holiday; days before today never move; a weekend is landed on only after an explicit confirm (the scheduler's
// weekend allow); a holiday is never landed on.
const isWeekend = (iso) => { const w = parseIso(iso).getDay(); return w === 0 || w === 6; };
const isOffDay = (iso) => isWeekend(iso) || S.holidays.has(iso);
/** Move a date by n working days, skipping weekends and holidays (the scheduler's nextWorking). */
function shiftWorking(iso, n) {
    let d = iso;
    const step = n > 0 ? 1 : -1;
    for (let left = Math.abs(n); left > 0; left--) {
        d = addDays(d, step);
        for (let guard = 0; guard < 30 && isOffDay(d); guard++) d = addDays(d, step);
    }
    return d;
}
/** Working days from a to b (negative when b is earlier). An off day b (a weekend the user confirmed) counts as one. */
function workingDaysBetween(a, b) {
    if (a === b) return 0;
    const step = b > a ? 1 : -1;
    let d = a, n = 0;
    while (d !== b) { d = addDays(d, step); if (!isOffDay(d) || d === b) n += step; }
    return n;
}
/** The scheduler's three refusals, asked before a dummy move lands: past day, holiday, weekend (confirm). */
function landingAllowed(iso) {
    if (iso < today()) { notice(`${fmtDate(iso)} has passed — the Plant Scheduler changes only today and later days, so the dummy does too.`, 'warn'); return false; }
    if (S.holidays.has(iso)) { notice(`${fmtDate(iso)} is a plant holiday — the Plant Scheduler never schedules holidays, so the dummy cannot land there.`, 'warn'); return false; }
    if (isWeekend(iso) && !window.confirm(`Land on ${weekdayOf(iso)} ${fmtShort(iso)}?\n\nThe Plant Scheduler works weekends only with an explicit allow per day. Applying this dummy would set that allow for this day.`)) return false;
    return true;
}
/** A cell a dummy card may be dropped on: a day cell that is today or later and not a holiday (week bands are checked on landing). */
const cellLandable = (cell) => !(cell.dataset.seckind === 'day' && (cell.dataset.secstart < today() || S.holidays.has(cell.dataset.secstart)));

// ---------------------------------------------------------------- the view: its range and its breaks ("sections")

function monthWeeks(year, month) {
    const out = [];
    let m = getMonday(new Date(year, month, 1));
    for (let i = 0; i < 7; i++) {
        const wm = getWeekMonth(m);
        const wy = m.getFullYear() + (wm < m.getMonth() ? 1 : 0);
        if (wm === month && (m.getFullYear() === year || wy === year)) out.push(getLocalDateString(m));
        else if (out.length) break;
        m = new Date(m.getFullYear(), m.getMonth(), m.getDate() + 7);
    }
    return out;
}

function viewSpec() {
    const a = S.anchor;
    if (S.view === 'day') {
        return { start: a, end: a, sections: [{ label: '', sub: '', start: a, end: a, kind: 'day' }], title: `${weekdayOf(a)} ${fmtDate(a)}${a === today() ? ' (today)' : ''}` };
    }
    if (S.view === 'week') {
        const mon = mondayOf(a);
        const days = S.sundays ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4, 5];
        const sections = days.map(i => { const d = addDays(mon, i); return { label: weekdayOf(d), sub: fmtShort(d), start: d, end: d, kind: 'day' }; });
        const last = addDays(mon, days[days.length - 1]);
        return { start: mon, end: last, sections, title: `Week of ${fmtShort(mon)} – ${fmtShort(last)}${mon === mondayOf(today()) ? ' (this week)' : ''}` };
    }
    if (S.view === 'month4') {
        const mon = mondayOf(a);
        const sections = [0, 1, 2, 3].map(i => { const s = addDays(mon, 7 * i); return { label: `Week ${7 * i + 1}–${7 * i + 7}`, sub: `${fmtShort(s)} – ${fmtShort(addDays(s, 5))}`, start: s, end: addDays(s, 6), kind: 'week' }; });
        return { start: mon, end: addDays(mon, 27), sections, title: `4 weeks: ${fmtShort(mon)} – ${fmtShort(addDays(mon, 26))}${mon === mondayOf(today()) ? ' (from this week)' : ''}` };
    }
    const d = parseIso(a);
    const wm = getWeekMonth(getMonday(d));
    let year = d.getFullYear();
    if (wm === 0 && d.getMonth() === 11) year += 1;
    if (wm === 11 && d.getMonth() === 0) year -= 1;
    const weeks = monthWeeks(year, wm);
    const thisMonth = weeks.includes(mondayOf(today()));
    const title = `${MONTHS[wm]} ${year}${thisMonth ? ' (this month)' : ''}`;
    const weekRows = weeks.map((s, i) => ({ label: `Week ${i + 1}`, sub: `${fmtShort(s)} – ${fmtShort(addDays(s, 5))}`, start: s, end: addDays(s, 6) }));
    if (S.view === 'calendar') {
        // the same weeks, but every day is its own break: a cell in the calendar grid (row = week, column = weekday)
        const dayIdx = S.sundays ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4, 5];
        const sections = [];
        weeks.forEach((s, w) => dayIdx.forEach((i, col) => { const dd = addDays(s, i); sections.push({ label: weekdayOf(dd), sub: fmtShort(dd), start: dd, end: dd, kind: 'day', week: w, col }); }));
        return { start: weeks[0], end: addDays(weeks[weeks.length - 1], 6), sections, title, month: wm, year, calendar: true, weekRows, dayNames: dayIdx.map(i => WEEKDAY[(i + 1) % 7]) };
    }
    const sections = weekRows.map(w => ({ ...w, kind: 'week' }));
    return { start: weeks[0], end: addDays(weeks[weeks.length - 1], 6), sections, title, month: wm, year };
}

// ---------------------------------------------------------------- data

const moveKey = (pn, cn, dept, orig) => `${pn}|${cn}|${dept}|${orig}`;
/** Where a weekly day sits now: the dummy's new date, or the real one. */
function effectiveDate(pn, cn, dept, orig) {
    return (S.dummy && S.dummy.moves.get(moveKey(pn, cn, dept, orig))) || orig;
}

/** One summary per casting from the raw weekly, with the open dummy's moves applied. Days carry their hours. */
function summarise(tasks) {
    const out = new Map();
    for (const t of tasks || []) {
        const pn = String(t.projectNumber || '').trim();
        const cn = String(t.castingNumber || '').trim();
        if (t.isSynthetic || !t.department) continue;
        const d = parseDate(t.date);
        if (!d) continue;
        const sheetName = String(t.project || '').trim();
        if (!pn && !cn && !sheetName) continue;
        // Rows with no job number / cast number (a sample typed straight into the Optimizer, a manual weekly card)
        // still belong on the map — they are on the weekly — grouped by their sheet name and flagged (2026-10-26).
        const missing = [!pn ? 'project #' : null, !cn ? 'cast #' : null].filter(Boolean);
        const key = missing.length ? `?|${sheetName.toLowerCase()}|${pn}|${cn}` : `${pn}|${cn}`;
        const orig = getLocalDateString(d);
        const iso = missing.length ? orig : effectiveDate(pn, cn, t.department, orig);   // rows without numbers cannot be moved in a dummy
        let c = out.get(key);
        if (!c) {
            c = { key, projectNumber: pn, castingNumber: cn, sheetName, missing, days: new Map(), orig: new Map(), hours: new Map(), inv: null, lastShip: null, lastDate: null, firstDate: null, moved: false };
            out.set(key, c);
        }
        if (t.invSummary && !c.inv) c.inv = t.invSummary;
        if (!c.days.has(t.department)) c.days.set(t.department, []);
        c.days.get(t.department).push(iso);
        c.orig.set(`${t.department}|${iso}`, orig);
        c.hours.set(`${t.department}|${iso}`, (c.hours.get(`${t.department}|${iso}`) || 0) + (parseFloat(t.hours) || 0));
        if (iso !== orig) c.moved = true;
        if (SHIPPING_DEPARTMENTS.includes(t.department) && (!c.lastShip || iso > c.lastShip)) c.lastShip = iso;
        if (!c.lastDate || iso > c.lastDate) c.lastDate = iso;
        if (!c.firstDate || iso < c.firstDate) c.firstDate = iso;
    }
    for (const c of out.values()) for (const list of c.days.values()) list.sort();
    return out;
}

/** The busiest real day and week per department over the look-back window (the "usual max" for the hours warning). */
function computeHoursMax(tasks) {
    const from = addDays(today(), -HOURS_LOOKBACK_DAYS);
    const byDay = new Map(), byWeek = new Map();
    for (const t of tasks || []) {
        if (t.isSynthetic || !t.department || deptRank(t.department) === -1) continue;
        const d = parseDate(t.date); if (!d) continue;
        const iso = getLocalDateString(d);
        if (iso < from || iso > today()) continue;
        const h = parseFloat(t.hours) || 0;
        const kd = `${t.department}|${iso}`, kw = `${t.department}|${mondayOf(iso)}`;
        byDay.set(kd, (byDay.get(kd) || 0) + h);
        byWeek.set(kw, (byWeek.get(kw) || 0) + h);
    }
    const maxOf = (m) => { const out = new Map(); for (const [k, v] of m) { const dept = k.split('|')[0]; if (v > (out.get(dept) || 0)) out.set(dept, v); } return out; };
    S.hoursMax = { day: maxOf(byDay), week: maxOf(byWeek) };
}

function projectOf(pn) { return pn ? (S.projects.get(pn) || null) : null; }
/** "Cast 3", or "Cast ?" when the row has no cast number. */
function castLabel(c) { return c.castingNumber ? `Cast ${c.castingNumber}` : 'Cast ?'; }
/** Red "Missing: project #, cast #" note for rows that lack their numbers ('' otherwise). */
function missingHtml(c) { return c.missing && c.missing.length ? `<span class="pm-missing" title="Add the ${c.missing.join(' and ')} to this row in the Optimizer so it can link to the portal">Missing: ${escapeHtml(c.missing.join(', '))}</span>` : ''; }
function jobName(c) {
    const p = projectOf(c.projectNumber);
    if (p && p.project_name) return p.project_name;
    return (c.sheetName || c.projectNumber).replace(/\s*[-–]?\s*cast\s*#?\s*[\w.]+\s*$/i, '').trim() || c.sheetName || c.projectNumber;
}
function shippedOn(c, before) {
    if (c.lastShip && c.lastShip < before) return c.lastShip;
    const p = projectOf(c.projectNumber);
    if (p && SHIPPED_STATUSES.includes(p.status)) return c.lastDate && c.lastDate < before ? c.lastDate : before;
    return null;
}
function matchesSearch(c, q = S.search) {
    return !q || `${jobName(c)} ${c.sheetName} ${c.projectNumber} cast ${c.castingNumber} ${(projectOf(c.projectNumber) || {}).pm || ''}`.toLowerCase().includes(q);
}
function anythingOn(iso) {
    for (const c of S.castings.values()) for (const [dept, list] of c.days) if (deptRank(dept) !== -1 && list.includes(iso)) return true;
    return false;
}

/** byCol = Map(dept -> sections[] of entries { c, dept, days, firstIdx, dayIndex, dayTotal, hours, moved }), shipped[], spec. */
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
            if (deptRank(dept) === -1) continue;
            spec.sections.forEach((sec, i) => {
                const inSec = list.filter(d => d >= sec.start && d <= sec.end);
                if (!inSec.length) return;
                const hours = inSec.reduce((a, d) => a + (c.hours.get(`${dept}|${d}`) || 0), 0);
                const moved = inSec.some(d => c.orig.get(`${dept}|${d}`) !== d);
                byCol.get(dept)[i].push({ c, dept, days: inSec, firstIdx: list.indexOf(inSec[0]) + 1, dayIndex: list.indexOf(inSec[inSec.length - 1]) + 1, dayTotal: list.length, hours, moved });
            });
        }
    }
    for (const sections of byCol.values()) for (const list of sections) list.sort((a, b) => byName(a.c, b.c));
    shipped.sort((a, b) => b.shippedOn.localeCompare(a.shippedOn) || byName(a.c, b.c));
    return { byCol, shipped, spec };
}

// ---------------------------------------------------------------- loads on a line: sq ft and the cast warning

/** Finished-face sq ft of the jobs on a line, rounded up (null when none of them has an inventory), and the busiest
 *  single day inside the line (a week band's colour follows that day, a day line's follows its own total). */
function sqftOf(list) {
    let t = 0, any = false;
    const perDay = new Map();
    for (const e of list) {
        const v = e.c.inv && e.c.inv.ff;
        if (v == null || isNaN(v)) continue;
        t += Number(v); any = true;
        for (const d of e.days) perDay.set(d, (perDay.get(d) || 0) + Number(v));
    }
    if (!any) return null;
    let busiest = null;
    for (const [date, n] of perDay) if (!busiest || n > busiest.n) busiest = { date, n: Math.ceil(n) };
    return { total: Math.ceil(t), busiest };
}
function sqftClass(n) { return n >= S.warn.sqftOver ? 'pm-sq-over' : n >= S.warn.sqftWarn ? 'pm-sq-warn' : 'pm-sq-ok'; }
function sqftTitle(sq) {
    const { sqftWarn, sqftOver } = S.warn;
    return sq.busiest.n !== sq.total
        ? `Busiest day ${fmtShort(sq.busiest.date)}: ${sq.busiest.n.toLocaleString('en-US')} sq ft (green under ${sqftWarn}, orange to ${sqftOver}, red from ${sqftOver})`
        : `Finished-face sq ft — green under ${sqftWarn}, orange ${sqftWarn}–${sqftOver}, red ${sqftOver} and over (Warnings in the header changes these)`;
}
/** True when a section is one clear day (the only lines that carry a sq ft load). */
const oneDay = (sec) => !!sec && sec.start === sec.end;
/** Fill a sq ft span in place (text, colour class, tooltip); empty when the line spans days or the jobs have no inventory. */
function fillSqft(el, list, base, single) {
    const sq = single ? sqftOf(list) : null;
    el.textContent = sq ? `${sq.total.toLocaleString('en-US')} sq ft` : '';
    el.className = `${base}${sq ? ' ' + sqftClass(sq.busiest.n) : ''}`;
    el.title = sq ? sqftTitle(sq) : '';
}
function sqftHtml(list, base, single) {
    const sq = single ? sqftOf(list) : null;
    return sq ? `<span class="${base} ${sqftClass(sq.busiest.n)}" title="${escapeHtml(sqftTitle(sq))}">${sq.total.toLocaleString('en-US')} sq ft</span>` : '';
}
/** Cast only: the busiest day inside a line has more castings than the limit → { n, date }, else null. */
function castOverload(col, list) {
    if (col !== 'Cast' || !list || list.length <= S.warn.castLimit) return null;
    const perDay = new Map();
    for (const e of list) for (const d of e.days) perDay.set(d, (perDay.get(d) || 0) + 1);
    let best = null;
    for (const [date, n] of perDay) if (!best || n > best.n) best = { n, date };
    return best && best.n > S.warn.castLimit ? best : null;
}
const overloadTitle = (ov) => `${ov.n} castings in Cast on ${fmtShort(ov.date)} — more than ${S.warn.castLimit} a day (Warnings in the header changes the limit)`;

// ---------------------------------------------------------------- Warnings pop-up (2026-10-29): the levels, saved for everyone
/** A saved value row -> levels (anything missing or unusable keeps the default). */
function warnFrom(v) {
    const w = { ...WARN_DEFAULTS };
    if (v && typeof v === 'object') for (const k of Object.keys(WARN_DEFAULTS)) { const n = Number(v[k]); if (Number.isFinite(n) && n > 0) w[k] = Math.round(n); }
    if (w.sqftOver < w.sqftWarn) w.sqftOver = w.sqftWarn;
    return w;
}
async function loadWarnings() {
    try { const rows = await loadSettingRows([WARN_KEY]); S.warn = warnFrom(rows.get(WARN_KEY)); }
    catch (err) { logger.warn('[project-map] warnings levels not read, defaults stand', err); }
    renderWarnForm();
}
function renderWarnForm() {
    const f = $('pm-warn-form');
    if (!f) return;
    f.elements.sqftWarn.value = S.warn.sqftWarn; f.elements.sqftOver.value = S.warn.sqftOver; f.elements.castLimit.value = S.warn.castLimit;
    const b = $('pm-warn-btn');
    if (b) b.title = `Warning levels: sq ft green under ${S.warn.sqftWarn}, orange to ${S.warn.sqftOver}, red from there; POTENTIAL RISK over ${S.warn.castLimit} castings in Cast a day. Saved for everyone.`;
}
async function saveWarnings(reset) {
    const f = $('pm-warn-form');
    const w = reset ? { ...WARN_DEFAULTS } : warnFrom({ sqftWarn: f.elements.sqftWarn.value, sqftOver: f.elements.sqftOver.value, castLimit: f.elements.castLimit.value });
    if (!reset && Number(f.elements.sqftOver.value) < Number(f.elements.sqftWarn.value)) { notice('Red must start at or above orange.', 'warn'); return; }
    try {
        await setSettingRow(WARN_KEY, reset ? null : w);
        S.warn = w;
        renderWarnForm(); renderMap();
        $('pm-warn-dropdown').classList.remove('open');
        notice(reset ? 'Warning levels back to the defaults (300 / 350 / 2), for everyone.' : `Warning levels saved for everyone: sq ft orange from ${w.sqftWarn}, red from ${w.sqftOver}; POTENTIAL RISK over ${w.castLimit} castings a day.`);
        setTimeout(() => { if ($('fm-notice').textContent.startsWith('Warning levels')) notice(''); }, 6000);
    } catch (err) {
        notice('Could not save the warning levels: ' + (err && err.message ? err.message : err), 'error');
    }
}
/** Fill a count span in place: red with the words POTENTIAL RISK before it when Cast is over the day limit.
 *  The span lives inside .pm-head-tail, so the pill and the count wrap onto a second line together (2026-10-28). */
function fillCount(el, col, list, warn = true) {
    const ov = warn ? castOverload(col, list) : null;
    el.textContent = list.length ? String(list.length) : '';
    el.classList.toggle('pm-cast-over', !!ov);
    el.title = ov ? overloadTitle(ov) : '';
    let risk = el.parentElement.querySelector('.pm-cast-risk');
    if (ov && !risk) { risk = document.createElement('span'); risk.className = 'pm-cast-risk'; risk.textContent = 'potential risk'; el.before(risk); }
    else if (!ov && risk) risk.remove();
}
function riskHtml(col, list) {
    const ov = castOverload(col, list);
    return ov ? `<span class="pm-cast-risk">potential risk</span><span class="pm-section-n pm-cast-over" title="${escapeHtml(overloadTitle(ov))}">${list.length}</span>` : '';
}

/** Count span for a calendar / pop-up head: the red count with POTENTIAL RISK when Cast is over the day limit. */
function countHtml(col, list) {
    return riskHtml(col, list) || `<span class="pm-section-n">${list.length ? list.length : ''}</span>`;
}

/** Columns to draw. In Day view a ticked department with nothing scheduled that day is hidden too (and listed in a notice). */
function shownDepartments(byCol) {
    const ticked = MAP_DEPARTMENTS.filter(d => (!S.depts || S.depts.has(d)) && (ALWAYS_SHOWN.has(d) || byCol.get(d).some(l => l.length)));
    if (S.view !== 'day') return { shown: ticked, hiddenEmpty: [] };
    const shown = ticked.filter(d => byCol.get(d).some(l => l.length));
    return { shown, hiddenEmpty: ticked.filter(d => !shown.includes(d)) };
}

// ---------------------------------------------------------------- dummy mode: moves

function dummyMoveBlock(key, dept, toFirstDate) {
    const c = S.castings.get(key);
    if (!c || !S.dummy) return;
    if (c.missing && c.missing.length) { notice('That row has no job / cast number on the weekly, so a dummy cannot move it. Add the numbers in the Optimizer first.', 'warn'); return; }
    const cur = c.days.get(dept);
    if (!cur || !cur.length) return;
    const tod = today();
    const movable = cur.filter(iso => iso >= tod);                 // days that already happened stay where they are (scheduler rule)
    if (!movable.length) { notice('Every day of that block has already happened — the Plant Scheduler changes only today and later days, so the dummy does too.', 'warn'); return; }
    if (!landingAllowed(toFirstDate)) return;
    const n = workingDaysBetween(movable[0], toFirstDate);
    if (!n) return;
    const blockStart = cur[0];
    const depts = [...c.days.keys()].filter(d => deptRank(d) !== -1 && (d === dept || (S.dummy.chain && deptRank(d) > deptRank(dept))));
    const plan = [];
    for (const d of depts) {
        for (const iso of c.days.get(d)) {
            if (d !== dept && iso < blockStart) continue;          // a later department's prep day that sits before the block stays put
            if (iso < tod) continue;                               // past days never move
            const orig = c.orig.get(`${d}|${iso}`) || iso;
            const next = d === dept && iso === movable[0] ? toFirstDate : shiftWorking(iso, n);
            if (next < tod) { notice('That move would push tasks into days that have passed — the Plant Scheduler refuses that, so the dummy does too.', 'warn'); return; }
            plan.push([moveKey(c.projectNumber, c.castingNumber, d, orig), orig, next]);
        }
    }
    S.dummy.undo.push(new Map(S.dummy.moves));
    if (S.dummy.undo.length > 50) S.dummy.undo.shift();
    for (const [k, orig, next] of plan) { if (next === orig) S.dummy.moves.delete(k); else S.dummy.moves.set(k, next); }
    const kept = cur.length - movable.length;
    if (kept) notice(`${kept} day${kept === 1 ? '' : 's'} of that block already happened and stayed put.`, 'info');
    S.dummy.dirty = true;
    S.castings = summarise(S.rawTasks);
    renderMap();
}

/** Touch-friendly move: remember the card, light up the cells it can land on; the next tap on one drops it there. */
function startPick(key, dept) {
    const c = S.castings.get(key);
    if (!S.dummy || !c || !c.days.get(dept)) return;
    S.picking = { key, dept, first: c.days.get(dept)[0] };
    S.expandedKey = null;
    renderMap();
}
function cancelPick() {
    if (!S.picking) return;
    S.picking = null;
    renderPickState();
}
/** Highlights for a picked-up card (also re-applied after every render) and the note in the dummy bar. */
function renderPickState() {
    const p = S.picking;
    document.body.classList.toggle('pm-picking', !!p);
    for (const el of document.querySelectorAll('.pm-cell.pm-pick-ok')) el.classList.remove('pm-pick-ok');
    if (p) for (const cell of document.querySelectorAll(`.pm-cell[data-cellcol="${CSS.escape(p.dept)}"], .pm-cell[data-cellcol="*"]`)) if (cellLandable(cell)) cell.classList.add('pm-pick-ok');
    const note = $('pm-pick-note');
    if (!note) return;
    note.hidden = !p;
    if (p) { const c = S.castings.get(p.key); $('pm-pick-what').textContent = c ? `${jobName(c)} ${castLabel(c)} · ${p.dept}` : ''; }
}

function dummyUndo() {
    if (!S.dummy || !S.dummy.undo.length) return;
    S.dummy.moves = S.dummy.undo.pop();
    S.dummy.dirty = true;
    S.castings = summarise(S.rawTasks);
    renderMap();
}

function dummyClear() {
    if (!S.dummy || !S.dummy.moves.size) return;
    if (!window.confirm('Put every card back where the weekly has it? (The saved copy is not touched until you save.)')) return;
    S.dummy.undo.push(new Map(S.dummy.moves));
    S.dummy.moves = new Map();
    S.dummy.dirty = true;
    S.castings = summarise(S.rawTasks);
    renderMap();
}

async function enterDummy() {
    if (S.dummy) return;
    if (!window.confirm('Dummy mode is for the DOP.\n\nUnless the DOP has asked you to work in it, press Cancel.\n\nNothing real changes in Dummy mode: moves are saved as a named dummy only.')) return;
    S.dummy = { id: null, name: '', final: false, chain: true, moves: new Map(), dirty: false, undo: [] };
    loadScheduleSettings().then(saved => {
        if (Number(saved.target) > 0) S.revTarget = Number(saved.target);
        if (Array.isArray(saved.holidays) && saved.holidays.length) S.holidays = new Set(saved.holidays);   // the scheduler's Settings list
        renderDummyBar(); renderMap();
    }).catch(() => { /* the defaults stand */ });
    if (S.view === 'day') S.view = 'calendar';
    S.expandedKey = null;
    renderMap();
    try { await listDummies(); } catch { /* the note in the bar covers a missing table */ }
    const noSave = $('pm-dummy-nosave');
    if (noSave) noSave.hidden = !isDummyMigrationPending();   // a short note in the bar, not a band of its own (2026-10-29)
}

function exitDummy() {
    if (!S.dummy) return;
    if (S.dummy.dirty && !window.confirm('Leave Dummy mode without saving? The unsaved moves are lost.')) return;
    S.dummy = null;
    S.expandedKey = null;
    S.picking = null;
    if (S.view === 'calendar') S.view = 'month';
    S.castings = summarise(S.rawTasks);
    notice('');
    renderMap();
}

async function dummySave(saveAs = false) {
    if (!S.dummy) return;
    let name = S.dummy.name;
    if (!name || saveAs) {
        name = window.prompt('Name for this dummy:', name || `Dummy ${fmtShort(today())}`);
        if (!name || !name.trim()) return;
    }
    try {
        const id = await saveDummy({ id: saveAs ? null : S.dummy.id, name, final: S.dummy.final, chain: S.dummy.chain, createdBy: who() }, S.dummy.moves);
        S.dummy.id = id; S.dummy.name = name.trim(); S.dummy.dirty = false;
        notice(`Saved "${S.dummy.name}" (${S.dummy.moves.size} moved days).`, 'info');
        setTimeout(() => { if ($('fm-notice').textContent.startsWith('Saved "')) notice(''); }, 4000);
        renderMap();
    } catch (err) {
        logger.error('[dummy] save failed', err);
        notice('Not saved: ' + (err.message || err), 'error');
    }
}

async function dummyOpen(id) {
    try {
        const list = await listDummies();
        const d = list.find(x => x.id === id);
        if (!d) return;
        const moves = await loadDummyMoves(id);
        S.dummy = { id: d.id, name: d.name, final: !!d.final, chain: d.chain !== false, moves, dirty: false, undo: [] };
        if (S.view === 'day') S.view = 'week';
        S.expandedKey = null;
        S.castings = summarise(S.rawTasks);
        closeModal();
        notice('');
        renderMap();
    } catch (err) {
        logger.error('[dummy] open failed', err);
        notice('Could not open: ' + (err.message || err), 'error');
    }
}

async function dummyRename() {
    if (!S.dummy) return;
    const name = window.prompt('New name:', S.dummy.name);
    if (!name || !name.trim()) return;
    S.dummy.name = name.trim();
    if (S.dummy.id) { try { await saveDummy({ id: S.dummy.id, name: S.dummy.name, final: S.dummy.final, chain: S.dummy.chain }, S.dummy.moves); } catch (err) { notice('Not renamed: ' + (err.message || err), 'error'); } }
    renderMap();
}

async function dummyDelete(id, name) {
    if (!window.confirm(`Delete the dummy "${name}"? This cannot be undone.`)) return;
    try {
        await deleteDummy(id);
        if (S.dummy && S.dummy.id === id) { S.dummy.id = null; S.dummy.dirty = true; }
        if (S.modal && S.modal.kind === 'dummies') renderModalBody();
        renderMap();
    } catch (err) { notice('Not deleted: ' + (err.message || err), 'error'); }
}

async function dummyToggleFinal() {
    if (!S.dummy) return;
    S.dummy.final = !S.dummy.final;
    if (S.dummy.id) { try { await saveDummy({ id: S.dummy.id, name: S.dummy.name, final: S.dummy.final, chain: S.dummy.chain }, S.dummy.moves); } catch (err) { notice('Not saved: ' + (err.message || err), 'error'); } }
    else S.dummy.dirty = true;
    renderMap();
}

const who = () => { try { return (localStorage.getItem(WHO_KEY) || '').trim(); } catch { return ''; } };

// ---------------------------------------------------------------- cards

function entryLine(e) {
    const span = e.firstIdx === e.dayIndex ? `day ${e.dayIndex}` : `days ${e.firstIdx}–${e.dayIndex}`;
    if (S.view === 'day' || S.view === 'calendar') return `${span} of ${e.dayTotal}`;
    return `${e.days.map(weekdayOf).join(' ')} · ${span} of ${e.dayTotal}`;
}

function cardBodyHtml(c, e) {
    const p = projectOf(c.projectNumber);
    const fmtN = (v) => (v == null || isNaN(v)) ? null : Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
    const inv = c.inv ? [`${c.inv.types} types`, `${c.inv.pcs} pcs`, fmtN(c.inv.cuFt) != null ? `${fmtN(c.inv.cuFt)} cu ft${c.inv.cuFtComplete === false ? ' (partial)' : ''}` : null, fmtN(c.inv.ff) != null ? `${fmtN(c.inv.ff)} ff sq ft${c.inv.ffComplete === false ? ' (partial)' : ''}` : null].filter(Boolean).join(' · ') : '';
    const trail = [...c.days.entries()].filter(([d]) => deptRank(d) !== -1).sort((a, b) => deptRank(a[0]) - deptRank(b[0]))
        .map(([d, list]) => {
            const movedHere = list.some(iso => c.orig.get(`${d}|${iso}`) !== iso);
            const text = escapeHtml(`${d} ${fmtShort(list[0])}${list.length > 1 ? `–${fmtShort(list[list.length - 1])}` : ''}`) + (movedHere ? ' <span class="pm-moved-tag">moved</span>' : '');
            return e && e.dept === d ? `<b class="pm-trail-here">${text}</b>` : text;
        }).join(' · ');
    const origLine = e && e.moved ? `<div class="fm-card-meta pm-orig">Weekly has it: ${escapeHtml(e.days.map(d => fmtShort(c.orig.get(`${e.dept}|${d}`) || d)).join(', '))}</div>` : '';
    const blockMovable = S.dummy && e && (c.days.get(e.dept) || []).some(iso => iso >= today());
    const moveBox = S.dummy && e && !(c.missing && c.missing.length)
        ? (blockMovable
            ? `<div class="pm-movebox"><button type="button" class="fm-mini-btn fm-bulk-go pm-pickup" data-pickup="${escapeHtml(c.key)}::${escapeHtml(e.dept)}" title="Then tap the day it should start on">Move ${escapeHtml(e.dept)} block&hellip;</button><label>or to <input type="date" data-move-date="${escapeHtml(c.key)}::${escapeHtml(e.dept)}" value="${escapeHtml(c.days.get(e.dept)[0])}" min="${today()}"></label></div>`
            : `<div class="pm-movebox pm-movebox-past" title="The Plant Scheduler changes only today and later days">&#128274; ${escapeHtml(e.dept)} already happened — cannot move</div>`)
        : '';
    return `<div class="fm-card-job">${escapeHtml(jobName(c))}</div>
        <div class="fm-card-cast">${escapeHtml(castLabel(c))}<span class="fm-card-pn">${escapeHtml(c.projectNumber)}</span>${missingHtml(c)}</div>
        ${p && p.pm ? `<div class="fm-card-meta">${escapeHtml(p.pm)}</div>` : ''}
        ${inv ? `<div class="fm-card-meta">${escapeHtml(inv)}</div>` : ''}
        ${e ? `<div class="fm-card-meta fm-card-finish">${escapeHtml(e.dept)}: ${escapeHtml(entryLine(e))}${e.hours ? ` · ${fmtH(e.hours)} h` : ''}</div>` : ''}
        ${origLine}
        ${c.lastShip ? `<div class="fm-card-meta">Ship ${fmtDate(c.lastShip)}</div>` : ''}
        ${trail ? `<div class="fm-card-meta pm-trail">${trail}</div>` : ''}
        ${moveBox}`;
}

/** Dummy mode: "452 sq ft · 38 cu ft" on the collapsed card, so a move can be judged without opening it (2026-10-29). */
function chipInvLine(c) {
    if (!S.dummy || !c.inv) return '';
    const n = (v) => (v == null || isNaN(v)) ? null : Math.round(Number(v)).toLocaleString('en-US');
    const parts = [n(c.inv.ff) != null ? `${n(c.inv.ff)} sq ft${c.inv.ffComplete === false ? '*' : ''}` : null,
                   n(c.inv.cuFt) != null ? `${n(c.inv.cuFt)} cu ft${c.inv.cuFtComplete === false ? '*' : ''}` : null].filter(Boolean);
    if (!parts.length) return '';
    const partial = c.inv.ffComplete === false || c.inv.cuFtComplete === false;
    return `<span class="pm-chip-inv" title="Finished-face sq ft · cu ft from the Casting Inventory${partial ? ' (* = some types have no figure yet)' : ''}">${escapeHtml(parts.join(' · '))}</span>`;
}
function chipHtml(e, col, sec) {
    const c = e.c;
    const pcs = c.inv && c.inv.pcs != null ? `${c.inv.pcs} pcs` : '';
    const id = `${c.key}@${col}@${sec}`;
    const cls = ['fm-chip', S.expandedKey === id ? 'fm-chip-open' : '', matchesSearch(c) ? '' : 'fm-card-dim', e.moved ? 'pm-chip-moved' : ''].filter(Boolean).join(' ');
    const movable = S.dummy && (c.days.get(col) || []).some(iso => iso >= today());
    return `<div class="${cls}" data-key="${escapeHtml(id)}" data-cast="${escapeHtml(c.key)}" data-dept="${escapeHtml(col)}"${movable && !(c.missing && c.missing.length) ? ' draggable="true"' : ''} title="${escapeHtml(c.sheetName || jobName(c))}${e.moved ? ' — moved in this dummy' : ''}">
        <span class="fm-chip-job">${escapeHtml(jobName(c))}</span>
        <span class="fm-chip-line"><b>${escapeHtml(castLabel(c))}</b><span>${escapeHtml(c.projectNumber)}</span><span>${escapeHtml(pcs)}</span></span>
        ${missingHtml(c)}
        ${chipInvLine(c)}
        <span class="pm-chip-day">${escapeHtml(entryLine(e))}${S.dummy && e.hours ? ` · ${fmtH(e.hours)} h` : ''}</span>
    </div>`;
}

function rowHtml(e, extra = '') {
    const c = e.c;
    const open = S.modal && S.modal.expandedKey === c.key;
    const pcs = c.inv && c.inv.pcs != null ? `${c.inv.pcs} pcs` : '';
    return `<div class="fm-mrow${open ? ' fm-mrow-open' : ''}${e.moved ? ' pm-chip-moved' : ''}" data-mrow="${escapeHtml(c.key)}">
        <div class="fm-mrow-text" data-expand="${escapeHtml(c.key)}" title="${open ? 'Click to close' : 'Click for the full card'}">
            ${open ? cardBodyHtml(c, e.dept ? e : null) : `<div class="fm-card-job">${escapeHtml(jobName(c))} <b>${escapeHtml(castLabel(c))}</b> <span class="fm-card-pn">${escapeHtml(c.projectNumber)}</span> ${missingHtml(c)} <span class="fm-card-meta">${escapeHtml([pcs, e.dept ? entryLine(e) : ''].filter(Boolean).join(' · '))}${extra}</span></div>`}
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
    for (const b of document.querySelectorAll('.pm-view-btn[data-view]')) b.classList.toggle('pm-view-on', b.dataset.view === S.view);
    const sun = $('pm-sunday');
    if (sun) { sun.hidden = S.view !== 'week' && S.view !== 'calendar'; sun.classList.toggle('pm-view-on', S.sundays); sun.setAttribute('aria-pressed', String(S.sundays)); }
    const calBtn = document.querySelector('.pm-view-btn[data-view="calendar"]');
    if (calBtn) calBtn.hidden = !S.dummy;   // the whiteboard calendar belongs to Dummy mode
    const dayBtn = document.querySelector('.pm-view-btn[data-view="day"]');
    if (dayBtn) { dayBtn.disabled = !!S.dummy; dayBtn.title = S.dummy ? 'Day view has no other day to drag to — use Week, 4 weeks or Month' : ''; }
}

// ---------------------------------------------------------------- revenue (dummy mode, 2026-10-29): hours × $135 like the scheduler
/** The scheduler's cut: a week belongs to the month its WEDNESDAY falls in. */
const revMonthOf = (monday) => addDays(monday, 2).slice(0, 7);
const money0 = (n) => (n < 0 ? '−' : '') + '$' + Math.round(Math.abs(n)).toLocaleString('en-US');
const money2 = (n) => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthName = (ym) => { const [y, m] = ym.split('-').map(Number); return `${MONTHS[m - 1].slice(0, 3)} ${y}`; };
/** Hours of every casting by week (Monday), as the dummy has them and as the live weekly has them: { fab, ship } each. */
function revByWeek() {
    const weeks = new Map();
    const add = (monday, side, dept, h) => {
        let w = weeks.get(monday);
        if (!w) { w = { d: { fab: 0, ship: 0 }, l: { fab: 0, ship: 0 } }; weeks.set(monday, w); }
        w[side][dept === 'Ship' ? 'ship' : 'fab'] += h;
    };
    for (const c of S.castings.values()) {
        for (const [k, h] of c.hours) {
            if (!h) continue;
            const bar = k.indexOf('|'); const dept = k.slice(0, bar), iso = k.slice(bar + 1);
            add(mondayOf(iso), 'd', dept, h);
            add(mondayOf(c.orig.get(k) || iso), 'l', dept, h);
        }
    }
    return weeks;
}
const netOf = (t) => (t.fab + t.ship) * REVENUE_PER_HOUR;
/** Per-month totals (Wednesday rule) from the per-week map. */
function revByMonth(weeks) {
    const months = new Map();
    for (const [monday, w] of weeks) {
        const ym = revMonthOf(monday);
        let m = months.get(ym);
        if (!m) { m = { d: { fab: 0, ship: 0 }, l: { fab: 0, ship: 0 } }; months.set(ym, m); }
        for (const side of ['d', 'l']) { m[side].fab += w[side].fab; m[side].ship += w[side].ship; }
    }
    return months;
}
function deltaHtml(d) {
    if (Math.abs(d) < 0.5) return '';
    return ` <span class="${d > 0 ? 'pm-rev-up' : 'pm-rev-down'}" title="against the live weekly">${d > 0 ? '+' : '−'}${money0(Math.abs(d))}</span>`;
}
function revTitle(label, t, live) {
    return `${label}\nDummy: Fabrication ${money2(t.fab * REVENUE_PER_HOUR)} + Ship ${money2(t.ship * REVENUE_PER_HOUR)} = Net ${money2(netOf(t))} (${fmtH(t.fab + t.ship)} h)\nLive weekly: Net ${money2(netOf(live))} (${fmtH(live.fab + live.ship)} h)`;
}
/** The strip under the dummy's buttons: Net revenue per week in view, the months the view touches (and any month a move
 *  reached) against the scheduler's target, and where the moves shifted money. Live = the weekly as it is now. */
function renderRevenueStrip() {
    const el = $('pm-dummy-rev');
    if (!el) return;
    if (!S.dummy) { el.innerHTML = ''; return; }
    const spec = viewSpec();
    const weeks = revByWeek(), months = revByMonth(weeks);
    const empty = { fab: 0, ship: 0 };
    const parts = [];
    for (let m = mondayOf(spec.start); m <= spec.end; m = addDays(m, 7)) {
        const w = weeks.get(m) || { d: empty, l: empty };
        parts.push(`<span class="pm-rev-wk" title="${escapeHtml(revTitle(`Week of ${fmtShort(m)} – ${fmtShort(addDays(m, 5))}`, w.d, w.l))}">Wk ${fmtShort(m)} <b>${money0(netOf(w.d))}</b>${deltaHtml(netOf(w.d) - netOf(w.l))}</span>`);
    }
    const inView = new Set();
    for (let m = mondayOf(spec.start); m <= spec.end; m = addDays(m, 7)) inView.add(revMonthOf(m));
    const shown = [...months.keys()].filter(ym => inView.has(ym) || Math.abs(netOf(months.get(ym).d) - netOf(months.get(ym).l)) >= 0.5).sort();
    const target = S.revTarget || 400000;
    const out = [], into = [];
    for (const ym of shown) {
        const t = months.get(ym);
        const net = netOf(t.d), live = netOf(t.l), pct = Math.round(net / target * 100);
        parts.push(`<span class="pm-rev-month${inView.has(ym) ? '' : ' pm-rev-away'}" title="${escapeHtml(revTitle(`${monthName(ym)} — every week whose Wednesday is in it`, t.d, t.l))}\nTarget ${money0(target)} (the scheduler's setting)">${monthName(ym)} <b>${money0(net)}</b>${deltaHtml(net - live)} <span class="${pct >= 100 ? 'pm-rev-pct-ok' : 'pm-rev-pct-low'}" title="Net ÷ target">${pct}% of target</span>${inView.has(ym) ? '' : ' <i>(not in view)</i>'}</span>`);
        const d = net - live;
        if (d <= -0.5) out.push(`${monthName(ym)} ${money0(d)}`); else if (d >= 0.5) into.push(`${monthName(ym)} +${money0(d)}`);
    }
    if (out.length || into.length) parts.push(`<span class="pm-rev-note">Moves shifted: ${escapeHtml([...out, ...into].join(' · '))}</span>`);
    el.innerHTML = `<span class="pm-rev-label" title="Revenue = scheduled hours × $${REVENUE_PER_HOUR}, the Plant Scheduler's rule. Net = every department incl. Ship.">REVENUE</span>` + parts.join('');
}

function renderDummyBar() {
    const bar = $('pm-dummy-bar');
    const btn = $('pm-dummy-btn');
    if (!bar) return;
    document.body.classList.toggle('pm-dummy', !!S.dummy);
    if (btn) btn.classList.toggle('pm-view-on', !!S.dummy);
    if (!S.dummy) { bar.hidden = true; return; }
    bar.hidden = false;
    const d = S.dummy;
    $('pm-dummy-name').textContent = d.name ? d.name : 'unsaved dummy';
    $('pm-dummy-state').textContent = `${d.moves.size} moved ${d.moves.size === 1 ? 'day' : 'days'}${d.dirty ? ' · unsaved changes' : ''}${d.final ? ' · FINAL' : ''}`;
    $('pm-dummy-chain').checked = d.chain;
    $('pm-dummy-undo').disabled = !d.undo.length;
    $('pm-dummy-final').textContent = d.final ? 'Unmark final' : 'Mark final';
    renderRevenueStrip();
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
    renderDummyBar();
    if (!shown.length) { map.dataset.layout = ''; map.classList.remove('pm-calendar'); map.style.gridTemplateColumns = ''; map.innerHTML = `<div class="fm-empty pm-none">Nothing scheduled ${S.view === 'day' ? 'that day' : 'in this view'} for the departments you have ticked.</div>`; $('pm-sub').textContent = '0 on the floor'; renderWhen(spec); renderDeptPicker(); renderPopover(); if (S.modal) renderModalBody(); return; }
    if (spec.calendar) { renderCalendar(byCol, shipped, spec, shown); return; }
    const layoutKey = `${S.view}|${spec.start}|${spec.sections.length}|${shown.join('|')}|${S.dummy ? 'd' : 'r'}`;
    if (map.dataset.layout !== layoutKey) {
        map.dataset.layout = layoutKey;
        map.classList.remove('pm-calendar');
        map.style.gridTemplateColumns = '';
        map.style.setProperty('--pm-cols', String(shown.length));
        const last = spec.sections.length - 1;
        map.innerHTML = shown.map((col, k) => `<div class="pm-col" data-col="${escapeHtml(col)}" style="${colStyle(col)}">
            <button type="button" class="fm-area-head pm-cell-head" style="grid-column:${k + 1};grid-row:1" data-open-col="${escapeHtml(col)}" title="See every job in ${escapeHtml(col)}">
                <span class="fm-area-label">${escapeHtml(col)}</span>
                <span class="fm-area-more" data-more="${escapeHtml(col)}"></span>
                <span class="pm-head-sq" data-colsq="${escapeHtml(col)}"></span>
                <span class="pm-head-tail"><span class="fm-area-count" data-count="${escapeHtml(col)}">0</span></span>
            </button>${spec.sections.map((sec, i) => `
            <div class="pm-cell${i === last ? ' pm-cell-last' : ''}${S.dummy && sec.kind === 'day' && sec.start < today() ? ' pm-past' : ''}${S.dummy && sec.kind === 'day' && S.holidays.has(sec.start) ? ' pm-holiday' : ''}" style="grid-column:${k + 1};grid-row:${i + 2}" data-cellcol="${escapeHtml(col)}" data-sec="${i}" data-secstart="${escapeHtml(sec.start)}" data-seckind="${escapeHtml(sec.kind)}">
                ${sec.label ? `<div class="pm-section-head" data-open-band="${escapeHtml(col)}|${i}" title="See every ${escapeHtml(col)} job in ${escapeHtml(sec.label)}"><span>${escapeHtml(sec.label)}</span><span class="pm-section-sub">${escapeHtml(sec.sub)}</span><span class="pm-section-h" data-sech="${escapeHtml(col)}|${i}"></span><span class="pm-section-h pm-section-sq" data-secsq="${escapeHtml(col)}|${i}"></span><span class="pm-head-tail"><span class="pm-section-n" data-secn="${escapeHtml(col)}|${i}"></span></span></div>` : `<div class="pm-section-head pm-section-head-day"><span class="pm-section-h" data-sech="${escapeHtml(col)}|${i}"></span><span class="pm-section-h pm-section-sq" data-secsq="${escapeHtml(col)}|${i}"></span></div>`}
                <div class="fm-cards" data-cards="${escapeHtml(col)}|${i}"></div>
            </div>`).join('')}
        </div>`).join('');
    }
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
            if (n) fillCount(n, col, list);
            const sqEl = map.querySelector(`[data-secsq="${CSS.escape(col + '|' + i)}"]`);
            if (sqEl) fillSqft(sqEl, list, 'pm-section-h pm-section-sq', oneDay(spec.sections[i]));
            const hEl = map.querySelector(`[data-sech="${CSS.escape(col + '|' + i)}"]`);
            const cell = hEl && hEl.closest('.pm-cell');
            if (hEl) {
                const hours = list.reduce((a, e) => a + e.hours, 0);
                const kind = spec.sections[i].kind;
                const usual = S.hoursMax[kind].get(col) || 0;
                const over = S.dummy && usual > 0 && hours > usual + 0.01;
                hEl.textContent = S.dummy && hours ? `${fmtH(hours)} h` : '';
                hEl.title = S.dummy && usual ? `Busiest real ${kind} for ${col} in the last 8 weeks: ${fmtH(usual)} h` : '';
                hEl.classList.toggle('pm-over', !!over);
                if (cell) cell.classList.toggle('pm-cell-over', !!over);
            }
        });
        onFloor += total;
        const all = sections.flat();
        const n = map.querySelector(`[data-count="${CSS.escape(col)}"]`);
        if (n) { fillCount(n, col, all, S.view === 'day'); n.textContent = String(total); }
        const sq = map.querySelector(`[data-colsq="${CSS.escape(col)}"]`);
        if (sq) fillSqft(sq, all, 'pm-head-sq', S.view === 'day');
    }
    $('fm-shipped-count').textContent = String(shipped.length);
    const unit = { day: 'that day', week: 'that week', month4: 'in those 4 weeks', month: 'that month', calendar: 'that month' }[S.view];
    $('pm-sub').textContent = `${onFloor} on the floor ${unit}`;
    renderWhen(spec);
    renderDeptPicker();
    markOverflow();
    renderPopover();
    renderPickState();
    if (S.modal) renderModalBody();
}

/** Dummy mode's whiteboard: rows = the month's weeks (Week 1, 2, 3…), columns = weekdays, a cell per day with that
 *  day's jobs grouped by department. Every day cell is a drop target (data-cellcol="*"): the dragged card's department
 *  block lands on that date. */
function renderCalendar(byCol, shipped, spec, shown) {
    const map = $('pm-map');
    map.dataset.layout = `calendar|${spec.start}|${spec.sections.length}`;
    map.classList.add('pm-calendar');
    map.classList.remove('pm-banded');
    map.style.gridTemplateColumns = `5.4rem repeat(${spec.dayNames.length}, minmax(0, 1fr))`;
    map.style.gridTemplateRows = 'auto ' + spec.weekRows.map(() => 'minmax(0, 1fr)').join(' ');
    const tod = today();
    let onFloor = 0;
    const parts = ['<div class="pm-cal-corner" style="grid-column:1;grid-row:1"></div>'];
    spec.dayNames.forEach((n, j) => parts.push(`<div class="pm-cal-dow${n === 'Sun' ? ' pm-cal-sun' : ''}" style="grid-column:${j + 2};grid-row:1">${n}</div>`));
    spec.weekRows.forEach((w, r) => parts.push(`<div class="pm-cal-week" style="grid-column:1;grid-row:${r + 2}"><span>${escapeHtml(w.label)}</span><span class="pm-section-sub">${escapeHtml(w.sub)}</span></div>`));
    spec.sections.forEach((sec, i) => {
        const groups = [];
        let dayHours = 0, dayN = 0;
        for (const col of shown) {
            const list = byCol.get(col)[i];
            if (!list.length) continue;
            const hours = list.reduce((a, e) => a + e.hours, 0);
            const usual = S.hoursMax.day.get(col) || 0;
            const over = S.dummy && usual > 0 && hours > usual + 0.01;
            dayHours += hours; dayN += list.length;
            const hTitle = usual ? `Busiest real day for ${col} in the last 8 weeks: ${fmtH(usual)} h` : '';
            groups.push(`<div class="pm-cal-dept${over ? ' pm-cal-dept-over' : ''}" style="${colStyle(col)}">
                <div class="pm-cal-dept-head" data-open-band="${escapeHtml(col)}|${i}" title="See every ${escapeHtml(col)} job on ${escapeHtml(sec.label)} ${escapeHtml(sec.sub)}"><span class="pm-cal-dept-name">${escapeHtml(col)}</span>${S.dummy && hours ? `<span class="pm-section-h${over ? ' pm-over' : ''}" title="${escapeHtml(hTitle)}">${fmtH(hours)} h</span>` : ''}${sqftHtml(list, 'pm-section-h pm-section-sq', true)}${countHtml(col, list)}</div>
                <div class="fm-cards" data-cards="${escapeHtml(col)}|${i}">${list.map(e => chipHtml(e, col, i)).join('')}</div>
            </div>`);
        }
        onFloor += dayN;
        // work is scheduled around the castings: a viewed department with nothing that day is an "open … day" (user, 2026-10-27)
        const openDepts = shown.filter(col => !byCol.get(col)[i].length);
        const openHtml = !openDepts.length ? ''
            : openDepts.length === shown.length ? '<span class="pm-cal-open" title="Nothing scheduled that day for any department you are viewing">open day</span>'
            : `<span class="pm-cal-open" title="Nothing scheduled that day for ${escapeHtml(openDepts.join(', '))}">open ${escapeHtml(openDepts.join(', '))} day</span>`;
        parts.push(`<div class="pm-cell pm-cal-day${sec.start === tod ? ' pm-cal-today' : ''}${sec.label === 'Sun' ? ' pm-cal-sun' : ''}${sec.start < tod ? ' pm-past' : ''}${S.holidays.has(sec.start) ? ' pm-holiday' : ''}" style="grid-column:${sec.col + 2};grid-row:${sec.week + 2}" data-cellcol="*" data-sec="${i}" data-secstart="${escapeHtml(sec.start)}" data-seckind="day">
            <div class="pm-cal-date" data-open-day="${i}" title="See every job on ${escapeHtml(sec.label)} ${escapeHtml(sec.sub)}"><b>${escapeHtml(sec.sub)}</b>${openHtml}<span class="pm-cal-date-n">${dayN ? `${dayN} ${dayN === 1 ? 'job' : 'jobs'}` : ''}${S.dummy && dayHours ? ` · ${fmtH(dayHours)} h` : ''}</span></div>
            <div class="pm-cal-body">${groups.join('')}</div>
        </div>`);
    });
    map.innerHTML = parts.join('');
    $('fm-shipped-count').textContent = String(shipped.length);
    $('pm-sub').textContent = `${onFloor} on the floor that month`;
    renderWhen(spec);
    renderDeptPicker();
    renderPopover();
    renderPickState();
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
    pop.innerHTML = `<div class="fm-card fm-chip-expanded" data-key="${escapeHtml(id)}" data-expanded="1" title="Click the name to close">${cardBodyHtml(c, e)}</div>`;
    const r = chip.getBoundingClientRect();
    pop.style.left = '0px'; pop.style.top = '0px';
    const w = Math.max(pop.offsetWidth, r.width), h = pop.offsetHeight;
    pop.style.left = Math.max(4, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
    pop.style.top = Math.max(4, Math.min(r.top, window.innerHeight - h - 8)) + 'px';
    pop.style.minWidth = r.width + 'px';
    pop.onmouseleave = () => { if (S.expandedKey === id && !pop.querySelector(':focus')) { S.expandedKey = null; renderMap(); } };
}

// ---------------------------------------------------------------- department picker

function renderDeptPicker() {
    const list = $('pm-dept-list');
    if (!list) return;
    list.innerHTML = MAP_DEPARTMENTS.filter(d => ALWAYS_SHOWN.has(d) || d === 'Mill').map(d => `<li><label><input type="checkbox" data-dept="${escapeHtml(d)}"${!S.depts || S.depts.has(d) ? ' checked' : ''}> ${escapeHtml(d)}</label></li>`).join('');
    const n = S.depts ? S.depts.size : null;
    $('pm-dept-label').textContent = n === null ? 'All departments' : n === 0 ? 'No departments' : n === 1 ? [...S.depts][0] : `${n} departments`;
}
function saveDepts() { try { localStorage.setItem(DEPTS_KEY, S.depts ? JSON.stringify([...S.depts]) : ''); } catch { /* ignore */ } }
function loadDepts() { try { const raw = localStorage.getItem(DEPTS_KEY); if (raw) S.depts = new Set(JSON.parse(raw)); } catch { S.depts = null; } }

// ---------------------------------------------------------------- pop-ups

function openModal(kind, extra = {}) {
    S.modal = { kind, filter: '', expandedKey: null, ...extra };
    const search = $('fm-modal-search');
    search.value = '';
    search.hidden = kind === 'dummies';
    search.placeholder = 'Filter by job, cast or PM';
    $('fm-modal').hidden = false;
    renderModalBody();
}
function closeModal() { S.modal = null; $('fm-modal').hidden = true; }

async function renderModalBody() {
    if (!S.modal) return;
    const title = $('fm-modal-title');
    const body = $('fm-modal-body');
    const q = S.modal.filter;
    if (S.modal.kind === 'dummies') {
        title.textContent = 'Saved dummies';
        body.innerHTML = '<div class="fm-empty">Loading…</div>';
        let list = [];
        try { list = await listDummies(); } catch (err) { body.innerHTML = `<div class="fm-empty">Could not load: ${escapeHtml(err.message || err)}</div>`; return; }
        if (!S.modal || S.modal.kind !== 'dummies') return;
        if (isDummyMigrationPending()) { body.innerHTML = '<div class="fm-empty">The dummy tables are not in the database yet — run migration/project-map-dummies.sql.</div>'; return; }
        body.innerHTML = list.length ? list.map(d => `<div class="fm-mrow pm-dummy-row${S.dummy && S.dummy.id === d.id ? ' fm-mrow-open' : ''}">
            <div class="fm-mrow-text">
                <div class="fm-card-job">${escapeHtml(d.name)}${d.final ? ' <span class="pm-final-tag">FINAL</span>' : ''}</div>
                <div class="fm-card-meta">${d.moves} moved ${d.moves === 1 ? 'day' : 'days'} · chain ${d.chain === false ? 'off' : 'on'} · ${d.created_by ? escapeHtml(d.created_by) + ' · ' : ''}updated ${new Date(d.updated_at).toLocaleString('en-US', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
            </div>
            <button type="button" class="fm-mini-btn fm-bulk-go" data-dummy-open="${escapeHtml(d.id)}">Open</button>
            <button type="button" class="fm-mini-btn" data-dummy-delete="${escapeHtml(d.id)}" data-dummy-name="${escapeHtml(d.name)}">Delete</button>
        </div>`).join('') : '<div class="fm-empty">No saved dummies yet.</div>';
        return;
    }
    if (S.modal.kind === 'day') {
        const { byCol, spec } = partition();
        const sec = spec.sections[S.modal.section];
        if (!sec) { closeModal(); return; }
        const { shown } = shownDepartments(byCol);
        let total = 0, hoursAll = 0;
        const parts = [];
        for (const col of shown) {
            const list = byCol.get(col)[S.modal.section] || [];
            total += list.length;
            const hours = list.reduce((a, e) => a + e.hours, 0);
            hoursAll += hours;
            const rows = list.filter(e => matchesSearch(e.c, q));
            if (!rows.length) continue;
            parts.push(`<div class="fm-log-day pm-day-dept" style="${colStyle(col)}"><span class="pm-hidden-dept">${escapeHtml(col)}</span><span class="pm-section-sub">${list.length} ${list.length === 1 ? 'job' : 'jobs'}${S.dummy && hours ? ` · ${fmtH(hours)} h` : ''}</span>${sqftHtml(list, 'pm-section-sq', true)}${riskHtml(col, list)}</div>`);
            parts.push(rows.map(e => rowHtml(e)).join(''));
        }
        title.textContent = `${sec.label} ${sec.sub} — ${total} ${total === 1 ? 'job' : 'jobs'}${S.dummy && hoursAll ? ` · ${fmtH(hoursAll)} h` : ''}`;
        body.innerHTML = parts.length ? parts.join('') : `<div class="fm-empty">${total ? 'No jobs match.' : 'Nothing scheduled that day.'}</div>`;
    } else if (S.modal.kind === 'column') {
        const { byCol, spec } = partition();
        const only = S.modal.section;
        const sections = (byCol.get(S.modal.column) || []).map((l, i) => only == null || i === only ? l : []);
        const total = sections.reduce((a, l) => a + l.length, 0);
        const bandTitle = only != null && spec.sections[only] ? `${spec.sections[only].label} ${spec.sections[only].sub}` : spec.title;
        title.textContent = `${S.modal.column} — ${total} ${total === 1 ? 'job' : 'jobs'} · ${bandTitle}`;
        const parts = [];
        sections.forEach((list, i) => {
            const rows = list.filter(e => matchesSearch(e.c, q));
            if (!rows.length) return;
            const sec = spec.sections[i];
            if (sec.label) parts.push(`<div class="fm-log-day pm-day-dept">${escapeHtml(sec.label)} <span class="pm-section-sub">${escapeHtml(sec.sub)}</span>${sqftHtml(list, 'pm-section-sq', oneDay(sec))}${riskHtml(S.modal.column, list)}</div>`);
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
    if (openRow && S.modal.kind !== 'dummies') openRow.addEventListener('mouseleave', () => { if (S.modal && S.modal.expandedKey === openRow.dataset.mrow && !openRow.querySelector(':focus')) { S.modal.expandedKey = null; renderModalBody(); } }, { once: true });
}

// ---------------------------------------------------------------- full screen (2026-10-29): like the Releasability Board's button
/** Full screen from the button (the Fullscreen API). */
function apiFullscreenOn() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
/** Full screen either way: the button, or the browser's own F11 (the window then fills the display). */
function fullscreenOn() { return apiFullscreenOn() || (screen.width > 0 && window.innerWidth >= screen.width - 2 && window.innerHeight >= screen.height - 2); }   // screen is 0×0 in some embedded browsers
function toggleFullscreen() {
    const el = document.documentElement;
    if (apiFullscreenOn()) { (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document); return; }
    if (fullscreenOn()) { notice('The browser is in its own full screen — press F11 to leave it.', 'info'); return; }
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) { notice('This browser cannot go full screen from a button — press F11 instead.', 'warn'); return; }
    try { const r = req.call(el); if (r && r.catch) r.catch(() => notice('Full screen was refused by the browser — press F11 instead.', 'warn')); } catch { notice('Full screen was refused by the browser — press F11 instead.', 'warn'); }
}
/** The button's label, and body.pm-fs: in full screen the page top collapses so the cells get the display. */
function renderFullscreenBtn() {
    const on = fullscreenOn();
    document.body.classList.toggle('pm-fs', on);
    const b = $('pm-fullscreen');
    if (b) { b.textContent = on ? '\u26F6 Exit full screen' : '\u26F6 Full screen'; b.classList.toggle('pm-view-on', on); }
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
            loadAllProjects().catch(err => { logger.warn('[project-map] projects failed', err); return []; }),
            loadWarnings()   // the shared levels, so a change saved on another screen shows here on the next refresh
        ]);
        S.projects = new Map((projects || []).map(p => [String(p.project_number || '').trim(), p]));
        S.rawTasks = tasks || [];
        computeHoursMax(S.rawTasks);
        S.castings = summarise(S.rawTasks);
        if (!silent || !$('fm-notice').textContent.startsWith('The dummy')) notice('');
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
    if (S.view === 'day') {
        S.anchor = addDays(S.anchor, n);
        while (!S.sundays && isSunday(S.anchor) && !anythingOn(S.anchor)) S.anchor = addDays(S.anchor, n > 0 ? 1 : -1);
    } else if (S.view === 'week') S.anchor = addDays(S.anchor, 7 * n);
    else if (S.view === 'month4') S.anchor = addDays(S.anchor, 28 * n);
    else {
        const spec = viewSpec();
        S.anchor = getLocalDateString(new Date(spec.year, spec.month + n, 15));
    }
    S.expandedKey = null;
    renderMap();
}

/** The date a dragged block's first day should land on when dropped on a band cell. */
function dropTarget(cell, firstDay) {
    const start = cell.dataset.secstart;
    if (cell.dataset.seckind === 'day') return start;
    const offset = (parseIso(firstDay).getDay() + 6) % 7;   // a week band: keep the weekday the block starts on (Mon = 0)
    return addDays(start, offset);
}

function wireEvents() {
    const app = $('fm-app');
    app.addEventListener('click', (e) => {
        const pick = e.target.closest('[data-pickup]');
        if (pick) { const [key, dept] = pick.dataset.pickup.split("::"); startPick(key, dept); return; }
        if (S.picking) {
            if (e.target.closest('#pm-pick-cancel')) { cancelPick(); return; }
            if (e.target.closest('#pm-dummy-bar') || e.target.closest('[data-view]') || e.target.closest('#pm-sunday') || e.target.closest('#pm-prev, #pm-next, #pm-today') || e.target.closest('#pm-dept-dropdown')) { /* keep the card picked while they change the view */ }
            else {
                const cell = e.target.closest('.pm-cell');
                const p = S.picking;
                S.picking = null;
                if (cell && (cell.dataset.cellcol === p.dept || cell.dataset.cellcol === '*')) { dummyMoveBlock(p.key, p.dept, dropTarget(cell, p.first)); return; }
                renderPickState();   // tapped something else: let go, then treat the tap as usual
            }
        }
        const view = e.target.closest('[data-view]');
        if (view) { if (view.disabled) return; S.view = view.dataset.view; S.expandedKey = null; renderMap(); return; }
        if (e.target.closest('#pm-sunday')) { S.sundays = !S.sundays; try { localStorage.setItem(SUNDAY_KEY, S.sundays ? '1' : ''); } catch { /* ignore */ } S.expandedKey = null; renderMap(); return; }
        if (e.target.closest('#pm-dept-btn')) { $('pm-dept-dropdown').classList.toggle('open'); return; }
        if (e.target.closest('#pm-dept-all')) { S.depts = null; saveDepts(); renderMap(); return; }
        if (e.target.closest('#pm-dept-none')) { S.depts = new Set(); saveDepts(); renderMap(); return; }
        if (e.target.closest('#pm-dept-dropdown')) return;
        $('pm-dept-dropdown')?.classList.remove('open');
        if (e.target.closest('#pm-warn-btn')) { renderWarnForm(); $('pm-warn-dropdown').classList.toggle('open'); return; }
        if (e.target.closest('#pm-warn-save')) { saveWarnings(false); return; }
        if (e.target.closest('#pm-warn-reset')) { saveWarnings(true); return; }
        if (e.target.closest('#pm-warn-close')) { $('pm-warn-dropdown').classList.remove('open'); return; }
        if (e.target.closest('#pm-warn-dropdown')) return;
        $('pm-warn-dropdown')?.classList.remove('open');
        if (e.target.closest('#pm-dummy-btn')) { if (S.dummy) exitDummy(); else enterDummy(); return; }
        if (e.target.closest('#pm-dummy-save')) { dummySave(false); return; }
        if (e.target.closest('#pm-dummy-saveas')) { dummySave(true); return; }
        if (e.target.closest('#pm-dummy-open')) { openModal('dummies'); return; }
        if (e.target.closest('#pm-dummy-rename')) { dummyRename(); return; }
        if (e.target.closest('#pm-dummy-final')) { dummyToggleFinal(); return; }
        if (e.target.closest('#pm-dummy-undo')) { dummyUndo(); return; }
        if (e.target.closest('#pm-dummy-clear')) { dummyClear(); return; }
        if (e.target.closest('#pm-dummy-exit')) { exitDummy(); return; }
        if (e.target.closest('#pm-dummy-bar')) return;
        if (e.target.closest('.pm-movebox')) return;   // the date box / its label: not a click on the card
        const head = e.target.closest('[data-open-col]');
        if (head) { S.expandedKey = null; renderMap(); openModal('column', { column: head.dataset.openCol }); return; }
        const day = e.target.closest('[data-open-day]');
        if (day) { S.expandedKey = null; renderMap(); openModal('day', { section: Number(day.dataset.openDay) }); return; }
        const band = e.target.closest('[data-open-band]');
        if (band) { const [column, i] = band.dataset.openBand.split('|'); S.expandedKey = null; renderMap(); openModal('column', { column, section: Number(i) }); return; }
        const card = e.target.closest('[data-key]');
        if (card) { S.expandedKey = S.expandedKey === card.dataset.key ? null : card.dataset.key; renderMap(); return; }
        if (S.expandedKey) { S.expandedKey = null; renderMap(); }
    });
    app.addEventListener('change', (e) => {
        if (e.target.id === 'pm-dummy-chain' && S.dummy) { S.dummy.chain = e.target.checked; S.dummy.dirty = true; renderDummyBar(); return; }
        const mv = e.target.closest('input[data-move-date]');
        if (mv && S.dummy && mv.value) { const [key, dept] = mv.dataset.moveDate.split("::"); S.expandedKey = null; dummyMoveBlock(key, dept, mv.value); }
    });

    // Dummy mode drag: a card to another band of the same department
    app.addEventListener('dragstart', (e) => {
        const chip = e.target.closest('.fm-chip[draggable="true"]');
        if (!chip || !S.dummy) { e.preventDefault(); return; }
        const c = S.castings.get(chip.dataset.cast);
        const dept = chip.dataset.dept;
        if (!c || !c.days.get(dept)) { e.preventDefault(); return; }
        S.dragging = { key: c.key, dept, first: c.days.get(dept)[0] };
        e.dataTransfer.setData('text/plain', c.key);
        e.dataTransfer.effectAllowed = 'move';
        chip.classList.add('fm-card-dragging');
        document.body.classList.add('pm-dragging');
        for (const cell of document.querySelectorAll(`.pm-cell[data-cellcol="${CSS.escape(dept)}"], .pm-cell[data-cellcol="*"]`)) if (cellLandable(cell)) cell.classList.add('pm-drop-ok');
    });
    // dragend fires on the dragged card — which a drop has already redrawn, so it never reaches us: clean up in drop too
    const endDrag = () => {
        S.dragging = null;
        document.body.classList.remove('pm-dragging');
        for (const el of document.querySelectorAll('.pm-drop-ok, .fm-drop-hover, .fm-card-dragging')) el.classList.remove('pm-drop-ok', 'fm-drop-hover', 'fm-card-dragging');
    };
    app.addEventListener('dragend', endDrag);
    app.addEventListener('dragover', (e) => {
        const cell = e.target.closest('.pm-cell');
        if (!cell || !S.dragging || (cell.dataset.cellcol !== S.dragging.dept && cell.dataset.cellcol !== '*')) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        cell.classList.add('fm-drop-hover');
    });
    app.addEventListener('dragleave', (e) => { e.target.closest?.('.pm-cell')?.classList.remove('fm-drop-hover'); });
    app.addEventListener('drop', (e) => {
        const cell = e.target.closest('.pm-cell');
        if (!cell || !S.dragging || (cell.dataset.cellcol !== S.dragging.dept && cell.dataset.cellcol !== '*')) return;
        e.preventDefault();
        const { key, dept, first } = S.dragging;
        endDrag();
        dummyMoveBlock(key, dept, dropTarget(cell, first));
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
        const pick = e.target.closest('[data-pickup]');
        if (pick) { const [key, dept] = pick.dataset.pickup.split("::"); closeModal(); startPick(key, dept); return; }
        const open = e.target.closest('[data-dummy-open]');
        if (open) { dummyOpen(open.dataset.dummyOpen); return; }
        const del = e.target.closest('[data-dummy-delete]');
        if (del) { dummyDelete(del.dataset.dummyDelete, del.dataset.dummyName); return; }
        if (e.target.closest('.pm-movebox')) return;   // the date box in an open row: leave the row open so the picker can show
        const txt = e.target.closest('[data-expand]');
        if (txt && S.modal) { S.modal.expandedKey = S.modal.expandedKey === txt.dataset.expand ? null : txt.dataset.expand; renderModalBody(); return; }
        if (e.target === modal || e.target.closest('#fm-modal-close')) closeModal();
    });
    modal.addEventListener('change', (e) => {
        const mv = e.target.closest('input[data-move-date]');
        if (mv && S.dummy && mv.value) { const [key, dept] = mv.dataset.moveDate.split("::"); dummyMoveBlock(key, dept, mv.value); }
    });
    $('fm-modal-search').addEventListener('input', (e) => { if (S.modal) { S.modal.filter = e.target.value.trim().toLowerCase(); renderModalBody(); } });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { if (S.modal) closeModal(); else if (S.picking) cancelPick(); else if (S.expandedKey) { S.expandedKey = null; renderMap(); } else { $('pm-dept-dropdown')?.classList.remove('open'); $('pm-warn-dropdown')?.classList.remove('open'); } }
        if (!S.modal && !(e.target.closest && e.target.closest('input'))) { if (e.key === 'ArrowLeft') step(-1); if (e.key === 'ArrowRight') step(1); }
        if (S.dummy && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !(e.target.closest && e.target.closest('input'))) { e.preventDefault(); dummyUndo(); }
    });
    $('fm-search').addEventListener('input', (e) => { S.search = e.target.value.trim().toLowerCase(); renderMap(); });
    $('fm-refresh').addEventListener('click', () => loadAll());
    $('fm-shipped-btn').addEventListener('click', () => openModal('shipped'));
    $('pm-fullscreen').addEventListener('click', toggleFullscreen);
    window.addEventListener('resize', () => { renderFullscreenBtn(); markOverflow(); });   // F11 shows up as a resize
    for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, () => { renderFullscreenBtn(); setTimeout(markOverflow, 300); });
    window.addEventListener('beforeunload', (e) => { if (S.dummy && S.dummy.dirty) { e.preventDefault(); e.returnValue = ''; } });
    registerRefreshHandler(async (payload, payloads) => {
        const batch = Array.isArray(payloads) && payloads.length ? payloads : [payload];
        const tables = batch.filter(isPortalChange).map(p => signalInfo(p).table || '');
        const onlyMaps = batch.every(isPortalChange) && tables.every(t => /^finishing_map|^project_map_dumm/.test(t));
        if (!onlyMaps) await loadAll({ silent: true });
        else if (S.modal && S.modal.kind === 'dummies') renderModalBody();
    });
}

(async function boot() {
    S.anchor = today();
    if (isSunday(S.anchor)) S.anchor = addDays(S.anchor, 1);
    loadDepts();
    try { S.sundays = !!localStorage.getItem(SUNDAY_KEY); } catch { /* ignore */ }
    if (document.getElementById('ro-test-count') || document.querySelector('[style*="99999"]')) document.body.classList.add('fm-has-test-bar');
    wireEvents();
    renderFullscreenBtn();
    renderWhen(viewSpec());
    renderDeptPicker();
    try { await initializeSupabase(); } catch (err) { logger.warn('[project-map] supabase init failed', err); }
    await loadAll();
    if (document.getElementById('ro-test-count')) document.body.classList.add('fm-has-test-bar');
})();

window.__projectMap = { state: S, partition, viewSpec, reload: loadAll, dummy: { enter: enterDummy, exit: exitDummy, move: dummyMoveBlock, save: dummySave, open: dummyOpen, undo: dummyUndo, pick: startPick, cancelPick } };
