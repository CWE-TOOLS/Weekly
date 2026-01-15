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

import { on } from './event-bus.js';
import { EVENTS } from './event-bus.js';
import { render } from './renderer.js';
import { isEditingActive, queueRefresh } from './refresh-queue.js';
import { logger } from '../utils/logger.js';

/**
 * Set up component event listeners
 * Subscribes components to relevant event bus events
 */
export function setupComponentEvents() {
    // Tasks filtered → render schedule (with editing check)
    on(EVENTS.TASKS_FILTERED, () => {
        if (isEditingActive()) {
            logger.info('📊 Tasks filtered but editing active, queueing refresh');
            queueRefresh(() => render(), { event: 'TASKS_FILTERED' });
        } else {
            render();
        }
    });

    // Tasks loaded → render schedule (with editing check)
    on(EVENTS.TASKS_LOADED, () => {
        logger.info('📊 Tasks loaded, rendering schedule...');
        if (isEditingActive()) {
            logger.info('📊 Editing active, queueing refresh');
            queueRefresh(() => render(), { event: 'TASKS_LOADED' });
        } else {
            render();
        }
    });

    // Actual hours updated → re-render to show updated values
    on('actual-hours-updated', (data) => {
        logger.info('⏱️ Actual hours updated for task:', data.taskId);
        if (isEditingActive()) {
            queueRefresh(() => render(), { event: 'actual-hours-updated' });
        } else {
            render();
        }
    });
}
