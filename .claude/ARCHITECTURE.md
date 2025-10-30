# System Architecture

Comprehensive architectural overview of the Weekly Schedule Viewer application.

## Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Technology Stack](#technology-stack)
3. [Design Patterns](#design-patterns)
4. [Module Architecture](#module-architecture)
5. [Data Flow](#data-flow)
6. [State Management](#state-management)
7. [Event System](#event-system)
8. [API Integration](#api-integration)
9. [Security Model](#security-model)
10. [Performance Considerations](#performance-considerations)

---

## High-Level Architecture

### Application Type
- **Progressive Web Application (PWA)**
- **Single Page Application (SPA)**
- **Client-side rendered**
- **No build step required** (native ES6 modules)

### Architectural Style
- **Modular monolith** - Single codebase, modular structure
- **Event-driven** - Component communication via pub/sub
- **Service-oriented** - Business logic in service layer
- **Component-based UI** - Self-contained UI components

### Layered Architecture

```
┌─────────────────────────────────────────┐
│         Presentation Layer               │
│  (Components, Modals, UI Controls)       │
├─────────────────────────────────────────┤
│         Feature Layer                    │
│  (Print, Drag-Drop, Context Menu)        │
├─────────────────────────────────────────┤
│         Application Layer                │
│  (App Controller, State, Event Bus)      │
├─────────────────────────────────────────┤
│         Service Layer                    │
│  (Auth, Sheets, Supabase, Data)          │
├─────────────────────────────────────────┤
│         Infrastructure Layer             │
│  (Storage, Error Handler, Utils)         │
└─────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend Core
- **JavaScript:** ES6+ (Native modules, async/await, classes)
- **HTML5:** Semantic markup, PWA manifest
- **CSS3:** Custom properties, Grid, Flexbox, Media queries

### Browser APIs
- **Drag & Drop API** - Task card reordering
- **LocalStorage API** - State persistence
- **Fullscreen API** - Distraction-free mode
- **Print API** - Custom print layouts
- **Visibility API** - Tab visibility detection
- **Online/Offline Events** - Network status

### External Services
- **Google Sheets API v4** - Task data source
- **Supabase** - PostgreSQL database + real-time subscriptions
- **Google OAuth 2.0** - User authentication
- **Service Account JWT** - Server-to-server auth

### Development Tools
- **http-server** - Local development server
- **Git** - Version control
- **VS Code** - IDE
- **Chrome DevTools** - Debugging

### Dependencies
**Zero runtime dependencies** - Pure vanilla JavaScript
**Dev dependencies:**
- `http-server` (via npx)
- Google APIs Client Library (CDN)

---

## Design Patterns

### 1. Module Pattern
**Used in:** All modules
**Purpose:** Encapsulation and namespace management

```javascript
// Each file is a self-contained module
export function initializeComponent() { /* ... */ }
export function updateComponent() { /* ... */ }

// Import only what's needed
import { initializeComponent } from './component.js';
```

### 2. Singleton Pattern
**Used in:** state.js, event-bus.js
**Purpose:** Single instance of critical services

```javascript
// state.js - Single source of truth
const state = {};
export const getState = () => state;

// event-bus.js - Single event hub
const listeners = {};
export const eventBus = { on, off, emit };
```

### 3. Observer Pattern (Pub/Sub)
**Used in:** event-bus.js
**Purpose:** Decoupled component communication

```javascript
// Publisher
eventBus.emit('data-loaded', tasks);

// Subscriber
eventBus.on('data-loaded', (tasks) => {
  renderSchedule(tasks);
});
```

### 4. Facade Pattern
**Used in:** data-service.js
**Purpose:** Simplified interface to complex subsystems

```javascript
// data-service.js hides complexity of multiple data sources
export async function fetchAllData() {
  const sheetsData = await sheetsService.fetchTasks();
  const supabaseData = await supabaseService.getTasks();
  return mergeTasks(sheetsData, supabaseData);
}
```

### 5. Strategy Pattern
**Used in:** auth-service.js
**Purpose:** Interchangeable authentication strategies

```javascript
// Can switch between OAuth and Service Account auth
export async function authenticate(strategy = 'serviceAccount') {
  if (strategy === 'oauth') return authenticateWithOAuth();
  if (strategy === 'serviceAccount') return authenticateWithServiceAccount();
}
```

### 6. Factory Pattern
**Used in:** task-card.js
**Purpose:** Task card creation

```javascript
export function createTaskCard(task, department) {
  const card = document.createElement('div');
  card.className = 'task-card';
  // ... configuration based on task type
  return card;
}
```

### 7. Dependency Injection
**Used in:** app-controller.js
**Purpose:** Loose coupling and testability

```javascript
export async function initializeApp(config = {}) {
  const services = config.services || defaultServices;
  const components = config.components || defaultComponents;
  // ... initialization with injected dependencies
}
```

### 8. Lazy Loading Pattern
**Used in:** lazy-loader.js (Phase 9)
**Purpose:** Load modules on demand

```javascript
export async function loadModal(modalName) {
  const module = await import(`./modals/${modalName}.js`);
  return module;
}
```

---

## Module Architecture

### Module Categories

#### 1. Configuration Modules
**Purpose:** Application configuration
**Files:** `config/api-config.js`, `config/constants.js`, `config/department-config.js`
**Dependencies:** None
**Exports:** Configuration objects

#### 2. Core Modules
**Purpose:** Application foundation
**Files:** `core/app-controller.js`, `core/state.js`, `core/event-bus.js`, `core/storage.js`, `core/error-handler.js`
**Dependencies:** Minimal (mostly independent)
**Exports:** Initialization functions, state/event APIs

#### 3. Service Modules
**Purpose:** Business logic and external communication
**Files:** `services/auth-service.js`, `services/sheets-service.js`, `services/supabase-service.js`, `services/data-service.js`
**Dependencies:** Core modules, config
**Exports:** Async functions for data operations

#### 4. Component Modules
**Purpose:** UI rendering and user interaction
**Files:** `components/*.js`, `components/modals/*.js`
**Dependencies:** Core modules, services, utils
**Exports:** Initialization and update functions

#### 5. Feature Modules
**Purpose:** Discrete application features
**Files:** `features/print/*.js`, `features/drag-drop/*.js`, `features/context-menu/*.js`, `features/editing/*.js`
**Dependencies:** Core modules, components
**Exports:** Feature-specific functions

#### 6. Utility Modules
**Purpose:** Helper functions
**Files:** `utils/date-utils.js`, `utils/ui-utils.js`, `utils/lazy-loader.js`
**Dependencies:** None
**Exports:** Pure utility functions

### Module Lifecycle

```
1. Import Phase
   └── ES6 imports execute, functions/objects exported

2. Registration Phase (app-controller.js)
   └── Services registered
   └── Components registered
   └── Features registered

3. Initialization Phase
   └── initialize*() functions called in order
   └── Event listeners attached
   └── DOM elements created

4. Runtime Phase
   └── Event handlers respond to user actions
   └── State updates trigger re-renders
   └── Services communicate with APIs

5. Cleanup Phase (if needed)
   └── Event listeners removed
   └── Resources freed
```

---

## Data Flow

### Primary Data Flow (Read)

```
User Opens App
      ↓
app-controller.js initializes
      ↓
auth-service.js authenticates
      ↓
data-service.js fetches data
      ↓
sheets-service.js → Google Sheets API
supabase-service.js → Supabase API
      ↓
data-service.js merges results
      ↓
state.js stores tasks
      ↓
event-bus.js emits 'data-loaded'
      ↓
schedule-grid.js listens and renders
```

### Secondary Data Flow (Write)

```
User Drags Task Card
      ↓
drag-drop-manager.js handles drop
      ↓
supabase-service.js saves to database
      ↓
state.js updates local state
      ↓
event-bus.js emits 'task-moved'
      ↓
schedule-grid.js re-renders affected cells
      ↓
storage.js persists state to localStorage
```

### Real-Time Data Flow

```
Another User Updates Task (in Supabase)
      ↓
Supabase real-time subscription fires
      ↓
supabase-service.js receives update
      ↓
state.js updates task
      ↓
event-bus.js emits 'task-updated'
      ↓
schedule-grid.js re-renders task card
```

---

## State Management

### State Structure

```javascript
{
  // Data
  tasks: [],              // All tasks (merged from Sheets + Supabase)
  departments: [],        // Department definitions

  // UI State
  currentWeekOffset: 0,   // Weeks from today (0 = current week)
  selectedDepartments: [], // Active department filters
  searchQuery: '',        // Search input value
  isFullscreen: false,    // Fullscreen mode active

  // User State
  isAuthenticated: false, // Auth status
  editPassword: '',       // Edit mode password
  isEditMode: false,      // Edit mode active

  // Feature State
  isPrintMode: false,     // Print preview active
  printConfig: {},        // Print settings

  // System State
  isLoading: false,       // Loading indicator
  lastError: null,        // Last error encountered
  lastSync: null          // Last data sync timestamp
}
```

### State Access Patterns

```javascript
// Read state
const weekOffset = state.get('currentWeekOffset');
const tasks = state.get('tasks');

// Write state (triggers events)
state.set('currentWeekOffset', 1);
state.set('tasks', newTasks);

// Batch updates
state.batch(() => {
  state.set('isLoading', true);
  state.set('tasks', []);
});

// Subscribe to changes
eventBus.on('state-changed:currentWeekOffset', (newValue) => {
  console.log('Week changed to:', newValue);
});
```

### State Persistence

```javascript
// Auto-save to localStorage on every state change
state.set('key', value);
  ↓
storage.save('key', value);
  ↓
localStorage.setItem('weekly_app_key', JSON.stringify(value));

// Restore on app load
app-controller.js initializes
  ↓
storage.restore();
  ↓
state.set('key', storage.get('key'));
```

---

## Event System

### Event Architecture

```javascript
// Centralized event bus (pub/sub pattern)
const eventBus = {
  on(event, handler),     // Subscribe
  off(event, handler),    // Unsubscribe
  emit(event, data)       // Publish
};
```

### Event Categories

#### 1. Data Events
- `data-loaded` - Initial data fetch complete
- `data-refreshed` - Manual refresh
- `task-added` - New task created
- `task-updated` - Task modified
- `task-deleted` - Task removed
- `task-moved` - Task repositioned

#### 2. UI Events
- `week-changed` - Week navigation
- `department-filter-changed` - Filter updated
- `search-changed` - Search query updated
- `modal-opened` - Modal shown
- `modal-closed` - Modal hidden
- `fullscreen-toggled` - Fullscreen mode

#### 3. System Events
- `error` - Error occurred
- `loading-start` - Loading begins
- `loading-end` - Loading completes
- `state-restored` - State loaded from cache
- `auth-changed` - Authentication status changed

#### 4. State Events
- `state-changed:*` - State property changed
  - `state-changed:currentWeekOffset`
  - `state-changed:selectedDepartments`
  - `state-changed:tasks`

### Event Flow Example

```javascript
// Component A emits event
eventBus.emit('week-changed', { offset: 1 });

// Event bus notifies all subscribers
eventBus.notify('week-changed', { offset: 1 });

// Component B receives event
eventBus.on('week-changed', ({ offset }) => {
  updateWeekDisplay(offset);
});

// Component C receives same event
eventBus.on('week-changed', ({ offset }) => {
  fetchTasksForWeek(offset);
});
```

### Event Naming Convention

- **Prefix:** Category (data-, ui-, state-)
- **Action:** Past tense verb (loaded, changed, added)
- **Format:** kebab-case
- **Examples:** `data-loaded`, `task-updated`, `week-changed`

---

## API Integration

### Google Sheets API

**Purpose:** Read-only task data source
**Authentication:** Service Account JWT
**Endpoint:** `https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}`

```javascript
// Flow
auth-service.js generates JWT
  ↓
sheets-service.js requests data
  ↓
Google Sheets API returns rows
  ↓
sheets-service.js parses into task objects
  ↓
Returns tasks array
```

**Data Format:**
- Each row = one task
- Columns: Project, Task, Department, Week, Date, etc.

### Supabase API

**Purpose:** Read/write manual tasks + real-time sync
**Authentication:** API key + JWT
**Endpoint:** `https://[project].supabase.co/rest/v1/tasks`

```javascript
// CRUD Operations
supabase-service.js
  ├── getTasks() - Fetch all tasks
  ├── addTask() - Create new task
  ├── updateTask() - Modify task
  └── deleteTask() - Remove task

// Real-time Subscription
supabase
  .channel('tasks')
  .on('postgres_changes',
      { event: '*', schema: 'public', table: 'tasks' },
      handleChange)
  .subscribe();
```

**Data Format:**
- PostgreSQL table schema
- JSON columns for metadata
- Timestamps for created/updated

---

## Security Model

### Authentication Layers

#### 1. Service Account (Server-to-Server)
- **Purpose:** Access Google Sheets API
- **Method:** JWT tokens
- **Credentials:** Private key in `api-key.txt`
- **Scope:** Read-only access to specific spreadsheet

#### 2. Edit Mode (Client-Side)
- **Purpose:** Unlock editing features
- **Method:** Password comparison
- **Storage:** Plaintext in `constants.js` (not secure - demo only)
- **Scope:** UI enable/disable

#### 3. Supabase (API Key)
- **Purpose:** Database access
- **Method:** Anon key + RLS policies
- **Storage:** `api-config.js`
- **Scope:** CRUD operations on tasks table

### Security Considerations

**Current State (Development):**
- ⚠️ Credentials in source code
- ⚠️ No encryption for sensitive data
- ⚠️ Plaintext password for edit mode
- ✅ Read-only Google Sheets access
- ✅ Supabase RLS policies

**Production Recommendations:**
- 🔒 Move credentials to environment variables
- 🔒 Implement proper authentication (OAuth)
- 🔒 Hash passwords on server
- 🔒 Use HTTPS only
- 🔒 Add CSP headers
- 🔒 Sanitize user inputs

---

## Performance Considerations

### Current Performance

**Initialization Time:** ~1.4 seconds
**Bundle Size:** ~11,000 lines (unminified)
**Load Strategy:** All modules load upfront (no code splitting yet)

### Optimization Strategies

#### 1. Lazy Loading (Phase 9 - Planned)
```javascript
// Load modals on demand
const modal = await import('./modals/project-modal.js');
modal.open(taskId);
```

#### 2. Virtual Scrolling (Future)
```javascript
// Only render visible task cards
renderVisibleTasks(scrollTop, viewportHeight);
```

#### 3. Memoization
```javascript
// Cache expensive computations
const memoizedDates = memoize(calculateWeekDates);
```

#### 4. Debouncing
```javascript
// Limit search API calls
const debouncedSearch = debounce(performSearch, 300);
```

#### 5. LocalStorage Caching
```javascript
// Serve cached data first, update in background
const cachedTasks = storage.get('tasks');
renderTasks(cachedTasks);
fetchFreshTasks().then(renderTasks);
```

### Performance Monitoring

```javascript
// performance-monitor.js tracks:
- Initialization time
- Render time
- API response time
- User interaction latency
```

---

## Extension Points

### Adding New Features

1. **Create feature module** in `src/features/[feature-name]/`
2. **Export initialization function** `export function initializeFeature() {}`
3. **Register in app-controller.js** Phase 5
4. **Use event bus** for communication
5. **Update state** for persistence

### Adding New UI Components

1. **Create component file** in `src/components/`
2. **Export initialization function** `export function initializeComponent() {}`
3. **Register in app-controller.js** Phase 4
4. **Subscribe to relevant events** via event-bus
5. **Add styles** in `src/styles/components.css`

### Adding New Data Sources

1. **Create service file** in `src/services/[source]-service.js`
2. **Implement CRUD operations**
3. **Register in data-service.js**
4. **Merge data** in `data-service.fetchAllData()`

---

## Architectural Decisions

### Why Native ES6 Modules?
- ✅ No build step required
- ✅ Easier debugging (source maps not needed)
- ✅ Faster development iteration
- ✅ Browser-native (no tooling required)
- ⚠️ Trade-off: Larger initial load (no tree-shaking)

### Why Event Bus vs Direct Coupling?
- ✅ Components don't need to know about each other
- ✅ Easy to add/remove features
- ✅ Better testability
- ✅ No circular dependencies
- ⚠️ Trade-off: Event flow harder to trace

### Why Centralized State?
- ✅ Single source of truth
- ✅ Easier debugging (inspect one object)
- ✅ Automatic persistence to localStorage
- ✅ State changes trigger events automatically
- ⚠️ Trade-off: All components access same state

### Why Vanilla JavaScript?
- ✅ No framework lock-in
- ✅ Smaller bundle size
- ✅ Full control over implementation
- ✅ Educational value
- ⚠️ Trade-off: More boilerplate code

---

## Future Architecture Considerations

### Phase 9: Performance Optimization
- Lazy loading of modals
- Code splitting by route/feature
- Service worker for offline support
- Preloading critical resources

### Phase 10: Testing (Planned)
- Unit tests for services
- Integration tests for components
- E2E tests with Playwright
- Performance regression tests

### Phase 11: Build System (Planned)
- Bundling with Rollup/Vite
- Minification
- Tree-shaking
- Source maps for production

### Phase 12: TypeScript Migration (Considered)
- Type safety
- Better IDE support
- Refactoring confidence
- Trade-off: Build complexity

---

## Architectural Principles

1. **Separation of Concerns** - Each module has single responsibility
2. **Loose Coupling** - Components communicate via events
3. **High Cohesion** - Related code stays together
4. **Dependency Inversion** - Depend on abstractions (event bus, state) not concrete implementations
5. **Open/Closed Principle** - Open for extension, closed for modification
6. **Progressive Enhancement** - Works without JavaScript (basic HTML), enhanced with JS
7. **Graceful Degradation** - Features degrade gracefully if APIs fail

---

## Print System Architecture (Modular)

### Overview

The print system is a fully modular architecture split into three specialized modules to handle report generation with proper page break management.

### Print System Modules

```
┌─────────────────────────────────────────────────────────────┐
│                     print-utils.js                           │
│  • Entry point for print operations                          │
│  • Department color mapping                                  │
│  • Date parsing utilities                                    │
│  • Backward compatibility layer                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────┬──────────────────────────────────────┐
│   print-layout.js    │        print-renderer.js             │
│  • Component creators│  • Page assembly                     │
│  • Headers           │  • Page break management (CRITICAL)  │
│  • Tables            │  • Print execution                   │
│  • Task cards        │  • Scaling logic                     │
│  • Summaries         │  • Cleanup                           │
└──────────────────────┴──────────────────────────────────────┘
```

### Module Responsibilities

**1. print-layout.js** - Layout Component Creators
- `createDepartmentHeader()` - Department header with colors
- `createDepartmentSummary()` - Footer with totals
- `createTableHeader()` - Column headers
- `createTableFooter()` - Daily totals row
- `createPrintTaskCard()` - Individual task cards
- `createTableBody()` - All task rows
- `createDepartmentTable()` - Complete table assembly

**2. print-renderer.js** - Page Assembly & Rendering
- `createDepartmentPage()` - Assemble complete page
- `applyPageBreakRules()` - **CRITICAL** Page break logic
- `generatePrintContent()` - Main entry point
- `applyPrintScaling()` - Scale to fit page
- `executePrint()` - Execute print with setup/cleanup

**3. print-utils.js** - Utilities & Bridge
- `getDepartmentColorMapping()` - Color scheme
- `parseDate()` - Date parsing
- `normalizeDepartmentClass()` - CSS class normalization
- `getMaxTasksForDept()` - Calculate row count
- Delegates to modular system

### Critical: Page Break Management

The print system prevents blank pages while ensuring proper page breaks between departments.

**Page Break Rules (in print-renderer.js):**

```javascript
// CRITICAL: Apply page breaks correctly
function applyPageBreakRules(pages) {
  pages.forEach((page, index) => {
    // Remove all existing page break styles
    page.style.pageBreakAfter = 'auto';
    page.style.pageBreakBefore = 'auto';
    page.style.pageBreakInside = 'avoid';

    // Remove margins that could push content
    page.style.marginBottom = '0';
    page.style.paddingBottom = '0';

    // Add page break between departments (but NOT after last)
    if (index < pages.length - 1) {
      page.style.pageBreakAfter = 'always';
      page.style.breakAfter = 'page';
    } else {
      // Last page: prevent page break to avoid blank pages
      page.style.pageBreakAfter = 'avoid';
      page.style.breakAfter = 'avoid';
    }
  });
}
```

**Key Principles:**
1. **Always add page breaks between departments** - Each gets own page
2. **Never add page breaks after last page** - Prevents blank pages
3. **Remove margins/padding** - Ensures clean boundaries
4. **Use `page-break-inside: avoid`** - Keeps content together
5. **Support both modern and legacy CSS** - `break-*` and `page-break-*`

### Print Types

**Weekly Print (Landscape)**
- 7-day columns (Mon-Sun)
- Department rows
- Revenue totals per day
- Each department on separate page

**Daily Print (Portrait)**
- Single day focus
- Columns: Date, Revenue, Mid-Day, End of Day
- Detailed task information
- Each department on separate page

### Print Flow

```
User clicks Print button
      ↓
print-modal.js opens
      ↓
User selects departments & print type
      ↓
print-utils.generatePrintContent()
      ↓
print-renderer.generatePrintContent()
      ↓
For each selected department:
  ├─ print-layout.createDepartmentHeader()
  ├─ print-layout.createDepartmentTable()
  └─ print-layout.createDepartmentSummary()
      ↓
print-renderer.applyPageBreakRules()  ← CRITICAL
      ↓
print-renderer.applyPrintScaling()
      ↓
print-renderer.executePrint()
      ↓
Browser print dialog opens
```

### Benefits of Modular Print System

1. **Separation of Concerns** - Layout, rendering, utilities separate
2. **Fixes Blank Page Issue** - Proper page break management
3. **Easier Testing** - Each module testable independently
4. **Better Maintainability** - Changes localized
5. **Reusability** - Components reused across print types
6. **Extensibility** - New features don't affect existing code

### Performance Characteristics

- **Load time:** Minimal increase (3 files vs 1 inline)
- **Execution time:** Same or better due to optimized logic
- **Memory usage:** Similar with better cleanup
- **Print quality:** Improved page break management

---

## Related Documentation

- `.claude/CODEBASE_MAP.md` - Quick navigation reference
- `.claude/MODULE_INDEX.md` - Detailed module descriptions
- `.claude/COMMON_TASKS.md` - Task-based guide (includes print system tasks)
- `Documentation/REFACTORING_PLAN.md` - Complete refactoring history
- `Documentation/PHASE_8_BRIEFING.md` - Latest implementation details
