# Releasability Board Implementation Plan

## Overview
This document outlines the complete implementation plan for the Releasability Board feature - a standalone page for tracking project release readiness across multiple weeks.

## Reference Materials
- **UI Example**: `releasabiltyboarddev\Releasability example.png`
- **Feature Branch**: `feature/releasability-board`

---

## Architecture Overview

The releasability board will follow the existing modular vanilla JavaScript architecture with these key components:

### File Structure
```
src/
├── pages/
│   └── releasability/
│       ├── releasability-page.js           # Main page controller
│       ├── releasability-grid.js           # Grid rendering logic
│       ├── releasability-state.js          # Board-specific state
│       ├── releasability-cell-renderer.js  # Cell status rendering
│       └── releasability-service.js        # Data integration
├── styles/
│   └── releasability.css                   # Board-specific styles
└── config/
    └── releasability-config.js             # Tracking items config
```

### New HTML Entry Point
```
releasability.html                          # Standalone page
```

---

## Current Codebase Context

### Key Technologies
- **Pure Vanilla JavaScript** (ES6+ modules)
- **CSS Grid** for layout
- **Google Sheets API** for read-only task data
- **Supabase PostgreSQL** for manual tasks + real-time sync
- **No build system** - runs directly in browser

### Existing Patterns to Follow
1. **State Management**: Centralized `state.js` + `event-bus.js`
2. **Weekly Logic**: `date-utils.js` (`getMonday()`, `getWeekMonth()`, `getWeekOfMonth()`)
3. **Grid Rendering**: `week-renderer.js` and `schedule-grid.js`
4. **Data Services**: `sheets-service.js` pattern
5. **Component Classes**: `CardRenderer` class-based approach
6. **Styling**: CSS custom properties with modular stylesheets

---

## Implementation Plan - Phases

### **Phase 1: Foundation & Data Model**

#### 1.1 Create Tracking Items Configuration
**File**: `src/config/releasability-config.js`

**Purpose**: Define all tracking items from the spreadsheet columns

**Content**:
- Tracking items list:
  - Shop Folder Built
  - Sample Approval
  - Color Log
  - Optimize Hours
  - Approved SB2
  - Batch Tracking
  - Work Order
  - Classroom #1
  - Final Tracking
  - Batching Sheets
  - Release to Buildrite Level
  - Release or Decline
  - Creating Report
  - Final Optimizer RRS
  - Classroom #2
  - Tailor Sales Ticket
  - 3D Drawings Parts List
  - Classroom #3
  - Toolpath Program
  - Mill 3D Staging

- Status definitions:
  ```javascript
  export const STATUS = {
    INCOMPLETE: 'incomplete',    // Red: #EF4444
    IN_PROGRESS: 'in_progress',  // Yellow: #F59E0B
    COMPLETE: 'complete'         // Green: #22C55E
  };
  ```

- Color scheme constants
- Default tracking status template

#### 1.2 Create Data Model & State Management
**File**: `src/pages/releasability/releasability-state.js`

**Purpose**: Manage board state and data

**Features**:
- Project structure:
  ```javascript
  {
    id: 'unique-id',
    project: 'Project Name',
    week: 'Week 2: Nov 10-15',
    weekMonday: '2025-11-10',
    department: 'Cast',
    source: 'sheets' | 'manual',
    trackingStatus: {
      'Shop Folder Built': 'complete',
      'Sample Approval': 'in_progress',
      'Color Log': 'incomplete',
      // ... all tracking items
    }
  }
  ```
- State management functions:
  - `getAllProjects()`
  - `getProjectsByWeek(weekMonday)`
  - `updateProjectStatus(projectId, trackingItem, newStatus)`
  - `addManualProject(projectData)`
  - `removeProject(projectId)`
- Event-bus integration for reactivity
- State persistence in localStorage

#### 1.3 Google Sheets Integration
**File**: `src/pages/releasability/releasability-service.js`

**Purpose**: Fetch and sync project data

**Features**:
- Extend `sheets-service.js` pattern
- Fetch project list from existing schedule data
- **Project Start Detection**: Find the first task date for each project
  - Group all tasks by project name
  - Find minimum date for each project (earliest task)
  - This date determines which week the project appears in the releasability board
- Map projects to weeks using `date-utils.js`:
  - `getMonday(taskDate)` for week boundaries
  - `getWeekMonth(monday)` for month association
  - `getWeekOfMonth(monday, month)` for week labels
- Merge Google Sheets projects with manual projects
- Support for manual project additions (stored in Supabase)
- Real-time sync with Supabase subscriptions

---

### **Phase 2: Core UI Components**

#### 2.1 Create Standalone HTML Page
**File**: `releasability.html`

**Purpose**: Entry point for releasability board

**Structure**:
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Releasability Board</title>

    <!-- Existing stylesheets -->
    <link rel="stylesheet" href="src/styles/variables.css">
    <link rel="stylesheet" href="src/styles/base.css">
    <link rel="stylesheet" href="src/styles/buttons.css">
    <link rel="stylesheet" href="src/styles/modals.css">

    <!-- New releasability stylesheet -->
    <link rel="stylesheet" href="src/styles/releasability.css">
</head>
<body>
    <div id="releasability-app">
        <header class="releasability-header">
            <h1>Releasability Board</h1>
            <div class="header-controls">
                <button id="add-project-btn">Add Project</button>
                <button id="prev-week-btn">← Previous Week</button>
                <button id="next-week-btn">Next Week →</button>
                <button id="current-week-btn">Current Week</button>
            </div>
        </header>

        <div id="releasability-grid-container"></div>
    </div>

    <script type="module" src="src/pages/releasability/releasability-page.js"></script>
</body>
</html>
```

#### 2.2 Build Grid Renderer
**File**: `src/pages/releasability/releasability-grid.js`

**Purpose**: Render the main releasability grid

**Features**:
- **Grid Structure**:
  - CSS Grid layout
  - Left column: Week headers + project rows
  - Top row: Tracking item headers (horizontal scroll if needed)
  - Cells: Project + tracking item intersection

- **Weekly Logic** (reuse existing utilities):
  - `getMonday()` for week boundaries
  - `getWeekMonth()` and `getWeekOfMonth()` for week labels
  - Display: previous week + all future weeks with projects

- **Grid Generation**:
  ```javascript
  export function renderReleasabilityGrid(projects, trackingItems) {
    // 1. Group projects by week
    const projectsByWeek = groupProjectsByWeek(projects);

    // 2. Get week range (previous week + future weeks)
    const weeks = getWeekRange(projectsByWeek);

    // 3. Create grid container
    const grid = document.createElement('div');
    grid.className = 'releasability-grid';

    // 4. Create header row (tracking items)
    const headerRow = createHeaderRow(trackingItems);
    grid.appendChild(headerRow);

    // 5. Create week sections
    weeks.forEach(weekMonday => {
      const weekSection = createWeekSection(weekMonday, projectsByWeek[weekMonday], trackingItems);
      grid.appendChild(weekSection);
    });

    return grid;
  }
  ```

- **Week Section Structure**:
  ```javascript
  function createWeekSection(weekMonday, projects, trackingItems) {
    // Week header row
    const weekHeader = document.createElement('div');
    weekHeader.className = 'week-header';
    weekHeader.textContent = formatWeekLabel(weekMonday); // "Week 2: Nov 10-15"

    // Project rows for this week
    projects.forEach(project => {
      const projectRow = createProjectRow(project, trackingItems);
      // Append to grid
    });
  }
  ```

#### 2.3 Cell Status Renderer
**File**: `src/pages/releasability/releasability-cell-renderer.js`

**Purpose**: Render individual status cells with interactivity

**Features**:
- Cell rendering with status colors:
  ```javascript
  export class CellRenderer {
    createCell(project, trackingItem, currentStatus) {
      const cell = document.createElement('div');
      cell.className = `status-cell status-${currentStatus}`;
      cell.dataset.projectId = project.id;
      cell.dataset.trackingItem = trackingItem;

      // Visual indicator based on status
      switch(currentStatus) {
        case STATUS.COMPLETE:
          cell.innerHTML = '<span class="status-icon">✓</span>';
          cell.style.backgroundColor = '#22C55E'; // Green
          break;
        case STATUS.IN_PROGRESS:
          cell.innerHTML = '<span class="status-icon">○</span>';
          cell.style.backgroundColor = '#F59E0B'; // Yellow
          break;
        case STATUS.INCOMPLETE:
          cell.innerHTML = '<span class="status-icon">-</span>';
          cell.style.backgroundColor = '#EF4444'; // Red
          break;
      }

      // Click handler for status cycling
      cell.addEventListener('click', () => this.cycleStatus(project.id, trackingItem));

      return cell;
    }

    cycleStatus(projectId, trackingItem) {
      // incomplete → in_progress → complete → incomplete
      const currentStatus = state.getProjectStatus(projectId, trackingItem);
      const nextStatus = this.getNextStatus(currentStatus);
      state.updateProjectStatus(projectId, trackingItem, nextStatus);
    }

    getNextStatus(current) {
      switch(current) {
        case STATUS.INCOMPLETE: return STATUS.IN_PROGRESS;
        case STATUS.IN_PROGRESS: return STATUS.COMPLETE;
        case STATUS.COMPLETE: return STATUS.INCOMPLETE;
      }
    }
  }
  ```

- Tooltips for status information
- Keyboard navigation support (arrow keys)
- Accessibility attributes (ARIA)

---

### **Phase 3: Interactivity & Features**

#### 3.1 Manual Project Management
**Features**:
- "Add Project" button in header
- Modal dialog for project creation:
  - Project name (required)
  - Week selection (dropdown or date picker)
  - Department (optional dropdown)
- **Week Movement Controls**:
  - Move project to previous week button (←)
  - Move project to next week button (→)
  - Or drag-and-drop to different week section
  - Updates project's start week
- Form validation
- Create project with default "incomplete" status for all tracking items
- Store in Supabase for persistence
- Delete project functionality (with confirmation)

#### 3.2 Cell Editing & Status Updates
**Features**:
- Click handler for status cycling (complete → in_progress → incomplete)
- Keyboard navigation:
  - Arrow keys to move between cells
  - Space/Enter to cycle status
  - Tab navigation
- Batch operations:
  - Mark entire row (all items for a project)
  - Mark entire column (all projects for a tracking item)
  - Right-click context menu
- Real-time sync across clients (Supabase subscriptions)
- Visual feedback on save (flash/highlight)

#### 3.3 Week Navigation & Filtering
**Features**:
- Navigation controls:
  - Previous/Next week buttons
  - "Jump to Current Week" button
  - Week picker dropdown
- Scroll behavior:
  - Smooth scroll to target week
  - Snap-to-week on scroll
- Department filter (reuse `department-filter.js` pattern):
  - Filter projects by department
  - Multi-select support
- Search functionality:
  - Search projects by name
  - Highlight matching rows
- View preferences saved to localStorage

---

### **Phase 4: Advanced Features & Polish**

#### 4.1 Print Support
**Features**:
- Adapt `print-renderer.js` and `print-layout.js` patterns
- Print button in header
- Print-optimized layout:
  - Page breaks between weeks
  - Landscape orientation
  - Proper table formatting
- Export as PDF (browser print to PDF)
- Weekly/monthly summary reports
- Legend for status colors

#### 4.2 Styling & Responsive Design
**File**: `src/styles/releasability.css`

**Features**:
- CSS Grid layout for main table:
  ```css
  .releasability-grid {
    display: grid;
    grid-template-columns: 200px repeat(auto-fit, 100px);
    gap: 1px;
    background: var(--border-primary);
  }
  ```

- Sticky headers:
  ```css
  .tracking-item-header {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--background-primary);
  }

  .week-header,
  .project-name-cell {
    position: sticky;
    left: 0;
    z-index: 5;
    background: var(--background-primary);
  }
  ```

- Status color coding with CSS custom properties:
  ```css
  .status-cell.status-complete {
    background-color: var(--status-complete, #22C55E);
    color: white;
  }

  .status-cell.status-in-progress {
    background-color: var(--status-in-progress, #F59E0B);
    color: white;
  }

  .status-cell.status-incomplete {
    background-color: var(--status-incomplete, #EF4444);
    color: white;
  }
  ```

- Hover effects and transitions
- Mobile-responsive stacked view (vertical scrolling)
- Print-specific styles (`@media print`)

#### 4.3 Data Persistence & Sync
**Features**:
- Auto-save on status changes
- Debounced save (avoid excessive writes)
- Conflict resolution for multi-user editing:
  - Last-write-wins strategy
  - Optional: Show conflict indicators
- Export/import functionality:
  - CSV export (for Excel)
  - JSON export/import (backup)
- Integration with existing Google Sheets for project sync
- Periodic refresh from Google Sheets (every 5 minutes)
- Offline support with localStorage cache

---

## Key Technical Decisions

### 1. Weekly Logic Reuse
- Leverage existing `date-utils.js` functions
- Week definition: Monday through Saturday (6 days)
- Week labels: "Week 2: Nov 10-15"
- Week grouping based on Monday date

### 2. Grid Layout
- CSS Grid with sticky positioning
- Similar to `schedule-grid.css` pattern
- Horizontal scroll for tracking items (if many columns)
- Vertical scroll for projects
- Both headers sticky

### 3. State Management
- Follow `state.js` + `event-bus.js` pattern
- Events:
  - `releasability:project-added`
  - `releasability:project-removed`
  - `releasability:status-updated`
  - `releasability:data-loaded`

### 4. Data Storage Strategy
- **Google Sheets**: Read-only project list (synced from existing schedule)
  - **Project detection logic**: Find earliest task date for each project
  - Only the first occurrence matters for determining project start week
- **Supabase**:
  - Manual projects (with start week)
  - All tracking status data (20 status fields per project)
  - Real-time subscriptions for multi-user sync
- **localStorage**:
  - UI preferences (scroll position, filters, view settings)
  - Offline cache

### 5. Component Pattern
- Modular classes similar to `CardRenderer`
- Separation of concerns:
  - Renderer (pure rendering logic)
  - Controller (event handling, data updates)
  - Service (data fetching, persistence)

### 6. Routing
- Standalone page (`releasability.html`)
- No routing library needed
- Accessible via `/releasability.html` URL
- Could add link in main app header (optional)

---

## Development Order (Step-by-Step)

### **STEP 1**: Configuration & Data Model (Foundation)
**Files**:
- `src/config/releasability-config.js`
- `src/pages/releasability/releasability-state.js`

**Tasks**:
- [ ] Define tracking items list
- [ ] Define status enums and colors
- [ ] Create data structure interfaces
- [ ] Implement state management functions
- [ ] Set up event-bus integration

**Estimated Time**: 2-3 hours

---

### **STEP 2**: Basic HTML Page
**Files**:
- `releasability.html`

**Tasks**:
- [ ] Create HTML structure
- [ ] Add header with controls
- [ ] Add grid container
- [ ] Link stylesheets
- [ ] Link main JavaScript module

**Estimated Time**: 30 minutes

---

### **STEP 3**: Styling Foundation
**Files**:
- `src/styles/releasability.css`

**Tasks**:
- [ ] Define CSS Grid layout
- [ ] Set up sticky headers
- [ ] Define status colors (red/yellow/green)
- [ ] Add cell hover effects
- [ ] Add responsive breakpoints
- [ ] Add print styles

**Estimated Time**: 1-2 hours

---

### **STEP 4**: Grid Renderer (Core Display)
**Files**:
- `src/pages/releasability/releasability-grid.js`

**Tasks**:
- [ ] Import date utilities (`getMonday`, `getWeekMonth`, `getWeekOfMonth`)
- [ ] Implement `groupProjectsByWeek()` function
- [ ] Implement `getWeekRange()` function (previous + future weeks)
- [ ] Implement `createHeaderRow()` for tracking items
- [ ] Implement `createWeekSection()` for week headers
- [ ] Implement `createProjectRow()` for project rows
- [ ] Create empty grid cells
- [ ] Add to DOM

**Estimated Time**: 3-4 hours

---

### **STEP 5**: Data Integration
**Files**:
- `src/pages/releasability/releasability-service.js`
- `src/pages/releasability/releasability-page.js`

**Tasks**:
- [ ] Extend `sheets-service.js` pattern
- [ ] Fetch projects from Google Sheets schedule data
- [ ] Parse and transform project data
- [ ] **Detect project start dates** (find earliest task date per project)
- [ ] Group projects by their start week using `getMonday()`
- [ ] Filter for previous week + future weeks
- [ ] Merge with manual projects from Supabase
- [ ] Initialize page controller
- [ ] Call renderer with data

**Estimated Time**: 3-4 hours

---

### **STEP 6**: Cell Rendering
**Files**:
- `src/pages/releasability/releasability-cell-renderer.js`

**Tasks**:
- [ ] Create `CellRenderer` class
- [ ] Implement `createCell()` method
- [ ] Add status color rendering
- [ ] Add visual indicators (checkmark, dot, dash)
- [ ] Add click handlers for status cycling
- [ ] Implement `cycleStatus()` method
- [ ] Update state on clicks
- [ ] Trigger re-render on status change

**Estimated Time**: 2-3 hours

---

### **STEP 7**: Manual Project Management
**Files**:
- `src/pages/releasability/modals/add-project-modal.js` (optional)
- Update `releasability-page.js`

**Tasks**:
- [ ] Create "Add Project" button handler
- [ ] Create modal dialog (or use inline form)
- [ ] Add form fields (project name, week, department)
- [ ] Add form validation
- [ ] Implement `addManualProject()` in state
- [ ] Store in Supabase or localStorage
- [ ] Refresh grid with new project
- [ ] Add delete project functionality

**Estimated Time**: 2-3 hours

---

### **STEP 8**: Navigation & Filtering
**Files**:
- Update `releasability-page.js`
- Update `releasability-grid.js`

**Tasks**:
- [ ] Implement week navigation (previous/next)
- [ ] Add "Jump to Current Week" functionality
- [ ] Add scroll-to-week behavior
- [ ] Add department filter dropdown
- [ ] Implement filter logic
- [ ] Add search functionality
- [ ] Save preferences to localStorage

**Estimated Time**: 2-3 hours

---

### **STEP 9**: Persistence
**Files**:
- Update `releasability-service.js`
- Update `releasability-state.js`

**Tasks**:
- [ ] Set up Supabase table for tracking status
- [ ] Implement save function (debounced)
- [ ] Auto-save on status changes
- [ ] Load saved statuses on page load
- [ ] Merge Google Sheets + Supabase data
- [ ] Set up real-time subscriptions
- [ ] Handle conflicts

**Estimated Time**: 3-4 hours

---

### **STEP 10**: Polish & Advanced Features
**Files**:
- Various

**Tasks**:
- [ ] Add print support
- [ ] Add export functionality (CSV, JSON)
- [ ] Optimize performance (virtualization if needed)
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add keyboard navigation
- [ ] Add tooltips and help text
- [ ] Add batch operations
- [ ] Mobile responsive refinements
- [ ] Cross-browser testing

**Estimated Time**: 4-6 hours

---

## Total Estimated Time
**25-35 hours** of development time

---

## Requirements & Decisions

Based on project requirements, the following decisions have been made:

### 1. Data Source
**Decision**: Existing Google Sheets schedule data

**Details**:
- Projects will be pulled from the current schedule sheet
- **Important**: Only track when a project **starts** (first appearance in schedule)
- Projects automatically appear in releasability board when they have their first scheduled task
- Use the first task date to determine the project's start week

### 2. Persistence Strategy
**Decision**: Supabase (PostgreSQL with real-time sync)

**Rationale**:
- Multi-user support required
- Real-time sync across clients
- Persistent storage across devices
- Existing Supabase infrastructure in place

**Storage Breakdown**:
- **Supabase**: All tracking status data, manual projects
- **localStorage**: UI preferences only (scroll position, filters)

### 3. Week Range
**Decision**: 1 past week + all future weeks with projects

**Details**:
- Display the previous week (relative to current week)
- Display all future weeks that have projects scheduled
- Dynamic range (grows as projects are scheduled further out)
- Empty weeks are not displayed

### 4. Manual Projects
**Decision**: Project name required, with week movement capability

**Features**:
- User can add projects by name only
- Ability to move projects forward/backward through weeks within the table
- Drag-and-drop or button-based week reassignment
- No department required (optional field)
- Manual projects persist in Supabase

### 5. Tracking Items
**Decision**: Hardcoded from example image

**Items List** (20 columns):
1. Shop Folder Built
2. Sample Approval
3. Color Log
4. Optimize Hours
5. Approved SB2
6. Batch Tracking
7. Work Order
8. Classroom #1
9. Final Tracking
10. Batching Sheets
11. Release to Buildrite Level
12. Release or Decline
13. Creating Report
14. Final Optimizer RRS
15. Classroom #2
16. Tailor Sales Ticket
17. 3D Drawings Parts List
18. Classroom #3
19. Toolpath Program
20. Mill 3D Staging

**Note**: Not configurable in Phase 1. Could add configurability in future phase if needed.

### 6. Multi-user Support
**Decision**: Yes, real-time sync enabled

**Implementation**:
- Supabase real-time subscriptions
- Multiple users can edit simultaneously
- Status changes broadcast to all connected clients
- Last-write-wins conflict resolution strategy
- Visual indicators when other users make changes

### 7. Integration with Main App
**Decision**: Standalone only, no integration

**Access**:
- Direct URL access: `/releasability.html`
- No navigation link in main app
- Completely independent page
- Can be bookmarked directly

---

## Next Steps

1. Review this plan and answer the questions above
2. Start with STEP 1 (Configuration & Data Model)
3. Iteratively build and test each component
4. Review UI/UX after STEP 6
5. Add advanced features in phases

---

## Notes & Considerations

- **Performance**: If project list grows large (100+ projects), consider virtual scrolling
- **Browser Support**: Target modern browsers (Chrome, Firefox, Safari, Edge)
- **Mobile**: Consider mobile-first design for smaller screens
- **Accessibility**: Ensure keyboard navigation and screen reader support
- **Testing**: Manual testing for each step, consider automated tests later
- **Documentation**: Update this document as implementation progresses

---

---

## Implementation Notes

### Project Start Detection Algorithm
```javascript
// Pseudocode for detecting project start weeks
function detectProjectStartWeeks(allTasks) {
  const projectStartDates = {};

  // Find earliest date for each project
  allTasks.forEach(task => {
    const projectName = task.project;
    const taskDate = parseDate(task.date);

    if (!projectStartDates[projectName] || taskDate < projectStartDates[projectName]) {
      projectStartDates[projectName] = taskDate;
    }
  });

  // Map to weeks
  const projectStartWeeks = {};
  Object.entries(projectStartDates).forEach(([project, date]) => {
    const monday = getMonday(date);
    projectStartWeeks[project] = monday;
  });

  return projectStartWeeks;
}
```

### Week Movement for Manual Projects
Manual projects can be moved between weeks using:
1. **Arrow buttons** next to project name (← →)
2. **Drag-and-drop** the project row to a different week section
3. **Context menu** right-click option "Move to week..."

Movement updates the project's `weekMonday` field in Supabase and triggers a grid re-render.

---

*Last Updated: 2025-11-10*
*Feature Branch: feature/releasability-board*
*Requirements Finalized: 2025-11-10*
