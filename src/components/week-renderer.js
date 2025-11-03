/**
 * Week Renderer Module
 * Handles rendering of individual week grids and their components
 * @module components/week-renderer
 *
 * @claude-context
 * @purpose Generate HTML structure for week grids including headers, department rows, and task cards
 * @dependencies state.js, date-utils.js, task-card.js, department-config.js, schedule-utils.js
 * @used-by schedule-grid.js (main coordinator)
 * @exports renderWeekGrid
 * @key-functions
 *   - renderWeekGrid() - Generate complete week grid HTML structure
 *   - createWeekDates() - Generate array of dates for the week
 *   - createHeaderRow() - Generate day header row
 *   - createDepartmentRows() - Generate department rows with task cards
 * @rendering-logic
 *   1. Calculate Monday and week dates (Mon-Sat, 6 days)
 *   2. Generate special department tasks (Batch, Layout)
 *   3. Create header row with date labels
 *   4. Group filtered tasks by department
 *   5. For each department, create rows with task cards or placeholders
 *   6. Return grid element with row class metadata
 */

import { getFilteredTasks, getAllTasks } from '../core/state.js';
import { parseDate, getMonday, getLocalDateString } from '../utils/date-utils.js';
import { DEPARTMENT_ORDER } from '../config/department-config.js';
import { createTaskCard, createTaskCardPlaceholder, normalizeDepartmentClass } from './task-card.js';
import { generateBatchTasks, generateLayoutTasks } from '../utils/schedule-utils.js';
import { Z_INDEX } from '../config/layout-constants.js';
import { logger } from '../utils/logger.js';

/**
 * Create array of dates for a week (Monday through Saturday)
 * @param {Date} monday - Monday date of the week
 * @returns {Date[]} Array of 6 dates (Mon-Sat)
 */
function createWeekDates(monday) {
    return Array.from({ length: 6 }).map((_, i) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        return date;
    });
}

/**
 * Create header row HTML for week grid
 * @param {Date[]} weekDates - Array of dates for the week
 * @returns {string} HTML string for header row
 */
function createHeaderRow(weekDates) {
    let headerHTML = '<div class="grid-header">Department</div>';
    weekDates.forEach(date => {
        const isToday = date.toDateString() === new Date().toDateString();
        headerHTML += `<div class="grid-header"><div class="date-container ${isToday ? 'today-highlight' : ''}"><div class="date-weekday">${date.toLocaleDateString('en-US', { weekday: 'short' })}</div><div class="date-day">${date.toLocaleDateString('en-US', { day: 'numeric' })}</div></div></div>`;
    });
    return headerHTML;
}

/**
 * Group tasks by department
 * @param {Object[]} filteredTasks - Filtered tasks to group
 * @param {Object[]} batchTasks - Generated batch tasks
 * @param {Object[]} layoutTasks - Generated layout tasks
 * @returns {Object} Tasks grouped by department
 */
function groupTasksByDepartment(filteredTasks, batchTasks, layoutTasks) {
    const tasksByDept = {};

    // Initialize with ordered departments
    DEPARTMENT_ORDER.forEach(dept => {
        tasksByDept[dept] = [];
    });

    // Add filtered tasks
    filteredTasks.forEach(task => {
        const dept = task.department || 'Other';
        if (!tasksByDept[dept]) tasksByDept[dept] = [];
        tasksByDept[dept].push(task);
    });

    // Add special departments
    tasksByDept['Batch'] = batchTasks;
    tasksByDept['Layout'] = layoutTasks;
    if (!tasksByDept['Special Events']) {
        tasksByDept['Special Events'] = [];
    }

    return tasksByDept;
}

/**
 * Sort departments according to department order
 * @param {Object} tasksByDept - Tasks grouped by department
 * @returns {string[]} Sorted array of department names
 */
function sortDepartments(tasksByDept) {
    const allDepts = new Set(DEPARTMENT_ORDER);
    Object.keys(tasksByDept).forEach(dept => allDepts.add(dept));

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
 * Group department tasks by date
 * @param {Object[]} deptTasks - Tasks for a department
 * @param {Date[]} weekDates - Array of dates for the week
 * @param {string} dept - Department name for debug logging
 * @returns {Object} Tasks grouped by date string
 */
function groupTasksByDate(deptTasks, weekDates, dept) {
    const tasksByDate = {};

    weekDates.forEach(date => {
        const dateString = date.toDateString();
        tasksByDate[dateString] = deptTasks.filter(t => {
            if (!t.date) return false;
            const taskDate = parseDate(t.date);
            const matches = taskDate && taskDate.toDateString() === dateString;

            // DEBUG for Batch/Layout
            if (dept === 'Batch' || dept === 'Layout') {
                console.log(`[${dept}] Task:`, t.date, '→ parsed:', taskDate?.toDateString(), '→ matches:', matches, '→ expected:', dateString);
            }

            return matches;
        });
    });

    if (dept === 'Batch' || dept === 'Layout') {
        console.log(`[${dept}] tasksByDate:`, tasksByDate);
    }

    return tasksByDate;
}

/**
 * Create department label element
 * @param {string} dept - Department name
 * @param {number} maxTasksInRow - Maximum tasks in row for gridRow span
 * @returns {HTMLElement} Department label element
 */
function createDepartmentLabel(dept, maxTasksInRow) {
    const deptLabel = document.createElement('div');
    deptLabel.className = `department-label department-${normalizeDepartmentClass(dept)}`;

    if (dept === 'Special Events') {
        deptLabel.innerHTML = 'Special<br>Events';
    } else {
        deptLabel.textContent = dept;
    }

    deptLabel.style.gridRow = `span ${maxTasksInRow}`;
    deptLabel.style.zIndex = Z_INDEX.DEPT_LABEL;

    return deptLabel;
}

/**
 * Create grid cell with task card or placeholder
 * @param {Object} task - Task object (or undefined for placeholder)
 * @param {Date} date - Date for the cell
 * @param {string} dept - Department name
 * @param {string} rowClass - Row class for height equalization
 * @returns {HTMLElement} Grid cell element
 */
function createGridCell(task, date, dept, rowClass) {
    const dayCell = document.createElement('div');
    dayCell.className = 'grid-cell';

    if (task) {
        const card = createTaskCard(task, rowClass);
        dayCell.appendChild(card);
    } else {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        const weekStr = getLocalDateString(getMonday(date));

        const placeholder = createTaskCardPlaceholder(dept, dateStr, weekStr, rowClass);
        dayCell.appendChild(placeholder);
    }

    return dayCell;
}

/**
 * Render department rows with task cards
 * @param {HTMLElement} grid - Grid element to append rows to
 * @param {string[]} sortedDepts - Sorted department names
 * @param {Object} tasksByDept - Tasks grouped by department
 * @param {Date[]} weekDates - Array of dates for the week
 * @param {Object} maxTasksPerDept - Maximum tasks per department
 * @returns {Set<string>} Set of all row classes created
 */
function renderDepartmentRows(grid, sortedDepts, tasksByDept, weekDates, maxTasksPerDept) {
    const allRowClasses = new Set();

    sortedDepts.forEach(dept => {
        if (tasksByDept[dept] !== undefined) {
            const deptTasks = tasksByDept[dept];
            const tasksByDate = groupTasksByDate(deptTasks, weekDates, dept);
            let maxTasksInRow = maxTasksPerDept[dept] || 0;

            // ALWAYS render Batch and Layout synthetic departments, even if maxTasksInRow is 0
            // These are special departments that should always be visible
            if ((dept === 'Batch' || dept === 'Layout') && maxTasksInRow === 0) {
                maxTasksInRow = 1;
            }

            // Debug Batch and Layout
            if (dept === 'Batch' || dept === 'Layout') {
                console.log(`[${dept}] deptTasks:`, deptTasks.length, deptTasks);
                console.log(`[${dept}] tasksByDate:`, tasksByDate);
                console.log(`[${dept}] maxTasksInRow (forced to 1 if 0):`, maxTasksInRow);
            }

            if (maxTasksInRow === 0) return;

            // Add department label
            grid.appendChild(createDepartmentLabel(dept, maxTasksInRow));

            // Render rows for this department
            for (let i = 0; i < maxTasksInRow; i++) {
                const rowClass = `dept-row-${normalizeDepartmentClass(dept)}-${i}`;
                allRowClasses.add(rowClass);

                weekDates.forEach(date => {
                    const dateString = date.toDateString();
                    const task = tasksByDate[dateString] ? tasksByDate[dateString][i] : undefined;

                    // Debug Batch and Layout task retrieval
                    if (dept === 'Batch' || dept === 'Layout') {
                        console.log(`[${dept}] Date: ${dateString}, Task at [${i}]:`, task);
                    }

                    const dayCell = createGridCell(task, date, dept, rowClass);
                    grid.appendChild(dayCell);
                });
            }
        }
    });

    return allRowClasses;
}

/**
 * Render a single week grid
 * @param {Date} dateForWeek - A date within the week to render
 * @param {Object} maxTasksPerDept - Maximum tasks per department for row normalization
 * @returns {HTMLElement} Week grid element
 */
export function renderWeekGrid(dateForWeek, maxTasksPerDept) {
    const filteredTasks = getFilteredTasks();
    const grid = document.createElement('div');
    grid.className = 'schedule-grid';

    // Setup Monday and week dates
    const monday = new Date(dateForWeek);
    monday.setDate(dateForWeek.getDate() - (dateForWeek.getDay() || 7) + 1);
    grid.dataset.mondayDate = getLocalDateString(monday);

    const weekDates = createWeekDates(monday);

    // Generate special department tasks
    const allTasks = getAllTasks(); // Explicitly get the latest state
    const batchTasks = generateBatchTasks(weekDates, monday, () => allTasks);
    const layoutTasks = generateLayoutTasks(weekDates, monday, () => allTasks);

    console.log('[SYNTHETIC] Generated batchTasks:', batchTasks.length, batchTasks);
    console.log('[SYNTHETIC] Generated layoutTasks:', layoutTasks.length, layoutTasks);

    // Create header row
    grid.innerHTML = createHeaderRow(weekDates);

    // Group and sort tasks
    const tasksByDept = groupTasksByDepartment(filteredTasks, batchTasks, layoutTasks);
    const sortedDepts = sortDepartments(tasksByDept);

    // Render department rows
    const allRowClasses = renderDepartmentRows(grid, sortedDepts, tasksByDept, weekDates, maxTasksPerDept);

    // Store row classes for height equalization
    grid.dataset.rowClasses = [...allRowClasses].join(',');

    return grid;
}
