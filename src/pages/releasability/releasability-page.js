/**
 * Releasability Board - Main Page Controller
 *
 * Initializes and controls the releasability board page, managing all
 * user interactions, data loading, and view updates.
 *
 * @module pages/releasability/releasability-page
 */

import { on, EVENTS } from '../../core/event-bus.js';
import {
  RELEASABILITY_EVENTS,
  getAllProjects,
  getFilteredProjects,
  addProject,
  removeProject,
  updateProjectWeek,
  updateProjectStatus,
  getNextStatus,
  setSearchQuery,
  setDepartmentFilters,
  setHideCompleted,
  getHideCompleted,
  setLoading,
  getStateSnapshot,
  setProjects,
  getWeeksWithProjects,
  toggleWeekCollapsed,
  loadCollapsedWeeksPreference
} from './releasability-state.js';
import {
  TRACKING_ITEMS,
  PROJECT_SOURCE,
  VALIDATION,
  STATUS_DISPLAY
} from '../../config/releasability-config.js';
import { renderReleasabilityGrid, getUniqueDepartments, setProjectActions } from './releasability-grid.js';
import { getMonday } from '../../utils/date-utils.js';
import { normalizeProjectName } from '../../utils/ui-utils.js';
import {
  loadAllReleasabilityData,
  saveTrackingStatus,
  deleteTrackingStatus,
  loadManualWeeks,
  saveManualWeek,
  deleteManualWeek,
  updateManualWeekPositions,
  updateManualWeekName
} from '../../services/releasability-data-service.js';
import {
  setupCacheSubscription,
  removeCacheSubscription
} from '../../services/sheets-cache-service.js';
import { registerRefreshHandler } from '../../services/supabase-service.js';
import { debug } from '../../utils/debug.js';

// ============================================================================
// GLOBAL STATE
// ============================================================================

let manualWeeks = []; // Store manual weeks globally
let copiedTrackingStatus = null; // Store copied tracking status for paste operation
let cachedProjects = null; // Cache loaded projects to prevent duplicate loads
let isInitializing = false; // Flag to prevent cache subscription from triggering during init
let isManualRefreshing = false; // Flag to prevent cache subscription from overwriting a manual refresh

/**
 * Get whether there is a copied tracking status
 * @returns {boolean} True if there is copied status
 */
export function hasCopiedStatus() {
  return copiedTrackingStatus !== null;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the releasability board page
 */
async function init() {
  debug.log('🔍 init() called');
  debug.trace('Init call stack:');

  // Set up project action callbacks for the grid (avoids circular dependency)
  setProjectActions({
    hasCopiedStatus,
    handleCopyStatus,
    handlePasteStatus,
    handleDeleteProject
  });

  // Set up event listeners
  setupEventListeners();

  // Set up state change handlers
  setupStateHandlers();

  // Set up cache subscription for real-time updates
  setupCacheSubscription(handleCacheUpdate);

  // Register refresh handler for silent sync when other clients make changes
  registerRefreshHandler(handleSilentRefresh);

  // Show initial loading state
  setLoading(true);

  try {
    // Load preferences from localStorage
    loadHideCompletedPreference();
    loadCollapsedWeeksPreference();

    // TODO: Load data from services (will implement in later steps)
    // For now, show empty state or test data
    await loadInitialData();

    // Initial render
    renderGrid();

  } catch (error) {
    console.error('❌ Error initializing releasability board:', error);
    showError('Failed to load releasability data. Please refresh the page.');
  } finally {
    setLoading(false);
  }
}

/**
 * Load initial data from services
 * @param {boolean} forceRefresh - If true, bypass cache and fetch fresh data from Google Sheets
 */
async function loadInitialData(forceRefresh = false) {
  try {
    // If we have cached data and not forcing refresh, reuse it
    if (!forceRefresh && cachedProjects !== null) {
      debug.log('🔄 Reusing cached projects data (skipping duplicate load)');
      setProjects(cachedProjects);
      return;
    }

    // Load all data in parallel (projects + manual weeks)
    const [projects, weeks] = await Promise.all([
      loadAllReleasabilityData(forceRefresh),
      loadManualWeeks()
    ]);

    // Cache the loaded projects
    cachedProjects = projects;

    // Set projects in state
    setProjects(projects);

    // Store manual weeks
    manualWeeks = weeks;

  } catch (error) {
    console.error('❌ Error loading releasability data:', error);
    // Don't throw - allow app to start with empty state
    // User can still add manual projects
  }
}

/**
 * Handle cache update broadcast from another client
 * This is called when the Google Sheets cache is refreshed by any client
 */
async function handleCacheUpdate(payload) {
  debug.log('📡 Cache update received, refreshing data silently...', payload);

  // Skip if a manual refresh is already in progress - the manual refresh will
  // handle rendering the fresh data. Without this guard, the cache subscription
  // fires during the manual refresh and loads stale cached data that overwrites
  // the fresh data, causing the UI to "flash" and revert.
  if (isManualRefreshing) {
    debug.log('⏭️ Skipping cache update - manual refresh in progress');
    return;
  }

  try {
    // Invalidate local cache to force fresh load
    cachedProjects = null;

    // Reload data without showing loading spinner
    await loadInitialData();

    // Re-render grid with fresh data
    renderGrid();

    debug.log('✅ Data refreshed from cache update');

  } catch (error) {
    console.error('❌ Error refreshing data after cache update:', error);
    // Silently fail - don't disrupt user experience
  }
}

/**
 * Handle refresh signal from another client
 * This is called when another client updates releasability data (status changes, etc.)
 */
async function handleSilentRefresh(payload) {
  debug.log('📡 Refresh signal received from another client, syncing data...', payload);

  // Skip if a manual refresh is already in progress
  if (isManualRefreshing) {
    debug.log('⏭️ Skipping silent refresh - manual refresh in progress');
    return;
  }

  try {
    // Invalidate local cache to force fresh load
    cachedProjects = null;

    // Reload data without showing loading spinner
    await loadInitialData();

    // Re-render grid with fresh data
    renderGrid();

    debug.log('✅ Data synced from refresh signal');

  } catch (error) {
    console.error('❌ Error syncing data after refresh signal:', error);
    // Silently fail - don't disrupt user experience
  }
}

// ============================================================================
// EVENT LISTENERS - UI Interactions
// ============================================================================

/**
 * Set up all DOM event listeners
 */
let eventListenersInitialized = false;
function setupEventListeners() {
  debug.log('🔍 setupEventListeners called, initialized:', eventListenersInitialized);
  // Prevent multiple registrations
  if (eventListenersInitialized) {
    debug.log('⚠️ setupEventListeners already initialized, returning');
    return;
  }
  eventListenersInitialized = true;
  debug.log('✅ Setting up event listeners');
  // Navigation buttons - REMOVED (UI elements deleted)
  // document.getElementById('prev-week-btn')?.addEventListener('click', handlePrevWeek);
  // document.getElementById('next-week-btn')?.addEventListener('click', handleNextWeek);
  // document.getElementById('current-week-btn')?.addEventListener('click', handleCurrentWeek);

  // Action buttons - REMOVED (UI elements deleted)
  // document.getElementById('add-project-btn')?.addEventListener('click', handleAddProjectClick);
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) refreshBtn.addEventListener('click', handleRefresh);
  const printBtn = document.getElementById('print-btn');
  if (printBtn) printBtn.addEventListener('click', handlePrint);

  // Add week button
  const addWeekBtn = document.getElementById('add-week-btn');
  if (addWeekBtn && !window.__addWeekListenerAdded) {
    window.__addWeekListenerAdded = true;
    addWeekBtn.addEventListener('click', handleAddWeekClick);
    debug.log('✅ Add Week listener attached');
  } else if (addWeekBtn) {
    debug.log('⚠️ Add Week listener already attached, skipping');
  }

  // Fullscreen button
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    });
  }

  // Fullscreen change handler to toggle icons
  document.addEventListener('fullscreenchange', () => {
    const isFullscreen = !!document.fullscreenElement;
    const expandIcon = document.getElementById('fullscreen-icon-expand');
    const compressIcon = document.getElementById('fullscreen-icon-compress');

    if (expandIcon && compressIcon) {
      expandIcon.style.display = isFullscreen ? 'none' : 'block';
      compressIcon.style.display = isFullscreen ? 'block' : 'none';
    }
  });

  // Tab visibility change - refresh data when tab becomes visible
  on(EVENTS.PAGE_VISIBLE, () => {
    handleSilentRefresh();
  });

  // Hide completed toggle
  const hideCompletedToggle = document.getElementById('hide-completed-toggle');
  if (hideCompletedToggle) {
    hideCompletedToggle.addEventListener('change', handleHideCompletedToggle);
  }

  // Search input - REMOVED (UI element deleted)
  // const searchInput = document.getElementById('project-search');
  // if (searchInput) {
  //   searchInput.addEventListener('input', handleSearchInput);
  // }

  // Clear filters button - REMOVED (UI element deleted)
  // document.getElementById('clear-filters-btn')?.addEventListener('click', handleClearFilters);

  // Modal controls - REMOVED (modal deleted)
  // document.getElementById('close-modal-btn')?.addEventListener('click', closeAddProjectModal);
  // document.getElementById('cancel-add-btn')?.addEventListener('click', closeAddProjectModal);
  // document.getElementById('add-project-form')?.addEventListener('submit', handleAddProjectSubmit);

  // Close modal on background click - REMOVED (modal deleted)
  // document.getElementById('add-project-modal')?.addEventListener('click', (e) => {
  //   if (e.target.id === 'add-project-modal') {
  //     closeAddProjectModal();
  //   }
  // });

}

/**
 * Set up state change handlers
 */
function setupStateHandlers() {
  // Re-render when projects change
  on(RELEASABILITY_EVENTS.PROJECTS_CHANGED, () => {
    renderGrid();
  });

  // Re-render when filters change
  on(RELEASABILITY_EVENTS.FILTERS_CHANGED, () => {
    renderGrid();
  });

  // Re-render when status updated (if hide completed is active)
  on(RELEASABILITY_EVENTS.STATUS_UPDATED, () => {
    if (getHideCompleted()) {
      renderGrid();
    }
  });

  // Handle loading state changes
  on(RELEASABILITY_EVENTS.LOADING_CHANGED, ({ isLoading }) => {
    updateLoadingState(isLoading);
  });
}

// ============================================================================
// NAVIGATION HANDLERS
// ============================================================================

function handlePrevWeek() {
  const weeks = getWeeksWithProjects().sort();

  if (weeks.length === 0) {
    showNotification('No weeks to navigate');
    return;
  }

  // Find first visible week in viewport
  const visibleWeek = findVisibleWeek();

  if (!visibleWeek) {
    // Scroll to first week
    scrollToWeek(weeks[0]);
    return;
  }

  // Find previous week
  const currentIndex = weeks.indexOf(visibleWeek);
  const prevWeek = currentIndex > 0 ? weeks[currentIndex - 1] : weeks[0];

  scrollToWeek(prevWeek);
}

function handleNextWeek() {
  const weeks = getWeeksWithProjects().sort();

  if (weeks.length === 0) {
    showNotification('No weeks to navigate');
    return;
  }

  // Find first visible week in viewport
  const visibleWeek = findVisibleWeek();

  if (!visibleWeek) {
    // Scroll to first week
    scrollToWeek(weeks[0]);
    return;
  }

  // Find next week
  const currentIndex = weeks.indexOf(visibleWeek);
  const nextWeek = currentIndex < weeks.length - 1 ? weeks[currentIndex + 1] : weeks[weeks.length - 1];

  scrollToWeek(nextWeek);
}

function handleCurrentWeek() {
  const today = new Date();
  const currentMonday = getMonday(today);
  const currentWeekStr = currentMonday.toISOString().split('T')[0];

  // Scroll to current week
  scrollToWeek(currentWeekStr);
}

/**
 * Find the first visible week header in the viewport
 * @returns {string|null} Week Monday string or null
 */
function findVisibleWeek() {
  const weekHeaders = document.querySelectorAll('.week-header-cell');
  const viewportTop = window.scrollY;
  const viewportBottom = viewportTop + window.innerHeight;

  for (const header of weekHeaders) {
    const rect = header.getBoundingClientRect();
    const elementTop = rect.top + window.scrollY;

    // Check if header is in viewport
    if (elementTop >= viewportTop && elementTop <= viewportBottom) {
      return header.dataset.weekMonday;
    }
  }

  return null;
}

/**
 * Scroll to a specific week
 * @param {string} weekMonday - Week Monday date string
 */
function scrollToWeek(weekMonday) {
  const weekHeader = document.querySelector(`.week-header-cell[data-week-monday="${weekMonday}"]`);

  if (weekHeader) {
    weekHeader.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    showNotification(`Week ${weekMonday} not found`);
  }
}

// ============================================================================
// ACTION HANDLERS
// ============================================================================

function handleAddProjectClick() {
  openAddProjectModal();
}

function handleRefresh() {
  setLoading(true);
  isManualRefreshing = true;
  // Force refresh to bypass cache and get fresh data from Google Sheets
  loadInitialData(true)
    .then(() => {
      renderGrid();
      showNotification('Data refreshed successfully!');
    })
    .catch(error => {
      console.error('Error refreshing:', error);
      showError('Failed to refresh data');
    })
    .finally(() => {
      isManualRefreshing = false;
      setLoading(false);
    });
}

function handlePrint() {
  const projects = getFilteredProjects();
  if (projects.length === 0) return;

  // Group projects by week
  const projectsByWeek = {};
  projects.forEach(p => {
    const key = p.manualWeekId || p.weekMonday;
    if (!projectsByWeek[key]) projectsByWeek[key] = [];
    projectsByWeek[key].push(p);
  });

  const weekKeys = Object.keys(projectsByWeek).sort();
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const fullMonthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // Build week label helper
  function getWeekLabel(weekKey) {
    const mw = manualWeeks.find(w => typeof w === 'object' && w.id === weekKey);
    if (mw) return mw.name || mw.id;
    if (/^\d{4}-\d{2}-\d{2}$/.test(weekKey)) {
      const monday = new Date(weekKey + 'T00:00:00');
      const saturday = new Date(monday);
      saturday.setDate(saturday.getDate() + 5);
      const startMonth = monthNames[monday.getMonth()];
      const endMonth = monthNames[saturday.getMonth()];
      const startDay = monday.getDate();
      const endDay = saturday.getDate();
      const dateRange = monday.getMonth() === saturday.getMonth()
        ? `${startMonth} ${startDay}-${endDay}`
        : `${startMonth} ${startDay}-${endMonth} ${endDay}`;
      return `Week of ${dateRange}`;
    }
    return weekKey;
  }

  // Collect unique months from date-based weeks
  const months = new Map();
  weekKeys.forEach(key => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
      const d = new Date(key + 'T00:00:00');
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!months.has(monthKey)) {
        months.set(monthKey, `${fullMonthNames[d.getMonth()]} ${d.getFullYear()}`);
      }
    }
  });

  // Build modal
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 420px;">
      <div class="modal-header">
        <h2>Print Report</h2>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div style="margin-bottom: 16px;">
          <label style="font-weight: 600; font-size: 14px; display: block; margin-bottom: 8px;">Filter by Month</label>
          <select id="print-month-filter" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px; font-size: 13px;">
            <option value="all">All Months</option>
            ${Array.from(months.entries()).map(([val, label]) => `<option value="${val}">${label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-weight: 600; font-size: 14px; display: block; margin-bottom: 8px;">Select Weeks</label>
          <div id="print-week-list" style="max-height: 260px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 6px; padding: 4px;">
            ${weekKeys.map(key => `
              <label style="display: flex; align-items: center; padding: 6px 8px; cursor: pointer; gap: 8px; font-size: 13px;" data-week="${key}" data-month="${/^\d{4}-\d{2}-\d{2}$/.test(key) ? key.substring(0, 7) : ''}">
                <input type="checkbox" value="${key}" checked style="margin: 0;" />
                ${getWeekLabel(key)}
                <span style="color: #999; margin-left: auto; font-size: 11px;">(${(projectsByWeek[key] || []).length})</span>
              </label>
            `).join('')}
          </div>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 16px; justify-content: flex-end;">
          <button id="print-cancel-btn" style="padding: 8px 16px; border: 1px solid #ccc; border-radius: 6px; background: white; cursor: pointer; font-size: 13px;">Cancel</button>
          <button id="print-confirm-btn" style="padding: 8px 16px; border: none; border-radius: 6px; background: #2563eb; color: white; cursor: pointer; font-size: 13px; font-weight: 500;">Print</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Month filter handler
  const monthSelect = modal.querySelector('#print-month-filter');
  const weekLabels = modal.querySelectorAll('#print-week-list label');
  monthSelect.addEventListener('change', () => {
    const selected = monthSelect.value;
    weekLabels.forEach(label => {
      const cb = label.querySelector('input');
      const weekMonth = label.dataset.month;
      if (selected === 'all') {
        label.style.display = 'flex';
        cb.checked = true;
      } else {
        if (weekMonth === selected) {
          label.style.display = 'flex';
          cb.checked = true;
        } else {
          label.style.display = 'none';
          cb.checked = false;
        }
      }
    });
  });

  // Close handlers
  const closeModal = () => modal.remove();
  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  modal.querySelector('#print-cancel-btn').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  // Print handler
  modal.querySelector('#print-confirm-btn').addEventListener('click', () => {
    const selectedWeeks = new Set();
    modal.querySelectorAll('#print-week-list input:checked').forEach(cb => selectedWeeks.add(cb.value));
    closeModal();
    if (selectedWeeks.size === 0) return;
    executePrint(projects, projectsByWeek, selectedWeeks, getWeekLabel);
  });
}

function executePrint(projects, projectsByWeek, selectedWeeks, getWeekLabel) {
  const weekKeys = Array.from(selectedWeeks).sort();

  let tableRows = '';
  weekKeys.forEach(weekKey => {
    if (!projectsByWeek[weekKey]) return;
    tableRows += `<tr class="week-header"><td colspan="2">${getWeekLabel(weekKey)}</td></tr>`;

    const weekProjects = projectsByWeek[weekKey].sort((a, b) => {
      const dateA = a.actualStartDate || a.weekMonday || '';
      const dateB = b.actualStartDate || b.weekMonday || '';
      return dateA.localeCompare(dateB) || a.project.localeCompare(b.project);
    });

    weekProjects.forEach(p => {
      let startDate = '--';
      if (p.actualStartDate) {
        const d = new Date(p.actualStartDate + 'T00:00:00');
        const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        startDate = `${days[d.getDay()]} ${d.getDate()}`;
      }
      tableRows += `<tr><td class="project-name">${p.project}</td><td class="start-date">${startDate}</td></tr>`;
    });
  });

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const printHtml = `<!DOCTYPE html>
<html><head><title>Releasability Board - ${dateStr}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 0.5in; }
  h1 { font-size: 18px; margin: 0 0 2px 0; }
  .print-date { font-size: 11px; color: #666; margin-bottom: 12px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #bbb; padding: 4px 8px; }
  th { background: #f0f0f0; text-align: left; font-size: 11px; }
  .project-name { font-size: 11px; }
  .start-date { text-align: center; font-size: 11px; width: 70px; }
  .week-header td { background: #e3e8f0; font-weight: bold; font-size: 12px; padding: 5px 8px; }
  @page { size: portrait; margin: 0.5in; }
</style></head><body>
<h1>Releasability Board</h1>
<div class="print-date">${dateStr}</div>
<table>
  <thead><tr><th>Project</th><th style="width:70px;text-align:center;">Start</th></tr></thead>
  <tbody>${tableRows}</tbody>
</table>
</body></html>`;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(printHtml);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function handleSearchInput(e) {
  const query = e.target.value;
  setSearchQuery(query);
}

function handleClearFilters() {
  setSearchQuery('');
  setDepartmentFilters([]);

  // Clear search input
  const searchInput = document.getElementById('project-search');
  if (searchInput) {
    searchInput.value = '';
  }

  showNotification('Filters cleared');
}

// ============================================================================
// MODAL MANAGEMENT
// ============================================================================

function openAddProjectModal() {
  const modal = document.getElementById('add-project-modal');
  if (modal) {
    modal.style.display = 'flex';

    // Set default date to current date
    const dateInput = document.getElementById('project-week');
    if (dateInput) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.value = today;
    }

    // Populate department dropdown
    populateDepartmentDropdown();

    // Focus on project name input
    setTimeout(() => {
      const projectNameInput = document.getElementById('project-name');
      if (projectNameInput) projectNameInput.focus();
    }, 100);
  }
}

/**
 * Populate the department dropdown in the add project modal
 */
function populateDepartmentDropdown() {
  const select = document.getElementById('project-department');
  if (!select) return;

  // Get unique departments
  const allProjects = getAllProjects();
  const departments = getUniqueDepartments(allProjects).filter(d => d); // Filter out empty

  // Clear existing options except the first one
  select.innerHTML = '<option value="">-- Select Department --</option>';

  // Add department options
  departments.forEach(dept => {
    const option = document.createElement('option');
    option.value = dept;
    option.textContent = dept;
    select.appendChild(option);
  });
}

function closeAddProjectModal() {
  const modal = document.getElementById('add-project-modal');
  if (modal) {
    modal.style.display = 'none';

    // Reset form
    const form = document.getElementById('add-project-form');
    if (form) {
      form.reset();
    }
  }
}

async function handleAddProjectSubmit(e) {
  e.preventDefault();

  const projectNameEl = document.getElementById('project-name');
  const projectWeekEl = document.getElementById('project-week');
  const projectDepartmentEl = document.getElementById('project-department');
  const projectName = projectNameEl ? projectNameEl.value.trim() : '';
  const projectWeek = projectWeekEl ? projectWeekEl.value : '';
  const projectDepartment = projectDepartmentEl ? projectDepartmentEl.value : '';

  // Validate
  if (!projectName || projectName.length < VALIDATION.PROJECT_NAME_MIN_LENGTH) {
    showError(`Project name must be at least ${VALIDATION.PROJECT_NAME_MIN_LENGTH} characters`);
    return;
  }

  if (!projectWeek) {
    showError('Please select a week');
    return;
  }

  try {
    // Convert selected date to Monday
    const mondayDate = getMonday(new Date(projectWeek));
    const weekMonday = mondayDate.toISOString().split('T')[0];

    // Add project to state
    const newProject = addProject({
      project: projectName,
      weekMonday: weekMonday,
      department: projectDepartment || null,
      source: PROJECT_SOURCE.MANUAL
    });

    // Save to Supabase
    try {
      await saveTrackingStatus(newProject);
    } catch (saveError) {
      console.error('❌ Failed to save project to Supabase:', saveError);
      // Don't prevent project from being added to UI
    }

    closeAddProjectModal();
    showNotification(`Project "${projectName}" added successfully!`);

  } catch (error) {
    console.error('Error adding project:', error);
    showError('Failed to add project. Please try again.');
  }
}

// ============================================================================
// RENDERING
// ============================================================================

function renderGrid() {
  const container = document.getElementById('releasability-grid-container');
  if (!container) return;

  const projects = getFilteredProjects();

  // Show empty state if no projects
  if (projects.length === 0) {
    showEmptyState();
    return;
  }

  // Hide empty state
  hideEmptyState();

  // Clear container
  container.innerHTML = '';

  // Determine which weeks contain only manual projects
  const projectsByWeek = {};
  projects.forEach(p => {
    if (!projectsByWeek[p.weekMonday]) {
      projectsByWeek[p.weekMonday] = { hasSheets: false, hasManual: false };
    }
    if (p.source === 'sheets') {
      projectsByWeek[p.weekMonday].hasSheets = true;
    } else if (p.source === 'manual') {
      projectsByWeek[p.weekMonday].hasManual = true;
    }
  });

  // A week is "manual only" if it has manual projects but no sheets projects, OR if it's a manual week with no projects
  const manualOnlyWeeks = [];
  manualWeeks.forEach(week => {
    const weekInfo = projectsByWeek[week];
    if (!weekInfo || !weekInfo.hasSheets) {
      manualOnlyWeeks.push(week);
    }
  });

  // Render the grid
  const grid = renderReleasabilityGrid(projects, manualWeeks, manualOnlyWeeks);
  container.appendChild(grid);

  // Set up grid event delegation
  setupGridEventDelegation(grid);

  // Update department filters
  updateDepartmentFilters();

  // Update paste buttons visibility
  updatePasteButtonsVisibility();
}

/**
 * Set up event delegation for grid interactions
 * @param {HTMLElement} grid - The grid container element
 */
function setupGridEventDelegation(grid) {
  grid.addEventListener('click', (e) => {
    const target = e.target.closest('.status-cell, .project-control-btn, .week-add-btn, .week-control-btn, .week-collapse-btn');
    if (!target) return;

    // Handle status cell clicks (will implement in STEP 6)
    if (target.classList.contains('status-cell')) {
      handleStatusCellClick(target);
    }

    // Handle project control button clicks
    if (target.classList.contains('project-control-btn')) {
      handleProjectControlClick(target);
    }

    // Handle week add project button clicks
    if (target.classList.contains('week-add-btn')) {
      handleWeekAddProjectClick(target);
    }

    // Handle week control button clicks (includes collapse button)
    if (target.classList.contains('week-control-btn') || target.classList.contains('week-collapse-btn')) {
      handleWeekControlClick(target);
    }
  });

  // Set up drag and drop for manual projects
  setupDragAndDrop(grid);
}

/**
 * Set up drag and drop for manual projects
 * @param {HTMLElement} grid - The grid container element
 */
function setupDragAndDrop(grid) {
  let draggedProjectId = null;
  let draggedProjectData = null;

  // Handle dragstart on project name cells
  grid.addEventListener('dragstart', (e) => {
    const projectCell = e.target.closest('.project-name-cell[draggable="true"]');
    if (!projectCell) return;

    draggedProjectId = projectCell.dataset.projectId;
    const project = getAllProjects().find(p => p.id === draggedProjectId);

    if (project) {
      draggedProjectData = {
        id: project.id,
        name: project.project,
        weekMonday: project.weekMonday,
        manualWeekId: project.manualWeekId
      };

      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedProjectId);
      projectCell.classList.add('dragging');
    }
  });

  // Handle dragend
  grid.addEventListener('dragend', (e) => {
    const projectCell = e.target.closest('.project-name-cell[draggable="true"]');
    if (projectCell) {
      projectCell.classList.remove('dragging');
    }

    // Remove drag-over class from all drop zones
    document.querySelectorAll('.drop-zone').forEach(zone => {
      zone.classList.remove('drag-over');
    });

    draggedProjectId = null;
    draggedProjectData = null;
  });

  // Handle dragover on drop zones (week headers)
  grid.addEventListener('dragover', (e) => {
    const dropZone = e.target.closest('.drop-zone');
    if (!dropZone || !draggedProjectId) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dropZone.classList.add('drag-over');
  });

  // Handle dragleave on drop zones
  grid.addEventListener('dragleave', (e) => {
    const dropZone = e.target.closest('.drop-zone');
    if (!dropZone) return;

    dropZone.classList.remove('drag-over');
  });

  // Handle drop on drop zones
  grid.addEventListener('drop', (e) => {
    e.preventDefault();

    const dropZone = e.target.closest('.drop-zone');
    if (!dropZone || !draggedProjectId || !draggedProjectData) return;

    dropZone.classList.remove('drag-over');

    const targetWeekMonday = dropZone.dataset.dropWeekMonday;
    const targetWeekId = dropZone.dataset.dropWeekId;

    // Handle the project move
    handleProjectDrop(draggedProjectId, draggedProjectData, targetWeekMonday, targetWeekId);
  });
}

/**
 * Handle project drop on a week
 * @param {string} projectId - Project ID
 * @param {Object} projectData - Project data
 * @param {string} targetWeekMonday - Target week Monday (for date-based weeks)
 * @param {string} targetWeekId - Target week ID (for manual weeks)
 */
async function handleProjectDrop(projectId, projectData, targetWeekMonday, targetWeekId) {
  // Check if dropping on the same week
  const isSameWeek = (targetWeekId && targetWeekId === projectData.manualWeekId) ||
                     (!targetWeekId && targetWeekMonday === projectData.weekMonday && !projectData.manualWeekId);

  if (isSameWeek) {
    return;
  }

  const project = getAllProjects().find(p => p.id === projectId);
  if (!project) return;

  const oldWeekMonday = project.weekMonday;
  const oldManualWeekId = project.manualWeekId;

  try {
    // Delete old tracking record
    await deleteTrackingStatus(project.project, oldWeekMonday);

    // Update project with new week
    if (targetWeekId) {
      // Moving to a manual week
      project.manualWeekId = targetWeekId;
      // Keep a weekMonday for database storage (use current week if needed)
      if (!targetWeekMonday) {
        const today = new Date();
        const currentMonday = getMonday(today);
        project.weekMonday = currentMonday.toISOString().split('T')[0];
      } else {
        project.weekMonday = targetWeekMonday;
      }
    } else {
      // Moving to a date-based week
      project.weekMonday = targetWeekMonday;
      project.manualWeekId = null;
    }

    // Save updated project
    await saveTrackingStatus(project);

    showNotification(`Moved "${project.project}" to new week`);

    // Re-render grid
    renderGrid();

  } catch (error) {
    console.error('❌ Failed to move project:', error);
    showError('Failed to move project. Please try again.');
  }
}

/**
 * Handle status cell click - cycle through statuses
 * @param {HTMLElement} cell - The clicked status cell
 */
async function handleStatusCellClick(cell) {
  const projectId = cell.dataset.projectId;
  const trackingItem = cell.dataset.trackingItem;
  const currentStatus = cell.dataset.status;

  // Get next status in the cycle
  const nextStatus = getNextStatus(currentStatus);

  // Update state
  const updatedProject = updateProjectStatus(projectId, trackingItem, nextStatus);

  if (updatedProject) {
    // Update cell visual immediately (optimistic update)
    updateCellVisual(cell, nextStatus);

    // Save to Supabase
    try {
      await saveTrackingStatus(updatedProject);
    } catch (error) {
      console.error('❌ Failed to save status to Supabase:', error);
      showError('Failed to save status change. Please try again.');
    }
  }
}

/**
 * Update a cell's visual appearance for a new status
 * @param {HTMLElement} cell - The status cell element
 * @param {string} newStatus - The new status value
 */
function updateCellVisual(cell, newStatus) {
  const statusConfig = STATUS_DISPLAY[newStatus];

  // Remove old status class
  cell.classList.remove('status-incomplete', 'status-in-progress', 'status-complete', 'status-not-applicable');

  // Convert underscore to hyphen for CSS class (in_progress -> in-progress)
  const cssStatus = newStatus.replace(/_/g, '-');

  // Add new status class
  cell.classList.add(`status-${cssStatus}`);

  // Update data attribute
  cell.dataset.status = newStatus;

  // Update icon
  const icon = cell.querySelector('.status-icon');
  if (icon) {
    icon.textContent = statusConfig.icon;
  }

  // Update tooltip
  const project = getAllProjects().find(p => p.id === cell.dataset.projectId);
  if (project) {
    cell.title = `${project.project} - ${cell.dataset.trackingItem}: ${statusConfig.label}`;
  }

  // Add visual feedback (flash animation)
  cell.classList.add('status-updated');
  setTimeout(() => {
    cell.classList.remove('status-updated');
  }, 300);
}

/**
 * Handle project control button click
 * @param {HTMLElement} button - The clicked control button
 */
function handleProjectControlClick(button) {
  const action = button.dataset.action;
  const projectId = button.dataset.projectId;

  switch (action) {
    case 'copy-status':
      handleCopyStatus(projectId);
      break;
    case 'paste-status':
      handlePasteStatus(projectId);
      break;
    case 'move-prev':
      handleMoveProjectWeek(projectId, -1);
      break;
    case 'move-next':
      handleMoveProjectWeek(projectId, 1);
      break;
    case 'delete':
      handleDeleteProject(projectId);
      break;
  }
}

/**
 * Handle week add project button click
 * @param {HTMLElement} button - The clicked add button
 */
async function handleWeekAddProjectClick(button) {
  // Handle both manual weeks (weekId) and date-based weeks (weekMonday)
  const weekMonday = button.dataset.weekMonday;
  const weekId = button.dataset.weekId;

  // Prompt for project name
  const projectName = prompt('Enter project name:');
  if (!projectName || !projectName.trim()) {
    return; // User cancelled or entered empty name
  }

  // Normalize the project name for consistent storage
  const normalizedProjectName = normalizeProjectName(projectName);

  // For manual weeks, we still need a weekMonday for database storage
  // Use current week's Monday as the base date
  let effectiveWeekMonday = weekMonday;
  if (!effectiveWeekMonday && weekId) {
    // If adding to a manual week, use current week's Monday
    const today = new Date();
    const currentMonday = getMonday(today);
    effectiveWeekMonday = currentMonday.toISOString().split('T')[0];
  }

  if (!effectiveWeekMonday) {
    console.error('❌ ERROR: effectiveWeekMonday is still null/undefined!');
    alert('Error: Could not determine week. Please refresh and try again.');
    return;
  }

  // Create new manual project
  const newProject = {
    project: normalizedProjectName,
    weekMonday: effectiveWeekMonday, // Always provide a valid weekMonday for database
    manualWeekId: weekId || null, // Use weekId for manual weeks (for display grouping)
    actualStartDate: effectiveWeekMonday, // Use the effective week Monday as start date
    department: null,
    source: PROJECT_SOURCE.MANUAL
  };

  // Add project to state
  const addedProject = addProject(newProject);

  if (addedProject) {
    // Save to Supabase
    try {
      await saveTrackingStatus(addedProject);
      showNotification(`Added project "${normalizedProjectName}"`);
    } catch (error) {
      console.error('❌ Failed to save manual project to Supabase:', error);
      showError('Failed to save project. Please try again.');
    }
  }
}

/**
 * Move a project to a different week
 * @param {string} projectId - The project ID
 * @param {number} weekOffset - Number of weeks to move (+1 or -1)
 */
async function handleMoveProjectWeek(projectId, weekOffset) {
  const project = getAllProjects().find(p => p.id === projectId);
  if (!project) return;

  const oldWeekMonday = project.weekMonday;

  // Calculate new week Monday
  const currentMonday = new Date(project.weekMonday);
  const newMonday = new Date(currentMonday);
  newMonday.setDate(newMonday.getDate() + (weekOffset * 7));

  const newMondayStr = newMonday.toISOString().split('T')[0];

  // Update project week
  const updatedProject = updateProjectWeek(projectId, newMondayStr);

  if (updatedProject) {
    // Delete old tracking record and create new one
    try {
      await deleteTrackingStatus(project.project, oldWeekMonday);
      await saveTrackingStatus(updatedProject);
    } catch (error) {
      console.error('❌ Failed to update project week in Supabase:', error);
    }

    const direction = weekOffset > 0 ? 'next' : 'previous';
    showNotification(`Moved "${project.project}" to ${direction} week`);
  }
}

/**
 * Delete a project
 * @param {string} projectId - The project ID
 */
export async function handleDeleteProject(projectId) {
  const project = getAllProjects().find(p => p.id === projectId);
  if (!project) return;

  // Delete from Supabase first
  try {
    await deleteTrackingStatus(project.project, project.weekMonday);
  } catch (error) {
    console.error('❌ Failed to delete from Supabase:', error);
    // Continue with local deletion anyway
  }

  // Remove from state
  removeProject(projectId);
  showNotification(`Deleted "${project.project}"`);
}

/**
 * Copy tracking status from a project
 * @param {string} projectId - The project ID to copy from
 */
export function handleCopyStatus(projectId) {
  const project = getAllProjects().find(p => p.id === projectId);
  if (!project) {
    showError('Project not found');
    return;
  }

  // Copy the tracking status (deep clone)
  copiedTrackingStatus = JSON.parse(JSON.stringify(project.trackingStatus));

  showNotification(`Copied status from "${project.project}"`);

  // Update UI to show paste buttons are now available
  updatePasteButtonsVisibility();
}

/**
 * Paste tracking status to a project
 * @param {string} projectId - The project ID to paste to
 */
export async function handlePasteStatus(projectId) {
  if (!copiedTrackingStatus) {
    showNotification('No status copied yet. Copy a status first.');
    return;
  }

  const project = getAllProjects().find(p => p.id === projectId);
  if (!project) {
    showError('Project not found');
    return;
  }

  // Update each tracking item status
  for (const [trackingItem, status] of Object.entries(copiedTrackingStatus)) {
    updateProjectStatus(projectId, trackingItem, status);
  }

  showNotification(`Pasted status to "${project.project}"`);

  // Save to Supabase
  try {
    const updatedProject = getAllProjects().find(p => p.id === projectId);
    if (updatedProject) {
      await saveTrackingStatus(updatedProject);
    }
  } catch (error) {
    console.error('❌ Failed to save pasted status to Supabase:', error);
    showError('Failed to save pasted status. Please try again.');
  }

  // Re-render grid to show updated statuses
  renderGrid();
}

/**
 * Update visibility of paste buttons based on whether status is copied
 */
function updatePasteButtonsVisibility() {
  // Support both old button style and new menu items
  const pasteElements = document.querySelectorAll('.paste-btn, .paste-item');
  pasteElements.forEach(btn => {
    if (copiedTrackingStatus) {
      btn.classList.add('has-copied-status');
    } else {
      btn.classList.remove('has-copied-status');
    }
  });
}

/**
 * Handle hide completed toggle change
 * @param {Event} e - Change event
 */
function handleHideCompletedToggle(e) {
  const checked = e.target.checked;

  // Update state
  setHideCompleted(checked);

  // Save preference to localStorage
  saveHideCompletedPreference(checked);

  showNotification(checked ? 'Hiding completed projects' : 'Showing all projects');
}

/**
 * Load hideCompleted preference from localStorage
 */
function loadHideCompletedPreference() {
  try {
    const saved = localStorage.getItem('releasability-hide-completed');
    const hideCompleted = saved === 'true';

    // Update state
    setHideCompleted(hideCompleted, true); // silent = true to avoid event

    // Update checkbox UI
    const toggle = document.getElementById('hide-completed-toggle');
    if (toggle) {
      toggle.checked = hideCompleted;
    }
  } catch (error) {
    console.error('Error loading hideCompleted preference:', error);
  }
}

/**
 * Save hideCompleted preference to localStorage
 * @param {boolean} value - The hideCompleted value
 */
function saveHideCompletedPreference(value) {
  try {
    localStorage.setItem('releasability-hide-completed', value.toString());
  } catch (error) {
    console.error('Error saving hideCompleted preference:', error);
  }
}

/**
 * Handle add week button click
 */
async function handleAddWeekClick() {
  debug.log('🔍 handleAddWeekClick called');
  debug.trace('Call stack:');
  // Prompt for custom week name
  const weekName = prompt('Enter a custom name for the new week:');
  if (!weekName || !weekName.trim()) {
    return; // User cancelled
  }

  // Check if name already exists
  if (manualWeeks.some(week => week.name === weekName.trim())) {
    showNotification(`Week named "${weekName.trim()}" already exists`);
    return;
  }

  // Calculate new position (append to end of entire grid)
  // Find the maximum position among existing manual weeks and add 1
  // This ensures the new week has a unique position at the very end
  const maxPosition = manualWeeks.length > 0
    ? Math.max(...manualWeeks.map(w => w.position))
    : -1;
  const newPosition = maxPosition + 1;

  // Save to Supabase
  try {
    const savedWeek = await saveManualWeek(weekName.trim(), newPosition);
    manualWeeks.push(savedWeek);
    showNotification(`Added week "${weekName.trim()}"`);

    // Re-render grid to show new week
    renderGrid();
  } catch (error) {
    console.error('❌ Failed to save manual week:', error);
    showError('Failed to add week. Please try again.');
  }
}

/**
 * Handle week control button click
 * @param {HTMLElement} button - The clicked control button
 */
function handleWeekControlClick(button) {
  const action = button.dataset.action;
  const weekId = button.dataset.weekId;
  const weekMonday = button.dataset.weekMonday;

  switch (action) {
    case 'move-week-up':
      handleMoveWeekUp(weekId);
      break;
    case 'move-week-down':
      handleMoveWeekDown(weekId);
      break;
    case 'edit-week':
      handleEditWeekName(weekId);
      break;
    case 'delete-week':
      handleDeleteManualWeek(weekId);
      break;
    case 'toggle-week-collapse':
      handleToggleWeekCollapse(weekId || weekMonday);
      break;
  }
}

/**
 * Get the full list of weeks as they appear in the grid (merged date-based and manual weeks)
 * This replicates the logic from getWeekRange in releasability-grid.js
 * @returns {Array<Object>} Array of week objects with { type: 'date'|'manual', value: string|Object, displayIndex: number }
 */
function getFullWeekList() {
  const projects = getAllProjects();

  // Group projects by week
  const projectsByWeek = {};
  projects.forEach(project => {
    const weekKey = project.manualWeekId || project.weekMonday;
    if (!projectsByWeek[weekKey]) {
      projectsByWeek[weekKey] = [];
    }
    projectsByWeek[weekKey].push(project);
  });

  // Get date-based weeks
  const today = new Date();
  const currentMonday = getMonday(today);
  const previousMonday = new Date(currentMonday);
  previousMonday.setDate(previousMonday.getDate() - 7);
  const previousMondayStr = previousMonday.toISOString().split('T')[0];

  // Get all weeks with projects (excluding manual week IDs)
  const manualWeekObjects = manualWeeks.filter(w => typeof w === 'object');
  const projectWeeks = Object.keys(projectsByWeek);

  const dateWeeks = new Set([
    previousMondayStr,
    ...projectWeeks.filter(w => !manualWeekObjects.some(mw => mw.id === w))
  ]);

  // Filter and sort date weeks
  const sortedDateWeeks = Array.from(dateWeeks)
    .sort()
    .filter(weekStr => weekStr >= previousMondayStr);

  // Merge date weeks and manual weeks based on position
  const result = [];
  let dateWeekIndex = 0;

  // Sort manual weeks by position
  const sortedManualWeeks = [...manualWeekObjects].sort((a, b) => a.position - b.position);

  // Merge based on position
  sortedManualWeeks.forEach(manualWeek => {
    // Add all date weeks before this manual week's position
    while (dateWeekIndex < manualWeek.position && dateWeekIndex < sortedDateWeeks.length) {
      result.push({
        type: 'date',
        value: sortedDateWeeks[dateWeekIndex],
        displayIndex: result.length
      });
      dateWeekIndex++;
    }
    // Add the manual week
    result.push({
      type: 'manual',
      value: manualWeek,
      displayIndex: result.length
    });
  });

  // Add remaining date weeks after all manual weeks
  while (dateWeekIndex < sortedDateWeeks.length) {
    result.push({
      type: 'date',
      value: sortedDateWeeks[dateWeekIndex],
      displayIndex: result.length
    });
    dateWeekIndex++;
  }

  return result;
}

/**
 * Move a manual week up (swap position with previous week in the grid)
 * @param {string} weekId - The manual week ID
 */
async function handleMoveWeekUp(weekId) {
  // Get the full merged week list as displayed in the grid
  const fullWeekList = getFullWeekList();

  // Find the current manual week in the full list
  const currentIndex = fullWeekList.findIndex(w =>
    w.type === 'manual' && w.value.id === weekId
  );

  if (currentIndex <= 0) {
    showNotification('Already at the top');
    return;
  }

  const currentWeek = fullWeekList[currentIndex].value;
  const prevWeek = fullWeekList[currentIndex - 1];

  if (prevWeek.type === 'manual') {
    // Swapping with another manual week - swap positions
    const prevManualWeek = prevWeek.value;
    const tempPosition = currentWeek.position;
    currentWeek.position = prevManualWeek.position;
    prevManualWeek.position = tempPosition;

    try {
      await updateManualWeekPositions([
        { id: currentWeek.id, position: currentWeek.position },
        { id: prevManualWeek.id, position: prevManualWeek.position }
      ]);

      // Update the original manualWeeks array
      const currentWeekInOriginal = manualWeeks.find(w => w.id === currentWeek.id);
      const prevWeekInOriginal = manualWeeks.find(w => w.id === prevManualWeek.id);
      if (currentWeekInOriginal) currentWeekInOriginal.position = currentWeek.position;
      if (prevWeekInOriginal) prevWeekInOriginal.position = prevManualWeek.position;

      showNotification(`Moved week "${currentWeek.name}" up`);
      renderGrid();
    } catch (error) {
      console.error('❌ Failed to move week up:', error);
      showError('Failed to move week. Please try again.');
    }
  } else {
    // Moving up past a date-based week - decrease position by 1
    currentWeek.position = Math.max(0, currentWeek.position - 1);

    try {
      await updateManualWeekPositions([
        { id: currentWeek.id, position: currentWeek.position }
      ]);

      // Update the original manualWeeks array
      const currentWeekInOriginal = manualWeeks.find(w => w.id === currentWeek.id);
      if (currentWeekInOriginal) currentWeekInOriginal.position = currentWeek.position;

      showNotification(`Moved week "${currentWeek.name}" up`);
      renderGrid();
    } catch (error) {
      console.error('❌ Failed to move week up:', error);
      showError('Failed to move week. Please try again.');
    }
  }
}

/**
 * Move a manual week down (swap position with next week in the grid)
 * @param {string} weekId - The manual week ID
 */
async function handleMoveWeekDown(weekId) {
  // Get the full merged week list as displayed in the grid
  const fullWeekList = getFullWeekList();

  // Find the current manual week in the full list
  const currentIndex = fullWeekList.findIndex(w =>
    w.type === 'manual' && w.value.id === weekId
  );

  if (currentIndex >= fullWeekList.length - 1) {
    showNotification('Already at the bottom');
    return;
  }

  const currentWeek = fullWeekList[currentIndex].value;
  const nextWeek = fullWeekList[currentIndex + 1];

  if (nextWeek.type === 'manual') {
    // Swapping with another manual week - swap positions
    const nextManualWeek = nextWeek.value;
    const tempPosition = currentWeek.position;
    currentWeek.position = nextManualWeek.position;
    nextManualWeek.position = tempPosition;

    try {
      await updateManualWeekPositions([
        { id: currentWeek.id, position: currentWeek.position },
        { id: nextManualWeek.id, position: nextManualWeek.position }
      ]);

      // Update the original manualWeeks array
      const currentWeekInOriginal = manualWeeks.find(w => w.id === currentWeek.id);
      const nextWeekInOriginal = manualWeeks.find(w => w.id === nextManualWeek.id);
      if (currentWeekInOriginal) currentWeekInOriginal.position = currentWeek.position;
      if (nextWeekInOriginal) nextWeekInOriginal.position = nextManualWeek.position;

      showNotification(`Moved week "${currentWeek.name}" down`);
      renderGrid();
    } catch (error) {
      console.error('❌ Failed to move week down:', error);
      showError('Failed to move week. Please try again.');
    }
  } else {
    // Moving down past a date-based week - increase position by 1
    currentWeek.position = currentWeek.position + 1;

    try {
      await updateManualWeekPositions([
        { id: currentWeek.id, position: currentWeek.position }
      ]);

      // Update the original manualWeeks array
      const currentWeekInOriginal = manualWeeks.find(w => w.id === currentWeek.id);
      if (currentWeekInOriginal) currentWeekInOriginal.position = currentWeek.position;

      showNotification(`Moved week "${currentWeek.name}" down`);
      renderGrid();
    } catch (error) {
      console.error('❌ Failed to move week down:', error);
      showError('Failed to move week. Please try again.');
    }
  }
}

/**
 * Delete a manual week
 * @param {string} weekId - The manual week ID
 */
async function handleDeleteManualWeek(weekId) {
  // Find the week to get its name for the confirmation message
  const week = manualWeeks.find(w => w.id === weekId);
  if (!week) {
    showError('Week not found');
    return;
  }

  // Confirm deletion
  const confirmed = confirm(`Are you sure you want to delete the week "${week.name}"?`);
  if (!confirmed) return;

  try {
    // Delete from Supabase
    await deleteManualWeek(weekId);

    // Remove from local array
    const index = manualWeeks.findIndex(w => w.id === weekId);
    if (index !== -1) {
      manualWeeks.splice(index, 1);
    }

    // Re-render grid
    renderGrid();

    // Show success notification
    showNotification(`Deleted week "${week.name}"`);

  } catch (error) {
    console.error('❌ Failed to delete manual week:', error);
    showError('Failed to delete week. Please try again.');
  }
}

/**
 * Edit a manual week name
 * @param {string} weekId - The manual week ID
 */
async function handleEditWeekName(weekId) {
  // Find the week to get its current name
  const week = manualWeeks.find(w => w.id === weekId);
  if (!week) {
    showError('Week not found');
    return;
  }

  // Prompt for new name with current name as default
  const newName = prompt('Enter new name for this week:', week.name);
  if (!newName || !newName.trim()) {
    return; // User cancelled or entered empty name
  }

  // Validate: check if name already exists (excluding current week)
  if (manualWeeks.some(w => w.id !== weekId && w.name === newName.trim())) {
    showNotification(`Week named "${newName.trim()}" already exists`);
    return;
  }

  try {
    // Update in Supabase
    const updatedWeek = await updateManualWeekName(weekId, newName.trim());

    // Update local array
    const index = manualWeeks.findIndex(w => w.id === weekId);
    if (index !== -1) {
      manualWeeks[index] = updatedWeek;
    }

    // Re-render grid
    renderGrid();

    // Show success notification
    showNotification(`Updated week name to "${newName.trim()}"`);

  } catch (error) {
    console.error('❌ Failed to update manual week name:', error);
    showError('Failed to update week name. Please try again.');
  }
}

/**
 * Handle toggle week collapse/expand
 * @param {string} weekIdentifier - Week Monday date or manual week ID
 */
function handleToggleWeekCollapse(weekIdentifier) {
  toggleWeekCollapsed(weekIdentifier);
  renderGrid();
}

// ============================================================================
// FILTERING
// ============================================================================

/**
 * Update department filter buttons based on available departments
 */
function updateDepartmentFilters() {
  const allProjects = getAllProjects();
  const departments = getUniqueDepartments(allProjects);
  const filterContainer = document.getElementById('department-filter-buttons');

  if (!filterContainer) return;

  // Clear existing buttons
  filterContainer.innerHTML = '';

  // Add "All" button
  const allBtn = document.createElement('button');
  allBtn.className = 'filter-button active';
  allBtn.textContent = 'All';
  allBtn.dataset.department = '';
  allBtn.addEventListener('click', () => handleDepartmentFilterClick(''));
  filterContainer.appendChild(allBtn);

  // Add department buttons
  departments.forEach(dept => {
    if (!dept) return; // Skip empty departments

    const btn = document.createElement('button');
    btn.className = 'filter-button';
    btn.textContent = dept;
    btn.dataset.department = dept;
    btn.addEventListener('click', () => handleDepartmentFilterClick(dept));
    filterContainer.appendChild(btn);
  });
}

/**
 * Handle department filter button click
 * @param {string} department - Department name or empty string for "All"
 */
function handleDepartmentFilterClick(department) {
  // Update active button state
  const buttons = document.querySelectorAll('.filter-button');
  buttons.forEach(btn => {
    if (btn.dataset.department === department) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update filter state
  if (department) {
    setDepartmentFilters([department]);
  } else {
    setDepartmentFilters([]);
  }
}

// ============================================================================
// UI HELPERS
// ============================================================================

function showEmptyState() {
  const emptyState = document.getElementById('empty-state');
  const gridContainer = document.getElementById('releasability-grid-container');

  if (emptyState) emptyState.style.display = 'block';
  if (gridContainer) gridContainer.style.display = 'none';
}

function hideEmptyState() {
  const emptyState = document.getElementById('empty-state');
  const gridContainer = document.getElementById('releasability-grid-container');

  if (emptyState) emptyState.style.display = 'none';
  if (gridContainer) gridContainer.style.display = 'block';
}

function updateLoadingState(isLoading) {
  const container = document.getElementById('releasability-grid-container');
  if (!container) return;

  if (isLoading) {
    container.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading releasability data...</p>
      </div>
    `;
  }
}

function showNotification(message) {
  // TODO: Implement proper notification system in later steps
  // For now, just use console and alert for critical messages
}

function showError(message) {
  console.error('❌ Error:', message);
  alert(message);
}

// ============================================================================
// START APPLICATION
// ============================================================================

// Initialize when DOM is ready
let appInitialized = false;

function ensureInit() {
  if (appInitialized) return;
  appInitialized = true;
  init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ensureInit);
} else {
  ensureInit();
}

// Make some functions available globally for debugging
window.__releasabilityDebug = {
  getStateSnapshot,
  getAllProjects,
  addProject,
  removeProject
};
