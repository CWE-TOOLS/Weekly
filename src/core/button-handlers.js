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
import { loadAddTaskModal, loadProjectModal, loadPrintModal, loadRevenueModal } from './modal-loader.js';
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
                showLoading(true);
                hideError();

                // Invalidate cache to force fresh data fetch
                logger.info('🗑️ Invalidating caches for manual refresh...');
                await Promise.all([
                    clearCache('tasks'),
                    clearCache('staging')
                ]);
                logger.info('✅ Caches invalidated, fetching fresh data...');

                await dataService.fetchAllTasks();
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
                showLoading(false);
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

    // Batch tickets for the week on screen (user 2026-10-30): hand the week's Cast cards to week-batch-print.html
    const weekBatchBtn = document.getElementById('week-batch-btn');
    if (weekBatchBtn) {
        weekBatchBtn.addEventListener('click', () => {
            const monday = state.getCurrentWeekDate();
            if (!monday) return;
            const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const start = new Date(monday); start.setHours(0, 0, 0, 0);
            const end = new Date(start); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999);
            const items = [];
            for (const t of state.getAllTasks()) {
                if (t.isManual || String(t.department || '') !== 'Cast') continue;
                const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(t.date || '').trim());
                if (!m) continue;
                const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
                if (d < start || d > end) continue;
                const pn = String(t.projectNumber || '').trim(), cn = String(t.castingNumber || '').trim();
                if (!pn || !cn || items.some(i => i.projectNumber === pn && i.castingNumber === cn)) continue;
                items.push({ projectNumber: pn, castingNumber: cn, date: t.date, projectName: t.resolvedProjectName || t.project || '' });
            }
            if (!items.length) { alert('No castings with a job and cast number are scheduled to cast in this week.'); return; }
            try { sessionStorage.setItem('weekBatchPrint:' + iso(start), JSON.stringify(items)); } catch (_) { /* the page falls back to the scheduler's rows */ }
            window.open('week-batch-print.html?week=' + iso(start), '_blank');
        });
    }

    // Revenue button (lazy loaded)
    const revenueBtn = document.getElementById('revenue-btn');
    if (revenueBtn) {
        revenueBtn.addEventListener('click', async () => {
            const module = await loadRevenueModal();
            module.showRevenueModal();
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
