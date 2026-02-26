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
 * Set up component event listeners
 * Subscribes components to relevant event bus events
 */
export function setupComponentEvents() {
    on(EVENTS.TASKS_FILTERED, () => renderOrQueue('TASKS_FILTERED'));
    on(EVENTS.TASKS_LOADED, () => renderOrQueue('TASKS_LOADED'));
    on('actual-hours-updated', () => renderOrQueue('actual-hours-updated'));
}
