/**
 * Drag & Drop Manager Module
 * Handles drag and drop functionality for moving tasks between dates
 * @module features/drag-drop/drag-drop-manager
 */

import { getAllTasks } from '../../core/state.js';
import { updateTaskInSupabase, sendRefreshSignal } from '../../services/supabase-service.js';
import { fetchAllTasks } from '../../services/data-service.js';
import { showSuccessNotification } from '../../utils/ui-utils.js';

// Private state
let draggedTask = null;
let dragGhost = null;

/**
 * Handle dragstart event - task starts being dragged
 * @param {DragEvent} e - Drag event
 * @private
 */
function handleDragStart(e) {
    if (!(e.target instanceof Element)) return;

    const taskCard = e.target.closest('.task-card[draggable="true"]');
    if (!taskCard) return;

    const allTasks = getAllTasks();
    draggedTask = taskCard.dataset.taskId
        ? allTasks.find(t => t.id === taskCard.dataset.taskId)
        : null;

    if (!draggedTask) return;

    e.dataTransfer.setData('text/plain', draggedTask.id);
    e.dataTransfer.effectAllowed = 'move';

    // Create a custom drag image
    dragGhost = taskCard.cloneNode(true);
    dragGhost.classList.add('dragging');
    dragGhost.style.position = 'absolute';
    dragGhost.style.top = '-1000px';
    dragGhost.style.left = '-1000px';
    dragGhost.style.width = taskCard.offsetWidth + 'px';
    dragGhost.style.height = taskCard.offsetHeight + 'px';
    dragGhost.style.opacity = '0.9';
    dragGhost.style.pointerEvents = 'none';
    dragGhost.style.transform = 'rotate(2deg)'; // Subtle rotation for visual feedback
    document.body.appendChild(dragGhost);
    e.dataTransfer.setDragImage(dragGhost, e.offsetX, e.offsetY);

    taskCard.style.opacity = '0.3';
    taskCard.classList.add('dragging');

    // Add dragging-active class to body for visual feedback
    document.body.classList.add('dragging-active');
}

/**
 * Handle dragend event - cleanup after drag
 * @param {DragEvent} e - Drag event
 * @private
 */
function handleDragEnd(e) {
    if (!(e.target instanceof Element)) return;

    const taskCard = e.target.closest('.task-card[draggable="true"]');
    if (taskCard) {
        taskCard.style.opacity = '1';
        taskCard.classList.remove('dragging');
    }

    // Remove drag ghost
    if (dragGhost && dragGhost.parentNode) {
        dragGhost.parentNode.removeChild(dragGhost);
        dragGhost = null;
    }

    // Remove dragging visual indicators
    document.body.classList.remove('dragging-active');
    document.querySelectorAll('.task-card-placeholder.drag-over, .task-card-placeholder.drag-invalid').forEach(el => {
        el.classList.remove('drag-over', 'drag-invalid');
    });

    draggedTask = null;
}

/**
 * Handle dragover event - visual feedback on drop zones
 * @param {DragEvent} e - Drag event
 * @private
 */
function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Provide visual feedback on drop zones
    if (!(e.target instanceof Element)) return;

    const dropTarget = e.target.closest('.task-card-placeholder');
    if (dropTarget && draggedTask) {
        const placeholder = dropTarget;
        const isValidDrop = placeholder.dataset.department === draggedTask.department;

        // Remove previous highlights
        document.querySelectorAll('.task-card-placeholder.drag-over, .task-card-placeholder.drag-invalid').forEach(el => {
            el.classList.remove('drag-over', 'drag-invalid');
        });

        // Add current highlight
        if (isValidDrop) {
            placeholder.classList.add('drag-over');
        } else {
            placeholder.classList.add('drag-invalid');
        }
    }
}

/**
 * Handle dragleave event - remove highlights when leaving drop zone
 * @param {DragEvent} e - Drag event
 * @private
 */
function handleDragLeave(e) {
    // Only remove highlight if actually leaving the drop zone
    if (!(e.target instanceof Element)) return;

    const relatedTarget = e.relatedTarget;
    const placeholder = e.target.closest('.task-card-placeholder');

    if (placeholder && relatedTarget instanceof Element) {
        const isLeavingDropZone = !placeholder.contains(relatedTarget) &&
                                  !relatedTarget.closest('.task-card-placeholder');

        if (isLeavingDropZone) {
            placeholder.classList.remove('drag-over', 'drag-invalid');
        }
    }
}

/**
 * Handle drop event - move task to new date
 * @param {DragEvent} e - Drag event
 * @private
 */
async function handleDrop(e) {
    e.preventDefault();

    if (!draggedTask) return;

    if (!(e.target instanceof Element)) return;

    const dropTarget = e.target.closest('.task-card-placeholder');
    if (!dropTarget) return;

    const newDate = dropTarget.dataset.date;
    const newWeek = dropTarget.dataset.week;
    const department = dropTarget.dataset.department;

    // Store task ID before draggedTask gets nulled by handleDragEnd
    const taskId = draggedTask.id;

    // Only allow dropping if department matches
    if (department !== draggedTask.department) {
        showSuccessNotification('Cannot move task to different department', true);
        return;
    }

    // Only allow dropping if date is different
    if (newDate === draggedTask.date) {
        showSuccessNotification('Task is already on this date', true);
        return;
    }

    try {
        // Show loading state on original card
        const originalCard = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
        if (originalCard) {
            originalCard.style.opacity = '0.5';
            originalCard.style.pointerEvents = 'none';
        }

        // Update task locally
        draggedTask.date = newDate;
        draggedTask.week = newWeek;

        // Save to Supabase
        let supabaseSuccess = false;
        try {
            await updateTaskInSupabase(draggedTask);
            supabaseSuccess = true;
        } catch (supabaseError) {
            console.error('Supabase update failed:', supabaseError);
            // Don't throw here - we want to continue with refresh signal
        }

        // Send refresh signal to all clients (don't fail the whole operation if this fails)
        try {
            await sendRefreshSignal({
                action: 'task_moved',
                taskId: draggedTask.id,
                newDate: newDate,
                department: department
            });
        } catch (signalError) {
            console.error('Refresh signal failed:', signalError);
            // Continue - this is not critical
        }

        // Refresh local data
        await fetchAllTasks();

        // Show appropriate success message
        if (supabaseSuccess) {
            showSuccessNotification('Task moved successfully!');
        } else {
            showSuccessNotification('Task moved locally. Sync to server may have failed.', true);
        }

        // Trigger success animation on the newly rendered card
        setTimeout(() => {
            const newCard = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
            if (newCard) {
                newCard.classList.add('drop-success');
                setTimeout(() => newCard.classList.remove('drop-success'), 300);
            }
        }, 50);

    } catch (error) {
        console.error('Failed to move task:', error);
        showSuccessNotification('Failed to move task', true);

        // Restore original card if save failed
        const originalCard = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
        if (originalCard) {
            originalCard.style.opacity = '1';
            originalCard.style.pointerEvents = 'auto';
        }
    }
}

/**
 * Add drag tooltip on hover
 * @param {MouseEvent} e - Mouse event
 * @private
 */
function handleMouseEnter(e) {
    if (!(e.target instanceof Element)) return;

    const taskCard = e.target.closest('.task-card[draggable="true"]');
    if (taskCard && !document.body.classList.contains('dragging-active')) {
        taskCard.title = 'Drag to move to different date';
    }
}

/**
 * Remove drag tooltip on mouse leave
 * @param {MouseEvent} e - Mouse event
 * @private
 */
function handleMouseLeave(e) {
    if (!(e.target instanceof Element)) return;

    const taskCard = e.target.closest('.task-card[draggable="true"]');
    if (taskCard) {
        taskCard.title = '';
    }
}

/**
 * Initialize drag and drop functionality
 * Sets up all drag event listeners
 */
export function initializeDragDrop() {
    console.log('Initializing drag and drop...');

    // Drag event listeners
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('dragend', handleDragEnd);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);

    // Tooltip event listeners
    document.addEventListener('mouseenter', handleMouseEnter, true);
    document.addEventListener('mouseleave', handleMouseLeave, true);

    console.log('Drag and drop initialized');
}

/**
 * Get currently dragged task (for debugging)
 * @returns {Object|null} Dragged task object
 */
export function getDraggedTask() {
    return draggedTask;
}
