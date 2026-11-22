/**
 * Error Handler
 * Centralized error handling and user notifications
 * @module core/error-handler
 */

// Error levels
import { logger } from '../utils/logger.js';
import { NOTIFICATION_DURATION } from '../config/timing-constants.js';

const ERROR_LEVELS = {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical'
};

// Error notification state
let notificationTimeout = null;
let retryCallback = null;

/**
 * Initialize error handler
 * Sets up global error listeners
 */
export function initializeErrorHandler() {
    logger.info('🛡️ Initializing error handler...');

    // Global error handler
    window.addEventListener('error', (event) => {
        // Handle case where event.error might be null (happens in some browsers)
        const error = event.error || new Error(event.message || 'Unknown error');
        logger.error('Global error caught:', error);
        handleError(error, {
            context: 'Global error handler',
            filename: event.filename || '',
            lineno: event.lineno || 0,
            colno: event.colno || 0
        });
    });

    // Global unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
        logger.error('Unhandled promise rejection:', event.reason);
        handleError(event.reason, {
            context: 'Unhandled promise rejection',
            promise: event.promise
        });
        event.preventDefault(); // Prevent default console error
    });

    // Set up close button listener
    const closeBtn = document.querySelector('#error-notification .error-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', hideErrorNotification);
    }

    logger.info('✅ Error handler initialized');
}

/**
 * Handle application errors
 * @param {Error|string} error - The error object or message
 * @param {Object} context - Error context (optional)
 * @param {boolean} context.critical - Is this a critical error?
 * @param {string} context.operation - Operation that failed
 * @param {Function} context.retry - Retry callback function
 */
export function handleError(error, context = {}) {
    const errorMessage = (error && error.message) || (error && error.toString()) || 'An unknown error occurred';
    const isCritical = context.critical || false;

    // Log to console with context
    logger.error('Error handled:', {
        message: errorMessage,
        error,
        context,
        stack: error && error.stack,
        timestamp: new Date().toISOString()
    });

    // Determine user-friendly message
    let userMessage = errorMessage;

    // Check for specific error types
    if (isNetworkError(error)) {
        userMessage = 'Network error. Please check your connection and try again.';
        handleNetworkError(error);
    } else if (isAuthError(error)) {
        userMessage = 'Authentication failed. Please check your credentials.';
    } else if (isDataError(error)) {
        userMessage = 'Failed to load data. Please try refreshing the page.';
    }

    // Show error notification to user
    showErrorNotification(userMessage, {
        level: isCritical ? ERROR_LEVELS.CRITICAL : ERROR_LEVELS.ERROR,
        retry: context.retry,
        duration: isCritical ? 0 : NOTIFICATION_DURATION.NETWORK_ERROR // Critical errors don't auto-hide
    });

    // Optional: Send to error tracking service
    if (typeof window.Sentry !== 'undefined') {
        window.Sentry.captureException(error, {
            contexts: {
                operation: {
                    name: context.operation || 'unknown',
                    ...context
                }
            }
        });
    }
}

/**
 * Show error notification to user
 * @param {string} message - User-friendly error message
 * @param {Object} options - Display options
 * @param {string} options.level - Error level (info, warning, error, critical)
 * @param {Function} options.retry - Retry callback function
 * @param {number} options.duration - Auto-hide duration in ms (0 = no auto-hide)
 */
export function showErrorNotification(message, options = {}) {
    const {
        level = ERROR_LEVELS.ERROR,
        retry = null,
        duration = NOTIFICATION_DURATION.WARNING
    } = options;

    const notification = document.getElementById('error-notification');
    if (!notification) {
        logger.warn('Error notification element not found');
        return;
    }

    const messageEl = notification.querySelector('.error-message');
    const retryBtn = notification.querySelector('.error-retry');
    const icon = notification.querySelector('.error-icon');

    // Set message
    if (messageEl) {
        messageEl.textContent = message;
    }

    // Set icon based on level
    if (icon) {
        switch (level) {
            case ERROR_LEVELS.INFO:
                icon.textContent = 'ℹ️';
                break;
            case ERROR_LEVELS.WARNING:
                icon.textContent = '⚠️';
                break;
            case ERROR_LEVELS.CRITICAL:
                icon.textContent = '🚨';
                break;
            default:
                icon.textContent = '⚠️';
        }
    }

    // Set notification class based on level
    notification.className = `error-notification ${level}`;

    // Handle retry button
    if (retryBtn) {
        if (retry && typeof retry === 'function') {
            retryBtn.classList.remove('hidden');
            retryCallback = retry;

            // Remove old listeners
            const newRetryBtn = retryBtn.cloneNode(true);
            retryBtn.parentNode.replaceChild(newRetryBtn, retryBtn);

            // Add new listener
            newRetryBtn.addEventListener('click', () => {
                hideErrorNotification();
                retry();
            });
        } else {
            retryBtn.classList.add('hidden');
        }
    }

    // Show notification
    notification.classList.remove('hidden');

    // Auto-hide after duration (unless duration is 0)
    if (duration > 0) {
        clearTimeout(notificationTimeout);
        notificationTimeout = setTimeout(() => {
            hideErrorNotification();
        }, duration);
    }
}

/**
 * Hide error notification
 */
export function hideErrorNotification() {
    const notification = document.getElementById('error-notification');
    if (notification) {
        notification.classList.add('hidden');
    }

    clearTimeout(notificationTimeout);
    retryCallback = null;
}

/**
 * Handle network errors specifically
 * @param {Error} error - Network error
 */
export function handleNetworkError(error) {
    logger.error('Network error:', error);

    // Check if offline
    if (!navigator.onLine) {
        showErrorNotification('You are offline. Please check your internet connection.', {
            level: ERROR_LEVELS.WARNING,
            duration: 0 // Don't auto-hide
        });
    } else {
        showErrorNotification('Network request failed. Please try again.', {
            level: ERROR_LEVELS.ERROR,
            duration: NOTIFICATION_DURATION.NETWORK_ERROR
        });
    }
}

/**
 * Show info notification (for non-error messages)
 * @param {string} message - Info message
 * @param {number} duration - Auto-hide duration in ms
 */
export function showInfoNotification(message, duration = NOTIFICATION_DURATION.INFO) {
    showErrorNotification(message, {
        level: ERROR_LEVELS.INFO,
        duration
    });
}

/**
 * Show warning notification
 * @param {string} message - Warning message
 * @param {number} duration - Auto-hide duration in ms
 */
export function showWarningNotification(message, duration = NOTIFICATION_DURATION.WARNING) {
    showErrorNotification(message, {
        level: ERROR_LEVELS.WARNING,
        duration
    });
}

// Helper functions to identify error types

/**
 * Check if error is a network error
 * @param {Error} error
 * @returns {boolean}
 */
function isNetworkError(error) {
    if (!error) return false;

    const message = (error.message && error.message.toLowerCase()) || '';
    const name = (error.name && error.name.toLowerCase()) || '';

    return (
        name === 'networkerror' ||
        message.includes('network') ||
        message.includes('fetch') ||
        message.includes('timeout') ||
        message.includes('connection') ||
        error instanceof TypeError && message.includes('failed to fetch')
    );
}

/**
 * Check if error is an authentication error
 * @param {Error} error
 * @returns {boolean}
 */
function isAuthError(error) {
    if (!error) return false;

    const message = (error.message && error.message.toLowerCase()) || '';
    const status = error.status || (error.response && error.response.status);

    return (
        status === 401 ||
        status === 403 ||
        message.includes('unauthorized') ||
        message.includes('forbidden') ||
        message.includes('authentication') ||
        message.includes('auth')
    );
}

/**
 * Check if error is a data loading error
 * @param {Error} error
 * @returns {boolean}
 */
function isDataError(error) {
    if (!error) return false;

    const message = (error.message && error.message.toLowerCase()) || '';

    return (
        message.includes('data') ||
        message.includes('parse') ||
        message.includes('json') ||
        message.includes('load') ||
        message.includes('fetch')
    );
}

// Export error levels for external use
export { ERROR_LEVELS };
