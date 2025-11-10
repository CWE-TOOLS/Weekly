/**
 * Releasability Grid Renderer
 *
 * Renders the main releasability grid with weeks, projects, and tracking items.
 * Uses CSS Grid layout with sticky headers for both rows and columns.
 *
 * @module pages/releasability/releasability-grid
 */

import { getMonday, getWeekMonth, getWeekOfMonth } from '../../utils/date-utils.js';
import { TRACKING_ITEMS, STATUS, STATUS_DISPLAY } from '../../config/releasability-config.js';

// ============================================================================
// MAIN RENDERING FUNCTION
// ============================================================================

/**
 * Render the complete releasability grid
 * @param {Array<Object>} projects - Array of project objects
 * @returns {HTMLElement} The rendered grid container
 */
export function renderReleasabilityGrid(projects) {
  if (!projects || projects.length === 0) {
    return createEmptyGrid();
  }

  // Group projects by week
  const projectsByWeek = groupProjectsByWeek(projects);

  // Get week range (1 past week + all future weeks with projects)
  const weeks = getWeekRange(projectsByWeek);

  // Create grid container
  const grid = document.createElement('div');
  grid.className = 'releasability-grid';

  // Calculate grid columns (1 project column + N tracking item columns)
  const columnCount = 1 + TRACKING_ITEMS.length;
  grid.style.gridTemplateColumns = `var(--grid-project-column-width) repeat(${TRACKING_ITEMS.length}, var(--grid-tracking-column-width))`;

  // Create header row
  const headerRow = createHeaderRow();
  headerRow.forEach(cell => grid.appendChild(cell));

  // Create week sections
  weeks.forEach(weekMonday => {
    const weekProjects = projectsByWeek[weekMonday] || [];
    const weekSection = createWeekSection(weekMonday, weekProjects);
    weekSection.forEach(element => grid.appendChild(element));
  });

  return grid;
}

// ============================================================================
// GRID STRUCTURE FUNCTIONS
// ============================================================================

/**
 * Create the header row with tracking item labels
 * @returns {Array<HTMLElement>} Array of header cell elements
 */
function createHeaderRow() {
  const cells = [];

  // Project name header (first column)
  const projectHeader = document.createElement('div');
  projectHeader.className = 'header-cell project-header';
  projectHeader.textContent = 'Project';
  cells.push(projectHeader);

  // Tracking item headers (one for each tracking item)
  TRACKING_ITEMS.forEach(item => {
    const headerCell = document.createElement('div');
    headerCell.className = 'header-cell tracking-item-header';
    headerCell.textContent = item;
    headerCell.title = item; // Tooltip with full name
    cells.push(headerCell);
  });

  return cells;
}

/**
 * Create a week section with header and project rows
 * @param {string} weekMonday - Monday date in YYYY-MM-DD format
 * @param {Array<Object>} projects - Projects for this week
 * @returns {Array<HTMLElement>} Array of elements for this week section
 */
function createWeekSection(weekMonday, projects) {
  const elements = [];

  // Week header (spans all columns)
  const weekHeader = createWeekHeader(weekMonday);
  elements.push(weekHeader);

  // Project rows for this week
  projects.forEach(project => {
    const projectRow = createProjectRow(project);
    projectRow.forEach(cell => elements.push(cell));
  });

  return elements;
}

/**
 * Create week header cell
 * @param {string} weekMonday - Monday date in YYYY-MM-DD format
 * @returns {HTMLElement} Week header element
 */
function createWeekHeader(weekMonday) {
  const monday = new Date(weekMonday);
  const month = getWeekMonth(monday);
  const weekNum = getWeekOfMonth(monday, month);

  // Format week label (e.g., "Week 2: Nov 10-15")
  const weekLabel = formatWeekLabel(monday, month, weekNum);

  const header = document.createElement('div');
  header.className = 'week-header-cell';
  header.textContent = weekLabel;
  header.dataset.weekMonday = weekMonday;

  return header;
}

/**
 * Create a project row with name cell and status cells
 * @param {Object} project - Project object
 * @returns {Array<HTMLElement>} Array of cells for this project row
 */
function createProjectRow(project) {
  const cells = [];

  // Project name cell (first column)
  const nameCell = createProjectNameCell(project);
  cells.push(nameCell);

  // Status cells (one for each tracking item)
  TRACKING_ITEMS.forEach(trackingItem => {
    const statusCell = createStatusCell(project, trackingItem);
    cells.push(statusCell);
  });

  return cells;
}

/**
 * Create project name cell with controls
 * @param {Object} project - Project object
 * @returns {HTMLElement} Project name cell element
 */
function createProjectNameCell(project) {
  const cell = document.createElement('div');
  cell.className = 'project-name-cell';
  cell.dataset.projectId = project.id;

  // Project name
  const nameSpan = document.createElement('span');
  nameSpan.className = 'project-name';
  nameSpan.textContent = project.project;
  nameSpan.title = project.project; // Tooltip with full name
  cell.appendChild(nameSpan);

  // Project controls (week navigation, delete)
  if (project.source === 'manual') {
    const controls = createProjectControls(project);
    cell.appendChild(controls);
  }

  return cell;
}

/**
 * Create project control buttons (move week, delete)
 * @param {Object} project - Project object
 * @returns {HTMLElement} Controls container
 */
function createProjectControls(project) {
  const controls = document.createElement('div');
  controls.className = 'project-controls';

  // Move to previous week button
  const prevBtn = document.createElement('button');
  prevBtn.className = 'project-control-btn';
  prevBtn.innerHTML = '&#9650;'; // ▲ Up-pointing triangle
  prevBtn.title = 'Move to previous week';
  prevBtn.dataset.action = 'move-prev';
  prevBtn.dataset.projectId = project.id;
  controls.appendChild(prevBtn);

  // Move to next week button
  const nextBtn = document.createElement('button');
  nextBtn.className = 'project-control-btn';
  nextBtn.innerHTML = '&#9660;'; // ▼ Down-pointing triangle
  nextBtn.title = 'Move to next week';
  nextBtn.dataset.action = 'move-next';
  nextBtn.dataset.projectId = project.id;
  controls.appendChild(nextBtn);

  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'project-control-btn';
  deleteBtn.innerHTML = '&#10005;'; // ✕ Heavy multiplication X
  deleteBtn.title = 'Delete project';
  deleteBtn.dataset.action = 'delete';
  deleteBtn.dataset.projectId = project.id;
  controls.appendChild(deleteBtn);

  return controls;
}

/**
 * Create a status cell for a tracking item
 * @param {Object} project - Project object
 * @param {string} trackingItem - Tracking item name
 * @returns {HTMLElement} Status cell element
 */
function createStatusCell(project, trackingItem) {
  const status = project.trackingStatus[trackingItem] || STATUS.INCOMPLETE;
  const statusConfig = STATUS_DISPLAY[status];

  const cell = document.createElement('div');
  cell.className = `status-cell status-${status}`;
  cell.dataset.projectId = project.id;
  cell.dataset.trackingItem = trackingItem;
  cell.dataset.status = status;

  // Status icon
  const icon = document.createElement('span');
  icon.className = 'status-icon';
  icon.textContent = statusConfig.icon;
  cell.appendChild(icon);

  // Tooltip
  cell.title = `${project.project} - ${trackingItem}: ${statusConfig.label}`;

  return cell;
}

/**
 * Create empty grid placeholder
 * @returns {HTMLElement} Empty grid message
 */
function createEmptyGrid() {
  const container = document.createElement('div');
  container.className = 'empty-grid';
  container.innerHTML = `
    <p>No projects to display. Add a project to get started.</p>
  `;
  return container;
}

// ============================================================================
// DATA PROCESSING FUNCTIONS
// ============================================================================

/**
 * Group projects by their week (Monday date)
 * @param {Array<Object>} projects - Array of project objects
 * @returns {Object} Map of weekMonday -> array of projects
 */
function groupProjectsByWeek(projects) {
  const grouped = {};

  projects.forEach(project => {
    const weekMonday = project.weekMonday;
    if (!grouped[weekMonday]) {
      grouped[weekMonday] = [];
    }
    grouped[weekMonday].push(project);
  });

  // Sort projects within each week alphabetically
  Object.keys(grouped).forEach(week => {
    grouped[week].sort((a, b) => a.project.localeCompare(b.project));
  });

  return grouped;
}

/**
 * Get the range of weeks to display (1 past week + all future weeks)
 * @param {Object} projectsByWeek - Map of weekMonday -> projects
 * @returns {Array<string>} Sorted array of Monday date strings
 */
function getWeekRange(projectsByWeek) {
  const today = new Date();
  const currentMonday = getMonday(today);

  // Get previous week's Monday
  const previousMonday = new Date(currentMonday);
  previousMonday.setDate(previousMonday.getDate() - 7);
  const previousMondayStr = formatDateToYYYYMMDD(previousMonday);

  // Get all weeks with projects
  const projectWeeks = Object.keys(projectsByWeek);

  // Include previous week even if it has no projects
  const allWeeks = new Set([previousMondayStr, ...projectWeeks]);

  // Convert to array, sort chronologically, and filter to include:
  // - Previous week
  // - Current week and all future weeks
  const sortedWeeks = Array.from(allWeeks)
    .sort()
    .filter(weekStr => weekStr >= previousMondayStr);

  return sortedWeeks;
}

// ============================================================================
// FORMATTING FUNCTIONS
// ============================================================================

/**
 * Format week label (e.g., "Week 2: Nov 10-15")
 * @param {Date} monday - Monday date
 * @param {number} month - Month index (0-11)
 * @param {number} weekNum - Week number within month
 * @returns {string} Formatted week label
 */
function formatWeekLabel(monday, month, weekNum) {
  // Month name abbreviation
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = monthNames[month];

  // Get Saturday (end of week)
  const saturday = new Date(monday);
  saturday.setDate(saturday.getDate() + 5);

  // Format dates
  const startDay = monday.getDate();
  const endDay = saturday.getDate();

  // Check if week spans two months
  let dateRange;
  if (monday.getMonth() === saturday.getMonth()) {
    // Same month: "Nov 10-15"
    dateRange = `${monthName} ${startDay}-${endDay}`;
  } else {
    // Different months: "Nov 28-Dec 3"
    const endMonthName = monthNames[saturday.getMonth()];
    dateRange = `${monthName} ${startDay}-${endMonthName} ${endDay}`;
  }

  return `Week ${weekNum}: ${dateRange}`;
}

/**
 * Format date to YYYY-MM-DD
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
function formatDateToYYYYMMDD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a date is today
 * @param {Date} date - Date to check
 * @returns {boolean} True if date is today
 */
function isToday(date) {
  const today = new Date();
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
}

/**
 * Get all unique departments from projects
 * @param {Array<Object>} projects - Array of project objects
 * @returns {Array<string>} Sorted array of unique department names
 */
export function getUniqueDepartments(projects) {
  const departments = new Set();

  projects.forEach(project => {
    if (project.department) {
      departments.add(project.department);
    }
  });

  return Array.from(departments).sort();
}
