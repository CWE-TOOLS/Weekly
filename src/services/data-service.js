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
import { loadManualTasks, fetchTaskDescriptions } from './supabase-service.js';
import { loadAllProjects } from './projects-service.js';
import { loadCastingsForProjects } from './castings-service.js';
import { loadAllInventoryForProject } from './inventory-service.js';
import { parseDate } from '../utils/date-utils.js';
import { setAllTasks, getAllTasks } from '../core/state.js';

import { logger } from '../utils/logger.js';
import { normalizeProjectName, taskDescCastingKey, taskDescNameKey } from '../utils/ui-utils.js';
import { debug } from '../utils/debug.js';

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
 * @param {boolean} [suppressEvents=false] - If true, don't emit events during state update
 * @returns {Promise<Array>} Combined array of all tasks from both sources
 * @throws {Error} If fetching from either data source fails
 *
 * @example
 * // Normal fetch (emits events)
 * const tasks = await fetchAllTasks();
 *
 * @example
 * // Fetch without emitting events
 * const tasks = await fetchAllTasks(false);
 */
export async function fetchAllTasks(suppressEvents = false) {
    debug.log('[Startup] Starting fetchAllTasks');
    debug.time('[Startup] fetchAllTasks');

    try {
        // Fetch Google Sheets data, Supabase manual tasks, and task descriptions in parallel for faster loading
        // Google Sheets has a 45s timeout, Supabase has 15s timeout to prevent infinite hanging
        logger.info('🚀 Starting parallel data fetch...');
        debug.log('[Startup] Starting parallel data fetch (Google Sheets + Supabase manual tasks + Task descriptions)');
        debug.time('[Startup] Parallel data fetch');
        const startTime = performance.now();

        debug.log('[Startup] Starting Google Sheets fetch');
        debug.time('[Startup] Google Sheets fetch');
        debug.log('[Startup] Starting Supabase manual tasks fetch');
        debug.time('[Startup] Supabase manual tasks fetch');
        debug.log('[Startup] Starting Supabase task descriptions fetch');
        debug.time('[Startup] Supabase task descriptions fetch');

        const [sheetsTasks, manualTasks, taskDescriptions, projects] = await Promise.all([
            fetchWithTimeout(fetchSheetsTasks(), 45000, 'Google Sheets'),
            fetchWithTimeout(loadManualTasks(), 15000, 'Supabase'),
            fetchWithTimeout(fetchTaskDescriptions(), 15000, 'Supabase task descriptions'),
            fetchWithTimeout(loadAllProjects(), 15000, 'Supabase projects')
        ]);

        debug.timeEnd('[Startup] Google Sheets fetch');
        debug.timeEnd('[Startup] Supabase manual tasks fetch');
        debug.timeEnd('[Startup] Supabase task descriptions fetch');
        debug.timeEnd('[Startup] Parallel data fetch');

        const fetchTime = (performance.now() - startTime).toFixed(0);
        logger.info(`✅ Parallel data fetch complete in ${fetchTime}ms`);
        logger.info(`   Sheets: ${sheetsTasks.length} tasks, Supabase: ${manualTasks.length} tasks, Descriptions: ${taskDescriptions.size} entries, Projects: ${projects.length}`);

        // Merge tasks, with manual tasks taking precedence for same ID
        debug.log('[Startup] Starting task merge');
        debug.time('[Startup] Task merge');
        const allTasks = mergeTasks(sheetsTasks, manualTasks);
        debug.timeEnd('[Startup] Task merge');

        // Merge task descriptions from Supabase into all tasks
        debug.log('[Startup] Starting description merge');
        debug.time('[Startup] Description merge');
        mergeTaskDescriptions(allTasks, taskDescriptions);
        // Casting side is only ever entered on the Cast row, but it's a
        // property of the casting itself — so Demold tasks for the same
        // (project, casting #) share that side and should show it too. Mirror
        // the board-print renderer's sideByKey trick: index Cast sides, then
        // back-fill onto Demold rows that match. After this, task-card.js's
        // existing castingSide-aware badge renders on Demold cards automatically.
        propagateCastingSideToDemold(allTasks);
        debug.timeEnd('[Startup] Description merge');

        // Resolve project names from the projects table by project_number
        enrichTasksWithProject(allTasks, projects);

        // For tasks linked to a casting in the project portal, attach the
        // casting's total inventory pieces (qty + extras). Non-fatal: on any
        // failure the schedule still renders without pieces counts.
        debug.log('[Startup] Starting pieces enrichment');
        debug.time('[Startup] Pieces enrichment');
        await enrichTasksWithPieces(allTasks);
        debug.timeEnd('[Startup] Pieces enrichment');

        // Calculate day counts
        debug.log('[Startup] Starting day count calculation');
        debug.time('[Startup] Day count calculation');
        calculateProjectDayCounts(allTasks);
        debug.timeEnd('[Startup] Day count calculation');

        // Update state with fetched tasks (will emit 'tasks:loaded' event unless suppressed)
        debug.log('[Startup] Starting state update');
        debug.time('[Startup] State update');
        setAllTasks(allTasks, suppressEvents);
        debug.timeEnd('[Startup] State update');

        debug.log('[Startup] Emitting TASKS_LOADED event');
        debug.timeEnd('[Startup] fetchAllTasks');
        return allTasks;
    } catch (error) {
        debug.timeEnd('[Startup] fetchAllTasks');
        logger.error('❌ Failed to fetch tasks:', error);

        // On timeout or fetch failure, keep existing data
        const existingTasks = getAllTasks();

        if (existingTasks && existingTasks.length > 0) {
            logger.warn('⚠️ Keeping existing data due to fetch failure');
            // Don't update state - keep what we have
            throw error; // Re-throw so caller knows it failed
        } else {
            // No existing data, set empty but still throw
            setAllTasks([], suppressEvents);
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
 * Merge task descriptions from Supabase into task objects
 *
 * Updates tasks with descriptions from the task_descriptions table by matching
 * project, department, and day_number. Manual tasks already have descriptions
 * and are skipped.
 *
 * IMPORTANT: Preserves exact project names (no trimming) when matching.
 *
 * @param {Array<Object>} tasks - Array of task objects to update (modified in-place)
 * @param {Map<string, {description: string, castingSide: string|null}>} descriptionsMap
 *   Map keyed by "project|department|day_number". Each entry carries the
 *   description override plus the optional casting side (Cast-department only).
 * @modifies {Array<Object>} tasks - Adds description and castingSide to each task
 *
 * @example
 * const tasks = [{project: 'Project A', department: 'Mill 1', dayNumber: '1'}];
 * const descriptions = new Map([
 *   ['Project A|Mill 1|1', { description: 'Task description', castingSide: null }]
 * ]);
 * mergeTaskDescriptions(tasks, descriptions);
 */
// Per-(project, casting, department) day index for the given task list — mirrors
// sheets-service computeDayNumbers so the indices match what Staging writes. Computed
// here (not read off task.castingDayNumber) so the weekly merge is robust even when the
// shared task cache still holds tasks parsed before castingDayNumber existed.
function computeCastingDayMap(tasks) {
    const groups = new Map();
    for (const t of tasks) {
        if (t.isManual) continue;
        const proj = (t.projectNumber || '').toString().trim();
        const cast = (t.castingNumber || '').toString().trim();
        if (!proj || !cast || !t.department) continue;
        const key = `${proj}|${cast}|${t.department}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(t);
    }
    const dayByTask = new Map();
    for (const list of groups.values()) {
        list.sort((a, b) => {
            const da = Date.parse(a.date) || 0;
            const db = Date.parse(b.date) || 0;
            if (da !== db) return da - db;
            const ai = parseInt((a.id || '').replace('task-', ''), 10) || 0;
            const bi = parseInt((b.id || '').replace('task-', ''), 10) || 0;
            return ai - bi;
        });
        list.forEach((t, idx) => dayByTask.set(t, String(idx + 1)));
    }
    return dayByTask;
}

export function mergeTaskDescriptions(tasks, descriptionsMap) {
    let matchedCount = 0;
    let skippedManualCount = 0;
    let missingCount = 0;

    // Per-casting day index, computed locally so the merge doesn't depend on cached tasks
    // already carrying castingDayNumber. Same ordering as sheets-service computeDayNumbers.
    const castingDayByTask = computeCastingDayMap(tasks);

    tasks.forEach(task => {
        // Skip manual tasks - they already have descriptions from weekly_tasks table
        if (task.isManual) {
            skippedManualCount++;
            return;
        }

        // Prefer the casting-aware key (a description pinned to this casting's day);
        // fall back to the legacy name+global-day key for rows not yet upgraded.
        const pnum = (task.projectNumber || '').toString().trim();
        const cnum = (task.castingNumber || '').toString().trim();
        const cday = castingDayByTask.get(task) || (task.castingDayNumber || '').toString().trim();
        // Keep the task object consistent so a later weekly-card edit (saveToStaging)
        // writes a casting-aware row rather than a legacy one when the cache is stale.
        if (cday) task.castingDayNumber = cday;

        let entry = null;
        if (pnum && cnum && cday) {
            entry = descriptionsMap.get(taskDescCastingKey(pnum, cnum, task.department, cday));
        }
        if (!entry) {
            entry = descriptionsMap.get(taskDescNameKey(task.project, task.department, task.dayNumber));
        }

        if (entry) {
            task.description = entry.description;
            task.castingSide = entry.castingSide;
            matchedCount++;
        } else {
            // No description found - set to empty string (graceful fallback)
            task.description = task.description || '';
            task.castingSide = null;
            missingCount++;
        }
    });

    logger.info(`📝 Description merge complete: ${matchedCount} matched, ${skippedManualCount} manual tasks skipped, ${missingCount} not found`);

    // Log sample of missing descriptions for debugging (limit to 5)
    if (missingCount > 0) {
        const missingTasks = tasks.filter(t => !t.isManual && !t.description).slice(0, 5);
        if (missingTasks.length > 0) {
            logger.debug('Sample tasks with missing descriptions:', missingTasks.map(t => ({
                project: t.project,
                department: t.department,
                dayNumber: t.dayNumber,
                key: `${t.project}|${t.department}|${t.dayNumber}`
            })));
        }
    }
}

/**
 * Back-fill `castingSide` on Demold tasks from the matching Cast task's side.
 *
 * The task_descriptions table is keyed by (project, department, day_number),
 * so when the user marks Side A/B on a Cast row only the Cast row gets the
 * casting_side. Demold rows for the same physical casting end up with no
 * side and the on-card "Side A/B" badge doesn't render. Side is a property
 * of the casting, not of the day, so it's safe to copy across.
 *
 * Match key is (projectNumber || project) + castingNumber — same composite
 * the board-print renderer uses to resolve sides. Tasks that already have a
 * side set are left alone; this only fills in nulls.
 *
 * @param {Array<Object>} tasks
 */
function propagateCastingSideToDemold(tasks) {
    if (!Array.isArray(tasks) || tasks.length === 0) return;

    const keyFor = (t) => {
        const proj = (t.projectNumber && String(t.projectNumber).trim())
            || String(t.project || '').trim();
        const cast = String(t.castingNumber || '').trim();
        if (!proj || !cast) return null;
        return `${proj.toLowerCase()}|${cast.toLowerCase()}`;
    };

    // Build (project|castingNumber) -> side index from Cast tasks. First Cast
    // row to claim the key wins, which matches the board-print renderer's
    // semantics (sides shouldn't disagree across rows of the same casting).
    const sideByCasting = new Map();
    for (const t of tasks) {
        if (t.department !== 'Cast') continue;
        if (t.castingSide !== 'A' && t.castingSide !== 'B') continue;
        const k = keyFor(t);
        if (k && !sideByCasting.has(k)) sideByCasting.set(k, t.castingSide);
    }
    if (sideByCasting.size === 0) return;

    let filled = 0;
    for (const t of tasks) {
        if (t.department !== 'Demold') continue;
        if (t.castingSide === 'A' || t.castingSide === 'B') continue;
        const k = keyFor(t);
        if (!k) continue;
        const side = sideByCasting.get(k);
        if (side) {
            t.castingSide = side;
            filled++;
        }
    }
    if (filled > 0) {
        logger.info(`📍 Propagated casting side to ${filled} Demold task(s) from matching Cast rows.`);
    }
}

/**
 * Resolve canonical project names from the Supabase `projects` table.
 *
 * For each task whose `projectNumber` (sheet column H) matches a row in
 * `projects.project_number`, sets `task.resolvedProjectName` to
 * `projects.project_name` and `task.resolvedProjectManager` to `projects.pm`.
 * The original `task.project` (sheet name) is preserved so other lookups
 * keyed on it (e.g. task_descriptions) keep working.
 *
 * @param {Array<Object>} tasks - All tasks (modified in-place)
 * @param {Array<Object>} projects - Rows from the `projects` table
 */
export function enrichTasksWithProject(tasks, projects) {
    const byNumber = new Map();
    for (const p of projects || []) {
        const num = String(p.project_number || '').trim();
        if (num) byNumber.set(num, p);
    }

    let matched = 0;
    for (const task of tasks) {
        const num = String(task.projectNumber || '').trim();
        if (!num) continue;
        const project = byNumber.get(num);
        if (project && project.project_name) {
            task.resolvedProjectName = project.project_name;
            matched++;
        }
        if (project && typeof project.pm === 'string' && project.pm.trim()) {
            task.resolvedProjectManager = project.pm.trim();
        }
    }

    logger.info(`🔗 Project linking: ${matched} tasks matched to projects table (of ${tasks.length} total)`);
}

/**
 * Attach a pieces count to tasks that are linked to a casting in the project
 * portal. A task is "casting-linked" when it carries both a projectNumber and a
 * castingNumber (sheet columns H/I). The lookup chain is:
 *   (project_number, casting_number) -> project_castings.id -> casting_inventory
 * and pieces = SUM(quantity + extras) across the casting's inventory rows —
 * mirroring the "X pcs" total shown on the project-portal casting cards.
 *
 * Sets `task.piecesCount` (number) only when the linked casting has inventory.
 * Resilient by design: any failure is logged and swallowed so a Supabase hiccup
 * never blocks the weekly schedule from rendering.
 *
 * @param {Array<Object>} tasks - All tasks (modified in-place)
 */
export async function enrichTasksWithPieces(tasks) {
    try {
        // Candidates: tasks linked to a casting (both project# and casting#).
        const linked = (tasks || []).filter(t =>
            String(t.projectNumber || '').trim() && String(t.castingNumber || '').trim()
        );
        if (linked.length === 0) return;

        // Resolve (project#, casting#) -> casting id via one bulk castings query.
        const projectNumbers = [...new Set(linked.map(t => String(t.projectNumber).trim()))];
        const castings = await loadCastingsForProjects(projectNumbers);
        if (!castings || castings.length === 0) return;

        const idByKey = new Map();
        for (const c of castings) {
            const key = `${String(c.project_number || '').trim()}|${String(c.casting_number || '').trim()}`;
            if (c.id) idByKey.set(key, c.id);
        }

        // Only fetch inventory for castings actually referenced by a task in view.
        const referencedIds = new Set();
        for (const t of linked) {
            const id = idByKey.get(`${String(t.projectNumber).trim()}|${String(t.castingNumber).trim()}`);
            if (id) referencedIds.add(id);
        }
        if (referencedIds.size === 0) return;

        // Sum quantity + extras per casting (same formula as the portal "pcs" total).
        const inventoryByCasting = await loadAllInventoryForProject([...referencedIds]);
        const piecesById = new Map();
        for (const [castingId, rows] of inventoryByCasting) {
            const total = (rows || []).reduce(
                (sum, r) => sum + (parseInt(r.quantity, 10) || 0) + (parseInt(r.extras, 10) || 0),
                0
            );
            if (total > 0) piecesById.set(castingId, total);
        }

        let matched = 0;
        for (const t of linked) {
            const id = idByKey.get(`${String(t.projectNumber).trim()}|${String(t.castingNumber).trim()}`);
            const total = id ? piecesById.get(id) : undefined;
            if (total) { t.piecesCount = total; matched++; }
        }
        logger.info(`🧱 Pieces linking: ${matched} tasks given a pieces count (of ${linked.length} casting-linked)`);
    } catch (err) {
        logger.error('[data-service] enrichTasksWithPieces failed (non-fatal):', err);
    }
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
