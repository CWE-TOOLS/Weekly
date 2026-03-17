# Weekly Schedule View — Refactoring Plan

## HIGH SEVERITY

### ~~1. `normalizeDepartmentClass` duplicated 6+ times~~ ✅ COMPLETED
~~Found identically implemented in `task-card.js`, `department-config.js`, `ui-utils.js`, `print-utils.js`, `department-filter.js`, and `week-renderer.js`. Should have a single canonical definition imported everywhere.~~
> Fixed: consolidated to single canonical definition in `department-config.js`. Removed 5 duplicate local definitions. `task-card.js` and `ui-utils.js` re-export for backward compatibility.

### ~~2. `render()` in `renderer.js` is 244 lines with 7+ responsibilities~~ ✅ COMPLETED
~~Handles reentrance guards, synthetic task generation, smart update attempts, task grouping, Monday gap-filling, max-tasks-per-dept calculation, and DOM construction. Each should be its own function.~~
> Fixed: extracted `groupTasksByWeek()`, `buildMaxTasksPerDept()`, `resolveWeekIndex()`, and `scheduleLayoutAndScroll()` as private helpers. Full-render path reduced from ~120 lines to ~22 lines.

### ~~3. `style.backgroundColor = "... !important"` is a bug (`card-renderer.js:186-187`)~~ ✅ COMPLETED
~~Setting `!important` via `element.style.backgroundColor` is **silently ignored** by browsers. Must use `element.style.setProperty('background-color', value, 'important')`.~~
> Fixed: now uses `style.setProperty()` with the `'important'` priority parameter.

### ~~4. XSS risk with `innerHTML` for user content (`task-card.js:75`, `smart-renderer.js:96-109`)~~ ✅ COMPLETED
~~Batch/Layout task descriptions are rendered via `innerHTML` without sanitization. If descriptions from Supabase contain malicious content, it's injected directly into the DOM.~~
> Fixed: added `sanitizeDescription()` to `security-utils.js` (escapes all HTML, restores only `<br>` tags). Applied across `task-card.js`, `smart-renderer.js`, `card-renderer.js`, and `project-modal-fields.js`. Template interpolations in `project-modal-fields.js` also escaped with `escapeHtml()`.

### ~~5. Stale primitive state in `schedule-renderer.js` (`setStateReferences`)~~ ✅ COMPLETED
~~`setStateReferences()` copies `currentViewedWeekIndex` (a number) by value into a module-level variable. When state updates, this module's copy doesn't change — a correctness bug.~~
> Fixed: deleted `schedule-renderer.js` entirely — it was legacy dead code. `setStateReferences()` was never called. The modern renderer is `src/core/renderer.js`.

---

## MEDIUM SEVERITY — Performance

### ~~6. O(n*d) task grouping in multiple files~~ ✅ COMPLETED
~~In `renderer.js:204-226`, `week-renderer.js:68-83`, `department-utils.js:95-109`, and `schedule-utils.js:89-115` — tasks are filtered per-department or per-date in nested loops. A single-pass `Map` grouping would reduce complexity from O(n*d) to O(n+d).~~
> Fixed: Single-pass Map grouping in `renderer.js` (`taskCountByDeptDate`), rewrote `groupTasksByDate()` in `department-utils.js` with Set-based lookup, `calculateMaxTasksPerDept()` now delegates to `groupTasksByDate()`, removed duplicate local `groupTasksByDate()` from `week-renderer.js`.

### ~~7. `parseDate()` called repeatedly on same task data~~ ✅ COMPLETED
~~Across `schedule-utils.js`, `department-utils.js`, and `week-renderer.js`, the same task's date is re-parsed multiple times per render cycle. Results should be cached or precomputed.~~
> Fixed: Added module-level `Map` cache to `parseDate()` in `date-utils.js` with `clearParseDateCache()` called at top of render cycle. Fixed double-parse pattern in 3 locations in `schedule-utils.js`.

### ~~8. `date.toDateString()` called in tight inner loops (`week-renderer.js:175,194`)~~ ✅ COMPLETED
~~For 6 dates × n rows per department, this creates O(6n) string allocations per department. Week dates should be precomputed once into an array of strings.~~
> Fixed: Precomputed `weekDateStrings` array in `renderDepartmentRows()`, inner loops use indexed lookup instead of calling `toDateString()` per cell.

### ~~9. Triple DOM traversal in `equalizeAllCardHeights` (`grid-layout-manager.js:49-96`)~~ ✅ COMPLETED
~~Queries the same row-class elements 3 times (clear phase, read phase, write phase). Can be reduced to 1 query with cached references.~~
> Fixed: Merged Phase 0+1 — single `querySelectorAll` per row class stored in `rowNodeLists` Map, reused for clear, read, and write phases.

### ~~10. `getIsEditingUnlocked()` called per-card (`task-card.js:36,145`)~~ ✅ COMPLETED
~~Called for every task card and placeholder. Should be computed once per render cycle and passed as a parameter.~~
> Fixed: Computed once in `renderer.js`, threaded through `renderWeekGrid` → `renderDepartmentRows` → `createGridCell` → `createTaskCard`/`createTaskCardPlaceholder`. Fallback preserved for `smart-renderer.js` callers.

---

## MEDIUM SEVERITY — Architecture

### ~~11. DOM access in the state module (`state.js:288-294`)~~ ✅ COMPLETED
~~`getSelectedDepartments()` directly queries `#department-list` checkboxes. A "pure data layer" should not touch the DOM. Department selection should be stored as state via a setter.~~
> Fixed: deleted the dead `getSelectedDepartments()` function from `state.js`. Zero callers — the real version lives in `department-filter.js`.

### ~~12. DOM/UI access in data service (`data-service.js:93-94`)~~ ✅ COMPLETED
~~`fetchAllTasks()` checks `document.getElementById('project-modal')` to determine modal state. Data services should not inspect the DOM.~~
> Fixed: removed modal DOM check and all UI calls (`showLoading`, `hideError`, `showError`) from `fetchAllTasks()`. Callers now own their own loading/error UI.

### ~~13. Inconsistent state access patterns across files~~ ✅ COMPLETED
~~Three different approaches to reading editing state:~~
~~- `getIsEditingUnlocked()` from `state.js`~~
~~- `localStorage.getItem('editingUnlocked')` in `smart-renderer.js:286`~~
~~- `isEditingActive()` from `refresh-queue.js`~~
> Fixed: replaced direct `localStorage.getItem('editingUnlocked')` in `smart-renderer.js` with `getIsEditingUnlocked()` from `state.js`.

### ~~14. `window.*` global pollution in an ES module codebase~~ ✅ COMPLETED
~~`department-utils.js` exports to `window.DepartmentUtils`, `schedule-renderer.js` uses `window.DEPARTMENT_ORDER`, `window.lastRenderTimestamp`, `window.renderCache`. This undermines the module architecture.~~
> Fixed: deleted `window.DepartmentUtils` from `department-utils.js`. Replaced `window.DEPARTMENT_ORDER` with proper import, `window.lastRenderTimestamp`/`window.renderCache` with `setLastRenderTimestamp()`/`setRenderCache()` from `state.js`.

### ~~15. Synthetic tasks injected in two places~~ ✅ COMPLETED
~~`renderer.js:86-88` and `week-renderer.js:229` both call `injectSyntheticTasks()`. During a full render, both execute, potentially double-injecting.~~
> Fixed: moved synthetic task generation inside the `previousFilteredTasks.length > 0` guard so injection only happens on the smart-update path. Made `injectSyntheticTasks()` idempotent by filtering out existing synthetic tasks before appending.

### ~~16. `data-service.js` mixes data fetching with UI (`showLoading`, `showError`)~~ ✅ COMPLETED
~~A service should return data/throw errors. The caller should handle UI feedback.~~
> Fixed: removed `showLoading`/`hideError`/`showError` imports and all UI calls from `fetchAllTasks()`. Removed `silent` parameter and modal DOM check. Callers (`initialization-orchestrator.js`, `button-handlers.js`, `keyboard-shortcuts.js`) now manage their own loading spinners and error banners.

---

## MEDIUM SEVERITY — Duplication

### ~~17. `createWeekDates()` identically duplicated~~ ✅ COMPLETED
~~Exists in both `renderer.js:34-40` and `week-renderer.js:39-45`. Should be in `date-utils.js`.~~
> Fixed: moved to `date-utils.js` as a shared export. Both `renderer.js` and `week-renderer.js` now import it.

### ~~18. `showRenderingStatus` duplicated~~ ✅ COMPLETED
~~Exists in `ui-utils.js` (imported by `schedule-grid.js`) and re-implemented locally in `schedule-renderer.js:284-292`.~~
> Fixed: deleted the local re-implementation and added `import { showRenderingStatus } from '../../utils/ui-utils.js'`.

### ~~19. Hardcoded `'Batch'` and `'Layout'` scattered across ~8 files~~ ✅ COMPLETED
~~Found in `renderer.js`, `task-card.js`, `department-utils.js`, `department-filter.js`, `schedule-renderer.js`, `schedule-utils.js`. Should derive from `SYNTHETIC_DEPARTMENT_CONFIG`.~~
> Fixed: Added `SYNTHETIC_DEPARTMENT_NAMES` Set, `isSyntheticDepartment()` helper, and `generateAllSyntheticTasks()` to config/utils. Replaced ~30 hardcoded checks across 12 files with config-driven references.

### ~~20. Duplicated details HTML in `card-renderer.js` (`addDetails` vs `updateDetails`)~~ ✅ COMPLETED
~~Lines 266-286 and 291-312 contain nearly identical HTML-building logic.~~
> Fixed: extracted shared `buildDetailsHTML(task)` method. Both `addDetails` and `updateDetails` now call it.

### ~~21. Triplicated event handler pattern in `component-events.js:26-54`~~ ✅ COMPLETED
~~Three handlers with identical structure: check editing → queue or render. Should be a shared helper.~~
> Fixed: extracted `renderOrQueue(eventName)` helper. Also consolidated duplicate `import` from `event-bus.js`.

---

## LOW SEVERITY — Dead Code

### ~~22. `schedule-grid.js` is ~50% dead code~~ ✅ COMPLETED
~~8 unused imports (`DEPARTMENT_ORDER`, `showRenderingStatus`, `parseDate`, `getMonday`, `getLocalDateString`, `RENDER_DELAY`, `canUseSmartUpdate`, `smartUpdateSchedule`), an unused variable `_previousTasks`, and an empty function `enableAddCardIndicators()`.~~
> Fixed: removed all unused imports, the unused `_previousTasks` variable, and the empty `enableAddCardIndicators()` function. File reduced from 91 lines to ~45.

### ~~23. Dead exported functions in `state.js`~~ ✅ COMPLETED
~~`getTaskById`, `getTasksByProject`, `getTasksByDepartment`, `debugState`, `getTaskCounts` — all exported but never imported elsewhere.~~
> Fixed: removed all 5 dead functions. Also removed the now-unused `MISC_CONFIG` import.

### ~~24. Dead/broken `toggleDepartmentDropdown` in `department-filter.js:227-232`~~ ✅ COMPLETED
~~Targets element ID `'department-dropdown'` with class `'show'`, while the actual dropdown uses `'multi-select-dropdown'` with class `'open'`.~~
> Fixed: removed the dead function and its export. Never imported anywhere.

### ~~25. Dead navigation functions in `week-navigation.js`~~ ✅ COMPLETED
~~`navigateToPreviousWeek` and `navigateToNextWeek` are exported but the buttons use different private functions (`showPreviousWeek`/`showNextWeek`).~~
> Fixed: removed both dead functions and the now-unused `navigateToWeek` import from `schedule-grid.js`.

---

## LOW SEVERITY — Code Smells

### ~~26. Three separate `document.addEventListener('click')` in `button-handlers.js:110,124,135`~~ ✅ COMPLETED
~~Every click anywhere triggers 3 handler functions. Should be one delegated handler with routing.~~
> Fixed: consolidated into a single delegated click handler with `closest()` routing and early returns.

### ~~27. No debounce on refresh button (`button-handlers.js:35`)~~ ✅ COMPLETED
~~Rapid clicks fire multiple simultaneous fetch operations.~~
> Fixed: added `isRefreshing` flag guard with `finally` block to prevent concurrent refresh operations.

### ~~28. `loadWeekIndex()` called twice in same render (`renderer.js:238,260`)~~ ✅ COMPLETED
> Fixed: removed redundant second call inside nested `requestAnimationFrame`. Now reuses `currentViewedWeekIndex` which already incorporates the saved index.

### ~~29. Magic number `6` for work week days (multiple files)~~ ✅ COMPLETED
~~Should be a constant like `DAYS_IN_WORK_WEEK`.~~
> Fixed: added `DAYS_IN_WORK_WEEK = 6` constant to `date-utils.js`. Updated `createWeekDates()` and `print-config-manager.js` to use it.

### ~~30. Inconsistent HTML construction — `createHeaderRow` returns a string while siblings return DOM elements (`week-renderer.js:52-59`)~~ ✅ COMPLETED
> Fixed: converted `createHeaderRow` from string concatenation + `innerHTML` to `createElement` + `DocumentFragment`. Usage changed from `grid.innerHTML =` to `grid.appendChild()`.

### ~~31. Task objects mutated during rendering (`renderer.js:157,214` — `task.missingDate = true`)~~ ✅ COMPLETED
> Fixed: first occurrence now creates a shallow copy `{ ...task, missingDate: true }` instead of mutating the original. Second occurrence (used only for counting) no longer sets the flag at all.

### ~~32. `smart-renderer.js:smartUpdateSchedule` is 208 lines with 7 levels of nesting~~ ✅ COMPLETED
> Fixed: extracted `removeCard()`, `moveCard()`, and `updateCardContent()` helper functions. Main function is now a clean orchestrator with max 3 levels of nesting.

### ~~33. Smart renderer gives up on any new tasks (`smart-renderer.js:330-338`) — falls back to full re-render, negating the optimization~~ ✅ COMPLETED
> Fixed: Phase 2 now finds the correct grid cell for new tasks and replaces a placeholder with `createTaskCard()`. Only falls back to full re-render if no matching cell or placeholder exists.

### ~~34. `getMonday(new Date())` computed 4 separate times in `schedule-renderer.js:renderAllWeeks`~~ ✅ COMPLETED
> Fixed: computed `todayMonday` once at the top of the function. All 5 occurrences now reuse the cached value.

### ~~35. `flushQueue` in `refresh-queue.js` calls queued function synchronously but it may return a Promise — async rejections go unhandled~~ ✅ COMPLETED
> Fixed: `flushQueue` is now `async` and `await`s the queued function. `queueRefresh` also handles promises when executing immediately.

---

## Recommended Refactoring Priority

1. **Extract shared utilities** — `normalizeDepartmentClass`, `createWeekDates`, synthetic department names from config
2. **Fix the `!important` style bug** in `card-renderer.js`
3. **Break up `render()` and `smartUpdateSchedule`** into smaller, single-responsibility functions
4. **Single-pass task grouping** — replace all O(n*d) filter patterns with Map-based grouping
5. **Clean dead code** from `schedule-grid.js`, `state.js`, `department-filter.js`, `week-navigation.js`
6. **Decouple layers** — remove DOM access from state and data service modules
7. **Consolidate global `window.*` usage** into proper ES module imports
