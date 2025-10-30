# Codebase Navigation Map

Quick reference guide for navigating the Weekly Schedule Viewer codebase.

## Project Overview

**Type:** Progressive Web App for weekly task scheduling
**Architecture:** Modular ES6 JavaScript with native browser modules
**Status:** Phase 8 Complete - Production Ready
**Total Lines:** ~11,000+ JavaScript across 43 files

## Quick Start - Essential Files

### 1. Entry Points (Start Here)
- `index.html` - HTML shell, loads all modules
- `src/main.js` - Application entry point (43 lines)
- `src/core/app-controller.js` - Main initialization orchestrator (558 lines)

### 2. Core System Files
- `src/core/state.js` - Centralized state management (353 lines)
- `src/core/event-bus.js` - Event-driven communication (196 lines)
- `src/core/storage.js` - LocalStorage wrapper (370 lines)
- `src/core/error-handler.js` - Global error handling (313 lines)

### 3. Data Layer
- `src/services/data-service.js` - Data orchestration (141 lines)
- `src/services/sheets-service.js` - Google Sheets API (220 lines)
- `src/services/supabase-service.js` - Supabase CRUD + real-time (345 lines)
- `src/services/auth-service.js` - JWT & OAuth (140 lines)

### 4. Main UI Components
- `src/components/schedule-grid.js` - Main schedule renderer (501 lines)
- `src/components/task-card.js` - Task card rendering (153 lines)
- `src/components/modals/project-modal.js` - Project details (502 lines)

## Directory Structure

```
weekly/
├── index.html                          # Entry point HTML
├── manifest.json                       # PWA configuration
│
├── src/
│   ├── main.js                         # App initialization
│   │
│   ├── config/                         # Configuration files
│   │   ├── api-config.js               # API credentials & endpoints
│   │   ├── constants.js                # App-wide constants
│   │   └── department-config.js        # Department definitions & colors
│   │
│   ├── core/                           # Core application logic
│   │   ├── app-controller.js           # Main orchestrator (6-phase init)
│   │   ├── state.js                    # State management
│   │   ├── event-bus.js                # Pub/sub event system
│   │   ├── storage.js                  # LocalStorage wrapper
│   │   ├── error-handler.js            # Error handling
│   │   ├── loading-manager.js          # Loading states
│   │   ├── keyboard-shortcuts.js       # Keyboard shortcuts (10 commands)
│   │   └── global-listeners.js         # Global event listeners
│   │
│   ├── services/                       # Business logic layer
│   │   ├── auth-service.js             # Authentication
│   │   ├── sheets-service.js           # Google Sheets integration
│   │   ├── supabase-service.js         # Supabase database
│   │   └── data-service.js             # Data orchestration
│   │
│   ├── components/                     # UI Components
│   │   ├── schedule-grid.js            # Main schedule display
│   │   ├── task-card.js                # Task card rendering
│   │   ├── department-filter.js        # Multi-select department filter
│   │   ├── week-navigation.js          # Week navigation controls
│   │   ├── search-bar.js               # Project search
│   │   └── modals/                     # Modal dialogs
│   │       ├── password-modal.js       # Password authentication
│   │       ├── add-task-modal.js       # Create new tasks
│   │       ├── project-modal.js        # Project details
│   │       └── print-modal.js          # Print configuration
│   │
│   ├── features/                       # Feature modules
│   │   ├── print/                      # Print system (modular)
│   │   │   ├── print-layout.js         # Layout components
│   │   │   ├── print-renderer.js       # Page assembly
│   │   │   ├── print-utils.js          # Print utilities
│   │   │   └── print-debug.js          # Debug tools
│   │   ├── drag-drop/
│   │   │   └── drag-drop-manager.js    # Drag & drop functionality
│   │   ├── context-menu/
│   │   │   └── context-menu.js         # Right-click context menu
│   │   └── editing/
│   │       ├── add-card-indicators.js  # Empty cell UI indicators
│   │       └── delete-task-handler.js  # Task deletion
│   │
│   ├── utils/                          # Utility functions
│   │   ├── date-utils.js               # Date parsing & formatting
│   │   ├── ui-utils.js                 # DOM manipulation helpers
│   │   └── lazy-loader.js              # Lazy loading utilities
│   │
│   └── styles/                         # CSS modules
│       ├── variables.css               # CSS custom properties
│       ├── base.css                    # Base styles
│       ├── layout.css                  # Layout & grid system
│       ├── components.css              # Component styles
│       ├── responsive.css              # Media queries
│       └── print.css                   # Print-specific styles
│
└── Documentation/                      # Project documentation
    ├── REFACTORING_PLAN.md             # Complete architecture guide (1,147 lines)
    ├── AGENTS.md                       # Print system documentation
    ├── PHASE_*_BRIEFING.md             # Phase implementation guides
    └── card_creation_documentation.md  # Task card recreation guide
```

## Application Initialization Flow

```
1. index.html loads
   ↓
2. src/main.js executes
   ↓
3. src/core/app-controller.js runs 6-phase initialization:

   Phase 1: Error Handler Setup
   └── error-handler.js initializes

   Phase 2: State Restoration
   └── storage.js loads cached state
   └── state.js restores application state

   Phase 3: Services Initialization
   └── auth-service.js authenticates
   └── sheets-service.js connects to Google Sheets
   └── supabase-service.js connects to database

   Phase 4: UI Components
   └── schedule-grid.js renders
   └── week-navigation.js initializes
   └── department-filter.js loads
   └── search-bar.js activates

   Phase 5: Feature Modules
   └── drag-drop-manager.js enables
   └── context-menu.js attaches
   └── keyboard-shortcuts.js registers

   Phase 6: Data Loading
   └── data-service.js fetches data
   └── schedule-grid.js renders tasks
```

## Data Flow

```
Google Sheets API
       ↓
sheets-service.js  ← auth-service.js (JWT)
       ↓
data-service.js
       ↓
state.js (updates state)
       ↓
event-bus.js (emits 'data-loaded')
       ↓
schedule-grid.js (listens and re-renders)
```

```
User Action (drag task)
       ↓
drag-drop-manager.js
       ↓
supabase-service.js (saves to DB)
       ↓
state.js (updates local state)
       ↓
event-bus.js (emits 'task-moved')
       ↓
schedule-grid.js (re-renders cell)
```

## Common Navigation Patterns

### Finding Where Something Happens

**Find all event emissions:**
```bash
grep: "eventBus.emit"
```

**Find all state updates:**
```bash
grep: "state.set"
```

**Find where a component initializes:**
```bash
grep: "export function initialize" in src/components/
```

### Finding Dependencies

**See what a file imports:**
```bash
grep: "^import" in src/core/app-controller.js
```

**Find where something is used:**
```bash
grep: "import.*schedule-grid"
```

### Finding Components

**All UI components:**
```bash
glob: "src/components/**/*.js"
```

**All modals:**
```bash
glob: "src/components/modals/*.js"
```

**All services:**
```bash
glob: "src/services/**/*.js"
```

## Key Concepts

### 1. Event-Driven Architecture
- Components communicate via `event-bus.js`
- No direct coupling between components
- Subscribe: `eventBus.on('event-name', handler)`
- Emit: `eventBus.emit('event-name', data)`

### 2. Centralized State
- Single source of truth in `state.js`
- Get: `state.get('currentWeekOffset')`
- Set: `state.set('currentWeekOffset', 1)`
- State changes emit events automatically

### 3. Service Layer
- Business logic separated from UI
- Services are stateless
- UI components never call external APIs directly
- All data flows through services → state → components

### 4. Backward Compatibility
- Legacy code can still access `window.state`
- Gradual migration to modular architecture
- Old and new code coexist during transition

## Important Events

### Data Events
- `data-loaded` - Initial data fetch complete
- `data-refreshed` - Manual refresh triggered
- `task-added` - New task created
- `task-updated` - Task modified
- `task-deleted` - Task removed
- `task-moved` - Task dragged to new cell

### UI Events
- `week-changed` - User navigated to different week
- `department-filter-changed` - Department filter updated
- `search-changed` - Search query updated
- `modal-opened` - Modal dialog opened
- `modal-closed` - Modal dialog closed

### System Events
- `error` - Error occurred
- `loading-start` - Loading indicator shown
- `loading-end` - Loading indicator hidden
- `state-restored` - State loaded from localStorage

## Configuration Files

### API Configuration
**File:** `src/config/api-config.js`
- Google Sheets spreadsheet ID
- Supabase URL and anon key
- Service account credentials path

### Constants
**File:** `src/config/constants.js`
- Edit password
- Performance thresholds
- UI constants

### Department Configuration
**File:** `src/config/department-config.js`
- 11 department definitions
- Color schemes
- Display order

## Testing & Development

### Running Locally
```bash
npx http-server -p 8080 --cors -o
```

### Viewing Logs
- Check browser console for errors
- `error-handler.js` logs all errors
- Performance metrics in console

### Common Commands
```bash
# Start dev server
npx http-server -p 8080 --cors -o

# Check git status
git status

# View recent commits
git log --oneline -10
```

## Documentation Priority Order

When exploring the codebase, read in this order:

1. **This file** - Quick navigation overview
2. `Documentation/REFACTORING_PLAN.md` - Complete architecture guide
3. `Documentation/PHASE_8_BRIEFING.md` - Latest implementation details
4. `src/core/app-controller.js` - See initialization flow
5. `src/core/state.js` - Understand state management
6. `src/core/event-bus.js` - Learn event system

## Module Relationships

### Core Dependencies (Load First)
- `state.js` - Used by almost everything
- `event-bus.js` - Used by all components
- `error-handler.js` - Global error handling

### Service Dependencies
- `auth-service.js` - Independent
- `sheets-service.js` - Depends on auth-service
- `supabase-service.js` - Depends on auth-service
- `data-service.js` - Depends on sheets-service, supabase-service

### Component Dependencies
- Most components depend on: state.js, event-bus.js
- `schedule-grid.js` depends on: task-card.js
- Modals depend on: state.js, event-bus.js, ui-utils.js

## Quick File Finder

Need to modify something? Find it here:

| What to Change | File to Edit |
|----------------|--------------|
| API credentials | `src/config/api-config.js` |
| App constants | `src/config/constants.js` |
| Department colors | `src/config/department-config.js` |
| Initialization logic | `src/core/app-controller.js` |
| State structure | `src/core/state.js` |
| Event definitions | `src/core/event-bus.js` |
| Google Sheets integration | `src/services/sheets-service.js` |
| Database operations | `src/services/supabase-service.js` |
| Schedule display | `src/components/schedule-grid.js` |
| Task card appearance | `src/components/task-card.js` |
| Drag & drop behavior | `src/features/drag-drop/drag-drop-manager.js` |
| Print functionality | `src/features/print/*.js` |
| Date formatting | `src/utils/date-utils.js` |
| CSS variables | `src/styles/variables.css` |

## Troubleshooting

### "Module not found" errors
- Check import paths are correct
- Verify file exists in expected location
- Ensure export statement exists in source file

### State not updating
- Check if `state.set()` is called
- Verify event listeners are attached
- Look for typos in event names

### UI not rendering
- Check browser console for errors
- Verify data is loaded: `console.log(state.get('tasks'))`
- Check if component is initialized in `app-controller.js`

### Print issues
- See `Documentation/AGENTS.md` for detailed troubleshooting
- Check `src/features/print/print-debug.js` for debug tools

## Next Steps

After reading this map:
1. Read `Documentation/REFACTORING_PLAN.md` for complete architecture
2. Explore `src/core/app-controller.js` to see initialization
3. Read `.claude/ARCHITECTURE.md` for design patterns
4. Check `.claude/MODULE_INDEX.md` for detailed module descriptions
5. Use `.claude/COMMON_TASKS.md` for task-based navigation
