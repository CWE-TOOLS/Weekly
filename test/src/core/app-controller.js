/**
 * Application Controller
 * Main orchestrator for 6-phase application initialization
 * @module core/app-controller
 *
 * @claude-context
 * @purpose Main orchestrator for 6-phase application initialization
 * @dependencies Refactored into specialized modules for better organization
 * @used-by main.js (entry point calls initializeApp)
 * @exports initializeApp, setupBackwardCompatibility, getAppStatus, shutdownApp, restartApp
 * @modifies Initializes all systems, coordinates startup phases
 * @initialization-phases
 *   Phase 1: Error Handler - Set up global error handling
 *   Phase 2: State Restoration - Load cached state from localStorage
 *   Phase 3: Services - Initialize auth, sheets, supabase, data services
 *   Phase 4: UI Components - Initialize schedule, filters, navigation, search
 *   Phase 5: Data Loading - Fetch initial data and render
 *   Phase 6: Global Features - Initialize listeners and shortcuts
 * @refactoring Split into focused modules:
 *   - modal-loader.js: Lazy loading for modals
 *   - button-handlers.js: UI event listeners
 *   - task-card-editor.js: Inline editing logic
 *   - component-events.js: Event bus subscriptions
 *   - initialization-orchestrator.js: Phase coordination
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

// Import services
import * as authService from '../services/auth-service.js';
import * as sheetsService from '../services/sheets-service.js';
import * as supabaseService from '../services/supabase-service.js';
import * as dataService from '../services/data-service.js';
import { initializeSupabase } from '../services/supabase-service.js';

// Import UI components
import { filterTasks } from '../components/department-filter.js';

// Import configuration
import { GOOGLE_SHEETS, SUPABASE } from '../config/api-config.js';

// Import utilities
import {
    parseDate,
    getLocalDateString,
    formatDateToMMDDYYYY,
    getMonday
} from '../utils/date-utils.js';

import {
    showLoading,
    showError,
    hideError,
    normalizeDepartment,
    normalizeDepartmentClass
} from '../utils/ui-utils.js';

// Import constants
import { UI_DELAY } from '../config/timing-constants.js';

// Import new modular components
import {
    exposeModalFunctionsGlobally,
    preloadFeaturesOnIdle,
    loadPasswordModal,
    loadAddTaskModal,
    loadProjectModal,
    loadPrintModal,
    loadContextMenu,
    loadDragDrop
} from './modal-loader.js';

import {
    restoreState,
    initializeServices,
    initializeComponents,
    loadInitialData,
    initializeCoreSystems
} from './initialization-orchestrator.js';

// Import feature functions
import { enableAddCardIndicators } from '../features/editing/add-card-indicators.js';

import { logger } from '../utils/logger.js';
import { checkVersion, subscribeToVersionChanges } from '../features/versioning/version-checker.js';
import { debug } from '../utils/debug.js';
import {
    checkBrowserCompatibility,
    setDegradedMode,
    showCompatibilityWarning,
    disableEditingUI
} from '../utils/browser-compat.js';
// Application state
let appState = {
    initialized: false,
    servicesReady: false,
    componentsReady: false,
    errors: [],
    initializationTime: 0
};

// Track lazy-loaded feature state
let contextMenuLoaded = false;
let dragDropLoaded = false;

/**
 * Setup lazy load trigger for context menu
 * Loads context menu on first click interaction
 * @private
 */
function setupContextMenuTrigger() {
    const triggerContextMenu = async (e) => {
        if (contextMenuLoaded) return;

        // Check if clicking on a task card or if it's a potential context menu trigger
        if (e.target instanceof Element) {
            const taskCard = e.target.closest('.task-card');
            if (taskCard) {
                contextMenuLoaded = true;
                await loadContextMenu();
                logger.debug('Context menu lazy loaded on first interaction');
            }
        }
    };

    // Listen for first click that might trigger context menu
    document.addEventListener('click', triggerContextMenu, { once: false, capture: true });
}

/**
 * Setup lazy load trigger for drag-drop
 * Loads drag-drop on first mousedown on schedule grid
 * @private
 */
function setupDragDropTrigger() {
    const triggerDragDrop = async (e) => {
        if (dragDropLoaded) return;

        // Check if interacting with a draggable task card
        if (e.target instanceof Element) {
            const taskCard = e.target.closest('.task-card[draggable="true"]');
            if (taskCard) {
                dragDropLoaded = true;
                await loadDragDrop();
                logger.debug('Drag-drop lazy loaded on first interaction');
            }
        }
    };

    // Listen for first mousedown on draggable elements
    document.addEventListener('mousedown', triggerDragDrop, { once: false, capture: true });
}

/**
 * Initialize the application
 * @returns {Promise<void>}
 */
export async function initializeApp() {
    // === Phase 0: Browser Compatibility Check (CRITICAL) ===
    debug.log('[Startup] Phase 0: Browser Compatibility Check');
    const compatResult = checkBrowserCompatibility();

    if (compatResult.degradedMode) {
        logger.warn('⚠️ Running in DEGRADED MODE (read-only)');
        logger.warn(`Browser: ${compatResult.browserName} ${compatResult.browserVersion}`);
        setDegradedMode(true);

        // Show warning banner immediately
        showCompatibilityWarning(compatResult.message);

        // Disable editing UI
        disableEditingUI();
    }

    // Initialize Supabase (will be skipped if in degraded mode)
    await initializeSupabase();

    // Check for application updates (skip in degraded mode as it needs Supabase)
    if (!compatResult.degradedMode) {
        await checkVersion();
        subscribeToVersionChanges();
    }

    debug.log('[Startup] Starting initializeApp');
    debug.time('[Startup] initializeApp');
    const startTime = performance.now();

    try {
        logger.info('🚀 Weekly Schedule Viewer - Starting initialization...');
        logger.info('📦 ES6 Modules: Loaded');

        // === Phase 1: Core Systems (Critical) ===
        debug.log('[Startup] Starting Phase 1: Core Systems');
        debug.time('[Startup] Phase 1: Core Systems');
        performanceMonitor.mark('app-init-start');
        loadingManager.showLoading('Loading schedule…', 'init');

        // Initialize core systems (performance monitor, loading manager, offline manager)
        initializeCoreSystems();

        // Expose modal functions globally for backward compatibility
        exposeModalFunctionsGlobally();

        debug.timeEnd('[Startup] Phase 1: Core Systems');

        // === Phase 2: State Restoration ===
        debug.log('[Startup] Starting Phase 2: State Restoration');
        debug.time('[Startup] Phase 2: State Restoration');
        logger.debug('\n=== Phase 2: State Restoration ===');
        performanceMonitor.mark('phase2-start');

        await restoreState();
        performanceMonitor.measure('phase2-state-restoration', 'phase2-start');
        debug.timeEnd('[Startup] Phase 2: State Restoration');

        // === Phase 3: Services Initialization ===
        debug.log('[Startup] Starting Phase 3: Services');
        debug.time('[Startup] Phase 3: Services');
        logger.debug('\n=== Phase 3: Services ===');
        performanceMonitor.mark('phase3-start');

        await initializeServices();
        appState.servicesReady = true;
        performanceMonitor.measure('phase3-services-init', 'phase3-start');
        debug.timeEnd('[Startup] Phase 3: Services');

        // === Phase 4: UI Components ===
        debug.log('[Startup] Starting Phase 4: UI Components');
        debug.time('[Startup] Phase 4: UI Components');
        logger.debug('\n=== Phase 4: UI Components ===');
        performanceMonitor.mark('phase4-start');

        await initializeComponents();
        appState.componentsReady = true;
        performanceMonitor.measure('phase4-components-init', 'phase4-start');
        debug.timeEnd('[Startup] Phase 4: UI Components');

        // === Phase 5: Data Loading ===
        debug.log('[Startup] Starting Phase 5: Data Loading');
        debug.time('[Startup] Phase 5: Data Loading');
        logger.debug('\n=== Phase 5: Data Loading ===');
        performanceMonitor.mark('phase5-start');

        await loadInitialData();
        performanceMonitor.measure('phase5-data-loading', 'phase5-start');
        debug.timeEnd('[Startup] Phase 5: Data Loading');

        // === Phase 6: Global Listeners & Features ===
        debug.log('[Startup] Starting Phase 6: Global Features');
        debug.time('[Startup] Phase 6: Global Features');
        logger.debug('\n=== Phase 6: Global Features ===');
        performanceMonitor.mark('phase6-start');

        globalListeners.initializeGlobalListeners();
        keyboardShortcuts.initializeKeyboardShortcuts();

        // Setup lazy load triggers for context menu and drag-drop
        setupContextMenuTrigger();
        setupDragDropTrigger();
        logger.debug('  Lazy load triggers set up');

        performanceMonitor.measure('phase6-global-features', 'phase6-start');
        debug.timeEnd('[Startup] Phase 6: Global Features');

        // === Initialization Complete ===
        const endTime = performance.now();
        appState.initializationTime = endTime - startTime;
        appState.initialized = true;

        // Measure total initialization time
        performanceMonitor.measure('total-app-initialization', 'app-init-start');

        loadingManager.hideLoading('init');

        logger.info(`\n✅ Application initialized successfully in ${Math.round(appState.initializationTime)}ms`);
        logger.info('🎉 Phase 9: Performance Optimization Active!');
        logger.info('📊 Performance metrics available via window.reportPerformanceMetrics()');

        // Preload features on idle (Phase 9)
        preloadFeaturesOnIdle();

        debug.timeEnd('[Startup] initializeApp');
    } catch (error) {
        debug.timeEnd('[Startup] initializeApp');
        logger.error('❌ Application initialization failed:', error);
        appState.errors.push(error);

        loadingManager.hideLoading('init');
        errorHandler.handleError(error, {
            critical: true,
            operation: 'Application Initialization',
            retry: () => {
                logger.info('🔄 Retrying initialization...');
                location.reload();
            }
        });

        throw error;
    }
}

/**
 * Shutdown the application gracefully
 */
export function shutdownApp() {
    logger.info('🛑 Shutting down application...');

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

        logger.info('✅ Application shutdown complete');
    } catch (error) {
        logger.error('❌ Error during shutdown:', error);
    }
}

/**
 * Restart the application
 * @returns {Promise<void>}
 */
export async function restartApp() {
    logger.info('🔄 Restarting application...');

    shutdownApp();

    await new Promise(resolve => setTimeout(resolve, UI_DELAY.RESTART));

    await initializeApp();

    logger.info('✅ Application restarted');
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
    logger.debug('🔗 Setting up backward compatibility...');

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
    window.renderAllWeeks = async () => {
        const renderer = await import('./renderer.js');
        renderer.render();
    };
    window.filterTasks = filterTasks;

    // Modal functions (lazy loaded via modal-loader.js)
    // showProjectView and showAddCardModal already exposed by modal-loader.js
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

    logger.debug('✅ Backward compatibility setup complete');
}
