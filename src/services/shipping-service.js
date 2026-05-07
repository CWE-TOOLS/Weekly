/**
 * Shipping Service
 * Per-project crates list and component-to-crate assignment.
 *
 * Schema: project_crates (id, project_number, crate_number, weight, dimensions, notes, sort_order)
 *         casting_components.crate_id FK → project_crates.id (nullable)
 *
 * @module services/shipping-service
 */

import { initializeSupabase, getSupabaseClient } from './supabase-service.js';
import { logger } from '../utils/logger.js';

const CRATES_TABLE = 'project_crates';
const COMPONENTS_TABLE = 'casting_components';

async function getClient() {
    let client = getSupabaseClient();
    if (!client) {
        client = await initializeSupabase();
    }
    return client;
}

function cleanText(v) {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
}

/**
 * Load all crates for a project, ordered by sort_order then created_at.
 * @param {string} projectNumber
 * @returns {Promise<Array<Object>>}
 */
export async function loadCratesForProject(projectNumber) {
    if (!projectNumber) return [];
    const client = await getClient();
    if (!client) return [];

    const { data, error } = await client
        .from(CRATES_TABLE)
        .select('*')
        .eq('project_number', String(projectNumber))
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) {
        logger.error('[shipping] loadCratesForProject error:', error);
        throw error;
    }
    return data || [];
}

/**
 * Insert a new crate. If crate_number is omitted, auto-generates the next
 * sequential numeric label (1, 2, 3, ...) within the project.
 * @param {string} projectNumber
 * @param {{crate_number?:string, weight?:string, dimensions?:string, notes?:string}} [fields]
 * @returns {Promise<Object>} inserted row
 */
export async function createCrate(projectNumber, fields = {}) {
    if (!projectNumber) throw new Error('projectNumber required');
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const existing = await loadCratesForProject(projectNumber);
    const nextOrder = existing.length > 0
        ? Math.max(...existing.map(c => c.sort_order || 0)) + 1
        : 0;

    let crateNumber = cleanText(fields.crate_number);
    if (!crateNumber) {
        const taken = new Set(existing.map(c => String(c.crate_number || '').trim()).filter(Boolean));
        let n = existing.length + 1;
        while (taken.has(String(n))) n += 1;
        crateNumber = String(n);
    }

    const payload = {
        project_number: String(projectNumber),
        crate_number: crateNumber,
        weight: cleanText(fields.weight),
        dimensions: cleanText(fields.dimensions),
        notes: cleanText(fields.notes),
        sort_order: nextOrder
    };

    const { data, error } = await client
        .from(CRATES_TABLE)
        .insert(payload)
        .select()
        .maybeSingle();

    if (error) {
        logger.error('[shipping] createCrate error:', error);
        throw error;
    }
    return data;
}

/**
 * Update one or more fields on a crate.
 * @param {string} crateId
 * @param {{crate_number?:string, weight?:string, dimensions?:string, notes?:string}} fields
 */
export async function updateCrate(crateId, fields) {
    if (!crateId) throw new Error('crateId required');
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const payload = {};
    if (fields.crate_number !== undefined) payload.crate_number = cleanText(fields.crate_number);
    if (fields.weight !== undefined) payload.weight = cleanText(fields.weight);
    if (fields.dimensions !== undefined) payload.dimensions = cleanText(fields.dimensions);
    if (fields.notes !== undefined) payload.notes = cleanText(fields.notes);
    if (Object.keys(payload).length === 0) return null;

    const { data, error } = await client
        .from(CRATES_TABLE)
        .update(payload)
        .eq('id', crateId)
        .select()
        .maybeSingle();

    if (error) {
        logger.error('[shipping] updateCrate error:', error);
        throw error;
    }
    return data;
}

/**
 * Delete a crate. ON DELETE SET NULL on the FK unassigns any members.
 * @param {string} crateId
 */
export async function deleteCrate(crateId) {
    if (!crateId) return false;
    const client = await getClient();
    if (!client) return false;

    const { error } = await client
        .from(CRATES_TABLE)
        .delete()
        .eq('id', crateId);

    if (error) {
        logger.error('[shipping] deleteCrate error:', error);
        throw error;
    }
    return true;
}

/**
 * Update sort_order for a list of crate ids in the order given.
 * @param {string[]} idsInOrder
 */
export async function setCratesOrder(idsInOrder) {
    if (!Array.isArray(idsInOrder) || idsInOrder.length === 0) return;
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    await Promise.all(idsInOrder.map((id, idx) =>
        client.from(CRATES_TABLE)
            .update({ sort_order: idx })
            .eq('id', id)
    ));
}

/**
 * Assign or unassign a component to a crate.
 * @param {string} componentId
 * @param {string|null} crateId  null/undefined to unassign
 */
export async function setComponentCrate(componentId, crateId) {
    if (!componentId) throw new Error('componentId required');
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const { data, error } = await client
        .from(COMPONENTS_TABLE)
        .update({ crate_id: crateId || null })
        .eq('id', componentId)
        .select()
        .maybeSingle();

    if (error) {
        logger.error('[shipping] setComponentCrate error:', error);
        throw error;
    }
    return data;
}

/**
 * Bulk-assign many components to one crate (or null to unassign).
 * @param {string[]} componentIds
 * @param {string|null} crateId
 */
export async function setComponentsCrateBulk(componentIds, crateId) {
    if (!Array.isArray(componentIds) || componentIds.length === 0) return;
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const { error } = await client
        .from(COMPONENTS_TABLE)
        .update({ crate_id: crateId || null })
        .in('id', componentIds);

    if (error) {
        logger.error('[shipping] setComponentsCrateBulk error:', error);
        throw error;
    }
}
