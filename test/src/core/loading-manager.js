/**
 * Loading Manager
 * Manages loading states and progress feedback
 * @module core/loading-manager
 */

// Track active operations
import { logger } from '../utils/logger.js';
import { UI_DELAY } from '../config/timing-constants.js';

const activeOperations = new Map();

// Progress state
let currentProgress = 0;
let progressMessage = '';

// Pending fade-out timer for the loading overlay
let fadeTimeout = null;

/**
 * Initialize loading manager
 */
export function initializeLoadingManager() {
    logger.debug('⏳ Initializing loading manager...');
    logger.debug('✅ Loading manager initialized');
}

/**
 * Show loading indicator
 * @param {string} message - Loading message
 * @param {string} operation - Operation identifier (default: 'default')
 */
export function showLoading(message = 'Loading...', operation = 'default') {
    // Track this operation
    activeOperations.set(operation, {
        message,
        startTime: Date.now()
    });

    const overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        logger.warn('Loading overlay element not found');
        return;
    }

    const messageEl = overlay.querySelector('.loading-message');
    if (messageEl) {
        messageEl.textContent = message;
    }

    // Cancel any pending fade-out and show overlay
    if (fadeTimeout) {
        clearTimeout(fadeTimeout);
        fadeTimeout = null;
    }
    overlay.classList.remove('fading');
    overlay.classList.remove('hidden');

    logger.debug(`⏳ Loading started: ${operation} - ${message}`);
}

/**
 * Hide loading indicator
 * @param {string} operation - Operation identifier (default: 'default')
 */
export function hideLoading(operation = 'default') {
    // Remove this operation
    const op = activeOperations.get(operation);
    if (op) {
        const duration = Date.now() - op.startTime;
        logger.debug(`✅ Loading completed: ${operation} (${duration}ms)`);
        activeOperations.delete(operation);
    }

    // Only hide overlay if no operations are active
    if (activeOperations.size === 0) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            // Fade out, then hide after the transition completes
            overlay.classList.add('fading');
            if (fadeTimeout) {
                clearTimeout(fadeTimeout);
            }
            fadeTimeout = setTimeout(() => {
                fadeTimeout = null;
                overlay.classList.add('hidden');
                overlay.classList.remove('fading');

                // Reset progress
                resetProgress();
            }, 250);
        } else {
            // Reset progress
            resetProgress();
        }
    } else {
        // Show the next active operation's message
        const nextOp = activeOperations.values().next().value;
        if (nextOp) {
            const overlay = document.getElementById('loading-overlay');
            const messageEl = overlay && overlay.querySelector('.loading-message');
            if (messageEl) {
                messageEl.textContent = nextOp.message;
            }
        }
    }
}

/**
 * Update loading progress
 * @param {number} percent - Progress percentage (0-100)
 * @param {string} message - Progress message (optional)
 */
export function updateProgress(percent, message = '') {
    currentProgress = Math.max(0, Math.min(100, percent));

    if (message) {
        progressMessage = message;
    }

    const overlay = document.getElementById('loading-overlay');
    if (!overlay) return;

    // Update message if provided (progress bar is indeterminate — CSS-driven)
    if (message) {
        const messageEl = overlay.querySelector('.loading-message');
        if (messageEl) {
            messageEl.textContent = message;
        }
    }

    logger.debug(`📊 Progress: ${currentProgress}% - ${progressMessage}`);
}

/**
 * Reset progress to zero
 */
function resetProgress() {
    currentProgress = 0;
    progressMessage = '';
}

/**
 * Show operation status (non-blocking notification)
 * @param {string} status - Status message
 * @param {string} type - Status type (info, success, warning, error)
 * @param {number} duration - Auto-hide duration in ms (default: 3000)
 */
export function showStatus(status, type = 'info', duration = UI_DELAY.STATUS_BANNER) {
    const statusEl = document.getElementById('status-banner');
    if (!statusEl) {
        logger.debug(`Status: [${type}] ${status}`);
        return;
    }

    const messageEl = statusEl.querySelector('.status-message');
    if (messageEl) {
        messageEl.textContent = status;
    }

    // Set status class
    statusEl.className = `status-banner ${type}`;
    statusEl.classList.remove('hidden');

    // Auto-hide after duration (except for errors)
    if (type !== 'error' && duration > 0) {
        setTimeout(() => {
            statusEl.classList.add('hidden');
        }, duration);
    }

    logger.debug(`📢 Status: [${type}] ${status}`);
}

/**
 * Hide status banner
 */
export function hideStatus() {
    const statusEl = document.getElementById('status-banner');
    if (statusEl) {
        statusEl.classList.add('hidden');
    }
}

/**
 * Show loading with progress for multi-step operations
 * @param {Array<Object>} steps - Array of step objects {message, action}
 * @param {string} operation - Operation identifier
 */
export async function showLoadingWithSteps(steps, operation = 'default') {
    if (!Array.isArray(steps) || steps.length === 0) {
        logger.warn('No steps provided for loading operation');
        return;
    }

    showLoading(steps[0].message, operation);
    updateProgress(0, steps[0].message);

    const stepProgress = 100 / steps.length;

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];

        // Update progress
        updateProgress(i * stepProgress, step.message);

        // Execute step action if provided
        if (typeof step.action === 'function') {
            try {
                await step.action();
            } catch (error) {
                logger.error(`Step ${i + 1} failed:`, error);
                throw error;
            }
        }
    }

    // Complete
    updateProgress(100, 'Complete');

    // Hide after brief delay
    setTimeout(() => {
        hideLoading(operation);
    }, UI_DELAY.STATUS_HIDE);
}

/**
 * Get active operations count
 * @returns {number}
 */
export function getActiveOperationsCount() {
    return activeOperations.size;
}

/**
 * Get all active operations
 * @returns {Array<Object>}
 */
export function getActiveOperations() {
    return Array.from(activeOperations.entries()).map(([id, data]) => ({
        id,
        ...data,
        duration: Date.now() - data.startTime
    }));
}

/**
 * Clear all loading states (emergency cleanup)
 */
export function clearAllLoading() {
    logger.debug('🧹 Clearing all loading states...');
    activeOperations.clear();

    if (fadeTimeout) {
        clearTimeout(fadeTimeout);
        fadeTimeout = null;
    }

    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.classList.remove('fading');
    }

    resetProgress();
}
