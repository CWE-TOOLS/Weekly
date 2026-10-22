/**
 * Task Descriptions Service (casting-aware)
 *
 * Casting-scoped read/write surface over the `task_descriptions` table for the
 * Project Portal optimizer. A casting-aware row is keyed by the composite
 * (project_number, casting_number, department, day_number) — where day_number is
 * the per-casting day index — mirroring the `actual_hours` table.
 *
 * The same rows are also read/written by the weekly view (via supabase-service's
 * fetchTaskDescriptions / saveTaskDescriptions), giving shared authorship: an edit
 * here and an edit on the weekly card land on the same row.
 *
 * @module services/task-descriptions-service
 */

import { initializeSupabase, getSupabaseClient, sendRefreshSignal } from './supabase-service.js';
import { logger } from '../utils/logger.js';

const TABLE = 'task_descriptions';
const ONCONFLICT = 'project_number,casting_number,department,day_number';
// task_name + hours arrive with migration/staging-task-hours.sql; until it is run, reads fall back to the old columns.
const FULL_COLS = 'casting_number, department, day_number, description, casting_side, task_name, hours';
const BASE_COLS = 'casting_number, department, day_number, description, casting_side';
let hoursColumnsMissing = false;
export function isStagingTaskHoursMigrationPending() { return hoursColumnsMissing; }
function missingColumn(error) { return !!error && /task_name|hours/.test(String(error.message || '')) && /column|does not exist|schema cache/i.test(String(error.message || '')); }
function rowToEntry(row) {
    return {
        description: row.description || '',
        castingSide: row.casting_side || null,
        taskName: row.task_name || '',
        hours: row.hours == null || row.hours === '' ? null : Number(row.hours)
    };
}

async function getClient() {
    let client = getSupabaseClient();
    if (!client) client = await initializeSupabase();
    return client;
}

/** Coerce a possibly-undefined field to a trimmed string. */
function s(v) {
    return v == null ? '' : String(v).trim();
}

/**
 * Load every casting-aware description for a project.
 * @param {string} projectNumber
 * @returns {Promise<Map<string, {description: string, castingSide: string|null}>>}
 *   Map keyed `${casting_number}|${department}|${day_number}` (project is fixed).
 */
export async function fetchForProject(projectNumber) {
    const out = new Map();
    const pnum = s(projectNumber);
    if (!pnum) return out;

    const client = await getClient();
    if (!client) return out;

    let { data, error } = await client
        .from(TABLE)
        .select(hoursColumnsMissing ? BASE_COLS : FULL_COLS)
        .eq('project_number', pnum)
        .not('casting_number', 'is', null);
    if (error && !hoursColumnsMissing && missingColumn(error)) {
        hoursColumnsMissing = true;
        logger.warn('[task-descriptions] task_name / hours columns missing — run migration/staging-task-hours.sql');
        ({ data, error } = await client.from(TABLE).select(BASE_COLS).eq('project_number', pnum).not('casting_number', 'is', null));
    }

    if (error) {
        logger.error('[task-descriptions] fetchForProject error:', error);
        return out;
    }

    for (const row of (data || [])) {
        const key = `${s(row.casting_number)}|${s(row.department)}|${s(row.day_number)}`;
        out.set(key, rowToEntry(row));
    }
    return out;
}

/**
 * Casting-aware descriptions for many projects at once (the Plant Scheduler).
 * @param {string[]} projectNumbers
 * @returns {Promise<Map<string, Map<string, Object>>>} project_number -> (`${cast}|${department}|${day}` -> entry)
 */
export async function fetchForProjects(projectNumbers) {
    const out = new Map();
    const nums = [...new Set((projectNumbers || []).map(s).filter(Boolean))];
    const client = await getClient();
    if (!client || !nums.length) return out;
    for (let i = 0; i < nums.length; i += 40) {
        const part = nums.slice(i, i + 40);
        let { data, error } = await client.from(TABLE).select('project_number, ' + (hoursColumnsMissing ? BASE_COLS : FULL_COLS)).in('project_number', part).not('casting_number', 'is', null);
        if (error && !hoursColumnsMissing && missingColumn(error)) {
            hoursColumnsMissing = true;
            ({ data, error } = await client.from(TABLE).select('project_number, ' + BASE_COLS).in('project_number', part).not('casting_number', 'is', null));
        }
        if (error) { logger.error('[task-descriptions] fetchForProjects error:', error); continue; }
        for (const row of (data || [])) {
            const pn = s(row.project_number);
            if (!out.has(pn)) out.set(pn, new Map());
            out.get(pn).set(`${s(row.casting_number)}|${s(row.department)}|${s(row.day_number)}`, rowToEntry(row));
        }
    }
    for (const pn of nums) if (!out.has(pn)) out.set(pn, new Map());
    return out;
}

/**
 * Upsert a single casting-aware description row.
 * @param {{projectNumber:string, castingNumber:string, department:string,
 *          dayNumber:string|number, description:string, castingSide?:string|null}} entry
 * @returns {Promise<boolean>}
 */
export async function upsertOne(entry) {
    if (!entry) throw new Error('entry required');
    const projectNumber = s(entry.projectNumber);
    const castingNumber = s(entry.castingNumber);
    const department = s(entry.department);
    const dayNumber = s(entry.dayNumber);
    if (!projectNumber || !castingNumber || !department || !dayNumber) {
        throw new Error('projectNumber, castingNumber, department and dayNumber are all required');
    }

    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const record = {
        project_number: projectNumber,
        casting_number: castingNumber,
        department: department,
        day_number: dayNumber,
        updated_at: new Date().toISOString()
    };
    const has = (k) => Object.prototype.hasOwnProperty.call(entry, k);
    if (has('description')) record.description = entry.description != null ? entry.description : '';
    if (has('taskName') && !hoursColumnsMissing) record.task_name = entry.taskName ? String(entry.taskName).trim() : null;
    if (has('hours') && !hoursColumnsMissing) record.hours = entry.hours == null || entry.hours === '' ? null : Number(entry.hours);

    // Only write casting_side when the caller explicitly provides it, so the
    // optimizer never clobbers a Side A/B set on the weekly Cast card.
    if (Object.prototype.hasOwnProperty.call(entry, 'castingSide')) {
        record.casting_side = entry.castingSide === 'A' || entry.castingSide === 'B'
            ? entry.castingSide
            : null;
    }

    const { error } = await client
        .from(TABLE)
        .upsert(record, { onConflict: ONCONFLICT, returning: 'minimal' });

    if (error) {
        logger.error('[task-descriptions] upsert error:', error);
        throw error;
    }

    await sendRefreshSignal({ action: 'task_descriptions_updated', project_number: projectNumber });
    return true;
}

/**
 * Delete a single casting-aware description row (remove-day / remove-department).
 * @param {{projectNumber:string, castingNumber:string, department:string, dayNumber:string|number}} key
 * @returns {Promise<void>}
 */
export async function deleteOne(key) {
    if (!key) return;
    const match = {
        project_number: s(key.projectNumber),
        casting_number: s(key.castingNumber),
        department: s(key.department),
        day_number: s(key.dayNumber)
    };
    if (!match.project_number || !match.casting_number || !match.department || !match.day_number) {
        return;
    }

    const client = await getClient();
    if (!client) return;

    const { error } = await client
        .from(TABLE)
        .delete()
        .match(match);

    if (error) {
        logger.error('[task-descriptions] delete error:', error);
        throw error;
    }

    await sendRefreshSignal({ action: 'task_descriptions_updated', project_number: match.project_number });
}
