/**
 * Optimizer Hours Service
 * Per-casting phase/task list with hours.
 *
 * Schema: casting_phases (id, casting_id FK, phase_name, hours, sort_order)
 * Each casting owns its own phase list — phases can differ across castings.
 *
 * @module services/optimizer-hours-service
 */

import { initializeSupabase, getSupabaseClient } from './supabase-service.js';
import { logger } from '../utils/logger.js';

const PHASES_TABLE = 'casting_phases';

/**
 * Default phase list seeded into a casting on first Optimizer Hours load.
 */
export const DEFAULT_PHASES = [
    'Mill',
    'Form Out',
    'Cast',
    'DM',
    'G/F',
    'GOF',
    'TU',
    'Rack',
    'Strip',
    'Seal',
    'Build Crate',
    'Load Crate',
    'Ship'
];

async function getClient() {
    let client = getSupabaseClient();
    if (!client) {
        client = await initializeSupabase();
    }
    return client;
}

/**
 * Load all phases for one casting, ordered by sort_order then created_at.
 * @param {string} castingId
 * @returns {Promise<Array<Object>>}
 */
export async function loadCastingPhases(castingId) {
    if (!castingId) return [];
    const client = await getClient();
    if (!client) return [];

    const { data, error } = await client
        .from(PHASES_TABLE)
        .select('*')
        .eq('casting_id', castingId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) {
        logger.error('[optimizer-hours] loadCastingPhases error:', error);
        throw error;
    }
    return data || [];
}

/**
 * Bulk-load phases for many castings in one query.
 * @param {string[]} castingIds
 * @returns {Promise<Map<string, Array<Object>>>} castingId -> ordered phase rows
 */
export async function loadAllCastingPhasesForProject(castingIds) {
    if (!Array.isArray(castingIds) || castingIds.length === 0) return new Map();
    const client = await getClient();
    if (!client) return new Map();

    const { data, error } = await client
        .from(PHASES_TABLE)
        .select('*')
        .in('casting_id', castingIds)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) {
        logger.error('[optimizer-hours] loadAllCastingPhasesForProject error:', error);
        throw error;
    }

    const result = new Map();
    for (const id of castingIds) result.set(id, []);
    for (const row of (data || [])) {
        const list = result.get(row.casting_id);
        if (list) list.push(row);
    }
    return result;
}

/**
 * Insert a new phase under a casting.
 * @param {string} castingId
 * @param {string} phaseName
 * @param {number} [sortOrder]
 * @param {number} [hours=0]
 * @returns {Promise<Object>} inserted row
 */
export async function createCastingPhase(castingId, phaseName, sortOrder, hours = 0) {
    if (!castingId) throw new Error('castingId required');
    const trimmed = (phaseName || '').trim();
    if (!trimmed) throw new Error('phase_name required');

    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    let order = sortOrder;
    if (order === undefined || order === null) {
        const existing = await loadCastingPhases(castingId);
        order = existing.length > 0
            ? Math.max(...existing.map(p => p.sort_order || 0)) + 1
            : 0;
    }

    const { data, error } = await client
        .from(PHASES_TABLE)
        .insert({
            casting_id: castingId,
            phase_name: trimmed,
            hours: Math.max(0, Math.floor(Number(hours) || 0)),
            sort_order: order
        })
        .select()
        .maybeSingle();

    if (error) {
        logger.error('[optimizer-hours] createCastingPhase error:', error);
        throw error;
    }
    return data;
}

/**
 * Rename a phase by id.
 * @param {string} phaseId
 * @param {string} newName
 * @returns {Promise<Object>}
 */
export async function renameCastingPhase(phaseId, newName) {
    if (!phaseId) throw new Error('phaseId required');
    const trimmed = (newName || '').trim();
    if (!trimmed) throw new Error('phase_name required');

    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const { data, error } = await client
        .from(PHASES_TABLE)
        .update({ phase_name: trimmed })
        .eq('id', phaseId)
        .select()
        .maybeSingle();

    if (error) {
        logger.error('[optimizer-hours] renameCastingPhase error:', error);
        throw error;
    }
    return data;
}

/**
 * Delete a phase by id.
 * @param {string} phaseId
 */
export async function deleteCastingPhase(phaseId) {
    if (!phaseId) return false;
    const client = await getClient();
    if (!client) return false;

    const { error } = await client
        .from(PHASES_TABLE)
        .delete()
        .eq('id', phaseId);

    if (error) {
        logger.error('[optimizer-hours] deleteCastingPhase error:', error);
        throw error;
    }
    return true;
}

/**
 * Update hours for a single phase row.
 * @param {string} phaseId
 * @param {number} hours
 */
export async function setCastingPhaseHours(phaseId, hours) {
    if (!phaseId) throw new Error('phaseId required');
    const intHours = Math.max(0, Math.floor(Number(hours) || 0));

    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const { data, error } = await client
        .from(PHASES_TABLE)
        .update({ hours: intHours })
        .eq('id', phaseId)
        .select()
        .maybeSingle();

    if (error) {
        logger.error('[optimizer-hours] setCastingPhaseHours error:', error);
        throw error;
    }
    return data;
}

/**
 * Update sort_order for a list of phase ids in the order given.
 * @param {string[]} phaseIdsInOrder
 */
export async function setCastingPhaseOrder(phaseIdsInOrder) {
    if (!Array.isArray(phaseIdsInOrder) || phaseIdsInOrder.length === 0) return;
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    await Promise.all(phaseIdsInOrder.map((id, idx) =>
        client.from(PHASES_TABLE)
            .update({ sort_order: idx })
            .eq('id', id)
    ));
}

/**
 * Replace a casting's phase list entirely. Used by paste:
 *   - Deletes all existing phases for the casting
 *   - Inserts the provided list (preserving phase_name, sort_order, hours)
 *
 * @param {string} castingId
 * @param {Array<{phase_name:string, hours?:number, sort_order?:number}>} phases
 * @returns {Promise<Array<Object>>} the inserted rows
 */
export async function replaceCastingPhases(castingId, phases) {
    if (!castingId) throw new Error('castingId required');
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    // 1) Delete all existing phases for the casting
    const { error: delErr } = await client
        .from(PHASES_TABLE)
        .delete()
        .eq('casting_id', castingId);
    if (delErr) {
        logger.error('[optimizer-hours] replaceCastingPhases delete error:', delErr);
        throw delErr;
    }

    // 2) Insert new phases
    if (!Array.isArray(phases) || phases.length === 0) return [];

    const rows = phases.map((p, idx) => ({
        casting_id: castingId,
        phase_name: (p.phase_name || '').trim(),
        hours: Math.max(0, Math.floor(Number(p.hours) || 0)),
        sort_order: (typeof p.sort_order === 'number') ? p.sort_order : idx
    })).filter(r => r.phase_name);

    if (rows.length === 0) return [];

    const { data, error: insErr } = await client
        .from(PHASES_TABLE)
        .insert(rows)
        .select();

    if (insErr) {
        logger.error('[optimizer-hours] replaceCastingPhases insert error:', insErr);
        throw insErr;
    }
    return data || [];
}

/**
 * Seed a casting with the default phase list. Idempotent — uses
 * unique(casting_id, phase_name) and ignoreDuplicates.
 * @param {string} castingId
 * @returns {Promise<Array<Object>>} all phases for that casting after seeding
 */
export async function seedDefaultPhasesForCasting(castingId) {
    if (!castingId) throw new Error('castingId required');
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const rows = DEFAULT_PHASES.map((name, idx) => ({
        casting_id: castingId,
        phase_name: name,
        sort_order: idx,
        hours: 0
    }));

    const { error } = await client
        .from(PHASES_TABLE)
        .upsert(rows, { onConflict: 'casting_id,phase_name', ignoreDuplicates: true });

    if (error) {
        logger.error('[optimizer-hours] seedDefaultPhasesForCasting error:', error);
        throw error;
    }
    return loadCastingPhases(castingId);
}
