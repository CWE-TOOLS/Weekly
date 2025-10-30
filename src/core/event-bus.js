/**
 * Event Bus - Pub/Sub Pattern for Component Communication
 *
 * This module provides a centralized event system that allows components
 * to communicate without tight coupling.
 *
 * @module core/event-bus
 *
 * @claude-context
 * @purpose Decoupled component communication via publish-subscribe pattern
 * @dependencies None (pure event system)
 * @used-by All components and services for event-driven communication
 * @exports on, off, emit, once functions for event handling
 * @modifies Internal event listener registry
 * @events-emitted N/A (this IS the event system)
 * @events-listened N/A (this IS the event system)
 * @key-functions
 *   - on(event, handler) - Subscribe to events
 *   - off(event, handler) - Unsubscribe from events
 *   - emit(event, data) - Publish events to subscribers
 *   - once(event, handler) - Subscribe for one-time notification
 * @event-categories
 *   - data-* (data-loaded, task-added, task-updated, task-deleted)
 *   - ui-* (week-changed, department-filter-changed, search-changed)
 *   - state-changed:* (state property changes)
 *   - system-* (error, loading-start, loading-end)
 */

// Store for event listeners
const listeners = new Map();

// Debug mode flag
let debugMode = false;

/**
 * Subscribe to an event
 * @param {string} event - Event name (e.g., 'tasks:loaded', 'week:changed')
 * @param {Function} handler - Callback function to execute when event fires
 * @returns {Function} Unsubscribe function
 *
 * @example
 * const unsubscribe = on('tasks:loaded', (data) => {
 *   console.log('Tasks loaded:', data);
 * });
 */
export function on(event, handler) {
    if (typeof handler !== 'function') {
        console.error(`[EventBus] Handler for "${event}" must be a function`);
        return () => {};
    }

    if (!listeners.has(event)) {
        listeners.set(event, new Set());
    }

    listeners.get(event).add(handler);

    // Return unsubscribe function
    return () => off(event, handler);
}

/**
 * Unsubscribe from an event
 * @param {string} event - Event name
 * @param {Function} handler - Handler function to remove
 *
 * @example
 * off('tasks:loaded', myHandler);
 */
export function off(event, handler) {
    if (!listeners.has(event)) {
        return;
    }

    listeners.get(event).delete(handler);

    // Clean up empty listener sets
    if (listeners.get(event).size === 0) {
        listeners.delete(event);
    }
}

/**
 * Emit an event with optional data
 * @param {string} event - Event name
 * @param {*} data - Data to pass to event handlers
 *
 * @example
 * emit('tasks:loaded', { tasks: [...], count: 42 });
 */
export function emit(event, data) {
    // Debug logging if enabled
    if (debugMode) {
        console.log(`[EventBus] Emit "${event}":`, data);
    }

    if (!listeners.has(event)) {
        return;
    }

    const eventListeners = listeners.get(event);

    // Execute all handlers with error handling
    eventListeners.forEach(handler => {
        try {
            handler(data);
        } catch (error) {
            console.error(`[EventBus] Error in handler for "${event}":`, error);
        }
    });
}

/**
 * Subscribe to an event for one-time execution only
 * Handler will be automatically removed after first execution
 * @param {string} event - Event name
 * @param {Function} handler - Callback function
 * @returns {Function} Unsubscribe function
 *
 * @example
 * once('tasks:loaded', (data) => {
 *   console.log('First load only:', data);
 * });
 */
export function once(event, handler) {
    const wrappedHandler = (data) => {
        handler(data);
        off(event, wrappedHandler);
    };

    return on(event, wrappedHandler);
}

/**
 * Clear all listeners for a specific event
 * If no event is specified, clears all listeners
 * @param {string} [event] - Optional event name to clear
 *
 * @example
 * clear('tasks:loaded'); // Clear specific event
 * clear(); // Clear all events
 */
export function clear(event) {
    if (event) {
        listeners.delete(event);
    } else {
        listeners.clear();
    }
}

/**
 * Get count of listeners for an event
 * Useful for debugging and testing
 * @param {string} event - Event name
 * @returns {number} Number of listeners
 *
 * @example
 * const count = getListenerCount('tasks:loaded');
 */
export function getListenerCount(event) {
    return listeners.has(event) ? listeners.get(event).size : 0;
}

/**
 * Get all registered event names
 * Useful for debugging
 * @returns {string[]} Array of event names
 *
 * @example
 * const events = getAllEvents();
 * console.log('Registered events:', events);
 */
export function getAllEvents() {
    return Array.from(listeners.keys());
}

/**
 * Debug mode - logs all emitted events
 * @param {boolean} enable - Enable or disable debug mode
 */
export function setDebugMode(enable) {
    debugMode = enable;
    if (enable) {
        console.log('[EventBus] Debug mode enabled');
    }
}

/**
 * Standard event names used throughout the application
 * Using these constants ensures consistency and prevents typos
 */
export const EVENTS = {
    // Data events
    TASKS_LOADED: 'tasks:loaded',
    TASKS_UPDATED: 'tasks:updated',
    TASKS_FILTERED: 'tasks:filtered',
    TASK_CREATED: 'task:created',
    TASK_DELETED: 'task:deleted',

    // UI events
    WEEK_CHANGED: 'week:changed',
    DEPARTMENT_FILTERED: 'department:filtered',
    EDITING_TOGGLED: 'editing:toggled',
    EDITING_UNLOCKED: 'editing:unlocked',
    EDITING_LOCKED: 'editing:locked',
    PROJECT_OPENED: 'project:opened',
    PROJECT_CLOSED: 'project:closed',
    PROJECT_SELECTED: 'project:selected',

    // Modal events
    MODAL_OPENED: 'modal:opened',
    MODAL_CLOSED: 'modal:closed',

    // State events
    STATE_RESTORED: 'state:restored',
    STATE_PERSISTED: 'state:persisted',

    // Render events
    RENDER_START: 'render:start',
    RENDER_COMPLETE: 'render:complete',
    RENDER_ERROR: 'render:error',
    SCHEDULE_RENDERED: 'schedule:rendered',

    // Global events (Phase 8)
    WINDOW_RESIZED: 'window:resized',
    FULLSCREEN_CHANGED: 'fullscreen:changed',
    PAGE_VISIBLE: 'page:visible',
    PAGE_HIDDEN: 'page:hidden',
    CONNECTION_CHANGED: 'connection:changed',
    MODAL_CLOSE_REQUESTED: 'modal:close-requested'
};
