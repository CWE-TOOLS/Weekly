# Weekly Schedule App

A real-time collaborative task scheduling application for managing weekly project schedules with department-based organization, advanced printing, and multi-client synchronization.

[![Version](https://img.shields.io/badge/version-2.0-blue.svg)](https://github.com/yourusername/weekly)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Development Guide](#development-guide)
- [Architecture](#architecture)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Overview

The Weekly Schedule App is a production scheduling tool designed for managing complex multi-department project workflows. It displays tasks in a weekly grid format, supports real-time collaborative editing, and provides advanced print capabilities with auto-scaling for consistent single-page output.

### What Makes This App Unique?

- **No Build System**: Uses native ES6 modules directly in the browser (no Webpack, Vite, or Rollup)
- **Real-Time Sync**: Multi-client coordination via Supabase Realtime
- **Advanced Print System**: Auto-scaling technology ensures consistent single-page output
- **Performance Optimized**: 70-95% improvement in layout operations through batched DOM operations
- **Modular Architecture**: 60+ focused modules averaging ~200 lines each

### Use Cases

- **Production Scheduling**: Manage manufacturing schedules across multiple departments
- **Project Planning**: Track tasks across teams with department filtering
- **Revenue Tracking**: Automatic revenue calculations based on task hours
- **Print Reports**: Generate professional weekly/daily reports with auto-scaling

---

## Key Features

### Core Functionality

- **Weekly Task Grid**: Display tasks organized by date and department
- **Department Filtering**: Multi-select dropdown to filter by department(s)
- **Project Search**: Search for specific projects across all weeks
- **Week Navigation**: Navigate between weeks with previous/next buttons
- **Real-Time Editing**: Collaborative editing with multi-client synchronization

### Advanced Features

- **Inline Task Editing**: Edit task descriptions and hours directly in the schedule
- **Project Modal**: View all tasks for a specific project with day counters ("Day 2 of 5")
- **Drag & Drop**: Reorganize tasks by dragging between dates (when editing unlocked)
- **Context Menu**: Right-click tasks for quick actions
- **Add Task Modal**: Create new manual tasks with validation
- **Password Protection**: Lock/unlock editing mode with password

### Print System

- **Auto-Scaling**: Intelligent scaling ensures content fits on one page
- **Week/Day Print**: Print entire weeks or single days
- **Department Selection**: Choose which departments to include
- **Revenue Summary**: Automatic revenue calculations per department
- **Synthetic Departments**: Auto-generate Batch (with Cast) and Layout (with Demold)
- **Print Preview**: Preview before printing with viewport scaling

### Technical Features

- **Offline Detection**: Graceful degradation when offline
- **Performance Monitoring**: Track render times and layout performance
- **Structured Logging**: Production-ready logging system (auto-disabled in production)
- **Error Handling**: Global error handler with retry logic
- **Memory Management**: Proper cleanup to prevent memory leaks
- **Lazy Loading**: Modals and features loaded on-demand for optimal performance

---

## Technology Stack

### Frontend

- **JavaScript**: ES6+ (native modules, async/await, classes)
- **HTML5**: Semantic markup
- **CSS3**: Modular stylesheets (8 separate files)
- **No Framework**: Pure vanilla JavaScript

### Backend Services

- **Google Sheets API**: Read-only task data source
- **Supabase**: PostgreSQL database for manual tasks and real-time sync
  - Real-time subscriptions for multi-client coordination
  - Anonymous auth with RLS policies

### Browser APIs

- **ES6 Modules**: Native module loading (`import`/`export`)
- **Web Crypto API**: JWT signature generation for Google API
- **LocalStorage**: State persistence (week index, editing mode)
- **RequestIdleCallback**: Idle-time preloading
- **Print API**: Browser print with custom scaling

### No Dependencies

- ✅ No npm packages
- ✅ No build tools
- ✅ No frameworks
- ✅ Pure vanilla JavaScript

---

## Getting Started

### Prerequisites

- **Web Browser**: Modern browser with ES6 module support
  - Chrome 61+
  - Firefox 60+
  - Safari 11+
  - Edge 16+
- **Local Web Server**: Required for ES6 modules (browser security)
  - Options: Live Server, http-server, Python SimpleHTTPServer

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/weekly.git
cd weekly
```

2. **No dependencies to install!**

Since this app uses native ES6 modules and no build system, there's no `npm install` required.

### Configuration

#### 1. Google Sheets API Setup

Create a `src/config/api-config.js` file with your Google Sheets credentials:

```javascript
export const GOOGLE_SHEETS_CONFIG = {
    SHEET_ID: 'your-sheet-id-here',
    SERVICE_ACCOUNT: {
        CLIENT_EMAIL: 'your-service-account@project.iam.gserviceaccount.com',
        PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n'
    }
};

export const SHEET_NAMES = {
    MAIN: 'Schedule',
    STAGING: 'Staging'
};

export const SUPABASE_CONFIG = {
    URL: 'https://your-project.supabase.co',
    ANON_KEY: 'your-anon-key'
};
```

**Google Sheets Setup**:
1. Create a Google Cloud project
2. Enable Google Sheets API
3. Create a service account with Sheets access
4. Download the JSON credentials
5. Share your Google Sheet with the service account email
6. Copy the Sheet ID from the URL

**Supabase Setup**:
1. Create a Supabase project at https://supabase.com
2. Copy the project URL and anon key
3. Set up the database schema (see [Database Schema](#database-schema))

#### 2. Edit Password Configuration

Set the editing password in `src/core/state.js`:

```javascript
export const EDIT_PASSWORD = 'your-password-here';
```

### Running Locally

#### Option 1: VS Code Live Server

1. Install the "Live Server" extension in VS Code
2. Right-click `index.html` → "Open with Live Server"
3. App opens at `http://127.0.0.1:5500`

#### Option 2: Node.js http-server

```bash
npx http-server -p 8080 -o
```

App opens at `http://localhost:8080`

#### Option 3: Python SimpleHTTPServer

```bash
# Python 3
python -m http.server 8080

# Python 2
python -m SimpleHTTPServer 8080
```

Open `http://localhost:8080` in your browser

### Database Schema

Create these tables in Supabase:

```sql
-- Manual tasks table
CREATE TABLE manual_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project TEXT NOT NULL,
    description TEXT,
    department TEXT NOT NULL,
    date DATE NOT NULL,
    hours NUMERIC(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    deleted_at TIMESTAMP
);

-- Refresh signals table (for real-time sync)
CREATE TABLE refresh_signals (
    id BIGSERIAL PRIMARY KEY,
    action TEXT NOT NULL,
    task_id UUID,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE manual_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_signals ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read/write (adjust as needed)
CREATE POLICY "Allow anonymous access" ON manual_tasks
    FOR ALL USING (true);

CREATE POLICY "Allow anonymous access" ON refresh_signals
    FOR ALL USING (true);

-- Create indexes
CREATE INDEX idx_manual_tasks_date ON manual_tasks(date);
CREATE INDEX idx_manual_tasks_project ON manual_tasks(project);
CREATE INDEX idx_manual_tasks_department ON manual_tasks(department);
CREATE INDEX idx_refresh_signals_created ON refresh_signals(created_at DESC);
```

### First Run

1. Start your local web server
2. Open the app in your browser
3. The app will initialize with a 6-phase startup sequence
4. You'll see the current week's schedule (defaults to this week)
5. Use the department filter to show/hide departments
6. Click the unlock button (🔒) to enter edit mode (requires password)

---

## Development Guide

### Project Structure

```
weekly/
├── index.html              # Application entry point
├── src/
│   ├── main.js            # Bootstrap and initialization
│   ├── components/        # UI Components
│   │   ├── modals/        # Modal dialogs (lazy-loaded)
│   │   ├── schedule-grid.js
│   │   ├── department-filter.js
│   │   └── ...
│   ├── config/            # Configuration constants
│   ├── core/              # Application infrastructure
│   ├── features/          # Feature modules
│   │   ├── print/         # Print system (4 files)
│   │   ├── drag-drop/     # Drag-drop functionality
│   │   └── ...
│   ├── services/          # Data & external services
│   ├── styles/            # Modular CSS (8 files)
│   └── utils/             # Utility functions
├── ARCHITECTURE.md        # Architecture documentation
├── REFACTORING_STATUS.md  # Refactoring history
└── README.md              # This file
```

### Coding Conventions

#### JavaScript Style

- **ES6 Modules**: Use `import`/`export` (not CommonJS)
- **Async/Await**: Prefer async/await over promises chains
- **Named Exports**: Use named exports (not default exports)
- **JSDoc**: Document all public APIs with comprehensive JSDoc
- **Logger**: Use `logger.info/warn/error()` instead of `console.*`

```javascript
// Good
import { fetchAllTasks } from '../services/data-service.js';

export async function loadData() {
    logger.info('Loading data...');
    const tasks = await fetchAllTasks();
    return tasks;
}

// Bad
const dataService = require('../services/data-service.js'); // Don't use require
console.log('Loading...'); // Use logger instead
```

#### File Naming

- **Kebab-case**: `task-card-editor.js` (not camelCase or snake_case)
- **Descriptive**: Name reflects purpose (`grid-layout-manager.js`)
- **Suffixes**: Use `-service`, `-utils`, `-modal`, `-handler` for clarity

#### Module Size

- **Target**: 200-300 lines per file
- **Single Responsibility**: One clear purpose per module
- **Split Large Files**: If >500 lines, consider splitting

### Adding New Features

#### Step 1: Plan the Architecture

1. Determine where the feature belongs:
   - **Component**: UI rendering/presentation → `src/components/`
   - **Feature**: Self-contained functionality → `src/features/`
   - **Core**: Infrastructure/lifecycle → `src/core/`
   - **Service**: External API integration → `src/services/`
   - **Util**: Pure reusable function → `src/utils/`

2. Identify dependencies:
   - What state does it need? → Import from `state.js`
   - What events does it emit? → Use `event-bus.js`
   - What data does it need? → Import from services

#### Step 2: Create the Module

```javascript
// src/features/my-feature/my-feature.js

import { logger } from '../../utils/logger.js';
import * as state from '../../core/state.js';
import * as eventBus from '../../core/event-bus.js';

/**
 * Initialize the feature
 *
 * @returns {void}
 */
export function initialize() {
    logger.info('Initializing my feature...');
    setupEventListeners();
}

/**
 * Handle feature action
 *
 * @param {Object} data - Action data
 * @returns {Promise<void>}
 */
export async function handleAction(data) {
    // Implementation
    eventBus.emit('my-feature:action-complete', { data });
}

function setupEventListeners() {
    eventBus.on('tasks:loaded', () => {
        // React to tasks being loaded
    });
}
```

#### Step 3: Register in Initialization

Add to `src/core/initialization-orchestrator.js`:

```javascript
// Import your feature
import * as myFeature from '../features/my-feature/my-feature.js';

// Add to appropriate phase
async function phase4() {
    // ...
    myFeature.initialize();
    // ...
}
```

#### Step 4: Add Tests

While there's no formal test suite yet, manually test:

1. Feature initializes without errors
2. Feature responds to events correctly
3. Feature emits expected events
4. No memory leaks (check in DevTools Memory profiler)
5. No console errors
6. Works after week navigation
7. Works after modal open/close

### Debugging

#### Development Mode

Set log level in browser console:

```javascript
// Show all logs (debug, info, warn, error)
logger.setLevel('debug');

// Show only warnings and errors
logger.setLevel('warn');

// Disable all logs
logger.disable();
```

#### Useful Debug Helpers

Available in browser console:

```javascript
// Get app status
window.getAppStatus();
// Returns: { initialized: true, phase: 6, tasksLoaded: true, ... }

// Access state
window.state.getAllTasks();
window.state.getFilteredTasks();

// Access event bus
window.eventBus.emit('custom:event', { data: 'test' });
window.eventBus.on('custom:event', (data) => console.log(data));

// Print system debug
window.PrintRenderer.generatePrintContent('week', ['Cast', 'Demold'], dates, tasks);
```

#### Common Issues

**Issue**: Module import error "Unexpected token"
**Solution**: Ensure web server is running (ES6 modules require server, not `file://`)

**Issue**: CORS error when fetching from Google Sheets
**Solution**: Check service account credentials and Sheet sharing permissions

**Issue**: Tasks not loading
**Solution**: Check browser console for errors, verify API config

**Issue**: Editing not working
**Solution**: Unlock editing mode with password (click 🔒 button)

---

## Architecture

### High-Level Overview

The app follows an **event-driven architecture** with centralized state management:

```
User Action → UI Component → State Update → Event Emission →
Event Bus → Subscribers → Re-render → DOM Update
```

### Key Architectural Decisions

1. **No Build System**: Uses native ES6 modules (per project requirement)
2. **Event-Driven**: Pub/sub pattern via `event-bus.js` for decoupled communication
3. **Centralized State**: Single source of truth in `state.js`
4. **Lazy Loading**: Modals and features loaded on-demand (~30% code deferred)
5. **Hybrid Modules**: Mix of ES6 modules + selective window globals for compatibility

### 6-Phase Initialization

1. **Core Systems** (0-10%): Error handler, loading manager, offline manager
2. **State Restoration** (10-25%): Load from localStorage
3. **Services** (25-45%): Initialize Google Sheets + Supabase
4. **UI Components** (45-70%): Schedule grid, filters, navigation
5. **Data Loading** (70-90%): Fetch, merge, calculate, render
6. **Global Features** (90-100%): Listeners, shortcuts, idle preload

### Module Organization

- **Components**: Presentation and UI rendering (pure functions where possible)
- **Core**: Application infrastructure and lifecycle management
- **Services**: Data fetching and external API integration (orchestration layer)
- **Utils**: Pure functions with no side effects (reusable across modules)
- **Config**: Configuration constants (no logic, just data)
- **Features**: Self-contained functionality (modals, drag-drop, print)

### For More Details

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for comprehensive documentation including:
- Module dependency graph
- Event flow diagrams
- State management patterns
- Print system architecture
- Lazy loading strategy
- Performance optimizations

---

## Deployment

### Static Hosting

Since this is a pure client-side app with no build step, deployment is straightforward:

#### Option 1: GitHub Pages

1. Push code to GitHub repository
2. Go to Settings → Pages
3. Select branch (usually `main`) and root folder
4. Save and wait for deployment
5. App available at `https://username.github.io/weekly/`

#### Option 2: Netlify

1. Sign up at https://netlify.com
2. Connect your GitHub repository (or drag-and-drop folder)
3. Build settings:
   - **Build command**: (leave empty)
   - **Publish directory**: `.` (root)
4. Deploy
5. App available at `https://your-site.netlify.app`

#### Option 3: Vercel

1. Sign up at https://vercel.com
2. Import your GitHub repository
3. Configure project:
   - **Framework Preset**: Other
   - **Build Command**: (leave empty)
   - **Output Directory**: (leave empty)
4. Deploy
5. App available at `https://your-project.vercel.app`

#### Option 4: Cloudflare Pages

1. Sign up at https://pages.cloudflare.com
2. Connect GitHub repository
3. Build settings:
   - **Build command**: (none)
   - **Build output directory**: `/`
4. Deploy

### Environment Configuration

#### Production vs Development

The logger automatically detects production:

```javascript
// In logger.js
const isProduction = window.location.hostname !== 'localhost'
    && !window.location.hostname.startsWith('127.0.0.1');

if (isProduction) {
    logger.disable(); // Auto-disable logs in production
}
```

#### API Configuration

For security, store credentials as environment variables:

**Netlify/Vercel**:
1. Go to Site Settings → Environment Variables
2. Add `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, etc.
3. Use build-time substitution or runtime config fetch

**Alternative**: Use Supabase Edge Functions to proxy Google Sheets API (keeps credentials server-side)

### Production Considerations

#### Performance

- ✅ **HTTP/2**: Use hosting with HTTP/2 support (Netlify, Vercel, Cloudflare)
- ✅ **Caching**: Configure cache headers for static assets
- ✅ **Compression**: Enable gzip/brotli compression (most hosts do this automatically)

#### Security

- ✅ **HTTPS**: Ensure site is served over HTTPS (required for Web Crypto API)
- ✅ **Credentials**: Never commit `api-config.js` to version control (add to `.gitignore`)
- ✅ **Service Account**: Use minimal permissions (read-only for Sheets)
- ✅ **Supabase RLS**: Configure Row Level Security policies

#### Monitoring

- ✅ **Error Tracking**: Integrate Sentry or similar for production errors
- ✅ **Analytics**: Add Google Analytics or Plausible for usage tracking
- ✅ **Performance**: Use Lighthouse CI or WebPageTest for performance monitoring

### Update Process

Since there's no build step, updates are simple:

1. Make code changes
2. Test locally
3. Commit and push to GitHub
4. Hosting provider auto-deploys (or manually trigger deploy)

**Cache Busting**: Browsers may cache old JS files. Solutions:
- Add version query string: `<script src="main.js?v=2.0">`
- Configure cache headers on host
- Use service worker for cache management

---

## Contributing

### How to Contribute

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/my-feature`
3. **Make your changes**: Follow coding conventions
4. **Test thoroughly**: Ensure no regressions
5. **Document changes**: Update JSDoc and README if needed
6. **Commit**: Use clear, descriptive commit messages
7. **Push**: `git push origin feature/my-feature`
8. **Create Pull Request**: Describe changes and motivation

### Commit Message Format

Use conventional commits format:

```
type(scope): Brief description

Longer description if needed

Fixes #123
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring (no feature change)
- `perf`: Performance improvements
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples**:
```
feat(print): Add landscape mode for day print

fix(drag-drop): Prevent memory leak on week navigation

docs(readme): Add deployment instructions

refactor(schedule-grid): Extract week renderer to separate module
```

### Code Review Process

1. **Automated Checks**: Ensure no console errors, syntax valid
2. **Manual Review**: Maintainer reviews code for quality
3. **Testing**: Verify feature works as expected
4. **Approval**: At least one maintainer approval required
5. **Merge**: Squash and merge to main branch

### Git Workflow

- **Main branch**: Production-ready code
- **Feature branches**: `feature/feature-name`
- **Bug fixes**: `fix/bug-description`
- **Hotfixes**: `hotfix/critical-issue`

**Branch Protection**:
- Direct commits to `main` disabled
- Pull request required for all changes
- At least one approval required

---

## Troubleshooting

### Common Issues and Solutions

#### Module Import Errors

**Error**: `Uncaught SyntaxError: Cannot use import statement outside a module`

**Solution**: Ensure `<script type="module">` in HTML and running from a web server (not `file://`)

```html
<!-- Correct -->
<script type="module" src="src/main.js"></script>

<!-- Incorrect -->
<script src="src/main.js"></script>
```

---

#### CORS Errors

**Error**: `Access to fetch at 'https://sheets.googleapis.com/...' blocked by CORS`

**Solution**:
- Check service account credentials are correct
- Verify Google Sheet is shared with service account email
- Ensure Sheet API is enabled in Google Cloud Console

---

#### Tasks Not Loading

**Symptoms**: Blank schedule, "Loading..." never finishes

**Debug Steps**:
1. Open browser DevTools (F12)
2. Check Console for errors
3. Check Network tab for failed requests
4. Verify `api-config.js` has correct credentials
5. Check Supabase URL and anon key

**Common Causes**:
- Invalid Google Sheets credentials
- Sheet not shared with service account
- Supabase project URL/key incorrect
- Internet connection issues

---

#### Editing Not Working

**Symptoms**: Can't edit tasks, drag-drop not working

**Solution**: Unlock editing mode
1. Click the lock button (🔒) in top-right
2. Enter password (default: `cwe`)
3. Button changes to unlocked (🔓)
4. Editing features now enabled

**Security Note**: Change default password in `src/core/state.js`:
```javascript
export const EDIT_PASSWORD = 'your-secure-password';
```

---

#### Print Output Cut Off

**Symptoms**: Print content extends beyond page boundaries

**Solution**: The auto-scaling system should prevent this. If it still occurs:
1. Check browser print settings (margins, scale)
2. Try reducing number of departments printed
3. Check `src/config/layout-constants.js` for print scaling constants
4. Ensure latest version with Phase 8 print fixes

**Debug**:
```javascript
// In browser console
window.PrintRenderer.generatePrintContent('week', ['Cast'], dates, tasks);
```

---

#### Performance Issues

**Symptoms**: Slow rendering, UI lag

**Debug Steps**:
1. Open DevTools → Performance tab
2. Record performance while navigating
3. Look for long tasks (>50ms)

**Common Causes**:
- Too many tasks (>100 per week)
- Browser extensions interfering
- Outdated browser

**Solutions**:
- Use department filter to reduce visible tasks
- Disable browser extensions
- Update to latest browser version
- Check `grid-layout-manager.js` for layout optimization

---

#### Memory Leaks

**Symptoms**: Browser tab memory usage grows over time, eventual slowdown

**Debug Steps**:
1. Open DevTools → Memory tab
2. Take heap snapshot
3. Navigate between weeks multiple times
4. Take another snapshot
5. Compare snapshots (look for growing arrays/listeners)

**Known Issues** (fixed in Phase 4):
- Drag-drop event listeners accumulated → Fixed with cleanup function
- Week grid DOM not cleared → Fixed with proper cleanup

**If leak occurs**:
1. Report issue with reproduction steps
2. Temporary fix: Refresh page periodically

---

### Where to Find Logs

#### Browser Console

Open DevTools (F12) → Console tab

**Development Mode** (localhost):
- All logs visible (DEBUG, INFO, WARN, ERROR)
- Color-coded for easy scanning

**Production Mode**:
- Logs auto-disabled for performance
- Only critical errors shown

**Enable Debug Logging**:
```javascript
logger.setLevel('debug');
```

#### Network Requests

DevTools → Network tab
- Filter by Fetch/XHR to see API calls
- Check Status (200 = success, 4xx/5xx = error)
- Inspect request/response data

#### Supabase Logs

Supabase Dashboard → Logs:
- API logs (request/response)
- Realtime logs (subscription activity)
- Error logs

#### Performance Metrics

DevTools → Performance Monitor:
- CPU usage
- JS heap size (watch for memory leaks)
- DOM nodes (should stay relatively stable)

---

### Getting Help

**Check Documentation First**:
- [`ARCHITECTURE.md`](ARCHITECTURE.md) - System architecture
- [`REFACTORING_STATUS.md`](REFACTORING_STATUS.md) - Recent changes
- This README - Setup and troubleshooting

**Still Stuck?**:
1. Check browser console for errors
2. Search existing GitHub issues
3. Create new issue with:
   - Clear description of problem
   - Steps to reproduce
   - Browser/OS version
   - Console errors (if any)
   - Screenshots (if applicable)

**Community**:
- GitHub Discussions for questions
- Stack Overflow tag: `weekly-schedule-app`

---

## License

MIT License

Copyright (c) 2025

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## Acknowledgments

- **Phase 3-5 Refactoring**: Major code quality improvements including:
  - 1,597+ lines of duplicate code removed
  - 22 new focused modules created
  - 278 console statements replaced with structured logger
  - Critical memory leak fixed
  - 70-95% performance improvement in layout operations

- **Contributors**: Thank you to all contributors who helped build and improve this application

---

**Built with ❤️ using vanilla JavaScript and native ES6 modules**
