/**
 * Projects Service
 * CRUD wrapper around the Supabase `projects` table (project_number is the PK).
 * @module services/projects-service
 */

import { initializeSupabase, getSupabaseClient } from './supabase-service.js';
import { logger } from '../utils/logger.js';

const PROJECTS_TABLE = 'projects';

const PROJECT_COLUMNS = [
    'project_number',
    'project_name',
    'status',
    'project_date',
    'project_address',
    'estimator',
    'architect',
    'pm',
    'contact_name',
    'contact_phone',
    'contact_company',
    'contact_email',
    'site_contact',
    'site_phone',
    'delivery_address',
    'site_restrictions',
    'need_by_date',
    'production_start_date',
    'scope_of_work',
    'imperative_information',
    'created_at',
    'updated_at'
];

async function getClient() {
    let client = getSupabaseClient();
    if (!client) {
        client = await initializeSupabase();
    }
    return client;
}

function sanitizeForDb(record) {
    const out = {};
    for (const col of PROJECT_COLUMNS) {
        if (col === 'created_at' || col === 'updated_at') continue;
        if (record[col] !== undefined) {
            const v = record[col];
            out[col] = (v === '' ? null : v);
        }
    }
    return out;
}

/**
 * Load all projects.
 * @returns {Promise<Array<Object>>}
 */
export async function loadAllProjects() {
    const client = await getClient();
    if (!client) return [];

    try {
        const { data, error } = await client
            .from(PROJECTS_TABLE)
            .select('*')
            .order('updated_at', { ascending: false });

        if (error) {
            logger.error('[projects-service] loadAllProjects error:', error);
            throw error;
        }
        return data || [];
    } catch (err) {
        logger.error('[projects-service] loadAllProjects failed:', err);
        return [];
    }
}

/**
 * Load a single project by project_number.
 * @param {string} projectNumber
 * @returns {Promise<Object|null>}
 */
export async function loadProject(projectNumber) {
    if (!projectNumber) return null;
    const client = await getClient();
    if (!client) return null;

    try {
        const { data, error } = await client
            .from(PROJECTS_TABLE)
            .select('*')
            .eq('project_number', projectNumber)
            .maybeSingle();

        if (error) {
            logger.error(`[projects-service] loadProject(${projectNumber}) error:`, error);
            throw error;
        }
        return data || null;
    } catch (err) {
        logger.error('[projects-service] loadProject failed:', err);
        return null;
    }
}

/**
 * Upsert a project record. project_number is the conflict target.
 * @param {Object} project - record fields (must include project_number)
 * @returns {Promise<Object|null>} the upserted row
 */
export async function upsertProject(project) {
    if (!project || !project.project_number) {
        throw new Error('upsertProject requires project_number');
    }
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const payload = sanitizeForDb(project);
    payload.project_number = project.project_number;

    const { data, error } = await client
        .from(PROJECTS_TABLE)
        .upsert(payload, { onConflict: 'project_number' })
        .select()
        .maybeSingle();

    if (error) {
        logger.error('[projects-service] upsertProject error:', error);
        throw error;
    }
    return data;
}

/**
 * Delete a project by project_number.
 * @param {string} projectNumber
 * @returns {Promise<boolean>}
 */
export async function deleteProject(projectNumber) {
    if (!projectNumber) return false;
    const client = await getClient();
    if (!client) return false;

    const { error } = await client
        .from(PROJECTS_TABLE)
        .delete()
        .eq('project_number', projectNumber);

    if (error) {
        logger.error('[projects-service] deleteProject error:', error);
        throw error;
    }
    return true;
}

/**
 * Empty/template record for the form.
 * @returns {Object}
 */
export function createEmptyProject(projectNumber = '') {
    return {
        project_number: projectNumber,
        project_name: '',
        status: 'Pending',
        project_date: '',
        project_address: '',
        estimator: '',
        architect: '',
        contact_name: '',
        contact_phone: '',
        contact_company: '',
        contact_email: '',
        site_contact: '',
        site_phone: '',
        delivery_address: '',
        site_restrictions: '',
        need_by_date: '',
        production_start_date: '',
        scope_of_work: '',
        imperative_information: ''
    };
}
