/**
 * Google Sheets Service
 * Handles all Google Sheets API operations including reading and writing data
 * @module services/sheets-service
 */

import { getAccessToken } from './auth-service.js';
import { GOOGLE_SHEETS } from '../config/api-config.js';
import { normalizeDepartment } from '../utils/ui-utils.js';
import { loadTasksFromCacheOrFetch, loadStagingFromCacheOrFetch, clearCache } from './sheets-cache-service.js';
import { saveTaskDescriptions } from './supabase-service.js';

import { logger } from '../utils/logger.js';
const { API_KEY, SPREADSHEET_ID, SHEET_NAME, STAGING_SHEET_NAME } = GOOGLE_SHEETS;

// Department to row mapping for staging sheet
export const departmentDayMapping = {
    "Mill 1": 5,
    "Mill 2": 8,
    "Mill 3": 11,
    "Mill 4": 14,
    "Form Out 1": 17,
    "Form Out 2": 20,
    "Form Out 3": 23,
    "Form Out 4": 26,
    "Cast 1": 29,
    "Cast 2": 32,
    "Demold 1": 37,
    "Demold 2": 40,
    "Demold 3": 43,
    "Crating 1": 49,
    "Crating 2": 52,
    "Finish 1": 61,
    "Finish 2": 64,
    "Finish 3": 67,
    "Finish 4": 70,
    "Finish 5": 73,
    "Seal 1": 76,
    "Seal 2": 79,
    "Seal 3": 82,
    "Seal 4": 85,
    "Special 1": 88,
    "Special 2": 91,
    "Special 3": 94,
    "Special 4": 96,
    "Special 5": 100,
    "Ship 1": 102,
    "Ship 2": 105,
    "Load 1": 55,
    "Load 2": 58
};

/**
 * Fetch tasks from Google Sheets (with caching)
 *
 * Retrieves all task data from the configured Google Sheet and parses it
 * into structured task objects. Uses caching via Supabase when available,
 * falling back to direct API calls.
 *
 * @returns {Promise<Array<Object>>} Array of task objects with all fields populated
 * @throws {Error} If the API request fails or no data is found
 *
 * @example
 * const tasks = await fetchTasks();
 * // Returns: [{id: 'task-1', project: 'A', department: 'Mill', ...}, ...]
 */
export async function fetchTasks() {
    return await loadTasksFromCacheOrFetch(fetchTasksDirect);
}

/**
 * Fetch tasks directly from Google Sheets API
 *
 * Internal function that performs the actual API call to Google Sheets.
 * Called by fetchTasks() when cache is unavailable or stale.
 *
 * @returns {Promise<Array<Object>>} Array of task objects with all fields populated
 * @throws {Error} If the API request fails or no data is found
 * @private
 */
async function fetchTasksDirect() {
    const fetchStartTime = performance.now();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}!A1:Z?key=${API_KEY}`;

    logger.info('[Startup] 📋 fetchTasksDirect() called');
    logger.info(`[Startup]   → URL: ${url.replace(/key=[^&]+/, 'key=***REDACTED***')}`);
    logger.info(`[Startup]   → Spreadsheet ID: ${SPREADSHEET_ID}`);
    logger.info(`[Startup]   → Sheet Name: ${SHEET_NAME}`);
    logger.info(`[Startup]   → API Key present: ${API_KEY ? 'Yes (length: ' + API_KEY.length + ')' : 'No'}`);
    logger.info(`[Startup]   → Network state: ${navigator.onLine ? 'Online' : 'Offline'}`);

    logger.info('[Startup] 🌐 Initiating fetch() call...');
    const fetchInitTime = performance.now();

    let response;
    try {
        response = await fetch(url);
        const fetchCompleteTime = performance.now();
        const fetchDuration = (fetchCompleteTime - fetchInitTime).toFixed(0);

        logger.info(`[Startup] ✅ Fetch completed in ${fetchDuration}ms`);
        logger.info(`[Startup]   → Response status: ${response.status} ${response.statusText}`);
        logger.info(`[Startup]   → Response ok: ${response.ok}`);
        logger.info(`[Startup]   → Response headers:`);

        // Log important response headers
        const headersToLog = ['content-type', 'content-length', 'cache-control', 'date', 'server', 'x-frame-options'];
        headersToLog.forEach(header => {
            const value = response.headers.get(header);
            if (value) {
                logger.info(`[Startup]     • ${header}: ${value}`);
            }
        });
    } catch (fetchError) {
        const fetchErrorTime = performance.now();
        const errorDuration = (fetchErrorTime - fetchInitTime).toFixed(0);

        logger.error(`[Startup] ❌ Fetch failed after ${errorDuration}ms`);
        logger.error(`[Startup]   → Error type: ${fetchError.name}`);
        logger.error(`[Startup]   → Error message: ${fetchError.message}`);
        logger.error(`[Startup]   → Network state: ${navigator.onLine ? 'Online' : 'Offline'}`);
        logger.error(`[Startup]   → Error stack:`, fetchError.stack);
        throw fetchError;
    }

    if (!response.ok) {
        logger.error(`[Startup] ❌ Response not OK: ${response.status} ${response.statusText}`);

        // Try to get error details from response body
        try {
            const errorText = await response.text();
            logger.error(`[Startup]   → Response body: ${errorText.substring(0, 500)}`);
        } catch (e) {
            logger.error(`[Startup]   → Could not read response body`);
        }

        throw new Error(`Failed to fetch tasks: ${response.statusText}`);
    }

    logger.info('[Startup] 📦 Parsing JSON response...');
    const parseStartTime = performance.now();

    let data;
    try {
        data = await response.json();
        const parseCompleteTime = performance.now();
        const parseDuration = (parseCompleteTime - parseStartTime).toFixed(0);

        logger.info(`[Startup] ✅ JSON parsed in ${parseDuration}ms`);
        logger.info(`[Startup]   → Data has 'values' property: ${!!data.values}`);

        if (data.values) {
            logger.info(`[Startup]   → Rows count: ${data.values.length}`);
            logger.info(`[Startup]   → First row columns: ${data.values[0] ? data.values[0].length : 0}`);
        }
    } catch (parseError) {
        const parseErrorTime = performance.now();
        const errorDuration = (parseErrorTime - parseStartTime).toFixed(0);

        logger.error(`[Startup] ❌ JSON parsing failed after ${errorDuration}ms`);
        logger.error(`[Startup]   → Error: ${parseError.message}`);
        throw parseError;
    }

    if (!data.values) {
        logger.error('[Startup] ❌ No values in response data');
        throw new Error('No data found in sheet');
    }

    logger.info('[Startup] 🔄 Parsing sheet data into task objects...');
    const parseDataStartTime = performance.now();
    const tasks = parseSheetData(data.values);
    const parseDataCompleteTime = performance.now();
    const parseDataDuration = (parseDataCompleteTime - parseDataStartTime).toFixed(0);

    const totalDuration = (parseDataCompleteTime - fetchStartTime).toFixed(0);
    logger.info(`[Startup] ✅ Sheet data parsed in ${parseDataDuration}ms`);
    logger.info(`[Startup]   → Total tasks parsed: ${tasks.length}`);
    logger.info(`[Startup] ✅ fetchTasksDirect() complete - Total time: ${totalDuration}ms`);

    return tasks;
}

/**
 * Parse sheet data into task objects
 *
 * Converts raw Google Sheets data (2D array) into structured task objects.
 * Assumes first row is headers and normalizes department names.
 *
 * @param {Array<Array<string>>} rows - Raw sheet data rows (first row is headers)
 * @returns {Array<Object>} Array of parsed task objects
 *
 * @example
 * const rows = [
 *   ['Week', 'Project', 'Description', 'Date', 'Department', ...],
 *   ['2025-01-01', 'Project A', 'Desc', '2025-01-05', 'mill', ...]
 * ];
 * const tasks = parseSheetData(rows);
 * // Returns: [{id: 'task-1', week: '2025-01-01', project: 'Project A', department: 'Mill', ...}]
 */
export function parseSheetData(rows) {
    const tasks = [];
    const headers = rows[0];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length >= 1) {  // Import incomplete entries
            const task = {
                id: `task-${i}`,
                week: row[0] || '',
                project: row[1] || '',
                projectDescription: row[2] || '',
                description: row[9] || '',
                date: row[3] || '',
                department: normalizeDepartment(row[4] || ''),
                value: row[5] || '',
                hours: row[6] || '',
                dayNumber: row[7] || '',
                totalDays: row[8] || ''
            };
            tasks.push(task);
        }
    }

    return tasks;
}

/**
 * Strip HTML tags from a string
 * @param {string} html - HTML string
 * @returns {string} Plain text
 */
function stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

/**
 * Get sheet ID by sheet name
 *
 * Queries spreadsheet metadata to find the numeric sheet ID for a given sheet name.
 * Required for batchUpdate operations that target specific sheets.
 *
 * @param {string} sheetName - Name of the sheet to find
 * @returns {Promise<number|null>} Sheet ID or null if not found
 * @throws {Error} If metadata fetch fails
 *
 * @example
 * const sheetId = await getSheetId('Staging');
 * // Returns: 123456789 (numeric sheet ID)
 */
export async function getSheetId(sheetName) {
    const startTime = performance.now();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?key=${API_KEY}`;

    logger.info(`[Startup] 🔍 getSheetId('${sheetName}') called`);
    logger.info(`[Startup]   → URL: ${url.replace(/key=[^&]+/, 'key=***REDACTED***')}`);

    const response = await fetch(url);

    const fetchTime = (performance.now() - startTime).toFixed(0);
    logger.info(`[Startup]   → Fetch completed in ${fetchTime}ms`);
    logger.info(`[Startup]   → Response status: ${response.status}`);

    if (!response.ok) {
        logger.error(`[Startup] ❌ Failed to fetch sheet metadata: ${response.statusText}`);
        throw new Error('Failed to fetch sheet metadata');
    }

    const data = await response.json();
    const sheet = data.sheets.find(s => s.properties.title === sheetName);
    const sheetId = sheet ? sheet.properties.sheetId : null;

    const totalTime = (performance.now() - startTime).toFixed(0);
    logger.info(`[Startup] ✅ getSheetId() complete in ${totalTime}ms - Sheet ID: ${sheetId}`);

    return sheetId;
}

/**
 * Get staging sheet data (with caching)
 *
 * Fetches all data from the staging sheet for reading or modification.
 * Used to check if project columns exist before saving. Uses caching via
 * Supabase when available, falling back to direct API calls.
 *
 * @returns {Promise<Array<Array<string>>>} 2D array of staging sheet data
 * @throws {Error} If staging data fetch fails
 *
 * @example
 * const data = await getStagingData();
 * // Returns: [['Header1', 'Header2', ...], ['Row1Col1', 'Row1Col2', ...], ...]
 */
export async function getStagingData() {
    return await loadStagingFromCacheOrFetch(getStagingDataDirect);
}

/**
 * Get staging sheet data directly from Google Sheets API
 *
 * Internal function that performs the actual API call to Google Sheets.
 * Called by getStagingData() when cache is unavailable or stale.
 *
 * @returns {Promise<Array<Array<string>>>} 2D array of staging sheet data
 * @throws {Error} If staging data fetch fails
 * @private
 */
async function getStagingDataDirect() {
    const startTime = performance.now();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(STAGING_SHEET_NAME)}!A1:ZZ?key=${API_KEY}`;

    logger.info('[Startup] 📊 getStagingDataDirect() called');
    logger.info(`[Startup]   → URL: ${url.replace(/key=[^&]+/, 'key=***REDACTED***')}`);

    const response = await fetch(url);

    const fetchTime = (performance.now() - startTime).toFixed(0);
    logger.info(`[Startup]   → Fetch completed in ${fetchTime}ms`);
    logger.info(`[Startup]   → Response status: ${response.status}`);

    if (!response.ok) {
        logger.error(`[Startup] ❌ Failed to fetch staging data: ${response.statusText}`);
        throw new Error('Failed to fetch staging data');
    }

    const data = await response.json();
    const values = data.values || [];

    const totalTime = (performance.now() - startTime).toFixed(0);
    logger.info(`[Startup] ✅ getStagingDataDirect() complete in ${totalTime}ms - Rows: ${values.length}`);

    return values;
}

/**
 * Save changes to staging (now saves to Supabase instead of Google Sheets)
 *
 * Writes task descriptions to Supabase task_descriptions table. This replaces
 * the previous Google Sheets staging implementation while maintaining the same
 * function signature for backward compatibility.
 *
 * @param {string} projectName - Project name (IMPORTANT: preserved exactly, no trimming)
 * @param {Array<{task: Object, newText: string}>} changedTasks - Array of task updates
 * @returns {Promise<boolean>} True if save successful
 * @throws {Error} If Supabase update fails
 *
 * @example
 * const changes = [
 *   {task: {department: 'Mill 1', dayNumber: '1'}, newText: 'Updated description'}
 * ];
 * await saveToStaging('Project Alpha', changes);
 */
export async function saveToStaging(projectName, changedTasks) {
    const startTime = performance.now();

    logger.info(`💾 saveToStaging('${projectName}') called`);
    logger.info(`  → Changed tasks count: ${changedTasks.length}`);

    try {
        // Validate input
        if (!changedTasks || changedTasks.length === 0) {
            logger.info('⚠️ No changed tasks to save');
            return true;
        }

        // Transform changedTasks format to match saveTaskDescriptions() requirements
        // Input format: [{task: {department, dayNumber, ...}, newText: 'description'}]
        // Output format: [{project, department, day_number, description}]
        const descriptions = changedTasks.map(({task, newText}) => {
            // Validate task has required fields
            if (!task.department || !task.dayNumber) {
                logger.warn('⚠️ Skipping task with missing department or dayNumber:', task);
                return null;
            }

            return {
                project: projectName, // IMPORTANT: Do NOT trim - preserve exact project name
                department: task.department,
                day_number: task.dayNumber,
                description: newText ?? '' // Handle null/undefined descriptions
            };
        }).filter(desc => desc !== null); // Remove invalid entries

        logger.info(`  → Valid descriptions to save: ${descriptions.length}`);

        if (descriptions.length === 0) {
            logger.warn('⚠️ No valid descriptions to save after transformation');
            return true;
        }

        // Save to Supabase (this also sends refresh signal)
        logger.info('📤 Saving task descriptions to Supabase...');
        const saveStartTime = performance.now();
        await saveTaskDescriptions(descriptions);
        const saveTime = (performance.now() - saveStartTime).toFixed(0);
        logger.info(`✅ Task descriptions saved to Supabase in ${saveTime}ms`);

        // Invalidate cache after successful write (consistent with previous implementation)
        try {
            logger.info('🗑️ Invalidating caches after successful write...');
            const cacheInvalidateStartTime = performance.now();
            // Clear both 'tasks' and 'staging' caches to maintain consistency
            await Promise.all([
                clearCache('tasks'),
                clearCache('staging')
            ]);
            const cacheInvalidateTime = (performance.now() - cacheInvalidateStartTime).toFixed(0);
            logger.info(`✅ Both caches ('tasks' and 'staging') invalidated in ${cacheInvalidateTime}ms`);
        } catch (cacheError) {
            // Don't fail the operation if cache clear fails
            logger.error('⚠️ Cache invalidation failed (non-critical):', cacheError);
        }

        const totalTime = (performance.now() - startTime).toFixed(0);
        logger.info(`✅ saveToStaging() complete in ${totalTime}ms`);
        logger.info('Successfully saved task descriptions to Supabase');

        return true;
    } catch (error) {
        const errorTime = (performance.now() - startTime).toFixed(0);
        logger.error(`❌ saveToStaging() failed after ${errorTime}ms`);
        logger.error('Error saving task descriptions:', error);
        throw error; // Re-throw to handle in caller
    }
}
