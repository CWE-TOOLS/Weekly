# Phase 4: State Management - Briefing Document

**Date:** 2025-10-28
**Status:** Ready to Start
**Previous Phases:** Phase 1 ✅ | Phase 2 ✅ | Phase 3 ✅

---

## 🎯 Mission

Extract all state management code from `index-old.html` and create a centralized state management system with event-driven architecture.

**Goal:** Move from scattered global variables to a clean, centralized state management system that enables better testing, debugging, and component decoupling.

---

## ✅ What's Already Done

### Phase 1: Foundation & Configuration
- ✅ CSS extracted and modularized
- ✅ Configuration centralized
- ✅ Print system modularized

### Phase 2: Utility Functions
- ✅ Date utilities extracted
- ✅ UI utilities extracted
- ✅ ES6 module system working

### Phase 3: Services Layer
- ✅ Authentication service (`auth-service.js`)
- ✅ Google Sheets service (`sheets-service.js`)
- ✅ Supabase service (`supabase-service.js`)
- ✅ Data orchestration service (`data-service.js`)

---

## 🚧 What Needs to Be Done (Phase 4)

### State Files to Create

| File | Status | Purpose |
|------|--------|---------|
| `src/core/state.js` | ⚠️ Partial | Centralize all application state |
| `src/core/event-bus.js` | ❌ Missing | Event system for component communication |
| `src/core/storage.js` | ❌ Missing | LocalStorage wrapper for persistence |

---

## 📍 Source Code Locations

All state code to extract is in **`index-old.html`**:

```javascript
// Lines 1132-1141: Global state variables
let allTasks = [];
let filteredTasks = [];
let currentDate = new Date();
let allWeekStartDates = []; // Store the start dates of all rendered weeks
const EDIT_PASSWORD = 'cwe'; // Rudimentary password for unlocking editing
let currentProjectName = '';
let currentViewedWeekIndex = -1; // Track the currently viewed week to preserve on refresh
let lastRenderTimestamp = null; // Track when we last successfully rendered
let renderCache = null; // Cache the last successful render

// Lines 1554-1560: getSelectedDepartments function
function getSelectedDepartments() {
    const selected = [];
    document.querySelectorAll('#department-list input[type="checkbox"]:checked').forEach(checkbox => {
        selected.push(checkbox.value);
    });
    return selected;
}

// Lines 1562-1598: populateDepartmentCheckboxes function (uses localStorage)
function populateDepartmentCheckboxes() {
    // ... reads from localStorage.getItem('selectedDepartments')
}

// Lines 1616-1632: filterTasks function (manages filteredTasks state)
function filterTasks() {
    const selectedDepartments = getSelectedDepartments();
    localStorage.setItem('selectedDepartments', JSON.stringify(selectedDepartments));
    // ... filters allTasks into filteredTasks
}

// Lines 1743-1820: renderAllWeeks function (manages week state and localStorage)
// Uses localStorage for: scheduleScrollPosition, currentViewedWeekIndex
```

---

## 🎯 Implementation Order

### 1. Create State Manager (`src/core/state.js`)
**Priority:** CRITICAL (foundation for everything else)

**State to Manage:**
```javascript
// Task data
allTasks: []
filteredTasks: []

// Date/Week state
currentDate: Date
allWeekStartDates: []
currentViewedWeekIndex: -1

// UI state
currentProjectName: ''
isEditingUnlocked: false

// Render optimization
lastRenderTimestamp: null
renderCache: null
```

**API Design:**
```javascript
// Getters
export function getAllTasks()
export function getFilteredTasks()
export function getCurrentDate()
export function getAllWeekStartDates()
export function getCurrentViewedWeekIndex()
export function getCurrentProjectName()
export function isEditingUnlocked()

// Setters
export function setAllTasks(tasks)
export function setFilteredTasks(tasks)
export function setCurrentDate(date)
export function setAllWeekStartDates(dates)
export function setCurrentViewedWeekIndex(index)
export function setCurrentProjectName(name)
export function setEditingUnlocked(unlocked)

// Computed
export function getSelectedDepartments()
export function getCurrentWeekDate()
```

---

### 2. Create Event Bus (`src/core/event-bus.js`)
**Priority:** HIGH (enables component decoupling)

**Events to Implement:**
```javascript
// Data events
'tasks:loaded'        // Fired when tasks are fetched
'tasks:updated'       // Fired when task is modified
'tasks:filtered'      // Fired when filters change

// UI events
'week:changed'        // Fired when week navigation occurs
'department:filtered' // Fired when department selection changes
'editing:toggled'     // Fired when edit mode changes
'project:opened'      // Fired when project modal opens
```

**API Design:**
```javascript
export function on(event, handler)
export function off(event, handler)
export function emit(event, data)
export function once(event, handler)
export function clear(event)
```

---

### 3. Create Storage Manager (`src/core/storage.js`)
**Priority:** MEDIUM (for state persistence)

**LocalStorage Keys to Manage:**
```javascript
'selectedDepartments'     // Department filter selection
'scheduleScrollPosition'  // Scroll position in schedule
'currentViewedWeekIndex'  // Currently viewed week
'editingUnlocked'         // Edit mode state
'printSelectedDepartments' // Print dialog department selection
```

**API Design:**
```javascript
export function saveState(key, value)
export function loadState(key, defaultValue)
export function removeState(key)
export function clearAllState()

// Typed helpers
export function saveSelectedDepartments(departments)
export function loadSelectedDepartments()
export function saveScrollPosition(position)
export function loadScrollPosition()
export function saveWeekIndex(index)
export function loadWeekIndex()
export function saveEditingMode(unlocked)
export function loadEditingMode()
```

---

### 4. Update Services to Use State

**Modify `data-service.js`:**
```javascript
// Before: manages allTasks internally
let allTasks = [];

// After: updates state
import { setAllTasks, setFilteredTasks } from '../core/state.js';

export async function fetchAllTasks(silent = false) {
    // ... fetch logic
    const tasks = mergeTasks(sheetsTasks, manualTasks);
    setAllTasks(tasks); // Update state
    return tasks;
}
```

**Update `main.js`:**
```javascript
// Initialize state system
import * as state from './core/state.js';
import * as eventBus from './core/event-bus.js';
import * as storage from './core/storage.js';

// Restore persisted state on load
const savedDepartments = storage.loadSelectedDepartments();
const savedWeekIndex = storage.loadWeekIndex();
// ... apply saved state

// Expose state to window for backward compatibility
window.state = state;
window.eventBus = eventBus;
```

---

## 🧪 Testing Strategy

After completing each component:

1. **State Manager Test:**
   ```javascript
   // In browser console
   state.setAllTasks([{id: 1, project: 'Test'}]);
   console.log(state.getAllTasks()); // Should return array
   ```

2. **Event Bus Test:**
   ```javascript
   // Subscribe to event
   eventBus.on('tasks:loaded', (data) => console.log('Tasks loaded:', data));

   // Emit event
   eventBus.emit('tasks:loaded', {count: 5});
   ```

3. **Storage Test:**
   ```javascript
   storage.saveSelectedDepartments(['Mill', 'Cast']);
   console.log(storage.loadSelectedDepartments()); // Should return array
   ```

4. **Integration Test:**
   - Load page
   - Change department filter
   - Verify state updates
   - Verify event fires
   - Verify localStorage saves
   - Reload page
   - Verify state restores

---

## 🛠️ Development Setup

```bash
# 1. Navigate to project directory
cd "C:\Users\mike10\Documents\VScode projects\weekly"

# 2. HTTP server should already be running on port 8080
# If not, start it:
npx http-server -p 8080 --cors -o

# 3. Open browser to http://localhost:8080

# 4. Open browser console (F12) to check for errors
```

---

## 📦 Key Files Reference

### Already Available (Use These!)
- `src/config/api-config.js` - All API configuration
- `src/config/constants.js` - Application constants
- `src/config/department-config.js` - Department configuration
- `src/utils/date-utils.js` - Date utilities
- `src/utils/ui-utils.js` - UI utilities
- `src/services/auth-service.js` - Authentication
- `src/services/sheets-service.js` - Google Sheets
- `src/services/supabase-service.js` - Supabase
- `src/services/data-service.js` - Data orchestration

### To Create (Phase 4)
- `src/core/state.js` - State management
- `src/core/event-bus.js` - Event system
- `src/core/storage.js` - LocalStorage wrapper

### To Update
- `src/main.js` - Initialize state system
- `src/services/data-service.js` - Use state instead of local variables

### Source to Extract From
- `index-old.html` (lines 1132-1141, 1554-1632, 1743-1820)

---

## ✅ Success Criteria

- [ ] All global state variables extracted from `index-old.html`
- [ ] State managed through `state.js` with getter/setter API
- [ ] Event bus implemented with pub/sub pattern
- [ ] LocalStorage wrapper created with typed helpers
- [ ] State persists across page reloads
- [ ] Event system tested and working
- [ ] `main.js` initializes state system
- [ ] Services updated to use state
- [ ] No console errors on page load
- [ ] Backward compatibility maintained
- [ ] Can run `npx http-server -p 8080` and app loads

---

## 📝 Notes

- **State Immutability:** Consider making state updates immutable for easier debugging
- **Event Naming:** Use consistent naming convention (namespace:action)
- **LocalStorage Errors:** Handle QuotaExceededError and SecurityError
- **Backward Compatibility:** Expose state via window.state for legacy code
- **Debug Mode:** Consider adding state.debug() for development

---

## 🚀 Ready to Start?

1. Read this document
2. Review `REFACTORING_PLAN.md` Phase 4 section
3. Start with `state.js` (most critical)
4. Then `event-bus.js` (enables decoupling)
5. Then `storage.js` (adds persistence)
6. Update services to use state
7. Test everything together

**Estimated Time:** 2-3 hours
**Estimated Lines Extracted:** ~200 lines from `index-old.html`

**Good luck! 🎉**
