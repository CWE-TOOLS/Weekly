/**
 * Supabase REST API Fallback
 * Direct REST API calls for browsers that don't support Supabase JS v2
 * Uses plain fetch() - compatible with older browsers
 * @module services/supabase-rest-fallback
 */

import { SUPABASE } from '../config/api-config.js';
import { logger } from '../utils/logger.js';
import { normalizeDepartment } from '../utils/ui-utils.js';
import { normalizeProjectName } from '../utils/ui-utils.js';

/**
 * Fetch task descriptions using REST API (fallback for old browsers)
 * @returns {Promise<Map<string, {description: string, castingSide: string|null}>>}
 *   Map keyed by "project|department|day_number". Mirrors the supabase-js path.
 */
export async function fetchTaskDescriptionsREST() {
    try {
        logger.debug('📥 Fetching task descriptions via REST API (fallback mode)...');

        const url = SUPABASE.URL + '/rest/v1/task_descriptions?limit=10000';

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE.ANON_KEY,
                'Authorization': 'Bearer ' + SUPABASE.ANON_KEY,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        });

        if (!response.ok) {
            throw new Error('REST API request failed: ' + response.status + ' ' + response.statusText);
        }

        const data = await response.json();
        logger.info('📊 REST API returned ' + (data ? data.length : 0) + ' task descriptions');

        // Convert array to Map for fast lookup
        const descriptionsMap = new Map();

        if (data && Array.isArray(data)) {
            data.forEach(function(row) {
                const normalizedProject = normalizeProjectName(row.project);
                const key = normalizedProject + '|' + row.department + '|' + row.day_number;
                descriptionsMap.set(key, {
                    description: row.description || '',
                    castingSide: row.casting_side || null
                });
            });

            logger.info('✅ Loaded ' + descriptionsMap.size + ' task descriptions via REST API');
        }

        return descriptionsMap;
    } catch (error) {
        logger.error('❌ Failed to fetch task descriptions via REST API:', error);
        return new Map();
    }
}

/**
 * Load manual tasks using REST API (fallback for old browsers)
 * @returns {Promise<Array<Object>>} Array of manual tasks
 */
export async function loadManualTasksREST() {
    try {
        logger.debug('📥 Fetching manual tasks via REST API (fallback mode)...');

        const url = SUPABASE.URL + '/rest/v1/' + SUPABASE.TASKS_TABLE + '?order=created_at.desc';

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE.ANON_KEY,
                'Authorization': 'Bearer ' + SUPABASE.ANON_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('REST API request failed: ' + response.status + ' ' + response.statusText);
        }

        const data = await response.json();
        logger.info('📊 REST API returned ' + (data ? data.length : 0) + ' manual tasks');

        // Convert to match Google Sheets task structure
        const manualTasks = [];

        if (data && Array.isArray(data)) {
            data.forEach(function(row) {
                manualTasks.push({
                    id: row.id,
                    week: row.week,
                    project: row.project,
                    projectDescription: row.project_description || '',
                    description: row.description || '',
                    date: row.date,
                    department: normalizeDepartment(row.department),
                    value: row.value || '',
                    hours: row.hours || '',
                    dayNumber: row.day_number || '',
                    totalDays: row.total_days || '',
                    dayCounter: '',
                    missingDate: !row.date,
                    isManual: true
                });
            });

            // Calculate day counters for manual tasks
            if (window.calculateProjectDayCounts) {
                window.calculateProjectDayCounts(manualTasks);
            }

            logger.info('✅ Loaded ' + manualTasks.length + ' manual tasks via REST API');
        }

        return manualTasks;
    } catch (error) {
        logger.error('❌ Failed to load manual tasks via REST API:', error);
        return [];
    }
}
