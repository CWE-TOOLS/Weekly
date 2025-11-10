/**
 * Global Event Listeners
 * Manages global DOM event listeners
 * @module core/global-listeners
 *
 * FUTURE ENHANCEMENTS:
 * ===================
 *
 * 1. Unsaved Changes Detection (Priority: High, Effort: 1-2 days)
 *    - Implement comprehensive tracking of unsaved changes
 *    - Warn users before navigating away with unsaved edits
 *    - See handleBeforeUnload() for detailed implementation plan
 *    - Prevents data loss and improves UX
 *    - Prerequisites: State manager dirty state tracking
 *
 * 2. Auto-Refresh on Return (Priority: Medium, Effort: 0.5 days)
 *    - Currently suggests refresh after 5min absence
 *    - Could implement automatic data refresh
 *    - Add user preference to enable/disable
 *    - Show notification when auto-refresh occurs
 *    - See handleVisibilityChange() lines 158-160
 *
 * 3. Network Status Sync (Priority: Medium, Effort: 1-2 days)
 *    - Auto-sync pending changes when back online
 *    - Queue changes while offline
 *    - Retry failed requests
 *    - Show sync status in UI
 *    - See handleOnline() lines 204-207
 *
 * 4. Performance Monitoring (Priority: Low, Effort: 1 day)
 *    - Track performance metrics on visibility change
 *    - Log slow renders after resize
 *    - Detect memory leaks
 *    - Report to analytics service
 *
 * 5. Idle Detection (Priority: Low, Effort: 0.5 days)
 *    - Detect when user is idle (no interaction)
 *    - Auto-lock editing after idle period
 *    - Show "still there?" prompt
 *    - Pause background tasks when idle
 */

import * as eventBus from './event-bus.js';
import { showWarningNotification } from './error-handler.js';
import { DEBOUNCE_DELAY } from '../config/timing-constants.js';

import { logger } from '../utils/logger.js';
// Store listener references for cleanup
const listeners = [];

// State tracking
let resizeTimeout = null;
let isPageVisible = true;
let lastVisibilityChange = Date.now();

/**
 * Initialize global event listeners
 */
export function initializeGlobalListeners() {
    logger.debug('🌐 Initializing global event listeners...');

    // Window resize handler
    addListener(window, 'resize', handleResize);

    // Fullscreen change handler
    addListener(document, 'fullscreenchange', handleFullscreenChange);

    // Page visibility change (tab switching)
    addListener(document, 'visibilitychange', handleVisibilityChange);

    // Before unload (warn about unsaved changes)
    addListener(window, 'beforeunload', handleBeforeUnload);

    // Online/offline detection
    addListener(window, 'online', handleOnline);
    addListener(window, 'offline', handleOffline);

    // Keyboard event listeners (for global shortcuts)
    // Note: Specific shortcuts handled by keyboard-shortcuts.js
    addListener(document, 'keydown', handleGlobalKeydown);

    logger.debug('✅ Global event listeners initialized');
}

/**
 * Clean up global event listeners
 */
export function cleanupGlobalListeners() {
    logger.debug('🧹 Cleaning up global event listeners...');

    listeners.forEach(({ target, type, handler }) => {
        target.removeEventListener(type, handler);
    });

    listeners.length = 0;

    logger.debug('✅ Global event listeners cleaned up');
}

/**
 * Add a listener and track it for cleanup
 * @param {EventTarget} target
 * @param {string} type
 * @param {Function} handler
 */
function addListener(target, type, handler) {
    target.addEventListener(type, handler);
    listeners.push({ target, type, handler });
}

/**
 * Handle window resize
 * Debounced to avoid excessive recalculations
 */
function handleResize() {
    // Debounce resize events
    clearTimeout(resizeTimeout);

    resizeTimeout = setTimeout(() => {
        logger.debug('📐 Window resized:', {
            width: window.innerWidth,
            height: window.innerHeight
        });

        // Emit resize event for components to respond
        eventBus.emit(eventBus.EVENTS.WINDOW_RESIZED, {
            width: window.innerWidth,
            height: window.innerHeight
        });

        // Recalculate card heights if schedule is rendered
        if (typeof window.equalizeAllCardHeights === 'function') {
            window.equalizeAllCardHeights();
        }
    }, DEBOUNCE_DELAY.RESIZE);
}

/**
 * Handle fullscreen change
 */
function handleFullscreenChange() {
    const isFullscreen = !!document.fullscreenElement;

    logger.debug(`🖥️ Fullscreen ${isFullscreen ? 'entered' : 'exited'}`);

    // Update fullscreen button icons
    const expandIcon = document.getElementById('fullscreen-icon-expand');
    const compressIcon = document.getElementById('fullscreen-icon-compress');

    if (expandIcon && compressIcon) {
        if (isFullscreen) {
            expandIcon.style.display = 'none';
            compressIcon.style.display = 'block';
        } else {
            expandIcon.style.display = 'block';
            compressIcon.style.display = 'none';
        }
    }

    // Emit fullscreen change event
    eventBus.emit(eventBus.EVENTS.FULLSCREEN_CHANGED, { isFullscreen });

    // Recalculate layout after fullscreen transition
    setTimeout(() => {
        if (typeof window.equalizeAllCardHeights === 'function') {
            window.equalizeAllCardHeights();
        }
    }, DEBOUNCE_DELAY.FULLSCREEN);
}

/**
 * Handle visibility change (tab switching)
 */
function handleVisibilityChange() {
    const wasVisible = isPageVisible;
    isPageVisible = !document.hidden;

    const timeSinceLastChange = Date.now() - lastVisibilityChange;
    lastVisibilityChange = Date.now();

    if (isPageVisible && !wasVisible) {
        logger.debug('👁️ Page became visible');

        // If page was hidden for more than 5 minutes, suggest refresh
        if (timeSinceLastChange > 5 * 60 * 1000) {
            logger.debug('⚠️ Page was hidden for a long time, data might be stale');

            // Emit event for components to refresh if needed
            eventBus.emit(eventBus.EVENTS.PAGE_VISIBLE, {
                wasHiddenForLong: true,
                hiddenDuration: timeSinceLastChange
            });
        } else {
            eventBus.emit(eventBus.EVENTS.PAGE_VISIBLE, {
                wasHiddenForLong: false,
                hiddenDuration: timeSinceLastChange
            });
        }
    } else if (!isPageVisible && wasVisible) {
        logger.debug('👁️ Page became hidden');
        eventBus.emit(eventBus.EVENTS.PAGE_HIDDEN, {});
    }
}

/**
 * Handle before unload (warn about unsaved changes)
 * @param {BeforeUnloadEvent} event
 *
 * FUTURE_ENHANCEMENT: Unsaved Changes Detection
 *
 * Implement comprehensive unsaved changes tracking to prevent data loss
 * when users navigate away or close the tab.
 *
 * Current situation:
 * - Framework is in place but hasUnsavedChanges always returns false
 * - No tracking of edit state or pending changes
 *
 * Proposed implementation:
 *
 * 1. State Management Integration:
 *    Add to state-manager.js:
 *    - isDirty flag: tracks if any changes made since last save
 *    - dirtyFields: Set of modified field IDs
 *    - lastSaveTimestamp: when data was last persisted
 *    - pendingSaves: Map of unsaved changes per card/task
 *
 * 2. Change Tracking:
 *    - Listen to eventBus.EVENTS.TASK_UPDATED
 *    - Listen to eventBus.EVENTS.CARD_UPDATED
 *    - Mark state as dirty when edits occur
 *    - Clear dirty flag on successful save (TASK_SAVED event)
 *
 * 3. Implementation in this function:
 *    const hasUnsavedChanges = window.state?.hasUnsavedChanges() || false;
 *
 *    In state-manager.js:
 *    hasUnsavedChanges() {
 *        return this.isDirty || this.pendingSaves.size > 0;
 *    }
 *
 * 4. Edge cases to handle:
 *    - Auto-save feature (if implemented): only warn if auto-save failed
 *    - Read-only mode: never show warning if editing locked
 *    - Rapid save/edit cycles: debounce dirty flag updates
 *    - Multiple tabs: coordinate via localStorage events
 *
 * 5. User Experience considerations:
 *    - Don't warn on every single keystroke save
 *    - Only warn for "significant" unsaved changes
 *    - Show what will be lost: "3 tasks have unsaved changes"
 *    - Provide "Save and Exit" option (requires custom modal)
 *
 * 6. Testing requirements:
 *    - Test with rapid edits
 *    - Test with navigation (router events)
 *    - Test with browser refresh
 *    - Test with tab close
 *    - Test with editing locked/unlocked
 *
 * Complexity: Medium
 * Priority: High (prevents data loss)
 * Prerequisites:
 *   - State manager tracking of dirty state
 *   - Event bus integration for save events
 * Estimated effort: 1-2 days (including testing)
 *
 * Alternative approaches:
 * - Simpler: Only track if editing is unlocked + time since last edit
 * - Advanced: Track changes in IndexedDB with change log
 * - Hybrid: Auto-save all changes + warn only if auto-save fails
 *
 * Note: Modern browsers limit customization of beforeunload messages
 * for security reasons. The message parameter is often ignored and
 * browsers show their own generic confirmation dialog.
 */
function handleBeforeUnload(event) {
    // Check if there are unsaved changes via state management
    // Currently always returns false - see FUTURE_ENHANCEMENT above
    const hasUnsavedChanges = false;

    if (hasUnsavedChanges) {
        // Show confirmation dialog
        const message = 'You have unsaved changes. Are you sure you want to leave?';
        event.preventDefault();
        event.returnValue = message;
        return message;
    }
}

/**
 * Handle online status
 */
function handleOnline() {
    logger.debug('🌐 Connection restored - Back online');

    showWarningNotification('✅ Connection restored', 3000);

    // Emit online event
    eventBus.emit(eventBus.EVENTS.CONNECTION_CHANGED, {
        online: true
    });

    // Optional: Sync pending changes or refresh data
    // if (typeof window.fetchAllTasks === 'function') {
    //     window.fetchAllTasks();
    // }
}

/**
 * Handle offline status
 */
function handleOffline() {
    logger.debug('🌐 Connection lost - Offline');

    showWarningNotification('⚠️ You are offline. Some features may not work.', 0);

    // Emit offline event
    eventBus.emit(eventBus.EVENTS.CONNECTION_CHANGED, {
        online: false
    });
}

/**
 * Handle global keydown events
 * @param {KeyboardEvent} event
 */
function handleGlobalKeydown(event) {
    // Close modals on Escape key (unless typing in input)
    if (event.key === 'Escape') {
        // Don't close if user is typing in an input/textarea
        if (event.target.matches('input, textarea')) {
            return;
        }

        // Check for open modals and close them
        const openModals = [
            'project-modal',
            'password-modal',
            'add-card-modal',
            'print-modal'
        ];

        for (const modalId of openModals) {
            const modal = document.getElementById(modalId);
            if (modal && modal.style.display !== 'none' && !modal.classList.contains('hidden')) {
                // Emit close event
                eventBus.emit(eventBus.EVENTS.MODAL_CLOSE_REQUESTED, { modalId });

                // Close modal by clicking its close button
                const closeBtn = modal.querySelector('[id$="-close"]');
                if (closeBtn) {
                    closeBtn.click();
                }

                event.preventDefault();
                break; // Only close the first open modal
            }
        }
    }
}

/**
 * Get page visibility state
 * @returns {boolean}
 */
export function isPageCurrentlyVisible() {
    return isPageVisible;
}

/**
 * Get time since last visibility change
 * @returns {number} Milliseconds since last change
 */
export function getTimeSinceVisibilityChange() {
    return Date.now() - lastVisibilityChange;
}

/**
 * Check if browser is online
 * @returns {boolean}
 */
export function isOnline() {
    return navigator.onLine;
}
