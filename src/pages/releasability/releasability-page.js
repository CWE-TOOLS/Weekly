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
  STATUS_DISPLAY
} from '../../config/releasability-config.js';
import { renderReleasabilityGrid, getUniqueDepartments } from './releasability-grid.js';
import { getMonday } from '../../utils/date-utils.js';
import {
  loadAllReleasabilityData,
  saveTrackingStatus,
  deleteTrackingStatus,
  loadManualWeeks,
  saveManualWeek,
  deleteManualWeek,
  updateManualWeekPositions
} from '../../services/releasability-data-service.js';

// ============================================================================
// GLOBAL STATE
// ============================================================================

let manualWeeks = []; // Store manual weeks globally
let copiedTrackingStatus = null; // Store copied tracking status for paste operation

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
  console.log('🚀 Initializing Releasability Board...');

  // Set up event listeners
  setupEventListeners();

  // Set up state change handlers
  setupStateHandlers();

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

    console.log('✅ Releasability Board initialized successfully');
    console.log('State snapshot:', getStateSnapshot());

  } catch (error) {
    console.error('❌ Error initializing releasability board:', error);
    showError('Failed to load releasability data. Please refresh the page.');
  } finally {
    setLoading(false);
  }
}

/**
 * Load initial data from services
 */
async function loadInitialData() {
  console.log('🔄 Loading releasability data from Google Sheets and Supabase...');

  try {
    // Load all data in parallel (projects + manual weeks)
    const [projects, weeks] = await Promise.all([
      loadAllReleasabilityData(),
      loadManualWeeks()
    ]);

    // Set projects in state
    setProjects(projects);

    // Store manual weeks
    manualWeeks = weeks;

    console.log(`✅ Loaded ${projects.length} projects and ${weeks.length} manual weeks successfully`);

  } catch (error) {
    console.error('❌ Error loading releasability data:', error);
    // Don't throw - allow app to start with empty state
    // User can still add manual projects
  }
}

// ============================================================================
// EVENT LISTENERS - UI Interactions
// ============================================================================

/**
 * Set up all DOM event listeners
 */
function setupEventListeners() {
  // Navigation buttons - REMOVED (UI elements deleted)
  // document.getElementById('prev-week-btn')?.addEventListener('click', handlePrevWeek);
  // document.getElementById('next-week-btn')?.addEventListener('click', handleNextWeek);
  // document.getElementById('current-week-btn')?.addEventListener('click', handleCurrentWeek);

  // Action buttons - REMOVED (UI elements deleted)
  // document.getElementById('add-project-btn')?.addEventListener('click', handleAddProjectClick);
  // document.getElementById('refresh-btn')?.addEventListener('click', handleRefresh);
  // document.getElementById('print-btn')?.addEventListener('click', handlePrint);

  // Add week button
  const addWeekBtn = document.getElementById('add-week-btn');
  if (addWeekBtn) {
    addWeekBtn.addEventListener('click', handleAddWeekClick);
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

  // Global click handler to close dropdown menus when clicking outside
  document.addEventListener('click', (e) => {
    // Check if click is outside a menu button or dropdown
    if (!e.target.closest('.project-menu-btn') && !e.target.closest('.project-menu-dropdown')) {
      document.querySelectorAll('.project-menu-dropdown.show').forEach(menu => {
        menu.classList.remove('show');
      });
    }
  });

  console.log('✅ Event listeners set up (UI simplified - buttons removed)');
}

/**
 * Set up state change handlers
 */
function setupStateHandlers() {
  // Re-render when projects change
  on(RELEASABILITY_EVENTS.PROJECTS_CHANGED, () => {
    console.log('📢 Projects changed, re-rendering grid');
    renderGrid();
  });

  // Re-render when filters change
  on(RELEASABILITY_EVENTS.FILTERS_CHANGED, () => {
    console.log('📢 Filters changed, re-rendering grid');
    renderGrid();
  });

  // Re-render when status updated (if hide completed is active)
  on(RELEASABILITY_EVENTS.STATUS_UPDATED, () => {
    if (getHideCompleted()) {
      console.log('📢 Status updated with hide completed active, re-rendering grid');
      renderGrid();
    }
  });

  // Handle loading state changes
  on(RELEASABILITY_EVENTS.LOADING_CHANGED, ({ isLoading }) => {
    updateLoadingState(isLoading);
  });

  console.log('✅ State handlers set up');
}

// ============================================================================
// NAVIGATION HANDLERS
// ============================================================================

function handlePrevWeek() {
  console.log('⬅️ Previous week clicked');
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
  console.log('➡️ Next week clicked');
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
  console.log('📅 Current week clicked');
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
    console.log(`📍 Scrolled to week: ${weekMonday}`);
  } else {
    console.log(`⚠️ Week ${weekMonday} not found in grid`);
    showNotification(`Week ${weekMonday} not found`);
  }
}

// ============================================================================
// ACTION HANDLERS
// ============================================================================

function handleAddProjectClick() {
  console.log('➕ Add project clicked');
  openAddProjectModal();
}

function handleRefresh() {
  console.log('🔄 Refresh clicked');
  setLoading(true);
  loadInitialData()
    .then(() => {
      renderGrid();
      showNotification('Data refreshed successfully!');
    })
    .catch(error => {
      console.error('Error refreshing:', error);
      showError('Failed to refresh data');
    })
    .finally(() => {
      setLoading(false);
    });
}

function handlePrint() {
  console.log('🖨 Print clicked');
  window.print();
}

function handleSearchInput(e) {
  const query = e.target.value;
  console.log('🔍 Search query:', query);
  setSearchQuery(query);
}

function handleClearFilters() {
  console.log('🧹 Clear filters clicked');
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
      document.getElementById('project-name')?.focus();
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

  const projectName = document.getElementById('project-name')?.value.trim();
  const projectWeek = document.getElementById('project-week')?.value;
  const projectDepartment = document.getElementById('project-department')?.value;

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

    console.log('✅ Project added:', newProject);

    // Save to Supabase
    try {
      await saveTrackingStatus(newProject);
      console.log('💾 Project saved to Supabase');
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

  console.log('📊 Rendered grid with', projects.length, 'projects');
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

      console.log('🔄 Started dragging project:', draggedProjectData.name);
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

    console.log('📍 Dropped project on week:', { targetWeekMonday, targetWeekId });

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
    console.log('ℹ️ Project already in this week');
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

    console.log(`✅ Moved "${project.project}" to new week`);
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

    console.log(`✅ Status updated: ${trackingItem} → ${STATUS_DISPLAY[nextStatus].label}`);

    // Save to Supabase
    try {
      await saveTrackingStatus(updatedProject);
      console.log('💾 Status saved to Supabase');
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
  cell.classList.remove('status-incomplete', 'status-in-progress', 'status-complete');

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

  console.log('🔍 Add Project Button Clicked - Button datasets:', {
    weekMonday: weekMonday,
    weekId: weekId,
    allDatasets: button.dataset
  });

  // Prompt for project name
  const projectName = prompt('Enter project name:');
  if (!projectName || !projectName.trim()) {
    return; // User cancelled or entered empty name
  }

  // For manual weeks, we still need a weekMonday for database storage
  // Use current week's Monday as the base date
  let effectiveWeekMonday = weekMonday;
  if (!effectiveWeekMonday && weekId) {
    // If adding to a manual week, use current week's Monday
    const today = new Date();
    console.log('🔍 Today:', today);
    const currentMonday = getMonday(today);
    console.log('🔍 Current Monday:', currentMonday);
    effectiveWeekMonday = currentMonday.toISOString().split('T')[0];
    console.log(`🔍 Generated weekMonday for manual week: ${effectiveWeekMonday}`);
  }

  if (!effectiveWeekMonday) {
    console.error('❌ ERROR: effectiveWeekMonday is still null/undefined!');
    alert('Error: Could not determine week. Please refresh and try again.');
    return;
  }

  console.log(`🔍 Creating project with weekMonday: ${effectiveWeekMonday}, manualWeekId: ${weekId}`);

  // Create new manual project
  const newProject = {
    project: projectName.trim(),
    weekMonday: effectiveWeekMonday, // Always provide a valid weekMonday for database
    manualWeekId: weekId || null, // Use weekId for manual weeks (for display grouping)
    actualStartDate: effectiveWeekMonday, // Use the effective week Monday as start date
    department: null,
    source: PROJECT_SOURCE.MANUAL
  };

  console.log(`🔍 New project object:`, newProject);

  // Add project to state
  const addedProject = addProject(newProject);
  console.log(`🔍 Added project returned:`, addedProject);

  if (addedProject) {
    // Save to Supabase
    try {
      await saveTrackingStatus(addedProject);
      console.log('💾 Manual project saved to Supabase');
      showNotification(`Added project "${projectName}"`);
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
      console.log('💾 Project week updated in Supabase');
    } catch (error) {
      console.error('❌ Failed to update project week in Supabase:', error);
    }

    const direction = weekOffset > 0 ? 'next' : 'previous';
    console.log(`📅 Moved "${project.project}" to ${direction} week`);
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

  const confirmed = confirm(`Are you sure you want to delete "${project.project}"?`);
  if (!confirmed) return;

  // Delete from Supabase first
  try {
    await deleteTrackingStatus(project.project, project.weekMonday);
    console.log('💾 Project deleted from Supabase');
  } catch (error) {
    console.error('❌ Failed to delete from Supabase:', error);
    // Continue with local deletion anyway
  }

  // Remove from state
  removeProject(projectId);
  console.log(`🗑️ Deleted project: "${project.project}"`);
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

  console.log(`📋 Copied tracking status from "${project.project}"`);
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

  // Confirm paste action
  const confirmed = confirm(`Paste copied status to "${project.project}"?`);
  if (!confirmed) return;

  // Update each tracking item status
  for (const [trackingItem, status] of Object.entries(copiedTrackingStatus)) {
    updateProjectStatus(projectId, trackingItem, status);
  }

  console.log(`📋 Pasted tracking status to "${project.project}"`);
  showNotification(`Pasted status to "${project.project}"`);

  // Save to Supabase
  try {
    const updatedProject = getAllProjects().find(p => p.id === projectId);
    if (updatedProject) {
      await saveTrackingStatus(updatedProject);
      console.log('💾 Pasted status saved to Supabase');
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
  console.log('👁️ Hide completed toggle:', checked);

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

    console.log('📥 Loaded hideCompleted preference:', hideCompleted);
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
    console.log('💾 Saved hideCompleted preference:', value);
  } catch (error) {
    console.error('Error saving hideCompleted preference:', error);
  }
}

/**
 * Handle add week button click
 */
async function handleAddWeekClick() {
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
  // Get the full merged list of all weeks (date-based + manual) in display order
  const fullWeekList = getFullWeekList();
  const newPosition = fullWeekList.length; // Position after all existing weeks

  // Save to Supabase
  try {
    const savedWeek = await saveManualWeek(weekName.trim(), newPosition);
    manualWeeks.push(savedWeek);
    console.log(`📅 Added manual week: "${weekName.trim()}" at position ${newPosition}`);
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

      console.log(`📅 Moved week "${currentWeek.name}" up (swapped with manual week)`);
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

      console.log(`📅 Moved week "${currentWeek.name}" up (past date-based week)`);
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

      console.log(`📅 Moved week "${currentWeek.name}" down (swapped with manual week)`);
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

      console.log(`📅 Moved week "${currentWeek.name}" down (past date-based week)`);
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
    console.log(`🗑️ Deleted manual week: "${week.name}"`);

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
 * Handle toggle week collapse/expand
 * @param {string} weekIdentifier - Week Monday date or manual week ID
 */
function handleToggleWeekCollapse(weekIdentifier) {
  console.log('🔄 Toggling week collapse:', weekIdentifier);
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

  console.log(`📊 Created ${departments.length} department filter buttons`);
}

/**
 * Handle department filter button click
 * @param {string} department - Department name or empty string for "All"
 */
function handleDepartmentFilterClick(department) {
  console.log(`🔍 Department filter clicked: "${department || 'All'}"`);

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
  console.log('💬 Notification:', message);
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
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Make some functions available globally for debugging
window.__releasabilityDebug = {
  getStateSnapshot,
  getAllProjects,
  addProject,
  removeProject
};

console.log('💡 Debug functions available at window.__releasabilityDebug');
