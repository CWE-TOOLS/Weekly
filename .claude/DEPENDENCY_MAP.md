# Module Dependency Map

Visual and text-based map of module dependencies and relationships.

## Table of Contents

1. [Dependency Layers](#dependency-layers)
2. [Module Dependency Graph](#module-dependency-graph)
3. [Import/Export Relationships](#importexport-relationships)
4. [Circular Dependencies](#circular-dependencies)
5. [Event Flow Map](#event-flow-map)
6. [Data Flow Map](#data-flow-map)

---

## Dependency Layers

The application follows a layered architecture where higher layers depend on lower layers, but not vice versa.

```
┌─────────────────────────────────────────────────────────┐
│  Layer 7: Entry Point                                    │
│  - main.js                                               │
│  Dependencies: Layer 6                                   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 6: Application Controller                         │
│  - core/app-controller.js                                │
│  Dependencies: Layers 1-5                                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 5: Features                                       │
│  - features/drag-drop/                                   │
│  - features/context-menu/                                │
│  - features/print/                                       │
│  - features/editing/                                     │
│  Dependencies: Layers 1-4                                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 4: Components                                     │
│  - components/schedule-grid.js                           │
│  - components/task-card.js                               │
│  - components/department-filter.js                       │
│  - components/week-navigation.js                         │
│  - components/search-bar.js                              │
│  - components/modals/                                    │
│  Dependencies: Layers 1-3                                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 3: Services                                       │
│  - services/data-service.js                              │
│  - services/sheets-service.js                            │
│  - services/supabase-service.js                          │
│  - services/auth-service.js                              │
│  Dependencies: Layers 1-2                                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 2: Core Infrastructure                            │
│  - core/state.js                                         │
│  - core/event-bus.js                                     │
│  - core/storage.js                                       │
│  - core/error-handler.js                                 │
│  - core/loading-manager.js                               │
│  - core/keyboard-shortcuts.js                            │
│  - core/global-listeners.js                              │
│  - core/performance-monitor.js                           │
│  - core/offline-manager.js                               │
│  Dependencies: Layer 1, minimal Layer 0                  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Utilities                                      │
│  - utils/date-utils.js                                   │
│  - utils/ui-utils.js                                     │
│  - utils/lazy-loader.js                                  │
│  Dependencies: Layer 0 only                              │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 0: Configuration                                  │
│  - config/api-config.js                                  │
│  - config/constants.js                                   │
│  - config/department-config.js                           │
│  Dependencies: None (pure data)                          │
└─────────────────────────────────────────────────────────┘
```

---

## Module Dependency Graph

### Core Module Dependencies

```
event-bus.js (no dependencies)
    ↓
state.js → event-bus.js
    ↓
storage.js → state.js (implicit)
    ↓
error-handler.js → event-bus.js
    ↓
loading-manager.js → event-bus.js, state.js
    ↓
keyboard-shortcuts.js → event-bus.js, state.js
    ↓
global-listeners.js → event-bus.js, state.js
    ↓
performance-monitor.js → constants.js
    ↓
offline-manager.js → event-bus.js, state.js, storage.js
```

### Service Module Dependencies

```
auth-service.js
    ← api-config.js
    ← state.js

sheets-service.js
    ← api-config.js
    ← auth-service.js
    ← date-utils.js

supabase-service.js
    ← api-config.js
    ← event-bus.js

data-service.js
    ← sheets-service.js
    ← supabase-service.js
    ← state.js
    ← date-utils.js
```

### Component Module Dependencies

```
task-card.js
    ← department-config.js
    ← date-utils.js

schedule-grid.js
    ← state.js
    ← event-bus.js
    ← storage.js
    ← date-utils.js
    ← task-card.js
    ← department-config.js

department-filter.js
    ← state.js
    ← event-bus.js
    ← department-config.js

week-navigation.js
    ← state.js
    ← event-bus.js
    ← date-utils.js

search-bar.js
    ← state.js
    ← event-bus.js

password-modal.js
    ← state.js
    ← event-bus.js
    ← constants.js

add-task-modal.js
    ← state.js
    ← event-bus.js
    ← supabase-service.js
    ← department-config.js

project-modal.js
    ← state.js
    ← event-bus.js
    ← supabase-service.js
    ← department-config.js

print-modal.js
    ← state.js
    ← event-bus.js
    ← print-renderer.js
```

### Feature Module Dependencies

```
drag-drop-manager.js
    ← state.js
    ← supabase-service.js
    ← data-service.js
    ← ui-utils.js

context-menu.js
    ← state.js
    ← event-bus.js

print-layout.js
    ← department-config.js
    ← date-utils.js

print-renderer.js
    ← state.js
    ← print-layout.js
    ← print-utils.js

print-utils.js
    ← (no dependencies)

print-debug.js
    ← (no dependencies)

add-card-indicators.js
    ← state.js
    ← event-bus.js

delete-task-handler.js
    ← event-bus.js
    ← supabase-service.js
```

---

## Import/Export Relationships

### Most Imported Modules (Used By Many)

**1. state.js** - Imported by 25+ modules
- Almost all components
- All services
- Most features
- Core systems

**2. event-bus.js** - Imported by 20+ modules
- All components
- Most features
- Core systems

**3. department-config.js** - Imported by 10+ modules
- schedule-grid.js
- task-card.js
- department-filter.js
- All modals
- Print system

**4. date-utils.js** - Imported by 10+ modules
- schedule-grid.js
- week-navigation.js
- sheets-service.js
- Print system

**5. ui-utils.js** - Imported by 8+ modules
- Most components
- Services
- Features

### Modules That Import The Most (High Fan-Out)

**1. app-controller.js** - Imports from 30+ modules
- All core systems
- All services
- All components
- All features
- All utilities

**2. schedule-grid.js** - Imports from 10+ modules
- state.js, event-bus.js, storage.js
- date-utils.js, ui-utils.js
- task-card.js
- department-config.js

**3. data-service.js** - Imports from 6 modules
- sheets-service.js
- supabase-service.js
- state.js
- date-utils.js
- ui-utils.js

### Modules With No Dependencies (Leaf Nodes)

- config/api-config.js
- config/constants.js
- config/department-config.js
- utils/date-utils.js (pure functions)
- utils/ui-utils.js (pure functions)
- utils/lazy-loader.js (pure functions)
- features/print/print-utils.js
- features/print/print-debug.js
- core/event-bus.js (only internal Map)

---

## Circular Dependencies

### Detected Circular Dependencies

**None detected!** The architecture successfully avoids circular dependencies through:

1. **Layered Architecture** - Higher layers depend on lower, never reverse
2. **Event Bus Pattern** - Components communicate via events, not direct calls
3. **Centralized State** - State is read/write, no bidirectional imports
4. **Service Layer** - Services are stateless and don't import components

### Potential Risk Areas

**1. state.js ↔ storage.js**
- Currently: state.js imports event-bus.js, storage.js doesn't import state.js
- Safe: storage.js is pure localStorage wrapper
- Risk: Low

**2. Component ↔ Modal**
- Currently: Components open modals via event emission
- Safe: Modals are lazy-loaded, not direct imports
- Risk: Low

**3. Service ↔ Service**
- data-service.js imports sheets-service.js and supabase-service.js
- Those services don't import data-service.js
- Safe: One-way dependency
- Risk: Low

---

## Event Flow Map

### Event Emission Sources → Listeners

#### data-loaded Event

**Emitted by:**
- data-service.js (after fetching data)

**Listened by:**
- schedule-grid.js (re-render grid)
- week-navigation.js (update week display)
- department-filter.js (update available departments)

#### week-changed Event

**Emitted by:**
- week-navigation.js (user clicked prev/next)
- keyboard-shortcuts.js (Ctrl+Left/Right)

**Listened by:**
- schedule-grid.js (render new week)
- storage.js (save week preference)

#### task-added Event

**Emitted by:**
- add-task-modal.js (after creating task)
- supabase-service.js (real-time subscription)

**Listened by:**
- schedule-grid.js (add card to grid)
- data-service.js (refresh task list)

#### task-updated Event

**Emitted by:**
- project-modal.js (after editing task)
- drag-drop-manager.js (after moving task)
- supabase-service.js (real-time subscription)

**Listened by:**
- schedule-grid.js (update card display)
- data-service.js (refresh task list)

#### task-deleted Event

**Emitted by:**
- delete-task-handler.js (after deletion)
- project-modal.js (delete button)
- supabase-service.js (real-time subscription)

**Listened by:**
- schedule-grid.js (remove card from grid)
- data-service.js (refresh task list)

#### department-filter-changed Event

**Emitted by:**
- department-filter.js (checkbox toggled)

**Listened by:**
- schedule-grid.js (filter displayed tasks)
- storage.js (save filter preference)

#### search-changed Event

**Emitted by:**
- search-bar.js (search input changed)

**Listened by:**
- schedule-grid.js (filter by search query)

#### modal-opened / modal-closed Events

**Emitted by:**
- password-modal.js
- add-task-modal.js
- project-modal.js
- print-modal.js

**Listened by:**
- keyboard-shortcuts.js (disable shortcuts when modal open)
- global-listeners.js (prevent background scrolling)

#### error Event

**Emitted by:**
- error-handler.js (global error)
- All services (API errors)
- All components (UI errors)

**Listened by:**
- error-handler.js (display error message)
- offline-manager.js (queue failed actions)

#### state-changed:* Events

**Emitted by:**
- state.js (automatically on state.set())

**Listened by:**
- Any module subscribed to specific state key
- storage.js (persist state changes)

---

## Data Flow Map

### Read Data Flow (Initial Load)

```
User Opens App
    ↓
main.js executes
    ↓
app-controller.js → initializeApp()
    ↓
[Phase 3: Services]
    ↓
auth-service.js → authenticate()
    ↓ (JWT token)
sheets-service.js → fetchTasks()
    ↓ (Google Sheets data)
supabase-service.js → getTasks()
    ↓ (Manual tasks)
data-service.js → fetchAllTasks()
    ↓ (merged tasks)
state.js → set('tasks', allTasks)
    ↓ (emits 'data-loaded')
event-bus.js → emit('data-loaded', tasks)
    ↓
schedule-grid.js → renderSchedule()
    ↓ (creates HTML)
task-card.js → createTaskCard()
    ↓ (for each task)
DOM Updated → User sees schedule
```

### Write Data Flow (Create Task)

```
User Clicks "Add Task"
    ↓
add-card-indicators.js → emit('open-add-task-modal')
    ↓
add-task-modal.js → openAddTaskModal()
    ↓
User fills form and clicks Save
    ↓
add-task-modal.js → validates input
    ↓
supabase-service.js → addTask(taskData)
    ↓ (saves to Supabase)
API Response (new task with ID)
    ↓
add-task-modal.js → emit('task-added', newTask)
    ↓
event-bus.js → notifies listeners
    ↓
data-service.js → fetchAllTasks() (refresh)
    ↓
state.js → set('tasks', updatedTasks)
    ↓
schedule-grid.js → updateCell() (re-render cell)
    ↓
DOM Updated → User sees new task card
```

### Real-Time Sync Flow (Another User Edits)

```
Another User Edits Task (in different browser)
    ↓
Supabase Database Updated
    ↓
Supabase Real-Time Channel fires
    ↓
supabase-service.js → subscription handler
    ↓
supabase-service.js → emit('task-updated', updatedTask)
    ↓
event-bus.js → notifies listeners
    ↓
schedule-grid.js → finds task card in DOM
    ↓
task-card.js → updateTaskCard(card, updatedTask)
    ↓
DOM Updated → User sees updated task (real-time)
```

### Drag & Drop Flow

```
User Drags Task Card
    ↓
drag-drop-manager.js → handleDragStart()
    ↓ (stores dragged task reference)
User Drops on New Cell
    ↓
drag-drop-manager.js → handleDrop()
    ↓ (reads cell date from dataset)
drag-drop-manager.js → updateTask()
    ↓
supabase-service.js → updateTask(id, { date: newDate })
    ↓ (saves to database)
API Response (success)
    ↓
drag-drop-manager.js → emit('task-moved')
    ↓
data-service.js → fetchAllTasks() (refresh)
    ↓
schedule-grid.js → renderSchedule()
    ↓
DOM Updated → Task appears in new cell
```

### Print System Flow

```
User Clicks Print Button
    ↓
print-modal.js → openPrintModal()
    ↓
User Selects:
  - Print type (weekly or daily)
  - Departments to print
  - Date range
    ↓
User clicks "Print Selected"
    ↓
print-modal.js → calls window.PrintUtils.generatePrintContent()
    ↓
print-utils.js → delegates to PrintRenderer.generatePrintContent()
    ↓
print-renderer.js → generatePrintContent()
    ↓
For each selected department:
  ├─ Get department tasks
  ├─ Get department colors (print-utils.getDepartmentColorMapping())
  ├─ Create department page:
  │     ↓
  │   print-renderer.js → createDepartmentPage()
  │     ├─ print-layout.js → createDepartmentHeader()
  │     ├─ print-layout.js → createDepartmentTable()
  │     │     ├─ createTableHeader()
  │     │     ├─ createTableBody()
  │     │     │     └─ createPrintTaskCard() (for each task)
  │     │     └─ createTableFooter()
  │     └─ print-layout.js → createDepartmentSummary()
  │
  └─ Append page to print container
    ↓
print-renderer.js → applyPageBreakRules(pages) ← CRITICAL
    ↓ (prevents blank pages)
For each page except last:
  └─ page.style.pageBreakAfter = 'always'
Last page:
  └─ page.style.pageBreakAfter = 'avoid'  ← Prevents blank page
    ↓
print-renderer.js → applyPrintScaling(printContent)
    ↓ (scales content to fit page)
print-renderer.js → executePrint(printContent)
    ↓
  ├─ Inject print CSS
  ├─ Hide main UI
  ├─ Show print content
  ├─ window.print() → Opens browser print dialog
  ├─ Wait for user to print/cancel
  ├─ Cleanup: remove print content, show main UI
  └─ Remove print CSS
    ↓
User Prints → PDF/Printer receives formatted pages
```

### Print System Module Dependencies

```
print-utils.js (entry point, no dependencies)
    ↓
    ├─ Provides: getDepartmentColorMapping()
    ├─ Provides: parseDate()
    ├─ Provides: normalizeDepartmentClass()
    └─ Delegates to: print-renderer.js
         ↓
       print-renderer.js (page assembly)
         ├─ Depends on: print-layout.js
         ├─ Depends on: print-utils.js
         └─ Functions:
             ├─ createDepartmentPage()
             ├─ applyPageBreakRules() ← CRITICAL
             ├─ generatePrintContent()
             ├─ applyPrintScaling()
             └─ executePrint()
              ↓
           print-layout.js (component creators)
              ├─ Depends on: print-utils.js (normalizeDepartmentClass)
              └─ Functions:
                  ├─ createDepartmentHeader()
                  ├─ createDepartmentSummary()
                  ├─ createTableHeader()
                  ├─ createTableFooter()
                  ├─ createPrintTaskCard()
                  ├─ createTableBody()
                  └─ createDepartmentTable()
```

---

## Module Dependency by Type

### Configuration Dependencies (0 imports)

```
api-config.js
constants.js
department-config.js
```

### Utility Dependencies (0-1 imports)

```
date-utils.js (0 imports)
ui-utils.js (0 imports)
lazy-loader.js (0 imports)
```

### Core Dependencies (0-3 imports)

```
event-bus.js (0 imports)
state.js → event-bus.js (1 import)
storage.js → (0 imports, but accesses window.localStorage)
error-handler.js → event-bus.js (1 import)
loading-manager.js → event-bus.js, state.js (2 imports)
keyboard-shortcuts.js → event-bus.js, state.js (2 imports)
global-listeners.js → event-bus.js, state.js (2 imports)
performance-monitor.js → constants.js (1 import)
offline-manager.js → event-bus.js, state.js, storage.js (3 imports)
```

### Service Dependencies (2-5 imports)

```
auth-service.js → api-config.js, state.js (2 imports)
sheets-service.js → api-config.js, auth-service.js, date-utils.js (3 imports)
supabase-service.js → api-config.js, event-bus.js (2 imports)
data-service.js → sheets, supabase, state, date-utils, ui-utils (5 imports)
```

### Component Dependencies (3-7 imports)

```
task-card.js → department-config.js, date-utils.js (2 imports)
schedule-grid.js → state, event-bus, storage, date-utils, task-card, department-config (6 imports)
department-filter.js → state, event-bus, department-config (3 imports)
week-navigation.js → state, event-bus, date-utils (3 imports)
search-bar.js → state, event-bus (2 imports)
```

### Modal Dependencies (3-5 imports)

```
password-modal.js → state, event-bus, constants (3 imports)
add-task-modal.js → state, event-bus, supabase-service, department-config (4 imports)
project-modal.js → state, event-bus, supabase-service, department-config (4 imports)
print-modal.js → state, event-bus, print-renderer (3 imports)
```

### Feature Dependencies (0-4 imports)

```
drag-drop-manager.js → state, supabase, data-service, ui-utils (4 imports)
context-menu.js → state, event-bus (2 imports)
add-card-indicators.js → state, event-bus (2 imports)
delete-task-handler.js → event-bus, supabase-service (2 imports)

Print System:
print-utils.js → None (0 imports)
print-renderer.js → print-layout, print-utils (2 imports)
print-layout.js → print-utils (1 import)
print-debug.js → None (0 imports)
```

---

## Dependency Search Commands

### Find All Imports in a File

```bash
grep "^import" src/core/app-controller.js
```

### Find Where a Module is Used

```bash
grep -r "import.*state" src/
```

### Find All Event Emissions

```bash
grep -r "emit(" src/ | grep -v "node_modules"
```

### Find All Event Listeners

```bash
grep -r "\.on(" src/ | grep -v "node_modules"
```

### Find State Getters

```bash
grep -r "state\.get\|getState" src/
```

### Find State Setters

```bash
grep -r "state\.set\|setState" src/
```

### Find API Calls

```bash
grep -r "fetch\|axios\|supabase\|gapi" src/
```

---

## Dependency Health Metrics

### Module Coupling Score

**Low Coupling (Good):**
- Configuration modules: 0 dependencies
- Utility modules: 0-1 dependencies
- Core modules: 0-3 dependencies

**Medium Coupling (Acceptable):**
- Services: 2-5 dependencies
- Components: 3-7 dependencies
- Features: 2-5 dependencies

**High Coupling (Watch):**
- app-controller.js: 30+ dependencies (expected for orchestrator)

### Dependency Depth (Transitive Dependencies)

**Depth 0:** Configuration, utilities (no deps)
**Depth 1:** Core infrastructure (direct deps on config/utils)
**Depth 2:** Services (deps on core + config + utils)
**Depth 3:** Components (deps on services + core + config + utils)
**Depth 4:** Features (deps on components + services + core)
**Depth 5:** App controller (deps on everything)

**Max Depth:** 5 levels (manageable)

---

## Refactoring Opportunities

### Potential Improvements

**1. Create Facade for Core Systems**
Instead of:
```javascript
import { state } from './core/state.js';
import { eventBus } from './core/event-bus.js';
import { storage } from './core/storage.js';
```

Could create:
```javascript
import { core } from './core/index.js';
core.state.get('tasks');
core.eventBus.emit('event');
core.storage.save('key', value);
```

**2. Group Related Utilities**
Create `utils/index.js` to export all utilities:
```javascript
export * from './date-utils.js';
export * from './ui-utils.js';
export * from './lazy-loader.js';
```

**3. Consolidate Modal Imports**
Create `components/modals/index.js`:
```javascript
export { openPasswordModal } from './password-modal.js';
export { openAddTaskModal } from './add-task-modal.js';
export { openProjectModal } from './project-modal.js';
export { openPrintModal } from './print-modal.js';
```

---

## Related Documentation

- `.claude/CODEBASE_MAP.md` - Quick navigation
- `.claude/ARCHITECTURE.md` - System design
- `.claude/MODULE_INDEX.md` - Module details
- `.claude/COMMON_TASKS.md` - Task guide
- `Documentation/REFACTORING_PLAN.md` - Complete history
