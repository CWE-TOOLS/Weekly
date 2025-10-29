/**
 * Application Constants
 * Contains general application configuration and constants
 */

// Authentication
export const EDIT_PASSWORD = 'cwe';

// Cache and performance settings
export const TOKEN_REFRESH_BUFFER = 300000; // 5 minutes in milliseconds
export const CACHE_DURATION = 60000; // 1 minute in milliseconds

// UI Configuration
export const DAYS_IN_WEEK = 7;
export const WEEKS_TO_DISPLAY = 4; // Number of weeks to display

// Date format options
export const DATE_FORMAT_OPTIONS = {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
};

// Grid configuration
export const GRID_CONFIG = {
    MIN_CARD_HEIGHT: 140,
    HEADER_HEIGHT: 72,
    CELL_PADDING: 12
};

// Modal animation durations (in milliseconds)
export const ANIMATION_DURATION = {
    MODAL_FADE: 300,
    SLIDE_IN: 500,
    NOTIFICATION: 2000
};

// Search configuration
export const SEARCH_CONFIG = {
    MIN_SEARCH_LENGTH: 2,
    MAX_RESULTS: 50,
    DEBOUNCE_DELAY: 300
};

// Print configuration
export const PRINT_CONFIG = {
    SCALE: 0.8,
    PAGE_SIZE: 'letter',
    ORIENTATION: 'landscape',
    MARGIN: '0.2in'
};

// Error messages
export const ERROR_MESSAGES = {
    FETCH_FAILED: 'Failed to fetch tasks from Google Sheets',
    AUTH_FAILED: 'Authentication failed',
    SAVE_FAILED: 'Failed to save changes',
    DELETE_FAILED: 'Failed to delete task',
    INVALID_DATE: 'Invalid date format',
    NETWORK_ERROR: 'Network error - please check your connection',
    PASSWORD_INCORRECT: 'Incorrect password'
};

// Success messages
export const SUCCESS_MESSAGES = {
    SAVE_SUCCESS: 'Changes saved successfully',
    DELETE_SUCCESS: 'Task deleted successfully',
    REFRESH_SUCCESS: 'Data refreshed successfully'
};

// Loading states
export const LOADING_STATES = {
    IDLE: 'idle',
    LOADING: 'loading',
    SUCCESS: 'success',
    ERROR: 'error'
};

// Task card minimum dimensions
export const TASK_CARD = {
    MIN_HEIGHT: '140px',
    MIN_HEIGHT_PRINT: '50px',
    MAX_WIDTH_PRINT: '200px'
};

// Local storage keys
export const STORAGE_KEYS = {
    SELECTED_DEPARTMENTS: 'selectedDepartments',
    CURRENT_WEEK: 'currentWeek',
    VIEW_PREFERENCES: 'viewPreferences',
    LAST_REFRESH: 'lastRefresh'
};
