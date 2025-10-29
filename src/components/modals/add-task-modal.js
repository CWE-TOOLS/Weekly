/**
 * Add Task Modal Component
 * Handles adding new manual tasks to the schedule
 * @module components/modals/add-task-modal
 */

// Imports
import { emit, EVENTS } from '../../core/event-bus.js';
import { saveTaskToSupabase, sendRefreshSignal } from '../../services/supabase-service.js';
import { fetchAllTasks } from '../../services/data-service.js';
import { showError } from '../../utils/ui-utils.js';

// Private state
let modalElement = null;
let formElement = null;
let submitButton = null;
let cancelButton = null;
let closeButton = null;
let currentAddCardContext = null; // { department, date, week }

/**
 * Initialize add task modal
 * Sets up event listeners and references to DOM elements
 */
export function initializeAddTaskModal() {
    // Get modal element
    modalElement = document.getElementById('add-card-modal');
    formElement = document.getElementById('add-card-form');
    submitButton = document.getElementById('add-card-submit');
    cancelButton = document.getElementById('add-card-cancel');
    closeButton = document.getElementById('add-card-close');

    if (!modalElement || !formElement) {
        console.error('Add task modal elements not found in DOM');
        return;
    }

    // Set up event listeners
    closeButton.addEventListener('click', hideAddTaskModal);
    cancelButton.addEventListener('click', hideAddTaskModal);

    // Close modal on background click
    modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) {
            hideAddTaskModal();
        }
    });

    // Handle form submission
    formElement.addEventListener('submit', handleAddCardSubmit);

    console.log('Add task modal initialized');
}

/**
 * Open the add task modal
 * @param {Object} options - Pre-fill options
 * @param {string} options.taskId - Task ID (for editing existing task)
 * @param {string} options.project - Project name
 * @param {string} options.description - Task description
 * @param {string} options.department - Pre-selected department
 * @param {string} options.date - Pre-filled date
 * @param {string} options.week - Week string
 * @param {number} options.hours - Hours
 * @param {number} options.dayNumber - Day number
 * @param {number} options.totalDays - Total days
 */
export function openAddTaskModal(options = {}) {
    if (!modalElement) {
        console.error('Add task modal not initialized');
        return;
    }

    // Store context (including taskId for editing mode)
    currentAddCardContext = {
        taskId: options.taskId || null,
        department: options.department || '',
        date: options.date || '',
        week: options.week || ''
    };

    console.log('openAddTaskModal called with:', currentAddCardContext);

    // Show modal
    modalElement.classList.add('show');
    document.body.style.overflow = 'hidden';

    // Update modal title based on mode
    const modalTitle = document.querySelector('#add-card-modal h3');
    if (modalTitle) {
        modalTitle.textContent = options.taskId ? 'Edit Task' : 'Add New Task';
    }

    // Update submit button text based on mode
    if (submitButton) {
        submitButton.textContent = options.taskId ? 'Update Task' : 'Add Task';
    }

    // Set values (either from existing task or defaults)
    setTimeout(() => {
        const elements = {
            'task-project': options.project || '',
            'task-description': options.description || '',
            'task-department': currentAddCardContext.department,
            'task-date': currentAddCardContext.date,
            'task-hours': options.hours !== undefined ? String(options.hours) : '0',
            'task-day-number': options.dayNumber !== undefined ? String(options.dayNumber) : '1',
            'task-total-days': options.totalDays !== undefined ? String(options.totalDays) : '1'
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.value = value;
            }
        });

        // Focus first input
        const taskProjectEl = document.getElementById('task-project');
        if (taskProjectEl) {
            taskProjectEl.focus();
        }
    }, 50);

    // Emit event
    emit(EVENTS.MODAL_OPENED, { modalName: 'add-task-modal' });
}

/**
 * Close the add task modal
 */
export function closeAddTaskModal() {
    hideAddTaskModal();
}

/**
 * Hide add task modal
 * @private
 */
function hideAddTaskModal() {
    if (!modalElement) return;

    modalElement.classList.remove('show');
    document.body.style.overflow = '';
    currentAddCardContext = null;

    // Reset form
    if (formElement) {
        formElement.reset();
    }

    // Emit event
    emit(EVENTS.MODAL_CLOSED, { modalName: 'add-task-modal' });
}

/**
 * Handle add card form submission
 * @param {Event} e - Form submit event
 * @private
 */
async function handleAddCardSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const taskData = {
        id: `manual-${Date.now()}`,
        week: currentAddCardContext.week,
        project: formData.get('project'),
        description: formData.get('description'),
        department: formData.get('department'),
        date: formData.get('date'),
        hours: formData.get('hours'),
        dayNumber: formData.get('dayNumber'),
        totalDays: formData.get('totalDays'),
        value: '',
        projectDescription: ''
    };

    // Validate required fields
    const validation = validateTaskForm(taskData);
    if (!validation.valid) {
        alert(validation.errors.join('\n'));
        return;
    }

    try {
        // Show loading state
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Adding...';
        }

        // Save to Supabase
        await saveTaskToSupabase(taskData);

        // Send refresh signal to all clients
        await sendRefreshSignal({
            action: 'task_added',
            taskId: taskData.id,
            department: taskData.department,
            date: taskData.date
        });

        // Refresh local data
        await fetchAllTasks();

        // Emit task created event
        emit(EVENTS.TASK_CREATED, { task: taskData });

        // Hide modal
        hideAddTaskModal();

        console.log('Task added successfully:', taskData);

    } catch (error) {
        console.error('Failed to add task:', error);
        showError('Failed to add task. Please try again.');
    } finally {
        // Restore button state
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Add Task';
        }
    }
}

/**
 * Validate task form data
 * @param {Object} taskData - Task data to validate
 * @returns {{valid: boolean, errors: string[]}} Validation result
 * @private
 */
function validateTaskForm(taskData) {
    const errors = [];

    if (!taskData.project || !taskData.project.trim()) {
        errors.push('Project name is required');
    }

    if (!taskData.department || !taskData.department.trim()) {
        errors.push('Department is required');
    }

    if (!taskData.date || !taskData.date.trim()) {
        errors.push('Date is required');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Show add task modal (alias for openAddTaskModal)
 * @param {string} department - Department name
 * @param {string} date - Date string
 * @param {string} week - Week string
 */
export function showAddCardModal(department, date, week) {
    openAddTaskModal({ department, date, week });
}

// Expose to window for backward compatibility
if (typeof window !== 'undefined') {
    window.showAddCardModal = showAddCardModal;
}
