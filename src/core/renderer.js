/**
 * Unified Rendering Engine
 *
 * This module consolidates all rendering logic for the application,
 * providing a single, efficient pipeline for updating the DOM.
 * It is designed to be idempotent and performant, minimizing
 * unnecessary re-renders and DOM manipulations.
 */

import { logger } from '../utils/logger.js';
import * as state from './state.js';
import { loadWeekIndex } from './storage.js';
import { renderWeekGrid } from '../components/week-renderer.js';
import { getMonday, parseDate, getLocalDateString, createWeekDates, clearParseDateCache } from '../utils/date-utils.js';
import { equalizeAllCardHeights, setGridWidths, scrollToWeek } from '../utils/grid-layout-manager.js';
import { showRenderingStatus } from '../utils/ui-utils.js';
import { RENDER_DELAY } from '../config/timing-constants.js';
import { emit, EVENTS } from './event-bus.js';
import {
    canUseSmartUpdate,
    smartUpdateSchedule,
    preserveScrollPosition
} from '../utils/smart-renderer.js';
import { clearSyntheticTasks, injectSyntheticTasks, getAllTasks, getAllWeekStartDates, getIsEditingUnlocked } from './state.js';
import { SYNTHETIC_DEPARTMENT_NAMES } from '../config/department-config.js';
import { generateAllSyntheticTasks } from '../utils/schedule-utils.js';

let isRendering = false;

/**
 * Main render function for the entire application.
 * This is the single entry point for all rendering operations.
 */
export async function render() {
    if (isRendering) {
        logger.warn('Render already in progress. Skipping.');
        return;
    }

    isRendering = true;
    logger.info('Starting unified render...');
    showRenderingStatus(true, 'Rendering schedule...');

    try {
        clearParseDateCache();

        const container = document.getElementById('schedule-container');
        const wrapper = document.getElementById('schedule-wrapper');

        if (!container || !wrapper) {
            logger.error('Schedule container or wrapper not found');
            return;
        }

        let filteredTasks = state.getFilteredTasks();
        const previousFilteredTasks = state.getPreviousFilteredTasks();

        // Attempt smart update first to preserve scroll position
        // Only generate synthetic tasks when smart update is a possibility
        // (on full-render path they'd be immediately cleared — wasted work)
        if (previousFilteredTasks.length > 0) {
            // Generate synthetic tasks BEFORE smart update comparison
            // Problem: previousFilteredTasks has synthetic tasks (from last render)
            //          but filteredTasks doesn't (not generated yet)
            // Solution: Generate and inject synthetic tasks into current state
            //           so both old and new have them for accurate comparison
            const allWeekStartDates = getAllWeekStartDates();
            if (allWeekStartDates.length > 0) {
                const allSyntheticTasks = [];

                allWeekStartDates.forEach(monday => {
                    const weekDates = createWeekDates(monday);
                    const syntheticTasksByDept = generateAllSyntheticTasks(weekDates, monday, getAllTasks);
                    allSyntheticTasks.push(...Object.values(syntheticTasksByDept).flat());
                });

                if (allSyntheticTasks.length > 0) {
                    injectSyntheticTasks(allSyntheticTasks);
                    filteredTasks = state.getFilteredTasks();
                    logger.debug('Renderer: Injected synthetic tasks before smart update', {
                        count: allSyntheticTasks.length,
                        weeks: allWeekStartDates.length
                    });
                }
            }

            if (canUseSmartUpdate(container, previousFilteredTasks, filteredTasks)) {

                logger.info('🔄 Attempting smart update to preserve scroll position...');

                const restoreScroll = preserveScrollPosition(wrapper);
                const stats = smartUpdateSchedule(container, previousFilteredTasks, filteredTasks);

                if (stats !== null) {
                    logger.info('✅ Smart update successful:', stats);

                    // Recalculate heights BEFORE restoring scroll to prevent jumping
                    requestAnimationFrame(() => {
                        equalizeAllCardHeights();
                        restoreScroll(); // Restores BOTH scrollTop and scrollLeft AFTER heights are stable
                        requestAnimationFrame(() => {
                            emit(EVENTS.SCHEDULE_RENDERED);
                        });
                    });

                    setTimeout(() => {
                        showRenderingStatus(false);
                    }, RENDER_DELAY.SCHEDULE);

                    isRendering = false;
                    return; // Early exit - skip full render (synthetic tasks preserved)
                }

                logger.warn('⚠️ Smart update not possible, falling back to full render');
            }
        }

        // Clear any existing synthetic tasks before doing a FULL render
        // (This happens after smart update check, so we only clear if doing full render)
        clearSyntheticTasks();

        // FALLBACK: Capture vertical scroll before full render
        const savedScrollTop = wrapper.scrollTop;

        // Clear the container
        container.innerHTML = '';

        if (filteredTasks.length === 0) {
            const currentMonday = getMonday(new Date());
            state.setAllWeekStartDates([currentMonday]);
            state.setCurrentViewedWeekIndex(0);
            container.innerHTML = '<div class="no-tasks-message">No tasks found for the selected criteria.</div>';
            emit(EVENTS.WEEK_CHANGED, { weekIndex: 0, weekDate: currentMonday });
            showRenderingStatus(false);
            isRendering = false;
            return;
        }

        const tasksByWeek = {};
        let currentMonday = getMonday(new Date());

        filteredTasks.forEach(task => {
            if (!task.project) return;
            let taskDate = parseDate(task.date);
            let taskToStore = task;
            if (!taskDate) {
                taskToStore = { ...task, missingDate: true };
                taskDate = currentMonday;
            }
            const monday = getMonday(taskDate);
            const mondayString = getLocalDateString(monday);
            if (!tasksByWeek[mondayString]) {
                tasksByWeek[mondayString] = [];
            }
            tasksByWeek[mondayString].push(taskToStore);
        });

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

        state.setAllWeekStartDates(allMondays);

        // Single-pass: count tasks per dept|date key
        const taskCountByDeptDate = new Map();
        filteredTasks.forEach(task => {
            if (!task.project || !task.department) return;
            const taskDate = parseDate(task.date) || getMonday(new Date());
            const key = `${task.department}|${taskDate.toDateString()}`;
            taskCountByDeptDate.set(key, (taskCountByDeptDate.get(key) || 0) + 1);
        });
        const maxTasksPerDept = {};
        for (const [key, count] of taskCountByDeptDate) {
            const dept = key.split('|')[0];
            maxTasksPerDept[dept] = Math.max(maxTasksPerDept[dept] || 0, count);
        }
        for (const dept of SYNTHETIC_DEPARTMENT_NAMES) {
            maxTasksPerDept[dept] = 1;
        }

        const isEditingUnlocked = getIsEditingUnlocked();
        const fragment = document.createDocumentFragment();
        allMondays.forEach(mondayDate => {
            fragment.appendChild(renderWeekGrid(mondayDate, maxTasksPerDept, isEditingUnlocked));
        });
        container.appendChild(fragment);

        let currentViewedWeekIndex = state.getCurrentViewedWeekIndex();
        if (currentViewedWeekIndex === -1 || currentViewedWeekIndex >= allMondays.length) {
            const savedWeekIndex = loadWeekIndex();
            if (savedWeekIndex !== null && savedWeekIndex >= 0 && savedWeekIndex < allMondays.length) {
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
        state.setCurrentViewedWeekIndex(currentViewedWeekIndex);

        requestAnimationFrame(() => {
            setGridWidths(container, wrapper);
            equalizeAllCardHeights();

            requestAnimationFrame(() => {
                // Scroll to the week index already resolved above (includes saved index fallback)
                const weekIndex = currentViewedWeekIndex;

                scrollToWeek(wrapper, container, weekIndex);

                // RESTORE VERTICAL SCROLL (if we had to do full render)
                if (typeof savedScrollTop === 'number') {
                    wrapper.scrollTop = savedScrollTop;
                }

                const finalWeekIndex = Math.min(weekIndex, allMondays.length - 1);
                emit(EVENTS.WEEK_CHANGED, { weekIndex: finalWeekIndex, weekDate: allMondays[finalWeekIndex] });

                wrapper.style.willChange = 'auto';
            });
        });

        setTimeout(() => {
            showRenderingStatus(false);
        }, RENDER_DELAY.SCHEDULE);

        emit(EVENTS.SCHEDULE_RENDERED);

    } catch (error) {
        logger.error('An error occurred during render:', error);
    } finally {
        isRendering = false;
    }
}