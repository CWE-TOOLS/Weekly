/**
 * Releasability Board State Management
 *
 * Manages all state for the releasability board including projects,
 * tracking statuses, filters, and view settings.
 *
 * @module pages/releasability/releasability-state
 * @dependencies core/event-bus, config/releasability-config, utils/date-utils
 */

import { emit, on, EVENTS } from '../../core/event-bus.js';
import {
  STATUS,
  DEFAULT_TRACKING_STATUS,
  PROJECT_SOURCE,
  TRACKING_ITEMS
} from '../../config/releasability-config.js';

// ============================================================================
// PRIVATE STATE
// ============================================================================

/**
 * All projects in the releasability board
 * @type {Array<Object>}
 * @private
 */
let _projects = [];

/**
 * Currently selected week (Monday date string in YYYY-MM-DD format)
 * @type {string|null}
 * @private
 */
let _currentViewWeek = null;

/**
 * Active department filters
 * @type {Array<string>}
 * @private
 */
let _departmentFilters = [];

/**
 * Search query for filtering projects
 * @type {string}
 * @private
 */
let _searchQuery = '';

/**
 * Hide completed projects flag
 * @type {boolean}
 * @private
 */
let _hideCompleted = false;

/**
 * Collapsed weeks (Set of week identifiers)
 * @type {Set<string>}
 * @private
 */
let _collapsedWeeks = new Set();

/**
 * Loading state indicator
 * @type {boolean}
 * @private
 */
let _isLoading = false;

// ============================================================================
// RELEASABILITY EVENTS
// ============================================================================

/**
 * Event names for releasability board state changes
 */
export const RELEASABILITY_EVENTS = {
  /** Fired when projects list changes */
  PROJECTS_CHANGED: 'releasability:projects-changed',

  /** Fired when a project is added */
  PROJECT_ADDED: 'releasability:project-added',

  /** Fired when a project is removed */
  PROJECT_REMOVED: 'releasability:project-removed',

  /** Fired when a project's week changes */
  PROJECT_WEEK_CHANGED: 'releasability:project-week-changed',

  /** Fired when a tracking item status is updated */
  STATUS_UPDATED: 'releasability:status-updated',

  /** Fired when data is loaded from external source */
  DATA_LOADED: 'releasability:data-loaded',

  /** Fired when the current view week changes */
  VIEW_WEEK_CHANGED: 'releasability:view-week-changed',

  /** Fired when filters change */
  FILTERS_CHANGED: 'releasability:filters-changed',

  /** Fired when loading state changes */
  LOADING_CHANGED: 'releasability:loading-changed',

  /** Fired when a week is collapsed/expanded */
  WEEK_COLLAPSED_CHANGED: 'releasability:week-collapsed-changed'
};

// ============================================================================
// GETTERS - Projects
// ============================================================================

/**
 * Get all projects
 * @returns {Array<Object>} All projects in the board
 */
export function getAllProjects() {
  return [..._projects];
}

/**
 * Get a specific project by ID
 * @param {string} projectId - The unique project ID
 * @returns {Object|null} The project or null if not found
 */
export function getProjectById(projectId) {
  return _projects.find(p => p.id === projectId) || null;
}

/**
 * Get all projects for a specific week
 * @param {string} weekMonday - The Monday date string (YYYY-MM-DD)
 * @returns {Array<Object>} Projects scheduled for that week
 */
export function getProjectsByWeek(weekMonday) {
  return _projects.filter(p => p.weekMonday === weekMonday);
}

/**
 * Get projects grouped by week
 * @returns {Object} Map of weekMonday -> array of projects
 */
export function getProjectsByWeekGrouped() {
  const grouped = {};

  _projects.forEach(project => {
    const week = project.weekMonday;
    if (!grouped[week]) {
      grouped[week] = [];
    }
    grouped[week].push(project);
  });

  return grouped;
}

/**
 * Get all unique weeks that have projects
 * @returns {Array<string>} Sorted array of Monday date strings
 */
export function getWeeksWithProjects() {
  const weeks = new Set(_projects.map(p => p.weekMonday));
  return Array.from(weeks).sort();
}

/**
 * Get filtered projects based on current filters
 * @returns {Array<Object>} Filtered projects
 */
export function getFilteredProjects() {
  let filtered = [..._projects];

  // Apply department filter
  if (_departmentFilters.length > 0) {
    filtered = filtered.filter(p =>
      p.department && _departmentFilters.includes(p.department)
    );
  }

  // Apply search query
  if (_searchQuery.trim()) {
    const query = _searchQuery.toLowerCase();
    filtered = filtered.filter(p =>
      p.project.toLowerCase().includes(query)
    );
  }

  // Apply hide completed filter
  if (_hideCompleted) {
    filtered = filtered.filter(p => !isProjectFullyComplete(p));
  }

  return filtered;
}

// ============================================================================
// GETTERS - View State
// ============================================================================

/**
 * Get the current view week
 * @returns {string|null} Current view week Monday date or null
 */
export function getCurrentViewWeek() {
  return _currentViewWeek;
}

/**
 * Get active department filters
 * @returns {Array<string>} Array of department names
 */
export function getDepartmentFilters() {
  return [..._departmentFilters];
}

/**
 * Get current search query
 * @returns {string} The search query string
 */
export function getSearchQuery() {
  return _searchQuery;
}

/**
 * Get hideCompleted flag
 * @returns {boolean} True if completed projects should be hidden
 */
export function getHideCompleted() {
  return _hideCompleted;
}

/**
 * Get loading state
 * @returns {boolean} True if data is being loaded
 */
export function isLoading() {
  return _isLoading;
}

/**
 * Get collapsed weeks
 * @returns {Set<string>} Set of collapsed week identifiers
 */
export function getCollapsedWeeks() {
  return new Set(_collapsedWeeks);
}

/**
 * Check if a week is collapsed
 * @param {string} weekIdentifier - Week Monday date or manual week ID
 * @returns {boolean} True if the week is collapsed
 */
export function isWeekCollapsed(weekIdentifier) {
  return _collapsedWeeks.has(weekIdentifier);
}

// ============================================================================
// SETTERS - Projects
// ============================================================================

/**
 * Set all projects (replaces entire list)
 * @param {Array<Object>} projects - The projects array
 * @param {boolean} silent - If true, don't emit events
 */
export function setProjects(projects, silent = false) {
  _projects = projects;

  if (!silent) {
    emit(RELEASABILITY_EVENTS.PROJECTS_CHANGED, { projects: [..._projects] });
  }
}

/**
 * Add a single project to the list
 * @param {Object} project - The project object
 * @param {boolean} silent - If true, don't emit events
 * @returns {Object} The added project
 */
export function addProject(project, silent = false) {
  // Ensure project has required fields
  const newProject = {
    id: project.id || generateProjectId(),
    project: project.project,
    weekMonday: project.weekMonday,
    actualStartDate: project.actualStartDate || project.weekMonday,
    department: project.department || null,
    source: project.source || PROJECT_SOURCE.MANUAL,
    manualWeekId: project.manualWeekId || null,
    trackingStatus: project.trackingStatus || { ...DEFAULT_TRACKING_STATUS },
    createdAt: project.createdAt || new Date().toISOString(),
    updatedAt: project.updatedAt || new Date().toISOString()
  };

  _projects.push(newProject);

  if (!silent) {
    emit(RELEASABILITY_EVENTS.PROJECT_ADDED, { project: newProject });
    emit(RELEASABILITY_EVENTS.PROJECTS_CHANGED, { projects: [..._projects] });
  }

  return newProject;
}

/**
 * Remove a project by ID
 * @param {string} projectId - The unique project ID
 * @param {boolean} silent - If true, don't emit events
 * @returns {boolean} True if project was removed
 */
export function removeProject(projectId, silent = false) {
  const index = _projects.findIndex(p => p.id === projectId);

  if (index === -1) {
    return false;
  }

  const removed = _projects.splice(index, 1)[0];

  if (!silent) {
    emit(RELEASABILITY_EVENTS.PROJECT_REMOVED, { project: removed });
    emit(RELEASABILITY_EVENTS.PROJECTS_CHANGED, { projects: [..._projects] });
  }

  return true;
}

/**
 * Update a project's week
 * @param {string} projectId - The project ID
 * @param {string} newWeekMonday - The new week Monday date
 * @param {boolean} silent - If true, don't emit events
 * @returns {Object|null} The updated project or null
 */
export function updateProjectWeek(projectId, newWeekMonday, silent = false) {
  const project = _projects.find(p => p.id === projectId);

  if (!project) {
    return null;
  }

  const oldWeek = project.weekMonday;
  project.weekMonday = newWeekMonday;
  project.updatedAt = new Date().toISOString();

  if (!silent) {
    emit(RELEASABILITY_EVENTS.PROJECT_WEEK_CHANGED, {
      project,
      oldWeek,
      newWeek: newWeekMonday
    });
    emit(RELEASABILITY_EVENTS.PROJECTS_CHANGED, { projects: [..._projects] });
  }

  return project;
}

/**
 * Update a tracking item status for a project
 * @param {string} projectId - The project ID
 * @param {string} trackingItem - The tracking item name
 * @param {string} newStatus - The new status value
 * @param {boolean} silent - If true, don't emit events
 * @returns {Object|null} The updated project or null
 */
export function updateProjectStatus(projectId, trackingItem, newStatus, silent = false) {
  const project = _projects.find(p => p.id === projectId);

  if (!project) {
    return null;
  }

  const oldStatus = project.trackingStatus[trackingItem];
  project.trackingStatus[trackingItem] = newStatus;
  project.updatedAt = new Date().toISOString();

  if (!silent) {
    emit(RELEASABILITY_EVENTS.STATUS_UPDATED, {
      project,
      trackingItem,
      oldStatus,
      newStatus
    });
  }

  return project;
}

/**
 * Batch update multiple tracking statuses for a project
 * @param {string} projectId - The project ID
 * @param {Object} statusUpdates - Map of trackingItem -> newStatus
 * @param {boolean} silent - If true, don't emit events
 * @returns {Object|null} The updated project or null
 */
export function batchUpdateStatuses(projectId, statusUpdates, silent = false) {
  const project = _projects.find(p => p.id === projectId);

  if (!project) {
    return null;
  }

  Object.entries(statusUpdates).forEach(([trackingItem, newStatus]) => {
    project.trackingStatus[trackingItem] = newStatus;
  });

  project.updatedAt = new Date().toISOString();

  if (!silent) {
    emit(RELEASABILITY_EVENTS.STATUS_UPDATED, {
      project,
      batchUpdate: true,
      updates: statusUpdates
    });
  }

  return project;
}

// ============================================================================
// SETTERS - View State
// ============================================================================

/**
 * Set the current view week
 * @param {string|null} weekMonday - The Monday date string or null
 * @param {boolean} silent - If true, don't emit events
 */
export function setCurrentViewWeek(weekMonday, silent = false) {
  const oldWeek = _currentViewWeek;
  _currentViewWeek = weekMonday;

  if (!silent && oldWeek !== weekMonday) {
    emit(RELEASABILITY_EVENTS.VIEW_WEEK_CHANGED, {
      oldWeek,
      newWeek: weekMonday
    });
  }
}

/**
 * Set department filters
 * @param {Array<string>} departments - Array of department names
 * @param {boolean} silent - If true, don't emit events
 */
export function setDepartmentFilters(departments, silent = false) {
  _departmentFilters = [...departments];

  if (!silent) {
    emit(RELEASABILITY_EVENTS.FILTERS_CHANGED, {
      departments: _departmentFilters,
      searchQuery: _searchQuery,
      hideCompleted: _hideCompleted
    });
  }
}

/**
 * Set search query
 * @param {string} query - The search query string
 * @param {boolean} silent - If true, don't emit events
 */
export function setSearchQuery(query, silent = false) {
  _searchQuery = query;

  if (!silent) {
    emit(RELEASABILITY_EVENTS.FILTERS_CHANGED, {
      departments: _departmentFilters,
      searchQuery: _searchQuery,
      hideCompleted: _hideCompleted
    });
  }
}

/**
 * Set hideCompleted flag
 * @param {boolean} value - True to hide completed projects
 * @param {boolean} silent - If true, don't emit events
 */
export function setHideCompleted(value, silent = false) {
  _hideCompleted = value;

  if (!silent) {
    emit(RELEASABILITY_EVENTS.FILTERS_CHANGED, {
      departments: _departmentFilters,
      searchQuery: _searchQuery,
      hideCompleted: _hideCompleted
    });
  }
}

/**
 * Set loading state
 * @param {boolean} loading - True if loading
 * @param {boolean} silent - If true, don't emit events
 */
export function setLoading(loading, silent = false) {
  _isLoading = loading;

  if (!silent) {
    emit(RELEASABILITY_EVENTS.LOADING_CHANGED, { isLoading: loading });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique project ID
 * @returns {string} A unique ID string
 */
function generateProjectId() {
  return `project_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get the next status in the cycle
 * @param {string} currentStatus - The current status value
 * @returns {string} The next status in the cycle
 */
export function getNextStatus(currentStatus) {
  switch (currentStatus) {
    case STATUS.INCOMPLETE:
      return STATUS.IN_PROGRESS;
    case STATUS.IN_PROGRESS:
      return STATUS.COMPLETE;
    case STATUS.COMPLETE:
      return STATUS.INCOMPLETE;
    default:
      return STATUS.INCOMPLETE;
  }
}

/**
 * Check if a project exists by ID
 * @param {string} projectId - The project ID
 * @returns {boolean} True if project exists
 */
export function projectExists(projectId) {
  return _projects.some(p => p.id === projectId);
}

/**
 * Get completion percentage for a project
 * @param {string} projectId - The project ID
 * @returns {number} Percentage (0-100) of completed tracking items
 */
export function getProjectCompletion(projectId) {
  const project = getProjectById(projectId);

  if (!project) {
    return 0;
  }

  const statuses = Object.values(project.trackingStatus);
  const completed = statuses.filter(s => s === STATUS.COMPLETE).length;

  return Math.round((completed / statuses.length) * 100);
}

/**
 * Check if a project is fully complete (all tracking items are complete)
 * @param {Object} project - The project object
 * @returns {boolean} True if all tracking items are complete
 */
export function isProjectFullyComplete(project) {
  if (!project || !project.trackingStatus) {
    console.log(`❌ Project "${project?.project}" - No trackingStatus`);
    return false;
  }

  // Only check the CURRENT tracking items from config, not all stored keys
  const incompleteItems = TRACKING_ITEMS.filter(item => {
    const status = project.trackingStatus[item];
    return !status || status !== STATUS.COMPLETE;
  });

  const isComplete = incompleteItems.length === 0;

  // Debug: Log incomplete projects
  if (!isComplete) {
    const details = incompleteItems.map(item => {
      const status = project.trackingStatus[item] || 'missing';
      return `${item}: ${status}`;
    });
    console.log(`⚠️ Project "${project.project}" not fully complete:`, details);
  }

  // Project is fully complete only if ALL current tracking items are 'complete'
  return isComplete;
}

/**
 * Toggle a week's collapsed state
 * @param {string} weekIdentifier - Week Monday date or manual week ID
 * @param {boolean} silent - If true, don't emit events
 */
export function toggleWeekCollapsed(weekIdentifier, silent = false) {
  if (_collapsedWeeks.has(weekIdentifier)) {
    _collapsedWeeks.delete(weekIdentifier);
  } else {
    _collapsedWeeks.add(weekIdentifier);
  }

  // Save to localStorage
  saveCollapsedWeeksPreference();

  if (!silent) {
    emit(RELEASABILITY_EVENTS.WEEK_COLLAPSED_CHANGED, {
      weekIdentifier,
      isCollapsed: _collapsedWeeks.has(weekIdentifier)
    });
  }
}

/**
 * Set a week's collapsed state
 * @param {string} weekIdentifier - Week Monday date or manual week ID
 * @param {boolean} collapsed - True to collapse, false to expand
 * @param {boolean} silent - If true, don't emit events
 */
export function setWeekCollapsed(weekIdentifier, collapsed, silent = false) {
  const wasCollapsed = _collapsedWeeks.has(weekIdentifier);

  if (collapsed) {
    _collapsedWeeks.add(weekIdentifier);
  } else {
    _collapsedWeeks.delete(weekIdentifier);
  }

  // Only save and emit if state actually changed
  if (wasCollapsed !== collapsed) {
    saveCollapsedWeeksPreference();

    if (!silent) {
      emit(RELEASABILITY_EVENTS.WEEK_COLLAPSED_CHANGED, {
        weekIdentifier,
        isCollapsed: collapsed
      });
    }
  }
}

/**
 * Save collapsed weeks preference to localStorage
 */
function saveCollapsedWeeksPreference() {
  try {
    const weeksArray = Array.from(_collapsedWeeks);
    localStorage.setItem('releasability-collapsed-weeks', JSON.stringify(weeksArray));
  } catch (error) {
    console.error('Error saving collapsed weeks preference:', error);
  }
}

/**
 * Load collapsed weeks preference from localStorage
 */
export function loadCollapsedWeeksPreference() {
  try {
    const saved = localStorage.getItem('releasability-collapsed-weeks');
    if (saved) {
      const weeksArray = JSON.parse(saved);
      _collapsedWeeks = new Set(weeksArray);
    }
  } catch (error) {
    console.error('Error loading collapsed weeks preference:', error);
    _collapsedWeeks = new Set();
  }
}

/**
 * Clear all state (useful for testing/reset)
 * @param {boolean} silent - If true, don't emit events
 */
export function clearState(silent = false) {
  _projects = [];
  _currentViewWeek = null;
  _departmentFilters = [];
  _searchQuery = '';
  _hideCompleted = false;
  _collapsedWeeks = new Set();
  _isLoading = false;

  if (!silent) {
    emit(RELEASABILITY_EVENTS.PROJECTS_CHANGED, { projects: [] });
  }
}

/**
 * Get a snapshot of the entire state (for debugging)
 * @returns {Object} Complete state snapshot
 */
export function getStateSnapshot() {
  return {
    projects: [..._projects],
    currentViewWeek: _currentViewWeek,
    departmentFilters: [..._departmentFilters],
    searchQuery: _searchQuery,
    hideCompleted: _hideCompleted,
    isLoading: _isLoading,
    projectCount: _projects.length,
    weeksWithProjects: getWeeksWithProjects()
  };
}
