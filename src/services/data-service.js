/**
 * Data Service Module
 * Handles data orchestration between Google Sheets and Supabase
 * Merges tasks from both sources and manages task lifecycle
 *
 * @module services/data-service
 *
 * @claude-context
 * @purpose Orchestrate data fetching from multiple sources and merge results
 * @dependencies sheets-service.js, supabase-service.js, state.js, date-utils.js
 * @used-by app-controller.js (initialization), UI components (refresh)
 * @exports fetchAllTasks, refreshData, mergeTaskSources
 * @modifies state.tasks, state.lastSync
 * @events-emitted data-loaded, data-refreshed
 * @events-listened None directly (services are stateless)
 * @key-functions
 *   - fetchAllTasks() - Fetch and merge from all sources
 *   - refreshData() - Manual refresh trigger
 *   - mergeTasks() - Merge Google Sheets + Supabase tasks
 * @data-flow
 *   1. Fetch from Google Sheets (read-only source)
 *   2. Fetch from Supabase (read/write manual tasks)
 *   3. Merge with manual tasks overriding sheets data
 *   4. Calculate aggregates (day counts)
 *   5. Update global state
 *   6. Emit data-loaded event
 */

import { fetchTasks as fetchSheetsTasks } from './sheets-service.js';
import { loadManualTasks } from './supabase-service.js';
import { parseDate } from '../utils/date-utils.js';
import { showLoading, hideError, showError } from '../utils/ui-utils.js';
import { setAllTasks, getAllTasks } from '../core/state.js';

import { logger } from '../utils/logger.js';

/**
 * Race a promise against a timeout
 * @param {Promise} promise - The promise to race
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} source - Name of the data source (for logging)
 * @returns {Promise} The promise result or empty array on timeout
 */
async function fetchWithTimeout(promise, timeoutMs, source) {
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error(`${source} fetch timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } catch (error) {
        // Re-throw timeout errors
        if (error.message && error.message.includes('timed out')) {
            throw error;
        }
        // Log other errors and re-throw
        logger.error(`❌ ${source} fetch failed:`, error);
        throw error;
    }
}

/**
 * Main data orchestration function
 *
 * Fetches tasks from Google Sheets and Supabase, merges them with manual tasks
 * taking precedence, calculates project day counts, and updates global state.
 *
 * @param {boolean} [silent=false] - If true, skip loading indicators (for background refresh)
 * @param {boolean|null} [suppressEvents=null] - If true, don't emit events. Defaults to silent value if null
 * @returns {Promise<Array>} Combined array of all tasks from both sources
 * @throws {Error} If fetching from either data source fails
 *
 * @example
 * // Normal fetch with loading indicator
 * const tasks = await fetchAllTasks();
 *
 * @example
 * // Silent background refresh
 * const tasks = await fetchAllTasks(true);
 *
 * @example
 * // Silent but still emit events for UI update
 * const tasks = await fetchAllTasks(true, false);
 */
export async function fetchAllTasks(silent = false, suppressEvents = null) {
    console.log('[Startup] Starting fetchAllTasks');
    console.time('[Startup] fetchAllTasks');

    const modalElement = document.getElementById('project-modal');
    const modalOpen = modalElement && modalElement.classList.contains('show');
    const shouldBeSilent = silent || modalOpen;

    // If suppressEvents not explicitly set, default to shouldBeSilent behavior
    const shouldSuppressEvents = suppressEvents !== null ? suppressEvents : shouldBeSilent;

    if (!shouldBeSilent) {
        showLoading(true);
        hideError();
    }

    try {
        // Fetch Google Sheets data and Supabase tasks in parallel for faster loading
        // Google Sheets has a 45s timeout, Supabase has 15s timeout to prevent infinite hanging
        logger.info('🚀 Starting parallel data fetch...');
        console.log('[Startup] Starting parallel data fetch (Google Sheets + Supabase)');
        console.time('[Startup] Parallel data fetch');
        const startTime = performance.now();

        console.log('[Startup] Starting Google Sheets fetch');
        console.time('[Startup] Google Sheets fetch');
        console.log('[Startup] Starting Supabase manual tasks fetch');
        console.time('[Startup] Supabase manual tasks fetch');

        const [sheetsTasks, manualTasks] = await Promise.all([
            fetchWithTimeout(fetchSheetsTasks(), 45000, 'Google Sheets'),
            fetchWithTimeout(loadManualTasks(), 15000, 'Supabase')
        ]);

        console.timeEnd('[Startup] Google Sheets fetch');
        console.timeEnd('[Startup] Supabase manual tasks fetch');
        console.timeEnd('[Startup] Parallel data fetch');

        const fetchTime = (performance.now() - startTime).toFixed(0);
        logger.info(`✅ Parallel data fetch complete in ${fetchTime}ms`);
        logger.info(`   Sheets: ${sheetsTasks.length} tasks, Supabase: ${manualTasks.length} tasks`);

        // Merge tasks, with manual tasks taking precedence for same ID
        console.log('[Startup] Starting task merge');
        console.time('[Startup] Task merge');
        const allTasks = mergeTasks(sheetsTasks, manualTasks);
        console.timeEnd('[Startup] Task merge');

        // Calculate day counts
        console.log('[Startup] Starting day count calculation');
        console.time('[Startup] Day count calculation');
        calculateProjectDayCounts(allTasks);
        console.timeEnd('[Startup] Day count calculation');

        // Update state with fetched tasks (will emit 'tasks:loaded' event unless suppressed)
        console.log('[Startup] Starting state update');
        console.time('[Startup] State update');
        setAllTasks(allTasks, shouldSuppressEvents);
        console.timeEnd('[Startup] State update');

        if (!shouldBeSilent) {
            showLoading(false);
        }

        console.log('[Startup] Emitting TASKS_LOADED event');
        console.timeEnd('[Startup] fetchAllTasks');
        return allTasks;
    } catch (error) {
        console.timeEnd('[Startup] fetchAllTasks');
        logger.error('❌ Failed to fetch tasks:', error);

        // On timeout or fetch failure, keep existing data
        const existingTasks = getAllTasks();

        if (existingTasks && existingTasks.length > 0) {
            logger.warn('⚠️ Keeping existing data due to fetch failure');
            // Don't update state - keep what we have
            if (!shouldBeSilent) {
                showError('Failed to load tasks: ' + error.message);
                showLoading(false);
            }
            throw error; // Re-throw so caller knows it failed
        } else {
            // No existing data, set empty but still throw
            setAllTasks([], shouldSuppressEvents);
            if (!shouldBeSilent) {
                showError('Failed to load tasks: ' + error.message);
                showLoading(false);
            } else {
                logger.error('Silent refresh failed:', error);
            }
            throw error;
        }
    }
}

/**
 * Merge tasks from Google Sheets and Supabase
 *
 * Combines tasks from both sources, with manual tasks taking precedence
 * when IDs conflict. This allows manual tasks to override sheet data.
 *
 * @param {Array<Object>} sheetsTasks - Tasks from Google Sheets
 * @param {Array<Object>} manualTasks - Manual tasks from Supabase
 * @returns {Array<Object>} Merged tasks array with no duplicates
 *
 * @example
 * const sheetsTasks = [{id: '1', project: 'A'}, {id: '2', project: 'B'}];
 * const manualTasks = [{id: '1', project: 'A-Modified'}];
 * const merged = mergeTasks(sheetsTasks, manualTasks);
 * // Result: [{id: '1', project: 'A-Modified'}, {id: '2', project: 'B'}]
 */
export function mergeTasks(sheetsTasks, manualTasks) {
    const manualTaskIds = new Set(manualTasks.map(t => t.id));
    return [...sheetsTasks.filter(t => !manualTaskIds.has(t.id)), ...manualTasks];
}

/**
 * Calculate day counts for all tasks
 *
 * Enriches tasks with formatted day counter strings (e.g., "Day 2 of 5")
 * and flags tasks with missing dates. Modifies tasks in-place.
 *
 * @param {Array<Object>} tasks - Array of task objects to process (modified in-place)
 * @modifies {Array<Object>} tasks - Adds dayCounter and missingDate properties to each task
 *
 * @example
 * const tasks = [{dayNumber: '2', totalDays: '5', date: '2025-01-15'}];
 * calculateProjectDayCounts(tasks);
 * // tasks[0].dayCounter === 'Day 2 of 5'
 * // tasks[0].missingDate === false
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
 * Aggregates tasks by project name, calculating total hours and collecting
 * all tasks for each project. Useful for reporting and project views.
 *
 * @param {Array<Object>} tasks - Array of tasks to summarize
 * @returns {Object<string, {totalHours: number, tasks: Array<Object>}>} Object with project names as keys
 *
 * @example
 * const tasks = [
 *   {project: 'A', hours: '10'},
 *   {project: 'A', hours: '5'},
 *   {project: 'B', hours: '8'}
 * ];
 * const summaries = getProjectSummaries(tasks);
 * // Returns: {
 * //   'A': {totalHours: 15, tasks: [...]},
 * //   'B': {totalHours: 8, tasks: [...]}
 * // }
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
 * Filter tasks by department names
 *
 * Returns only tasks that belong to the specified departments.
 * Returns empty array if no departments specified.
 *
 * @param {Array<Object>} tasks - Array of tasks to filter
 * @param {Array<string>} departments - Array of department names to include
 * @returns {Array<Object>} Filtered tasks matching the department criteria
 *
 * @example
 * const tasks = [
 *   {department: 'Mill', project: 'A'},
 *   {department: 'Cast', project: 'B'},
 *   {department: 'Finish', project: 'C'}
 * ];
 * const filtered = filterTasksByDepartment(tasks, ['Mill', 'Cast']);
 * // Returns: [{department: 'Mill', ...}, {department: 'Cast', ...}]
 */
export function filterTasksByDepartment(tasks, departments) {
    if (!departments || departments.length === 0) {
        return [];
    }

    return tasks.filter(task => departments.includes(task.department));
}
