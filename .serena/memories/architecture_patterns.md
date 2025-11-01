# Weekly Schedule App - Architecture Patterns

## Application Initialization

### Entry Point Flow
```
index.html → main.js → initialization-orchestrator.js → 6-Phase Initialization → App Ready
```

### 6-Phase Initialization Sequence

**Phase 1: Core Systems (0-10%)**
- Initialize performance monitor, loading manager, offline manager
- Expose modal functions globally (backward compatibility)

**Phase 2: State Restoration (10-25%)**
- Load week index and editing mode from localStorage
- Set up event listeners for auto-save

**Phase 3: Services Initialization (25-45%)**
- Initialize Supabase client and Google Sheets API
- Graceful degradation if services fail
- Connect real-time listeners

**Phase 4: UI Components (45-70%)**
- **Eager Loading**: Department filter, week navigation, search bar, add card indicators, delete handler
- **Lazy Loading**: Modals, context menu, drag-drop (loaded on-demand)

**Phase 5: Data Loading (70-90%)**
- Fetch tasks from Google Sheets and Supabase
- Merge tasks (manual overrides sheets)
- Calculate project day counts
- Render schedule grid

**Phase 6: Global Features (90-100%)**
- Global listeners (resize, visibility, online/offline)
- Keyboard shortcuts
- Preload features on idle (requestIdleCallback)

## Event Bus Architecture

**File**: `src/core/event-bus.js`  
**Type**: Centralized Pub/Sub (Observer Pattern)  
**Storage**: `Map<eventName, Set<handlers>>`

### Standard Event Names

#### Data Events
- `tasks:loaded`, `tasks:updated`, `tasks:filtered`
- `task:created`, `task:deleted`

#### UI Events
- `week:changed`, `department:filtered`, `editing:toggled`
- `project:opened`, `project:closed`

#### Modal Events
- `modal:opened`, `modal:closed`, `modal:close-requested`

#### Render Events
- `render:start`, `render:complete`, `schedule:rendered`

#### Global Events
- `window:resized`, `fullscreen:changed`, `page:visible`, `page:hidden`
- `connection:changed`

### Event Flow Pattern
```
User Action → Component → State Update → Event Emission → 
Event Bus → Subscribers → Re-render → DOM Update
```

## State Management

**File**: `src/core/state.js`  
**Pattern**: Centralized state with automatic event emission  
**Access**: Public getters/setters only (private module-level variables)

### State Variables
- `_allTasks` - All tasks from sheets + supabase
- `_filteredTasks` - After department filter
- `_currentDate`, `_allWeekStartDates`
- `_currentProjectName`, `_currentViewedWeekIndex`
- `_isEditingUnlocked` - Password protection state

### State Access Pattern
```javascript
// Setter with automatic event emission
export function setAllTasks(tasks, silent = false) {
    _allTasks = tasks;
    if (!silent) {
        emit(EVENTS.TASKS_LOADED, { tasks, count: tasks.length });
    }
}

// Getter
export function getAllTasks() {
    return _allTasks;
}
```

## Key Design Patterns

### 1. No Build System - Native ES6 Modules
- Uses native browser ES6 modules, no Webpack/Vite/Rollup
- All imports use relative paths with `.js` extensions
- Browser handles module loading and caching

### 2. Hybrid Module Strategy (ES6 + Window Globals)
- ES6 modules for modern code
- Selective window exposure for:
  - Print system (non-module scripts need access)
  - Backward compatibility (legacy code)
  - Debugging (developer console access)

### 3. Centralized Configuration (Config Layer)
All constants in `src/config/` - no magic numbers:
- `api-config.js`, `business-constants.js`, `department-config.js`
- `layout-constants.js`, `timing-constants.js`, `visual-constants.js`

### 4. Coordinator Pattern
```javascript
// schedule-grid.js orchestrates
export function renderAllWeeks() {
    const tasks = state.getFilteredTasks();
    
    // Delegate rendering to week-renderer.js
    const html = weekRenderer.renderWeekGrid(tasks, weekDates);
    
    // Delegate layout to grid-layout-manager.js
    gridLayoutManager.equalizeAllCardHeights();
}
```

### 5. Lazy Loading with Preloading
- Load on-demand, preload on idle (requestIdleCallback)
- Fast initial load, zero perceived latency after preload
- **Lazy Loaded**: 6 modals/features (~1,500 lines deferred)

### 6. Graceful Degradation
Continue if non-critical services fail:
```javascript
try {
    await sheetsService.fetchTasks();
} catch (error) {
    logger.warn('Sheets failed, using Supabase only:', error);
}
```

## Data Flow

### Complete User Action Example (Filter Tasks)
```
1. User clicks department checkbox
2. Event listener fires (department-filter.js)
3. filterTasks() called
4. State updated (state.setFilteredTasks)
5. Event bus emits TASKS_FILTERED
6. Component event handler responds
7. Schedule re-renders (renderAllWeeks)
8. UI updates complete
```

### Data Source Orchestration
```
data-service.fetchAllTasks()
  ├─→ sheets-service.fetchTasks() (JWT auth)
  └─→ supabase-service.loadManualTasks()
       ↓
Merge tasks (manual overrides sheets)
       ↓
Calculate project day counts
       ↓
Update state → Emit TASKS_LOADED
       ↓
Schedule renders
```

### Real-Time Refresh (Supabase Realtime)
```
Client A edits task → supabase.updateTask() → 
INSERT INTO refresh_signals → 
Supabase broadcasts to all clients → 
Client B receives signal → 
fetchAllTasks(silent=true) → 
Schedule re-renders (background)
```

## Print System Architecture

**Location**: `src/features/print/`  
**Pattern**: 4 specialized modules

### Modules
1. **print-utils.js** - Loaded early, shared utilities (window global)
2. **print-layout.js** - Non-module script, layout components
3. **print-renderer.js** - ES6 module, page assembly and execution
4. **print-debug.js** - Debug utilities

### Auto-Scaling System (Phase 8 Innovation)
**Problem**: Unpredictable overflow/cut-off  
**Solution**: Measure rendered content, calculate scale, apply CSS transform

```javascript
// Measure actual content dimensions
const contentWidth = page.scrollWidth;
const contentHeight = page.scrollHeight;

// Calculate scale (never scale up, only down)
const widthScale = pageMaxWidthPx / contentWidth;
const heightScale = pageMaxHeightPx / contentHeight;
let scale = Math.min(widthScale, heightScale, 1.0);

// Apply CSS transform scaling
page.style.transform = `scale(${scale})`;
```

**Result**: 70-95% improvement in layout reliability

## Modal System

**Pattern**: Lazy-loaded, event-driven  
**Loader**: `src/core/modal-loader.js`

### Modals
- Password (`password-modal.js`) - Click unlock button
- Add Task (`add-task-modal.js`) - Click + FAB or empty cell
- Project (`project-modal.js`) - Click task Plan button
- Print (`print-modal.js`) - Click print button

### Modal Lifecycle
```javascript
// 1. User triggers action
// 2. Lazy load module (loadPrintModal())
// 3. Initialize on first load
// 4. Show modal
```

## Performance Optimizations

### 1. Layout Manager (70-95% improvement)
**File**: `src/utils/grid-layout-manager.js`
- Batch DOM reads (avoid layout thrashing)
- Phase 1: Read all heights, Phase 2: Write all heights
- Reduced reflows from O(n) to O(1)

### 2. Lazy Loading
- 30% of codebase deferred (~1,500 lines)
- Initial page load ~200ms faster
- Preload on idle for zero perceived latency

### 3. Event Delegation
Single listener on document for dynamic elements (fewer listeners, faster rendering)

### 4. Memory Leak Prevention
Fixed critical leak in drag-drop system with cleanup functions

## Security

### 1. HTML Escaping (XSS Prevention)
**File**: `src/utils/security-utils.js`
- All user-generated content escaped before display

### 2. Password Protection
**File**: `src/core/state.js`
- Edit password: 'cwe'
- Password modal validates before unlocking

### 3. JWT Authentication (Google Sheets)
**File**: `src/services/auth-service.js`
- RSA-256 signing with Web Crypto API
- Expires in 1 hour

### 4. Graceful Error Handling
**File**: `src/core/error-handler.js`
- Global error listener, unhandled promise rejection handler
