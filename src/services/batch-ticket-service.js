/**
 * Batch Ticket Service
 * Persists per-casting batch ticket settings + manual batch-type overrides.
 *
 * Schema: batch_tickets
 *   - One row per casting (casting_id is UNIQUE).
 *   - Cascades on casting delete.
 *
 * @module services/batch-ticket-service
 */

import { initializeSupabase, getSupabaseClient } from './supabase-service.js';
import { logger } from '../utils/logger.js';

const TABLE = 'batch_tickets';

const FORM_TO_DB = {
    cuFt: 'cu_ft',
    faceSqFt: 'face_sq_ft',
    cuFtPer250: 'cu_ft_per_250',
    pigReduction: 'pig_reduction',
    batchedBy: 'batched_by',
    outTemp: 'out_temp',
    waterTemp: 'water_temp',
    notes: 'notes',
    batchAssignments: 'batch_assignments'
};

async function getClient() {
    let client = getSupabaseClient();
    if (!client) client = await initializeSupabase();
    return client;
}

function toDb(formObj) {
    const out = {};
    for (const [formKey, dbKey] of Object.entries(FORM_TO_DB)) {
        if (formObj[formKey] !== undefined) {
            const v = formObj[formKey];
            if (v === '' && (dbKey === 'cu_ft' || dbKey === 'face_sq_ft' || dbKey === 'cu_ft_per_250' || dbKey === 'pig_reduction')) {
                out[dbKey] = null;
            } else {
                out[dbKey] = v;
            }
        }
    }
    return out;
}

export function rowToForm(row) {
    if (!row) return null;
    return {
        id: row.id,
        castingId: row.casting_id,
        cuFt: row.cu_ft != null ? String(row.cu_ft) : '',
        faceSqFt: row.face_sq_ft != null ? String(row.face_sq_ft) : '',
        cuFtPer250: row.cu_ft_per_250 != null ? String(row.cu_ft_per_250) : '4.28',
        pigReduction: row.pig_reduction != null ? String(row.pig_reduction) : '50',
        batchedBy: row.batched_by || '',
        outTemp: row.out_temp || '',
        waterTemp: row.water_temp || '',
        notes: row.notes || '',
        batchAssignments: Array.isArray(row.batch_assignments) ? row.batch_assignments : []
    };
}

export function emptyForm(castingId) {
    return {
        id: null,
        castingId: castingId || null,
        cuFt: '',
        faceSqFt: '',
        cuFtPer250: '4.28',
        pigReduction: '50',
        batchedBy: '',
        outTemp: '',
        waterTemp: '',
        notes: '',
        batchAssignments: []
    };
}

/**
 * Load batch ticket for a single casting, or null.
 * @param {string} castingId
 * @returns {Promise<Object|null>}
 */
export async function loadBatchTicketForCasting(castingId) {
    if (!castingId) return null;
    const client = await getClient();
    if (!client) return null;

    const { data, error } = await client
        .from(TABLE)
        .select('*')
        .eq('casting_id', castingId)
        .maybeSingle();

    if (error) {
        logger.error('[batch-ticket] loadForCasting error:', error);
        throw error;
    }
    return rowToForm(data);
}

/**
 * Load all batch tickets whose casting belongs to a given list of casting IDs.
 * Used to bulk-prefetch when activating the tab.
 * @param {Array<string>} castingIds
 * @returns {Promise<Map<string, Object>>} keyed by casting_id
 */
export async function loadBatchTicketsForCastings(castingIds) {
    const map = new Map();
    if (!castingIds?.length) return map;
    const client = await getClient();
    if (!client) return map;

    const { data, error } = await client
        .from(TABLE)
        .select('*')
        .in('casting_id', castingIds);

    if (error) {
        logger.error('[batch-ticket] loadForCastings error:', error);
        throw error;
    }
    for (const row of data || []) {
        map.set(row.casting_id, rowToForm(row));
    }
    return map;
}

/**
 * Insert or update the batch ticket for a casting.
 * @param {string} castingId
 * @param {Object} formObj
 * @returns {Promise<Object>} updated form-shaped record
 */
export async function saveBatchTicketForCasting(castingId, formObj) {
    if (!castingId) throw new Error('castingId required');
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const payload = toDb(formObj);
    payload.casting_id = castingId;

    let row;
    if (formObj.id) {
        const { data, error } = await client
            .from(TABLE)
            .update(payload)
            .eq('id', formObj.id)
            .select()
            .maybeSingle();
        if (error) {
            logger.error('[batch-ticket] update error:', error);
            throw error;
        }
        row = data;
    } else {
        const { data, error } = await client
            .from(TABLE)
            .insert(payload)
            .select()
            .maybeSingle();
        if (error) {
            logger.error('[batch-ticket] insert error:', error);
            throw error;
        }
        row = data;
    }
    return rowToForm(row);
}
