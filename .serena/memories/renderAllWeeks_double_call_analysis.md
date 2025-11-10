# renderAllWeeks Double Call Investigation

## Issue Summary
`renderAllWeeks` is being called twice during initial page load, causing unnecessary rendering overhead and performance issues.

## Call Sequence (Root Cause Analysis)

### The Double Call Flow:
1. **data-service.js:fetchAllTasks()** -> calls setAllTasks(allTasks, shouldSuppressEvents)
2. **state.js:setAllTasks()** emits TASKS_LOADED event (when suppressEvents=false)
3. **component-events.js:setupComponentEvents()** has listener for TASKS_LOADED
4. **component-events.js** -> calls renderAllWeeks() [FIRST CALL]

AND ALSO:

1. **data-service.js:fetchAllTasks()** -> calls setAllTasks() again at line 92
2. **state.js:setAllTasks()** emits TASKS_LOADED event
3. **component-events.js** listener fires AGAIN (or never unsubscribed)
4. **component-events.js** -> calls renderAllWeeks() [SECOND CALL]

**Actually the real sequence is:**

1. **initialization-orchestrator.js:loadInitialData()** calls dataService.fetchAllTasks(false)
2. **data-service.js:fetchAllTasks()** at line 144 calls:
   - setAllTasks(allTasks, shouldSuppressEvents) which emits TASKS_LOADED
3. **component-events.js:setupComponentEvents()** listens for:
   - TASKS_LOADED event -> renderAllWeeks() [FIRST CALL] (line 41)
   - TASKS_FILTERED event -> renderAllWeeks() (line 32)
4. **department-filter.js:initializeDepartmentFilter()** at line 145 calls:
   - filterTasks() 
   - filterTasks() calls setFilteredTasks(filtered) 
   - setFilteredTasks() emits TASKS_FILTERED event
   - component-events.js listener for TASKS_FILTERED fires -> renderAllWeeks() [SECOND CALL]

## Event Flow Diagram

```
Phase 5: loadInitialData()
    ↓
dataService.fetchAllTasks()
    ↓
setAllTasks(allTasks, false)  [false = don't suppress events]
    ↓
emit(TASKS_LOADED)
    ├─→ [Listener 1] component-events.js → renderAllWeeks() [1st CALL]
    └─→ [Listener 2] department-filter.js → populateDepartmentCheckboxes() + filterTasks()
                                                ↓
                                        setFilteredTasks(filtered)
                                                ↓
                                        emit(TASKS_FILTERED)
                                                ↓
                                        component-events.js → renderAllWeeks() [2nd CALL]
```

## Files Involved

### 1. data-service.js (line 144)
- **When**: Phase 5: Data Loading
- **What**: Calls `setAllTasks(allTasks, shouldSuppressEvents)`
- **shouldSuppressEvents**: false (because silent=false in loadInitialData call)

### 2. state.js - setAllTasks()
```javascript
export function setAllTasks(tasks, silent = false) {
    _allTasks = tasks;
    if (!silent) {
        emit(EVENTS.TASKS_LOADED, { tasks, count: tasks.length });  // Line ~92
    }
}
```

### 3. component-events.js (setupComponentEvents)
```javascript
// Line 41 - Listens for TASKS_LOADED
eventBus.on(eventBus.EVENTS.TASKS_LOADED, () => {
    logger.info('📊 Tasks loaded, rendering schedule...');
    if (isEditingActive()) {
        queueRefresh(() => renderAllWeeks(), { event: 'TASKS_LOADED' });
    } else {
        renderAllWeeks();  // FIRST CALL HERE
    }
});

// Line 32 - Listens for TASKS_FILTERED
eventBus.on(eventBus.EVENTS.TASKS_FILTERED, () => {
    if (isEditingActive()) {
        queueRefresh(() => renderAllWeeks(), { event: 'TASKS_FILTERED' });
    } else {
        renderAllWeeks();  // SECOND CALL HERE
    }
});
```

### 4. department-filter.js
```javascript
// Line 145 in initializeDepartmentFilter()
export function initializeDepartmentFilter() {
    populateDepartmentCheckboxes();
    
    on(EVENTS.TASKS_LOADED, () => {
        populateDepartmentCheckboxes();
        filterTasks();  // This triggers TASKS_FILTERED event
    });
    
    filterTasks();  // Initial filter - also triggers TASKS_FILTERED on TASKS_LOADED
}
```

### 5. schedule-grid.js
- Lines 77-78: Timer usage with requestAnimationFrame
- Line 321: equalizeAllCardHeights()

## Why Both Are Firing During Initial Load

### Root Cause:
During initialization phase 5 (loadInitialData), the sequence is:
1. Phase 4 completes: `initializeComponents()` calls `initializeDepartmentFilter()` 
2. Phase 5: `loadInitialData()` calls `fetchAllTasks(false)` - **This is the trigger**
3. fetchAllTasks emits TASKS_LOADED
4. **Problem**: BOTH component-events listener AND department-filter listener react to TASKS_LOADED

## Current Initialization Sequence

```
Phase 3: Services initialization
    ↓
Phase 4: UI Components initialization
    ├─→ initializeDepartmentFilter()
    │   └─→ filterTasks() [with empty/default tasks - no event yet]
    ├─→ initializeWeekNavigation()
    ├─→ initializeSearch()
    └─→ setupComponentEvents() [Sets up listeners]
    ↓
Phase 5: Load Initial Data
    ├─→ fetchAllTasks(false)  [This triggers TASKS_LOADED and TASKS_FILTERED]
    └─→ Both listeners fire
        ├─→ component-events: renderAllWeeks() [1st]
        └─→ department-filter: filterTasks() → renderAllWeeks() [2nd]
```

## Proper Initialization Sequence (Recommended)

The proper sequence should be:

1. **Phase 4**: Initialize components BUT defer event listeners until after data is loaded
2. **Phase 5**: Load data with suppressEvents=true initially to prevent premature rendering
3. **Phase 6**: Manually trigger single render after data is loaded

OR

1. Keep current flow BUT coordinate to render only once
2. Have department-filter NOT call filterTasks() immediately on TASKS_LOADED
3. Let component-events handle the single render

## Solutions

### Solution 1: Suppress Initial Events (Recommended)
- In loadInitialData(), call: `await dataService.fetchAllTasks(false, true)` 
  - This would suppress TASKS_LOADED event emission
- Then manually emit a single coordinated render trigger

### Solution 2: Defer Department Filter Listener
- In initializeDepartmentFilter(), don't auto-call filterTasks() on TASKS_LOADED
- Let the schedule render happen once from component-events
- Only re-filter/re-render if departments are actually changed by user

### Solution 3: Add Deduplication Logic
- Add a flag to track if a render is pending
- Skip duplicate render calls within same render cycle
- Use requestIdleCallback or microtask to batch them

### Solution 4: Change Event Strategy
- Don't emit TASKS_LOADED from setAllTasks during initial load
- Instead, have loadInitialData() emit a special INITIAL_DATA_LOADED event
- Only component-events should listen to this, not department-filter
