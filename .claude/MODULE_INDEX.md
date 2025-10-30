# Module Index

Comprehensive index of all modules with descriptions, dependencies, and usage.

## Table of Contents

1. [Entry Point](#entry-point)
2. [Configuration Modules](#configuration-modules)
3. [Core Modules](#core-modules)
4. [Service Modules](#service-modules)
5. [Component Modules](#component-modules)
6. [Feature Modules](#feature-modules)
7. [Utility Modules](#utility-modules)
8. [Quick Reference Table](#quick-reference-table)

---

## Entry Point

### main.js
**Path:** `src/main.js`
**Size:** 43 lines
**Purpose:** Application entry point that initializes the app controller

**Exports:**
- None (immediately invoked)

**Dependencies:**
- `core/app-controller.js`

**Description:**
The main entry point that kicks off the entire application. Simply imports and calls `initializeApp()` from the app controller. Wrapped in DOMContentLoaded to ensure DOM is ready.

**Usage:**
```javascript
// Loaded automatically by index.html
// <script type="module" src="src/main.js"></script>
```

---

## Configuration Modules

### api-config.js
**Path:** `src/config/api-config.js`
**Purpose:** Centralized API configuration and credentials

**Exports:**
```javascript
export const API_CONFIG = {
  googleSheets: {
    spreadsheetId: string,
    serviceAccountKeyPath: string
  },
  supabase: {
    url: string,
    anonKey: string
  }
}
```

**Dependencies:** None

**Description:**
Contains all API endpoints, keys, and configuration. Should be the only place credentials are stored (currently in source, should be environment variables in production).

**Used By:**
- `services/auth-service.js`
- `services/sheets-service.js`
- `services/supabase-service.js`

**Security Notes:**
- ⚠️ Contains sensitive credentials
- ⚠️ Should not be committed to public repos
- 🔒 Move to environment variables for production

---

### constants.js
**Path:** `src/config/constants.js`
**Purpose:** Application-wide constants

**Exports:**
```javascript
export const EDIT_PASSWORD = string;
export const PERFORMANCE_THRESHOLDS = {
  initTime: number,
  renderTime: number
};
export const UI_CONSTANTS = {
  animationDuration: number,
  debounceDelay: number
};
```

**Dependencies:** None

**Description:**
Stores constants used throughout the application. Includes edit mode password, performance targets, and UI timing values.

**Used By:**
- `components/modals/password-modal.js`
- `core/performance-monitor.js`
- Various UI components

---

### department-config.js
**Path:** `src/config/department-config.js`
**Purpose:** Department definitions and display configuration

**Exports:**
```javascript
export const DEPARTMENTS = [
  { id: string, name: string, color: string },
  // ... 11 departments total
];
export const DEPARTMENT_ORDER = string[];
```

**Dependencies:** None

**Description:**
Defines all departments with their colors and display order. Central place for department configuration.

**Used By:**
- `components/schedule-grid.js`
- `components/department-filter.js`
- `components/task-card.js`
- `features/print/print-layout.js`

**Department List:**
1. Graphic Design
2. Web Development
3. Video Production
4. Social Media
5. Photography
6. Copywriting
7. Project Management
8. Client Services
9. Print Production
10. Strategy
11. Other

---

## Core Modules

### app-controller.js
**Path:** `src/core/app-controller.js`
**Size:** 558 lines
**Purpose:** Main application orchestrator

**Exports:**
```javascript
export async function initializeApp(config?: object): Promise<void>
```

**Dependencies:**
- `core/error-handler.js`
- `core/state.js`
- `core/storage.js`
- `core/event-bus.js`
- `services/*`
- `components/*`
- `features/*`

**Description:**
Orchestrates the 6-phase initialization sequence:
1. **Phase 1:** Error handler setup
2. **Phase 2:** State restoration from localStorage
3. **Phase 3:** Service initialization (auth, sheets, supabase)
4. **Phase 4:** UI component initialization
5. **Phase 5:** Feature module initialization
6. **Phase 6:** Initial data fetch and render

**Key Functions:**
- `initializeApp()` - Main initialization
- `initializeServices()` - Phase 3
- `initializeComponents()` - Phase 4
- `initializeFeatures()` - Phase 5
- `loadInitialData()` - Phase 6

**Usage:**
```javascript
import { initializeApp } from './core/app-controller.js';
await initializeApp();
```

---

### state.js
**Path:** `src/core/state.js`
**Size:** 353 lines
**Purpose:** Centralized state management

**Exports:**
```javascript
export function get(key: string): any
export function set(key: string, value: any): void
export function batch(fn: Function): void
export function subscribe(key: string, handler: Function): Function
```

**Dependencies:**
- `core/event-bus.js`
- `core/storage.js`

**Description:**
Single source of truth for application state. Provides getters/setters with automatic event emission and localStorage persistence.

**State Structure:**
```javascript
{
  tasks: [],
  departments: [],
  currentWeekOffset: 0,
  selectedDepartments: [],
  searchQuery: '',
  isFullscreen: false,
  isAuthenticated: false,
  isEditMode: false,
  isPrintMode: false,
  isLoading: false
}
```

**Key Features:**
- Automatic event emission on state change
- Automatic localStorage persistence
- Batch updates for multiple changes
- Subscribe to specific state keys
- Backward compatibility via `window.state`

**Usage:**
```javascript
import { get, set } from './core/state.js';

const weekOffset = get('currentWeekOffset');
set('currentWeekOffset', 1); // Emits 'state-changed:currentWeekOffset'
```

---

### event-bus.js
**Path:** `src/core/event-bus.js`
**Size:** 196 lines
**Purpose:** Event-driven communication hub

**Exports:**
```javascript
export const eventBus = {
  on(event: string, handler: Function): void,
  off(event: string, handler: Function): void,
  emit(event: string, data?: any): void,
  once(event: string, handler: Function): void
}
```

**Dependencies:** None

**Description:**
Implements pub/sub pattern for decoupled component communication. Central event hub for all application events.

**Event Categories:**
- **Data Events:** `data-loaded`, `task-added`, `task-updated`, `task-deleted`, `task-moved`
- **UI Events:** `week-changed`, `department-filter-changed`, `search-changed`, `modal-opened`, `modal-closed`
- **System Events:** `error`, `loading-start`, `loading-end`, `auth-changed`
- **State Events:** `state-changed:*`

**Usage:**
```javascript
import { eventBus } from './core/event-bus.js';

// Subscribe
eventBus.on('data-loaded', (tasks) => {
  console.log('Tasks loaded:', tasks);
});

// Publish
eventBus.emit('data-loaded', tasks);

// Unsubscribe
eventBus.off('data-loaded', handler);
```

---

### storage.js
**Path:** `src/core/storage.js`
**Size:** 370 lines
**Purpose:** LocalStorage wrapper with versioning

**Exports:**
```javascript
export function save(key: string, value: any): void
export function get(key: string): any
export function remove(key: string): void
export function clear(): void
export function restore(): object
```

**Dependencies:** None

**Description:**
Wrapper around localStorage with JSON serialization, versioning, and error handling. Prefixes all keys with 'weekly_app_'.

**Features:**
- Automatic JSON serialization/deserialization
- Version migration support
- Error handling for quota exceeded
- Bulk restore on app load
- Clear all app data

**Usage:**
```javascript
import { save, get, restore } from './core/storage.js';

save('tasks', tasks);
const tasks = get('tasks');
const allState = restore(); // Load all saved state
```

---

### error-handler.js
**Path:** `src/core/error-handler.js`
**Size:** 313 lines
**Purpose:** Global error handling and logging

**Exports:**
```javascript
export function initializeErrorHandler(): void
export function logError(error: Error, context?: string): void
export function showErrorMessage(message: string): void
```

**Dependencies:**
- `core/event-bus.js`

**Description:**
Catches and logs all JavaScript errors. Displays user-friendly error messages and emits error events for monitoring.

**Features:**
- Global error and unhandled rejection handlers
- Error categorization (network, auth, data, UI)
- User-friendly error messages
- Error logging to console
- Error event emission for monitoring

**Usage:**
```javascript
import { initializeErrorHandler, logError } from './core/error-handler.js';

initializeErrorHandler();

try {
  // risky operation
} catch (error) {
  logError(error, 'risky-operation');
}
```

---

### loading-manager.js
**Path:** `src/core/loading-manager.js`
**Size:** 187 lines
**Purpose:** Loading indicator management

**Exports:**
```javascript
export function showLoading(message?: string): void
export function hideLoading(): void
export function setLoadingProgress(percent: number): void
```

**Dependencies:**
- `core/event-bus.js`

**Description:**
Manages loading indicators and progress bars. Prevents UI interaction during loading.

**Features:**
- Show/hide loading overlay
- Progress bar updates
- Loading message display
- Prevents multiple simultaneous loaders

**Usage:**
```javascript
import { showLoading, hideLoading } from './core/loading-manager.js';

showLoading('Fetching tasks...');
await fetchTasks();
hideLoading();
```

---

### keyboard-shortcuts.js
**Path:** `src/core/keyboard-shortcuts.js`
**Size:** 339 lines
**Purpose:** Keyboard shortcut handling

**Exports:**
```javascript
export function initializeKeyboardShortcuts(): void
export function registerShortcut(keys: string, handler: Function): void
```

**Dependencies:**
- `core/event-bus.js`
- `core/state.js`

**Description:**
Registers and handles 10 keyboard shortcuts for common actions.

**Shortcuts:**
- `Ctrl+Left` - Previous week
- `Ctrl+Right` - Next week
- `Ctrl+0` - Current week
- `Ctrl+F` - Focus search
- `Ctrl+R` - Refresh data
- `Ctrl+P` - Print
- `Ctrl+E` - Toggle edit mode
- `F11` - Fullscreen
- `Escape` - Close modal/exit fullscreen
- `Ctrl+Z` - Undo (future)

**Usage:**
```javascript
import { initializeKeyboardShortcuts } from './core/keyboard-shortcuts.js';

initializeKeyboardShortcuts();
```

---

### global-listeners.js
**Path:** `src/core/global-listeners.js`
**Size:** 237 lines
**Purpose:** Global event listeners (window, document)

**Exports:**
```javascript
export function initializeGlobalListeners(): void
```

**Dependencies:**
- `core/event-bus.js`
- `core/state.js`

**Description:**
Attaches listeners for browser events like online/offline, visibility change, fullscreen, and resize.

**Events Handled:**
- `online`/`offline` - Network status
- `visibilitychange` - Tab visibility
- `fullscreenchange` - Fullscreen mode
- `resize` - Window resize
- `beforeunload` - Warn before leaving with unsaved changes

**Usage:**
```javascript
import { initializeGlobalListeners } from './core/global-listeners.js';

initializeGlobalListeners();
```

---

### performance-monitor.js
**Path:** `src/core/performance-monitor.js`
**Purpose:** Performance tracking and monitoring

**Exports:**
```javascript
export function startTracking(label: string): void
export function endTracking(label: string): void
export function logPerformance(): void
```

**Dependencies:**
- `config/constants.js`

**Description:**
Tracks performance metrics like initialization time, render time, and API response time.

**Metrics Tracked:**
- App initialization time
- Component render time
- API request duration
- User interaction latency

---

### offline-manager.js
**Path:** `src/core/offline-manager.js`
**Purpose:** Offline support and sync queue

**Exports:**
```javascript
export function initializeOfflineManager(): void
export function queueAction(action: object): void
export function syncQueue(): Promise<void>
```

**Dependencies:**
- `core/event-bus.js`
- `core/state.js`
- `core/storage.js`

**Description:**
Handles offline scenarios by queueing actions and syncing when online.

**Features:**
- Detect online/offline status
- Queue write operations when offline
- Auto-sync when connection restored
- Show offline indicator

---

## Service Modules

### auth-service.js
**Path:** `src/services/auth-service.js`
**Size:** 140 lines
**Purpose:** Authentication management

**Exports:**
```javascript
export async function authenticate(): Promise<string>
export async function getAccessToken(): Promise<string>
export function isAuthenticated(): boolean
```

**Dependencies:**
- `config/api-config.js`
- `core/state.js`

**Description:**
Handles authentication with Google API using Service Account JWT tokens.

**Auth Methods:**
- Service Account JWT (default)
- OAuth 2.0 (optional)

**Usage:**
```javascript
import { authenticate, getAccessToken } from './services/auth-service.js';

await authenticate();
const token = await getAccessToken();
```

---

### sheets-service.js
**Path:** `src/services/sheets-service.js`
**Size:** 220 lines
**Purpose:** Google Sheets API integration

**Exports:**
```javascript
export async function fetchTasks(): Promise<Task[]>
export async function fetchDepartments(): Promise<Department[]>
```

**Dependencies:**
- `config/api-config.js`
- `services/auth-service.js`
- `utils/date-utils.js`

**Description:**
Fetches task data from Google Sheets. Read-only access.

**Features:**
- Fetch all tasks from spreadsheet
- Parse rows into task objects
- Handle date formatting
- Error handling for API failures

**Data Format:**
Each row = one task with columns: Project, Task, Department, Week, Date, Status, Notes

**Usage:**
```javascript
import { fetchTasks } from './services/sheets-service.js';

const tasks = await fetchTasks();
```

---

### supabase-service.js
**Path:** `src/services/supabase-service.js`
**Size:** 345 lines
**Purpose:** Supabase database integration

**Exports:**
```javascript
export async function getTasks(): Promise<Task[]>
export async function addTask(task: Task): Promise<Task>
export async function updateTask(id: string, updates: object): Promise<Task>
export async function deleteTask(id: string): Promise<void>
export function subscribeToChanges(handler: Function): void
```

**Dependencies:**
- `config/api-config.js`
- `core/event-bus.js`

**Description:**
Full CRUD operations on Supabase database plus real-time subscriptions.

**Features:**
- CRUD operations for manual tasks
- Real-time sync via Postgres subscriptions
- Optimistic updates
- Conflict resolution

**Usage:**
```javascript
import { addTask, subscribeToChanges } from './services/supabase-service.js';

const newTask = await addTask({ project: 'Test', task: 'Example' });

subscribeToChanges((payload) => {
  console.log('Change detected:', payload);
});
```

---

### data-service.js
**Path:** `src/services/data-service.js`
**Size:** 141 lines
**Purpose:** Data orchestration and merging

**Exports:**
```javascript
export async function fetchAllData(): Promise<object>
export async function refreshData(): Promise<void>
export function mergeTaskSources(sheets: Task[], supabase: Task[]): Task[]
```

**Dependencies:**
- `services/sheets-service.js`
- `services/supabase-service.js`
- `core/state.js`
- `core/event-bus.js`

**Description:**
Orchestrates data fetching from multiple sources and merges results.

**Features:**
- Fetch from Google Sheets and Supabase
- Merge tasks from both sources
- Deduplicate based on ID
- Update global state
- Emit data-loaded event

**Usage:**
```javascript
import { fetchAllData, refreshData } from './services/data-service.js';

const { tasks, departments } = await fetchAllData();
await refreshData(); // Manual refresh
```

---

## Component Modules

### schedule-grid.js
**Path:** `src/components/schedule-grid.js`
**Size:** 501 lines
**Purpose:** Main schedule display grid

**Exports:**
```javascript
export function initializeScheduleGrid(): void
export function renderSchedule(): void
export function updateCell(day: string, department: string): void
```

**Dependencies:**
- `core/state.js`
- `core/event-bus.js`
- `components/task-card.js`
- `config/department-config.js`
- `utils/date-utils.js`

**Description:**
Renders the main weekly schedule grid with days as columns and departments as rows.

**Features:**
- Renders 7x11 grid (7 days × 11 departments)
- Filters by selected departments
- Search filtering
- Drag & drop zones
- Empty cell indicators

**Event Listeners:**
- `data-loaded` - Re-render grid
- `week-changed` - Re-render for new week
- `department-filter-changed` - Filter display
- `search-changed` - Filter by search query
- `task-added`, `task-updated`, `task-deleted` - Update cells

**Usage:**
```javascript
import { initializeScheduleGrid } from './components/schedule-grid.js';

initializeScheduleGrid();
```

---

### task-card.js
**Path:** `src/components/task-card.js`
**Size:** 153 lines
**Purpose:** Task card rendering

**Exports:**
```javascript
export function createTaskCard(task: Task): HTMLElement
export function updateTaskCard(cardElement: HTMLElement, task: Task): void
```

**Dependencies:**
- `config/department-config.js`
- `utils/date-utils.js`

**Description:**
Creates and updates individual task card elements.

**Features:**
- Department color coding
- Project and task name display
- Click to open details
- Draggable for drag & drop
- Context menu support

**Usage:**
```javascript
import { createTaskCard } from './components/task-card.js';

const card = createTaskCard(task);
cell.appendChild(card);
```

---

### department-filter.js
**Path:** `src/components/department-filter.js`
**Size:** 156 lines
**Purpose:** Multi-select department filter

**Exports:**
```javascript
export function initializeDepartmentFilter(): void
```

**Dependencies:**
- `core/state.js`
- `core/event-bus.js`
- `config/department-config.js`

**Description:**
Multi-select checkbox filter for departments.

**Features:**
- Checkbox for each department
- "Select All" / "Deselect All"
- Persists selection to state
- Emits filter-changed event

**Usage:**
```javascript
import { initializeDepartmentFilter } from './components/department-filter.js';

initializeDepartmentFilter();
```

---

### week-navigation.js
**Path:** `src/components/week-navigation.js`
**Size:** 159 lines
**Purpose:** Week navigation controls

**Exports:**
```javascript
export function initializeWeekNavigation(): void
```

**Dependencies:**
- `core/state.js`
- `core/event-bus.js`
- `utils/date-utils.js`

**Description:**
Previous/Next week buttons and current week display.

**Features:**
- Previous week button
- Next week button
- Current week button (reset to today)
- Week range display
- Keyboard shortcuts

**Usage:**
```javascript
import { initializeWeekNavigation } from './components/week-navigation.js';

initializeWeekNavigation();
```

---

### search-bar.js
**Path:** `src/components/search-bar.js`
**Size:** 153 lines
**Purpose:** Project/task search

**Exports:**
```javascript
export function initializeSearchBar(): void
```

**Dependencies:**
- `core/state.js`
- `core/event-bus.js`

**Description:**
Search input that filters tasks by project or task name.

**Features:**
- Debounced search input
- Clear button
- Keyboard shortcut (Ctrl+F)
- Highlights matching tasks

**Usage:**
```javascript
import { initializeSearchBar } from './components/search-bar.js';

initializeSearchBar();
```

---

## Component Modules - Modals

### password-modal.js
**Path:** `src/components/modals/password-modal.js`
**Size:** 206 lines
**Purpose:** Edit mode password authentication

**Exports:**
```javascript
export function openPasswordModal(): void
export function closePasswordModal(): void
```

**Dependencies:**
- `core/state.js`
- `core/event-bus.js`
- `config/constants.js`

**Description:**
Modal for entering edit mode password.

**Features:**
- Password input field
- Show/hide password toggle
- Submit/cancel buttons
- Enter key to submit
- Escape to close

---

### add-task-modal.js
**Path:** `src/components/modals/add-task-modal.js`
**Size:** 231 lines
**Purpose:** Create new tasks

**Exports:**
```javascript
export function openAddTaskModal(day?: string, department?: string): void
export function closeAddTaskModal(): void
```

**Dependencies:**
- `core/state.js`
- `core/event-bus.js`
- `services/supabase-service.js`
- `config/department-config.js`

**Description:**
Form modal for creating new manual tasks.

**Features:**
- Pre-filled day/department if clicked from cell
- Project name input
- Task description input
- Department dropdown
- Date picker
- Save to Supabase

---

### project-modal.js
**Path:** `src/components/modals/project-modal.js`
**Size:** 502 lines
**Purpose:** Task details and editing

**Exports:**
```javascript
export function openProjectModal(taskId: string): void
export function closeProjectModal(): void
```

**Dependencies:**
- `core/state.js`
- `core/event-bus.js`
- `services/supabase-service.js`
- `config/department-config.js`

**Description:**
Modal for viewing and editing task details.

**Features:**
- View all task fields
- Edit task (if in edit mode)
- Delete task
- Move to different day/department
- Add notes
- Change status

---

### print-modal.js
**Path:** `src/components/modals/print-modal.js`
**Size:** 336 lines
**Purpose:** Print configuration

**Exports:**
```javascript
export function openPrintModal(): void
export function closePrintModal(): void
```

**Dependencies:**
- `core/state.js`
- `core/event-bus.js`
- `features/print/print-renderer.js`

**Description:**
Configure print settings before printing.

**Features:**
- Select date range
- Select departments
- Page layout options
- Include/exclude completed tasks
- Preview before print

---

## Feature Modules

### drag-drop-manager.js
**Path:** `src/features/drag-drop/drag-drop-manager.js`
**Purpose:** Drag and drop functionality

**Exports:**
```javascript
export function initializeDragDrop(): void
```

**Dependencies:**
- `core/state.js`
- `core/event-bus.js`
- `services/supabase-service.js`

**Description:**
Enables dragging task cards between cells.

**Features:**
- Drag task cards
- Drop zones in cells
- Visual feedback during drag
- Update task day/department
- Save changes to database

---

### context-menu.js
**Path:** `src/features/context-menu/context-menu.js`
**Purpose:** Right-click context menu

**Exports:**
```javascript
export function initializeContextMenu(): void
```

**Dependencies:**
- `core/state.js`
- `core/event-bus.js`

**Description:**
Right-click menu on task cards.

**Actions:**
- Open details
- Edit task
- Delete task
- Move to...
- Mark complete

---

### add-card-indicators.js
**Path:** `src/features/editing/add-card-indicators.js`
**Purpose:** Empty cell UI indicators

**Exports:**
```javascript
export function initializeAddCardIndicators(): void
```

**Dependencies:**
- `core/state.js`
- `core/event-bus.js`

**Description:**
Shows "+" button in empty cells when in edit mode.

---

### delete-task-handler.js
**Path:** `src/features/editing/delete-task-handler.js`
**Purpose:** Task deletion

**Exports:**
```javascript
export function initializeDeleteHandler(): void
```

**Dependencies:**
- `core/event-bus.js`
- `services/supabase-service.js`

**Description:**
Handles task deletion with confirmation.

---

## Feature Modules - Print System

> **Important:** The print system is modular with three core modules handling layout, rendering, and utilities. See `.claude/ARCHITECTURE.md` for complete architectural overview including critical page break management.

### print-layout.js
**Path:** `src/features/print/print-layout.js`
**Purpose:** Layout component creators for print reports

**Exports (via window.PrintLayout):**
```javascript
// Component creators
export function createDepartmentHeader(dept, printType, colors): HTMLElement
export function createDepartmentSummary(dept, totalHours, revenue): HTMLElement
export function createTableHeader(dates, printType): HTMLElement
export function createTableFooter(dates, tasks, printType): HTMLElement
export function createPrintTaskCard(task, departmentClass): HTMLElement
export function createTableBody(dates, tasks, maxTasks, printType): HTMLElement
export function createDepartmentTable(dept, tasks, dates, printType, isCompact): HTMLElement
```

**Dependencies:**
- `print-utils.js` (for normalizeDepartmentClass)
- `config/department-config.js` (for department order)

**Description:**
Creates individual layout components for print reports. Each function generates a specific part of the print layout (headers, tables, cards, summaries).

**Key Functions:**
- `createDepartmentHeader()` - Department header with background color
- `createDepartmentTable()` - Complete table with header, body, footer
- `createPrintTaskCard()` - Individual task card for print
- `createTableBody()` - Generates all task rows for a department

**Usage:**
```javascript
const colors = { bg: '#06B6D4', text: '#FFFFFF' };
const header = window.PrintLayout.createDepartmentHeader('Mill', 'week', colors);
const table = window.PrintLayout.createDepartmentTable('Mill', tasks, dates, 'week', false);
```

---

### print-renderer.js
**Path:** `src/features/print/print-renderer.js`
**Purpose:** Page assembly and print execution with page break management

**Exports (via window.PrintRenderer):**
```javascript
export function createDepartmentPage(dept, tasks, dates, printType, isCompact, colors): HTMLElement
export function applyPageBreakRules(pages): void  // CRITICAL
export function generatePrintContent(printType, selectedDepts, weekDates, allTasks): HTMLElement
export function applyPrintScaling(printContent, printType): void
export function executePrint(printContent, printType): void
```

**Dependencies:**
- `print-layout.js` (for component creation)
- `print-utils.js` (for utilities)

**Description:**
Assembles complete pages and manages the print process. Contains **critical page break logic** that prevents blank pages.

**Critical Function - applyPageBreakRules():**
```javascript
// Prevents blank pages while ensuring proper breaks between departments
function applyPageBreakRules(pages) {
  pages.forEach((page, index) => {
    // Remove all existing page break styles
    page.style.pageBreakAfter = 'auto';
    page.style.pageBreakInside = 'avoid';

    // Remove margins/padding that could push content
    page.style.marginBottom = '0';
    page.style.paddingBottom = '0';

    // Add page break between departments (NOT after last)
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

**Key Functions:**
- `createDepartmentPage()` - Assembles header + table + summary
- `applyPageBreakRules()` - **CRITICAL** Prevents blank pages
- `generatePrintContent()` - Main entry point for content generation
- `executePrint()` - Opens browser print dialog with proper setup

**Usage:**
```javascript
const printContent = window.PrintRenderer.generatePrintContent(
  'week',              // printType: 'week' or 'day'
  ['Mill', 'Cast'],    // selectedDepts
  weekDates,           // array of Date objects
  allTasks             // all tasks
);
window.PrintRenderer.executePrint(printContent, 'week');
```

---

### print-utils.js
**Path:** `src/features/print/print-utils.js`
**Purpose:** Print utilities and bridge to modular system

**Exports (via window.PrintUtils):**
```javascript
export function getDepartmentColorMapping(): object
export function parseDate(dateStr): Date
export function normalizeDepartmentClass(dept): string
export function getMaxTasksForDept(dept, tasks, dates, printType): number
export function generatePrintContent(...): HTMLElement  // Delegates to PrintRenderer
export function executePrint(...): void  // Delegates to PrintRenderer
```

**Dependencies:**
- None (pure utilities)
- Delegates to `print-renderer.js` for main operations

**Description:**
Provides utility functions and acts as backward compatibility layer. Entry point delegates to modular system.

**Key Functions:**
- `getDepartmentColorMapping()` - Returns department colors for print
- `parseDate()` - Parses dates from various formats (MM/DD/YYYY, etc.)
- `normalizeDepartmentClass()` - Converts "Form Out" → "form-out"
- `getMaxTasksForDept()` - Calculates max tasks per day for layout

**Department Colors:**
```javascript
{
  'mill': { bg: '#06B6D4', text: '#FFFFFF' },
  'cast': { bg: '#EF4444', text: '#FFFFFF' },
  'batch': { bg: '#800000', text: '#FFFFFF' },
  // ... 11 departments total
}
```

**Usage:**
```javascript
const colors = window.PrintUtils.getDepartmentColorMapping()['mill'];
const date = window.PrintUtils.parseDate('12/25/2024');
const maxTasks = window.PrintUtils.getMaxTasksForDept('Mill', tasks, dates, 'week');
```

---

### print-debug.js
**Path:** `src/features/print/print-debug.js`
**Purpose:** Print debugging tools

**Exports:**
```javascript
export function enablePrintDebug(): void
export function logPrintMetrics(): void
```

**Description:**
Debugging utilities for print system development and troubleshooting.

**Features:**
- Enable detailed print logging
- Track page break application
- Measure print performance
- Log scaling calculations

---

## Print System Summary

**Module Loading Order:**
1. `print-layout.js` (component creators)
2. `print-renderer.js` (page assembly)
3. `print-utils.js` (entry point/bridge)

**Print Types:**
- **Weekly Print** - Landscape, 7-day columns, all tasks
- **Daily Print** - Portrait, single day, detailed view

**Critical Behavior:**
- Single department → 1 page, no page break after
- Multiple departments → Each on own page, breaks between (not after last)
- Page break management prevents blank pages

**Testing Checklist:**
- [ ] Single department prints on 1 page (no blank pages)
- [ ] Multiple departments each get own page
- [ ] No blank page after last department
- [ ] Weekly print uses landscape orientation
- [ ] Daily print uses portrait orientation
- [ ] Content doesn't overflow pages

**See Also:**
- `.claude/ARCHITECTURE.md` - Complete print system architecture
- `.claude/COMMON_TASKS.md` - Print system troubleshooting guide

---

## Feature Modules - Schedule & Search

### schedule-renderer.js
**Path:** `src/features/schedule/schedule-renderer.js`
**Purpose:** Schedule rendering logic

**Exports:**
```javascript
export function renderWeek(weekOffset: number): void
```

---

### schedule-filter.js
**Path:** `src/features/schedule/schedule-filter.js`
**Purpose:** Task filtering logic

**Exports:**
```javascript
export function filterTasks(tasks: Task[], filters: object): Task[]
```

---

### schedule-navigation.js
**Path:** `src/features/schedule/schedule-navigation.js`
**Purpose:** Week navigation logic

**Exports:**
```javascript
export function navigateToWeek(offset: number): void
export function getCurrentWeekDates(): Date[]
```

---

### search-handler.js
**Path:** `src/features/search/search-handler.js`
**Purpose:** Search functionality

**Exports:**
```javascript
export function performSearch(query: string): Task[]
export function highlightSearchResults(query: string): void
```

---

### project-modal.js (feature duplicate)
**Path:** `src/features/modals/project-modal.js`
**Note:** Duplicate of `components/modals/project-modal.js` - should consolidate

---

## Utility Modules

### date-utils.js
**Path:** `src/utils/date-utils.js`
**Purpose:** Date manipulation and formatting

**Exports:**
```javascript
export function getWeekDates(offset: number): Date[]
export function formatDate(date: Date, format: string): string
export function parseDate(dateString: string): Date
export function isToday(date: Date): boolean
export function isSameDay(date1: Date, date2: Date): boolean
export function addDays(date: Date, days: number): Date
export function getWeekNumber(date: Date): number
```

**Dependencies:** None

**Description:**
Comprehensive date utilities for week calculations, formatting, and comparisons.

**Usage:**
```javascript
import { getWeekDates, formatDate } from './utils/date-utils.js';

const dates = getWeekDates(0); // Current week
const formatted = formatDate(new Date(), 'MMM DD, YYYY');
```

---

### ui-utils.js
**Path:** `src/utils/ui-utils.js`
**Purpose:** DOM manipulation helpers

**Exports:**
```javascript
export function createElement(tag: string, className?: string, attributes?: object): HTMLElement
export function clearElement(element: HTMLElement): void
export function showElement(element: HTMLElement): void
export function hideElement(element: HTMLElement): void
export function toggleElement(element: HTMLElement): void
export function debounce(fn: Function, delay: number): Function
export function throttle(fn: Function, limit: number): Function
```

**Dependencies:** None

**Description:**
Helper functions for DOM manipulation and function optimization.

**Usage:**
```javascript
import { createElement, debounce } from './utils/ui-utils.js';

const button = createElement('button', 'btn-primary', { id: 'submit' });
const debouncedSearch = debounce(performSearch, 300);
```

---

### lazy-loader.js
**Path:** `src/utils/lazy-loader.js`
**Purpose:** Dynamic module loading

**Exports:**
```javascript
export async function loadModule(modulePath: string): Promise<object>
export async function preloadModules(modulePaths: string[]): Promise<void>
```

**Dependencies:** None

**Description:**
Utilities for lazy loading modules on demand (Phase 9).

**Usage:**
```javascript
import { loadModule } from './utils/lazy-loader.js';

const modal = await loadModule('./modals/project-modal.js');
modal.open(taskId);
```

---

## Quick Reference Table

| Module | Category | Size (lines) | Key Dependencies | Primary Purpose |
|--------|----------|--------------|------------------|-----------------|
| main.js | Entry | 43 | app-controller | App entry point |
| app-controller.js | Core | 558 | All modules | Orchestration |
| state.js | Core | 353 | event-bus, storage | State management |
| event-bus.js | Core | 196 | None | Event system |
| storage.js | Core | 370 | None | Persistence |
| error-handler.js | Core | 313 | event-bus | Error handling |
| auth-service.js | Service | 140 | api-config | Authentication |
| sheets-service.js | Service | 220 | auth-service | Google Sheets |
| supabase-service.js | Service | 345 | api-config | Database CRUD |
| data-service.js | Service | 141 | sheets, supabase | Data orchestration |
| schedule-grid.js | Component | 501 | state, event-bus | Main display |
| task-card.js | Component | 153 | department-config | Task rendering |
| project-modal.js | Component | 502 | supabase-service | Task details |
| drag-drop-manager.js | Feature | - | supabase-service | Drag & drop |
| print-renderer.js | Feature | - | print-layout | Print system |
| date-utils.js | Utility | - | None | Date functions |
| ui-utils.js | Utility | - | None | DOM helpers |

---

## Module Loading Order

**Phase 1: Configuration**
1. api-config.js
2. constants.js
3. department-config.js

**Phase 2: Core Infrastructure**
4. error-handler.js
5. storage.js
6. event-bus.js
7. state.js

**Phase 3: Services**
8. auth-service.js
9. sheets-service.js
10. supabase-service.js
11. data-service.js

**Phase 4: Utilities**
12. date-utils.js
13. ui-utils.js
14. lazy-loader.js

**Phase 5: Components**
15. task-card.js
16. schedule-grid.js
17. department-filter.js
18. week-navigation.js
19. search-bar.js
20. Modals (lazy loaded)

**Phase 6: Features**
21. drag-drop-manager.js
22. context-menu.js
23. print system
24. editing features

**Phase 7: Orchestration**
25. app-controller.js
26. main.js

---

## Finding Modules

**By Functionality:**
```bash
# Authentication
grep: "export.*authenticate" in src/services/

# State management
grep: "export function get" in src/core/state.js

# Event handling
grep: "eventBus.emit" in src/

# Task rendering
grep: "createTaskCard" in src/
```

**By Dependency:**
```bash
# Find what uses state.js
grep: "import.*state" in src/

# Find event emitters
grep: "eventBus.emit" in src/

# Find Supabase calls
grep: "import.*supabase-service" in src/
```

---

## Related Documentation

- `.claude/CODEBASE_MAP.md` - Quick navigation
- `.claude/ARCHITECTURE.md` - System design
- `.claude/COMMON_TASKS.md` - Task guide
- `.claude/DEPENDENCY_MAP.md` - Module relationships
