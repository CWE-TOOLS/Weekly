/**
 * Drag & Drop Manager Module
 * Handles drag and drop functionality for moving tasks between dates
 * @module features/drag-drop/drag-drop-manager
 *
 * @claude-context
 * @purpose Enable drag-and-drop of task cards to move tasks between dates/departments
 * @dependencies state.js, supabase-service.js, data-service.js, ui-utils.js
 * @used-by app-controller.js (registered in Phase 5)
 * @exports initializeDragDrop function
 * @modifies Task dates/departments in Supabase, DOM (task card positions)
 * @events-emitted task-moved, task-drop-success, task-drop-error
 * @events-listened None (handles DOM drag events directly)
 * @key-functions
 *   - initializeDragDrop() - Attach drag/drop event listeners
 *   - handleDragStart() - Store dragged task reference
 *   - handleDragOver() - Show drop zone indicators (IMMEDIATE feedback)
 *   - handleDrop() - Update task and save to database
 * @drag-drop-flow
 *   1. User starts dragging task card (dragstart)
 *   2. Highlight drop zones immediately as mouse moves (dragover)
 *   3. On drop, extract target date from cell dataset
 *   4. Update task in Supabase
 *   5. Refresh data and re-render grid
 *   6. Show success notification
 * @visual-feedback
 *   - Immediate drop zone highlighting (no delays)
 *   - Success/error notifications
 * @performance
 *   - Removed RAF throttling for instant feedback
 *   - Removed custom drag ghost creation
 *   - Removed placeholder caching
 *   - Direct DOM manipulation for speed
 */

import { getAllTasks, getFilteredTasks } from '../../core/state.js';
import { updateTaskInSupabase, sendRefreshSignal } from '../../services/supabase-service.js';
import { fetchAllTasks } from '../../services/data-service.js';
import { showSuccessNotification, showError } from '../../utils/ui-utils.js';
import { OPACITY } from '../../config/visual-constants.js';
import { DRAG_DROP_TIMING } from '../../config/timing-constants.js';
import { render } from '../../core/renderer.js';
import { filterTasks } from '../../components/department-filter.js';
import { logger } from '../../utils/logger.js';

// Private state
let draggedTask = null;
let isInitialized = false;
let currentHighlightedElement = null;
let animationTimeoutIds = new Set(); // Track animation timeouts for cleanup

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

    // Apply immediate visual feedback
    taskCard.style.opacity = `${OPACITY.DRAGGING_CARD}`;
    taskCard.classList.add('dragging');
    document.body.classList.add('dragging-active');
}

/**
 * Comprehensive cleanup function for drag-drop operations
 * Removes all temporary visual state
 * Safe to call multiple times (idempotent)
 * @private
 */
function cleanupDragState() {
    draggedTask = null;
    currentHighlightedElement = null;
    document.body.classList.remove('dragging-active');

    // Remove all drag-over and drag-invalid classes from placeholders
    document.querySelectorAll('.task-card-placeholder.drag-over, .task-card-placeholder.drag-invalid').forEach(el => {
        el.classList.remove('drag-over', 'drag-invalid');
    });

    // Reset opacity and dragging class on any task cards that might still have them
    document.querySelectorAll('.task-card.dragging').forEach(card => {
        card.style.opacity = '1';
        card.classList.remove('dragging');
        card.style.pointerEvents = 'auto';
    });
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

    cleanupDragState();
}

/**
 * Handle dragover event - IMMEDIATE visual feedback on drop zones
 * No throttling - applies highlights instantly
 * @param {DragEvent} e - Drag event
 * @private
 */
function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (!draggedTask || !(e.target instanceof Element)) return;

    const dropTarget = e.target.closest('.task-card-placeholder');

    // Only update highlights when the target changes
    if (dropTarget && dropTarget !== currentHighlightedElement) {
        const isValidDrop = dropTarget.dataset.department === draggedTask.department;

        // Clear previous highlight if it exists
        if (currentHighlightedElement) {
            currentHighlightedElement.classList.remove('drag-over', 'drag-invalid');
        }

        // Apply immediate highlight to current target
        if (isValidDrop) {
            dropTarget.classList.add('drag-over');
        } else {
            dropTarget.classList.add('drag-invalid');
        }

        currentHighlightedElement = dropTarget;
    } else if (!dropTarget && currentHighlightedElement) {
        // Clear highlight if we're no longer over a valid drop target
        currentHighlightedElement.classList.remove('drag-over', 'drag-invalid');
        currentHighlightedElement = null;
    }
}

/**
 * Handle dragleave event - remove highlights when leaving drop zone
 * @param {DragEvent} e - Drag event
 * @private
 */
function handleDragLeave(e) {
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

    // Store task reference before draggedTask gets nulled by handleDragEnd
    const task = draggedTask;
    const taskId = task.id;

    // Only allow dropping if department matches
    if (department !== task.department) {
        showSuccessNotification('Cannot move task to different department', true);
        return;
    }

    // Only allow dropping if date is different
    if (newDate === task.date) {
        showSuccessNotification('Task is already on this date', true);
        return;
    }

    try {
        // Show loading state on original card
        const originalCard = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
        if (originalCard) {
            originalCard.style.opacity = `${OPACITY.CARD_PREVIEW}`;
            originalCard.style.pointerEvents = 'none';
        }

        // Store original values in case we need to revert
        const originalDate = task.date;
        const originalWeek = task.week;

        // Update task locally
        task.date = newDate;
        task.week = newWeek;

        console.log('=== DRAG-DROP: Task updated locally ===', {
            taskId: task.id,
            oldDate: originalDate,
            newDate: task.date,
            oldWeek: originalWeek,
            newWeek: task.week
        });

        // Save to Supabase
        try {
            await updateTaskInSupabase(task);
            logger.debug('Manual task updated successfully via drag-drop', { id: task.id, newDate, newWeek });
            console.log('=== DRAG-DROP: Supabase update succeeded ===', { taskId: task.id });
        } catch (supabaseError) {
            logger.error('Failed to update manual task in Supabase:', supabaseError);

            // Revert the local changes
            task.date = originalDate;
            task.week = originalWeek;

            // Show error to user
            showError('Failed to move task: ' + (supabaseError.message || 'Unknown error'));

            // Re-render to show task in original position
            render();

            // Restore original card state
            if (originalCard) {
                originalCard.style.opacity = '1';
                originalCard.style.pointerEvents = 'auto';
            }

            // Cleanup drag state
            cleanupDragState();
            return;
        }

        // Send refresh signal to all clients (don't fail the whole operation if this fails)
        try {
            await sendRefreshSignal({
                action: 'task_moved',
                taskId: task.id,
                newDate: newDate,
                department: department
            });
        } catch (signalError) {
            logger.error('Refresh signal failed:', signalError);
            // Continue - this is not critical
        }

        // Refresh local data
        await fetchAllTasks();

        console.log('=== DRAG-DROP: After fetchAllTasks ===');
        const allTasks = getAllTasks();
        const movedTask = allTasks.find(t => t.id === task.id);
        console.log('Moved task in _allTasks:', movedTask ? { id: movedTask.id, date: movedTask.date, week: movedTask.week } : 'NOT FOUND');

        // Update filtered tasks immediately to avoid race condition
        filterTasks();

        console.log('=== DRAG-DROP: After filterTasks ===');
        const filtered = getFilteredTasks();
        const filteredMovedTask = filtered.find(t => t.id === task.id);
        console.log('Moved task in _filteredTasks:', filteredMovedTask ? { id: filteredMovedTask.id, date: filteredMovedTask.date, week: filteredMovedTask.week } : 'NOT FOUND');

        // Force UI update to ensure the card appears in its new position
        render();

        // Show success message
        showSuccessNotification('Task moved successfully!');

        // Trigger success animation on the newly rendered card
        const outerTimeoutId = setTimeout(() => {
            const newCard = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
            if (newCard) {
                newCard.classList.add('drop-success');
                const innerTimeoutId = setTimeout(() => {
                    newCard.classList.remove('drop-success');
                    animationTimeoutIds.delete(innerTimeoutId);
                }, DRAG_DROP_TIMING.FEEDBACK);
                animationTimeoutIds.add(innerTimeoutId);
            }
            animationTimeoutIds.delete(outerTimeoutId);
        }, DRAG_DROP_TIMING.CLEANUP);
        animationTimeoutIds.add(outerTimeoutId);

    } catch (error) {
        logger.error('Failed to move task:', error);
        showSuccessNotification('Failed to move task', true);

        // Restore original card if save failed
        const originalCard = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
        if (originalCard) {
            originalCard.style.opacity = '1';
            originalCard.style.pointerEvents = 'auto';
        }

        // Cleanup drag state on error
        cleanupDragState();
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
 * Clean up all drag-drop event listeners and state
 * Prevents memory leaks by removing all attached event listeners
 * Should be called before re-initializing or when shutting down
 * @private
 */
function cleanup() {
    // Remove all drag event listeners
    document.removeEventListener('dragstart', handleDragStart);
    document.removeEventListener('dragend', handleDragEnd);
    document.removeEventListener('dragover', handleDragOver);
    document.removeEventListener('dragleave', handleDragLeave);
    document.removeEventListener('drop', handleDrop);

    // Remove tooltip event listeners
    document.removeEventListener('mouseenter', handleMouseEnter, true);
    document.removeEventListener('mouseleave', handleMouseLeave, true);

    // Clear any pending animation timeouts
    animationTimeoutIds.forEach(timeoutId => {
        clearTimeout(timeoutId);
    });
    animationTimeoutIds.clear();

    // Cleanup drag state
    cleanupDragState();

    isInitialized = false;
    logger.info('Drag and drop cleanup completed');
}

/**
 * Initialize drag and drop functionality
 * Sets up all drag event listeners
 * Prevents duplicate initialization to avoid memory leaks
 */
export function initializeDragDrop() {
    // Prevent duplicate initialization
    if (isInitialized) {
        logger.warn('Drag and drop already initialized, skipping...');
        return;
    }

    logger.info('Initializing drag and drop...');

    // Drag event listeners
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('dragend', handleDragEnd);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);

    // Tooltip event listeners
    document.addEventListener('mouseenter', handleMouseEnter, true);
    document.addEventListener('mouseleave', handleMouseLeave, true);

    isInitialized = true;
    logger.info('Drag and drop initialized');
}

/**
 * Destroy drag and drop functionality
 * Removes all event listeners and cleans up state
 * Use this when tearing down the application or for testing
 * @public
 */
export function destroyDragDrop() {
    logger.info('Destroying drag and drop...');
    cleanup();
}

/**
 * Get currently dragged task (for debugging)
 * @returns {Object|null} Dragged task object
 */
export function getDraggedTask() {
    return draggedTask;
}
