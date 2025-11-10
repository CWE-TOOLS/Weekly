/**
 * Schedule Utilities
 * Provides shared utilities for generating special department tasks (Batch, Layout)
 * @module utils/schedule-utils
 *
 * @claude-context
 * @purpose Consolidate duplicate task generation logic for Batch and Layout departments
 * @dependencies date-utils.js, security-utils.js
 * @used-by components/schedule-grid.js, features/print/print-renderer.js, features/print/print-utils.js, features/schedule/schedule-renderer.js
 * @exports generateSpecialDepartmentTasks
 * @key-functions
 *   - generateSpecialDepartmentTasks() - Unified function to generate Batch or Layout tasks
 * @business-logic
 *   - Special departments (Batch, Layout) display next day's casting projects
 *   - Monday-Thursday: Show next day's Cast department projects
 *   - Friday: Show both Saturday and Monday's Cast department projects
 *   - Only generates tasks for weekdays (Mon-Fri)
 */

import { parseDate, getLocalDateString, getMonday } from './date-utils.js';
import { escapeHtml } from './security-utils.js';
import { logger } from './logger.js';
/**
 * Generate special department tasks (Batch or Layout) for a week
 *
 * These special departments display upcoming casting projects to help plan work:
 * - Mon-Thu: Display next day's casting projects
 * - Friday: Display Saturday AND Monday's casting projects (weekend + next week)
 *
 * Business Context:
 * - Batch department needs to know what will be cast so they can prepare materials
 * - Layout department needs to know what will be demolded so they can plan workspace
 * - Both depend on the Cast department's schedule
 *
 * @param {Date[]} weekDates - Array of dates for the week (typically Mon-Sat, 6 dates)
 * @param {Date} monday - Monday of the week (used for task ID and week field)
 * @param {string} departmentName - Name of the department ('Batch' or 'Layout')
 * @param {Function} getAllTasks - Function that returns all tasks (to query Cast department)
 * @returns {Object[]} Array of task objects for the special department
 *
 * @example
 * // Generate batch tasks for current week
 * const weekDates = [mon, tue, wed, thu, fri, sat];
 * const monday = getMonday(new Date());
 * const batchTasks = generateSpecialDepartmentTasks(weekDates, monday, 'Batch', getAllTasks);
 *
 * @example
 * // Generate layout tasks for a specific week
 * const layoutTasks = generateSpecialDepartmentTasks(weekDates, monday, 'Layout', getAllTasks);
 */
export function generateSpecialDepartmentTasks(weekDates, monday, departmentName, getAllTasks) {
    // Validate inputs
    if (!Array.isArray(weekDates) || weekDates.length === 0) {
        logger.warn(`generateSpecialDepartmentTasks: Invalid weekDates provided for ${departmentName}`);
        return [];
    }

    if (!monday || !(monday instanceof Date)) {
        logger.warn(`generateSpecialDepartmentTasks: Invalid monday date provided for ${departmentName}`);
        return [];
    }

    if (!departmentName || typeof departmentName !== 'string') {
        logger.warn('generateSpecialDepartmentTasks: Invalid departmentName provided');
        return [];
    }

    if (typeof getAllTasks !== 'function') {
        logger.warn(`generateSpecialDepartmentTasks: getAllTasks must be a function for ${departmentName}`);
        return [];
    }

    const allTasks = getAllTasks();
    const specialTasks = [];

    // Generate tasks for weekdays only (Mon-Fri)
    weekDates.forEach((date, i) => {
        // Only process Mon-Fri (index 0-4 in typical Mon-Sat array)
        if (i < 5) {
            let castingProjects = [];

            if (i === 4) {
                // Friday - show Saturday and Monday's casting projects

                // Get Saturday's casting projects
                const saturday = new Date(date);
                saturday.setDate(date.getDate() + 1);
                const saturdayString = saturday.toDateString();
                const saturdayProjects = allTasks
                    .filter(t => t.department === 'Cast' && t.project && parseDate(t.date) && parseDate(t.date).toDateString() === saturdayString)
                    .map(t => t.project);

                if (saturdayProjects.length > 0) {
                    castingProjects.push(`<b>Sat:</b> ${saturdayProjects.map(escapeHtml).join(', ')}`);
                }

                // Get Monday's casting projects (next week)
                const nextMonday = new Date(date);
                nextMonday.setDate(date.getDate() + 3); // Friday + 3 days = Monday
                const mondayString = nextMonday.toDateString();
                const mondayProjects = allTasks
                    .filter(t => t.department === 'Cast' && t.project && parseDate(t.date) && parseDate(t.date).toDateString() === mondayString)
                    .map(t => t.project);

                if (mondayProjects.length > 0) {
                    castingProjects.push(`<b>Mon:</b> ${mondayProjects.map(escapeHtml).join(', ')}`);
                }
            } else {
                // Mon-Thu - show next day's casting projects
                const nextDate = new Date(date);
                nextDate.setDate(date.getDate() + 1);
                const nextDateString = nextDate.toDateString();
                const nextDayProjects = allTasks
                    .filter(t => t.department === 'Cast' && t.project && parseDate(t.date) && parseDate(t.date).toDateString() === nextDateString)
                    .map(t => t.project);

                if (nextDayProjects.length > 0) {
                    castingProjects = nextDayProjects.map(escapeHtml);
                }
            }

            // Create task object for this date
            const task = {
                id: `${departmentName.toLowerCase()}-${date.toISOString()}`,
                week: getLocalDateString(monday),
                project: departmentName,
                description: castingProjects.length > 0
                    ? (Array.isArray(castingProjects) ? castingProjects.join('<br>') : castingProjects)
                    : '',
                date: getLocalDateString(date),
                department: departmentName,
                value: '',
                hours: '',
                dayNumber: '',
                totalDays: '',
                dayCounter: '',
                missingDate: false
            };

            specialTasks.push(task);
        }
    });

    return specialTasks;
}

/**
 * Convenience function to generate Batch tasks
 * @param {Date[]} weekDates - Array of dates for the week
 * @param {Date} monday - Monday of the week
 * @param {Function} getAllTasks - Function that returns all tasks
 * @returns {Object[]} Array of batch task objects
 */
export function generateBatchTasks(weekDates, monday, getAllTasks) {
    return generateSpecialDepartmentTasks(weekDates, monday, 'Batch', getAllTasks);
}

/**
 * Convenience function to generate Layout tasks
 * @param {Date[]} weekDates - Array of dates for the week
 * @param {Date} monday - Monday of the week
 * @param {Function} getAllTasks - Function that returns all tasks
 * @returns {Object[]} Array of layout task objects
 */
export function generateLayoutTasks(weekDates, monday, getAllTasks) {
    return generateSpecialDepartmentTasks(weekDates, monday, 'Layout', getAllTasks);
}

