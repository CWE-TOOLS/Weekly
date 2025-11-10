# Code Style and Conventions

## No Formal Config Files
- No `.eslintrc`, `.prettierrc`, or `tsconfig.json`
- Conventions established through documentation and consistency

## JavaScript Style

### Module System
- **ES6 Modules ONLY** with `import`/`export` (not CommonJS)
- Always include `.js` extension in imports
- Named exports preferred (no default exports)
```javascript
// Good
import { fetchAllTasks } from '../services/data-service.js';
export async function loadData() { ... }

// Bad
const dataService = require('../services/data-service.js'); // Don't use require
export default function loadData() { ... } // Avoid default exports
```

### Async Programming
- **Async/await** preferred over promise chains
- Always handle errors with try/catch
```javascript
// Good
async function loadData() {
    try {
        const data = await fetchData();
        return data;
    } catch (error) {
        logger.error('Failed to load data:', error);
    }
}

// Bad
function loadData() {
    return fetchData().then(data => data).catch(err => console.log(err));
}
```

### Logging
- Use structured `logger.*` instead of `console.*`
- Available levels: `debug`, `info`, `warn`, `error`
```javascript
// Good
logger.info('Loading tasks...');
logger.error('Failed to load tasks:', error);

// Bad
console.log('Loading tasks...'); // Don't use console
console.error(error);
```

### Documentation
- **Comprehensive JSDoc** for all public APIs
- Include parameter types, return types, descriptions
```javascript
/**
 * Fetches all tasks from Google Sheets and Supabase
 * @returns {Promise<Array<Object>>} Combined array of tasks
 * @throws {Error} If both data sources fail
 */
export async function fetchAllTasks() { ... }
```

### Error Handling
- Global error handler catches unhandled errors
- Service-level try/catch for graceful degradation
- User-friendly error messages via notifications

## File Naming
- **Kebab-case**: `task-card-editor.js` (not camelCase or snake_case)
- Descriptive names with suffixes:
  - Services: `-service.js`
  - Utils: `-utils.js`
  - Modals: `-modal.js`
  - Handlers: `-handler.js`
  - Managers: `-manager.js`

## Module Size Guidelines
- **Target**: 200-300 lines per file
- **Maximum**: 500 lines (split if larger)
- **Single Responsibility Principle**
- Separate orchestration from implementation

## Variable Naming
- **camelCase** for variables and functions
- **UPPER_SNAKE_CASE** for constants
- **PascalCase** for class names (rare in this codebase)
```javascript
// Good
const currentWeek = getWeekStart();
const MAX_RETRY_COUNT = 3;

// Bad
const CurrentWeek = getWeekStart();
const max_retry_count = 3;
```

## Event-Driven Architecture
- Use `event-bus` for component communication
- Standardized event naming: `category:action`
  - Examples: `tasks:loaded`, `week:changed`, `modal:opened`
- Document emitted and consumed events

## Import Organization
```javascript
// 1. Config imports
import { DEPARTMENTS } from '../config/department-config.js';

// 2. Core imports
import { state } from '../core/state.js';
import { eventBus } from '../core/event-bus.js';

// 3. Service imports
import { fetchAllTasks } from '../services/data-service.js';

// 4. Utils imports
import { formatDate } from '../utils/date-utils.js';
```

## CSS Conventions
- Modular CSS files by component/feature
- BEM-like naming for specificity
- CSS variables in `variables.css`
- Mobile-first responsive design

## Git Conventions
- No specific commit message format required
- Use descriptive messages
- `.gitignore` excludes:
  - `src/config/api-config.js` (credentials)
  - `.vscode/settings.json` (local config)
  - Node modules if testing tools installed

## Browser Compatibility
- Target: Modern evergreen browsers (Chrome, Firefox, Edge, Safari)
- ES6+ features used without transpilation
- No polyfills (native ES6 modules required)