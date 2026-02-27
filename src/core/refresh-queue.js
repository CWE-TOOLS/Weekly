/**
 * Refresh Queue Manager
 *
 * Manages queued data refreshes during active editing to prevent
 * flickering and disrupting user interactions.
 *
 * Pattern: Queue-based deferral system
 * - Tracks global editing state (any card being edited)
 * - Queues refresh requests while editing is active
 * - Automatically flushes queue when editing completes
 */

import { logger } from '../utils/logger.js';

// Private state
let _isEditingActive = false;
let _queuedRefreshes = [];
let _editingCardId = null;

/**
 * Check if any card is currently being edited
 * @returns {boolean} True if editing is active
 */
export function isEditingActive() {
    return _isEditingActive;
}

/**
 * Get the ID of the currently editing card
 * @returns {string|null} Task ID or null
 */
export function getEditingCardId() {
    return _editingCardId;
}

/**
 * Mark editing as started
 * @param {string} taskId - ID of task being edited
 */
export function startEditing(taskId) {
    _isEditingActive = true;
    _editingCardId = taskId;
    logger.info('RefreshQueue: Editing started', { taskId });
}

/**
 * Mark editing as completed and flush queued refreshes
 * @param {string} taskId - ID of task that was being edited
 */
export function endEditing(taskId) {
    if (_editingCardId !== taskId) {
        logger.warn('RefreshQueue: End editing called for different card', {
            expected: _editingCardId,
            received: taskId
        });
    }

    _isEditingActive = false;
    _editingCardId = null;

    logger.info('RefreshQueue: Editing ended', { taskId, queuedCount: _queuedRefreshes.length });

    // Flush any queued refreshes
    flushQueue();
}

/**
 * Queue a refresh to be executed later
 * @param {Function} refreshFunction - Function to call when queue is flushed
 * @param {Object} context - Context data for logging
 */
export function queueRefresh(refreshFunction, context = {}) {
    if (!_isEditingActive) {
        logger.warn('RefreshQueue: Attempted to queue refresh while not editing, executing immediately');
        Promise.resolve().then(() => refreshFunction()).catch(error => {
            logger.error('RefreshQueue: Error executing immediate refresh', error);
        });
        return;
    }

    const queueEntry = {
        fn: refreshFunction,
        context,
        timestamp: Date.now()
    };

    _queuedRefreshes.push(queueEntry);
    logger.info('RefreshQueue: Refresh queued', {
        queueLength: _queuedRefreshes.length,
        context
    });
}

/**
 * Execute all queued refreshes
 * Uses the most recent refresh only (coalescing)
 */
export async function flushQueue() {
    if (_queuedRefreshes.length === 0) {
        return;
    }

    logger.info('RefreshQueue: Flushing queue', { count: _queuedRefreshes.length });

    // Coalesce: only execute the most recent refresh
    // (multiple refreshes are redundant, latest has all data)
    const latestRefresh = _queuedRefreshes[_queuedRefreshes.length - 1];

    // Clear queue first (prevent re-queuing during execution)
    _queuedRefreshes = [];

    try {
        await latestRefresh.fn();
        logger.info('RefreshQueue: Successfully executed queued refresh');
    } catch (error) {
        logger.error('RefreshQueue: Error executing queued refresh', error);
    }
}

/**
 * Clear all queued refreshes without executing
 * Used for cleanup or cancellation
 */
export function clearQueue() {
    const count = _queuedRefreshes.length;
    _queuedRefreshes = [];

    if (count > 0) {
        logger.info('RefreshQueue: Queue cleared', { clearedCount: count });
    }
}

/**
 * Get queue status for debugging
 * @returns {Object} Queue status information
 */
export function getQueueStatus() {
    return {
        isEditing: _isEditingActive,
        editingCardId: _editingCardId,
        queuedCount: _queuedRefreshes.length,
        oldestTimestamp: _queuedRefreshes.length > 0 ? _queuedRefreshes[0].timestamp : null,
        newestTimestamp: _queuedRefreshes.length > 0 ? _queuedRefreshes[_queuedRefreshes.length - 1].timestamp : null
    };
}

// Export for debugging
if (typeof window !== 'undefined') {
    window.refreshQueue = {
        isEditingActive,
        getEditingCardId,
        getQueueStatus,
        clearQueue
    };
}
