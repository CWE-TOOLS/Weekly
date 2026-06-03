/**
 * Project Portal Page
 * - List view: all projects (Supabase) merged with sheet-derived project numbers without records
 * - Form view: edit/save/delete/print a project record
 * @module pages/project-portal/project-portal-page
 */

import { logger } from '../../utils/logger.js';
import {
    loadAllProjects,
    loadProject,
    upsertProject,
    deleteProject,
    createEmptyProject,
    setProjectShipQtyMode
} from '../../services/projects-service.js';
import {
    loadCastings,
    createCasting,
    updateCasting,
    deleteCasting,
    setCastingsOrder
} from '../../services/castings-service.js';
import {
    loadAllCastingPhasesForProject,
    loadCastingPhases,
    createCastingPhase,
    renameCastingPhase,
    deleteCastingPhase,
    setCastingPhaseHours,
    setCastingPhaseDescription,
    setCastingPhaseOrder,
    replaceCastingPhases,
    seedDefaultPhasesForCasting
} from '../../services/optimizer-hours-service.js';
import {
    loadAllComponentsForProject,
    createComponentsBulk,
    deleteAllComponentsForCasting,
    setComponentProduced,
    setComponentsProducedBulk,
    setComponentRejected
} from '../../services/tracking-service.js';
import {
    loadCratesForProject,
    createCrate,
    updateCrate,
    deleteCrate,
    setCratesOrder,
    setComponentCrate,
    setComponentsCrateBulk
} from '../../services/shipping-service.js';
import {
    loadPhasesForProject,
    enablePhasesForProject,
    createPhase,
    renamePhase,
    deletePhase,
    setPhasesOrder,
    getPhaseUsageCounts
} from '../../services/phases-service.js';
import {
    loadMemosForProject,
    loadAllRecentMemos,
    createMemoForProject,
    updateMemo as updateJobMemo,
    deleteMemo as deleteJobMemo
} from '../../services/job-memos-service.js';
import {
    loadAllInventoryForProject,
    createInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    setInventoryOrder
} from '../../services/inventory-service.js';
import {
    loadColorLogForProject,
    loadColorLogsForProject,
    loadColorLogById,
    createColorLogForProject,
    deleteColorLog,
    getColorLogUsageCounts,
    saveColorLogForProject,
    loadPresets as loadColorLogPresets,
    saveAsPreset as saveColorLogAsPreset,
    updatePreset as updateColorLogPreset
} from '../../services/color-log-service.js';
import { enableMultiColorForProject } from '../../services/multi-color-service.js';
import {
    loadBatchTicketsForCastings,
    saveBatchTicketForCasting,
    emptyForm as emptyBatchTicketForm
} from '../../services/batch-ticket-service.js';
import {
    buildBatchPlan,
    getColorLogSandLbs,
    roundSig,
    FROM_LBS
} from '../../utils/batch-calc.js';
import { fetchAllTasks } from '../../services/data-service.js';
import { parseDate } from '../../utils/date-utils.js';
import {
    loadClassroomTasks,
    createClassroomTask,
    updateClassroomTask,
    deleteClassroomTask,
    setClassroomTasksOrder
} from '../../services/classroom-tasks-service.js';
import { renderCastingLayout } from './casting-layout.js?v=20260521-01';
import { attachLayoutDrag } from './casting-layout-drag.js?v=20260521-01';
import {
    loadLayoutPositions,
    snapshotLayout,
    clearLayoutPositions
} from '../../services/casting-layout-service.js';

const STATUS_SORT_ORDER = {
    'kicked off': 0,
    'releasability': 1,
    'approved': 2,
    'in production': 3,
    'shipped': 4,
    'closed out': 5
};

const FORM_FIELDS = [
    'project_number', 'project_name', 'status', 'pm', 'project_date', 'project_address',
    'estimator', 'architect',
    'contact_name', 'contact_phone', 'contact_company', 'contact_email',
    'site_contact', 'site_phone', 'delivery_address', 'site_restrictions',
    'need_by_date', 'production_start_date',
    'scope_of_work', 'imperative_information',
    'classroom_1_notes', 'classroom_2_notes', 'classroom_3_notes', 'cr_general_notes',
    'castings_notes', 'optimizer_notes', 'color_log_notes'
];

let allProjectRows = [];           // From Supabase
let currentProjectNumber = null;     // null = list view; string = form view
let currentFolderTab = 'projects';   // 'projects' | 'recent-memos' — top folder-tab strip
let recentMemos = [];                // cross-project memo feed for Recent Memos view
let recentMemosFilter = '';          // search filter applied client-side
let listSort = { column: 'status', direction: 'asc' };
let currentTab = 'info';             // 'info' | 'castings' | 'optimizer' | 'tracking' | 'shipping'
let currentClassroom = '1';          // CR Notes sub-tab: '1' | '2' | '3'
let currentClassroomTasks = [];      // all classroom tasks for current project (across all 3 classrooms)
let classroomTaskSaveTimers = new Map(); // taskId -> debounce handle
let classroomTasksSortables = { '1': null, '2': null, '3': null };
let currentCastings = [];            // loaded for current project
let currentOptCastingId = null;            // active casting in optimizer tab
let currentCastingPhases = new Map();      // castingId -> Array<phase row>
let copiedPhases = null;                   // Array<{phase_name, hours, sort_order, description}> from a copy action
let currentTrackExpanded = new Set();      // castingIds whose tracking sections are open
let currentCastingComponents = new Map();  // castingId -> Array<component row>
let currentCrates = [];                    // project_crates rows for current project (ordered)
let cratesLoadedFor = null;                // project_number we last loaded crates for
let crateSaveTimers = new Map();           // crateId -> debounce handle (per-field saves)
let currentShipExpanded = new Set();       // crateIds whose body is expanded on Shipping tab
let shipQtyModeGlobal = false;             // when true, all crate cards + packing lists render as type×qty rollups
let selectedComponentIds = new Set();      // tracking-tab multi-select for bulk crate assign
let lastTrackSelectionAnchor = null;       // last component_id single-clicked in Tracking (for shift-click range select)
let currentPhasesEnabled = false;          // mirrors projects.phases_enabled for the active project
let currentPhases = [];                    // project_phases rows (ordered) for active project
let phasesLoadedFor = null;                // project_number we last loaded phases for
let phaseRenameSaveTimers = new Map();     // phaseId -> debounce handle for rename
let currentPhaseId = null;                 // active phase for filtering across tabs (null = no phase / phases off)
// Production phases that can appear as columns on the tracking sheet.
// Order here is the order they'll print in. Editable per project via the chip bar.
const TRACKING_PHASES = ['MILL', 'FO', 'CAST', 'DEMOLD', 'FINISH', 'SEAL', 'STRIPS', 'DRILL', 'CRATE', 'FINAL', 'LOAD'];
let currentTrackingPhases = new Set(TRACKING_PHASES); // default: all phases tracked
// Tracks which project the phases above belong to, so switching projects resets defaults.
let trackingPhasesProject = null;
let currentCastInvExpanded = new Set();    // castingIds whose inventory sections are open (Castings tab)
let castInvExpandedProject = null;         // tracks which project the expanded-set defaults have been seeded for
let currentCastingInventory = new Map();   // castingId -> Array<inventory row>
let currentCastingInventoryLoadedFor = null; // project_number we last loaded inventory for
let inventorySaveTimers = new Map();       // itemId -> debounce handle
let copiedComponents = null;               // Array<{type,width,length,color,sealer,quantity,extras,cu_ft,ff_sq_ft}> from a copy action
let currentColorLog = null;                // form-shaped record (id null = unsaved) — currently active log when multi-color on
let currentColorLogs = [];                 // all non-preset color logs for this project (>=1 when project has any)
let currentColorLogId = null;              // id of the active log being edited in the Color Log tab
let currentMultiColorEnabled = false;      // mirrors projects.multi_color_enabled for the active project
let colorLogPresets = [];                  // cached preset rows
let colorLogSaveTimer = null;              // debounce timer
let colorLogLoadedFor = null;              // project_number we last loaded for
let currentJobMemos = [];                  // form-shaped memo records, sorted newest-first
let jobMemosLoadedFor = null;              // project_number we last loaded memos for
let jobMemoSaveTimers = new Map();         // memoId -> debounce handle (per-field edits)
let batchTickets = new Map();              // castingId -> form-shaped batch ticket record
let batchTicketsLoadedFor = null;          // project_number we last bulk-loaded for
let currentBatchCastingId = null;          // active casting in batch tickets tab
let batchTicketSaveTimers = new Map();     // castingId -> debounce handle
let projectInfoSaveTimer = null;           // debounce timer for project info form
let castingSaveTimers = new Map();         // castingId -> debounce handle for castings tab
let optimizerPhaseSaveTimers = new Map();  // phaseId -> debounce handle (hours / rename)
let optimizerDescSaveTimers = new Map();   // phaseId -> debounce handle (description)
let currentOptDescExpanded = new Set();    // phaseIds whose description editor is open

function getPhasesFor(castingId) {
    return currentCastingPhases.get(castingId) || [];
}

function setPhasesFor(castingId, phases) {
    currentCastingPhases.set(castingId, phases);
}

// ---------- View routing ----------

function getProjectFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('project');
}

function setProjectInUrl(projectNumber) {
    const url = new URL(window.location);
    if (projectNumber) {
        url.searchParams.set('project', projectNumber);
    } else {
        url.searchParams.delete('project');
    }
    history.pushState({}, '', url);
}

// Tab + folder-tab URL persistence. Uses replaceState so clicking through
// tabs doesn't pollute the browser back-stack — only entering / leaving the
// form view pushes (via setProjectInUrl).
function setTabInUrl(tab) {
    const url = new URL(window.location);
    if (tab && tab !== 'info') {
        url.searchParams.set('tab', tab);
    } else {
        url.searchParams.delete('tab');
    }
    history.replaceState({}, '', url);
}

function setViewInUrl(view) {
    const url = new URL(window.location);
    if (view && view !== 'projects') {
        url.searchParams.set('view', view);
    } else {
        url.searchParams.delete('view');
    }
    history.replaceState({}, '', url);
}

function getTabFromUrl() {
    return new URLSearchParams(window.location.search).get('tab');
}

function getViewFromUrl() {
    return new URLSearchParams(window.location.search).get('view');
}

const VALID_TABS = new Set([
    'info', 'job-memos', 'castings', 'optimizer', 'tracking',
    'casting-layout', 'shipping', 'color-log', 'batch-tickets', 'cr-notes'
]);

async function showListView() {
    // Flush any pending color-log save before leaving the form view.
    if (colorLogSaveTimer) {
        clearTimeout(colorLogSaveTimer);
        colorLogSaveTimer = null;
        try { await saveColorLogNow(); } catch (e) { /* error already logged */ }
    }
    // Flush all pending batch-ticket saves.
    await flushAllBatchTicketSaves();
    // Flush all pending job-memo saves.
    await flushAllJobMemoSaves();
    currentProjectNumber = null;
    document.getElementById('pp-list-view').hidden = false;
    document.getElementById('pp-form-view').hidden = true;
    const memosView = document.getElementById('pp-memos-view');
    if (memosView) memosView.hidden = true;
    setFolderTabActive('projects');
    setProjectInUrl(null);
    setTabInUrl(null);
    colorLogLoadedFor = null;
    currentColorLog = null;
    currentColorLogs = [];
    currentColorLogId = null;
    currentMultiColorEnabled = false;
    batchTicketsLoadedFor = null;
    batchTickets.clear();
    currentBatchCastingId = null;
    jobMemosLoadedFor = null;
    currentJobMemos = [];
    await refreshList();
}

async function showFormView(projectNumber, draftOverrides = null) {
    currentProjectNumber = projectNumber || null;
    document.getElementById('pp-list-view').hidden = true;
    document.getElementById('pp-form-view').hidden = false;
    const memosView = document.getElementById('pp-memos-view');
    if (memosView) memosView.hidden = true;
    setProjectInUrl(projectNumber);
    // Leaving the cross-project Recent Memos view as we drill into a project.
    setViewInUrl(null);

    // Invalidate color-log cache so we reload for the new project on next tab activation.
    colorLogLoadedFor = null;
    currentColorLog = null;
    currentColorLogs = [];
    currentColorLogId = null;
    currentMultiColorEnabled = false;
    if (colorLogSaveTimer) { clearTimeout(colorLogSaveTimer); colorLogSaveTimer = null; }

    // Invalidate batch-ticket cache.
    batchTicketsLoadedFor = null;
    batchTickets.clear();
    currentBatchCastingId = null;
    for (const t of batchTicketSaveTimers.values()) clearTimeout(t);
    batchTicketSaveTimers.clear();

    // Invalidate job-memos cache.
    jobMemosLoadedFor = null;
    currentJobMemos = [];
    for (const t of jobMemoSaveTimers.values()) clearTimeout(t);
    jobMemoSaveTimers.clear();

    // Invalidate shipping/crates cache.
    cratesLoadedFor = null;
    currentCrates = [];
    for (const t of crateSaveTimers.values()) clearTimeout(t);
    crateSaveTimers.clear();
    currentShipExpanded.clear();
    shipQtyModeGlobal = false;

    // Invalidate phases cache.
    phasesLoadedFor = null;
    currentPhases = [];
    currentPhasesEnabled = false;
    for (const t of phaseRenameSaveTimers.values()) clearTimeout(t);
    phaseRenameSaveTimers.clear();

    let project = null;
    let isExisting = false;
    if (projectNumber) {
        project = await loadProject(projectNumber);
        isExisting = !!project;
    }
    if (!project) {
        project = createEmptyProject(projectNumber || '');
    }
    if (draftOverrides && !isExisting) {
        Object.assign(project, draftOverrides);
    }
    populateForm(project);

    currentPhasesEnabled = !!project.phases_enabled;
    currentMultiColorEnabled = !!project.multi_color_enabled;
    shipQtyModeGlobal = !!project.ship_qty_mode;
    if (isExisting && currentPhasesEnabled) {
        try {
            currentPhases = await loadPhasesForProject(project.project_number);
            phasesLoadedFor = project.project_number;
        } catch (err) {
            logger.error('[project-portal] loadPhasesForProject failed:', err);
            currentPhases = [];
        }
    } else {
        currentPhases = [];
        phasesLoadedFor = null;
    }
    currentPhaseId = null;
    ensureValidCurrentPhase();
    renderPhasesSection();
    renderPhaseSwitcher();

    document.getElementById('pp-f-project_number').readOnly = isExisting;
    document.getElementById('pp-delete-btn').hidden = !isExisting;

    updateFormContext(project);
    setActiveTab(currentTab);

    if (projectNumber) {
        // Preload color logs so color-aware tabs (Casting Inventory, Tracking,
        // Shipping, Batch Tickets) render their dropdowns correctly on first
        // paint. Without this, refreshing onto Casting Inventory shows "Create
        // color log" placeholders even when a log exists, until the user
        // manually visits the Color Log tab.
        if (isExisting) await ensureColorLogsLoaded();
        await loadAndRenderCastings();
        await loadAndRenderClassroomTasks();
    } else {
        currentCastings = [];
        renderCastings();
        currentClassroomTasks = [];
        renderClassroomTasksAll();
    }

    // If the user is already on a data-loading tab, fire its activation now
    // so the right panel hydrates (this also handles URL-restored deep links
    // like ?project=X&tab=optimizer after the browser discards an idle tab).
    if (currentTab === 'color-log')    activateColorLogTab();
    if (currentTab === 'batch-tickets') activateBatchTicketsTab();
    if (currentTab === 'job-memos')    activateJobMemosTab();
    if (currentTab === 'optimizer')    activateOptimizerTab();
    if (currentTab === 'tracking')     activateTrackingTab();
    if (currentTab === 'casting-layout') activateCastingLayoutTab();
    if (currentTab === 'shipping')     activateShippingTab();
}

function openNewProjectModal() {
    const modal = document.getElementById('pp-new-modal');
    const numInput = document.getElementById('pp-new-modal-num');
    const nameInput = document.getElementById('pp-new-modal-name');
    const errEl = document.getElementById('pp-new-modal-num-err');
    numInput.value = '';
    nameInput.value = '';
    errEl.hidden = true;
    errEl.textContent = '';
    modal.hidden = false;
    setTimeout(() => numInput.focus(), 0);
}

function closeNewProjectModal() {
    document.getElementById('pp-new-modal').hidden = true;
}

async function handleCreateNewProject() {
    const numInput = document.getElementById('pp-new-modal-num');
    const nameInput = document.getElementById('pp-new-modal-name');
    const errEl = document.getElementById('pp-new-modal-num-err');
    const submitBtn = document.querySelector('#pp-new-modal-form button[type="submit"]');

    const num = numInput.value.trim();
    const name = nameInput.value.trim();

    if (!num) {
        errEl.textContent = 'Project # is required.';
        errEl.hidden = false;
        numInput.focus();
        return;
    }
    const conflict = allProjectRows.some(p => String(p.project_number || '').trim() === num);
    if (conflict) {
        errEl.textContent = `Project # "${num}" already exists.`;
        errEl.hidden = false;
        numInput.focus();
        return;
    }

    const draft = createEmptyProject(num);
    draft.project_name = name;

    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = 'Creating...';
    try {
        const saved = await upsertProject(draft);
        if (saved) {
            allProjectRows = [saved, ...allProjectRows];
        }
        closeNewProjectModal();
        showToast('Project created.');
        showFormView(num);
    } catch (err) {
        logger.error('[project-portal] create new project failed:', err);
        errEl.textContent = 'Create failed: ' + (err?.message || err);
        errEl.hidden = false;
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
    }
}

function updateFormContext(project) {
    const numEl = document.getElementById('pp-form-context-num');
    const nameEl = document.getElementById('pp-form-context-name');
    if (numEl) numEl.textContent = project.project_number || 'New Project';
    if (nameEl) nameEl.textContent = project.project_name || '';
}

function setActiveTab(tab) {
    if (currentTab === 'tracking' && tab !== 'tracking' && selectedComponentIds.size > 0) {
        selectedComponentIds.clear();
        const bar = document.getElementById('pp-track-bulk-bar');
        if (bar) bar.hidden = true;
    }
    if (currentTab === 'tracking' && tab !== 'tracking') lastTrackSelectionAnchor = null;
    currentTab = tab;
    document.querySelectorAll('.pp-tab-btn').forEach(btn => {
        btn.classList.toggle('pp-tab-active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.pp-tab-panel').forEach(panel => {
        const isActive = panel.dataset.panel === tab;
        panel.classList.toggle('pp-tab-panel-active', isActive);
        panel.hidden = !isActive;
    });
    // CR Notes textareas can't measure scrollHeight while hidden, so size them
    // once the panel becomes visible.
    if (tab === 'cr-notes') {
        // Make sure the active classroom sub-tab matches state, then size visible textareas.
        setActiveClassroom(currentClassroom);
    }
    const printBtn = document.getElementById('pp-print-btn');
    if (printBtn) {
        // Tracking + Shipping have per-row print buttons — hide the global one.
        // Job Memos has no print pipeline yet; Casting Layout has its own button.
        if (tab === 'tracking' || tab === 'shipping' || tab === 'job-memos' || tab === 'casting-layout') {
            printBtn.hidden = true;
        } else {
            printBtn.hidden = false;
            if (tab === 'batch-tickets') printBtn.textContent = 'Print Batch Tickets';
            else if (tab === 'color-log') printBtn.textContent = 'Print Color Log';
            else if (tab === 'optimizer') printBtn.textContent = 'Print Optimizer';
            else if (tab === 'info') printBtn.textContent = 'Print Cover';
            else printBtn.textContent = 'Print';
        }
    }

    if (tab === 'shipping' && currentProjectNumber) {
        activateShippingTab();
    }

    // Persist the active tab in the URL so a page reload (e.g. after the
    // browser discards an idle tab) restores the user where they left off.
    // Only meaningful when in form view — list view has its own URL state.
    if (currentProjectNumber) setTabInUrl(tab);
}

/**
 * Switch which classroom panel is visible inside the CR Notes tab.
 * @param {string} num - '1' | '2' | '3'
 */
function setActiveClassroom(num) {
    const target = String(num);
    currentClassroom = target;
    document.querySelectorAll('.pp-cr-subtab').forEach(btn => {
        const isActive = btn.dataset.classroom === target;
        btn.classList.toggle('pp-cr-subtab-active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    document.querySelectorAll('.pp-cr-classroom-panel').forEach(panel => {
        const isActive = panel.dataset.classroomPanel === target;
        panel.classList.toggle('pp-cr-classroom-panel-active', isActive);
        panel.hidden = !isActive;
    });
    // Size the now-visible classroom textarea + the always-visible General Notes.
    const activeTextarea = document.getElementById(`pp-f-classroom_${target}_notes`);
    if (activeTextarea) autoGrowTextarea(activeTextarea);
    const general = document.getElementById('pp-f-cr_general_notes');
    if (general) autoGrowTextarea(general);
}

// ---------- Data ----------

async function loadAllData() {
    const [projects, tasks] = await Promise.all([
        loadAllProjects(),
        fetchAllTasks(true).catch(err => {
            logger.warn('[project-portal] failed to fetch tasks for Opt. Ship Date:', err);
            return [];
        })
    ]);
    const shipDateByProject = buildShipDateMap(tasks);
    const startDateByProject = buildStartDateMap(tasks);
    allProjectRows = projects.map(p => ({
        ...p,
        opt_start_date: startDateByProject.get(String(p.project_number || '').trim()) || '',
        opt_ship_date: shipDateByProject.get(String(p.project_number || '').trim()) || ''
    }));
}

// Returns the *next upcoming* ship date per project — earliest "Ship…" row
// dated today-or-later. Past ship rows are ignored so orphan/old rows in the
// sheet don't pin a project to a stale date.
function buildShipDateMap(tasks) {
    const out = new Map();
    if (!Array.isArray(tasks)) return out;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    for (const t of tasks) {
        const num = String(t?.projectNumber || '').trim();
        if (!num) continue;
        const dept = String(t?.department || '').trim().toLowerCase();
        if (!dept.startsWith('ship')) continue;
        const date = String(t?.date || '').trim();
        if (!date) continue;
        const parsed = parseDate(date);
        if (!parsed || parsed.getTime() < todayMs) continue;
        const existing = out.get(num);
        if (!existing || compareDateStrings(date, existing) < 0) {
            out.set(num, date);
        }
    }
    return out;
}

function buildStartDateMap(tasks) {
    const out = new Map();
    if (!Array.isArray(tasks)) return out;
    for (const t of tasks) {
        const num = String(t?.projectNumber || '').trim();
        if (!num) continue;
        const date = String(t?.date || '').trim();
        if (!date) continue;
        const existing = out.get(num);
        if (!existing || compareDateStrings(date, existing) < 0) {
            out.set(num, date);
        }
    }
    return out;
}

function compareDateStrings(a, b) {
    const ta = Date.parse(a);
    const tb = Date.parse(b);
    if (!Number.isNaN(ta) && !Number.isNaN(tb)) return ta - tb;
    return a.localeCompare(b);
}

function formatListDate(value) {
    const s = (value ?? '').toString().trim();
    if (!s) return '';
    const d = parseDate(s);
    if (!d) return s;
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${mm}/${dd}/${yy}`;
}

async function refreshList() {
    const tbody = document.getElementById('pp-list-tbody');
    tbody.innerHTML = '<tr><td colspan="8" class="pp-empty">Loading projects...</td></tr>';

    await loadAllData();
    renderList(document.getElementById('pp-search').value);
}

function renderList(searchQuery = '') {
    const tbody = document.getElementById('pp-list-tbody');
    const q = (searchQuery || '').trim().toLowerCase();

    const sorted = allProjectRows.slice().sort((a, b) => {
        const col = listSort.column;
        const aVal = (a[col] ?? '').toString().toLowerCase();
        const bVal = (b[col] ?? '').toString().toLowerCase();
        // Empty values always go to the end regardless of direction
        if (aVal === '' && bVal !== '') return 1;
        if (bVal === '' && aVal !== '') return -1;
        let cmp;
        if (col === 'status') {
            const aRank = STATUS_SORT_ORDER[aVal] ?? 99;
            const bRank = STATUS_SORT_ORDER[bVal] ?? 99;
            cmp = aRank - bRank;
        } else {
            cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
        }
        return listSort.direction === 'asc' ? cmp : -cmp;
    });

    const filtered = q
        ? sorted.filter(r =>
            (r.project_number || '').toLowerCase().includes(q) ||
            (r.project_name || '').toLowerCase().includes(q))
        : sorted;

    // Reflect sort state on header cells
    document.querySelectorAll('th[data-sort-key]').forEach(th => {
        th.classList.remove('pp-sort-asc', 'pp-sort-desc');
        if (th.dataset.sortKey === listSort.column) {
            th.classList.add(listSort.direction === 'asc' ? 'pp-sort-asc' : 'pp-sort-desc');
        }
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="pp-empty">No projects yet. Click "+ New Project" to get started.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(row => {
        const status = row.status ? `<span class="pp-status-pill pp-status-${slug(row.status)}">${escapeHtml(row.status)}</span>` : '';
        return `
            <tr class="pp-row-clickable" data-project-number="${escapeAttr(row.project_number)}">
                <td>${status}</td>
                <td class="pp-cell-num"><strong>${escapeHtml(row.project_number)}</strong></td>
                <td>${escapeHtml(row.project_name || '')}</td>
                <td>${escapeHtml(row.pm || '')}</td>
                <td>${escapeHtml(formatListDate(row.project_date))}</td>
                <td>${escapeHtml(formatListDate(row.need_by_date))}</td>
                <td>${escapeHtml(formatListDate(row.opt_start_date))}</td>
                <td>${escapeHtml(formatListDate(row.opt_ship_date))}</td>
            </tr>
        `;
    }).join('');
}

// ---------- Form ----------

function populateForm(project) {
    for (const field of FORM_FIELDS) {
        const el = document.getElementById(`pp-f-${field}`);
        if (!el) continue;
        const v = project[field];
        el.value = (v === null || v === undefined) ? '' : v;
    }
    applyStatusColor();
    // Resize all auto-growing textareas (Project Info + CR Notes + tab-level notes) to fit their loaded content.
    document.querySelectorAll('.pp-section textarea, .pp-cr-textarea, .pp-tab-notes-textarea').forEach(autoGrowTextarea);
    // Load tracking phases for this project (NULL/missing = use full default set).
    if (Array.isArray(project.tracking_phases)) {
        currentTrackingPhases = new Set(project.tracking_phases.filter(p => TRACKING_PHASES.includes(p)));
    } else {
        currentTrackingPhases = new Set(TRACKING_PHASES);
    }
    trackingPhasesProject = project.project_number || null;
}

/**
 * Resize a textarea's height to fit its content.
 * The CSS min-height keeps empty fields from collapsing.
 */
function autoGrowTextarea(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
}

function applyStatusColor() {
    const sel = document.getElementById('pp-f-status');
    if (!sel) return;
    const states = ['pp-status-kicked-off', 'pp-status-releasability', 'pp-status-approved', 'pp-status-in-production', 'pp-status-shipped', 'pp-status-closed-out'];
    sel.classList.remove(...states);
    const cls = `pp-status-${slug(sel.value)}`;
    if (states.includes(cls)) sel.classList.add(cls);
}

function readForm() {
    const out = {};
    for (const field of FORM_FIELDS) {
        const el = document.getElementById(`pp-f-${field}`);
        if (!el) continue;
        out[field] = el.value.trim();
    }
    out.tracking_phases = [...currentTrackingPhases];
    return out;
}

async function handleSave({ silent = false } = {}) {
    const record = readForm();
    if (!record.project_number) {
        if (!silent) showToast('Project # is required.', 'error');
        return;
    }
    try {
        if (silent) setProjectInfoStatus('saving');
        const saved = await upsertProject(record);
        const wasNew = currentProjectNumber !== saved.project_number;
        currentProjectNumber = saved.project_number;
        setProjectInUrl(currentProjectNumber);
        document.getElementById('pp-f-project_number').readOnly = true;
        document.getElementById('pp-delete-btn').hidden = false;
        updateFormContext(saved);
        if (wasNew) {
            await loadAndRenderCastings();
        }
        if (silent) {
            setProjectInfoStatus('saved');
            setTimeout(() => setProjectInfoStatus(''), 1500);
        } else {
            showToast('Saved.');
        }
    } catch (err) {
        logger.error('[project-portal] save failed:', err);
        if (silent) setProjectInfoStatus('error');
        else showToast('Save failed: ' + (err.message || err), 'error');
    }
}

function setProjectInfoStatus(state) {
    const el = document.getElementById('pp-form-save-status');
    if (!el) return;
    if (state === 'saving') el.textContent = 'Saving…';
    else if (state === 'saved') el.textContent = 'Saved';
    else if (state === 'error') el.textContent = 'Save failed';
    else el.textContent = '';
}

function scheduleProjectInfoSave() {
    if (!currentProjectNumber) return;
    if (projectInfoSaveTimer) clearTimeout(projectInfoSaveTimer);
    setProjectInfoStatus('saving');
    projectInfoSaveTimer = setTimeout(() => handleSave({ silent: true }), 600);
}

function handleDelete() {
    if (!currentProjectNumber) return;
    openDeleteModal(currentProjectNumber);
}

function openDeleteModal(projectNumber) {
    const modal = document.getElementById('pp-delete-modal');
    const target = document.getElementById('pp-delete-modal-target');
    const confirmTarget = document.getElementById('pp-delete-modal-confirm-target');
    const input = document.getElementById('pp-delete-modal-input');
    const btn = document.getElementById('pp-delete-modal-confirm');
    if (!modal || !target || !input || !btn) return;
    target.textContent = projectNumber;
    confirmTarget.textContent = projectNumber;
    input.value = '';
    btn.disabled = true;
    modal.hidden = false;
    setTimeout(() => input.focus(), 0);
}

function closeDeleteModal() {
    const modal = document.getElementById('pp-delete-modal');
    if (modal) modal.hidden = true;
}

async function performDelete() {
    if (!currentProjectNumber) return;
    const btn = document.getElementById('pp-delete-modal-confirm');
    if (btn) { btn.disabled = true; btn.textContent = 'Deleting…'; }
    try {
        await deleteProject(currentProjectNumber);
        closeDeleteModal();
        if (btn) btn.textContent = 'Delete project';
        showToast('Deleted.');
        await showListView();
    } catch (err) {
        logger.error('[project-portal] delete failed:', err);
        if (btn) { btn.disabled = false; btn.textContent = 'Delete project'; }
        showToast('Delete failed: ' + (err.message || err), 'error');
    }
}

function handlePrint() {
    document.body.classList.add('pp-printing');
    setTimeout(() => {
        window.print();
        setTimeout(() => document.body.classList.remove('pp-printing'), 500);
    }, 50);
}

// ---------- Castings ----------

async function loadAndRenderCastings() {
    if (!currentProjectNumber) {
        currentCastings = [];
        currentCastingInventory = new Map();
        currentCastInvExpanded = new Set();
        castInvExpandedProject = null;
        currentCastingInventoryLoadedFor = null;
        renderCastings();
        return;
    }
    try {
        currentCastings = await loadCastings(currentProjectNumber);
    } catch (err) {
        logger.error('[project-portal] loadCastings failed:', err);
        currentCastings = [];
    }
    await loadAllInventoryForCurrentProject();
    // First time visiting this project's Castings tab in this session: seed
    // every casting as expanded EXCEPT those with more than the threshold of
    // inventory rows — those would push the rest off-screen, so default them
    // collapsed. Subsequent re-renders within the same project preserve the
    // user's collapse choices (clicking the chevron is sticky for the session).
    if (castInvExpandedProject !== currentProjectNumber) {
        currentCastInvExpanded = new Set(
            currentCastings
                .filter(c => getInventoryFor(c.id).length <= CAST_INV_AUTO_EXPAND_LIMIT)
                .map(c => c.id)
        );
        castInvExpandedProject = currentProjectNumber;
    }
    renderCastings();
}

// Castings with more than this many inventory rows default to collapsed when
// the user first lands on the Castings tab for a project.
const CAST_INV_AUTO_EXPAND_LIMIT = 10;

async function loadAllInventoryForCurrentProject() {
    const ids = currentCastings.map(c => c.id);
    try {
        currentCastingInventory = await loadAllInventoryForProject(ids);
        currentCastingInventoryLoadedFor = currentProjectNumber;
    } catch (err) {
        logger.error('[project-portal] loadAllInventoryForProject failed:', err);
        currentCastingInventory = new Map();
        for (const id of ids) currentCastingInventory.set(id, []);
    }
    // Drop expanded ids that no longer exist
    const validIds = new Set(ids);
    for (const id of [...currentCastInvExpanded]) {
        if (!validIds.has(id)) currentCastInvExpanded.delete(id);
    }
}

function getInventoryFor(castingId) {
    return currentCastingInventory.get(castingId) || [];
}

function setInventoryFor(castingId, items) {
    currentCastingInventory.set(castingId, items);
}

function getCastingsForActivePhase() {
    if (!currentPhasesEnabled) return currentCastings;
    if (!currentPhaseId) return [];
    return currentCastings.filter(c => c.phase_id === currentPhaseId);
}

function renderCastings() {
    const list = document.getElementById('pp-castings-list');
    const empty = document.getElementById('pp-castings-empty');
    const needsSave = document.getElementById('pp-castings-needs-save');
    const addRow = document.querySelector('.pp-castings-add');
    if (!list || !empty || !needsSave || !addRow) return;

    const hasProject = !!currentProjectNumber;
    needsSave.hidden = hasProject;
    addRow.style.display = hasProject ? '' : 'none';

    if (!hasProject) {
        list.hidden = true;
        empty.hidden = true;
        list.innerHTML = '';
        return;
    }

    const visible = getCastingsForActivePhase();
    if (visible.length === 0) {
        list.hidden = true;
        empty.hidden = false;
        list.innerHTML = '';
        return;
    }

    list.hidden = false;
    empty.hidden = true;
    list.innerHTML = visible.map(c => renderCastingCard(c)).join('');

    ensureCastingsSortable();
    ensureInventorySortables();
}

function renderCastingCard(c) {
    const isOpen = currentCastInvExpanded.has(c.id);
    const items = getInventoryFor(c.id);
    const totalQty = items.reduce((sum, it) => sum + (parseInt(it.quantity, 10) || 0) + (parseInt(it.extras, 10) || 0), 0);
    const countLabel = items.length === 0
        ? '0 components'
        : `${items.length} ${items.length === 1 ? 'type' : 'types'} · ${totalQty} pcs`;
    const hasComponentClipboard = Array.isArray(copiedComponents) && copiedComponents.length > 0;
    const copyDisabled = items.length === 0;

    return `
        <div class="pp-cast-card${isOpen ? ' pp-cast-card-open' : ''}" data-casting-id="${escapeAttr(c.id)}">
            <div class="pp-cast-card-header">
                <button type="button" class="pp-cast-card-chevron" data-action="toggle-inventory" aria-expanded="${isOpen}" title="${isOpen ? 'Collapse inventory' : 'Expand inventory'}">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"/>
                    </svg>
                </button>
                <div class="pp-cast-card-grip" aria-hidden="true" title="Drag to reorder">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/>
                        <circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>
                    </svg>
                </div>
                <div class="pp-cast-card-num">
                    <input type="text" class="pp-cast-card-num-input" data-field="casting_number" value="${escapeAttr(c.casting_number || '')}" />
                </div>
                <div class="pp-cast-card-desc">
                    <input type="text" class="pp-cast-card-desc-input" data-field="description" value="${escapeAttr(c.description || '')}" placeholder="(no description)" />
                </div>
                <span class="pp-cast-card-count">${countLabel}</span>
                <div class="pp-cast-card-actions">
                    <button class="pp-row-btn pp-row-btn-icon" data-action="copy-components" type="button" ${copyDisabled ? 'disabled' : ''} aria-label="Copy components" title="Copy components">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                    </button>
                    <button class="pp-row-btn pp-row-btn-icon" data-action="paste-components" type="button" ${hasComponentClipboard ? '' : 'disabled'} aria-label="Paste components" title="Paste components">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                        </svg>
                    </button>
                    <button class="pp-row-btn pp-row-btn-delete" data-action="delete" type="button" aria-label="Delete casting" title="Delete casting">&times;</button>
                </div>
            </div>
            ${isOpen ? renderInventoryBody(c, items) : ''}
        </div>
    `;
}

function renderInventoryBody(casting, items) {
    const cardsHtml = items.length === 0
        ? `<div class="pp-opt-cards-empty">No components yet. Add one below.</div>`
        : items.map(item => renderInventoryRow(item, casting.id)).join('');

    const headerRow = `
        <div class="pp-inv-header-row" aria-hidden="true">
            <div class="pp-inv-header-grip-spacer"></div>
            <div class="pp-inv-header-fields">
                <span class="pp-inv-header-qty">Qty</span>
                <span class="pp-inv-header-qty">Extras</span>
                <span>Type</span>
                <span>Width</span>
                <span>Length</span>
                <span>Color</span>
                <span class="pp-inv-header-num">Cu Ft</span>
                <span class="pp-inv-header-num">FF Sq Ft</span>
            </div>
            <div class="pp-inv-header-delete-spacer"></div>
        </div>
    `;

    return `
        <div class="pp-cast-card-body">
            ${headerRow}
            <div class="pp-inv-rows" data-casting-id="${escapeAttr(casting.id)}">
                ${cardsHtml}
            </div>
            <button type="button" class="pp-add-btn pp-inv-add" data-action="add-inventory" data-casting-id="${escapeAttr(casting.id)}">+ Add Component</button>
        </div>
    `;
}

function renderInventoryRow(item, castingId) {
    return `
        <div class="pp-inv-row" data-inventory-id="${escapeAttr(item.id)}" data-casting-id="${escapeAttr(castingId)}">
            <div class="pp-inv-row-grip" aria-hidden="true" title="Drag to reorder">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/>
                    <circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>
                </svg>
            </div>
            <div class="pp-inv-row-fields">
                <input type="number" class="pp-inv-input pp-inv-input-qty" data-field="quantity" min="1" step="1" value="${escapeAttr(item.quantity ?? 1)}" />
                <input type="number" class="pp-inv-input pp-inv-input-qty" data-field="extras" min="0" step="1" placeholder="0" value="${escapeAttr(item.extras ?? 0)}" />
                <input type="text" class="pp-inv-input" data-field="type" placeholder="Type" value="${escapeAttr(item.type || '')}" />
                <input type="text" class="pp-inv-input" data-field="width" placeholder="Width" value="${escapeAttr(item.width || '')}" />
                <input type="text" class="pp-inv-input" data-field="length" placeholder="Length" value="${escapeAttr(item.length || '')}" />
                ${buildColorLogSelectHtml(item.color_log_id, {
                    className: 'pp-inv-input pp-inv-color-select',
                    dataAttrs: { 'data-field': 'color_log_id' }
                })}
                <input type="number" class="pp-inv-input pp-inv-input-num" data-field="cu_ft" step="any" min="0" placeholder="0" value="${item.cu_ft == null ? '' : escapeAttr(item.cu_ft)}" />
                <input type="number" class="pp-inv-input pp-inv-input-num" data-field="ff_sq_ft" step="any" min="0" placeholder="0" value="${item.ff_sq_ft == null ? '' : escapeAttr(item.ff_sq_ft)}" />
            </div>
            <button class="pp-inv-row-delete" type="button" data-action="delete-inventory" aria-label="Delete component" title="Delete component">&times;</button>
        </div>
    `;
}

let castingsSortable = null;

function ensureCastingsSortable() {
    if (castingsSortable) {
        try { castingsSortable.destroy(); } catch {}
        castingsSortable = null;
    }
    if (typeof window.Sortable === 'undefined') return;
    const list = document.getElementById('pp-castings-list');
    if (!list) return;

    castingsSortable = window.Sortable.create(list, {
        animation: 180,
        easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
        handle: '.pp-cast-card-grip',
        draggable: '.pp-cast-card',
        ghostClass: 'pp-cast-card-ghost',
        chosenClass: 'pp-cast-card-chosen',
        dragClass: 'pp-cast-card-drag',
        forceFallback: true,
        fallbackTolerance: 4,
        scroll: true,
        scrollSensitivity: 60,
        scrollSpeed: 14,
        onEnd: async (evt) => {
            const oldIdx = evt.oldIndex;
            const newIdx = evt.newIndex;
            if (oldIdx === newIdx || oldIdx === undefined || newIdx === undefined) return;

            const reordered = currentCastings.slice();
            const [moved] = reordered.splice(oldIdx, 1);
            reordered.splice(newIdx, 0, moved);
            reordered.forEach((c, idx) => { c.sort_order = idx; });
            currentCastings = reordered;

            // Pills/columns in the optimizer tab read currentCastings,
            // so re-render if it's mounted.
            if (currentTab === 'optimizer') renderOptimizer();

            try {
                await setCastingsOrder(currentCastings.map(c => c.id));
                syncTrackingFromInventory();
            } catch (err) {
                logger.error('[project-portal] setCastingsOrder failed:', err);
                showToast('Reorder save failed: ' + (err.message || err), 'error');
                await loadAndRenderCastings();
            }
        }
    });
}

/**
 * Suggest the next casting_number based on the trailing-number pattern of
 * the last casting in the list. Preserves any prefix and leading zeros.
 *   []                  -> '1'
 *   ['1']               -> '2'
 *   ['A1']              -> 'A2'
 *   ['0001']            -> '0002'
 *   ['C-3']             -> 'C-4'
 *   ['foo']             -> ''   (no trailing digits, leave blank)
 */
function suggestNextCastingNumber(castings) {
    if (!Array.isArray(castings) || castings.length === 0) return '1';
    const last = castings[castings.length - 1]?.casting_number || '';
    const m = last.match(/^(.*?)(\d+)$/);
    if (!m) return '';
    const [, prefix, digits] = m;
    const next = String(Number(digits) + 1).padStart(digits.length, '0');
    return prefix + next;
}

async function handleAddCastingClick() {
    if (!currentProjectNumber) return;
    const list = document.getElementById('pp-castings-list');
    const empty = document.getElementById('pp-castings-empty');
    if (!list) return;

    // Cancel any existing draft
    list.querySelector('.pp-cast-card[data-draft="true"]')?.remove();

    const addBtn = document.getElementById('pp-cast-add-btn');
    // Suggestion + duplicate-check scope to the active phase when phases are on,
    // so each phase has its own 1, 2, 3... counter.
    const phaseScoped = getCastingsForActivePhase();
    const suggested = suggestNextCastingNumber(phaseScoped);

    // Fast path: when we have a valid auto-suggested number, create the
    // casting immediately. This avoids a draft state where rapid second
    // clicks could collide on the same suggested number.
    if (suggested) {
        if (phaseScoped.some(c => (c.casting_number || '').toLowerCase() === suggested.toLowerCase())) {
            // Suggestion already taken — fall through to manual draft input.
        } else {
            list.hidden = false;
            empty.hidden = true;
            if (addBtn) addBtn.disabled = true;
            try {
                const created = await createCasting({
                    project_number: currentProjectNumber,
                    casting_number: suggested,
                    description: '',
                    phase_id: currentPhasesEnabled ? currentPhaseId : null
                });
                if (created) {
                    currentCastings.push(created);
                    currentCastInvExpanded.add(created.id);
                }
                renderCastings();
                showToast('Casting added.');
                if (created) {
                    const newCard = list.querySelector(`.pp-cast-card[data-casting-id="${created.id}"]`);
                    const descInput = newCard?.querySelector('input[data-field="description"]');
                    descInput?.focus();
                }
            } catch (err) {
                logger.error('[project-portal] add casting failed:', err);
                const msg = (err.code === '23505') ? 'That casting # already exists.' : (err.message || 'Add failed');
                showToast(msg, 'error');
                if (currentCastings.length === 0) renderCastings();
            } finally {
                if (addBtn) addBtn.disabled = false;
            }
            return;
        }
    }

    list.hidden = false;
    empty.hidden = true;

    const card = document.createElement('div');
    card.className = 'pp-cast-card pp-cast-card-draft';
    card.dataset.draft = 'true';
    card.innerHTML = `
        <div class="pp-cast-card-header">
            <span class="pp-cast-card-chevron-spacer" aria-hidden="true"></span>
            <div class="pp-cast-card-grip" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/>
                    <circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>
                </svg>
            </div>
            <div class="pp-cast-card-num">
                <input type="text" class="pp-cast-card-num-input" data-field="casting_number" placeholder="Casting #" />
            </div>
            <div class="pp-cast-card-desc">
                <input type="text" class="pp-cast-card-desc-input" data-field="description" placeholder="Description (optional)" />
            </div>
            <div class="pp-cast-card-actions">
                <button class="pp-row-btn pp-row-btn-delete" data-action="cancel-draft" type="button" aria-label="Cancel">&times;</button>
            </div>
        </div>
    `;
    list.appendChild(card);

    const numInput = card.querySelector('input[data-field="casting_number"]');
    const descInput = card.querySelector('input[data-field="description"]');

    if (suggested) {
        numInput.value = suggested;
    }
    numInput.focus();
    numInput.select();

    let blurTimer = null;
    const cleanup = () => card.remove();

    const commit = async () => {
        const num = numInput.value.trim();
        const desc = descInput.value.trim();
        if (!num) {
            cleanup();
            if (currentCastings.length === 0) renderCastings();
            return;
        }
        if (getCastingsForActivePhase().some(c => (c.casting_number || '').toLowerCase() === num.toLowerCase())) {
            showToast(currentPhasesEnabled ? 'That casting # already exists in this phase.' : 'That casting # already exists for this project.', 'error');
            numInput.focus();
            return;
        }
        try {
            const created = await createCasting({
                project_number: currentProjectNumber,
                casting_number: num,
                description: desc,
                phase_id: currentPhasesEnabled ? currentPhaseId : null
            });
            if (created) {
                currentCastings.push(created);
                currentCastInvExpanded.add(created.id);
            }
            renderCastings();
            showToast('Casting added.');
        } catch (err) {
            logger.error('[project-portal] add casting failed:', err);
            const msg = (err.code === '23505') ? 'That casting # already exists.' : (err.message || 'Add failed');
            showToast(msg, 'error');
            cleanup();
        }
    };

    card.addEventListener('focusout', () => {
        clearTimeout(blurTimer);
        blurTimer = setTimeout(() => {
            if (!card.contains(document.activeElement)) commit();
        }, 100);
    });
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            (document.activeElement || numInput).blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            numInput.value = '';
            descInput.value = '';
            cleanup();
            if (currentCastings.length === 0) renderCastings();
        }
    });
    card.querySelector('button[data-action="cancel-draft"]').addEventListener('click', () => {
        numInput.value = '';
        descInput.value = '';
        cleanup();
        if (currentCastings.length === 0) renderCastings();
    });
}

// ---------- Add Remake Casting ----------
//
// "Add Remake Casting" creates a brand-new casting on the active project whose
// inventory mirrors the rejected panels pulled from one or more *existing*
// castings on this project. The user picks the source castings via checkbox;
// every rejected panel on a selected source is pulled in. The new casting
// gets a fresh, sequential casting_number and brand-new panel_ids — there is
// no back-link to the originals. The original rejected panels stay rejected
// on their source castings forever.

// Working state for the modal — refreshed each time it's opened.
let remakeModalSources = []; // [{ casting, rejected: [components] }]
let remakeModalSelected = new Set();

async function handleAddRemakeCastingClick() {
    if (!currentProjectNumber) return;
    if (currentCastings.length === 0) {
        showToast('No castings on this project yet.', 'error');
        return;
    }

    // Ensure components are loaded so we can read the rejected flag.
    await loadAllComponentsForCurrentProject();

    // Build the picker list: every casting with ≥1 rejected panel.
    remakeModalSources = currentCastings
        .slice()
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map(casting => {
            const comps = currentCastingComponents.get(casting.id) || [];
            const rejected = comps.filter(c => c.rejected);
            return { casting, rejected };
        })
        .filter(entry => entry.rejected.length > 0);

    remakeModalSelected = new Set();
    renderRemakeModal();

    const modal = document.getElementById('pp-remake-modal');
    if (modal) modal.hidden = false;
}

function renderRemakeModal() {
    const listEl = document.getElementById('pp-remake-modal-list');
    const emptyEl = document.getElementById('pp-remake-modal-empty');
    const submitBtn = document.getElementById('pp-remake-modal-submit');
    if (!listEl || !emptyEl || !submitBtn) return;

    if (remakeModalSources.length === 0) {
        listEl.innerHTML = '';
        emptyEl.hidden = false;
        submitBtn.disabled = true;
        return;
    }
    emptyEl.hidden = true;

    listEl.innerHTML = remakeModalSources.map(entry => {
        const id = entry.casting.id;
        const num = escapeHtml(entry.casting.casting_number || '');
        const desc = entry.casting.description ? ` — ${escapeHtml(entry.casting.description)}` : '';
        const n = entry.rejected.length;
        const isChecked = remakeModalSelected.has(id);
        return `
            <label class="pp-remake-row">
                <input type="checkbox" data-action="remake-source" data-casting-id="${escapeAttr(id)}" ${isChecked ? 'checked' : ''} />
                <span class="pp-remake-row-label">Casting ${num}${desc}</span>
                <span class="pp-remake-row-count">${n} rejected</span>
            </label>
        `;
    }).join('');

    submitBtn.disabled = remakeModalSelected.size === 0;
}

function closeRemakeModal() {
    const modal = document.getElementById('pp-remake-modal');
    if (modal) modal.hidden = true;
    remakeModalSources = [];
    remakeModalSelected = new Set();
}

/**
 * Aggregate selected sources' rejected panels into inventory lines.
 * Returns array of { type, width, length, color, color_log_id, sealer, quantity }.
 * Lines are grouped by the join of (type, width, length, color_log_id||color, sealer)
 * so that identical panels collapse to a single qty-N line — the same shape the
 * user would manually enter on the Castings tab.
 */
function aggregateRemakeInventory(selectedIds) {
    const groups = new Map();
    for (const entry of remakeModalSources) {
        if (!selectedIds.has(entry.casting.id)) continue;
        for (const c of entry.rejected) {
            const key = [
                c.type || '',
                c.width || '',
                c.length || '',
                c.color_log_id || c.color || '',
                c.sealer || ''
            ].join('|');
            const existing = groups.get(key);
            if (existing) {
                existing.quantity += 1;
            } else {
                groups.set(key, {
                    type: c.type || null,
                    width: c.width || null,
                    length: c.length || null,
                    color: c.color || null,
                    color_log_id: c.color_log_id || null,
                    sealer: c.sealer || null,
                    quantity: 1
                });
            }
        }
    }
    return Array.from(groups.values());
}

async function handleCreateRemakeSubmit() {
    if (!currentProjectNumber) return;
    const submitBtn = document.getElementById('pp-remake-modal-submit');
    if (remakeModalSelected.size === 0) return;

    const lines = aggregateRemakeInventory(remakeModalSelected);
    if (lines.length === 0) {
        showToast('No rejected panels in the selected castings.', 'error');
        return;
    }

    // Reserve a fresh casting number. Mirrors the auto-number logic used by
    // "Add Casting" so remakes slot into the same per-phase sequence.
    const phaseScoped = getCastingsForActivePhase();
    let suggested = suggestNextCastingNumber(phaseScoped);
    if (!suggested) suggested = String(phaseScoped.length + 1);
    if (phaseScoped.some(c => (c.casting_number || '').toLowerCase() === suggested.toLowerCase())) {
        // Walk forward until we find a free number.
        let n = parseInt(suggested, 10);
        if (!Number.isFinite(n)) n = phaseScoped.length + 1;
        while (phaseScoped.some(c => (c.casting_number || '') === String(n))) n++;
        suggested = String(n);
    }

    if (submitBtn) submitBtn.disabled = true;
    try {
        const sourceLabels = Array.from(remakeModalSelected)
            .map(id => remakeModalSources.find(e => e.casting.id === id)?.casting.casting_number)
            .filter(Boolean)
            .join(', ');
        const description = sourceLabels ? `Remake of Cast ${sourceLabels}` : 'Remake';
        const created = await createCasting({
            project_number: currentProjectNumber,
            casting_number: suggested,
            description,
            phase_id: currentPhasesEnabled ? currentPhaseId : null
        });
        if (!created) throw new Error('createCasting returned null');
        currentCastings.push(created);
        currentCastInvExpanded.add(created.id);
        // Seed empty caches for the new casting so the inventory write loop +
        // syncTrackingFromInventory both see it without a full reload.
        setInventoryFor(created.id, []);
        currentCastingComponents.set(created.id, []);

        // Write inventory lines sequentially so sort_order increments cleanly,
        // pushing each created row into the local cache the same way
        // handleAddInventoryItem does so the subsequent sync picks them up.
        for (let idx = 0; idx < lines.length; idx++) {
            const line = lines[idx];
            const createdLine = await createInventoryItem(created.id, { ...line, sort_order: idx });
            if (createdLine) {
                const list = getInventoryFor(created.id).slice();
                list.push(createdLine);
                setInventoryFor(created.id, list);
            }
        }

        closeRemakeModal();
        // Re-sync tracking from inventory so the new panel_ids materialize,
        // then re-render the Castings tab.
        await syncTrackingFromInventory();
        renderCastings();
        const totalPanels = lines.reduce((n, l) => n + l.quantity, 0);
        showToast(`Remake casting ${created.casting_number} created (${totalPanels} panel${totalPanels === 1 ? '' : 's'}).`);
    } catch (err) {
        logger.error('[project-portal] create remake casting failed:', err);
        const msg = (err.code === '23505') ? 'That casting # already exists.' : (err.message || 'Could not create remake casting.');
        showToast(msg, 'error');
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function handleSaveCasting(id) {
    const card = document.querySelector(`.pp-cast-card[data-casting-id="${id}"]`);
    if (!card) return;
    const numInput = card.querySelector('input[data-field="casting_number"]');
    const descInput = card.querySelector('input[data-field="description"]');
    const num = numInput.value.trim();
    const desc = descInput.value.trim();
    if (!num) return; // skip silently while empty; user is mid-edit
    try {
        const updated = await updateCasting(id, { casting_number: num, description: desc });
        if (updated) {
            const idx = currentCastings.findIndex(c => c.id === id);
            if (idx !== -1) currentCastings[idx] = updated;
        }
    } catch (err) {
        logger.error('[project-portal] save casting failed:', err);
        if (err.code === '23505') {
            // Conflict on casting_number — silent during typing; revert next render fixes it.
            return;
        }
        showToast('Save failed: ' + (err.message || err), 'error');
    }
}

function scheduleCastingSave(id) {
    if (!id) return;
    const prev = castingSaveTimers.get(id);
    if (prev) clearTimeout(prev);
    const t = setTimeout(() => handleSaveCasting(id), 600);
    castingSaveTimers.set(id, t);
}

async function handleDeleteCasting(id) {
    const c = currentCastings.find(x => x.id === id);
    if (!c) return;
    if (!confirm(`Delete casting ${c.casting_number}?`)) return;
    try {
        await deleteCasting(id);
        currentCastings = currentCastings.filter(x => x.id !== id);
        currentCastInvExpanded.delete(id);
        currentCastingInventory.delete(id);
        currentCastingComponents.delete(id);
        if (currentOptCastingId === id) {
            currentOptCastingId = currentCastings[0]?.id || null;
            currentOptHours = new Map();
        }
        renderCastings();
        showToast('Casting deleted.');
        syncTrackingFromInventory();
    } catch (err) {
        logger.error('[project-portal] delete casting failed:', err);
        showToast('Delete failed: ' + (err.message || err), 'error');
    }
}

// ---------- Casting inventory (expand/collapse on Castings tab) ----------

function handleToggleCastInventory(castingId) {
    if (currentCastInvExpanded.has(castingId)) currentCastInvExpanded.delete(castingId);
    else currentCastInvExpanded.add(castingId);
    renderCastings();
}

async function handleAddInventoryItem(castingId) {
    if (!currentProjectNumber || !castingId) return;
    if (!currentCastInvExpanded.has(castingId)) currentCastInvExpanded.add(castingId);
    try {
        // Auto-link to the project's first color log (if any) so new
        // components inherit it without the user having to pick.
        const defaultColorLogId = currentColorLogs[0]?.id || null;
        const created = await createInventoryItem(castingId, {
            quantity: 1,
            color_log_id: defaultColorLogId
        });
        if (created) {
            const list = getInventoryFor(castingId).slice();
            list.push(created);
            setInventoryFor(castingId, list);
        }
        renderCastings();
        // Focus the type input on the newest row
        const card = document.querySelector(`.pp-cast-card[data-casting-id="${castingId}"]`);
        const last = card?.querySelector('.pp-inv-row:last-of-type input[data-field="type"]');
        last?.focus();
        syncTrackingFromInventory();
    } catch (err) {
        logger.error('[project-portal] add inventory failed:', err);
        showToast('Add component failed: ' + (err.message || err), 'error');
    }
}

async function saveInventoryItem(itemId, castingId) {
    const row = document.querySelector(`.pp-inv-row[data-inventory-id="${itemId}"]`);
    if (!row) return;
    const list = getInventoryFor(castingId);
    const item = list.find(c => c.id === itemId);
    if (!item) return;

    const NUMERIC_FIELDS = new Set(['cu_ft', 'ff_sq_ft']);
    const fields = {};
    row.querySelectorAll('[data-field]').forEach(input => {
        const field = input.dataset.field;
        if (field === 'quantity') {
            const n = parseInt(input.value, 10);
            fields.quantity = (Number.isFinite(n) && n >= 1) ? n : 1;
        } else if (field === 'extras') {
            const n = parseInt(input.value, 10);
            fields.extras = (Number.isFinite(n) && n >= 0) ? n : 0;
        } else if (NUMERIC_FIELDS.has(field)) {
            const raw = (input.value || '').trim();
            if (raw === '') {
                fields[field] = null;
            } else {
                const n = parseFloat(raw);
                fields[field] = Number.isFinite(n) ? n : null;
            }
        } else if (field === 'color_log_id') {
            const v = input.value;
            fields.color_log_id = (v && v !== '') ? v : null;
        } else {
            const cleaned = (input.value || '').trim();
            fields[field] = cleaned === '' ? null : cleaned;
        }
    });

    // Diff against current state — skip the round-trip if nothing changed.
    const changed = {};
    for (const k of Object.keys(fields)) {
        const cur = (item[k] === undefined || item[k] === '') ? null : item[k];
        const next = (fields[k] === undefined || fields[k] === '') ? null : fields[k];
        if (cur !== next) changed[k] = fields[k];
    }
    if (Object.keys(changed).length === 0) return;

    try {
        const updated = await updateInventoryItem(itemId, changed);
        if (updated) Object.assign(item, updated);
        else Object.assign(item, changed);
        // Refresh the count label in the header without a full re-render.
        updateCastingInventoryCount(castingId);
        syncTrackingFromInventory();
    } catch (err) {
        logger.error('[project-portal] updateInventoryItem failed:', err);
        showToast('Save failed: ' + (err.message || err), 'error');
    }
}

function scheduleInventorySave(itemId, castingId) {
    if (!itemId) return;
    const prev = inventorySaveTimers.get(itemId);
    if (prev) clearTimeout(prev);
    const t = setTimeout(() => {
        inventorySaveTimers.delete(itemId);
        saveInventoryItem(itemId, castingId);
    }, 500);
    inventorySaveTimers.set(itemId, t);
}

function updateCastingInventoryCount(castingId) {
    const card = document.querySelector(`.pp-cast-card[data-casting-id="${castingId}"]`);
    if (!card) return;
    const countEl = card.querySelector('.pp-cast-card-count');
    if (!countEl) return;
    const items = getInventoryFor(castingId);
    const totalQty = items.reduce((sum, it) => sum + (parseInt(it.quantity, 10) || 0) + (parseInt(it.extras, 10) || 0), 0);
    countEl.textContent = items.length === 0
        ? '0 components'
        : `${items.length} ${items.length === 1 ? 'type' : 'types'} · ${totalQty} pcs`;
}

async function handleDeleteInventoryItem(castingId, itemId) {
    try {
        // Cancel any pending debounced save for this item.
        const t = inventorySaveTimers.get(itemId);
        if (t) { clearTimeout(t); inventorySaveTimers.delete(itemId); }
        await deleteInventoryItem(itemId);
        const list = getInventoryFor(castingId).filter(c => c.id !== itemId);
        setInventoryFor(castingId, list);
        renderCastings();
        syncTrackingFromInventory();
    } catch (err) {
        logger.error('[project-portal] deleteInventoryItem failed:', err);
        showToast('Delete failed: ' + (err.message || err), 'error');
    }
}

let inventorySortables = [];

function ensureInventorySortables() {
    inventorySortables.forEach(s => { try { s.destroy(); } catch {} });
    inventorySortables = [];
    if (typeof window.Sortable === 'undefined') return;

    document.querySelectorAll('#pp-castings-list .pp-cast-card-body .pp-inv-rows').forEach(el => {
        const castingId = el.dataset.castingId;
        if (!castingId) return;
        const s = window.Sortable.create(el, {
            animation: 180,
            easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
            handle: '.pp-inv-row-grip',
            draggable: '.pp-inv-row',
            ghostClass: 'pp-inv-row-ghost',
            chosenClass: 'pp-inv-row-chosen',
            dragClass: 'pp-inv-row-drag',
            forceFallback: true,
            fallbackTolerance: 4,
            scroll: true,
            scrollSensitivity: 60,
            scrollSpeed: 14,
            onEnd: async (evt) => {
                const oldIdx = evt.oldIndex;
                const newIdx = evt.newIndex;
                if (oldIdx === newIdx || oldIdx === undefined || newIdx === undefined) return;
                const list = getInventoryFor(castingId).slice();
                const [moved] = list.splice(oldIdx, 1);
                list.splice(newIdx, 0, moved);
                list.forEach((c, idx) => { c.sort_order = idx; });
                setInventoryFor(castingId, list);
                try {
                    await setInventoryOrder(list.map(c => c.id));
                    syncTrackingFromInventory();
                } catch (err) {
                    logger.error('[project-portal] setInventoryOrder failed:', err);
                    showToast('Reorder save failed: ' + (err.message || err), 'error');
                    renderCastings();
                }
            }
        });
        inventorySortables.push(s);
    });
}

// ---------- Classroom Tasks (CR Notes tab) ----------

async function loadAndRenderClassroomTasks() {
    if (!currentProjectNumber) {
        currentClassroomTasks = [];
        renderClassroomTasksAll();
        return;
    }
    try {
        currentClassroomTasks = await loadClassroomTasks(currentProjectNumber);
    } catch (err) {
        logger.error('[project-portal] loadClassroomTasks failed:', err);
        currentClassroomTasks = [];
    }
    renderClassroomTasksAll();
}

function renderClassroomTasksAll() {
    ['1', '2', '3'].forEach(num => renderClassroomTasks(num));
}

function renderClassroomTasks(num) {
    const list = document.getElementById(`pp-cr-tasks-list-${num}`);
    const empty = document.getElementById(`pp-cr-tasks-empty-${num}`);
    const needsSave = document.getElementById(`pp-cr-tasks-needs-save-${num}`);
    if (!list || !empty || !needsSave) return;

    if (!currentProjectNumber) {
        needsSave.hidden = false;
        empty.hidden = true;
        list.hidden = true;
        list.innerHTML = '';
        return;
    }
    needsSave.hidden = true;

    const tasks = currentClassroomTasks
        .filter(t => Number(t.classroom) === Number(num))
        .sort((a, b) => {
            const ao = a.sort_order ?? 0;
            const bo = b.sort_order ?? 0;
            if (ao !== bo) return ao - bo;
            return (a.created_at || '').localeCompare(b.created_at || '');
        });

    if (tasks.length === 0) {
        list.hidden = true;
        empty.hidden = false;
        list.innerHTML = '';
        return;
    }

    list.hidden = false;
    empty.hidden = true;
    list.innerHTML = tasks.map(t => `
        <div class="pp-cr-task-card${t.is_completed ? ' is-completed' : ''}" data-task-id="${escapeAttr(t.id)}">
            <div class="pp-cr-task-grip" aria-hidden="true" title="Drag to reorder">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/>
                    <circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>
                </svg>
            </div>
            <input type="checkbox" class="pp-cr-task-check" data-field="is_completed" ${t.is_completed ? 'checked' : ''} aria-label="Mark complete" />
            <div class="pp-cr-task-desc">
                <input type="text" class="pp-cr-task-desc-input" data-field="description" value="${escapeAttr(t.description || '')}" placeholder="Task description" />
            </div>
            <div class="pp-cr-task-assignee">
                <input type="text" class="pp-cr-task-assignee-input" data-field="assignee" value="${escapeAttr(t.assignee || '')}" placeholder="Assignee" />
            </div>
            <div class="pp-cr-task-actions">
                <button class="pp-row-btn pp-row-btn-delete" data-action="delete" type="button" aria-label="Delete task" title="Delete task">&times;</button>
            </div>
        </div>
    `).join('');

    ensureClassroomTasksSortable(num);
}

function ensureClassroomTasksSortable(num) {
    const existing = classroomTasksSortables[num];
    if (existing) {
        try { existing.destroy(); } catch {}
        classroomTasksSortables[num] = null;
    }
    if (typeof window.Sortable === 'undefined') return;
    const list = document.getElementById(`pp-cr-tasks-list-${num}`);
    if (!list) return;

    classroomTasksSortables[num] = window.Sortable.create(list, {
        animation: 180,
        easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
        handle: '.pp-cr-task-grip',
        draggable: '.pp-cr-task-card',
        ghostClass: 'pp-cr-task-card-ghost',
        chosenClass: 'pp-cr-task-card-chosen',
        dragClass: 'pp-cr-task-card-drag',
        forceFallback: true,
        fallbackTolerance: 4,
        scroll: true,
        scrollSensitivity: 60,
        scrollSpeed: 14,
        onEnd: async (evt) => {
            const oldIdx = evt.oldIndex;
            const newIdx = evt.newIndex;
            if (oldIdx === newIdx || oldIdx === undefined || newIdx === undefined) return;

            // Reorder within this classroom only.
            const inClassroom = currentClassroomTasks.filter(t => Number(t.classroom) === Number(num));
            const others = currentClassroomTasks.filter(t => Number(t.classroom) !== Number(num));
            const reordered = inClassroom.slice();
            const [moved] = reordered.splice(oldIdx, 1);
            reordered.splice(newIdx, 0, moved);
            reordered.forEach((t, idx) => { t.sort_order = idx; });
            currentClassroomTasks = [...others, ...reordered];

            try {
                await setClassroomTasksOrder(reordered.map(t => t.id));
            } catch (err) {
                logger.error('[project-portal] setClassroomTasksOrder failed:', err);
                showToast('Reorder save failed: ' + (err.message || err), 'error');
                await loadAndRenderClassroomTasks();
            }
        }
    });
}

async function handleAddClassroomTaskClick(num) {
    if (!currentProjectNumber) return;
    const inClassroom = currentClassroomTasks.filter(t => Number(t.classroom) === Number(num));
    const sortOrder = inClassroom.length > 0
        ? Math.max(...inClassroom.map(t => t.sort_order ?? 0)) + 1
        : 0;
    try {
        const created = await createClassroomTask({
            project_number: currentProjectNumber,
            classroom: Number(num),
            description: '',
            assignee: '',
            is_completed: false,
            sort_order: sortOrder
        });
        if (created) {
            currentClassroomTasks.push(created);
            renderClassroomTasks(num);
            // Focus the new task's description input for immediate typing.
            const card = document.querySelector(`.pp-cr-task-card[data-task-id="${created.id}"]`);
            const descInput = card?.querySelector('input[data-field="description"]');
            if (descInput) descInput.focus();
        }
    } catch (err) {
        logger.error('[project-portal] add classroom task failed:', err);
        showToast('Add task failed: ' + (err.message || err), 'error');
    }
}

async function handleSaveClassroomTask(id) {
    const card = document.querySelector(`.pp-cr-task-card[data-task-id="${id}"]`);
    if (!card) return;
    const descInput = card.querySelector('input[data-field="description"]');
    const assigneeInput = card.querySelector('input[data-field="assignee"]');
    const checkInput = card.querySelector('input[data-field="is_completed"]');
    const fields = {
        description: (descInput?.value || '').trim(),
        assignee: (assigneeInput?.value || '').trim(),
        is_completed: !!checkInput?.checked
    };
    try {
        const updated = await updateClassroomTask(id, fields);
        if (updated) {
            const idx = currentClassroomTasks.findIndex(t => t.id === id);
            if (idx !== -1) currentClassroomTasks[idx] = updated;
        }
    } catch (err) {
        logger.error('[project-portal] save classroom task failed:', err);
        showToast('Save failed: ' + (err.message || err), 'error');
    }
}

function scheduleClassroomTaskSave(id) {
    if (!id) return;
    const prev = classroomTaskSaveTimers.get(id);
    if (prev) clearTimeout(prev);
    const t = setTimeout(() => handleSaveClassroomTask(id), 600);
    classroomTaskSaveTimers.set(id, t);
}

async function handleToggleClassroomTaskComplete(id, checked) {
    // Reflect immediately in DOM (strikethrough) for snappy feedback.
    const card = document.querySelector(`.pp-cr-task-card[data-task-id="${id}"]`);
    if (card) card.classList.toggle('is-completed', !!checked);
    // Persist with no debounce — toggles are deliberate.
    try {
        const updated = await updateClassroomTask(id, { is_completed: !!checked });
        if (updated) {
            const idx = currentClassroomTasks.findIndex(t => t.id === id);
            if (idx !== -1) currentClassroomTasks[idx] = updated;
        }
    } catch (err) {
        logger.error('[project-portal] toggle classroom task failed:', err);
        showToast('Save failed: ' + (err.message || err), 'error');
    }
}

async function handleDeleteClassroomTask(id) {
    const t = currentClassroomTasks.find(x => x.id === id);
    if (!t) return;
    const label = (t.description || '').trim() || 'this task';
    if (!confirm(`Delete "${label}"?`)) return;
    try {
        await deleteClassroomTask(id);
        currentClassroomTasks = currentClassroomTasks.filter(x => x.id !== id);
        renderClassroomTasks(String(t.classroom));
        showToast('Task deleted.');
    } catch (err) {
        logger.error('[project-portal] delete classroom task failed:', err);
        showToast('Delete failed: ' + (err.message || err), 'error');
    }
}

// ---------- Optimizer Hours ----------

async function activateOptimizerTab() {
    const needsSave = document.getElementById('pp-opt-needs-save');
    const noCastings = document.getElementById('pp-opt-no-castings');
    const editor = document.getElementById('pp-opt-editor');

    if (!currentProjectNumber) {
        needsSave.hidden = false;
        noCastings.hidden = true;
        editor.hidden = true;
        return;
    }
    needsSave.hidden = true;

    if (currentCastings.length === 0) {
        try { currentCastings = await loadCastings(currentProjectNumber); } catch (e) { /* ignore */ }
    }

    const phaseScoped = getCastingsForActivePhase();
    if (phaseScoped.length === 0) {
        noCastings.hidden = false;
        editor.hidden = true;
        return;
    }
    noCastings.hidden = true;
    editor.hidden = false;

    if (!currentOptCastingId || !phaseScoped.find(c => c.id === currentOptCastingId)) {
        currentOptCastingId = phaseScoped[0].id;
    }
    await loadAllPhasesForProject();
    renderOptimizer();
}

async function loadAllPhasesForProject() {
    const ids = currentCastings.map(c => c.id);
    try {
        currentCastingPhases = await loadAllCastingPhasesForProject(ids);
    } catch (err) {
        logger.error('[project-portal] loadAllCastingPhasesForProject failed:', err);
        currentCastingPhases = new Map();
        for (const id of ids) currentCastingPhases.set(id, []);
    }

    // First-time seed: any casting with zero phases gets the default list.
    const seedTargets = ids.filter(id => (currentCastingPhases.get(id) || []).length === 0);
    if (seedTargets.length > 0) {
        await Promise.all(seedTargets.map(async id => {
            try {
                const seeded = await seedDefaultPhasesForCasting(id);
                currentCastingPhases.set(id, seeded);
            } catch (err) {
                logger.error('[project-portal] seedDefaultPhasesForCasting failed:', err);
            }
        }));
    }

    // Auto-expand any phase card that already has a description so notes
    // are never hidden behind a chevron on a fresh load. Replace the Set
    // outright (rather than union) so it resets when switching projects.
    currentOptDescExpanded = new Set();
    for (const phases of currentCastingPhases.values()) {
        for (const p of phases) {
            if ((p.description || '').trim()) currentOptDescExpanded.add(p.id);
        }
    }
}

function renderOptimizer() {
    renderOptPills();
    renderOptColumns();
    renderOptTotals();
    ensurePhaseSortable();
    // Size the visible description textareas to fit their content. Hidden
    // (collapsed) cards have display:none so scrollHeight reads 0 — those
    // are sized on toggle-open instead.
    document.querySelectorAll('.pp-opt-card-expanded textarea[data-action="description"]').forEach(autoGrowTextarea);
}

function getVisibleCastings() {
    const list = getCastingsForActivePhase();
    const total = list.length;
    if (total === 0) return [];
    const activeIdx = list.findIndex(c => c.id === currentOptCastingId);
    if (total <= 3) return list.slice();
    if (activeIdx <= 0) return list.slice(0, 3);
    if (activeIdx >= total - 1) return list.slice(total - 3);
    return list.slice(activeIdx - 1, activeIdx + 2);
}

function renderOptPills() {
    const wrap = document.getElementById('pp-opt-pills');
    if (!wrap) return;

    const list = getCastingsForActivePhase();
    const total = list.length;
    if (total === 0) { wrap.innerHTML = ''; return; }

    const activeIdx = list.findIndex(c => c.id === currentOptCastingId);
    const visible = getVisibleCastings();
    const canPrev = activeIdx > 0;
    const canNext = activeIdx >= 0 && activeIdx < total - 1;

    const pills = visible.map(c => {
        const active = c.id === currentOptCastingId ? ' pp-opt-pill-active' : '';
        return `<button type="button" class="pp-opt-pill${active}" data-casting-id="${escapeAttr(c.id)}">${escapeHtml(c.casting_number || '')}</button>`;
    }).join('');

    wrap.innerHTML = `
        <button type="button" class="pp-opt-nav-btn" data-action="prev" ${canPrev ? '' : 'disabled'} aria-label="Previous casting">&lsaquo;</button>
        ${pills}
        <button type="button" class="pp-opt-nav-btn" data-action="next" ${canNext ? '' : 'disabled'} aria-label="Next casting">&rsaquo;</button>
    `;
}

function renderOptColumns() {
    const wrap = document.getElementById('pp-opt-columns');
    if (!wrap) return;

    const visible = getVisibleCastings();
    if (visible.length === 0) { wrap.innerHTML = ''; return; }

    wrap.innerHTML = visible.map(c => renderOptColumn(c)).join('');
    wrap.style.gridTemplateColumns = `repeat(${visible.length}, minmax(0, 1fr))`;
}

function renderOptColumn(casting) {
    const isActive = casting.id === currentOptCastingId;
    const colClass = isActive ? 'pp-opt-col pp-opt-col-active' : 'pp-opt-col';
    const phases = getPhasesFor(casting.id);

    let cardsHtml;
    if (phases.length === 0) {
        cardsHtml = `<div class="pp-opt-cards-empty">No tasks yet. Add one below.</div>`;
    } else {
        cardsHtml = phases.map(p => {
            // Render 0 as empty so the placeholder="0" carries the visual — users no longer
            // have to delete the leading 0 before typing a real value.
            const value = (p.hours === undefined || p.hours === null || p.hours === 0) ? '' : String(p.hours);
            const description = (p.description == null) ? '' : String(p.description);
            const hasDesc = description.trim().length > 0;
            const isExpanded = currentOptDescExpanded.has(p.id);
            const cardCls = `pp-opt-card${isExpanded ? ' pp-opt-card-expanded' : ''}${hasDesc ? ' pp-opt-card-has-desc' : ''}`;
            const toggleLabel = isExpanded ? 'Hide description' : (hasDesc ? 'Show description' : 'Add description');
            // Drag grip stays gated to the active column — SortableJS attaches to one column at a time.
            const grip = isActive ? `
                <div class="pp-opt-card-grip" aria-hidden="true" title="Drag to reorder">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/>
                        <circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>
                    </svg>
                </div>` : '';
            const nameField = `<input type="text" class="pp-opt-card-name" data-action="rename" value="${escapeAttr(p.phase_name)}" />`;
            const toggleBtn = `<button class="pp-opt-card-desc-toggle" type="button" data-action="toggle-desc" aria-label="${escapeAttr(toggleLabel)}" title="${escapeAttr(toggleLabel)}" aria-expanded="${isExpanded ? 'true' : 'false'}">
                <svg class="pp-opt-card-desc-chev" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                </svg>
            </button>`;
            const deleteBtn = `<button class="pp-opt-card-delete" type="button" data-action="delete-phase" aria-label="Delete task" title="Delete task">&times;</button>`;
            const descField = `<textarea class="pp-opt-card-desc" data-action="description" rows="3" placeholder="Add notes for this task…">${escapeHtml(description)}</textarea>`;
            return `
                <div class="${cardCls}" data-phase-id="${escapeAttr(p.id)}" data-casting-id="${escapeAttr(casting.id)}">
                    <div class="pp-opt-card-row">
                        ${grip}
                        <div class="pp-opt-card-left">${nameField}</div>
                        <div class="pp-opt-card-right">
                            <input type="number" min="0" step="1" class="pp-opt-card-hours" data-action="hours" value="${escapeAttr(value)}" placeholder="0" />
                            <span class="pp-opt-card-hours-label">hrs</span>
                            ${toggleBtn}
                            ${deleteBtn}
                        </div>
                    </div>
                    <div class="pp-opt-card-desc-wrap">${descField}</div>
                </div>
            `;
        }).join('');
    }

    const hasClipboard = Array.isArray(copiedPhases) && copiedPhases.length > 0;
    const copyTitle = `Copy hours from Cast ${casting.casting_number || ''}`;
    const pasteTitle = hasClipboard
        ? `Paste hours into Cast ${casting.casting_number || ''}`
        : 'Nothing copied yet';

    return `
        <div class="${colClass}" data-casting-id="${escapeAttr(casting.id)}">
            <div class="pp-opt-col-headerbar">
                <button type="button" class="pp-opt-col-header" data-action="select-col" data-casting-id="${escapeAttr(casting.id)}">
                    <span class="pp-opt-col-label">Cast</span>
                    <span class="pp-opt-col-num">${escapeHtml(casting.casting_number || '')}</span>
                </button>
                <div class="pp-opt-col-actions">
                    <button type="button" class="pp-opt-col-action" data-action="copy-hours" data-casting-id="${escapeAttr(casting.id)}" aria-label="${escapeAttr(copyTitle)}" title="${escapeAttr(copyTitle)}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                    </button>
                    <button type="button" class="pp-opt-col-action" data-action="paste-hours" data-casting-id="${escapeAttr(casting.id)}" ${hasClipboard ? '' : 'disabled'} aria-label="${escapeAttr(pasteTitle)}" title="${escapeAttr(pasteTitle)}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="pp-opt-cards" data-casting-id="${escapeAttr(casting.id)}">
                ${cardsHtml}
            </div>
            <button type="button" class="pp-add-btn pp-opt-col-add" data-action="add-task" data-casting-id="${escapeAttr(casting.id)}">+ Add Task</button>
            <div class="pp-opt-col-total">
                <span class="pp-opt-col-total-label">Total</span>
                <span class="pp-opt-col-total-value"><strong data-col-total="${escapeAttr(casting.id)}">0</strong> hrs</span>
            </div>
        </div>
    `;
}

function renderOptTotals() {
    const sumPhases = (phases) => {
        let total = 0;
        for (const p of phases) if (typeof p.hours === 'number') total += p.hours;
        return total;
    };

    // Per-column totals (visible columns only)
    document.querySelectorAll('[data-col-total]').forEach(el => {
        const castingId = el.getAttribute('data-col-total');
        el.textContent = String(sumPhases(getPhasesFor(castingId)));
    });

    // Grand/Phase total — for phased projects, sum only the active phase's
    // castings so the bottom total reflects the phase you're viewing.
    const grandEl = document.getElementById('pp-opt-grand-total');
    if (grandEl) {
        let grand = 0;
        if (currentPhasesEnabled) {
            for (const c of getCastingsForActivePhase()) {
                grand += sumPhases(getPhasesFor(c.id));
            }
        } else {
            for (const phases of currentCastingPhases.values()) {
                grand += sumPhases(phases);
            }
        }
        grandEl.textContent = String(grand);
    }

    // Match the label to what the number actually represents.
    const labelEl = document.querySelector('.pp-opt-grand-total .pp-opt-total-label');
    if (labelEl) {
        labelEl.textContent = currentPhasesEnabled ? 'Phase Total' : 'Grand Total';
    }
}

function handleAddPhaseClick() {
    if (!currentProjectNumber) return;
    // Add the draft to the active column only (it will appear elsewhere on commit/render).
    const cards = document.querySelector('.pp-opt-col.pp-opt-col-active .pp-opt-cards')
        || document.querySelector('.pp-opt-col .pp-opt-cards');
    if (!cards) return;

    // Remove the empty-state placeholder if it's there
    cards.querySelector('.pp-opt-cards-empty')?.remove();
    // Cancel any existing draft
    cards.querySelector('.pp-opt-card-draft')?.remove();

    const draft = document.createElement('div');
    draft.className = 'pp-opt-card pp-opt-card-draft';
    draft.dataset.draft = 'true';
    draft.innerHTML = `
        <div class="pp-opt-card-row">
            <div class="pp-opt-card-grip" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/>
                    <circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>
                </svg>
            </div>
            <div class="pp-opt-card-left">
                <input type="text" class="pp-opt-card-name" placeholder="Task name" />
            </div>
            <div class="pp-opt-card-right">
                <input type="number" class="pp-opt-card-hours" placeholder="0" disabled />
                <span class="pp-opt-card-hours-label">hrs</span>
                <button class="pp-opt-card-delete" type="button" aria-label="Cancel">&times;</button>
            </div>
        </div>
    `;
    cards.appendChild(draft);

    const input = draft.querySelector('input.pp-opt-card-name');
    input.focus();
    const cleanup = () => {
        draft.remove();
        if (getPhasesFor(currentOptCastingId).length === 0 && !cards.querySelector('.pp-opt-card')) {
            renderOptColumns();
        }
    };

    let committing = false;
    const commit = async () => {
        if (committing) return;
        const name = input.value.trim();
        if (!name) { cleanup(); return; }
        const existing = getPhasesFor(currentOptCastingId);
        if (existing.some(p => p.phase_name.toLowerCase() === name.toLowerCase())) {
            showToast('That task already exists.', 'error');
            input.focus();
            return;
        }
        committing = true;
        try {
            const phase = await createCastingPhase(currentOptCastingId, name);
            if (phase) {
                existing.push(phase);
                setPhasesFor(currentOptCastingId, existing);
            }
            renderOptimizer();
            // Auto-focus the hours input on the newly-created card so the user can keep
            // typing without reaching for the mouse: name → Enter → hours → Enter → next card.
            if (phase?.id) {
                const newCard = document.querySelector(`.pp-opt-card[data-phase-id="${CSS.escape(phase.id)}"]`);
                const hoursInput = newCard?.querySelector('input[data-action="hours"]');
                if (hoursInput) {
                    hoursInput.focus();
                    hoursInput.select();
                }
            }
        } catch (err) {
            logger.error('[project-portal] createCastingPhase failed:', err);
            showToast('Add task failed: ' + (err.message || err), 'error');
            cleanup();
        }
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            input.value = '';
            input.removeEventListener('blur', commit); // skip auto-commit
            cleanup();
        }
    });
    draft.querySelector('.pp-opt-card-delete').addEventListener('click', () => {
        input.value = '';
        input.removeEventListener('blur', commit);
        cleanup();
    });
}

function findPhaseById(castingId, phaseId) {
    const list = getPhasesFor(castingId);
    return list.find(p => p.id === phaseId);
}

async function handleRenamePhase(castingId, phaseId, newName) {
    const trimmed = (newName || '').trim();
    const phase = findPhaseById(castingId, phaseId);
    if (!phase) return;
    if (!trimmed || trimmed === phase.phase_name) {
        renderOptColumns();
        return;
    }
    const phases = getPhasesFor(castingId);
    if (phases.some(p => p.id !== phaseId && p.phase_name.toLowerCase() === trimmed.toLowerCase())) {
        showToast('That task already exists.', 'error');
        renderOptColumns();
        return;
    }
    try {
        const updated = await renameCastingPhase(phaseId, trimmed);
        if (updated) Object.assign(phase, updated);
        renderOptimizer();
    } catch (err) {
        logger.error('[project-portal] renameCastingPhase failed:', err);
        showToast('Rename failed: ' + (err.message || err), 'error');
        renderOptColumns();
    }
}

async function handleDeletePhase(castingId, phaseId) {
    try {
        await deleteCastingPhase(phaseId);
        const phases = getPhasesFor(castingId).filter(p => p.id !== phaseId);
        setPhasesFor(castingId, phases);
        renderOptimizer();
        showToast('Task deleted.');
    } catch (err) {
        logger.error('[project-portal] deleteCastingPhase failed:', err);
        showToast('Delete task failed: ' + (err.message || err), 'error');
    }
}

function scheduleOptimizerHoursSave(castingId, phaseId, hoursStr) {
    if (!phaseId) return;
    const prev = optimizerPhaseSaveTimers.get(phaseId);
    if (prev) clearTimeout(prev);
    const t = setTimeout(() => handleSetHours(castingId, phaseId, hoursStr), 500);
    optimizerPhaseSaveTimers.set(phaseId, t);
}

async function handleSetHours(castingId, phaseId, hoursStr) {
    if (!castingId || !phaseId) return;
    const hours = Math.max(0, Math.floor(Number(hoursStr) || 0));
    try {
        const updated = await setCastingPhaseHours(phaseId, hours);
        const phase = findPhaseById(castingId, phaseId);
        if (phase) phase.hours = updated ? updated.hours : hours;
        renderOptTotals();
    } catch (err) {
        logger.error('[project-portal] setCastingPhaseHours failed:', err);
        showToast('Save hours failed: ' + (err.message || err), 'error');
    }
}

function scheduleOptimizerDescriptionSave(castingId, phaseId, descStr) {
    if (!phaseId) return;
    const prev = optimizerDescSaveTimers.get(phaseId);
    if (prev) clearTimeout(prev);
    const t = setTimeout(() => handleSetDescription(castingId, phaseId, descStr), 500);
    optimizerDescSaveTimers.set(phaseId, t);
}

async function handleSetDescription(castingId, phaseId, descStr) {
    if (!castingId || !phaseId) return;
    const desc = (descStr == null) ? '' : String(descStr);
    const phase = findPhaseById(castingId, phaseId);
    const wasFlagged = !!(phase && (phase.description || '').trim());
    const isFlagged = !!desc.trim();
    try {
        const updated = await setCastingPhaseDescription(phaseId, desc);
        if (phase) phase.description = updated ? updated.description : desc;
        // Toggle the "has description" flag on the card without clobbering the
        // open textarea (avoid full re-render so the user's caret stays put).
        if (wasFlagged !== isFlagged) {
            const cardEl = document.querySelector(`.pp-opt-card[data-phase-id="${CSS.escape(phaseId)}"]`);
            if (cardEl) cardEl.classList.toggle('pp-opt-card-has-desc', isFlagged);
        }
    } catch (err) {
        logger.error('[project-portal] setCastingPhaseDescription failed:', err);
        showToast('Save notes failed: ' + (err.message || err), 'error');
    }
}

function handleToggleDescription(phaseId) {
    if (!phaseId) return;
    const cardEl = document.querySelector(`.pp-opt-card[data-phase-id="${CSS.escape(phaseId)}"]`);
    if (!cardEl) return;
    const isOpen = currentOptDescExpanded.has(phaseId);
    if (isOpen) {
        currentOptDescExpanded.delete(phaseId);
        cardEl.classList.remove('pp-opt-card-expanded');
    } else {
        currentOptDescExpanded.add(phaseId);
        cardEl.classList.add('pp-opt-card-expanded');
        // Focus and size the textarea once the row has expanded.
        const ta = cardEl.querySelector('textarea[data-action="description"]');
        if (ta) {
            autoGrowTextarea(ta);
            ta.focus();
            const len = ta.value.length;
            try { ta.setSelectionRange(len, len); } catch {}
        }
    }
    const btn = cardEl.querySelector('button[data-action="toggle-desc"]');
    if (btn) btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
}

async function handleSelectOptCasting(castingId) {
    if (castingId === currentOptCastingId) return;
    currentOptCastingId = castingId;
    renderOptimizer();
}

function handleCopyHours(castingId) {
    const phases = getPhasesFor(castingId);
    copiedPhases = phases.map(p => ({
        phase_name: p.phase_name,
        hours: p.hours,
        sort_order: p.sort_order,
        description: p.description || ''
    }));
    const casting = currentCastings.find(c => c.id === castingId);
    showToast(`Copied tasks from Cast ${casting?.casting_number || ''}.`);
    renderOptColumns();
}

async function handlePasteHours(targetCastingId) {
    if (!Array.isArray(copiedPhases) || copiedPhases.length === 0) return;
    if (!targetCastingId) return;
    try {
        const inserted = await replaceCastingPhases(targetCastingId, copiedPhases);
        // Re-sort by sort_order to mirror DB ordering
        inserted.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        setPhasesFor(targetCastingId, inserted);
        renderOptimizer();
        const target = currentCastings.find(c => c.id === targetCastingId);
        showToast(`Pasted into Cast ${target?.casting_number || ''}.`);
    } catch (err) {
        logger.error('[project-portal] paste tasks failed:', err);
        showToast('Paste failed: ' + (err.message || err), 'error');
    }
}

function handleCopyComponents(castingId) {
    const items = getInventoryFor(castingId);
    if (items.length === 0) return;
    copiedComponents = items.map(it => ({
        type: it.type,
        width: it.width,
        length: it.length,
        color: it.color,
        sealer: it.sealer,
        quantity: it.quantity,
        extras: it.extras,
        cu_ft: it.cu_ft,
        ff_sq_ft: it.ff_sq_ft
    }));
    const casting = currentCastings.find(c => c.id === castingId);
    const n = copiedComponents.length;
    showToast(`Copied ${n} component${n === 1 ? '' : 's'} from Cast ${casting?.casting_number || ''}.`);
    renderCastings();
}

async function handlePasteComponents(targetCastingId) {
    if (!Array.isArray(copiedComponents) || copiedComponents.length === 0) return;
    if (!targetCastingId) return;
    if (!currentCastInvExpanded.has(targetCastingId)) currentCastInvExpanded.add(targetCastingId);
    try {
        const existing = getInventoryFor(targetCastingId);
        const baseOrder = existing.length > 0
            ? Math.max(...existing.map(c => c.sort_order || 0)) + 1
            : 0;
        const inserted = await Promise.all(copiedComponents.map((src, idx) =>
            createInventoryItem(targetCastingId, { ...src, sort_order: baseOrder + idx })
        ));
        const list = existing.slice();
        for (const row of inserted) if (row) list.push(row);
        setInventoryFor(targetCastingId, list);
        renderCastings();
        const target = currentCastings.find(c => c.id === targetCastingId);
        const n = inserted.filter(Boolean).length;
        showToast(`Pasted ${n} component${n === 1 ? '' : 's'} into Cast ${target?.casting_number || ''}.`);
        syncTrackingFromInventory();
    } catch (err) {
        logger.error('[project-portal] paste components failed:', err);
        showToast('Paste failed: ' + (err.message || err), 'error');
    }
}

// Drag-and-drop reorder for phase cards (powered by SortableJS)
let phaseSortable = null;

function ensurePhaseSortable() {
    // Active column changes when user navigates pills, so destroy/recreate.
    if (phaseSortable) {
        try { phaseSortable.destroy(); } catch {}
        phaseSortable = null;
    }
    if (typeof window.Sortable === 'undefined') return;
    const el = document.querySelector('.pp-opt-col.pp-opt-col-active .pp-opt-cards');
    if (!el) return;

    phaseSortable = window.Sortable.create(el, {
        animation: 180,
        easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
        handle: '.pp-opt-card-grip',
        draggable: '.pp-opt-card',
        ghostClass: 'pp-opt-card-ghost',
        chosenClass: 'pp-opt-card-chosen',
        dragClass: 'pp-opt-card-drag',
        forceFallback: true,
        fallbackTolerance: 4,
        scroll: true,
        scrollSensitivity: 60,
        scrollSpeed: 14,
        onEnd: async (evt) => {
            const oldIdx = evt.oldIndex;
            const newIdx = evt.newIndex;
            if (oldIdx === newIdx || oldIdx === undefined || newIdx === undefined) return;

            const phases = getPhasesFor(currentOptCastingId).slice();
            const [moved] = phases.splice(oldIdx, 1);
            phases.splice(newIdx, 0, moved);
            phases.forEach((p, idx) => { p.sort_order = idx; });
            setPhasesFor(currentOptCastingId, phases);

            try {
                await setCastingPhaseOrder(phases.map(p => p.id));
            } catch (err) {
                logger.error('[project-portal] setCastingPhaseOrder failed:', err);
                showToast('Reorder save failed: ' + (err.message || err), 'error');
                renderOptColumns();
            }
        }
    });
}

// ---------- Tracking (vertical accordion, one section per casting) ----------

function getComponentsFor(castingId) {
    return currentCastingComponents.get(castingId) || [];
}
function setComponentsFor(castingId, components) {
    currentCastingComponents.set(castingId, components);
}

async function activateTrackingTab() {
    const needsSave = document.getElementById('pp-track-needs-save');
    const noCastings = document.getElementById('pp-track-no-castings');
    const editor = document.getElementById('pp-track-editor');

    if (!currentProjectNumber) {
        needsSave.hidden = false;
        noCastings.hidden = true;
        editor.hidden = true;
        hideTrackingPhasesBar();
        return;
    }
    needsSave.hidden = true;
    ensureTrackingPhasesForProject(currentProjectNumber);
    renderTrackingPhasesBar();

    if (currentCastings.length === 0) {
        try { currentCastings = await loadCastings(currentProjectNumber); } catch (e) { /* ignore */ }
    }

    if (currentCastings.length === 0) {
        noCastings.hidden = false;
        editor.hidden = true;
        return;
    }
    noCastings.hidden = true;
    editor.hidden = false;

    // Drop expanded ids that no longer exist
    const validIds = new Set(currentCastings.map(c => c.id));
    for (const id of [...currentTrackExpanded]) {
        if (!validIds.has(id)) currentTrackExpanded.delete(id);
    }

    await Promise.all([
        loadAllComponentsForCurrentProject(),
        ensureCratesLoaded()
    ]);
    renderTracking();
    // Defensive sync — covers external edits or out-of-band state.
    syncTrackingFromInventory();
}

async function ensureCratesLoaded() {
    if (!currentProjectNumber) {
        currentCrates = [];
        cratesLoadedFor = null;
        return;
    }
    if (cratesLoadedFor === currentProjectNumber) return;
    try {
        currentCrates = await loadCratesForProject(currentProjectNumber);
        cratesLoadedFor = currentProjectNumber;
    } catch (err) {
        logger.error('[project-portal] loadCratesForProject failed:', err);
        currentCrates = [];
    }
}

function getComponentCount(crateId) {
    let n = 0;
    for (const list of currentCastingComponents.values()) {
        for (const comp of list) if (comp.crate_id === crateId) n += 1;
    }
    return n;
}

// Pick-by-number flow: tracking row dropdown chooses a 1–20 crate#. We
// look up the crate locally; if it doesn't exist yet, we create it on the
// fly so it shows up on the Shipping tab automatically.
async function handleTrackingCrateSelect(componentId, crateNumber) {
    if (!componentId) return;
    // If the row is part of a multi-row selection, treat it as a bulk assign for every selected row.
    if (selectedComponentIds.has(componentId) && selectedComponentIds.size > 1) {
        await applyBulkCrate(crateNumber || '');
        return;
    }
    const num = (crateNumber || '').trim();
    if (!num) {
        await assignComponentToCrate(componentId, null);
        return;
    }

    // Within a phased project, crate # is unique per phase — look up only
    // crates in the active phase, and create new ones tagged to it.
    const phaseScopedCrates = currentPhasesEnabled
        ? currentCrates.filter(c => c.phase_id === currentPhaseId)
        : currentCrates;
    let crate = phaseScopedCrates.find(c => String(c.crate_number || '') === num);
    if (!crate) {
        try {
            crate = await createCrate(currentProjectNumber, {
                crate_number: num,
                phase_id: currentPhasesEnabled ? currentPhaseId : null
            });
            if (crate) currentCrates.push(crate);
        } catch (err) {
            logger.error('[project-portal] createCrate failed:', err);
            return;
        }
    }
    if (crate) await assignComponentToCrate(componentId, crate.id);
}

async function handleRejectedToggle(componentId, checkboxEl) {
    if (!componentId) return;
    let target = null;
    for (const list of currentCastingComponents.values()) {
        const found = list.find(c => c.id === componentId);
        if (found) { target = found; break; }
    }
    if (!target) return;

    const prev = !!target.rejected;
    const next = checkboxEl ? !!checkboxEl.checked : !prev;
    if (prev === next) return;

    const label = target.panel_id ? `panel ${target.panel_id}` : 'this panel';
    const message = next
        ? `Mark ${label} as rejected?\n\nUse "Add Remake Casting" on the Castings tab to schedule the replacement.`
        : `Un-reject ${label}?\n\nMake sure a remake hasn't already been scheduled for it — otherwise you'll end up with a duplicate panel in production.`;
    const ok = window.confirm(message);
    if (!ok) {
        if (checkboxEl) checkboxEl.checked = prev;
        return;
    }
    target.rejected = next;
    renderTracking();
    try {
        await setComponentRejected(componentId, next);
    } catch (err) {
        logger.error('[project-portal] setComponentRejected failed:', err);
        target.rejected = prev;
        renderTracking();
        showToast('Could not save rejected flag — check connection.', 'error');
    }
}

async function handleProducedToggle(componentId, produced) {
    if (!componentId) return;
    // If the row is part of a multi-row selection, apply the toggle to every selected row.
    if (selectedComponentIds.has(componentId) && selectedComponentIds.size > 1) {
        await applyBulkProduced(!!produced);
        return;
    }
    let target = null;
    for (const list of currentCastingComponents.values()) {
        const found = list.find(c => c.id === componentId);
        if (found) { target = found; break; }
    }
    if (!target) return;
    const prev = !!target.produced;
    target.produced = !!produced;
    renderTracking();
    try {
        await setComponentProduced(componentId, !!produced);
    } catch (err) {
        logger.error('[project-portal] setComponentProduced failed:', err);
        target.produced = prev;
        renderTracking();
        showToast('Could not save produced flag — check connection.', 'error');
    }
}

async function assignComponentToCrate(componentId, crateId) {
    if (!componentId) return;
    // Locate the component row in our local map and update it.
    let target = null;
    for (const list of currentCastingComponents.values()) {
        const found = list.find(c => c.id === componentId);
        if (found) { target = found; break; }
    }
    if (!target) return;
    const prev = target.crate_id || null;
    target.crate_id = crateId || null;
    renderTracking();
    if (currentTab === 'shipping') renderShipping();
    try {
        await setComponentCrate(componentId, crateId);
    } catch (err) {
        logger.error('[project-portal] setComponentCrate failed:', err);
        target.crate_id = prev;
        renderTracking();
        if (currentTab === 'shipping') renderShipping();
    }
}

async function loadAllComponentsForCurrentProject() {
    const ids = currentCastings.map(c => c.id);
    try {
        currentCastingComponents = await loadAllComponentsForProject(ids);
    } catch (err) {
        logger.error('[project-portal] loadAllComponentsForProject failed:', err);
        currentCastingComponents = new Map();
        for (const id of ids) currentCastingComponents.set(id, []);
    }
}

// ---------- Casting Layout ----------

// UI state for the Casting Layout tab. The mold offset is the only editable
// control — everything else on the tab is generated from the casting data.
let clSelectedCastingId = null;
let clSelectedArea = 'B';
let clOffsetPerSide = 4;
let clGapBetween = 0;
// Saved manual mold positions for the selected casting (all areas). When this
// holds rows for the current area, the layout renders manually instead of
// auto-packed.
let clLayoutPositions = [];

function castingLayoutLabel(c) {
    const num = (c.casting_number || '').trim();
    const desc = (c.description || '').trim();
    const base = num ? `Casting ${num}` : 'Casting (unnamed)';
    return desc ? `${base} — ${desc}` : base;
}

async function activateCastingLayoutTab() {
    const needsSave = document.getElementById('pp-clay-needs-save');
    const noCastings = document.getElementById('pp-clay-no-castings');
    const controls = document.getElementById('pp-clay-controls');
    const viewer = document.getElementById('pp-clay-viewer');
    const errorEl = document.getElementById('pp-clay-error');
    if (errorEl) errorEl.textContent = '';

    if (!currentProjectNumber) {
        needsSave.hidden = false;
        noCastings.hidden = true;
        controls.hidden = true;
        viewer.hidden = true;
        return;
    }
    needsSave.hidden = true;

    if (currentCastings.length === 0) {
        try { currentCastings = await loadCastings(currentProjectNumber); }
        catch (e) { logger.error('[project-portal] loadCastings failed:', e); }
    }

    if (currentCastings.length === 0) {
        noCastings.hidden = false;
        controls.hidden = true;
        viewer.hidden = true;
        return;
    }
    noCastings.hidden = true;
    controls.hidden = false;
    viewer.hidden = false;

    await loadAllComponentsForCurrentProject();

    // Keep the selected casting valid as projects/castings change.
    const validIds = new Set(currentCastings.map(c => c.id));
    if (!clSelectedCastingId || !validIds.has(clSelectedCastingId)) {
        clSelectedCastingId = currentCastings[0].id;
    }

    const sel = document.getElementById('pp-clay-casting');
    if (sel) {
        sel.innerHTML = '';
        for (const c of currentCastings) {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = castingLayoutLabel(c);
            sel.appendChild(opt);
        }
        sel.value = clSelectedCastingId;
    }
    const areaSel = document.getElementById('pp-clay-area');
    if (areaSel) areaSel.value = clSelectedArea;
    const offsetInput = document.getElementById('pp-clay-offset');
    if (offsetInput) offsetInput.value = clOffsetPerSide;
    const gapInput = document.getElementById('pp-clay-gap');
    if (gapInput) gapInput.value = clGapBetween;

    await loadLayoutPositionsForSelected();
    renderCastingLayoutTab();
}

/** Load saved mold positions for the currently-selected casting. */
async function loadLayoutPositionsForSelected() {
    try {
        clLayoutPositions = clSelectedCastingId
            ? await loadLayoutPositions(clSelectedCastingId)
            : [];
    } catch (e) {
        logger.error('[project-portal] loadLayoutPositions failed:', e);
        clLayoutPositions = [];
    }
}

function renderCastingLayoutTab() {
    const card = document.getElementById('pp-clay-card');
    const errorEl = document.getElementById('pp-clay-error');
    if (!card) return;

    const casting = currentCastings.find(c => c.id === clSelectedCastingId);
    const components = currentCastingComponents.get(clSelectedCastingId) || [];
    const title = casting
        ? `${currentProjectNumber} — ${castingLayoutLabel(casting)}`
        : 'Casting Layout';

    const handle = renderCastingLayout({
        container: card,
        errorEl,
        components,
        title,
        area: clSelectedArea,
        offsetPerSide: clOffsetPerSide,
        gapBetween: clGapBetween,
        positions: clLayoutPositions
    });

    if (handle) {
        attachLayoutDrag(handle, {
            castingId: clSelectedCastingId,
            area: clSelectedArea,
            onCommit: commitLayoutPositions
        });
    }

    // The reset button only makes sense once a layout has been customized.
    const resetBtn = document.getElementById('pp-clay-reset-btn');
    if (resetBtn) resetBtn.hidden = !handle || handle.mode !== 'manual';
}

/**
 * Persist dragged mold positions, then reload and re-render. The first commit
 * for an auto-packed casting snapshots every mold, switching it to manual mode.
 */
async function commitLayoutPositions(rows) {
    try {
        await snapshotLayout(rows);
        await loadLayoutPositionsForSelected();
    } catch (e) {
        logger.error('[project-portal] commitLayoutPositions failed:', e);
        alert('Could not save the layout change. Please try again.');
    }
    renderCastingLayoutTab();
}

/** Discard the manual layout for the current casting area, back to auto-pack. */
async function resetCastingLayout() {
    if (!clSelectedCastingId) return;
    if (!confirm('Discard the manual layout for this casting area and return to automatic packing?')) return;
    try {
        await clearLayoutPositions(clSelectedCastingId, clSelectedArea);
        await loadLayoutPositionsForSelected();
    } catch (e) {
        logger.error('[project-portal] resetCastingLayout failed:', e);
        alert('Could not reset the layout. Please try again.');
    }
    renderCastingLayoutTab();
}

function printCastingLayout() {
    const svgEl = document.querySelector('#pp-clay-card svg');
    if (!svgEl) { alert('No layout to print yet.'); return; }
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html>
<html><head><title>Casting Layout</title>
<style>
  @page { size: letter portrait; margin: 0.5in; }
  html, body { margin: 0; padding: 0; }
  svg { width: 7.5in; height: 10in; display: block; margin: 0 auto; }
</style></head>
<body>${svgEl.outerHTML}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
}

function renderTrackingPhasesBar() {
    const bar = document.getElementById('pp-track-phases-bar');
    const chips = document.getElementById('pp-track-phases-chips');
    if (!bar || !chips) return;
    chips.innerHTML = TRACKING_PHASES.map(p => {
        const active = currentTrackingPhases.has(p);
        return `<button type="button" class="pp-track-phase-chip${active ? ' pp-track-phase-active' : ''}" data-phase="${escapeAttr(p)}" aria-pressed="${active}" title="${active ? 'Click to remove' : 'Click to add'} ${escapeAttr(p)}">${escapeHtml(p)}</button>`;
    }).join('');
    bar.hidden = false;
}

function hideTrackingPhasesBar() {
    const bar = document.getElementById('pp-track-phases-bar');
    if (bar) bar.hidden = true;
}

function handleToggleTrackingPhase(phase) {
    if (!phase || !TRACKING_PHASES.includes(phase)) return;
    if (currentTrackingPhases.has(phase)) currentTrackingPhases.delete(phase);
    else currentTrackingPhases.add(phase);
    renderTrackingPhasesBar();
    scheduleProjectInfoSave();
}

function ensureTrackingPhasesForProject(projectNumber) {
    // populateForm() is the primary loader (reads project.tracking_phases on
    // form-view entry). This is a safety net for direct tab activations
    // before populateForm runs — fall back to the full default set.
    if (trackingPhasesProject !== projectNumber) {
        currentTrackingPhases = new Set(TRACKING_PHASES);
        trackingPhasesProject = projectNumber;
    }
}

function renderTracking() {
    const list = document.getElementById('pp-track-list');
    if (!list) return;
    pruneSelectedComponentIds();
    list.innerHTML = getCastingsForActivePhase().map(c => renderTrackSection(c)).join('');
    // <input> doesn't have an :indeterminate attribute, so set it via JS.
    list.querySelectorAll('.pp-track-select-all[data-indeterminate="true"]').forEach(cb => {
        cb.indeterminate = true;
    });
    renderTrackingBulkBar();
}

function pruneSelectedComponentIds() {
    if (selectedComponentIds.size === 0) return;
    const validIds = new Set();
    for (const list of currentCastingComponents.values()) {
        for (const comp of list) validIds.add(comp.id);
    }
    for (const id of [...selectedComponentIds]) {
        if (!validIds.has(id)) selectedComponentIds.delete(id);
    }
}

function renderTrackingBulkBar() {
    const bar = document.getElementById('pp-track-bulk-bar');
    if (!bar) return;
    const count = selectedComponentIds.size;
    if (count === 0) {
        bar.hidden = true;
        return;
    }
    const options = ['<option value="">— Set crate # —</option>', '<option value="__clear__">Clear assignment</option>']
        .concat(CRATE_NUMBER_OPTIONS.map(n => `<option value="${escapeAttr(n)}">Crate #${escapeHtml(n)}</option>`))
        .join('');
    bar.innerHTML = `
        <div class="pp-track-bulk-inner">
            <span class="pp-track-bulk-count">${count} ${count === 1 ? 'panel' : 'panels'} selected</span>
            <select id="pp-track-bulk-select" class="pp-track-bulk-select" aria-label="Bulk crate assignment">${options}</select>
            <button type="button" class="pp-track-bulk-btn pp-track-bulk-btn-complete" data-action="track-bulk-complete">Mark Complete</button>
            <button type="button" class="pp-track-bulk-btn pp-track-bulk-btn-incomplete" data-action="track-bulk-incomplete">Mark Incomplete</button>
            <button type="button" class="pp-track-bulk-clear" data-action="track-bulk-clear">Clear selection</button>
        </div>
    `;
    bar.hidden = false;
}

function toggleSelectComponent(componentId, selected) {
    if (!componentId) return;
    if (selected) selectedComponentIds.add(componentId);
    else selectedComponentIds.delete(componentId);
    renderTracking();
}

function toggleSelectAllInCasting(castingId, selected) {
    if (!castingId) return;
    const components = getComponentsFor(castingId);
    for (const comp of components) {
        if (selected) selectedComponentIds.add(comp.id);
        else selectedComponentIds.delete(comp.id);
    }
    renderTracking();
}

async function applyBulkProduced(produced) {
    if (selectedComponentIds.size === 0) return;
    const ids = [...selectedComponentIds];

    const prevById = new Map();
    for (const list of currentCastingComponents.values()) {
        for (const comp of list) {
            if (selectedComponentIds.has(comp.id)) {
                prevById.set(comp.id, !!comp.produced);
                comp.produced = !!produced;
            }
        }
    }
    selectedComponentIds.clear();
    renderTracking();

    try {
        await setComponentsProducedBulk(ids, !!produced);
    } catch (err) {
        logger.error('[project-portal] setComponentsProducedBulk failed:', err);
        for (const list of currentCastingComponents.values()) {
            for (const comp of list) {
                if (prevById.has(comp.id)) comp.produced = prevById.get(comp.id);
            }
        }
        renderTracking();
        showToast('Could not save produced flags — check connection.', 'error');
    }
}

async function applyBulkCrate(value) {
    if (selectedComponentIds.size === 0) return;
    const ids = [...selectedComponentIds];

    let crateId = null;
    if (value && value !== '__clear__') {
        const phaseScopedCrates = currentPhasesEnabled
            ? currentCrates.filter(c => c.phase_id === currentPhaseId)
            : currentCrates;
        let crate = phaseScopedCrates.find(c => String(c.crate_number || '') === value);
        if (!crate) {
            try {
                crate = await createCrate(currentProjectNumber, {
                    crate_number: value,
                    phase_id: currentPhasesEnabled ? currentPhaseId : null
                });
                if (crate) currentCrates.push(crate);
            } catch (err) {
                logger.error('[project-portal] bulk createCrate failed:', err);
                return;
            }
        }
        crateId = crate?.id || null;
    }

    // Optimistic local update so the UI snaps immediately.
    const prevById = new Map();
    for (const list of currentCastingComponents.values()) {
        for (const comp of list) {
            if (selectedComponentIds.has(comp.id)) {
                prevById.set(comp.id, comp.crate_id || null);
                comp.crate_id = crateId;
            }
        }
    }
    selectedComponentIds.clear();
    renderTracking();
    if (currentTab === 'shipping') renderShipping();

    try {
        await setComponentsCrateBulk(ids, crateId);
    } catch (err) {
        logger.error('[project-portal] setComponentsCrateBulk failed:', err);
        // Roll back local state
        for (const list of currentCastingComponents.values()) {
            for (const comp of list) {
                if (prevById.has(comp.id)) comp.crate_id = prevById.get(comp.id);
            }
        }
        renderTracking();
        if (currentTab === 'shipping') renderShipping();
    }
}

function renderTrackSection(casting) {
    const isOpen = currentTrackExpanded.has(casting.id);
    const components = getComponentsFor(casting.id);
    const count = components.length;
    const rejectedCount = components.reduce((n, c) => n + (c.rejected ? 1 : 0), 0);
    const rejectedBadge = rejectedCount > 0
        ? `<span class="pp-track-section-rejected-count" title="${rejectedCount} rejected ${rejectedCount === 1 ? 'panel' : 'panels'}">${rejectedCount} rejected</span>`
        : '';
    const desc = casting.description ? `<span class="pp-track-section-desc">${escapeHtml(casting.description)}</span>` : '';

    const cardsHtml = count === 0
        ? `<div class="pp-opt-cards-empty">No components — add inventory in the Castings tab.</div>`
        : components.map(comp => renderTrackCard(comp, casting.id)).join('');

    const allIds = components.map(c => c.id);
    const allSelected = count > 0 && allIds.every(id => selectedComponentIds.has(id));
    const someSelected = !allSelected && allIds.some(id => selectedComponentIds.has(id));
    const headerRow = `
        <div class="pp-track-header-row">
            <div class="pp-track-header-grip-spacer">
                <input type="checkbox" class="pp-track-select-all" data-action="track-select-all-casting" data-casting-id="${escapeAttr(casting.id)}" ${allSelected ? 'checked' : ''} ${someSelected ? 'data-indeterminate="true"' : ''} aria-label="Select all in this cast" title="Select all in this cast" ${count === 0 ? 'disabled' : ''} />
            </div>
            <div class="pp-track-header-fields" aria-hidden="true">
                <span>Complete</span>
                <span>Panel ID</span>
                <span>Width</span>
                <span>Length</span>
                <span>Color</span>
                <span>Crate #</span>
                <span>Rejected</span>
            </div>
        </div>
    `;

    const body = isOpen ? `
        <div class="pp-track-section-body">
            ${headerRow}
            <div class="pp-track-cards" data-casting-id="${escapeAttr(casting.id)}">
                ${cardsHtml}
            </div>
        </div>
    ` : '';

    return `
        <div class="pp-track-section${isOpen ? ' pp-track-section-open' : ''}" data-casting-id="${escapeAttr(casting.id)}">
            <div class="pp-track-section-header">
                <button type="button" class="pp-track-section-toggle" data-action="toggle-section" aria-expanded="${isOpen}">
                    <span class="pp-track-chevron" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"/>
                        </svg>
                    </span>
                    <span class="pp-track-section-label">Cast</span>
                    <span class="pp-track-section-num">${escapeHtml(casting.casting_number || '')}</span>
                    ${desc}
                </button>
                <div class="pp-track-section-print-group">
                    <button type="button" class="pp-track-section-stickers" data-action="print-stickers" data-casting-id="${escapeAttr(casting.id)}" ${count === 0 ? 'disabled' : ''} title="${count === 0 ? 'No panels to label' : `Print panel labels for Cast ${casting.casting_number || ''}`}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <polyline points="6 9 6 2 18 2 18 9"/>
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                            <rect x="6" y="14" width="12" height="8"/>
                        </svg>
                        <span>Stickers</span>
                    </button>
                    <button type="button" class="pp-track-section-print" data-action="print-tracking" data-casting-id="${escapeAttr(casting.id)}" ${count === 0 ? 'disabled' : ''} title="${count === 0 ? 'No components to print' : `Print tracking sheet for Cast ${casting.casting_number || ''}`}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <polyline points="6 9 6 2 18 2 18 9"/>
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                            <rect x="6" y="14" width="12" height="8"/>
                        </svg>
                        <span>Tracking</span>
                    </button>
                </div>
                <span class="pp-track-section-count">${count} ${count === 1 ? 'component' : 'components'}</span>
                ${rejectedBadge}
            </div>
            ${body}
        </div>
    `;
}

const CRATE_NUMBER_OPTIONS = Array.from({ length: 20 }, (_, i) => String(i + 1));

function renderTrackCard(comp, castingId) {
    const lockTitle = 'Synced from Castings inventory — edit there';
    const crate = comp.crate_id ? currentCrates.find(c => c.id === comp.crate_id) : null;
    const currentNum = crate ? String(crate.crate_number || '') : '';
    const options = ['<option value="">—</option>']
        .concat(CRATE_NUMBER_OPTIONS.map(n =>
            `<option value="${escapeAttr(n)}"${n === currentNum ? ' selected' : ''}>${escapeHtml(n)}</option>`
        ))
        .join('');
    const isSelected = selectedComponentIds.has(comp.id);
    const isProduced = !!comp.produced;
    const isRejected = !!comp.rejected;
    const rejectTitle = isRejected
        ? 'This panel is rejected. Unchecking will prompt to confirm — make sure no remake was already scheduled.'
        : 'Mark this panel as rejected. Use Add Remake Casting to schedule the replacement.';
    return `
        <div class="pp-track-card pp-track-card-locked${isSelected ? ' pp-track-card-selected' : ''}${isProduced ? ' pp-track-card-produced' : ''}${isRejected ? ' pp-track-card-rejected' : ''}" data-component-id="${escapeAttr(comp.id)}" data-casting-id="${escapeAttr(castingId)}">
            <div class="pp-track-card-grip-spacer">
                <input type="checkbox" class="pp-track-row-select" data-action="track-row-select" data-component-id="${escapeAttr(comp.id)}" ${isSelected ? 'checked' : ''} aria-label="Select this panel" />
            </div>
            <div class="pp-track-card-fields">
                <label class="pp-track-produced-cell" title="Mark this panel as complete">
                    <input type="checkbox" class="pp-track-produced" data-action="track-produced-toggle" data-component-id="${escapeAttr(comp.id)}" ${isProduced ? 'checked' : ''} aria-label="Mark as complete" />
                </label>
                <input type="text" class="pp-track-input" data-field="panel_id" value="${escapeAttr(comp.panel_id || '')}" readonly title="${escapeAttr(lockTitle)}" />
                <input type="text" class="pp-track-input" data-field="width" value="${escapeAttr(comp.width || '')}" readonly title="${escapeAttr(lockTitle)}" />
                <input type="text" class="pp-track-input" data-field="length" value="${escapeAttr(comp.length || '')}" readonly title="${escapeAttr(lockTitle)}" />
                <input type="text" class="pp-track-input" data-field="color" value="${escapeAttr(resolveComponentColorName(comp))}" readonly title="${escapeAttr(lockTitle)}" />
                <select class="pp-track-crate-select${currentNum ? ' pp-track-crate-set' : ''}" data-action="track-crate-select" data-component-id="${escapeAttr(comp.id)}" title="Assign this panel to a crate">${options}</select>
                <label class="pp-track-rejected-cell" title="${escapeAttr(rejectTitle)}">
                    <input type="checkbox" class="pp-track-rejected" data-action="track-rejected-toggle" data-component-id="${escapeAttr(comp.id)}" ${isRejected ? 'checked' : ''} aria-label="Mark as rejected" />
                </label>
            </div>
        </div>
    `;
}

function handleToggleTrackSection(castingId) {
    if (currentTrackExpanded.has(castingId)) currentTrackExpanded.delete(castingId);
    else currentTrackExpanded.add(castingId);
    renderTracking();
}

// Tracking is a read-only mirror of Castings inventory. Whenever inventory
// mutates (add/edit/delete/reorder, casting reorder/delete), we re-derive
// each casting's casting_components rows in project sort_order so panel_id
// numbering stays globally consistent per type. Numbered panels come first
// (e.g. A.01, A.02), then any "extras" as `${type}.EXTRA` rows.
let syncInFlight = false;
let syncPending = false;

async function syncTrackingFromInventory() {
    if (!currentProjectNumber) return;
    if (syncInFlight) { syncPending = true; return; }
    syncInFlight = true;
    try {
        do {
            syncPending = false;
            await runTrackingSync();
        } while (syncPending);
    } finally {
        syncInFlight = false;
    }
}

async function runTrackingSync() {
    if (!currentProjectNumber || currentCastings.length === 0) return;

    if (currentCastingInventoryLoadedFor !== currentProjectNumber) {
        await loadAllInventoryForCurrentProject();
    }
    if (currentCastingComponents.size === 0) {
        await loadAllComponentsForCurrentProject();
    }

    const sortedCastings = currentCastings.slice().sort((a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );

    // Compute padLen per type from the project-wide qty total so all panel_ids
    // for a given type share the same zero-pad width.
    const typeTotals = new Map();
    for (const casting of sortedCastings) {
        for (const inv of getInventoryFor(casting.id)) {
            if (!inv.type) continue;
            const qty = Math.max(1, parseInt(inv.quantity, 10) || 1);
            typeTotals.set(inv.type, (typeTotals.get(inv.type) || 0) + qty);
        }
    }
    const padLenFor = (type) => Math.max(2, String(typeTotals.get(type) || 0).length);

    // Per-type running counter across castings in sort order.
    const counters = new Map();
    const nextPanelId = (type) => {
        if (!type) return null;
        const next = (counters.get(type) || 0) + 1;
        counters.set(type, next);
        return `${type}.${String(next).padStart(padLenFor(type), '0')}`;
    };

    for (const casting of sortedCastings) {
        const expected = [];
        for (const inv of getInventoryFor(casting.id)) {
            const qty = Math.max(1, parseInt(inv.quantity, 10) || 1);
            const extras = Math.max(0, parseInt(inv.extras, 10) || 0);
            for (let i = 0; i < qty; i++) {
                expected.push({
                    type: inv.type || null,
                    width: inv.width || null,
                    length: inv.length || null,
                    panel_id: nextPanelId(inv.type),
                    color: inv.color || null,
                    color_log_id: inv.color_log_id || null,
                    sealer: inv.sealer || null
                });
            }
            for (let i = 0; i < extras; i++) {
                expected.push({
                    type: inv.type || null,
                    width: inv.width || null,
                    length: inv.length || null,
                    panel_id: inv.type ? `${inv.type}.EXTRA` : null,
                    color: inv.color || null,
                    color_log_id: inv.color_log_id || null,
                    sealer: inv.sealer || null
                });
            }
        }

        const current = getComponentsFor(casting.id);
        if (componentsMatchExpected(current, expected)) continue;

        try {
            await deleteAllComponentsForCasting(casting.id);
            if (expected.length === 0) {
                setComponentsFor(casting.id, []);
            } else {
                const created = await createComponentsBulk(casting.id, expected);
                setComponentsFor(casting.id, created || []);
            }
        } catch (err) {
            logger.error('[project-portal] sync tracking failed for casting', casting.id, err);
            showToast('Tracking sync failed: ' + (err.message || err), 'error');
            return;
        }
    }

    if (currentTab === 'tracking') renderTracking();
}

function componentsMatchExpected(current, expected) {
    if (current.length !== expected.length) return false;
    const norm = v => (v === undefined || v === '' ? null : v);
    for (let i = 0; i < current.length; i++) {
        const c = current[i], e = expected[i];
        if (norm(c.panel_id) !== norm(e.panel_id)) return false;
        if (norm(c.type) !== norm(e.type)) return false;
        if (norm(c.width) !== norm(e.width)) return false;
        if (norm(c.length) !== norm(e.length)) return false;
        if (norm(c.color) !== norm(e.color)) return false;
        if (norm(c.color_log_id) !== norm(e.color_log_id)) return false;
        if (norm(c.sealer) !== norm(e.sealer)) return false;
    }
    return true;
}

// ---------- Helpers ----------

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function escapeAttr(s) { return escapeHtml(s); }
function slug(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

let toastTimer = null;
function showToast(msg, kind = 'success') {
    const el = document.getElementById('pp-toast');
    el.textContent = msg;
    el.className = `pp-toast pp-toast-${kind}`;
    el.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2500);
}

// ---------- Color Log (UI only — no DB yet) ----------

const CL_UNIT_OPTIONS = ['lbs', 'oz', 'g', 'kg', 'ml', 'fl oz', 'gal'];

const CL_TO_LBS = { lbs: 1, oz: 1/16, g: 1/453.592, kg: 2.20462, ml: 1/453.592, 'fl oz': 1/16, gal: 8.345 };
const CL_FROM_LBS = { lbs: 1, oz: 16, g: 453.592, kg: 1/2.20462, ml: 453.592, 'fl oz': 16, gal: 1/8.345 };

function createEmptyColorLog() {
    return {
        name: '',
        date: '',
        madeBy: '',
        temperature: '',
        project: '',
        isStandard: true,
        cementType: 'white',
        castMethod: 'sprayUp',
        baseIngredients: [],
        additives: [],
        aggregates: [],
        pigments: [],
        groutType: [],
        fillCoat: [],
        finishingNotes: '',
        sealingNotes: ''
    };
}

function clUnitSelect(selected) {
    return `<select class="pp-cl-unit-select">${CL_UNIT_OPTIONS.map(u =>
        `<option value="${u}"${u === selected ? ' selected' : ''}>${u}</option>`
    ).join('')}</select>`;
}

function clRoundSig(num, decimals) {
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

function clGetSandWeightLbs() {
    const rows = document.querySelectorAll('#pp-cl-base-table tbody tr');
    for (const tr of rows) {
        const nameInput = tr.querySelector('input[data-cl-field="name"]');
        const weightInput = tr.querySelector('input[data-cl-field="weight"]');
        const unitSelect = tr.querySelector('select');
        if (nameInput && nameInput.value.trim().toLowerCase() === 'sand' && weightInput) {
            const val = parseFloat(weightInput.value);
            if (isNaN(val)) return 0;
            const unit = unitSelect ? unitSelect.value : 'lbs';
            return val * (CL_TO_LBS[unit] || 1);
        }
    }
    return 0;
}

function clRenderIngTable(tableId, items, type) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    const valField = type === 'additive' ? 'amount' : 'weight';
    tbody.innerHTML = items.map((item, i) => `
        <tr data-cl-type="${type}" data-cl-idx="${i}">
            <td><input type="text" value="${escapeAttr(item.name || '')}" data-cl-field="name"></td>
            <td><input type="number" step="any" value="${item[valField] ?? item.weight ?? item.amount ?? ''}" data-cl-field="${valField}"></td>
            <td>${clUnitSelect(item.unit || 'lbs')}</td>
            <td><input type="text" value="${escapeAttr(item.note || '')}" data-cl-field="note"></td>
            <td class="pp-cl-col-action"><button type="button" class="pp-cl-btn-remove" data-cl-remove>&times;</button></td>
        </tr>
    `).join('');
}

function clRenderSimpleTable(tableId, items, type) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    tbody.innerHTML = items.map((item, i) => `
        <tr data-cl-type="${type}" data-cl-idx="${i}">
            <td><input type="text" value="${escapeAttr(item.name || '')}" data-cl-field="name"></td>
            <td><input type="number" step="any" value="${item.amount ?? ''}" data-cl-field="amount"></td>
            <td>${clUnitSelect(item.unit || 'lbs')}</td>
            <td class="pp-cl-col-action"><button type="button" class="pp-cl-btn-remove" data-cl-remove>&times;</button></td>
        </tr>
    `).join('');
}

function clRenderPigmentTable(tableId, items, type) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    const sandLbs = clGetSandWeightLbs();
    tbody.innerHTML = items.map((item, i) => {
        const pct = item.pct ?? '';
        const unit = item.unit || 'lbs';
        const weightLbs = (pct !== '' && sandLbs > 0) ? sandLbs * pct / 100 : '';
        const calcWeight = (weightLbs !== '') ? clRoundSig(weightLbs * (CL_FROM_LBS[unit] || 1), 4) : '';
        return `
        <tr data-cl-type="${type}" data-cl-idx="${i}">
            <td><input type="text" value="${escapeAttr(item.name || '')}" data-cl-field="name"></td>
            <td><div class="pp-cl-input-suffix"><input type="number" step="any" value="${pct}" data-cl-field="pct"><span class="pp-cl-suffix">%</span></div></td>
            <td><input type="number" step="any" value="${calcWeight}" data-cl-field="qty" readonly style="background:#e2e8f0;cursor:not-allowed;" title="Auto-calculated from % of sand"></td>
            <td>${clUnitSelect(unit)}</td>
            <td class="pp-cl-col-action"><button type="button" class="pp-cl-btn-remove" data-cl-remove>&times;</button></td>
        </tr>`;
    }).join('');
}

function clRenderGroutTable(tableId, items, type) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    tbody.innerHTML = items.map((item, i) => `
        <tr data-cl-type="${type}" data-cl-idx="${i}">
            <td><input type="text" value="${escapeAttr(item.name || '')}" data-cl-field="name"></td>
            <td><input type="number" step="any" value="${item.ratio ?? ''}" data-cl-field="ratio"></td>
            <td class="pp-cl-col-action"><button type="button" class="pp-cl-btn-remove" data-cl-remove>&times;</button></td>
        </tr>
    `).join('');
}

const CL_TYPE_KEY = {
    base: 'baseIngredients',
    additive: 'additives',
    aggregate: 'aggregates',
    pigment: 'pigments',
    grout: 'groutType',
    fillCoat: 'fillCoat',
};

const CL_TYPE_TABLE = {
    base: 'pp-cl-base-table',
    additive: 'pp-cl-additives-table',
    aggregate: 'pp-cl-aggregates-table',
    pigment: 'pp-cl-pigments-table',
    grout: 'pp-cl-grout-table',
    fillCoat: 'pp-cl-fillcoat-table',
};

function clRenderType(type) {
    if (!currentColorLog) return;
    const tableId = CL_TYPE_TABLE[type];
    const items = currentColorLog[CL_TYPE_KEY[type]] || [];
    if (type === 'base' || type === 'additive') clRenderIngTable(tableId, items, type);
    else if (type === 'aggregate') clRenderSimpleTable(tableId, items, type);
    else if (type === 'pigment' || type === 'fillCoat') clRenderPigmentTable(tableId, items, type);
    else if (type === 'grout') clRenderGroutTable(tableId, items, type);
}

function clSetStandard(isStd) {
    if (currentColorLog) currentColorLog.isStandard = !!isStd;
    document.getElementById('pp-cl-std-box')?.classList.toggle('checked', !!isStd);
    document.getElementById('pp-cl-cust-box')?.classList.toggle('checked', !isStd);
}

function clSetRadio(name, value) {
    document.querySelectorAll(`input[name="${name}"]`).forEach(r => {
        r.checked = (r.value === value);
    });
}

function getCurrentProjectDisplay() {
    const num = (currentProjectNumber || '').trim();
    const name = (document.getElementById('pp-f-project_name')?.value || '').trim();
    if (num && name) return `${num} — ${name}`;
    return num || name || '';
}

function renderColorLog() {
    if (!currentColorLog) currentColorLog = createEmptyColorLog();
    const log = currentColorLog;
    // Project field is always live — never user-edited. Sync in-memory copy too.
    log.project = getCurrentProjectDisplay();

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
    set('pp-cl-name', log.name);
    set('pp-cl-temp', log.temperature);
    set('pp-cl-project', log.project);
    set('pp-cl-date', log.date);
    set('pp-cl-madeby', log.madeBy);
    set('pp-cl-finishing-notes', log.finishingNotes);
    set('pp-cl-sealing-notes', log.sealingNotes);

    clSetStandard(log.isStandard !== false);
    clSetRadio('pp-cl-cement', log.cementType || 'white');
    clSetRadio('pp-cl-cast', log.castMethod || 'sprayUp');

    Object.keys(CL_TYPE_KEY).forEach(clRenderType);
}

function clHandleAdd(type) {
    if (!currentColorLog) currentColorLog = createEmptyColorLog();
    const key = CL_TYPE_KEY[type];
    if (!key) return;
    const list = currentColorLog[key];
    if (type === 'base') list.push({ name: '', weight: '', unit: 'lbs', note: '' });
    else if (type === 'additive') list.push({ name: '', amount: '', unit: 'oz', note: '' });
    else if (type === 'aggregate') list.push({ name: '', amount: '', unit: 'lbs' });
    else if (type === 'pigment' || type === 'fillCoat') list.push({ name: '', pct: '', qty: '', unit: 'lbs' });
    else if (type === 'grout') list.push({ name: '', ratio: '' });
    clRenderType(type);
}

function clHandleRemove(type, idx) {
    if (!currentColorLog) return;
    const key = CL_TYPE_KEY[type];
    const list = currentColorLog[key];
    if (!list || idx < 0 || idx >= list.length) return;
    list.splice(idx, 1);
    clRenderType(type);
    // Pigment weights depend on sand presence; nothing else dynamic here.
}

function clHandleRowInputChange(tr, input) {
    if (!currentColorLog) return;
    const type = tr.dataset.clType;
    const idx = parseInt(tr.dataset.clIdx, 10);
    const field = input.dataset.clField;
    const key = CL_TYPE_KEY[type];
    if (!key || isNaN(idx)) return;
    const item = currentColorLog[key]?.[idx];
    if (!item) return;

    if (field === 'name' || field === 'note') {
        item[field] = input.value;
    } else if (field === 'weight') {
        item.weight = input.value === '' ? '' : parseFloat(input.value);
    } else if (field === 'amount') {
        item.amount = input.value === '' ? '' : parseFloat(input.value);
    } else if (field === 'pct') {
        item.pct = input.value === '' ? '' : parseFloat(input.value);
    } else if (field === 'ratio') {
        item.ratio = input.value === '' ? '' : parseFloat(input.value);
    }

    // If sand row weight/unit changed, recompute pigment + fill-coat weights.
    if (type === 'base' && (field === 'name' || field === 'weight')) {
        clRenderType('pigment');
        clRenderType('fillCoat');
    }

    // If pct changed on a pigment / fillCoat row, recompute that row's qty inline
    // (don't re-render — would steal focus from the active input).
    if (field === 'pct' && (type === 'pigment' || type === 'fillCoat')) {
        clRecomputeRowQty(tr, item);
    }
}

function clRecomputeRowQty(tr, item) {
    const qtyInput = tr.querySelector('input[data-cl-field="qty"]');
    if (!qtyInput) return;
    const sandLbs = clGetSandWeightLbs();
    const pct = item.pct;
    const unit = item.unit || 'lbs';
    if (pct === '' || pct == null || isNaN(pct) || sandLbs <= 0) {
        qtyInput.value = '';
        return;
    }
    const weightLbs = sandLbs * Number(pct) / 100;
    qtyInput.value = clRoundSig(weightLbs * (CL_FROM_LBS[unit] || 1), 4);
}

function clHandleRowUnitChange(tr, select) {
    if (!currentColorLog) return;
    const type = tr.dataset.clType;
    const idx = parseInt(tr.dataset.clIdx, 10);
    const key = CL_TYPE_KEY[type];
    if (!key || isNaN(idx)) return;
    const item = currentColorLog[key]?.[idx];
    if (!item) return;
    item.unit = select.value;
    if (type === 'base') {
        clRenderType('pigment');
        clRenderType('fillCoat');
    } else if (type === 'pigment' || type === 'fillCoat') {
        clRenderType(type);
    }
}

/**
 * Populate the in-memory color-log cache for the current project.
 * No-op when there's no project, or when the cache is already hot for this project.
 * Safe to call from any tab — does NOT touch the Color Log tab's DOM.
 *
 * Why this exists: color-aware tabs (Casting Inventory, Tracking, Shipping,
 * Batch Tickets) read `currentColorLogs` when they render. If those tabs render
 * before the user has visited the Color Log tab, every dropdown falls through
 * to the "— Create color log —" disabled state even when a log exists in the DB.
 * Loading eagerly in showFormView prevents that on initial paint / after refresh.
 */
async function ensureColorLogsLoaded() {
    if (!currentProjectNumber) return;
    if (colorLogLoadedFor === currentProjectNumber) return;
    try {
        // Load all color logs for the project. Multi-color projects get
        // a populated list; single-color projects get [oneLog] or [].
        const list = await loadColorLogsForProject(currentProjectNumber);
        currentColorLogs = list;
        if (list.length > 0) {
            currentColorLogId = list[0].id;
            currentColorLog = list[0];
        } else {
            // No log yet — start with an unsaved empty form.
            currentColorLogId = null;
            currentColorLog = createEmptyColorLog();
        }
    } catch (err) {
        logger.error('[color-log] load failed', err);
        currentColorLogs = [];
        currentColorLogId = null;
        currentColorLog = createEmptyColorLog();
        showToast('Failed to load color log', 'error');
    }
    colorLogLoadedFor = currentProjectNumber;
}

async function activateColorLogTab() {
    const needsSave = document.getElementById('pp-cl-needs-save');
    const toolbar   = document.getElementById('pp-cl-toolbar');
    const wrap      = document.getElementById('pp-cl-wrap');

    if (!currentProjectNumber) {
        if (needsSave) needsSave.hidden = false;
        if (toolbar) toolbar.hidden = true;
        if (wrap) wrap.hidden = true;
        return;
    }

    if (needsSave) needsSave.hidden = true;
    if (toolbar) toolbar.hidden = false;
    if (wrap) wrap.hidden = false;

    // Cache may already be hot (preloaded by showFormView). Either way the
    // tab's UI must render fresh every time it's activated.
    await ensureColorLogsLoaded();

    // Refresh the project display in case the project name changed.
    if (currentColorLog) {
        const live = getCurrentProjectDisplay();
        if (currentColorLog.project !== live) {
            currentColorLog.project = live;
            const el = document.getElementById('pp-cl-project');
            if (el) el.value = live;
        }
    }

    renderColorLog();
    renderColorLogsToolbar();
    await refreshPresetPicker();
}

async function refreshPresetPicker() {
    const sel = document.getElementById('pp-cl-preset-select');
    if (!sel) return;
    try {
        colorLogPresets = await loadColorLogPresets();
    } catch (err) {
        logger.warn('[color-log] loadPresets failed', err);
        colorLogPresets = [];
    }
    sel.innerHTML = '<option value="">— Choose preset —</option>' +
        colorLogPresets.map(p =>
            `<option value="${p.id}">${escapeHtml(p.presetName || '(unnamed)')}</option>`
        ).join('');
    sel.value = '';
}

function loadPresetIntoForm(presetId) {
    const preset = colorLogPresets.find(p => p.id === presetId);
    if (!preset || !currentColorLog) return;
    // Copy preset fields into the project's log, preserving id/projectNumber.
    const keepId = currentColorLog.id;
    const keepProject = currentColorLog.projectNumber;
    currentColorLog = {
        ...preset,
        id: keepId,
        projectNumber: keepProject,
        isPreset: false,
        presetName: ''
    };
    renderColorLog();
    scheduleColorLogSave();
}

// ---------- Multi-color: toggle, pills, add/delete ----------

/**
 * Apply the current multi-color state to the toolbar UI:
 *   - the checkbox reflects the project's flag, and is locked-on once true
 *   - the pill strip is visible when multi-color is on
 *   - the pill list reflects currentColorLogs with the active one highlighted
 */
function renderColorLogsToolbar() {
    const cb = document.getElementById('pp-cl-multi-toggle');
    if (cb) {
        cb.checked = currentMultiColorEnabled;
        // One-way: once enabled, lock it. Disabled state is what carries
        // the "already on" affordance for the user.
        cb.disabled = currentMultiColorEnabled;
    }
    renderColorLogsPills();
}

function renderColorLogsPills() {
    const bar = document.getElementById('pp-cl-logs-bar');
    const pills = document.getElementById('pp-cl-logs-pills');
    const delBtn = document.getElementById('pp-cl-logs-delete');
    if (!bar || !pills) return;

    bar.hidden = !currentMultiColorEnabled;
    if (!currentMultiColorEnabled) {
        pills.innerHTML = '';
        return;
    }

    if (currentColorLogs.length === 0) {
        pills.innerHTML = '<span class="pp-cl-logs-empty">No color logs yet — click + Add color log to create one.</span>';
        if (delBtn) delBtn.disabled = true;
        return;
    }

    pills.innerHTML = currentColorLogs.map(l => {
        const active = l.id === currentColorLogId ? ' is-active' : '';
        const label = escapeHtml((l.name || '').trim() || '(unnamed)');
        return `<button type="button" class="pp-cl-logs-pill${active}" data-color-log-id="${escapeHtml(l.id)}">${label}</button>`;
    }).join('');
    if (delBtn) delBtn.disabled = currentColorLogs.length === 0;
}

async function handleMultiColorToggleChange(checkbox) {
    if (!currentProjectNumber) {
        checkbox.checked = false;
        return;
    }
    if (currentMultiColorEnabled) {
        // Already on — one-way switch, ignore.
        checkbox.checked = true;
        return;
    }
    if (!checkbox.checked) return; // unchecking from off state is a no-op

    const confirmed = window.confirm(
        'Enable multiple color logs for this project?\n\n' +
        'This is a one-way switch — once on, it cannot be turned off. ' +
        'All existing components will stay linked to your current color log.'
    );
    if (!confirmed) {
        checkbox.checked = false;
        return;
    }

    try {
        // Flush any in-flight save first so the existing log has an id.
        if (colorLogSaveTimer) {
            clearTimeout(colorLogSaveTimer);
            colorLogSaveTimer = null;
            await saveColorLogNow();
        }
        await enableMultiColorForProject(currentProjectNumber);
        currentMultiColorEnabled = true;

        // Re-load color logs so a single-log project gets its row reflected
        // back from the DB (the existing-pill UI needs it in currentColorLogs).
        const list = await loadColorLogsForProject(currentProjectNumber);
        currentColorLogs = list;
        if (list.length > 0 && !list.some(l => l.id === currentColorLogId)) {
            currentColorLogId = list[0].id;
            currentColorLog = list[0];
            renderColorLog();
        }

        // Reload casting components / inventory so their color_log_id FKs
        // (which the migration backfilled) are reflected in the in-memory
        // caches. Best-effort — silently skip if loaders fail.
        try { await reloadColorLinkedRowsForProject(); } catch (e) {
            logger.warn('[multi-color] reload after enable failed', e);
        }

        renderColorLogsToolbar();
        rerenderColorAwareTabs();
        showToast('Multi-color enabled for this project', 'success');
    } catch (err) {
        logger.error('[multi-color] enable failed', err);
        checkbox.checked = false;
        showToast('Failed to enable multi-color', 'error');
    }
}

async function handleColorLogPillClick(id) {
    if (!id || id === currentColorLogId) return;
    // Flush pending save on the previous log before switching.
    if (colorLogSaveTimer) {
        clearTimeout(colorLogSaveTimer);
        colorLogSaveTimer = null;
        try { await saveColorLogNow(); } catch (e) { /* logged */ }
    }
    const next = currentColorLogs.find(l => l.id === id);
    if (!next) return;
    currentColorLogId = id;
    currentColorLog = next;
    renderColorLog();
    renderColorLogsPills();
}

async function handleAddColorLog() {
    if (!currentProjectNumber || !currentMultiColorEnabled) return;
    // Flush pending save on the active log first.
    if (colorLogSaveTimer) {
        clearTimeout(colorLogSaveTimer);
        colorLogSaveTimer = null;
        try { await saveColorLogNow(); } catch (e) { /* logged */ }
    }
    try {
        const created = await createColorLogForProject(currentProjectNumber);
        currentColorLogs.push(created);
        currentColorLogId = created.id;
        currentColorLog = created;
        renderColorLog();
        renderColorLogsPills();
        // Re-render dependent UI so the new log shows up in dropdowns.
        rerenderColorAwareTabs();
    } catch (err) {
        logger.error('[color-log] add failed', err);
        showToast('Failed to add color log', 'error');
    }
}

async function handleDeleteColorLog(id) {
    if (!id || !currentMultiColorEnabled) return;
    const log = currentColorLogs.find(l => l.id === id);
    if (!log) return;

    let counts;
    try {
        counts = await getColorLogUsageCounts(id);
    } catch (err) {
        logger.error('[color-log] usage check failed', err);
        showToast('Could not check color log usage', 'error');
        return;
    }
    const total = counts.components + counts.inventory + counts.batchTickets;
    if (total > 0) {
        const parts = [];
        if (counts.components)   parts.push(`${counts.components} component${counts.components === 1 ? '' : 's'}`);
        if (counts.inventory)    parts.push(`${counts.inventory} inventory item${counts.inventory === 1 ? '' : 's'}`);
        if (counts.batchTickets) parts.push(`${counts.batchTickets} batch ticket${counts.batchTickets === 1 ? '' : 's'}`);
        showToast(`Can't delete — still used by ${parts.join(', ')}`, 'error');
        return;
    }

    if (!window.confirm(`Delete color log "${log.name || '(unnamed)'}"?`)) return;

    try {
        await deleteColorLog(id);
        currentColorLogs = currentColorLogs.filter(l => l.id !== id);
        if (currentColorLogs.length > 0) {
            currentColorLogId = currentColorLogs[0].id;
            currentColorLog = currentColorLogs[0];
        } else {
            currentColorLogId = null;
            currentColorLog = createEmptyColorLog();
        }
        renderColorLog();
        renderColorLogsPills();
        rerenderColorAwareTabs();
    } catch (err) {
        logger.error('[color-log] delete failed', err);
        showToast('Failed to delete color log', 'error');
    }
}

/** Re-render every tab whose UI depends on the color log list. */
function rerenderColorAwareTabs() {
    if (currentTab === 'tracking') renderTracking();
    if (currentTab === 'castings') renderCastings();
    if (currentTab === 'shipping') renderShipping();
    if (currentTab === 'batch-tickets') {
        try { renderBatchTickets(); } catch (e) { /* tab may not be ready */ }
    }
}

/**
 * Reload casting components + inventory after the multi-color enable
 * runs its backfill, so the in-memory caches reflect the newly populated
 * color_log_id FKs. Used only at toggle-on time.
 */
async function reloadColorLinkedRowsForProject() {
    if (!currentProjectNumber) return;
    const castingIds = (currentCastings || []).map(c => c.id);
    if (castingIds.length === 0) return;

    const [compsMap, invMap] = await Promise.all([
        loadAllComponentsForProject(castingIds),
        loadAllInventoryForProject(castingIds)
    ]);
    currentCastingComponents = compsMap;
    currentCastingInventory = invMap;
}

// ---------- Multi-color helpers ----------

/** In-memory lookup. Falls back to a fresh DB fetch when not in the cache. */
function getColorLogByIdSync(id) {
    if (!id) return null;
    return currentColorLogs.find(l => l.id === id) || null;
}

/**
 * Resolve a component / inventory row's color display name. Prefers the
 * linked color_log_id (post-feature data); falls back to the legacy
 * free-text `color` column for rows that predate the FK; finally falls
 * back to the project's currently active color log name.
 */
function resolveComponentColorName(comp) {
    if (!comp) return '';
    const log = getColorLogByIdSync(comp.color_log_id);
    if (log) return log.name || '';
    if (comp.color) return comp.color;
    if (currentMultiColorEnabled) return '';
    return currentColorLog?.name || '';
}

/**
 * For a batch ticket: returns the color-log form record to scale from.
 * Priority: explicit ticket.colorLogId > most-common color_log_id among
 * the casting's components > project's first color log.
 */
function getActiveBatchColorLog(casting, ticket) {
    // Explicit override on the ticket.
    if (ticket?.colorLogId) {
        const explicit = getColorLogByIdSync(ticket.colorLogId);
        if (explicit) return explicit;
    }
    // Most-common color_log_id among the casting's components.
    if (casting?.id) {
        const comps = currentCastingComponents.get(casting.id) || [];
        const counts = new Map();
        for (const c of comps) {
            if (!c.color_log_id) continue;
            counts.set(c.color_log_id, (counts.get(c.color_log_id) || 0) + 1);
        }
        if (counts.size > 0) {
            let bestId = null, bestN = -1;
            for (const [id, n] of counts) {
                if (n > bestN) { bestId = id; bestN = n; }
            }
            const hit = getColorLogByIdSync(bestId);
            if (hit) return hit;
        }
    }
    // Project's first log.
    if (currentColorLogs.length > 0) return currentColorLogs[0];
    // Legacy single-log fallback.
    return currentColorLog || null;
}

/**
 * Build a `<select>` of the project's color logs for a component / inventory
 * cell. When the project has zero color logs, renders a single disabled
 * option prompting the user to create one. Returns an HTML string.
 *
 * @param {string|null} selectedId
 * @param {{className?:string, dataAttrs?:Object}} [opts]
 */
function buildColorLogSelectHtml(selectedId, opts = {}) {
    const cls = opts.className || 'pp-color-log-select';
    const dataAttrs = Object.entries(opts.dataAttrs || {})
        .map(([k, v]) => `${k}="${escapeHtml(String(v))}"`)
        .join(' ');
    if (!currentColorLogs.length) {
        return `<select class="${cls}" ${dataAttrs} disabled>` +
            `<option value="">— Create color log —</option>` +
            `</select>`;
    }
    const options = currentColorLogs.map(l => {
        const sel = (selectedId && l.id === selectedId) ? ' selected' : '';
        return `<option value="${escapeHtml(l.id)}"${sel}>${escapeHtml(l.name || '(unnamed)')}</option>`;
    }).join('');
    // Auto-select first when nothing matches (e.g. legacy row with null FK).
    const placeholderOpt = selectedId && !currentColorLogs.some(l => l.id === selectedId)
        ? `<option value="" disabled selected>— Pick color log —</option>`
        : '';
    return `<select class="${cls}" ${dataAttrs}>${placeholderOpt}${options}</select>`;
}

function setColorLogStatus(state) {
    const el = document.getElementById('pp-cl-save-status');
    if (!el) return;
    el.classList.remove('is-saving', 'is-saved', 'is-error');
    if (state === 'saving') {
        el.classList.add('is-saving');
        el.textContent = 'Saving…';
    } else if (state === 'saved') {
        el.classList.add('is-saved');
        el.textContent = 'Saved';
    } else if (state === 'error') {
        el.classList.add('is-error');
        el.textContent = 'Save failed';
    } else {
        el.textContent = '';
    }
}

function scheduleColorLogSave() {
    if (!currentProjectNumber || !currentColorLog) return;
    if (colorLogSaveTimer) clearTimeout(colorLogSaveTimer);
    setColorLogStatus('saving');
    colorLogSaveTimer = setTimeout(saveColorLogNow, 700);
}

async function saveColorLogNow() {
    if (!currentProjectNumber || !currentColorLog) return;
    try {
        const saved = await saveColorLogForProject(currentProjectNumber, currentColorLog);
        if (saved) {
            // Preserve the id so subsequent saves are UPDATEs not INSERTs.
            const wasNew = !currentColorLog.id;
            currentColorLog.id = saved.id;
            if (wasNew) currentColorLogId = saved.id;
            // Keep the in-memory list in sync so the pill strip / dropdowns
            // see the latest name. New rows get appended; existing rows
            // updated in place.
            const existingIdx = currentColorLogs.findIndex(l => l.id === saved.id);
            if (existingIdx === -1) {
                currentColorLogs.push(currentColorLog);
            } else {
                currentColorLogs[existingIdx] = currentColorLog;
            }
            if (typeof renderColorLogsPills === 'function') renderColorLogsPills();
        }
        setColorLogStatus('saved');
        setTimeout(() => setColorLogStatus(''), 1500);
    } catch (err) {
        logger.error('[color-log] save failed', err);
        setColorLogStatus('error');
    }
}

function toggleColorLogMenu() {
    const btn = document.getElementById('pp-cl-menu-btn');
    const list = document.getElementById('pp-cl-menu-list');
    if (!btn || !list) return;
    const open = !list.hidden;
    if (open) closeColorLogMenu();
    else {
        list.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
    }
}

function closeColorLogMenu() {
    const btn = document.getElementById('pp-cl-menu-btn');
    const list = document.getElementById('pp-cl-menu-list');
    if (list && !list.hidden) list.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
}

function handleSaveAsPresetClick() {
    if (!currentColorLog) return;
    openPresetSaveModal();
}

function findPresetByName(name) {
    const target = (name || '').trim().toLowerCase();
    if (!target) return null;
    return colorLogPresets.find(p =>
        ((p.presetName || p.name || '').trim().toLowerCase()) === target
    ) || null;
}

function openPresetSaveModal() {
    const modal = document.getElementById('pp-cl-preset-modal');
    const input = document.getElementById('pp-cl-preset-modal-name');
    if (!modal || !input) return;
    const defaultName = (currentColorLog?.name || '').trim() || 'New Standard Color';
    input.value = defaultName;
    modal.hidden = false;
    updatePresetSaveModalState();
    setTimeout(() => { input.focus(); input.select(); }, 0);
}

function closePresetSaveModal() {
    const modal = document.getElementById('pp-cl-preset-modal');
    if (modal) modal.hidden = true;
}

function updatePresetSaveModalState() {
    const input = document.getElementById('pp-cl-preset-modal-name');
    const hint = document.getElementById('pp-cl-preset-modal-hint');
    const submit = document.getElementById('pp-cl-preset-modal-submit');
    if (!input || !hint || !submit) return;

    const trimmed = input.value.trim();
    if (!trimmed) {
        hint.hidden = true;
        submit.disabled = true;
        submit.textContent = 'Save';
        submit.classList.remove('pp-danger-btn');
        submit.classList.add('pp-primary-btn');
        return;
    }

    const match = findPresetByName(trimmed);
    submit.disabled = false;
    if (match) {
        hint.hidden = false;
        hint.textContent = `A standard color named "${match.presetName || match.name}" already exists. Saving will override it.`;
        hint.classList.add('pp-modal-hint-warn');
        submit.textContent = 'Override';
    } else {
        hint.hidden = false;
        hint.textContent = 'Will be saved as a new standard color.';
        hint.classList.remove('pp-modal-hint-warn');
        submit.textContent = 'Save';
    }
}

async function handlePresetSaveSubmit() {
    if (!currentColorLog) return;
    const input = document.getElementById('pp-cl-preset-modal-name');
    const submit = document.getElementById('pp-cl-preset-modal-submit');
    if (!input || !submit) return;

    const name = input.value.trim();
    if (!name) return;

    const match = findPresetByName(name);
    submit.disabled = true;
    const originalLabel = submit.textContent;
    submit.textContent = match ? 'Overriding…' : 'Saving…';

    try {
        // Presets are project-agnostic — strip the project field so it stays
        // empty in the library and gets refilled live when loaded into a project.
        const presetForm = { ...currentColorLog, project: '' };
        if (match) {
            await updateColorLogPreset(match.id, presetForm, name);
            showToast('Standard color updated', 'success');
        } else {
            await saveColorLogAsPreset(name, presetForm);
            showToast('Standard color saved', 'success');
        }
        closePresetSaveModal();
        await refreshPresetPicker();
    } catch (err) {
        logger.error('[color-log] saveAsPreset failed', err);
        showToast('Failed to save standard color', 'error');
        submit.disabled = false;
        submit.textContent = originalLabel;
    }
}

// ---------- Job Memos ----------

async function activateJobMemosTab() {
    const needsSave = document.getElementById('pp-jm-needs-save');
    const toolbar   = document.getElementById('pp-jm-toolbar');
    const wrap      = document.getElementById('pp-jm-wrap');

    if (!currentProjectNumber) {
        if (needsSave) needsSave.hidden = false;
        if (toolbar) toolbar.hidden = true;
        if (wrap) wrap.hidden = true;
        return;
    }

    if (needsSave) needsSave.hidden = true;
    if (toolbar) toolbar.hidden = false;
    if (wrap) wrap.hidden = false;

    if (jobMemosLoadedFor !== currentProjectNumber) {
        try {
            currentJobMemos = await loadMemosForProject(currentProjectNumber);
        } catch (err) {
            logger.error('[job-memos] load failed', err);
            currentJobMemos = [];
            showToast('Failed to load job memos', 'error');
        }
        jobMemosLoadedFor = currentProjectNumber;
    }
    renderJobMemos();
}

function renderJobMemos() {
    const listEl  = document.getElementById('pp-jm-list');
    const emptyEl = document.getElementById('pp-jm-empty');
    const countEl = document.getElementById('pp-jm-count');
    if (!listEl) return;

    const memos = currentJobMemos || [];
    if (countEl) {
        countEl.textContent = memos.length === 0
            ? ''
            : `${memos.length} memo${memos.length === 1 ? '' : 's'}`;
    }
    if (emptyEl) emptyEl.hidden = memos.length > 0;

    // Group by memo_date. Memos are already sorted newest-first, so we
    // just walk and start a new group every time the date key changes.
    const groups = [];
    let group = null;
    for (const memo of memos) {
        const key = memo.memoDate || '';
        if (!group || group.dateKey !== key) {
            group = { dateKey: key, label: formatJobMemoDateHeader(key), memos: [] };
            groups.push(group);
        }
        group.memos.push(memo);
    }

    listEl.innerHTML = groups.map(g => `
        <section class="pp-jm-group">
            <h3 class="pp-jm-date-header">${escapeHtml(g.label)}</h3>
            ${g.memos.map(renderJobMemoCard).join('')}
        </section>
    `).join('');

    // Size pre-existing memo bodies to their content on first render
    // (browsers without field-sizing:content fall back to this).
    listEl.querySelectorAll('.pp-jm-body').forEach(autoGrowTextarea);
}

/**
 * Smart label for a date-header in the memo list.
 * - Today / Yesterday for the obvious cases
 * - "Wed, May 6" for dates within the current year
 * - "May 4, 2024" for older entries
 * Parses ISO YYYY-MM-DD as a *local* date so timezones don't shift it.
 */
function formatJobMemoDateHeader(isoDate) {
    if (!isoDate) return 'No date';
    const parts = isoDate.split('-').map(Number);
    if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return isoDate;
    const [y, m, d] = parts;
    const date = new Date(y, m - 1, d);
    if (Number.isNaN(date.getTime())) return isoDate;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateMid = new Date(date);
    dateMid.setHours(0, 0, 0, 0);

    const dayMs = 86400000;
    const diffDays = Math.round((dateMid.getTime() - today.getTime()) / dayMs);

    if (diffDays === 0)  return 'Today';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays === 1)  return 'Tomorrow';

    const sameYear = date.getFullYear() === today.getFullYear();
    if (sameYear) {
        return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Return the most-recent non-empty author on the project so we can
 * pre-fill new memos. Memos are newest-first, so iterate and return
 * the first hit.
 */
function findLastJobMemoAuthor(memos) {
    if (!Array.isArray(memos)) return '';
    for (const m of memos) {
        const a = (m.author || '').trim();
        if (a !== '') return a;
    }
    return '';
}

/**
 * Re-sort currentJobMemos in place by memo_date DESC, created_at DESC.
 * Mirrors the server-side ordering so date edits land the memo in the
 * right group without needing a round-trip.
 */
function sortJobMemosLocal() {
    currentJobMemos.sort((a, b) => {
        const da = a.memoDate || '';
        const db = b.memoDate || '';
        if (da !== db) return db.localeCompare(da);
        const ca = a.createdAt || '';
        const cb = b.createdAt || '';
        return cb.localeCompare(ca);
    });
}

function renderJobMemoCard(memo) {
    const id     = escapeAttr(memo.id);
    const date   = escapeAttr(memo.memoDate || '');
    const author = escapeAttr(memo.author || '');
    const body   = escapeHtml(memo.body || '');
    return `
        <article class="pp-jm-card" data-memo-id="${id}">
            <div class="pp-jm-card-rail" aria-hidden="true"></div>
            <div class="pp-jm-card-row">
                <input type="date" class="pp-jm-date" data-jm-field="memoDate" value="${date}" aria-label="Memo date">
                <textarea class="pp-jm-body" data-jm-field="body" placeholder="Log an event…" rows="1" aria-label="Memo body">${body}</textarea>
                <input type="text" class="pp-jm-author" data-jm-field="author" placeholder="Author" value="${author}" aria-label="Author">
                <button type="button" class="pp-jm-delete" data-jm-delete title="Delete memo" aria-label="Delete memo">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        </article>
    `;
}

async function handleAddJobMemo() {
    if (!currentProjectNumber) {
        showToast('Save the project first', 'error');
        return;
    }
    // Carry forward the last author used on this project so users don't
    // re-type the same name on every memo.
    const suggestedAuthor = findLastJobMemoAuthor(currentJobMemos);
    try {
        const memo = await createMemoForProject(currentProjectNumber, {
            memoDate: new Date().toISOString().slice(0, 10),
            author: suggestedAuthor
        });
        if (memo) {
            // Newest first: prepend.
            currentJobMemos.unshift(memo);
            renderJobMemos();
            // Focus the new card's body for fast entry.
            const card = document.querySelector(`.pp-jm-card[data-memo-id="${cssEscape(memo.id)}"]`);
            if (card) card.querySelector('.pp-jm-body')?.focus();
        }
    } catch (err) {
        logger.error('[job-memos] create failed', err);
        showToast('Failed to add memo', 'error');
    }
}

async function handleDeleteJobMemo(memoId) {
    if (!memoId) return;
    const idx = currentJobMemos.findIndex(m => m.id === memoId);
    if (idx === -1) return;
    const memo = currentJobMemos[idx];
    const hasContent = (memo.body && memo.body.trim() !== '') || (memo.author && memo.author.trim() !== '');
    if (hasContent && !confirm('Delete this memo? This cannot be undone.')) return;
    // Cancel any pending save for this memo.
    const t = jobMemoSaveTimers.get(memoId);
    if (t) { clearTimeout(t); jobMemoSaveTimers.delete(memoId); }
    try {
        await deleteJobMemo(memoId);
        currentJobMemos.splice(idx, 1);
        renderJobMemos();
    } catch (err) {
        logger.error('[job-memos] delete failed', err);
        showToast('Failed to delete memo', 'error');
    }
}

function scheduleJobMemoSave(memoId, field, value) {
    const memo = currentJobMemos.find(m => m.id === memoId);
    if (!memo) return;
    // Local-state update first so we don't lose typing if a re-render happens.
    memo[field] = value;
    const existing = jobMemoSaveTimers.get(memoId);
    if (existing) clearTimeout(existing);
    setJobMemoStatus('saving');
    const t = setTimeout(() => saveJobMemoNow(memoId), 600);
    jobMemoSaveTimers.set(memoId, t);
}

async function saveJobMemoNow(memoId) {
    const memo = currentJobMemos.find(m => m.id === memoId);
    if (!memo) return;
    jobMemoSaveTimers.delete(memoId);
    try {
        await updateJobMemo(memoId, {
            memoDate: memo.memoDate,
            body: memo.body,
            author: memo.author
        });
        if (jobMemoSaveTimers.size === 0) setJobMemoStatus('saved');
    } catch (err) {
        logger.error('[job-memos] update failed', err);
        setJobMemoStatus('error');
        showToast('Failed to save memo', 'error');
    }
}

async function flushAllJobMemoSaves() {
    const ids = [...jobMemoSaveTimers.keys()];
    for (const id of ids) {
        clearTimeout(jobMemoSaveTimers.get(id));
    }
    jobMemoSaveTimers.clear();
    for (const id of ids) {
        try { await saveJobMemoNow(id); } catch (e) { /* already logged */ }
    }
}

function setJobMemoStatus(state) {
    const el = document.getElementById('pp-jm-save-status');
    if (!el) return;
    if (state === 'saving') { el.textContent = 'Saving…'; el.className = 'pp-jm-save-status is-saving'; }
    else if (state === 'saved') { el.textContent = 'Saved'; el.className = 'pp-jm-save-status is-saved'; setTimeout(() => { if (el.classList.contains('is-saved')) el.textContent = ''; }, 1500); }
    else if (state === 'error') { el.textContent = 'Save failed'; el.className = 'pp-jm-save-status is-error'; }
    else { el.textContent = ''; el.className = 'pp-jm-save-status'; }
}

// ---------- Recent Memos (cross-project feed) ----------

function setFolderTabActive(name) {
    currentFolderTab = name;
    document.querySelectorAll('[data-folder-tab]').forEach(t => {
        const active = t.dataset.folderTab === name;
        t.classList.toggle('pp-folder-tab-active', active);
        t.setAttribute('aria-selected', String(active));
    });
    setViewInUrl(name);
}

async function showRecentMemosView() {
    // Flush any pending saves in case the user is coming from a form view.
    if (colorLogSaveTimer) {
        clearTimeout(colorLogSaveTimer);
        colorLogSaveTimer = null;
        try { await saveColorLogNow(); } catch (e) { /* logged */ }
    }
    await flushAllBatchTicketSaves();
    await flushAllJobMemoSaves();

    currentProjectNumber = null;
    setProjectInUrl(null);
    setTabInUrl(null);

    document.getElementById('pp-list-view').hidden = true;
    document.getElementById('pp-form-view').hidden = true;
    const memosView = document.getElementById('pp-memos-view');
    if (memosView) memosView.hidden = false;
    setFolderTabActive('recent-memos');

    await loadAndRenderRecentMemos();
}

async function loadAndRenderRecentMemos() {
    const listEl = document.getElementById('pp-rm-list');
    if (listEl) listEl.innerHTML = '<div class="pp-rm-loading">Loading memos…</div>';
    try {
        recentMemos = await loadAllRecentMemos(200);
    } catch (err) {
        logger.error('[recent-memos] load failed', err);
        recentMemos = [];
        showToast('Failed to load recent memos', 'error');
    }
    renderRecentMemos();
}

function renderRecentMemos() {
    const listEl  = document.getElementById('pp-rm-list');
    const emptyEl = document.getElementById('pp-rm-empty');
    const countEl = document.getElementById('pp-rm-count');
    if (!listEl) return;

    const filter = (recentMemosFilter || '').trim().toLowerCase();
    const filtered = !filter ? recentMemos : recentMemos.filter(m => {
        const project = projectByNumber(m.projectNumber);
        const haystack = [
            m.projectNumber || '',
            project?.project_name || '',
            m.body || '',
            m.author || ''
        ].join(' ').toLowerCase();
        return haystack.includes(filter);
    });

    if (countEl) {
        if (recentMemos.length === 0) {
            countEl.textContent = '';
        } else if (filter && filtered.length !== recentMemos.length) {
            countEl.textContent = `${filtered.length} of ${recentMemos.length}`;
        } else {
            countEl.textContent = `${filtered.length} memo${filtered.length === 1 ? '' : 's'}`;
        }
    }
    if (emptyEl) emptyEl.hidden = filtered.length > 0;

    // Group by memo_date (already sorted newest-first by the server).
    const groups = [];
    let group = null;
    for (const memo of filtered) {
        const key = memo.memoDate || '';
        if (!group || group.dateKey !== key) {
            group = { dateKey: key, label: formatJobMemoDateHeader(key), memos: [] };
            groups.push(group);
        }
        group.memos.push(memo);
    }

    listEl.innerHTML = groups.map(g => `
        <section class="pp-jm-group">
            <h3 class="pp-jm-date-header">${escapeHtml(g.label)}</h3>
            ${g.memos.map(renderRecentMemoCard).join('')}
        </section>
    `).join('');
}

function renderRecentMemoCard(memo) {
    const project = projectByNumber(memo.projectNumber);
    const projectNum = memo.projectNumber || '(unknown)';
    const projectName = project?.project_name || '';
    const chipText = projectName ? `${projectNum} — ${projectName}` : projectNum;
    const bodyHtml = memo.body && memo.body.trim() !== ''
        ? escapeHtml(memo.body)
        : '<span class="pp-rm-empty-body">(empty memo)</span>';
    const authorHtml = (memo.author && memo.author.trim() !== '')
        ? `<span class="pp-rm-author">${escapeHtml(memo.author)}</span>`
        : '';
    return `
        <article class="pp-jm-card pp-rm-card" data-memo-id="${escapeAttr(memo.id)}">
            <div class="pp-jm-card-rail" aria-hidden="true"></div>
            <div class="pp-rm-card-row">
                <button type="button" class="pp-rm-project-chip" data-rm-project="${escapeAttr(memo.projectNumber || '')}" title="Open ${escapeAttr(chipText)} → Job Memos">
                    ${escapeHtml(chipText)}
                </button>
                <div class="pp-rm-body">${bodyHtml}</div>
                ${authorHtml}
            </div>
        </article>
    `;
}

function projectByNumber(num) {
    if (!num) return null;
    const target = String(num).trim();
    return allProjectRows.find(p => String(p.project_number || '').trim() === target) || null;
}

async function handleRecentMemoProjectClick(projectNumber) {
    if (!projectNumber) return;
    // Open the project in form view and land on the Job Memos tab.
    currentTab = 'job-memos';
    await showFormView(projectNumber);
    setActiveTab('job-memos');
    activateJobMemosTab();
}

// ---------- Wire up ----------

function wireEvents() {
    // List: search
    document.getElementById('pp-search').addEventListener('input', (e) => {
        renderList(e.target.value);
    });

    // List: new project (opens modal)
    document.getElementById('pp-new-btn').addEventListener('click', () => {
        openNewProjectModal();
    });

    // New Project modal: close handlers
    document.getElementById('pp-new-modal-close').addEventListener('click', closeNewProjectModal);
    document.getElementById('pp-new-modal-cancel').addEventListener('click', closeNewProjectModal);
    document.getElementById('pp-new-modal').addEventListener('click', (e) => {
        if (e.target.id === 'pp-new-modal') closeNewProjectModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !document.getElementById('pp-new-modal').hidden) {
            closeNewProjectModal();
        }
    });

    // New Project modal: submit
    document.getElementById('pp-new-modal-form').addEventListener('submit', (e) => {
        e.preventDefault();
        handleCreateNewProject();
    });

    // Preset save modal: close handlers
    document.getElementById('pp-cl-preset-modal-close').addEventListener('click', closePresetSaveModal);
    document.getElementById('pp-cl-preset-modal-cancel').addEventListener('click', closePresetSaveModal);
    document.getElementById('pp-cl-preset-modal').addEventListener('click', (e) => {
        if (e.target.id === 'pp-cl-preset-modal') closePresetSaveModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !document.getElementById('pp-cl-preset-modal').hidden) {
            closePresetSaveModal();
        }
    });
    document.getElementById('pp-cl-preset-modal-name').addEventListener('input', updatePresetSaveModalState);
    document.getElementById('pp-cl-preset-modal-form').addEventListener('submit', (e) => {
        e.preventDefault();
        handlePresetSaveSubmit();
    });

    // Delete Project modal: close handlers
    document.getElementById('pp-delete-modal-close').addEventListener('click', closeDeleteModal);
    document.getElementById('pp-delete-modal-cancel').addEventListener('click', closeDeleteModal);
    document.getElementById('pp-delete-modal').addEventListener('click', (e) => {
        if (e.target.id === 'pp-delete-modal') closeDeleteModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !document.getElementById('pp-delete-modal').hidden) {
            closeDeleteModal();
        }
    });

    // Delete Project modal: enable button only when input matches project number
    const deleteInput = document.getElementById('pp-delete-modal-input');
    deleteInput.addEventListener('input', () => {
        const target = document.getElementById('pp-delete-modal-target')?.textContent || '';
        const btn = document.getElementById('pp-delete-modal-confirm');
        btn.disabled = (deleteInput.value.trim() !== target);
    });

    // Delete Project modal: submit
    document.getElementById('pp-delete-modal-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const target = document.getElementById('pp-delete-modal-target')?.textContent || '';
        if (deleteInput.value.trim() !== target) return;
        performDelete();
    });

    // List: entire row click (event delegation)
    document.getElementById('pp-list-tbody').addEventListener('click', (e) => {
        const tr = e.target.closest('tr[data-project-number]');
        if (!tr) return;
        showFormView(tr.getAttribute('data-project-number'));
    });

    // List: column header click → sort
    const theadRow = document.getElementById('pp-list-thead-row');
    if (theadRow) {
        theadRow.addEventListener('click', (e) => {
            const th = e.target.closest('th[data-sort-key]');
            if (!th) return;
            const key = th.dataset.sortKey;
            if (listSort.column === key) {
                listSort.direction = listSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                listSort = { column: key, direction: 'asc' };
            }
            renderList(document.getElementById('pp-search').value);
        });
    }

    // Form: back to list — return to whichever folder tab was last active
    document.getElementById('pp-back-list-btn').addEventListener('click', () => {
        if (currentFolderTab === 'recent-memos') {
            showRecentMemosView();
        } else {
            showListView();
        }
    });

    // Folder tabs at the very top (Project Portal / Recent Memos / disabled stubs)
    document.querySelectorAll('[data-folder-tab]').forEach(tab => {
        tab.addEventListener('click', () => {
            const which = tab.dataset.folderTab;
            if (which === 'projects') {
                showListView();
            } else if (which === 'recent-memos') {
                showRecentMemosView();
            }
        });
    });

    // Recent Memos: search filter
    const rmSearch = document.getElementById('pp-rm-search');
    if (rmSearch) {
        rmSearch.addEventListener('input', (e) => {
            recentMemosFilter = e.target.value || '';
            renderRecentMemos();
        });
    }

    // Recent Memos: project-chip click → open that project's Job Memos tab
    const rmView = document.getElementById('pp-memos-view');
    if (rmView) {
        rmView.addEventListener('click', (e) => {
            const chip = e.target.closest('[data-rm-project]');
            if (!chip) return;
            handleRecentMemoProjectClick(chip.dataset.rmProject);
        });
    }

    // Form: auto-save on input/change (debounced)
    const formEl = document.getElementById('pp-form');
    if (formEl) {
        formEl.addEventListener('input', (e) => {
            if (e.target instanceof HTMLTextAreaElement) autoGrowTextarea(e.target);
            scheduleProjectInfoSave();
        });
        formEl.addEventListener('change', scheduleProjectInfoSave);
    }

    // CR Notes panel: lives outside #pp-form, so it needs its own auto-save listener.
    // Fields are still part of FORM_FIELDS, so populate/read pick them up.
    const crNotesPanel = document.querySelector('.pp-tab-panel[data-panel="cr-notes"]');
    if (crNotesPanel) {
        crNotesPanel.addEventListener('input', (e) => {
            // Classroom task inline edits route to the task save flow, not the project save.
            const taskCard = e.target.closest('.pp-cr-task-card[data-task-id]');
            if (taskCard && e.target.matches('input[data-field="description"], input[data-field="assignee"]')) {
                scheduleClassroomTaskSave(taskCard.getAttribute('data-task-id'));
                return;
            }
            // Auto-grow textareas as content is typed
            if (e.target.classList.contains('pp-cr-textarea')) {
                autoGrowTextarea(e.target);
            }
            scheduleProjectInfoSave();
        });
        crNotesPanel.addEventListener('change', (e) => {
            // Checkbox toggle on a classroom task — immediate save, no debounce.
            const taskCard = e.target.closest('.pp-cr-task-card[data-task-id]');
            if (taskCard && e.target.matches('input[data-field="is_completed"]')) {
                handleToggleClassroomTaskComplete(taskCard.getAttribute('data-task-id'), e.target.checked);
                return;
            }
            scheduleProjectInfoSave();
        });

        // Classroom sub-tabs (1 / 2 / 3) — switch the visible classroom panel.
        crNotesPanel.querySelectorAll('.pp-cr-subtab').forEach(btn => {
            btn.addEventListener('click', () => {
                const num = btn.dataset.classroom;
                if (num) setActiveClassroom(num);
            });
        });

        // Classroom tasks: + Add Task buttons (one per classroom)
        crNotesPanel.querySelectorAll('button[data-cr-add-task]').forEach(btn => {
            btn.addEventListener('click', () => {
                const num = btn.dataset.crAddTask;
                if (num) handleAddClassroomTaskClick(num);
            });
        });

        // Classroom tasks: row delete (event delegation across all 3 lists)
        crNotesPanel.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action="delete"]');
            if (!btn) return;
            const card = btn.closest('.pp-cr-task-card[data-task-id]');
            if (!card) return;
            handleDeleteClassroomTask(card.getAttribute('data-task-id'));
        });
    }

    // Form: delete
    document.getElementById('pp-delete-btn').addEventListener('click', (e) => {
        e.preventDefault();
        handleDelete();
    });

    // Form: print — Batch Tickets, Color Log, Optimizer, and Tracking tabs use dedicated print handlers.
    document.getElementById('pp-print-btn').addEventListener('click', (e) => {
        e.preventDefault();
        if (currentTab === 'batch-tickets') {
            if (currentBatchCastingId) handlePrintBatchTickets(currentBatchCastingId);
            else showToast('Select a casting first', 'error');
            return;
        }
        if (currentTab === 'color-log') {
            handlePrintColorLog();
            return;
        }
        if (currentTab === 'optimizer') {
            openOptPrintModal();
            return;
        }
        if (currentTab === 'info') {
            handlePrintCoverPage();
            return;
        }
        // Tracking tab uses per-casting print buttons in each section header — no global handler.
        handlePrint();
    });

    // Print Tracking modal: close handlers
    document.getElementById('pp-track-print-modal-close').addEventListener('click', closeTrackPrintModal);
    document.getElementById('pp-track-print-modal-cancel').addEventListener('click', closeTrackPrintModal);
    document.getElementById('pp-track-print-modal').addEventListener('click', (e) => {
        if (e.target.id === 'pp-track-print-modal') closeTrackPrintModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !document.getElementById('pp-track-print-modal').hidden) {
            closeTrackPrintModal();
        }
    });
    document.getElementById('pp-track-print-modal-list').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-casting-id]');
        if (!btn) return;
        const id = btn.dataset.castingId;
        if (!id) return;
        closeTrackPrintModal();
        handlePrintTracking(id);
    });

    // Print Optimizer modal: close + actions
    document.getElementById('pp-opt-print-modal-close').addEventListener('click', closeOptPrintModal);
    document.getElementById('pp-opt-print-modal-cancel').addEventListener('click', closeOptPrintModal);
    document.getElementById('pp-opt-print-modal').addEventListener('click', (e) => {
        if (e.target.id === 'pp-opt-print-modal') closeOptPrintModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !document.getElementById('pp-opt-print-modal').hidden) {
            closeOptPrintModal();
        }
    });
    document.getElementById('pp-opt-print-select-all').addEventListener('click', () => setOptPrintAllChecked(true));
    document.getElementById('pp-opt-print-select-none').addEventListener('click', () => setOptPrintAllChecked(false));
    document.getElementById('pp-opt-print-modal-print').addEventListener('click', () => {
        const ids = Array.from(document.querySelectorAll('#pp-opt-print-modal-list .pp-opt-print-checkbox:checked'))
            .map(cb => cb.dataset.castingId)
            .filter(Boolean);
        if (ids.length === 0) {
            showToast('Select at least one casting to print.', 'error');
            return;
        }
        // Preserve project sort order (currentCastings is already sorted on load).
        const sortedIds = currentCastings.map(c => c.id).filter(id => ids.includes(id));
        closeOptPrintModal();
        handlePrintOptimizer(sortedIds);
    });

    // Prevent enter-key submit; auto-save handles persistence.
    document.getElementById('pp-form').addEventListener('submit', (e) => {
        e.preventDefault();
        scheduleProjectInfoSave();
    });

    // Status select: update color on change
    document.getElementById('pp-f-status')?.addEventListener('change', applyStatusColor);

    // Sidebar tabs
    document.querySelectorAll('.pp-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            if (!tab) return;
            setActiveTab(tab);
            if (tab === 'castings' && currentProjectNumber) {
                loadAndRenderCastings();
            } else if (tab === 'optimizer') {
                activateOptimizerTab();
            } else if (tab === 'tracking') {
                activateTrackingTab();
            } else if (tab === 'casting-layout') {
                activateCastingLayoutTab();
            } else if (tab === 'color-log') {
                activateColorLogTab();
            } else if (tab === 'batch-tickets') {
                activateBatchTicketsTab();
            } else if (tab === 'job-memos') {
                activateJobMemosTab();
            }
        });
    });

    // ----- Casting Layout: control wiring -----
    document.getElementById('pp-clay-casting')?.addEventListener('change', async (e) => {
        clSelectedCastingId = e.target.value;
        await loadLayoutPositionsForSelected();
        renderCastingLayoutTab();
    });
    document.getElementById('pp-clay-area')?.addEventListener('change', (e) => {
        clSelectedArea = e.target.value;
        renderCastingLayoutTab();
    });
    document.getElementById('pp-clay-offset')?.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        clOffsetPerSide = (Number.isFinite(v) && v >= 0) ? v : 0;
        renderCastingLayoutTab();
    });
    document.getElementById('pp-clay-gap')?.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        clGapBetween = (Number.isFinite(v) && v >= 0) ? v : 0;
        renderCastingLayoutTab();
    });
    document.getElementById('pp-clay-print-btn')?.addEventListener('click', printCastingLayout);
    document.getElementById('pp-clay-reset-btn')?.addEventListener('click', resetCastingLayout);

    // ----- Color Log: event delegation on its panel -----
    const clPanel = document.querySelector('.pp-tab-panel[data-panel="color-log"]');
    if (clPanel) {
        clPanel.addEventListener('click', (e) => {
            const addBtn = e.target.closest('[data-cl-add]');
            if (addBtn) {
                clHandleAdd(addBtn.dataset.clAdd);
                scheduleColorLogSave();
                return;
            }

            const removeBtn = e.target.closest('[data-cl-remove]');
            if (removeBtn) {
                const tr = removeBtn.closest('tr');
                if (!tr) return;
                clHandleRemove(tr.dataset.clType, parseInt(tr.dataset.clIdx, 10));
                scheduleColorLogSave();
                return;
            }

            const stdEl = e.target.closest('[data-cl-std]');
            if (stdEl) {
                clSetStandard(stdEl.dataset.clStd === 'true');
                scheduleColorLogSave();
                return;
            }

            if (e.target.id === 'pp-cl-menu-btn' || e.target.closest('#pp-cl-menu-btn')) {
                toggleColorLogMenu();
                return;
            }

            if (e.target.id === 'pp-cl-save-preset-btn') {
                closeColorLogMenu();
                handleSaveAsPresetClick();
                return;
            }

            // Multi-color pill strip clicks
            const pillBtn = e.target.closest('.pp-cl-logs-pill');
            if (pillBtn) {
                const id = pillBtn.dataset.colorLogId;
                if (id) handleColorLogPillClick(id);
                return;
            }
            if (e.target.id === 'pp-cl-logs-add') {
                handleAddColorLog();
                return;
            }
            if (e.target.id === 'pp-cl-logs-delete') {
                handleDeleteColorLog(currentColorLogId);
                return;
            }
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('#pp-cl-menu')) closeColorLogMenu();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeColorLogMenu();
        });

        clPanel.addEventListener('input', (e) => {
            const target = e.target;
            if (!currentColorLog) return;
            let touched = false;

            // Top-level fields
            if (target.id === 'pp-cl-name')           { currentColorLog.name = target.value; touched = true; }
            else if (target.id === 'pp-cl-temp')      { currentColorLog.temperature = target.value; touched = true; }
            else if (target.id === 'pp-cl-date')      { currentColorLog.date = target.value; touched = true; }
            else if (target.id === 'pp-cl-madeby')    { currentColorLog.madeBy = target.value; touched = true; }
            else if (target.id === 'pp-cl-finishing-notes') { currentColorLog.finishingNotes = target.value; touched = true; }
            else if (target.id === 'pp-cl-sealing-notes')   { currentColorLog.sealingNotes = target.value; touched = true; }
            else {
                const tr = target.closest('tr[data-cl-type]');
                if (tr && target.matches('input[data-cl-field]')) {
                    clHandleRowInputChange(tr, target);
                    touched = true;
                }
            }
            if (touched) scheduleColorLogSave();
        });

        clPanel.addEventListener('change', (e) => {
            const target = e.target;

            if (target.id === 'pp-cl-multi-toggle') {
                handleMultiColorToggleChange(target);
                return;
            }

            if (!currentColorLog) return;

            if (target.id === 'pp-cl-preset-select') {
                if (target.value) loadPresetIntoForm(target.value);
                target.value = '';
                return;
            }

            if (target.name === 'pp-cl-cement') {
                currentColorLog.cementType = target.value;
                scheduleColorLogSave();
                return;
            }
            if (target.name === 'pp-cl-cast') {
                currentColorLog.castMethod = target.value;
                scheduleColorLogSave();
                return;
            }

            const tr = target.closest('tr[data-cl-type]');
            if (tr && target.tagName === 'SELECT') {
                clHandleRowUnitChange(tr, target);
                scheduleColorLogSave();
            }
        });
    }

    // ----- Job Memos: event delegation on its panel -----
    const jmPanel = document.querySelector('.pp-tab-panel[data-panel="job-memos"]');
    if (jmPanel) {
        jmPanel.addEventListener('click', (e) => {
            if (e.target.id === 'pp-jm-add' || e.target.closest('#pp-jm-add')) {
                handleAddJobMemo();
                return;
            }
            const delBtn = e.target.closest('[data-jm-delete]');
            if (delBtn) {
                const card = delBtn.closest('.pp-jm-card');
                if (card) handleDeleteJobMemo(card.dataset.memoId);
                return;
            }
        });

        jmPanel.addEventListener('input', (e) => {
            const fieldEl = e.target.closest('[data-jm-field]');
            if (!fieldEl) return;
            const card = fieldEl.closest('.pp-jm-card');
            if (!card) return;
            const memoId = card.dataset.memoId;
            const field = fieldEl.dataset.jmField;
            if (!memoId || !field) return;
            if (fieldEl.tagName === 'TEXTAREA') autoGrowTextarea(fieldEl);
            scheduleJobMemoSave(memoId, field, fieldEl.value);
        });

        // Date inputs fire 'change' but not always 'input' across browsers — cover both.
        // After a date edit, re-sort + re-render so the memo moves into the
        // right date-group header and sort position.
        jmPanel.addEventListener('change', (e) => {
            const fieldEl = e.target.closest('[data-jm-field]');
            if (!fieldEl || fieldEl.tagName !== 'INPUT' || fieldEl.type !== 'date') return;
            const card = fieldEl.closest('.pp-jm-card');
            if (!card) return;
            scheduleJobMemoSave(card.dataset.memoId, 'memoDate', fieldEl.value);
            sortJobMemosLocal();
            renderJobMemos();
        });
    }

    // Optimizer: pills + prev/next nav
    document.getElementById('pp-opt-pills').addEventListener('click', (e) => {
        const navBtn = e.target.closest('button[data-action]');
        if (navBtn) {
            if (navBtn.disabled) return;
            const action = navBtn.dataset.action;
            const list = getCastingsForActivePhase();
            const idx = list.findIndex(c => c.id === currentOptCastingId);
            if (idx === -1) return;
            const newIdx = action === 'prev' ? idx - 1 : idx + 1;
            if (newIdx < 0 || newIdx >= list.length) return;
            handleSelectOptCasting(list[newIdx].id);
            return;
        }
        const pillBtn = e.target.closest('button[data-casting-id]');
        if (!pillBtn) return;
        handleSelectOptCasting(pillBtn.dataset.castingId);
    });

    // Add Task buttons live inside each column now — handled via delegation in pp-opt-columns below.

    // Optimizer: column container (event delegation across all visible columns)
    const optColumns = document.getElementById('pp-opt-columns');

    optColumns.addEventListener('click', (e) => {
        // Copy hours
        const copyBtn = e.target.closest('button[data-action="copy-hours"]');
        if (copyBtn) {
            handleCopyHours(copyBtn.dataset.castingId);
            return;
        }
        // Paste hours
        const pasteBtn = e.target.closest('button[data-action="paste-hours"]');
        if (pasteBtn && !pasteBtn.disabled) {
            handlePasteHours(pasteBtn.dataset.castingId);
            return;
        }
        // Add Task button (one per column) — switch to that column if needed, then open draft
        const addBtn = e.target.closest('button[data-action="add-task"]');
        if (addBtn) {
            const castingId = addBtn.dataset.castingId;
            if (castingId && castingId !== currentOptCastingId) {
                currentOptCastingId = castingId;
                renderOptimizer();
            }
            handleAddPhaseClick();
            return;
        }
        // Column header click → make that casting the active center
        const headerBtn = e.target.closest('button[data-action="select-col"]');
        if (headerBtn) {
            handleSelectOptCasting(headerBtn.dataset.castingId);
            return;
        }
        // Description toggle (chevron) on a phase card
        const toggleBtn = e.target.closest('button[data-action="toggle-desc"]');
        if (toggleBtn) {
            const card = toggleBtn.closest('.pp-opt-card[data-phase-id]');
            if (card) handleToggleDescription(card.dataset.phaseId);
            return;
        }
        const btn = e.target.closest('button[data-action="delete-phase"]');
        if (!btn) return;
        const card = btn.closest('.pp-opt-card[data-phase-id]');
        if (!card) return;
        handleDeletePhase(card.dataset.castingId, card.dataset.phaseId);
    });
    optColumns.addEventListener('input', (e) => {
        const card = e.target.closest('.pp-opt-card[data-phase-id]');
        if (!card) return;
        const phaseId = card.dataset.phaseId;
        const castingId = card.dataset.castingId;
        if (e.target.matches('input[data-action="hours"]')) {
            scheduleOptimizerHoursSave(castingId, phaseId, e.target.value);
        } else if (e.target.matches('textarea[data-action="description"]')) {
            autoGrowTextarea(e.target);
            scheduleOptimizerDescriptionSave(castingId, phaseId, e.target.value);
        }
    });
    // Rename still commits on blur (full re-render would clobber active typing).
    optColumns.addEventListener('change', (e) => {
        const card = e.target.closest('.pp-opt-card[data-phase-id]');
        if (!card) return;
        if (e.target.matches('input[data-action="rename"]')) {
            handleRenamePhase(card.dataset.castingId, card.dataset.phaseId, e.target.value);
        }
    });
    optColumns.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const input = e.target;
        if (input.matches('input[data-action="rename"]')) {
            e.preventDefault();
            input.blur(); // triggers change → handleRenamePhase
            return;
        }
        if (input.matches('input[data-action="hours"]')) {
            e.preventDefault();
            const card = input.closest('.pp-opt-card[data-phase-id]');
            if (!card) { input.blur(); return; }
            // Flush any pending debounced save so the typed value commits before focus moves.
            const phaseId = card.dataset.phaseId;
            const castingId = card.dataset.castingId;
            const pending = optimizerPhaseSaveTimers.get(phaseId);
            if (pending) {
                clearTimeout(pending);
                optimizerPhaseSaveTimers.delete(phaseId);
                handleSetHours(castingId, phaseId, input.value);
            }
            // Move focus to the next (or previous, with Shift) card's hours input in this column.
            const cards = Array.from(card.parentElement.querySelectorAll('.pp-opt-card[data-phase-id]:not(.pp-opt-card-draft)'));
            const idx = cards.indexOf(card);
            const dir = e.shiftKey ? -1 : 1;
            const nextInput = cards[idx + dir]?.querySelector('input[data-action="hours"]');
            if (nextInput) {
                nextInput.focus();
                nextInput.select();
            } else {
                input.blur();
            }
        }
    });

    // Optimizer: "go to castings" link in empty state
    document.querySelector('[data-action="goto-castings"]')?.addEventListener('click', () => {
        setActiveTab('castings');
        if (currentProjectNumber) loadAndRenderCastings();
    });

    // Tracking: accordion list (delegation)
    const trackList = document.getElementById('pp-track-list');
    // Suppress browser text-selection on shift+click of a card (selection happens at mousedown,
    // not click, so we have to intercept it here).
    trackList?.addEventListener('mousedown', (e) => {
        if (!e.shiftKey) return;
        const card = e.target.closest('.pp-track-card[data-component-id]');
        if (!card) return;
        if (e.target.closest('select') || e.target.closest('input[type="text"]')) return;
        e.preventDefault();
    });
    trackList?.addEventListener('click', (e) => {
        // Produced checkbox — handled by its own change handler; let it through without
        // our card-click intercept that would otherwise hijack the toggle.
        if (e.target.closest('input[data-action="track-produced-toggle"]')) return;
        // Same for the Rejected checkbox — its change handler runs the confirm
        // and write-once write; the card-click intercept must not eat it.
        if (e.target.closest('input[data-action="track-rejected-toggle"]')) return;
        // Click anywhere on a panel card to toggle selection (skip the crate select).
        const card = e.target.closest('.pp-track-card[data-component-id]');
        if (card && !e.target.closest('select')) {
            const componentId = card.dataset.componentId;
            if (!componentId) return;
            // Suppress native checkbox toggle / text selection / dropdown bubbling — we drive everything from selectedComponentIds.
            e.preventDefault();
            // Clear any lingering text selection from prior interactions.
            const sel = window.getSelection?.();
            if (sel && sel.rangeCount > 0) sel.removeAllRanges();

            if (e.shiftKey && lastTrackSelectionAnchor && lastTrackSelectionAnchor !== componentId) {
                const cards = trackList.querySelectorAll('.pp-track-card[data-component-id]');
                const orderedIds = Array.from(cards).map(c => c.getAttribute('data-component-id'));
                const anchorIdx = orderedIds.indexOf(lastTrackSelectionAnchor);
                const targetIdx = orderedIds.indexOf(componentId);
                if (anchorIdx >= 0 && targetIdx >= 0) {
                    const [start, end] = anchorIdx <= targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx];
                    // Shift-click is purely additive — selects every row in the range.
                    for (let i = start; i <= end; i++) selectedComponentIds.add(orderedIds[i]);
                    lastTrackSelectionAnchor = componentId;
                    renderTracking();
                    return;
                }
            }

            // Plain click: toggle this row's selection and set it as the new anchor.
            if (selectedComponentIds.has(componentId)) selectedComponentIds.delete(componentId);
            else selectedComponentIds.add(componentId);
            lastTrackSelectionAnchor = componentId;
            renderTracking();
            return;
        }

        const headerBtn = e.target.closest('button[data-action="toggle-section"]');
        if (headerBtn) {
            const section = headerBtn.closest('.pp-track-section[data-casting-id]');
            if (section) handleToggleTrackSection(section.dataset.castingId);
            return;
        }
        const printBtn = e.target.closest('button[data-action="print-tracking"]');
        if (printBtn) {
            const id = printBtn.dataset.castingId;
            if (id) handlePrintTracking(id);
            return;
        }
        const stickerBtn = e.target.closest('button[data-action="print-stickers"]');
        if (stickerBtn) {
            const id = stickerBtn.dataset.castingId;
            if (id) handlePrintStickers(id);
        }
    });
    trackList?.addEventListener('change', (e) => {
        const sel = e.target.closest('select[data-action="track-crate-select"]');
        if (sel) {
            const id = sel.dataset.componentId;
            if (id) handleTrackingCrateSelect(id, sel.value);
            return;
        }
        const producedCb = e.target.closest('input[data-action="track-produced-toggle"]');
        if (producedCb) {
            const id = producedCb.dataset.componentId;
            if (id) handleProducedToggle(id, producedCb.checked);
            return;
        }
        const rejectCb = e.target.closest('input[data-action="track-rejected-toggle"]');
        if (rejectCb) {
            const id = rejectCb.dataset.componentId;
            if (id) handleRejectedToggle(id, rejectCb);
            return;
        }
        const rowCb = e.target.closest('input[data-action="track-row-select"]');
        if (rowCb) {
            const id = rowCb.dataset.componentId;
            if (id) toggleSelectComponent(id, rowCb.checked);
            return;
        }
        const allCb = e.target.closest('input[data-action="track-select-all-casting"]');
        if (allCb) {
            const castingId = allCb.dataset.castingId;
            if (castingId) toggleSelectAllInCasting(castingId, allCb.checked);
        }
    });

    // Tracking: bulk-action toolbar
    const bulkBar = document.getElementById('pp-track-bulk-bar');
    bulkBar?.addEventListener('change', (e) => {
        const sel = e.target.closest('#pp-track-bulk-select');
        if (sel && sel.value) {
            const value = sel.value;
            // Reset the dropdown back to placeholder so the user can re-apply.
            sel.value = '';
            applyBulkCrate(value);
        }
    });
    bulkBar?.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="track-bulk-clear"]')) {
            selectedComponentIds.clear();
            renderTracking();
            return;
        }
        if (e.target.closest('[data-action="track-bulk-complete"]')) {
            applyBulkProduced(true);
            return;
        }
        if (e.target.closest('[data-action="track-bulk-incomplete"]')) {
            applyBulkProduced(false);
        }
    });

    // "Go to castings" link in the Tracking / Casting Layout empty states.
    document.querySelectorAll('[data-action="goto-castings-from-tracking"]').forEach(btn => {
        btn.addEventListener('click', () => {
            setActiveTab('castings');
            if (currentProjectNumber) loadAndRenderCastings();
        });
    });

    // Global phase switcher in the title bar
    document.getElementById('pp-phase-switcher')?.addEventListener('change', (e) => {
        handlePhaseSwitch(e.target.value);
    });

    // Project Info: Phases enable button + add button + list interactions.
    document.getElementById('pp-phases-enable-btn')?.addEventListener('click', handleEnablePhases);
    document.getElementById('pp-phases-add-btn')?.addEventListener('click', handleAddProjectPhase);
    const phasesList = document.getElementById('pp-phases-list');
    phasesList?.addEventListener('click', (e) => {
        const delBtn = e.target.closest('button[data-action="phase-delete"]');
        if (delBtn) {
            const id = delBtn.dataset.phaseId;
            if (id) handleDeleteProjectPhase(id);
        }
    });
    phasesList?.addEventListener('input', (e) => {
        const input = e.target.closest('input[data-action="phase-rename"]');
        if (!input) return;
        const row = input.closest('.pp-phase-row[data-phase-id]');
        if (!row) return;
        scheduleProjectPhaseRename(row.dataset.phaseId, input.value);
        const phase = currentPhases.find(p => p.id === row.dataset.phaseId);
        if (phase) phase.phase_name = input.value;
    });

    // Shipping: per-crate event delegation (clicks)
    const shipList = document.getElementById('pp-ship-list');
    shipList?.addEventListener('click', async (e) => {
        const expandBtn = e.target.closest('button[data-action="ship-toggle-expand"]');
        if (expandBtn) {
            const card = expandBtn.closest('.pp-ship-crate[data-crate-id]');
            const id = card?.dataset.crateId;
            if (id) {
                if (currentShipExpanded.has(id)) currentShipExpanded.delete(id);
                else currentShipExpanded.add(id);
                renderShipping();
            }
            return;
        }
        const printBtn = e.target.closest('button[data-action="ship-print"]');
        if (printBtn) {
            const id = printBtn.dataset.crateId;
            if (id) handlePrintPackingList(id);
            return;
        }
        const delBtn = e.target.closest('button[data-action="ship-delete"]');
        if (delBtn) {
            const id = delBtn.dataset.crateId;
            if (id) handleDeleteCrate(id);
            return;
        }
        const unassignBtn = e.target.closest('button[data-action="ship-unassign"]');
        if (unassignBtn) {
            const componentId = unassignBtn.dataset.componentId;
            if (componentId) await assignComponentToCrate(componentId, null);
        }
    });

    // Shipping: global "list as quantities" checkbox — re-renders all crate
    // cards and persists the choice on the project record.
    document.getElementById('pp-ship-qty-mode')?.addEventListener('change', async (e) => {
        shipQtyModeGlobal = !!e.target.checked;
        renderShipping();
        if (currentProjectNumber) {
            try {
                await setProjectShipQtyMode(currentProjectNumber, shipQtyModeGlobal);
            } catch (err) {
                logger.error('[project-portal] setProjectShipQtyMode failed:', err);
                showToast('Could not save Shipping toggle — check connection.', 'error');
            }
        }
    });

    // Shipping: per-crate field edits (input)
    shipList?.addEventListener('input', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLInputElement)) return;
        const card = target.closest('.pp-ship-crate[data-crate-id]');
        if (!card) return;
        const crateId = card.dataset.crateId;
        const field = target.dataset.field;
        if (!crateId || !field) return;
        scheduleCrateSave(crateId, { [field]: target.value });
        // Reflect crate_number locally so the Tracking picker label updates immediately on next render.
        const crate = currentCrates.find(c => c.id === crateId);
        if (crate) crate[field] = target.value;
    });

    // Tracking: phase-picker chip toggles
    document.getElementById('pp-track-phases-chips')?.addEventListener('click', (e) => {
        const chip = e.target.closest('.pp-track-phase-chip');
        if (!chip) return;
        handleToggleTrackingPhase(chip.dataset.phase);
    });

    // Batch Tickets: pill bar (casting selector)
    const btPills = document.getElementById('pp-bt-pills');
    btPills?.addEventListener('click', (e) => {
        const pill = e.target.closest('[data-bt-pill]');
        if (!pill) return;
        handleSelectBatchCasting(pill.dataset.castingId);
    });

    // Batch Tickets: active-casting form (delegation)
    const btContent = document.getElementById('pp-bt-content');
    btContent?.addEventListener('input', (e) => {
        const target = e.target;
        if (!currentBatchCastingId) return;
        if (target.matches('[data-bt-field]')) {
            const val = target.type === 'checkbox' ? target.checked : target.value;
            handleBatchFieldInput(currentBatchCastingId, target.dataset.btField, val);
        }
    });
    btContent?.addEventListener('change', (e) => {
        const target = e.target;
        if (!currentBatchCastingId) return;

        if (target.matches('[data-bt-casting-date]')) {
            handleCastingDateChange(currentBatchCastingId, target.value);
            return;
        }
        if (target.matches('input[type="radio"][data-bt-assign]')) {
            const idx = parseInt(target.dataset.btAssign, 10);
            handleBatchAssignChange(currentBatchCastingId, idx, target.value);
            return;
        }
    });
    btContent?.addEventListener('click', (e) => {
        if (!currentBatchCastingId) return;
        if (e.target.closest('[data-bt-import]')) {
            handleImportBatchFromTracking(currentBatchCastingId);
        }
    });

    // Tab-level notes textareas (Castings + Optimizer) live outside #pp-form,
    // so they need their own auto-save listener. Fields are still in FORM_FIELDS,
    // so populate/read pick them up.
    document.querySelectorAll('.pp-tab-notes-textarea').forEach(el => {
        el.addEventListener('input', () => {
            autoGrowTextarea(el);
            scheduleProjectInfoSave();
        });
    });

    // Castings: add
    document.getElementById('pp-cast-add-btn').addEventListener('click', handleAddCastingClick);

    // Castings: add remake (button + modal)
    document.getElementById('pp-cast-add-remake-btn')?.addEventListener('click', handleAddRemakeCastingClick);
    document.getElementById('pp-remake-modal-close')?.addEventListener('click', closeRemakeModal);
    document.getElementById('pp-remake-modal-cancel')?.addEventListener('click', closeRemakeModal);
    document.getElementById('pp-remake-modal')?.addEventListener('click', (e) => {
        // Click on backdrop (the modal-backdrop itself, not its inner card) closes the modal.
        if (e.target.id === 'pp-remake-modal') closeRemakeModal();
    });
    document.getElementById('pp-remake-modal-list')?.addEventListener('change', (e) => {
        const cb = e.target.closest('input[data-action="remake-source"]');
        if (!cb) return;
        const castingId = cb.dataset.castingId;
        if (!castingId) return;
        if (cb.checked) remakeModalSelected.add(castingId);
        else remakeModalSelected.delete(castingId);
        // Just toggle the submit-button state; no full re-render needed.
        const submitBtn = document.getElementById('pp-remake-modal-submit');
        if (submitBtn) submitBtn.disabled = remakeModalSelected.size === 0;
    });
    document.getElementById('pp-remake-modal-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        handleCreateRemakeSubmit();
    });

    // Castings: row actions (delegation)
    const castingsList = document.getElementById('pp-castings-list');
    castingsList.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const card = btn.closest('.pp-cast-card[data-casting-id]');
        if (!card) return;
        const castingId = card.getAttribute('data-casting-id');
        const action = btn.dataset.action;
        if (action === 'delete') {
            handleDeleteCasting(castingId);
        } else if (action === 'toggle-inventory') {
            handleToggleCastInventory(castingId);
        } else if (action === 'add-inventory') {
            handleAddInventoryItem(castingId);
        } else if (action === 'copy-components') {
            if (!btn.disabled) handleCopyComponents(castingId);
        } else if (action === 'paste-components') {
            if (!btn.disabled) handlePasteComponents(castingId);
        } else if (action === 'delete-inventory') {
            const row = btn.closest('.pp-inv-row[data-inventory-id]');
            const itemId = row?.getAttribute('data-inventory-id');
            if (itemId) handleDeleteInventoryItem(castingId, itemId);
        }
    });
    castingsList.addEventListener('input', (e) => {
        if (!e.target.matches('input[data-field]')) return;
        const invRow = e.target.closest('.pp-inv-row[data-inventory-id]');
        if (invRow) {
            const itemId = invRow.getAttribute('data-inventory-id');
            const castingId = invRow.getAttribute('data-casting-id');
            scheduleInventorySave(itemId, castingId);
            return;
        }
        const card = e.target.closest('.pp-cast-card[data-casting-id]');
        if (!card) return;
        // Only trigger casting save for fields directly on the card header (not nested in body)
        if (!e.target.closest('.pp-cast-card-header')) return;
        scheduleCastingSave(card.getAttribute('data-casting-id'));
    });
    // Dropdowns (color log) fire 'change' instead of 'input'.
    castingsList.addEventListener('change', (e) => {
        if (!e.target.matches('select[data-field]')) return;
        const invRow = e.target.closest('.pp-inv-row[data-inventory-id]');
        if (!invRow) return;
        const itemId = invRow.getAttribute('data-inventory-id');
        const castingId = invRow.getAttribute('data-casting-id');
        // Save immediately for selects — no debounce needed.
        const t = inventorySaveTimers.get(itemId);
        if (t) clearTimeout(t);
        inventorySaveTimers.delete(itemId);
        saveInventoryItem(itemId, castingId);
    });
    // Flush inventory save immediately on blur so users see the count update without waiting.
    castingsList.addEventListener('focusout', (e) => {
        const invRow = e.target.closest('.pp-inv-row[data-inventory-id]');
        if (!invRow) return;
        if (!e.target.matches('input[data-field], select[data-field]')) return;
        const itemId = invRow.getAttribute('data-inventory-id');
        const castingId = invRow.getAttribute('data-casting-id');
        const t = inventorySaveTimers.get(itemId);
        if (t) clearTimeout(t);
        inventorySaveTimers.delete(itemId);
        saveInventoryItem(itemId, castingId);
    });

    // Browser back/forward
    window.addEventListener('popstate', () => {
        const num = getProjectFromUrl();
        if (num !== null) {
            showFormView(num);
        } else {
            showListView();
        }
    });
}

// ===================================================================
// Batch Tickets tab
// Per-casting accordion. Each casting has its own batch_tickets row
// holding the batch parameters + manual type overrides. The plan
// (list of 250/150/50 lb batches, scaled ingredient values) is
// derived on render from the project's color log + the casting's
// settings.
// ===================================================================

// Default pigment reduction applied to FINAL Backup batches.
// Per-casting value is editable via the batch ticket form (ticket.pigReduction).
const FINAL_BACKUP_PIG_REDUCTION_PCT = 50;

/**
 * Resolve a casting's FINAL Back Up pigment reduction percentage.
 * Falls back to the 50% default for blank/invalid values; clamps to 0–100.
 * @param {string|number} raw
 * @returns {number}
 */
function parsePigReduction(raw) {
    const n = parseFloat(raw);
    if (isNaN(n)) return FINAL_BACKUP_PIG_REDUCTION_PCT;
    return Math.min(100, Math.max(0, n));
}

function getBatchTicketFor(castingId) {
    if (!batchTickets.has(castingId)) {
        batchTickets.set(castingId, emptyBatchTicketForm(castingId));
    }
    return batchTickets.get(castingId);
}

async function activateBatchTicketsTab() {
    const needsSave    = document.getElementById('pp-bt-needs-save');
    const needsCL      = document.getElementById('pp-bt-needs-color-log');
    const noCastings   = document.getElementById('pp-bt-no-castings');
    const pills        = document.getElementById('pp-bt-pills');
    const content      = document.getElementById('pp-bt-content');

    if (!content) return;

    // Project not saved yet
    if (!currentProjectNumber) {
        if (needsSave) needsSave.hidden = false;
        if (needsCL) needsCL.hidden = true;
        if (noCastings) noCastings.hidden = true;
        if (pills) pills.innerHTML = '';
        content.innerHTML = '';
        return;
    }
    if (needsSave) needsSave.hidden = true;

    // Make sure color logs are loaded — we need ingredients to scale.
    // Don't set colorLogLoadedFor — leave that to activateColorLogTab so its
    // first activation still triggers renderColorLog + refreshPresetPicker.
    if (currentColorLogs.length === 0) {
        try {
            const list = await loadColorLogsForProject(currentProjectNumber);
            currentColorLogs = list;
            if (list.length > 0 && !currentColorLog?.id) {
                currentColorLogId = list[0].id;
                currentColorLog = list[0];
            }
        } catch (err) {
            logger.error('[batch-tickets] color-log load failed', err);
        }
    }

    // No color log yet → block until they create one.
    if (currentColorLogs.length === 0) {
        if (needsCL) needsCL.hidden = false;
        if (noCastings) noCastings.hidden = true;
        if (pills) pills.innerHTML = '';
        content.innerHTML = '';
        return;
    }
    if (needsCL) needsCL.hidden = true;

    // No castings (in the active phase, when phases on) → tell them to add one.
    const phaseScoped = getCastingsForActivePhase();
    if (!phaseScoped || phaseScoped.length === 0) {
        if (noCastings) noCastings.hidden = false;
        if (pills) pills.innerHTML = '';
        content.innerHTML = '';
        return;
    }
    if (noCastings) noCastings.hidden = true;

    // Bulk-load tickets for these castings if not yet loaded for this project.
    if (batchTicketsLoadedFor !== currentProjectNumber) {
        try {
            const ids = currentCastings.map(c => c.id);
            const map = await loadBatchTicketsForCastings(ids);
            batchTickets.clear();
            for (const c of currentCastings) {
                batchTickets.set(c.id, map.get(c.id) || emptyBatchTicketForm(c.id));
            }
            batchTicketsLoadedFor = currentProjectNumber;
        } catch (err) {
            logger.error('[batch-tickets] load failed', err);
            showToast('Failed to load batch tickets', 'error');
        }
    }

    // Default active casting: first in active phase if not chosen or fell out of scope.
    if (!currentBatchCastingId || !phaseScoped.some(c => c.id === currentBatchCastingId)) {
        currentBatchCastingId = phaseScoped[0]?.id || null;
    }

    renderBatchTickets();
}

function renderBatchTickets() {
    renderBatchTicketsPills();
    renderBatchTicketsContent();
}

function renderBatchTicketsPills() {
    const pills = document.getElementById('pp-bt-pills');
    if (!pills) return;
    const list = getCastingsForActivePhase();
    if (!list.length) { pills.innerHTML = ''; return; }
    pills.innerHTML = list.map(c => {
        const active = c.id === currentBatchCastingId ? ' pp-bt-pill-active' : '';
        const date = c.casting_date ? `<span class="pp-bt-pill-date">${escapeHtml(c.casting_date)}</span>` : '';
        return `<button type="button" class="pp-bt-pill${active}" data-bt-pill data-casting-id="${escapeAttr(c.id)}">${escapeHtml(c.casting_number || '')}${date}</button>`;
    }).join('');
}

function renderBatchTicketsContent() {
    const content = document.getElementById('pp-bt-content');
    if (!content) return;
    const casting = currentCastings.find(c => c.id === currentBatchCastingId);
    if (!casting) { content.innerHTML = ''; return; }
    const ticket = getBatchTicketFor(casting.id);
    content.innerHTML = `<div data-casting-id="${escapeAttr(casting.id)}">${renderBatchTicketBody(casting, ticket)}</div>`;
}

function renderBatchTicketBody(casting, ticket) {
    const activeLog = getActiveBatchColorLog(casting, ticket);
    const colorLogPicker = currentMultiColorEnabled && currentColorLogs.length > 0
        ? `<div class="pp-bt-context-colorlog-group">
                <label class="pp-bt-context-date-label" for="pp-bt-color-${escapeAttr(casting.id)}">Color Log</label>
                <select id="pp-bt-color-${escapeAttr(casting.id)}" class="pp-bt-context-colorlog" data-bt-field="colorLogId">
                    ${currentColorLogs.map(l =>
                        `<option value="${escapeAttr(l.id)}"${l.id === activeLog?.id ? ' selected' : ''}>${escapeHtml(l.name || '(unnamed)')}</option>`
                    ).join('')}
                </select>
            </div>`
        : '';
    return `
        <div class="pp-bt-form">
            <div class="pp-bt-context">
                <div class="pp-bt-context-cast">
                    <span class="pp-bt-context-cast-label">Casting</span>${escapeHtml(casting.casting_number || '')}
                </div>
                <span class="pp-bt-save-status" data-bt-status></span>
                ${colorLogPicker}
                <div class="pp-bt-context-date-group">
                    <label class="pp-bt-context-date-label" for="pp-bt-castdate-${escapeAttr(casting.id)}">Cast Date</label>
                    <input type="date" id="pp-bt-castdate-${escapeAttr(casting.id)}" class="pp-bt-context-date" data-bt-casting-date value="${escapeAttr(casting.casting_date || '')}">
                </div>
            </div>

            <div class="pp-bt-card">
                <div class="pp-bt-card-head">
                    <h3 class="pp-bt-card-title">Batch Plan</h3>
                    <button type="button" class="pp-bt-import-btn" data-bt-import title="Total Cu Ft & FF Sq Ft from this casting's inventory">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>
                        </svg>
                        Import from Tracking
                    </button>
                </div>
                <div class="pp-bt-grid">
                    <div class="pp-bt-field">
                        <label class="pp-bt-field-label">Total Cu Ft Needed</label>
                        <input type="number" step="0.01" class="pp-bt-input" data-bt-field="cuFt" value="${escapeAttr(ticket.cuFt)}">
                    </div>
                    <div class="pp-bt-field">
                        <label class="pp-bt-field-label">Face Sq Ft</label>
                        <input type="number" step="0.01" class="pp-bt-input" data-bt-field="faceSqFt" value="${escapeAttr(ticket.faceSqFt)}">
                    </div>
                </div>
                <div class="pp-bt-field pp-bt-pigreduce">
                    <label class="pp-bt-field-label">Back Up Pigment Reduction (%)</label>
                    <div class="pp-bt-pigreduce-row">
                        <input type="number" step="1" min="0" max="100" class="pp-bt-input pp-bt-pigreduce-input" data-bt-field="pigReduction" value="${escapeAttr(ticket.pigReduction)}" placeholder="50">
                        <label class="pp-bt-checkbox">
                            <input type="checkbox" data-bt-field="pigReduceFirstBackup"${ticket.pigReduceFirstBackup ? ' checked' : ''}>
                            Also reduce First Back Up
                        </label>
                    </div>
                    <span class="pp-bt-field-hint">Always applied to FINAL Back Up. Check the box to also reduce First Back Up.</span>
                </div>
                <details class="pp-bt-advanced"${parseFloat(ticket.cuFtPer250) !== 4.28 ? ' open' : ''}>
                    <summary>Advanced</summary>
                    <div class="pp-bt-advanced-body">
                        <div class="pp-bt-field">
                            <label class="pp-bt-field-label">Cu Ft per 250lb Batch</label>
                            <input type="number" step="0.01" class="pp-bt-input" data-bt-field="cuFtPer250" value="${escapeAttr(ticket.cuFtPer250)}">
                        </div>
                    </div>
                </details>
            </div>

            <div class="pp-bt-card">
                <h3 class="pp-bt-card-title">Ticket Info</h3>
                <div class="pp-bt-field">
                    <label class="pp-bt-field-label">Batched By</label>
                    <input type="text" class="pp-bt-input" data-bt-field="batchedBy" value="${escapeAttr(ticket.batchedBy)}">
                </div>
                <div class="pp-bt-field">
                    <label class="pp-bt-field-label">Notes</label>
                    <textarea class="pp-bt-textarea" data-bt-field="notes" rows="2">${escapeHtml(ticket.notes)}</textarea>
                </div>
            </div>

            <div data-bt-preview>${renderBatchPreview(casting, ticket)}</div>
        </div>
    `;
}

/**
 * Render the live preview: summary, assignment table, and ticket cards.
 * Recomputed every render from current ticket state + color log.
 */
function renderBatchPreview(casting, ticket) {
    const totalCuFt = parseFloat(ticket.cuFt);
    if (!totalCuFt || totalCuFt <= 0) return '';

    const activeLog = getActiveBatchColorLog(casting, ticket);
    const sandLbs = getColorLogSandLbs(activeLog);
    if (!sandLbs) {
        return `<div class="pp-bt-no-color-log">No sand weight in this project's color log base ingredients. Add a sand entry to the color log to enable scaling.</div>`;
    }

    const plan = buildBatchPlan({
        totalCuFt,
        faceSqFt: parseFloat(ticket.faceSqFt) || 0,
        cuFtPer250: parseFloat(ticket.cuFtPer250) || 4.28,
        castMethod: activeLog?.castMethod || 'sprayUp',
        colorLogSandLbs: sandLbs,
        manualOverrides: ticket.batchAssignments
    });

    if (!plan.batches.length) return '';

    const pigReductionPct = parsePigReduction(ticket.pigReduction);
    const reduceFirstBackup = !!ticket.pigReduceFirstBackup;
    const sectionHeader = renderBatchSectionHeader(plan);
    const assign = renderBatchAssignTable(plan);
    const totalsPanel = renderBatchTotals(plan, activeLog, pigReductionPct, reduceFirstBackup);
    const tickets = renderBatchTicketCards(casting, ticket, plan);

    return `
        ${sectionHeader}
        ${assign}
        ${totalsPanel}
        <div class="pp-bt-tickets">${tickets}</div>
        <div class="pp-bt-print-hint">Use <strong>Print Batch Tickets</strong> in the top bar to print these.</div>
    `;
}

function renderBatchSectionHeader(plan) {
    const { summary } = plan;
    const parts = [];
    if (summary.count250) parts.push(`${summary.count250} × 250 lb`);
    if (summary.count150) parts.push(`${summary.count150} × 150 lb`);
    if (summary.count50)  parts.push(`${summary.count50} × 50 lb`);
    return `
        <div class="pp-bt-section-header">
            <span class="pp-bt-section-header-title">Generated Batches</span>
            <span class="pp-bt-section-header-summary">
                <strong>${summary.total}</strong> batches · <strong>${roundSig(summary.actualCuFt, 2)}</strong> cu ft total${parts.length ? ' · ' + parts.join(' · ') : ''}
            </span>
        </div>
    `;
}

function renderBatchAssignTable(plan) {
    const rows = plan.batches.map((b, idx) => `
        <tr>
            <td>Batch ${b.num}</td>
            <td>${b.batchSandLbs} lbs</td>
            <td>${roundSig(b.cuFt, 2)} cu ft</td>
            <td><input type="radio" name="bt_type_${idx}" data-bt-assign="${idx}" value="face"        ${b.type === 'face' ? 'checked' : ''}></td>
            <td><input type="radio" name="bt_type_${idx}" data-bt-assign="${idx}" value="firstBackUp" ${b.type === 'firstBackUp' ? 'checked' : ''}></td>
            <td><input type="radio" name="bt_type_${idx}" data-bt-assign="${idx}" value="finalBackUp" ${b.type === 'finalBackUp' ? 'checked' : ''}></td>
        </tr>
    `).join('');
    return `
        <div class="pp-bt-assign">
            <div class="pp-bt-assign-title">Assign Batch Types <span class="pp-bt-assign-hint">auto-calculated from Face Sq Ft — override manually if needed</span></div>
            <table class="pp-bt-assign-table">
                <thead>
                    <tr>
                        <th>Batch</th>
                        <th>Size</th>
                        <th>Volume</th>
                        <th>Face Mix</th>
                        <th>First Back Up</th>
                        <th>FINAL Back Up</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

/**
 * Mix Day Totals — sums every ingredient across all batches in the plan,
 * applying the same per-batch overrides used on the tickets:
 *   - Sand split into "Sand - Bulk (Cowbay)" for Spray Up backup batches
 *   - Fibers replaced by Cemfill for Spray Up backup batches and ALL Direct Cast batches
 *   - Pigments multiplied by (1 - reduction%) on FINAL Back Up batches
 * Matches the totals table from Batchin Calc/index.html.
 */
function renderBatchTotals(plan, log, pigReductionPct = FINAL_BACKUP_PIG_REDUCTION_PCT, reduceFirstBackup = false) {
    if (!plan?.batches?.length) return '';
    const isDirectCast = log?.castMethod === 'directCast';

    const totals = {};
    const orderKeys = [];
    const addTotal = (key, name, qty, unit, category) => {
        if (qty === '-' || qty === '' || qty == null || isNaN(qty)) return;
        const k = key + '__' + unit;
        if (!totals[k]) {
            totals[k] = { name, total: 0, unit, category };
            orderKeys.push(k);
        }
        totals[k].total += parseFloat(qty);
    };

    // Pre-seed base ingredient ordering, inserting bulk sand right after sand.
    const hasBulkSand = !isDirectCast && plan.batches.some(b => b.type === 'firstBackUp' || b.type === 'finalBackUp');
    for (const ing of (log?.baseIngredients || [])) {
        if (!ing?.name) continue;
        const unit = ing.unit || 'lbs';
        const k = ing.name + '__' + unit;
        if (!totals[k]) {
            totals[k] = { name: ing.name + (ing.note ? ' (' + ing.note + ')' : ''), total: 0, unit, category: 'dry' };
            orderKeys.push(k);
        }
        if ((ing.name || '').trim().toLowerCase() === 'sand' && hasBulkSand) {
            const bk = 'Sand_bulk__' + unit;
            if (!totals[bk]) {
                totals[bk] = { name: 'Sand - Bulk (Cowbay)', total: 0, unit, category: 'dry' };
                orderKeys.push(bk);
            }
        }
    }

    plan.batches.forEach(b => {
        const { batchSandLbs, scaleFactor, type: batchType } = b;
        const applyPigReduction = batchType === 'finalBackUp' || (batchType === 'firstBackUp' && reduceFirstBackup);
        const pigMultiplier = applyPigReduction ? (1 - pigReductionPct / 100) : 1;
        const isBackup = batchType === 'firstBackUp' || batchType === 'finalBackUp';

        // Base ingredients — split sand into Bulk Sand for sprayUp backup batches.
        for (const ing of (log?.baseIngredients || [])) {
            if (!ing?.weight || !ing?.name) continue;
            const w = Number(ing.weight) * scaleFactor;
            if ((ing.name || '').trim().toLowerCase() === 'sand' && !isDirectCast && isBackup) {
                addTotal('Sand_bulk', 'Sand - Bulk (Cowbay)', roundSig(w, 4), ing.unit || 'lbs', 'dry');
            } else {
                addTotal(ing.name, ing.name + (ing.note ? ' (' + ing.note + ')' : ''), roundSig(w, 4), ing.unit || 'lbs', 'dry');
            }
        }

        // Fibers override:
        //   - Spray Up backup batches → Cemfill 18 lbs/250 lbs sand
        //   - Direct Cast (all batches) → Cemfill 18 lbs/250 lbs sand
        const cemfillOverride = isBackup || (isDirectCast && batchType === 'face');
        if (cemfillOverride) {
            const fibersLbs = 18 * (batchSandLbs / 250);
            addTotal('Fibers_override', 'Fibers - Cemfill', roundSig(fibersLbs, 4), 'lbs', 'dry');
        } else {
            const fib = (log?.additives || []).find(a => /fiber|fibre/i.test(a?.name || ''));
            const fibAmt = fib?.weight ?? fib?.amount;
            if (fib && fibAmt !== '' && fibAmt != null && !isNaN(Number(fibAmt))) {
                addTotal('Fibers', 'Fibers' + (fib.note ? ' (' + fib.note + ')' : ''), roundSig(Number(fibAmt) * scaleFactor, 4), fib.unit || 'g', 'additive');
            }
        }

        // Pigments
        (log?.pigments || []).forEach(pig => {
            if (!pig || pig.pct === '' || pig.pct == null) return;
            const effectivePct = Number(pig.pct) * pigMultiplier;
            const weightLbs = batchSandLbs * effectivePct / 100;
            const unit = pig.unit || 'lbs';
            const converted = weightLbs * (FROM_LBS[unit] || 1);
            const label = (pig.name || '') + ' (' + roundSig(effectivePct, 2) + '%)';
            addTotal('pig_' + (pig.name || '_'), label, roundSig(converted, 4), unit, 'pigment');
        });

        // Additives (skip fibers — handled above)
        for (const add of (log?.additives || [])) {
            if (!add?.name) continue;
            if (/fiber|fibre/i.test(add.name)) continue;
            const amt = add.weight ?? add.amount;
            if (amt === '' || amt == null || isNaN(Number(amt))) continue;
            const a = Number(amt) * scaleFactor;
            addTotal(add.name, add.name + (add.note ? ' (' + add.note + ')' : ''), roundSig(a, 4), add.unit || 'oz', 'additive');
        }
    });

    const categories = [
        { key: 'dry', label: 'Dry Batch' },
        { key: 'pigment', label: 'Pigments' },
        { key: 'additive', label: 'Additives' },
    ];

    let rows = '';
    for (const cat of categories) {
        const items = orderKeys.map(k => totals[k]).filter(t => t && t.category === cat.key && t.total > 0);
        if (items.length === 0) continue;
        rows += `<tr class="pp-bt-totals-cat-row"><td colspan="3">${escapeHtml(cat.label)}</td></tr>`;
        for (const item of items) {
            rows += `<tr><td>${escapeHtml(item.name)}</td><td class="pp-bt-totals-num">${roundSig(item.total, 2)}</td><td>${escapeHtml(item.unit)}</td></tr>`;
        }
    }

    if (!rows) return '';

    return `
        <div class="pp-bt-totals-panel">
            <div class="pp-bt-totals-title">Mix Day Totals — All Batches</div>
            <table class="pp-bt-totals-table">
                <thead><tr><th>Material</th><th class="pp-bt-totals-num">Total Qty</th><th>Unit</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

function renderBatchTicketCards(casting, ticket, plan) {
    const activeLog = getActiveBatchColorLog(casting, ticket);
    const projectName = document.getElementById('pp-f-project_name')?.value || '';
    const sampleName = activeLog?.name || '';
    const castMethod = activeLog?.castMethod || '';
    const castNumber = casting.casting_number || '';
    const castDate = casting.casting_date || '';

    const pigReductionPct = parsePigReduction(ticket.pigReduction);
    const reduceFirstBackup = !!ticket.pigReduceFirstBackup;

    return plan.batches.map(b =>
        renderBatchTicketCard({
            colorLog: activeLog,
            batch: b,
            project: projectName,
            sampleName,
            castMethod,
            castNumber,
            castDate,
            batchedBy: ticket.batchedBy,
            notes: ticket.notes,
            pigReductionPct,
            reduceFirstBackup
        })
    ).join('');
}

/**
 * Build a single batch ticket card HTML. Pure (DOM-free).
 * Mirrors Batchin Calc's renderBatchTicket().
 */
function renderBatchTicketCard({
    colorLog, batch, project, sampleName, castMethod, castNumber, castDate,
    batchedBy, notes, pigReductionPct = FINAL_BACKUP_PIG_REDUCTION_PCT, reduceFirstBackup = false
}) {
    const { batchSandLbs, scaleFactor, num, total, type: batchType } = batch;
    const applyPigReduction = batchType === 'finalBackUp' || (batchType === 'firstBackUp' && reduceFirstBackup);
    const pigMultiplier = applyPigReduction ? (1 - pigReductionPct / 100) : 1;
    const cb = (checked) => `<span class="bt-cb-box ${checked ? 'checked' : ''}"></span>`;

    const findBase = (name) => (colorLog?.baseIngredients || []).find(i => (i.name || '').toLowerCase() === name.toLowerCase());
    const findAdd  = (name) => (colorLog?.additives        || []).find(i => (i.name || '').toLowerCase() === name.toLowerCase());

    const scaleBase = (name) => {
        const f = findBase(name);
        if (!f || !f.weight) return { qty: '-', unit: f?.unit || 'lbs', type: f?.note || '' };
        return { qty: roundSig(Number(f.weight) * scaleFactor, 2), unit: f.unit || 'lbs', type: f.note || '' };
    };
    const scaleAdd = (name) => {
        const f = findAdd(name);
        // Additives are stored as `weight` in the color log UI; legacy rows may use `amount`.
        const amt = f?.weight ?? f?.amount;
        if (!f || amt === '' || amt == null || isNaN(Number(amt))) {
            return { qty: '-', unit: f?.unit || 'oz', type: f?.note || '' };
        }
        return { qty: roundSig(Number(amt) * scaleFactor, 2), unit: f.unit || 'oz', type: f.note || '' };
    };

    const portland = scaleBase('Portland');
    const sand     = scaleBase('Sand');
    const pozzo    = scaleBase('Pozzotive');

    let aggRows = '';
    const aggs = (colorLog?.aggregates || []).filter(a => a && a.name);
    if (aggs.length) {
        aggRows = aggs.map(agg => {
            const qty = agg.amount ? roundSig(Number(agg.amount) * scaleFactor, 2) : '-';
            const unit = agg.unit || 'lbs';
            return `<tr><td class="bt-label">Aggregate:</td><td class="bt-type">TYPE: ${escapeHtml(agg.name)}</td><td class="bt-qty-label">QTY:</td><td class="bt-qty">${qty}</td><td class="bt-unit">${escapeHtml(unit)}</td></tr>`;
        }).join('');
    } else {
        aggRows = `<tr><td class="bt-label">Aggregate:</td><td class="bt-type">TYPE:</td><td class="bt-qty-label">QTY:</td><td class="bt-qty">-</td><td class="bt-unit">lbs</td></tr>`;
    }

    // Tolerant lookup so "Fiber" / "Fibers" / "fibre" all match.
    const fiberSrc = (colorLog?.additives || []).find(i => /fiber|fibre/i.test(i?.name || ''));
    const fiberAmt = fiberSrc?.weight ?? fiberSrc?.amount;
    let fibers;
    if (fiberSrc && fiberAmt !== '' && fiberAmt != null && !isNaN(Number(fiberAmt))) {
        fibers = { qty: roundSig(Number(fiberAmt) * scaleFactor, 2), unit: fiberSrc.unit || 'oz', type: fiberSrc.note || '' };
    } else {
        fibers = { qty: '-', unit: fiberSrc?.unit || 'oz', type: fiberSrc?.note || '' };
    }
    // Cemfill override:
    //   - Spray Up: First Back Up & FINAL Back Up
    //   - Direct Cast: ALL batches (Face Mix + FINAL Back Up)
    const overrideToCemfill = (batchType === 'firstBackUp' || batchType === 'finalBackUp')
        || (castMethod === 'directCast' && batchType === 'face');
    if (overrideToCemfill) {
        fibers = { qty: roundSig(18 * (batchSandLbs / 250), 2), unit: 'lbs', type: 'Cemfill' };
    }

    const waterBase = scaleBase('Water');
    const waterAdd = scaleAdd('Water');
    const water = waterBase.qty !== '-' ? waterBase : waterAdd;
    const adva = scaleAdd('ADVA');
    const eclipse = scaleAdd('Eclipse');
    const fortonBase = scaleBase('Forton');
    const fortonAdd = scaleAdd('Forton');
    const forton = fortonBase.qty !== '-' ? fortonBase : fortonAdd;

    // Pigments (4 slots)
    const reducedLabel = (applyPigReduction && pigReductionPct > 0) ? ` (${pigReductionPct}% reduced)` : '';
    let pigRows = '';
    for (let i = 0; i < 4; i++) {
        const p = (colorLog?.pigments || [])[i];
        if (p && p.pct !== '' && p.pct != null && p.pct !== undefined) {
            const effectivePct = Number(p.pct) * pigMultiplier;
            const weightLbs = batchSandLbs * effectivePct / 100;
            const unit = p.unit || 'lbs';
            const converted = roundSig(weightLbs * (FROM_LBS[unit] || 1), 2);
            const pctDisplay = pigMultiplier < 1 ? `${roundSig(effectivePct, 4)}%` : `${p.pct}%`;
            pigRows += `<tr><td class="bt-label">Pigment #${i+1}:</td><td class="bt-type">COLOR: ${escapeHtml(p.name || '')} ${pctDisplay}${reducedLabel}</td><td class="bt-qty-label">QTY:</td><td class="bt-qty">${converted}</td><td class="bt-unit">${escapeHtml(unit)}</td></tr>`;
        } else {
            pigRows += `<tr><td class="bt-label">Pigment #${i+1}:</td><td class="bt-type">COLOR:</td><td class="bt-qty-label">QTY:</td><td class="bt-qty"></td><td class="bt-unit"></td></tr>`;
        }
    }

    const bannerLabel = batchType === 'face' ? 'Face Mix'
        : batchType === 'firstBackUp' ? 'First Back Up'
        : batchType === 'finalBackUp' ? 'FINAL Back Up'
        : '';

    const isDirectCast = castMethod === 'directCast';
    const sandTypeDisplay = (!isDirectCast && (batchType === 'firstBackUp' || batchType === 'finalBackUp'))
        ? 'Bulk Sand (Cowbay)'
        : escapeHtml(sand.type || '');

    return `
    <div class="batch-ticket bt-${batchType}">
        <div class="bt-title">BATCHING TICKET</div>
        <div class="bt-type-banner">${bannerLabel}</div>

        <div class="bt-header-grid">
            <div class="bt-hrow"><span class="bt-hlabel">PROJECT:</span><span class="bt-hval">${escapeHtml(project || '')}</span></div>
            <div class="bt-hrow"><span class="bt-hlabel">Batched by:</span><span class="bt-hval">${escapeHtml(batchedBy || '')}</span></div>
            <div class="bt-hrow"><span class="bt-hlabel">Sample #:</span><span class="bt-hval">${escapeHtml(sampleName || '')}</span></div>
            <div class="bt-hrow"><span class="bt-hlabel">Cast #:</span><span class="bt-hval">${escapeHtml(castNumber || '')}</span></div>
            <div class="bt-hrow"><span class="bt-hlabel">Cast Date:</span><span class="bt-hval">${escapeHtml(castDate || '')}</span></div>
            <div class="bt-hrow"><span class="bt-hlabel">Batch:</span><span class="bt-hval">${num} of ${total}</span></div>
        </div>

        <div class="bt-mix-box">
            <div class="bt-mix-label">MIX DESIGN</div>
            <div class="bt-cb-row">
                <span class="bt-cb">${cb(castMethod === 'sprayUp')} GFRC Spray</span>
                <span class="bt-cb">${cb(castMethod === 'directCast')} GFRC Direct</span>
                <span class="bt-cb">${cb(false)} Regular Concrete</span>
                <span class="bt-cb">${cb(castMethod === 'other')} Other</span>
            </div>
        </div>
        <div class="bt-cb-row">
            <span class="bt-cb"><strong>Face Mix:</strong> ${cb(batchType === 'face')}</span>
            <span class="bt-cb"><strong>First Back Up:</strong> ${cb(batchType === 'firstBackUp')}</span>
            <span class="bt-cb"><strong>FINAL Back Up:</strong> ${cb(batchType === 'finalBackUp')}</span>
        </div>

        <div class="bt-section-label">DRY BATCH</div>
        <table class="bt-table">
            <tr><td class="bt-label">Portland:</td><td class="bt-type">TYPE: ${escapeHtml(portland.type || 'Portland')}</td><td class="bt-qty-label">QTY:</td><td class="bt-qty">${portland.qty}</td><td class="bt-unit">${escapeHtml(portland.unit)}</td></tr>
            <tr><td class="bt-label">Sand:</td><td class="bt-type">TYPE: ${sandTypeDisplay}</td><td class="bt-qty-label">QTY:</td><td class="bt-qty">${sand.qty}</td><td class="bt-unit">${escapeHtml(sand.unit)}</td></tr>
            <tr><td class="bt-label">Portland Reducer:</td><td class="bt-type">TYPE: ${escapeHtml(pozzo.type || 'Pozzotive')}</td><td class="bt-qty-label">QTY:</td><td class="bt-qty">${pozzo.qty}</td><td class="bt-unit">${escapeHtml(pozzo.unit)}</td></tr>
            ${aggRows}
            <tr><td class="bt-label">Fibers:</td><td class="bt-type">TYPE: ${escapeHtml(fibers.type || '')}</td><td class="bt-qty-label">QTY:</td><td class="bt-qty">${fibers.qty}</td><td class="bt-unit">${escapeHtml(fibers.unit)}</td></tr>
        </table>

        <div class="bt-section-label">PIGMENTS</div>
        <table class="bt-table">${pigRows}</table>

        <div class="bt-section-label">ADDITIVES</div>
        <table class="bt-table">
            <tr><td class="bt-label">Additive #1:</td><td class="bt-type">TYPE: Water</td><td class="bt-qty-label">QTY:</td><td class="bt-qty">${water.qty}</td><td class="bt-unit">${escapeHtml(water.unit)}</td></tr>
            <tr><td class="bt-label">Additive #2:</td><td class="bt-type">TYPE: ${escapeHtml(adva.type || 'ADVA Flex')}</td><td class="bt-qty-label">QTY:</td><td class="bt-qty">${adva.qty}</td><td class="bt-unit">${escapeHtml(adva.unit)}</td></tr>
            <tr><td class="bt-label">Additive #3:</td><td class="bt-type">TYPE: ${escapeHtml(eclipse.type || 'Eclipse')}</td><td class="bt-qty-label">QTY:</td><td class="bt-qty">${eclipse.qty}</td><td class="bt-unit">${escapeHtml(eclipse.unit)}</td></tr>
            <tr><td class="bt-label">Additive #4:</td><td class="bt-type">TYPE: Forton</td><td class="bt-qty-label">QTY:</td><td class="bt-qty">${forton.qty}</td><td class="bt-unit">${escapeHtml(forton.unit)}</td></tr>
        </table>

        <div class="bt-notes-title">NOTES:</div>
        <div class="bt-notes">${batchSandLbs} lbs Mix\nBatch ${num} of ${total}${notes ? '\n' + escapeHtml(notes) : ''}</div>
    </div>`;
}

// ---------- Save / state ----------

function setBatchTicketStatus(castingId, state) {
    if (castingId !== currentBatchCastingId) return; // only the visible casting has a status indicator
    const el = document.querySelector('#pp-bt-content [data-bt-status]');
    if (!el) return;
    el.classList.remove('is-saving', 'is-saved', 'is-error');
    if (state === 'saving') { el.classList.add('is-saving'); el.textContent = 'Saving…'; }
    else if (state === 'saved') { el.classList.add('is-saved'); el.textContent = 'Saved'; }
    else if (state === 'error') { el.classList.add('is-error'); el.textContent = 'Save failed'; }
    else el.textContent = '';
}

function scheduleBatchTicketSave(castingId) {
    if (!currentProjectNumber) return;
    const existing = batchTicketSaveTimers.get(castingId);
    if (existing) clearTimeout(existing);
    setBatchTicketStatus(castingId, 'saving');
    const t = setTimeout(() => saveBatchTicketNow(castingId), 700);
    batchTicketSaveTimers.set(castingId, t);
}

async function saveBatchTicketNow(castingId) {
    const ticket = batchTickets.get(castingId);
    if (!ticket) return;
    batchTicketSaveTimers.delete(castingId);
    try {
        const saved = await saveBatchTicketForCasting(castingId, ticket);
        if (saved) ticket.id = saved.id;
        setBatchTicketStatus(castingId, 'saved');
        setTimeout(() => setBatchTicketStatus(castingId, ''), 1500);
    } catch (err) {
        logger.error('[batch-tickets] save failed', err);
        setBatchTicketStatus(castingId, 'error');
    }
}

async function flushAllBatchTicketSaves() {
    const pending = Array.from(batchTicketSaveTimers.entries());
    if (!pending.length) return;
    for (const [, t] of pending) clearTimeout(t);
    batchTicketSaveTimers.clear();
    await Promise.all(pending.map(([id]) => saveBatchTicketNow(id).catch(() => {})));
}

async function handleSelectBatchCasting(castingId) {
    if (castingId === currentBatchCastingId) return;
    // Flush any pending save on the casting we're leaving so its DB state matches the form.
    const prev = currentBatchCastingId;
    if (prev && batchTicketSaveTimers.has(prev)) {
        clearTimeout(batchTicketSaveTimers.get(prev));
        batchTicketSaveTimers.delete(prev);
        try { await saveBatchTicketNow(prev); } catch (e) { /* logged */ }
    }
    currentBatchCastingId = castingId;
    renderBatchTickets();
}

function handleBatchFieldInput(castingId, field, value) {
    const ticket = getBatchTicketFor(castingId);
    if (!(field in ticket)) return;
    ticket[field] = value;
    // Inputs that affect the visible preview: re-render it so summary/tickets stay in sync.
    const previewAffectingFields = ['cuFt', 'faceSqFt', 'cuFtPer250', 'pigReduction', 'pigReduceFirstBackup', 'batchedBy', 'notes', 'colorLogId'];
    if (previewAffectingFields.includes(field)) {
        // If the batch count would change, drop manual overrides so they don't desync.
        const casting = currentCastings.find(c => c.id === castingId);
        const activeLog = getActiveBatchColorLog(casting, ticket);
        const sandLbs = getColorLogSandLbs(activeLog);
        if (sandLbs && Array.isArray(ticket.batchAssignments) && ticket.batchAssignments.length) {
            const newPlan = buildBatchPlan({
                totalCuFt: parseFloat(ticket.cuFt) || 0,
                faceSqFt: parseFloat(ticket.faceSqFt) || 0,
                cuFtPer250: parseFloat(ticket.cuFtPer250) || 4.28,
                castMethod: activeLog?.castMethod || 'sprayUp',
                colorLogSandLbs: sandLbs,
                manualOverrides: null
            });
            if (newPlan.batches.length !== ticket.batchAssignments.length) {
                ticket.batchAssignments = [];
            }
        }
        rerenderBatchPreview(castingId);
    }
    scheduleBatchTicketSave(castingId);
}

function handleBatchAssignChange(castingId, idx, type) {
    const ticket = getBatchTicketFor(castingId);
    const casting = currentCastings.find(c => c.id === castingId);
    const activeLog = getActiveBatchColorLog(casting, ticket);
    const sandLbs = getColorLogSandLbs(activeLog);
    if (!sandLbs) return;
    const plan = buildBatchPlan({
        totalCuFt: parseFloat(ticket.cuFt) || 0,
        faceSqFt: parseFloat(ticket.faceSqFt) || 0,
        cuFtPer250: parseFloat(ticket.cuFtPer250) || 4.28,
        castMethod: activeLog?.castMethod || 'sprayUp',
        colorLogSandLbs: sandLbs,
        manualOverrides: ticket.batchAssignments
    });
    // Materialize current assignments (auto + any prior overrides), then update one.
    const assignments = plan.batches.map(b => ({ batchLbs: b.batchSandLbs, type: b.type }));
    if (idx >= 0 && idx < assignments.length) assignments[idx].type = type;
    ticket.batchAssignments = assignments;
    rerenderBatchPreview(castingId);
    scheduleBatchTicketSave(castingId);
}

/**
 * Import "Total Cu Ft Needed" and "Face Sq Ft" by totalling the selected
 * casting's inventory rows. Each row contributes its value × (quantity + extras).
 * A field is only filled when EVERY row has that value — otherwise that field
 * is left untouched and the user is warned which rows are incomplete.
 * @param {string} castingId
 */
async function handleImportBatchFromTracking(castingId) {
    if (!castingId) return;

    // Inventory is loaded lazily by the Casting Inventory tab — make sure it's
    // present for this project before we total it.
    if (currentCastingInventoryLoadedFor !== currentProjectNumber) {
        try {
            await loadAllInventoryForCurrentProject();
        } catch (err) {
            logger.error('[batch-tickets] inventory load for import failed', err);
            showToast('Could not load inventory for import', 'error');
            return;
        }
    }

    const rows = getInventoryFor(castingId);
    if (!rows.length) {
        showToast('No inventory components for this casting', 'error');
        return;
    }

    const has = (v) => v !== null && v !== undefined && v !== '';
    const unitsFor = (r) => (Number(r.quantity) || 0) + (Number(r.extras) || 0);

    const cuFtComplete = rows.every(r => has(r.cu_ft));
    const ffComplete   = rows.every(r => has(r.ff_sq_ft));

    let totalCuFt = 0, totalFf = 0;
    for (const r of rows) {
        const units = unitsFor(r);
        totalCuFt += (Number(r.cu_ft) || 0) * units;
        totalFf   += (Number(r.ff_sq_ft) || 0) * units;
    }

    const ticket = getBatchTicketFor(castingId);
    const applied = [];
    if (cuFtComplete) { ticket.cuFt = String(roundSig(totalCuFt, 2)); applied.push('Total Cu Ft'); }
    if (ffComplete)   { ticket.faceSqFt = String(roundSig(totalFf, 2)); applied.push('Face Sq Ft'); }

    if (!applied.length) {
        showToast('Import blocked — inventory rows are missing Cu Ft and FF Sq Ft values', 'error');
        return;
    }

    // Plan inputs changed — drop manual batch-type overrides so they can't desync.
    ticket.batchAssignments = [];
    renderBatchTicketsContent();
    scheduleBatchTicketSave(castingId);

    const skipped = [];
    if (!cuFtComplete) skipped.push('Cu Ft');
    if (!ffComplete)   skipped.push('FF Sq Ft');
    if (skipped.length) {
        showToast(`Imported ${applied.join(' & ')}. Skipped ${skipped.join(' & ')} — some inventory rows are blank.`, 'error');
    } else {
        showToast(`Imported ${applied.join(' & ')} from inventory`, 'success');
    }
}

async function handleCastingDateChange(castingId, value) {
    try {
        await updateCasting(castingId, { casting_date: value || null });
        const c = currentCastings.find(x => x.id === castingId);
        if (c) c.casting_date = value || null;
        // Refresh both pills (date label) and content if this is the active casting.
        renderBatchTicketsPills();
    } catch (err) {
        logger.error('[batch-tickets] casting_date update failed', err);
        showToast('Failed to update cast date', 'error');
    }
}

/** Update only the live-preview region (summary + assignment + ticket cards) — keeps focus in the inputs. */
function rerenderBatchPreview(castingId) {
    if (castingId !== currentBatchCastingId) return;
    const wrap = document.querySelector('#pp-bt-content [data-bt-preview]');
    if (!wrap) return;
    const casting = currentCastings.find(c => c.id === castingId);
    const ticket = batchTickets.get(castingId);
    if (!casting || !ticket) return;
    wrap.innerHTML = renderBatchPreview(casting, ticket);
}

// CSS.escape polyfill — for our IDs (UUIDs, no specials), plain interpolation works,
// but use the native API when available for safety.
function cssEscape(s) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(s);
    return String(s).replace(/[^a-zA-Z0-9_-]/g, m => '\\' + m);
}

// ---------- Print Tracking ----------

function openTrackPrintModal() {
    const modal = document.getElementById('pp-track-print-modal');
    const list = document.getElementById('pp-track-print-modal-list');
    if (!modal || !list) return;

    const phaseScoped = getCastingsForActivePhase();
    if (!phaseScoped || phaseScoped.length === 0) {
        list.innerHTML = `<div class="pp-track-print-empty">No castings to print. Add a casting first.</div>`;
    } else {
        list.innerHTML = phaseScoped.map(c => {
            const components = getComponentsFor(c.id);
            const count = components.length;
            const num = c.casting_number || '(no #)';
            const desc = c.description ? escapeHtml(c.description) : '';
            const countLabel = `${count} ${count === 1 ? 'component' : 'components'}`;
            return `
                <button type="button" class="pp-track-print-option" data-casting-id="${escapeAttr(c.id)}">
                    <span class="pp-track-print-option-num">Cast ${escapeHtml(num)}</span>
                    <span class="pp-track-print-option-desc">${desc}</span>
                    <span class="pp-track-print-option-count">${countLabel}</span>
                </button>
            `;
        }).join('');
    }

    modal.hidden = false;
}

function closeTrackPrintModal() {
    const modal = document.getElementById('pp-track-print-modal');
    if (modal) modal.hidden = true;
}

// ---------- Phases (project-level toggle + editor on Info tab) ----------

function renderPhaseSwitcher() {
    const sel = document.getElementById('pp-phase-switcher');
    if (!sel) return;
    if (!currentPhasesEnabled || currentPhases.length === 0) {
        sel.hidden = true;
        sel.innerHTML = '';
        return;
    }
    sel.innerHTML = currentPhases.map(p =>
        `<option value="${escapeAttr(p.id)}"${p.id === currentPhaseId ? ' selected' : ''}>${escapeHtml(p.phase_name || '')}</option>`
    ).join('');
    sel.hidden = false;
}

function ensureValidCurrentPhase() {
    // After phases reload or change, make sure currentPhaseId points at a real phase.
    if (!currentPhasesEnabled) {
        currentPhaseId = null;
        return;
    }
    if (currentPhases.length === 0) {
        currentPhaseId = null;
        return;
    }
    if (!currentPhaseId || !currentPhases.some(p => p.id === currentPhaseId)) {
        currentPhaseId = currentPhases[0].id;
    }
}

function handlePhaseSwitch(phaseId) {
    if (!phaseId || phaseId === currentPhaseId) return;
    currentPhaseId = phaseId;
    // Re-render the active phase-scoped tab so it reflects the new phase.
    if (currentTab === 'castings') {
        renderCastings();
    } else if (currentTab === 'tracking') {
        // Active tracking selection may now be on a casting from another phase.
        selectedComponentIds.clear();
        renderTracking();
    } else if (currentTab === 'shipping') {
        renderShipping();
    } else if (currentTab === 'optimizer') {
        // Reset active casting if it's no longer in this phase.
        const phaseScoped = getCastingsForActivePhase();
        if (!currentOptCastingId || !phaseScoped.some(c => c.id === currentOptCastingId)) {
            currentOptCastingId = phaseScoped[0]?.id || null;
        }
        renderOptimizer();
    } else if (currentTab === 'batch-tickets') {
        const phaseScoped = getCastingsForActivePhase();
        if (!currentBatchCastingId || !phaseScoped.some(c => c.id === currentBatchCastingId)) {
            currentBatchCastingId = phaseScoped[0]?.id || null;
        }
        renderBatchTickets();
    }
}

function renderPhasesSection() {
    const disabledState = document.getElementById('pp-phases-disabled-state');
    const enabledState = document.getElementById('pp-phases-enabled-state');
    const enableBtn = document.getElementById('pp-phases-enable-btn');
    if (!disabledState || !enabledState) return;

    if (!currentProjectNumber) {
        // List view / unsaved project — hide both sub-states.
        disabledState.hidden = true;
        enabledState.hidden = true;
        return;
    }

    if (!currentPhasesEnabled) {
        disabledState.hidden = false;
        enabledState.hidden = true;
        if (enableBtn) enableBtn.disabled = false;
        return;
    }

    disabledState.hidden = true;
    enabledState.hidden = false;

    const list = document.getElementById('pp-phases-list');
    if (!list) return;
    list.innerHTML = currentPhases.length === 0
        ? `<div class="pp-phases-empty">No phases. Click <strong>Add Phase</strong> below.</div>`
        : currentPhases.map(p => renderPhaseRow(p)).join('');
}

function renderPhaseRow(phase) {
    return `
        <div class="pp-phase-row" data-phase-id="${escapeAttr(phase.id)}">
            <span class="pp-phase-grip" aria-hidden="true">⋮⋮</span>
            <input type="text" class="pp-phase-name" data-action="phase-rename" value="${escapeAttr(phase.phase_name || '')}" />
            <button type="button" class="pp-phase-delete" data-action="phase-delete" data-phase-id="${escapeAttr(phase.id)}" title="Delete phase">×</button>
        </div>
    `;
}

async function handleEnablePhases() {
    if (!currentProjectNumber) {
        showToast('Save the project first.', 'error');
        return;
    }
    const enableBtn = document.getElementById('pp-phases-enable-btn');
    const ok = window.confirm(
        'Enable phases for this project?\n\n' +
        'All existing castings and crates will be moved into "Phase 1". ' +
        'Once enabled, phases stay on for this project — this can\'t be undone.'
    );
    if (!ok) return;
    if (enableBtn) enableBtn.disabled = true;
    try {
        const result = await enablePhasesForProject(currentProjectNumber);
        currentPhasesEnabled = !!result.enabled;
        currentPhases = result.phases || [];
        phasesLoadedFor = currentProjectNumber;
        ensureValidCurrentPhase();
        // Tag every loaded casting/crate locally so the in-memory state matches
        // what enablePhasesForProject just wrote to the DB. Avoids a reload.
        const phaseId = currentPhases[0]?.id || null;
        if (phaseId) {
            for (const c of currentCastings) if (!c.phase_id) c.phase_id = phaseId;
            for (const c of currentCrates) if (!c.phase_id) c.phase_id = phaseId;
        }
        renderPhasesSection();
        renderPhaseSwitcher();
        showToast('Phases enabled — Phase 1 created.', 'success');
    } catch (err) {
        logger.error('[project-portal] enablePhasesForProject failed:', err);
        showToast('Failed to enable phases. See console.', 'error');
        if (enableBtn) enableBtn.disabled = false;
    }
}

async function handleAddProjectPhase() {
    if (!currentProjectNumber || !currentPhasesEnabled) return;
    try {
        const newPhase = await createPhase(currentProjectNumber, {});
        if (newPhase) {
            currentPhases.push(newPhase);
            renderPhasesSection();
            renderPhaseSwitcher();
        }
    } catch (err) {
        logger.error('[project-portal] createPhase failed:', err);
        showToast('Failed to add phase.', 'error');
    }
}

function scheduleProjectPhaseRename(phaseId, name) {
    if (!phaseId) return;
    if (phaseRenameSaveTimers.has(phaseId)) clearTimeout(phaseRenameSaveTimers.get(phaseId));
    const handle = setTimeout(async () => {
        phaseRenameSaveTimers.delete(phaseId);
        try {
            const trimmed = (name || '').trim();
            if (!trimmed) return;
            const updated = await renamePhase(phaseId, trimmed);
            if (updated) {
                const idx = currentPhases.findIndex(p => p.id === phaseId);
                if (idx >= 0) currentPhases[idx] = { ...currentPhases[idx], ...updated };
            }
        } catch (err) {
            logger.error('[project-portal] renamePhase failed:', err);
        }
    }, 350);
    phaseRenameSaveTimers.set(phaseId, handle);
}

async function handleDeleteProjectPhase(phaseId) {
    if (!phaseId) return;
    const phase = currentPhases.find(p => p.id === phaseId);
    if (!phase) return;

    let usage;
    try {
        usage = await getPhaseUsageCounts(phaseId);
    } catch (err) {
        logger.error('[project-portal] getPhaseUsageCounts failed:', err);
        showToast('Could not check phase contents.', 'error');
        return;
    }
    const totalRefs = (usage.castings || 0) + (usage.crates || 0);
    if (totalRefs > 0) {
        const parts = [];
        if (usage.castings) parts.push(`${usage.castings} ${usage.castings === 1 ? 'casting' : 'castings'}`);
        if (usage.crates) parts.push(`${usage.crates} ${usage.crates === 1 ? 'crate' : 'crates'}`);
        showToast(`Cannot delete "${phase.phase_name}" — it still has ${parts.join(' and ')}. Move them to another phase first.`, 'error');
        return;
    }
    if (currentPhases.length <= 1) {
        showToast('Cannot delete the last phase.', 'error');
        return;
    }
    if (!window.confirm(`Delete "${phase.phase_name}"?`)) return;
    try {
        await deletePhase(phaseId);
        currentPhases = currentPhases.filter(p => p.id !== phaseId);
        if (currentPhaseId === phaseId) {
            currentPhaseId = null;
            ensureValidCurrentPhase();
        }
        renderPhasesSection();
        renderPhaseSwitcher();
    } catch (err) {
        logger.error('[project-portal] deletePhase failed:', err);
        showToast('Failed to delete phase.', 'error');
    }
}

// ---------- Shipping (crate-based packing lists) ----------

async function activateShippingTab() {
    const needsSave = document.getElementById('pp-ship-needs-save');
    const list = document.getElementById('pp-ship-list');
    if (!list) return;

    if (!currentProjectNumber) {
        if (needsSave) needsSave.hidden = false;
        list.innerHTML = '';
        return;
    }
    if (needsSave) needsSave.hidden = true;

    // Default to all crates collapsed each time the user opens this tab.
    // Qty-vs-list view choice persists for the session.
    currentShipExpanded.clear();
    const qtyCheckbox = document.getElementById('pp-ship-qty-mode');
    if (qtyCheckbox) qtyCheckbox.checked = shipQtyModeGlobal;

    // Make sure castings + components are loaded (member display depends on them).
    if (currentCastings.length === 0) {
        try { currentCastings = await loadCastings(currentProjectNumber); } catch (e) { /* ignore */ }
    }
    await Promise.all([
        loadAllComponentsForCurrentProject(),
        ensureCratesLoaded()
    ]);
    renderShipping();
}

function getCratesForActivePhase() {
    if (!currentPhasesEnabled) return currentCrates;
    if (!currentPhaseId) return [];
    return currentCrates.filter(c => c.phase_id === currentPhaseId);
}

function renderShipping() {
    const list = document.getElementById('pp-ship-list');
    if (!list) return;

    const visibleCrates = getCratesForActivePhase();
    if (visibleCrates.length === 0) {
        list.innerHTML = `<div class="pp-ship-empty">No crates yet. Pick a crate # on the <strong>Tracking</strong> tab to start a packing list.</div>`;
        return;
    }

    // Build a map crateId -> ordered components (across all visible castings).
    const visibleCastings = getCastingsForActivePhase();
    const membersByCrate = new Map();
    for (const crate of visibleCrates) membersByCrate.set(crate.id, []);
    for (const casting of visibleCastings) {
        const comps = getComponentsFor(casting.id);
        for (const comp of comps) {
            if (comp.crate_id && membersByCrate.has(comp.crate_id)) {
                membersByCrate.get(comp.crate_id).push({ comp, casting });
            }
        }
    }

    list.innerHTML = visibleCrates.map(crate => renderCrateCard(crate, membersByCrate.get(crate.id) || [])).join('');
}

function renderCrateCard(crate, members) {
    const isOpen = currentShipExpanded.has(crate.id);
    const memberCount = members.length;

    const memberRows = members.length === 0
        ? `<div class="pp-ship-crate-empty">No panels assigned.</div>`
        : shipQtyModeGlobal
            ? renderCrateQtyRollup(members)
            : members.map(({ comp, casting }) => `
                <div class="pp-ship-crate-member">
                    <span class="pp-ship-member-panel">${escapeHtml(comp.panel_id || '—')}</span>
                    <span class="pp-ship-member-meta">${escapeHtml(casting.casting_number ? `Cast ${casting.casting_number}` : '')}</span>
                    <span class="pp-ship-member-meta">${escapeHtml([comp.width, comp.length].filter(Boolean).join(' × '))}</span>
                    <span class="pp-ship-member-meta">${escapeHtml(resolveComponentColorName(comp))}</span>
                    <button type="button" class="pp-ship-member-remove" data-action="ship-unassign" data-component-id="${escapeAttr(comp.id)}" title="Remove from this crate">×</button>
                </div>
            `).join('');

    return `
        <div class="pp-ship-crate${isOpen ? ' pp-ship-crate-open' : ''}" data-crate-id="${escapeAttr(crate.id)}">
            <div class="pp-ship-crate-header">
                <button type="button" class="pp-ship-crate-chevron" data-action="ship-toggle-expand" aria-expanded="${isOpen}" title="${isOpen ? 'Collapse' : 'Expand'}">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <polyline points="9 18 15 12 9 6"/>
                    </svg>
                </button>
                <span class="pp-ship-crate-num-label">Crate&nbsp;#</span>
                <input type="text" class="pp-ship-crate-num" data-field="crate_number" value="${escapeAttr(crate.crate_number || '')}" />
                <span class="pp-ship-crate-count">${memberCount} ${memberCount === 1 ? 'panel' : 'panels'}</span>
                <div class="pp-ship-crate-actions">
                    <button type="button" class="pp-ship-print-btn" data-action="ship-print" data-crate-id="${escapeAttr(crate.id)}" ${memberCount === 0 ? 'disabled' : ''} title="${memberCount === 0 ? 'Assign panels first' : 'Print packing list'}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <polyline points="6 9 6 2 18 2 18 9"/>
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                            <rect x="6" y="14" width="12" height="8"/>
                        </svg>
                        <span>Packing List</span>
                    </button>
                    <button type="button" class="pp-ship-delete-btn" data-action="ship-delete" data-crate-id="${escapeAttr(crate.id)}" title="Delete crate (panels become unassigned)">×</button>
                </div>
            </div>
            <div class="pp-ship-crate-body">
                <div class="pp-ship-crate-meta-row">
                    <label class="pp-ship-crate-field">
                        <span>Weight</span>
                        <input type="text" data-field="weight" value="${escapeAttr(crate.weight || '')}" placeholder="e.g. 1,250 lbs" />
                    </label>
                    <label class="pp-ship-crate-field">
                        <span>Dimensions</span>
                        <input type="text" data-field="dimensions" value="${escapeAttr(crate.dimensions || '')}" placeholder="e.g. 96 × 48 × 30 in" />
                    </label>
                    <label class="pp-ship-crate-field pp-ship-crate-notes">
                        <span>Notes</span>
                        <input type="text" data-field="notes" value="${escapeAttr(crate.notes || '')}" placeholder="Handling notes, fragile, etc." />
                    </label>
                </div>
                <div class="pp-ship-crate-members">
                    ${memberRows}
                </div>
            </div>
        </div>
    `;
}

function renderCrateQtyRollup(members) {
    // Aggregate by (type, width, length, color, sealer) so each unique panel
    // spec collapses to one row with a count.
    const buckets = new Map();
    for (const { comp } of members) {
        const colorName = resolveComponentColorName(comp);
        const key = [comp.type || '', comp.width || '', comp.length || '', colorName, comp.sealer || ''].join('||');
        if (!buckets.has(key)) {
            buckets.set(key, { type: comp.type || '', width: comp.width || '', length: comp.length || '', color: colorName, count: 0 });
        }
        buckets.get(key).count++;
    }
    // Sort by type then dimensions for stable display.
    const rows = [...buckets.values()].sort((a, b) =>
        (a.type || '').localeCompare(b.type || '') ||
        (a.length || '').localeCompare(b.length || '') ||
        (a.width || '').localeCompare(b.width || '')
    );
    return rows.map(r => `
        <div class="pp-ship-crate-member pp-ship-crate-member-qty">
            <span class="pp-ship-member-panel">${escapeHtml(r.type || '—')}</span>
            <span class="pp-ship-member-qty">× ${r.count}</span>
            <span class="pp-ship-member-meta">${escapeHtml([r.width, r.length].filter(Boolean).join(' × '))}</span>
            <span class="pp-ship-member-meta">${escapeHtml(r.color || '')}</span>
        </div>
    `).join('');
}

function scheduleCrateSave(crateId, fields) {
    if (!crateId) return;
    if (crateSaveTimers.has(crateId)) clearTimeout(crateSaveTimers.get(crateId));
    const handle = setTimeout(async () => {
        crateSaveTimers.delete(crateId);
        try {
            const updated = await updateCrate(crateId, fields);
            if (updated) {
                const idx = currentCrates.findIndex(c => c.id === crateId);
                if (idx >= 0) currentCrates[idx] = { ...currentCrates[idx], ...updated };
            }
        } catch (err) {
            logger.error('[project-portal] updateCrate failed:', err);
        }
    }, 350);
    crateSaveTimers.set(crateId, handle);
}

async function handleDeleteCrate(crateId) {
    if (!crateId) return;
    const crate = currentCrates.find(c => c.id === crateId);
    if (!crate) return;
    const memberCount = getComponentCount(crateId);
    const msg = memberCount === 0
        ? `Delete crate #${crate.crate_number || ''}?`
        : `Delete crate #${crate.crate_number || ''}? ${memberCount} ${memberCount === 1 ? 'panel' : 'panels'} will be unassigned.`;
    if (!window.confirm(msg)) return;
    try {
        await deleteCrate(crateId);
        currentCrates = currentCrates.filter(c => c.id !== crateId);
        // Locally clear crate_id on any components that pointed here.
        for (const list of currentCastingComponents.values()) {
            for (const comp of list) if (comp.crate_id === crateId) comp.crate_id = null;
        }
        renderShipping();
    } catch (err) {
        logger.error('[project-portal] deleteCrate failed:', err);
    }
}

// Override the print-header label for specific phases. Anything not listed
// here prints with its default phase name from TRACKING_PHASES.
const TRACK_PRINT_PHASE_LABELS = {
    LOAD: 'LOAD/CRATE #'
};

const TRACK_PRINT_CSS = `
/* 11x17 (tabloid) landscape: 17in wide x 11in tall. */
@page { size: 17in 11in; margin: 0.35in 0.45in; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: "Segoe UI", Arial, sans-serif;
    color: #1a1d21;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}

/* Single continuous sheet — the browser paginates the long table
   automatically. The table's <thead> repeats on every printed page
   (display: table-header-group), and rows avoid splitting mid-row. */
.tp-sheet { }
table.tp-table thead { display: table-header-group; }
table.tp-table tbody tr { page-break-inside: avoid; break-inside: avoid; }

/* ---------- Header (single line) ---------- */
.tp-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 14pt;
    border-bottom: 3pt solid #1f3a5f;
    padding-bottom: 6pt;
}
.tp-proj { font-size: 14pt; font-weight: 800; white-space: nowrap; }
.tp-meta { display: flex; gap: 18pt; font-size: 11pt; align-items: baseline; flex-wrap: wrap; }
.tp-meta b { color: #5b6470; font-weight: 600; }

/* ---------- Instruction band (EN / ES) ---------- */
.tp-howto {
    margin: 8pt 0 6pt;
    background: #1f3a5f;
    color: #fff;
    border-radius: 4pt;
    padding: 6pt 10pt;
    font-size: 10.5pt;
    display: flex;
    flex-direction: column;
    gap: 5pt;
}
.tp-howto-line {
    display: flex;
    gap: 12pt;
    align-items: center;
    flex-wrap: wrap;
    line-height: 1.3;
}
.tp-howto-line.es {
    border-top: 1px solid rgba(255,255,255,0.22);
    padding-top: 5pt;
    /* Spanish runs ~15-20% longer than English; tighten gap + font so the
       whole ES band fits on one line at print width, matching EN. */
    gap: 6pt;
    font-size: 9pt;
}
.tp-howto-line.es .tp-big { font-size: 9.5pt; }
.tp-howto .tp-lang {
    background: #fff;
    color: #1f3a5f;
    border-radius: 3px;
    padding: 1px 6px;
    font-weight: 800;
    font-size: 9pt;
    letter-spacing: 0.5px;
}
.tp-howto-line.es .tp-lang { background: #ffd24d; }
.tp-howto .tp-big { font-weight: 800; font-size: 11pt; }
.tp-howto .tp-star { color: #ffd24d; }
.tp-howto .tp-chip {
    background: #fff;
    color: #1f3a5f;
    border-radius: 4px;
    padding: 1px 7px;
    font-weight: 700;
    font-family: monospace;
}
.tp-howto .tp-failchip { background: #c0392b; color: #fff; }

/* ---------- Grid ---------- */
table.tp-table {
    border-collapse: collapse;
    width: 100%;
    font-size: 9pt;
    table-layout: fixed;
}
.tp-table thead th {
    background: #1f3a5f;
    color: #fff;
    font-size: 9pt;
    font-weight: 700;
    padding: 6pt 3pt;
    border: 1px solid #2c4f7c;
    text-align: center;
    vertical-align: middle;
    line-height: 1.15;
}
.tp-table thead th.tp-hold { background: #c0392b; }
.tp-table thead th.tp-col-panel { text-align: left; padding-left: 6pt; }
.tp-table thead th.tp-col-color { text-align: left; padding-left: 6pt; }
.tp-table thead th .tp-seq {
    display: block;
    font-weight: 600;
    opacity: 0.7;
    font-size: 7.5pt;
    margin-top: 1pt;
}

.tp-table tbody td {
    border: 1px solid #c2c9d2;
    height: 22pt;
    text-align: center;
    vertical-align: middle;
    font-family: Consolas, monospace;
    font-size: 10pt;
    color: #16314f;
}
.tp-table tbody td.tp-col-panel {
    text-align: left;
    padding-left: 6pt;
    font-weight: 700;
    font-family: "Segoe UI", Arial, sans-serif;
    color: #1a1d21;
    background: #f7f9fc;
}
.tp-table tbody td.tp-col-color {
    text-align: left;
    padding-left: 6pt;
    font-family: "Segoe UI", Arial, sans-serif;
    font-size: 9pt;
    color: #5b6470;
    background: #f7f9fc;
}
.tp-table tbody td.tp-hold {
    border-left: 2px solid #c0392b;
    border-right: 2px solid #c0392b;
    background: #fdf1ee;
}
.tp-table tbody tr.tp-band td { background: #eef2f7; }
.tp-table tbody tr.tp-band td.tp-col-panel,
.tp-table tbody tr.tp-band td.tp-col-color { background: #eef1f6; }
.tp-table tbody tr.tp-band td.tp-hold { background: #fde6e0; }

/* Heavier divider every 5 rows */
.tp-table tbody tr.tp-group td { border-top: 2px solid #8a929d; }

.tp-done { background: #e7f4ea !important; color: #1f6b34; font-weight: 700; }
.tp-flag { background: #fde6e0 !important; color: #c0392b; font-weight: 800; }

/* Clearly-marked example row */
.tp-table tbody tr.tp-example td {
    background: #fffbe6;
    border-color: #e6cf73;
}
.tp-table tbody tr.tp-example td.tp-col-panel {
    background: #fff3c4;
    font-size: 9pt;
    line-height: 1.1;
}
.tp-table tbody tr.tp-example td.tp-col-color { background: #fff7d1; }

/* ---------- Footer note ---------- */
.tp-note {
    margin-top: 8pt;
    font-size: 8.5pt;
    color: #5b6470;
    font-style: italic;
    line-height: 1.4;
}
`;

function buildTrackPrintHtml(casting, components, projectNumber, projectName) {
    const num = casting.casting_number || '';
    const desc = casting.description || '';

    // Phases come out in TRACKING_PHASES order, filtered by what's currently
    // selected. FINAL is the QC hold-point — always force it on for the
    // printed traveler so the 2nd-initial sign-off column is never missing.
    const userPhases = TRACKING_PHASES.filter(p => currentTrackingPhases.has(p));
    const selectedPhases = userPhases.includes('FINAL')
        ? userPhases
        : [...userPhases, 'FINAL'].sort((a, b) => TRACKING_PHASES.indexOf(a) - TRACKING_PHASES.indexOf(b));

    // ---------- Header values ----------
    const projectLabel = [projectNumber, projectName]
        .map(s => (s == null ? '' : String(s).trim()))
        .filter(Boolean)
        .join(' — ');

    // "Cast 15 kitchen counter" — append description if present.
    const castNumLabel = num ? `Cast ${num}` : 'Cast';
    const castLabel = desc ? `${castNumLabel} ${desc}` : castNumLabel;

    // Cast color — if every component shares the same color name use it;
    // if multiple distinct non-empty colors appear use "Mixed"; else blank.
    const colorSet = new Set();
    for (const c of components) {
        const name = (resolveComponentColorName(c) || '').trim();
        if (name) colorSet.add(name);
    }
    let castColor = '';
    if (colorSet.size === 1) castColor = [...colorSet][0];
    else if (colorSet.size > 1) castColor = 'Mixed';

    // Date as M/D/YY (no leading zeros).
    const d = new Date();
    const dateLabel = `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;

    // ---------- Column widths ----------
    // Panel ID 6%, Color 8%, phases split the remainder evenly.
    const panelIdPct = 6;
    const colorPct = 8;
    const phasePct = selectedPhases.length > 0
        ? (100 - panelIdPct - colorPct) / selectedPhases.length
        : 0;

    // ---------- Header cells (single <thead>; browser repeats it per print page) ----------
    const headerCells = [
        `<th class="tp-col-panel" style="width:${panelIdPct}%;">Panel ID</th>`,
        `<th class="tp-col-color" style="width:${colorPct}%;">Color</th>`,
        ...selectedPhases.map((p, i) => {
            const isFinal = p === 'FINAL';
            const label = escapeHtml(TRACK_PRINT_PHASE_LABELS[p] || p);
            const seq = `${i + 1}${isFinal ? ' · QC' : ''}`;
            const cls = isFinal ? 'tp-hold' : '';
            const labelHtml = isFinal ? `★ ${label}` : label;
            return `<th class="${cls}" style="width:${phasePct}%;">${labelHtml}<span class="tp-seq">${seq}</span></th>`;
        })
    ].join('');

    // ---------- Instruction band (literal markup from mockup) ----------
    const instructionBand = `
        <div class="tp-howto">
            <div class="tp-howto-line">
                <span class="tp-lang">EN</span>
                <span class="tp-big">How to fill this in:</span>
                <span>When a step <b>PASSES</b>, write your <span class="tp-chip">initials</span> in the cell — at the station, as you finish it.</span>
                <span>Step <b>FAILS</b>? Write <span class="tp-chip tp-failchip">F</span> in the cell. Do not pass it on.</span>
                <span><b class="tp-star">★ FINAL</b> = QC sign-off — needs a 2nd initial before the panel ships.</span>
            </div>
            <div class="tp-howto-line es">
                <span class="tp-lang">ES</span>
                <span class="tp-big">Cómo completar esta hoja:</span>
                <span>Cuando termine un paso correctamente, escriba sus <span class="tp-chip">iniciales</span> en la casilla — en la estación.</span>
                <span>¿Un paso <b>FALLA</b>? Escriba <span class="tp-chip tp-failchip">F</span> en la casilla. No lo pase adelante.</span>
                <span><b class="tp-star">★ FINAL</b> = aprobación final de QC — requiere una 2.ª inicial antes de enviar el panel.</span>
            </div>
        </div>
    `;

    // ---------- Example row (rendered once at top of the body) ----------
    // Three PASS cells then one F, then blank cells. FINAL cell gets tp-hold.
    const exampleColor = escapeHtml(castColor || 'Fairfield #12');
    const exampleSamples = ['MD', 'MD', 'RT', 'F'];
    const exampleCells = selectedPhases.map((p, i) => {
        const isFinal = p === 'FINAL';
        const sample = exampleSamples[i];
        if (sample === undefined) {
            return `<td class="${isFinal ? 'tp-hold' : ''}"></td>`;
        }
        if (sample === 'F') {
            const cls = isFinal ? 'tp-flag tp-hold' : 'tp-flag';
            return `<td class="${cls}">F</td>`;
        }
        const cls = isFinal ? 'tp-done tp-hold' : 'tp-done';
        return `<td class="${cls}">${escapeHtml(sample)}</td>`;
    }).join('');
    const exampleRow = `
        <tr class="tp-group tp-example">
            <td class="tp-col-panel">EXAMPLE<br><span style="font-weight:400;font-style:italic;color:#5b6470;">EJEMPLO</span></td>
            <td class="tp-col-color">${exampleColor}</td>
            ${exampleCells}
        </tr>
    `;

    const totalCols = 2 + selectedPhases.length;

    // ---------- Build the single continuous body ----------
    let bodyRows = exampleRow;

    if (components.length === 0) {
        bodyRows += `
            <tr>
                <td colspan="${totalCols}" style="padding:14pt;text-align:center;font-style:italic;color:#5b6470;background:#fff;">No components recorded for this casting.</td>
            </tr>
        `;
    } else {
        bodyRows += components.map((comp, idx) => {
            // Mockup pattern: rows 1,6,11,... get tp-group (heavier top border);
            // rows 2,4,6,8,... get tp-band (zebra). Rows can have both.
            const rowNum = idx + 1;
            const classes = [];
            if (rowNum % 5 === 1) classes.push('tp-group');
            if (rowNum % 2 === 0) classes.push('tp-band');
            const rowClass = classes.length ? ` class="${classes.join(' ')}"` : '';

            const phaseCells = selectedPhases.map(p => {
                const isFinal = p === 'FINAL';
                const cls = isFinal ? 'tp-hold' : 'tp-col-phase';
                return `<td class="${cls}"></td>`;
            }).join('');

            return `
                <tr${rowClass}>
                    <td class="tp-col-panel">${escapeHtml(comp.panel_id || '')}</td>
                    <td class="tp-col-color">${escapeHtml(resolveComponentColorName(comp) || '')}</td>
                    ${phaseCells}
                </tr>
            `;
        }).join('');
    }

    const headerMeta = [
        castLabel ? `<span><b>Cast&nbsp;#</b>&nbsp;${escapeHtml(String(num) || '')}${desc ? ` ${escapeHtml(desc)}` : ''}</span>` : '',
        castColor ? `<span><b>Color</b>&nbsp;${escapeHtml(castColor)}</span>` : '',
        `<span><b>Date</b>&nbsp;${escapeHtml(dateLabel)}</span>`
    ].filter(Boolean).join('');

    // One sheet: header + instruction band once, then a single long table.
    // The browser paginates the table; the <thead> repeats on each printed page.
    const sheet = `
        <div class="tp-sheet">
            <div class="tp-top">
                <div class="tp-proj">${escapeHtml(projectLabel)}</div>
                <div class="tp-meta">${headerMeta}</div>
            </div>
            ${instructionBand}
            <table class="tp-table">
                <thead><tr>${headerCells}</tr></thead>
                <tbody>${bodyRows}</tbody>
            </table>
        </div>
    `;

    return `<!doctype html><html><head><meta charset="utf-8"><title>Tracking — ${escapeHtml(projectNumber)} — ${escapeHtml(castLabel)}</title><style>${TRACK_PRINT_CSS}</style></head><body>${sheet}</body></html>`;
}

function handlePrintTracking(castingId) {
    if (!castingId) return;
    const casting = currentCastings.find(c => c.id === castingId);
    if (!casting) {
        showToast('Casting not found', 'error');
        return;
    }
    const components = getComponentsFor(castingId) || [];
    const projectNumber = currentProjectNumber || '';
    const projectName = document.getElementById('pp-f-project_name')?.value || '';

    // Single continuous sheet — header once at the top, then one long table.
    // The browser paginates the table automatically and repeats the <thead>
    // on each printed page (handled by CSS in TRACK_PRINT_CSS).
    const html = buildTrackPrintHtml(casting, components, projectNumber, projectName);

    // Remove any leftover iframe from a prior print attempt.
    const prior = document.getElementById('pp-track-print-frame');
    if (prior) prior.remove();

    // Hidden iframe — kept off-screen rather than display:none so browsers
    // reliably layout & print the contents.
    const iframe = document.createElement('iframe');
    iframe.id = 'pp-track-print-frame';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(iframe);

    let cleaned = false;
    const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        // Defer removal so the print dialog can finish reading the document.
        setTimeout(() => { iframe.remove(); }, 500);
    };

    iframe.addEventListener('load', () => {
        try {
            const win = iframe.contentWindow;
            // onafterprint fires whether the user printed or cancelled.
            win.addEventListener('afterprint', cleanup);
            win.focus();
            win.print();
        } catch (err) {
            logger.error('[project-portal] print tracking failed:', err);
            showToast('Print failed', 'error');
            cleanup();
        }
        // Safety net: clean up after 60s even if afterprint never fires
        // (some browsers/printers swallow the event).
        setTimeout(cleanup, 60000);
    }, { once: true });

    // Write the HTML into the iframe document.
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
        showToast('Print failed — could not open frame', 'error');
        iframe.remove();
        return;
    }
    doc.open();
    doc.write(html);
    doc.close();
}

// ---------- Print Panel Stickers ----------
// 4in x 1in stickers — one title sticker per casting (project + cast# + inventory
// summary by type + total count) followed by one sticker per panel (panel_id big
// in the middle, color on the rotated right strip). Print pipeline mirrors
// handlePrintTracking: hidden iframe + window.print().

const STICKER_PRINT_CSS = `
@page { size: 4in 0.75in; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; color: #000; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.sticker {
    width: 4in;
    height: 0.75in;
    overflow: hidden;
    page-break-after: always;
    display: flex;
    flex-direction: column;
    position: relative;
}
.sticker:last-child { page-break-after: auto; }
.sticker-title-top {
    font-weight: bold;
    letter-spacing: 0.05em;
    text-align: center;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 11pt;
    padding: 0.05in;
    border-bottom: 1px solid #ccc;
}
.sticker-top {
    flex: 0;
    text-align: left;
    padding: 0.05in;
    font-weight: bold;
    letter-spacing: 0.05em;
    border-bottom: 1px solid #ccc;
}
.sticker-content {
    flex: 1;
    display: flex;
    overflow: hidden;
    margin-right: 0.4in;
}
.sticker-bottom {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    font-size: 34pt;
    font-weight: bold;
    padding-left: 0.05in;
    padding-bottom: 0.02in;
    line-height: 1;
    overflow: hidden;
    white-space: nowrap;
}
.sticker-finish {
    display: flex;
    align-items: center;
    justify-content: center;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    font-size: 12pt;
    text-align: center;
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 0.4in;
    padding: 0 0.05in;
    border-left: 1px solid #ccc;
    height: 100%;
    box-sizing: border-box;
    z-index: 10;
    overflow: hidden;
    white-space: nowrap;
}
.sticker-inventory {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-content: flex-start;
    font-size: 8pt;
    padding: 0.05in;
    flex: 1;
    line-height: 1;
    overflow: hidden;
}
.sticker-inventory p {
    margin: 0 0.1in 0 0;
    white-space: nowrap;
}
`;

// Inline auto-shrink: matches the original sticker maker's adjustFontSize so the
// inventory line fits when there are many types. Runs inside the iframe doc.
const STICKER_PRINT_AUTOFIT_JS = `
(function() {
    document.querySelectorAll('.sticker-inventory').forEach(container => {
        const items = Array.from(container.querySelectorAll('p'));
        if (items.length === 0) return;
        let size = 8;
        const apply = () => items.forEach(it => it.style.fontSize = size + 'pt');
        apply();
        while ((container.scrollHeight > container.clientHeight || container.scrollWidth > container.clientWidth) && size > 4) {
            size -= 0.5;
            apply();
        }
    });
    document.querySelectorAll('.sticker-finish').forEach(finish => {
        let size = 12;
        finish.style.fontSize = size + 'pt';
        while ((finish.scrollHeight > finish.clientHeight || finish.scrollWidth > finish.clientWidth) && size > 6) {
            size -= 0.5;
            finish.style.fontSize = size + 'pt';
        }
    });
    document.querySelectorAll('.sticker-bottom').forEach(bottom => {
        let size = 34;
        bottom.style.fontSize = size + 'pt';
        while ((bottom.scrollWidth > bottom.clientWidth || bottom.scrollHeight > bottom.clientHeight) && size > 10) {
            size -= 1;
            bottom.style.fontSize = size + 'pt';
        }
    });
})();
`;

function formatStickerCasting(num) {
    const trimmed = String(num || '').trim();
    if (trimmed === '') return 'CASTING';
    const m = trimmed.match(/^(?:cast)?\s*#?\s*(\d+)$/i);
    if (m) return `Cast#${m[1]}`;
    return trimmed;
}

function buildStickerPrintHtml(casting, components, projectName) {
    const cleanProject = (projectName || '').trim().replace(/\s*\n\s*/g, ' ') || 'PROJECT NAME';
    const castLabel = formatStickerCasting(casting.casting_number);
    const phaseName = currentPhasesEnabled
        ? (currentPhases.find(p => p.id === casting.phase_id)?.phase_name || '')
        : '';
    const headerText = phaseName
        ? `${cleanProject} : ${phaseName} · ${castLabel}`
        : `${cleanProject} : ${castLabel}`;

    // Inventory summary: group by type, count panels per type.
    // Format mirrors the original sticker maker: "{type} - ({n}pcs)".
    const counts = new Map();
    for (const c of components) {
        const t = (c.type || '').trim() || '?';
        counts.set(t, (counts.get(t) || 0) + 1);
    }
    const inventoryItems = Array.from(counts.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([t, n]) => `<p>${escapeHtml(t)} - (${n}pcs)</p>`);
    inventoryItems.push(`<p>(${components.length}) Pieces Total</p>`);

    // Per-panel color resolution; title sticker shows the distinct set.
    const distinctNames = [];
    for (const c of components) {
        const n = resolveComponentColorName(c);
        if (n && !distinctNames.includes(n)) distinctNames.push(n);
    }
    const titleColor = distinctNames.length > 0
        ? distinctNames.join(', ')
        : (currentColorLog?.name || '').trim();

    const titleSticker = `
        <div class="sticker">
            <div class="sticker-title-top">${escapeHtml(headerText)}</div>
            <div class="sticker-content">
                <div class="sticker-inventory">
                    ${inventoryItems.join('')}
                </div>
            </div>
            <div class="sticker-finish">${escapeHtml(titleColor)}</div>
        </div>
    `;

    // Reverse panel order so when stickers exit the printer in stack-fed order,
    // the title sticker ends up on top of the pile.
    const panelStickers = [...components].reverse().map(c => {
        const panel = (c.panel_id || '').trim();
        const panelColor = resolveComponentColorName(c) || titleColor;
        return `
            <div class="sticker">
                <div class="sticker-top">${escapeHtml(headerText)}</div>
                <div class="sticker-content">
                    <div class="sticker-bottom">${escapeHtml(panel)}</div>
                </div>
                <div class="sticker-finish">${escapeHtml(panelColor)}</div>
            </div>
        `;
    }).join('');

    return `<!doctype html><html><head><meta charset="utf-8"><title>Stickers — ${escapeHtml(cleanProject)} — ${escapeHtml(castLabel)}</title><style>${STICKER_PRINT_CSS}</style></head><body>
        ${panelStickers}
        ${titleSticker}
        <script>${STICKER_PRINT_AUTOFIT_JS}<\/script>
    </body></html>`;
}

async function handlePrintStickers(castingId) {
    if (!castingId) return;
    const casting = currentCastings.find(c => c.id === castingId);
    if (!casting) {
        showToast('Casting not found', 'error');
        return;
    }
    const components = getComponentsFor(castingId) || [];
    if (components.length === 0) {
        showToast('No panels to label', 'error');
        return;
    }

    // Sticker color comes from the project's Color Log title. Load it lazily if
    // the user hasn't visited the Color Log tab yet.
    if (!currentColorLog && currentProjectNumber) {
        try {
            const existing = await loadColorLogForProject(currentProjectNumber);
            currentColorLog = existing || createEmptyColorLog();
        } catch (err) {
            logger.error('[project-portal] color-log load failed for stickers:', err);
            currentColorLog = createEmptyColorLog();
        }
    }

    const projectName = document.getElementById('pp-f-project_name')?.value || '';
    const html = buildStickerPrintHtml(casting, components, projectName);

    const prior = document.getElementById('pp-track-sticker-frame');
    if (prior) prior.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'pp-track-sticker-frame';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(iframe);

    let cleaned = false;
    const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        setTimeout(() => { iframe.remove(); }, 500);
    };

    iframe.addEventListener('load', () => {
        try {
            const win = iframe.contentWindow;
            win.addEventListener('afterprint', cleanup);
            win.focus();
            win.print();
        } catch (err) {
            logger.error('[project-portal] print stickers failed:', err);
            showToast('Print failed', 'error');
            cleanup();
        }
        setTimeout(cleanup, 60000);
    }, { once: true });

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
        showToast('Print failed — could not open frame', 'error');
        iframe.remove();
        return;
    }
    doc.open();
    doc.write(html);
    doc.close();
}

// ---------- Print Project Cover Page ----------
// Letter portrait one-pager mirroring the legacy "Full Scope" cover sheet:
// status pill + CWE wordmark in a header row, two-column meta block, two
// contact-info columns, then full-width Scope of Work and Imperative
// Information sections.

const COVER_PRINT_CSS = `
@page { size: letter portrait; margin: 0.5in; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; color: #000; font-size: 10pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; line-height: 1.35; }
.cv-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14pt; }
.cv-status {
    display: inline-block;
    padding: 4pt 14pt;
    border-radius: 999px;
    font-size: 10pt;
    font-weight: 700;
    letter-spacing: 0.3pt;
    background: #b91c1c; color: #fff;
}
.cv-status.cv-status-kicked-off  { background: #1e40af; color: #fff; }
.cv-status.cv-status-releasability { background: #b45309; color: #fff; }
.cv-status.cv-status-approved      { background: #166534; color: #fff; }
.cv-status.cv-status-in-production { background: #5b21b6; color: #fff; }
.cv-status.cv-status-shipped       { background: #0f766e; color: #fff; }
.cv-status.cv-status-closed-out    { background: #475569; color: #fff; }
.cv-brand { font-size: 22pt; font-weight: 800; letter-spacing: 1pt; }
.cv-meta { display: flex; gap: 24pt; margin-bottom: 8pt; }
.cv-meta-col { flex: 1; display: grid; grid-template-columns: 12em 1fr; row-gap: 3pt; column-gap: 6pt; }
.cv-meta-col .cv-label { color: #000; }
.cv-meta-col .cv-value { font-weight: 700; }
.cv-meta-col .cv-value.cv-multiline { white-space: pre-wrap; }
.cv-contact-row { display: flex; gap: 24pt; margin-top: 6pt; }
.cv-contact { flex: 1; }
.cv-section-bar {
    background: #e5e7eb;
    color: #000;
    text-align: left;
    padding: 3pt 8pt;
    font-size: 10pt;
    font-weight: 600;
    margin-bottom: 4pt;
}
.cv-contact .cv-section-bar { text-align: left; }
.cv-contact-grid { display: grid; grid-template-columns: 9em 1fr; row-gap: 3pt; column-gap: 6pt; padding: 0 2pt; }
.cv-contact-grid .cv-label { color: #000; }
.cv-contact-grid .cv-value { font-weight: 700; word-break: break-word; }
.cv-contact-grid .cv-value.cv-link { color: #1d4ed8; }
.cv-dates { display: flex; gap: 24pt; margin: 10pt 0 14pt 0; }
.cv-dates .cv-date-cell { flex: 1; display: flex; gap: 8pt; align-items: baseline; }
.cv-dates .cv-label { width: 9em; }
.cv-dates .cv-value { font-weight: 700; }
.cv-fullbar { background: #e5e7eb; text-align: center; padding: 4pt 8pt; font-size: 10pt; font-weight: 600; }
.cv-fullbar-content { padding: 8pt 8pt; min-height: 36pt; white-space: pre-wrap; text-align: center; }
.cv-fullbar-content.cv-empty { color: #6b7280; font-style: italic; }
.cv-section { margin-bottom: 10pt; }
`;

function statusSlug(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function formatCoverDate(raw) {
    const v = String(raw || '').trim();
    if (!v) return '';
    // ISO yyyy-mm-dd → m/d/yyyy
    const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return `${parseInt(iso[2], 10)}/${parseInt(iso[3], 10)}/${iso[1]}`;
    return v;
}

function readCoverFields() {
    const get = id => (document.getElementById(id)?.value || '').trim();
    return {
        status: get('pp-f-status'),
        pm: get('pp-f-pm'),
        project_name: get('pp-f-project_name'),
        project_number: get('pp-f-project_number'),
        project_date: formatCoverDate(get('pp-f-project_date')),
        project_address: get('pp-f-project_address'),
        estimator: get('pp-f-estimator'),
        architect: get('pp-f-architect'),
        contact_name: get('pp-f-contact_name'),
        contact_phone: get('pp-f-contact_phone'),
        contact_company: get('pp-f-contact_company'),
        contact_email: get('pp-f-contact_email'),
        site_contact: get('pp-f-site_contact'),
        site_phone: get('pp-f-site_phone'),
        delivery_address: get('pp-f-delivery_address'),
        site_restrictions: get('pp-f-site_restrictions'),
        need_by_date: get('pp-f-need_by_date'),
        production_start_date: get('pp-f-production_start_date'),
        scope_of_work: get('pp-f-scope_of_work'),
        imperative_information: get('pp-f-imperative_information')
    };
}

function buildCoverPrintHtml(f) {
    const statusCls = f.status ? `cv-status-${statusSlug(f.status)}` : '';
    const statusText = f.status || 'No Status';
    const emailHtml = f.contact_email ? `<a class="cv-link" href="mailto:${escapeAttr(f.contact_email)}">${escapeHtml(f.contact_email)}</a>` : '';
    const projectAddrLines = f.project_address ? escapeHtml(f.project_address).replace(/\n/g, '<br>') : '';
    const deliveryAddrLines = f.delivery_address ? escapeHtml(f.delivery_address).replace(/\n/g, '<br>') : '';

    const scopeBody = f.scope_of_work
        ? `<div class="cv-fullbar-content">${escapeHtml(f.scope_of_work)}</div>`
        : `<div class="cv-fullbar-content cv-empty">—</div>`;
    const impBody = f.imperative_information
        ? `<div class="cv-fullbar-content">${escapeHtml(f.imperative_information)}</div>`
        : `<div class="cv-fullbar-content cv-empty">—</div>`;

    return `<!doctype html><html><head><meta charset="utf-8"><title>Cover — ${escapeHtml(f.project_number || '')} ${escapeHtml(f.project_name || '')}</title><style>${COVER_PRINT_CSS}</style></head><body>
        <div class="cv-header">
            <span class="cv-status ${statusCls}">${escapeHtml(statusText)}</span>
            <span class="cv-brand">CWE</span>
        </div>

        <div class="cv-meta">
            <div class="cv-meta-col">
                <span class="cv-label">Project Name:</span><span class="cv-value">${escapeHtml(f.project_name)}</span>
                <span class="cv-label">Project #:</span><span class="cv-value">${escapeHtml(f.project_number)}</span>
                <span class="cv-label">PM:</span><span class="cv-value">${escapeHtml(f.pm)}</span>
                <span class="cv-label">Estimator/Sales Manager:</span><span class="cv-value">${escapeHtml(f.estimator)}</span>
                <span class="cv-label">Architect:</span><span class="cv-value">${escapeHtml(f.architect)}</span>
            </div>
            <div class="cv-meta-col">
                <span class="cv-label">Date:</span><span class="cv-value">${escapeHtml(f.project_date)}</span>
                <span class="cv-label">Project Address:</span><span class="cv-value cv-multiline">${projectAddrLines}</span>
            </div>
        </div>

        <div class="cv-contact-row">
            <div class="cv-contact">
                <div class="cv-section-bar">Main Contact Information</div>
                <div class="cv-contact-grid">
                    <span class="cv-label">Name:</span><span class="cv-value">${escapeHtml(f.contact_name)}</span>
                    <span class="cv-label">Phone:</span><span class="cv-value">${escapeHtml(f.contact_phone)}</span>
                    <span class="cv-label">Company Name:</span><span class="cv-value">${escapeHtml(f.contact_company)}</span>
                    <span class="cv-label">Email Address:</span><span class="cv-value">${emailHtml}</span>
                </div>
            </div>
            <div class="cv-contact">
                <div class="cv-section-bar">Delivery Information</div>
                <div class="cv-contact-grid">
                    <span class="cv-label">Site Contact:</span><span class="cv-value">${escapeHtml(f.site_contact)}</span>
                    <span class="cv-label">Phone:</span><span class="cv-value">${escapeHtml(f.site_phone)}</span>
                    <span class="cv-label">Delivery Address:</span><span class="cv-value cv-multiline">${deliveryAddrLines}</span>
                    <span class="cv-label">Site Restrictions:</span><span class="cv-value">${escapeHtml(f.site_restrictions)}</span>
                </div>
            </div>
        </div>

        <div class="cv-dates">
            <div class="cv-date-cell">
                <span class="cv-label">Need By Date:</span>
                <span class="cv-value">${escapeHtml(f.need_by_date)}</span>
            </div>
            <div class="cv-date-cell">
                <span class="cv-label">Production Start Date:</span>
                <span class="cv-value">${escapeHtml(f.production_start_date)}</span>
            </div>
        </div>

        <div class="cv-section">
            <div class="cv-fullbar">Scope of Work</div>
            ${scopeBody}
        </div>

        <div class="cv-section">
            <div class="cv-fullbar">Imperative Information</div>
            ${impBody}
        </div>
    </body></html>`;
}

function handlePrintCoverPage() {
    if (!currentProjectNumber) {
        showToast('Save the project first', 'error');
        return;
    }
    const fields = readCoverFields();
    const html = buildCoverPrintHtml(fields);

    const prior = document.getElementById('pp-cover-print-frame');
    if (prior) prior.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'pp-cover-print-frame';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(iframe);

    let cleaned = false;
    const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        setTimeout(() => { iframe.remove(); }, 500);
    };

    iframe.addEventListener('load', () => {
        try {
            const win = iframe.contentWindow;
            win.addEventListener('afterprint', cleanup);
            win.focus();
            win.print();
        } catch (err) {
            logger.error('[project-portal] print cover failed:', err);
            showToast('Print failed', 'error');
            cleanup();
        }
        setTimeout(cleanup, 60000);
    }, { once: true });

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
        showToast('Print failed — could not open frame', 'error');
        iframe.remove();
        return;
    }
    doc.open();
    doc.write(html);
    doc.close();
}

// ---------- Print Packing List (per crate) ----------

const PACKING_PRINT_CSS = `
@page {
    size: letter portrait;
    margin: 0.5in;
    @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font-family: 'Segoe UI', Arial, sans-serif;
        font-size: 9pt;
        color: #475569;
    }
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; color: #000; font-size: 8.5pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; line-height: 1.3; }
.pk-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8pt; padding-bottom: 4pt; border-bottom: 1.5pt solid #000; }
.pk-title { font-size: 15pt; font-weight: 800; letter-spacing: 0.4pt; }
.pk-crate-num { font-size: 18pt; font-weight: 800; color: #b91c1c; }
.pk-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 2pt 14pt; margin-bottom: 10pt; }
.pk-meta-row { display: grid; grid-template-columns: 8em 1fr; column-gap: 5pt; }
.pk-meta-row .pk-label { color: #475569; font-weight: 600; }
.pk-meta-row .pk-value { font-weight: 700; }
.pk-section-bar { background: #e5e7eb; padding: 3pt 6pt; font-size: 9.5pt; font-weight: 700; margin-bottom: 4pt; border: 1pt solid #cbd5e1; }
table.pk-table { width: 100%; border-collapse: collapse; margin-bottom: 10pt; }
table.pk-table th, table.pk-table td { border: 1pt solid #94a3b8; padding: 2.5pt 5pt; font-size: 8.5pt; vertical-align: middle; }
table.pk-table th { background: #f1f5f9; font-weight: 700; text-align: left; font-size: 8pt; }
table.pk-table td.pk-num { text-align: center; font-weight: 700; }
table.pk-table td.pk-checkbox { text-align: center; width: 0.45in; }
.pk-notes-block { margin-top: 8pt; }
.pk-notes-box { border: 1pt solid #94a3b8; min-height: 0.5in; padding: 5pt; font-size: 8.5pt; white-space: pre-wrap; }
.pk-signature-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20pt; margin-top: 14pt; }
.pk-sig-block { display: flex; flex-direction: column; gap: 2pt; }
.pk-sig-line { border-bottom: 1pt solid #000; height: 22pt; }
.pk-sig-label { font-size: 8pt; color: #475569; font-weight: 600; }
.pk-footer { margin-top: 12pt; text-align: center; font-size: 8pt; color: #64748b; }
@media print {
    .pk-header { page-break-after: avoid; }
    table.pk-table { page-break-inside: auto; }
    table.pk-table tr { page-break-inside: avoid; page-break-after: auto; }
}
`;

function buildPackingListHtml(crate, members, project) {
    const proj = project || {};
    const memberCount = members.length;
    const phaseName = currentPhasesEnabled
        ? (currentPhases.find(p => p.id === crate.phase_id)?.phase_name || '')
        : '';

    // Per-member resolved color name. Honors color_log_id → falls back to
    // legacy free-text → falls back to the project's currently active log.
    const memberColor = (comp) => resolveComponentColorName(comp);

    // Distinct set of color names actually present in this crate (used in
    // the header). Order = first appearance.
    const distinctColors = [];
    for (const { comp } of members) {
        const name = memberColor(comp);
        if (name && !distinctColors.includes(name)) distinctColors.push(name);
    }
    const colorHeaderLabel = (currentMultiColorEnabled && distinctColors.length > 1) ? 'Colors:' : 'Color:';
    const colorHeaderValue = distinctColors.length > 0
        ? distinctColors.join(', ')
        : (currentColorLog?.name || '').trim();

    const qtyMode = shipQtyModeGlobal;
    // Width/length intentionally omitted from the packing list print layout.
    const colCount = qtyMode ? 4 : 6;

    let rows;
    if (members.length === 0) {
        rows = `<tr><td colspan="${colCount}" style="text-align:center;color:#94a3b8;padding:8pt;">No panels assigned to this crate.</td></tr>`;
    } else if (qtyMode) {
        const buckets = new Map();
        for (const { comp } of members) {
            const colorName = memberColor(comp);
            const key = [comp.type || '', comp.width || '', comp.length || '', colorName].join('||');
            if (!buckets.has(key)) {
                buckets.set(key, { type: comp.type || '', width: comp.width || '', length: comp.length || '', color: colorName, count: 0 });
            }
            buckets.get(key).count++;
        }
        const aggregated = [...buckets.values()].sort((a, b) =>
            (a.type || '').localeCompare(b.type || '') ||
            (a.length || '').localeCompare(b.length || '') ||
            (a.width || '').localeCompare(b.width || '')
        );
        rows = aggregated.map((r, i) => {
            return `<tr>
                <td class="pk-num">${i + 1}</td>
                <td><strong>${escapeHtml(r.type)}</strong></td>
                <td>${escapeHtml(r.color)}</td>
                <td class="pk-num">${r.count}</td>
            </tr>`;
        }).join('');
    } else {
        rows = members.map(({ comp, casting }, i) => {
            return `<tr>
                <td class="pk-num">${i + 1}</td>
                <td><strong>${escapeHtml(comp.panel_id || '')}</strong></td>
                <td>${escapeHtml(casting?.casting_number ? `Cast ${casting.casting_number}` : '')}</td>
                <td>${escapeHtml(comp.type || '')}</td>
                <td>${escapeHtml(memberColor(comp))}</td>
                <td class="pk-checkbox">☐</td>
            </tr>`;
        }).join('');
    }

    return `<!doctype html><html><head><meta charset="utf-8"><title>Packing List — Crate ${escapeHtml(crate.crate_number || '')} — ${escapeHtml(proj.project_number || '')}</title><style>${PACKING_PRINT_CSS}</style></head><body>
        <div class="pk-header">
            <div class="pk-title">PACKING LIST</div>
            <div class="pk-crate-num">CRATE #${escapeHtml(crate.crate_number || '—')}</div>
        </div>

        <div class="pk-meta">
            <div class="pk-meta-row"><span class="pk-label">Project #:</span><span class="pk-value">${escapeHtml(proj.project_number || '')}</span></div>
            <div class="pk-meta-row"><span class="pk-label">Project Name:</span><span class="pk-value">${escapeHtml(proj.project_name || '')}</span></div>
            ${phaseName ? `<div class="pk-meta-row"><span class="pk-label">Phase:</span><span class="pk-value">${escapeHtml(phaseName)}</span></div>` : ''}
            <div class="pk-meta-row"><span class="pk-label">${escapeHtml(colorHeaderLabel)}</span><span class="pk-value">${escapeHtml(colorHeaderValue || '')}</span></div>
            <div class="pk-meta-row"><span class="pk-label">Panel Count:</span><span class="pk-value">${memberCount}</span></div>
            <div class="pk-meta-row"><span class="pk-label">Weight:</span><span class="pk-value">${escapeHtml(crate.weight || '')}</span></div>
            <div class="pk-meta-row"><span class="pk-label">Dimensions:</span><span class="pk-value">${escapeHtml(crate.dimensions || '')}</span></div>
            <div class="pk-meta-row"><span class="pk-label">Delivery Address:</span><span class="pk-value">${proj.delivery_address ? escapeHtml(proj.delivery_address).replace(/\n/g, '<br>') : ''}</span></div>
            <div class="pk-meta-row"><span class="pk-label">Date:</span><span class="pk-value">${escapeHtml(formatPackingDate(new Date()))}</span></div>
        </div>

        <div class="pk-section-bar">${qtyMode ? 'Panel quantities in this crate' : 'Panels in this crate'}</div>
        <table class="pk-table">
            <thead>
                ${qtyMode ? `<tr>
                    <th style="width:0.4in;">#</th>
                    <th>Type</th>
                    <th>Color</th>
                    <th style="width:0.6in;text-align:center;">Qty</th>
                </tr>` : `<tr>
                    <th style="width:0.4in;">#</th>
                    <th>Panel ID</th>
                    <th>Cast</th>
                    <th>Type</th>
                    <th>Color</th>
                    <th style="width:0.5in;text-align:center;">✓</th>
                </tr>`}
            </thead>
            <tbody>${rows}</tbody>
        </table>

        ${crate.notes ? `<div class="pk-notes-block">
            <div class="pk-section-bar">Notes</div>
            <div class="pk-notes-box">${escapeHtml(crate.notes)}</div>
        </div>` : ''}

        <div class="pk-signature-row">
            <div class="pk-sig-block">
                <div class="pk-sig-line"></div>
                <div class="pk-sig-label">Packed by (signature / date)</div>
            </div>
            <div class="pk-sig-block">
                <div class="pk-sig-line"></div>
                <div class="pk-sig-label">Received by (signature / date)</div>
            </div>
        </div>

        <div class="pk-footer">Crate ${escapeHtml(crate.crate_number || '')} · Project ${escapeHtml(proj.project_number || '')} · ${memberCount} ${memberCount === 1 ? 'panel' : 'panels'}</div>
    </body></html>`;
}

function formatPackingDate(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return '';
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

async function handlePrintPackingList(crateId) {
    if (!currentProjectNumber) {
        showToast('Save the project first', 'error');
        return;
    }
    const crate = currentCrates.find(c => c.id === crateId);
    if (!crate) return;

    // Lazily load color log if the user hasn't visited that tab.
    if (!currentColorLog && currentProjectNumber) {
        try {
            const existing = await loadColorLogForProject(currentProjectNumber);
            currentColorLog = existing || createEmptyColorLog();
        } catch (err) {
            logger.error('[project-portal] color-log load failed for packing list:', err);
            currentColorLog = createEmptyColorLog();
        }
    }

    // Gather members across all castings, ordered by casting sort_order then panel.
    const members = [];
    for (const casting of currentCastings) {
        const comps = getComponentsFor(casting.id);
        for (const comp of comps) {
            if (comp.crate_id === crateId) members.push({ comp, casting });
        }
    }

    let project = null;
    try {
        project = await loadProject(currentProjectNumber);
    } catch (err) {
        logger.warn('[project-portal] loadProject for packing list failed:', err);
    }
    if (!project) project = { project_number: currentProjectNumber };

    const html = buildPackingListHtml(crate, members, project);

    const prior = document.getElementById('pp-packing-print-frame');
    if (prior) prior.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'pp-packing-print-frame';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(iframe);

    let cleaned = false;
    const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        setTimeout(() => { iframe.remove(); }, 500);
    };

    iframe.addEventListener('load', () => {
        try {
            const win = iframe.contentWindow;
            win.addEventListener('afterprint', cleanup);
            win.focus();
            win.print();
        } catch (err) {
            logger.error('[project-portal] print packing list failed:', err);
            showToast('Print failed', 'error');
            cleanup();
        }
        setTimeout(cleanup, 60000);
    }, { once: true });

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
        showToast('Print failed — could not open frame', 'error');
        iframe.remove();
        return;
    }
    doc.open();
    doc.write(html);
    doc.close();
}

// ---------- Print Optimizer Hours ----------

function openOptPrintModal() {
    const modal = document.getElementById('pp-opt-print-modal');
    const list = document.getElementById('pp-opt-print-modal-list');
    if (!modal || !list) return;

    const phaseScoped = getCastingsForActivePhase();
    if (!phaseScoped || phaseScoped.length === 0) {
        list.innerHTML = `<div class="pp-track-print-empty">No castings to print. Add a casting first.</div>`;
    } else {
        list.innerHTML = phaseScoped.map(c => {
            const phases = getPhasesFor(c.id);
            const total = phases.reduce((s, p) => s + (typeof p.hours === 'number' ? p.hours : 0), 0);
            const num = c.casting_number || '(no #)';
            const desc = c.description ? escapeHtml(c.description) : '';
            const totalLabel = `${total} hr${total === 1 ? '' : 's'} · ${phases.length} task${phases.length === 1 ? '' : 's'}`;
            return `
                <label class="pp-opt-print-row">
                    <input type="checkbox" class="pp-opt-print-checkbox" data-casting-id="${escapeAttr(c.id)}" checked />
                    <span class="pp-opt-print-row-num">Cast ${escapeHtml(num)}</span>
                    <span class="pp-opt-print-row-desc">${desc}</span>
                    <span class="pp-opt-print-row-count">${totalLabel}</span>
                </label>
            `;
        }).join('');
    }

    modal.hidden = false;
}

function closeOptPrintModal() {
    const modal = document.getElementById('pp-opt-print-modal');
    if (modal) modal.hidden = true;
}

function setOptPrintAllChecked(checked) {
    const boxes = document.querySelectorAll('#pp-opt-print-modal-list .pp-opt-print-checkbox');
    boxes.forEach(cb => { cb.checked = !!checked; });
}

const OPT_PRINT_CSS = `
/* Letter portrait: 8.5in x 11in. Generous margins for binder-friendly layout. */
@page { size: letter portrait; margin: 0.5in; }
* { margin:0; padding:0; box-sizing:border-box; }
html, body { background:#fff; }
body { font-family: 'Segoe UI', Arial, sans-serif; color:#0f172a; font-size: 10pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.op-page { page-break-after: always; padding-bottom: 6pt; }
.op-page:last-child { page-break-after: auto; }
.op-header { border-bottom: 1.5pt solid #000; padding-bottom: 6pt; margin-bottom: 10pt; }
.op-project { font-size: 10.5pt; font-weight: 600; color: #475569; letter-spacing: 0.2pt; text-transform: uppercase; }
.op-cast { font-size: 18pt; font-weight: 800; margin-top: 2pt; color: #0f172a; }
.op-cast-desc { font-size: 11pt; font-weight: 500; color: #475569; margin-top: 1pt; }
.op-section-title { font-size: 9pt; font-weight: 700; letter-spacing: 0.5pt; text-transform: uppercase; color: #334155; margin-bottom: 4pt; }
table.op-table { width: 100%; border-collapse: collapse; font-size: 10pt; table-layout: fixed; }
table.op-table th, table.op-table td { border: 0.5pt solid #94a3b8; padding: 4pt 6pt; vertical-align: top; }
table.op-table th { background: #f1f5f9; font-weight: 700; font-size: 8.5pt; letter-spacing: 0.4pt; text-transform: uppercase; color: #334155; text-align: left; }
table.op-table td.op-c-num { text-align: center; font-weight: 600; color: #64748b; width: 7%; }
table.op-table td.op-c-task { font-weight: 700; width: 26%; }
table.op-table td.op-c-hours { text-align: center; font-weight: 700; width: 12%; }
table.op-table td.op-c-notes { color: #1e293b; white-space: pre-wrap; word-wrap: break-word; }
table.op-table tbody tr:nth-child(even) td { background: #f8fafc; }
.op-total-row td { border-top: 1.5pt solid #000; background: #fff !important; font-size: 11pt; font-weight: 800; }
.op-total-row td.op-c-task { color: #0f172a; }
.op-total-row td.op-c-hours { background: #e2e8f0 !important; color: #0f172a; }
.op-empty { padding: 16pt; text-align: center; font-style: italic; color: #64748b; border: 0.5pt dashed #94a3b8; }
.op-foot { margin-top: 8pt; font-size: 8pt; color: #94a3b8; text-align: right; }
`;

function buildOptPrintPage(casting, phases, projectNumber, projectName) {
    const num = casting.casting_number || '';
    const castDesc = casting.description || '';
    const phaseName = currentPhasesEnabled
        ? (currentPhases.find(p => p.id === casting.phase_id)?.phase_name || '')
        : '';
    const projectLabel = [projectNumber, projectName].filter(Boolean).map(s => escapeHtml(s)).join(' — ');
    const castLabel = phaseName ? `${escapeHtml(phaseName)} &middot; Cast ${escapeHtml(num)}` : `Cast ${escapeHtml(num)}`;

    const total = phases.reduce((s, p) => s + (typeof p.hours === 'number' ? p.hours : 0), 0);

    const rows = phases.length === 0
        ? `<tr><td class="op-empty" colspan="4">No tasks recorded for this casting.</td></tr>`
        : phases.map((p, idx) => {
            const hours = (typeof p.hours === 'number') ? p.hours : 0;
            const desc = (p.description || '').trim();
            return `
                <tr>
                    <td class="op-c-num">${idx + 1}</td>
                    <td class="op-c-task">${escapeHtml(p.phase_name || '')}</td>
                    <td class="op-c-hours">${hours}</td>
                    <td class="op-c-notes">${escapeHtml(desc)}</td>
                </tr>
            `;
        }).join('');

    const totalRow = phases.length === 0 ? '' : `
        <tr class="op-total-row">
            <td class="op-c-num"></td>
            <td class="op-c-task">Total</td>
            <td class="op-c-hours">${total}</td>
            <td class="op-c-notes"></td>
        </tr>
    `;

    return `
        <section class="op-page">
            <header class="op-header">
                <div class="op-project">${projectLabel}</div>
                <div class="op-cast">${castLabel}</div>
                ${castDesc ? `<div class="op-cast-desc">${escapeHtml(castDesc)}</div>` : ''}
            </header>
            <div class="op-section-title">Optimizer Hours</div>
            <table class="op-table">
                <thead>
                    <tr>
                        <th class="op-c-num" style="width:7%;">#</th>
                        <th class="op-c-task" style="width:26%;">Task</th>
                        <th class="op-c-hours" style="width:12%;">Hours</th>
                        <th class="op-c-notes">Notes</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                    ${totalRow}
                </tbody>
            </table>
        </section>
    `;
}

function buildOptPrintHtml(castings, projectNumber, projectName) {
    const pages = castings.map(c => buildOptPrintPage(c, getPhasesFor(c.id), projectNumber, projectName)).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><title>Optimizer Hours — ${escapeHtml(projectNumber)}</title><style>${OPT_PRINT_CSS}</style></head><body>${pages}</body></html>`;
}

function handlePrintOptimizer(castingIds) {
    if (!Array.isArray(castingIds) || castingIds.length === 0) {
        showToast('Select at least one casting to print.', 'error');
        return;
    }
    const selected = castingIds
        .map(id => currentCastings.find(c => c.id === id))
        .filter(Boolean);
    if (selected.length === 0) {
        showToast('No matching castings found.', 'error');
        return;
    }

    const projectNumber = currentProjectNumber || '';
    const projectName = document.getElementById('pp-f-project_name')?.value || '';
    const html = buildOptPrintHtml(selected, projectNumber, projectName);

    const prior = document.getElementById('pp-opt-print-frame');
    if (prior) prior.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'pp-opt-print-frame';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(iframe);

    let cleaned = false;
    const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        setTimeout(() => { iframe.remove(); }, 500);
    };

    iframe.addEventListener('load', () => {
        try {
            const win = iframe.contentWindow;
            win.addEventListener('afterprint', cleanup);
            win.focus();
            win.print();
        } catch (err) {
            logger.error('[project-portal] print optimizer failed:', err);
            showToast('Print failed', 'error');
            cleanup();
        }
        setTimeout(cleanup, 60000);
    }, { once: true });

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
        showToast('Print failed — could not open frame', 'error');
        iframe.remove();
        return;
    }
    doc.open();
    doc.write(html);
    doc.close();
}

// ---------- Print ----------

const BATCH_PRINT_CSS = `
/* Letter portrait: printable area with our 0.3in × 0.4in @page margin = 7.7in × 10.4in (~554pt × 748pt).
   Goal: each ticket fits on a single page. Sizes are tuned so total content height + padding + border
   stays under 748pt, leaving the notes block to soak up the rest. */
@page { size: letter portrait; margin: 0.3in 0.4in; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; color:#000; font-size:11pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
/* Fixed pt height (NOT vh) so each ticket fills the printable area exactly without
   the cross-page rendering bugs that vh+flex caused. Letter portrait minus 0.3in
   margins = ~748pt printable; we use 745pt for a touch of safety against rounding. */
.bt-page {
    page-break-after: always;
    page-break-inside: avoid;
    break-after: page;
    break-inside: avoid;
    padding: 12pt 14pt;
    border: 6pt solid #ccc;
    height: 745pt;
    display: flex;
    flex-direction: column;
}
.bt-page:last-child { page-break-after: auto; break-after: auto; }
.bt-page.bt-face { border-color: #f97316; }
.bt-page.bt-firstBackUp { border-color: #3b82f6; }
.bt-page.bt-finalBackUp { border-color: #eab308; }
.batch-ticket {
    border: none !important;
    padding: 0 !important;
    box-shadow: none !important;
    max-width: none !important;
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
}
.bt-title { font-size: 18pt; font-weight: 900; color: #000; margin-bottom: 2pt; letter-spacing: 0.5pt; }
.bt-type-banner { font-size: 11pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5pt; margin-bottom: 6pt; }
.batch-ticket.bt-face .bt-type-banner { color: #f97316; }
.batch-ticket.bt-firstBackUp .bt-type-banner { color: #3b82f6; }
.batch-ticket.bt-finalBackUp .bt-type-banner { color: #ca8a04; }
.bt-header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin-bottom: 4pt; }
.bt-hrow { display: flex; align-items: baseline; padding: 2.5pt 0; border-bottom: 0.75pt solid #000; }
.bt-hrow:nth-child(odd) { padding-right: 12pt; }
.bt-hrow:nth-child(even) { padding-left: 12pt; }
.bt-hlabel { font-size: 9.5pt; font-weight: 700; min-width: 78pt; margin-right: 6pt; }
.bt-hval { flex: 1; font-size: 10.5pt; font-style: italic; min-height: 12pt; }
.bt-mix-box { border: 1.5pt solid #000; padding: 6pt 10pt; margin: 4pt 0; background: #fff; color: #000; }
.batch-ticket.bt-face .bt-mix-box { background: #f97316; border-color: #f97316; color: #fff; }
.batch-ticket.bt-firstBackUp .bt-mix-box { background: #3b82f6; border-color: #3b82f6; color: #fff; }
.batch-ticket.bt-finalBackUp .bt-mix-box { background: #eab308; border-color: #eab308; }
.bt-mix-label { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8pt; margin-bottom: 3pt; }
.bt-cb-row { display: flex; justify-content: space-between; align-items: center; padding: 2pt 0; gap: 8pt; flex-wrap: wrap; }
.bt-cb { display: flex; align-items: center; gap: 5pt; font-size: 10pt; }
.bt-cb-box { width: 14pt; height: 14pt; border: 1.5pt solid #000; display: inline-flex; align-items: center; justify-content: center; font-size: 11pt; font-weight: 900; background: #fff; color: #000; }
.bt-cb-box.checked::after { content: '\\2713'; }
.bt-section-label { font-weight: 700; font-size: 9.5pt; text-transform: uppercase; letter-spacing: 0.8pt; padding: 4pt 0 1.5pt; border-bottom: 1pt solid #000; margin-top: 3pt; }
.bt-table { width: 100%; border-collapse: collapse; margin-bottom: 2pt; }
.bt-table td { font-size: 10pt; padding: 2.5pt 4pt; border-bottom: 0.5pt solid #d4d4d4; vertical-align: baseline; }
.bt-table .bt-label { font-weight: 700; width: 22%; white-space: nowrap; }
.bt-table .bt-type { width: 40%; }
.bt-table .bt-qty-label { font-weight: 700; width: 8%; text-align: right; }
.bt-table .bt-qty { width: 18%; text-align: right; font-style: italic; }
.bt-table .bt-unit { width: 12%; padding-left: 4pt; }
.bt-notes-title { font-size: 9.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5pt; margin-top: 6pt; margin-bottom: 2pt; }
/* flex: 1 inside the fixed-height .bt-page lets this absorb leftover vertical space and fill the page. */
.bt-notes { border: 1pt solid #000; padding: 6pt 8pt; flex: 1 1 auto; min-height: 70pt; font-size: 10pt; line-height: 1.4; white-space: pre-wrap; }
`;

function handlePrintBatchTickets(castingId) {
    const ticket = batchTickets.get(castingId);
    if (!ticket) return;
    const casting = currentCastings.find(c => c.id === castingId);
    if (!casting) return;
    const activeLog = getActiveBatchColorLog(casting, ticket);
    const sandLbs = getColorLogSandLbs(activeLog);
    if (!sandLbs) {
        showToast('Add a sand entry to the color log first', 'error');
        return;
    }
    const plan = buildBatchPlan({
        totalCuFt: parseFloat(ticket.cuFt) || 0,
        faceSqFt: parseFloat(ticket.faceSqFt) || 0,
        cuFtPer250: parseFloat(ticket.cuFtPer250) || 4.28,
        castMethod: activeLog?.castMethod || 'sprayUp',
        colorLogSandLbs: sandLbs,
        manualOverrides: ticket.batchAssignments
    });
    if (!plan.batches.length) {
        showToast('Enter Total Cu Ft to generate tickets', 'error');
        return;
    }

    const projectName = document.getElementById('pp-f-project_name')?.value || '';
    const sampleName = activeLog?.name || '';
    const castMethod = activeLog?.castMethod || '';
    // Pigment reduction (final backup, and optionally first backup) — without
    // these, renderBatchTicketCard() falls back to its defaults and the
    // printed tickets show un-reduced pigment values even though the on-screen
    // preview applies the reduction.
    const pigReductionPct = parsePigReduction(ticket.pigReduction);
    const reduceFirstBackup = !!ticket.pigReduceFirstBackup;

    const pages = plan.batches.map(b => `
        <div class="bt-page bt-${b.type}">
            ${renderBatchTicketCard({
                colorLog: activeLog,
                batch: b,
                project: projectName,
                sampleName,
                castMethod,
                castNumber: casting.casting_number || '',
                castDate: casting.casting_date || '',
                batchedBy: ticket.batchedBy,
                notes: ticket.notes,
                pigReductionPct,
                reduceFirstBackup
            })}
        </div>
    `).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Batch Tickets — ${escapeHtml(projectName)} — Cast ${escapeHtml(casting.casting_number || '')}</title><style>${BATCH_PRINT_CSS}</style></head><body>${pages}<script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),200);});<\/script></body></html>`;

    const w = window.open('', '_blank');
    if (!w) {
        showToast('Pop-up blocked — allow pop-ups for printing', 'error');
        return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
}

// ---------- Color Log Print ----------

const COLOR_LOG_PRINT_CSS = `
@page { size: letter portrait; margin: 0.3in 0.4in; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; color:#000; font-size:11pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { page-break-after: always; }
.page:last-child { page-break-after: auto; }
h1 { font-size: 18pt; font-weight: 900; margin-bottom: 2pt; }
.subtitle { font-size: 9pt; margin-bottom: 10pt; }
.header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin-bottom: 6pt; }
.hrow { display: flex; align-items: baseline; padding: 3pt 0; border-bottom: 1px solid #000; }
.hrow .hlabel { font-weight: 700; font-size: 10pt; min-width: 110pt; }
.hrow .hval { flex:1; font-style: italic; font-size: 11pt; }
.checkbox-row { display: flex; gap: 24pt; align-items: center; padding: 6pt 0; }
.checkbox-row .cb { display: flex; align-items: center; gap: 4pt; font-size: 10pt; }
.cb-box { width: 14pt; height: 14pt; border: 1.5px solid #000; display: inline-flex; align-items: center; justify-content: center; font-size: 11pt; background: #fff; color: #000; }
.cb-box.checked::after { content: '\\2713'; font-weight: 900; color: #000; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
.col-left { padding-right: 12pt; }
.col-right { padding-left: 12pt; border-left: 1px solid #ccc; }
.sect-label { font-weight: 700; font-size: 10pt; padding: 6pt 0 3pt; border-bottom: 1px solid #000; margin-bottom: 2pt; }
.ing-row { display: flex; align-items: baseline; padding: 2pt 0; }
.ing-row .ilabel { font-size: 10pt; min-width: 90pt; }
.ing-row .ival { flex:1; font-style: italic; font-size: 10pt; border-bottom: 1px solid #000; margin-left: 4pt; min-height: 12pt; }
.notes-area { font-style: italic; font-size: 10pt; min-height: 40pt; padding: 2pt 0; white-space: pre-wrap; line-height: 1.5; }
.std-custom { display: flex; gap: 30pt; align-items: center; padding: 8pt 0; justify-content: center; }
.std-custom .tag { font-weight: 700; font-size: 11pt; letter-spacing: 1pt; }
.std-custom .tag-box { width: 28pt; height: 22pt; border: 1.5px solid #000; display: inline-flex; align-items: center; justify-content: center; margin-left: 6pt; font-size: 14pt; font-weight: 900; }
`;

function buildColorLogPrintHtml(log, projectNumber, projectDisplay) {
    const list = (key) => Array.isArray(log[key]) ? log[key] : [];
    const isStd = log.isStandard !== false;
    const cement = log.cementType || 'white';
    const cast = log.castMethod || 'sprayUp';
    const cb = (on) => `<span class="cb-box${on ? ' checked' : ''}"></span>`;

    const findIng = (sourceKey, targetName) => {
        const arr = list(sourceKey);
        return arr.find(b => (b?.name || '').trim().toLowerCase() === targetName.toLowerCase());
    };
    const baseIngVal = (name) => {
        const found = findIng('baseIngredients', name);
        if (!found || found.weight === '' || found.weight == null) return '';
        return `${found.weight} ${found.unit || 'lbs'}${found.note ? ' (' + found.note + ')' : ''}`;
    };
    const additiveVal = (name) => {
        const found = findIng('additives', name);
        if (!found || found.amount === '' || found.amount == null) return '';
        return `${found.amount} ${found.unit || 'oz'}${found.note ? ' ' + found.note : ''}`;
    };

    // Pigments (4 fixed slots)
    const slots = 4;
    const pigList = list('pigments');
    const pigRows = Array.from({ length: slots }, (_, i) => {
        const p = pigList[i];
        const pctTxt = p && p.pct !== '' && p.pct != null ? `${p.pct}%` : '';
        return `<div class="ing-row"><span class="ilabel">Pigment 0${i + 1}</span><span class="ival">${escapeHtml(p ? (p.name || '') : '')}</span><span style="font-size:10pt;min-width:30pt;text-align:right;">Qty:</span><span class="ival" style="max-width:50pt;text-align:right;">${escapeHtml(pctTxt)}</span></div>`;
    }).join('');

    // Fill Coat (4 fixed slots)
    const fillList = list('fillCoat');
    const fillRows = Array.from({ length: slots }, (_, i) => {
        const f = fillList[i];
        const pctTxt = f && f.pct !== '' && f.pct != null ? `${f.pct}%` : '';
        return `<div class="ing-row"><span class="ilabel">Fill Pigment 0${i + 1}</span><span class="ival">${escapeHtml(f ? (f.name || '') : '')}</span><span style="font-size:10pt;min-width:30pt;text-align:right;">Qty:</span><span class="ival" style="max-width:50pt;text-align:right;">${escapeHtml(pctTxt)}</span></div>`;
    }).join('');

    // Aggregates (4 fixed slots)
    const aggList = list('aggregates');
    const aggRows = Array.from({ length: slots }, (_, i) => {
        const a = aggList[i];
        const val = a ? `${a.name || ''}${a.amount ? ' ' + a.amount + ' ' + (a.unit || 'lbs') : ''}`.trim() : '';
        return `<div class="ing-row"><span class="ilabel">Other Agg 0${i + 1}</span><span class="ival">${escapeHtml(val)}</span></div>`;
    }).join('');

    // Additives — 3 standard slots (ADVA / Eclipse / Fibers) plus any custom ones the user added
    const STD_ADDITIVES = ['ADVA', 'Eclipse', 'Fibers'];
    const additiveRows = (() => {
        const rows = STD_ADDITIVES.map((name) =>
            `<div class="ing-row"><span class="ilabel">${name}</span><span class="ival">${escapeHtml(additiveVal(name))}</span></div>`
        );
        const extras = list('additives').filter((a) => {
            const n = (a?.name || '').trim().toLowerCase();
            return n && !STD_ADDITIVES.some((s) => s.toLowerCase() === n);
        });
        for (const a of extras) {
            const hasAmt = a.amount !== '' && a.amount != null;
            const val = hasAmt ? `${a.amount} ${a.unit || 'oz'}${a.note ? ' ' + a.note : ''}` : '';
            rows.push(`<div class="ing-row"><span class="ilabel">${escapeHtml(a.name)}</span><span class="ival">${escapeHtml(val)}</span></div>`);
        }
        return rows.join('');
    })();

    // Grout (3 slots: Antique White / Bright White / Other — fall back to user's row name)
    const groutNames = ['Antique White', 'Bright White', 'Other'];
    const groutList = list('groutType');
    const groutRows = Array.from({ length: 3 }, (_, i) => {
        // Prefer matching by name; if no match, fall back to positional
        let g = groutList.find(x => (x?.name || '').trim().toLowerCase() === groutNames[i].toLowerCase());
        if (!g) g = groutList[i];
        const label = g?.name || groutNames[i];
        const ratioTxt = g && g.ratio !== '' && g.ratio != null ? `${g.ratio}%` : '';
        return `<div class="ing-row"><span class="ilabel">${escapeHtml(label)}</span><span class="ival">${escapeHtml(ratioTxt)}</span></div>`;
    }).join('');

    return `
<div class="page">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
    <div><h1>COLOR LOG</h1><div class="subtitle">Concreteworks East - Rev. 2025</div></div>
    <div style="text-align:right;">
      <div class="hrow" style="border:none;"><span class="hlabel">Sample #:</span><span class="hval" style="font-size:14pt;font-weight:700;">${escapeHtml(log.name || '')}</span></div>
      <div style="font-size:8pt;color:#666;">* new standard master</div>
    </div>
  </div>

  <div class="header-grid">
    <div class="hrow"><span class="hlabel">Tempature:</span><span class="hval">${escapeHtml(log.temperature || '')}</span></div>
    <div class="hrow"><span class="hlabel">Project:</span><span class="hval">${escapeHtml(projectDisplay || log.project || projectNumber || '')}</span></div>
    <div class="hrow"><span class="hlabel">Date:</span><span class="hval">${escapeHtml(log.date || '')}</span></div>
    <div class="hrow"><span class="hlabel">Made By:</span><span class="hval">${escapeHtml(log.madeBy || '')}</span></div>
  </div>

  <div class="std-custom">
    <div><span class="tag">STANDARD</span><span class="tag-box">${isStd ? '&#10003;' : ''}</span></div>
    <div><span class="tag">CUSTOM</span><span class="tag-box">${!isStd ? '&#10003;' : ''}</span></div>
  </div>

  <div class="checkbox-row" style="border-bottom:1px solid #000;padding-bottom:6pt;">
    <span style="font-weight:700;font-size:10pt;">Cement Type:</span>
    <span class="cb">${cb(cement === 'white')} White Portland</span>
    <span class="cb">${cb(cement === 'gray')} Gray Portland</span>
    <span class="cb">${cb(cement === 'other')} Other</span>
  </div>

  <div class="two-col" style="margin:4pt 0;">
    <div class="col-left">
      <div class="ing-row"><span class="ilabel">Sand</span><span class="ival">${escapeHtml(baseIngVal('Sand'))}</span></div>
      <div class="ing-row"><span class="ilabel">Portland</span><span class="ival">${escapeHtml(baseIngVal('Portland'))}</span></div>
      <div class="ing-row"><span class="ilabel">Pozzotive</span><span class="ival">${escapeHtml(baseIngVal('Pozzotive'))}</span></div>
      <div class="ing-row"><span class="ilabel">Forton</span><span class="ival">${escapeHtml(baseIngVal('Forton'))}</span></div>
      <div class="ing-row"><span class="ilabel">Water</span><span class="ival">${escapeHtml(baseIngVal('Water'))}</span></div>
    </div>
    <div class="col-right">
      ${additiveRows}
      <div class="ing-row" style="margin-top:4pt;border-bottom:none;"><span class="ilabel" style="font-weight:700;">Notes</span></div>
      <div style="font-style:italic;font-size:10pt;min-height:20pt;"></div>
    </div>
  </div>

  <div class="checkbox-row" style="border-top:1px solid #000;border-bottom:1px solid #000;padding:6pt 0;">
    <span style="font-weight:700;font-size:10pt;">Cast Method:</span>
    <span class="cb">${cb(cast === 'sprayUp')} Spray Up</span>
    <span class="cb">${cb(cast === 'directCast')} Direct Cast</span>
    <span class="cb">${cb(cast === 'other')} Other</span>
  </div>

  <div class="two-col" style="margin:4pt 0;">
    <div class="col-left">
      <div class="sect-label">Aggregrates:</div>
      ${aggRows}
    </div>
    <div class="col-right">
      <div class="sect-label">Pigments:</div>
      ${pigRows}
    </div>
  </div>

  <div class="two-col" style="margin:4pt 0;">
    <div class="col-left">
      <div class="sect-label">Grout Type:</div>
      ${groutRows}
    </div>
    <div class="col-right">
      <div class="sect-label">Fill Coat:</div>
      ${fillRows}
    </div>
  </div>

  <div class="two-col" style="margin-top:8pt;border-top:1px solid #000;padding-top:4pt;">
    <div class="col-left">
      <div class="sect-label">Finishing Notes:</div>
      <div class="notes-area">${escapeHtml(log.finishingNotes || '')}</div>
    </div>
    <div class="col-right">
      <div class="sect-label">Sealing Notes:</div>
      <div class="notes-area">${escapeHtml(log.sealingNotes || '')}</div>
    </div>
  </div>
</div>
`;
}

function handlePrintColorLog() {
    if (!currentColorLog) {
        showToast('No color log to print', 'error');
        return;
    }
    const log = currentColorLog;
    const projectNumber = currentProjectNumber || '';
    const projectName = document.getElementById('pp-f-project_name')?.value || '';
    const titleParts = [
        'Color Log',
        log.name || '',
        projectName || projectNumber
    ].filter(Boolean).join(' — ');

    const body = buildColorLogPrintHtml(log, projectNumber, getCurrentProjectDisplay());
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(titleParts)}</title><style>${COLOR_LOG_PRINT_CSS}</style></head><body>${body}<script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),200);});<\/script></body></html>`;

    const w = window.open('', '_blank');
    if (!w) {
        showToast('Pop-up blocked — allow pop-ups for printing', 'error');
        return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
}

// ---------- Bootstrap ----------

async function init() {
    wireEvents();
    const urlProject = getProjectFromUrl();
    const urlTab     = getTabFromUrl();
    const urlView    = getViewFromUrl();

    // Recent Memos cross-project view takes precedence if explicitly requested.
    if (urlView === 'recent-memos' && urlProject === null) {
        loadAllData().catch(err => logger.warn(err));
        await showRecentMemosView();
        return;
    }

    if (urlProject !== null) {
        // Form view. Set the initial tab BEFORE showFormView so its
        // internal setActiveTab + activate-tab calls land on the right panel.
        if (urlTab && VALID_TABS.has(urlTab)) currentTab = urlTab;
        // List data still loads in the background for completeness.
        loadAllData().catch(err => logger.warn(err));
        await showFormView(urlProject);
        return;
    }

    await showListView();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
