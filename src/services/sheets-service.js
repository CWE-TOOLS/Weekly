/**
 * Google Sheets Service
 * Handles all Google Sheets API operations including reading and writing data
 * @module services/sheets-service
 */

import { getAccessToken } from './auth-service.js';
import { GOOGLE_SHEETS } from '../config/api-config.js';
import { normalizeDepartment } from '../utils/ui-utils.js';

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
 * Fetch tasks from Google Sheets
 *
 * Retrieves all task data from the configured Google Sheet and parses it
 * into structured task objects. Uses read-only API key authentication.
 *
 * @returns {Promise<Array<Object>>} Array of task objects with all fields populated
 * @throws {Error} If the API request fails or no data is found
 *
 * @example
 * const tasks = await fetchTasks();
 * // Returns: [{id: 'task-1', project: 'A', department: 'Mill', ...}, ...]
 */
export async function fetchTasks() {
    const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}!A1:Z?key=${API_KEY}`
    );

    if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.values) {
        throw new Error('No data found in sheet');
    }

    return parseSheetData(data.values);
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
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?key=${API_KEY}`);
    if (!response.ok) throw new Error('Failed to fetch sheet metadata');
    const data = await response.json();
    const sheet = data.sheets.find(s => s.properties.title === sheetName);
    return sheet ? sheet.properties.sheetId : null;
}

/**
 * Get staging sheet data
 *
 * Fetches all data from the staging sheet for reading or modification.
 * Used to check if project columns exist before saving.
 *
 * @returns {Promise<Array<Array<string>>>} 2D array of staging sheet data
 * @throws {Error} If staging data fetch fails
 *
 * @example
 * const data = await getStagingData();
 * // Returns: [['Header1', 'Header2', ...], ['Row1Col1', 'Row1Col2', ...], ...]
 */
export async function getStagingData() {
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(STAGING_SHEET_NAME)}!A1:ZZ?key=${API_KEY}`);
    if (!response.ok) throw new Error('Failed to fetch staging data');
    const data = await response.json();
    return data.values || [];
}

/**
 * Save changes to staging sheet
 *
 * Updates or creates a project column in the staging sheet and writes task
 * descriptions to the appropriate department/day rows. Uses authenticated
 * batchUpdate API for atomic operations.
 *
 * @param {string} projectName - Project name (becomes column header)
 * @param {Array<{task: Object, newText: string}>} changedTasks - Array of task updates
 * @returns {Promise<boolean>} True if save successful
 * @throws {Error} If sheet update fails
 *
 * @example
 * const changes = [
 *   {task: {department: 'Mill', dayNumber: '1'}, newText: 'Updated description'}
 * ];
 * await saveToStaging('Project Alpha', changes);
 */
export async function saveToStaging(projectName, changedTasks) {
    try {
        const sheetId = await getSheetId(STAGING_SHEET_NAME);
        if (!sheetId) throw new Error('Staging sheet not found');
        const stagingData = await getStagingData();
        const headers = stagingData[0] || [];
        let projectCol = headers.indexOf(projectName);
        const requests = [];
        if (projectCol === -1) {
            // Insert column after D (index 3, so startIndex 4)
            requests.push({
                "insertDimension": {
                    "range": {
                        "sheetId": sheetId,
                        "dimension": "COLUMNS",
                        "startIndex": 4,
                        "endIndex": 5
                    },
                    "inheritFromBefore": false
                }
            });
            // Set header in new column E (index 4)
            requests.push({
                "updateCells": {
                    "range": {
                        "sheetId": sheetId,
                        "startRowIndex": 0,
                        "endRowIndex": 1,
                        "startColumnIndex": 4,
                        "endColumnIndex": 5
                    },
                    "rows": [{
                        "values": [{
                            "userEnteredValue": { "stringValue": projectName }
                        }]
                    }],
                    "fields": "userEnteredValue"
                }
            });
            projectCol = 4;
        }
        // Now update the changed descriptions
        changedTasks.forEach(({task, newText}) => {
            const deptDay = task.department + ' ' + task.dayNumber;
            const rowIndex = departmentDayMapping[deptDay];
            if (rowIndex !== undefined) {
                requests.push({
                    "updateCells": {
                        "range": {
                            "sheetId": sheetId,
                            "startRowIndex": rowIndex - 1,
                            "endRowIndex": rowIndex,
                            "startColumnIndex": projectCol,
                            "endColumnIndex": projectCol + 1
                        },
                        "rows": [{
                            "values": [{
                                "userEnteredValue": { "stringValue": newText }
                            }]
                        }],
                        "fields": "userEnteredValue"
                    }
                });
            }
        });
        if (requests.length > 0) {
            const accessToken = await getAccessToken();
            const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({ requests })
            });
            if (!response.ok) {
                const error = await response.text();
                throw new Error('Failed to update sheet: ' + error);
            }
            logger.info('Successfully saved to staging sheet');
            return true;
        }
        return true;
    } catch (error) {
        logger.error('Error saving to staging:', error);
        throw error; // Re-throw to handle in caller
    }
}
