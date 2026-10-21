/**
 * Milestones Service (2026-10-15)
 *
 * Read/write surface over the `casting_milestones` table: one row per casting per
 * Releasability Board AUTO column. See config/milestones-config.js for the columns and
 * migration/casting-milestones.sql for the table.
 *
 * Until the migration has been run the table does not exist; every call then degrades
 * quietly (loads return empty, saves are no-ops) and `isMilestonesMigrationPending()`
 * is true so the UI can say so once.
 *
 * @module services/milestones-service
 */

import { initializeSupabase, getSupabaseClient, sendRefreshSignal } from './supabase-service.js';
import { logger } from '../utils/logger.js';

const TABLE = 'casting_milestones';
let migrationPending = false;
let warned = false;

async function getClient() {
    if (!getSupabaseClient()) await initializeSupabase();
    return getSupabaseClient();
}

function isMissingTable(err) {
    const msg = String((err && (err.message || err.details || err.hint)) || '');
    return (err && err.code === '42P01') || /casting_milestones/i.test(msg) && /not (exist|found)|schema cache|relation/i.test(msg);
}
function notePending() {
    migrationPending = true;
    if (!warned) {
        warned = true;
        logger.warn('[milestones] casting_milestones table missing — run migration/casting-milestones.sql in the Supabase SQL editor.');
    }
}
export function isMilestonesMigrationPending() { return migrationPending; }

/**
 * Every milestone row of a project.
 * @returns {Promise<Map<string, Map<string, Object>>>} castingId -> milestone -> row
 */
export async function loadMilestonesForProject(projectNumber) {
    const out = new Map();
    if (!projectNumber) return out;
    const client = await getClient();
    if (!client) return out;
    const { data, error } = await client.from(TABLE).select('*').eq('project_number', String(projectNumber));
    if (error) {
        if (isMissingTable(error)) { notePending(); return out; }
        logger.error('[milestones] load failed:', error);
        throw error;
    }
    for (const row of data || []) {
        if (!out.has(row.casting_id)) out.set(row.casting_id, new Map());
        out.get(row.casting_id).set(row.milestone, row);
    }
    migrationPending = false;
    return out;
}

/**
 * Every milestone row of several projects (the weekly's cards).
 * @returns {Promise<{byCasting: Map<string, Map<string, Object>>, touched: Set<string>}>}
 *   byCasting: castingId -> milestone -> row; touched: project numbers that have any row (= on the new format)
 */
export async function loadMilestonesForProjects(projectNumbers) {
    const out = { byCasting: new Map(), touched: new Set() };
    const list = [...new Set((projectNumbers || []).map(p => String(p || '').trim()).filter(Boolean))];
    if (!list.length) return out;
    const client = await getClient();
    if (!client) return out;
    const { data, error } = await client.from(TABLE).select('*').in('project_number', list);
    if (error) {
        if (isMissingTable(error)) { notePending(); return out; }
        logger.error('[milestones] load (projects) failed:', error);
        throw error;
    }
    for (const row of data || []) {
        out.touched.add(String(row.project_number || '').trim());
        if (!out.byCasting.has(row.casting_id)) out.byCasting.set(row.casting_id, new Map());
        out.byCasting.get(row.casting_id).set(row.milestone, row);
    }
    migrationPending = false;
    return out;
}

/**
 * Every milestone row in the database, with the casting's identity for the board.
 * @returns {Promise<Array<Object>>} rows with .casting = {project_number, casting_number, phase_id}
 */
export async function loadAllMilestones() {
    const client = await getClient();
    if (!client) return [];
    const { data, error } = await client
        .from(TABLE)
        .select('*, casting:project_castings(project_number, casting_number, phase_id)');
    if (error) {
        if (isMissingTable(error)) { notePending(); return []; }
        logger.error('[milestones] loadAll failed:', error);
        throw error;
    }
    migrationPending = false;
    return data || [];
}

/** Prefix used in the note of a "Casting Layout" row that was marked green by a special condition. */
export const LAYOUT_CONDITION_PREFIX = 'Special condition: ';

/**
 * Every special layout condition ever used, on any job — the names after the prefix, A→Z.
 * (They live in the notes of "Casting Layout" rows, so a condition is "saved" by being used once.)
 */
export async function loadLayoutConditions() {
    const client = await getClient();
    if (!client) return [];
    const { data, error } = await client
        .from(TABLE)
        .select('note')
        .eq('milestone', 'Casting Layout')
        .like('note', LAYOUT_CONDITION_PREFIX + '%');
    if (error) {
        if (isMissingTable(error)) { notePending(); return []; }
        logger.error('[milestones] loadLayoutConditions failed:', error);
        return [];
    }
    const names = new Set();
    for (const r of data || []) {
        const n = String(r.note || '').slice(LAYOUT_CONDITION_PREFIX.length).trim();
        if (n) names.add(n);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
}

/**
 * Insert-or-update one milestone row (keyed on casting_id + milestone).
 * @param {{projectNumber:string, castingId:string, milestone:string, status:string, locked?:boolean, note?:string|null, stampedAt?:string|null}} m
 * @returns {Promise<Object|null>} the saved row, or null when the table is missing
 */
export async function saveMilestone(m) {
    if (!m || !m.projectNumber || !m.castingId || !m.milestone) throw new Error('milestone needs projectNumber, castingId, milestone');
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');
    const row = {
        project_number: String(m.projectNumber),
        casting_id: m.castingId,
        milestone: m.milestone,
        status: m.status || 'red',
        locked: !!m.locked,
        note: m.note == null ? null : String(m.note),
        stamped_at: m.stampedAt === undefined ? null : m.stampedAt,
        updated_at: new Date().toISOString()
    };
    const { data, error } = await client
        .from(TABLE)
        .upsert(row, { onConflict: 'casting_id,milestone' })
        .select()
        .maybeSingle();
    if (error) {
        if (isMissingTable(error)) { notePending(); return null; }
        logger.error('[milestones] save failed:', error);
        throw error;
    }
    migrationPending = false;
    // Open Releasability Boards refresh themselves on this signal (the weekly ignores it).
    try { await sendRefreshSignal({ action: 'releasability_status_updated', milestone: m.milestone, castingId: m.castingId }); } catch { /* best effort */ }
    return data || row;
}
