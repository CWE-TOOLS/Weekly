/**
 * Releasability Board - Main Page Controller
 *
 * Initializes and controls the releasability board page, managing all
 * user interactions, data loading, and view updates.
 *
 * @module pages/releasability/releasability-page
 */

import { on } from '../../core/event-bus.js';
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
  STATUS,
  STATUS_DISPLAY
} from '../../config/releasability-config.js';
import { renderReleasabilityGrid, getUniqueDepartments, setProjectActions } from './releasability-grid.js';
import { getMonday, getWeekMonth, getWeekOfMonth } from '../../utils/date-utils.js';
import { normalizeProjectName } from '../../utils/ui-utils.js';
import {
  loadAllReleasabilityData,
  saveTrackingStatus,
  deleteTrackingStatus,
  getCastingKey,
  loadManualWeeks,
  saveManualWeek,
  deleteManualWeek,
  updateManualWeekPositions,
  updateManualWeekName
} from '../../services/releasability-data-service.js';
import { loadProject } from '../../services/projects-service.js';
import {
  setupCacheSubscription,
  removeCacheSubscription
} from '../../services/sheets-cache-service.js';
import { registerRefreshHandler } from '../../services/supabase-service.js';
import { initFreshnessLabel, markDataUpdated, startVisiblePolling } from '../../utils/auto-refresh.js';
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

    // Initial load. A failure here must NOT alert (an unattended shop display
    // would freeze behind the modal) and must NOT markDataUpdated — leaving
    // the data age at "never loaded" makes the refresh engine below retry
    // within its first tick, so a bad-network startup self-heals.
    let initialLoadOk = true;
    try {
      await loadInitialData();
    } catch (error) {
      initialLoadOk = false;
      console.error('❌ Initial releasability load failed (auto-refresh will retry):', error);
    }

    // Initial render
    renderGrid();
    if (initialLoadOk) markDataUpdated();

    // Attach the freshness chip and start the refresh engine. The sync
    // promise is RETURNED (and rejects on failure) so the engine can show
    // "retrying" and try again; during a manual refresh it resolves as a
    // no-op — the manual path stamps freshness itself.
    initFreshnessLabel(document.getElementById('data-freshness'));
    startVisiblePolling(() => isManualRefreshing ? Promise.resolve() : syncData());

  } catch (error) {
    console.error('❌ Error initializing releasability board:', error);
    showError('Failed to load releasability data. Please refresh the page.');
  } finally {
    setLoading(false);
  }
}

/**
 * Reject if `promise` hasn't settled within `ms`. The underlying fetches keep
 * running — this just stops a hung request from wedging the refresh cycle
 * (and the isManualRefreshing guard) indefinitely.
 */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
  ]);
}

/**
 * Load initial data from services. THROWS on failure or timeout — callers keep
 * the last good render and let the auto-refresh engine retry. (This used to
 * swallow errors, which made a failed reload look like a success: the stale —
 * or wiped — data got re-rendered and stamped "Updated just now", and the
 * engine's staleness-driven retry never fired.)
 * @param {boolean} forceRefresh - If true, bypass cache and fetch fresh data from Google Sheets
 */
async function loadInitialData(forceRefresh = false) {
  // If we have cached data and not forcing refresh, reuse it
  if (!forceRefresh && cachedProjects !== null) {
    debug.log('🔄 Reusing cached projects data (skipping duplicate load)');
    setProjects(cachedProjects);
    return;
  }

  // Load all data in parallel (projects + manual weeks). 45s ceiling matches
  // the weekly view's Google Sheets timeout.
  const [projects, weeks] = await withTimeout(Promise.all([
    loadAllReleasabilityData(forceRefresh),
    loadManualWeeks()
  ]), 45000, 'Releasability data load');

  // Cache the loaded projects
  cachedProjects = projects;

  // Set projects in state
  setProjects(projects);

  // Store manual weeks
  manualWeeks = weeks;
}

/**
 * One silent sync cycle: bypass the page cache, reload everything, re-render,
 * and stamp freshness. THROWS on failure so the caller decides: the broadcast
 * handlers swallow (a missed broadcast just waits for the next poll), while
 * the auto-refresh engine propagates it — showing "retrying" on the chip and
 * trying again on its next tick.
 */
async function syncData() {
  cachedProjects = null;
  await loadInitialData();
  renderGrid();
  markDataUpdated();
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
    // Reload without a loading spinner
    await syncData();
    debug.log('✅ Data refreshed from cache update');
  } catch (error) {
    console.error('❌ Error refreshing data after cache update:', error);
    // Swallow: the last good render stays up, and because markDataUpdated()
    // wasn't reached the auto-refresh engine retries within its next tick.
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
    // Reload without a loading spinner
    await syncData();
    debug.log('✅ Data synced from refresh signal');
  } catch (error) {
    console.error('❌ Error syncing data after refresh signal:', error);
    // Swallow: the last good render stays up, and because markDataUpdated()
    // wasn't reached the auto-refresh engine retries within its next tick.
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

  // Tab-return refresh is handled by startVisiblePolling() in auto-refresh.js,
  // whose own visibilitychange listener re-runs handleSilentRefresh the instant
  // the tab becomes visible. (This page never initializes global-listeners, so
  // PAGE_VISIBLE was never emitted here and the old hook below was dead.)

  // Hide completed toggle
  const hideCompletedToggle = document.getElementById('hide-completed-toggle');
  if (hideCompletedToggle) {
    hideCompletedToggle.addEventListener('change', handleHideCompletedToggle);
  }

  // Search input
  const searchInput = document.getElementById('project-search');
  if (searchInput) {
    searchInput.addEventListener('input', handleSearchInput);
  }

  // Search clear button
  const searchClearBtn = document.getElementById('search-clear-btn');
  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      const input = document.getElementById('project-search');
      if (input) input.value = '';
      setSearchQuery('');
      searchClearBtn.style.display = 'none';
    });
  }

  // Clear filters button - REMOVED (UI element deleted)
  // document.getElementById('clear-filters-btn')?.addEventListener('click', handleClearFilters);

  // Add Casting modal controls
  const castingCloseBtn = document.getElementById('add-casting-close-btn');
  if (castingCloseBtn) castingCloseBtn.addEventListener('click', closeAddCastingModal);

  const castingCancelBtn = document.getElementById('add-casting-cancel-btn');
  if (castingCancelBtn) castingCancelBtn.addEventListener('click', closeAddCastingModal);

  const castingForm = document.getElementById('add-casting-form');
  if (castingForm) castingForm.addEventListener('submit', handleAddCastingSubmit);

  const castingNumberInput = document.getElementById('casting-project-number');
  if (castingNumberInput) castingNumberInput.addEventListener('input', handleCastingProjectNumberInput);

  // Close modal on background (overlay) click
  const castingModal = document.getElementById('add-casting-modal');
  if (castingModal) {
    castingModal.addEventListener('click', (e) => {
      if (e.target.id === 'add-casting-modal') {
        closeAddCastingModal();
      }
    });
  }

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
      markDataUpdated();
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

function openWeekSelectionModal({ title = 'Print', confirmLabel = 'Print Selected' } = {}) {
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

  // Build week label helper — matches the "Week N: MMM DD-DD" scheme used on the board
  function getWeekInfo(weekKey) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(weekKey)) {
      const monday = new Date(weekKey + 'T00:00:00');
      const weekMonth = getWeekMonth(monday); // 0-11 — month this week "belongs to"
      const weekNum = getWeekOfMonth(monday, weekMonth);
      // Use the year of the week-month, not the calendar Monday (handles Dec/Jan boundaries)
      const ref = new Date(monday.getTime());
      ref.setDate(monday.getDate() + 3); // Thursday — always in the week's month
      const year = ref.getFullYear();
      return { monday, weekMonth, weekNum, year };
    }
    return null;
  }

  function getWeekLabel(weekKey) {
    const mw = manualWeeks.find(w => typeof w === 'object' && w.id === weekKey);
    if (mw) return mw.name || mw.id;
    const info = getWeekInfo(weekKey);
    if (info) {
      const { monday, weekMonth, weekNum } = info;
      const saturday = new Date(monday);
      saturday.setDate(saturday.getDate() + 5);
      const startMonth = monthNames[monday.getMonth()];
      const endMonth = monthNames[saturday.getMonth()];
      const startDay = monday.getDate();
      const endDay = saturday.getDate();
      const dateRange = monday.getMonth() === saturday.getMonth()
        ? `${startMonth} ${startDay}-${endDay}`
        : `${startMonth} ${startDay}-${endMonth} ${endDay}`;
      return `Week ${weekNum}: ${dateRange}`;
    }
    return weekKey;
  }

  // Group weeks by the week-month (the month the week "belongs to" per the project's scheme),
  // plus a "Manual Weeks" bucket
  const groups = new Map(); // groupKey -> { label, weeks: [keys] }
  const MANUAL_KEY = '__manual__';
  weekKeys.forEach(key => {
    const info = getWeekInfo(key);
    if (info) {
      const { weekMonth, year } = info;
      const groupKey = `${year}-${String(weekMonth + 1).padStart(2, '0')}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, { label: `${fullMonthNames[weekMonth]} ${year}`, weeks: [] });
      }
      groups.get(groupKey).weeks.push(key);
    } else {
      if (!groups.has(MANUAL_KEY)) {
        groups.set(MANUAL_KEY, { label: 'Manual Weeks', weeks: [] });
      }
      groups.get(MANUAL_KEY).weeks.push(key);
    }
  });

  // Determine the "current week-month" and "next week-month" for default state
  const todayMonday = getMonday(new Date());
  const currentWeekMonth = getWeekMonth(todayMonday);
  const currentRef = new Date(todayMonday.getTime());
  currentRef.setDate(todayMonday.getDate() + 3);
  const currentMonthKey = `${currentRef.getFullYear()}-${String(currentWeekMonth + 1).padStart(2, '0')}`;
  const nextMonthDate = new Date(currentRef.getFullYear(), currentWeekMonth + 1, 1);
  const nextMonthKey = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;

  // Default selection: next month's weeks only
  const defaultSelectedGroup = nextMonthKey;

  // Build group HTML — collapsible sections with master checkbox.
  // By default, only the next-month group is checked and auto-expanded.
  const groupsHTML = Array.from(groups.entries()).map(([groupKey, group]) => {
    const isDefaultSelected = groupKey === defaultSelectedGroup;
    const isOpen = isDefaultSelected; // expand the default group
    const totalProjects = group.weeks.reduce((sum, k) => sum + (projectsByWeek[k] || []).length, 0);
    const weeksHTML = group.weeks.map(key => `
      <label class="print-week-row" data-week="${key}" data-group="${groupKey}" style="display: flex; align-items: center; padding: 6px 8px 6px 32px; cursor: pointer; gap: 8px; font-size: 13px; color: #333;">
        <input type="checkbox" value="${key}"${isDefaultSelected ? ' checked' : ''} style="margin: 0;" />
        <span style="flex: 1;">${getWeekLabel(key)}</span>
        <span style="color: #999; font-size: 11px;">(${(projectsByWeek[key] || []).length})</span>
      </label>
    `).join('');
    return `
      <div class="print-group" data-group="${groupKey}" style="border-bottom: 1px solid #f0f0f0;">
        <div class="print-group-header" style="display: flex; align-items: center; padding: 8px 10px; gap: 8px; cursor: pointer; background: #fafafa; user-select: none;">
          <span class="print-group-toggle" style="display: inline-block; width: 12px; color: #666; transition: transform 0.15s; transform: rotate(${isOpen ? '90deg' : '0deg'});">▶</span>
          <input type="checkbox" class="print-group-master" data-group="${groupKey}"${isDefaultSelected ? ' checked' : ''} style="margin: 0;" onclick="event.stopPropagation();" />
          <span style="font-weight: 600; font-size: 13px; color: #333;">${group.label}</span>
          <span class="print-group-count" style="margin-left: auto; font-size: 11px; color: #777;">${group.weeks.length} weeks · ${totalProjects} projects</span>
        </div>
        <div class="print-group-body" style="display: ${isOpen ? 'block' : 'none'};">
          ${weeksHTML}
        </div>
      </div>
    `;
  }).join('');

  // Build modal
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 460px;">
      <div class="modal-header">
        <h2>${title}</h2>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="print-format-toggle" style="display: flex; gap: 8px; margin-bottom: 14px;">
          <label class="print-format-opt" data-format="report" style="flex: 1; display: flex; align-items: center; gap: 8px; padding: 10px 12px; border: 2px solid #2563eb; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; color: #1d4ed8; background: #eff4ff;">
            <input type="radio" name="print-format" value="report" checked style="margin: 0;" /> Releasability Report
          </label>
          <label class="print-format-opt" data-format="folder" style="flex: 1; display: flex; align-items: center; gap: 8px; padding: 10px 12px; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; color: #555; background: #fff;">
            <input type="radio" name="print-format" value="folder" style="margin: 0;" /> Folder Board
          </label>
        </div>
        <div style="display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap;">
          <button class="print-preset" data-preset="next-month" style="padding: 6px 12px; border: 1px solid #2563eb; border-radius: 999px; background: #2563eb; color: white; cursor: pointer; font-size: 12px; font-weight: 500;">Next Month</button>
          <button class="print-preset" data-preset="current-month" style="padding: 6px 12px; border: 1px solid #ccc; border-radius: 999px; background: white; color: #333; cursor: pointer; font-size: 12px; font-weight: 500;">Current Month</button>
          <button class="print-preset" data-preset="all" style="padding: 6px 12px; border: 1px solid #ccc; border-radius: 999px; background: white; color: #333; cursor: pointer; font-size: 12px; font-weight: 500;">All</button>
          <button class="print-preset" data-preset="none" style="padding: 6px 12px; border: 1px solid #ccc; border-radius: 999px; background: white; color: #333; cursor: pointer; font-size: 12px; font-weight: 500;">None</button>
        </div>
        <div id="print-week-list" style="max-height: 320px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 6px;">
          ${groupsHTML}
        </div>
        <div id="print-summary" style="margin-top: 10px; font-size: 12px; color: #666; text-align: center;"></div>
        <div style="display: flex; gap: 8px; margin-top: 12px; justify-content: flex-end; align-items: center;">
          <button id="print-cancel-btn" style="padding: 8px 16px; border: 1px solid #ccc; border-radius: 6px; background: white; color: #333; cursor: pointer; font-size: 13px;">Cancel</button>
          <button id="print-confirm-btn" style="padding: 8px 16px; border: none; border-radius: 6px; background: #2563eb; color: white; cursor: pointer; font-size: 13px; font-weight: 500;">${confirmLabel}</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // ---- Helpers ----
  const allWeekCheckboxes = () => modal.querySelectorAll('#print-week-list .print-week-row input[type="checkbox"]');
  const groupWeekCheckboxes = (groupKey) => modal.querySelectorAll(`.print-week-row[data-group="${groupKey}"] input[type="checkbox"]`);

  function updateSummary() {
    const total = allWeekCheckboxes().length;
    const checked = modal.querySelectorAll('.print-week-row input[type="checkbox"]:checked').length;
    const summaryEl = modal.querySelector('#print-summary');
    summaryEl.textContent = `${checked} of ${total} weeks selected`;
    const confirmBtn = modal.querySelector('#print-confirm-btn');
    confirmBtn.disabled = checked === 0;
    confirmBtn.style.opacity = checked === 0 ? '0.5' : '1';
    confirmBtn.style.cursor = checked === 0 ? 'not-allowed' : 'pointer';
  }

  function syncMaster(groupKey) {
    const master = modal.querySelector(`.print-group-master[data-group="${groupKey}"]`);
    if (!master) return;
    const cbs = Array.from(groupWeekCheckboxes(groupKey));
    const checkedCount = cbs.filter(c => c.checked).length;
    if (checkedCount === 0) {
      master.checked = false;
      master.indeterminate = false;
    } else if (checkedCount === cbs.length) {
      master.checked = true;
      master.indeterminate = false;
    } else {
      master.checked = false;
      master.indeterminate = true;
    }
  }

  function syncAllMasters() {
    modal.querySelectorAll('.print-group-master').forEach(m => syncMaster(m.dataset.group));
  }

  // ---- Group header click: toggle expand/collapse ----
  modal.querySelectorAll('.print-group-header').forEach(header => {
    header.addEventListener('click', (e) => {
      // Ignore clicks on the master checkbox itself
      if (e.target.classList.contains('print-group-master')) return;
      const group = header.closest('.print-group');
      const body = group.querySelector('.print-group-body');
      const toggle = header.querySelector('.print-group-toggle');
      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : 'block';
      toggle.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
    });
  });

  // ---- Master checkbox: toggle all weeks in group ----
  modal.querySelectorAll('.print-group-master').forEach(master => {
    master.addEventListener('change', (e) => {
      e.stopPropagation();
      const groupKey = master.dataset.group;
      const shouldCheck = master.checked;
      groupWeekCheckboxes(groupKey).forEach(cb => { cb.checked = shouldCheck; });
      master.indeterminate = false;
      updateSummary();
    });
  });

  // ---- Individual week checkbox: sync master + summary ----
  allWeekCheckboxes().forEach(cb => {
    cb.addEventListener('change', () => {
      const row = cb.closest('.print-week-row');
      syncMaster(row.dataset.group);
      updateSummary();
    });
  });

  // ---- Format toggle (Releasability Report vs Folder Board) ----
  const formatOpts = modal.querySelectorAll('.print-format-opt');
  function syncFormat() {
    const selected = modal.querySelector('input[name="print-format"]:checked');
    const fmt = selected ? selected.value : 'report';
    formatOpts.forEach(opt => {
      const active = opt.dataset.format === fmt;
      opt.style.borderColor = active ? '#2563eb' : '#e5e7eb';
      opt.style.background = active ? '#eff4ff' : '#fff';
      opt.style.color = active ? '#1d4ed8' : '#555';
    });
    const cBtn = modal.querySelector('#print-confirm-btn');
    if (cBtn) cBtn.textContent = fmt === 'folder' ? 'Print Folder Board' : 'Print Selected';
  }
  formatOpts.forEach(opt => {
    const input = opt.querySelector('input[type="radio"]');
    if (input) input.addEventListener('change', syncFormat);
  });

  // ---- Preset buttons ----
  modal.querySelectorAll('.print-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      const allCbs = Array.from(allWeekCheckboxes());
      if (preset === 'all') {
        allCbs.forEach(cb => { cb.checked = true; });
      } else if (preset === 'none') {
        allCbs.forEach(cb => { cb.checked = false; });
      } else if (preset === 'current-month') {
        allCbs.forEach(cb => {
          const row = cb.closest('.print-week-row');
          cb.checked = row.dataset.group === currentMonthKey;
        });
      } else if (preset === 'next-month') {
        allCbs.forEach(cb => {
          const row = cb.closest('.print-week-row');
          cb.checked = row.dataset.group === nextMonthKey;
        });
      }
      syncAllMasters();
      updateSummary();
    });
  });

  // ---- Close handlers ----
  const closeModal = () => modal.remove();
  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  modal.querySelector('#print-cancel-btn').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  // ---- Print handler ----
  modal.querySelector('#print-confirm-btn').addEventListener('click', () => {
    const selectedWeeks = new Set();
    modal.querySelectorAll('.print-week-row input[type="checkbox"]:checked').forEach(cb => selectedWeeks.add(cb.value));
    if (selectedWeeks.size === 0) return;
    const fmtEl = modal.querySelector('input[name="print-format"]:checked');
    const fmt = fmtEl ? fmtEl.value : 'report';
    closeModal();
    if (fmt === 'folder') {
      executePrintFolderBoard(projects, projectsByWeek, selectedWeeks, getWeekLabel);
    } else {
      executePrint(projects, projectsByWeek, selectedWeeks, getWeekLabel);
    }
  });

  // Initial render
  syncAllMasters();
  updateSummary();
  syncFormat();
}

function handlePrint() {
  openWeekSelectionModal();
}

function executePrintFolderBoard(projects, projectsByWeek, selectedWeeks, getWeekLabel) {
  const weekKeys = Array.from(selectedWeeks).sort();
  const mNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Banner: "July Week 1 - 6th-21st" (full month + week-of-month + ordinal day range)
  // for real (date-keyed) weeks; manual-week name otherwise.
  const fullMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const ordinal = (n) => {
    const s = ['th','st','nd','rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  function bannerTitle(weekKey) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(weekKey)) {
      const monday = new Date(weekKey + 'T00:00:00');
      const sat = new Date(monday); sat.setDate(monday.getDate() + 5);
      const weekMonth = getWeekMonth(monday); // 0-11 — month this week "belongs to"
      const weekNum = getWeekOfMonth(monday, weekMonth);
      const range = monday.getMonth() === sat.getMonth()
        ? `${ordinal(monday.getDate())}-${ordinal(sat.getDate())}`
        : `${mNames[monday.getMonth()]} ${ordinal(monday.getDate())}-${mNames[sat.getMonth()]} ${ordinal(sat.getDate())}`;
      return `${fullMonths[weekMonth]} Week ${weekNum} - ${range}`;
    }
    return getWeekLabel(weekKey);
  }

  function fmtStart(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    return `${dayNames[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;
  }

  let pages = '';
  weekKeys.forEach(weekKey => {
    const weekProjects = (projectsByWeek[weekKey] || []).slice().sort((a, b) => {
      const dateA = a.actualStartDate || a.weekMonday || '';
      const dateB = b.actualStartDate || b.weekMonday || '';
      return dateA.localeCompare(dateB) || (a.project || '').localeCompare(b.project || '');
    });
    if (weekProjects.length === 0) return;

    const rows = weekProjects.map(p => {
      const name = esc(p.displayName || p.project || '');
      const start = esc(fmtStart(p.actualStartDate));
      // Fixed-width marker slot keeps every title left-aligned, whether it's a star or a rectangle.
      const hasGreenSticker = !!(p.trackingStatus && p.trackingStatus['Green Sticker'] === STATUS.COMPLETE);
      const inner = hasGreenSticker ? '<span class="fb-green"></span>' : '<span class="fb-star">★</span>';
      // Casting # flag — mirrors the blue "Cast #N" pill from the live tiles; omitted when unset.
      const castNum = p.castingNumber == null ? '' : String(p.castingNumber).trim();
      const castTag = castNum ? `<span class="fb-cast">Cast #${esc(castNum)}</span>` : '';
      return `<tr><td class="fb-name"><span class="fb-marker">${inner}</span>${name}${castTag}</td><td class="fb-start">${start}</td></tr>`;
    }).join('');

    pages += `
      <section class="folder-page">
        <div class="fb-banner">
          <h1>${esc(bannerTitle(weekKey))}</h1>
          <div class="fb-sub">${weekProjects.length} casting${weekProjects.length === 1 ? '' : 's'}</div>
        </div>
        <table class="fb-list">
          <thead><tr><th class="fb-name">Project</th><th class="fb-start">Start</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`;
  });

  if (!pages) return;

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const printHtml = `<!DOCTYPE html>
<html><head><title>Folder Board - ${dateStr}</title>
<style>
  @page { size: letter landscape; margin: 0.5in; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; margin: 0; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .folder-page { page-break-after: always; }
  .folder-page:last-child { page-break-after: auto; }
  .fb-banner { text-align: center; border-bottom: 3px solid #111; padding-bottom: 14px; margin-bottom: 24px; }
  .fb-banner h1 { font-size: 46px; line-height: 1.05; margin: 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; }
  .fb-banner .fb-sub { font-size: 14px; color: #666; margin-top: 8px; text-transform: uppercase; letter-spacing: 1.5px; }
  table.fb-list { width: 100%; border-collapse: collapse; }
  table.fb-list th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: #555; border-bottom: 2px solid #999; padding: 6px 12px; }
  table.fb-list td { padding: 6px 12px; border-bottom: 1px solid #ddd; vertical-align: middle; }
  table.fb-list tr { page-break-inside: avoid; }
  table.fb-list td.fb-name { font-size: 52px; font-weight: 700; line-height: 1.05; }
  .fb-marker { display: inline-block; width: 52px; margin-right: 18px; text-align: center; vertical-align: middle; }
  .fb-star { color: #e53935; font-size: 42px; line-height: 1; vertical-align: middle; }
  .fb-green { display: inline-block; width: 40px; height: 28px; background: #43a047; border-radius: 3px; vertical-align: middle; }
  .fb-cast { display: inline-block; margin-left: 18px; padding: 4px 16px; border-radius: 999px; background: #d7e3ff; color: #1b3a6b; font-size: 24px; font-weight: 700; letter-spacing: 0.5px; line-height: 1.2; vertical-align: middle; white-space: nowrap; }
  table.fb-list td.fb-start { text-align: right; white-space: nowrap; font-size: 28px; font-variant-numeric: tabular-nums; width: 180px; }
  th.fb-start { text-align: right; }
</style></head><body>
${pages}
</body></html>`;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(printHtml);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
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
  const clearBtn = document.getElementById('search-clear-btn');
  if (clearBtn) clearBtn.style.display = query ? 'flex' : 'none';
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
    // For a numbered casting the stable key (project#+cast#) doesn't change when
    // the week changes — the upsert below relocates the row in place, so we must
    // NOT delete first (that would briefly drop the state). Only legacy
    // (un-numbered) castings are keyed by name+week and need the old row removed.
    if (!getCastingKey(project)) {
      await deleteTrackingStatus(project.project, oldWeekMonday);
    }

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

    // The Green Sticker drives the project# flag color — update it live so the
    // flag turns green (or reverts) without waiting for a full re-render.
    if (trackingItem === 'Green Sticker') {
      const nameCell = document.querySelector(`.project-name-cell[data-project-id="${projectId}"]`);
      const badge = nameCell && nameCell.querySelector('.project-number-badge');
      if (badge) {
        badge.classList.toggle('green-sticker-complete', nextStatus === STATUS.COMPLETE);
      }
    }

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
  // Stash which week the "+" belongs to, then open the Add Casting modal. The
  // project name is resolved from the portal by Project #, so the modal only
  // needs the two number boxes.
  _pendingAddWeek = {
    weekMonday: button.dataset.weekMonday || null,
    weekId: button.dataset.weekId || null
  };
  openAddCastingModal();
}

// ============================================================================
// ADD CASTING MODAL (Project # + Cast #; name auto-resolved from the portal)
// ============================================================================

// Which week the casting is being added to (set when a week's "+" is clicked).
let _pendingAddWeek = null;
// Debounce timer + last successfully resolved portal name for the # lookup.
let _castingNameTimer = null;
let _resolvedCastingName = null;

/**
 * Open the Add Casting modal: reset fields, clear the name preview, focus Project #.
 */
function openAddCastingModal() {
  const modal = document.getElementById('add-casting-modal');
  if (!modal) return;

  const form = document.getElementById('add-casting-form');
  if (form) form.reset();
  _resolvedCastingName = null;
  setResolvedCastingName('', 'empty');

  modal.style.display = 'flex';
  setTimeout(() => {
    const numInput = document.getElementById('casting-project-number');
    if (numInput) numInput.focus();
  }, 50);
}

/**
 * Close the Add Casting modal and clear its transient state.
 */
function closeAddCastingModal() {
  const modal = document.getElementById('add-casting-modal');
  if (modal) modal.style.display = 'none';

  const form = document.getElementById('add-casting-form');
  if (form) form.reset();

  _pendingAddWeek = null;
  _resolvedCastingName = null;
  if (_castingNameTimer) {
    clearTimeout(_castingNameTimer);
    _castingNameTimer = null;
  }
}

/**
 * Render the resolved-name preview area.
 * @param {string} text - Name (or message) to show
 * @param {'empty'|'loading'|'found'|'not-found'} state
 */
function setResolvedCastingName(text, state) {
  const el = document.getElementById('casting-resolved-name');
  if (!el) return;

  el.classList.remove('is-empty', 'not-found');
  if (state === 'empty') {
    el.textContent = 'Enter a Project # to look up the name…';
    el.classList.add('is-empty');
  } else if (state === 'loading') {
    el.textContent = 'Looking up…';
    el.classList.add('is-empty');
  } else if (state === 'not-found') {
    el.textContent = text || 'No matching project in the portal';
    el.classList.add('not-found');
  } else {
    el.textContent = text;
  }
}

/**
 * Look up the portal project name from the entered Project # and show it.
 * Debounced; bound to the Project # input's 'input' event.
 */
function handleCastingProjectNumberInput() {
  const numInput = document.getElementById('casting-project-number');
  const projectNumber = numInput ? numInput.value.trim() : '';

  _resolvedCastingName = null;
  if (_castingNameTimer) clearTimeout(_castingNameTimer);

  if (!projectNumber) {
    setResolvedCastingName('', 'empty');
    return;
  }

  setResolvedCastingName('', 'loading');
  _castingNameTimer = setTimeout(async () => {
    try {
      const portalProject = await loadProject(projectNumber);

      // Ignore stale results if the field changed while we were fetching.
      const current = document.getElementById('casting-project-number');
      if (!current || current.value.trim() !== projectNumber) return;

      if (portalProject && portalProject.project_name) {
        _resolvedCastingName = portalProject.project_name;
        setResolvedCastingName(portalProject.project_name, 'found');
      } else {
        _resolvedCastingName = null;
        setResolvedCastingName(`No portal match for #${projectNumber} — you can still add it`, 'not-found');
      }
    } catch (error) {
      console.error('❌ Portal name lookup failed:', error);
      _resolvedCastingName = null;
      setResolvedCastingName('Lookup failed — you can still add it', 'not-found');
    }
  }, 350);
}

/**
 * Submit the Add Casting modal: create a manual casting keyed by project#+cast#
 * so it merges seamlessly when the real casting arrives from Sheets.
 */
async function handleAddCastingSubmit(e) {
  e.preventDefault();

  const numEl = document.getElementById('casting-project-number');
  const castEl = document.getElementById('casting-cast-number');
  const projectNumber = numEl ? numEl.value.trim() : '';
  const castingNumber = castEl ? castEl.value.trim() : '';

  if (!projectNumber) {
    showError('Please enter a Project #.');
    return;
  }
  if (!castingNumber) {
    showError('Please enter a Cast #.');
    return;
  }

  // Resolve the name from the portal (reuse the previewed value when we have it).
  let resolvedName = _resolvedCastingName;
  if (!resolvedName) {
    try {
      const portalProject = await loadProject(projectNumber);
      if (portalProject && portalProject.project_name) {
        resolvedName = portalProject.project_name;
      }
    } catch (error) {
      console.error('❌ Portal name lookup failed on submit:', error);
    }
  }
  // Fall back to a readable placeholder; displayName resolves from the portal on
  // the next load if/when the project exists there.
  const name = resolvedName || `Project ${projectNumber}`;

  // Resolve the target week from the "+" that opened the modal.
  const ctx = _pendingAddWeek || {};
  let effectiveWeekMonday = ctx.weekMonday || null;
  if (!effectiveWeekMonday) {
    const today = new Date();
    effectiveWeekMonday = getMonday(today).toISOString().split('T')[0];
  }

  const newProject = {
    project: name,
    displayName: name,
    projectNumber: projectNumber, // keyed by project#+cast# → seamless merge from Sheets
    castingNumber: castingNumber,
    weekMonday: effectiveWeekMonday,
    manualWeekId: ctx.weekId || null,
    actualStartDate: effectiveWeekMonday,
    department: null,
    source: PROJECT_SOURCE.MANUAL
  };

  const addedProject = addProject(newProject);
  if (addedProject) {
    try {
      await saveTrackingStatus(addedProject);
      showNotification(`Added casting ${projectNumber} #${castingNumber} — "${name}"`);
    } catch (error) {
      console.error('❌ Failed to save manual casting to Supabase:', error);
      showError('Failed to save casting. Please try again.');
    }
  }

  closeAddCastingModal();
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
    // Relocate the tracking record. Numbered castings keep their stable key, so
    // the upsert moves the row in place — no delete (which would drop state).
    // Legacy (un-numbered) castings are keyed by name+week and need the old row
    // deleted before the new one is saved.
    try {
      if (!getCastingKey(project)) {
        await deleteTrackingStatus(project.project, oldWeekMonday);
      }
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

  // Delete from Supabase first. Pass the numbers so a numbered casting is removed
  // by its stable key (project#+cast#) regardless of its current week.
  try {
    await deleteTrackingStatus(project.project, project.weekMonday, project.projectNumber, project.castingNumber);
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
