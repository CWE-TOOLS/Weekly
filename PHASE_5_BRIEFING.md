# Phase 5: UI Components - Core - Briefing Document

**Date:** 2025-10-29
**Status:** Ready to Start
**Previous Phases:** Phase 1 ✅ | Phase 2 ✅ | Phase 3 ✅ | Phase 4 ✅

---

## 🎯 Mission

Extract core UI rendering components from `index-old.html` into modular, reusable components. Focus on the schedule grid, task cards, week navigation, and department filtering.

**Goal:** Transform monolithic rendering code into clean, testable UI components that leverage the state management system built in Phase 4.

---

## ✅ What's Already Done

### Phase 1: Foundation & Configuration
- ✅ CSS extracted and modularized
- ✅ Configuration centralized
- ✅ Print system modularized

### Phase 2: Utility Functions
- ✅ Date utilities extracted (`date-utils.js`)
- ✅ UI utilities extracted (`ui-utils.js`)
- ✅ ES6 module system working

### Phase 3: Services Layer
- ✅ Authentication service (`auth-service.js`)
- ✅ Google Sheets service (`sheets-service.js`)
- ✅ Supabase service (`supabase-service.js`)
- ✅ Data orchestration service (`data-service.js`)

### Phase 4: State Management
- ✅ Centralized state manager (`state.js`)
- ✅ Event bus for component communication (`event-bus.js`)
- ✅ LocalStorage persistence (`storage.js`)
- ✅ State automatically updates when data loads

---

## 🚧 What Needs to Be Done (Phase 5)

### Component Files to Create

| Component | File | Purpose | Priority |
|-----------|------|---------|----------|
| Schedule Grid | `src/components/schedule-grid.js` | Main weekly schedule rendering | 🔴 Critical |
| Task Card | `src/components/task-card.js` | Individual task card rendering | 🔴 Critical |
| Week Navigation | `src/components/week-navigation.js` | Week selector and navigation | 🟡 High |
| Department Filter | `src/components/department-filter.js` | Department multi-select dropdown | 🟡 High |
| Search Bar | `src/components/search-bar.js` | Project search functionality | 🟢 Medium |

---

## 📍 Source Code Locations

All UI rendering code to extract is in **`index-old.html`**:

### 1. Schedule Grid Rendering (~600 lines)
```javascript
// Lines 1634-1820: renderAllWeeks function
function renderAllWeeks(weeks) {
    // Creates the main schedule grid
    // Renders department rows
    // Creates task cards for each day
    // Handles scroll position restoration
    // Manages week navigation state
}

// Lines 2233-2280: equalizeAllCardHeights function
function equalizeAllCardHeights() {
    // Equalizes card heights across all weeks
    // Ensures consistent layout
}
```

### 2. Task Card Rendering (~200 lines)
```javascript
// Lines 2060-2100: createTaskCard function (embedded in renderAllWeeks)
// Creates individual task cards with:
// - Project name display
// - Description
// - Day counter (Day X of Y)
// - Hour display
// - Edit/delete buttons (when unlocked)
// - Drag & drop handlers
// - Click handlers for project modal
```

### 3. Week Navigation (~150 lines)
```javascript
// Lines 1823-1850: updateWeekDisplayHeader function
function updateWeekDisplayHeader(date) {
    // Updates week header text
    // Shows current week range
}

// Lines 2282-2320: Week navigation button handlers
document.getElementById('prev-week').addEventListener('click', () => {
    // Navigate to previous week
});

document.getElementById('next-week').addEventListener('click', () => {
    // Navigate to next week
});

// Lines 1740-1770: Scroll-based week detection
wrapper.addEventListener('scroll', () => {
    // Detect current visible week
    // Update header
    // Save position to localStorage
});
```

### 4. Department Filter (~200 lines)
```javascript
// Lines 1554-1560: getSelectedDepartments function
function getSelectedDepartments() {
    const selected = [];
    document.querySelectorAll('#department-list input[type="checkbox"]:checked').forEach(checkbox => {
        selected.push(checkbox.value);
    });
    return selected;
}

// Lines 1562-1598: populateDepartmentCheckboxes function
function populateDepartmentCheckboxes() {
    // Creates department checkboxes
    // Restores selection from localStorage
    // Sets up change listeners
}

// Lines 1600-1614: updateMultiSelectLabel function
function updateMultiSelectLabel() {
    // Updates dropdown button label
    // Shows "X Departments Selected"
}

// Lines 1616-1632: filterTasks function
function filterTasks() {
    // Filters tasks by selected departments
    // Updates filteredTasks array
    // Triggers re-render
}
```

### 5. Search Bar (~100 lines)
```javascript
// Lines 2350-2400: Project search functionality
document.getElementById('project-search').addEventListener('input', (e) => {
    // Search through projects
    // Filter and highlight matches
    // Show search results
});
```

---

## 🎯 Implementation Order

### Step 1: Create Task Card Component (Foundation)
**File:** `src/components/task-card.js`
**Priority:** 🔴 CRITICAL (used by schedule grid)

**What to Extract:**
- Task card HTML generation
- Card styling and layout
- Drag & drop handlers
- Click handlers
- Edit/delete button logic

**API Design:**
```javascript
/**
 * Create a task card element
 * @param {Object} task - Task data
 * @param {Date} date - Date for this card
 * @param {boolean} isEditing - Whether editing is unlocked
 * @returns {HTMLElement} Task card element
 */
export function createTaskCard(task, date, isEditing) {
    // ...
}
```

---

### Step 2: Create Department Filter Component
**File:** `src/components/department-filter.js`
**Priority:** 🟡 HIGH (needed before rendering)

**What to Extract:**
- Department checkbox generation
- Selection state management
- Change event handlers
- Label updating logic
- Integration with state manager

**API Design:**
```javascript
/**
 * Initialize department filter
 * @param {string} containerId - Container element ID
 * @param {Function} onFilterChange - Callback when filter changes
 */
export function initializeDepartmentFilter(containerId, onFilterChange) {
    // ...
}

/**
 * Get currently selected departments
 * @returns {string[]} Array of department names
 */
export function getSelectedDepartments() {
    // ...
}

/**
 * Update the dropdown label text
 */
export function updateFilterLabel() {
    // ...
}
```

---

### Step 3: Create Schedule Grid Component
**File:** `src/components/schedule-grid.js`
**Priority:** 🔴 CRITICAL (main renderer)

**What to Extract:**
- Week grid generation
- Department row creation
- Task card placement
- Scroll position management
- Height equalization
- Initial week selection

**API Design:**
```javascript
/**
 * Render the schedule grid for all weeks
 * @param {Array<Date>} weekStartDates - Array of Monday dates
 * @param {Array} tasks - Filtered tasks to render
 */
export function renderScheduleGrid(weekStartDates, tasks) {
    // ...
}

/**
 * Equalize card heights across all weeks
 */
export function equalizeCardHeights() {
    // ...
}

/**
 * Navigate to a specific week
 * @param {number} weekIndex - Week index to navigate to
 */
export function navigateToWeek(weekIndex) {
    // ...
}
```

---

### Step 4: Create Week Navigation Component
**File:** `src/components/week-navigation.js`
**Priority:** 🟡 HIGH (user navigation)

**What to Extract:**
- Week header display
- Previous/Next button handlers
- Scroll-based week detection
- Week state synchronization

**API Design:**
```javascript
/**
 * Initialize week navigation
 * @param {Array<Date>} weekStartDates - Available weeks
 */
export function initializeWeekNavigation(weekStartDates) {
    // ...
}

/**
 * Update week header text
 * @param {Date} weekStart - Monday of current week
 */
export function updateWeekHeader(weekStart) {
    // ...
}

/**
 * Navigate to previous week
 */
export function navigateToPreviousWeek() {
    // ...
}

/**
 * Navigate to next week
 */
export function navigateToNextWeek() {
    // ...
}
```

---

### Step 5: Create Search Bar Component
**File:** `src/components/search-bar.js`
**Priority:** 🟢 MEDIUM (enhancement)

**What to Extract:**
- Search input handling
- Project filtering logic
- Search result highlighting
- Search state management

**API Design:**
```javascript
/**
 * Initialize project search
 * @param {string} inputId - Search input element ID
 */
export function initializeSearch(inputId) {
    // ...
}

/**
 * Filter tasks by search query
 * @param {string} query - Search query
 * @param {Array} tasks - Tasks to search
 * @returns {Array} Filtered tasks
 */
export function searchTasks(query, tasks) {
    // ...
}
```

---

## 🔗 Integration with Existing Systems

### State Management Integration
Components should **consume** state, not manage it:

```javascript
// ✅ GOOD: Read from state
import { getFilteredTasks, getAllWeekStartDates } from '../core/state.js';

const tasks = getFilteredTasks();
const weeks = getAllWeekStartDates();
```

```javascript
// ❌ BAD: Don't modify state directly
window.allTasks = [...]; // Don't do this!

// ✅ GOOD: Use state setters
import { setAllTasks } from '../core/state.js';
setAllTasks(newTasks);
```

### Event Bus Integration
Components should **emit** and **listen** to events:

```javascript
import { emit, on, EVENTS } from '../core/event-bus.js';

// Listen for state changes
on(EVENTS.TASKS_FILTERED, ({ tasks }) => {
    renderScheduleGrid(weeks, tasks);
});

// Emit user actions
emit(EVENTS.DEPARTMENT_FILTERED, { departments });
```

### Storage Integration
Use storage for UI preferences:

```javascript
import { saveScrollPosition, loadScrollPosition } from '../core/storage.js';

// Save scroll position
wrapper.addEventListener('scroll', () => {
    saveScrollPosition(wrapper.scrollLeft);
});

// Restore scroll position
const savedPosition = loadScrollPosition();
wrapper.scrollLeft = savedPosition;
```

---

## 🧪 Testing Strategy

### Unit Tests
Each component should have tests for:
- Rendering with various inputs
- Event handlers
- Edge cases (empty data, missing fields)
- Error handling

### Integration Tests
- Department filter + schedule grid
- Week navigation + scroll position
- Search + task filtering

### Browser Tests (Playwright)
- Visual regression testing
- Scroll behavior
- Click interactions
- Drag & drop (Phase 7)

---

## ✅ Success Criteria

- [ ] All components created and documented
- [ ] Components use state manager (not global variables)
- [ ] Components emit/listen to events
- [ ] No direct DOM manipulation outside components
- [ ] Schedule renders correctly with all tasks
- [ ] Department filtering works
- [ ] Week navigation works
- [ ] Search functionality works
- [ ] Scroll position persists
- [ ] No console errors
- [ ] App runs on `http://localhost:8080` or `http://localhost:8083`
- [ ] Backward compatibility maintained (for now)
- [ ] ~1,000 lines extracted from `index-old.html`

---

## 🚧 NOT In Scope for Phase 5

The following will be handled in later phases:

**Phase 6: Modals**
- Project detail modal
- Add task modal
- Password modal
- Print modal

**Phase 7: Advanced Features**
- Drag & drop functionality
- Inline editing
- Context menus
- Real-time updates UI

**Phase 8: App Controller**
- Main app initialization
- Route handling (if needed)
- Global error handling

---

## 📂 Expected File Structure After Phase 5

```
src/
├── components/              # ⭐ NEW
│   ├── schedule-grid.js     # Main schedule renderer
│   ├── task-card.js         # Task card component
│   ├── week-navigation.js   # Week selector
│   ├── department-filter.js # Department filter
│   └── search-bar.js        # Project search
├── core/
│   ├── state.js             # ✅ Phase 4
│   ├── event-bus.js         # ✅ Phase 4
│   └── storage.js           # ✅ Phase 4
├── services/
│   ├── auth-service.js      # ✅ Phase 3
│   ├── sheets-service.js    # ✅ Phase 3
│   ├── supabase-service.js  # ✅ Phase 3
│   └── data-service.js      # ✅ Phase 3
├── utils/
│   ├── date-utils.js        # ✅ Phase 2
│   └── ui-utils.js          # ✅ Phase 2
├── config/                  # ✅ Phase 1
├── features/print/          # ✅ Phase 1
├── styles/                  # ✅ Phase 1
└── main.js                  # Entry point (to be updated)
```

---

## 🎬 Getting Started

### Prerequisites
```bash
# Ensure development server is running
npx http-server -p 8083 --cors -c-1
```

### Development Workflow

1. **Create component file** in `src/components/`
2. **Extract code** from `index-old.html`
3. **Add ES6 imports** for dependencies
4. **Add ES6 exports** for public API
5. **Test in browser** - verify rendering
6. **Update main.js** to initialize component
7. **Commit changes** with descriptive message

### Code Organization Pattern

Each component file should follow this structure:

```javascript
/**
 * Component Name
 * Description of what this component does
 * @module components/component-name
 */

// Imports
import { ... } from '../core/state.js';
import { ... } from '../core/event-bus.js';
import { ... } from '../utils/date-utils.js';

// Private helper functions
function helperFunction() {
    // ...
}

// Public API
export function initializeComponent() {
    // ...
}

export function renderComponent() {
    // ...
}
```

---

## 📊 Progress Tracking

### Estimated Effort
- **Task Card:** ~3-4 hours
- **Department Filter:** ~3-4 hours
- **Schedule Grid:** ~6-8 hours (most complex)
- **Week Navigation:** ~2-3 hours
- **Search Bar:** ~2-3 hours
- **Testing & Integration:** ~4-5 hours
- **Total:** ~20-27 hours (3-4 days)

### Milestones
1. ✅ **Milestone 1:** Task card component working
2. ✅ **Milestone 2:** Department filter working
3. ✅ **Milestone 3:** Schedule grid rendering
4. ✅ **Milestone 4:** Week navigation working
5. ✅ **Milestone 5:** Search working
6. ✅ **Milestone 6:** All integration tests passing

---

## 🔍 Key Design Principles

### 1. Single Responsibility
Each component has ONE job:
- Task card = render a task
- Schedule grid = render the grid
- Department filter = filter by department

### 2. Event-Driven
Components communicate via events, not direct calls:
```javascript
// Component A emits
emit(EVENTS.DEPARTMENT_FILTERED, { departments });

// Component B listens
on(EVENTS.DEPARTMENT_FILTERED, ({ departments }) => {
    // Re-render with new filter
});
```

### 3. Stateless Where Possible
Components read from central state, don't maintain their own:
```javascript
// ✅ GOOD: Read from state
const tasks = getFilteredTasks();

// ❌ BAD: Maintain own state
let componentTasks = [...];
```

### 4. Composable
Components should be usable in different contexts:
```javascript
// Used in main schedule
renderScheduleGrid(weeks, tasks);

// Could also be used in print preview
renderScheduleGrid(printWeeks, printTasks);
```

---

## 🆘 Common Pitfalls to Avoid

### ❌ Don't Do This:
```javascript
// Global state access
window.allTasks.push(task);

// Direct DOM manipulation outside component
document.getElementById('schedule-container').innerHTML = '';

// Tight coupling
import { renderScheduleGrid } from './schedule-grid.js';
renderScheduleGrid(); // Component doesn't know its dependencies
```

### ✅ Do This Instead:
```javascript
// Use state setters
import { setAllTasks, getAllTasks } from '../core/state.js';
setAllTasks([...getAllTasks(), task]);

// Component manages its own DOM
export function renderScheduleGrid(container, weeks, tasks) {
    container.innerHTML = '';
    // ... render
}

// Clear dependencies
renderScheduleGrid(containerElement, weekDates, filteredTasks);
```

---

## 📚 Additional Resources

- **REFACTORING_PLAN.md** - Overall architecture
- **PHASE_4_BRIEFING.md** - State management details
- **src/core/state.js** - State API reference
- **src/core/event-bus.js** - Event bus API reference
- **index-old.html** - Source code to extract

---

**Document Version:** 1.0
**Last Updated:** 2025-10-29
**Author:** Rooroo Developer
**Status:** Ready to Start
**Estimated Duration:** 3-4 days

---

## 🚀 Let's Build Phase 5!

Ready to transform the monolithic UI into clean, modular components. Focus on creating small, testable, reusable components that leverage our new state management system!

**Start with:** Task Card Component → Department Filter → Schedule Grid → Week Navigation → Search Bar
