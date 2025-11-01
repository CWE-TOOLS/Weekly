# Suggested Commands

## Running the Application

### Option 1: VS Code Live Server (Recommended)
1. Install "Live Server" extension in VS Code
2. Right-click `index.html`
3. Select "Open with Live Server"
4. Opens automatically at `http://127.0.0.1:5500`

### Option 2: Node.js http-server
```bash
npx http-server -p 8080 -o
# Opens at http://localhost:8080
```

### Option 3: Python HTTP Server
```bash
# Python 3
python -m http.server 8080

# Python 2
python -m SimpleHTTPServer 8080
```

**Note**: Application MUST be served via HTTP/HTTPS (not `file://` protocol) due to ES6 module restrictions.

## No Build Commands
- ✅ No `npm install` needed
- ✅ No `npm run build`
- ✅ No bundling or transpilation
- Native ES6 modules loaded directly by browser

## Windows System Commands

### File Operations (Git Bash or PowerShell)
```bash
# List files
ls
dir  # PowerShell

# Find files (Git Bash)
find . -name "*.js"

# Search in files (Git Bash)
grep -r "searchTerm" src/

# PowerShell equivalents
Get-ChildItem -Recurse -Filter "*.js"
Select-String -Path src/* -Pattern "searchTerm" -Recurse
```

### Git Commands
```bash
git status
git add .
git commit -m "message"
git push
git pull
git log --oneline
git diff
```

## Configuration Setup

### Create API Config (First Time Setup)
Create `src/config/api-config.js`:
```javascript
export const GOOGLE_SHEETS_CONFIG = {
    SHEET_ID: 'your-google-sheet-id',
    SERVICE_ACCOUNT: {
        CLIENT_EMAIL: 'your-service-account@project.iam.gserviceaccount.com',
        PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n'
    }
};

export const SUPABASE_CONFIG = {
    URL: 'https://your-project.supabase.co',
    ANON_KEY: 'your-anon-key-here'
};
```

**Security**: This file is gitignored to prevent credential leaks.

## Browser DevTools Debugging

### Console Commands (Available at Runtime)
```javascript
// Get application status
window.getAppStatus();

// Access state
window.state.getAllTasks();
window.state.getWeekStart();

// Emit test events
window.eventBus.emit('custom:event', { data: 'test' });

// Enable debug logging
logger.setLevel('debug');  // 'debug', 'info', 'warn', 'error'

// Performance monitoring
window.performanceMonitor.getMetrics();
```

### Chrome DevTools
- **Network Tab**: Monitor API calls to Google Sheets and Supabase
- **Application > Local Storage**: Inspect persisted state
- **Console**: Check for errors and warnings
- **Performance**: Profile render operations
- **Memory**: Check for leaks after navigation

## Testing (Manual)
No automated testing framework. Manual checklist:
1. Feature initializes without console errors
2. Feature responds to user interactions correctly
3. Feature emits expected events (check with `eventBus`)
4. No memory leaks after repeated operations
5. Works after week navigation
6. Works after modal open/close cycles
7. Offline behavior (disconnect network)

## Utility Scripts

### Toggle Claude Code Subscription
```bash
# Windows
toggle-claude.bat

# Git Bash / WSL
./toggle-claude.sh

# PowerShell
.\toggle-claude.ps1
```

## Recommended VS Code Extensions
- **Live Server** - Local development server
- **ES6 String HTML** - Syntax highlighting in template literals
- **Path Intellisense** - Autocomplete for file paths
- **GitLens** - Enhanced Git integration

## Common Development Tasks

### Adding a New Feature
1. Create file in appropriate directory (`features/`, `components/`, `utils/`)
2. Follow naming conventions (kebab-case with suffix)
3. Export functions/classes with named exports
4. Import where needed with `.js` extension
5. Add to lazy loading if modal or non-critical feature
6. Update documentation if public API

### Debugging Issues
1. Check browser console for errors
2. Enable debug logging: `logger.setLevel('debug')`
3. Check Network tab for API failures
4. Inspect Local Storage for state issues
5. Use `window.getAppStatus()` for system health

### Performance Optimization
1. Use `grid-layout-manager.js` for batched DOM updates
2. Debounce expensive operations
3. Consider lazy loading for non-critical code
4. Profile with Chrome DevTools Performance tab