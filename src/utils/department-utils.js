/**
 * Shared department utilities for grouping, sorting, and organizing tasks by department
 * Used by all rendering paths (screen, print, smart)
 * @module utils/department-utils
 */

import { DEPARTMENT_ORDER, SYNTHETIC_DEPARTMENT_CONFIG, SYNTHETIC_DEPARTMENT_NAMES, isSyntheticDepartment } from '../config/department-config.js';
import { parseDate } from './date-utils.js';
import { debug } from './debug.js';

/**
 * Groups tasks by department, nesting synthetic departments under their primary department.
 * @param {Object[]} filteredTasks - Array of filtered task objects.
 * @param {Object<string, Object[]>} syntheticTasksByDept - Map of synthetic dept name to task arrays
 *        (e.g., { 'Batch': [...], 'Layout': [...] }).
 * @returns {Object} A nested structure where each key is a department name.
 *                   The value is an object with `tasks` and optional `syntheticTasks`.
 */
export function groupTasksByDepartment(filteredTasks, syntheticTasksByDept) {
    const tasksByDept = {};

    // 1. Initialize all departments from the canonical order
    DEPARTMENT_ORDER.forEach(dept => {
        tasksByDept[dept] = { tasks: [] };
    });

    // 2. Group primary tasks
    filteredTasks.forEach(task => {
        const dept = task.department || 'Other';
        if (!tasksByDept[dept]) {
            tasksByDept[dept] = { tasks: [] };
        }
        tasksByDept[dept].tasks.push(task);
    });

    // 3. Handle special, non-synthetic departments
    if (!tasksByDept['Special Events']) {
        tasksByDept['Special Events'] = { tasks: [] };
    }

    // 4. Nest synthetic departments (driven by config)
    for (const primaryDept in SYNTHETIC_DEPARTMENT_CONFIG) {
        const config = SYNTHETIC_DEPARTMENT_CONFIG[primaryDept];
        const syntheticDeptName = config.synthetic;
        const syntheticTasks = (syntheticTasksByDept && syntheticTasksByDept[syntheticDeptName]) || [];

        if (tasksByDept[primaryDept]) {
            tasksByDept[primaryDept].syntheticTasks = syntheticTasks;
            tasksByDept[primaryDept].syntheticDeptName = config.label;
        }
    }

    // 5. Remove synthetic departments from top-level keys
    for (const dept of SYNTHETIC_DEPARTMENT_NAMES) {
        delete tasksByDept[dept];
    }

    return tasksByDept;
}

/**
 * Sorts an array of department names according to DEPARTMENT_ORDER.
 * @param {string[]} departmentNames - An array of department names.
 * @returns {string[]} A new array with department names sorted.
 */
export function sortDepartments(departmentNames) {
    const allDepts = new Set([...DEPARTMENT_ORDER, ...departmentNames]);

    return Array.from(allDepts).sort((a, b) => {
        const aIndex = DEPARTMENT_ORDER.indexOf(a);
        const bIndex = DEPARTMENT_ORDER.indexOf(b);

        if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
    });
}

/**
 * Groups tasks by date for a given week
 * @param {Object[]} tasks - Array of task objects for a department
 * @param {Date[]} weekDates - Array of dates for the week
 * @param {string} [departmentName=''] - Department name for debug logging
 * @returns {Object} Tasks grouped by date string (key: date.toDateString(), value: task[])
 */
export function groupTasksByDate(tasks, weekDates, departmentName = '') {
    const tasksByDate = {};

    weekDates.forEach(date => {
        const dateString = date.toDateString();
        tasksByDate[dateString] = tasks.filter(t => {
            if (!t.date) return false;
            const taskDate = parseDate(t.date);
            const matches = taskDate && taskDate.toDateString() === dateString;

            // DEBUG for synthetic departments
            if (isSyntheticDepartment(departmentName)) {
                debug.log(`[${departmentName}] Task:`, t.date, '→ parsed:', (taskDate && taskDate.toDateString()), '→ matches:', matches, '→ expected:', dateString);
            }

            return matches;
        });
    });

    if (isSyntheticDepartment(departmentName)) {
        debug.log(`[${departmentName}] tasksByDate:`, tasksByDate);
    }

    return tasksByDate;
}


/**
 * Calculates the maximum number of tasks for any single day within a week for each department.
 * This is used to determine the number of rows to render for each department in the grid.
 * @param {Object} tasksByDept - Tasks grouped by department.
 * @param {Date[]} weekDates - Array of dates for the week.
 * @returns {Object} An object mapping department names to their max daily task count for the week.
 */
export function calculateMaxTasksPerDept(tasksByDept, weekDates) {
    const maxTasks = {};
    for (const dept in tasksByDept) {
        if (isSyntheticDepartment(dept)) {
            maxTasks[dept] = 1; // Synthetic departments always render one row
            continue;
        }

        const dailyCounts = weekDates.map(date => {
            const dateString = date.toDateString();
            if (tasksByDept[dept] && Array.isArray(tasksByDept[dept].tasks)) {
                return tasksByDept[dept].tasks.filter(task => {
                    const taskDate = parseDate(task.date);
                    return taskDate && taskDate.toDateString() === dateString;
                }).length;
            }
            return 0;
        });
        maxTasks[dept] = Math.max(0, ...dailyCounts);
    }
    return maxTasks;
}
