/**
 * Releasability Board Configuration
 *
 * Defines tracking items, status types, and visual constants for the
 * releasability board feature.
 *
 * @module config/releasability-config
 */

// ============================================================================
// STATUS DEFINITIONS
// ============================================================================

/**
 * Status values for tracking items
 * Used to indicate completion state of each tracking milestone
 */
export const STATUS = {
  /** Item has not been started or completed - Red */
  INCOMPLETE: 'incomplete',

  /** Item is currently being worked on - Yellow */
  IN_PROGRESS: 'in_progress',

  /** Item has been finished and verified - Green */
  COMPLETE: 'complete',

  /** Item is not applicable for this project - Green */
  NOT_APPLICABLE: 'not_applicable'
};

/**
 * Visual representation for each status type
 */
export const STATUS_DISPLAY = {
  [STATUS.INCOMPLETE]: {
    color: '#EF4444',      // Red
    textColor: '#FFFFFF',   // White
    icon: '−',              // Dash/minus
    label: 'Incomplete'
  },
  [STATUS.IN_PROGRESS]: {
    color: '#F59E0B',      // Yellow/Orange
    textColor: '#FFFFFF',   // White
    icon: '/',              // Forward slash
    label: 'In Progress'
  },
  [STATUS.COMPLETE]: {
    color: '#22C55E',      // Green
    textColor: '#FFFFFF',   // White
    icon: '✓',              // Checkmark
    label: 'Complete'
  },
  [STATUS.NOT_APPLICABLE]: {
    color: '#E8E7E4',      // Grid background gray
    textColor: '#999999',   // Gray text
    icon: 'N/A',            // Not Applicable
    label: 'N/A'
  }
};

// ============================================================================
// TRACKING ITEMS
// ============================================================================

/**
 * List of all tracking items for project releasability
 * These appear as columns in the releasability grid
 * Order matches the standard workflow sequence
 */
export const TRACKING_ITEMS = [
  'Classroom #1',
  'Classroom #2',
  'Classroom #3',
  'Shop Folder Built',
  'Approved SDs',
  'Sample Approval',
  'Color Log',
  'Final Optimizer HRS',
  'Rebar/Drilling Layout',
  'Labels',
  'Final Tracking',
  'Batching Sheets',
  'Casting Layout',
  'Inflow Sales Ticket',
  '3D Drawings/Parts List',
  'Toolpath Program',
  'Jig List',
  'Staging',
  'Green Sticker'
];

/**
 * Display-only header overrides for tracking items.
 * Keys are the canonical TRACKING_ITEMS names — those are also the
 * tracking_status keys persisted in Supabase, so never rename them;
 * change what the column shows here instead.
 */
export const TRACKING_ITEM_LABELS = {
  'Jig List': 'Jig List / Cross-Section',
  'Inflow Sales Ticket': 'Inflow Sales Quote',
  'Casting Layout': 'Casting Layout/Instructions'
};

/**
 * Shortened display names for tracking items (for narrow columns)
 * Maps full name to abbreviated version
 */
export const TRACKING_ITEM_ABBREVIATIONS = {
  'Shop Folder Built': 'Shop Folder',
  'Sample Approval': 'Sample',
  'Color Log': 'Color',
  'Optimize Hours': 'Optimize',
  'Approved SB2': 'SB2',
  'Batch Tracking': 'Batch Track',
  'Classroom #1': 'Class #1',
  'Final Tracking': 'Final Track',
  'Batching Sheets': 'Batch Sheet',
  'Release to Buildrite Level': 'Buildrite',
  'Release or Decline': 'Release',
  'Creating Report': 'Report',
  'Final Optimizer RRS': 'Optimizer',
  'Classroom #2': 'Class #2',
  'Tailor Sales Ticket': 'Sales Ticket',
  '3D Drawings Parts List': '3D Parts',
  'Classroom #3': 'Class #3',
  'Toolpath Program': 'Toolpath',
  'Mill 3D Staging': '3D Staging'
};

// ============================================================================
// DEFAULT TEMPLATES
// ============================================================================

/**
 * Default tracking status object for new projects
 * All tracking items start as incomplete
 */
export const DEFAULT_TRACKING_STATUS = Object.freeze(
  TRACKING_ITEMS.reduce((acc, item) => {
    acc[item] = STATUS.INCOMPLETE;
    return acc;
  }, {})
);

// ============================================================================
// PROJECT SOURCES
// ============================================================================

/**
 * Source types for projects in the releasability board
 */
export const PROJECT_SOURCE = {
  /** Project pulled from Google Sheets schedule */
  SHEETS: 'sheets',

  /** Project manually added by user */
  MANUAL: 'manual'
};

// ============================================================================
// GRID DISPLAY CONFIGURATION
// ============================================================================

/**
 * Visual configuration for the releasability grid
 */
export const GRID_CONFIG = {
  /** Width of the project name column in pixels */
  PROJECT_COLUMN_WIDTH: 200,

  /** Width of each tracking item column in pixels */
  TRACKING_COLUMN_WIDTH: 100,

  /** Minimum width of tracking columns in narrow view */
  TRACKING_COLUMN_MIN_WIDTH: 80,

  /** Gap between grid cells in pixels */
  CELL_GAP: 1,

  /** Height of each project row in pixels */
  ROW_HEIGHT: 40,

  /** Height of the header row in pixels */
  HEADER_HEIGHT: 60
};

// ============================================================================
// WEEK RANGE CONFIGURATION
// ============================================================================

/**
 * Configuration for week range display
 */
export const WEEK_RANGE = {
  /** Number of past weeks to display relative to current week */
  PAST_WEEKS: 1,

  /** Whether to display weeks without any projects */
  SHOW_EMPTY_WEEKS: false
};

// ============================================================================
// VALIDATION RULES
// ============================================================================

/**
 * Validation rules for project data
 */
export const VALIDATION = {
  /** Minimum length for project name */
  PROJECT_NAME_MIN_LENGTH: 2,

  /** Maximum length for project name */
  PROJECT_NAME_MAX_LENGTH: 100,

  /** Required fields for manual project creation */
  REQUIRED_FIELDS: ['project', 'weekMonday']
};
