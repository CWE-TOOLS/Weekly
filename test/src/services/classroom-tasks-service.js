/**
 * Classroom Tasks Service
 * CRUD wrapper around the Supabase `project_classroom_tasks` table.
 * Tasks are scoped to a project + classroom (1, 2, or 3).
 * @module services/classroom-tasks-service
 */

import { initializeSupabase, getSupabaseClient } from './supabase-service.js';
import { logger } from '../utils/logger.js';

const TABLE = 'project_classroom_tasks';

async function getClient() {
    let client = getSupabaseClient();
    if (!client) {
        client = await initializeSupabase();
    }
    return client;
}

/**
 * Load all classroom tasks for a project (across all 3 classrooms).
 * @param {string} projectNumber
 * @returns {Promise<Array<Object>>}
 */
export async function loadClassroomTasks(projectNumber) {
    if (!projectNumber) return [];
    const client = await getClient();
    if (!client) return [];

    try {
        const { data, error } = await client
            .from(TABLE)
            .select('*')
            .eq('project_number', projectNumber)
            .order('classroom', { ascending: true })
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) {
            logger.error('[classroom-tasks-service] loadClassroomTasks error:', error);
            throw error;
        }
        return data || [];
    } catch (err) {
        logger.error('[classroom-tasks-service] loadClassroomTasks failed:', err);
        return [];
    }
}

/**
 * Create a classroom task.
 * @param {Object} task
 * @param {string} task.project_number
 * @param {number} task.classroom - 1 | 2 | 3
 * @param {string} [task.description]
 * @param {string} [task.assignee]
 * @param {boolean} [task.is_completed]
 * @param {number} [task.sort_order]
 * @returns {Promise<Object>} the created row
 */
export async function createClassroomTask(task) {
    if (!task || !task.project_number || !task.classroom) {
        throw new Error('createClassroomTask requires project_number and classroom');
    }
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const payload = {
        project_number: task.project_number,
        classroom: task.classroom,
        description: task.description ?? '',
        assignee: task.assignee ?? '',
        is_completed: !!task.is_completed,
        sort_order: typeof task.sort_order === 'number' ? task.sort_order : 0
    };

    const { data, error } = await client
        .from(TABLE)
        .insert(payload)
        .select()
        .single();

    if (error) {
        logger.error('[classroom-tasks-service] createClassroomTask error:', error);
        throw error;
    }
    return data;
}

/**
 * Update fields on a classroom task.
 * @param {string} id
 * @param {Object} fields - any subset of { description, assignee, is_completed }
 * @returns {Promise<Object|null>}
 */
export async function updateClassroomTask(id, fields) {
    if (!id) return null;
    const client = await getClient();
    if (!client) return null;

    const allowed = ['description', 'assignee', 'is_completed'];
    const payload = {};
    for (const k of allowed) {
        if (fields[k] !== undefined) payload[k] = fields[k];
    }
    if (Object.keys(payload).length === 0) return null;

    const { data, error } = await client
        .from(TABLE)
        .update(payload)
        .eq('id', id)
        .select()
        .maybeSingle();

    if (error) {
        logger.error('[classroom-tasks-service] updateClassroomTask error:', error);
        throw error;
    }
    return data;
}

/**
 * Delete a classroom task.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteClassroomTask(id) {
    if (!id) return false;
    const client = await getClient();
    if (!client) return false;

    const { error } = await client
        .from(TABLE)
        .delete()
        .eq('id', id);

    if (error) {
        logger.error('[classroom-tasks-service] deleteClassroomTask error:', error);
        throw error;
    }
    return true;
}

/**
 * Persist the new sort order for a list of task ids (within one classroom).
 * @param {Array<string>} taskIdsInOrder
 * @returns {Promise<void>}
 */
export async function setClassroomTasksOrder(taskIdsInOrder) {
    if (!Array.isArray(taskIdsInOrder) || taskIdsInOrder.length === 0) return;
    const client = await getClient();
    if (!client) return;

    const updates = taskIdsInOrder.map((id, index) =>
        client.from(TABLE).update({ sort_order: index }).eq('id', id)
    );
    const results = await Promise.all(updates);
    for (const r of results) {
        if (r.error) logger.error('[classroom-tasks-service] setClassroomTasksOrder error:', r.error);
    }
}
