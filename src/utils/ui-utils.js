// UI Utility Functions

/**
 * Show or hide loading indicator
 * @param {boolean} show - Whether to show the loading indicator
 * @param {string} message - Message to display
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
        // Auto-hide after 30 seconds to prevent getting stuck
        if (window.loadingTimeout) clearTimeout(window.loadingTimeout);
        window.loadingTimeout = setTimeout(() => {
            loadingElement.style.display = 'none';
            console.warn('Loading indicator auto-hidden after timeout');
        }, 30000);
    } else {
        loadingElement.style.display = 'none';
        if (window.loadingTimeout) {
            clearTimeout(window.loadingTimeout);
            window.loadingTimeout = null;
        }
        // Performance monitoring: Log render completion time
        if (window.renderStartTime) {
            const renderTime = performance.now() - window.renderStartTime;
            console.log(`Render completed in ${renderTime.toFixed(2)}ms`);
            window.renderStartTime = null;
        }
    }
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
export function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

/**
 * Hide error message
 */
export function hideError() {
    document.getElementById('error').style.display = 'none';
}

/**
 * Show rendering status indicator
 * @param {boolean} show - Whether to show the rendering status
 * @param {string} message - Status message to display
 */
export function showRenderingStatus(show, message = 'Optimizing layout...') {
    const statusElement = document.getElementById('rendering-status');
    if (show) {
        statusElement.textContent = message;
        statusElement.style.display = 'block';
    } else {
        statusElement.style.display = 'none';
    }
}

/**
 * Show success notification
 * @param {string} message - Notification message
 * @param {boolean} isError - Whether this is an error notification
 */
export function showSuccessNotification(message, isError = false) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'inline-edit-notification';
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.background = isError ? '#ef4444' : '#22c55e';
    notification.style.color = 'white';
    notification.style.padding = '0.75rem 1rem';
    notification.style.borderRadius = 'var(--border-radius-md)';
    notification.style.boxShadow = 'var(--shadow-md)';
    notification.style.zIndex = '10000';
    notification.style.fontSize = '0.875rem';
    notification.style.fontWeight = '500';

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

/**
 * Strip HTML tags from a string
 * @param {string} html - HTML string to strip
 * @returns {string} Plain text without HTML tags
 */
export function stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

/**
 * Normalize department name
 * @param {string} dept - Department name to normalize
 * @returns {string} Normalized department name
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
    if (normalized === 'special') return 'Special';
    if (normalized === 'crating') return 'Crating';
    if (normalized === 'load') return 'Load';
    if (normalized === 'ship') return 'Ship';
    return dept;
}

/**
 * Normalize department name for CSS class names
 * @param {string} dept - Department name to normalize
 * @returns {string} CSS-safe department class name
 */
export function normalizeDepartmentClass(dept) {
    if (!dept) return '';
    return dept.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}
