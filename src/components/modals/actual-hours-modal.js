/**
 * Actual Hours Modal Component
 * Provides a keypad interface for inputting actual hours worked on tasks
 * @module components/modals/actual-hours-modal
 */

import { logger } from '../../utils/logger.js';
import { emit } from '../../core/event-bus.js';

// In-memory storage for actual hours (Map: taskId -> hours)
const actualHoursStorage = new Map();

// Current state
let currentTask = null;
let currentValue = '0';

/**
 * Get actual hours for a task
 * @param {string} taskId - Task identifier
 * @returns {number|null} Actual hours or null if not set
 */
export function getActualHours(taskId) {
    return actualHoursStorage.get(taskId) || null;
}

/**
 * Set actual hours for a task
 * @param {string} taskId - Task identifier
 * @param {number} hours - Actual hours worked
 */
export function setActualHours(taskId, hours) {
    if (hours === null || hours === undefined) {
        actualHoursStorage.delete(taskId);
    } else {
        actualHoursStorage.set(taskId, hours);
    }
}

/**
 * Update the display value
 */
function updateDisplay() {
    const displayElement = document.getElementById('hours-display-value');
    if (!displayElement) return;

    // Format to always show 2 digits
    const numValue = parseInt(currentValue, 10);
    const formattedValue = isNaN(numValue) ? '00' : numValue.toString().padStart(2, '0');

    displayElement.textContent = formattedValue;

    // Toggle empty class for styling
    if (currentValue === '0' || currentValue === '') {
        displayElement.classList.add('empty');
    } else {
        displayElement.classList.remove('empty');
    }

    // Enable/disable confirm button based on value
    const confirmBtn = document.getElementById('hours-confirm-btn');
    if (confirmBtn) {
        const numValue = parseInt(currentValue, 10);
        confirmBtn.disabled = isNaN(numValue) || numValue < 0 || numValue > 99;
    }
}

/**
 * Handle digit button click
 * @param {string} digit - The digit to append (0-9)
 */
function handleDigit(digit) {
    // If current value is '0', replace it
    if (currentValue === '0') {
        currentValue = digit;
    } else if (currentValue.length >= 2) {
        // If already 2 digits, start over with new digit
        currentValue = digit;
    } else {
        // Append digit
        currentValue = currentValue + digit;
    }

    updateDisplay();
}

/**
 * Handle backspace button click
 */
function handleBackspace() {
    if (currentValue.length > 1) {
        currentValue = currentValue.slice(0, -1);
    } else {
        currentValue = '0';
    }
    updateDisplay();
}

/**
 * Handle clear button click
 */
function handleClear() {
    currentValue = '0';
    updateDisplay();
}

/**
 * Handle confirm button click
 */
function handleConfirm() {
    if (!currentTask) return;

    const hours = parseInt(currentValue, 10);

    // Validate
    if (isNaN(hours) || hours < 0 || hours > 99) {
        logger.warn('Invalid hours value:', currentValue);
        return;
    }

    // Save to storage
    setActualHours(currentTask.id, hours);

    logger.info(`Set actual hours for task ${currentTask.id}: ${hours}`);

    // Emit event to update UI
    emit('actual-hours-updated', {
        taskId: currentTask.id,
        actualHours: hours
    });

    // Close modal
    hideActualHoursModal();
}

/**
 * Handle cancel button click
 */
function handleCancel() {
    hideActualHoursModal();
}

/**
 * Show the actual hours modal
 * @param {Object} task - Task object
 */
export function showActualHoursModal(task) {
    if (!task) {
        logger.error('Cannot show actual hours modal: no task provided');
        return;
    }

    currentTask = task;

    // Load existing value or default to 0
    const existingHours = getActualHours(task.id);
    currentValue = existingHours !== null ? existingHours.toString() : '0';

    // Update task name in header
    const taskNameElement = document.getElementById('actual-hours-task-name');
    if (taskNameElement) {
        taskNameElement.textContent = task.project || 'Unknown Project';
    }

    // Update display
    updateDisplay();

    // Show modal
    const modal = document.getElementById('actual-hours-modal');
    if (modal) {
        modal.classList.add('show');
    }

    logger.info('Opened actual hours modal for task:', task.id);
}

/**
 * Hide the actual hours modal
 */
export function hideActualHoursModal() {
    const modal = document.getElementById('actual-hours-modal');
    if (modal) {
        modal.classList.remove('show');
    }

    currentTask = null;
    currentValue = '0';

    logger.info('Closed actual hours modal');
}

/**
 * Initialize the actual hours modal
 * Sets up all event listeners
 */
export function initializeActualHoursModal() {
    logger.info('Initializing actual hours modal...');

    // Digit buttons
    const digitButtons = document.querySelectorAll('.keypad-btn[data-digit]');
    digitButtons.forEach(button => {
        button.addEventListener('click', () => {
            const digit = button.dataset.digit;
            handleDigit(digit);
        });
    });

    // Clear button
    const clearBtn = document.getElementById('hours-clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', handleClear);
    }

    // Backspace button
    const backspaceBtn = document.getElementById('hours-backspace-btn');
    if (backspaceBtn) {
        backspaceBtn.addEventListener('click', handleBackspace);
    }

    // Confirm button
    const confirmBtn = document.getElementById('hours-confirm-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', handleConfirm);
    }

    // Cancel button
    const cancelBtn = document.getElementById('hours-cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', handleCancel);
    }

    // Click outside modal to close
    const modal = document.getElementById('actual-hours-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideActualHoursModal();
            }
        });
    }

    // Keyboard support
    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('actual-hours-modal');
        if (!modal || !modal.classList.contains('show')) return;

        // Number keys
        if (e.key >= '0' && e.key <= '9') {
            e.preventDefault();
            handleDigit(e.key);
        }
        // Backspace
        else if (e.key === 'Backspace') {
            e.preventDefault();
            handleBackspace();
        }
        // Enter - confirm
        else if (e.key === 'Enter') {
            e.preventDefault();
            handleConfirm();
        }
        // Escape - cancel
        else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
        }
        // C or Delete - clear
        else if (e.key === 'c' || e.key === 'C' || e.key === 'Delete') {
            e.preventDefault();
            handleClear();
        }
    });

    // Make showActualHoursModal available globally for context menu
    window.showActualHoursModal = showActualHoursModal;

    logger.info('Actual hours modal initialized');
}
