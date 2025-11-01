/**
 * Schedule Grid Component - Main Coordinator
 * Orchestrates rendering, navigation, and layout management for the weekly schedule grid
 * @module components/schedule-grid
 *
 * @claude-context
 * @purpose Main coordinator for schedule grid - handles rendering orchestration, week navigation, and layout
 * @dependencies state.js, event-bus.js, storage.js, date-utils.js, week-renderer.js, grid-layout-manager.js
 * @used-by app-controller.js (initialization), print system
 * @exports renderAllWeeks, navigateToWeek, equalizeAllCardHeights
 * @modifies DOM (#schedule-container), state (currentViewedWeekIndex)
 * @events-emitted weeks-rendered, week-navigated
 * @events-listened tasks:loaded, week:changed, department-filter:changed, search:changed
 * @key-functions
 *   - renderAllWeeks() - Main rendering orchestrator
 *   - navigateToWeek(index) - Navigate to specific week
 *   - equalizeAllCardHeights() - Balance row heights for consistent layout (delegates to layout manager)
 * @architecture-notes
 *   Refactored in Phase 3 to separate concerns:
 *   - week-renderer.js: Rendering logic (week grids, headers, task cards)
 *   - grid-layout-manager.js: Layout and height management utilities
 *   - schedule-grid.js: Coordination and orchestration
 */

import {
    getFilteredTasks,
    getAllTasks,
    setAllWeekStartDates,
    getAllWeekStartDates,
    getCurrentViewedWeekIndex,
    setCurrentViewedWeekIndex
} from '../core/state.js';
import { emit, EVENTS } from '../core/event-bus.js';
import { loadScrollPosition, saveScrollPosition, loadWeekIndex, saveWeekIndex } from '../core/storage.js';
import { parseDate, getMonday, getLocalDateString } from '../utils/date-utils.js';
import { showRenderingStatus } from '../utils/ui-utils.js';
import { DEPARTMENT_ORDER } from '../config/department-config.js';
import { renderWeekGrid } from './week-renderer.js';
import { logger } from '../utils/logger.js';
import {
    equalizeAllCardHeights as equalizeHeights,
    setGridWidths,
    scrollToWeek,
    preserveScrollPosition,
    restoreScrollPosition
} from '../utils/grid-layout-manager.js';
import { RENDER_DELAY } from '../config/timing-constants.js';
import {
    canUseSmartUpdate,
    smartUpdateSchedule,
    preserveScrollPosition as smartPreserveScroll
} from '../utils/smart-renderer.js';

// Track previous tasks for smart updates
let _previousTasks = [];

/**
 * Equalize card heights across all weeks for consistent layout
 * Delegates to grid-layout-manager.js
 */
export function equalizeAllCardHeights() {
    equalizeHeights();
}

/**
 * Enable add card indicators (placeholder cells)
 */
function enableAddCardIndicators() {
    // This function is called after rendering completes
    // Placeholder cells are already created with add-enabled class if editing is unlocked
}

/**
 * Render all weeks in the schedule
 */
export function renderAllWeeks() {
    const container = document.getElementById('schedule-container');
    const wrapper = document.getElementById('schedule-wrapper');

    if (!container || !wrapper) {
        logger.error('Schedule container or wrapper not found');
        return;
    }

    const filteredTasks = getFilteredTasks();

    console.log('=== RENDER: Starting renderAllWeeks ===', {
        previousTaskCount: _previousTasks ? _previousTasks.length : 0,
        currentTaskCount: filteredTasks.length
    });

    // Try smart update first (if conditions are met)
    if (canUseSmartUpdate(container, _previousTasks, filteredTasks)) {
        console.log('=== RENDER: Using smart update ===');
        logger.debug('🚀 Using smart update (no flicker)');

        // Preserve scroll position
        const restoreScroll = smartPreserveScroll(wrapper);

        // Perform smart update
        const updateStats = smartUpdateSchedule(container, _previousTasks, filteredTasks);

        console.log('=== RENDER: Smart update result ===', { result: updateStats === null ? 'null (needs full render)' : 'success' });

        if (updateStats !== null) {
            // Smart update succeeded
            logger.debug('✅ Smart update complete', updateStats);

            // Restore scroll position
            restoreScroll();

            // Update previous tasks
            _previousTasks = filteredTasks.map(task => ({...task}));

            // Equalize heights if there were changes
            if (updateStats.updated > 0 || updateStats.removed > 0) {
                requestAnimationFrame(() => {
                    equalizeAllCardHeights();
                });
            }

            return; // Exit early - no full re-render needed
        }

        // Smart update failed, fall through to full render
        logger.warn('⚠️ Smart update not possible, falling back to full render');
    }

    // Full render path (initial render or when smart update can't be used)
    console.log('=== RENDER: Using full render ===');
    showRenderingStatus(true, 'Rendering schedule...');

    const allTasks = getAllTasks();
    container.innerHTML = '';

    if (filteredTasks.length === 0) {
        container.innerHTML = '<div class="loading">No tasks found for the selected department.</div>';
        showRenderingStatus(false);
        _previousTasks = []; // Update tracking
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

    // Save current scroll position before re-rendering (to preserve position during refresh)
    const previousScrollPosition = wrapper.scrollLeft;
    const wasScrolled = previousScrollPosition > 0;

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

    // Scroll and layout - use two animation frames to ensure layout is complete
    requestAnimationFrame(() => {
        const wrapperWidth = wrapper.clientWidth;

        // Set grid widths
        setGridWidths(container, wrapper);

        // Equalize heights FIRST before scrolling to prevent jitter
        equalizeAllCardHeights();

        // Then scroll in next frame after heights are stable
        requestAnimationFrame(() => {
            // Determine scroll position
            let finalScrollPosition = null;

            // If page was already scrolled (refresh case), preserve the exact position
            if (wasScrolled) {
                const preserved = preserveScrollPosition(wrapper, previousScrollPosition, wrapperWidth);
                if (preserved) {
                    wrapper.scrollLeft = preserved.scrollLeft;
                    setCurrentViewedWeekIndex(preserved.weekIndex);
                    finalScrollPosition = preserved.scrollLeft;
                }
            }

            // Otherwise try to restore saved position
            if (finalScrollPosition === null) {
                const savedScrollPosition = loadScrollPosition();
                const restored = restoreScrollPosition(wrapper, savedScrollPosition, wrapperWidth);
                if (restored) {
                    wrapper.scrollLeft = restored.scrollLeft;
                    setCurrentViewedWeekIndex(restored.weekIndex);
                    finalScrollPosition = restored.scrollLeft;
                }
            }

            // Otherwise scroll to calculated week index
            if (finalScrollPosition === null) {
                finalScrollPosition = scrollToWeek(wrapper, container, currentViewedWeekIndex);
            }

            // Update header
            const finalWeekIndex = Math.min(getCurrentViewedWeekIndex(), allMondays.length - 1);
            emit(EVENTS.WEEK_CHANGED, { weekIndex: finalWeekIndex, weekDate: allMondays[finalWeekIndex] });

            wrapper.style.willChange = 'auto';
        });
    });

    // Enable add card indicators
    setTimeout(() => {
        enableAddCardIndicators();
        showRenderingStatus(false);
    }, RENDER_DELAY.SCHEDULE);

    // Emit render complete event
    emit(EVENTS.SCHEDULE_RENDERED);

    // Track tasks for future smart updates
    _previousTasks = filteredTasks.map(task => ({...task}));
}

/**
 * Navigate to a specific week by index
 * @param {number} weekIndex - Week index to navigate to
 */
export function navigateToWeek(weekIndex) {
    const wrapper = document.getElementById('schedule-wrapper');
    const container = document.getElementById('schedule-container');
    const allWeekStartDates = getAllWeekStartDates();

    if (!wrapper || !container || weekIndex < 0 || weekIndex >= allWeekStartDates.length) return;

    setCurrentViewedWeekIndex(weekIndex);
    saveWeekIndex(weekIndex);

    // Use layout manager to scroll to week
    const targetScrollLeft = scrollToWeek(wrapper, container, weekIndex);
    saveScrollPosition(targetScrollLeft);

    emit(EVENTS.WEEK_CHANGED, { weekIndex, weekDate: allWeekStartDates[weekIndex] });
}
