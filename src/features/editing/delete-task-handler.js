/**
 * Delete Task Handler Module
 * Handles task deletion with confirmation
 * @module features/editing/delete-task-handler
 */

import { deleteTaskFromSupabase, sendRefreshSignal } from '../../services/supabase-service.js';
import { fetchAllTasks } from '../../services/data-service.js';
import { showSuccessNotification } from '../../utils/ui-utils.js';

/**
 * Handle task deletion
 * @param {string} taskId - Task ID to delete
 * @param {string} taskName - Task name for confirmation dialog
 * @private
 */
async function handleTaskDelete(taskId, taskName) {
    try {
        // Delete from Supabase
        await deleteTaskFromSupabase(taskId);

        // Send refresh signal to all clients
        await sendRefreshSignal({
            action: 'task_deleted',
            taskId: taskId
        });

        // Refresh the tasks
        await fetchAllTasks();

        showSuccessNotification('Task deleted successfully!');
    } catch (error) {
        console.error('Failed to delete task:', error);
        showSuccessNotification('Failed to delete task.', true);
    }
}

/**
 * Handle delete button clicks
 * @param {MouseEvent} e - Click event
 * @private
 */
function handleDeleteClick(e) {
    if (!(e.target instanceof Element)) return;

    const deleteBtn = e.target.closest('.task-delete-btn');
    if (!deleteBtn) return;

    e.preventDefault();

    const taskId = deleteBtn.dataset.taskId;
    const taskCard = deleteBtn.closest('.task-card');
    const taskTitleEl = taskCard && taskCard.querySelector('.task-title');
    const taskName = taskTitleEl ? taskTitleEl.textContent || 'this task' : 'this task';

    // Confirm deletion
    if (confirm(`Are you sure you want to delete "${taskName}"? This action cannot be undone.`)) {
        handleTaskDelete(taskId, taskName);
    }
}

/**
 * Initialize delete task handler
 * Sets up click listener for delete buttons
 */
export function initializeDeleteHandler() {
    console.log('Initializing delete task handler...');

    // Click handler for delete buttons
    document.addEventListener('click', handleDeleteClick);

    console.log('Delete task handler initialized');
}
