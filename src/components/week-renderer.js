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
 *   - createWeekDates() - Generate array of dates for the week (imported from date-utils)
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

import { getFilteredTasks, getAllTasks, injectSyntheticTasks } from '../core/state.js';
import { getMonday, getLocalDateString, createWeekDates } from '../utils/date-utils.js';
import { DEPARTMENT_ORDER } from '../config/department-config.js';
import { groupTasksByDepartment, groupTasksByDate } from '../utils/department-utils.js';
import { createTaskCard, createTaskCardPlaceholder, normalizeDepartmentClass } from './task-card.js';
import { generateAllSyntheticTasks } from '../utils/schedule-utils.js';
import { Z_INDEX } from '../config/layout-constants.js';
import { logger } from '../utils/logger.js';

/**
 * Create header row elements for week grid
 * @param {Date[]} weekDates - Array of dates for the week
 * @returns {DocumentFragment} Fragment containing header elements
 */
function createHeaderRow(weekDates) {
    const fragment = document.createDocumentFragment();
    const todayStr = new Date().toDateString();

    const deptHeader = document.createElement('div');
    deptHeader.className = 'grid-header';
    deptHeader.textContent = 'Department';
    fragment.appendChild(deptHeader);

    weekDates.forEach(date => {
        const header = document.createElement('div');
        header.className = 'grid-header';

        const container = document.createElement('div');
        container.className = 'date-container';
        if (date.toDateString() === todayStr) {
            container.classList.add('today-highlight');
        }

        const weekday = document.createElement('div');
        weekday.className = 'date-weekday';
        weekday.textContent = date.toLocaleDateString('en-US', { weekday: 'short' });

        const day = document.createElement('div');
        day.className = 'date-day';
        day.textContent = date.toLocaleDateString('en-US', { day: 'numeric' });

        container.appendChild(weekday);
        container.appendChild(day);
        header.appendChild(container);
        fragment.appendChild(header);
    });

    return fragment;
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
function createGridCell(task, date, dept, rowClass, isEditingUnlocked) {
    const dayCell = document.createElement('div');
    dayCell.className = 'grid-cell';

    // Format date and set data attributes for smart renderer queries
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    dayCell.dataset.date = dateStr;
    dayCell.dataset.department = dept;

    if (task) {
        const card = createTaskCard(task, rowClass, isEditingUnlocked);
        dayCell.appendChild(card);
    } else {
        const weekStr = getLocalDateString(getMonday(date));
        const placeholder = createTaskCardPlaceholder(dept, dateStr, weekStr, rowClass, isEditingUnlocked);
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
function renderDepartmentRows(grid, sortedDepts, tasksByDept, weekDates, maxTasksPerDept, isEditingUnlocked) {
    const allRowClasses = new Set();
    const weekDateStrings = weekDates.map(d => d.toDateString());

    sortedDepts.forEach(dept => {
        const deptData = tasksByDept[dept];
        const primaryMaxTasks = maxTasksPerDept[dept] || 0;

        if (!deptData || (deptData.tasks.length === 0 && (!deptData.syntheticTasks || deptData.syntheticTasks.length === 0))) {
            if (primaryMaxTasks > 0) {
                // This case handles departments that have max tasks but no actual tasks in the current week
                // We still need to render placeholders to maintain grid alignment
            } else {
                return;
            }
        }

        // --- Render Primary Department ---
        const primaryTasks = (deptData && deptData.tasks) || [];
        const primaryTasksByDate = groupTasksByDate(primaryTasks, weekDates);
        const rowsToRender = Math.max(primaryMaxTasks, 0);

        if (rowsToRender > 0) {
            grid.appendChild(createDepartmentLabel(dept, rowsToRender));
            for (let i = 0; i < rowsToRender; i++) {
                const rowClass = `dept-row-${normalizeDepartmentClass(dept)}-${i}`;
                allRowClasses.add(rowClass);
                weekDates.forEach((date, dateIdx) => {
                    const dateString = weekDateStrings[dateIdx];
                    const task = (primaryTasksByDate[dateString] && primaryTasksByDate[dateString][i]) || undefined;
                    grid.appendChild(createGridCell(task, date, dept, rowClass, isEditingUnlocked));
                });
            }
        }

        // --- Render Synthetic Department (if exists) ---
        const syntheticTasks = (deptData && deptData.syntheticTasks) || [];
        const syntheticDeptName = deptData && deptData.syntheticDeptName;
        if (syntheticTasks.length > 0 && syntheticDeptName) {
            const syntheticTasksByDate = groupTasksByDate(syntheticTasks, weekDates);
            const syntheticMaxTasks = 1; // Always 1 row for synthetic depts

            grid.appendChild(createDepartmentLabel(syntheticDeptName, syntheticMaxTasks));
            for (let i = 0; i < syntheticMaxTasks; i++) {
                const rowClass = `dept-row-${normalizeDepartmentClass(syntheticDeptName)}-${i}`;
                allRowClasses.add(rowClass);
                weekDates.forEach((date, dateIdx) => {
                    const dateString = weekDateStrings[dateIdx];
                    const task = (syntheticTasksByDate[dateString] && syntheticTasksByDate[dateString][i]) || undefined;
                    grid.appendChild(createGridCell(task, date, syntheticDeptName, rowClass, isEditingUnlocked));
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
export function renderWeekGrid(dateForWeek, maxTasksPerDept, isEditingUnlocked) {
    const filteredTasks = getFilteredTasks();
    const grid = document.createElement('div');
    grid.className = 'schedule-grid';

    // Setup Monday and week dates
    const monday = new Date(dateForWeek);
    monday.setDate(dateForWeek.getDate() - (dateForWeek.getDay() || 7) + 1);
    grid.dataset.mondayDate = getLocalDateString(monday);

    const weekDates = createWeekDates(monday);

    // Generate special department tasks
    const syntheticTasksByDept = generateAllSyntheticTasks(weekDates, monday, getAllTasks);

    // Inject synthetic tasks into state for smart renderer
    injectSyntheticTasks(Object.values(syntheticTasksByDept).flat());

    // Create header row
    grid.appendChild(createHeaderRow(weekDates));

    // Group and sort tasks
    const tasksByDept = groupTasksByDepartment(filteredTasks, syntheticTasksByDept);
    const sortedDepts = Object.keys(tasksByDept).sort((a, b) => {
        const aIndex = DEPARTMENT_ORDER.indexOf(a);
        const bIndex = DEPARTMENT_ORDER.indexOf(b);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
    });

    // Render department rows
    const allRowClasses = renderDepartmentRows(grid, sortedDepts, tasksByDept, weekDates, maxTasksPerDept, isEditingUnlocked);

    // Store row classes for height equalization
    grid.dataset.rowClasses = [...allRowClasses].join(',');

    return grid;
}
