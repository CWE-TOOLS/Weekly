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
import { isWeekCollapsed } from './releasability-state.js';

// Callbacks for project actions (set by releasability-page.js to avoid circular dependency)
let projectActions = {
  hasCopiedStatus: () => false,
  handleCopyStatus: () => {},
  handlePasteStatus: async () => {},
  handleDeleteProject: async () => {}
};

/**
 * Set the project action callbacks
 * Called by releasability-page.js to provide action handlers
 * @param {Object} actions - Object containing action callback functions
 */
export function setProjectActions(actions) {
  projectActions = { ...projectActions, ...actions };
}

// ============================================================================
// MAIN RENDERING FUNCTION
// ============================================================================

/**
 * Render the complete releasability grid
 * @param {Array<Object>} projects - Array of project objects
 * @param {Array<Object|string>} manualWeeks - Array of manual week objects {id, name, position} or date strings
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

  // Create wrapper container for header + body
  const wrapper = document.createElement('div');
  wrapper.className = 'grid-with-header';

  // Create header grid (sticky at top)
  const headerGrid = document.createElement('div');
  headerGrid.className = 'releasability-grid-header';
  const headerRow = createHeaderRow();
  headerRow.forEach(cell => headerGrid.appendChild(cell));

  // Create body grid (scrollable content)
  const bodyGrid = document.createElement('div');
  bodyGrid.className = 'releasability-grid-body';

  // Create week sections for body
  weeks.forEach(week => {
    // Handle both date-based weeks (strings) and manual weeks (objects)
    const weekKey = typeof week === 'string' ? week : week.id;
    const weekProjects = projectsByWeek[weekKey] || [];
    const weekSection = createWeekSection(week, weekProjects);
    weekSection.forEach(element => bodyGrid.appendChild(element));
  });

  // Assemble the complete grid
  wrapper.appendChild(headerGrid);
  wrapper.appendChild(bodyGrid);

  return wrapper;
}

// ============================================================================
// GRID STRUCTURE FUNCTIONS
// ============================================================================

/**
 * Department group definitions for column headers.
 * Each group spans a range of tracking item indices.
 */
const COLUMN_GROUPS = [
  { label: 'Classroom', startIndex: 0, endIndex: 2, className: 'group-classroom' },
  { label: 'Project Manager', startIndex: 3, endIndex: 8, className: 'group-pm' },
  { label: 'Engineering', startIndex: 9, endIndex: 17, className: 'group-engineering' }
];

/**
 * Create the header rows (group header + tracking item headers)
 * @returns {Array<HTMLElement>} Array of header cell elements (group row first, then item row)
 */
function createHeaderRow() {
  const cells = [];

  // === Group header row ===
  // Empty cell spanning Project column
  const groupProjectSpacer = document.createElement('div');
  groupProjectSpacer.className = 'group-header-cell group-spacer';
  cells.push(groupProjectSpacer);

  // Empty cell spanning Start Date column
  const groupDateSpacer = document.createElement('div');
  groupDateSpacer.className = 'group-header-cell group-spacer';
  cells.push(groupDateSpacer);

  // Group header cells spanning tracking columns
  COLUMN_GROUPS.forEach(group => {
    const span = group.endIndex - group.startIndex + 1;
    const groupCell = document.createElement('div');
    groupCell.className = `group-header-cell ${group.className}`;
    groupCell.textContent = group.label;
    groupCell.style.gridColumn = `span ${span}`;
    cells.push(groupCell);
  });

  // === Tracking item header row ===
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
  TRACKING_ITEMS.forEach((item, index) => {
    const headerCell = document.createElement('div');
    headerCell.className = 'header-cell tracking-item-header';
    headerCell.textContent = item;
    headerCell.title = item; // Tooltip with full name
    headerCell.dataset.trackingIndex = index; // Add index for individual targeting
    cells.push(headerCell);
  });

  return cells;
}

/**
 * Create a week section with header and project rows
 * @param {string|Object} week - Monday date in YYYY-MM-DD format OR manual week object {id, name, position}
 * @param {Array<Object>} projects - Projects for this week
 * @returns {Array<HTMLElement>} Array of elements for this week section
 */
function createWeekSection(week, projects) {
  const elements = [];
  const isManualWeek = typeof week === 'object';
  const weekIdentifier = isManualWeek ? week.id : week;
  const collapsed = isWeekCollapsed(weekIdentifier);

  // Week header (spans all columns)
  const weekHeader = createWeekHeader(week);

  // Add collapsed class to header if needed
  if (collapsed) {
    weekHeader.classList.add('collapsed');
  }

  elements.push(weekHeader);

  // Project rows for this week
  projects.forEach(project => {
    const projectRow = createProjectRow(project);
    projectRow.forEach(cell => {
      // Add data attribute to mark which week this cell belongs to
      if (isManualWeek) {
        cell.dataset.weekId = week.id;
      } else {
        cell.dataset.weekMonday = week;
      }

      // Add collapsed class to hide cells when week is collapsed
      if (collapsed) {
        cell.classList.add('week-collapsed');
      }

      elements.push(cell);
    });
  });

  return elements;
}

/**
 * Create week header cell
 * @param {string|Object} week - Monday date in YYYY-MM-DD format OR manual week object {id, name, position}
 * @returns {HTMLElement} Week header element
 */
function createWeekHeader(week) {
  const isManualWeek = typeof week === 'object';
  const weekId = isManualWeek ? week.id : week;
  const weekMonday = isManualWeek ? null : week;

  let weekLabel;

  if (isManualWeek) {
    // Manual week: use the custom name
    weekLabel = week.name;
  } else {
    // Date-based week: calculate week label
    const monday = parseLocalDate(weekMonday);

    // Handle invalid dates gracefully
    if (!monday) {
      // Silently skip invalid dates (e.g., UUIDs from manual weeks)
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
    weekLabel = formatWeekLabel(monday, month, weekNum);
  }

  const header = document.createElement('div');
  header.className = 'week-header-cell drop-zone';

  // Set appropriate data attributes based on week type
  if (isManualWeek) {
    header.dataset.weekId = week.id;
    header.dataset.dropWeekId = week.id;
    header.classList.add('manual-week');
  } else {
    header.dataset.weekMonday = weekMonday;
    header.dataset.dropWeekMonday = weekMonday;
  }

  // Collapse/expand button (before the label)
  const weekIdentifier = isManualWeek ? week.id : weekMonday;
  const collapsed = isWeekCollapsed(weekIdentifier);

  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'week-collapse-btn';
  collapseBtn.innerHTML = collapsed ? '▶' : '▼'; // Right arrow when collapsed, down arrow when expanded
  collapseBtn.title = collapsed ? 'Expand week' : 'Collapse week';
  collapseBtn.dataset.action = 'toggle-week-collapse';

  if (isManualWeek) {
    collapseBtn.dataset.weekId = week.id;
  } else {
    collapseBtn.dataset.weekMonday = weekMonday;
  }

  header.appendChild(collapseBtn);

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

  // Set appropriate identifier for add project button
  if (isManualWeek) {
    addProjectBtn.dataset.weekId = week.id;
  } else {
    addProjectBtn.dataset.weekMonday = weekMonday;
  }
  header.appendChild(addProjectBtn);

  // Week controls container (only for manual weeks - date-based weeks maintain chronological order)
  if (isManualWeek) {
    const controls = document.createElement('div');
    controls.className = 'week-controls';

    // Move up button
    const moveUpBtn = document.createElement('button');
    moveUpBtn.className = 'week-control-btn';
    moveUpBtn.innerHTML = '&#9650;'; // ▲
    moveUpBtn.title = 'Move week earlier (swap with previous week)';
    moveUpBtn.dataset.action = 'move-week-up';
    moveUpBtn.dataset.weekId = week.id;
    controls.appendChild(moveUpBtn);

    // Move down button
    const moveDownBtn = document.createElement('button');
    moveDownBtn.className = 'week-control-btn';
    moveDownBtn.innerHTML = '&#9660;'; // ▼
    moveDownBtn.title = 'Move week later (swap with next week)';
    moveDownBtn.dataset.action = 'move-week-down';
    moveDownBtn.dataset.weekId = week.id;
    controls.appendChild(moveDownBtn);

    // Edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'week-control-btn week-edit-btn';
    editBtn.innerHTML = '&#9998;'; // ✎
    editBtn.title = 'Edit week name';
    editBtn.dataset.action = 'edit-week';
    editBtn.dataset.weekId = week.id;
    controls.appendChild(editBtn);

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'week-control-btn week-delete-btn';
    deleteBtn.innerHTML = '&#10005;'; // ✕
    deleteBtn.title = 'Delete this week';
    deleteBtn.dataset.action = 'delete-week';
    deleteBtn.dataset.weekId = week.id;
    controls.appendChild(deleteBtn);

    header.appendChild(controls);
  }

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
    // Make manual projects draggable
    cell.draggable = true;
    cell.dataset.projectName = project.project;
    cell.dataset.weekMonday = project.weekMonday;
    cell.dataset.manualWeekId = project.manualWeekId || '';
  }

  // Drag icon for manual projects
  if (project.source === 'manual') {
    const dragIcon = document.createElement('span');
    dragIcon.className = 'drag-handle';
    dragIcon.innerHTML = '&#8942;&#8942;'; // ⋮⋮ (vertical dots)
    dragIcon.title = 'Drag to move to another week';
    cell.appendChild(dragIcon);
  }

  // Identifier badges (project# + cast#) go in a fixed-width slot so the project
  // title always starts at the same x across rows, regardless of how wide the
  // individual numbers are (e.g. "#1" vs "#13" vs "#1A").
  if (project.projectNumber || project.castingNumber) {
    const badges = document.createElement('span');
    badges.className = 'project-badges';

    // Project number badge (only when the board project matched a portal project)
    if (project.projectNumber) {
      const numBadge = document.createElement('span');
      numBadge.className = 'project-number-badge';
      numBadge.textContent = project.projectNumber;
      numBadge.title = `Project #${project.projectNumber}`;
      badges.appendChild(numBadge);
    }

    // Cast number badge — the per-casting identifier (Google Sheet col I).
    if (project.castingNumber) {
      const castBadge = document.createElement('span');
      castBadge.className = 'cast-number-badge';
      castBadge.textContent = `#${project.castingNumber}`;
      castBadge.title = `Cast #${project.castingNumber}`;
      badges.appendChild(castBadge);
    }

    cell.appendChild(badges);
  }

  // Project name — prefer the authoritative portal name (looked up by project#),
  // falling back to the Google Sheet name. Surface the Sheet name in the tooltip
  // when it differs, so name mismatches stay visible.
  const displayName = project.displayName || project.project;
  const nameSpan = document.createElement('span');
  nameSpan.className = 'project-name';
  nameSpan.textContent = displayName;
  nameSpan.title = (displayName === project.project)
    ? displayName
    : `${displayName}\n(sheet: ${project.project})`;
  cell.appendChild(nameSpan);

  // Project controls (copy/paste for all projects, delete for manual only)
  const controls = createProjectControls(project);
  cell.appendChild(controls);

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

  // Show "--" for manual projects (not from database)
  if (project.source === 'manual') {
    cell.textContent = '--';
    cell.title = 'Manual project (no start date)';
    return cell;
  }

  // Use actualStartDate if available, otherwise fall back to weekMonday
  const startDateStr = project.actualStartDate || project.weekMonday;

  // Parse and format the start date
  const startDate = parseLocalDate(startDateStr);
  if (startDate) {
    // Format as "Day DD" (e.g., "Wed 13")
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = dayNames[startDate.getDay()];
    const day = startDate.getDate();
    cell.textContent = `${dayName} ${day}`;
    cell.title = startDateStr; // Tooltip with full date
  } else {
    cell.textContent = startDateStr;
  }

  return cell;
}

/**
 * Create project control buttons (copy/paste for all, delete for manual)
 * @param {Object} project - Project object
 * @returns {HTMLElement} Controls container
 */
function createProjectControls(project) {
  const controls = document.createElement('div');
  controls.className = 'project-controls';

  // Copy button
  const copyBtn = document.createElement('button');
  copyBtn.className = 'project-action-btn copy-btn';
  copyBtn.textContent = 'copy';
  copyBtn.title = 'Copy status';
  copyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    projectActions.handleCopyStatus(project.id);
  });
  controls.appendChild(copyBtn);

  // Paste button
  const pasteBtn = document.createElement('button');
  pasteBtn.className = 'project-action-btn paste-btn paste-item';
  pasteBtn.textContent = 'paste';
  pasteBtn.title = 'Paste status';
  if (projectActions.hasCopiedStatus()) {
    pasteBtn.classList.add('has-copied-status');
  }
  pasteBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await projectActions.handlePasteStatus(project.id);
  });
  controls.appendChild(pasteBtn);

  // Delete button (manual projects only)
  if (project.source === 'manual') {
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'project-action-btn delete-btn';
    deleteBtn.innerHTML = '&#x2715;';
    deleteBtn.title = 'Delete project';
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await projectActions.handleDeleteProject(project.id);
    });
    controls.appendChild(deleteBtn);
  }

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
 * Group projects by their week (Monday date or manual week ID)
 * @param {Array<Object>} projects - Array of project objects
 * @returns {Object} Map of weekMonday/weekId -> array of projects
 */
function groupProjectsByWeek(projects) {
  const grouped = {};

  projects.forEach(project => {
    // Use manualWeekId if assigned to a manual week, otherwise use weekMonday
    const weekKey = project.manualWeekId || project.weekMonday;
    if (!grouped[weekKey]) {
      grouped[weekKey] = [];
    }
    grouped[weekKey].push(project);
  });

  // Sort projects within each week: real (sheets) projects first by start date, then manual projects alphabetically
  Object.keys(grouped).forEach(week => {
    grouped[week].sort((a, b) => {
      const aIsManual = a.source === 'manual';
      const bIsManual = b.source === 'manual';

      // Manual projects always come after real projects
      if (aIsManual !== bIsManual) {
        return aIsManual ? 1 : -1;
      }

      // Both manual: sort alphabetically by project name
      if (aIsManual) {
        return a.project.localeCompare(b.project);
      }

      // Both real: sort by actual start date, then alphabetically
      const dateA = a.actualStartDate || a.weekMonday || '';
      const dateB = b.actualStartDate || b.weekMonday || '';
      const dateCompare = dateA.localeCompare(dateB);
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
 * @param {Array<Object|string>} manualWeeks - Array of manual week objects {id, name, position} or date strings
 * @returns {Array<string|Object>} Mixed array of date strings and manual week objects, sorted by position/date
 */
function getWeekRange(projectsByWeek, manualWeeks = []) {
  const today = new Date();
  const currentMonday = getMonday(today);

  // Get previous week's Monday
  const previousMonday = new Date(currentMonday);
  previousMonday.setDate(previousMonday.getDate() - 7);
  const previousMondayStr = formatDateToYYYYMMDD(previousMonday);

  // Get all weeks with projects (these are date strings or manual week IDs)
  const projectWeeks = Object.keys(projectsByWeek);

  // Separate manual weeks (objects) from date-based weeks (strings)
  const manualWeekObjects = manualWeeks.filter(w => typeof w === 'object');
  const manualWeekDateStrings = manualWeeks.filter(w => typeof w === 'string');

  // Include previous week, project weeks (excluding manual week IDs), and manual week date strings
  const dateWeeks = new Set([
    previousMondayStr,
    ...projectWeeks.filter(w => !manualWeekObjects.some(mw => mw.id === w)),
    ...manualWeekDateStrings
  ]);

  // Convert date weeks to array and filter to include previous week and future
  const sortedDateWeeks = Array.from(dateWeeks)
    .sort()
    .filter(weekStr => weekStr >= previousMondayStr);

  // Create a combined list with manual weeks inserted at their positions
  const result = [];
  let dateWeekIndex = 0;

  // Sort manual weeks by position
  const sortedManualWeeks = [...manualWeekObjects].sort((a, b) => a.position - b.position);

  // Merge date weeks and manual weeks based on position
  sortedManualWeeks.forEach(manualWeek => {
    // Add all date weeks before this manual week's position
    while (dateWeekIndex < manualWeek.position && dateWeekIndex < sortedDateWeeks.length) {
      result.push(sortedDateWeeks[dateWeekIndex]);
      dateWeekIndex++;
    }
    // Add the manual week
    result.push(manualWeek);
  });

  // Add remaining date weeks after all manual weeks
  while (dateWeekIndex < sortedDateWeeks.length) {
    result.push(sortedDateWeeks[dateWeekIndex]);
    dateWeekIndex++;
  }

  return result;
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
    return null;
  }
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    // Silently return null for invalid date formats (e.g., UUIDs)
    return null;
  }
  const [year, month, day] = parts.map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) {
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
