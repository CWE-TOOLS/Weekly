/**
 * Schedule Renderer Module
 * Handles rendering of weekly schedule grids and card height equalization
 *
 * Dependencies:
 * - utils/date-utils.js (parseDate, getMonday, getLocalDateString, getWeekMonth, getWeekOfMonth)
 * - core/state.js (filteredTasks, allTasks, allWeekStartDates, currentViewedWeekIndex)
 * - config/constants.js (DEPARTMENT_ORDER)
 * - utils/department-utils.js (normalizeDepartmentClass)
 */

import { parseDate, getMonday, getLocalDateString, getWeekMonth, getWeekOfMonth } from '../../utils/date-utils.js';
import { renderWeekGrid } from '../../components/week-renderer.js';
import { Z_INDEX } from '../../config/layout-constants.js';
import { RENDER_DELAY } from '../../config/timing-constants.js';

// State references (will be set by state.js)
let filteredTasks = [];
let allTasks = [];
let allWeekStartDates = [];
let currentViewedWeekIndex = -1;

/**
 * Render all weeks in the schedule
 * Main entry point for rendering the complete schedule view
 */
export function renderAllWeeks() {
    showRenderingStatus(true, 'Rendering schedule...');
    const container = document.getElementById('schedule-container');
    const wrapper = document.getElementById('schedule-wrapper');
    container.innerHTML = '';
    allWeekStartDates.length = 0; // Clear the array

    if (filteredTasks.length === 0) {
        container.innerHTML = '<div class="loading">No tasks found for the selected department.</div>';
        return;
    }

    // Group tasks by the Monday of their week
    const tasksByWeek = {};
    let currentMonday = getMonday(new Date()); // Assign early for missing dates
    filteredTasks.forEach(task => {
        if (!task.project) return;
        let taskDate = parseDate(task.date);
        if (!taskDate) {
            task.missingDate = true;
            taskDate = currentMonday; // Assign to current week for display
        }
        const monday = getMonday(taskDate);
        const mondayString = getLocalDateString(monday);
        if (!tasksByWeek[mondayString]) {
            tasksByWeek[mondayString] = [];
        }
        tasksByWeek[mondayString].push(task);
    });

    // Generate all weeks between the earliest and latest non-empty weeks, including empty ones
    const mondayStrings = Object.keys(tasksByWeek);
    let allMondays = [];
    if (mondayStrings.length === 0) {
        // No tasks, include only current week
        currentMonday = getMonday(new Date());
        const currentMondayString = getLocalDateString(currentMonday);
        allMondays = [currentMonday];
        tasksByWeek[currentMondayString] = [];
    } else {
        mondayStrings.sort();
        const minMonday = new Date(mondayStrings[0] + 'T00:00:00');
        const maxMonday = new Date(mondayStrings[mondayStrings.length - 1] + 'T00:00:00');
        let current = new Date(minMonday);
        while (current <= maxMonday) {
            const mondayString = getLocalDateString(current);
            allMondays.push(new Date(current));
            if (!tasksByWeek[mondayString]) {
                tasksByWeek[mondayString] = [];
            }
            current.setDate(current.getDate() + 7);
        }
        // Include current week if not already included
        currentMonday = getMonday(new Date());
        const currentMondayString = getLocalDateString(currentMonday);
        if (!allMondays.some(d => d.getTime() === currentMonday.getTime())) {
            allMondays.push(currentMonday);
            allMondays.sort((a, b) => a - b);
            if (!tasksByWeek[currentMondayString]) {
                tasksByWeek[currentMondayString] = [];
            }
        }
    }
    allWeekStartDates.push(...allMondays);

    // --- Global Calculation for Row Normalization ---
    const maxTasksPerDept = {};
    window.DEPARTMENT_ORDER.forEach(dept => {
        const deptTasks = filteredTasks.filter(t => t.department === dept);
        if (deptTasks.length === 0) return;

        const tasksByDate = {};
        deptTasks.forEach(task => {
            if (!task.project) return;
            let taskDate = parseDate(task.date);
            if (!taskDate) {
                task.missingDate = true;
                taskDate = getMonday(new Date());
            }
            const dateString = taskDate.toDateString();
            if (!tasksByDate[dateString]) tasksByDate[dateString] = [];
            tasksByDate[dateString].push(task);
        });

        const maxTasks = Math.max(0, ...Object.values(tasksByDate).map(tasks => tasks.length));
        if (maxTasks > 0) {
            maxTasksPerDept[dept] = maxTasks;
        }
    });
    maxTasksPerDept['Batch'] = 1;
    maxTasksPerDept['Layout'] = 1;
    maxTasksPerDept['Sample'] = 1;

    // Render a grid for each week using the global max tasks count - use document fragment for better performance
    const fragment = document.createDocumentFragment();
    allWeekStartDates.forEach(mondayDate => {
        fragment.appendChild(renderWeekGrid(mondayDate, maxTasksPerDept));
    });
    container.appendChild(fragment);

    // Determine the initial week index, preserving the currently viewed week if set
    if (currentViewedWeekIndex === -1 || currentViewedWeekIndex >= allWeekStartDates.length) {
        // Try to restore from localStorage first
        const savedWeekIndex = localStorage.getItem('currentViewedWeekIndex');

        if (savedWeekIndex && !isNaN(parseInt(savedWeekIndex))) {
            const restoredIndex = parseInt(savedWeekIndex);
            if (restoredIndex >= 0 && restoredIndex < allWeekStartDates.length) {
                currentViewedWeekIndex = restoredIndex;
            }
        }

        // If no valid saved position, set to current week
        if (currentViewedWeekIndex === -1 || currentViewedWeekIndex >= allWeekStartDates.length) {
            currentMonday = getMonday(new Date());
            currentViewedWeekIndex = allWeekStartDates.findIndex(d => d.getTime() === currentMonday.getTime());
            if (currentViewedWeekIndex === -1) {
                currentViewedWeekIndex = allWeekStartDates.findIndex(d => d > currentMonday);
                if (currentViewedWeekIndex === -1) currentViewedWeekIndex = allWeekStartDates.length - 1;
            }
        }
    }
    let initialWeekIndex = currentViewedWeekIndex;

    // Performance optimization: Use requestAnimationFrame for better performance
    requestAnimationFrame(() => {
        // Set the precise width for each grid now that they are in the DOM
        const wrapperWidth = wrapper.clientWidth;
        const grids = container.querySelectorAll('.schedule-grid');
        grids.forEach(grid => {
            grid.style.width = `${wrapperWidth}px`;
        });

        // Scroll to the target week using offsetLeft
        if (grids[initialWeekIndex]) {
            const targetScrollLeft = grids[initialWeekIndex].offsetLeft;
            wrapper.scrollLeft = targetScrollLeft;
        }

        // Update header after scroll position is set
        const finalWeekIndex = Math.min(currentViewedWeekIndex, allWeekStartDates.length - 1);
        updateWeekDisplayHeader(allWeekStartDates[finalWeekIndex]);

        equalizeAllCardHeights();
        // Reset will-change after optimizations
        wrapper.style.willChange = 'auto';
    });

    // Store successful render state
    window.lastRenderTimestamp = Date.now();
    window.renderCache = {
        containerHTML: container.innerHTML,
        scrollPosition: wrapper.scrollLeft,
        weekIndex: currentViewedWeekIndex,
        weekDates: [...allWeekStartDates]
    };

    // Re-enable add card indicators after rendering
    setTimeout(() => {
        if (typeof window.enableAddCardIndicators === 'function') {
            window.enableAddCardIndicators();
        }
        showRenderingStatus(false);
    }, RENDER_DELAY.SCHEDULE_RENDERER);
}


/**
 * Update the week display header with the current week's date range
 *
 * @param {Date} date - Date within the week to display
 */
export function updateWeekDisplayHeader(date) {
    if (!date) return;
    const monday = getMonday(date);
    const month = getWeekMonth(monday);
    const weekNum = getWeekOfMonth(monday, month);
    const weekStart = new Date(monday);
    const weekEnd = new Date(monday);
    weekEnd.setDate(monday.getDate() + 5);
    const weekDisplay = document.getElementById('week-display');
    weekDisplay.textContent = `Week ${weekNum}: ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

/**
 * Equalize card heights across all weeks for each department row
 */
export function equalizeAllCardHeights() {
    const container = document.getElementById("schedule-container");
    const allRowClasses = new Set();

    container.querySelectorAll(".schedule-grid").forEach(grid => {
        const rowClasses = grid.dataset.rowClasses || "";
        rowClasses.split(",").forEach(rowClass => {
            if (rowClass) allRowClasses.add(rowClass);
        });
    });

    allRowClasses.forEach(rowClass => {
        const cells = container.querySelectorAll(`.${rowClass}`);
        if (cells.length === 0) return;

        let maxHeight = 0;
        cells.forEach(cell => {
            const height = cell.offsetHeight;
            if (height > maxHeight) maxHeight = height;
        });

        if (maxHeight > 0) {
            cells.forEach(cell => {
                cell.style.minHeight = `${maxHeight}px`;
            });
        }
    });
}

/**
 * Equalize card heights within project view sections
 */
export function equalizeProjectCardHeights() {
    const projectSections = document.querySelectorAll('.project-dept-section');

    projectSections.forEach(section => {
        const cards = section.querySelectorAll('.project-task-card');
        if (cards.length === 0) return;

        // Find max height
        let maxHeight = 0;
        cards.forEach(card => {
            const originalHeight = card.style.minHeight;
            card.style.minHeight = 'auto';
            const currentHeight = card.offsetHeight;
            if (currentHeight > maxHeight) maxHeight = currentHeight;
            card.style.minHeight = originalHeight;
        });

        // Apply max height to all cards in this section
        if (maxHeight > 0) {
            cards.forEach(card => {
                card.style.minHeight = `${maxHeight}px`;
            });
        }
    });
}

/**
 * Set state references (called from state.js initialization)
 */
export function setStateReferences(refs) {
    filteredTasks = refs.filteredTasks;
    allTasks = refs.allTasks;
    allWeekStartDates = refs.allWeekStartDates;
    currentViewedWeekIndex = refs.currentViewedWeekIndex;
}


// UI Helper function
function showRenderingStatus(show, message = 'Optimizing layout...') {
    const statusElement = document.getElementById('rendering-status');
    if (show) {
        statusElement.textContent = message;
        statusElement.style.display = 'block';
    } else {
        statusElement.style.display = 'none';
    }
}
