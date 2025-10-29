# Phase 7: Feature Modules - Briefing Document

**Date:** 2025-10-29
**Status:** Ready to Start
**Previous Phases:** Phase 1 ✅ | Phase 2 ✅ | Phase 3 ✅ | Phase 4 ✅ | Phase 5 ✅ | Phase 6 ✅

---

## 🎯 Mission

Extract feature-specific modules from `index-old.html` into modular, reusable components. Focus on drag & drop, context menus, inline editing, and visual add card indicators.

**Goal:** Transform remaining feature code into clean, event-driven modules that complete the application's interactive functionality.

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

### Phase 5: UI Components - Core
- ✅ Task card component (`task-card.js`)
- ✅ Department filter component (`department-filter.js`)
- ✅ Schedule grid component (`schedule-grid.js`)
- ✅ Week navigation component (`week-navigation.js`)
- ✅ Search bar component (`search-bar.js`)

### Phase 6: UI Components - Modals
- ✅ Password modal (`password-modal.js`)
- ✅ Add task modal (`add-task-modal.js`)
- ✅ Project modal (`project-modal.js`)
- ✅ Print modal (`print-modal.js`)

---

## 🚧 What Needs to Be Done (Phase 7)

### Feature Modules to Create

| Module | File | Purpose | Priority |
|--------|------|---------|----------|
| Context Menu | `src/features/context-menu/context-menu.js` | Right-click menu on task cards | 🔴 High |
| Drag & Drop | `src/features/drag-drop/drag-drop-manager.js` | Drag tasks between dates | 🟡 Medium |
| Add Indicators | `src/features/editing/add-card-indicators.js` | Visual placeholders for adding tasks | 🟡 Medium |
| Inline Editing | `src/features/editing/inline-editor.js` | Future inline editing capabilities | 🟢 Low |

---

## 📍 Source Code Locations

All feature code to extract is in **`index-old.html`**:

### 1. Context Menu (~150 lines)
```javascript
// Lines 2584-2598: showContextMenu function
function showContextMenu(x, y) {
    const contextMenu = document.getElementById('context-menu');
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    contextMenu.style.display = 'block';
    // Position adjustment logic
}

// Lines 2490-2528: Context menu event listeners
document.addEventListener('contextmenu', (e) => {
    // Right-click handler
    // Shows menu for task cards
    // Opens project modal on "build-plan" action
});

// Lines 2520-2528: Context menu click handler
document.getElementById('context-menu').addEventListener('click', (e) => {
    const action = menuItem.dataset.action;
    if (action === 'build-plan' && currentTask) {
        showProjectView(currentTask.project);
    }
});

// Lines 2530-2544: Keyboard support (Context menu key, Shift+F10)
```

### 2. Drag & Drop Manager (~200 lines)
```javascript
// Lines 2070-2182: Drag event handlers
document.addEventListener('dragstart', function(e) {
    // Set dragged task
    // Create drag ghost
    // Add visual feedback
});

document.addEventListener('dragend', function(e) {
    // Cleanup drag state
    // Remove visual indicators
});

document.addEventListener('dragover', function(e) {
    // Visual feedback on drop zones
    // Validate drop target
});

document.addEventListener('drop', async function(e) {
    // Update task date
    // Save to Supabase
    // Send refresh signal
    // Re-render schedule
});

// Lines 2209-2224: Drag leave handlers
```

### 3. Add Card Indicators (~150 lines)
```javascript
// Lines 5121-5138: enableAddCardIndicators function
function enableAddCardIndicators() {
    const isEditingUnlocked = localStorage.getItem('editingUnlocked') === 'true';
    if (!isEditingUnlocked) {
        // Remove add-enabled class if locked
        return;
    }
    const placeholders = document.querySelectorAll('.task-card-placeholder');
    placeholders.forEach(placeholder => {
        placeholder.classList.add('add-enabled');
    });
}

// Lines 5196-5212: Click handlers for empty cells
document.addEventListener('click', (e) => {
    const placeholder = e.target.closest('.task-card-placeholder.add-enabled');
    if (placeholder && !placeholder.querySelector('.task-card')) {
        const department = placeholder.dataset.department;
        const date = placeholder.dataset.date;
        const week = placeholder.dataset.week;
        showAddCardModal(department, date, week);
    }
});
```

### 4. Delete Task Handler (~50 lines)
```javascript
// Lines 5167-5194: Delete button click handler
document.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.task-delete-btn');
    if (deleteBtn) {
        const taskId = deleteBtn.dataset.taskId;
        if (confirm('Are you sure you want to delete?')) {
            deleteTaskFromSupabase(taskId).then(async () => {
                await sendRefreshSignal({ action: 'task_deleted', taskId });
                await fetchTasks();
            });
        }
    }
});
```

---

## 🎯 Implementation Order

### Step 1: Create Context Menu Module
**File:** `src/features/context-menu/context-menu.js`
**Priority:** 🔴 HIGH (essential for user workflow)

**What to Extract:**
- Right-click event handler
- Context menu positioning logic
- Menu item click handlers
- Keyboard shortcuts (Context menu key, Shift+F10)
- Integration with project modal

**API Design:**
```javascript
/**
 * Initialize context menu
 */
export function initializeContextMenu() {
    // Set up event listeners
}

/**
 * Show context menu at position
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {Object} task - Task object
 */
export function showContextMenu(x, y, task) {
    // Position and display menu
}

/**
 * Hide context menu
 */
export function hideContextMenu() {
    // Hide menu
}
```

---

### Step 2: Create Drag & Drop Manager
**File:** `src/features/drag-drop/drag-drop-manager.js`
**Priority:** 🟡 MEDIUM (nice-to-have feature)

**What to Extract:**
- Dragstart handler (set drag data, create ghost)
- Dragend handler (cleanup)
- Dragover handler (visual feedback)
- Drop handler (update task, save to DB)
- Dragleave handler (remove highlights)
- Visual feedback (drag ghost, drop zone highlighting)

**API Design:**
```javascript
/**
 * Initialize drag and drop functionality
 */
export function initializeDragDrop() {
    // Set up all drag event listeners
}

/**
 * Enable drag and drop
 */
export function enableDragDrop() {
    // Enable draggable attributes
}

/**
 * Disable drag and drop
 */
export function disableDragDrop() {
    // Disable draggable attributes
}

/**
 * Handle task drop
 * @param {Object} task - Dragged task
 * @param {string} newDate - New date
 * @param {string} newWeek - New week
 * @param {string} department - Department
 * @private
 */
async function handleTaskDrop(task, newDate, newWeek, department) {
    // Update and save task
}
```

---

### Step 3: Create Add Card Indicators Module
**File:** `src/features/editing/add-card-indicators.js`
**Priority:** 🟡 MEDIUM (enhances UX)

**What to Extract:**
- Enable/disable add card indicators based on editing state
- Click handlers for empty placeholders
- Integration with add task modal

**API Design:**
```javascript
/**
 * Initialize add card indicators
 */
export function initializeAddCardIndicators() {
    // Set up click handlers
}

/**
 * Enable add card indicators
 */
export function enableAddCardIndicators() {
    // Add 'add-enabled' class to placeholders
}

/**
 * Disable add card indicators
 */
export function disableAddCardIndicators() {
    // Remove 'add-enabled' class
}

/**
 * Handle placeholder click
 * @param {HTMLElement} placeholder - Clicked placeholder
 * @private
 */
function handlePlaceholderClick(placeholder) {
    // Extract context and open modal
}
```

---

### Step 4: Create Delete Task Handler Module
**File:** `src/features/editing/delete-task-handler.js`
**Priority:** 🟡 MEDIUM (part of editing workflow)

**What to Extract:**
- Delete button click handler
- Confirmation dialog
- Integration with Supabase service
- Refresh signal after deletion

**API Design:**
```javascript
/**
 * Initialize delete task handler
 */
export function initializeDeleteHandler() {
    // Set up click listener
}

/**
 * Handle task deletion
 * @param {string} taskId - Task ID to delete
 * @private
 */
async function handleTaskDelete(taskId) {
    // Confirm, delete, refresh
}
```

---

## 🔗 Integration with Existing Systems

### State Management Integration
Feature modules should **read** and **update** state:

```javascript
// ✅ GOOD: Use state for task data
import { getAllTasks } from '../../core/state.js';

const allTasks = getAllTasks();
const task = allTasks.find(t => t.id === taskId);
```

### Event Bus Integration
Features should **listen** and **emit** events:

```javascript
import { on, emit, EVENTS } from '../../core/event-bus.js';

// Listen for editing unlocked
on(EVENTS.EDITING_UNLOCKED, () => {
    enableAddCardIndicators();
});

// Emit when task moved
emit(EVENTS.TASK_UPDATED, { taskId, newDate });
```

### Service Integration
Use services for data operations:

```javascript
import { updateTaskInSupabase, deleteTaskFromSupabase, sendRefreshSignal } from '../../services/supabase-service.js';
import { fetchAllTasks } from '../../services/data-service.js';

// Update task
await updateTaskInSupabase(updatedTask);

// Send refresh signal
await sendRefreshSignal({ action: 'task_moved', taskId });

// Reload data
await fetchAllTasks();
```

### Modal Integration
Open modals when needed:

```javascript
import { openAddTaskModal } from '../../components/modals/add-task-modal.js';
import { showProjectModal } from '../../components/modals/project-modal.js';

// Open add task modal with context
openAddTaskModal({ department, date, week });

// Show project details
showProjectModal(projectName);
```

---

## 🧪 Testing Strategy

### Unit Tests
Each feature module should be testable for:
- Event listener setup
- State updates
- Visual feedback
- Error handling

### Integration Tests
- Context menu → opens project modal
- Drag & drop → updates task → saves to Supabase → refreshes schedule
- Add indicator → click → opens modal → creates task
- Delete button → confirms → deletes → refreshes

### Browser Tests (Playwright)
- Right-click shows context menu
- Drag and drop visual feedback
- Empty cell click opens modal
- Delete confirmation dialog

---

## ✅ Success Criteria

- [ ] All 4 feature modules created and documented
- [ ] Features use state manager for data access
- [ ] Features emit/listen to appropriate events
- [ ] Context menu shows on right-click
- [ ] Drag & drop moves tasks between dates
- [ ] Add card indicators show when editing unlocked
- [ ] Delete handler confirms and deletes tasks
- [ ] No direct DOM manipulation outside modules
- [ ] No console errors
- [ ] App runs on `http://localhost:8083`
- [ ] Backward compatibility maintained
- [ ] ~600+ lines extracted from `index-old.html`

---

## 🚧 NOT In Scope for Phase 7

The following will be handled in later phases:

**Phase 8: App Controller**
- Final cleanup of main.js
- Route handling (if needed)
- Centralized error handling UI

**Phase 9: Performance Optimization**
- Code splitting
- Lazy loading
- Service worker

**Phase 10: Documentation & Deployment**
- Complete API docs
- Deployment guide
- CI/CD pipeline

---

## 📂 Expected File Structure After Phase 7

```
src/
├── features/
│   ├── context-menu/            # ⭐ NEW - Phase 7
│   │   └── context-menu.js      # Right-click menu
│   ├── drag-drop/               # ⭐ NEW - Phase 7
│   │   └── drag-drop-manager.js # Drag & drop
│   ├── editing/                 # ⭐ NEW - Phase 7
│   │   ├── add-card-indicators.js   # Add task placeholders
│   │   └── delete-task-handler.js   # Delete confirmation
│   ├── print/                   # ✅ Phase 1
│   │   └── ...
│   └── search/                  # ✅ Phase 5 (integrated in search-bar.js)
├── components/
│   ├── modals/                  # ✅ Phase 6
│   └── ...                      # ✅ Phase 5
├── core/                        # ✅ Phase 4
├── services/                    # ✅ Phase 3
├── utils/                       # ✅ Phase 2
├── config/                      # ✅ Phase 1
└── main.js                      # Entry point (to be updated)
```

---

## 🎬 Getting Started

### Prerequisites
```bash
# Ensure development server is running
npx http-server -p 8083 --cors -c-1
```

### Development Workflow

1. **Create feature directories**
   ```bash
   mkdir -p src/features/context-menu
   mkdir -p src/features/drag-drop
   mkdir -p src/features/editing
   ```

2. **Create module file** in appropriate directory

3. **Extract code** from `index-old.html`

4. **Add ES6 imports** for dependencies

5. **Add ES6 exports** for public API

6. **Test in browser** - verify feature behavior

7. **Update main.js** to initialize feature

8. **Commit changes** with descriptive message

### Code Organization Pattern

Each feature file should follow this structure:

```javascript
/**
 * Feature Name
 * Description of what this feature does
 * @module features/category/feature-name
 */

// Imports
import { ... } from '../../core/state.js';
import { ... } from '../../core/event-bus.js';
import { ... } from '../../services/supabase-service.js';

// Private state
let featureState = null;

// Private helper functions
function helperFunction() {
    // ...
}

// Public API - Initialize
export function initializeFeature() {
    // Set up event listeners
    // Initialize state
    // Subscribe to events
}

// Public API - Enable
export function enableFeature() {
    // Activate feature
}

// Public API - Disable
export function disableFeature() {
    // Deactivate feature
}
```

---

## 📊 Progress Tracking

### Estimated Effort
- **Context Menu:** ~2-3 hours
- **Drag & Drop Manager:** ~4-5 hours (complex event handling)
- **Add Card Indicators:** ~2-3 hours
- **Delete Task Handler:** ~1-2 hours
- **Testing & Integration:** ~2-3 hours
- **Total:** ~11-16 hours (2-3 days)

### Milestones
1. ✅ **Milestone 1:** Context menu working
2. ✅ **Milestone 2:** Drag & drop functional
3. ✅ **Milestone 3:** Add indicators clickable
4. ✅ **Milestone 4:** Delete handler confirms
5. ✅ **Milestone 5:** All features integrated
6. ✅ **Milestone 6:** All tests passing

---

## 🔍 Key Design Principles

### 1. Single Responsibility
Each feature module has ONE job:
- Context menu = show menu on right-click
- Drag & drop = move tasks between dates
- Add indicators = visual placeholders
- Delete handler = confirm and delete tasks

### 2. Event-Driven
Features communicate via events:
```javascript
// Feature listens for state changes
on(EVENTS.EDITING_UNLOCKED, () => {
    enableFeature();
});

// Feature emits on action
emit(EVENTS.TASK_UPDATED, { taskId });
```

### 3. Stateless Where Possible
Features read from central state:
```javascript
// ✅ GOOD: Read from state
const tasks = getAllTasks();

// ❌ BAD: Maintain own task list
let myTasks = [];
```

### 4. Progressive Enhancement
Features should enhance, not break:
- App works without drag & drop
- Context menu is optional
- Add indicators are visual enhancement

---

## 🆘 Common Pitfalls to Avoid

### ❌ Don't Do This:
```javascript
// Direct global access
window.draggedTask = task;

// Hard-coded DOM queries everywhere
document.querySelector('.task-card').addEventListener(/*...*/);

// No error handling
await updateTaskInSupabase(task); // What if it fails?

// Blocking operations
alert('Task moved'); // Use notifications instead
```

### ✅ Do This Instead:
```javascript
// Use module-scoped state
let draggedTask = null;

// Event delegation
document.addEventListener('click', (e) => {
    const taskCard = e.target.closest('.task-card');
    if (taskCard) { /* handle */ }
});

// Error handling
try {
    await updateTaskInSupabase(task);
    showSuccessNotification('Task moved');
} catch (error) {
    showError('Failed to move task');
}

// Non-blocking notifications
showSuccessNotification('Task moved successfully!');
```

---

## 📚 Additional Resources

- **REFACTORING_PLAN.md** - Overall architecture
- **PHASE_6_BRIEFING.md** - Modal components reference
- **src/core/state.js** - State API reference
- **src/core/event-bus.js** - Event bus API reference
- **src/services/supabase-service.js** - Task CRUD operations
- **src/components/modals/add-task-modal.js** - Task creation modal
- **index-old.html** - Source code to extract

---

## 🔧 Helpful Code Snippets

### Event Delegation Pattern
```javascript
// Listen for clicks on dynamic elements
document.addEventListener('click', (e) => {
    const target = e.target.closest('.dynamic-element');
    if (target) {
        handleClick(target);
    }
});
```

### Drag Data Transfer
```javascript
// On dragstart
e.dataTransfer.setData('application/json', JSON.stringify(task));
e.dataTransfer.effectAllowed = 'move';

// On drop
const task = JSON.parse(e.dataTransfer.getData('application/json'));
```

### Visual Feedback Pattern
```javascript
// Add class during operation
element.classList.add('processing');

try {
    await performOperation();
} finally {
    element.classList.remove('processing');
}
```

### Confirmation Dialog Pattern
```javascript
if (confirm(`Are you sure you want to delete "${taskName}"?`)) {
    await deleteTask(taskId);
    showSuccessNotification('Task deleted');
}
```

---

**Document Version:** 1.0
**Last Updated:** 2025-10-29
**Author:** Rooroo Developer
**Status:** Ready to Start
**Estimated Duration:** 2-3 days

---

## 🚀 Let's Build Phase 7!

Ready to extract the final interactive features into clean, modular components. Focus on creating accessible, event-driven features that complete the application's functionality!

**Start with:** Context Menu → Drag & Drop → Add Indicators → Delete Handler
