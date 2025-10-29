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
            if (restoredIndex < allWeekStartDates.length) {
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

        // Scroll to the target grid
        if (grids[initialWeekIndex]) {
            const targetScrollLeft = grids[initialWeekIndex].offsetLeft;

            // Try to restore from localStorage first
            const savedScrollPosition = localStorage.getItem('scheduleScrollPosition');
            if (savedScrollPosition && !isNaN(parseFloat(savedScrollPosition))) {
                const savedPosition = parseFloat(savedScrollPosition);
                // Only use saved position if it's within reasonable bounds
                if (savedPosition >= 0 && savedPosition <= wrapper.scrollWidth) {
                    wrapper.scrollLeft = savedPosition;
                    // Update currentViewedWeekIndex based on restored position
                    currentViewedWeekIndex = Math.round(savedPosition / wrapper.offsetWidth);
                } else {
                    wrapper.scrollLeft = targetScrollLeft;
                }
            } else {
                wrapper.scrollLeft = targetScrollLeft;
            }
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
    }, 100);
}

/**
 * Render a single week grid
 *
 * @param {Date} dateForWeek - Date within the week to render
 * @param {Object} maxTasksPerDept - Object mapping department names to max task counts
 * @returns {HTMLElement} The grid element
 */
export function renderWeekGrid(dateForWeek, maxTasksPerDept) {
    const grid = document.createElement('div');
    grid.className = 'schedule-grid';

    // --- Date Setup ---
    const monday = new Date(dateForWeek);
    monday.setDate(dateForWeek.getDate() - (dateForWeek.getDay() || 7) + 1);
    grid.dataset.mondayDate = getLocalDateString(monday);
    const weekDates = Array.from({ length: 6 }).map((_, i) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        return date;
    });

    // Generate batch tasks (Mon-Fri only)
    const batchTasks = generateBatchTasks(weekDates, dateForWeek);

    // Generate layout tasks (Mon-Fri only)
    const layoutTasks = generateLayoutTasks(weekDates, dateForWeek);

    // --- Header Row ---
    let headerHTML = `<div class="grid-header">Department</div>`;
    weekDates.forEach(date => {
        const isToday = date.toDateString() === new Date().toDateString();
        headerHTML += `<div class="grid-header"><div class="date-container ${isToday ? "today-highlight" : ""}"><div class="date-weekday">${date.toLocaleDateString("en-US", { weekday: "short" })}</div><div class="date-day">${date.toLocaleDateString("en-US", { day: "numeric" })}</div></div></div>`;
    });
    grid.innerHTML = headerHTML;

    // --- Data Grouping ---
    const tasksByDept = {};
    // Initialize all departments from DEPARTMENT_ORDER with empty arrays
    window.DEPARTMENT_ORDER.forEach(dept => {
        tasksByDept[dept] = [];
    });
    filteredTasks.forEach(task => {
        const dept = task.department || 'Other';
        if (!tasksByDept[dept]) tasksByDept[dept] = [];
        tasksByDept[dept].push(task);
    });
    tasksByDept['Batch'] = batchTasks;
    tasksByDept['Layout'] = layoutTasks;
    // Ensure Special Events always exists even if empty
    if (!tasksByDept['Special Events']) {
        tasksByDept['Special Events'] = [];
    }

    // Collect all departments present in tasks, sorted by DEPARTMENT_ORDER priority
    const allDepts = new Set(window.DEPARTMENT_ORDER);
    Object.keys(tasksByDept).forEach(dept => allDepts.add(dept));
    const sortedDepts = Array.from(allDepts).sort((a, b) => {
        const aIndex = window.DEPARTMENT_ORDER.indexOf(a);
        const bIndex = window.DEPARTMENT_ORDER.indexOf(b);
        if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
    });

    const allRowClasses = new Set();

    // --- Render Department Rows ---
    sortedDepts.forEach(dept => {
        if (tasksByDept[dept] !== undefined) {
            const deptTasks = tasksByDept[dept];
            const tasksByDate = {};
            weekDates.forEach(date => {
                const dateString = date.toDateString();
                tasksByDate[dateString] = deptTasks.filter(t => {
                    if (!t.date) return false;
                    const taskDate = parseDate(t.date);
                    return taskDate && taskDate.toDateString() === dateString;
                });
            });

            const maxTasksInRow = maxTasksPerDept[dept] || 0;
            if (maxTasksInRow === 0) return;

            // Add department label, spanning all its potential rows
            const deptLabel = document.createElement('div');
            deptLabel.className = `department-label department-${normalizeDepartmentClass(dept)}`;
            if (dept === 'Special Events') {
                deptLabel.innerHTML = 'Special<br>Events';
            } else {
                deptLabel.textContent = dept;
            }
            deptLabel.style.gridRow = `span ${maxTasksInRow}`;
            deptLabel.style.zIndex = '10'; // Ensure department labels stay above dragging cards
            grid.appendChild(deptLabel);

            for (let i = 0; i < maxTasksInRow; i++) {
                const rowClass = `dept-row-${normalizeDepartmentClass(dept)}-${i}`;
                allRowClasses.add(rowClass);

                weekDates.forEach(date => {
                    const dateString = date.toDateString();
                    const dayCell = document.createElement('div');
                    dayCell.className = 'grid-cell';

                    const task = tasksByDate[dateString] ? tasksByDate[dateString][i] : undefined;

                    const editingUnlocked = localStorage.getItem('editingUnlocked') === 'true';
                    if (task) {
                        const showDetails = task.department !== 'Batch' && task.department !== 'Layout';
                        const isManualAndEditable = task.isManual && editingUnlocked;
                        dayCell.innerHTML = `<div class="task-card ${rowClass} department-${normalizeDepartmentClass(task.department)} ${isManualAndEditable ? '' : 'not-draggable'}" data-task-id="${task.id}" ${isManualAndEditable ? 'draggable="true"' : ''} title="${isManualAndEditable ? 'Drag to move to different date' : 'Click for options'}"><div class="task-title">${task.project}</div><div class="project-description">${task.projectDescription || ''}</div><div class="task-day-counter">${task.dayCounter || ''}</div><div class="task-description">${task.description && task.description.trim() ? task.description : '<span class="missing-description">Staging Missing</span>'}</div>${showDetails ? `<div class="task-details">${task.missingDate ? '<strong>Date:</strong> Missing<br>' : ''}<strong>Hours:</strong> ${task.hours}</div>` : ''}${editingUnlocked ? `<button class="task-plan-btn" data-task-id="${task.id}">Plan</button><button class="task-edit-btn" data-task-id="${task.id}">Edit</button>` : ''}${isManualAndEditable ? `<button class="task-delete-btn" data-task-id="${task.id}" title="Delete this manual task">🗑️</button>` : ''}</div>`;
                    } else {
                        const year = date.getFullYear();
                        const month = (date.getMonth() + 1).toString().padStart(2, '0');
                        const day = date.getDate().toString().padStart(2, '0');
                        const dateString = `${year}-${month}-${day}`;
                        const weekString = getLocalDateString(getMonday(date));
                        const placeholder = document.createElement('div');
                        placeholder.className = `task-card-placeholder ${rowClass}${editingUnlocked ? ' add-enabled' : ''}`;
                        placeholder.dataset.department = dept;
                        placeholder.dataset.date = dateString;
                        placeholder.dataset.week = weekString;
                        dayCell.appendChild(placeholder);
                    }
                    grid.appendChild(dayCell);
                });
            }
        }
    });

    grid.dataset.rowClasses = [...allRowClasses].join(',');
    return grid;
}

/**
 * Generate batch tasks for a week (looks ahead to next day's casting)
 */
function generateBatchTasks(weekDates, dateForWeek) {
    const batchTasks = [];
    weekDates.forEach((date, i) => {
        if (i < 5) { // Mon to Fri
            let castingProjects = [];
            if (i === 4) { // Friday
                // Get tasks for Saturday
                const saturday = new Date(date);
                saturday.setDate(date.getDate() + 1);
                const saturdayString = saturday.toDateString();
                const saturdayProjects = allTasks
                    .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === saturdayString)
                    .map(t => t.project);
                if (saturdayProjects.length > 0) {
                    castingProjects.push(`<b>Sat:</b> ${saturdayProjects.join(', ')}`);
                }

                // Get tasks for Monday
                const monday = new Date(date);
                monday.setDate(date.getDate() + 3);
                const mondayString = monday.toDateString();
                const mondayProjects = allTasks
                    .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === mondayString)
                    .map(t => t.project);
                if (mondayProjects.length > 0) {
                    castingProjects.push(`<b>Mon:</b> ${mondayProjects.join(', ')}`);
                }
            } else {
                // For Mon-Thu, get next day's tasks
                const nextDate = new Date(date);
                nextDate.setDate(date.getDate() + 1);
                const nextDateString = nextDate.toDateString();
                castingProjects = allTasks
                    .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === nextDateString)
                    .map(t => t.project);
            }
            const batchTask = {
                id: `batch-${date.toISOString()}`,
                week: getLocalDateString(getMonday(dateForWeek)),
                project: 'Batch',
                description: castingProjects.length > 0 ? castingProjects.join('<br>') : '',
                date: getLocalDateString(date),
                department: 'Batch',
                value: '',
                hours: '',
                dayNumber: '',
                totalDays: '',
                dayCounter: '',
                missingDate: false
            };
            batchTasks.push(batchTask);
        }
    });
    return batchTasks;
}

/**
 * Generate layout tasks for a week (looks ahead to next day's casting)
 */
function generateLayoutTasks(weekDates, dateForWeek) {
    const layoutTasks = [];
    weekDates.forEach((date, i) => {
        if (i < 5) { // Mon to Fri
            let castingProjects = [];
            if (i === 4) { // Friday
                // Get tasks for Saturday
                const saturday = new Date(date);
                saturday.setDate(date.getDate() + 1);
                const saturdayString = saturday.toDateString();
                const saturdayProjects = allTasks
                    .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === saturdayString)
                    .map(t => t.project);
                if (saturdayProjects.length > 0) {
                    castingProjects.push(`<b>Sat:</b> ${saturdayProjects.join(', ')}`);
                }

                // Get tasks for Monday
                const monday = new Date(date);
                monday.setDate(date.getDate() + 3);
                const mondayString = monday.toDateString();
                const mondayProjects = allTasks
                    .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === mondayString)
                    .map(t => t.project);
                if (mondayProjects.length > 0) {
                    castingProjects.push(`<b>Mon:</b> ${mondayProjects.join(', ')}`);
                }
            } else {
                // For Mon-Thu, get next day's tasks
                const nextDate = new Date(date);
                nextDate.setDate(date.getDate() + 1);
                const nextDateString = nextDate.toDateString();
                castingProjects = allTasks
                    .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === nextDateString)
                    .map(t => t.project);
            }
            const layoutTask = {
                id: `layout-${date.toISOString()}`,
                week: getLocalDateString(getMonday(dateForWeek)),
                project: 'Layout',
                description: castingProjects.length > 0 ? castingProjects.join('<br>') : '',
                date: getLocalDateString(date),
                department: 'Layout',
                value: '',
                hours: '',
                dayNumber: '',
                totalDays: '',
                dayCounter: '',
                missingDate: false
            };
            layoutTasks.push(layoutTask);
        }
    });
    return layoutTasks;
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

// Helper function - should be imported from utils
function normalizeDepartmentClass(dept) {
    if (!dept) return '';
    return dept.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
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
