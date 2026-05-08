/**
 * Tracking Service
 * Per-casting component list (Type / Panel ID / Color / Sealer).
 * Components are not equivalent across castings — each casting owns its own list.
 *
 * Schema: casting_components (id, casting_id FK, type, panel_id, color, sealer, sort_order)
 *
 * @module services/tracking-service
 */

import { initializeSupabase, getSupabaseClient } from './supabase-service.js';
import { logger } from '../utils/logger.js';

const TABLE = 'casting_components';

async function getClient() {
    let client = getSupabaseClient();
    if (!client) {
        client = await initializeSupabase();
    }
    return client;
}

/**
 * Load all components for one casting, ordered by sort_order then created_at.
 * @param {string} castingId
 * @returns {Promise<Array<Object>>}
 */
export async function loadCastingComponents(castingId) {
    if (!castingId) return [];
    const client = await getClient();
    if (!client) return [];

    const { data, error } = await client
        .from(TABLE)
        .select('*')
        .eq('casting_id', castingId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) {
        logger.error('[tracking] loadCastingComponents error:', error);
        throw error;
    }
    return data || [];
}

/**
 * Bulk-load components for many castings in one query.
 * @param {string[]} castingIds
 * @returns {Promise<Map<string, Array<Object>>>} castingId -> ordered rows
 */
export async function loadAllComponentsForProject(castingIds) {
    if (!Array.isArray(castingIds) || castingIds.length === 0) return new Map();
    const client = await getClient();
    if (!client) return new Map();

    const { data, error } = await client
        .from(TABLE)
        .select('*')
        .in('casting_id', castingIds)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) {
        logger.error('[tracking] loadAllComponentsForProject error:', error);
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
 * Insert a new component under a casting. All fields optional — at minimum
 * an empty placeholder row is written so the user can fill it in inline.
 * @param {string} castingId
 * @param {{type?:string, width?:string, length?:string, panel_id?:string, color?:string, sealer?:string, sort_order?:number}} [fields]
 * @returns {Promise<Object>} inserted row
 */
export async function createComponent(castingId, fields = {}) {
    if (!castingId) throw new Error('castingId required');
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    let order = (typeof fields.sort_order === 'number') ? fields.sort_order : null;
    if (order === null) {
        const existing = await loadCastingComponents(castingId);
        order = existing.length > 0
            ? Math.max(...existing.map(c => c.sort_order || 0)) + 1
            : 0;
    }

    const payload = {
        casting_id: castingId,
        type: cleanText(fields.type),
        width: cleanText(fields.width),
        length: cleanText(fields.length),
        panel_id: cleanText(fields.panel_id),
        color: cleanText(fields.color),
        sealer: cleanText(fields.sealer),
        sort_order: order
    };

    const { data, error } = await client
        .from(TABLE)
        .insert(payload)
        .select()
        .maybeSingle();

    if (error) {
        logger.error('[tracking] createComponent error:', error);
        throw error;
    }
    return data;
}

/**
 * Bulk-insert components for one casting in a single round-trip.
 * @param {string} castingId
 * @param {Array<{type?:string, width?:string, length?:string, panel_id?:string, color?:string, sealer?:string}>} items
 * @returns {Promise<Array<Object>>} inserted rows in order
 */
export async function createComponentsBulk(castingId, items) {
    if (!castingId) throw new Error('castingId required');
    if (!Array.isArray(items) || items.length === 0) return [];
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const existing = await loadCastingComponents(castingId);
    const startOrder = existing.length > 0
        ? Math.max(...existing.map(c => c.sort_order || 0)) + 1
        : 0;

    const payload = items.map((item, idx) => ({
        casting_id: castingId,
        type: cleanText(item.type),
        width: cleanText(item.width),
        length: cleanText(item.length),
        panel_id: cleanText(item.panel_id),
        color: cleanText(item.color),
        sealer: cleanText(item.sealer),
        from_inventory: true,
        sort_order: startOrder + idx
    }));

    const { data, error } = await client
        .from(TABLE)
        .insert(payload)
        .select();

    if (error) {
        logger.error('[tracking] createComponentsBulk error:', error);
        throw error;
    }
    return data || [];
}

/**
 * Update one or more fields on a component.
 * @param {string} componentId
 * @param {{type?:string, width?:string, length?:string, panel_id?:string, color?:string, sealer?:string}} fields
 */
export async function updateComponent(componentId, fields) {
    if (!componentId) throw new Error('componentId required');
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const payload = {};
    if (fields.type !== undefined) payload.type = cleanText(fields.type);
    if (fields.width !== undefined) payload.width = cleanText(fields.width);
    if (fields.length !== undefined) payload.length = cleanText(fields.length);
    if (fields.panel_id !== undefined) payload.panel_id = cleanText(fields.panel_id);
    if (fields.color !== undefined) payload.color = cleanText(fields.color);
    if (fields.sealer !== undefined) payload.sealer = cleanText(fields.sealer);
    if (Object.keys(payload).length === 0) return null;

    const { data, error } = await client
        .from(TABLE)
        .update(payload)
        .eq('id', componentId)
        .select()
        .maybeSingle();

    if (error) {
        logger.error('[tracking] updateComponent error:', error);
        throw error;
    }
    return data;
}

/**
 * Delete a component by id.
 * @param {string} componentId
 */
export async function deleteComponent(componentId) {
    if (!componentId) return false;
    const client = await getClient();
    if (!client) return false;

    const { error } = await client
        .from(TABLE)
        .delete()
        .eq('id', componentId);

    if (error) {
        logger.error('[tracking] deleteComponent error:', error);
        throw error;
    }
    return true;
}

/**
 * Delete all components for a casting in one round-trip.
 * @param {string} castingId
 * @returns {Promise<number>} count of rows the operation targeted (best-effort)
 */
export async function deleteAllComponentsForCasting(castingId) {
    if (!castingId) return 0;
    const client = await getClient();
    if (!client) return 0;

    const { error } = await client
        .from(TABLE)
        .delete()
        .eq('casting_id', castingId);

    if (error) {
        logger.error('[tracking] deleteAllComponentsForCasting error:', error);
        throw error;
    }
    return 1;
}

/**
 * Mark a component produced or not. Treated as a fast, single-field write.
 * @param {string} componentId
 * @param {boolean} produced
 */
export async function setComponentProduced(componentId, produced) {
    if (!componentId) throw new Error('componentId required');
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const { data, error } = await client
        .from(TABLE)
        .update({ produced: !!produced })
        .eq('id', componentId)
        .select()
        .maybeSingle();

    if (error) {
        logger.error('[tracking] setComponentProduced error:', error);
        throw error;
    }
    return data;
}

/**
 * Bulk mark many components produced (or not) in a single round-trip.
 * @param {string[]} componentIds
 * @param {boolean} produced
 */
export async function setComponentsProducedBulk(componentIds, produced) {
    if (!Array.isArray(componentIds) || componentIds.length === 0) return;
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const { error } = await client
        .from(TABLE)
        .update({ produced: !!produced })
        .in('id', componentIds);

    if (error) {
        logger.error('[tracking] setComponentsProducedBulk error:', error);
        throw error;
    }
}

/**
 * Update sort_order for a list of component ids in the order given.
 * @param {string[]} idsInOrder
 */
export async function setComponentsOrder(idsInOrder) {
    if (!Array.isArray(idsInOrder) || idsInOrder.length === 0) return;
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    await Promise.all(idsInOrder.map((id, idx) =>
        client.from(TABLE)
            .update({ sort_order: idx })
            .eq('id', id)
    ));
}

function cleanText(v) {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
}
