/**
 * State Manager - Centralized Application State
 *
 * This module manages all application state with event emission on changes.
 * State is centralized here to provide a single source of truth.
 *
 * @module core/state
 *
 * @claude-context
 * @purpose Centralized state management with automatic event emission
 * @dependencies event-bus.js (for emitting state change events)
 * @used-by Almost all modules access state for reading/writing data
 * @exports get, set, batch, subscribe functions for state access
 * @modifies Global application state, localStorage (via storage.js)
 * @events-emitted state-changed:*, data-loaded, tasks-updated
 * @events-listened None (state is pure data layer)
 * @key-functions
 *   - get(key) - Read any state value
 *   - set(key, value) - Write state and emit change event
 *   - batch(fn) - Batch multiple state updates
 *   - subscribe(key, handler) - Listen to specific state changes
 */

import { emit, EVENTS } from './event-bus.js';

// ============================================================================
// Internal State Variables (private)
// ============================================================================

let _allTasks = [];
let _filteredTasks = [];
let _currentDate = new Date();
let _allWeekStartDates = [];
let _currentProjectName = '';
let _currentViewedWeekIndex = -1;
let _lastRenderTimestamp = null;
let _renderCache = null;
let _isEditingUnlocked = false;

// ============================================================================
// Constants
// ============================================================================

// Password for unlocking editing
export const EDIT_PASSWORD = 'cwe';

// Department order for sorting
export const DEPARTMENT_ORDER = [
    'Special Events',
    'Mill',
    'Form Out',
    'Cast',
    'Batch',
    'Demold',
    'Layout',
    'Finish',
    'Seal',
    'Special',
    'Crating',
    'Load',
    'Ship'
];

// ============================================================================
// Setters (with event emission)
// ============================================================================

/**
 * Set all tasks
 * @param {Array} tasks - Array of tasks to set
 * @param {boolean} silent - If true, don't emit event (default: false)
 */
export function setAllTasks(tasks, silent = false) {
    _allTasks = tasks;
    if (!silent) {
        emit(EVENTS.TASKS_LOADED, { tasks, count: tasks.length });
    }
}

/**
 * Set filtered tasks
 * @param {Array} tasks - Array of filtered tasks to set
 * @param {boolean} silent - If true, don't emit event (default: false)
 */
export function setFilteredTasks(tasks, silent = false) {
    _filteredTasks = tasks;
    if (!silent) {
        emit(EVENTS.TASKS_FILTERED, { tasks, count: tasks.length });
    }
}

/**
 * Set current date
 * @param {Date} date - Date to set
 */
export function setCurrentDate(date) {
    _currentDate = date;
}

/**
 * Set all week start dates
 * @param {Array} dates - Array of week start dates
 */
export function setAllWeekStartDates(dates) {
    _allWeekStartDates = dates;
}

/**
 * Set current project name
 * @param {string} name - Project name
 */
export function setCurrentProjectName(name) {
    const changed = _currentProjectName !== name;
    _currentProjectName = name;
    if (changed && name) {
        emit(EVENTS.PROJECT_OPENED, { projectName: name });
    } else if (changed && !name) {
        emit(EVENTS.PROJECT_CLOSED, {});
    }
}

/**
 * Set current viewed week index
 * @param {number} index - Week index
 * @param {boolean} silent - If true, don't emit event (default: false)
 */
export function setCurrentViewedWeekIndex(index, silent = false) {
    const changed = _currentViewedWeekIndex !== index;
    _currentViewedWeekIndex = index;
    if (changed && !silent) {
        emit(EVENTS.WEEK_CHANGED, { weekIndex: index });
    }
}

/**
 * Set last render timestamp
 * @param {number} timestamp - Timestamp in milliseconds
 */
export function setLastRenderTimestamp(timestamp) {
    _lastRenderTimestamp = timestamp;
}

/**
 * Set render cache
 * @param {*} cache - Cache data
 */
export function setRenderCache(cache) {
    _renderCache = cache;
}

/**
 * Set editing unlocked state
 * @param {boolean} unlocked - Whether editing is unlocked
 */
export function setIsEditingUnlocked(unlocked) {
    const changed = _isEditingUnlocked !== unlocked;
    _isEditingUnlocked = unlocked;
    if (changed) {
        emit(EVENTS.EDITING_TOGGLED, { unlocked });
    }
}

// ============================================================================
// Getters
// ============================================================================

/**
 * Get all tasks
 * @returns {Array} Array of all tasks
 */
export function getAllTasks() {
    return _allTasks;
}

/**
 * Get filtered tasks
 * @returns {Array} Array of filtered tasks
 */
export function getFilteredTasks() {
    return _filteredTasks;
}

/**
 * Get current date
 * @returns {Date} Current date
 */
export function getCurrentDate() {
    return _currentDate;
}

/**
 * Get all week start dates
 * @returns {Array} Array of week start dates
 */
export function getAllWeekStartDates() {
    return _allWeekStartDates;
}

/**
 * Get current project name
 * @returns {string} Current project name
 */
export function getCurrentProjectName() {
    return _currentProjectName;
}

/**
 * Get current viewed week index
 * @returns {number} Current viewed week index
 */
export function getCurrentViewedWeekIndex() {
    return _currentViewedWeekIndex;
}

/**
 * Get last render timestamp
 * @returns {number} Last render timestamp
 */
export function getLastRenderTimestamp() {
    return _lastRenderTimestamp;
}

/**
 * Get render cache
 * @returns {*} Render cache data
 */
export function getRenderCache() {
    return _renderCache;
}

/**
 * Get editing unlocked state
 * @returns {boolean} Whether editing is unlocked
 */
export function getIsEditingUnlocked() {
    return _isEditingUnlocked;
}

// ============================================================================
// Computed State & Helper Methods
// ============================================================================

/**
 * Get selected departments from the DOM
 * This reads directly from the checkbox elements in the UI
 * @returns {string[]} Array of selected department names
 */
export function getSelectedDepartments() {
    const selected = [];
    const checkboxes = document.querySelectorAll('#department-list input[type="checkbox"]:checked');
    checkboxes.forEach(checkbox => {
        selected.push(checkbox.value);
    });
    return selected;
}

/**
 * Get the current week's start date (Monday)
 * @returns {Date|null} Current week's Monday or null if not available
 */
export function getCurrentWeekDate() {
    if (_currentViewedWeekIndex >= 0 && _currentViewedWeekIndex < _allWeekStartDates.length) {
        return _allWeekStartDates[_currentViewedWeekIndex];
    }
    return null;
}

/**
 * Get task by ID
 * @param {string|number} taskId - Task ID to find
 * @returns {Object|null} Task object or null if not found
 */
export function getTaskById(taskId) {
    return _allTasks.find(task => task.id === taskId) || null;
}

/**
 * Get tasks by project name
 * @param {string} projectName - Project name to search for
 * @returns {Array} Array of tasks matching the project
 */
export function getTasksByProject(projectName) {
    return _allTasks.filter(task => task.project === projectName);
}

/**
 * Get tasks by department
 * @param {string} department - Department name
 * @returns {Array} Array of tasks in the department
 */
export function getTasksByDepartment(department) {
    return _allTasks.filter(task => task.department === department);
}

/**
 * Check if state has been initialized with data
 * @returns {boolean} True if state has tasks loaded
 */
export function isStateInitialized() {
    return _allTasks.length > 0 && _allWeekStartDates.length > 0;
}

/**
 * Get count of filtered vs all tasks
 * @returns {Object} Object with filtered and total counts
 */
export function getTaskCounts() {
    return {
        filtered: _filteredTasks.length,
        total: _allTasks.length,
        percentage: _allTasks.length > 0
            ? Math.round((_filteredTasks.length / _allTasks.length) * 100)
            : 0
    };
}

// ============================================================================
// State Reset & Debug
// ============================================================================

/**
 * Reset all state to initial values
 * WARNING: This will clear all in-memory state
 * @param {boolean} silent - If true, don't emit events (default: false)
 */
export function resetState(silent = false) {
    _allTasks = [];
    _filteredTasks = [];
    _currentDate = new Date();
    _allWeekStartDates = [];
    _currentProjectName = '';
    _currentViewedWeekIndex = -1;
    _lastRenderTimestamp = null;
    _renderCache = null;
    _isEditingUnlocked = false;

    if (!silent) {
        emit(EVENTS.STATE_RESTORED, { reset: true });
    }
}

/**
 * Get all state as an object (for debugging)
 * @returns {Object} Current state snapshot
 */
export function getStateSnapshot() {
    return {
        allTasks: _allTasks,
        filteredTasks: _filteredTasks,
        currentDate: _currentDate,
        allWeekStartDates: _allWeekStartDates,
        currentProjectName: _currentProjectName,
        currentViewedWeekIndex: _currentViewedWeekIndex,
        lastRenderTimestamp: _lastRenderTimestamp,
        renderCache: _renderCache,
        isEditingUnlocked: _isEditingUnlocked
    };
}

/**
 * Debug helper - log current state to console
 */
export function debugState() {
    console.log('[State] Current state:', getStateSnapshot());
    console.log('[State] Task counts:', getTaskCounts());
    console.log('[State] Initialized:', isStateInitialized());
}
