/**
 * Supabase Service
 * Handles all Supabase operations including task CRUD, real-time sync, and refresh signals
 */

import { SUPABASE, REFRESH_CONFIG } from '../config/api-config.js';
import { normalizeDepartment } from '../utils/ui-utils.js';

// Supabase client and channel state
let supabaseClient = null;
let refreshChannel = null;
const tasksTable = SUPABASE.TASKS_TABLE;

/**
 * Initialize Supabase for task management and refresh signaling
 * @returns {Promise<Object>} Supabase client instance
 */
export async function initializeSupabase() {
    if (supabaseClient) return supabaseClient;

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

    console.log('✅ Supabase initialized');
    return supabaseClient;
}

/**
 * Get Supabase client instance
 * @returns {Object|null} Supabase client
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
            console.log('🔄 Refresh signal received:', payload);
            handleRefreshSignal(payload);
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Subscribed to refresh signals');
            } else if (status === 'CLOSED') {
                console.log('⚠️ Refresh subscription closed');
            } else if (status === 'CHANNEL_ERROR') {
                console.error('❌ Refresh subscription error');
            }
        });
}

/**
 * Handle refresh signal by reloading data from Google Sheets
 * @param {Object} payload - Refresh signal payload
 */
function handleRefreshSignal(payload) {
    console.log('🔄 Processing refresh signal...');

    // Add visual indicator
    showRefreshIndicator();

    // Reload data using fetchTasks function (needs to be passed in or imported)
    if (window.fetchTasks) {
        window.fetchTasks()
            .then(() => {
                console.log('✅ Data refreshed from Google Sheets');
            })
            .catch(error => {
                console.error('❌ Failed to refresh data:', error);
            });
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
        top: 20px;
        right: 20px;
        background: #3b82f6;
        color: white;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;

    document.body.appendChild(indicator);
    setTimeout(() => {
        if (indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
        }
    }, 2000);
}

/**
 * Show notification
 * @param {string} message - Notification message
 * @param {string} type - Notification type (info, success, error)
 */
function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);

    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;

    document.body.appendChild(notification);
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 4000);
}

/**
 * Send a refresh signal to all other clients
 * Call this after successfully updating Google Sheets or Supabase
 * @param {Object} updateInfo - Information about the update
 * @returns {Promise<void>}
 */
export async function sendRefreshSignal(updateInfo = {}) {
    if (!supabaseClient) {
        console.warn('⚠️ Supabase not initialized, cannot send refresh signal');
        return;
    }

    try {
        console.log('📡 Sending refresh signal to all clients...');

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
            console.error('❌ Failed to send refresh signal:', error);
        } else {
            console.log('✅ Refresh signal sent successfully');
        }

    } catch (error) {
        console.error('❌ Error sending refresh signal:', error);
    }
}

/**
 * Load manual tasks from Supabase and merge with Google Sheets data
 * @returns {Promise<Array>} Array of manual tasks
 */
export async function loadManualTasks() {
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
        console.error('❌ Failed to load manual tasks:', error);
        return [];
    }
}

/**
 * Update task in Supabase
 * @param {Object} task - Task object to update
 * @returns {Promise<boolean>} Success status
 */
export async function updateTaskInSupabase(task) {
    if (!supabaseClient) {
        await initializeSupabase();
    }

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
        const { error } = await supabaseClient
            .from(tasksTable)
            .update({
                date: task.date,
                week: task.week,
                updated_at: new Date().toISOString()
            })
            .eq('id', task.id);

        clearTimeout(timeoutId);

        if (error) {
            throw error;
        }

        console.log('✅ Task updated in Supabase');
        return true;
    } catch (error) {
        clearTimeout(timeoutId);
        console.error('❌ Failed to update task in Supabase:', error);
        throw error;
    }
}

/**
 * Save a new task to Supabase
 * @param {Object} taskData - Task data to save
 * @returns {Promise<Object>} Saved task data
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

        console.log('✅ Task saved to Supabase');
        return data;
    } catch (error) {
        console.error('❌ Failed to save task to Supabase:', error);
        throw error;
    }
}

/**
 * Delete a task from Supabase
 * @param {string} taskId - ID of task to delete
 * @returns {Promise<boolean>} Success status
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

        console.log('✅ Task deleted from Supabase');
        return true;
    } catch (error) {
        console.error('❌ Failed to delete task from Supabase:', error);
        throw error;
    }
}
