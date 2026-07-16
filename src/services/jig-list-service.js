/**
 * Jig List Service
 * Per-project state blob for the Jig List tab (ported GFRC Scrim Jig
 * Generator). One row per project.
 *
 * Schema: jig_lists
 *   - project_number TEXT PK FK -> projects (CASCADE on delete)
 *   - data JSONB (the tool's full state object, same shape as its
 *     .jigs.json export files)
 *   - created_at / updated_at TIMESTAMPTZ
 *
 * @module services/jig-list-service
 */

import { initializeSupabase, getSupabaseClient } from './supabase-service.js';
import { logger } from '../utils/logger.js';

const TABLE = 'jig_lists';

async function getClient() {
    let client = getSupabaseClient();
    if (!client) client = await initializeSupabase();
    return client;
}

/**
 * Load the saved jig list state for a project.
 * @param {string} projectNumber
 * @returns {Promise<Object|null>} the state object, or null if none saved
 */
export async function loadJigList(projectNumber) {
    if (!projectNumber) return null;
    const client = await getClient();
    if (!client) return null;

    const { data, error } = await client
        .from(TABLE)
        .select('data')
        .eq('project_number', projectNumber)
        .maybeSingle();

    if (error) {
        logger.error('[jig-list] loadJigList error:', error);
        throw error;
    }
    return data ? data.data : null;
}

/**
 * Save (upsert) the jig list state for a project.
 * @param {string} projectNumber
 * @param {Object} state the tool's full state object
 * @returns {Promise<boolean>}
 */
export async function saveJigList(projectNumber, state) {
    if (!projectNumber) throw new Error('projectNumber required');
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const { error } = await client
        .from(TABLE)
        .upsert({
            project_number: projectNumber,
            data: state || {},
            updated_at: new Date().toISOString()
        }, { onConflict: 'project_number' });

    if (error) {
        logger.error('[jig-list] saveJigList error:', error);
        throw error;
    }
    return true;
}

/**
 * Delete the saved jig list state for a project.
 * @param {string} projectNumber
 */
export async function deleteJigList(projectNumber) {
    if (!projectNumber) return false;
    const client = await getClient();
    if (!client) return false;

    const { error } = await client
        .from(TABLE)
        .delete()
        .eq('project_number', projectNumber);

    if (error) {
        logger.error('[jig-list] deleteJigList error:', error);
        throw error;
    }
    return true;
}
