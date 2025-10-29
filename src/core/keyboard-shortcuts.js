/**
 * Keyboard Shortcuts Manager
 * Centralized keyboard shortcut handling
 * @module core/keyboard-shortcuts
 */

import * as dataService from '../services/data-service.js';
import { showInfoNotification } from './error-handler.js';

// Shortcut definitions
export const SHORTCUTS = {
    REFRESH: { key: 'r', ctrlKey: true, description: 'Refresh data' },
    PRINT: { key: 'p', ctrlKey: true, description: 'Open print modal' },
    SEARCH: { key: 'f', ctrlKey: true, description: 'Focus search' },
    UNLOCK_EDITING: { key: 'e', ctrlKey: true, shiftKey: true, description: 'Unlock editing' },
    CLOSE_MODAL: { key: 'Escape', description: 'Close modal/dialog' },
    NEXT_WEEK: { key: 'ArrowRight', altKey: true, description: 'Next week' },
    PREV_WEEK: { key: 'ArrowLeft', altKey: true, description: 'Previous week' },
    SHOW_HELP: { key: '?', shiftKey: true, description: 'Show keyboard shortcuts' },
    FULLSCREEN: { key: 'f', altKey: true, description: 'Toggle fullscreen' },
    ADD_TASK: { key: 'n', ctrlKey: true, description: 'Add new task' }
};

// Registry of active shortcuts
const shortcutRegistry = new Map();

// Keyboard listener
let keyboardListener = null;

/**
 * Initialize keyboard shortcuts
 */
export function initializeKeyboardShortcuts() {
    console.log('⌨️ Initializing keyboard shortcuts...');

    // Register default shortcuts
    registerDefaultShortcuts();

    // Set up global keyboard listener
    keyboardListener = (event) => handleKeyboardEvent(event);
    document.addEventListener('keydown', keyboardListener);

    console.log('✅ Keyboard shortcuts initialized');
    console.log('💡 Press Shift+? to see all shortcuts');
}

/**
 * Clean up keyboard shortcuts
 */
export function cleanupKeyboardShortcuts() {
    if (keyboardListener) {
        document.removeEventListener('keydown', keyboardListener);
        keyboardListener = null;
    }

    shortcutRegistry.clear();
    console.log('🧹 Keyboard shortcuts cleaned up');
}

/**
 * Register default application shortcuts
 */
function registerDefaultShortcuts() {
    // Refresh data (Ctrl+R)
    registerShortcut(SHORTCUTS.REFRESH, async () => {
        console.log('⌨️ Shortcut: Refresh data');
        try {
            if (typeof window.showLoading === 'function') {
                window.showLoading();
            }
            await dataService.fetchAllTasks();
            showInfoNotification('✅ Data refreshed');
        } catch (error) {
            console.error('Failed to refresh:', error);
        }
    });

    // Print (Ctrl+P)
    registerShortcut(SHORTCUTS.PRINT, () => {
        console.log('⌨️ Shortcut: Print');
        if (typeof window.showPrintModal === 'function') {
            window.showPrintModal();
        }
    });

    // Search (Ctrl+F)
    registerShortcut(SHORTCUTS.SEARCH, () => {
        console.log('⌨️ Shortcut: Focus search');
        const searchInput = document.getElementById('project-search');
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    });

    // Unlock editing (Ctrl+Shift+E)
    registerShortcut(SHORTCUTS.UNLOCK_EDITING, () => {
        console.log('⌨️ Shortcut: Unlock editing');
        const editingBtn = document.getElementById('main-editing-btn');
        if (editingBtn) {
            editingBtn.click();
        }
    });

    // Next week (Alt+Right Arrow)
    registerShortcut(SHORTCUTS.NEXT_WEEK, () => {
        console.log('⌨️ Shortcut: Next week');
        const nextBtn = document.getElementById('next-week-btn');
        if (nextBtn && !nextBtn.disabled) {
            nextBtn.click();
        }
    });

    // Previous week (Alt+Left Arrow)
    registerShortcut(SHORTCUTS.PREV_WEEK, () => {
        console.log('⌨️ Shortcut: Previous week');
        const prevBtn = document.getElementById('prev-week-btn');
        if (prevBtn && !prevBtn.disabled) {
            prevBtn.click();
        }
    });

    // Show help (Shift+?)
    registerShortcut(SHORTCUTS.SHOW_HELP, () => {
        console.log('⌨️ Shortcut: Show help');
        showShortcutsHelp();
    });

    // Toggle fullscreen (Alt+F)
    registerShortcut(SHORTCUTS.FULLSCREEN, () => {
        console.log('⌨️ Shortcut: Toggle fullscreen');
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.click();
        }
    });

    // Add task (Ctrl+N)
    registerShortcut(SHORTCUTS.ADD_TASK, () => {
        console.log('⌨️ Shortcut: Add task');
        // Only works if editing is unlocked
        if (window.state?.getIsEditingUnlocked()) {
            const fabBtn = document.getElementById('fab-add-task');
            if (fabBtn) {
                fabBtn.click();
            }
        }
    });
}

/**
 * Handle keyboard event
 * @param {KeyboardEvent} event
 */
function handleKeyboardEvent(event) {
    // Don't trigger shortcuts if user is typing in an input/textarea
    // (except for Escape key)
    if (event.key !== 'Escape' && event.target.matches('input, textarea, [contenteditable]')) {
        return;
    }

    // Check all registered shortcuts
    for (const [key, { shortcut, handler }] of shortcutRegistry) {
        if (matchesShortcut(event, shortcut)) {
            event.preventDefault();
            event.stopPropagation();

            // Execute handler
            try {
                handler(event);
            } catch (error) {
                console.error('Shortcut handler error:', error);
            }

            break; // Only trigger first matching shortcut
        }
    }
}

/**
 * Check if keyboard event matches a shortcut definition
 * @param {KeyboardEvent} event
 * @param {Object} shortcut
 * @returns {boolean}
 */
function matchesShortcut(event, shortcut) {
    // Check key
    if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) {
        return false;
    }

    // Check modifier keys
    const ctrlKey = shortcut.ctrlKey || false;
    const shiftKey = shortcut.shiftKey || false;
    const altKey = shortcut.altKey || false;
    const metaKey = shortcut.metaKey || false;

    // Use Ctrl or Meta (Cmd on Mac) interchangeably
    const hasCtrlOrMeta = ctrlKey ? (event.ctrlKey || event.metaKey) : true;

    return (
        hasCtrlOrMeta &&
        (shiftKey ? event.shiftKey : !event.shiftKey) &&
        (altKey ? event.altKey : !event.altKey) &&
        (metaKey ? event.metaKey : !event.metaKey)
    );
}

/**
 * Register a keyboard shortcut
 * @param {Object} shortcut - Shortcut definition
 * @param {Function} handler - Shortcut handler
 * @returns {string} Shortcut key for unregistering
 */
export function registerShortcut(shortcut, handler) {
    const key = generateShortcutKey(shortcut);

    if (shortcutRegistry.has(key)) {
        console.warn(`Shortcut already registered: ${key}`);
    }

    shortcutRegistry.set(key, { shortcut, handler });

    return key;
}

/**
 * Unregister a keyboard shortcut
 * @param {Object} shortcut - Shortcut to remove
 */
export function unregisterShortcut(shortcut) {
    const key = generateShortcutKey(shortcut);
    shortcutRegistry.delete(key);
}

/**
 * Generate a unique key for a shortcut
 * @param {Object} shortcut
 * @returns {string}
 */
function generateShortcutKey(shortcut) {
    const parts = [];

    if (shortcut.ctrlKey) parts.push('Ctrl');
    if (shortcut.shiftKey) parts.push('Shift');
    if (shortcut.altKey) parts.push('Alt');
    if (shortcut.metaKey) parts.push('Meta');

    parts.push(shortcut.key);

    return parts.join('+');
}

/**
 * Format shortcut for display
 * @param {Object} shortcut
 * @returns {string}
 */
function formatShortcut(shortcut) {
    const parts = [];

    // Use platform-specific key names
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    if (shortcut.ctrlKey) {
        parts.push(isMac ? '⌘' : 'Ctrl');
    }
    if (shortcut.shiftKey) {
        parts.push(isMac ? '⇧' : 'Shift');
    }
    if (shortcut.altKey) {
        parts.push(isMac ? '⌥' : 'Alt');
    }
    if (shortcut.metaKey) {
        parts.push(isMac ? '⌘' : 'Meta');
    }

    // Format key name
    let keyName = shortcut.key;
    if (keyName === 'Escape') keyName = 'Esc';
    if (keyName === 'ArrowRight') keyName = '→';
    if (keyName === 'ArrowLeft') keyName = '←';
    if (keyName === 'ArrowUp') keyName = '↑';
    if (keyName === 'ArrowDown') keyName = '↓';

    parts.push(keyName);

    return parts.join('+');
}

/**
 * Show keyboard shortcuts help
 */
export function showShortcutsHelp() {
    let helpText = '⌨️ Keyboard Shortcuts:\n\n';

    // Get shortcuts from SHORTCUTS const
    Object.entries(SHORTCUTS).forEach(([name, shortcut]) => {
        const formatted = formatShortcut(shortcut);
        const description = shortcut.description || name;
        helpText += `${formatted}: ${description}\n`;
    });

    // Show in console
    console.log(helpText);

    // Show as notification
    showInfoNotification('💡 Keyboard shortcuts logged to console', 3000);

    // TODO: Create a proper modal for shortcuts help
    // For now, just show in console
}

/**
 * Get all registered shortcuts
 * @returns {Array<Object>}
 */
export function getAllShortcuts() {
    return Object.values(SHORTCUTS);
}

/**
 * Check if shortcut is registered
 * @param {Object} shortcut
 * @returns {boolean}
 */
export function isShortcutRegistered(shortcut) {
    const key = generateShortcutKey(shortcut);
    return shortcutRegistry.has(key);
}
