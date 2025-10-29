/**
 * Context Menu Module
 * Handles left-click context menu on task cards
 * @module features/context-menu/context-menu
 */

import { getAllTasks } from '../../core/state.js';

// Private state
let currentTask = null;

/**
 * Show context menu at specified position
 * @param {number} x - X coordinate (viewport)
 * @param {number} y - Y coordinate (viewport)
 */
function showContextMenu(x, y) {
    const contextMenu = document.getElementById('context-menu');

    // Position is fixed, so use viewport coordinates directly
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    contextMenu.style.display = 'block';

    // Force a reflow to get accurate dimensions
    contextMenu.offsetHeight;

    // Adjust position if menu goes outside viewport
    const rect = contextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        contextMenu.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
        contextMenu.style.top = `${y - rect.height}px`;
    }
}

/**
 * Hide context menu
 */
function hideContextMenu() {
    const contextMenu = document.getElementById('context-menu');
    contextMenu.style.display = 'none';
    currentTask = null;
}

/**
 * Handle context menu on task card (left-click)
 * @param {MouseEvent} e - Mouse event
 * @private
 */
function handleContextMenu(e) {
    if (!(e.target instanceof Element)) return;

    const taskCard = e.target.closest('.task-card');
    const deleteBtn = e.target.closest('.task-delete-btn');
    const editBtn = e.target.closest('.task-edit-btn');
    const planBtn = e.target.closest('.task-plan-btn');
    const editActions = e.target.closest('.edit-actions');

    // Don't show context menu on buttons or edit actions
    if (deleteBtn || editBtn || planBtn || editActions) {
        return;
    }

    if (taskCard) {
        // Don't show context menu if inside the build plan modal or if editing
        const projectModal = document.getElementById('project-modal');
        if (projectModal && projectModal.classList.contains('show')) {
            return;
        }
        if (taskCard.classList.contains('editing')) {
            return;
        }

        // Don't interfere with text selection
        if (window.getSelection().toString().length > 0) {
            return;
        }

        const allTasks = getAllTasks();
        currentTask = taskCard.dataset.taskId
            ? allTasks.find(t => t.id === taskCard.dataset.taskId)
            : null;

        if (currentTask) {
            // Adjust for 80% zoom on body element
            showContextMenu(e.clientX / 0.8, e.clientY / 0.8);
        }
        return; // Prevent the hide handler from running
    }

    // Hide menu if click is outside task card and outside menu
    const contextMenu = document.getElementById('context-menu');
    if (!contextMenu.contains(e.target)) {
        hideContextMenu();
    }
}

/**
 * Handle context menu item clicks
 * @param {MouseEvent} e - Mouse event
 * @private
 */
async function handleContextMenuClick(e) {
    if (!(e.target instanceof Element)) return;

    const menuItem = e.target.closest('.context-menu-item');
    const action = menuItem && menuItem.dataset.action;

    if (action === 'build-plan' && currentTask) {
        // Use the global showProjectModal function which handles initialization
        if (window.showProjectModal) {
            await window.showProjectModal(currentTask.project);
        } else {
            console.error('showProjectModal is not available');
        }
    }

    hideContextMenu();
}

/**
 * Handle keyboard shortcuts for context menu
 * @param {KeyboardEvent} e - Keyboard event
 * @private
 */
function handleContextMenuKeyboard(e) {
    // Context menu key (93) or Shift+F10
    if (e.keyCode === 93 || (e.shiftKey && e.key === 'F10')) {
        if (!(e.target instanceof Element)) return;

        const taskCard = e.target.closest('.task-card');
        if (taskCard) {
            const projectModal = document.getElementById('project-modal');
            if (projectModal && projectModal.classList.contains('show')) {
                return;
            }

            e.preventDefault();

            const allTasks = getAllTasks();
            currentTask = taskCard.dataset.taskId
                ? allTasks.find(t => t.id === taskCard.dataset.taskId)
                : null;

            if (currentTask) {
                const rect = taskCard.getBoundingClientRect();
                // Adjust for 80% zoom on body element
                const x = (rect.left + rect.width / 2) / 0.8;
                const y = (rect.top + rect.height / 2) / 0.8;
                showContextMenu(x, y);
            }
        }
    }

    // Hide menu on Escape key
    if (e.key === 'Escape') {
        hideContextMenu();
    }
}

/**
 * Initialize context menu module
 * Sets up all event listeners for left-click context menu
 */
export function initializeContextMenu() {
    console.log('Initializing context menu...');

    // Left-click handler - show menu when clicking on task cards
    document.addEventListener('click', handleContextMenu);

    // Context menu item click handler
    const contextMenu = document.getElementById('context-menu');
    if (contextMenu) {
        contextMenu.addEventListener('click', handleContextMenuClick);
    }

    // Keyboard support
    document.addEventListener('keydown', handleContextMenuKeyboard);

    console.log('Context menu initialized');
}

/**
 * Get current task (for debugging)
 * @returns {Object|null} Current task object
 */
export function getCurrentTask() {
    return currentTask;
}
