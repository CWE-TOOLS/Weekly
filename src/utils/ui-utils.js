/**
 * UI Utility Functions
 * Provides common UI operations like loading states, notifications, and text formatting
 * @module utils/ui-utils
 */

import { logger } from './logger.js';
import { UI_DELAY, NOTIFICATION_DURATION } from '../config/timing-constants.js';
import { POSITION_OFFSET, Z_INDEX, NOTIFICATION_STYLE } from '../config/layout-constants.js';

/**
 * Show or hide loading indicator with optional message
 *
 * Displays a loading spinner with customizable message and automatic timeout protection.
 * Tracks render performance timing when showing/hiding the indicator.
 *
 * @param {boolean} show - Whether to show the loading indicator
 * @param {string} [message='Loading tasks...'] - Message to display during loading
 *
 * @example
 * // Show loading indicator
 * showLoading(true, 'Fetching data...');
 *
 * // Hide loading indicator
 * showLoading(false);
 */
export function showLoading(show, message = 'Loading tasks...') {
    const loadingElement = document.getElementById('loading');
    if (show) {
        loadingElement.style.display = 'block';
        // Update message if provided
        if (message) {
            loadingElement.querySelector('div:first-child').textContent = message;
        }
        // Performance monitoring: Track render start time
        window.renderStartTime = performance.now();
        // Auto-hide after timeout to prevent getting stuck
        if (window.loadingTimeout) clearTimeout(window.loadingTimeout);
        window.loadingTimeout = setTimeout(() => {
            loadingElement.style.display = 'none';
            logger.warn('Loading indicator auto-hidden after timeout');
        }, UI_DELAY.LOADING_TIMEOUT);
    } else {
        loadingElement.style.display = 'none';
        if (window.loadingTimeout) {
            clearTimeout(window.loadingTimeout);
            window.loadingTimeout = null;
        }
        // Performance monitoring: Log render completion time
        if (window.renderStartTime) {
            const renderTime = performance.now() - window.renderStartTime;
            logger.info(`Render completed in ${renderTime.toFixed(2)}ms`);
            window.renderStartTime = null;
        }
    }
}

/**
 * Show error message in the error display area
 *
 * Displays an error message to the user in the dedicated error section.
 * The error persists until explicitly hidden with hideError().
 *
 * @param {string} message - Error message to display
 *
 * @example
 * showError('Failed to load schedule data. Please try again.');
 */
export function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

/**
 * Hide error message display area
 *
 * Removes the currently displayed error message from view.
 *
 * @example
 * hideError();
 */
export function hideError() {
    document.getElementById('error').style.display = 'none';
}

/**
 * Show success or error notification toast
 *
 * Displays a temporary toast notification in the top-right corner.
 * Auto-dismisses after a timeout. Styled as green for success or red for errors.
 *
 * @param {string} message - Notification message to display
 * @param {boolean} [isError=false] - Whether this is an error notification (changes color)
 *
 * @example
 * // Success notification
 * showSuccessNotification('Task saved successfully!');
 *
 * // Error notification
 * showSuccessNotification('Failed to save task', true);
 */
export function showSuccessNotification(message, isError = false) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'inline-edit-notification';
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.top = `${POSITION_OFFSET.NOTIFICATION}px`;
    notification.style.right = `${POSITION_OFFSET.NOTIFICATION}px`;
    notification.style.background = isError ? '#ef4444' : '#22c55e';
    notification.style.color = 'white';
    notification.style.padding = `${NOTIFICATION_STYLE.PADDING_VERTICAL_REM}rem ${NOTIFICATION_STYLE.PADDING_HORIZONTAL_REM}rem`;
    notification.style.borderRadius = 'var(--border-radius-md)';
    notification.style.boxShadow = 'var(--shadow-md)';
    notification.style.zIndex = `${Z_INDEX.NOTIFICATION}`;
    notification.style.fontSize = `${NOTIFICATION_STYLE.FONT_SIZE_REM}rem`;
    notification.style.fontWeight = '500';

    document.body.appendChild(notification);

    // Remove after timeout
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, NOTIFICATION_DURATION.INFO);
}

/**
 * Strip HTML tags from a string to get plain text
 *
 * Safely removes all HTML tags from a string by using DOM parsing.
 * Useful for displaying HTML content as plain text.
 *
 * @param {string} html - HTML string to strip
 * @returns {string} Plain text without HTML tags
 *
 * @example
 * stripHtml('<b>Hello</b> <i>World</i>');
 * // Returns: 'Hello World'
 */
export function stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

/**
 * Normalize department name to standard casing
 *
 * Converts department names to their canonical form with proper casing.
 * Handles case-insensitive matching and common variations (e.g., 'formout' vs 'Form Out').
 *
 * @param {string} dept - Department name to normalize
 * @returns {string} Normalized department name with proper casing
 *
 * @example
 * normalizeDepartment('special events'); // Returns: 'Special Events'
 * normalizeDepartment('FORM OUT');       // Returns: 'Form Out'
 * normalizeDepartment('mill');           // Returns: 'Mill'
 */
export function normalizeDepartment(dept) {
    if (!dept) return '';
    const normalized = dept.toLowerCase().trim();
    // Handle case-insensitive matching for department names
    if (normalized === 'special events') return 'Special Events';
    if (normalized === 'mill') return 'Mill';
    if (normalized === 'formout' || normalized === 'form out') return 'Form Out';
    if (normalized === 'cast') return 'Cast';
    if (normalized === 'batch') return 'Batch';
    if (normalized === 'demold') return 'Demold';
    if (normalized === 'layout') return 'Layout';
    if (normalized === 'finish') return 'Finish';
    if (normalized === 'seal') return 'Seal';
    if (normalized === 'final' || normalized === 'final insp' || normalized === 'final insp.' || normalized === 'final inspection') return 'Final Insp.';
    if (normalized === 'special') return 'Special';
    if (normalized === 'crating') return 'Crating';
    if (normalized === 'load') return 'Load';
    if (normalized === 'ship') return 'Ship';
    if (normalized === 'samples') return 'Samples';
    if (normalized === 'facilities' || normalized === 'facility') return 'Facilities';
    return dept;
}

/**
 * Normalize project name for consistent lookup keys
 *
 * Collapses multiple consecutive whitespace characters into single spaces and trims.
 * This matches how browsers display text content (HTML whitespace collapsing).
 * Essential for matching task descriptions when Google Sheets has inconsistent spacing.
 *
 * @param {string} projectName - Project name to normalize
 * @returns {string} Normalized project name with single spaces
 *
 * @example
 * normalizeProjectName('U of M stair Z               cast #2'); // Returns: 'U of M stair Z cast #2'
 * normalizeProjectName('Project   Name  ');                     // Returns: 'Project Name'
 */
export function normalizeProjectName(projectName) {
    if (!projectName) return '';
    // Replace multiple consecutive whitespace with single space, then trim
    return projectName.replace(/\s+/g, ' ').trim();
}

export { normalizeDepartmentClass } from '../config/department-config.js';
