# Weekly Schedule App - Codebase Structure

## Directory Organization

```
weekly/
├── index.html                 # Application entry point
│
├── src/
│   ├── main.js               # Bootstrap and initialization
│   │
│   ├── components/           # UI Components (presentation layer)
│   │   ├── modals/           # Modal dialogs (lazy-loaded)
│   │   │   ├── add-task-modal.js
│   │   │   ├── password-modal.js
│   │   │   ├── print-modal.js
│   │   │   ├── print-config-manager.js
│   │   │   ├── print-preview-renderer.js
│   │   │   ├── project-modal.js
│   │   │   ├── project-modal-fields.js
│   │   │   └── project-modal-validation.js
│   │   ├── department-filter.js
│   │   ├── schedule-grid.js     # Grid coordinator
│   │   ├── search-bar.js
│   │   ├── task-card.js
│   │   ├── week-navigation.js
│   │   └── week-renderer.js      # Pure rendering logic
│   │
│   ├── config/               # Configuration constants
│   │   ├── api-config.js         # API endpoints, credentials
│   │   ├── business-constants.js # Revenue rates, business rules
│   │   ├── constants.js          # General constants
│   │   ├── department-config.js  # Department colors, order
│   │   ├── layout-constants.js   # Z-index, spacing, dimensions
│   │   ├── timing-constants.js   # Delays, durations, debounce
│   │   └── visual-constants.js   # Opacity, animations
│   │
│   ├── core/                 # Application infrastructure
│   │   ├── app-controller.js            # Master orchestrator
│   │   ├── button-handlers.js           # UI event bindings
│   │   ├── component-events.js          # Event bus subscriptions
│   │   ├── error-handler.js             # Global error handling
│   │   ├── event-bus.js                 # Pub/sub communication
│   │   ├── global-listeners.js          # Window events
│   │   ├── initialization-orchestrator.js # 6-phase startup
│   │   ├── keyboard-shortcuts.js        # Keyboard commands
│   │   ├── loading-manager.js           # Loading overlays
│   │   ├── modal-loader.js              # Lazy modal loading
│   │   ├── offline-manager.js           # Offline detection
│   │   ├── performance-monitor.js       # Performance metrics
│   │   ├── state.js                     # Centralized state
│   │   ├── storage.js                   # LocalStorage wrapper
│   │   └── task-card-editor.js          # Inline editing
│   │
│   ├── features/             # Feature modules (self-contained)
│   │   ├── context-menu/     # Right-click menus (lazy-loaded)
│   │   ├── drag-drop/        # Drag-drop functionality (lazy-loaded)
│   │   ├── editing/          # Add/delete task handlers
│   │   ├── print/            # Print system (4 modules)
│   │   │   ├── print-debug.js
│   │   │   ├── print-layout.js      # Layout components
│   │   │   ├── print-renderer.js    # Page assembly
│   │   │   └── print-utils.js       # Utilities
│   │   └── schedule/         # Schedule rendering utilities
│   │
│   ├── services/             # Data & external services
│   │   ├── auth-service.js       # JWT generation for Google
│   │   ├── data-service.js       # Data orchestration
│   │   ├── sheets-service.js     # Google Sheets API
│   │   └── supabase-service.js   # Supabase API
│   │
│   ├── styles/               # Modular CSS
│   │   ├── base.css, layout.css, variables.css
│   │   ├── buttons.css, modals.css, notifications.css
│   │   ├── schedule-grid.css, task-card.css
│   │   ├── department-filter.css, context-menu.css
│   │   ├── misc-components.css
│   │   └── print.css, responsive.css
│   │
│   └── utils/                # Utility functions (pure)
│       ├── date-utils.js              # Date parsing, Monday calc
│       ├── grid-layout-manager.js     # Height equalization
│       ├── lazy-loader.js             # Dynamic imports
│       ├── logger.js                  # Structured logging
│       ├── project-modal-validation.js # Form validation
│       ├── schedule-utils.js          # Schedule helpers
│       ├── security-utils.js          # HTML escaping
│       └── ui-utils.js                # DOM utilities
```

## Module Organization Philosophy

### Components (src/components/)
- UI rendering and presentation
- **Coordinator Pattern**: `schedule-grid.js` orchestrates, delegates to `week-renderer.js`
- **Pure Functions**: Rendering logic separated from state management

### Core (src/core/)
- Application infrastructure and lifecycle
- **Single Responsibility**: Each module has one clear purpose
- **Event-Driven**: Communication via event bus, not direct calls

### Services (src/services/)
- Data fetching and external API integration
- **Orchestration Layer**: `data-service.js` coordinates multiple sources
- **Graceful Degradation**: Continues if one service fails

### Utils (src/utils/)
- Pure functions with no side effects
- **Reusable**: Can be used across any module
- **Stateless**: No internal state or dependencies on app state

### Config (src/config/)
- Configuration constants
- **No Magic Numbers**: All constants named and documented
- **Single Source of Truth**: Easy to tune without code search

## Core Module Dependencies

### state.js (24 imports across codebase)
- **Dependencies**: event-bus.js (emits state change events)
- **Dependents**: Almost all modules (centralized state)
- **Pattern**: Single source of truth for application state

### event-bus.js (22 imports across codebase)
- **Dependencies**: logger.js only
- **Dependents**: All components for communication
- **Pattern**: Pub/sub for decoupled communication

### No Circular Dependencies
All imports are unidirectional:
- Core → Services → Utils
- Components → Core → Services
- Features → Core/Components
