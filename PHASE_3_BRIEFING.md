# Phase 3: Services Layer - Briefing Document

**Date:** 2025-10-28
**Status:** Ready to Start
**Previous Phases:** Phase 1 ✅ | Phase 2 ✅

---

## 🎯 Mission

Extract all service-layer code from `index-old.html` into modular ES6 service files.

**Goal:** Separate business logic (services) from UI code to enable better testing, maintainability, and reusability.

---

## ✅ What's Already Done

### Phase 1: Foundation & Configuration
- ✅ Modular file structure (`/src` directory)
- ✅ CSS extracted (6 files: variables, base, layout, components, responsive, print)
- ✅ Config centralized (`api-config.js`, `constants.js`, `department-config.js`)
- ✅ Print system modularized

### Phase 2: Utility Functions
- ✅ Date utilities (`src/utils/date-utils.js`)
- ✅ UI utilities (`src/utils/ui-utils.js`)
- ✅ ES6 module system working
- ✅ `main.js` entry point created
- ✅ Testing with `http-server` successful

---

## 🚧 What Needs to Be Done (Phase 3)

### Service Files Status

| File | Status | Actions Required |
|------|--------|------------------|
| `src/services/auth-service.js` | ⚠️ Partial | Extract JWT functions, add ES6 exports |
| `src/services/sheets-service.js` | ⚠️ Partial | Extract Google Sheets API calls, add ES6 exports |
| `src/services/supabase-service.js` | ⚠️ Partial | Extract Supabase CRUD, add ES6 exports |
| `src/services/data-service.js` | ⚠️ Partial | Extract orchestration logic, add ES6 exports |

---

## 📍 Source Code Locations

All code to extract is in **`index-old.html`**:

```javascript
// Lines ~1107-1180: Constants & Service Account Setup
const API_KEY = '...';
const SPREADSHEET_ID = '...';
let SERVICE_ACCOUNT = { ... };

// Lines ~1181-1250: JWT & Authentication Functions
function base64UrlEncode() { ... }
function base64UrlDecode() { ... }
async function generateJWT() { ... }
async function getAccessToken() { ... }

// Lines ~1280-1320: Utility Functions (✅ DONE in Phase 2)
function normalizeDepartment() { ... }
function parseDate() { ... }
// etc.

// Lines ~1353-1396: Google Sheets Data Fetching
async function fetchTasks() { ... }

// Lines ~1397-1550: Google Sheets API Operations
async function getSheetId() { ... }
async function getStagingData() { ... }
async function saveToStaging() { ... }

// Lines ~1550-1800: Supabase CRUD Operations
async function loadManualTasks() { ... }
async function saveTaskToSupabase() { ... }
async function deleteTaskFromSupabase() { ... }

// Lines ~1800-2000: Task Calculation & Merging
function calculateProjectDayCounts() { ... }

// Lines ~2000-2500: Real-time Sync & Refresh Signals
async function sendRefreshSignal() { ... }
// Supabase channel subscriptions
```

---

## 🎯 Implementation Order

### 1. Authentication Service (`src/services/auth-service.js`)
**Priority:** HIGH (other services depend on it)

**Extract:**
- `base64UrlEncode()` - Base64 URL encoding
- `base64UrlDecode()` - Base64 URL decoding
- `generateJWT()` - JWT token generation
- `getAccessToken()` - OAuth token exchange

**Dependencies:**
- `src/config/api-config.js` (SERVICE_ACCOUNT)

**Export as:**
```javascript
export {
    base64UrlEncode,
    base64UrlDecode,
    generateJWT,
    getAccessToken
};
```

---

### 2. Google Sheets Service (`src/services/sheets-service.js`)
**Priority:** HIGH (core data source)

**Extract:**
- `fetchTasks()` - Fetch tasks from Google Sheets
- `parseSheetData()` - Parse Google Sheets response
- `getSheetId()` - Get sheet ID by name
- `getStagingData()` - Fetch staging sheet data
- `saveToStaging()` - Save to staging sheet

**Dependencies:**
- `src/config/api-config.js` (GOOGLE_SHEETS config)
- `src/services/auth-service.js` (getAccessToken)
- `src/utils/date-utils.js` (parseDate)

**Export as:**
```javascript
export {
    fetchTasks,
    parseSheetData,
    getSheetId,
    getStagingData,
    saveToStaging
};
```

---

### 3. Supabase Service (`src/services/supabase-service.js`)
**Priority:** HIGH (manual tasks & real-time sync)

**Extract:**
- Supabase client initialization
- `loadManualTasks()` - Load tasks from Supabase
- `saveTaskToSupabase()` - Save task to Supabase
- `deleteTaskFromSupabase()` - Delete task from Supabase
- `updateTaskInSupabase()` - Update task in Supabase
- `sendRefreshSignal()` - Send real-time refresh signal
- Real-time subscription setup

**Dependencies:**
- `src/config/api-config.js` (SUPABASE config)
- `src/utils/date-utils.js` (date formatting)

**External Dependency:**
- Supabase JS client (loaded via CDN in index.html)

**Export as:**
```javascript
export {
    initSupabase,
    loadManualTasks,
    saveTaskToSupabase,
    deleteTaskFromSupabase,
    updateTaskInSupabase,
    sendRefreshSignal,
    subscribeToRefreshSignals
};
```

---

### 4. Data Service (`src/services/data-service.js`)
**Priority:** MEDIUM (orchestrates other services)

**Extract:**
- `calculateProjectDayCounts()` - Calculate day numbers for projects
- Task merging logic (Sheets + Supabase)
- Task filtering logic

**Dependencies:**
- `src/services/sheets-service.js` (fetchTasks, parseSheetData)
- `src/services/supabase-service.js` (loadManualTasks)
- `src/core/state.js` (state management)
- `src/utils/ui-utils.js` (showLoading, showError)

**Export as:**
```javascript
export {
    fetchAllTasks,
    calculateProjectDayCounts,
    mergeTasks,
    filterTasksByDepartment
};
```

---

## 🧪 Testing Strategy

After completing each service:

1. **Import test in browser console:**
   ```javascript
   // Open http://localhost:8080 in browser
   // Check console for errors
   console.log('Testing service imports...');
   ```

2. **Verify ES6 exports work:**
   - No console errors on page load
   - All imports successful
   - Functions accessible from `main.js`

3. **Functional testing:**
   - Auth: Can generate JWT and get access token
   - Sheets: Can fetch and parse data from Google Sheets
   - Supabase: Can load, save, and delete tasks
   - Data: Can merge tasks and calculate day counts

---

## 🛠️ Development Setup

```bash
# 1. Navigate to project directory
cd "C:\Users\mike10\Documents\VScode projects\weekly"

# 2. Start HTTP server (ES6 modules require HTTP, not file://)
npx http-server -p 8080 --cors -o

# 3. Open browser to http://localhost:8080

# 4. Open browser console (F12) to check for errors
```

---

## 📦 Key Files Reference

### Already Available (Use These!)
- `src/config/api-config.js` - All API keys and endpoints
- `src/config/constants.js` - Application constants
- `src/config/department-config.js` - Department configuration
- `src/utils/date-utils.js` - Date parsing and formatting
- `src/utils/ui-utils.js` - UI helper functions
- `src/core/state.js` - Application state

### To Update
- `src/main.js` - Add service imports and initialization

### Source to Extract From
- `index-old.html` (lines 1100-2500)

---

## ✅ Success Criteria

- [ ] All 4 service files completed with ES6 exports
- [ ] `main.js` imports all services
- [ ] No console errors on page load
- [ ] Data fetching from Google Sheets works
- [ ] Supabase CRUD operations work
- [ ] Authentication/JWT generation works
- [ ] No breaking changes to existing functionality
- [ ] Can run `npx http-server -p 8080` and app loads

---

## 📝 Notes

- **ES6 Modules:** Using native browser ES6 modules (no build system)
- **Server Required:** Must use HTTP server, not `file://` protocol
- **Backward Compatibility:** Temporary globals in `main.js` for legacy code
- **Testing:** Browser console is your friend - watch for errors!

---

## 🚀 Ready to Start?

1. Read this document
2. Review `REFACTORING_PLAN.md` Phase 3 section
3. Start with `auth-service.js`
4. Test after each service
5. Update `main.js` imports as you go

**Good luck! 🎉**
