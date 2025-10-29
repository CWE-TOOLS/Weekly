/**
 * Task Card Component
 * Handles rendering of individual task cards in the schedule grid
 * @module components/task-card
 */

import { getIsEditingUnlocked } from '../core/state.js';

/**
 * Normalize department name to CSS class format
 * @param {string} dept - Department name
 * @returns {string} Normalized class name
 */
function normalizeDepartmentClass(dept) {
    if (!dept) return '';
    return dept.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

/**
 * Create a task card element
 * @param {Object} task - Task data object
 * @param {string} task.id - Unique task identifier
 * @param {string} task.project - Project name
 * @param {string} task.projectDescription - Project description
 * @param {string} task.description - Task description
 * @param {string} task.department - Department name
 * @param {string} task.dayCounter - Day counter (e.g., "Day 1 of 3")
 * @param {string} task.hours - Hours allocated
 * @param {boolean} task.isManual - Whether this is a manually added task
 * @param {boolean} task.missingDate - Whether the task has a missing date
 * @param {string} rowClass - CSS class for row alignment
 * @returns {HTMLElement} Task card element
 */
export function createTaskCard(task, rowClass) {
    const isEditingUnlocked = getIsEditingUnlocked();
    const showHours = task.department !== 'Batch' && task.department !== 'Layout';
    const isDraggable = task.isManual && isEditingUnlocked;

    const card = document.createElement('div');
    card.className = `task-card ${rowClass} department-${normalizeDepartmentClass(task.department)} ${isDraggable ? '' : 'not-draggable'}`;
    card.dataset.taskId = task.id;

    if (isDraggable) {
        card.draggable = true;
        card.title = 'Drag to move to different date';
    } else {
        card.title = 'Click for options';
    }

    // Task title
    const titleDiv = document.createElement('div');
    titleDiv.className = 'task-title';
    titleDiv.textContent = task.project;
    card.appendChild(titleDiv);

    // Project description
    const projectDescDiv = document.createElement('div');
    projectDescDiv.className = 'project-description';
    projectDescDiv.textContent = task.projectDescription || '';
    card.appendChild(projectDescDiv);

    // Day counter
    const dayCounterDiv = document.createElement('div');
    dayCounterDiv.className = 'task-day-counter';
    dayCounterDiv.textContent = task.dayCounter || '';
    card.appendChild(dayCounterDiv);

    // Task description
    const descDiv = document.createElement('div');
    descDiv.className = 'task-description';
    if (task.description && task.description.trim()) {
        // Use innerHTML for Batch and Layout to support <br> tags, textContent for others for safety
        if (task.department === 'Batch' || task.department === 'Layout') {
            descDiv.innerHTML = task.description;
        } else {
            descDiv.textContent = task.description;
        }
    } else {
        descDiv.innerHTML = '<span class="missing-description">Staging Missing</span>';
    }
    card.appendChild(descDiv);

    // Task details (hours) - only for non-Batch/Layout tasks
    if (showHours) {
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'task-details';

        let detailsHTML = '';
        if (task.missingDate) {
            detailsHTML += '<strong>Date:</strong> Missing<br>';
        }
        detailsHTML += `<strong>Hours:</strong> ${task.hours}`;

        detailsDiv.innerHTML = detailsHTML;
        card.appendChild(detailsDiv);
    }

    // Edit buttons (when editing is unlocked)
    if (isEditingUnlocked) {
        const planBtn = document.createElement('button');
        planBtn.className = 'task-plan-btn';
        planBtn.dataset.taskId = task.id;
        planBtn.textContent = 'Plan';
        card.appendChild(planBtn);

        const editBtn = document.createElement('button');
        editBtn.className = 'task-edit-btn';
        editBtn.dataset.taskId = task.id;
        editBtn.textContent = 'Edit';
        card.appendChild(editBtn);
    }

    // Delete button (only for manual tasks when editing is unlocked)
    if (isDraggable) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'task-delete-btn';
        deleteBtn.dataset.taskId = task.id;
        deleteBtn.title = 'Delete this manual task';
        deleteBtn.textContent = '🗑️';
        card.appendChild(deleteBtn);
    }

    return card;
}

/**
 * Create a task card placeholder for empty cells
 * @param {string} department - Department name
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @param {string} weekString - Week start date string
 * @param {string} rowClass - CSS class for row alignment
 * @returns {HTMLElement} Placeholder element
 */
export function createTaskCardPlaceholder(department, dateString, weekString, rowClass) {
    const isEditingUnlocked = getIsEditingUnlocked();

    const placeholder = document.createElement('div');
    placeholder.className = `task-card-placeholder ${rowClass}${isEditingUnlocked ? ' add-enabled' : ''}`;
    placeholder.dataset.department = department;
    placeholder.dataset.date = dateString;
    placeholder.dataset.week = weekString;

    return placeholder;
}

/**
 * Normalize department class (exposed for backward compatibility)
 * @param {string} dept - Department name
 * @returns {string} Normalized class name
 */
export { normalizeDepartmentClass };
