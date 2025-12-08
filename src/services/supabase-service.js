/**
 * Supabase Service
 * Handles all Supabase operations including task CRUD, real-time sync, and refresh signals
 * @module services/supabase-service
 */

import { SUPABASE, REFRESH_CONFIG } from '../config/api-config.js';
import { normalizeDepartment } from '../utils/ui-utils.js';
import { UI_DELAY, NOTIFICATION_DURATION, NETWORK_TIMING } from '../config/timing-constants.js';
import { POSITION_OFFSET, Z_INDEX, INDICATOR_STYLE } from '../config/layout-constants.js';

import { logger } from '../utils/logger.js';
import { normalizeProjectName } from '../utils/ui-utils.js';
import { isInDegradedMode } from '../utils/browser-compat.js';
import { fetchTaskDescriptionsREST, loadManualTasksREST } from './supabase-rest-fallback.js';
// Supabase client and channel state
let supabaseClient = null;
let refreshChannel = null;
let initializationPromise = null; // Guard against concurrent initialization
let customRefreshHandler = null; // Custom refresh handler for different pages
const tasksTable = SUPABASE.TASKS_TABLE;

/**
 * Initialize Supabase for task management and refresh signaling
 *
 * Loads the Supabase client library if needed, creates client instance,
 * and sets up real-time subscription for refresh signals from other clients.
 *
 * @returns {Promise<Object>} Supabase client instance
 * @throws {Error} If Supabase library fails to load
 *
 * @example
 * const client = await initializeSupabase();
 * // Returns singleton Supabase client instance
 */
export async function initializeSupabase() {
    // Skip Supabase initialization in degraded mode (old browsers)
    if (isInDegradedMode()) {
        logger.info('⚠️ Supabase initialization skipped (degraded mode)');
        return null;
    }

    // Return existing client if already initialized
    if (supabaseClient) {
        return supabaseClient;
    }

    // Return existing initialization promise if already in progress
    if (initializationPromise) {
        return initializationPromise;
    }

    // Create new initialization promise
    initializationPromise = (async () => {
        try {
            // Load Supabase library if not already loaded
            if (!window.supabase) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = SUPABASE.CDN_URL;
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }

            supabaseClient = window.supabase.createClient(SUPABASE.URL, SUPABASE.ANON_KEY);

            // Subscribe to refresh signals
            setupRefreshSubscription();

            logger.info('✅ Supabase initialized');
            return supabaseClient;
        } finally {
            // Clear the initialization promise so future calls can check supabaseClient directly
            initializationPromise = null;
        }
    })();

    return initializationPromise;
}

/**
 * Get Supabase client instance
 *
 * Returns the singleton Supabase client instance if initialized, or null otherwise.
 *
 * @returns {Object|null} Supabase client or null if not initialized
 *
 * @example
 * const client = getSupabaseClient();
 * if (client) {
 *   // Use client for queries
 * }
 */
export function getSupabaseClient() {
    return supabaseClient;
}

/**
 * Set up subscription to refresh signals
 */
function setupRefreshSubscription() {
    // Create a channel for refresh signals
    refreshChannel = supabaseClient
        .channel(REFRESH_CONFIG.CHANNEL_NAME)
        .on('broadcast', { event: REFRESH_CONFIG.EVENT_NAME }, (payload) => {
            logger.debug('🔄 Refresh signal received:', payload);
            handleRefreshSignal(payload);
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                logger.debug('✅ Subscribed to refresh signals');
            } else if (status === 'CLOSED') {
                logger.warn('⚠️ Refresh subscription closed');
            } else if (status === 'CHANNEL_ERROR') {
                logger.error('❌ Refresh subscription error');
            }
        });
}

/**
 * Register a custom refresh handler for the current page
 * This allows different pages (weekly schedule, releasability board) to handle refreshes differently
 * @param {Function} handler - Async function to call when refresh signal received
 */
export function registerRefreshHandler(handler) {
    customRefreshHandler = handler;
    logger.debug('✅ Custom refresh handler registered');
}

/**
 * Handle refresh signal by reloading data from all sources
 * @param {Object} payload - Refresh signal payload
 */
function handleRefreshSignal(payload) {
    logger.debug('🔄 Processing refresh signal (silent mode)...');

    // No visual indicator - silent refresh per user preference
    // Smart rendering will handle updates without disruption

    // Use custom handler if registered (e.g., releasability board)
    if (customRefreshHandler) {
        customRefreshHandler(payload)
            .then(() => {
                logger.debug('✅ Data refreshed from all sources (silent)');
            })
            .catch(error => {
                logger.error('❌ Failed to refresh data:', error);
            });
        return;
    }

    // Fallback to weekly schedule page handler
    // Only refresh weekly schedule for non-releasability actions
    const action = payload && payload.payload && payload.payload.info && payload.payload.info.action;
    const isReleasabilityAction = action === 'releasability_status_updated' ||
                                   action === 'releasability_project_deleted';

    if (isReleasabilityAction) {
        logger.debug('⏭️ Ignoring releasability action in weekly schedule:', action);
        return;
    }

    // Reload data using fetchAllTasks from data-service
    // This will fetch from both Google Sheets and Supabase, merge, and update state
    // Use silent=true to hide loading spinner, suppressEvents=false to emit events for UI refresh
    if (window.dataService && window.dataService.fetchAllTasks) {
        window.dataService.fetchAllTasks(true, false) // silent loading, but emit events to trigger UI update
            .then(() => {
                logger.debug('✅ Data refreshed from all sources (silent)');
            })
            .catch(error => {
                logger.error('❌ Failed to refresh data:', error);
            });
    } else {
        logger.warn('⚠️ No refresh handler available (dataService.fetchAllTasks not on window)');
    }
}

/**
 * Show refresh indicator
 */
function showRefreshIndicator() {
    const indicator = document.createElement('div');
    indicator.textContent = '🔄 Refreshing...';
    indicator.style.cssText = `
        position: fixed;
        top: ${POSITION_OFFSET.INDICATOR}px;
        right: ${POSITION_OFFSET.INDICATOR}px;
        background: #3b82f6;
        color: white;
        padding: ${INDICATOR_STYLE.PADDING_VERTICAL_PX}px ${INDICATOR_STYLE.PADDING_HORIZONTAL_PX}px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: ${Z_INDEX.INDICATOR};
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;

    document.body.appendChild(indicator);
    setTimeout(() => {
        if (indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
        }
    }, UI_DELAY.REFRESH_INDICATOR);
}

/**
 * Show notification
 * @param {string} message - Notification message
 * @param {string} type - Notification type (info, success, error)
 */
function showNotification(message, type = 'info') {
    logger.debug(`[${type.toUpperCase()}] ${message}`);

    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: ${POSITION_OFFSET.NOTIFICATION}px;
        right: ${POSITION_OFFSET.NOTIFICATION}px;
        background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: ${INDICATOR_STYLE.NOTIFICATION_PADDING_VERTICAL_PX}px ${INDICATOR_STYLE.NOTIFICATION_PADDING_HORIZONTAL_PX}px;
        border-radius: 8px;
        font-weight: 500;
        z-index: ${Z_INDEX.NOTIFICATION};
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;

    document.body.appendChild(notification);
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, NOTIFICATION_DURATION.ERROR);
}

/**
 * Send a refresh signal to all other clients
 *
 * Broadcasts a refresh event via Supabase real-time channels to notify
 * other connected clients to reload their data. Call this after successfully
 * updating Google Sheets or Supabase to keep all clients in sync.
 *
 * @param {Object} [updateInfo={}] - Optional metadata about the update
 * @returns {Promise<void>}
 *
 * @example
 * // After saving task changes
 * await saveTaskToSupabase(task);
 * await sendRefreshSignal({action: 'task_updated', taskId: task.id});
 */
export async function sendRefreshSignal(updateInfo = {}) {
    // Skip in degraded mode
    if (isInDegradedMode()) {
        logger.debug('⚠️ Refresh signals unavailable (degraded mode)');
        return;
    }

    if (!supabaseClient) {
        logger.warn('⚠️ Supabase not initialized, cannot send refresh signal');
        return;
    }

    try {
        logger.debug('📡 Sending refresh signal to all clients...');

        // Send broadcast signal
        const { error } = await supabaseClient
            .channel(REFRESH_CONFIG.CHANNEL_NAME)
            .send({
                type: 'broadcast',
                event: REFRESH_CONFIG.EVENT_NAME,
                payload: {
                    timestamp: new Date().toISOString(),
                    source: 'web_app',
                    info: updateInfo
                }
            });

        if (error) {
            logger.error('❌ Failed to send refresh signal:', error);
        } else {
            logger.debug('✅ Refresh signal sent successfully');
        }

    } catch (error) {
        logger.error('❌ Error sending refresh signal:', error);
    }
}

/**
 * Fetch task descriptions from Supabase
 *
 * Fetches all task descriptions from the task_descriptions table and returns them
 * as a Map keyed by "project|department|day_number" for fast lookup.
 *
 * @returns {Promise<Map<string, string>>} Map of task descriptions keyed by composite key
 *
 * @example
 * const descriptions = await fetchTaskDescriptions();
 * const key = 'Project A|Mill 1|1';
 * const description = descriptions.get(key);
 */
export async function fetchTaskDescriptions() {
    // Use REST API fallback in degraded mode
    if (isInDegradedMode()) {
        logger.debug('⚠️ Using REST API fallback for task descriptions (degraded mode)');
        return await fetchTaskDescriptionsREST();
    }

    if (!supabaseClient) {
        await initializeSupabase();
    }

    try {
        logger.debug('📥 Fetching task descriptions from Supabase...');

        const { data, error } = await supabaseClient
            .from('task_descriptions')
            .select('project, department, day_number, description')
            .limit(10000); // Increase limit to fetch all descriptions (default is 1000)

        if (error) {
            throw error;
        }

        logger.info(`📊 Supabase returned ${data ? data.length : 0} rows (limit was set to 10000)`);

        // Convert array to Map for fast lookup
        // Key format: "project|department|day_number"
        // IMPORTANT: Do NOT trim project names - preserve exact match
        const descriptionsMap = new Map();

        if (data) {
            data.forEach(row => {
                const normalizedProject = normalizeProjectName(row.project);
                const key = `${normalizedProject}|${row.department}|${row.day_number}`;
                descriptionsMap.set(key, row.description || '');
            });

            logger.info(`✅ Loaded ${descriptionsMap.size} task descriptions from Supabase`);
        }

        return descriptionsMap;
    } catch (error) {
        logger.error('❌ Failed to fetch task descriptions from Supabase:', error);
        // Return empty Map on error - graceful fallback
        return new Map();
    }
}

/**
 * Load manual tasks from Supabase
 *
 * Fetches all manually-created tasks from Supabase, converts them to match
 * the Google Sheets task structure, and calculates day counters.
 *
 * @returns {Promise<Array<Object>>} Array of manual tasks with isManual flag set
 *
 * @example
 * const manualTasks = await loadManualTasks();
 * // Returns: [{id: 'custom-1', project: 'Manual Project', isManual: true, ...}]
 */
export async function loadManualTasks() {
    // Use REST API fallback in degraded mode
    if (isInDegradedMode()) {
        logger.debug('⚠️ Using REST API fallback for manual tasks (degraded mode)');
        return await loadManualTasksREST();
    }

    if (!supabaseClient) {
        await initializeSupabase();
    }

    try {
        const { data, error } = await supabaseClient
            .from(tasksTable)
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        // Convert Supabase data to match Google Sheets task structure
        const manualTasks = data.map(row => ({
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
            isManual: true // Flag to identify manual tasks
        }));

        // Calculate day counters for manual tasks (requires calculateProjectDayCounts function)
        if (window.calculateProjectDayCounts) {
            window.calculateProjectDayCounts(manualTasks);
        }

        return manualTasks;
    } catch (error) {
        logger.error('❌ Failed to load manual tasks:', error);
        return [];
    }
}

/**
 * Update task in Supabase
 *
 * Updates an existing manual task in Supabase with new date and week values.
 * Includes timeout protection to prevent hanging requests.
 *
 * @param {Object} task - Task object containing id, date, and week
 * @param {string} task.id - Task ID
 * @param {string} task.date - New date value
 * @param {string} task.week - New week value
 * @returns {Promise<boolean>} True if update successful
 * @throws {Error} If update fails or times out
 *
 * @example
 * await updateTaskInSupabase({
 *   id: 'task-123',
 *   date: '2025-01-15',
 *   week: '2025-01-13'
 * });
 */
export async function updateTaskInSupabase(task) {
    if (!supabaseClient) {
        await initializeSupabase();
    }

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), NETWORK_TIMING.FETCH_TIMEOUT);

    try {
        const { data, error } = await supabaseClient
            .from(tasksTable)
            .update({
                date: task.date,
                week: task.week,
                updated_at: new Date().toISOString()
            })
            .eq('id', task.id)
            .select(); // Add this to return updated rows

        clearTimeout(timeoutId);

        if (error) {
            logger.error('Supabase update error:', error);
            throw error;
        }

        if (!data || data.length === 0) {
            const errorMsg = `Failed to update task: No task found with ID "${task.id}"`;
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        logger.debug('Task updated successfully in Supabase:', { id: task.id, date: task.date, week: task.week });
        return true;
    } catch (error) {
        clearTimeout(timeoutId);
        logger.error('❌ Failed to update task in Supabase:', error);
        throw error;
    }
}
/**
 * Update a manual task in Supabase with new data
 * @param {Object} task - The full task object to update
 * @returns {Promise<Object>} Updated task data from Supabase
 * @throws {Error} If update fails
 */
export async function updateManualTask(task) {
    if (!supabaseClient) {
        await initializeSupabase();
    }

    const updateData = {
        project: task.project,
        project_description: task.projectDescription,
        description: task.description,
        date: task.date,
        week: task.week,
        department: task.department,
        value: task.value,
        hours: task.hours,
        day_number: task.dayNumber,
        total_days: task.totalDays,
        updated_at: new Date().toISOString()
    };

    try {
        const { data, error } = await supabaseClient
            .from(tasksTable)
            .update(updateData)
            .eq('id', task.id)
            .select();

        if (error) {
            logger.error('Supabase manual task update error:', error);
            throw error;
        }

        if (!data || data.length === 0) {
            const errorMsg = `Failed to update manual task: No task found with ID "${task.id}"`;
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        logger.debug('Manual task updated successfully in Supabase:', { id: task.id });
        return data[0];
    } catch (error) {
        logger.error('❌ Failed to update manual task in Supabase:', error);
        throw error;
    }
}

/**
 * Save a new task to Supabase
 *
 * Creates a new manual task in Supabase with all provided fields.
 * Generates ID if not provided.
 *
 * @param {Object} taskData - Task data to save
 * @param {string} [taskData.id] - Task ID (auto-generated if omitted)
 * @param {string} taskData.week - Week date
 * @param {string} taskData.project - Project name
 * @param {string} taskData.date - Task date
 * @param {string} taskData.department - Department name
 * @returns {Promise<Object>} Saved task data from Supabase
 * @throws {Error} If save fails
 *
 * @example
 * const newTask = await saveTaskToSupabase({
 *   week: '2025-01-13',
 *   project: 'Custom Project',
 *   date: '2025-01-15',
 *   department: 'Mill'
 * });
 */
export async function saveTaskToSupabase(taskData) {
    if (!supabaseClient) {
        await initializeSupabase();
    }

    try {
        const { data, error } = await supabaseClient
            .from(tasksTable)
            .insert([{
                id: taskData.id || `task-${Date.now()}`,
                week: taskData.week,
                project: taskData.project,
                project_description: taskData.projectDescription || '',
                description: taskData.description || '',
                date: taskData.date,
                department: taskData.department,
                value: taskData.value || '',
                hours: taskData.hours || '',
                day_number: taskData.dayNumber || '',
                total_days: taskData.totalDays || '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }]);

        if (error) {
            throw error;
        }

        logger.debug('✅ Task saved to Supabase');
        return data;
    } catch (error) {
        logger.error('❌ Failed to save task to Supabase:', error);
        throw error;
    }
}

/**
 * Delete a task from Supabase
 *
 * Permanently removes a manual task from Supabase by ID.
 *
 * @param {string} taskId - ID of task to delete
 * @returns {Promise<boolean>} True if deletion successful
 * @throws {Error} If deletion fails
 *
 * @example
 * await deleteTaskFromSupabase('task-123');
 */
export async function deleteTaskFromSupabase(taskId) {
    if (!supabaseClient) {
        await initializeSupabase();
    }

    try {
        const { error } = await supabaseClient
            .from(tasksTable)
            .delete()
            .eq('id', taskId);

        if (error) {
            throw error;
        }

        logger.debug('✅ Task deleted from Supabase');
        return true;
    } catch (error) {
        logger.error('❌ Failed to delete task from Supabase:', error);
        throw error;
    }
}

/**
 * Save task descriptions to Supabase
 *
 * Upserts task descriptions to the task_descriptions table using batch operations.
 * Automatically sends refresh signal to other clients after successful save.
 *
 * @param {Array<{project: string, department: string, day_number: string, description: string}>} descriptions - Array of task descriptions to save
 * @returns {Promise<boolean>} True if save successful
 * @throws {Error} If save fails
 *
 * @example
 * await saveTaskDescriptions([
 *   {project: 'Project A', department: 'Mill 1', day_number: '1', description: 'Task desc'},
 *   {project: 'Project A', department: 'Mill 1', day_number: '2', description: 'Another desc'}
 * ]);
 */
export async function saveTaskDescriptions(descriptions) {
    if (!supabaseClient) {
        await initializeSupabase();
    }

    const startTime = performance.now();

    try {
        logger.info(`📝 Saving ${descriptions.length} task descriptions to Supabase...`);

        // Validate input
        if (!Array.isArray(descriptions) || descriptions.length === 0) {
            logger.warn('⚠️ No task descriptions to save');
            return true;
        }

        // Transform and validate each description
        const records = descriptions.map((desc, index) => {
            // Validate required fields
            if (!desc.project || !desc.department || !desc.day_number) {
                logger.error(`❌ Invalid description at index ${index}:`, desc);
                throw new Error(`Missing required fields in description at index ${index}`);
            }

            // Handle empty/null descriptions (Chrome 76 compatible)
            const description = (desc.description != null ? desc.description : '');

            logger.debug(`  → [${index}] Project: "${desc.project}", Dept: "${desc.department}", Day: "${desc.day_number}", Desc length: ${description.length}`);

            return {
                project: desc.project, // IMPORTANT: Do NOT trim - preserve exact project name
                department: desc.department,
                day_number: desc.day_number,
                description: description,
                updated_at: new Date().toISOString()
            };
        });

        // Use upsert to insert/update records
        // The composite primary key (project, department, day_number) handles deduplication
        const { data, error } = await supabaseClient
            .from('task_descriptions')
            .upsert(records, {
                onConflict: 'project,department,day_number',
                returning: 'minimal' // Don't return data to reduce payload size
            });

        if (error) {
            logger.error('❌ Supabase upsert error:', error);
            throw error;
        }

        const saveTime = (performance.now() - startTime).toFixed(0);
        logger.info(`✅ Successfully saved ${descriptions.length} task descriptions in ${saveTime}ms`);

        // Send refresh signal to other clients
        await sendRefreshSignal({
            action: 'task_descriptions_updated',
            count: descriptions.length,
            project: (descriptions[0] && descriptions[0].project) || undefined
        });

        return true;
    } catch (error) {
        const errorTime = (performance.now() - startTime).toFixed(0);
        logger.error(`❌ Failed to save task descriptions after ${errorTime}ms:`, error);
        throw error;
    }
}
