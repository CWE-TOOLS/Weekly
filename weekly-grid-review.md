# Weekly View Grid — Architecture Review

## Architecture Summary

The grid uses a well-structured multi-layer system:
- **CSS Grid** layout (1 dept column + 6 day columns)
- **Two-path rendering**: smart diff update with full-rebuild fallback
- **Central state** + event bus for data flow
- **Batched DOM ops** for height equalization
- **Refresh queue** to defer renders during editing
- **Dual data sources**: Google Sheets (read-only schedule) + Supabase (manual tasks, descriptions, realtime sync)
- **Synthetic department generation**: Batch/Layout tasks computed from Cast/Demold at render time

Overall the architecture is solid and shows good engineering. Below are architectural issues, followed by UX/functionality improvement opportunities.

---

## Architectural Issues

### 1. `maxTasksPerDept` is calculated globally, not per-week

`buildMaxTasksPerDept()` calculates the maximum task count per department across **all dates**. If one week has 5 Mill tasks but every other week has 1, **every week** gets 5 empty Mill rows. This wastes some vertical space.

**Decision**: Keep global max. Per-week row counts were tested and rejected — departments disappearing/reappearing between weeks makes it too hard to follow a department across weeks. The consistent grid structure is more valuable than the space savings.

### 2. No DOM virtualization — all weeks rendered at once

Every week in the dataset is rendered into the DOM simultaneously. With a year's worth of data that's ~52 grids × ~14 departments × 6 days = thousands of cells, most off-screen.

**Suggestion**: Render only the visible week(s) plus one buffer on each side. Use an `IntersectionObserver` or scroll-position-based lazy rendering to mount/unmount week grids as the user scrolls.

### 3. Synthetic tasks injected into `_filteredTasks` state

`injectSyntheticTasks()` mutates the filtered tasks array to include generated Batch/Layout data. This mixes computed/derived data with source-of-truth data, making it harder to reason about state and introducing subtle ordering dependencies (synthetic tasks must be injected before smart update comparison, cleared before full render).

**Suggestion**: Keep synthetic tasks in a separate state slot (e.g., `_syntheticTasks`) and merge them at render time rather than polluting `_filteredTasks`. The renderer can combine both sets when building the grid.

### 4. Smart renderer uses attribute selectors for cell lookup

The smart renderer locates target cells via:

```js
.grid-cell[data-date="${dateStr}"][data-department="${dept}"]
```

This is O(DOM_size) per task and runs for every changed task. With many weeks in the DOM, this gets expensive.

**Suggestion**: Build a cell lookup map (keyed by `date|department`) during render and pass it to the smart renderer. O(1) lookups instead of DOM queries.

### 5. `container.innerHTML = ''` on full rebuild

Full rebuilds wipe the DOM with `innerHTML = ''`, which:
- Triggers garbage collection of all child nodes
- Loses any direct event listeners (though delegation mitigates this)
- Causes a visual flash/blank frame

**Suggestion**: Consider using `replaceChildren()` with the new fragment in one call, or diff at the week-grid level (keep unchanged weeks, only rebuild affected ones).

### 6. Height equalization couples all weeks

Row classes like `dept-row-mill-0` span across all weeks, so `equalizeAllCardHeights()` must query and synchronize heights globally. This is O(weeks × rowClasses) DOM reads plus a forced reflow.

**Suggestion**: If weeks are decoupled (virtualized), height equalization only needs to run on visible weeks. Even without virtualization, consider whether cross-week height sync is truly necessary — most users view one week at a time.

---

## Minor Technical Concerns

### 7. Date parse cache cleared every render

`clearParseDateCache()` runs at the start of each `render()`, defeating the cache for repeated renders triggered in quick succession (e.g., filter changes).

**Suggestion**: Only clear when the underlying date data changes, not on every render pass.

### 8. Coalesced queue flushing assumes latest refresh is sufficient

`flushQueue()` only executes the **most recent** queued refresh, discarding earlier ones. This works if each refresh is a full data reload, but could silently drop intermediate state changes if refreshes are more granular.

**Suggestion**: Document this assumption clearly. If future refreshes become more granular (e.g., single-task updates), this will need revisiting.

### 9. Smart update fallback conditions are broad

The smart renderer falls back to full rebuild if department structure changes at all (departments added/removed). Filtering by department is a common user action that triggers this.

**Suggestion**: Handle department changes incrementally — add/remove department row sections rather than rebuilding everything.

### 10. Forced reflow in height equalization

`container.offsetHeight` is used to force a synchronous layout. This is intentional but expensive — it blocks the main thread while the browser recalculates layout for the entire container.

**Suggestion**: If height equalization is deferred to a `requestAnimationFrame`, the browser may have already performed layout, making the forced reflow unnecessary. Test whether removing it causes visual glitches; if not, it's free perf.

---

## UX & Functionality Improvements

### High Impact

#### 11. Collapsible Department Rows

The department filter is all-or-nothing — departments are either fully visible or completely hidden. Users often want to *de-emphasize* departments without losing awareness of them entirely. Clicking a department label could toggle between expanded (full card detail) and collapsed (single summary row showing task count per day). State persisted in localStorage alongside the filter selection.

**Where**: `week-renderer.js` (createDepartmentLabel, renderDepartmentRows), new CSS for collapsed state.

#### 12. Task Card Density Toggle

A compact/full toggle in the controls bar. **Compact mode**: project name + day counter only (single line per card). **Full mode**: current layout with description, hours, etc. Compact mode lets users scan the full week at a glance, then drill into specific days. Could be a simple CSS class toggle on the grid container that hides `.task-description`, `.task-details`, `.project-description` elements.

**Where**: Controls bar in `index.html`, CSS class toggle, localStorage persistence.

#### 13. Department Workload Heatmap Overlay

Color-code day cells by total hours allocated — light tint for low utilization, saturated for overloaded days. Makes capacity bottlenecks instantly visible without reading individual cards. Toggle via a button in the controls bar. Could use CSS custom properties set per-cell based on hours sum.

**Where**: `week-renderer.js` (createGridCell — compute hours sum per cell), new CSS for heatmap tints.

#### 14. Week Summary Stats Bar

Show aggregate info in each week's header area: total tasks, total hours, estimated revenue (`hours × $135` from `REVENUE.HOURLY_RATE`), and per-department mini utilization bars. Gives managers instant workload visibility without counting cards.

**Where**: New element in `renderWeekGrid()` output, computed from task data during render.

#### 15. Undo/Redo for Edits

No recovery path exists for destructive actions. Accidentally delete a manual task or overwrite a description — it's gone. A simple undo stack (5-10 operations) with Ctrl+Z/Ctrl+Y would provide a safety net. Each edit (task create/delete/move, description change) pushes an inverse operation onto the stack.

**Where**: New `src/core/undo-stack.js` module, integrated with Supabase write operations in task management and description editing.

### Medium Impact

#### 16. Project Pipeline Timeline View

Departments represent a production pipeline (Mill → Form Out → Cast → Batch → Demold → Layout → Finish → Seal → Crating → Load → Ship). A per-project Gantt-like timeline showing where each project currently sits in the pipeline would give managers a powerful at-a-glance view of production status. All data already exists — `dayNumber`, `totalDays`, department assignments per project.

**Where**: New view mode alongside the weekly grid, sharing the same data/state layer.

#### 17. Hover Quick Actions on Cards

The right-click context menu is a hidden affordance that many users never discover. Surface common actions (View Project, Log Hours) as small icon buttons that appear on card hover, matching the existing pattern used by Edit/Plan/Delete buttons when editing is unlocked.

**Where**: `task-card.js` (createTaskCard — add always-present hover action buttons), CSS for show-on-hover.

#### 18. "Today" Column Visual Anchor

Beyond the current `today-highlight` on the header date, add a subtle vertical stripe or background tint to today's entire column of cells. When scanning a dense week grid, the eye needs an anchor point. A light accent tint on all cells in today's column would provide this.

**Where**: CSS only — `week-renderer.js` already sets `data-date` on cells; add a `.today-column` class to cells matching today's date, style with a subtle background.

#### 19. Toast Notifications for Realtime Updates

When the Supabase broadcast channel fires a refresh, the grid silently re-renders. Users should know *why* the grid just changed. A brief toast notification ("Schedule updated by another user") provides context and prevents confusion.

**Where**: `src/core/refresh-handler.js` (broadcast listener), new lightweight toast component.

#### 20. Drag-and-Drop Across Weeks

Currently dragging manual tasks is limited to within a single week grid. Allowing cross-week dragging (or at minimum a "Move to week..." option in the context menu) would eliminate the delete-then-recreate workflow for rescheduling tasks.

**Where**: `src/features/drag-drop.js` (extend drop zone detection), context menu enhancement.

### Lower Effort Polish

#### 21. Keyboard Card Navigation

Arrow keys to move focus between cards within the grid (spatial navigation). Enter to open project modal for focused card. Tab already moves between interactive elements, but spatial arrow-key navigation maps better to a grid layout and is faster for power users.

**Where**: New keyboard handler in `keyboard-shortcuts.js`, focus management CSS (`:focus-visible` ring on cards).

#### 22. Empty Week State

When a week has zero tasks, show a friendly empty state message instead of just bare grid headers with no content. Something like "No tasks scheduled for this week" with a prompt to add tasks if editing is unlocked.

**Where**: `week-renderer.js` (renderWeekGrid — check if no departments have tasks).

#### 23. Print Preview Modal

The current print flow goes straight to `window.print()` after a 1500ms delay for scaling. A print preview within the app (showing the scaled pages in a modal before committing) would prevent wasted paper and let users adjust department selection or orientation.

**Where**: `src/features/print/print-renderer.js` (add preview step before `executePrint`), new preview modal.

#### 24. Search Result Navigation

The search bar shows results in a dropdown, but selecting a result doesn't visually highlight or scroll to the matching card in the grid. Clicking a search result should scroll to the relevant week and briefly pulse/highlight the matching card.

**Where**: `src/features/search.js` (result click handler), scroll-to-card logic, CSS pulse animation.

---

## What's Working Well

- **Batched read/write pattern** in `equalizeAllCardHeights()` — proper separation prevents layout thrashing
- **DocumentFragment** usage for batch DOM insertion
- **Two-frame RAF scheduling** — layout in frame 1, scroll in frame 2
- **Refresh queue** during editing prevents flicker
- **Delegated event handling** — robust against DOM changes
- **Idempotent drag cleanup** — safe to call multiple times
- **Error classification** with graceful fallbacks
- **Performance monitoring** with Core Web Vitals
- **Security-first rendering** — HTML sanitization with allowlisted tags for Batch/Layout descriptions
- **Realtime multi-user sync** — Supabase broadcast channel for cross-client invalidation
- **Dual data source merging** — Google Sheets + Supabase manual tasks merged seamlessly
- **Synthetic department generation** — Batch/Layout computed from Cast/Demold without extra data storage
- **Comprehensive print system** — 4 report types with auto-scaling and density-aware layouts
