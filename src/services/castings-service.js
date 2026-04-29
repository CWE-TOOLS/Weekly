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
 * Load all castings for a project, ordered by casting_number.
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
 * Insert a new casting.
 * @param {{project_number:string, casting_number:string, description?:string}} casting
 * @returns {Promise<Object>} inserted row
 */
export async function createCasting(casting) {
    if (!casting?.project_number) throw new Error('project_number required');
    if (!casting?.casting_number) throw new Error('casting_number required');
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const payload = {
        project_number: casting.project_number,
        casting_number: casting.casting_number.trim(),
        description: casting.description ? casting.description.trim() : null
    };

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
 * Update an existing casting by id.
 * @param {string} id
 * @param {{casting_number?:string, description?:string}} fields
 * @returns {Promise<Object>}
 */
export async function updateCasting(id, fields) {
    if (!id) throw new Error('id required');
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const payload = {};
    if (fields.casting_number !== undefined) payload.casting_number = fields.casting_number.trim();
    if (fields.description !== undefined) payload.description = fields.description ? fields.description.trim() : null;

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
