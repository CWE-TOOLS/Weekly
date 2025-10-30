/**
 * Application Controller
 * Manages app initialization, lifecycle, and coordination
 * @module core/app-controller
 *
 * @claude-context
 * @purpose Main orchestrator for 6-phase application initialization
 * @dependencies ALL modules (this is the central controller)
 * @used-by main.js (entry point calls initializeApp)
 * @exports initializeApp function
 * @modifies Initializes all systems, sets up DOM, registers event listeners
 * @events-emitted app-initialized, initialization-phase-*
 * @events-listened None (controller doesn't listen, it orchestrates)
 * @initialization-phases
 *   Phase 1: Error Handler - Set up global error handling
 *   Phase 2: State Restoration - Load cached state from localStorage
 *   Phase 3: Services - Initialize auth, sheets, supabase, data services
 *   Phase 4: UI Components - Initialize schedule, filters, navigation, search
 *   Phase 5: Features - Initialize drag-drop, context menu, editing features
 *   Phase 6: Data Loading - Fetch initial data and render
 * @key-functions
 *   - initializeApp() - Main entry point for app startup
 *   - initializeServices() - Phase 3 orchestration
 *   - initializeComponents() - Phase 4 orchestration
 *   - initializeFeatures() - Phase 5 orchestration
 * @phase9-optimization Implements lazy loading for modal components
 */

// Import core systems
import * as errorHandler from './error-handler.js';
import * as loadingManager from './loading-manager.js';
import * as globalListeners from './global-listeners.js';
import * as keyboardShortcuts from './keyboard-shortcuts.js';
import * as state from './state.js';
import * as eventBus from './event-bus.js';
import * as storage from './storage.js';
import * as performanceMonitor from './performance-monitor.js';
import * as offlineManager from './offline-manager.js';

// Import services
import * as authService from '../services/auth-service.js';
import * as sheetsService from '../services/sheets-service.js';
import * as supabaseService from '../services/supabase-service.js';
import * as dataService from '../services/data-service.js';

// Import UI components
import { renderAllWeeks, equalizeAllCardHeights, navigateToWeek } from '../components/schedule-grid.js';
import { initializeDepartmentFilter, filterTasks } from '../components/department-filter.js';
import { initializeWeekNavigation } from '../components/week-navigation.js';
import { initializeSearch } from '../components/search-bar.js';

// Modals will be lazy loaded (Phase 9 optimization)
// import { initializePasswordModal, showPasswordModal, lockEditing } from '../components/modals/password-modal.js';
// import { initializeAddTaskModal, openAddTaskModal, showAddCardModal } from '../components/modals/add-task-modal.js';
// import { initializeProjectModal, showProjectModal, showProjectView } from '../components/modals/project-modal.js';
// import { initializePrintModal, openPrintModal, showPrintModal } from '../components/modals/print-modal.js';

// Import lazy loader (Phase 9)
import { lazyLoad, preloadOnIdle } from '../utils/lazy-loader.js';

// Import Feature modules
import { initializeContextMenu } from '../features/context-menu/context-menu.js';
import { initializeDragDrop } from '../features/drag-drop/drag-drop-manager.js';
import { initializeAddCardIndicators, enableAddCardIndicators } from '../features/editing/add-card-indicators.js';
import { initializeDeleteHandler } from '../features/editing/delete-task-handler.js';

// Import configuration
import { GOOGLE_SHEETS, SUPABASE } from '../config/api-config.js';
import { DEPARTMENT_ORDER } from '../config/department-config.js';
import * as constants from '../config/constants.js';

// Import utilities
import {
    parseDate,
    getLocalDateString,
    formatDateToMMDDYYYY,
    getMonday,
    getWeekMonth,
    getWeekOfMonth
} from '../utils/date-utils.js';

import {
    showLoading,
    showError,
    hideError,
    showRenderingStatus,
    showSuccessNotification,
    stripHtml,
    normalizeDepartment,
    normalizeDepartmentClass
} from '../utils/ui-utils.js';

// Application state
let appState = {
    initialized: false,
    servicesReady: false,
    componentsReady: false,
    errors: [],
    initializationTime: 0
};

// === Lazy Loading Modal Wrappers (Phase 9) ===

// Track which modules have been initialized (ES6 modules are not extensible)
const initializedModals = new Set();

/**
 * Lazy load and initialize password modal
 * @returns {Promise<Object>} Password modal module
 */
async function loadPasswordModal() {
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
async function loadAddTaskModal() {
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
async function loadProjectModal() {
    const module = await lazyLoad(
        () => import('../components/modals/project-modal.js'),
        'project-modal'
    );
    if (!initializedModals.has('project-modal')) {
        const success = module.initializeProjectModal();
        if (success !== false) {
            initializedModals.add('project-modal');
        } else {
            console.error('Failed to initialize project modal - DOM elements not found');
        }
    }
    return module;
}

/**
 * Lazy load and initialize print modal
 * @returns {Promise<Object>} Print modal module
 */
async function loadPrintModal() {
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
async function showProjectViewLazy(projectName) {
    const module = await loadProjectModal();
    module.showProjectView(projectName);
}

/**
 * Show add card modal (lazy loaded)
 * Exposed globally for add card indicators
 * @param {Object} data - Modal data
 */
async function showAddCardModalLazy(data) {
    const module = await loadAddTaskModal();
    module.showAddCardModal(data);
}

// Expose lazy modal functions globally
if (typeof window !== 'undefined') {
    window.showProjectView = showProjectViewLazy;
    window.showAddCardModal = showAddCardModalLazy;
}

/**
 * Preload modals on browser idle time (Phase 9)
 * Loads modals in background for better perceived performance
 */
function preloadModalsOnIdle() {
    console.log('🔮 Scheduling modal preload on idle...');

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
        }
    ], 2000);
}

/**
 * Initialize the application
 * @returns {Promise<void>}
 */
export async function initializeApp() {
    const startTime = performance.now();

    try {
        console.log('🚀 Weekly Schedule Viewer - Starting initialization...');
        console.log('📦 ES6 Modules: Loaded');

        // === Phase 1: Core Systems (Critical) ===
        console.log('\n=== Phase 1: Core Systems ===');
        performanceMonitor.mark('app-init-start');
        loadingManager.showLoading('Initializing application...', 'init');
        loadingManager.updateProgress(5, 'Starting core systems...');

        // Error handler is already initialized in main.js

        // Initialize performance monitoring (Phase 9)
        performanceMonitor.initializePerformanceMonitor();
        console.log('  ✅ Performance monitor initialized');

        // Initialize loading manager
        loadingManager.initializeLoadingManager();
        console.log('  ✅ Loading manager initialized');

        // Initialize offline manager (Phase 9)
        offlineManager.initializeOfflineManager();
        console.log('  ✅ Offline manager initialized');

        loadingManager.updateProgress(10, 'Core systems ready');

        // === Phase 2: State Restoration ===
        console.log('\n=== Phase 2: State Restoration ===');
        performanceMonitor.mark('phase2-start');
        loadingManager.updateProgress(15, 'Restoring state...');

        await restoreState();
        performanceMonitor.measure('phase2-state-restoration', 'phase2-start');
        loadingManager.updateProgress(25, 'State restored');

        // === Phase 3: Services Initialization ===
        console.log('\n=== Phase 3: Services ===');
        performanceMonitor.mark('phase3-start');
        loadingManager.updateProgress(30, 'Initializing services...');

        await initializeServices();
        appState.servicesReady = true;
        performanceMonitor.measure('phase3-services-init', 'phase3-start');
        loadingManager.updateProgress(45, 'Services initialized');

        // === Phase 4: UI Components ===
        console.log('\n=== Phase 4: UI Components ===');
        performanceMonitor.mark('phase4-start');
        loadingManager.updateProgress(50, 'Initializing UI components...');

        await initializeComponents();
        appState.componentsReady = true;
        performanceMonitor.measure('phase4-components-init', 'phase4-start');
        loadingManager.updateProgress(70, 'UI components ready');

        // === Phase 5: Data Loading ===
        console.log('\n=== Phase 5: Data Loading ===');
        performanceMonitor.mark('phase5-start');
        loadingManager.updateProgress(75, 'Loading initial data...');

        await loadInitialData();
        performanceMonitor.measure('phase5-data-loading', 'phase5-start');
        loadingManager.updateProgress(90, 'Data loaded');

        // === Phase 6: Global Listeners & Features ===
        console.log('\n=== Phase 6: Global Features ===');
        performanceMonitor.mark('phase6-start');
        loadingManager.updateProgress(95, 'Initializing global features...');

        globalListeners.initializeGlobalListeners();
        keyboardShortcuts.initializeKeyboardShortcuts();

        performanceMonitor.measure('phase6-global-features', 'phase6-start');
        loadingManager.updateProgress(100, 'Application ready');

        // === Initialization Complete ===
        const endTime = performance.now();
        appState.initializationTime = endTime - startTime;
        appState.initialized = true;

        // Measure total initialization time
        performanceMonitor.measure('total-app-initialization', 'app-init-start');

        loadingManager.hideLoading('init');
        loadingManager.showStatus('✅ Application ready', 'success', 3000);

        console.log(`\n✅ Application initialized successfully in ${Math.round(appState.initializationTime)}ms`);
        console.log('🎉 Phase 9: Performance Optimization Active!');
        console.log('📊 Performance metrics available via window.reportPerformanceMetrics()');

        // Preload modals on idle (Phase 9)
        preloadModalsOnIdle();

    } catch (error) {
        console.error('❌ Application initialization failed:', error);
        appState.errors.push(error);

        loadingManager.hideLoading('init');
        errorHandler.handleError(error, {
            critical: true,
            operation: 'Application Initialization',
            retry: () => {
                console.log('🔄 Retrying initialization...');
                location.reload();
            }
        });

        throw error;
    }
}

/**
 * Restore persisted state from localStorage
 * @returns {Promise<void>}
 */
async function restoreState() {
    console.log('🔄 Restoring persisted state...');

    try {
        // Restore week index
        const savedWeekIndex = storage.loadWeekIndex();
        if (savedWeekIndex !== -1) {
            state.setCurrentViewedWeekIndex(savedWeekIndex, true);
            console.log('  ✅ Restored week index:', savedWeekIndex);
        }

        // Restore editing mode
        const savedEditingMode = storage.loadEditingMode();
        if (savedEditingMode) {
            state.setIsEditingUnlocked(savedEditingMode);
            console.log('  ✅ Restored editing mode:', savedEditingMode);
        }

        // Set up event listeners for state persistence
        eventBus.on(eventBus.EVENTS.WEEK_CHANGED, (data) => {
            storage.saveWeekIndex(data.weekIndex);
        });

        eventBus.on(eventBus.EVENTS.EDITING_TOGGLED, (data) => {
            storage.saveEditingMode(data.unlocked);
        });

        console.log('✅ State restored successfully');
    } catch (error) {
        console.warn('⚠️ Failed to restore state:', error);
        // Non-critical error, continue initialization
    }
}

/**
 * Initialize services (Supabase, Google Sheets, etc.)
 * @returns {Promise<void>}
 */
async function initializeServices() {
    console.log('⚙️ Initializing services...');

    // Initialize Supabase (critical service)
    try {
        await supabaseService.initializeSupabase();
        console.log('  ✅ Supabase initialized');
    } catch (error) {
        console.error('  ❌ Failed to initialize Supabase:', error);
        // Continue even if Supabase fails (graceful degradation)
        errorHandler.handleError(error, {
            critical: false,
            operation: 'Supabase initialization'
        });
    }

    console.log('✅ Services initialized');
}

/**
 * Initialize UI components
 * @returns {Promise<void>}
 */
async function initializeComponents() {
    console.log('🎨 Initializing UI components...');

    try {
        // Core UI Components
        initializeDepartmentFilter();
        console.log('  ✅ Department filter');

        initializeWeekNavigation();
        console.log('  ✅ Week navigation');

        initializeSearch();
        console.log('  ✅ Search bar');

        // Modals are lazy loaded (Phase 9) - will be initialized on first use
        console.log('  📦 Modals: Lazy loaded (will initialize on demand)');

        // Feature Modules
        initializeContextMenu();
        console.log('  ✅ Context menu');

        initializeDragDrop();
        console.log('  ✅ Drag & drop');

        initializeAddCardIndicators();
        console.log('  ✅ Add card indicators');

        initializeDeleteHandler();
        console.log('  ✅ Delete handler');

        // Set up component event listeners
        setupComponentEvents();

        // Initialize button event listeners
        initializeButtonHandlers();

        console.log('✅ UI components initialized');
    } catch (error) {
        console.error('❌ Failed to initialize components:', error);
        throw error;
    }
}

/**
 * Set up component event listeners
 */
function setupComponentEvents() {
    // Tasks filtered → render schedule
    eventBus.on(eventBus.EVENTS.TASKS_FILTERED, () => {
        renderAllWeeks();
    });

    // Tasks loaded → render schedule
    eventBus.on(eventBus.EVENTS.TASKS_LOADED, () => {
        console.log('📊 Tasks loaded, rendering schedule...');
    });
}

/**
 * Make a task card editable inline
 * @param {HTMLElement} taskCard - Task card element to make editable
 */
function makeTaskCardEditable(taskCard) {
    if (!taskCard) return;

    // Mark card as editing
    taskCard.classList.add('editing');

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
    saveBtn.title = 'Save changes (Enter)';
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
        if (e.key === 'Enter' && !e.ctrlKey) {
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
async function saveTaskCardEdit(taskCard) {
    if (!taskCard) return;

    const textarea = taskCard.querySelector('.edit-description');
    const taskId = taskCard.dataset.taskId;
    const newDescription = textarea ? textarea.value.trim() : '';

    try {
        // Update task in state
        const allTasks = state.getAllTasks();
        const task = allTasks.find(t => t.id === taskId);

        if (task) {
            task.description = newDescription;

            // Save to backend
            const { saveToStaging } = await import('../services/sheets-service.js');
            await saveToStaging(task.project, [{
                task: task,
                newText: newDescription
            }]);

            // Send refresh signal to other clients
            await supabaseService.sendRefreshSignal({
                operation: 'task_description_update',
                taskId: taskId,
                project: task.project
            });

            // Show success notification
            showSuccessNotification('Task updated successfully!');
        }

        // Restore normal view
        restoreTaskCardView(taskCard, newDescription);

    } catch (error) {
        console.error('Failed to save task:', error);
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
function cancelTaskCardEdit(taskCard) {
    if (!taskCard) return;

    const originalDescription = taskCard.dataset.originalDescription || '';
    restoreTaskCardView(taskCard, originalDescription);
}

/**
 * Restore task card to normal view after editing
 * @param {HTMLElement} taskCard - Task card to restore
 * @param {string} description - Description text to display
 */
function restoreTaskCardView(taskCard, description) {
    if (!taskCard) return;

    taskCard.classList.remove('editing');

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
}

/**
 * Initialize button event handlers
 */
function initializeButtonHandlers() {
    console.log('🔌 Wiring up button event listeners...');

    // Refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            try {
                showLoading();
                await dataService.fetchAllTasks();
                hideError();
                showSuccessNotification('Data refreshed successfully!');

                // Send refresh signal to all other clients
                await supabaseService.sendRefreshSignal({
                    action: 'manual_refresh',
                    source: 'refresh_button'
                });
            } catch (error) {
                console.error('Failed to refresh data:', error);
                errorHandler.handleError(error, {
                    operation: 'Data refresh',
                    retry: () => refreshBtn.click()
                });
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

    // Main editing button (lazy loaded)
    const mainEditingBtn = document.getElementById('main-editing-btn');
    if (mainEditingBtn) {
        mainEditingBtn.addEventListener('click', async () => {
            const isUnlocked = state.getIsEditingUnlocked();
            if (isUnlocked) {
                const module = await loadPasswordModal();
                module.lockEditing();
            } else {
                const module = await loadPasswordModal();
                module.showPasswordModal();
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

    // Event delegation for task card Plan buttons - show project modal
    document.addEventListener('click', async (e) => {
        const planBtn = e.target.closest('.task-plan-btn');
        if (planBtn) {
            const taskId = planBtn.dataset.taskId;
            const allTasks = state.getAllTasks();
            const task = allTasks.find(t => t.id === taskId);
            if (task) {
                const module = await loadProjectModal();
                module.showProjectModal(task.project);
            }
        }
    });

    // Event delegation for task card Edit buttons - make card editable inline
    document.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.task-edit-btn');
        if (editBtn) {
            const taskCard = editBtn.closest('.task-card');
            if (taskCard && !taskCard.classList.contains('editing')) {
                makeTaskCardEditable(taskCard);
            }
        }
    });

    // Event delegation for empty cells - click to add task
    document.addEventListener('click', async (e) => {
        const placeholder = e.target.closest('.task-card-placeholder');
        if (placeholder) {
            const isEditingUnlocked = state.getIsEditingUnlocked();
            if (!isEditingUnlocked) return; // Only allow adding tasks when editing is unlocked

            const department = placeholder.dataset.department;
            const date = placeholder.dataset.date;
            const week = placeholder.dataset.week;

            const module = await loadAddTaskModal();
            module.openAddTaskModal({ department, date, week });
        }
    });

    console.log('✅ Button event listeners initialized');
}

/**
 * Load initial data
 * @returns {Promise<void>}
 */
async function loadInitialData() {
    console.log('📊 Loading initial data...');

    try {
        await dataService.fetchAllTasks();
        console.log('✅ Initial data loaded');
    } catch (error) {
        console.error('❌ Failed to load initial data:', error);
        errorHandler.handleError(error, {
            operation: 'Initial data load',
            retry: loadInitialData
        });
        throw error;
    }
}

/**
 * Shutdown the application gracefully
 */
export function shutdownApp() {
    console.log('🛑 Shutting down application...');

    try {
        // Clean up global listeners
        globalListeners.cleanupGlobalListeners();

        // Clean up keyboard shortcuts
        keyboardShortcuts.cleanupKeyboardShortcuts();

        // Save state
        storage.saveState('appState', {
            weekIndex: state.getCurrentViewedWeekIndex(),
            editingMode: state.getIsEditingUnlocked(),
            timestamp: Date.now()
        });

        // Clear event bus subscriptions
        eventBus.clear();

        appState.initialized = false;

        console.log('✅ Application shutdown complete');
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
    }
}

/**
 * Restart the application
 * @returns {Promise<void>}
 */
export async function restartApp() {
    console.log('🔄 Restarting application...');

    shutdownApp();

    await new Promise(resolve => setTimeout(resolve, 100));

    await initializeApp();

    console.log('✅ Application restarted');
}

/**
 * Get application status
 * @returns {Object} Application health status
 */
export function getAppStatus() {
    return {
        initialized: appState.initialized,
        servicesReady: appState.servicesReady,
        componentsReady: appState.componentsReady,
        errors: appState.errors,
        initializationTime: appState.initializationTime,
        online: globalListeners.isOnline(),
        pageVisible: globalListeners.isPageCurrentlyVisible(),
        activeLoadingOperations: loadingManager.getActiveOperationsCount()
    };
}

/**
 * Setup backward compatibility
 * Expose necessary functions to window object for legacy code
 */
export function setupBackwardCompatibility() {
    console.log('🔗 Setting up backward compatibility...');

    // Expose configuration
    window.API_KEY = GOOGLE_SHEETS.API_KEY;
    window.SPREADSHEET_ID = GOOGLE_SHEETS.SPREADSHEET_ID;
    window.SHEET_NAME = GOOGLE_SHEETS.SHEET_NAME;
    window.SUPABASE_URL = SUPABASE.URL;
    window.SUPABASE_ANON_KEY = SUPABASE.ANON_KEY;

    // Expose utilities
    window.parseDate = parseDate;
    window.getLocalDateString = getLocalDateString;
    window.formatDateToMMDDYYYY = formatDateToMMDDYYYY;
    window.getMonday = getMonday;
    window.showLoading = showLoading;
    window.showError = showError;
    window.hideError = hideError;
    window.normalizeDepartment = normalizeDepartment;
    window.normalizeDepartmentClass = normalizeDepartmentClass;

    // Expose services
    window.getAccessToken = authService.getAccessToken;
    window.fetchTasks = sheetsService.fetchTasks;
    window.parseSheetData = sheetsService.parseSheetData;
    window.getSheetId = sheetsService.getSheetId;
    window.getStagingData = sheetsService.getStagingData;
    window.saveToStaging = sheetsService.saveToStaging;
    window.loadManualTasks = supabaseService.loadManualTasks;
    window.saveTaskToSupabase = supabaseService.saveTaskToSupabase;
    window.deleteTaskFromSupabase = supabaseService.deleteTaskFromSupabase;
    window.updateTaskInSupabase = supabaseService.updateTaskInSupabase;
    window.sendRefreshSignal = supabaseService.sendRefreshSignal;
    window.calculateProjectDayCounts = dataService.calculateProjectDayCounts;
    window.getProjectSummaries = dataService.getProjectSummaries;
    window.dataService = dataService; // Expose entire dataService for refresh signal handling

    // Expose state management
    window.state = state;
    window.eventBus = eventBus;
    window.storage = storage;

    // Expose state variables via getters/setters
    Object.defineProperty(window, 'allTasks', {
        get: () => state.getAllTasks(),
        set: (val) => state.setAllTasks(val, true)
    });
    Object.defineProperty(window, 'filteredTasks', {
        get: () => state.getFilteredTasks(),
        set: (val) => state.setFilteredTasks(val, true)
    });
    Object.defineProperty(window, 'currentDate', {
        get: () => state.getCurrentDate(),
        set: (val) => state.setCurrentDate(val)
    });
    Object.defineProperty(window, 'allWeekStartDates', {
        get: () => state.getAllWeekStartDates(),
        set: (val) => state.setAllWeekStartDates(val)
    });
    Object.defineProperty(window, 'currentProjectName', {
        get: () => state.getCurrentProjectName(),
        set: (val) => state.setCurrentProjectName(val)
    });
    Object.defineProperty(window, 'currentViewedWeekIndex', {
        get: () => state.getCurrentViewedWeekIndex(),
        set: (val) => state.setCurrentViewedWeekIndex(val)
    });
    Object.defineProperty(window, 'isEditingUnlocked', {
        get: () => state.getIsEditingUnlocked(),
        set: (val) => state.setIsEditingUnlocked(val)
    });
    Object.defineProperty(window, 'lastRenderTimestamp', {
        get: () => state.getLastRenderTimestamp(),
        set: (val) => state.setLastRenderTimestamp(val)
    });
    Object.defineProperty(window, 'renderCache', {
        get: () => state.getRenderCache(),
        set: (val) => state.setRenderCache(val)
    });

    // Expose constants
    window.EDIT_PASSWORD = state.EDIT_PASSWORD;
    window.DEPARTMENT_ORDER = state.DEPARTMENT_ORDER;

    // Expose UI functions
    window.renderAllWeeks = renderAllWeeks;
    window.equalizeAllCardHeights = equalizeAllCardHeights;
    window.filterTasks = filterTasks;

    // Modal functions are already exposed via lazy loading wrappers (Phase 9)
    // See lines 168-171 for showProjectView and showAddCardModal
    // Additional lazy modal functions:
    window.showPasswordModal = async () => {
        const module = await loadPasswordModal();
        module.showPasswordModal();
    };
    window.lockEditing = async () => {
        const module = await loadPasswordModal();
        module.lockEditing();
    };
    window.openAddTaskModal = async (data) => {
        const module = await loadAddTaskModal();
        module.openAddTaskModal(data);
    };
    window.showProjectModal = async (projectName) => {
        const module = await loadProjectModal();
        module.showProjectModal(projectName);
    };
    window.showPrintModal = async () => {
        const module = await loadPrintModal();
        module.showPrintModal();
    };
    window.openPrintModal = async () => {
        const module = await loadPrintModal();
        module.openPrintModal();
    };

    // Expose feature functions
    window.enableAddCardIndicators = enableAddCardIndicators;

    console.log('✅ Backward compatibility setup complete');
}
