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
    sealingNotes: 'sealing_notes'
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
        sealingNotes: row.sealing_notes || ''
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
