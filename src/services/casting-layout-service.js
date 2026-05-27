/**
 * Casting Layout Service
 * CRUD wrapper around the Supabase `casting_layout_positions` table.
 *
 * A casting+area is in "manual" mode when it has any rows here: the Casting
 * Layout tab then renders molds from these saved positions instead of running
 * the automatic shelf packer. Positions are inches in area-coordinate space.
 *
 * @module services/casting-layout-service
 */

import { initializeSupabase, getSupabaseClient } from './supabase-service.js';
import { logger } from '../utils/logger.js';

const POSITIONS_TABLE = 'casting_layout_positions';

async function getClient() {
    let client = getSupabaseClient();
    if (!client) {
        client = await initializeSupabase();
    }
    return client;
}

/**
 * Build a clean DB payload from a loose position object. Accepts either
 * snake_case (DB-shaped) or camelCase keys.
 * @param {Object} p
 * @returns {{component_id:string, casting_id:string, area:string, pos_x:number, pos_y:number, rotation:number}}
 */
function toPayload(p) {
    const rotation = Number(p.rotation ?? 0) === 90 ? 90 : 0;
    return {
        component_id: p.component_id ?? p.componentId,
        casting_id: p.casting_id ?? p.castingId,
        area: (p.area === 'A' ? 'A' : 'B'),
        pos_x: Number(p.pos_x ?? p.posX) || 0,
        pos_y: Number(p.pos_y ?? p.posY) || 0,
        rotation,
    };
}

/**
 * Load all saved mold positions for a casting (both areas).
 * @param {string} castingId
 * @returns {Promise<Array<Object>>} rows: {component_id, casting_id, area, pos_x, pos_y, rotation}
 */
export async function loadLayoutPositions(castingId) {
    if (!castingId) return [];
    const client = await getClient();
    if (!client) return [];

    try {
        const { data, error } = await client
            .from(POSITIONS_TABLE)
            .select('*')
            .eq('casting_id', castingId);

        if (error) {
            logger.error('[casting-layout-service] loadLayoutPositions error:', error);
            throw error;
        }
        return data || [];
    } catch (err) {
        logger.error('[casting-layout-service] loadLayoutPositions failed:', err);
        return [];
    }
}

/**
 * Upsert a single mold position (keyed on component_id + area).
 * @param {Object} position - {component_id, casting_id, area, pos_x, pos_y, rotation}
 * @returns {Promise<Object>} the saved row
 */
export async function saveLayoutPosition(position) {
    const payload = toPayload(position);
    if (!payload.component_id) throw new Error('component_id required');
    if (!payload.casting_id) throw new Error('casting_id required');
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const { data, error } = await client
        .from(POSITIONS_TABLE)
        .upsert(payload, { onConflict: 'component_id,area' })
        .select()
        .maybeSingle();

    if (error) {
        logger.error('[casting-layout-service] saveLayoutPosition error:', error);
        throw error;
    }
    return data;
}

/**
 * Bulk-upsert positions — used to "snapshot" an auto-packed layout into manual
 * mode on the first drag.
 * @param {Array<Object>} positions - each {component_id, casting_id, area, pos_x, pos_y, rotation}
 * @returns {Promise<Array<Object>>} the saved rows
 */
export async function snapshotLayout(positions) {
    if (!Array.isArray(positions) || positions.length === 0) return [];
    const payload = positions.map(toPayload);
    if (payload.some(p => !p.component_id || !p.casting_id)) {
        throw new Error('every position needs component_id and casting_id');
    }
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const { data, error } = await client
        .from(POSITIONS_TABLE)
        .upsert(payload, { onConflict: 'component_id,area' })
        .select();

    if (error) {
        logger.error('[casting-layout-service] snapshotLayout error:', error);
        throw error;
    }
    return data || [];
}

/**
 * Delete all saved positions for a casting+area — reverts that layout to
 * automatic packing ("Reset to auto-pack").
 * @param {string} castingId
 * @param {string} area - 'A' or 'B'
 * @returns {Promise<boolean>}
 */
export async function clearLayoutPositions(castingId, area) {
    if (!castingId) return false;
    const client = await getClient();
    if (!client) return false;

    const { error } = await client
        .from(POSITIONS_TABLE)
        .delete()
        .eq('casting_id', castingId)
        .eq('area', area === 'A' ? 'A' : 'B');

    if (error) {
        logger.error('[casting-layout-service] clearLayoutPositions error:', error);
        throw error;
    }
    return true;
}
