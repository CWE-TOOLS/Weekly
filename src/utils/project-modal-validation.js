/**
 * Project Modal Validation Module
 * Handles validation logic, error display, and data integrity checks
 * @module utils/project-modal-validation
 */

import { CONTENT_LIMITS } from '../config/layout-constants.js';

/**
 * Strip HTML tags from string
 * @param {string} html - HTML string
 * @returns {string} Plain text
 */
export function stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

/**
 * Check if description has changed
 * @param {string} originalHtml - Original HTML content
 * @param {string} newText - New text content
 * @returns {boolean} True if changed
 */
export function hasDescriptionChanged(originalHtml, newText) {
    const originalStripped = stripHtml(originalHtml).trim();
    return newText !== originalStripped;
}

/**
 * Show success notification
 * @param {string} message - Notification message
 * @param {number} duration - Duration in milliseconds (default: 2500)
 */
export function showSuccessNotification(message, duration = 2500) {
    const successNotif = document.getElementById('project-success-notification');
    if (successNotif) {
        successNotif.textContent = message;
        successNotif.style.display = 'block';
        setTimeout(() => {
            successNotif.style.display = 'none';
        }, duration);
    }
}

/**
 * Show error notification
 * @param {string} message - Error message
 * @param {number} duration - Duration in milliseconds (default: 5000)
 */
export function showErrorNotification(message, duration = 5000) {
    const successNotif = document.getElementById('project-success-notification');
    if (successNotif) {
        successNotif.textContent = message;
        successNotif.style.display = 'block';
        successNotif.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        setTimeout(() => {
            successNotif.style.display = 'none';
            successNotif.style.background = ''; // Reset to default
        }, duration);
    }
}

/**
 * Validate task data
 * @param {Object} task - Task object to validate
 * @returns {Object} Validation result {isValid: boolean, errors: Array}
 */
export function validateTaskData(task) {
    const errors = [];

    if (!task) {
        errors.push('Task object is null or undefined');
        return { isValid: false, errors };
    }

    if (!task.id) {
        errors.push('Task ID is missing');
    }

    if (!task.project || task.project.trim() === '') {
        errors.push('Project name is missing');
    }

    if (!task.department || task.department.trim() === '') {
        errors.push('Department is missing');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validate description text
 * @param {string} text - Description text
 * @returns {Object} Validation result {isValid: boolean, message: string}
 */
export function validateDescription(text) {
    if (!text || text.trim() === '') {
        return {
            isValid: true, // Empty descriptions are allowed
            message: ''
        };
    }

    // Check for maximum length (if needed)
    if (text.length > CONTENT_LIMITS.MAX_DESCRIPTION_LENGTH) {
        return {
            isValid: false,
            message: `Description exceeds maximum length of ${CONTENT_LIMITS.MAX_DESCRIPTION_LENGTH} characters`
        };
    }

    return {
        isValid: true,
        message: ''
    };
}

/**
 * Collect changed tasks from textareas
 * @param {NodeList} textareas - Textarea elements
 * @param {Map} originalDescriptions - Map of original descriptions by task ID
 * @param {Array} allTasks - Array of all tasks
 * @returns {Array} Array of {task, newText} objects
 */
export function collectChangedTasks(textareas, originalDescriptions, allTasks) {
    const changedTasks = [];

    textareas.forEach(textarea => {
        const taskId = textarea.closest('.project-task-card').dataset.taskId;
        const originalText = originalDescriptions.get(taskId);
        const newText = textarea.value.trim();

        if (hasDescriptionChanged(originalText, newText)) {
            const task = allTasks.find(t => t.id === taskId);
            if (task) {
                changedTasks.push({ task, newText });
            }
        }
    });

    return changedTasks;
}
