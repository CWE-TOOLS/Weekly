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
import { loadScrollPosition, loadWeekIndex } from './storage.js';
import { renderWeekGrid } from '../components/week-renderer.js';
import { getMonday, parseDate, getLocalDateString } from '../utils/date-utils.js';
import { equalizeAllCardHeights, setGridWidths, scrollToWeek, preserveScrollPosition, restoreScrollPosition } from '../utils/grid-layout-manager.js';
import { showRenderingStatus } from '../utils/ui-utils.js';
import { RENDER_DELAY } from '../config/timing-constants.js';
import { emit, EVENTS } from './event-bus.js';

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
        const container = document.getElementById('schedule-container');
        const wrapper = document.getElementById('schedule-wrapper');

        if (!container || !wrapper) {
            logger.error('Schedule container or wrapper not found');
            return;
        }

        const filteredTasks = state.getFilteredTasks();

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

        const maxTasksPerDept = {};
        state.DEPARTMENT_ORDER.forEach(dept => {
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

        const fragment = document.createDocumentFragment();
        allMondays.forEach(mondayDate => {
            fragment.appendChild(renderWeekGrid(mondayDate, maxTasksPerDept));
        });
        container.appendChild(fragment);

        const previousScrollPosition = wrapper.scrollLeft;
        const wasScrolled = previousScrollPosition > 0;

        let currentViewedWeekIndex = state.getCurrentViewedWeekIndex();
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
        state.setCurrentViewedWeekIndex(currentViewedWeekIndex);

        requestAnimationFrame(() => {
            const wrapperWidth = wrapper.clientWidth;
            setGridWidths(container, wrapper);
            equalizeAllCardHeights();

            requestAnimationFrame(() => {
                let finalScrollPosition = null;

                if (wasScrolled) {
                    const preserved = preserveScrollPosition(wrapper, previousScrollPosition, wrapperWidth);
                    if (preserved) {
                        wrapper.scrollLeft = preserved.scrollLeft;
                        state.setCurrentViewedWeekIndex(preserved.weekIndex);
                        finalScrollPosition = preserved.scrollLeft;
                    }
                }

                if (finalScrollPosition === null) {
                    const savedScrollPosition = loadScrollPosition();
                    const restored = restoreScrollPosition(wrapper, savedScrollPosition, wrapperWidth);
                    if (restored) {
                        wrapper.scrollLeft = restored.scrollLeft;
                        state.setCurrentViewedWeekIndex(restored.weekIndex);
                        finalScrollPosition = restored.scrollLeft;
                    }
                }

                if (finalScrollPosition === null) {
                    finalScrollPosition = scrollToWeek(wrapper, container, currentViewedWeekIndex);
                }

                const finalWeekIndex = Math.min(state.getCurrentViewedWeekIndex(), allMondays.length - 1);
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