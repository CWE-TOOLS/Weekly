/**
 * Finishing Map placements — one row per casting (project_number + casting_number):
 *   area        which plant area the casting sits in (null = still in the queue)
 *   moved_by    who moved it last (free text, remembered per browser)
 *   moved_at    when
 *   shipped_on  the day it left (set by the weekly's last Ship day, or by hand) — hides the card, lists it in the drawer
 * Table: finishing_map (migration/finishing-map.sql). Every write is announced to other open pages by the
 * write announcer in supabase-service (portal_changed:finishing_map).
 */
import { initializeSupabase, getSupabaseClient } from './supabase-service.js';
import { logger } from '../utils/logger.js';

const TABLE = 'finishing_map';
const LOG_TABLE = 'finishing_map_log';
let migrationPending = false;

/** True when the table is not there yet (the page shows a notice instead of failing). */
export function isFinishingMapMigrationPending() { return migrationPending; }

async function client() {
    return getSupabaseClient() || await initializeSupabase();
}

export function placementKey(projectNumber, castingNumber) {
    return `${String(projectNumber || '').trim()}|${String(castingNumber || '').trim()}`;
}

/** @returns {Promise<Map<string, Object>>} key -> row */
export async function loadPlacements() {
    const sb = await client();
    const out = new Map();
    if (!sb) return out;
    const { data, error } = await sb.from(TABLE).select('*').limit(5000);
    if (error) {
        if (/relation .* does not exist|42P01|schema cache/i.test(error.message || '') || error.code === '42P01' || error.code === 'PGRST205') {
            migrationPending = true;
            logger.warn('[finishing-map] table missing — run migration/finishing-map.sql');
            return out;
        }
        throw error;
    }
    migrationPending = false;
    for (const row of data || []) out.set(placementKey(row.project_number, row.casting_number), row);
    return out;
}

/** Create the row for a casting the map sees for the first time (queue, no area). */
export async function ensurePlacements(castings) {
    const sb = await client();
    if (!sb || migrationPending || !castings.length) return;
    const rows = castings.map(c => ({ project_number: c.projectNumber, casting_number: c.castingNumber, area: null }));
    const { error } = await sb.from(TABLE).upsert(rows, { onConflict: 'project_number,casting_number', ignoreDuplicates: true });
    if (error) throw error;
}

export async function setArea(projectNumber, castingNumber, area, movedBy) {
    const sb = await client();
    if (!sb) throw new Error('No database connection');
    const row = {
        project_number: String(projectNumber).trim(),
        casting_number: String(castingNumber).trim(),
        area: area || null,
        moved_by: movedBy || null,
        moved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    const { error } = await sb.from(TABLE).upsert(row, { onConflict: 'project_number,casting_number' });
    if (error) throw error;
}

/** @param {string|null} shippedOn 'YYYY-MM-DD' or null to put the casting back on the map */
export async function setShipped(projectNumber, castingNumber, shippedOn, movedBy) {
    const sb = await client();
    if (!sb) throw new Error('No database connection');
    const row = {
        project_number: String(projectNumber).trim(),
        casting_number: String(castingNumber).trim(),
        shipped_on: shippedOn,
        moved_by: movedBy || null,
        updated_at: new Date().toISOString()
    };
    const { error } = await sb.from(TABLE).upsert(row, { onConflict: 'project_number,casting_number' });
    if (error) throw error;
}

/** One line in the move log. Failures are logged, never thrown: the move itself already saved. */
export async function logMove({ projectNumber, castingNumber, kind, fromArea = null, toArea = null, movedBy = null }) {
    try {
        const sb = await client();
        if (!sb) return;
        const { error } = await sb.from(LOG_TABLE).insert({
            project_number: String(projectNumber).trim(), casting_number: String(castingNumber).trim(),
            kind, from_area: fromArea, to_area: toArea, moved_by: movedBy || null
        });
        if (error) logger.warn('[finishing-map] log insert failed', error);
    } catch (err) { logger.warn('[finishing-map] log insert failed', err); }
}

/** Newest first, within `days`. */
export async function loadLog(days = 60, limit = 1000) {
    const sb = await client();
    if (!sb) return [];
    const since = new Date(); since.setDate(since.getDate() - days);
    const { data, error } = await sb.from(LOG_TABLE).select('*').gte('moved_at', since.toISOString()).order('moved_at', { ascending: false }).limit(limit);
    if (error) { logger.warn('[finishing-map] log load failed', error); return []; }
    return data || [];
}
