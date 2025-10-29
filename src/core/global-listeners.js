/**
 * Global Event Listeners
 * Manages global DOM event listeners
 * @module core/global-listeners
 */

import * as eventBus from './event-bus.js';
import { showWarningNotification } from './error-handler.js';

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
    console.log('🌐 Initializing global event listeners...');

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

    console.log('✅ Global event listeners initialized');
}

/**
 * Clean up global event listeners
 */
export function cleanupGlobalListeners() {
    console.log('🧹 Cleaning up global event listeners...');

    listeners.forEach(({ target, type, handler }) => {
        target.removeEventListener(type, handler);
    });

    listeners.length = 0;

    console.log('✅ Global event listeners cleaned up');
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
        console.log('📐 Window resized:', {
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
    }, 250); // 250ms debounce
}

/**
 * Handle fullscreen change
 */
function handleFullscreenChange() {
    const isFullscreen = !!document.fullscreenElement;

    console.log(`🖥️ Fullscreen ${isFullscreen ? 'entered' : 'exited'}`);

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
    }, 100);
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
        console.log('👁️ Page became visible');

        // If page was hidden for more than 5 minutes, suggest refresh
        if (timeSinceLastChange > 5 * 60 * 1000) {
            console.log('⚠️ Page was hidden for a long time, data might be stale');

            // Emit event for components to refresh if needed
            eventBus.emit(eventBus.EVENTS.PAGE_VISIBLE, {
                wasHiddenForLong: true,
                hiddenDuration: timeSinceLastChange
            });

            // Optional: Auto-refresh data
            // if (typeof window.fetchAllTasks === 'function') {
            //     window.fetchAllTasks();
            // }
        } else {
            eventBus.emit(eventBus.EVENTS.PAGE_VISIBLE, {
                wasHiddenForLong: false,
                hiddenDuration: timeSinceLastChange
            });
        }
    } else if (!isPageVisible && wasVisible) {
        console.log('👁️ Page became hidden');
        eventBus.emit(eventBus.EVENTS.PAGE_HIDDEN, {});
    }
}

/**
 * Handle before unload (warn about unsaved changes)
 * @param {BeforeUnloadEvent} event
 */
function handleBeforeUnload(event) {
    // Check if there are unsaved changes
    // This would be determined by your state management
    const hasUnsavedChanges = false; // TODO: Implement this check

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
    console.log('🌐 Connection restored - Back online');

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
    console.log('🌐 Connection lost - Offline');

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
