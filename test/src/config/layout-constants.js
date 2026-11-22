/**
 * Layout Constants
 *
 * Centralized layout dimension values for spacing, positioning, and sizing.
 * Values in pixels unless otherwise specified.
 */

// ============================================================================
// Z-INDEX VALUES
// ============================================================================

export const Z_INDEX = {
  /** Notification z-index */
  NOTIFICATION: 10000,

  /** Indicator/status z-index */
  INDICATOR: 10000,

  /** Print debug z-index */
  PRINT_DEBUG: 10000,

  /** Department label z-index (dragging) */
  DEPT_LABEL: 10,
};

// ============================================================================
// POSITIONING OFFSETS
// ============================================================================

export const POSITION_OFFSET = {
  /** Notification top/right offset (px) */
  NOTIFICATION: 20,

  /** Refresh indicator top/right offset (px) */
  INDICATOR: 20,

  /** Off-screen drag ghost position (px) */
  OFFSCREEN: -1000,
};

// ============================================================================
// NOTIFICATION STYLING
// ============================================================================

export const NOTIFICATION_STYLE = {
  /** Padding (rem) */
  PADDING_VERTICAL_REM: 0.75,
  PADDING_HORIZONTAL_REM: 1,

  /** Font size (rem) */
  FONT_SIZE_REM: 0.875,
};

// ============================================================================
// INDICATOR STYLING
// ============================================================================

export const INDICATOR_STYLE = {
  /** Indicator padding (px) */
  PADDING_VERTICAL_PX: 8,
  PADDING_HORIZONTAL_PX: 16,

  /** Notification padding (px) */
  NOTIFICATION_PADDING_VERTICAL_PX: 12,
  NOTIFICATION_PADDING_HORIZONTAL_PX: 20,
};

// ============================================================================
// GRID CONFIGURATION
// ============================================================================

export const GRID_LAYOUT = {
  /** Minimum card height (px) */
  MIN_CARD_HEIGHT: 140,

  /** Grid header height (px) */
  HEADER_HEIGHT: 72,

  /** Grid cell padding (px) */
  CELL_PADDING: 12,
};

// ============================================================================
// TASK CARD DIMENSIONS
// ============================================================================

export const TASK_CARD = {
  /** Minimum height (px) */
  MIN_HEIGHT: 140,

  /** Minimum height for print (px) */
  MIN_HEIGHT_PRINT: 50,

  /** Maximum width for print (px) */
  MAX_WIDTH_PRINT: 200,
};

// ============================================================================
// PRINT LAYOUT DIMENSIONS
// ============================================================================

export const PRINT_LAYOUT = {
  /** Page max width in pixels (10.5 inches at 96 DPI) */
  PAGE_MAX_WIDTH_PX: 10.5 * 96, // 1008px

  /** Landscape page max height in pixels (8 inches at 96 DPI) */
  PAGE_MAX_HEIGHT_PX_LANDSCAPE: 8 * 96, // 768px

  /** Day print page max height in pixels (10 inches at 96 DPI) */
  PAGE_MAX_HEIGHT_PX_DAY: 10 * 96, // 960px

  /** Minimum print scale threshold */
  MIN_SCALE: 0.5,

  /** Base font size for print scaling (points) */
  BASE_FONT_SIZE_PT: 8,

  /** Task cell width percentage */
  TASK_CELL_WIDTH_PERCENT: 60,

  /** Revenue/time period cell width percentage (4 columns × 10% = 40%, paired with 60% task cell) */
  PERIOD_CELL_WIDTH_PERCENT: 10,

  /** Print card max width (px) */
  CARD_MAX_WIDTH_PX: 180,

  /** Revenue row font size (em) */
  REVENUE_ROW_FONT_SIZE_EM: 0.85,

  /** Revenue cell padding (em) */
  REVENUE_CELL_PADDING_EM: 0.4,

  /** Print revenue font size (rem) */
  REVENUE_FONT_SIZE_REM: 0.5,

  /** Department per page scaling thresholds */
  DEPARTMENT_PER_PAGE: {
    /** Enable department-per-page mode */
    ENABLED: true,
    
    /** Maximum tasks before forcing department split */
    MAX_TASKS_BEFORE_SPLIT: 8,
    
    /** Maximum content height percentage to use per department */
    MAX_CONTENT_HEIGHT_PERCENT: 0.85,
    
    /** Minimum font size for department pages (points) */
    MIN_FONT_SIZE_PT: 4,
    
    /** Maximum font size for small departments (points) */
    MAX_FONT_SIZE_PT: 10,
    
    /** Compact mode font size (points) */
    COMPACT_FONT_SIZE_PT: 6,
    
    /** Ultra-compact mode font size (points) */
    ULTRA_COMPACT_FONT_SIZE_PT: 5,
    
    /** Spacing reduction factors */
    SPACING_REDUCTION: {
      HEADER_PADDING_MULTIPLIER: 0.7,
      CELL_PADDING_MULTIPLIER: 0.6,
      CARD_MARGIN_MULTIPLIER: 0.5,
      SECTION_MARGIN_MULTIPLIER: 0.6
    }
  }
};

// ============================================================================
// PRINT PREVIEW DIMENSIONS
// ============================================================================

export const PRINT_PREVIEW = {
  /** Viewport height usage percentage */
  VIEWPORT_USAGE_PERCENT: 0.98,

  /** Maximum print preview scale */
  MAX_SCALE: 0.95,

  /** Margin between print preview pages (px) */
  PAGE_MARGIN_PX: 40,

  /** Preview viewport height scale factor */
  HEIGHT_SCALE_FACTOR: 0.98,
};

// ============================================================================
// CONTENT THRESHOLDS
// ============================================================================

export const CONTENT_LIMITS = {
  /** Maximum project description length */
  MAX_DESCRIPTION_LENGTH: 500,

  /** Minimum search length */
  MIN_SEARCH_LENGTH: 2,

  /** Maximum search results */
  MAX_RESULTS: 50,

  /** Minimum text content length threshold */
  MIN_TEXT_CONTENT_LENGTH: 10,

  /** Maximum margin/padding threshold (px) */
  MAX_SPACING_THRESHOLD_PX: 50,

  /** Compact layout department threshold */
  COMPACT_LAYOUT_DEPT_THRESHOLD: 4,

  /** Compact layout task threshold */
  COMPACT_LAYOUT_TASK_THRESHOLD: 20,
};

// ============================================================================
// DATE BOUNDARIES
// ============================================================================

export const DATE_BOUNDARIES = {
  /** Year boundary threshold (2-digit year) */
  YEAR_BOUNDARY_THRESHOLD: 50,

  /** Century 1900 */
  CENTURY_1900: 1900,

  /** Century 2000 */
  CENTURY_2000: 2000,
};

// ============================================================================
// MISC CONFIGURATION
// ============================================================================

export const MISC_CONFIG = {
  /** Weeks to display */
  WEEKS_TO_DISPLAY: 4,

  /** Percentage calculation divisor */
  PERCENTAGE_DIVISOR: 100,
};
