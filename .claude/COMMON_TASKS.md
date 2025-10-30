# Common Tasks Guide

Task-based navigation guide for common development scenarios. Find what files to modify for common tasks.

## Table of Contents

1. [Adding New Features](#adding-new-features)
2. [Fixing Bugs](#fixing-bugs)
3. [Modifying UI](#modifying-ui)
4. [Working with Data](#working-with-data)
5. [Configuration Changes](#configuration-changes)
6. [Performance Optimization](#performance-optimization)
7. [Testing](#testing)
8. [Deployment](#deployment)

---

## Adding New Features

### Add a New Modal Dialog

**Files to modify:**
1. Create `src/components/modals/my-modal.js`
2. Register in `src/core/app-controller.js` (Phase 4)
3. Add styles to `src/styles/components.css`
4. Emit open event from trigger component

**Template:**
```javascript
// src/components/modals/my-modal.js
import { eventBus } from '../../core/event-bus.js';
import { state } from '../../core/state.js';

export function openMyModal(data) {
  const modal = document.getElementById('my-modal');
  // ... setup modal
  modal.style.display = 'block';
  eventBus.emit('modal-opened', { name: 'my-modal' });
}

export function closeMyModal() {
  const modal = document.getElementById('my-modal');
  modal.style.display = 'none';
  eventBus.emit('modal-closed', { name: 'my-modal' });
}

export function initializeMyModal() {
  // Create modal HTML
  // Attach event listeners
}
```

**Register in app-controller.js:**
```javascript
// In initializeComponents() function
import { initializeMyModal } from '../components/modals/my-modal.js';

async function initializeComponents() {
  // ... existing components
  initializeMyModal();
}
```

---

### Add a New UI Component

**Files to modify:**
1. Create `src/components/my-component.js`
2. Register in `src/core/app-controller.js` (Phase 4)
3. Add HTML structure in `index.html` (if needed)
4. Add styles to `src/styles/components.css`

**Steps:**
1. Create component file with `initialize*()` export
2. Subscribe to relevant events via `eventBus.on()`
3. Update state via `state.set()` when user interacts
4. Emit events via `eventBus.emit()` to notify other components
5. Register in app-controller Phase 4

**Example:**
```javascript
// src/components/my-component.js
import { eventBus } from '../core/event-bus.js';
import { state } from '../core/state.js';

export function initializeMyComponent() {
  const container = document.getElementById('my-component');

  // Listen for events
  eventBus.on('data-loaded', handleDataLoaded);

  // Attach DOM listeners
  container.addEventListener('click', handleClick);
}

function handleDataLoaded(data) {
  // Update component
}

function handleClick(e) {
  // Update state
  state.set('myComponentValue', e.target.value);

  // Emit event
  eventBus.emit('my-component-changed', e.target.value);
}
```

---

### Add a New Feature Module

**Files to modify:**
1. Create `src/features/my-feature/my-feature.js`
2. Register in `src/core/app-controller.js` (Phase 5)
3. Add any required UI components
4. Update state structure if needed

**Steps:**
1. Create feature directory: `src/features/my-feature/`
2. Create main file with `initializeMyFeature()` export
3. Break into sub-modules if complex
4. Register in app-controller Phase 5
5. Document in `REFACTORING_PLAN.md`

**Example:**
```javascript
// src/features/my-feature/my-feature.js
import { eventBus } from '../../core/event-bus.js';
import { state } from '../../core/state.js';

export function initializeMyFeature() {
  // Feature initialization
  attachEventListeners();
  setupFeatureState();
}

function attachEventListeners() {
  eventBus.on('trigger-event', handleTrigger);
}

function setupFeatureState() {
  state.set('myFeatureEnabled', true);
}

function handleTrigger(data) {
  // Feature logic
  eventBus.emit('my-feature-activated', result);
}
```

---

### Add a New Keyboard Shortcut

**Files to modify:**
1. `src/core/keyboard-shortcuts.js`

**Steps:**
1. Add shortcut definition in `SHORTCUTS` object
2. Add handler function
3. Register in `initializeKeyboardShortcuts()`

**Example:**
```javascript
// src/core/keyboard-shortcuts.js

const SHORTCUTS = {
  // ... existing shortcuts
  'Ctrl+N': 'new-task',
};

function handleNewTask() {
  eventBus.emit('open-add-task-modal');
}

export function initializeKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault();
      handleNewTask();
    }
  });
}
```

---

### Add Real-Time Sync for New Data Type

**Files to modify:**
1. `src/services/supabase-service.js` - Add subscription
2. `src/services/data-service.js` - Add merge logic
3. `src/core/state.js` - Add state property

**Steps:**
1. Create Supabase table
2. Add CRUD functions in `supabase-service.js`
3. Add subscription handler
4. Merge with existing data in `data-service.js`
5. Update state structure
6. Emit events on changes

**Example:**
```javascript
// In supabase-service.js

export async function getComments() {
  const { data, error } = await supabase
    .from('comments')
    .select('*');
  return data;
}

export function subscribeToComments(handler) {
  supabase
    .channel('comments')
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'comments' },
        handler)
    .subscribe();
}

// In data-service.js

export async function fetchAllData() {
  const [tasks, departments, comments] = await Promise.all([
    sheetsService.fetchTasks(),
    sheetsService.fetchDepartments(),
    supabaseService.getComments()
  ]);

  state.set('comments', comments);
}
```

---

## Fixing Bugs

### Debug Initialization Errors

**Check these files in order:**
1. Browser console - Check for JavaScript errors
2. `src/core/error-handler.js` - Check error logs
3. `src/core/app-controller.js` - Check initialization phases
4. `src/main.js` - Verify entry point

**Common issues:**
- Missing imports: Check file paths
- Circular dependencies: Check import order
- DOM not ready: Ensure DOMContentLoaded
- API errors: Check network tab

**Debugging approach:**
```javascript
// Add console logs to track initialization
console.log('[Phase 1] Error handler initialized');
console.log('[Phase 2] State restored:', state.get('tasks'));
console.log('[Phase 3] Services initialized');
```

---

### Fix Data Loading Issues

**Check these files:**
1. `src/services/data-service.js` - Data orchestration
2. `src/services/sheets-service.js` - Google Sheets API
3. `src/services/supabase-service.js` - Supabase API
4. `src/services/auth-service.js` - Authentication

**Common issues:**
- Auth failure: Check API keys in `api-config.js`
- Network error: Check browser network tab
- Data format error: Check API response structure
- CORS error: Check API permissions

**Debug data flow:**
```javascript
// In data-service.js
export async function fetchAllData() {
  console.log('[Data] Starting fetch...');

  const sheetsData = await sheetsService.fetchTasks();
  console.log('[Data] Sheets data:', sheetsData);

  const supabaseData = await supabaseService.getTasks();
  console.log('[Data] Supabase data:', supabaseData);

  const merged = mergeTaskSources(sheetsData, supabaseData);
  console.log('[Data] Merged:', merged);

  return merged;
}
```

---

### Fix Rendering Issues

**Check these files:**
1. `src/components/schedule-grid.js` - Main grid rendering
2. `src/components/task-card.js` - Card rendering
3. `src/core/state.js` - Check state values
4. Browser DevTools - Inspect DOM

**Common issues:**
- Empty grid: Check if data is loaded (`state.get('tasks')`)
- Missing cards: Check filtering logic
- Wrong styles: Check CSS class names
- Layout issues: Check CSS grid/flexbox

**Debug rendering:**
```javascript
// In schedule-grid.js
export function renderSchedule() {
  const tasks = state.get('tasks');
  console.log('[Render] Tasks:', tasks);

  const selectedDepts = state.get('selectedDepartments');
  console.log('[Render] Selected departments:', selectedDepts);

  const filtered = filterTasks(tasks);
  console.log('[Render] Filtered tasks:', filtered);

  // ... render logic
}
```

---

### Fix Event Handling Issues

**Check these files:**
1. `src/core/event-bus.js` - Event system
2. Emitting component - Check `eventBus.emit()` calls
3. Listening component - Check `eventBus.on()` calls

**Common issues:**
- Event not firing: Check event name spelling
- Handler not called: Check if listener is attached
- Wrong data: Check event payload
- Multiple handlers: Check if `off()` is called

**Debug events:**
```javascript
// In event-bus.js - Add logging
export const eventBus = {
  emit(event, data) {
    console.log('[Event] Emitting:', event, data);
    // ... existing code
  },

  on(event, handler) {
    console.log('[Event] Listening:', event);
    // ... existing code
  }
};
```

---

### Fix Drag & Drop Issues

**Check these files:**
1. `src/features/drag-drop/drag-drop-manager.js`
2. `src/components/task-card.js` - Draggable attribute
3. `src/components/schedule-grid.js` - Drop zones

**Common issues:**
- Cards not draggable: Check `draggable="true"` attribute
- Drop not working: Check drop zone event listeners
- Wrong cell: Check drop target calculation
- Not saving: Check `supabase-service.updateTask()` call

---

## Modifying UI

### Change Department Colors

**Files to modify:**
1. `src/config/department-config.js` - Update color values
2. `src/styles/variables.css` - Update CSS custom properties (optional)

**Example:**
```javascript
// src/config/department-config.js
export const DEPARTMENTS = [
  { id: 'graphic-design', name: 'Graphic Design', color: '#FF5733' },
  // ... update colors
];
```

---

### Change Page Layout

**Files to modify:**
1. `index.html` - HTML structure
2. `src/styles/layout.css` - Layout styles
3. `src/components/schedule-grid.js` - Grid rendering logic

**Common changes:**
- Add sidebar: Update HTML + layout.css
- Change grid columns: Update schedule-grid.js rendering
- Reorder sections: Update HTML structure

---

### Update Task Card Appearance

**Files to modify:**
1. `src/components/task-card.js` - Card HTML structure
2. `src/styles/components.css` - Card styles (`.task-card`)

**Example:**
```javascript
// src/components/task-card.js
export function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card';

  // Add new elements
  const badge = document.createElement('span');
  badge.className = 'task-badge';
  badge.textContent = task.status;
  card.appendChild(badge);

  return card;
}
```

```css
/* src/styles/components.css */
.task-card {
  /* Update existing styles */
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.task-badge {
  /* New badge styles */
  background: #007bff;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
}
```

---

### Change Week Display Format

**Files to modify:**
1. `src/utils/date-utils.js` - Date formatting functions
2. `src/components/week-navigation.js` - Display update

**Example:**
```javascript
// src/utils/date-utils.js
export function formatWeekRange(startDate, endDate) {
  // Change from "Jan 1 - Jan 7" to "Week of January 1, 2024"
  return `Week of ${formatDate(startDate, 'MMMM D, YYYY')}`;
}
```

---

### Add Custom Print Styles

**Files to modify:**
1. `src/styles/print.css` - Print-specific styles
2. `src/features/print/print-layout.js` - Print HTML structure
3. `src/features/print/print-renderer.js` - Rendering logic

---

### Troubleshoot Print System

The print system is modular with three specialized modules. Common issues and solutions:

#### Issue: Blank Pages Appearing After Last Department

**Root Cause:** Page break styles being applied to last page

**Files to check:**
1. `src/features/print/print-renderer.js` - `applyPageBreakRules()` function

**Solution:**
```javascript
// In applyPageBreakRules()
if (index < pages.length - 1) {
  // Add page break between departments
  page.style.pageBreakAfter = 'always';
  page.style.breakAfter = 'page';
} else {
  // CRITICAL: Last page must prevent page break
  page.style.pageBreakAfter = 'avoid';
  page.style.breakAfter = 'avoid';
}
```

**Verify:**
- Check that `applyPageBreakRules()` is being called
- Ensure no margins/padding on last page
- Verify `index < pages.length - 1` condition is correct

---

#### Issue: Content Overflowing Pages

**Files to check:**
1. `src/features/print/print-renderer.js` - `applyPrintScaling()` function
2. `src/features/print/print-utils.js` - `getMaxTasksForDept()` calculation

**Debug:**
```javascript
// In applyPrintScaling()
console.log('Content height:', contentHeight);
console.log('Page max height:', pageMaxHeightPx);
console.log('Scale factor:', scaleFactor);
```

**Solution:**
- Adjust `pageMaxHeightPx` calculation
- Modify scaling factor (currently 0.95)
- Reduce font sizes in print CSS

---

#### Issue: Page Breaks in Wrong Places

**Files to check:**
1. `src/features/print/print-renderer.js` - Page break CSS
2. `src/styles/print.css` - Global print styles

**Common causes:**
- Conflicting CSS from other sources
- Table rows not using `page-break-inside: avoid`
- Missing `break-inside: avoid` for modern browsers

**Solution:**
```javascript
// Ensure these styles in executePrint()
.print-page {
  page-break-inside: avoid !important;
  break-inside: avoid !important;
}

table tr {
  page-break-inside: avoid !important;
  break-inside: avoid !important;
}
```

---

#### Issue: Department Colors Not Showing

**Files to check:**
1. `src/features/print/print-utils.js` - `getDepartmentColorMapping()`
2. `src/features/print/print-layout.js` - `createDepartmentHeader()`

**Solution:**
```javascript
// Verify color mapping
const colors = getDepartmentColorMapping();
console.log('Colors for Mill:', colors['mill']);

// Check header creation
const header = createDepartmentHeader('Mill', 'week', colors['mill']);
console.log('Header background:', header.style.backgroundColor);
```

---

#### Issue: Print Modules Not Loading

**Files to check:**
1. `index.html` - Check script loading order

**Required order:**
```html
<script src="src/features/print/print-layout.js"></script>
<script src="src/features/print/print-renderer.js"></script>
<script src="src/features/print/print-utils.js"></script>
```

**Verify:**
```javascript
// Check in browser console
console.log(window.PrintLayout);   // Should exist
console.log(window.PrintRenderer); // Should exist
console.log(window.PrintUtils);    // Should exist
```

---

### Test Print System

**Single Department Test:**
1. Open application
2. Click print button
3. Select ONE department (e.g., "Mill")
4. Choose "Print Week" or "Print Day"
5. Click "Print Selected"
6. **Verify:** Only one page, no blank pages

**Multiple Departments Test:**
1. Select 2-3 departments
2. Print report (weekly or daily)
3. **Verify:** Each department on own page
4. **Verify:** Page breaks between departments
5. **Verify:** No blank page after last department

**Weekly vs Daily Test:**
1. Test with "Weekly Print" mode
   - **Verify:** Landscape orientation
   - **Verify:** 7-day columns
2. Test with "Daily Print" mode
   - **Verify:** Portrait orientation
   - **Verify:** Single day focus

---

### Modify Print System

#### Change Department Colors

**Files to modify:**
1. `src/features/print/print-utils.js` - `getDepartmentColorMapping()`

**Example:**
```javascript
function getDepartmentColorMapping() {
  return {
    'mill': { bg: '#NEW_COLOR', text: '#FFFFFF' },
    // ... update other departments
  };
}
```

---

#### Add New Component to Print Layout

**Files to modify:**
1. `src/features/print/print-layout.js` - Add creator function
2. `src/features/print/print-renderer.js` - Use in page assembly

**Steps:**
```javascript
// 1. Add to print-layout.js
function createMyNewComponent(data) {
  const component = document.createElement('div');
  component.className = 'my-new-component';
  // ... build component
  return component;
}

// Export via window.PrintLayout
window.PrintLayout = {
  // ... existing exports
  createMyNewComponent
};

// 2. Use in print-renderer.js createDepartmentPage()
const myComponent = window.PrintLayout.createMyNewComponent(data);
pageDiv.appendChild(myComponent);
```

---

#### Modify Page Break Behavior

**Files to modify:**
1. `src/features/print/print-renderer.js` - `applyPageBreakRules()`

**Warning:** Be very careful modifying this function - it prevents blank pages!

**Example - Force 2 departments per page:**
```javascript
function applyPageBreakRules(pages) {
  pages.forEach((page, index) => {
    // ... existing setup

    // Add page break every 2 departments
    if ((index + 1) % 2 === 0 && index < pages.length - 1) {
      page.style.pageBreakAfter = 'always';
    } else if (index === pages.length - 1) {
      page.style.pageBreakAfter = 'avoid';  // Still prevent on last
    }
  });
}
```

**Always test:**
- Single department
- Multiple departments (odd and even counts)
- Check for blank pages

---

## Working with Data

### Add New Task Field

**Files to modify:**
1. Google Sheets - Add column
2. `src/services/sheets-service.js` - Parse new column
3. Supabase - Add column to table
4. `src/services/supabase-service.js` - Include in queries
5. `src/components/task-card.js` - Display new field
6. `src/components/modals/project-modal.js` - Edit new field

**Steps:**
1. Add column to Google Sheets
2. Update `sheets-service.js` parsing:
```javascript
function parseTaskRow(row) {
  return {
    // ... existing fields
    newField: row[10], // New column index
  };
}
```
3. Add column to Supabase table
4. Update task card display
5. Update modals to edit new field

---

### Change Data Source (from Sheets to API)

**Files to modify:**
1. Create new service: `src/services/my-api-service.js`
2. `src/services/data-service.js` - Replace sheets service
3. `src/config/api-config.js` - Add new API config

**Steps:**
1. Create new service file with same interface
2. Replace import in data-service.js
3. Update API_CONFIG with new credentials
4. Test data format compatibility

---

### Add Data Caching

**Files to modify:**
1. `src/core/storage.js` - Add cache methods
2. `src/services/data-service.js` - Implement cache logic

**Example:**
```javascript
// src/services/data-service.js
export async function fetchAllData() {
  // Check cache first
  const cached = storage.get('tasks_cache');
  const cacheTime = storage.get('tasks_cache_time');

  if (cached && Date.now() - cacheTime < 5 * 60 * 1000) {
    // Cache valid for 5 minutes
    console.log('[Data] Using cached data');
    return cached;
  }

  // Fetch fresh data
  const data = await fetchFromAPIs();

  // Update cache
  storage.save('tasks_cache', data);
  storage.save('tasks_cache_time', Date.now());

  return data;
}
```

---

### Add Data Validation

**Files to modify:**
1. `src/services/supabase-service.js` - Validate before save
2. `src/components/modals/add-task-modal.js` - Client-side validation

**Example:**
```javascript
// Validation helper
function validateTask(task) {
  const errors = [];

  if (!task.project) errors.push('Project name required');
  if (!task.task) errors.push('Task description required');
  if (!task.department) errors.push('Department required');

  return errors;
}

// In supabase-service.js
export async function addTask(task) {
  const errors = validateTask(task);
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }

  // ... save to database
}
```

---

## Configuration Changes

### Update API Credentials

**Files to modify:**
1. `src/config/api-config.js`

**IMPORTANT:** Never commit credentials to git!

**Example:**
```javascript
// src/config/api-config.js
export const API_CONFIG = {
  googleSheets: {
    spreadsheetId: 'your-new-spreadsheet-id',
    serviceAccountKeyPath: '/path/to/new-key.json'
  },
  supabase: {
    url: 'https://your-project.supabase.co',
    anonKey: 'your-new-anon-key'
  }
};
```

---

### Change Edit Password

**Files to modify:**
1. `src/config/constants.js`

**Example:**
```javascript
// src/config/constants.js
export const EDIT_PASSWORD = 'new-password-here';
```

---

### Add New Department

**Files to modify:**
1. `src/config/department-config.js` - Add department
2. Google Sheets - Add to department list
3. Supabase - Add to enum if using enums

**Example:**
```javascript
// src/config/department-config.js
export const DEPARTMENTS = [
  // ... existing departments
  { id: 'new-dept', name: 'New Department', color: '#FF6B6B' }
];

export const DEPARTMENT_ORDER = [
  // ... existing order
  'new-dept'
];
```

---

### Change Performance Thresholds

**Files to modify:**
1. `src/config/constants.js`
2. `src/core/performance-monitor.js` - Update monitoring logic

---

## Performance Optimization

### Implement Lazy Loading for Modals

**Files to modify:**
1. `src/utils/lazy-loader.js` - Create lazy loader
2. `src/core/app-controller.js` - Remove eager modal imports
3. Individual modal openers - Use dynamic import

**Example:**
```javascript
// src/utils/lazy-loader.js
export async function loadModal(modalName) {
  const module = await import(`../components/modals/${modalName}.js`);
  return module;
}

// In component that opens modal
async function openProjectModal(taskId) {
  showLoading('Loading...');
  const modal = await loadModal('project-modal');
  hideLoading();
  modal.openProjectModal(taskId);
}
```

---

### Add Debouncing to Search

**Files to modify:**
1. `src/components/search-bar.js`

**Example:**
```javascript
// src/components/search-bar.js
import { debounce } from '../utils/ui-utils.js';

export function initializeSearchBar() {
  const searchInput = document.getElementById('search-input');

  // Debounce search to reduce re-renders
  const debouncedSearch = debounce((query) => {
    state.set('searchQuery', query);
    eventBus.emit('search-changed', query);
  }, 300); // Wait 300ms after typing stops

  searchInput.addEventListener('input', (e) => {
    debouncedSearch(e.target.value);
  });
}
```

---

### Optimize Schedule Grid Rendering

**Files to modify:**
1. `src/components/schedule-grid.js`

**Optimizations:**
- Only re-render changed cells
- Use document fragments for batch updates
- Memoize filtered tasks

**Example:**
```javascript
// Only update specific cell instead of entire grid
export function updateCell(day, department) {
  const cell = document.querySelector(`[data-day="${day}"][data-dept="${department}"]`);
  const tasks = getTasksForCell(day, department);

  // Clear and re-render only this cell
  cell.innerHTML = '';
  tasks.forEach(task => {
    cell.appendChild(createTaskCard(task));
  });
}
```

---

### Add Service Worker for Offline Support

**Files to create:**
1. `service-worker.js` in root
2. `src/core/offline-manager.js` - Enhanced offline handling

**Steps:**
1. Create service worker file
2. Register in `index.html`
3. Cache static assets
4. Implement offline fallbacks

---

## Testing

### Manual Testing Checklist

**Files to check:**
- Browser console - No errors
- Network tab - All API calls successful
- LocalStorage - State persisted
- Multiple browsers - Cross-browser compatibility

**Features to test:**
- [ ] Data loads correctly
- [ ] Week navigation works
- [ ] Department filter works
- [ ] Search works
- [ ] Drag & drop works
- [ ] Modals open/close
- [ ] Keyboard shortcuts work
- [ ] Print works
- [ ] Edit mode works
- [ ] Real-time sync works

---

### Using Playwright for Testing

**Files to create:**
1. `tests/e2e/basic.spec.js` - Basic tests

**Example test:**
```javascript
// tests/e2e/basic.spec.js
import { test, expect } from '@playwright/test';

test('loads schedule grid', async ({ page }) => {
  await page.goto('http://localhost:8080');

  // Wait for data to load
  await page.waitForSelector('.schedule-grid');

  // Check grid exists
  const grid = await page.locator('.schedule-grid');
  await expect(grid).toBeVisible();

  // Check task cards exist
  const cards = await page.locator('.task-card');
  expect(await cards.count()).toBeGreaterThan(0);
});

test('week navigation', async ({ page }) => {
  await page.goto('http://localhost:8080');

  // Click next week button
  await page.click('#next-week-btn');

  // Verify week changed
  const weekDisplay = await page.locator('#week-display').textContent();
  expect(weekDisplay).toContain('Week');
});
```

**Run tests:**
```bash
npx playwright test
```

---

### Debug with Performance Monitor

**Files to modify:**
1. `src/core/performance-monitor.js` - Enable detailed logging

**Usage:**
```javascript
// In any file
import { startTracking, endTracking } from './core/performance-monitor.js';

startTracking('data-fetch');
await fetchAllData();
endTracking('data-fetch'); // Logs duration
```

---

## Deployment

### Prepare for Production

**Files to modify:**
1. Move credentials to environment variables
2. Minify JavaScript (add build step)
3. Optimize images
4. Add service worker
5. Update `manifest.json`

**Checklist:**
- [ ] Remove console.logs
- [ ] Minify CSS/JS
- [ ] Compress images
- [ ] Enable HTTPS
- [ ] Add CSP headers
- [ ] Test on production domain
- [ ] Set up error monitoring
- [ ] Configure caching headers

---

### Build System Setup (Future)

**Files to create:**
1. `rollup.config.js` or `vite.config.js`
2. `package.json` with build scripts

**Example package.json:**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

---

### Environment Variables

**Instead of hardcoding in api-config.js:**

Create `.env`:
```
VITE_SHEETS_ID=your-spreadsheet-id
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_KEY=your-anon-key
```

Update api-config.js:
```javascript
export const API_CONFIG = {
  googleSheets: {
    spreadsheetId: import.meta.env.VITE_SHEETS_ID,
  },
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_KEY
  }
};
```

---

## Quick Command Reference

### Start Development Server
```bash
npx http-server -p 8080 --cors -o
```

### Find All TODOs in Code
```bash
grep -r "TODO" src/
```

### Find All Event Emissions
```bash
grep -r "eventBus.emit" src/
```

### Find All State Updates
```bash
grep -r "state.set" src/
```

### Count Lines of Code
```bash
find src -name "*.js" -exec wc -l {} + | sort -n
```

### Check for Console Logs (before production)
```bash
grep -r "console.log" src/
```

---

## Getting Help

### Debugging Strategy

1. **Check browser console** - Look for errors
2. **Check network tab** - Verify API calls
3. **Check localStorage** - Verify state persistence
4. **Add console.logs** - Trace execution flow
5. **Use breakpoints** - Debug in DevTools
6. **Check event flow** - Add logs to event-bus.js

### Common Error Messages

**"Module not found"**
- Check import path is correct
- Verify file exists
- Check file extension (.js)

**"state is not defined"**
- Import state: `import { state } from './core/state.js'`
- Check import path

**"eventBus.emit is not a function"**
- Import eventBus: `import { eventBus } from './core/event-bus.js'`

**"Cannot read property of undefined"**
- Check if data is loaded: `state.get('tasks')`
- Add null checks: `if (tasks && tasks.length > 0)`

---

## Related Documentation

- `.claude/CODEBASE_MAP.md` - Navigation overview
- `.claude/ARCHITECTURE.md` - System design
- `.claude/MODULE_INDEX.md` - Module details
- `.claude/DEPENDENCY_MAP.md` - Dependencies
- `Documentation/REFACTORING_PLAN.md` - Complete history
