/**
 * Initialization Orchestrator Module
 * Manages the 6-phase application initialization sequence
 * @module core/initialization-orchestrator
 *
 * @claude-context
 * @purpose Orchestrates application startup phases
 * @dependencies All core systems, services, and components
 * @used-by app-controller
 * @exports restoreState, initializeServices, initializeComponents, loadInitialData
 * @modifies Initializes all application subsystems
 */

import { logger } from '../utils/logger.js';
import * as loadingManager from './loading-manager.js';
import * as performanceMonitor from './performance-monitor.js';
import * as offlineManager from './offline-manager.js';
import * as state from './state.js';
import * as eventBus from './event-bus.js';
import * as storage from './storage.js';
import * as errorHandler from './error-handler.js';

// Services
import * as supabaseService from '../services/supabase-service.js';
import * as dataService from '../services/data-service.js';

// UI Components
import { initializeDepartmentFilter } from '../components/department-filter.js';
import { initializeWeekNavigation } from '../components/week-navigation.js';
import { initializeSearch } from '../components/search-bar.js';

// Features
import { initializeAddCardIndicators } from '../features/editing/add-card-indicators.js';
import { initializeDeleteHandler } from '../features/editing/delete-task-handler.js';

// Local imports
import { setupComponentEvents } from './component-events.js';
import { initializeButtonHandlers } from './button-handlers.js';

/**
 * Restore persisted state from localStorage
 * @returns {Promise<void>}
 */
export async function restoreState() {
    logger.debug('Restoring persisted state...');

    try {
        // Restore week index
        const savedWeekIndex = storage.loadWeekIndex();
        if (savedWeekIndex !== -1) {
            state.setCurrentViewedWeekIndex(savedWeekIndex, true);
            logger.debug('  Restored week index:', savedWeekIndex);
        }

        // Restore editing mode
        const savedEditingMode = storage.loadEditingMode();
        if (savedEditingMode) {
            state.setIsEditingUnlocked(savedEditingMode);
            logger.debug('  Restored editing mode:', savedEditingMode);
        }

        // Set up event listeners for state persistence
        eventBus.on(eventBus.EVENTS.WEEK_CHANGED, (data) => {
            storage.saveWeekIndex(data.weekIndex);
        });

        eventBus.on(eventBus.EVENTS.EDITING_TOGGLED, (data) => {
            storage.saveEditingMode(data.unlocked);
        });

        logger.debug('State restored successfully');
    } catch (error) {
        logger.warn('Failed to restore state:', error);
        // Non-critical error, continue initialization
    }
}

/**
 * Initialize services (Supabase, Google Sheets, etc.)
 * @returns {Promise<void>}
 */
export async function initializeServices() {
    logger.debug('Initializing services...');

    // Initialize Supabase (critical service)
    try {
        await supabaseService.initializeSupabase();
        logger.debug('  Supabase initialized');
    } catch (error) {
        logger.error('  Failed to initialize Supabase:', error);
        // Continue even if Supabase fails (graceful degradation)
        errorHandler.handleError(error, {
            critical: false,
            operation: 'Supabase initialization'
        });
    }

    logger.debug('Services initialized');
}

/**
 * Initialize UI components
 * @returns {Promise<void>}
 */
export async function initializeComponents() {
    logger.debug('Initializing UI components...');

    try {
        // Core UI Components
        initializeDepartmentFilter();
        logger.debug('  Department filter');

        initializeWeekNavigation();
        logger.debug('  Week navigation');

        initializeSearch();
        logger.debug('  Search bar');

        // Initialize password modal on startup
        const { initializePasswordModal } = await import('../components/modals/password-modal.js');
        initializePasswordModal();
        logger.debug('  Password modal');

        // Other modals remain lazy loaded
        logger.debug('  Other modals: Lazy loaded (will initialize on demand)');

        // Feature Modules - Lazy loaded
        logger.debug('  Context menu: Lazy loaded (on first right-click)');
        logger.debug('  Drag & drop: Lazy loaded (on first interaction)');

        initializeAddCardIndicators();
        logger.debug('  Add card indicators');

        initializeDeleteHandler();
        logger.debug('  Delete handler');

        // Set up component event listeners
        setupComponentEvents();

        // Initialize button event listeners
        initializeButtonHandlers();

        logger.debug('UI components initialized');
    } catch (error) {
        logger.error('Failed to initialize components:', error);
        throw error;
    }
}

/**
 * Load initial data
 * Blocks until data is fully loaded to prevent race conditions
 * @returns {Promise<void>}
 */
export async function loadInitialData() {
    logger.debug('Loading initial data...');

    try {
        // Wait for data fetch to complete before proceeding
        // This prevents race conditions with Supabase initialization on cold start
        await dataService.fetchAllTasks(false); // silent=false to show loading UI

        logger.debug('Initial data loaded successfully');
    } catch (error) {
        logger.error('Failed to load initial data:', error);
        errorHandler.handleError(error, {
            operation: 'Initial data load',
            retry: loadInitialData
        });
        throw error;
    }
}

/**
 * Initialize core systems
 * Called during Phase 1 of initialization
 */
export function initializeCoreSystems() {
    logger.debug('=== Phase 1: Core Systems ===');

    // Initialize performance monitoring (Phase 9)
    performanceMonitor.initializePerformanceMonitor();
    logger.debug('  Performance monitor initialized');

    // Initialize loading manager
    loadingManager.initializeLoadingManager();
    logger.debug('  Loading manager initialized');

    // Initialize offline manager (Phase 9)
    offlineManager.initializeOfflineManager();
    logger.debug('  Offline manager initialized');

}
