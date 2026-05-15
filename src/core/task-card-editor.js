/**
 * Task Card Editor Module
 * Handles inline editing of task cards
 * @module core/task-card-editor
 *
 * @claude-context
 * @purpose Provides inline editing functionality for task cards
 * @dependencies state, error-handler, supabase-service, sheets-service
 * @used-by app-controller (button handlers)
 * @exports makeTaskCardEditable, saveTaskCardEdit, cancelTaskCardEdit
 * @modifies Task card DOM, updates backend via sheets-service
 */

import * as state from './state.js';
import * as errorHandler from './error-handler.js';
import * as supabaseService from '../services/supabase-service.js';
import { showSuccessNotification } from '../utils/ui-utils.js';
import { startEditing, endEditing } from './refresh-queue.js';
import { logger } from '../utils/logger.js';
/**
 * Make a task card editable inline
 * @param {HTMLElement} taskCard - Task card element to make editable
 */
export function makeTaskCardEditable(taskCard) {
    if (!taskCard) return;

    // Mark card as editing
    taskCard.classList.add('editing');

    // Notify refresh queue that editing has started
    const taskId = taskCard.dataset.taskId;
    if (taskId) {
        startEditing(taskId);
    }

    // Get task description element
    const descDiv = taskCard.querySelector('.task-description');
    if (!descDiv) return;

    // Store original value
    const originalValue = descDiv.textContent.trim() === 'Staging Missing' ? '' : descDiv.textContent.trim();
    taskCard.dataset.originalDescription = originalValue;

    // Replace with textarea
    const textarea = document.createElement('textarea');
    textarea.className = 'edit-description';
    textarea.value = originalValue;
    textarea.placeholder = 'Enter task description...';
    descDiv.replaceWith(textarea);

    // Casting side dropdown — only for Cast-department tasks. Inserted above
    // the description textarea; stored separately on the task_descriptions row.
    const task = state.getAllTasks().find(t => t.id === taskId);
    if (task && task.department === 'Cast') {
        const originalSide = (task.castingSide === 'A' || task.castingSide === 'B') ? task.castingSide : '';
        taskCard.dataset.originalCastingSide = originalSide;

        const sideSelect = document.createElement('select');
        sideSelect.className = 'edit-casting-side';
        sideSelect.title = 'Casting side';
        [
            { value: '', label: 'No side' },
            { value: 'A', label: 'Side A' },
            { value: 'B', label: 'Side B' }
        ].forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = opt.label;
            if (originalSide === opt.value) o.selected = true;
            sideSelect.appendChild(o);
        });
        textarea.before(sideSelect);
    }

    textarea.focus();

    // Hide the existing Edit and Plan buttons
    const editBtn = taskCard.querySelector('.task-edit-btn');
    const planBtn = taskCard.querySelector('.task-plan-btn');
    if (editBtn) editBtn.style.display = 'none';
    if (planBtn) planBtn.style.display = 'none';

    // Create edit action buttons container
    const editActions = document.createElement('div');
    editActions.className = 'edit-actions';

    // Create Save button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'edit-save-btn';
    saveBtn.textContent = 'Save';
    saveBtn.title = 'Save changes (Ctrl+Enter)';
    saveBtn.onclick = (e) => {
        e.stopPropagation();
        saveTaskCardEdit(taskCard);
    };

    // Create Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'edit-cancel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.title = 'Cancel editing (Esc)';
    cancelBtn.onclick = (e) => {
        e.stopPropagation();
        cancelTaskCardEdit(taskCard);
    };

    editActions.appendChild(saveBtn);
    editActions.appendChild(cancelBtn);
    taskCard.appendChild(editActions);

    // Handle save on Enter (Ctrl+Enter for new line)
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            saveTaskCardEdit(taskCard);
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            cancelTaskCardEdit(taskCard);
        }
    });
}

/**
 * Save inline task card edits
 * @param {HTMLElement} taskCard - Task card being edited
 */
export async function saveTaskCardEdit(taskCard) {
    if (!taskCard) return;

    const textarea = taskCard.querySelector('.edit-description');
    const sideSelect = taskCard.querySelector('.edit-casting-side');
    const taskId = taskCard.dataset.taskId;
    const newDescription = textarea ? textarea.value.trim() : '';
    // sideSelect only exists for Cast-department tasks. Empty string -> null
    // means "no side selected" (clears the column).
    const newCastingSide = sideSelect ? (sideSelect.value || null) : undefined;

    try {
        // Update task in state
        const allTasks = state.getAllTasks();
        const task = allTasks.find(t => t.id === taskId);

        if (task) {
            task.description = newDescription;
            if (newCastingSide !== undefined) {
                task.castingSide = newCastingSide;
            }

            // Save to backend
            if (task.isManual) {
                await supabaseService.updateManualTask(task);
            } else {
                // Save to staging sheet (cache invalidation happens automatically in saveToStaging)
                const { saveToStaging } = await import('../services/sheets-service.js');
                const entry = { task: task, newText: newDescription };
                if (newCastingSide !== undefined) entry.castingSide = newCastingSide;
                await saveToStaging(task.project, [entry]);
            }

            // Send refresh signal to other clients
            await supabaseService.sendRefreshSignal({
                operation: 'task_description_update',
                taskId: taskId,
                project: task.project
            });

            // Show success notification
            showSuccessNotification('Task updated successfully!');
        }

        // Restore normal view (passes the freshly-saved side so the badge updates
        // in place — without this the card still shows the pre-edit value until
        // a full re-render).
        restoreTaskCardView(taskCard, newDescription, newCastingSide);

    } catch (error) {
        logger.error('Failed to save task:', error);
        errorHandler.handleError(error, {
            operation: 'Save task edit',
            retry: () => saveTaskCardEdit(taskCard)
        });
    }
}

/**
 * Cancel inline task card edits
 * @param {HTMLElement} taskCard - Task card being edited
 */
export function cancelTaskCardEdit(taskCard) {
    if (!taskCard) return;

    const originalDescription = taskCard.dataset.originalDescription || '';
    restoreTaskCardView(taskCard, originalDescription);
}

/**
 * Restore task card to normal view after editing
 * @param {HTMLElement} taskCard - Task card to restore
 * @param {string} description - Description text to display
 * @param {string|null|undefined} [castingSide] - Newly-saved side ('A' / 'B' / null
 *   to clear). Pass `undefined` (default) when restoring without persisting — the
 *   existing badge is left alone, which is what we want for the cancel path.
 */
function restoreTaskCardView(taskCard, description, castingSide) {
    if (!taskCard) return;

    taskCard.classList.remove('editing');

    // Notify refresh queue that editing has ended
    const taskId = taskCard.dataset.taskId;
    if (taskId) {
        endEditing(taskId);
    }

    // Restore description
    const textarea = taskCard.querySelector('.edit-description');
    if (textarea) {
        const descDiv = document.createElement('div');
        descDiv.className = 'task-description';
        if (description && description.trim()) {
            descDiv.textContent = description;
        } else {
            descDiv.innerHTML = '<span class="missing-description">Staging Missing</span>';
        }
        textarea.replaceWith(descDiv);
    }

    // Remove casting-side dropdown (only present for Cast tasks)
    const sideSelect = taskCard.querySelector('.edit-casting-side');
    if (sideSelect) sideSelect.remove();

    // Sync the visible side badge with the freshly-saved value. Skipped on
    // cancel (castingSide === undefined) so we leave the existing badge alone.
    if (castingSide !== undefined) {
        let badge = taskCard.querySelector('.task-casting-side');
        const wantBadge = castingSide === 'A' || castingSide === 'B';
        if (wantBadge) {
            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'task-casting-side';
                const anchor = taskCard.querySelector('.task-cast-number')
                    || taskCard.querySelector('.task-title');
                if (anchor) {
                    anchor.after(badge);
                } else {
                    taskCard.prepend(badge);
                }
            }
            badge.textContent = `Side ${castingSide}`;
        } else if (badge) {
            badge.remove();
        }
    }

    // Remove edit actions container
    const editActions = taskCard.querySelector('.edit-actions');
    if (editActions) {
        editActions.remove();
    }

    // Restore original Edit and Plan buttons
    const editBtn = taskCard.querySelector('.task-edit-btn');
    const planBtn = taskCard.querySelector('.task-plan-btn');
    if (editBtn) editBtn.style.display = '';
    if (planBtn) planBtn.style.display = '';

    // Clean up
    delete taskCard.dataset.originalDescription;
    delete taskCard.dataset.originalCastingSide;
}
