/**
 * Component Events Module
 * Sets up event bus subscriptions for UI components
 * @module core/component-events
 *
 * @claude-context
 * @purpose Manages event bus subscriptions between components
 * @dependencies event-bus, schedule-grid
 * @used-by app-controller
 * @exports setupComponentEvents
 * @modifies Sets up event listeners on event bus
 */

import { on, EVENTS } from './event-bus.js';
import { render } from './renderer.js';
import { isEditingActive, queueRefresh } from './refresh-queue.js';
import { logger } from '../utils/logger.js';
import { getAllTasks } from './state.js';
import { buildTaskDetailsHTML } from '../components/task-card.js';

/**
 * Render or queue a refresh depending on editing state
 * @param {string} eventName - Name of the triggering event (for logging/context)
 */
function renderOrQueue(eventName) {
    if (isEditingActive()) {
        logger.info(`Editing active during ${eventName}, queueing refresh`);
        queueRefresh(() => render(), { event: eventName });
    } else {
        render();
    }
}

/**
 * Patch the .task-details DOM nodes for actual-hours changes without going
 * through the full render pipeline. The renderer's smart-update path treats
 * actual hours as a side-channel value (not a tracked task field), so a
 * normal re-render is a no-op for badges. Direct DOM patch is reliable.
 */
function patchActualHoursDom(taskId) {
    if (taskId) {
        const task = getAllTasks().find(t => t.id === taskId);
        if (!task) return;
        const div = document.querySelector(`.task-details[data-task-id="${CSS.escape(taskId)}"]`);
        if (div) div.innerHTML = buildTaskDetailsHTML(task);
        return;
    }
    // Bulk path (e.g. startup priming) — re-derive every visible details node.
    const tasksById = new Map(getAllTasks().map(t => [t.id, t]));
    document.querySelectorAll('.task-details[data-task-id]').forEach(div => {
        const task = tasksById.get(div.dataset.taskId);
        if (task) div.innerHTML = buildTaskDetailsHTML(task);
    });
}

/**
 * Set up component event listeners
 * Subscribes components to relevant event bus events
 */
export function setupComponentEvents() {
    on(EVENTS.TASKS_FILTERED, () => renderOrQueue('TASKS_FILTERED'));
    on(EVENTS.TASKS_LOADED, () => renderOrQueue('TASKS_LOADED'));
    on('actual-hours-updated', (data) => patchActualHoursDom(data?.taskId));
}
