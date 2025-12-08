# Browser Compatibility & Degraded Mode

## Overview
The application now includes progressive enhancement to support older browsers (like Chrome 76) by automatically detecting browser capabilities and disabling features that require modern JavaScript.

## How It Works

### 1. Browser Detection
- On app startup, checks if browser supports modern JavaScript features (optional chaining, nullish coalescing)
- Minimum supported browsers for **full features**:
  - Chrome 80+ (Feb 2020)
  - Firefox 72+ (Jan 2020)
  - Safari 13.1+ (Mar 2020)
  - Edge 80+ (Feb 2020)

### 2. Degraded Mode (Read-Only)
When an older browser is detected, the app automatically:

**✅ ENABLED (Core Features):**
- View tasks from Google Sheets
- **View manual tasks from Supabase** (via REST API)
- **View task descriptions from Supabase** (via REST API)
- Filter by department
- Search projects
- Navigate weeks
- Print schedules

**❌ DISABLED (Advanced Features):**
- Manual task creation/editing/deletion
- Task descriptions editing
- Real-time sync between clients
- Drag-and-drop reordering
- Context menu operations

### 3. User Experience
**Visual Indicators:**
- Orange warning banner at top: "⚠️ Chrome 76 detected. Running in read-only mode..."
- Editing button hidden
- Add task button (FAB) hidden
- Refresh button disabled with tooltip

**Console Messages:**
```
⚠️ Browser does not support modern JavaScript features
Browser: Chrome 76
Running in degraded mode with limited features
⚠️ Supabase initialization skipped (degraded mode)
```

## Implementation Files

### New Files Created:
- `src/utils/browser-compat.js` - Browser detection and UI disabling logic
- `src/services/supabase-rest-fallback.js` - REST API fallback for old browsers

### Modified Files:
1. `src/core/app-controller.js` - Added Phase 0 browser check before initialization
2. `src/services/supabase-service.js` - Use REST fallback in degraded mode
3. `src/core/error-handler.js` - Fixed null error handling for older browsers

### How REST Fallback Works:
In degraded mode, instead of loading the Supabase JS v2 library (which uses modern syntax), we make direct HTTP requests to the Supabase REST API using plain `fetch()`:

```javascript
// Modern browsers: Use Supabase client
const { data } = await supabaseClient.from('tasks').select('*');

// Old browsers: Use REST API fallback
const response = await fetch(SUPABASE.URL + '/rest/v1/tasks', {
  headers: { 'apikey': SUPABASE.ANON_KEY }
});
const data = await response.json();
```

This allows full read access to Supabase data without requiring modern JavaScript features.

## Testing

### Test on Modern Browser (Chrome 80+):
1. Open app → Should load normally
2. All features should work (editing, manual tasks, etc.)
3. No warning banner

### Test on Old Browser (Chrome 76):
1. Open app → Orange warning banner appears
2. Can view Google Sheets data
3. Cannot add/edit tasks
4. Editing buttons hidden

### Simulate Old Browser (Developer Tools):
1. Open Chrome DevTools → Settings → Experiments
2. Enable "Custom user agent strings"
3. Set User Agent to Chrome 76
4. Reload page

## API Reference

### Check Browser Compatibility
```javascript
import { checkBrowserCompatibility } from './utils/browser-compat.js';

const result = checkBrowserCompatibility();
// Returns: {
//   isSupported: boolean,
//   browserName: string,
//   browserVersion: string,
//   degradedMode: boolean,
//   message: string
// }
```

### Check if Running in Degraded Mode
```javascript
import { isInDegradedMode } from './utils/browser-compat.js';

if (isInDegradedMode()) {
  console.log('Running in read-only mode');
}
```

## Future Enhancements
- Add option to show full browser requirements modal
- Consider using Supabase JS v1 for broader compatibility
- Add automatic browser update prompt
- Add telemetry to track browser versions in use

## Troubleshooting

**Q: App won't load at all on Chrome 76**
A: Check browser console for syntax errors. ES6 modules should still work.

**Q: How do I force full mode for testing?**
A: Clear sessionStorage: `sessionStorage.removeItem('degradedMode')`

**Q: Can I use a polyfill instead?**
A: Possible but not recommended - Supabase JS v2 has many ES2020+ features that would require extensive polyfilling.

---
*Last Updated: 2025-12-08*
