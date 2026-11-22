/**
 * Actual Hours Service
 *
 * Persists actual labor hours against a planned weekly-schedule task.
 * One row per planned task, keyed by composite (task_date, project_number,
 * casting_number, department, day_number). Re-entries upsert.
 *
 * planned_hours is snapshotted at entry time so downstream consumers
 * (Project Portal "Actual Labor" tab) can render Planned vs Actual
 * without re-reading the Google Sheet.
 *
 * NOTE: task.id is positional (row index from the sheet) and not stable
 * across sheet edits, so we never use it for persistence — only for
 * in-memory render lookup.
 *
 * @module services/actual-hours-service
 */

import { initializeSupabase, getSupabaseClient } from './supabase-service.js';
import { logger } from '../utils/logger.js';
import { parseDate, getLocalDateString } from '../utils/date-utils.js';

const TABLE = 'actual_hours';
const ONCONFLICT = 'task_date,project_number,casting_number,department,day_number';

async function getClient() {
    let client = getSupabaseClient();
    if (!client) client = await initializeSupabase();
    return client;
}

/** Coerce a possibly-undefined string field to '' so it matches the
 *  composite UNIQUE constraint (Postgres treats NULLs as distinct). */
function s(v) {
    return v == null ? '' : String(v);
}

/** Normalize any date string the sheet might use ('MM/DD/YYYY', 'YYYY-MM-DD', …)
 *  to canonical 'YYYY-MM-DD'. Returns '' for anything that isn't a real date
 *  (the sheet has section-label rows like 'Sheet 2' in the date column). */
function toIsoDate(v) {
    if (!v) return '';
    const str = String(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const d = parseDate(str);
    return d ? getLocalDateString(d) : '';
}

/**
 * Composite key derived from a weekly-schedule task object.
 * Used both for upserts and for matching saved rows back to tasks.
 */
export function buildTaskKey(task) {
    return {
        task_date:      toIsoDate(task?.date),
        project_number: s(task?.projectNumber),
        casting_number: s(task?.castingNumber),
        department:     s(task?.department),
        day_number:     s(task?.dayNumber)
    };
}

function keyString(k) {
    return [k.task_date, k.project_number, k.casting_number, k.department, k.day_number].join('|');
}

/**
 * Stable composite-key string for a task — the canonical identity of an
 * actual-hours entry. The in-memory render cache keys on THIS, never on the
 * positional `task.id` (which is reassigned on every sheet re-parse, so caching
 * by it makes a saved value slide onto a different card after a refresh).
 * @param {Object} task — weekly-schedule task object
 * @returns {string}
 */
export function taskHoursKey(task) {
    return keyString(buildTaskKey(task));
}

/** Composite key derived from a DB row (snake_case fields). */
function rowKey(row) {
    return keyString({
        task_date:      s(row.task_date),
        project_number: s(row.project_number),
        casting_number: s(row.casting_number),
        department:     s(row.department),
        day_number:     s(row.day_number)
    });
}

/**
 * Upsert actual hours for a task. planned_hours is snapshotted from
 * task.hours on every save.
 * @param {Object} task — weekly-schedule task object
 * @param {number|string} hours — actual hours value
 * @returns {Promise<Object|null>} saved row
 */
export async function saveActualHours(task, hours) {
    if (!task) throw new Error('task required');
    const numHours = Number(hours);
    if (!Number.isFinite(numHours) || numHours < 0) {
        throw new Error('actual hours must be a non-negative number');
    }
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const payload = {
        ...buildTaskKey(task),
        planned_hours: s(task.hours),
        actual_hours: numHours,
        updated_at: new Date().toISOString()
    };

    const { data, error } = await client
        .from(TABLE)
        .upsert(payload, { onConflict: ONCONFLICT })
        .select()
        .maybeSingle();

    if (error) {
        logger.error('[actual-hours] upsert error:', error);
        throw error;
    }
    return data;
}

/**
 * Delete the actual-hours row for a task (lets the user clear an entry).
 * @param {Object} task
 * @returns {Promise<void>}
 */
export async function deleteActualHours(task) {
    if (!task) return;
    const client = await getClient();
    if (!client) return;
    const k = buildTaskKey(task);

    const { error } = await client
        .from(TABLE)
        .delete()
        .match(k);

    if (error) {
        logger.error('[actual-hours] delete error:', error);
        throw error;
    }
}

/**
 * Fetch all actual_hours rows whose task_date falls within the given list.
 * Used by the weekly view init to prime the in-memory cache.
 * @param {Array<string>} dates — ISO date strings ('YYYY-MM-DD')
 * @returns {Promise<Array<Object>>}
 */
export async function loadActualHoursForDates(dates) {
    if (!dates?.length) return [];
    const client = await getClient();
    if (!client) return [];

    const unique = Array.from(new Set(dates.map(toIsoDate).filter(Boolean)));
    if (!unique.length) return [];

    const { data, error } = await client
        .from(TABLE)
        .select('*')
        .in('task_date', unique);

    if (error) {
        logger.error('[actual-hours] loadForDates error:', error);
        throw error;
    }
    return data || [];
}

/**
 * Fetch all actual_hours rows whose task_date falls in [start, end] inclusive.
 * Used by the weekly view's day/week labor popover (cross-project).
 * @param {string} startDate — ISO 'YYYY-MM-DD'
 * @param {string} endDate   — ISO 'YYYY-MM-DD' (use same as startDate for a single day)
 * @returns {Promise<Array<Object>>}
 */
export async function loadActualHoursForRange(startDate, endDate) {
    const a = toIsoDate(startDate);
    const b = toIsoDate(endDate || startDate);
    if (!a || !b) return [];
    const client = await getClient();
    if (!client) return [];

    const { data, error } = await client
        .from(TABLE)
        .select('*')
        .gte('task_date', a)
        .lte('task_date', b)
        .order('task_date', { ascending: true });

    if (error) {
        logger.error('[actual-hours] loadForRange error:', error);
        throw error;
    }
    return data || [];
}

/**
 * Fetch all actual_hours rows for a given project, ordered by date.
 * Used by the Project Portal "Actual Labor" tab.
 * @param {string} projectNumber
 * @returns {Promise<Array<Object>>}
 */
export async function loadActualHoursForProject(projectNumber) {
    if (!projectNumber) return [];
    const client = await getClient();
    if (!client) return [];

    const { data, error } = await client
        .from(TABLE)
        .select('*')
        .eq('project_number', s(projectNumber))
        .order('task_date', { ascending: true });

    if (error) {
        logger.error('[actual-hours] loadForProject error:', error);
        throw error;
    }
    return data || [];
}

/**
 * Build a Map<compositeKey, actualHours:number> by matching DB rows against
 * a list of tasks via composite key. Keyed by the STABLE composite (see
 * taskHoursKey), never by positional task.id, so the seeded cache survives a
 * sheet re-parse that reshuffles ids. Tasks without a saved row are absent.
 * @param {Array<Object>} tasks
 * @param {Array<Object>} rows
 * @returns {Map<string, number>}
 */
export function buildTaskHoursMap(tasks, rows) {
    const out = new Map();
    if (!tasks?.length || !rows?.length) return out;

    const rowsByKey = new Map();
    for (const row of rows) {
        rowsByKey.set(rowKey(row), Number(row.actual_hours));
    }
    for (const task of tasks) {
        const compositeKey = keyString(buildTaskKey(task));
        const hours = rowsByKey.get(compositeKey);
        if (hours != null && Number.isFinite(hours)) {
            out.set(compositeKey, hours);
        }
    }
    return out;
}
