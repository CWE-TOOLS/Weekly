/**
 * Actual Hours Modal Component
 * Provides a keypad interface for inputting actual hours worked on tasks
 * @module components/modals/actual-hours-modal
 */

import { logger } from '../../utils/logger.js';
import { emit } from '../../core/event-bus.js';
import { saveActualHours as persistActualHours } from '../../services/actual-hours-service.js';

// In-memory render cache (Map: taskId -> hours). Repopulated on app startup
// from Supabase via seedActualHoursStorage(). task.id is positional and not
// stable across sheet edits, so we never persist by it — only use it here
// for fast lookup during render.
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
 * Bulk-prime the in-memory cache from a Map<taskId, hours>. Called once
 * at app startup after Supabase rows are loaded and matched to tasks.
 * @param {Map<string, number>} taskIdToHours
 */
export function seedActualHoursStorage(taskIdToHours) {
    actualHoursStorage.clear();
    if (!taskIdToHours) return;
    for (const [id, hours] of taskIdToHours) {
        actualHoursStorage.set(id, hours);
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
async function handleConfirm() {
    if (!currentTask) return;

    const hours = parseInt(currentValue, 10);

    // Validate
    if (isNaN(hours) || hours < 0 || hours > 99) {
        logger.warn('Invalid hours value:', currentValue);
        return;
    }

    const confirmBtn = document.getElementById('hours-confirm-btn');
    if (confirmBtn) confirmBtn.disabled = true;

    const taskAtConfirm = currentTask;
    try {
        await persistActualHours(taskAtConfirm, hours);
    } catch (err) {
        logger.error('Failed to persist actual hours:', err);
        if (confirmBtn) confirmBtn.disabled = false;
        return;
    }

    setActualHours(taskAtConfirm.id, hours);
    logger.info(`Set actual hours for task ${taskAtConfirm.id}: ${hours}`);

    emit('actual-hours-updated', {
        taskId: taskAtConfirm.id,
        actualHours: hours
    });

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
    console.log('showActualHoursModal called with task:', task);

    if (!task) {
        logger.error('Cannot show actual hours modal: no task provided');
        console.error('No task provided to modal');
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

    // Show modal - use both class and inline style for compatibility
    const modal = document.getElementById('actual-hours-modal');
    if (modal) {
        console.log('Modal element found, showing modal');
        modal.classList.add('show');
        // Fallback for older browsers - explicitly set display
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
    } else {
        console.error('Modal element not found!');
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
        // Explicitly hide for compatibility
        modal.style.display = 'none';
    }

    currentTask = null;
    currentValue = '0';

    logger.info('Closed actual hours modal');
}

/**
 * Initialize the actual hours modal
 * Sets up all event listeners
 */
/**
 * Add both click and touch event listeners for better compatibility
 * @param {HTMLElement} element - Element to add listeners to
 * @param {Function} handler - Handler function
 */
function addClickHandler(element, handler) {
    if (!element) return;

    // Add click event (works for mouse and some touch devices)
    element.addEventListener('click', (e) => {
        e.preventDefault();
        handler();
    });

    // Add touchend for better touch responsiveness (Chrome OS, tablets, etc.)
    element.addEventListener('touchend', (e) => {
        e.preventDefault();
        handler();
    });
}

export function initializeActualHoursModal() {
    logger.info('Initializing actual hours modal...');

    // Digit buttons
    const digitButtons = document.querySelectorAll('.keypad-btn[data-digit]');
    digitButtons.forEach(button => {
        addClickHandler(button, () => {
            const digit = button.dataset.digit;
            handleDigit(digit);
        });
    });

    // Clear button
    const clearBtn = document.getElementById('hours-clear-btn');
    addClickHandler(clearBtn, handleClear);

    // Backspace button
    const backspaceBtn = document.getElementById('hours-backspace-btn');
    addClickHandler(backspaceBtn, handleBackspace);

    // Confirm button
    const confirmBtn = document.getElementById('hours-confirm-btn');
    addClickHandler(confirmBtn, handleConfirm);

    // Cancel button
    const cancelBtn = document.getElementById('hours-cancel-btn');
    addClickHandler(cancelBtn, handleCancel);

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
