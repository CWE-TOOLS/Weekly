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
  setLoading,
  getStateSnapshot
} from './releasability-state.js';
import {
  TRACKING_ITEMS,
  PROJECT_SOURCE,
  VALIDATION,
  STATUS_DISPLAY
} from '../../config/releasability-config.js';
import { renderReleasabilityGrid, getUniqueDepartments } from './releasability-grid.js';
import { getMonday } from '../../utils/date-utils.js';

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
  // TODO: In STEP 5, this will:
  // 1. Fetch projects from Google Sheets
  // 2. Detect project start dates
  // 3. Load tracking statuses from Supabase
  // 4. Merge data into state

  // For now, just simulate loading
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('ℹ️ Initial data load complete (no data sources connected yet)');
}

// ============================================================================
// EVENT LISTENERS - UI Interactions
// ============================================================================

/**
 * Set up all DOM event listeners
 */
function setupEventListeners() {
  // Navigation buttons
  document.getElementById('prev-week-btn')?.addEventListener('click', handlePrevWeek);
  document.getElementById('next-week-btn')?.addEventListener('click', handleNextWeek);
  document.getElementById('current-week-btn')?.addEventListener('click', handleCurrentWeek);

  // Action buttons
  document.getElementById('add-project-btn')?.addEventListener('click', handleAddProjectClick);
  document.getElementById('refresh-btn')?.addEventListener('click', handleRefresh);
  document.getElementById('print-btn')?.addEventListener('click', handlePrint);

  // Search input
  const searchInput = document.getElementById('project-search');
  if (searchInput) {
    searchInput.addEventListener('input', handleSearchInput);
  }

  // Clear filters button
  document.getElementById('clear-filters-btn')?.addEventListener('click', handleClearFilters);

  // Modal controls
  document.getElementById('close-modal-btn')?.addEventListener('click', closeAddProjectModal);
  document.getElementById('cancel-add-btn')?.addEventListener('click', closeAddProjectModal);
  document.getElementById('add-project-form')?.addEventListener('submit', handleAddProjectSubmit);

  // Close modal on background click
  document.getElementById('add-project-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'add-project-modal') {
      closeAddProjectModal();
    }
  });

  console.log('✅ Event listeners set up');
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
  // TODO: Implement week navigation in later steps
  showNotification('Previous week navigation - Coming soon!');
}

function handleNextWeek() {
  console.log('➡️ Next week clicked');
  // TODO: Implement week navigation in later steps
  showNotification('Next week navigation - Coming soon!');
}

function handleCurrentWeek() {
  console.log('📅 Current week clicked');
  // TODO: Implement jump to current week in later steps
  showNotification('Jump to current week - Coming soon!');
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

    // Focus on project name input
    setTimeout(() => {
      document.getElementById('project-name')?.focus();
    }, 100);
  }
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

    // TODO: Save to Supabase in later steps

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

  // Render the grid
  const grid = renderReleasabilityGrid(projects);
  container.appendChild(grid);

  // Set up grid event delegation
  setupGridEventDelegation(grid);

  console.log('📊 Rendered grid with', projects.length, 'projects');
}

/**
 * Set up event delegation for grid interactions
 * @param {HTMLElement} grid - The grid container element
 */
function setupGridEventDelegation(grid) {
  grid.addEventListener('click', (e) => {
    const target = e.target.closest('.status-cell, .project-control-btn');
    if (!target) return;

    // Handle status cell clicks (will implement in STEP 6)
    if (target.classList.contains('status-cell')) {
      handleStatusCellClick(target);
    }

    // Handle project control button clicks
    if (target.classList.contains('project-control-btn')) {
      handleProjectControlClick(target);
    }
  });
}

/**
 * Handle status cell click - cycle through statuses
 * @param {HTMLElement} cell - The clicked status cell
 */
function handleStatusCellClick(cell) {
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

    // TODO: Save to Supabase in STEP 9
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

  // Add new status class
  cell.classList.add(`status-${newStatus}`);

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
 * Move a project to a different week
 * @param {string} projectId - The project ID
 * @param {number} weekOffset - Number of weeks to move (+1 or -1)
 */
function handleMoveProjectWeek(projectId, weekOffset) {
  const project = getAllProjects().find(p => p.id === projectId);
  if (!project) return;

  // Calculate new week Monday
  const currentMonday = new Date(project.weekMonday);
  const newMonday = new Date(currentMonday);
  newMonday.setDate(newMonday.getDate() + (weekOffset * 7));

  const newMondayStr = newMonday.toISOString().split('T')[0];

  // Update project week
  updateProjectWeek(projectId, newMondayStr);

  const direction = weekOffset > 0 ? 'next' : 'previous';
  console.log(`📅 Moved "${project.project}" to ${direction} week`);
  showNotification(`Moved "${project.project}" to ${direction} week`);
}

/**
 * Delete a project
 * @param {string} projectId - The project ID
 */
function handleDeleteProject(projectId) {
  const project = getAllProjects().find(p => p.id === projectId);
  if (!project) return;

  const confirmed = confirm(`Are you sure you want to delete "${project.project}"?`);
  if (!confirmed) return;

  removeProject(projectId);
  console.log(`🗑️ Deleted project: "${project.project}"`);
  showNotification(`Deleted "${project.project}"`);
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
