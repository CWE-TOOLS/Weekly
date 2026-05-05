/**
 * Casting Inventory Service
 * Per-casting inventory of component types with quantities. Sister to
 * tracking-service.js: this counts "how many of each" (e.g. 5× L2)
 * whereas tracking tracks individual panels (L2.01, L2.02).
 *
 * Schema: casting_inventory
 *   (id, casting_id FK, type, width, length, panel_id, color, sealer,
 *    quantity, sort_order, created_at)
 *
 * @module services/inventory-service
 */

import { initializeSupabase, getSupabaseClient } from './supabase-service.js';
import { logger } from '../utils/logger.js';

const TABLE = 'casting_inventory';

async function getClient() {
    let client = getSupabaseClient();
    if (!client) {
        client = await initializeSupabase();
    }
    return client;
}

/**
 * Load all inventory items for one casting, ordered by sort_order then created_at.
 * @param {string} castingId
 * @returns {Promise<Array<Object>>}
 */
export async function loadCastingInventory(castingId) {
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
        logger.error('[inventory] loadCastingInventory error:', error);
        throw error;
    }
    return data || [];
}

/**
 * Bulk-load inventory for many castings in one query.
 * @param {string[]} castingIds
 * @returns {Promise<Map<string, Array<Object>>>} castingId -> ordered rows
 */
export async function loadAllInventoryForProject(castingIds) {
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
        logger.error('[inventory] loadAllInventoryForProject error:', error);
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
 * Insert a new inventory item under a casting.
 * @param {string} castingId
 * @param {{type?:string, width?:string, length?:string, color?:string, sealer?:string, quantity?:number, extras?:number, cu_ft?:number, ff_sq_ft?:number, sort_order?:number}} [fields]
 * @returns {Promise<Object>} inserted row
 */
export async function createInventoryItem(castingId, fields = {}) {
    if (!castingId) throw new Error('castingId required');
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    let order = (typeof fields.sort_order === 'number') ? fields.sort_order : null;
    if (order === null) {
        const existing = await loadCastingInventory(castingId);
        order = existing.length > 0
            ? Math.max(...existing.map(c => c.sort_order || 0)) + 1
            : 0;
    }

    const payload = {
        casting_id: castingId,
        type: cleanText(fields.type),
        width: cleanText(fields.width),
        length: cleanText(fields.length),
        color: cleanText(fields.color),
        sealer: cleanText(fields.sealer),
        quantity: cleanQty(fields.quantity, 1),
        extras: cleanExtras(fields.extras),
        cu_ft: cleanNumber(fields.cu_ft),
        ff_sq_ft: cleanNumber(fields.ff_sq_ft),
        sort_order: order
    };

    const { data, error } = await client
        .from(TABLE)
        .insert(payload)
        .select()
        .maybeSingle();

    if (error) {
        logger.error('[inventory] createInventoryItem error:', error);
        throw error;
    }
    return data;
}

/**
 * Update one or more fields on an inventory item.
 * @param {string} itemId
 * @param {{type?:string, width?:string, length?:string, color?:string, sealer?:string, quantity?:number, extras?:number, cu_ft?:number, ff_sq_ft?:number}} fields
 */
export async function updateInventoryItem(itemId, fields) {
    if (!itemId) throw new Error('itemId required');
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const payload = {};
    if (fields.type !== undefined) payload.type = cleanText(fields.type);
    if (fields.width !== undefined) payload.width = cleanText(fields.width);
    if (fields.length !== undefined) payload.length = cleanText(fields.length);
    if (fields.color !== undefined) payload.color = cleanText(fields.color);
    if (fields.sealer !== undefined) payload.sealer = cleanText(fields.sealer);
    if (fields.quantity !== undefined) payload.quantity = cleanQty(fields.quantity, 1);
    if (fields.extras !== undefined) payload.extras = cleanExtras(fields.extras);
    if (fields.cu_ft !== undefined) payload.cu_ft = cleanNumber(fields.cu_ft);
    if (fields.ff_sq_ft !== undefined) payload.ff_sq_ft = cleanNumber(fields.ff_sq_ft);
    if (Object.keys(payload).length === 0) return null;

    const { data, error } = await client
        .from(TABLE)
        .update(payload)
        .eq('id', itemId)
        .select()
        .maybeSingle();

    if (error) {
        logger.error('[inventory] updateInventoryItem error:', error);
        throw error;
    }
    return data;
}

/**
 * Delete an inventory item by id.
 * @param {string} itemId
 */
export async function deleteInventoryItem(itemId) {
    if (!itemId) return false;
    const client = await getClient();
    if (!client) return false;

    const { error } = await client
        .from(TABLE)
        .delete()
        .eq('id', itemId);

    if (error) {
        logger.error('[inventory] deleteInventoryItem error:', error);
        throw error;
    }
    return true;
}

/**
 * Update sort_order for a list of inventory ids in the order given.
 * @param {string[]} idsInOrder
 */
export async function setInventoryOrder(idsInOrder) {
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

function cleanQty(v, fallback) {
    if (v === undefined || v === null || v === '') return fallback;
    const n = parseInt(v, 10);
    if (!Number.isFinite(n) || n < 1) return fallback;
    return n;
}

function cleanExtras(v) {
    if (v === undefined || v === null || v === '') return 0;
    const n = parseInt(v, 10);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
}

function cleanNumber(v) {
    if (v === undefined || v === null || v === '') return null;
    const n = (typeof v === 'number') ? v : parseFloat(String(v));
    if (!Number.isFinite(n)) return null;
    return n;
}
