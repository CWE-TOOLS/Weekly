/**
 * Data Service Module
 * Handles data orchestration between Google Sheets and Supabase
 * Merges tasks from both sources and manages task lifecycle
 */

import { fetchTasks as fetchSheetsTasks } from './sheets-service.js';
import { loadManualTasks } from './supabase-service.js';
import { parseDate } from '../utils/date-utils.js';
import { showLoading, hideError, showError } from '../utils/ui-utils.js';
import { setAllTasks } from '../core/state.js';

/**
 * Main data orchestration function
 * Fetches tasks from Google Sheets and Supabase, then merges them
 * Automatically updates the state with fetched tasks
 *
 * @param {boolean} silent - If true, skip loading indicators (for background refresh)
 * @returns {Promise<Array>} Combined array of tasks
 */
export async function fetchAllTasks(silent = false) {
    const modalOpen = document.getElementById('project-modal')?.classList.contains('show');
    const shouldBeSilent = silent || modalOpen;

    if (!shouldBeSilent) {
        showLoading(true);
        hideError();
    }

    try {
        // Fetch Google Sheets data
        const sheetsTasks = await fetchSheetsTasks();

        // Fetch manual tasks from Supabase
        const manualTasks = await loadManualTasks();

        // Merge tasks, with manual tasks taking precedence for same ID
        const allTasks = mergeTasks(sheetsTasks, manualTasks);

        // Calculate day counts
        calculateProjectDayCounts(allTasks);

        // Update state with fetched tasks (will emit 'tasks:loaded' event)
        setAllTasks(allTasks, shouldBeSilent);

        if (!shouldBeSilent) {
            showLoading(false);
        }

        return allTasks;
    } catch (error) {
        if (!shouldBeSilent) {
            showError('Failed to load tasks: ' + error.message);
            showLoading(false);
        } else {
            console.error('Silent refresh failed:', error);
        }
        throw error;
    }
}

/**
 * Merge tasks from Google Sheets and Supabase
 * Manual tasks take precedence over sheet tasks with same ID
 *
 * @param {Array} sheetsTasks - Tasks from Google Sheets
 * @param {Array} manualTasks - Tasks from Supabase
 * @returns {Array} Merged tasks array
 */
export function mergeTasks(sheetsTasks, manualTasks) {
    const manualTaskIds = new Set(manualTasks.map(t => t.id));
    return [...sheetsTasks.filter(t => !manualTaskIds.has(t.id)), ...manualTasks];
}

/**
 * Calculate day counts for all tasks
 * Adds dayCounter property and missingDate flag to each task
 *
 * @param {Array} tasks - Array of task objects to process
 */
export function calculateProjectDayCounts(tasks) {
    tasks.forEach(task => {
        const taskDate = parseDate(task.date);
        if (!taskDate) {
            task.missingDate = true;
        }

        if (task.dayNumber && task.totalDays) {
            const dayNum = parseInt(task.dayNumber);
            const total = parseInt(task.totalDays);
            if (!isNaN(dayNum) && !isNaN(total)) {
                task.dayCounter = `Day ${dayNum} of ${total}`;
            } else {
                task.dayCounter = '';
            }
        } else {
            task.dayCounter = '';
        }
    });
}

/**
 * Get project summaries with total hours and tasks
 *
 * @param {Array} tasks - Array of tasks to summarize
 * @returns {Object} Object with project names as keys and {totalHours, tasks} as values
 */
export function getProjectSummaries(tasks) {
    const projectSummaries = {};

    tasks.forEach(task => {
        if (!task.project) return;

        if (!projectSummaries[task.project]) {
            projectSummaries[task.project] = {
                totalHours: 0,
                tasks: []
            };
        }

        const hours = parseFloat(task.hours);
        if (!isNaN(hours)) {
            projectSummaries[task.project].totalHours += hours;
        }

        projectSummaries[task.project].tasks.push(task);
    });

    return projectSummaries;
}

/**
 * Filter tasks by department
 *
 * @param {Array} tasks - Array of tasks to filter
 * @param {Array<string>} departments - Array of department names
 * @returns {Array} Filtered tasks
 */
export function filterTasksByDepartment(tasks, departments) {
    if (!departments || departments.length === 0) {
        return [];
    }

    return tasks.filter(task => departments.includes(task.department));
}
