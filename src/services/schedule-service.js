/**
 * Plant Schedule service — rows of the scheduler grid (plant_schedule) and its shared settings
 * (plant_schedule_settings). Needs migration/plant-schedule.sql. Until that is run every load
 * returns empty and `isScheduleMigrationPending()` is true so the page can say so.
 *
 * Reads only its own two tables; the scheduler page reads castings / phases through their services.
 *
 * @module services/schedule-service
 */

import { initializeSupabase, getSupabaseClient } from './supabase-service.js';
import { logger } from '../utils/logger.js';

const TABLE = 'plant_schedule';
const SETTINGS_TABLE = 'plant_schedule_settings';
let migrationPending = false;

async function getClient() {
    if (!getSupabaseClient()) await initializeSupabase();
    return getSupabaseClient();
}

function missingTable(error) {
    if (!error) return false;
    const msg = String(error.message || '');
    return error.code === '42P01' || error.code === 'PGRST205' || /does not exist|could not find the table/i.test(msg);
}

export function isScheduleMigrationPending() { return migrationPending; }

/** Rows in a date window (inclusive), oldest first. */
export async function loadScheduleRange(fromIso, toIso) {
    const client = await getClient();
    if (!client) return [];
    const { data, error } = await client.from(TABLE).select('*').gte('date', fromIso).lte('date', toIso).order('date');
    if (error) {
        if (missingTable(error)) { migrationPending = true; return []; }
        logger.error('[schedule] loadScheduleRange', error);
        throw error;
    }
    return data || [];
}

/** Every row of the given castings (any date). */
export async function loadScheduleForCastings(castingIds) {
    const client = await getClient();
    if (!client || !castingIds.length) return [];
    const out = [];
    for (let i = 0; i < castingIds.length; i += 80) {
        const { data, error } = await client.from(TABLE).select('*').in('casting_id', castingIds.slice(i, i + 80)).order('date');
        if (error) {
            if (missingTable(error)) { migrationPending = true; return []; }
            logger.error('[schedule] loadScheduleForCastings', error);
            throw error;
        }
        out.push(...(data || []));
    }
    return out;
}

/** Insert many rows; returns the saved rows (with ids). */
export async function insertScheduleRows(rows) {
    const client = await getClient();
    if (!client || !rows.length) return [];
    const { data, error } = await client.from(TABLE).insert(rows).select();
    if (error) { logger.error('[schedule] insertScheduleRows', error); throw error; }
    return data || [];
}

export async function updateScheduleRow(id, fields) {
    const client = await getClient();
    if (!client) return null;
    const { data, error } = await client.from(TABLE).update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) { logger.error('[schedule] updateScheduleRow', error); throw error; }
    return data;
}

export async function deleteScheduleRow(id) {
    const client = await getClient();
    if (!client) return;
    const { error } = await client.from(TABLE).delete().eq('id', id);
    if (error) { logger.error('[schedule] deleteScheduleRow', error); throw error; }
}

/** Drop a casting's generated rows (phase-driven). Manual rows (no phase) stay unless `all`. */
export async function deleteCastingSchedule(castingId, all = false) {
    const client = await getClient();
    if (!client) return;
    let q = client.from(TABLE).delete().eq('casting_id', castingId);
    if (!all) q = q.not('phase_id', 'is', null);
    const { error } = await q;
    if (error) { logger.error('[schedule] deleteCastingSchedule', error); throw error; }
}

/** Shared settings as one object (keys: dayHours, holidays, weeks, showWeekends …). */
export async function loadScheduleSettings() {
    const client = await getClient();
    if (!client) return {};
    const { data, error } = await client.from(SETTINGS_TABLE).select('key, value');
    if (error) {
        if (missingTable(error)) { migrationPending = true; return {}; }
        logger.error('[schedule] loadScheduleSettings', error);
        return {};
    }
    const out = {};
    for (const r of data || []) out[r.key] = r.value;
    return out;
}

export async function saveScheduleSetting(key, value) {
    const client = await getClient();
    if (!client) return;
    const { error } = await client.from(SETTINGS_TABLE).upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) { logger.error('[schedule] saveScheduleSetting', error); throw error; }
}
