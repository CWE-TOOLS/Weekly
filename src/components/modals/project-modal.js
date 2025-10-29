/**
 * Project Modal Component
 * Handles viewing and editing project details across all departments
 * @module components/modals/project-modal
 */

// Imports
import { getAllTasks, getIsEditingUnlocked } from '../../core/state.js';
import { on, emit, EVENTS } from '../../core/event-bus.js';
import { saveToStaging } from '../../services/sheets-service.js';
import { normalizeDepartmentClass } from '../../utils/ui-utils.js';
import { parseDate } from '../../utils/date-utils.js';
import { DEPARTMENT_ORDER } from '../../config/department-config.js';
import { showPasswordModal } from './password-modal.js';

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
        console.error('Project modal elements not found in DOM');
        return;
    }

    // Set up event listeners
    closeButton.addEventListener('click', hideProjectModal);

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

    console.log('Project modal initialized');
}

/**
 * Show project detail modal
 * @param {string} projectName - Project to display
 */
export function showProjectModal(projectName) {
    if (!modalElement) {
        console.error('Project modal not initialized');
        return;
    }

    currentProjectName = projectName;
    const allTasks = getAllTasks();
    const projectTasks = allTasks.filter(task => task.project === projectName);

    // Calculate total hours
    let totalHours = 0;
    projectTasks.forEach(task => {
        const hours = parseFloat(task.hours);
        if (!isNaN(hours)) {
            totalHours += hours;
        }
    });

    // Update title
    titleElement.textContent = `Build Plan: ${projectName} - Total Hours: ${Math.round(totalHours)}`;

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

    // Render each department section
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

        // Add department section
        const deptSection = document.createElement('div');
        deptSection.className = 'project-dept-section';
        const deptText = dept === 'Special Events' ? 'Special<br>Events' : dept;
        deptSection.innerHTML = `
            <div class="project-dept-header department-label department-${normalizeDepartmentClass(dept)}">
                ${deptText}
            </div>
            <div class="project-cards-container">
                ${deptTasks.map((task, index) => {
                    const taskDate = parseDate(task.date);
                    const formattedDate = task.missingDate ? 'No date' : (taskDate ? taskDate.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    }) : 'No date');

                    return `
                        <div class="project-task-card task-card department-${normalizeDepartmentClass(task.department)}"
                             style="animation-delay: ${index * 0.1}s"
                             data-task-id="${task.id}"
                             title="Click for options">
                            <div class="task-title">${task.project}</div>
                            <div class="project-description">${task.projectDescription || ''}</div>
                            <div class="task-day-counter">${task.dayCounter || ''}</div>
                            <div class="task-description">${task.description && task.description.trim() ? task.description : '<span class="missing-description">Staging Missing</span>'}</div>
                            <div class="task-details">
                                <strong>Date:</strong> ${formattedDate}<br>
                                <strong>Hours:</strong> ${task.hours}<br>
                                <strong>Code:</strong> ${task.value}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        gridElement.appendChild(deptSection);
    });

    // Show modal
    modalElement.classList.add('show');
    document.body.style.overflow = 'hidden';

    // Equalize card heights after a short delay
    setTimeout(() => {
        equalizeProjectCardHeights();
    }, 100);

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
            const descDiv = document.createElement('div');
            descDiv.className = 'task-description';
            descDiv.innerHTML = task && task.description ? task.description : '<span class="missing-description">Staging Missing</span>';
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
        console.error('Edit mode buttons not found');
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

        const textarea = document.createElement('textarea');
        textarea.className = 'edit-description';
        textarea.value = desc.textContent.trim() === 'Staging Missing' ? '' : desc.textContent.trim();
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
        const changedTasks = [];
        const allTasks = getAllTasks();

        textareas.forEach(textarea => {
            const taskId = textarea.closest('.project-task-card').dataset.taskId;
            const originalText = originalDescriptions.get(taskId);
            const originalStripped = stripHtml(originalText).trim();
            const newText = textarea.value.trim();

            // Update the task
            const task = allTasks.find(t => t.id === taskId);
            if (task) {
                task.description = newText;

                // Update weekly view cards
                const weeklyCard = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
                if (weeklyCard) {
                    const descElement = weeklyCard.querySelector('.task-description');
                    if (descElement) {
                        descElement.innerHTML = newText || '<span class="missing-description">Staging Missing</span>';
                    }
                }
            }

            // Replace textarea
            const descDiv = document.createElement('div');
            descDiv.className = 'task-description';
            descDiv.innerHTML = newText || '<span class="missing-description">Staging Missing</span>';
            textarea.replaceWith(descDiv);

            // Check if changed
            if (newText !== originalStripped) {
                changedTasks.push({ task, newText });
            }
        });

        // Save to staging
        let syncSuccess = true;
        if (changedTasks.length > 0) {
            try {
                await saveToStaging(currentProjectName, changedTasks);
            } catch (error) {
                syncSuccess = false;
                console.error('Staging sync failed:', error);
            }
        }

        // Exit edit mode
        exitEditMode();

        // Show success notification
        const successNotif = document.getElementById('project-success-notification');
        if (successNotif) {
            const syncStatus = syncSuccess
                ? '✅ Changes saved and synced!'
                : '✅ Changes saved locally. Sync to backend failed - please try again.';
            successNotif.textContent = syncStatus;
            successNotif.style.display = 'block';
            setTimeout(() => {
                successNotif.style.display = 'none';
            }, syncSuccess ? 2500 : 5000);
        }

    } catch (error) {
        console.error('Save failed:', error);
        // Show error feedback
        saveBtn.innerHTML = '❌ Save Failed';
        saveBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        setTimeout(() => {
            restoreSaveButton();
        }, 2000);
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
 * Equalize card heights in project view
 * @private
 */
function equalizeProjectCardHeights() {
    const projectSections = document.querySelectorAll('.project-dept-section');

    projectSections.forEach(section => {
        const cards = section.querySelectorAll('.project-task-card');
        if (cards.length === 0) return;

        // Find max height
        let maxHeight = 0;
        cards.forEach(card => {
            const originalHeight = card.style.minHeight;
            card.style.minHeight = 'auto';
            const currentHeight = card.offsetHeight;
            if (currentHeight > maxHeight) maxHeight = currentHeight;
            card.style.minHeight = originalHeight;
        });

        // Apply max height to all cards in this section
        if (maxHeight > 0) {
            cards.forEach(card => {
                card.style.minHeight = `${maxHeight}px`;
            });
        }
    });
}

/**
 * Strip HTML tags from string
 * @param {string} html - HTML string
 * @returns {string} Plain text
 * @private
 */
function stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

/**
 * Alias for showProjectModal (for backward compatibility)
 * @param {string} projectName - Project name
 */
export function showProjectView(projectName) {
    showProjectModal(projectName);
}

// Expose to window for backward compatibility
if (typeof window !== 'undefined') {
    window.showProjectView = showProjectView;
}
