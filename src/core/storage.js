/**
 * Storage Manager - LocalStorage Wrapper with Type Safety
 *
 * This module provides a safe, typed wrapper around localStorage with
 * error handling and convenience methods for common storage operations.
 *
 * @module core/storage
 */

/**
 * Storage keys used throughout the application
 */
export const STORAGE_KEYS = {
    SELECTED_DEPARTMENTS: 'selectedDepartments',
    SCHEDULE_SCROLL_POSITION: 'scheduleScrollPosition',
    CURRENT_WEEK_INDEX: 'currentViewedWeekIndex',
    EDITING_UNLOCKED: 'editingUnlocked',
    PRINT_SELECTED_DEPARTMENTS: 'printSelectedDepartments'
};

/**
 * Check if localStorage is available
 * @returns {boolean} True if localStorage is available
 */
function isStorageAvailable() {
    try {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (error) {
        console.warn('[Storage] localStorage is not available:', error.message);
        return false;
    }
}

/**
 * Save a value to localStorage with error handling
 * @param {string} key - Storage key
 * @param {*} value - Value to store (will be JSON stringified)
 * @returns {boolean} True if successful
 *
 * @example
 * saveState('myKey', { foo: 'bar' });
 */
export function saveState(key, value) {
    if (!isStorageAvailable()) {
        return false;
    }

    try {
        const serialized = JSON.stringify(value);
        localStorage.setItem(key, serialized);
        return true;
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            console.error('[Storage] Storage quota exceeded. Consider clearing old data.');
        } else {
            console.error(`[Storage] Failed to save "${key}":`, error.message);
        }
        return false;
    }
}

/**
 * Load a value from localStorage with error handling
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if key doesn't exist or error occurs
 * @returns {*} Parsed value or defaultValue
 *
 * @example
 * const data = loadState('myKey', {});
 */
export function loadState(key, defaultValue = null) {
    if (!isStorageAvailable()) {
        return defaultValue;
    }

    try {
        const item = localStorage.getItem(key);

        if (item === null) {
            return defaultValue;
        }

        return JSON.parse(item);
    } catch (error) {
        console.error(`[Storage] Failed to load "${key}":`, error.message);
        return defaultValue;
    }
}

/**
 * Remove a value from localStorage
 * @param {string} key - Storage key
 * @returns {boolean} True if successful
 *
 * @example
 * removeState('myKey');
 */
export function removeState(key) {
    if (!isStorageAvailable()) {
        return false;
    }

    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error(`[Storage] Failed to remove "${key}":`, error.message);
        return false;
    }
}

/**
 * Clear all state from localStorage
 * WARNING: This will remove ALL localStorage data
 * @returns {boolean} True if successful
 *
 * @example
 * clearAllState();
 */
export function clearAllState() {
    if (!isStorageAvailable()) {
        return false;
    }

    try {
        localStorage.clear();
        return true;
    } catch (error) {
        console.error('[Storage] Failed to clear storage:', error.message);
        return false;
    }
}

/**
 * Clear only application-specific keys
 * Leaves other localStorage data intact
 * @returns {boolean} True if successful
 */
export function clearAppState() {
    if (!isStorageAvailable()) {
        return false;
    }

    try {
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        return true;
    } catch (error) {
        console.error('[Storage] Failed to clear app state:', error.message);
        return false;
    }
}

// ============================================================================
// Typed Helper Methods - Convenience functions for specific data types
// ============================================================================

/**
 * Save selected departments to localStorage
 * @param {string[]} departments - Array of department names
 * @returns {boolean} True if successful
 *
 * @example
 * saveSelectedDepartments(['Mill', 'Cast', 'Finish']);
 */
export function saveSelectedDepartments(departments) {
    if (!Array.isArray(departments)) {
        console.error('[Storage] saveSelectedDepartments expects an array');
        return false;
    }
    return saveState(STORAGE_KEYS.SELECTED_DEPARTMENTS, departments);
}

/**
 * Load selected departments from localStorage
 * @param {string[]} defaultValue - Default departments if none saved
 * @returns {string[]} Array of department names
 *
 * @example
 * const departments = loadSelectedDepartments(['Mill']);
 */
export function loadSelectedDepartments(defaultValue = []) {
    const departments = loadState(STORAGE_KEYS.SELECTED_DEPARTMENTS, defaultValue);
    return Array.isArray(departments) ? departments : defaultValue;
}

/**
 * Save schedule scroll position
 * @param {number} position - Scroll position in pixels
 * @returns {boolean} True if successful
 *
 * @example
 * saveScrollPosition(500);
 */
export function saveScrollPosition(position) {
    if (typeof position !== 'number' || position < 0) {
        console.error('[Storage] saveScrollPosition expects a non-negative number');
        return false;
    }
    return saveState(STORAGE_KEYS.SCHEDULE_SCROLL_POSITION, position);
}

/**
 * Load schedule scroll position
 * @param {number} defaultValue - Default position (default: 0)
 * @returns {number} Scroll position in pixels
 *
 * @example
 * const position = loadScrollPosition();
 */
export function loadScrollPosition(defaultValue = 0) {
    const position = loadState(STORAGE_KEYS.SCHEDULE_SCROLL_POSITION, defaultValue);
    return typeof position === 'number' ? position : defaultValue;
}

/**
 * Save current week index
 * @param {number} index - Week index
 * @returns {boolean} True if successful
 *
 * @example
 * saveWeekIndex(3);
 */
export function saveWeekIndex(index) {
    if (typeof index !== 'number' || index < -1) {
        console.error('[Storage] saveWeekIndex expects a number >= -1');
        return false;
    }
    return saveState(STORAGE_KEYS.CURRENT_WEEK_INDEX, index);
}

/**
 * Load current week index
 * @param {number} defaultValue - Default index (default: -1)
 * @returns {number} Week index
 *
 * @example
 * const index = loadWeekIndex();
 */
export function loadWeekIndex(defaultValue = -1) {
    const index = loadState(STORAGE_KEYS.CURRENT_WEEK_INDEX, defaultValue);
    return typeof index === 'number' ? index : defaultValue;
}

/**
 * Save editing mode state
 * @param {boolean} unlocked - Whether editing is unlocked
 * @returns {boolean} True if successful
 *
 * @example
 * saveEditingMode(true);
 */
export function saveEditingMode(unlocked) {
    if (typeof unlocked !== 'boolean') {
        console.error('[Storage] saveEditingMode expects a boolean');
        return false;
    }
    return saveState(STORAGE_KEYS.EDITING_UNLOCKED, unlocked);
}

/**
 * Load editing mode state
 * @param {boolean} defaultValue - Default state (default: false)
 * @returns {boolean} Editing mode state
 *
 * @example
 * const unlocked = loadEditingMode();
 */
export function loadEditingMode(defaultValue = false) {
    const unlocked = loadState(STORAGE_KEYS.EDITING_UNLOCKED, defaultValue);
    return typeof unlocked === 'boolean' ? unlocked : defaultValue;
}

/**
 * Save print selected departments
 * @param {string[]} departments - Array of department names for print
 * @returns {boolean} True if successful
 *
 * @example
 * savePrintSelectedDepartments(['Mill', 'Cast']);
 */
export function savePrintSelectedDepartments(departments) {
    if (!Array.isArray(departments)) {
        console.error('[Storage] savePrintSelectedDepartments expects an array');
        return false;
    }
    return saveState(STORAGE_KEYS.PRINT_SELECTED_DEPARTMENTS, departments);
}

/**
 * Load print selected departments
 * @param {string[]} defaultValue - Default departments if none saved
 * @returns {string[]} Array of department names
 *
 * @example
 * const departments = loadPrintSelectedDepartments([]);
 */
export function loadPrintSelectedDepartments(defaultValue = []) {
    const departments = loadState(STORAGE_KEYS.PRINT_SELECTED_DEPARTMENTS, defaultValue);
    return Array.isArray(departments) ? departments : defaultValue;
}

/**
 * Get storage usage information (if available)
 * @returns {Object|null} Storage info or null if not available
 *
 * @example
 * const info = getStorageInfo();
 * if (info) {
 *   console.log(`Using ${info.used} of ${info.quota} bytes`);
 * }
 */
export async function getStorageInfo() {
    if (!navigator.storage || !navigator.storage.estimate) {
        return null;
    }

    try {
        const estimate = await navigator.storage.estimate();
        return {
            quota: estimate.quota,
            used: estimate.usage,
            percentage: estimate.quota ? (estimate.usage / estimate.quota * 100).toFixed(2) : 0
        };
    } catch (error) {
        console.error('[Storage] Failed to get storage info:', error.message);
        return null;
    }
}

/**
 * Export all application state for backup
 * @returns {Object} All stored state
 *
 * @example
 * const backup = exportState();
 * console.log('Backup:', backup);
 */
export function exportState() {
    const state = {};

    Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
        const value = loadState(key);
        if (value !== null) {
            state[name] = value;
        }
    });

    return state;
}

/**
 * Import application state from backup
 * @param {Object} state - State object to import
 * @returns {boolean} True if successful
 *
 * @example
 * importState(backupData);
 */
export function importState(state) {
    if (typeof state !== 'object' || state === null) {
        console.error('[Storage] importState expects an object');
        return false;
    }

    try {
        Object.entries(state).forEach(([name, value]) => {
            const key = STORAGE_KEYS[name];
            if (key) {
                saveState(key, value);
            }
        });
        return true;
    } catch (error) {
        console.error('[Storage] Failed to import state:', error.message);
        return false;
    }
}
