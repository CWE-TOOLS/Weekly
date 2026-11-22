/**
 * Phases Service
 * Project-level phases that scope castings, tracking, shipping,
 * optimizer hours, and batch tickets when enabled. Color Log and the
 * Cover sheet stay project-wide. Phases are one-way: once enabled, stays on.
 *
 * Schema:
 *   project_phases (id, project_number, phase_name, sort_order, created_at)
 *   projects.phases_enabled BOOLEAN
 *   project_castings.phase_id, project_crates.phase_id (nullable FKs)
 *
 * @module services/phases-service
 */

import { initializeSupabase, getSupabaseClient } from './supabase-service.js';
import { logger } from '../utils/logger.js';

const PHASES_TABLE = 'project_phases';
const PROJECTS_TABLE = 'projects';
const CASTINGS_TABLE = 'project_castings';
const CRATES_TABLE = 'project_crates';

async function getClient() {
    let client = getSupabaseClient();
    if (!client) {
        client = await initializeSupabase();
    }
    return client;
}

/**
 * Load all phases for a project, ordered by sort_order then created_at.
 * @param {string} projectNumber
 * @returns {Promise<Array<Object>>}
 */
export async function loadPhasesForProject(projectNumber) {
    if (!projectNumber) return [];
    const client = await getClient();
    if (!client) return [];

    const { data, error } = await client
        .from(PHASES_TABLE)
        .select('*')
        .eq('project_number', String(projectNumber))
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) {
        logger.error('[phases] loadPhasesForProject error:', error);
        throw error;
    }
    return data || [];
}

/**
 * Enable phases for a project atomically:
 *  - flips projects.phases_enabled to TRUE
 *  - creates "Phase 1"
 *  - reassigns all existing project_castings and project_crates for that
 *    project to the new phase
 *
 * Idempotent: if phases are already enabled, returns the existing phase list.
 *
 * @param {string} projectNumber
 * @returns {Promise<{enabled: boolean, phases: Array<Object>}>}
 */
export async function enablePhasesForProject(projectNumber) {
    if (!projectNumber) throw new Error('projectNumber required');
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const projNum = String(projectNumber);

    // Already enabled? Return current state.
    const { data: project, error: projErr } = await client
        .from(PROJECTS_TABLE)
        .select('project_number, phases_enabled')
        .eq('project_number', projNum)
        .maybeSingle();
    if (projErr) {
        logger.error('[phases] enablePhasesForProject project lookup error:', projErr);
        throw projErr;
    }
    if (project?.phases_enabled) {
        const phases = await loadPhasesForProject(projNum);
        return { enabled: true, phases };
    }

    // Create Phase 1.
    const { data: newPhase, error: insErr } = await client
        .from(PHASES_TABLE)
        .insert({
            project_number: projNum,
            phase_name: 'Phase 1',
            sort_order: 0
        })
        .select()
        .maybeSingle();
    if (insErr) {
        logger.error('[phases] enablePhasesForProject createPhase error:', insErr);
        throw insErr;
    }
    if (!newPhase) throw new Error('Failed to create Phase 1');

    // Reassign existing castings + crates to Phase 1.
    const { error: castUpdErr } = await client
        .from(CASTINGS_TABLE)
        .update({ phase_id: newPhase.id })
        .eq('project_number', projNum)
        .is('phase_id', null);
    if (castUpdErr) {
        logger.error('[phases] enablePhasesForProject castings reassign error:', castUpdErr);
        throw castUpdErr;
    }

    const { error: crateUpdErr } = await client
        .from(CRATES_TABLE)
        .update({ phase_id: newPhase.id })
        .eq('project_number', projNum)
        .is('phase_id', null);
    if (crateUpdErr) {
        logger.error('[phases] enablePhasesForProject crates reassign error:', crateUpdErr);
        throw crateUpdErr;
    }

    // Flip the flag last — if any of the above failed we want to retry.
    const { error: flagErr } = await client
        .from(PROJECTS_TABLE)
        .update({ phases_enabled: true })
        .eq('project_number', projNum);
    if (flagErr) {
        logger.error('[phases] enablePhasesForProject flag flip error:', flagErr);
        throw flagErr;
    }

    return { enabled: true, phases: [newPhase] };
}

/**
 * Insert a new phase. Auto-assigns the next sort_order. Auto-names
 * "Phase N" if no name is provided.
 * @param {string} projectNumber
 * @param {{phase_name?:string}} [fields]
 * @returns {Promise<Object>} inserted row
 */
export async function createPhase(projectNumber, fields = {}) {
    if (!projectNumber) throw new Error('projectNumber required');
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const existing = await loadPhasesForProject(projectNumber);
    const nextOrder = existing.length > 0
        ? Math.max(...existing.map(p => p.sort_order || 0)) + 1
        : 0;

    let name = (fields.phase_name || '').trim();
    if (!name) {
        const taken = new Set(existing.map(p => String(p.phase_name || '').trim()).filter(Boolean));
        let n = existing.length + 1;
        while (taken.has(`Phase ${n}`)) n += 1;
        name = `Phase ${n}`;
    }

    const { data, error } = await client
        .from(PHASES_TABLE)
        .insert({
            project_number: String(projectNumber),
            phase_name: name,
            sort_order: nextOrder
        })
        .select()
        .maybeSingle();

    if (error) {
        logger.error('[phases] createPhase error:', error);
        throw error;
    }
    return data;
}

/**
 * Rename a phase by id.
 * @param {string} phaseId
 * @param {string} newName
 */
export async function renamePhase(phaseId, newName) {
    if (!phaseId) throw new Error('phaseId required');
    const trimmed = (newName || '').trim();
    if (!trimmed) throw new Error('phase_name required');

    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const { data, error } = await client
        .from(PHASES_TABLE)
        .update({ phase_name: trimmed })
        .eq('id', phaseId)
        .select()
        .maybeSingle();

    if (error) {
        logger.error('[phases] renamePhase error:', error);
        throw error;
    }
    return data;
}

/**
 * Delete a phase by id. Caller is responsible for ensuring it has no
 * castings or crates (the UI blocks delete otherwise).
 * @param {string} phaseId
 */
export async function deletePhase(phaseId) {
    if (!phaseId) return false;
    const client = await getClient();
    if (!client) return false;

    const { error } = await client
        .from(PHASES_TABLE)
        .delete()
        .eq('id', phaseId);

    if (error) {
        logger.error('[phases] deletePhase error:', error);
        throw error;
    }
    return true;
}

/**
 * Update sort_order for a list of phase ids in the order given.
 * @param {string[]} idsInOrder
 */
export async function setPhasesOrder(idsInOrder) {
    if (!Array.isArray(idsInOrder) || idsInOrder.length === 0) return;
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    await Promise.all(idsInOrder.map((id, idx) =>
        client.from(PHASES_TABLE)
            .update({ sort_order: idx })
            .eq('id', id)
    ));
}

/**
 * Count castings + crates that point at a phase. Used by the UI to
 * block deletion of non-empty phases.
 * @param {string} phaseId
 * @returns {Promise<{castings:number, crates:number}>}
 */
export async function getPhaseUsageCounts(phaseId) {
    if (!phaseId) return { castings: 0, crates: 0 };
    const client = await getClient();
    if (!client) return { castings: 0, crates: 0 };

    const [{ count: cast }, { count: cr }] = await Promise.all([
        client.from(CASTINGS_TABLE).select('id', { count: 'exact', head: true }).eq('phase_id', phaseId),
        client.from(CRATES_TABLE).select('id', { count: 'exact', head: true }).eq('phase_id', phaseId)
    ]);

    return { castings: cast || 0, crates: cr || 0 };
}
