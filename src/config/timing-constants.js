/**
 * Timing Constants
 *
 * Centralized timing values for timeouts, delays, and durations.
 * All values in milliseconds unless otherwise specified.
 */

// ============================================================================
// NOTIFICATION DURATIONS
// ============================================================================

export const NOTIFICATION_DURATION = {
  /** Default info notification duration (3s) */
  INFO: 3000,

  /** Warning notification duration (5s) */
  WARNING: 5000,

  /** Network error notification duration (8s) */
  NETWORK_ERROR: 8000,

  /** Error notification duration (4s) */
  ERROR: 4000,

  /** Keyboard shortcuts help notification (3s) */
  KEYBOARD_HELP: 3000,
};

// ============================================================================
// UI COMPONENT DELAYS
// ============================================================================

export const UI_DELAY = {
  /** Generic restart/refresh delay (100ms) */
  RESTART: 100,

  /** Loading indicator auto-hide timeout (30s) */
  LOADING_TIMEOUT: 30000,

  /** Refresh indicator auto-hide (2s) */
  REFRESH_INDICATOR: 2000,

  /** Status banner auto-hide default (3s) */
  STATUS_BANNER: 3000,

  /** Hide status banner delay (500ms) */
  STATUS_HIDE: 500,

  /** Sync status notification delay (2s) */
  SYNC_STATUS: 2000,
};

// ============================================================================
// FOCUS & INPUT DELAYS
// ============================================================================

export const FOCUS_DELAY = {
  /** Modal focus delay (50ms) */
  MODAL: 50,

  /** Password modal focus delay (100ms) */
  PASSWORD_MODAL: 100,
};

// ============================================================================
// RENDER DELAYS
// ============================================================================

export const RENDER_DELAY = {
  /** Schedule render completion delay (100ms) */
  SCHEDULE: 100,

  /** Week navigation update delay (100ms) */
  WEEK_NAV_UPDATE: 100,

  /** Card height equalization delay (100ms) */
  CARD_HEIGHT_EQUALIZE: 100,

  /** Schedule renderer completion delay (100ms) */
  SCHEDULE_RENDERER: 100,

  /** Print scaling DOM render delay (100ms) */
  PRINT_RENDER: 100,

  /** Print execution completion delay (1.5s) */
  PRINT_EXEC: 1500,

  /** Modal loader async delay (2s) */
  MODAL_LOADER: 2000,
};

// ============================================================================
// DEBOUNCE DELAYS
// ============================================================================

export const DEBOUNCE_DELAY = {
  /** Resize event debounce (250ms) */
  RESIZE: 250,

  /** Fullscreen change handler (100ms) */
  FULLSCREEN: 100,
};

// ============================================================================
// DRAG & DROP TIMING
// ============================================================================

export const DRAG_DROP_TIMING = {
  /** Drag completion cleanup delay (50ms) */
  CLEANUP: 50,

  /** Visual feedback timeout (300ms) */
  FEEDBACK: 300,
};

// ============================================================================
// NETWORK & REQUEST TIMING
// ============================================================================

export const NETWORK_TIMING = {
  /** Fetch request timeout (10s) */
  FETCH_TIMEOUT: 10000,

  /** Token refresh buffer (5 min) */
  TOKEN_REFRESH_BUFFER: 300000,

  /** Cache duration (1 min) */
  CACHE_DURATION: 60000,

  /** JWT token expiry in seconds (1 hour) */
  JWT_EXPIRY_SECONDS: 3600,
};

// ============================================================================
// MONITORING & PERFORMANCE
// ============================================================================

export const MONITORING = {
  /** Performance metric collection interval (5s) */
  PERF_MONITOR_INTERVAL: 5000,
};

// ============================================================================
// DATE/TIME CONSTANTS
// ============================================================================

export const TIME_CONSTANTS = {
  /** Milliseconds per day */
  MILLISECONDS_PER_DAY: 1000 * 60 * 60 * 24,

  /** Days in week (milliseconds) */
  DAYS_IN_WEEK_MS: 7 * 24 * 60 * 60 * 1000,

  /** Days in week */
  DAYS_IN_WEEK: 7,
};
