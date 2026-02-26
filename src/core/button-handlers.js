/**
 * Button Handlers Module
 * Manages all button click event listeners and delegated events
 * @module core/button-handlers
 *
 * @claude-context
 * @purpose Centralized event listener setup for UI buttons and interactions
 * @dependencies state, data-service, error-handler, modal-loader, task-card-editor
 * @used-by app-controller
 * @exports initializeButtonHandlers
 * @modifies Attaches event listeners to buttons and document
 */

import * as state from './state.js';
import * as errorHandler from './error-handler.js';
import * as supabaseService from '../services/supabase-service.js';
import * as dataService from '../services/data-service.js';
import { clearCache } from '../services/sheets-cache-service.js';
import { showLoading, hideError, showSuccessNotification } from '../utils/ui-utils.js';
import { loadAddTaskModal, loadProjectModal, loadPrintModal } from './modal-loader.js';
import { showPasswordModal, lockEditing } from '../components/modals/password-modal.js';
import { makeTaskCardEditable } from './task-card-editor.js';

import { logger } from '../utils/logger.js';

let isRefreshing = false;

/**
 * Initialize button event handlers
 * Sets up all click listeners for buttons and interactive elements
 */
export function initializeButtonHandlers() {
    logger.info('🔌 Wiring up button event listeners...');

    // Refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            if (isRefreshing) return;
            isRefreshing = true;
            try {
                showLoading();

                // Invalidate cache to force fresh data fetch
                logger.info('🗑️ Invalidating caches for manual refresh...');
                await Promise.all([
                    clearCache('tasks'),
                    clearCache('staging')
                ]);
                logger.info('✅ Caches invalidated, fetching fresh data...');

                await dataService.fetchAllTasks();
                hideError();
                showSuccessNotification('Data refreshed successfully!');

                // Send refresh signal to all other clients
                await supabaseService.sendRefreshSignal({
                    action: 'manual_refresh',
                    source: 'refresh_button'
                });
            } catch (error) {
                logger.error('Failed to refresh data:', error);
                errorHandler.handleError(error, {
                    operation: 'Data refresh',
                    retry: () => refreshBtn.click()
                });
            } finally {
                isRefreshing = false;
            }
        });
    }

    // Print button (lazy loaded)
    const printBtn = document.getElementById('print-btn');
    if (printBtn) {
        printBtn.addEventListener('click', async () => {
            const module = await loadPrintModal();
            module.showPrintModal();
        });
    }

    // Main editing button
    const mainEditingBtn = document.getElementById('main-editing-btn');
    if (mainEditingBtn) {
        mainEditingBtn.addEventListener('click', () => {
            const isUnlocked = state.getIsEditingUnlocked();
            if (isUnlocked) {
                lockEditing();
            } else {
                showPasswordModal();
            }
        });
    }

    // FAB add task button (lazy loaded)
    const fabAddTask = document.getElementById('fab-add-task');
    if (fabAddTask) {
        fabAddTask.addEventListener('click', async () => {
            const module = await loadAddTaskModal();
            module.openAddTaskModal({});
        });
    }

    // Fullscreen button
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        });
    }

    // Consolidated event delegation for task card interactions
    document.addEventListener('click', async (e) => {
        // Plan button - show project modal
        const planBtn = e.target.closest('.task-plan-btn');
        if (planBtn) {
            const taskId = planBtn.dataset.taskId;
            const allTasks = state.getAllTasks();
            const task = allTasks.find(t => t.id === taskId);
            if (task) {
                const module = await loadProjectModal();
                module.showProjectModal(task.project);
            }
            return;
        }

        // Edit button - make card editable inline
        const editBtn = e.target.closest('.task-edit-btn');
        if (editBtn) {
            const taskCard = editBtn.closest('.task-card');
            if (taskCard && !taskCard.classList.contains('editing')) {
                makeTaskCardEditable(taskCard);
            }
            return;
        }

        // Placeholder cell - click to add task
        const placeholder = e.target.closest('.task-card-placeholder');
        if (placeholder) {
            const isEditingUnlocked = state.getIsEditingUnlocked();
            if (!isEditingUnlocked) return;

            const department = placeholder.dataset.department;
            const date = placeholder.dataset.date;
            const week = placeholder.dataset.week;

            const module = await loadAddTaskModal();
            module.openAddTaskModal({ department, date, week });
        }
    });

    logger.info('✅ Button event listeners initialized');
}
