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
 * @param {Array<string>} manualWeeks - Array of manually added week dates
 * @returns {HTMLElement} The rendered grid container
 */
export function renderReleasabilityGrid(projects, manualWeeks = []) {
  if (!projects || projects.length === 0) {
    return createEmptyGrid();
  }

  // Group projects by week
  const projectsByWeek = groupProjectsByWeek(projects);

  // Get week range (1 past week + all future weeks with projects + manual weeks)
  const weeks = getWeekRange(projectsByWeek, manualWeeks);

  // Create grid container
  const grid = document.createElement('div');
  grid.className = 'releasability-grid';

  // Grid columns are defined in CSS to auto-fit screen width
  // 250px project column + 20 flexible tracking columns

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

  // Start date header (second column)
  const startDateHeader = document.createElement('div');
  startDateHeader.className = 'header-cell start-date-header';
  startDateHeader.textContent = 'Start Date';
  cells.push(startDateHeader);

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
  // Parse date in local timezone (not UTC)
  const monday = parseLocalDate(weekMonday);

  // Handle invalid dates gracefully
  if (!monday) {
    console.warn('createWeekHeader: Invalid date, skipping week header for:', weekMonday);
    const header = document.createElement('div');
    header.className = 'week-header-cell error';
    header.textContent = `Invalid date: ${weekMonday}`;
    header.dataset.weekMonday = weekMonday;
    return header;
  }

  // Use the same logic as the main app
  const month = getWeekMonth(monday);
  const weekNum = getWeekOfMonth(monday, month);

  // Format week label (e.g., "Week 2: Nov 10-15")
  const weekLabel = formatWeekLabel(monday, month, weekNum);

  const header = document.createElement('div');
  header.className = 'week-header-cell';
  header.dataset.weekMonday = weekMonday;

  // Week label text
  const labelSpan = document.createElement('span');
  labelSpan.className = 'week-header-label';
  labelSpan.textContent = weekLabel;
  header.appendChild(labelSpan);

  // Add project button (appears on hover)
  const addProjectBtn = document.createElement('button');
  addProjectBtn.className = 'week-add-btn';
  addProjectBtn.innerHTML = '+ Add Project';
  addProjectBtn.title = 'Add manual project to this week';
  addProjectBtn.dataset.action = 'add-project';
  addProjectBtn.dataset.weekMonday = weekMonday;
  header.appendChild(addProjectBtn);

  // Week controls container
  const controls = document.createElement('div');
  controls.className = 'week-controls';

  // Move up button
  const moveUpBtn = document.createElement('button');
  moveUpBtn.className = 'week-control-btn';
  moveUpBtn.innerHTML = '&#9650;'; // ▲
  moveUpBtn.title = 'Move week earlier (swap with previous week)';
  moveUpBtn.dataset.action = 'move-week-up';
  moveUpBtn.dataset.weekMonday = weekMonday;
  controls.appendChild(moveUpBtn);

  // Move down button
  const moveDownBtn = document.createElement('button');
  moveDownBtn.className = 'week-control-btn';
  moveDownBtn.innerHTML = '&#9660;'; // ▼
  moveDownBtn.title = 'Move week later (swap with next week)';
  moveDownBtn.dataset.action = 'move-week-down';
  moveDownBtn.dataset.weekMonday = weekMonday;
  controls.appendChild(moveDownBtn);

  header.appendChild(controls);

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

  // Start date cell (second column)
  const startDateCell = createStartDateCell(project);
  cells.push(startDateCell);

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

  // Add 'manual' class if this is a manually added project
  if (project.source === 'manual') {
    cell.classList.add('manual');
  }

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
 * Create start date cell
 * @param {Object} project - Project object
 * @returns {HTMLElement} Start date cell element
 */
function createStartDateCell(project) {
  const cell = document.createElement('div');
  cell.className = 'start-date-cell';

  // Use actualStartDate if available, otherwise fall back to weekMonday
  const startDateStr = project.actualStartDate || project.weekMonday;

  // Parse and format the start date
  const startDate = parseLocalDate(startDateStr);
  if (startDate) {
    // Format as "Day MMM DD" (e.g., "Wed Jan 13")
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = dayNames[startDate.getDay()];
    const monthName = monthNames[startDate.getMonth()];
    const day = startDate.getDate();
    cell.textContent = `${dayName} ${monthName} ${day}`;
    cell.title = startDateStr; // Tooltip with full date
  } else {
    cell.textContent = startDateStr;
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
  // Convert underscore to hyphen for CSS class (in_progress -> in-progress)
  const cssStatus = status.replace(/_/g, '-');
  cell.className = `status-cell status-${cssStatus}`;
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

  // Sort projects within each week by actual start date (earliest first)
  Object.keys(grouped).forEach(week => {
    grouped[week].sort((a, b) => {
      const dateA = a.actualStartDate || a.weekMonday;
      const dateB = b.actualStartDate || b.weekMonday;
      // Sort by date first
      const dateCompare = dateA.localeCompare(dateB);
      // If dates are the same, sort alphabetically by project name
      if (dateCompare === 0) {
        return a.project.localeCompare(b.project);
      }
      return dateCompare;
    });
  });

  return grouped;
}

/**
 * Get the range of weeks to display (1 past week + all future weeks + manual weeks)
 * @param {Object} projectsByWeek - Map of weekMonday -> projects
 * @param {Array<string>} manualWeeks - Array of manually added week dates
 * @returns {Array<string>} Sorted array of Monday date strings
 */
function getWeekRange(projectsByWeek, manualWeeks = []) {
  const today = new Date();
  const currentMonday = getMonday(today);

  // Get previous week's Monday
  const previousMonday = new Date(currentMonday);
  previousMonday.setDate(previousMonday.getDate() - 7);
  const previousMondayStr = formatDateToYYYYMMDD(previousMonday);

  // Get all weeks with projects
  const projectWeeks = Object.keys(projectsByWeek);

  // Include previous week, project weeks, and manual weeks
  const allWeeks = new Set([previousMondayStr, ...projectWeeks, ...manualWeeks]);

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
 * @param {number} month - Month index (0-11) that this week belongs to
 * @param {number} weekNum - Week number within month
 * @returns {string} Formatted week label
 */
function formatWeekLabel(monday, month, weekNum) {
  // Defensive check for null/invalid dates
  if (!monday || !(monday instanceof Date) || isNaN(monday.getTime())) {
    console.warn('formatWeekLabel: Invalid date provided');
    return 'Invalid Week';
  }

  // Month name abbreviation
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = monthNames[month];

  // Get Saturday (end of week) - copy the date to avoid mutation
  const saturday = new Date(monday.getTime());
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
 * Parse a YYYY-MM-DD date string as local timezone
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {Date} Date object in local timezone
 */
function parseLocalDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    console.warn('parseLocalDate: Invalid date string provided');
    return null;
  }
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    console.warn('parseLocalDate: Date string not in expected format (YYYY-MM-DD):', dateStr);
    return null;
  }
  const [year, month, day] = parts.map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    console.warn('parseLocalDate: Invalid date components:', { year, month, day });
    return null;
  }
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) {
    console.warn('parseLocalDate: Created invalid date from:', dateStr);
    return null;
  }
  return date;
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
