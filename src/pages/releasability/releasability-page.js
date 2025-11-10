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
  getStateSnapshot,
  setProjects,
  getWeeksWithProjects
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
  deleteManualWeek
} from '../../services/releasability-data-service.js';

// ============================================================================
// GLOBAL STATE
// ============================================================================

let manualWeeks = []; // Store manual weeks globally

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

  console.log('📊 Rendered grid with', projects.length, 'projects');
}

/**
 * Set up event delegation for grid interactions
 * @param {HTMLElement} grid - The grid container element
 */
function setupGridEventDelegation(grid) {
  grid.addEventListener('click', (e) => {
    const target = e.target.closest('.status-cell, .project-control-btn, .week-add-btn, .week-control-btn');
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

    // Handle week control button clicks
    if (target.classList.contains('week-control-btn')) {
      handleWeekControlClick(target);
    }
  });
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
  const weekMonday = button.dataset.weekMonday;

  // Prompt for project name
  const projectName = prompt('Enter project name:');
  if (!projectName || !projectName.trim()) {
    return; // User cancelled or entered empty name
  }

  // Prompt for department (optional)
  const department = prompt('Enter department (optional):') || null;

  // Create new manual project
  const newProject = {
    project: projectName.trim(),
    weekMonday: weekMonday,
    actualStartDate: weekMonday, // For manual entries, use the week Monday
    department: department ? department.trim() : null,
    source: PROJECT_SOURCE.MANUAL
  };

  // Add project to state
  const addedProject = addProject(newProject);

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
async function handleDeleteProject(projectId) {
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
 * Handle add week button click
 */
async function handleAddWeekClick() {
  // Prompt for date
  const dateInput = prompt('Enter a date for the new week (YYYY-MM-DD):');
  if (!dateInput || !dateInput.trim()) {
    return; // User cancelled
  }

  // Parse the date and get Monday of that week
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) {
    showError('Invalid date format. Please use YYYY-MM-DD.');
    return;
  }

  const monday = getMonday(date);
  const mondayStr = monday.toISOString().split('T')[0];

  // Check if week already exists
  if (manualWeeks.includes(mondayStr)) {
    showNotification(`Week of ${mondayStr} already exists`);
    return;
  }

  // Save to Supabase
  try {
    await saveManualWeek(mondayStr);
    manualWeeks.push(mondayStr);
    console.log(`📅 Added manual week: ${mondayStr}`);
    showNotification(`Added week of ${mondayStr}`);

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
  const weekMonday = button.dataset.weekMonday;

  switch (action) {
    case 'move-week-up':
      handleMoveWeekUp(weekMonday);
      break;
    case 'move-week-down':
      handleMoveWeekDown(weekMonday);
      break;
  }
}

/**
 * Move a week up (swap dates with previous week)
 * @param {string} weekMonday - The week Monday date
 */
async function handleMoveWeekUp(weekMonday) {
  const projects = getFilteredProjects();
  const projectsByWeek = {};
  projects.forEach(p => {
    if (!projectsByWeek[p.weekMonday]) projectsByWeek[p.weekMonday] = [];
    projectsByWeek[p.weekMonday].push(p);
  });

  // Get all weeks (with manual weeks)
  const allWeeks = [...new Set([...Object.keys(projectsByWeek), ...manualWeeks])].sort();

  const currentIndex = allWeeks.indexOf(weekMonday);
  if (currentIndex <= 0) {
    showNotification('Already at the top');
    return;
  }

  const prevWeek = allWeeks[currentIndex - 1];

  // Swap the weeks by updating all projects and manual week entries
  await swapWeeks(weekMonday, prevWeek);

  showNotification(`Moved week earlier`);
  renderGrid();
}

/**
 * Move a week down (swap dates with next week)
 * @param {string} weekMonday - The week Monday date
 */
async function handleMoveWeekDown(weekMonday) {
  const projects = getFilteredProjects();
  const projectsByWeek = {};
  projects.forEach(p => {
    if (!projectsByWeek[p.weekMonday]) projectsByWeek[p.weekMonday] = [];
    projectsByWeek[p.weekMonday].push(p);
  });

  // Get all weeks (with manual weeks)
  const allWeeks = [...new Set([...Object.keys(projectsByWeek), ...manualWeeks])].sort();

  const currentIndex = allWeeks.indexOf(weekMonday);
  if (currentIndex >= allWeeks.length - 1) {
    showNotification('Already at the bottom');
    return;
  }

  const nextWeek = allWeeks[currentIndex + 1];

  // Swap the weeks by updating all projects and manual week entries
  await swapWeeks(weekMonday, nextWeek);

  showNotification(`Moved week later`);
  renderGrid();
}

/**
 * Swap two weeks by updating all projects in both weeks
 * @param {string} week1 - First week Monday
 * @param {string} week2 - Second week Monday
 */
async function swapWeeks(week1, week2) {
  const allProjects = getAllProjects();

  // Find projects in both weeks
  const week1Projects = allProjects.filter(p => p.weekMonday === week1);
  const week2Projects = allProjects.filter(p => p.weekMonday === week2);

  try {
    // Update all projects in week1 to week2
    for (const project of week1Projects) {
      await deleteTrackingStatus(project.project, week1);
      const updated = updateProjectWeek(project.id, week2);
      if (updated) {
        await saveTrackingStatus(updated);
      }
    }

    // Update all projects in week2 to week1
    for (const project of week2Projects) {
      await deleteTrackingStatus(project.project, week2);
      const updated = updateProjectWeek(project.id, week1);
      if (updated) {
        await saveTrackingStatus(updated);
      }
    }

    // Swap manual week entries if they exist
    const week1IsManual = manualWeeks.includes(week1);
    const week2IsManual = manualWeeks.includes(week2);

    if (week1IsManual && !week2IsManual) {
      await deleteManualWeek(week1);
      await saveManualWeek(week2);
      manualWeeks = manualWeeks.filter(w => w !== week1);
      manualWeeks.push(week2);
    } else if (week2IsManual && !week1IsManual) {
      await deleteManualWeek(week2);
      await saveManualWeek(week1);
      manualWeeks = manualWeeks.filter(w => w !== week2);
      manualWeeks.push(week1);
    }
    // If both are manual, they stay as manual weeks

    console.log(`📅 Swapped weeks: ${week1} <-> ${week2}`);
  } catch (error) {
    console.error('❌ Failed to swap weeks:', error);
    showError('Failed to move week. Please try again.');
  }
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
