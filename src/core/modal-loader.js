/**
 * Modal Loader Module
 * Manages lazy loading and initialization of modal components
 * @module core/modal-loader
 *
 * @claude-context
 * @purpose Centralized lazy loading for modal components (Phase 9 optimization)
 * @dependencies lazy-loader, modal components
 * @used-by app-controller
 * @exports Modal loading functions and preload utilities
 * @modifies Initializes modals on-demand, preloads on idle
 */

import { lazyLoad, preloadOnIdle } from '../utils/lazy-loader.js';
import { RENDER_DELAY } from '../config/timing-constants.js';

import { logger } from '../utils/logger.js';
// Track which modules have been initialized (ES6 modules are not extensible)
const initializedModals = new Set();

/**
 * Lazy load and initialize password modal
 * @returns {Promise<Object>} Password modal module
 */
export async function loadPasswordModal() {
    const module = await lazyLoad(
        () => import('../components/modals/password-modal.js'),
        'password-modal'
    );
    // Initialize once on first load
    if (!initializedModals.has('password-modal')) {
        module.initializePasswordModal();
        initializedModals.add('password-modal');
    }
    return module;
}

/**
 * Lazy load and initialize add task modal
 * @returns {Promise<Object>} Add task modal module
 */
export async function loadAddTaskModal() {
    const module = await lazyLoad(
        () => import('../components/modals/add-task-modal.js'),
        'add-task-modal'
    );
    if (!initializedModals.has('add-task-modal')) {
        module.initializeAddTaskModal();
        initializedModals.add('add-task-modal');
    }
    return module;
}

/**
 * Lazy load and initialize project modal
 * @returns {Promise<Object>} Project modal module
 */
export async function loadProjectModal() {
    const module = await lazyLoad(
        () => import('../components/modals/project-modal.js'),
        'project-modal'
    );
    if (!initializedModals.has('project-modal')) {
        const success = module.initializeProjectModal();
        if (success !== false) {
            initializedModals.add('project-modal');
        } else {
            logger.error('Failed to initialize project modal - DOM elements not found');
        }
    }
    return module;
}

/**
 * Lazy load and initialize print modal
 * @returns {Promise<Object>} Print modal module
 */
export async function loadPrintModal() {
    const module = await lazyLoad(
        () => import('../components/modals/print-modal.js'),
        'print-modal'
    );
    if (!initializedModals.has('print-modal')) {
        module.initializePrintModal();
        initializedModals.add('print-modal');
    }
    return module;
}

/**
 * Show project modal (lazy loaded)
 * Exposed globally for context menu
 * @param {string} projectName - Project name
 */
export async function showProjectViewLazy(projectName) {
    const module = await loadProjectModal();
    module.showProjectView(projectName);
}

/**
 * Show add card modal (lazy loaded)
 * Exposed globally for add card indicators
 * @param {Object} data - Modal data
 */
export async function showAddCardModalLazy(data) {
    const module = await loadAddTaskModal();
    module.showAddCardModal(data);
}

/**
 * Lazy load and initialize context menu
 * @returns {Promise<Object>} Context menu module
 */
export async function loadContextMenu() {
    const module = await lazyLoad(
        () => import('../features/context-menu/context-menu.js'),
        'context-menu'
    );
    if (!initializedModals.has('context-menu')) {
        module.initializeContextMenu();
        initializedModals.add('context-menu');
    }
    return module;
}

/**
 * Lazy load and initialize drag-drop manager
 * @returns {Promise<Object>} Drag-drop module
 */
export async function loadDragDrop() {
    const module = await lazyLoad(
        () => import('../features/drag-drop/drag-drop-manager.js'),
        'drag-drop'
    );
    if (!initializedModals.has('drag-drop')) {
        module.initializeDragDrop();
        initializedModals.add('drag-drop');
    }
    return module;
}

/**
 * Preload features on browser idle time (Phase 9)
 * Loads modals and features in background for better perceived performance
 */
export function preloadFeaturesOnIdle() {
    logger.info('🔮 Scheduling feature preload on idle...');

    preloadOnIdle([
        {
            importer: () => import('../components/modals/password-modal.js'),
            key: 'password-modal'
        },
        {
            importer: () => import('../components/modals/print-modal.js'),
            key: 'print-modal'
        },
        {
            importer: () => import('../components/modals/project-modal.js'),
            key: 'project-modal'
        },
        {
            importer: () => import('../components/modals/add-task-modal.js'),
            key: 'add-task-modal'
        },
        {
            importer: () => import('../features/context-menu/context-menu.js'),
            key: 'context-menu'
        },
        {
            importer: () => import('../features/drag-drop/drag-drop-manager.js'),
            key: 'drag-drop'
        }
    ], RENDER_DELAY.MODAL_LOADER);
}

/**
 * Expose lazy modal functions globally
 * Required for backward compatibility
 */
export function exposeModalFunctionsGlobally() {
    if (typeof window !== 'undefined') {
        window.showProjectView = showProjectViewLazy;
        window.showAddCardModal = showAddCardModalLazy;
    }
}
