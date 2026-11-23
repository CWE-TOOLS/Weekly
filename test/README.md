# Weekly view: test copy

A full copy of the weekly view for trying out changes before they go live.

| | URL |
|---|---|
| Live | https://cwe-tools.github.io/Weekly/ |
| Test | https://cwe-tools.github.io/Weekly/test/ |

## What is shared, what is separate

- **Separate:** all page code. `test/index.html` and `test/src/` are a copy. Editing them changes only the test page.
  `test/version.json` has its own stamp, so publishing a test change does not reload people on the live page.
- **Shared, deliberately:** the data. The test page reads the same Google Sheet and **reads and writes the same live
  Supabase database** as the live page. Dragging, editing, adding or deleting a task, or entering actual hours, on
  the test page changes the real schedule and refreshes everyone's screens. The orange banner at the top says so.
- **Shared:** browser settings (selected departments, viewed week, print choices), because both pages are on the same site.
- The Plant Scheduler, Project Portal and Batch tickets (week) buttons open the **live** versions of those pages.

## Differences from the live `index.html` / `src/`

Only these, so they are easy to skip when promoting:

- `test/index.html`: 🧪 tab icon, "TEST –" title, `noindex` meta, no manifest link, orange banner (hidden when
  printing), and `../` on the Plant Scheduler and Project Portal links.
- `test/src/core/button-handlers.js`: Batch tickets (week) opens `../week-batch-print.html`.

## Workflow

1. Build the change in `test/` (usually `test/src/...`). Bump `test/version.json` so open test tabs reload.
2. Commit and push to `main`. The test URL updates in about a minute; the live page is untouched.
3. The owner reviews at the test URL.
4. Once approved, copy the same change into the root `index.html` / `src/` (not the test-only differences above),
   bump the root `version.json`, then commit and push. The live page updates.
5. Re-sync the test copy from live before the next feature, so it doesn't drift.
   Copy `index.html` and `src/` over again and re-apply the test-only differences.

## Cranbury (second building, test only for now)

- **Rule:** a task is Cranbury when its task code (Sheet column F, `task.value`; `plant_schedule.task` on the
  scheduler path) ends in `-C` (`/-\s*C\s*$/i`). Crating and Load become `Crating (Cranbury)`; Seal, Special and
  Ship become `<Dept> (Cranbury)`. Other departments are left alone. The project name is never tested, and
  the displayed code is unchanged.
- **Helpers:** everything lives in `src/config/department-config.js`: `CRANBURY_DEPARTMENTS`, `isCranbury`,
  `buildingOf`, `dunhamsCounterpart`, `isCranburyTaskCode`, `cranburyDepartmentFor`, `applyBuilding` and
  `normalizeCranburyDepartment`. The latter is used by both `normalizeDepartment` copies (config + `ui-utils.js`).
- **Shared cache:** the parsed sheet cache (Supabase + localStorage) is shared with the live page, so the
  mapping is applied *after* the cache, on copies, in `sheets-service.js` `fetchTasks` (`withBuildings`).
  The cached data stays exactly what the live page parses.
- **Keys:** day numbers are counted per *sheet* department, and staging notes keep the sheet department
  (`stagingDepartment`), so notes match the live page. Actual hours are keyed on the Cranbury department.
- **Print pickers:** Week/Day/Buy-In selections store a `<key>_shown` record, so newly added entries
  (Cranbury) start ticked even when an older selection is saved.
