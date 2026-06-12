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

    const { data, error } = await client
        .from(TABLE)
        .select('casting_number, department, day_number, description, casting_side')
        .eq('project_number', pnum)
        .not('casting_number', 'is', null);

    if (error) {
        logger.error('[task-descriptions] fetchForProject error:', error);
        return out;
    }

    for (const row of (data || [])) {
        const key = `${s(row.casting_number)}|${s(row.department)}|${s(row.day_number)}`;
        out.set(key, {
            description: row.description || '',
            castingSide: row.casting_side || null
        });
    }
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
        description: (entry.description != null ? entry.description : ''),
        updated_at: new Date().toISOString()
    };

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
