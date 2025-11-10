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
  setSearchQuery,
  setDepartmentFilters,
  setLoading,
  getStateSnapshot
} from './releasability-state.js';
import {
  TRACKING_ITEMS,
  PROJECT_SOURCE,
  VALIDATION
} from '../../config/releasability-config.js';

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
    // Convert selected date to Monday (will use date-utils in later steps)
    const weekMonday = getMonday(new Date(projectWeek));

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

  // TODO: In STEP 4, this will render the actual grid
  // For now, show a placeholder
  container.innerHTML = `
    <div style="padding: 2rem; text-align: center; color: var(--text-secondary);">
      <h2>Grid Rendering - Coming in STEP 4</h2>
      <p>Found ${projects.length} project(s) to display</p>
      <p style="font-size: 0.875rem; margin-top: 1rem;">
        The grid renderer will be implemented in the next step.<br>
        For now, the page structure and state management are working!
      </p>
    </div>
  `;

  console.log('📊 Rendered placeholder grid with', projects.length, 'projects');
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
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get Monday date for a given date
 * TODO: Will import from date-utils.js in later steps
 * @param {Date} date - Input date
 * @returns {string} Monday date in YYYY-MM-DD format
 */
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(d.setDate(diff));

  return monday.toISOString().split('T')[0];
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
