/**
 * Project Modal Component
 * Handles viewing and editing project details across all departments
 * @module components/modals/project-modal
 */

// Core imports
import { getAllTasks, getIsEditingUnlocked } from '../../core/state.js';
import { on, emit, EVENTS } from '../../core/event-bus.js';
import { saveToStaging } from '../../services/sheets-service.js';
import { parseDate } from '../../utils/date-utils.js';
import { DEPARTMENT_ORDER } from '../../config/department-config.js';
import { showPasswordModal } from './password-modal.js';

import { logger } from '../../utils/logger.js';
import { RENDER_DELAY, UI_DELAY } from '../../config/timing-constants.js';
// Field rendering module
import {
    renderDepartmentSection,
    createEditableDescriptionField,
    createReadOnlyDescriptionField,
    updateWeeklyViewCard,
    equalizeProjectCardHeights,
    calculateTotalHours,
    formatProjectTitle
} from './project-modal-fields.js';

// Validation module
import {
    stripHtml,
    hasDescriptionChanged,
    showSuccessNotification,
    collectChangedTasks
} from '../../utils/project-modal-validation.js';

// Private state
let modalElement = null;
let titleElement = null;
let gridElement = null;
let closeButton = null;
let unlockBtn = null;
let editBtn = null;
let lockBtn = null;
let saveBtn = null;
let cancelBtn = null;
let currentProjectName = '';
let originalDescriptions = new Map();

/**
 * Initialize project modal
 * Sets up event listeners and subscribes to events
 */
export function initializeProjectModal() {
    // Get modal elements
    modalElement = document.getElementById('project-modal');
    titleElement = document.getElementById('project-title');
    gridElement = document.getElementById('project-schedule-grid');
    closeButton = document.getElementById('project-close');
    unlockBtn = document.getElementById('unlock-editing-btn');
    editBtn = document.getElementById('edit-plan-btn');
    lockBtn = document.getElementById('lock-editing-btn');
    saveBtn = document.getElementById('save-changes-btn');
    cancelBtn = document.getElementById('cancel-changes-btn');

    if (!modalElement || !titleElement || !gridElement) {
        logger.error('Project modal elements not found in DOM');
        logger.error('modalElement:', modalElement);
        logger.error('titleElement:', titleElement);
        logger.error('gridElement:', gridElement);
        return false;
    }

    // Set up event listeners
    if (closeButton) {
        closeButton.addEventListener('click', hideProjectModal);
    }

    // Close modal on background click
    modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) {
            hideProjectModal();
        }
    });

    // Initialize edit mode controls
    initializeEditMode();

    // Listen for project selection event from search
    on(EVENTS.PROJECT_SELECTED, ({ projectName }) => {
        showProjectModal(projectName);
    });

    logger.info('Project modal initialized');
    return true;
}

/**
 * Show project detail modal
 * @param {string} projectName - Project to display
 */
export function showProjectModal(projectName) {
    if (!modalElement) {
        logger.error('Project modal not initialized');
        return;
    }

    currentProjectName = projectName;
    const allTasks = getAllTasks();
    const projectTasks = allTasks.filter(task => task.project === projectName);

    // Calculate total hours using field module
    const totalHours = calculateTotalHours(projectTasks);

    // Update title using field module
    titleElement.textContent = formatProjectTitle(projectName, totalHours);

    // Clear grid
    gridElement.innerHTML = '';

    // Group tasks by department
    const tasksByDept = {};
    projectTasks.forEach(task => {
        const dept = task.department || 'Other';
        if (!tasksByDept[dept]) tasksByDept[dept] = [];
        tasksByDept[dept].push(task);
    });

    // Sort departments in the same order as main view
    const sortedDepts = DEPARTMENT_ORDER.filter(dept => tasksByDept[dept]);
    if (tasksByDept['Other']) sortedDepts.push('Other');

    // Render each department section using field module
    sortedDepts.forEach(dept => {
        const deptTasks = tasksByDept[dept].sort((a, b) => {
            // Sort by date, then by day number
            const dateA = parseDate(a.date);
            const dateB = parseDate(b.date);
            if (dateA && dateB) {
                const dateDiff = dateA - dateB;
                if (dateDiff !== 0) return dateDiff;
            }
            return parseInt(a.dayNumber || 0) - parseInt(b.dayNumber || 0);
        });

        const deptSection = renderDepartmentSection(dept, deptTasks);
        gridElement.appendChild(deptSection);
    });

    // Show modal
    modalElement.classList.add('show');
    document.body.style.overflow = 'hidden';

    // Equalize card heights after a short delay
    setTimeout(() => {
        equalizeProjectCardHeights();
    }, RENDER_DELAY.CARD_HEIGHT_EQUALIZE);

    // Update edit mode UI
    updateEditModeUI();

    // Emit event
    emit(EVENTS.MODAL_OPENED, { modalName: 'project-modal', projectName });
}

/**
 * Close project modal
 */
export function closeProjectModal() {
    hideProjectModal();
}

/**
 * Hide project modal
 * @private
 */
function hideProjectModal() {
    if (!modalElement) return;

    // Cancel edit mode if active
    const textareas = gridElement.querySelectorAll('.edit-description');
    if (textareas.length > 0) {
        textareas.forEach(textarea => {
            const taskCard = textarea.closest('.project-task-card');
            const taskId = taskCard.dataset.taskId;
            const allTasks = getAllTasks();
            const task = allTasks.find(t => t.id === taskId);
            const descDiv = createReadOnlyDescriptionField(task && task.description ? task.description : '');
            textarea.replaceWith(descDiv);
        });

        // Reset buttons to non-edit state
        exitEditMode();
    }

    modalElement.classList.remove('show');
    document.body.style.overflow = '';
    currentProjectName = '';

    // Emit event
    emit(EVENTS.MODAL_CLOSED, { modalName: 'project-modal' });
}

/**
 * Initialize edit mode controls
 * @private
 */
function initializeEditMode() {
    if (!unlockBtn || !editBtn || !lockBtn || !saveBtn || !cancelBtn) {
        logger.error('Edit mode buttons not found');
        return;
    }

    unlockBtn.addEventListener('click', () => {
        showPasswordModal();
    });

    editBtn.addEventListener('click', () => {
        if (!getIsEditingUnlocked()) return;
        enterEditMode();
    });

    saveBtn.addEventListener('click', async () => {
        await saveChanges();
    });

    cancelBtn.addEventListener('click', () => {
        cancelEditMode();
    });

    lockBtn.addEventListener('click', () => {
        const isEditingUnlocked = getIsEditingUnlocked();
        if (isEditingUnlocked) {
            // Lock editing
            if (window.lockEditing) {
                window.lockEditing();
            }
            updateEditModeUI();

            // If currently in edit mode, cancel it
            if (saveBtn.style.display !== 'none') {
                cancelEditMode();
            }
        }
    });

    // Listen for editing unlocked event
    on(EVENTS.EDITING_UNLOCKED, () => {
        updateEditModeUI();
    });

    on(EVENTS.EDITING_LOCKED, () => {
        updateEditModeUI();
    });
}

/**
 * Update edit mode UI based on editing state
 * @private
 */
function updateEditModeUI() {
    const isUnlocked = getIsEditingUnlocked();

    if (unlockBtn && editBtn && lockBtn) {
        unlockBtn.style.display = isUnlocked ? 'none' : 'inline-block';
        editBtn.style.display = isUnlocked ? 'inline-block' : 'none';
        lockBtn.style.display = isUnlocked ? 'inline-block' : 'none';
    }
}

/**
 * Enter edit mode
 * @private
 */
function enterEditMode() {
    if (!editBtn || !lockBtn || !saveBtn || !cancelBtn) return;

    editBtn.style.display = 'none';
    lockBtn.style.display = 'none';
    saveBtn.style.display = 'inline-block';
    cancelBtn.style.display = 'inline-block';

    const descriptions = gridElement.querySelectorAll('.task-description');
    descriptions.forEach(desc => {
        const taskId = desc.closest('.project-task-card').dataset.taskId;
        const originalText = desc.innerHTML;
        originalDescriptions.set(taskId, originalText);

        const textarea = createEditableDescriptionField(desc);
        desc.replaceWith(textarea);
    });
}

/**
 * Save changes to staging
 * @private
 */
async function saveChanges() {
    if (!saveBtn || !cancelBtn) return;

    // Set loading state
    saveBtn.disabled = true;
    cancelBtn.disabled = true;
    saveBtn.innerHTML = '<div class="save-loading-spinner"></div>Saving...';
    saveBtn.style.background = 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)';
    saveBtn.style.cursor = 'not-allowed';

    try {
        const textareas = gridElement.querySelectorAll('.edit-description');
        const allTasks = getAllTasks();

        // Collect changed tasks using validation module
        const changedTasks = [];

        textareas.forEach(textarea => {
            const taskId = textarea.closest('.project-task-card').dataset.taskId;
            const originalText = originalDescriptions.get(taskId);
            const newText = textarea.value.trim();

            // Update the task
            const task = allTasks.find(t => t.id === taskId);
            if (task) {
                task.description = newText;

                // Update weekly view cards using field module
                updateWeeklyViewCard(taskId, newText);
            }

            // Replace textarea with read-only div
            const descDiv = createReadOnlyDescriptionField(newText);
            textarea.replaceWith(descDiv);

            // Check if changed using validation module
            if (hasDescriptionChanged(originalText, newText)) {
                changedTasks.push({ task, newText });
            }
        });

        // Save to staging (cache invalidation happens automatically in saveToStaging)
        let syncSuccess = true;
        if (changedTasks.length > 0) {
            try {
                await saveToStaging(currentProjectName, changedTasks);
            } catch (error) {
                syncSuccess = false;
                logger.error('Staging sync failed:', error);
            }
        }

        // Exit edit mode
        exitEditMode();

        // Show success notification using validation module
        const syncStatus = syncSuccess
            ? '✅ Changes saved and synced!'
            : '✅ Changes saved locally. Sync to backend failed - please try again.';
        showSuccessNotification(syncStatus, syncSuccess ? 2500 : UI_DELAY.SYNC_STATUS * 2.5);

    } catch (error) {
        logger.error('Save failed:', error);
        // Show error feedback
        saveBtn.innerHTML = '❌ Save Failed';
        saveBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        setTimeout(() => {
            restoreSaveButton();
        }, UI_DELAY.SYNC_STATUS);
    } finally {
        if (!saveBtn.innerHTML.includes('Failed')) {
            restoreSaveButton();
        }
    }
}

/**
 * Restore save button to default state
 * @private
 */
function restoreSaveButton() {
    if (!saveBtn || !cancelBtn) return;

    saveBtn.disabled = false;
    cancelBtn.disabled = false;
    saveBtn.innerHTML = '💾 Save Changes';
    saveBtn.style.background = 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)';
    saveBtn.style.cursor = 'pointer';
}

/**
 * Cancel edit mode
 * @private
 */
function cancelEditMode() {
    const textareas = gridElement.querySelectorAll('.edit-description');
    textareas.forEach(textarea => {
        const taskId = textarea.closest('.project-task-card').dataset.taskId;
        const originalText = originalDescriptions.get(taskId);

        const descDiv = document.createElement('div');
        descDiv.className = 'task-description';
        descDiv.innerHTML = originalText;
        textarea.replaceWith(descDiv);
    });

    exitEditMode();
}

/**
 * Exit edit mode
 * @private
 */
function exitEditMode() {
    if (!editBtn || !lockBtn || !saveBtn || !cancelBtn) return;

    const isUnlocked = getIsEditingUnlocked();

    editBtn.style.display = 'inline-block';
    lockBtn.style.display = isUnlocked ? 'inline-block' : 'none';
    saveBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
    originalDescriptions.clear();
}

/**
 * Alias for showProjectModal (for backward compatibility)
 * @param {string} projectName - Project name
 */
export function showProjectView(projectName) {
    // Check if modal is initialized, if not try to initialize it
    if (!modalElement) {
        logger.warn('Project modal not initialized when showProjectView called, attempting to initialize...');
        const success = initializeProjectModal();
        if (success === false) {
            logger.error('Cannot show project modal - DOM elements not available');
            alert('Error: Project modal cannot be opened. Please refresh the page and try again.');
            return;
        }
    }
    showProjectModal(projectName);
}

// Expose to window for backward compatibility
if (typeof window !== 'undefined') {
    window.showProjectView = showProjectView;
}
