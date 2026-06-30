/**
 * Castings Service
 * CRUD wrapper around the Supabase `project_castings` table.
 * Castings are scoped to a project and unique within (project_number, casting_number).
 * @module services/castings-service
 */

import { initializeSupabase, getSupabaseClient } from './supabase-service.js';
import { logger } from '../utils/logger.js';

const CASTINGS_TABLE = 'project_castings';

async function getClient() {
    let client = getSupabaseClient();
    if (!client) {
        client = await initializeSupabase();
    }
    return client;
}

/**
 * Load all castings for a project, ordered by user-defined sort_order
 * with casting_number as a stable tiebreaker.
 * @param {string} projectNumber
 * @returns {Promise<Array<Object>>}
 */
export async function loadCastings(projectNumber) {
    if (!projectNumber) return [];
    const client = await getClient();
    if (!client) return [];

    try {
        const { data, error } = await client
            .from(CASTINGS_TABLE)
            .select('*')
            .eq('project_number', projectNumber)
            .order('sort_order', { ascending: true })
            .order('casting_number', { ascending: true });

        if (error) {
            logger.error('[castings-service] loadCastings error:', error);
            throw error;
        }
        return data || [];
    } catch (err) {
        logger.error('[castings-service] loadCastings failed:', err);
        return [];
    }
}

/**
 * Bulk-load castings for many projects in a single query. Mirrors loadCastings()
 * but filters by a set of project numbers and returns only the columns needed to
 * resolve a (project_number, casting_number) pair to its casting `id` — used when
 * enriching the weekly schedule with casting-linked data (e.g. pieces counts).
 * @param {string[]} projectNumbers
 * @returns {Promise<Array<{id: string, project_number: string, casting_number: string}>>}
 */
export async function loadCastingsForProjects(projectNumbers) {
    if (!Array.isArray(projectNumbers) || projectNumbers.length === 0) return [];
    const client = await getClient();
    if (!client) return [];

    try {
        const { data, error } = await client
            .from(CASTINGS_TABLE)
            .select('id, project_number, casting_number')
            .in('project_number', projectNumbers);

        if (error) {
            logger.error('[castings-service] loadCastingsForProjects error:', error);
            throw error;
        }
        return data || [];
    } catch (err) {
        logger.error('[castings-service] loadCastingsForProjects failed:', err);
        return [];
    }
}

/**
 * Insert a new casting.
 * @param {{project_number:string, casting_number:string, description?:string}} casting
 * @returns {Promise<Object>} inserted row
 */
export async function createCasting(casting) {
    if (!casting?.project_number) throw new Error('project_number required');
    if (!casting?.casting_number) throw new Error('casting_number required');
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    let sortOrder = (typeof casting.sort_order === 'number') ? casting.sort_order : null;
    if (sortOrder === null) {
        const existing = await loadCastings(casting.project_number);
        sortOrder = existing.length > 0
            ? Math.max(...existing.map(c => c.sort_order || 0)) + 1
            : 0;
    }

    const payload = {
        project_number: casting.project_number,
        casting_number: casting.casting_number.trim(),
        description: casting.description ? casting.description.trim() : null,
        sort_order: sortOrder
    };
    if (casting.phase_id !== undefined) {
        payload.phase_id = casting.phase_id || null;
    }

    const { data, error } = await client
        .from(CASTINGS_TABLE)
        .insert(payload)
        .select()
        .maybeSingle();

    if (error) {
        logger.error('[castings-service] createCasting error:', error);
        throw error;
    }
    return data;
}

/**
 * Update sort_order for a list of casting ids in the order given.
 * @param {string[]} castingIdsInOrder
 */
export async function setCastingsOrder(castingIdsInOrder) {
    if (!Array.isArray(castingIdsInOrder) || castingIdsInOrder.length === 0) return;
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    await Promise.all(castingIdsInOrder.map((id, idx) =>
        client.from(CASTINGS_TABLE)
            .update({ sort_order: idx })
            .eq('id', id)
    ));
}

/**
 * Update an existing casting by id.
 * @param {string} id
 * @param {{casting_number?:string, description?:string, casting_date?:string|null}} fields
 * @returns {Promise<Object>}
 */
export async function updateCasting(id, fields) {
    if (!id) throw new Error('id required');
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const payload = {};
    if (fields.casting_number !== undefined) payload.casting_number = fields.casting_number.trim();
    if (fields.description !== undefined) payload.description = fields.description ? fields.description.trim() : null;
    if (fields.casting_date !== undefined) payload.casting_date = fields.casting_date || null;

    const { data, error } = await client
        .from(CASTINGS_TABLE)
        .update(payload)
        .eq('id', id)
        .select()
        .maybeSingle();

    if (error) {
        logger.error('[castings-service] updateCasting error:', error);
        throw error;
    }
    return data;
}

/**
 * Delete a casting by id.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteCasting(id) {
    if (!id) return false;
    const client = await getClient();
    if (!client) return false;

    const { error } = await client
        .from(CASTINGS_TABLE)
        .delete()
        .eq('id', id);

    if (error) {
        logger.error('[castings-service] deleteCasting error:', error);
        throw error;
    }
    return true;
}
