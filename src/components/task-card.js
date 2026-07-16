/**
 * Task Card Component
 * Handles rendering of individual task cards in the schedule grid
 * @module components/task-card
 */

import { getIsEditingUnlocked } from '../core/state.js';
import { getActualHours } from './modals/actual-hours-modal.js';
import { RENDERING } from '../config/rendering-constants.js';
import { normalizeDepartmentClass } from '../config/department-config.js';
import { sanitizeDescription } from '../utils/security-utils.js';

/**
 * Build the inner HTML for a task's `.task-details` div. Single source of truth
 * for the planned + (optional) actual-hours display, shared by initial render,
 * smart-update, and the actual-hours-updated DOM patch.
 */
export function buildTaskDetailsHTML(task) {
    let html = '';
    if (task.missingDate) {
        html += '<strong>Date:</strong> Missing<br>';
    }
    const actualHours = getActualHours(task);
    if (actualHours !== null) {
        html += `<strong>Hours:</strong> ${task.hours} | <strong class="actual-hours">Actual:</strong> <span class="actual-hours-value">${actualHours}</span>`;
    } else {
        html += `<strong>Hours:</strong> ${task.hours}`;
    }
    return html;
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
 * @param {boolean} [isEditingUnlocked] - Whether editing is unlocked (falls back to state if omitted)
 * @returns {HTMLElement} Task card element
 */
export function createTaskCard(task, rowClass, isEditingUnlocked) {
    if (isEditingUnlocked === undefined) isEditingUnlocked = getIsEditingUnlocked();
    const showHours = task.isSynthetic ? false : RENDERING.shouldShowHours(task.department);
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

    // Task title — prefer the canonical project name from the projects table when
    // the task's project number resolved to one. Cast # renders on its own line.
    const titleDiv = document.createElement('div');
    titleDiv.className = 'task-title';
    titleDiv.textContent = task.resolvedProjectName || task.project;
    card.appendChild(titleDiv);

    if (task.resolvedProjectName && task.castingNumber) {
        const castDiv = document.createElement('div');
        castDiv.className = 'task-cast-number';
        castDiv.textContent = `Cast ${task.castingNumber}`;
        card.appendChild(castDiv);
    }

    // Casting side (A/B) — Cast-department only, rendered when a side has been
    // selected for this task. Stored in task_descriptions.casting_side.
    if (task.castingSide === 'A' || task.castingSide === 'B') {
        const sideDiv = document.createElement('div');
        sideDiv.className = 'task-casting-side';
        sideDiv.textContent = `Side ${task.castingSide}`;
        card.appendChild(sideDiv);
    }

    // Project manager (from projects table) — falls back to the Google Sheet
    // description (column C) when the task has no project-number match or the
    // matched project has no PM set. Mirrors how the title falls back from
    // resolvedProjectName to the sheet's project name.
    const projectDescDiv = document.createElement('div');
    projectDescDiv.className = 'project-description';
    projectDescDiv.textContent = task.resolvedProjectManager || task.projectDescription || '';
    card.appendChild(projectDescDiv);

    // Day counter
    const dayCounterDiv = document.createElement('div');
    dayCounterDiv.className = 'task-day-counter';
    dayCounterDiv.textContent = task.dayCounter || '';
    card.appendChild(dayCounterDiv);

    // Cast-department cards linked to a portal casting show explicit "Missing …"
    // placeholders when a readout has no data (instead of hiding the line).
    const isCastCastingLinked = task.department === 'Cast'
        && String(task.projectNumber || '').trim() !== ''
        && String(task.castingNumber || '').trim() !== '';
    const appendBand = (className, text, missing) => {
        const div = document.createElement('div');
        div.className = missing ? `${className} task-missing-data` : className;
        div.textContent = text;
        card.appendChild(div);
    };

    // Pieces count — for tasks linked to a casting in the project portal, show
    // the casting's total inventory pieces (quantity + extras) as a slim band
    // directly below the day counter. Set during load by enrichTasksWithPieces.
    if (typeof task.piecesCount === 'number' && task.piecesCount > 0) {
        appendBand('task-pieces-count', `${task.piecesCount} pcs`);
    } else if (isCastCastingLinked) {
        appendBand('task-pieces-count', 'Missing pcs count', true);
    }

    // Color log title — name(s) of the color log(s) used by this casting's
    // batch tickets. Set during load by enrichTasksWithPieces.
    const colorLogTitle = typeof task.colorLogTitle === 'string' ? task.colorLogTitle.trim() : '';
    if (colorLogTitle) {
        appendBand('task-color-log', colorLogTitle);
    } else if (isCastCastingLinked) {
        appendBand('task-color-log', 'Missing color log', true);
    }

    // Cast method — "Spray Up" / "Direct Cast" from the resolved color log(s).
    // Only rendered when a color log exists (the "Missing color log" line
    // covers the no-log case). Set during load by enrichTasksWithPieces.
    const castMethod = typeof task.castMethod === 'string' ? task.castMethod.trim() : '';
    if (castMethod) {
        appendBand('task-cast-method', castMethod);
    } else if (isCastCastingLinked && colorLogTitle) {
        appendBand('task-cast-method', 'Missing cast method', true);
    }

    // Batch count — total batches across the casting's batch tickets
    // (buildBatchPlan summary totals). Set during load by enrichTasksWithPieces.
    if (typeof task.batchCount === 'number' && task.batchCount > 0) {
        appendBand('task-batch-count', `${task.batchCount} ${task.batchCount === 1 ? 'batch' : 'batches'}`);
    } else if (isCastCastingLinked) {
        appendBand('task-batch-count', 'Missing batching', true);
    }

    // Task description
    const descDiv = document.createElement('div');
    descDiv.className = 'task-description';
    if (task.description && task.description.trim()) {
        // Use innerHTML for synthetic Batch/Layout tasks to support <br> tags, textContent for others for safety
        if (task.isSynthetic && RENDERING.shouldUseHtmlDescription(task.department)) {
            descDiv.innerHTML = sanitizeDescription(task.description);
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
        detailsDiv.dataset.taskId = task.id; // For updating later
        detailsDiv.innerHTML = buildTaskDetailsHTML(task);
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
 * @param {boolean} [isEditingUnlocked] - Whether editing is unlocked (falls back to state if omitted)
 * @returns {HTMLElement} Placeholder element
 */
export function createTaskCardPlaceholder(department, dateString, weekString, rowClass, isEditingUnlocked) {
    if (isEditingUnlocked === undefined) isEditingUnlocked = getIsEditingUnlocked();

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
export { normalizeDepartmentClass } from '../config/department-config.js';
