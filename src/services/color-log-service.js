/**
 * Color Log Service
 * Persists per-project color log records and a library of standard presets.
 *
 * Schema: color_logs
 *   - is_preset = false, project_number = <X>  → one row per project
 *   - is_preset = true,  project_number = NULL → reusable preset
 *
 * @module services/color-log-service
 */

import { initializeSupabase, getSupabaseClient } from './supabase-service.js';
import { logger } from '../utils/logger.js';

const TABLE = 'color_logs';

const FORM_TO_DB = {
    name: 'name',
    date: 'log_date',
    madeBy: 'made_by',
    temperature: 'temperature',
    project: 'project_text',
    isStandard: 'is_standard',
    cementType: 'cement_type',
    castMethod: 'cast_method',
    baseIngredients: 'base_ingredients',
    additives: 'additives',
    aggregates: 'aggregates',
    pigments: 'pigments',
    groutType: 'grout_type',
    fillCoat: 'fill_coat',
    finishingNotes: 'finishing_notes',
    sealingNotes: 'sealing_notes',
    sortOrder: 'sort_order'
};

async function getClient() {
    let client = getSupabaseClient();
    if (!client) {
        client = await initializeSupabase();
    }
    return client;
}

/**
 * Convert form-shaped object → DB-shaped object.
 * Ignores unknown keys.
 */
function toDb(formObj) {
    const out = {};
    for (const [formKey, dbKey] of Object.entries(FORM_TO_DB)) {
        if (formObj[formKey] !== undefined) {
            const v = formObj[formKey];
            out[dbKey] = (v === '' && (dbKey === 'log_date')) ? null : v;
        }
    }
    return out;
}

/**
 * Convert DB row → form-shaped object.
 */
export function rowToForm(row) {
    if (!row) return null;
    return {
        id: row.id,
        projectNumber: row.project_number || null,
        isPreset: !!row.is_preset,
        presetName: row.preset_name || '',
        name: row.name || '',
        date: row.log_date || '',
        madeBy: row.made_by || '',
        temperature: row.temperature || '',
        project: row.project_text || '',
        isStandard: row.is_standard !== false,
        cementType: row.cement_type || 'white',
        castMethod: row.cast_method || 'sprayUp',
        baseIngredients: Array.isArray(row.base_ingredients) ? row.base_ingredients : [],
        additives:       Array.isArray(row.additives)        ? row.additives        : [],
        aggregates:      Array.isArray(row.aggregates)       ? row.aggregates       : [],
        pigments:        Array.isArray(row.pigments)         ? row.pigments         : [],
        groutType:       Array.isArray(row.grout_type)       ? row.grout_type       : [],
        fillCoat:        Array.isArray(row.fill_coat)        ? row.fill_coat        : [],
        finishingNotes: row.finishing_notes || '',
        sealingNotes: row.sealing_notes || '',
        sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0
    };
}

/**
 * Load the (single) color log for a project, or null if none exists yet.
 * @param {string} projectNumber
 * @returns {Promise<Object|null>} form-shaped record or null
 */
export async function loadColorLogForProject(projectNumber) {
    if (!projectNumber) return null;
    const client = await getClient();
    if (!client) return null;

    const { data, error } = await client
        .from(TABLE)
        .select('*')
        .eq('project_number', projectNumber)
        .eq('is_preset', false)
        .maybeSingle();

    if (error) {
        logger.error('[color-log] loadColorLogForProject error:', error);
        throw error;
    }
    return rowToForm(data);
}

/**
 * Load all non-preset color logs for a project, ordered by sort_order then created_at.
 * Used by the multi-color UI; single-color projects will typically return a 1-element array.
 * @param {string} projectNumber
 * @returns {Promise<Array<Object>>} form-shaped records
 */
export async function loadColorLogsForProject(projectNumber) {
    if (!projectNumber) return [];
    const client = await getClient();
    if (!client) return [];

    const { data, error } = await client
        .from(TABLE)
        .select('*')
        .eq('project_number', projectNumber)
        .eq('is_preset', false)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) {
        logger.error('[color-log] loadColorLogsForProject error:', error);
        throw error;
    }
    return (data || []).map(rowToForm);
}

/**
 * Fetch a single color log by id. Returns null when missing.
 * @param {string} id
 * @returns {Promise<Object|null>} form-shaped record
 */
export async function loadColorLogById(id) {
    if (!id) return null;
    const client = await getClient();
    if (!client) return null;

    const { data, error } = await client
        .from(TABLE)
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error) {
        logger.error('[color-log] loadColorLogById error:', error);
        throw error;
    }
    return rowToForm(data);
}

/**
 * Insert a new (additional) color log for a project.
 * Auto-assigns sort_order to the end of the list and a default name
 * ("Color N") when none is provided.
 * @param {string} projectNumber
 * @param {Object} [fields] - optional starter fields
 * @returns {Promise<Object>} form-shaped record
 */
export async function createColorLogForProject(projectNumber, fields = {}) {
    if (!projectNumber) throw new Error('projectNumber required');
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const existing = await loadColorLogsForProject(projectNumber);
    const nextOrder = existing.length > 0
        ? Math.max(...existing.map(l => l.sortOrder || 0)) + 1
        : 0;
    const name = (fields.name && String(fields.name).trim())
        || `Color ${existing.length + 1}`;

    const payload = toDb({
        ...fields,
        name,
        sortOrder: nextOrder
    });
    payload.project_number = projectNumber;
    payload.is_preset = false;

    const { data, error } = await client
        .from(TABLE)
        .insert(payload)
        .select()
        .maybeSingle();

    if (error) {
        logger.error('[color-log] createColorLogForProject error:', error);
        throw error;
    }
    return rowToForm(data);
}

/**
 * Delete a non-preset color log by id. Caller is responsible for checking
 * usage first (see getColorLogUsageCounts) — components / inventory /
 * batch tickets pointing at this log will have their FKs SET NULL by the
 * schema's ON DELETE rule.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteColorLog(id) {
    if (!id) return false;
    const client = await getClient();
    if (!client) return false;

    const { error } = await client
        .from(TABLE)
        .delete()
        .eq('id', id)
        .eq('is_preset', false);

    if (error) {
        logger.error('[color-log] deleteColorLog error:', error);
        throw error;
    }
    return true;
}

/**
 * Count rows that reference a color log. Used to gate deletion.
 * @param {string} colorLogId
 * @returns {Promise<{components:number, inventory:number, batchTickets:number}>}
 */
export async function getColorLogUsageCounts(colorLogId) {
    const result = { components: 0, inventory: 0, batchTickets: 0 };
    if (!colorLogId) return result;
    const client = await getClient();
    if (!client) return result;

    const [comp, inv, bt] = await Promise.all([
        client.from('casting_components').select('id', { count: 'exact', head: true }).eq('color_log_id', colorLogId),
        client.from('casting_inventory').select('id', { count: 'exact', head: true }).eq('color_log_id', colorLogId),
        client.from('batch_tickets').select('id', { count: 'exact', head: true }).eq('color_log_id', colorLogId)
    ]);
    if (comp.error) { logger.error('[color-log] usage components error:', comp.error); throw comp.error; }
    if (inv.error)  { logger.error('[color-log] usage inventory error:',  inv.error);  throw inv.error;  }
    if (bt.error)   { logger.error('[color-log] usage batch tickets error:', bt.error); throw bt.error;  }

    result.components   = comp.count || 0;
    result.inventory    = inv.count  || 0;
    result.batchTickets = bt.count   || 0;
    return result;
}

/**
 * Persist a new sort order for a list of color log ids.
 * @param {string[]} idsInOrder
 */
export async function setColorLogsOrder(idsInOrder) {
    if (!Array.isArray(idsInOrder) || idsInOrder.length === 0) return;
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    await Promise.all(idsInOrder.map((id, idx) =>
        client.from(TABLE)
            .update({ sort_order: idx })
            .eq('id', id)
            .eq('is_preset', false)
    ));
}

/**
 * Insert or update the color log for a project.
 * If a row already exists for this project_number, updates it; otherwise inserts.
 * @param {string} projectNumber
 * @param {Object} formObj - form-shaped record
 * @returns {Promise<Object>} updated form-shaped record
 */
export async function saveColorLogForProject(projectNumber, formObj) {
    if (!projectNumber) throw new Error('projectNumber required');
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const payload = toDb(formObj);
    payload.project_number = projectNumber;
    payload.is_preset = false;

    let row;
    if (formObj.id) {
        const { data, error } = await client
            .from(TABLE)
            .update(payload)
            .eq('id', formObj.id)
            .select()
            .maybeSingle();
        if (error) {
            logger.error('[color-log] update error:', error);
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
            logger.error('[color-log] insert error:', error);
            throw error;
        }
        row = data;
    }
    return rowToForm(row);
}

/**
 * Load all preset rows (project_number IS NULL, is_preset = true), ordered by name.
 * @returns {Promise<Array<Object>>} array of form-shaped records
 */
export async function loadPresets() {
    const client = await getClient();
    if (!client) return [];

    const { data, error } = await client
        .from(TABLE)
        .select('*')
        .eq('is_preset', true)
        .order('preset_name', { ascending: true });

    if (error) {
        logger.error('[color-log] loadPresets error:', error);
        throw error;
    }
    return (data || []).map(rowToForm);
}

/**
 * Save the current form state as a new standalone preset.
 * The preset is independent — it does not link back to any project.
 * @param {string} presetName
 * @param {Object} formObj - form-shaped record (id/projectNumber are ignored)
 * @returns {Promise<Object>} the inserted preset row, form-shaped
 */
export async function saveAsPreset(presetName, formObj) {
    if (!presetName || !presetName.trim()) {
        throw new Error('presetName required');
    }
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const payload = toDb(formObj);
    payload.is_preset = true;
    payload.project_number = null;
    payload.preset_name = presetName.trim();

    const { data, error } = await client
        .from(TABLE)
        .insert(payload)
        .select()
        .maybeSingle();

    if (error) {
        logger.error('[color-log] saveAsPreset error:', error);
        throw error;
    }
    return rowToForm(data);
}

/**
 * Override an existing preset with the given form state. Keeps the same
 * preset_name (rename via name arg if provided).
 * @param {string} presetId
 * @param {Object} formObj
 * @param {string} [presetName] - if provided, also renames the preset
 * @returns {Promise<Object>} the updated preset row, form-shaped
 */
export async function updatePreset(presetId, formObj, presetName) {
    if (!presetId) throw new Error('presetId required');
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const payload = toDb(formObj);
    payload.is_preset = true;
    payload.project_number = null;
    if (presetName !== undefined && presetName !== null) {
        payload.preset_name = String(presetName).trim();
    }

    const { data, error } = await client
        .from(TABLE)
        .update(payload)
        .eq('id', presetId)
        .eq('is_preset', true)
        .select()
        .maybeSingle();

    if (error) {
        logger.error('[color-log] updatePreset error:', error);
        throw error;
    }
    return rowToForm(data);
}

/**
 * Delete a preset by id.
 * @param {string} presetId
 * @returns {Promise<boolean>}
 */
export async function deletePreset(presetId) {
    if (!presetId) return false;
    const client = await getClient();
    if (!client) return false;

    const { error } = await client
        .from(TABLE)
        .delete()
        .eq('id', presetId)
        .eq('is_preset', true);

    if (error) {
        logger.error('[color-log] deletePreset error:', error);
        throw error;
    }
    return true;
}
