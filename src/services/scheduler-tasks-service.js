/**
 * The Plant Scheduler as the weekly's schedule (2026-10-28).
 *
 * Turns plant_schedule rows into the task objects the weekly has always built from the Google Sheet
 * ("Primary Live List 2"), field for field, so every consumer — the week grid, task cards, staging notes
 * (task_descriptions), actual hours, prints, the Releasability Board — works unchanged:
 *
 *   sheet column            task field          from the scheduler
 *   A Week                  week                '' (the sheet left it blank too; the grid uses the date)
 *   B Main Project          project             "<portal project name> - Cast #<n>"
 *   C Task Description      projectDescription  the casting's description in the portal
 *   D Date                  date                M/D/YYYY
 *   E Department            department          the Staging tab's department of the row's unit note
 *                                               ("Mill", "Load", "Form Out" …), else the team's weekly name
 *   F Value (code)          value               the task code as the sheet spelt it (tu, seal, g/f, r/d …)
 *   G Hours                 hours               hours
 *   H Project Num           projectNumber       project_number
 *   I Casting Num           castingNumber       project_castings.casting_number
 *
 * Day numbers: an imported row's note "unit:<cast>|<staging dept>|<day>" names the Staging-tab day it came
 * from (numbered over the whole live list, September included), so that day is used as is — the staging
 * note, the Optimizer Hours box and the actual-hours row all hang on it. Rows without a unit note (castings
 * scheduled from the portal's phases) are numbered by date within casting + department, like the sheet.
 *
 * Read directly from the database on every load (no sheets_cache): a scheduler save broadcasts
 * portal_changed:plant_schedule and the weekly reloads within seconds.
 *
 * @module services/scheduler-tasks-service
 */

import { initializeSupabase, getSupabaseClient } from './supabase-service.js';
import { DEPARTMENTS } from '../config/scheduler-config.js';
import { DEPARTMENT_ORDER } from '../config/department-config.js';
import { normalizeDepartment, normalizeProjectName } from '../utils/ui-utils.js';
import { logger } from '../utils/logger.js';

const PAGE = 1000;

/** scheduler team -> the weekly's department name (CNC, Parts, Form Out, Cast, Demold, Finish, Seal, Crating, Special, Ship) */
const WEEKLY_OF_TEAM = Object.fromEntries(DEPARTMENTS.map(d => [d.key, d.weekly]));

/** scheduler task code -> the word the sheet used in its Value column (what prints and the task modal show) */
const SHEET_WORD = {
    'PARTS': 'parts', 'PARTS/FO': 'm/f', 'G/F': 'g/f', 'GOF': 'gof', 'DRY/RACK': 'r/d', 'CLEAN RUBBER': 'clean',
    'STRIP': 'strips', 'RB': 'rb', 'FO': 'fo', 'CAST': 'cast', 'DM': 'dm', 'TU': 'tu', 'SEAL': 'seal', 'BUILD': 'build',
    'LOAD': 'load', 'RACK': 'rack', 'SHIP': 'ship', 'WASH': 'wash', 'ACID': 'acid', 'PAINT': 'paint', 'AZEK': 'azek',
    'PAN': 'pan', 'DRILL': 'drill', 'CNC': 'cnc', 'EPOXY': 'epoxy'
};

async function getClient() {
    if (!getSupabaseClient()) await initializeSupabase();
    return getSupabaseClient();
}

async function loadAllRows(client) {
    const rows = [];
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await client.from('plant_schedule').select('*').order('date').order('id').range(from, from + PAGE - 1);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < PAGE) break;
    }
    return rows;
}

async function loadByIn(client, table, select, column, values) {
    const out = [];
    const list = [...new Set(values.filter(Boolean))];
    for (let i = 0; i < list.length; i += 80) {
        const { data, error } = await client.from(table).select(select).in(column, list.slice(i, i + 80));
        if (error) throw error;
        out.push(...(data || []));
    }
    return out;
}

/** "unit:<cast>|<staging dept>|<day>" (the import's link to the Staging tab) -> { dept, day } or null */
function unitOf(note) {
    const n = String(note || '').trim();
    if (!n.startsWith('unit:')) return null;
    const parts = n.slice(5).split(' — ')[0].split('|');
    if (parts.length < 3) return null;
    const day = parseInt(parts[2], 10);
    return { dept: normalizeDepartment(parts[1].trim()), day: day > 0 ? day : null };
}

function mdy(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? `${Number(m[2])}/${Number(m[3])}/${m[1]}` : '';
}

function fmtHours(h) {
    const n = Number(h);
    if (!isFinite(n)) return '';
    return String(Math.round(n * 100) / 100);
}

/** natural order for casting numbers ("2" < "10", "T1" < "T2", "E3" …) */
function castSort(a, b) {
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Day index within a group: tasks carrying an explicit day keep it; the rest are numbered by date in the
 * slots that are left, in order. Total = the highest day the group reaches.
 */
function numberGroup(list, dayField, totalField, explicitField) {
    list.sort((a, b) => (a._sortKey < b._sortKey ? -1 : a._sortKey > b._sortKey ? 1 : 0));
    const taken = new Set(list.map(t => t[explicitField]).filter(Boolean));
    let next = 1;
    for (const t of list) {
        if (t[explicitField]) { t[dayField] = String(t[explicitField]); continue; }
        while (taken.has(next)) next++;
        t[dayField] = String(next); taken.add(next); next++;
    }
    const total = Math.max(...list.map(t => parseInt(t[dayField], 10) || 0), 0);
    for (const t of list) t[totalField] = String(total);
}

/**
 * Every plant_schedule row as a weekly task (same shape as sheets-service parseSheetData()).
 * @returns {Promise<Array<Object>>}
 */
export async function fetchTasksFromScheduler() {
    const t0 = performance.now();
    const client = await getClient();
    if (!client) throw new Error('No database connection for the Plant Scheduler');

    const rows = await loadAllRows(client);
    const castings = await loadByIn(client, 'project_castings', 'id, project_number, casting_number, description', 'id', rows.map(r => r.casting_id));
    const castById = new Map(castings.map(c => [c.id, c]));
    const projects = await loadByIn(client, 'projects', 'project_number, project_name', 'project_number', rows.map(r => r.project_number));
    const nameByNumber = new Map(projects.map(p => [String(p.project_number || '').trim(), String(p.project_name || '').trim()]));

    const tasks = [];
    let orphans = 0;
    for (const r of rows) {
        const c = castById.get(r.casting_id);
        if (!c) { orphans++; continue; }                     // casting deleted from the portal: nothing to show
        const projectNumber = String(r.project_number || '').trim();
        const castingNumber = String(c.casting_number || '').trim();
        const unit = unitOf(r.note);
        const team = String(r.department || '').trim();
        const code = String(r.task || '').trim().toUpperCase();
        let department = unit ? unit.dept : (code === 'LOAD' ? 'Load' : (WEEKLY_OF_TEAM[team] || team));
        department = normalizeDepartment(department) || team;
        const projectName = nameByNumber.get(projectNumber) || projectNumber;
        const word = SHEET_WORD[code] || code.toLowerCase();
        tasks.push({
            id: '',                                           // set after sorting
            week: '',
            project: `${projectName} - Cast #${castingNumber}`,
            projectDescription: String(c.description || '').trim(),
            date: mdy(r.date),
            department,
            value: (code === 'PARTS' && department === 'Mill') ? 'mill' : word,
            hours: fmtHours(r.hours),
            projectNumber,
            castingNumber,
            dayNumber: '',
            totalDays: '',
            castingDayNumber: '',
            castingTotalDays: '',
            // extra, scheduler-only fields (nothing on the weekly needs them; kept for future use)
            fromScheduler: true,
            scheduleRowId: r.id,
            schedulerTeam: team,
            taskCode: code,
            crew: Array.isArray(r.crew) ? r.crew : null,
            stagingDayNumber: unit && unit.day ? String(unit.day) : '',
            _iso: r.date,
            _sortKey: ''
        });
    }

    // deterministic order: date, the weekly's department order, project, casting, task — then sheet-style ids
    const deptIdx = (d) => { const i = DEPARTMENT_ORDER.indexOf(d); return i < 0 ? 99 : i; };
    tasks.sort((a, b) => a._iso.localeCompare(b._iso) || (deptIdx(a.department) - deptIdx(b.department))
        || a.projectNumber.localeCompare(b.projectNumber) || castSort(a.castingNumber, b.castingNumber) || a.taskCode.localeCompare(b.taskCode));
    tasks.forEach((t, i) => { t.id = `task-${i + 1}`; t._sortKey = `${t._iso}|${String(i + 1).padStart(6, '0')}`; });

    // day numbers: per casting + department (the staging / actual-hours key) and per project name + department
    // (the card's "Day X of Y"). With one name per casting both groups are the same rows.
    const byCast = new Map(), byName = new Map();
    for (const t of tasks) {
        t._explicitDay = parseInt(t.stagingDayNumber, 10) || 0;
        const k1 = `${t.projectNumber}|${t.castingNumber}|${t.department}`;
        if (!byCast.has(k1)) byCast.set(k1, []);
        byCast.get(k1).push(t);
        const k2 = `${normalizeProjectName(t.project)}|${t.department}`;
        if (!byName.has(k2)) byName.set(k2, []);
        byName.get(k2).push(t);
    }
    for (const list of byCast.values()) numberGroup(list, 'castingDayNumber', 'castingTotalDays', '_explicitDay');
    for (const list of byName.values()) numberGroup(list, 'dayNumber', 'totalDays', '_explicitDay');
    for (const t of tasks) { delete t._iso; delete t._sortKey; delete t._explicitDay; }

    logger.info(`[scheduler-tasks] ${tasks.length} tasks from ${rows.length} Plant Scheduler rows (${castings.length} castings, ${projects.length} projects${orphans ? `, ${orphans} rows of deleted castings skipped` : ''}) in ${(performance.now() - t0).toFixed(0)}ms`);
    return tasks;
}
