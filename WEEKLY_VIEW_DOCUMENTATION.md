# Weekly Schedule View: Detailed Data Flow and Process Documentation

## 1. Overview

This document provides an exhaustive, function-level breakdown of the data flow and rendering process for the main weekly schedule view. It details the precise order of operations, dependencies, and the specific implementation of the "Batch" and "Layout" departments.

The system aggregates data from multiple sources, processes it, and then renders a dynamic, week-by-week grid view. The process is initiated by a single call and flows through a chain of specialized modules.

## 2. Phase 1: Application Initialization and Data Sourcing

The entire process begins when the application is loaded. The central orchestrator is the **App Controller** ([`src/core/app-controller.js`](src/core/app-controller.js)).

### `initializeApp()` in `app-controller.js`

This is the main entry point for the application's startup sequence. It executes a series of phases to ensure all systems are ready before displaying data.

-   **Phase 1-4 (Setup):** Initializes core systems like error handling, restores the application's previous state (e.g., last viewed week), initializes data services (Google Sheets, Supabase), and prepares UI components.
-   **Phase 5 (Data Loading):** This is the key phase for our data flow. It calls `loadInitialData()` from [`initialization-orchestrator.js`](src/core/initialization-orchestrator.js), which in turn calls the primary data fetching function: `fetchAllTasks()` from the Data Service.

### `fetchAllTasks()` in `data-service.js`

This function is responsible for gathering all raw task data from the different sources.

1.  **Parallel Fetching:** It uses `Promise.all()` to simultaneously request data from two sources for maximum efficiency:
    *   `fetchSheetsTasks()` from [`sheets-service.js`](src/services/sheets-service.js): Fetches the primary list of tasks from the designated Google Sheet.
    *   `loadManualTasks()` from [`supabase-service.js`](src/services/supabase-service.js): Fetches all manually created, edited, or moved tasks from the Supabase database.

2.  **Data Merging with `mergeTasks()`:** Once both fetches are complete, the results are passed to the `mergeTasks()` function within the same module.
    *   **Logic:** It creates a `Set` of all task IDs from the `manualTasks` array. It then filters the `sheetsTasks` array, removing any task whose ID is present in the manual set. Finally, it concatenates the filtered sheets tasks with the manual tasks.
    *   **Outcome:** This ensures that any manually adjusted task in Supabase completely overrides its original version from Google Sheets.

3.  **Data Enrichment with `calculateProjectDayCounts()`:** The newly merged `allTasks` array is processed by this function.
    *   **Logic:** It iterates through each task, parses its date, and calculates a `dayCounter` string (e.g., "Day 2 of 5") if `dayNumber` and `totalDays` properties exist. It also flags tasks with invalid dates by setting a `missingDate` property to `true`.

4.  **State Update:** The final, merged, and enriched task list is passed to `setAllTasks()` in the global state manager ([`src/core/state.js`](src/core/state.js)). This action stores the data globally and, crucially, emits a `tasks:loaded` event, which signals the UI to begin the rendering process.

## 3. Phase 2: Rendering the Schedule Grid

The rendering process is triggered by the `tasks:loaded` event and is handled by the **Schedule Renderer**.

### `renderAllWeeks()` in `schedule-renderer.js`

This is the master function for drawing the entire multi-week schedule.

1.  **Data Preparation:** It retrieves the `filteredTasks` from the global state.
2.  **Group Tasks by Week:** It iterates through every task and groups them into a `tasksByWeek` object, where keys are the date string of the Monday of that week.
3.  **Generate Full Timeline:** It identifies the earliest and latest week with tasks and generates a complete list of all weeks in between, ensuring there are no gaps. Empty weeks are created if the timeline is not contiguous.
4.  **Calculate Max Tasks per Department (Row Normalization):** Before rendering, it performs a global calculation. For each department, it determines the single day with the most tasks across the entire schedule. This maximum number is stored in `maxTasksPerDept`. This is critical for ensuring that a department's row has a consistent height in every week's grid. For "Batch" and "Layout", this is hardcoded to `1`.
5.  **Render Each Week:** It iterates through the complete list of weeks and calls `renderWeekGrid()` for each one, passing the date and the `maxTasksPerDept` object.

### `renderWeekGrid()` in `week-renderer.js`

This function is responsible for creating the HTML structure for a single week.

1.  **Date Setup:** It calculates the six dates (Mon-Sat) for the given week.
2.  **Generate Synthetic Tasks:** It makes two critical calls to [`src/utils/schedule-utils.js`](src/utils/schedule-utils.js):
    *   `generateBatchTasks()`: Creates the tasks for the "Batch" department for this specific week.
    *   `generateLayoutTasks()`: Creates the tasks for the "Layout" department for this specific week.
3.  **Header Creation:** It calls `createHeaderRow()` to generate the HTML for the top row containing the day and date labels.
4.  **Task Grouping:** It calls `groupTasksByDepartment()`, which takes the filtered tasks for the week and the newly generated synthetic tasks and organizes them into a single object keyed by department name.
5.  **Department Row Rendering:** It iterates through a sorted list of departments. For each department, it:
    *   Groups the department's tasks by date using `groupTasksByDate()`.
    *   Uses the `maxTasksInRow` value (calculated earlier in `renderAllWeeks`) to determine how many grid rows this department will occupy.
    *   Creates the department label on the far left, spanning the required number of rows.
    *   For each day of the week and for each potential task slot (up to `maxTasksInRow`), it creates a grid cell.
    *   If a task exists for that slot, it calls `createTaskCard()` to generate the task's HTML.
    *   If no task exists, it calls `createTaskCardPlaceholder()` to create an empty, interactive placeholder.
6.  **Return Grid Element:** The fully constructed HTML element for the week's grid is returned to `renderAllWeeks()`.

## 4. Special Department Logic: `generateSpecialDepartmentTasks()`

This function in [`src/utils/schedule-utils.js`](src/utils/schedule-utils.js) is the core of the "Batch" and "Layout" department functionality.

-   **Input:** It receives the dates for a week, the department name ('Batch' or 'Layout'), and a function to access `allTasks`.
-   **Process:**
    1.  It iterates through the weekdays (Monday to Friday).
    2.  **For Mon-Thu:** It calculates the *next day's* date. It then filters the entire `allTasks` list to find tasks where the department is "Cast" and the date matches the next day. The project names from these tasks are collected.
    3.  **For Friday:** It performs the same process twice: once for the upcoming Saturday and once for the following Monday. The results are concatenated.
    4.  **Task Object Creation:** For each day, it creates a single "task" object. The `description` field of this object is populated with the list of "Cast" project names it found. If no projects were found, the description is empty.
-   **Output:** It returns an array of 5 synthetic task objects, one for each weekday, which are then integrated into the rendering process by `renderWeekGrid()`. This predictive display is a core feature enabling proactive planning for the Batch and Layout teams.

## 5. Analysis of Batch/Layout Initial Load Issue

The behavior where Batch and Layout cards fail to appear on the initial load but show up after toggling a filter is caused by a timing issue (race condition) between the initial data filtering and the initial render call.

### The Problem Flow:

1.  **`TASKS_LOADED` Event:** When `fetchAllTasks()` completes, it fires the `TASKS_LOADED` event.
2.  **Two Listeners Act Simultaneously:**
    *   **Listener A (`component-events.js`):** Immediately triggers `renderAllWeeks()` to build the UI. This render process uses the `filteredTasks` array *as it exists at that exact moment*.
    *   **Listener B (`department-filter.js`):** Hears the same event and calls `filterTasks(true)`. This `true` flag indicates a "silent" update.
3.  **State Updates Too Late:** The `filterTasks(true)` call correctly updates the global `filteredTasks` state based on the saved filter settings. However, the initial render (`Listener A`) has already started with the *old, pre-filtered* state.
4.  **Consequence:** The crucial `maxTasksPerDept` calculation in `renderAllWeeks()` runs on incomplete data. Because the synthetic Batch and Layout tasks are only generated *inside* the `renderWeekGrid` function (which runs later), they are not present in the global `filteredTasks` list that the initial calculations rely on. This results in their rows not being rendered correctly.
5.  **Why Toggling Works:** When you manually change the filter, `filterTasks()` is called *without* the silent flag. This updates the state *and then* emits a `DEPARTMENT_FILTERED` event. This event correctly triggers a **new** `renderAllWeeks()` call with the fully updated and correct state, causing the Batch and Layout cards to appear as expected.

### Proposed Solution:

The order of operations on initial load needs to be serialized. The initial filtering must complete *before* the initial render begins.

A potential solution would be to modify the event chain:

1.  On `TASKS_LOADED`, the `department-filter` should be the primary listener.
2.  It should run `filterTasks(true)` as it does now.
3.  After updating the state, instead of doing nothing, it should emit a new, secondary event, such as `INITIAL_FILTER_COMPLETE`.
4.  The `component-events.js` module should listen for `INITIAL_FILTER_COMPLETE` instead of `TASKS_LOADED` to trigger the first `renderAllWeeks()` call.

This would ensure the rendering process always begins with the correctly filtered data, resolving the initial load issue.