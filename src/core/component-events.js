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

import * as eventBus from './event-bus.js';
import { renderAllWeeks } from '../components/schedule-grid.js';
import { isEditingActive, queueRefresh } from './refresh-queue.js';
import { logger } from '../utils/logger.js';

/**
 * Set up component event listeners
 * Subscribes components to relevant event bus events
 */
export function setupComponentEvents() {
    // Tasks filtered → render schedule (with editing check)
    // The TASKS_FILTERED event is now only for manual filter changes.
    // The main render after a data load is handled by TASKS_READY_FOR_RENDER.
    // This listener is kept in case other parts of the app rely on TASKS_FILTERED
    // for non-rendering UI updates. For now, we will just log it.
    eventBus.on(eventBus.EVENTS.TASKS_FILTERED, () => {
        logger.info('📊 Tasks filtered event received. No re-render triggered by this event.');
        // Previously, this would call renderAllWeeks(), creating a race condition.
        // That responsibility is now handled by the TASKS_READY_FOR_RENDER event.
    });

    // Tasks ready for render → render schedule (with editing check)
    eventBus.on(eventBus.EVENTS.TASKS_READY_FOR_RENDER, () => {
        logger.info('✅ Tasks ready for render, rendering schedule...');
        if (isEditingActive()) {
            logger.info('📝 Editing active, queueing refresh');
            queueRefresh(() => renderAllWeeks(), { event: 'TASKS_READY_FOR_RENDER' });
        } else {
            renderAllWeeks();
        }
    });
}
