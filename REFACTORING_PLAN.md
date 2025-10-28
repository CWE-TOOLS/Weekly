# Weekly Schedule Viewer - Production-Ready Refactoring Plan

## Executive Summary

This document outlines a comprehensive, incremental refactoring plan to transform the Weekly Schedule Viewer from its current monolithic state into a production-ready, modular application following industry best practices.

**Current State:** ~5,300 lines of code in a single HTML file with inline JavaScript, CSS, and HTML.

**Target State:** Modular, maintainable, testable architecture with clear separation of concerns.

---

## Table of Contents

1. [Current Architecture Analysis](#current-architecture-analysis)
2. [Proposed File Structure](#proposed-file-structure)
3. [Refactoring Phases](#refactoring-phases)
4. [Implementation Order & Rationale](#implementation-order--rationale)
5. [Testing Strategy](#testing-strategy)
6. [Risk Mitigation](#risk-mitigation)

---

## Current Architecture Analysis

### Existing Files
```
├── index.html (5,281 lines) - MONOLITHIC
│   ├── Inline CSS (~800 lines)
│   ├── Inline JavaScript (~4,400 lines)
│   └── HTML structure
├── styles.css (289 lines) - Print-specific styles
├── print-layout.js (270 lines) - ✅ Already modular
├── print-renderer.js (304 lines) - ✅ Already modular
├── print-utils.js (211 lines) - ✅ Already modular
├── print-debug.js (304 lines) - ✅ Already modular
├── data-fetch utility.html (139 lines) - Utility file
└── Documentation files (AGENTS.md, etc.)
```

### Key Dependencies Identified
- **Google Sheets API** - Data source
- **Supabase** - Manual task storage & real-time sync
- **Service Account Authentication** - Google Sheets write access
- **Browser APIs** - Print, Fullscreen, Drag & Drop

### Core Functionality Modules
1. **Data Management** - Fetching, parsing, caching
2. **UI Rendering** - Schedule grid, task cards, modals
3. **Task Management** - CRUD operations, drag & drop
4. **Print System** - Already modularized ✅
5. **Authentication** - Password protection for editing
6. **Real-time Sync** - Supabase channels
7. **Search & Filter** - Department filtering, project search
8. **State Management** - Current week, selected departments, editing mode

---

## Proposed File Structure

```
weekly-schedule-viewer/
├── index.html                          # Minimal HTML shell
├── package.json                        # Dependencies & scripts
├── .gitignore                          # Git ignore patterns
├── README.md                           # Project documentation
│
├── src/                                # Source code
│   ├── main.js                         # Application entry point
│   │
│   ├── config/                         # Configuration
│   │   ├── constants.js                # App constants
│   │   ├── api-config.js               # API endpoints & keys
│   │   └── department-config.js        # Department definitions
│   │
│   ├── core/                           # Core application logic
│   │   ├── app.js                      # Main app controller
│   │   ├── state-manager.js            # Centralized state management
│   │   └── event-bus.js                # Event system for decoupling
│   │
│   ├── services/                       # Business logic & external services
│   │   ├── data/
│   │   │   ├── google-sheets-service.js    # Google Sheets API
│   │   │   ├── supabase-service.js         # Supabase integration
│   │   │   ├── task-service.js             # Task CRUD operations
│   │   │   └── cache-service.js            # Data caching
│   │   ├── auth/
│   │   │   ├── auth-service.js             # Authentication logic
│   │   │   └── service-account-auth.js     # Google service account
│   │   └── sync/
│   │       ├── refresh-service.js          # Real-time refresh
│   │       └── conflict-resolver.js        # Handle sync conflicts
│   │
│   ├── components/                     # UI Components
│   │   ├── schedule/
│   │   │   ├── schedule-grid.js            # Main schedule grid
│   │   │   ├── week-navigation.js          # Week selector
│   │   │   ├── task-card.js                # Individual task card
│   │   │   └── department-row.js           # Department row
│   │   ├── modals/
│   │   │   ├── project-modal.js            # Project detail view
│   │   │   ├── password-modal.js           # Password entry
│   │   │   ├── print-modal.js              # Print options
│   │   │   └── add-task-modal.js           # Add new task
│   │   ├── controls/
│   │   │   ├── search-bar.js               # Project search
│   │   │   ├── department-filter.js        # Department multi-select
│   │   │   └── action-buttons.js           # Refresh, print, etc.
│   │   └── shared/
│   │       ├── loading-spinner.js          # Loading indicator
│   │       ├── notification.js             # Toast notifications
│   │       └── context-menu.js             # Right-click menu
│   │
│   ├── features/                       # Feature modules
│   │   ├── drag-drop/
│   │   │   ├── drag-drop-manager.js        # Drag & drop logic
│   │   │   └── drop-zone.js                # Drop target handling
│   │   ├── editing/
│   │   │   ├── inline-editor.js            # Inline task editing
│   │   │   └── edit-mode-manager.js        # Edit mode state
│   │   ├── print/                          # Print system (existing)
│   │   │   ├── print-layout.js             # ✅ Already exists
│   │   │   ├── print-renderer.js           # ✅ Already exists
│   │   │   ├── print-utils.js              # ✅ Already exists
│   │   │   └── print-debug.js              # ✅ Already exists
│   │   └── search/
│   │       ├── search-engine.js            # Search logic
│   │       └── search-results.js           # Results display
│   │
│   ├── utils/                          # Utility functions
│   │   ├── date-utils.js                   # Date parsing & formatting
│   │   ├── dom-utils.js                    # DOM manipulation helpers
│   │   ├── validation-utils.js             # Input validation
│   │   ├── storage-utils.js                # LocalStorage wrapper
│   │   └── error-handler.js                # Error handling
│   │
│   └── styles/                         # Stylesheets
│       ├── main.css                        # Main styles
│       ├── variables.css                   # CSS custom properties
│       ├── components/                     # Component-specific styles
│       │   ├── schedule-grid.css
│       │   ├── task-card.css
│       │   ├── modals.css
│       │   └── controls.css
│       ├── print.css                       # Print styles (existing)
│       └── responsive.css                  # Media queries
│
├── tests/                              # Test files
│   ├── unit/                           # Unit tests
│   │   ├── services/
│   │   ├── utils/
│   │   └── components/
│   ├── integration/                    # Integration tests
│   └── e2e/                            # End-to-end tests
│
├── docs/                               # Documentation
│   ├── ARCHITECTURE.md                 # Architecture overview
│   ├── API.md                          # API documentation
│   ├── DEPLOYMENT.md                   # Deployment guide
│   └── CONTRIBUTING.md                 # Contribution guidelines
│
└── scripts/                            # Build & utility scripts
    ├── build.js                        # Build script
    └── dev-server.js                   # Development server
```

---

## Refactoring Phases

### Phase 1: Foundation & Configuration (Week 1)
**Goal:** Extract configuration and establish build system

**Tasks:**
1. Create project structure
2. Extract all constants to `config/` directory
3. Set up build system (Vite or Webpack)
4. Extract CSS to separate files
5. Create minimal `index.html` shell

**Deliverables:**
- Working build system
- Separated CSS files
- Configuration files
- Updated documentation

**Testing:** Verify app loads and displays correctly

---

### Phase 2: Utility Functions (Week 1-2)
**Goal:** Extract and test utility functions

**Tasks:**
1. Extract date utilities (`parseDate`, `getMonday`, etc.)
2. Extract DOM utilities
3. Extract validation utilities
4. Extract storage utilities
5. Create comprehensive unit tests

**Deliverables:**
- `utils/` directory with all utility modules
- Unit tests for all utilities
- JSDoc documentation

**Testing:** 100% unit test coverage for utilities

---

### Phase 3: Services Layer (Week 2-3)
**Goal:** Separate business logic from UI

**Tasks:**
1. Create `google-sheets-service.js`
   - Extract `fetchTasks()`, `parseSheetData()`
   - Extract authentication logic
2. Create `supabase-service.js`
   - Extract Supabase initialization
   - Extract task CRUD operations
3. Create `task-service.js`
   - Centralize task operations
   - Add caching layer
4. Create `auth-service.js`
   - Extract password authentication
   - Extract service account auth

**Deliverables:**
- Complete services layer
- Service integration tests
- API documentation

**Testing:** Integration tests for each service

---

### Phase 4: State Management (Week 3-4)
**Goal:** Centralize application state

**Tasks:**
1. Create `state-manager.js`
   - Current week state
   - Selected departments
   - Editing mode
   - Task data
2. Create `event-bus.js` for component communication
3. Refactor existing code to use state manager
4. Add state persistence (localStorage)

**Deliverables:**
- Centralized state management
- Event-driven architecture
- State persistence

**Testing:** State management unit tests

---

### Phase 5: UI Components - Core (Week 4-5)
**Goal:** Extract core UI components

**Tasks:**
1. Create `schedule-grid.js`
   - Extract grid rendering logic
   - Extract row equalization
2. Create `task-card.js`
   - Extract card rendering
   - Extract card interactions
3. Create `week-navigation.js`
   - Extract week navigation
4. Create `department-filter.js`
   - Extract filter logic

**Deliverables:**
- Core UI components
- Component documentation
- Component tests

**Testing:** Component integration tests

---

### Phase 6: UI Components - Modals (Week 5-6)
**Goal:** Extract modal components

**Tasks:**
1. Create `project-modal.js`
   - Extract project view logic
   - Extract edit mode
2. Create `password-modal.js`
3. Create `print-modal.js`
4. Create `add-task-modal.js`

**Deliverables:**
- All modal components
- Modal state management
- Modal tests

**Testing:** Modal interaction tests

---

### Phase 7: Feature Modules (Week 6-7)
**Goal:** Extract feature-specific logic

**Tasks:**
1. Create drag-drop module
   - Extract drag & drop logic
   - Add visual feedback
2. Create editing module
   - Extract inline editing
   - Extract edit mode management
3. Create search module
   - Extract search logic
   - Optimize search performance

**Deliverables:**
- Feature modules
- Feature documentation
- Feature tests

**Testing:** Feature integration tests

---

### Phase 8: Main Application Controller (Week 7-8)
**Goal:** Create clean application entry point

**Tasks:**
1. Create `app.js` controller
   - Initialize services
   - Initialize components
   - Set up event listeners
2. Create `main.js` entry point
3. Remove all inline JavaScript from HTML
4. Optimize initialization sequence

**Deliverables:**
- Clean application architecture
- Optimized initialization
- Complete separation of concerns

**Testing:** End-to-end tests

---

### Phase 9: Performance Optimization (Week 8-9)
**Goal:** Optimize for production

**Tasks:**
1. Implement code splitting
2. Add lazy loading for modals
3. Optimize rendering performance
4. Add service worker for offline support
5. Implement progressive enhancement

**Deliverables:**
- Optimized build
- Performance metrics
- Offline support

**Testing:** Performance benchmarks

---

### Phase 10: Documentation & Deployment (Week 9-10)
**Goal:** Production-ready deployment

**Tasks:**
1. Complete API documentation
2. Create deployment guide
3. Set up CI/CD pipeline
4. Create user documentation
5. Final security audit

**Deliverables:**
- Complete documentation
- Deployment pipeline
- Production build

**Testing:** Final QA testing

---

## Implementation Order & Rationale

### Why This Order?

1. **Foundation First (Phases 1-2)**
   - Establishes build system early
   - Utilities have no dependencies
   - Easy to test in isolation
   - Low risk of breaking existing functionality

2. **Services Before UI (Phase 3)**
   - Business logic is independent of UI
   - Easier to test without DOM
   - Can be developed in parallel with UI work
   - Reduces coupling

3. **State Management Early (Phase 4)**
   - Required by all components
   - Simplifies component development
   - Enables better testing
   - Reduces prop drilling

4. **Core UI Then Modals (Phases 5-6)**
   - Core components are used most frequently
   - Modals depend on core components
   - Allows incremental testing
   - Users see improvements faster

5. **Features Last (Phase 7)**
   - Features depend on core components
   - Can be developed independently
   - Lower risk if delayed
   - Easier to add/remove

6. **Optimization & Deployment (Phases 9-10)**
   - Requires complete codebase
   - Performance testing needs all features
   - Documentation needs stable API

---

## Testing Strategy

### Unit Tests
- **Target:** 80%+ code coverage
- **Tools:** Jest, Testing Library
- **Focus:** Utilities, services, pure functions

### Integration Tests
- **Target:** All service interactions
- **Tools:** Jest, MSW (Mock Service Worker)
- **Focus:** API calls, state management, component integration

### End-to-End Tests
- **Target:** Critical user flows
- **Tools:** Playwright or Cypress
- **Focus:** 
  - Load schedule
  - Filter departments
  - Edit tasks
  - Print reports
  - Drag & drop tasks

### User Acceptance Testing
- **Between each phase**
- **Verify no regression**
- **Test on multiple browsers**
- **Test on mobile devices**

---

## Risk Mitigation

### High-Risk Areas

1. **Data Fetching & Parsing**
   - **Risk:** Breaking existing data flow
   - **Mitigation:** 
     - Extensive integration tests
     - Parallel implementation with feature flags
     - Gradual rollout

2. **Print Functionality**
   - **Risk:** Print system already modular but tightly coupled
   - **Mitigation:**
     - Keep existing print modules
     - Only refactor integration points
     - Extensive print testing

3. **Real-time Sync**
   - **Risk:** Race conditions, data conflicts
   - **Mitigation:**
     - Implement conflict resolution
     - Add retry logic
     - Comprehensive error handling

4. **State Management**
   - **Risk:** State inconsistencies
   - **Mitigation:**
     - Immutable state updates
     - State validation
     - Time-travel debugging

### Rollback Strategy

- **Git branching:** Each phase in separate branch
- **Feature flags:** Toggle new features on/off
- **Backup:** Keep old `index.html` as `index.legacy.html`
- **Monitoring:** Add error tracking (Sentry)

---

## Success Metrics

### Code Quality
- ✅ No files over 300 lines
- ✅ 80%+ test coverage
- ✅ Zero ESLint errors
- ✅ All functions documented

### Performance
- ✅ Initial load < 2 seconds
- ✅ Time to interactive < 3 seconds
- ✅ Smooth 60fps scrolling
- ✅ Print generation < 1 second

### Maintainability
- ✅ Clear module boundaries
- ✅ Minimal coupling
- ✅ Comprehensive documentation
- ✅ Easy to onboard new developers

### User Experience
- ✅ No regression in functionality
- ✅ Improved performance
- ✅ Better error messages
- ✅ Offline support

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Set up project repository** with new structure
3. **Create Phase 1 branch** and begin implementation
4. **Schedule weekly check-ins** to track progress
5. **Document decisions** in ADR (Architecture Decision Records)

---

## Appendix A: Technology Stack

### Current
- Vanilla JavaScript (ES6+)
- Google Sheets API
- Supabase
- Browser APIs

### Proposed Additions
- **Build Tool:** Vite (fast, modern, simple)
- **Testing:** Jest + Testing Library + Playwright
- **Linting:** ESLint + Prettier
- **Documentation:** JSDoc + TypeDoc
- **CI/CD:** GitHub Actions
- **Monitoring:** Sentry (optional)

### Why Vite?
- Zero config for modern JavaScript
- Fast HMR (Hot Module Replacement)
- Built-in code splitting
- Optimized production builds
- Great developer experience

---

## Appendix B: File Size Comparison

### Before Refactoring
```
index.html: 5,281 lines (monolithic)
Total: ~5,900 lines
```

### After Refactoring (Estimated)
```
50+ files, each < 300 lines
Total: ~6,500 lines (includes tests & docs)
Average file size: ~130 lines
```

**Note:** Total lines increase due to:
- Proper separation of concerns
- Comprehensive tests
- Detailed documentation
- Better code organization

---

## Appendix C: Migration Checklist

### Pre-Migration
- [ ] Backup current codebase
- [ ] Document current functionality
- [ ] Set up version control
- [ ] Create test environment

### During Migration
- [ ] Follow phase order strictly
- [ ] Test after each phase
- [ ] Update documentation continuously
- [ ] Communicate progress weekly

### Post-Migration
- [ ] Final QA testing
- [ ] Performance benchmarking
- [ ] Security audit
- [ ] User training (if needed)
- [ ] Monitor for issues

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-28  
**Author:** Rooroo Developer  
**Status:** Ready for Review