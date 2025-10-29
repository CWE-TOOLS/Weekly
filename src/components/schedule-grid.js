/**
 * Schedule Grid Component
 * Handles rendering of the main weekly schedule grid
 * @module components/schedule-grid
 */

import {
    getFilteredTasks,
    getAllTasks,
    setAllWeekStartDates,
    getAllWeekStartDates,
    getCurrentViewedWeekIndex,
    setCurrentViewedWeekIndex,
    getIsEditingUnlocked
} from '../core/state.js';
import { emit, EVENTS } from '../core/event-bus.js';
import { loadScrollPosition, saveScrollPosition, loadWeekIndex, saveWeekIndex } from '../core/storage.js';
import { parseDate, getMonday, getLocalDateString } from '../utils/date-utils.js';
import { showRenderingStatus } from '../utils/ui-utils.js';
import { DEPARTMENT_ORDER } from '../config/department-config.js';
import { createTaskCard, createTaskCardPlaceholder, normalizeDepartmentClass } from './task-card.js';

/**
 * Equalize card heights across all weeks for consistent layout
 */
export function equalizeAllCardHeights() {
    const container = document.getElementById('schedule-container');
    if (!container) return;

    const allRowClasses = new Set();

    // Collect all row classes from all grids
    container.querySelectorAll('.schedule-grid').forEach(grid => {
        const rowClasses = grid.dataset.rowClasses || '';
        rowClasses.split(',').forEach(cls => {
            if (cls) allRowClasses.add(cls);
        });
    });

    // For each row class, find max height and apply to all
    allRowClasses.forEach(rowClass => {
        const rows = container.querySelectorAll(`.${rowClass}`);
        if (rows.length === 0) return;

        let maxHeight = 0;
        rows.forEach(row => {
            const height = row.offsetHeight;
            if (height > maxHeight) maxHeight = height;
        });

        if (maxHeight > 0) {
            rows.forEach(row => {
                row.style.minHeight = `${maxHeight}px`;
            });
        }
    });
}

/**
 * Enable add card indicators (placeholder cells)
 */
function enableAddCardIndicators() {
    // This function is called after rendering completes
    // Placeholder cells are already created with add-enabled class if editing is unlocked
}

/**
 * Generate batch tasks for a week (Mon-Fri showing next day's casting)
 * @param {Date[]} weekDates - Array of 6 dates (Mon-Sat)
 * @param {Date} monday - Monday of the week
 * @returns {Object[]} Array of batch tasks
 */
function generateBatchTasks(weekDates, monday) {
    const allTasks = getAllTasks();
    const batchTasks = [];

    weekDates.forEach((date, i) => {
        if (i < 5) { // Mon to Fri
            let castingProjects = [];

            if (i === 4) { // Friday - show Saturday and Monday
                // Saturday
                const saturday = new Date(date);
                saturday.setDate(date.getDate() + 1);
                const saturdayString = saturday.toDateString();
                const saturdayProjects = allTasks
                    .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === saturdayString)
                    .map(t => t.project);
                if (saturdayProjects.length > 0) {
                    castingProjects.push(`<b>Sat:</b> ${saturdayProjects.join(', ')}`);
                }

                // Monday (next week)
                const nextMonday = new Date(date);
                nextMonday.setDate(date.getDate() + 3);
                const mondayString = nextMonday.toDateString();
                const mondayProjects = allTasks
                    .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === mondayString)
                    .map(t => t.project);
                if (mondayProjects.length > 0) {
                    castingProjects.push(`<b>Mon:</b> ${mondayProjects.join(', ')}`);
                }
            } else {
                // Mon-Thu - show next day's tasks
                const nextDate = new Date(date);
                nextDate.setDate(date.getDate() + 1);
                const nextDateString = nextDate.toDateString();
                castingProjects = allTasks
                    .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === nextDateString)
                    .map(t => t.project);
            }

            const batchTask = {
                id: `batch-${date.toISOString()}`,
                week: getLocalDateString(monday),
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
 * Generate layout tasks for a week (same as batch tasks)
 * @param {Date[]} weekDates - Array of 6 dates (Mon-Sat)
 * @param {Date} monday - Monday of the week
 * @returns {Object[]} Array of layout tasks
 */
function generateLayoutTasks(weekDates, monday) {
    const allTasks = getAllTasks();
    const layoutTasks = [];

    weekDates.forEach((date, i) => {
        if (i < 5) { // Mon to Fri
            let castingProjects = [];

            if (i === 4) { // Friday
                // Saturday
                const saturday = new Date(date);
                saturday.setDate(date.getDate() + 1);
                const saturdayString = saturday.toDateString();
                const saturdayProjects = allTasks
                    .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === saturdayString)
                    .map(t => t.project);
                if (saturdayProjects.length > 0) {
                    castingProjects.push(`<b>Sat:</b> ${saturdayProjects.join(', ')}`);
                }

                // Monday
                const nextMonday = new Date(date);
                nextMonday.setDate(date.getDate() + 3);
                const mondayString = nextMonday.toDateString();
                const mondayProjects = allTasks
                    .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === mondayString)
                    .map(t => t.project);
                if (mondayProjects.length > 0) {
                    castingProjects.push(`<b>Mon:</b> ${mondayProjects.join(', ')}`);
                }
            } else {
                // Mon-Thu
                const nextDate = new Date(date);
                nextDate.setDate(date.getDate() + 1);
                const nextDateString = nextDate.toDateString();
                castingProjects = allTasks
                    .filter(t => t.department === 'Cast' && parseDate(t.date) && parseDate(t.date).toDateString() === nextDateString)
                    .map(t => t.project);
            }

            const layoutTask = {
                id: `layout-${date.toISOString()}`,
                week: getLocalDateString(monday),
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
 * Render a single week grid
 * @param {Date} dateForWeek - A date within the week to render
 * @param {Object} maxTasksPerDept - Maximum tasks per department for row normalization
 * @returns {HTMLElement} Week grid element
 */
function renderWeekGrid(dateForWeek, maxTasksPerDept) {
    const filteredTasks = getFilteredTasks();
    const grid = document.createElement('div');
    grid.className = 'schedule-grid';

    // Setup Monday and week dates
    const monday = new Date(dateForWeek);
    monday.setDate(dateForWeek.getDate() - (dateForWeek.getDay() || 7) + 1);
    grid.dataset.mondayDate = getLocalDateString(monday);

    const weekDates = Array.from({ length: 6 }).map((_, i) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        return date;
    });

    // Generate special department tasks
    const batchTasks = generateBatchTasks(weekDates, monday);
    const layoutTasks = generateLayoutTasks(weekDates, monday);

    // Header Row
    let headerHTML = '<div class="grid-header">Department</div>';
    weekDates.forEach(date => {
        const isToday = date.toDateString() === new Date().toDateString();
        headerHTML += `<div class="grid-header"><div class="date-container ${isToday ? 'today-highlight' : ''}"><div class="date-weekday">${date.toLocaleDateString('en-US', { weekday: 'short' })}</div><div class="date-day">${date.toLocaleDateString('en-US', { day: 'numeric' })}</div></div></div>`;
    });
    grid.innerHTML = headerHTML;

    // Group tasks by department
    const tasksByDept = {};
    DEPARTMENT_ORDER.forEach(dept => {
        tasksByDept[dept] = [];
    });
    filteredTasks.forEach(task => {
        const dept = task.department || 'Other';
        if (!tasksByDept[dept]) tasksByDept[dept] = [];
        tasksByDept[dept].push(task);
    });
    tasksByDept['Batch'] = batchTasks;
    tasksByDept['Layout'] = layoutTasks;
    if (!tasksByDept['Special Events']) {
        tasksByDept['Special Events'] = [];
    }

    // Sort departments
    const allDepts = new Set(DEPARTMENT_ORDER);
    Object.keys(tasksByDept).forEach(dept => allDepts.add(dept));
    const sortedDepts = Array.from(allDepts).sort((a, b) => {
        const aIndex = DEPARTMENT_ORDER.indexOf(a);
        const bIndex = DEPARTMENT_ORDER.indexOf(b);
        if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
    });

    const allRowClasses = new Set();

    // Render department rows
    sortedDepts.forEach(dept => {
        if (tasksByDept[dept] !== undefined) {
            const deptTasks = tasksByDept[dept];

            // Group tasks by date
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

            // Add department label
            const deptLabel = document.createElement('div');
            deptLabel.className = `department-label department-${normalizeDepartmentClass(dept)}`;
            if (dept === 'Special Events') {
                deptLabel.innerHTML = 'Special<br>Events';
            } else {
                deptLabel.textContent = dept;
            }
            deptLabel.style.gridRow = `span ${maxTasksInRow}`;
            deptLabel.style.zIndex = '10';
            grid.appendChild(deptLabel);

            // Render rows for this department
            for (let i = 0; i < maxTasksInRow; i++) {
                const rowClass = `dept-row-${normalizeDepartmentClass(dept)}-${i}`;
                allRowClasses.add(rowClass);

                weekDates.forEach(date => {
                    const dateString = date.toDateString();
                    const dayCell = document.createElement('div');
                    dayCell.className = 'grid-cell';

                    const task = tasksByDate[dateString] ? tasksByDate[dateString][i] : undefined;

                    if (task) {
                        // Create and append task card
                        const card = createTaskCard(task, rowClass);
                        dayCell.appendChild(card);
                    } else {
                        // Create placeholder
                        const year = date.getFullYear();
                        const month = (date.getMonth() + 1).toString().padStart(2, '0');
                        const day = date.getDate().toString().padStart(2, '0');
                        const dateStr = `${year}-${month}-${day}`;
                        const weekStr = getLocalDateString(getMonday(date));

                        const placeholder = createTaskCardPlaceholder(dept, dateStr, weekStr, rowClass);
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
 * Render all weeks in the schedule
 */
export function renderAllWeeks() {
    showRenderingStatus(true, 'Rendering schedule...');

    const container = document.getElementById('schedule-container');
    const wrapper = document.getElementById('schedule-wrapper');

    if (!container || !wrapper) {
        console.error('Schedule container or wrapper not found');
        showRenderingStatus(false);
        return;
    }

    const filteredTasks = getFilteredTasks();
    container.innerHTML = '';

    if (filteredTasks.length === 0) {
        container.innerHTML = '<div class="loading">No tasks found for the selected department.</div>';
        showRenderingStatus(false);
        return;
    }

    // Group tasks by week
    const tasksByWeek = {};
    let currentMonday = getMonday(new Date());

    filteredTasks.forEach(task => {
        let taskDate = parseDate(task.date);
        if (!taskDate) {
            task.missingDate = true;
            taskDate = currentMonday;
        }
        const monday = getMonday(taskDate);
        const mondayString = getLocalDateString(monday);
        if (!tasksByWeek[mondayString]) {
            tasksByWeek[mondayString] = [];
        }
        tasksByWeek[mondayString].push(task);
    });

    // Generate all weeks between earliest and latest
    const mondayStrings = Object.keys(tasksByWeek);
    let allMondays = [];

    if (mondayStrings.length === 0) {
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

    // Update state
    setAllWeekStartDates(allMondays);

    // Calculate max tasks per department for normalization
    const maxTasksPerDept = {};
    DEPARTMENT_ORDER.forEach(dept => {
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

    // Render all weeks
    const fragment = document.createDocumentFragment();
    allMondays.forEach(mondayDate => {
        fragment.appendChild(renderWeekGrid(mondayDate, maxTasksPerDept));
    });
    container.appendChild(fragment);

    // Determine initial week index
    let currentViewedWeekIndex = getCurrentViewedWeekIndex();
    if (currentViewedWeekIndex === -1 || currentViewedWeekIndex >= allMondays.length) {
        const savedWeekIndex = loadWeekIndex();
        if (savedWeekIndex !== null && savedWeekIndex < allMondays.length) {
            currentViewedWeekIndex = savedWeekIndex;
        }

        if (currentViewedWeekIndex === -1 || currentViewedWeekIndex >= allMondays.length) {
            currentMonday = getMonday(new Date());
            currentViewedWeekIndex = allMondays.findIndex(d => d.getTime() === currentMonday.getTime());
            if (currentViewedWeekIndex === -1) {
                currentViewedWeekIndex = allMondays.findIndex(d => d > currentMonday);
                if (currentViewedWeekIndex === -1) currentViewedWeekIndex = allMondays.length - 1;
            }
        }
    }
    setCurrentViewedWeekIndex(currentViewedWeekIndex);

    // Scroll and layout
    requestAnimationFrame(() => {
        const wrapperWidth = wrapper.clientWidth;
        const grids = container.querySelectorAll('.schedule-grid');

        grids.forEach(grid => {
            grid.style.width = `${wrapperWidth}px`;
        });

        // Scroll to target grid
        if (grids[currentViewedWeekIndex]) {
            const savedScrollPosition = loadScrollPosition();
            if (savedScrollPosition !== null && savedScrollPosition >= 0 && savedScrollPosition <= wrapper.scrollWidth) {
                wrapper.scrollLeft = savedScrollPosition;
                const newWeekIndex = Math.round(savedScrollPosition / wrapper.offsetWidth);
                setCurrentViewedWeekIndex(newWeekIndex);
            } else {
                const targetScrollLeft = grids[currentViewedWeekIndex].offsetLeft;
                wrapper.scrollLeft = targetScrollLeft;
            }
        }

        // Update header
        const finalWeekIndex = Math.min(getCurrentViewedWeekIndex(), allMondays.length - 1);
        emit(EVENTS.WEEK_CHANGED, { weekIndex: finalWeekIndex, weekDate: allMondays[finalWeekIndex] });

        equalizeAllCardHeights();
        wrapper.style.willChange = 'auto';
    });

    // Enable add card indicators
    setTimeout(() => {
        enableAddCardIndicators();
        showRenderingStatus(false);
    }, 100);

    // Emit render complete event
    emit(EVENTS.SCHEDULE_RENDERED);
}

/**
 * Navigate to a specific week by index
 * @param {number} weekIndex - Week index to navigate to
 */
export function navigateToWeek(weekIndex) {
    const wrapper = document.getElementById('schedule-wrapper');
    const allWeekStartDates = getAllWeekStartDates();

    if (!wrapper || weekIndex < 0 || weekIndex >= allWeekStartDates.length) return;

    setCurrentViewedWeekIndex(weekIndex);
    saveWeekIndex(weekIndex);

    const container = document.getElementById('schedule-container');
    const grids = container.querySelectorAll('.schedule-grid');

    if (grids[weekIndex]) {
        const targetScrollLeft = grids[weekIndex].offsetLeft;
        wrapper.scrollLeft = targetScrollLeft;
        saveScrollPosition(targetScrollLeft);

        emit(EVENTS.WEEK_CHANGED, { weekIndex, weekDate: allWeekStartDates[weekIndex] });
    }
}
