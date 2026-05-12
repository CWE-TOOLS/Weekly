/**
 * Job Memos Service
 * Per-project timeline log of dated events. One row per memo.
 *
 * Schema: job_memos
 *   - id UUID PK
 *   - project_number TEXT FK -> projects (CASCADE on delete)
 *   - memo_date DATE
 *   - body TEXT
 *   - author TEXT (nullable)
 *   - created_at / updated_at TIMESTAMPTZ
 *
 * Sort order is derived: memo_date DESC, created_at DESC.
 *
 * @module services/job-memos-service
 */

import { initializeSupabase, getSupabaseClient } from './supabase-service.js';
import { logger } from '../utils/logger.js';

const TABLE = 'job_memos';

async function getClient() {
    let client = getSupabaseClient();
    if (!client) client = await initializeSupabase();
    return client;
}

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

function rowToForm(row) {
    if (!row) return null;
    return {
        id: row.id,
        projectNumber: row.project_number,
        memoDate: row.memo_date || todayIso(),
        body: row.body || '',
        author: row.author || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

/**
 * Load all memos for a project, newest first.
 * @param {string} projectNumber
 * @returns {Promise<Array<Object>>}
 */
export async function loadMemosForProject(projectNumber) {
    if (!projectNumber) return [];
    const client = await getClient();
    if (!client) return [];

    const { data, error } = await client
        .from(TABLE)
        .select('*')
        .eq('project_number', projectNumber)
        .order('memo_date', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) {
        logger.error('[job-memos] loadMemosForProject error:', error);
        throw error;
    }
    return (data || []).map(rowToForm);
}

/**
 * Load the most recent memos across ALL projects, newest first.
 * Used by the Recent Memos top-level view.
 * @param {number} [limit=200] maximum rows to return
 * @returns {Promise<Array<Object>>}
 */
export async function loadAllRecentMemos(limit = 200) {
    const client = await getClient();
    if (!client) return [];

    const { data, error } = await client
        .from(TABLE)
        .select('*')
        .order('memo_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        logger.error('[job-memos] loadAllRecentMemos error:', error);
        throw error;
    }
    return (data || []).map(rowToForm);
}

/**
 * Insert a new memo for a project. Defaults date to today, empty body/author.
 * @param {string} projectNumber
 * @param {{memoDate?:string, body?:string, author?:string}} [fields]
 * @returns {Promise<Object>}
 */
export async function createMemoForProject(projectNumber, fields = {}) {
    if (!projectNumber) throw new Error('projectNumber required');
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const payload = {
        project_number: projectNumber,
        memo_date: fields.memoDate || todayIso(),
        body: typeof fields.body === 'string' ? fields.body : '',
        author: typeof fields.author === 'string' && fields.author.trim() !== ''
            ? fields.author.trim()
            : null
    };

    const { data, error } = await client
        .from(TABLE)
        .insert(payload)
        .select()
        .maybeSingle();

    if (error) {
        logger.error('[job-memos] createMemoForProject error:', error);
        throw error;
    }
    return rowToForm(data);
}

/**
 * Update one or more fields on a memo. Server-side updated_at is bumped.
 * @param {string} id
 * @param {{memoDate?:string, body?:string, author?:string}} fields
 */
export async function updateMemo(id, fields) {
    if (!id) throw new Error('id required');
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const payload = {};
    if (fields.memoDate !== undefined) {
        payload.memo_date = fields.memoDate || todayIso();
    }
    if (fields.body !== undefined) {
        payload.body = typeof fields.body === 'string' ? fields.body : '';
    }
    if (fields.author !== undefined) {
        const a = typeof fields.author === 'string' ? fields.author.trim() : '';
        payload.author = a === '' ? null : a;
    }
    if (Object.keys(payload).length === 0) return null;
    payload.updated_at = new Date().toISOString();

    const { data, error } = await client
        .from(TABLE)
        .update(payload)
        .eq('id', id)
        .select()
        .maybeSingle();

    if (error) {
        logger.error('[job-memos] updateMemo error:', error);
        throw error;
    }
    return rowToForm(data);
}

/**
 * Delete a memo by id.
 * @param {string} id
 */
export async function deleteMemo(id) {
    if (!id) return false;
    const client = await getClient();
    if (!client) return false;

    const { error } = await client
        .from(TABLE)
        .delete()
        .eq('id', id);

    if (error) {
        logger.error('[job-memos] deleteMemo error:', error);
        throw error;
    }
    return true;
}
