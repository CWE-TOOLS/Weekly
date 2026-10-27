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
    setProjectShipQtyMode,
    setProjectSlumpTargets
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
    fetchForProject as fetchTaskDescriptionsForProject,
    upsertOne as upsertTaskDescription,
    isStagingTaskHoursMigrationPending,
    deleteOne as deleteTaskDescription
} from '../../services/task-descriptions-service.js';
import {
    loadAllComponentsForProject,
    createComponentsBulk,
    deleteAllComponentsForCasting,
    loadTrackingStateForCasting,
    applyTrackingStateForCasting,
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
    loadCastingInventory,
    createInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    setInventoryOrder
} from '../../services/inventory-service.js?v=20261020-2';
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
    updatePreset as updateColorLogPreset,
    deletePreset as deleteColorLogPreset
} from '../../services/color-log-service.js';
import { enableMultiColorForProject } from '../../services/multi-color-service.js';
import {
    loadBatchTicketsForCastings,
    saveBatchTicketForCasting,
    deleteBatchTicket,
    emptyForm as emptyBatchTicketForm
} from '../../services/batch-ticket-service.js';
import {
    buildBatchPlan,
    getColorLogSandLbs,
    roundSig,
    FROM_LBS
} from '../../utils/batch-calc.js';
import { getSpecialBatching } from '../../config/special-batching.js?v=20261026-2';
import { fetchAllTasks } from '../../services/data-service.js';
import { loadActualHoursForProject } from '../../services/actual-hours-service.js';
import { parseDate } from '../../utils/date-utils.js';
import {
    DEPARTMENT_ORDER,
    DEPARTMENT_COLORS,
    normalizeDepartment,
    normalizeDepartmentClass
} from '../../config/department-config.js';
import {
    loadClassroomTasks,
    createClassroomTask,
    updateClassroomTask,
    deleteClassroomTask,
    setClassroomTasksOrder
} from '../../services/classroom-tasks-service.js';
import { renderCastingLayout } from './casting-layout.js?v=20261023-2';
import { attachLayoutDrag } from './casting-layout-drag.js?v=20260701-01';
import { activateJigListTab } from './jig-list.js?v=20261026-1';
import { CI_DEPENDENT, MS, CI_STATE, milestonesApply, AUTO_MILESTONES, PORTAL_MANUAL_MILESTONES, APPROVALS_TAB_ITEMS } from '../../config/milestones-config.js?v=20261020-2';
import { loadMilestonesForProject, saveMilestone, isMilestonesMigrationPending, loadLayoutConditions, LAYOUT_CONDITION_PREFIX, layoutConditionNote, parseLayoutCondition, sideWords } from '../../services/milestones-service.js';
import { loadJigListsForProject as loadJigListsForScrim, scrimForInventory } from '../../services/jig-list-service.js';
import { loadReadyFlags, setReadyFlag, loadSettingRows, setSettingRow } from '../../services/schedule-service.js?v=20261027-1';
import { tasksForDepartment, teamOfDepartment, taskForPhase, STAGING_NAME_OF_TEAM, REVENUE_PER_HOUR } from '../../config/scheduler-config.js?v=20261023-2';
import {
    loadLayoutPositions,
    snapshotLayout,
    clearLayoutPositions
} from '../../services/casting-layout-service.js';
import { registerRefreshHandler, isPortalChange, isOwnSignal, signalInfo } from '../../services/supabase-service.js';

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
const TRACKING_PHASES = ['MILL', 'FO', 'POST FO QA', 'CAST', 'DEMOLD', 'FINISH', 'EPOXY', 'SEAL', 'STRIPS', 'DRILL', 'DRY FIT', 'CRATE', 'FINAL', 'LOAD'];   // POST FO QA added 2026-10-13
let currentTrackingPhases = new Set(TRACKING_PHASES); // default: all phases tracked
// Tracks which project the phases above belong to, so switching projects resets defaults.
let trackingPhasesProject = null;
let currentCastInvExpanded = new Set();    // castingIds whose inventory sections are open (Castings tab)
let castInvExpandedProject = null;         // tracks which project the expanded-set defaults have been seeded for
let currentCastingInventory = new Map();   // castingId -> Array<inventory row>
let currentCastingInventoryLoadedFor = null; // project_number we last loaded inventory for
// Casting Inventory "what did I just change" marks (2026-10-13). While someone refines values on the
// Castings tab, every field whose EXISTING value they changed gets a red outline and can be undone
// (undo arrow / Ctrl+Z, one step per change). Kept only in memory for this screen: leaving the tab,
// switching project or reloading accepts everything. Key: `${inventoryRowId}|${field}`.
const invEdits = new Map();   // -> [{ value, label }] previous values, oldest first
const invEditKey = (itemId, field) => `${itemId}|${field}`;
function invEditedCls(itemId, field) { return invEdits.has(invEditKey(itemId, field)) ? ' pp-inv-edited' : ''; }
function invEditedTip(itemId, field) {
    const stack = invEdits.get(invEditKey(itemId, field));
    if (!stack || !stack.length) return '';
    const last = stack[stack.length - 1];
    return `Changed - was ${String(last.label).trim() === '' ? '(blank)' : last.label}. Undo: the red arrow or Ctrl+Z.`;
}
function invEditedTitle(itemId, field) {
    const tip = invEditedTip(itemId, field);
    return tip ? ` title="${escapeAttr(tip)}"` : '';
}
const INV_UNDO_BTN = (field) => `<button type="button" class="pp-inv-undo" data-action="inv-undo" data-undo-field="${escapeAttr(field)}" title="Undo this change" aria-label="Undo this change">&#8630;</button>`;
/** Grid cell wrapper so a marked field can show its undo arrow without disturbing the row's columns. */
function invCell(itemId, field, inputHtml) {
    const undo = invEdits.has(invEditKey(itemId, field)) ? INV_UNDO_BTN(field) : '';
    return `<span class="pp-inv-cell">${inputHtml}${undo}</span>`;
}
/** Two field values the same? Numbers compare as numbers ("1.020" = "1.02"), everything else as trimmed text. */
function invSameValue(a, b) {
    const sa = String(a ?? '').trim(), sb = String(b ?? '').trim();
    if (sa === sb) return true;
    const na = parseFloat(sa), nb = parseFloat(sb);
    return sa !== '' && sb !== '' && Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}
/** A field lost focus (or a select changed): if it HAD a value and now has a different one, remember the old one and mark it. */
function invRecordEdit(el) {
    if (!el || !el.matches || !el.matches('input[data-field], select[data-field]') || el.dataset.before === undefined) return;
    const row = el.closest('.pp-inv-row[data-inventory-id]');
    if (!row) return;
    const before = el.dataset.before, beforeLabel = el.dataset.beforeLabel ?? before;
    delete el.dataset.before; delete el.dataset.beforeLabel;
    if (String(before).trim() === '' || invSameValue(before, el.value)) return;   // first entry, or nothing changed
    const key = invEditKey(row.getAttribute('data-inventory-id'), el.dataset.field);
    const stack = invEdits.get(key) || [];
    stack.push({ value: before, label: beforeLabel });
    invEdits.set(key, stack);
    invRefreshMark(el);
}
function invRefreshMark(el) {
    const row = el.closest('.pp-inv-row[data-inventory-id]');
    if (!row) return;
    const itemId = row.getAttribute('data-inventory-id'), field = el.dataset.field;
    const marked = invEdits.has(invEditKey(itemId, field));
    el.classList.toggle('pp-inv-edited', marked);
    const tip = invEditedTip(itemId, field);
    if (tip) el.setAttribute('title', tip); else el.removeAttribute('title');
    const cell = el.closest('.pp-inv-cell');
    if (cell) {
        const btn = cell.querySelector('.pp-inv-undo');
        if (marked && !btn) cell.insertAdjacentHTML('beforeend', INV_UNDO_BTN(field));
        else if (!marked && btn) btn.remove();
    }
    updateInvFloat();
}
/** Put the previous value back (one step), save it, and drop the mark when nothing is left to undo. */
function invUndo(el) {
    const row = el.closest('.pp-inv-row[data-inventory-id]');
    if (!row) return false;
    const itemId = row.getAttribute('data-inventory-id'), castingId = row.getAttribute('data-casting-id');
    const key = invEditKey(itemId, el.dataset.field);
    const stack = invEdits.get(key);
    if (!stack || !stack.length) return false;
    const prev = stack.pop();
    if (!stack.length) invEdits.delete(key);
    el.value = prev.value;
    delete el.dataset.before; delete el.dataset.beforeLabel;
    invRefreshMark(el);
    const t = inventorySaveTimers.get(itemId);
    if (t) clearTimeout(t);
    inventorySaveTimers.delete(itemId);
    saveInventoryItem(itemId, castingId);
    return true;
}

// ---- Leaving the Castings tab with marks pending: accept them, put every old value back, or look first.
const INV_FIELD_LABELS = { quantity: 'QTY', extras: 'EXTRAS', type: 'TYPE', width: 'WIDTH', length: 'LENGTH', color_log_id: 'COLOR', cu_ft: 'CU FT', ff_sq_ft: 'FF SQ FT' };
let invReviewThen = null;   // what to do once the user has accepted or rejected (e.g. finish the tab switch)

/** Every pending change: where it is, what it was first, what it is now. */
function invChangeList() {
    const out = [];
    for (const [key, stack] of invEdits) {
        const [itemId, field] = key.split('|');
        const row = document.querySelector(`.pp-inv-row[data-inventory-id="${itemId}"]`);
        const el = row?.querySelector(`[data-field="${field}"]`);
        const castingId = row?.getAttribute('data-casting-id');
        const casting = currentCastings.find(c => c.id === castingId);
        const item = getInventoryFor(castingId).find(i => i.id === itemId);
        const now = el ? (el.tagName === 'SELECT' ? (el.selectedOptions[0]?.text || '') : el.value) : '';
        out.push({ itemId, field, el, cast: casting?.casting_number || '?', comp: item?.type || '', label: INV_FIELD_LABELS[field] || field, was: stack[0].label, now, first: stack[0] });
    }
    out.sort((a, b) => String(a.cast).localeCompare(String(b.cast), undefined, { numeric: true }) || String(a.comp).localeCompare(String(b.comp), undefined, { numeric: true }));
    return out;
}
function invAcceptAll() {
    invEdits.clear();
    document.querySelectorAll('.pp-inv-edited').forEach(el => invRefreshMark(el));
    updateInvFloat();
}
/** Put every changed field back to the value it had before the first change, and save. */
function invRejectAll() {
    for (const ch of invChangeList()) {
        if (!ch.el) continue;
        ch.el.value = ch.first.value;
        delete ch.el.dataset.before; delete ch.el.dataset.beforeLabel;
        const row = ch.el.closest('.pp-inv-row[data-inventory-id]');
        const itemId = row.getAttribute('data-inventory-id');
        const t = inventorySaveTimers.get(itemId);
        if (t) clearTimeout(t);
        inventorySaveTimers.delete(itemId);
        saveInventoryItem(itemId, row.getAttribute('data-casting-id'));
    }
    invEdits.clear();
    document.querySelectorAll('.pp-inv-edited').forEach(el => invRefreshMark(el));
    updateInvFloat();
}
function invReviewListHtml() {
    const rows = invChangeList().map(ch => `<tr><td>${escapeHtml(String(ch.cast))}</td><td>${escapeHtml(ch.comp)}</td><td>${escapeHtml(ch.label)}</td><td class="pp-inv-review-was">${escapeHtml(String(ch.was).trim() === '' ? '(blank)' : ch.was)}</td><td class="pp-inv-review-now">${escapeHtml(String(ch.now).trim() === '' ? '(blank)' : ch.now)}</td></tr>`).join('');
    return `<table class="pp-inv-review-table"><thead><tr><th>Cast</th><th>Component</th><th>Field</th><th>Was</th><th>Now</th></tr></thead><tbody>${rows}</tbody></table>`;
}
// ---- Floating "changes to review" box on the Castings tab: there as soon as a field is marked, stays
// put while scrolling, so the marks can be accepted or rejected without leaving the tab.
let invFloatEl = null;
function updateInvFloat() {
    const n = invEdits.size;
    const show = n > 0 && currentTab === 'castings';
    if (!show) { if (invFloatEl) invFloatEl.hidden = true; return; }
    if (!invFloatEl) {
        invFloatEl = document.createElement('div');
        invFloatEl.id = 'pp-inv-float';
        invFloatEl.className = 'pp-bt-stale pp-bt-stale-float pp-inv-float';
        invFloatEl.setAttribute('role', 'status');
        document.body.appendChild(invFloatEl);
        invFloatEl.addEventListener('click', (e) => {
            const act = e.target.closest('[data-inv-float]')?.dataset.invFloat;
            if (act === 'accept') invAcceptAll();
            else if (act === 'reject') invRejectAll();
            else if (act === 'view') openInvReviewModal(null, { showList: true });
        });
    }
    invFloatEl.innerHTML = `<div class="pp-bt-stale-float-title">&#9888; ${n} CHANGE${n === 1 ? '' : 'S'} TO REVIEW</div>
        <div class="pp-bt-stale-float-text">Casting Inventory values you changed on this screen are outlined red. They are saved; accept them when you are done, or put the old values back.</div>
        <div class="pp-inv-float-actions">
            <button type="button" class="pp-inv-float-btn pp-inv-float-accept" data-inv-float="accept">Accept all</button>
            <button type="button" class="pp-inv-float-btn pp-inv-float-reject" data-inv-float="reject">Reject all</button>
            <button type="button" class="pp-bt-stale-link" data-inv-float="view">View changes</button>
        </div>`;
    invFloatEl.style.top = Math.round(headerBottom() + 12) + 'px';
    invFloatEl.hidden = false;
}
window.addEventListener('resize', updateInvFloat, { passive: true });

/** Ask what to do with the pending marks; `then` runs after Accept or Reject (not after Cancel). */
function openInvReviewModal(then, opts = {}) {
    invReviewThen = then || null;
    let m = document.getElementById('pp-inv-review-modal');
    if (!m) {
        document.body.insertAdjacentHTML('beforeend', `
        <div id="pp-inv-review-modal" class="pp-modal-backdrop" hidden>
            <div class="pp-modal" role="dialog" aria-modal="true" aria-labelledby="pp-inv-review-title">
                <div class="pp-modal-header">
                    <h2 id="pp-inv-review-title">Casting Inventory changes</h2>
                    <button type="button" class="pp-modal-close" data-inv-review="cancel" aria-label="Close">&times;</button>
                </div>
                <div class="pp-modal-body">
                    <p class="pp-modal-hint" id="pp-inv-review-hint"></p>
                    <div id="pp-inv-review-list" class="pp-inv-review-list" hidden></div>
                    <div class="pp-modal-actions">
                        <button type="button" class="pp-secondary-btn" data-inv-review="view">View changes</button>
                        <button type="button" class="pp-secondary-btn pp-inv-review-reject" data-inv-review="reject">Reject all changes</button>
                        <button type="button" class="pp-primary-btn" data-inv-review="accept">Accept all changes</button>
                    </div>
                </div>
            </div>
        </div>`);
        m = document.getElementById('pp-inv-review-modal');
        m.addEventListener('click', (e) => {
            const act = e.target === m ? 'cancel' : e.target.closest('[data-inv-review]')?.dataset.invReview;
            if (!act) return;
            if (act === 'view') {
                const list = document.getElementById('pp-inv-review-list');
                list.hidden = !list.hidden;
                if (!list.hidden) list.innerHTML = invReviewListHtml();
                e.target.closest('[data-inv-review]').textContent = list.hidden ? 'View changes' : 'Hide changes';
                return;
            }
            if (act === 'accept') invAcceptAll();
            if (act === 'reject') invRejectAll();
            m.hidden = true;
            const then = invReviewThen;
            invReviewThen = null;
            if (act !== 'cancel' && then) then();
        });
    }
    const n = invEdits.size;
    document.getElementById('pp-inv-review-hint').textContent = `You changed ${n} value${n === 1 ? '' : 's'} on the Casting Inventory. Accept them, or put the old values back. Cancel stays on this tab.`;
    const list = document.getElementById('pp-inv-review-list');
    list.hidden = !opts.showList; list.innerHTML = opts.showList ? invReviewListHtml() : '';
    m.querySelector('[data-inv-review="view"]').textContent = opts.showList ? 'Hide changes' : 'View changes';
    m.hidden = false;
}
// Refresh / close with marks pending: the browser's own "leave page?" prompt (its wording can't be changed).
window.addEventListener('beforeunload', (e) => {
    if (invEdits.size) { e.preventDefault(); e.returnValue = ''; }
});
let inventorySaveTimers = new Map();       // itemId -> debounce handle
let copiedComponents = null;               // Array<{type,width,length,color,sealer,quantity,extras,cu_ft,ff_sq_ft}> from a copy action
const invSelected = new Set();             // inventory row ids ticked for "Copy / Cut selected" (2026-10-13); only for this screen
function invSelectedIn(castingId) { return getInventoryFor(castingId).filter(it => invSelected.has(it.id)); }
/** Redraw just the Copy / Cut buttons in a casting's title block after ticks change. */
function invRefreshTitleButtons(card, castingId) {
    const actions = card.querySelector('.pp-cast-card-actions');
    if (!actions) return;
    const nSel = invSelectedIn(castingId).length;
    const copy = actions.querySelector('[data-action="copy-components"]');
    if (copy) {
        copy.textContent = nSel ? `Copy ${nSel} selected` : 'Copy';
        copy.title = nSel ? `Copy the ${nSel} ticked component${nSel === 1 ? '' : 's'}` : 'Copy all components on this casting';
    }
    let cut = actions.querySelector('[data-action="cut-selected"]');
    if (nSel) {
        if (!cut) { copy?.insertAdjacentHTML('afterend', '<button class="pp-row-btn pp-row-btn-word pp-row-btn-cut" data-action="cut-selected" type="button"></button>'); cut = actions.querySelector('[data-action="cut-selected"]'); }
        cut.textContent = `Cut ${nSel} selected`;
        cut.title = `Cut the ${nSel} ticked component${nSel === 1 ? '' : 's'} — paste them into another casting`;
    } else if (cut) cut.remove();
}
function inventoryClipItem(it) {
    return { type: it.type, width: it.width, length: it.length, color: it.color, sealer: it.sealer,
             quantity: it.quantity, extras: it.extras, cu_ft: it.cu_ft, ff_sq_ft: it.ff_sq_ft };
}
let currentColorLog = null;                // form-shaped record (id null = unsaved) — currently active log when multi-color on
let currentColorLogs = [];                 // all non-preset color logs for this project (>=1 when project has any)
let currentColorLogId = null;              // id of the active log being edited in the Color Log tab
let currentMultiColorEnabled = false;      // mirrors projects.multi_color_enabled for the active project
const SLUMP_TARGET_DEFAULTS = { face: 6, firstBackUp: 5, finalBackUp: 5 }; // starting slump targets (in), by batch type
let currentSlumpTargets = { ...SLUMP_TARGET_DEFAULTS }; // project-wide slump targets (in), by batch type
let slumpTargetSaveTimer = null;           // debounce handle for persisting slump targets
let colorLogPresets = [];                  // cached preset rows
let colorLogSaveTimer = null;              // debounce timer
let colorLogLoadedFor = null;              // project_number we last loaded for
let currentJobMemos = [];                  // form-shaped memo records, sorted newest-first
let jobMemosLoadedFor = null;              // project_number we last loaded memos for
let jobMemoSaveTimers = new Map();         // memoId -> debounce handle (per-field edits)
let batchTickets = new Map();              // castingId -> Array<form-shaped batch ticket record> (saved + unsaved color tickets)
let batchTicketsLoadedFor = null;          // project_number we last bulk-loaded for
let currentBatchCastingId = null;          // active casting in batch tickets tab
let currentBatchColorSel = new Map();      // castingId -> active color ticket key (colorLogId, or '' for the NULL-color one)
let batchTicketSaveTimers = new Map();     // ticket object -> { castingId, timer } debounce handle
let projectInfoSaveTimer = null;           // debounce timer for project info form
let castingSaveTimers = new Map();         // castingId -> debounce handle for castings tab
let optimizerPhaseSaveTimers = new Map();  // phaseId -> debounce handle (hours / rename)
let optimizerDescSaveTimers = new Map();   // phaseId -> debounce handle (description)
let currentOptDescExpanded = new Set();    // phaseIds whose description editor is open
// --- Staging tab: per-casting description grid (department × day) ---
// Pre-fills every casting column with the standard production departments so task
// descriptions can be authored before the Google Sheet schedules them. Names come
// from DEPARTMENT_ORDER so they match the weekly board's plain department names.
const STG_DEPARTMENT_SEQUENCE = ['CNC', 'Parts', 'Form Out', 'Cast', 'Demold', 'Finish', 'Seal'];          // from Nov 2026 the Optimizer has CNC + Parts instead of Mill
const STG_DEPARTMENT_SEQUENCE_MILL = ['Mill', 'Form Out', 'Cast', 'Demold', 'Finish', 'Seal'];            // castings scheduled or noted under Mill keep their Mill column
let currentStagingCastingId = null;          // active casting column in the Staging tab
let currentStagingDescriptions = new Map();  // `${castingNumber}|${dept}|${day}` -> {description, castingSide}
let currentStagingScaffold = new Map();      // castingNumber -> Array<{ department, days:number }>

// ---- Releasability milestones (2026-10-15): the board's AUTO columns, driven from here ----
let msByCasting = new Map();          // castingId -> Map(milestone -> row)
let msPendingStamp = null;            // { ids, milestone } set by a print handler, consumed when the print fires
let msJigCastingId = null;            // the Jig List tab's active casting (the module tells us)
let msFloatEl = null;
let msLayoutConditions = null;        // special layout conditions used anywhere (null = not loaded yet)
let stagingGridSaveTimers = new Map();       // `${castingNumber}|${dept}|${day}` -> debounce handle
let copiedStaging = null;                    // { fromCastNum, scaffold:[{department,days}], descById:{`${dept}|${day}`:desc} } from a copy action

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
    'info', 'job-memos', 'castings', 'optimizer', 'tracking', 'approvals',
    'casting-layout', 'jig-list', 'shipping', 'color-log', 'batch-tickets', 'cr-notes',
    'actual-labor'
]);

async function showListView() {
    if (currentTab === 'castings' && invEdits.size) {
        openInvReviewModal(() => showListView());
        return;
    }
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
    window.__portalProject = null;
    document.getElementById('pp-list-view').hidden = false;
    document.getElementById('pp-form-view').hidden = true;
    updateFloats();   // hides the batching floats (castings box, out-of-date warning) and the Releasability bar
    const memosView = document.getElementById('pp-memos-view');
    if (memosView) memosView.hidden = true;
    const scViewLV = document.getElementById('pp-standards-view');
    if (scViewLV) scViewLV.hidden = true;
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
    currentBatchColorSel.clear();
    jobMemosLoadedFor = null;
    currentJobMemos = [];
    await refreshList();
}

async function showFormView(projectNumber, draftOverrides = null) {
    currentProjectNumber = projectNumber || null;
    window.__portalProject = currentProjectNumber;
    document.getElementById('pp-list-view').hidden = true;
    document.getElementById('pp-form-view').hidden = false;
    requestAnimationFrame(updateMsFloat);
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
    currentBatchColorSel.clear();
    for (const p of batchTicketSaveTimers.values()) clearTimeout(p.timer);
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
    currentSlumpTargets = {
        face: clampSlumpTarget(project.target_slump_face, SLUMP_TARGET_DEFAULTS.face),
        firstBackUp: clampSlumpTarget(project.target_slump_first_backup, SLUMP_TARGET_DEFAULTS.firstBackUp),
        finalBackUp: clampSlumpTarget(project.target_slump_final_backup, SLUMP_TARGET_DEFAULTS.finalBackUp)
    };
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
    if (currentTab === 'staging')      activateStagingTab();
    if (currentTab === 'approvals')    activateApprovalsTab();
    if (currentTab === 'tracking')     activateTrackingTab();
    if (currentTab === 'casting-layout') activateCastingLayoutTab();
    if (currentTab === 'jig-list')     activateJigListTabWithCtx();
    if (currentTab === 'shipping')     activateShippingTab();
    if (currentTab === 'actual-labor') activateActualLaborTab();
}

// Bridge to the extracted Jig List module: hand it the current project context
// plus the phase-scoped castings (same source the Batch Tickets tab uses).
function activateJigListTabWithCtx() {
    activateJigListTab({
        projectNumber: currentProjectNumber,
        projectName: document.getElementById('pp-f-project_name')?.value || '',
        castings: getCastingsForActivePhase()
    });
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
    if (currentTab === 'castings' && tab !== 'castings' && invEdits.size) {
        openInvReviewModal(() => setActiveTab(tab));   // decide first; the switch continues after Accept / Reject
        return;
    }
    if (currentTab === 'tracking' && tab !== 'tracking' && selectedComponentIds.size > 0) {
        selectedComponentIds.clear();
        const bar = document.getElementById('pp-track-bulk-bar');
        if (bar) bar.hidden = true;
    }
    if (currentTab === 'tracking' && tab !== 'tracking') lastTrackSelectionAnchor = null;
    currentTab = tab;
    updateFloats();   // the floating out-of-date warning only belongs to the Batch Tickets tab
    requestAnimationFrame(updateMsFloat);   // again once the new tab has painted (the Releasability bar sizes to it)
    if (tab === 'cr-notes') renderClassroomMs();
    if (tab !== 'castings' && invEdits.size) invEdits.clear();   // leaving the Castings tab accepts every inventory edit
    if (tab !== 'castings') invSelected.clear();
    updateInvFloat();
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
        // Job Memos has no print pipeline yet; Casting Layout and Jig List have their own buttons.
        if (tab === 'tracking' || tab === 'shipping' || tab === 'job-memos' || tab === 'casting-layout' || tab === 'jig-list' || tab === 'actual-labor' || tab === 'staging' || tab === 'approvals') {
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
    // Print Label (folder labels) lives beside Print Cover — Info tab only.
    const printLabelBtn = document.getElementById('pp-print-label-btn');
    if (printLabelBtn) printLabelBtn.hidden = (tab !== 'info');
    // Print Shop Folder Cover (QC sticker cover) — Info tab only.
    const printShopFolderBtn = document.getElementById('pp-print-shop-folder-btn');
    if (printShopFolderBtn) printShopFolderBtn.hidden = (tab !== 'info');

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
    // Components are needed alongside inventory so the Import Remakes button
    // can detect rejected panels from other castings on first paint. Without
    // this load, countImportableRemakes reads an empty map and shows (0) until
    // the user visits the Tracking tab.
    await Promise.all([
        loadAllInventoryForCurrentProject(),
        loadAllComponentsForCurrentProject()
    ]);
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
        // Summary readouts start collapsed on every project.
        castSumExpanded = new Set();
    }
    await loadMilestones();
    renderCastings();
}

// Castings with more than this many inventory rows default to collapsed when
// the user first lands on the Castings tab for a project.
const CAST_INV_AUTO_EXPAND_LIMIT = 10;

async function loadAllInventoryForCurrentProject() {
    invEdits.clear();   // fresh data: nothing to undo
    invSelected.clear();
    updateInvFloat();
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

// Which summary cards are expanded ('total' / 'rejected'). Collapsed by
// default; survives re-renders within the session.
let castSumExpanded = new Set();

// Project-wide readout above the casting list: total panels entered in
// inventory (quantity + extras), and panels flagged Rejected on Tracking.
function updateCastingsSummary() {
    const wrap = document.getElementById('pp-castings-summary');
    if (!wrap) return;
    if (!currentProjectNumber || currentCastings.length === 0) {
        wrap.hidden = true;
        return;
    }
    // Panels entered in inventory, grouped by component type.
    const totalByType = new Map();
    let totalPanels = 0;
    for (const c of currentCastings) {
        for (const it of getInventoryFor(c.id)) {
            const qty = (parseInt(it.quantity, 10) || 0) + (parseInt(it.extras, 10) || 0);
            const key = (it.type || '').trim() || '(untyped)';
            totalByType.set(key, (totalByType.get(key) || 0) + qty);
            totalPanels += qty;
        }
    }
    // Panels flagged Rejected on Tracking, grouped by component type.
    const rejectedByType = new Map();
    let totalRejected = 0;
    for (const list of currentCastingComponents.values()) {
        for (const comp of list) {
            if (!comp.rejected) continue;
            const key = (comp.type || String(comp.panel_id || '').split('.')[0] || '').trim() || '(untyped)';
            rejectedByType.set(key, (rejectedByType.get(key) || 0) + 1);
            totalRejected++;
        }
    }
    const gridByType = (m) => [...m.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
        .map(([type, n]) => `
            <span class="pp-cast-sum-item">
                <span class="pp-cast-sum-type">${escapeHtml(type)}</span>
                <span class="pp-cast-sum-n">${n}</span>
            </span>`)
        .join('');
    const totalEl = document.getElementById('pp-cast-sum-total');
    const rejEl = document.getElementById('pp-cast-sum-rejected');
    const totalListEl = document.getElementById('pp-cast-sum-total-list');
    const rejListEl = document.getElementById('pp-cast-sum-rejected-list');
    if (totalEl) totalEl.textContent = String(totalPanels);
    if (rejEl) rejEl.textContent = String(totalRejected);
    if (totalListEl) totalListEl.innerHTML = totalByType.size ? gridByType(totalByType) : '';
    if (rejListEl) rejListEl.innerHTML = totalRejected ? gridByType(rejectedByType) : '';
    wrap.querySelector('.pp-cast-sum-rej')?.classList.toggle('pp-cast-sum-rej-has', totalRejected > 0);
    // Collapse/expand state. A card with nothing to list keeps its chevron hidden.
    const applyToggle = (key, listEl, hasEntries) => {
        const head = wrap.querySelector(`[data-sum-toggle="${key}"]`);
        if (!head || !listEl) return;
        const open = hasEntries && castSumExpanded.has(key);
        listEl.hidden = !open;
        head.setAttribute('aria-expanded', String(open));
        head.classList.toggle('pp-cast-sum-open', open);
        head.classList.toggle('pp-cast-sum-empty', !hasEntries);
    };
    applyToggle('total', totalListEl, totalByType.size > 0);
    applyToggle('rejected', rejListEl, totalRejected > 0);
    wrap.hidden = false;
}

function handleCastingsSummaryToggle(e) {
    const head = e.target.closest('[data-sum-toggle]');
    if (!head || head.classList.contains('pp-cast-sum-empty')) return;
    const key = head.getAttribute('data-sum-toggle');
    if (castSumExpanded.has(key)) castSumExpanded.delete(key);
    else castSumExpanded.add(key);
    updateCastingsSummary();
}

function renderCastings() {
    const list = document.getElementById('pp-castings-list');
    const empty = document.getElementById('pp-castings-empty');
    const needsSave = document.getElementById('pp-castings-needs-save');
    const addRow = document.querySelector('.pp-castings-add');
    if (!list || !empty || !needsSave || !addRow) return;

    updateCastingsSummary();

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
    // Ready (final) inventories are read-only until "Make changes" is pressed on the casting.
    list.querySelectorAll('.pp-cast-card').forEach(card => {
        if (!ciLockedById(card.dataset.castingId)) return;
        card.classList.add('pp-cast-card-locked');
        card.querySelectorAll('.pp-inv-row input, .pp-inv-row select, .pp-inv-add, .pp-inv-import-remakes, [data-action="paste-components"], [data-action="cut-selected"], .pp-inv-row-cut, .pp-inv-row-delete, .pp-inv-row-select, .pp-inv-select-all')
            .forEach(el => { el.disabled = true; });
    });

    ensureCastingsSortable();
    ensureInventorySortables();
    updateMsFloat();
}

function renderCastingCard(c) {
    const isOpen = currentCastInvExpanded.has(c.id);
    const items = getInventoryFor(c.id);
    const countLabel = castingCountLabelHtml(items);
    const hasComponentClipboard = Array.isArray(copiedComponents) && copiedComponents.length > 0;
    const copyDisabled = items.length === 0;
    const nSel = items.filter(it => invSelected.has(it.id)).length;
    const copyLabel = nSel ? `Copy ${nSel} selected` : 'Copy';
    const copyTitle = nSel ? `Copy the ${nSel} ticked component${nSel === 1 ? '' : 's'}` : 'Copy all components on this casting';
    const cutBtn = nSel ? `<button class="pp-row-btn pp-row-btn-word pp-row-btn-cut" data-action="cut-selected" type="button" title="Cut the ${nSel} ticked component${nSel === 1 ? '' : 's'} — paste them into another casting">Cut ${nSel} selected</button>` : '';

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
                    <button class="pp-row-btn pp-row-btn-word" data-action="copy-components" type="button" ${copyDisabled ? 'disabled' : ''} title="${escapeAttr(copyTitle)}">${copyLabel}</button>
                    ${cutBtn}
                    <button class="pp-row-btn pp-row-btn-word" data-action="paste-components" type="button" ${hasComponentClipboard ? '' : 'disabled'} title="Paste copied components into this casting">Paste</button>
                    <button class="pp-row-btn pp-row-btn-delete" data-action="delete" type="button" aria-label="Delete casting" title="Delete casting">&times;</button>
                </div>
            </div>
            ${msOn() ? ciCardRowHtml(c) : ''}
            ${isOpen ? renderInventoryBody(c, items) : ''}
        </div>
    `;
}

/** The Casting Inventory state + its next step, under the casting's title block. */
function ciCardRowHtml(c) {
    const s = ciStatus(c.id), st = CI_STATE[s], r = msRow(c.id, 'Casting Inventory');
    const since = msWhen(r);
    const action = ciActionsHtml(c.id, 'data-action');
    return `<div class="pp-cast-card-ms pp-ms-ci-${s}">
        ${msDot(s)}<span class="pp-cast-card-ms-state">${escapeHtml(st.label)}</span>
        ${msNote(r) ? `<span class="pp-cast-card-ms-note">${escapeHtml(msNote(r))}${since ? ' · ' + escapeHtml(since) : ''}</span>` : ''}
        <span class="pp-cast-card-ms-action">${action}</span>
    </div>`;
}

function renderInventoryBody(casting, items) {
    const cardsHtml = items.length === 0
        ? `<div class="pp-opt-cards-empty">No components yet. Add one below.</div>`
        : items.map(item => renderInventoryRow(item, casting.id)).join('');

    const headerRow = `
        <div class="pp-inv-legend"><span class="pp-inv-legend-pm" title="Qty, Extras, Type, Width, Length, Color, Remake Of — the PM enters these, then presses Ready for engineering">PM fields</span><span class="pp-inv-legend-eng" title="Cu Ft, FF Sq Ft — engineering enters these, then presses Casting Inventory ready">Engineering fields</span></div>
        <div class="pp-inv-header-row">
            <input type="checkbox" class="pp-inv-row-select pp-inv-select-all" data-select-all aria-label="Select every component on this casting" title="Select all / none" ${items.length && items.every(it => invSelected.has(it.id)) ? 'checked' : ''} ${items.length ? '' : 'disabled'}>
            <div class="pp-inv-header-grip-spacer"></div>
            <div class="pp-inv-header-fields">
                <span class="pp-inv-header-qty pp-inv-h-pm">Qty</span>
                <span class="pp-inv-header-qty pp-inv-h-pm">Extras</span>
                <span class="pp-inv-h-pm">Type</span>
                <span class="pp-inv-h-pm">Width</span>
                <span class="pp-inv-h-pm">Length</span>
                <span class="pp-inv-h-pm">Color</span>
                <span class="pp-inv-header-num pp-inv-h-eng">Cu Ft</span>
                <span class="pp-inv-header-num pp-inv-h-eng">FF Sq Ft</span>
                <span class="pp-inv-h-pm">Remake Of</span>
            </div>
            <div class="pp-inv-header-copy-spacer"></div>
            <div class="pp-inv-header-cut-spacer"></div>
            <div class="pp-inv-header-delete-spacer"></div>
        </div>
    `;

    const candidateCount = countImportableRemakes(casting.id);
    const importTitle = candidateCount === 0
        ? 'No rejected panels target this casting'
        : `${candidateCount} rejected panel(s) ready to import`;
    const importLabel = candidateCount > 0
        ? `+ Import Remakes (${candidateCount})`
        : '+ Import Remakes';

    return `
        <div class="pp-cast-card-body">
            ${headerRow}
            <div class="pp-inv-rows" data-casting-id="${escapeAttr(casting.id)}">
                ${cardsHtml}
            </div>
            <button type="button" class="pp-add-btn pp-inv-add" data-action="add-inventory" data-casting-id="${escapeAttr(casting.id)}">+ Add Component</button>
            <button type="button" class="pp-add-btn pp-inv-import-remakes" data-action="open-import-remakes" data-casting-id="${escapeAttr(casting.id)}" ${candidateCount === 0 ? 'disabled' : ''} title="${escapeAttr(importTitle)}">${escapeHtml(importLabel)}</button>
        </div>
    `;
}

function countImportableRemakes(castingId) {
    let count = 0;
    const importedKeys = new Set();
    for (const list of currentCastingComponents.values()) {
        for (const c of list) {
            if (c.remake_of_panel_id && c.remake_of_casting_id) {
                importedKeys.add(`${c.remake_of_casting_id}::${c.remake_of_panel_id}`);
            }
        }
    }
    // Hoist the target casting's sort_order once per function call.
    const target = currentCastings.find(cc => cc.id === castingId);
    const targetOrder = target ? (target.sort_order ?? -Infinity) : -Infinity;

    for (const list of currentCastingComponents.values()) {
        for (const c of list) {
            if (!c.rejected) continue;
            // Only count panels from EARLIER castings (sort_order < target's).
            const srcCasting = currentCastings.find(cc => cc.id === c.casting_id);
            const srcOrder = srcCasting ? (srcCasting.sort_order ?? -Infinity) : -Infinity;
            if (srcOrder >= targetOrder) continue;
            // Skip if already imported anywhere.
            const key = `${c.casting_id}::${c.panel_id}`;
            if (importedKeys.has(key)) continue;
            count++;
        }
    }
    return count;
}

/** The rejected panels a remake inventory row re-casts (kept on the row as a comma list, one id per piece). */
function invRemakeIds(item) { return String(item?.remake_of_panel_id || '').split(',').map(x => x.trim()).filter(Boolean); }
function renderInventoryRow(item, castingId) {
    const remakeIds = item.remake_of_casting_id ? invRemakeIds(item) : [];
    let remakeCellHtml;
    if (!remakeIds.length) {
        remakeCellHtml = `<span class="pp-inv-input pp-inv-pm pp-inv-remake-cell" aria-label="Remake of"></span>`;
    } else {
        const srcCasting = currentCastings.find(c => c.id === item.remake_of_casting_id);
        const srcNum = srcCasting?.casting_number || '?';
        remakeCellHtml = `<span class="pp-inv-input pp-inv-pm pp-inv-remake-cell" title="Re-cast of ${remakeIds.length} rejected panel${remakeIds.length === 1 ? '' : 's'} from cast ${escapeAttr(srcNum)}: ${escapeAttr(remakeIds.join(', '))}">Cast ${escapeHtml(srcNum)}</span>`;
    }
    return `
        <div class="pp-inv-row${remakeIds.length ? ' pp-inv-row-remake' : ''}${invSelected.has(item.id) ? ' pp-inv-row-selected' : ''}" data-inventory-id="${escapeAttr(item.id)}" data-casting-id="${escapeAttr(castingId)}">
            <input type="checkbox" class="pp-inv-row-select" data-select-row aria-label="Select component" title="Tick to copy or cut several components at once" ${invSelected.has(item.id) ? 'checked' : ''}>
            <div class="pp-inv-row-grip" aria-hidden="true" title="Drag to reorder">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/>
                    <circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>
                </svg>
            </div>
            <div class="pp-inv-row-fields">
                ${invCell(item.id, 'quantity', `<input type="number" class="pp-inv-input pp-inv-pm pp-inv-input-qty${invEditedCls(item.id, 'quantity')}" data-field="quantity" min="1" step="1" value="${escapeAttr(item.quantity ?? 1)}"${invEditedTitle(item.id, 'quantity')} />`)}
                ${invCell(item.id, 'extras', `<input type="number" class="pp-inv-input pp-inv-pm pp-inv-input-qty${invEditedCls(item.id, 'extras')}" data-field="extras" min="0" step="1" placeholder="0" value="${escapeAttr(item.extras ?? 0)}"${invEditedTitle(item.id, 'extras')} />`)}
                ${invCell(item.id, 'type', `<input type="text" class="pp-inv-input pp-inv-pm${invEditedCls(item.id, 'type')}" data-field="type" placeholder="Type" value="${escapeAttr(item.type || '')}"${invEditedTitle(item.id, 'type')} />`)}
                ${invCell(item.id, 'width', `<input type="text" class="pp-inv-input pp-inv-pm${invEditedCls(item.id, 'width')}" data-field="width" placeholder="Width" value="${escapeAttr(item.width || '')}"${invEditedTitle(item.id, 'width')} />`)}
                ${invCell(item.id, 'length', `<input type="text" class="pp-inv-input pp-inv-pm${invEditedCls(item.id, 'length')}" data-field="length" placeholder="Length" value="${escapeAttr(item.length || '')}"${invEditedTitle(item.id, 'length')} />`)}
                ${invCell(item.id, 'color_log_id', buildColorLogSelectHtml(item.color_log_id, {
                    className: 'pp-inv-input pp-inv-pm pp-inv-color-select' + invEditedCls(item.id, 'color_log_id'),
                    dataAttrs: { 'data-field': 'color_log_id' }
                }))}
                ${invCell(item.id, 'cu_ft', `<input type="number" class="pp-inv-input pp-inv-eng pp-inv-input-num${invEditedCls(item.id, 'cu_ft')}" data-field="cu_ft" step="any" min="0" placeholder="0" value="${item.cu_ft == null ? '' : escapeAttr(item.cu_ft)}"${invEditedTitle(item.id, 'cu_ft')} />`)}
                ${invCell(item.id, 'ff_sq_ft', `<input type="number" class="pp-inv-input pp-inv-eng pp-inv-input-num${invEditedCls(item.id, 'ff_sq_ft')}" data-field="ff_sq_ft" step="any" min="0" placeholder="0" value="${item.ff_sq_ft == null ? '' : escapeAttr(item.ff_sq_ft)}"${invEditedTitle(item.id, 'ff_sq_ft')} />`)}
                ${remakeCellHtml}
            </div>
            <button class="pp-inv-row-copy" type="button" data-action="copy-inventory-row" aria-label="Copy component" title="Copy this component — paste it with another casting's Paste button">Copy</button>
            <button class="pp-inv-row-copy pp-inv-row-cut" type="button" data-action="cut-inventory-row" aria-label="Cut component" title="Cut this component (removed here, kept on the clipboard) — paste it with another casting's Paste button">Cut</button>
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
            // While a row is held, nothing on the page can be text-selected (the fallback drag otherwise
            // sweeps a selection across every row it passes).
            onChoose: () => { document.body.classList.add('pp-inv-dragging'); try { window.getSelection()?.removeAllRanges(); } catch {} },
            onUnchoose: () => document.body.classList.remove('pp-inv-dragging'),
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

            // Reordering can shift panel_id allocation (runTrackingSync walks
            // castings in sort_order). Refuse if either the moved row or the
            // row at the destination index is locked — moving across a locked
            // casting would change its sort_order and re-attach its tracking
            // marks to the wrong physical panel.
            const moved = currentCastings[oldIdx];
            const neighbor = currentCastings[newIdx];
            if (isCastingInventoryLocked(moved) || isCastingInventoryLocked(neighbor)) {
                const locked = isCastingInventoryLocked(moved) ? moved : neighbor;
                showCastingLockedToast(locked);
                renderCastings();
                return;
            }

            const reordered = currentCastings.slice();
            const [movedRow] = reordered.splice(oldIdx, 1);
            reordered.splice(newIdx, 0, movedRow);
            reordered.forEach((c, idx) => { c.sort_order = idx; });
            currentCastings = reordered;

            // Pills/columns in the optimizer tab read currentCastings,
            // so re-render if it's mounted.
            if (currentTab === 'optimizer') renderOptimizer();
            if (currentTab === 'staging') renderStaging();

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

        if (lines.length) ciEntered(created.id);
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

// Import Remakes modal — bring any rejected panel from an EARLIER casting in
// this project (one not yet imported anywhere) into this casting's inventory,
// attributed back to its source panel/casting.
let importRemakesTargetCastingId = null;

function openImportRemakesModal(castingId) {
    const target = currentCastings.find(c => c.id === castingId);
    if (!target) return;
    importRemakesTargetCastingId = castingId;

    const modal = document.getElementById('pp-import-remakes-modal');
    const list = document.getElementById('pp-import-remakes-list');
    const intro = document.getElementById('pp-import-remakes-intro');
    const submit = document.getElementById('pp-import-remakes-submit');
    if (!modal || !list || !submit || !intro) return;

    // Build the set of source (casting_id, panel_id) pairs that have already
    // been imported anywhere in this project, so they're excluded.
    const importedKeys = new Set();
    for (const arr of currentCastingComponents.values()) {
        for (const c of arr) {
            if (c.remake_of_panel_id && c.remake_of_casting_id) {
                importedKeys.add(`${c.remake_of_casting_id}::${c.remake_of_panel_id}`);
            }
        }
    }

    const candidates = [];
    const targetOrder = target.sort_order ?? -Infinity;
    for (const arr of currentCastingComponents.values()) {
        for (const c of arr) {
            if (!c.rejected) continue;
            const srcCasting = currentCastings.find(cc => cc.id === c.casting_id);
            const srcOrder = srcCasting ? (srcCasting.sort_order ?? -Infinity) : -Infinity;
            if (srcOrder >= targetOrder) continue;
            const key = `${c.casting_id}::${c.panel_id}`;
            if (importedKeys.has(key)) continue;
            candidates.push(c);
        }
    }

    intro.textContent = candidates.length === 0
        ? `No rejected panels are currently targeting ${target.casting_number || 'this casting'} for remake.`
        : `Select panels to import into ${target.casting_number || 'this casting'} as remakes. Panels of the same type and size become one inventory line (its quantity counts them).`;

    if (candidates.length === 0) {
        list.innerHTML = `<div class="pp-import-remakes-empty">Nothing to import.</div>`;
        submit.disabled = true;
    } else {
        // Group by source casting for clarity.
        const groups = new Map();
        for (const c of candidates) {
            if (!groups.has(c.casting_id)) groups.set(c.casting_id, []);
            groups.get(c.casting_id).push(c);
        }
        const groupHtml = [];
        for (const [srcCastingId, comps] of groups) {
            const srcCasting = currentCastings.find(cc => cc.id === srcCastingId);
            const srcLabel = srcCasting ? (srcCasting.casting_number || '?') : '?';
            comps.sort((a, b) => String(a.panel_id || '').localeCompare(String(b.panel_id || '')));
            const rows = comps.map(c => {
                const dims = [c.width, c.length].filter(Boolean).join(' × ');
                const meta = [dims, resolveComponentColorName(c)].filter(Boolean).join(' · ');
                return `<label class="pp-import-remakes-row">
                    <input type="checkbox" data-component-id="${escapeAttr(c.id)}" />
                    <span class="pp-import-remakes-row-name">${escapeHtml(c.panel_id || '?')}</span>
                    <span class="pp-import-remakes-row-meta">${escapeHtml(meta)}</span>
                </label>`;
            }).join('');
            groupHtml.push(`<div class="pp-import-remakes-group" data-src-casting-id="${escapeAttr(srcCastingId)}">
                <label class="pp-import-remakes-group-title">
                    <input type="checkbox" class="pp-import-remakes-group-toggle" data-src-casting-id="${escapeAttr(srcCastingId)}" aria-label="Select all from ${escapeAttr(srcLabel)}" />
                    <span>From ${escapeHtml(srcLabel)} <span class="pp-import-remakes-group-count">(${comps.length})</span></span>
                </label>
                ${rows}
            </div>`);
        }
        list.innerHTML = groupHtml.join('');
        submit.disabled = true;

        const groupToggles = list.querySelectorAll('.pp-import-remakes-group-toggle');
        const childCheckboxes = list.querySelectorAll('.pp-import-remakes-row input[type="checkbox"]');

        function refreshSubmitState() {
            const anyChecked = list.querySelectorAll('.pp-import-remakes-row input[type="checkbox"]:checked').length > 0;
            submit.disabled = !anyChecked;
        }

        function refreshGroupState(groupEl) {
            const toggle = groupEl.querySelector('.pp-import-remakes-group-toggle');
            if (!toggle) return;
            const kids = groupEl.querySelectorAll('.pp-import-remakes-row input[type="checkbox"]');
            const checkedCount = Array.from(kids).filter(cb => cb.checked).length;
            if (checkedCount === 0) {
                toggle.checked = false;
                toggle.indeterminate = false;
            } else if (checkedCount === kids.length) {
                toggle.checked = true;
                toggle.indeterminate = false;
            } else {
                toggle.checked = false;
                toggle.indeterminate = true;
            }
        }

        groupToggles.forEach(toggle => {
            toggle.addEventListener('change', () => {
                const groupEl = toggle.closest('.pp-import-remakes-group');
                if (!groupEl) return;
                const turnOn = toggle.checked;
                groupEl.querySelectorAll('.pp-import-remakes-row input[type="checkbox"]').forEach(cb => {
                    cb.checked = turnOn;
                });
                toggle.indeterminate = false;
                refreshSubmitState();
            });
        });

        childCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                const groupEl = cb.closest('.pp-import-remakes-group');
                if (groupEl) refreshGroupState(groupEl);
                refreshSubmitState();
            });
        });
    }

    modal.hidden = false;
}

function closeImportRemakesModal() {
    const modal = document.getElementById('pp-import-remakes-modal');
    if (modal) modal.hidden = true;
    importRemakesTargetCastingId = null;
}

async function handleImportRemakesConfirm() {
    const targetCastingId = importRemakesTargetCastingId;
    if (!targetCastingId) return;
    const list = document.getElementById('pp-import-remakes-list');
    if (!list) return;
    const checked = Array.from(list.querySelectorAll('input[type="checkbox"]:checked'));
    if (checked.length === 0) return;

    // Resolve each checked component-id back to its source row.
    const sources = [];
    for (const cb of checked) {
        const id = cb.dataset.componentId;
        if (!id) continue;
        let found = null;
        for (const arr of currentCastingComponents.values()) {
            const c = arr.find(x => x.id === id);
            if (c) { found = c; break; }
        }
        if (found) sources.push(found);
    }
    if (sources.length === 0) return;

    const submit = document.getElementById('pp-import-remakes-submit');
    if (submit) submit.disabled = true;

    // One inventory row per source cast + type + size + colour (2026-10-20): the quantity counts the panels, Cu Ft /
    // FF Sq Ft come from the source cast's inventory row for that type, and the panel ids stay on the row (comma
    // list) so every rebuilt component still points back at its own rejected panel. Panels of a kind already
    // imported here from the same cast join that row.
    const same = (a, b) => (a || null) === (b || null);
    const groups = new Map();
    for (const src of sources) {
        const key = [src.casting_id, src.type, src.width, src.length, src.color_log_id, src.color, src.sealer].map(v => v ?? '').join('|');
        if (!groups.has(key)) groups.set(key, { src, ids: [] });
        if (src.panel_id) groups.get(key).ids.push(src.panel_id);
    }
    let okCount = 0;
    let failCount = 0;
    for (const { src, ids } of groups.values()) {
        const n = Math.max(1, ids.length);
        try {
            const existing = getInventoryFor(targetCastingId).find(r => r.remake_of_casting_id === src.casting_id && same(r.type, src.type) && same(r.width, src.width) && same(r.length, src.length) && same(r.color_log_id, src.color_log_id));
            if (existing) {
                const merged = invRemakeIds(existing).concat(ids);
                await updateInventoryItem(existing.id, { quantity: (parseInt(existing.quantity, 10) || 0) + n, remake_of_panel_id: merged.join(',') || null });
            } else {
                const srcRows = getInventoryFor(src.casting_id);
                const srcInv = srcRows.find(r => same(r.type, src.type) && same(r.width, src.width) && same(r.length, src.length)) || srcRows.find(r => same(r.type, src.type)) || null;
                await createInventoryItem(targetCastingId, {
                    type: src.type || null,
                    width: src.width || null,
                    length: src.length || null,
                    color: src.color || null,
                    color_log_id: src.color_log_id || null,
                    sealer: src.sealer || null,
                    quantity: n,
                    extras: 0,
                    cu_ft: srcInv?.cu_ft ?? null,
                    ff_sq_ft: srcInv?.ff_sq_ft ?? null,
                    remake_of_panel_id: ids.join(',') || null,
                    remake_of_casting_id: src.casting_id || null
                });
            }
            okCount += n;
        } catch (err) {
            logger.error('[project-portal] import remake failed:', err);
            failCount += n;
        }
    }

    closeImportRemakesModal();
    if (okCount > 0) {
        // Refresh local inventory cache for the target casting then re-sync
        // tracking so the new rows materialize as panel_ids.
        try {
            const refreshed = await loadCastingInventory(targetCastingId);
            setInventoryFor(targetCastingId, refreshed);
        } catch (e) {
            logger.error('[project-portal] post-import reload failed:', e);
        }
        renderCastings();
        ciEntered(targetCastingId);
        await syncTrackingFromInventory();
        msInventoryChanged(targetCastingId);
        showToast(`Imported ${okCount} remake${okCount === 1 ? '' : 's'}${failCount ? ` (${failCount} failed)` : ''}.`, failCount ? 'warning' : 'success');
    } else {
        showToast('Could not import remakes — check connection.', 'error');
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
    if (isCastingInventoryLocked(c)) {
        showCastingLockedToast(c);
        return;
    }
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
    const casting = currentCastings.find(c => c.id === castingId);
    if (isCastingInventoryLocked(casting)) {
        showCastingLockedToast(casting);
        return;
    }
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
        ciEntered(castingId);
        syncTrackingFromInventory();
        msInventoryChanged(castingId);
    } catch (err) {
        logger.error('[project-portal] add inventory failed:', err);
        showToast('Add component failed: ' + (err.message || err), 'error');
    }
}

async function saveInventoryItem(itemId, castingId) {
    const row = document.querySelector(`.pp-inv-row[data-inventory-id="${itemId}"]`);
    if (!row) return;
    const casting = currentCastings.find(c => c.id === castingId);
    if (isCastingInventoryLocked(casting)) {
        showCastingLockedToast(casting);
        return;
    }
    const list = getInventoryFor(castingId);
    const item = list.find(c => c.id === itemId);
    if (!item) return;

    const NUMERIC_FIELDS = new Set(['cu_ft', 'ff_sq_ft']);
    const fields = {};
    row.querySelectorAll('input[data-field], select[data-field]').forEach(input => {
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
    Object.assign(item, changed);          // the value changed in the user's hands
    ciEntered(castingId);                  // first entry: the board's Casting Inventory cell goes orange by itself
    msInventoryChanged(castingId);         // linked prints go orange — or back to green when the inventory is back as printed

    try {
        const updated = await updateInventoryItem(itemId, changed);
        if (updated) Object.assign(item, updated);
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

/**
 * Title-block summary for a casting: types · pcs · cu ft · ff sq ft (2026-10-14). Volume and face area
 * total the same way Import from Tracking does (value × (quantity + extras)). A total whose rows are
 * not all filled in is still shown, but flagged "incomplete" with the count of blank rows.
 */
function castingCountLabelHtml(items) {
    if (items.length === 0) return '0 components';
    const units = (it) => (parseInt(it.quantity, 10) || 0) + (parseInt(it.extras, 10) || 0);
    const totalQty = items.reduce((sum, it) => sum + units(it), 0);
    const blank = (v) => v === null || v === undefined || v === '';
    const part = (field, label) => {
        const total = items.reduce((sum, it) => sum + (Number(it[field]) || 0) * units(it), 0);
        const missing = items.filter(it => blank(it[field])).length;
        const text = `${roundSig(total, 2)} ${label}`;
        if (!missing) return escapeHtml(text);
        const tip = `${missing} of ${items.length} component${items.length === 1 ? '' : 's'} ${missing === 1 ? 'has' : 'have'} no ${label} — this total is incomplete`;
        return `<span class="pp-cast-card-count-warn" title="${escapeAttr(tip)}">${escapeHtml(text)} &#9888; incomplete</span>`;
    };
    return `${items.length} ${items.length === 1 ? 'type' : 'types'} · ${totalQty} pcs · ${part('cu_ft', 'cu ft')} · ${part('ff_sq_ft', 'ff sq ft')}`;
}

function updateCastingInventoryCount(castingId) {
    const card = document.querySelector(`.pp-cast-card[data-casting-id="${castingId}"]`);
    if (!card) return;
    const countEl = card.querySelector('.pp-cast-card-count');
    if (!countEl) return;
    countEl.innerHTML = castingCountLabelHtml(getInventoryFor(castingId));
    updateCastingsSummary();
}

async function handleDeleteInventoryItem(castingId, itemId) {
    const casting = currentCastings.find(c => c.id === castingId);
    if (isCastingInventoryLocked(casting)) {
        showCastingLockedToast(casting);
        return;
    }
    try {
        const t = inventorySaveTimers.get(itemId);
        if (t) { clearTimeout(t); inventorySaveTimers.delete(itemId); }
        await deleteInventoryItem(itemId);
        const list = getInventoryFor(castingId).filter(c => c.id !== itemId);
        setInventoryFor(castingId, list);
        renderCastings();
        syncTrackingFromInventory();
        msInventoryChanged(castingId);
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
            // While a row is held, nothing on the page can be text-selected (the fallback drag otherwise
            // sweeps a selection across every row it passes).
            onChoose: () => { document.body.classList.add('pp-inv-dragging'); try { window.getSelection()?.removeAllRanges(); } catch {} },
            onUnchoose: () => document.body.classList.remove('pp-inv-dragging'),
            ghostClass: 'pp-inv-row-ghost',
            chosenClass: 'pp-inv-row-chosen',
            dragClass: 'pp-inv-row-drag',
            forceFallback: true,
            fallbackTolerance: 4,
            scroll: true,
            scrollSensitivity: 60,
            scrollSpeed: 14,
            onEnd: async (evt) => {
                document.body.classList.remove('pp-inv-dragging');
                const oldIdx = evt.oldIndex;
                const newIdx = evt.newIndex;
                if (oldIdx === newIdx || oldIdx === undefined || newIdx === undefined) return;
                const casting = currentCastings.find(c => c.id === castingId);
                if (isCastingInventoryLocked(casting)) {
                    showCastingLockedToast(casting);
                    renderCastings();
                    return;
                }
                const list = getInventoryFor(castingId).slice();
                const [moved] = list.splice(oldIdx, 1);
                list.splice(newIdx, 0, moved);
                list.forEach((c, idx) => { c.sort_order = idx; });
                setInventoryFor(castingId, list);
                try {
                    await setInventoryOrder(list.map(c => c.id));
                    syncTrackingFromInventory();
                    msInventoryChanged(castingId);
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
    try { optReady = await loadReadyFlags(currentCastings.map(c => c.id)); } catch (e) { optReady = new Map(); }
    await loadOptValue();
    await loadStagingDescriptions();   // the Optimizer Hours tab mirrors Staging (teams × days with task names)
    renderOptimizer();
}

// ---- Optimizer Hours per staged day (2026-10-22): the tab mirrors the Staging tab; hours live on the staging row.
function optStagedCells(castNum) {
    const scaffold = currentStagingScaffold.get(castNum) || [];
    const cells = [];
    for (const sec of scaffold) {
        for (let d = 1; d <= sec.days; d++) {
            const entry = currentStagingDescriptions.get(`${castNum}|${sec.department}|${d}`) || {};
            cells.push({ department: sec.department, day: d, taskName: entry.taskName || '', hours: entry.hours == null ? null : Number(entry.hours), description: entry.description || '' });
        }
    }
    return cells;
}
function optStagedHours(castNum) { return optStagedCells(castNum).reduce((n, c) => n + (Number(c.hours) || 0), 0); }
/** Total hours of a casting: the staged days when any carry hours, else the previous task list. */
function optHoursOf(casting) {
    const staged = optStagedHours(String(casting.casting_number || ''));
    if (staged > 0) return staged;
    return getPhasesFor(casting.id).reduce((n, p) => n + (typeof p.hours === 'number' ? p.hours : 0), 0);
}
const optHoursSaveTimers = new Map();
function scheduleOptHoursSave(castNum, dept, day, value) {
    const key = `${castNum}|${dept}|${day}`;
    const hours = value === '' || value == null ? null : Math.max(0, Number(value) || 0);
    const cur = currentStagingDescriptions.get(key) || { description: '', castingSide: null };
    currentStagingDescriptions.set(key, { ...cur, hours });
    renderOptTotals();
    const prev = optHoursSaveTimers.get(key);
    if (prev) clearTimeout(prev);
    optHoursSaveTimers.set(key, setTimeout(async () => {
        optHoursSaveTimers.delete(key);
        try { await upsertTaskDescription({ projectNumber: currentProjectNumber, castingNumber: castNum, department: dept, dayNumber: String(day), hours }); }
        catch (err) { logger.error('[project-portal] save optimizer hours failed:', err); showToast('Save hours failed: ' + (err.message || err), 'error'); }
    }, 500));
}
/** Whole-number split, first day heavier (same rule as the scheduler). */
function optWholeSplit(hours, n) {
    if (n <= 1) return [hours];
    const whole = Math.floor(hours), extra = Math.round((hours - whole) * 100) / 100;
    const base = Math.floor(whole / n), rem = whole - base * n;
    const out = Array.from({ length: n }, (_, k) => base + (k < rem ? 1 : 0));
    out[0] = Math.round((out[0] + extra) * 100) / 100;
    return out;
}
/**
 * Pull the previous task list's hours into the staged days (2026-10-22): each old task goes to its team's
 * staging department; the team's days are shared out between its tasks (a task gets at least one day; more
 * days than tasks are split by hours), the task name and the hours land on those days. Days already carrying
 * hours are left alone. Returns { filled, skipped }.
 */
async function optPullLegacyHours(casting) {
    const castNum = String(casting.casting_number || '');
    const phases = getPhasesFor(casting.id).filter(p => Number(p.hours) > 0);
    if (!phases.length) return { filled: 0, skipped: 'no previous hours' };
    let scaffold = currentStagingScaffold.get(castNum);
    if (!scaffold) { scaffold = []; currentStagingScaffold.set(castNum, scaffold); }
    // old tasks by team, in their order
    const groups = new Map();
    const sealIdx = phases.findIndex(p => taskForPhase(p.phase_name).code === 'SEAL');
    phases.forEach((p, i) => {
        const m = taskForPhase(p.phase_name, { afterSeal: sealIdx >= 0 && i > sealIdx });
        if (!groups.has(m.dept)) groups.set(m.dept, []);
        groups.get(m.dept).push({ code: m.code, hours: Number(p.hours) || 0 });
    });
    let filled = 0;
    const skippedTeams = [];
    for (const [team, tasks] of groups) {
        let sec = scaffold.find(s => teamOfDepartment(s.department) === team);
        if (!sec) { sec = { department: STAGING_NAME_OF_TEAM[team] || team, days: 0 }; scaffold.push(sec); }
        const hasHours = Array.from({ length: sec.days }, (_, i) => currentStagingDescriptions.get(`${castNum}|${sec.department}|${i + 1}`)).some(e => e && e.hours != null && e.hours !== '');
        if (hasHours) { skippedTeams.push(sec.department); continue; }
        if (sec.days < tasks.length) sec.days = tasks.length;
        // share the team's days between its tasks: at least one each, the rest by hours
        const total = tasks.reduce((n, t) => n + t.hours, 0) || 1;
        const alloc = tasks.map(() => 1);
        for (let left = sec.days - tasks.length; left > 0; left--) {
            let best = 0, bestGap = -Infinity;
            tasks.forEach((t, i) => { const gap = t.hours / total * sec.days - alloc[i]; if (gap > bestGap) { bestGap = gap; best = i; } });
            alloc[best] += 1;
        }
        let day = 1;
        for (let i = 0; i < tasks.length; i++) {
            const split = optWholeSplit(tasks[i].hours, alloc[i]);
            for (const h of split) {
                const key = `${castNum}|${sec.department}|${day}`;
                const cur = currentStagingDescriptions.get(key) || { description: '', castingSide: null };
                await upsertTaskDescription({ projectNumber: currentProjectNumber, castingNumber: castNum, department: sec.department, dayNumber: String(day), taskName: tasks[i].code, hours: h });
                currentStagingDescriptions.set(key, { ...cur, taskName: tasks[i].code, hours: h });
                filled++; day++;
            }
        }
    }
    scaffold.sort((a, b) => { const i = DEPARTMENT_ORDER.indexOf(a.department), j = DEPARTMENT_ORDER.indexOf(b.department); return (i === -1 ? 999 : i) - (j === -1 ? 999 : j); });
    return { filled, skipped: skippedTeams.length ? `${skippedTeams.join(', ')} already had hours` : '' };
}
async function handlePullLegacyHours(castingId) {
    const c = currentCastings.find(x => x.id === castingId);
    if (!c) return;
    if (isStagingTaskHoursMigrationPending()) { showToast('Run migration/staging-task-hours.sql first — the hours columns are not in the database yet.', 'error'); return; }
    try {
        const r = await optPullLegacyHours(c);
        renderOptimizer();
        showToast(r.filled ? `Cast ${c.casting_number}: ${r.filled} day${r.filled === 1 ? '' : 's'} filled from the previous task list${r.skipped ? ' (' + r.skipped + ')' : ''}` : `Cast ${c.casting_number}: nothing to pull${r.skipped ? ' — ' + r.skipped : ''}`);
    } catch (err) { showToast('Pull failed: ' + (err.message || err), 'error'); }
}
async function handlePullLegacyHoursAll() {
    if (isStagingTaskHoursMigrationPending()) { showToast('Run migration/staging-task-hours.sql first — the hours columns are not in the database yet.', 'error'); return; }
    const list = getCastingsForActivePhase().filter(c => optStagedHours(String(c.casting_number || '')) <= 0 && getPhasesFor(c.id).some(p => Number(p.hours) > 0));
    if (!list.length) { showToast('Every casting already has hours on its staged days.'); return; }
    if (!window.confirm(`Pull the previous task list hours into the staged days of ${list.length} casting${list.length === 1 ? '' : 's'}? Days that already have hours are left alone.`)) return;
    let filled = 0;
    try { for (const c of list) filled += (await optPullLegacyHours(c)).filled; }
    catch (err) { showToast('Pull failed: ' + (err.message || err), 'error'); }
    renderOptimizer();
    showToast(`${filled} day${filled === 1 ? '' : 's'} filled across ${list.length} casting${list.length === 1 ? '' : 's'}`);
}

function renderOptStagedGrid(casting) {
    const castNum = String(casting.casting_number || '');
    const scaffold = currentStagingScaffold.get(castNum) || [];
    const deptChip = (dept) => {
        const colorKey = normalizeDepartmentClass(normalizeDepartment(dept));
        const color = DEPARTMENT_COLORS[colorKey];
        const style = color ? ` style="background:${color.background};color:${color.text}"` : '';
        return `<span class="pp-opt-dept-chip"${style}>${escapeHtml(dept)}</span>`;
    };
    const staged = scaffold.filter(sec => Array.from({ length: sec.days }, (_, i) => i + 1).some(d => currentStagingDescriptions.has(`${castNum}|${sec.department}|${d}`)));
    if (!staged.length) {
        return `<div class="pp-opt-staged-empty">Nothing staged yet for Cast ${escapeHtml(castNum)}. Set the days and tasks on the <button type="button" class="pp-link-btn" data-action="goto-staging">Staging tab</button> first — the hours are entered here per day.</div>`;
    }
    return staged.map(sec => {
        const rows = [];
        for (let d = 1; d <= sec.days; d++) {
            const entry = currentStagingDescriptions.get(`${castNum}|${sec.department}|${d}`) || {};
            const task = entry.taskName || '';
            const hours = entry.hours == null ? '' : String(entry.hours);
            const hasBudget = optBudgets.get(casting.id) != null;
            const pct = optPctOf(casting.id, sec.department, d);
            const byPct = hasBudget && pct != null;
            rows.push(`<div class="pp-opt-stg-row${hasBudget ? ' pp-opt-stg-row-pct' : ''}">
                <span class="pp-opt-day-label">Day ${d}</span>
                <span class="pp-opt-stg-task${task ? '' : ' pp-opt-stg-task-missing'}" title="${task ? 'Task from the Staging tab' : 'No task picked on the Staging tab yet'}">${task ? escapeHtml(task.toLowerCase()) : '— no task —'}</span>
                ${hasBudget ? `<span class="pp-opt-pct"><input type="number" min="0" max="100" step="1" data-action="staged-pct" data-casting-id="${escapeAttr(casting.id)}" data-department="${escapeAttr(sec.department)}" data-day="${d}" value="${pct == null ? '' : escapeAttr(fmtHrs(pct))}" placeholder="%" title="Share of the casting's budget for this task">%</span>` : ''}
                <input type="number" min="0" step="1" class="pp-opt-card-hours${byPct ? ' pp-opt-hours-derived' : ''}" data-action="staged-hours" data-casting-number="${escapeAttr(castNum)}" data-department="${escapeAttr(sec.department)}" data-day="${d}" value="${escapeAttr(hours)}" placeholder="0"${byPct ? ' readonly' : ''} title="${byPct ? 'Budget × percent — change the percent to change it' : escapeAttr((entry.description || '').trim() || 'Hours for this day')}" />
                <span class="pp-opt-card-hours-label">hrs</span>
            </div>`);
        }
        const deptTotal = Array.from({ length: sec.days }, (_, i) => Number((currentStagingDescriptions.get(`${castNum}|${sec.department}|${i + 1}`) || {}).hours) || 0).reduce((a, b) => a + b, 0);
        return `<section class="pp-opt-dept pp-opt-stg-dept" data-department="${escapeAttr(sec.department)}">
            <div class="pp-opt-dept-head">${deptChip(sec.department)}<span class="pp-opt-stg-dept-total" data-dept-total="${escapeAttr(castNum + '|' + sec.department)}">${deptTotal} hrs</span></div>
            ${rows.join('')}
        </section>`;
    }).join('');
}

// ---------- Staging (pre-author task descriptions per casting, by department × day) ----------

/* ===================== Releasability Approvals tab (2026-10-16) ===================== */
async function activateApprovalsTab() {
    const needsSave = document.getElementById('pp-appr-needs-save');
    const noCastings = document.getElementById('pp-appr-no-castings');
    const table = document.getElementById('pp-appr-table');
    if (!table) return;
    if (!currentProjectNumber) { needsSave.hidden = false; noCastings.hidden = true; table.innerHTML = ''; return; }
    needsSave.hidden = true;
    if (currentCastings.length === 0) { try { currentCastings = await loadCastings(currentProjectNumber); } catch (e) { /* ignore */ } }
    if (!msByCasting.size && currentProjectNumber) await loadMilestones();
    renderApprovals();
}
function apprCellHtml(castingId, milestone) {
    const auto = AUTO_MILESTONES.includes(milestone);
    const r = msRow(castingId, milestone);
    const s = r?.status || MS.RED;
    const when = msWhen(r);
    const tip = `${milestone}: ${s === MS.GREEN ? 'done' : s === MS.ORANGE ? 'in progress' : 'not done'}`
        + (msNote(r) ? ` — ${msNote(r)}` : '') + (when ? ` (since ${when})` : '')
        + (auto ? ' · set by the portal' : ' · click to flip; the Releasability Board follows');
    const icon = s === MS.GREEN ? '&#10003;' : s === MS.ORANGE ? '/' : '&minus;';
    return `<button type="button" class="pp-opt-ms pp-appr-cell pp-opt-ms-${s}${auto ? ' pp-appr-cell-auto' : ''}" data-casting-id="${escapeAttr(castingId)}" data-milestone="${escapeAttr(milestone)}" ${auto ? 'disabled' : ''} title="${escapeAttr(tip)}"><span class="pp-opt-ms-box">${icon}</span></button>`;
}
function renderApprovals() {
    const table = document.getElementById('pp-appr-table');
    const noCastings = document.getElementById('pp-appr-no-castings');
    if (!table) return;
    const scoped = getCastingsForActivePhase();
    if (!scoped.length) { noCastings.hidden = false; table.innerHTML = ''; return; }
    noCastings.hidden = true;
    if (!msOn()) { table.innerHTML = '<div class="pp-castings-hint">This job is before the cut-off — its approvals are clicked on the Releasability Board.</div>'; return; }
    const head = APPROVALS_TAB_ITEMS.map(m => {
        const auto = AUTO_MILESTONES.includes(m);
        const allGreen = scoped.every(c => msStatus(c.id, m) === MS.GREEN);
        return `<th><span class="pp-appr-col-name">${escapeHtml(m)}</span><span class="pp-appr-col-tag ${auto ? 'pp-appr-tag-auto' : 'pp-appr-tag-pman'}">${auto ? 'AUTO' : 'P. MANUAL'}</span>
            ${auto ? '' : `<button type="button" class="pp-appr-all" data-action="appr-all" data-milestone="${escapeAttr(m)}" data-to="${allGreen ? 'red' : 'green'}" title="${allGreen ? 'Clear every casting' : 'Mark every casting done'}">${allGreen ? 'clear all' : 'all done'}</button>`}</th>`;
    }).join('');
    const rows = scoped.map(c => `<tr><th class="pp-appr-cast">Cast ${escapeHtml(c.casting_number || '')}${c.description ? `<span class="pp-appr-desc">${escapeHtml(c.description)}</span>` : ''}</th>
        ${APPROVALS_TAB_ITEMS.map(m => `<td>${apprCellHtml(c.id, m)}</td>`).join('')}</tr>`).join('');
    table.innerHTML = `<table class="pp-appr"><thead><tr><th class="pp-appr-corner"></th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}
async function toggleApproval(castingId, milestone, force = null) {
    if (!castingId || !milestone || AUTO_MILESTONES.includes(milestone)) return;
    const green = msStatus(castingId, milestone) === MS.GREEN;
    const to = force || (green ? MS.RED : MS.GREEN);
    if ((to === MS.GREEN) === green) return;
    await msSet(castingId, milestone, to, { note: to === MS.GREEN ? 'Confirmed in the portal' : null, stamp: true });
}

async function activateStagingTab() {
    const needsSave = document.getElementById('pp-stg-needs-save');
    const noCastings = document.getElementById('pp-stg-no-castings');
    const editor = document.getElementById('pp-stg-editor');

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

    if (!currentStagingCastingId || !phaseScoped.find(c => c.id === currentStagingCastingId)) {
        currentStagingCastingId = phaseScoped[0].id;
    }
    await loadStagingDescriptions();
    renderStaging();
}

// Build the staging description map + per-casting day scaffold from two sources:
//  1. The project's SCHEDULED tasks — they already carry casting #, department, the
//     per-casting day and their merged description (legacy or casting-aware), so existing
//     descriptions surface in Staging with no backfill needed.
//  2. Casting-aware rows — pre-authored descriptions for castings/days not yet on the sheet.
// Pre-authored rows overlay the scheduled ones (same row resolves to the same text).
async function loadStagingDescriptions() {
    const pn = String(currentProjectNumber || '').trim();

    let scheduled = [];
    try {
        const all = await fetchAllTasks();
        scheduled = (all || []).filter(t => !t.isManual && String(t.projectNumber || '').trim() === pn);
    } catch (err) {
        logger.error('[project-portal] fetchAllTasks (staging) failed:', err);
    }

    // Per-casting day index, computed locally so Staging doesn't depend on the shared task
    // cache already carrying castingDayNumber (it won't until the cache refreshes after a
    // deploy). Same ordering as computeDayNumbers(), so the numbers match what the weekly
    // board reads/writes for the same task.
    const dayByTask = computeCastingDays(scheduled);

    let castingRows = new Map();
    try {
        castingRows = await fetchTaskDescriptionsForProject(currentProjectNumber);
    } catch (err) {
        logger.error('[project-portal] fetchTaskDescriptionsForProject failed:', err);
    }

    currentStagingDescriptions = new Map();
    for (const t of scheduled) {
        const cast = String(t.castingNumber || '').trim();
        const day = dayByTask.get(t) || String(t.castingDayNumber || '').trim();
        if (!cast || !t.department || !day) continue;
        currentStagingDescriptions.set(`${cast}|${t.department}|${day}`, {
            description: t.description || '',
            castingSide: t.castingSide || null
        });
    }
    for (const [k, v] of castingRows) {
        currentStagingDescriptions.set(k, v);
    }

    buildStgScaffold();
    deriveStagingMilestones();
}

// Local per-casting day numbering — mirrors sheets-service computeDayNumbers (group by
// casting + department, order by date then sheet-row index) so the indices are identical
// to what the weekly merge/save use. Lets Staging place descriptions even when the cached
// tasks predate the castingDayNumber field.
function computeCastingDays(tasks) {
    const groups = new Map();
    for (const t of tasks) {
        const cast = String(t.castingNumber || '').trim();
        if (!cast || !t.department) continue;
        const key = cast + '|' + t.department;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(t);
    }
    const dayByTask = new Map();
    for (const list of groups.values()) {
        list.sort((a, b) => {
            const da = Date.parse(a.date) || 0;
            const db = Date.parse(b.date) || 0;
            if (da !== db) return da - db;
            const ai = parseInt((a.id || '').replace('task-', ''), 10) || 0;
            const bi = parseInt((b.id || '').replace('task-', ''), 10) || 0;
            return ai - bi;
        });
        list.forEach((t, idx) => dayByTask.set(t, String(idx + 1)));
    }
    return dayByTask;
}

// Scaffold = the standard department sequence (each with at least Day 1) unioned with every
// (department, day) that already has a saved/scheduled description — so authored rows,
// including non-standard departments, always render.
function buildStgScaffold() {
    currentStagingScaffold = new Map();

    const seen = new Map(); // castingNumber -> Map<dept, maxDaySeen>
    for (const key of currentStagingDescriptions.keys()) {
        const parts = key.split('|');
        const castNum = parts[0];
        const dept = parts[1];
        const day = parseInt(parts[2], 10) || 1;
        if (!seen.has(castNum)) seen.set(castNum, new Map());
        const deptMap = seen.get(castNum);
        deptMap.set(dept, Math.max(deptMap.get(dept) || 0, day));
    }

    for (const casting of currentCastings) {
        const castNum = String(casting.casting_number || '');
        const deptMax = seen.get(castNum) || new Map();
        const depts = [];
        const used = new Set();
        const legacyMill = deptMax.has('Mill') && !deptMax.has('CNC') && !deptMax.has('Parts');
        for (const dept of (legacyMill ? STG_DEPARTMENT_SEQUENCE_MILL : STG_DEPARTMENT_SEQUENCE)) {
            depts.push({ department: dept, days: Math.max(1, deptMax.get(dept) || 0) });
            used.add(dept);
        }
        const extras = [...deptMax.keys()].filter(d => !used.has(d));
        for (const dept of extras) {
            depts.push({ department: dept, days: Math.max(1, deptMax.get(dept) || 1) });
        }
        // Weekly order throughout (a casting with October Mill days and November Parts days reads CNC, Parts, Mill, Form Out…).
        const orderIdx = (d) => { const i = DEPARTMENT_ORDER.indexOf(d); return i === -1 ? Number.MAX_SAFE_INTEGER : i; };
        depts.sort((a, b) => orderIdx(a.department) - orderIdx(b.department));
        currentStagingScaffold.set(castNum, depts);
    }
}

/** The Task box of a staging day: one of the team's tasks (the Plant Scheduler shows this word). */
function stgTaskSelectHtml(castNum, department, day, current) {
    const opts = tasksForDepartment(department);
    const cur = String(current || '').trim();
    if (!opts.length) return cur ? `<span class="pp-stg-task-fixed" title="Task">${escapeHtml(cur)}</span>` : '';
    const missing = !cur ? ' pp-stg-task-missing' : '';
    const extra = cur && !opts.includes(cur) ? `<option value="${escapeAttr(cur)}" selected>${escapeHtml(cur)}</option>` : '';
    return `<select class="pp-stg-task${missing}" data-action="grid-task" data-casting-number="${escapeAttr(castNum)}" data-department="${escapeAttr(department)}" data-day="${day}" title="${cur ? 'Task for this day (shown on the Plant Scheduler)' : 'No task picked yet — pick the task for this day'}">
        <option value=""${cur ? '' : ' selected'}>— task —</option>${extra}
        ${opts.map(o => `<option value="${escapeAttr(o)}"${o === cur ? ' selected' : ''}>${escapeHtml(o.toLowerCase())}</option>`).join('')}
    </select>`;
}
async function handleSaveStagingTask(castNum, dept, day, taskName) {
    if (!currentProjectNumber || !castNum || !dept || !day) return;
    const key = `${castNum}|${dept}|${day}`;
    const cur = currentStagingDescriptions.get(key) || { description: '', castingSide: null };
    currentStagingDescriptions.set(key, { ...cur, taskName: taskName || '' });
    try {
        await upsertTaskDescription({ projectNumber: currentProjectNumber, castingNumber: castNum, department: dept, dayNumber: String(day), taskName: taskName || null });
        const sel = document.querySelector(`#pp-stg-columns select[data-action="grid-task"][data-casting-number="${CSS.escape(castNum)}"][data-department="${CSS.escape(dept)}"][data-day="${day}"]`);
        if (sel) sel.classList.toggle('pp-stg-task-missing', !taskName);
    } catch (err) {
        logger.error('[project-portal] save staging task failed:', err);
        showToast('Save task failed: ' + (err.message || err), 'error');
    }
}

function renderStaging() {
    renderStgPills();
    renderStgColumns();
    document.querySelectorAll('#pp-stg-columns textarea[data-action="grid-desc"]').forEach(autoGrowTextarea);
    updateMsFloat();
}

function getVisibleStagingCastings() {
    const list = getCastingsForActivePhase();
    const total = list.length;
    if (total === 0) return [];
    const activeIdx = list.findIndex(c => c.id === currentStagingCastingId);
    if (total <= 3) return list.slice();
    if (activeIdx <= 0) return list.slice(0, 3);
    if (activeIdx >= total - 1) return list.slice(total - 3);
    return list.slice(activeIdx - 1, activeIdx + 2);
}

function renderStgPills() {
    const wrap = document.getElementById('pp-stg-pills');
    if (!wrap) return;

    const list = getCastingsForActivePhase();
    const total = list.length;
    if (total === 0) { wrap.innerHTML = ''; return; }

    const activeIdx = list.findIndex(c => c.id === currentStagingCastingId);
    const visible = getVisibleStagingCastings();
    const canPrev = activeIdx > 0;
    const canNext = activeIdx >= 0 && activeIdx < total - 1;

    const pills = visible.map(c => {
        const active = c.id === currentStagingCastingId ? ' pp-opt-pill-active' : '';
        return `<button type="button" class="pp-opt-pill${active}" data-casting-id="${escapeAttr(c.id)}">${escapeHtml(c.casting_number || '')}</button>`;
    }).join('');

    wrap.innerHTML = `
        <button type="button" class="pp-opt-nav-btn" data-action="prev" ${canPrev ? '' : 'disabled'} aria-label="Previous casting">&lsaquo;</button>
        ${pills}
        <button type="button" class="pp-opt-nav-btn" data-action="next" ${canNext ? '' : 'disabled'} aria-label="Next casting">&rsaquo;</button>
    `;
}

function renderStgColumns() {
    const wrap = document.getElementById('pp-stg-columns');
    if (!wrap) return;

    const visible = getVisibleStagingCastings();
    if (visible.length === 0) { wrap.innerHTML = ''; return; }

    wrap.innerHTML = visible.map(c => renderStgColumn(c)).join('');
    wrap.style.gridTemplateColumns = `repeat(${visible.length}, minmax(0, 1fr))`;
}

function renderStgColumn(casting) {
    const isActive = casting.id === currentStagingCastingId;
    const colClass = isActive ? 'pp-opt-col pp-opt-col-active' : 'pp-opt-col';
    const castNum = String(casting.casting_number || '');
    const scaffold = currentStagingScaffold.get(castNum) || [];
    const usedDepts = new Set(scaffold.map(s => s.department));

    const deptChip = (dept) => {
        const colorKey = normalizeDepartmentClass(normalizeDepartment(dept));
        const color = DEPARTMENT_COLORS[colorKey];
        const style = color ? ` style="background:${color.background};color:${color.text}"` : '';
        return `<span class="pp-opt-dept-chip"${style}>${escapeHtml(dept)}</span>`;
    };

    const sectionsHtml = scaffold.map(({ department, days }) => {
        const dayRows = [];
        for (let d = 1; d <= days; d++) {
            const entry = currentStagingDescriptions.get(`${castNum}|${department}|${d}`);
            const desc = entry ? (entry.description || '') : '';
            const taskSel = stgTaskSelectHtml(castNum, department, d, entry ? (entry.taskName || '') : '');
            const removable = d === days && days > 1;
            const removeBtn = removable
                ? `<button type="button" class="pp-opt-day-remove" data-action="remove-day" data-casting-number="${escapeAttr(castNum)}" data-department="${escapeAttr(department)}" data-day="${d}" title="Remove Day ${d}" aria-label="Remove Day ${d}">&times;</button>`
                : `<span class="pp-opt-day-remove-spacer" aria-hidden="true"></span>`;
            dayRows.push(`
                <div class="pp-opt-day-row pp-stg-day-row" data-department="${escapeAttr(department)}" data-day="${d}">
                    <span class="pp-opt-day-label">Day ${d}</span>
                    <div class="pp-stg-day-cell">
                        ${taskSel}
                        <textarea class="pp-opt-grid-desc" data-action="grid-desc" data-casting-number="${escapeAttr(castNum)}" data-department="${escapeAttr(department)}" data-day="${d}" rows="2" placeholder="Description…">${escapeHtml(desc)}</textarea>
                    </div>
                    ${removeBtn}
                </div>`);
        }
        return `
            <section class="pp-opt-dept" data-department="${escapeAttr(department)}" data-casting-number="${escapeAttr(castNum)}">
                <div class="pp-opt-dept-head">
                    ${deptChip(department)}
                    <div class="pp-opt-dept-actions">
                        <button type="button" class="pp-opt-add-day" data-action="add-day" data-casting-number="${escapeAttr(castNum)}" data-department="${escapeAttr(department)}" title="Add a day">+ Day</button>
                        <button type="button" class="pp-opt-dept-remove" data-action="remove-dept" data-casting-number="${escapeAttr(castNum)}" data-department="${escapeAttr(department)}" title="Remove ${escapeAttr(department)}" aria-label="Remove ${escapeAttr(department)}">&times;</button>
                    </div>
                </div>
                ${dayRows.join('')}
            </section>`;
    }).join('');

    const addableDepts = DEPARTMENT_ORDER.filter(d => !usedDepts.has(d));
    const addDept = addableDepts.length
        ? `<select class="pp-opt-add-dept" data-action="add-dept" data-casting-number="${escapeAttr(castNum)}" aria-label="Add a department">
                <option value="">+ Department…</option>
                ${addableDepts.map(d => `<option value="${escapeAttr(d)}">${escapeHtml(d)}</option>`).join('')}
            </select>`
        : '';

    const hasStgClipboard = !!(copiedStaging && Array.isArray(copiedStaging.scaffold));
    const stgCopyTitle = `Copy staging cards from Cast ${castNum}`;
    const stgPasteTitle = hasStgClipboard
        ? (copiedStaging.fromCastNum === castNum
            ? 'This casting was copied — paste into another'
            : `Replace Cast ${castNum}'s staging with the copy from Cast ${copiedStaging.fromCastNum}`)
        : 'Nothing copied yet';
    const stgPasteDisabled = (!hasStgClipboard || copiedStaging.fromCastNum === castNum) ? 'disabled' : '';

    return `
        <div class="${colClass}" data-casting-id="${escapeAttr(casting.id)}" data-casting-number="${escapeAttr(castNum)}">
            <div class="pp-opt-col-headerbar">
                <button type="button" class="pp-opt-col-header" data-action="select-col" data-casting-id="${escapeAttr(casting.id)}">
                    <span class="pp-opt-col-label">Cast</span>
                    <span class="pp-opt-col-num">${escapeHtml(castNum)}</span>
                </button>
                <div class="pp-opt-col-actions">
                    <button type="button" class="pp-opt-col-action" data-action="copy-staging" data-casting-number="${escapeAttr(castNum)}" aria-label="${escapeAttr(stgCopyTitle)}" title="${escapeAttr(stgCopyTitle)}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                    </button>
                    <button type="button" class="pp-opt-col-action" data-action="paste-staging" data-casting-number="${escapeAttr(castNum)}" ${stgPasteDisabled} aria-label="${escapeAttr(stgPasteTitle)}" title="${escapeAttr(stgPasteTitle)}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="pp-opt-deptgrid" data-casting-number="${escapeAttr(castNum)}">
                ${sectionsHtml}
            </div>
            ${addDept}
        </div>
    `;
}

async function handleSelectStgCasting(castingId) {
    if (castingId === currentStagingCastingId) return;
    currentStagingCastingId = castingId;
    renderStaging();
}

// Snapshot a casting's staging grid (department/day shape + every non-empty description)
// to the in-memory clipboard so it can be pasted onto another casting.
let copiedStaging_tasks = {};
function handleCopyStaging(castNum) {
    if (!castNum) return;
    const scaffold = currentStagingScaffold.get(castNum) || [];
    const descById = {};
    copiedStaging_tasks = {};
    let count = 0;
    for (const sec of scaffold) {
        for (let d = 1; d <= sec.days; d++) {
            const entry = currentStagingDescriptions.get(`${castNum}|${sec.department}|${d}`);
            const desc = entry ? (entry.description || '') : '';
            if (desc.trim()) {
                descById[`${sec.department}|${d}`] = desc;
                count++;
            }
            if (entry && entry.taskName) (copiedStaging_tasks[`${sec.department}|${d}`] = entry.taskName);
        }
    }
    copiedStaging = {
        fromCastNum: castNum,
        scaffold: scaffold.map(s => ({ department: s.department, days: s.days })),
        descById,
        taskById: { ...copiedStaging_tasks }
    };
    showToast(`Copied staging from Cast ${castNum} (${count} description${count === 1 ? '' : 's'}).`);
    renderStgColumns();   // re-render so the Paste buttons enable on the other columns
}

// Replace a target casting's staging grid with the clipboard copy: clear cells the source
// doesn't cover (or leaves blank), then write the source's descriptions onto it, and match
// the target's department/day shape to the source. casting_side is left untouched.
async function handlePasteStaging(targetCastNum) {
    if (!copiedStaging || !Array.isArray(copiedStaging.scaffold)) return;
    if (!targetCastNum || !currentProjectNumber) return;
    if (targetCastNum === copiedStaging.fromCastNum) return;

    // Source cells (department/day shape) + the description for each.
    const srcKeySet = new Set();   // `${dept}|${day}`
    const srcCells = [];           // { department, day, description }
    for (const sec of copiedStaging.scaffold) {
        for (let d = 1; d <= sec.days; d++) {
            const lk = `${sec.department}|${d}`;
            srcKeySet.add(lk);
            srcCells.push({ department: sec.department, day: d, description: copiedStaging.descById[lk] || '' });
        }
    }

    // Existing saved descriptions on the target.
    const targetKeys = [];   // full `${targetCastNum}|${dept}|${day}` keys
    let hasContent = false;
    for (const [k, v] of currentStagingDescriptions) {
        if (k.indexOf(targetCastNum + '|') !== 0) continue;
        targetKeys.push(k);
        if (v && (v.description || '').trim()) hasContent = true;
    }

    if (hasContent && !window.confirm(
        `Replace all staging descriptions for Cast ${targetCastNum} with the copy from Cast ${copiedStaging.fromCastNum}? This overwrites its current descriptions.`
    )) {
        return;
    }

    try {
        // 1. Clear target cells the source doesn't cover, or that the source leaves blank.
        for (const fullKey of targetKeys) {
            const parts = fullKey.split('|');           // [castNum, dept, day]
            const lk = `${parts[1]}|${parts[2]}`;
            const srcDesc = srcKeySet.has(lk) ? (copiedStaging.descById[lk] || '') : '';
            if (!srcDesc.trim()) {
                await deleteTaskDescription({
                    projectNumber: currentProjectNumber,
                    castingNumber: targetCastNum,
                    department: parts[1],
                    dayNumber: parts[2]
                });
                currentStagingDescriptions.delete(fullKey);
            }
        }
        // 2. Write the source's non-empty descriptions onto the target.
        for (const cell of srcCells) {
            const taskName = (copiedStaging.taskById || {})[`${cell.department}|${cell.day}`] || '';
            if (!(cell.description || '').trim() && !taskName) continue;
            await upsertTaskDescription({
                projectNumber: currentProjectNumber,
                castingNumber: targetCastNum,
                department: cell.department,
                dayNumber: String(cell.day),
                description: cell.description,
                taskName: taskName || null
            });
            const fk = `${targetCastNum}|${cell.department}|${cell.day}`;
            const prev = currentStagingDescriptions.get(fk) || {};
            currentStagingDescriptions.set(fk, { ...prev, description: cell.description, castingSide: prev.castingSide || null, taskName });
        }
        // 3. Match the target's grid shape to the source.
        currentStagingScaffold.set(targetCastNum, copiedStaging.scaffold.map(s => ({ department: s.department, days: s.days })));

        renderStaging();
        showToast(`Pasted staging from Cast ${copiedStaging.fromCastNum} into Cast ${targetCastNum}.`);
    } catch (err) {
        logger.error('[project-portal] paste staging failed:', err);
        showToast('Paste failed: ' + (err.message || err), 'error');
    }
}

function scheduleStagingGridSave(castNum, dept, day, text) {
    if (!castNum || !dept || !day) return;
    const key = `${castNum}|${dept}|${day}`;
    // Keep the local map current so the Staging milestone (red / orange / green) follows the typing.
    const cur = currentStagingDescriptions.get(key) || {};
    currentStagingDescriptions.set(key, { ...cur, description: text == null ? '' : String(text), castingSide: cur.castingSide || null });
    scheduleStagingDerive();
    const prev = stagingGridSaveTimers.get(key);
    if (prev) clearTimeout(prev);
    const t = setTimeout(() => handleSaveStagingDescription(castNum, dept, day, text), 500);
    stagingGridSaveTimers.set(key, t);
}

async function handleSaveStagingDescription(castNum, dept, day, text) {
    if (!currentProjectNumber || !castNum || !dept || !day) return;
    const desc = (text == null) ? '' : String(text);
    const key = `${castNum}|${dept}|${day}`;
    try {
        await upsertTaskDescription({
            projectNumber: currentProjectNumber,
            castingNumber: castNum,
            department: dept,
            dayNumber: String(day),
            description: desc
        });
        // Update the in-memory map without re-rendering so the caret stays put.
        const prev = currentStagingDescriptions.get(key) || {};
        currentStagingDescriptions.set(key, { ...prev, description: desc, castingSide: prev.castingSide || null });
    } catch (err) {
        logger.error('[project-portal] save staging description failed:', err);
        showToast('Save description failed: ' + (err.message || err), 'error');
    }
}

function handleAddStagingDay(castNum, dept) {
    const scaffold = currentStagingScaffold.get(castNum);
    if (!scaffold) return;
    const section = scaffold.find(s => s.department === dept);
    if (!section) return;
    section.days += 1;
    renderStgColumns();
    const ta = document.querySelector(
        `#pp-stg-columns textarea[data-casting-number="${CSS.escape(castNum)}"][data-department="${CSS.escape(dept)}"][data-day="${section.days}"]`
    );
    if (ta) ta.focus();
}

function handleAddStagingDept(castNum, dept) {
    if (!dept) return;
    const scaffold = currentStagingScaffold.get(castNum);
    if (!scaffold) return;
    if (scaffold.some(s => s.department === dept)) return;
    scaffold.push({ department: dept, days: 1 });
    scaffold.sort((a, b) => DEPARTMENT_ORDER.indexOf(a.department) - DEPARTMENT_ORDER.indexOf(b.department));
    renderStgColumns();
}

async function handleRemoveStagingDay(castNum, dept, day) {
    const scaffold = currentStagingScaffold.get(castNum);
    if (!scaffold) return;
    const section = scaffold.find(s => s.department === dept);
    if (!section || section.days <= 1 || day !== section.days) return;
    const key = `${castNum}|${dept}|${day}`;
    const entry = currentStagingDescriptions.get(key);
    if (entry && (entry.description || '').trim()) {
        if (!window.confirm(`Remove Day ${day} of ${dept} for Cast ${castNum}? Its description will be deleted.`)) return;
    }
    try {
        if (entry) {
            await deleteTaskDescription({ projectNumber: currentProjectNumber, castingNumber: castNum, department: dept, dayNumber: String(day) });
            currentStagingDescriptions.delete(key);
        }
        section.days -= 1;
        renderStgColumns();
    } catch (err) {
        logger.error('[project-portal] remove staging day failed:', err);
        showToast('Remove day failed: ' + (err.message || err), 'error');
    }
}

async function handleRemoveStagingDept(castNum, dept) {
    const scaffold = currentStagingScaffold.get(castNum);
    if (!scaffold) return;
    const section = scaffold.find(s => s.department === dept);
    if (!section) return;
    const savedDays = [];
    for (let d = 1; d <= section.days; d++) {
        const entry = currentStagingDescriptions.get(`${castNum}|${dept}|${d}`);
        if (entry) savedDays.push(d);
    }
    const hasContent = savedDays.some(d => ((currentStagingDescriptions.get(`${castNum}|${dept}|${d}`) || {}).description || '').trim());
    if (hasContent && !window.confirm(`Remove ${dept} for Cast ${castNum}? All its descriptions will be deleted.`)) return;
    try {
        for (const d of savedDays) {
            await deleteTaskDescription({ projectNumber: currentProjectNumber, castingNumber: castNum, department: dept, dayNumber: String(d) });
            currentStagingDescriptions.delete(`${castNum}|${dept}|${d}`);
        }
        const idx = scaffold.indexOf(section);
        if (idx >= 0) scaffold.splice(idx, 1);
        renderStgColumns();
    } catch (err) {
        logger.error('[project-portal] remove staging department failed:', err);
        showToast('Remove department failed: ' + (err.message || err), 'error');
    }
}

async function activateActualLaborTab() {
    const container = document.getElementById('pp-actual-labor-container');
    if (!container) return;

    if (!currentProjectNumber) {
        container.innerHTML = '<div class="pp-actual-labor-empty">No project selected.</div>';
        return;
    }

    container.innerHTML = '<div class="pp-actual-labor-empty">Loading…</div>';

    let castings = [];
    let rows = [];
    try {
        [castings, rows] = await Promise.all([
            loadCastings(currentProjectNumber),
            loadActualHoursForProject(currentProjectNumber)
        ]);
    } catch (err) {
        logger.error('[project-portal] activateActualLaborTab load failed:', err);
        container.innerHTML = '<div class="pp-actual-labor-empty">Failed to load actual hours.</div>';
        return;
    }

    if ((!castings || castings.length === 0) && (!rows || rows.length === 0)) {
        container.innerHTML = '<div class="pp-actual-labor-empty">No actual hours logged for this project yet.</div>';
        return;
    }

    renderActualLaborContent(container, castings || [], rows || []);
}

function renderActualLaborContent(container, castings, rows) {
    const escape = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const fmtHours = (n) => Number(n).toFixed(1);
    const parsePlanned = (v) => {
        if (v == null || v === '') return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    };
    // Δ semantics: positive = over budget (BAD/red), negative = under budget (GOOD/green).
    const deltaClass = (delta) => delta > 0 ? 'pp-al-delta-bad' : delta < 0 ? 'pp-al-delta-good' : 'pp-al-delta-zero';
    const fmtDelta = (delta) => (delta > 0 ? '+' : delta < 0 ? '−' : '') + fmtHours(Math.abs(delta));
    const fmtPct = (delta, planned) => {
        if (!planned || planned === 0) return '';
        const pct = (delta / planned) * 100;
        const rounded = Math.abs(pct) >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10;
        return ` (${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(rounded)}%)`;
    };

    const rowsByCasting = new Map();
    for (const row of rows) {
        const key = row.casting_number == null ? '' : String(row.casting_number);
        if (!rowsByCasting.has(key)) rowsByCasting.set(key, []);
        rowsByCasting.get(key).push(row);
    }

    const sortedCastings = [...castings].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const castingKeys = new Set(sortedCastings.map(c => String(c.casting_number)));
    const orphanKeys = [];
    for (const key of rowsByCasting.keys()) {
        if (key === '') continue;
        if (!castingKeys.has(key)) orphanKeys.push(key);
    }
    orphanKeys.sort();

    let projPlanned = 0;
    let projActual = 0;
    let projAnyPlanned = false;
    const groupBodies = [];

    const deptOrderIndex = (dept) => {
        const idx = DEPARTMENT_ORDER.indexOf(normalizeDepartment(dept));
        return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
    };
    const renderDeptChip = (dept) => {
        if (!dept) return '<td>—</td>';
        const colorKey = normalizeDepartmentClass(normalizeDepartment(dept));
        const color = DEPARTMENT_COLORS[colorKey];
        const style = color ? ` style="background:${color.background};color:${color.text}"` : '';
        return `<td><span class="pp-al-dept-chip"${style}>${escape(dept)}</span></td>`;
    };

    const renderGroup = (name, groupRows, miscClass = '') => {
        const sorted = [...groupRows].sort((a, b) => {
            const dateCmp = String(a.task_date || '').localeCompare(String(b.task_date || ''));
            if (dateCmp !== 0) return dateCmp;
            return deptOrderIndex(a.department) - deptOrderIndex(b.department);
        });
        let plannedSum = 0;
        let actualSum = 0;
        let anyPlanned = false;

        const detailRows = sorted.map(r => {
            const planned = parsePlanned(r.planned_hours);
            const actual = Number(r.actual_hours) || 0;
            actualSum += actual;
            projActual += actual;
            let plannedCell = '<td class="num muted">—</td>';
            let deltaCell = '<td class="num muted">—</td>';
            if (planned != null) {
                plannedSum += planned;
                projPlanned += planned;
                anyPlanned = true;
                projAnyPlanned = true;
                plannedCell = `<td class="num">${fmtHours(planned)}</td>`;
                const delta = actual - planned;
                deltaCell = `<td class="num ${deltaClass(delta)}">${fmtDelta(delta)}</td>`;
            }
            const day = r.day_number == null || r.day_number === '' ? '' : `Day ${escape(r.day_number)}`;
            return `<tr class="pp-al-detail-row">
                <td>${escape(r.task_date)}</td>
                ${renderDeptChip(r.department)}
                <td>${day}</td>
                ${plannedCell}
                <td class="num">${fmtHours(actual)}</td>
                ${deltaCell}
            </tr>`;
        }).join('');

        const delta = actualSum - plannedSum;
        const groupDeltaCell = anyPlanned
            ? `<td class="num ${deltaClass(delta)}">${fmtDelta(delta)}<span class="pp-al-pct">${fmtPct(delta, plannedSum)}</span></td>`
            : '<td class="num muted">—</td>';
        const groupPlannedCell = anyPlanned ? `<td class="num">${fmtHours(plannedSum)}</td>` : '<td class="num muted">—</td>';

        return `<tbody class="pp-al-group ${miscClass}">
            <tr class="pp-al-group-row">
                <td colspan="3" class="pp-al-group-name">${escape(name)}</td>
                ${groupPlannedCell}
                <td class="num">${fmtHours(actualSum)}</td>
                ${groupDeltaCell}
            </tr>
            ${detailRows}
        </tbody>`;
    };

    for (const c of sortedCastings) {
        const key = String(c.casting_number);
        const sectionRows = rowsByCasting.get(key) || [];
        if (sectionRows.length === 0) continue;
        const desc = (c.description || '').trim();
        const name = desc ? `Cast ${c.casting_number} — ${desc}` : `Cast ${c.casting_number}`;
        groupBodies.push(renderGroup(name, sectionRows));
    }
    for (const key of orphanKeys) {
        const sectionRows = rowsByCasting.get(key) || [];
        if (sectionRows.length === 0) continue;
        groupBodies.push(renderGroup(`Cast ${key}`, sectionRows));
    }
    const nonCastingRows = rowsByCasting.get('') || [];
    if (nonCastingRows.length > 0) {
        groupBodies.push(renderGroup('Non-casting labor', nonCastingRows, 'pp-al-group-misc'));
    }

    if (groupBodies.length === 0) {
        container.innerHTML = '<div class="pp-actual-labor-empty">No actual hours logged for this project yet.</div>';
        return;
    }

    let summaryHtml;
    if (projAnyPlanned) {
        const delta = projActual - projPlanned;
        summaryHtml = `<div class="pp-al-summary">
            <div class="pp-al-summary-label">Project Total</div>
            <div class="pp-al-summary-stats">
                <span class="pp-al-stat"><span class="pp-al-stat-label">Planned</span><span class="pp-al-stat-value">${fmtHours(projPlanned)}</span></span>
                <span class="pp-al-stat"><span class="pp-al-stat-label">Actual</span><span class="pp-al-stat-value">${fmtHours(projActual)}</span></span>
                <span class="pp-al-stat pp-al-stat-delta ${deltaClass(delta)}"><span class="pp-al-stat-label">Δ</span><span class="pp-al-stat-value">${fmtDelta(delta)}<span class="pp-al-pct">${fmtPct(delta, projPlanned)}</span></span></span>
            </div>
        </div>`;
    } else {
        summaryHtml = `<div class="pp-al-summary">
            <div class="pp-al-summary-label">Project Total</div>
            <div class="pp-al-summary-stats">
                <span class="pp-al-stat"><span class="pp-al-stat-label">Actual</span><span class="pp-al-stat-value">${fmtHours(projActual)}</span></span>
            </div>
        </div>`;
    }

    container.innerHTML = `
        ${summaryHtml}
        <table class="pp-al-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Department</th>
                    <th>Day</th>
                    <th class="num">Planned</th>
                    <th class="num">Actual</th>
                    <th class="num">Δ</th>
                </tr>
            </thead>
            ${groupBodies.join('')}
        </table>
    `;
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
    const mig = document.getElementById('pp-opt-migration'); if (mig) mig.hidden = !isStagingTaskHoursMigrationPending();
    renderOptValue();
    renderOptReadyBar();
    renderOptPills();
    renderOptColumns();
    renderOptTotals();
    ensurePhaseSortable();
    // Size the visible description textareas to fit their content. Hidden
    // (collapsed) cards have display:none so scrollHeight reads 0 — those
    // are sized on toggle-open instead.
    document.querySelectorAll('.pp-opt-card-expanded textarea[data-action="description"]').forEach(autoGrowTextarea);
    updateMsFloat();
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

/** The Final Optimizer HRS cell on a casting column — looks and works like the board's cell (red − / green ✓). */
// ---- "Ready for scheduling" (2026-10-21): puts the casting in the Plant Scheduler's "Not yet scheduled" list.
let optReady = new Map();   // castingId -> { project_number, at }
function optCastingHours(castingId) { const c = currentCastings.find(x => x.id === castingId); return c ? optHoursOf(c) : 0; }
function optReadyHtml(castingId) {
    const on = optReady.has(castingId);
    const at = on && optReady.get(castingId).at ? new Date(optReady.get(castingId).at).toLocaleString() : '';
    const tip = on ? `Ready for scheduling since ${at} — it is in the Plant Scheduler's "Not yet scheduled" list (once it has a Casting Inventory). Click to take it back.`
                   : 'Click when this casting\'s hours are ready to be scheduled — it then shows in the Plant Scheduler\'s "Not yet scheduled" list (it also needs a Casting Inventory).';
    return `<button type="button" class="pp-opt-ready ${on ? 'pp-opt-ready-on' : ''}" data-action="toggle-ready" data-casting-id="${escapeAttr(castingId)}" title="${escapeAttr(tip)}">${on ? '&#10003; Ready for scheduling' : 'Ready for scheduling'}</button>`;
}
// ---- Project value → Optimizer hours (2026-10-27): PMs enter the job's value (base + change orders); ÷ $135 = the
// hours the job has; each casting gets a budget; the budgets must add up to exactly those hours.
let optValueItems = [];          // [{ name, value }]
let optBudgets = new Map();      // castingId -> hours
let optPcts = new Map();         // castingId -> { "dept|day": percent } — the casting's budget is split by these
const optValueSaveTimers = new Map();
async function loadOptValue() {
    optValueItems = []; optBudgets = new Map();
    if (!currentProjectNumber) return;
    try {
        const rows = await loadSettingRows([`value:${currentProjectNumber}`, ...currentCastings.map(c => `budget:${c.id}`), ...currentCastings.map(c => `pct:${c.id}`)]);
        optPcts = new Map();
        for (const c of currentCastings) { const p = rows.get(`pct:${c.id}`); if (p && typeof p === 'object') optPcts.set(c.id, p); }
        const v = rows.get(`value:${currentProjectNumber}`);
        if (v && Array.isArray(v.items)) optValueItems = v.items.map(it => ({ name: String(it.name || ''), value: Number(it.value) || 0 }));
        for (const c of currentCastings) { const b = rows.get(`budget:${c.id}`); if (b != null && b !== '') optBudgets.set(c.id, Number(b) || 0); }
    } catch (e) { logger.warn('[project-portal] loadOptValue failed', e); }
}
function optTotalValue() { return optValueItems.reduce((n, it) => n + (Number(it.value) || 0), 0); }
function optJobHours() { return Math.round(optTotalValue() / REVENUE_PER_HOUR * 10) / 10; }
function optAllocated(castings) { return castings.reduce((n, c) => n + (optBudgets.get(c.id) || 0), 0); }
const money0 = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
function renderOptValue() {
    const box = document.getElementById('pp-opt-value');
    if (!box) return;
    if (!currentProjectNumber) { box.innerHTML = ''; return; }
    const total = optTotalValue(), hours = optJobHours();
    const castings = getCastingsForActivePhase();
    const alloc = optAllocated(castings), left = Math.round((hours - alloc) * 10) / 10;
    const rows = optValueItems.map((it, i) => `<div class="pp-opt-val-row"><input type="text" data-val-name="${i}" value="${escapeAttr(it.name)}" placeholder="${i === 0 ? 'Contract value' : 'Change order #' + i}"><span class="pp-opt-val-cur">$</span><input type="number" min="0" step="1" data-val-amount="${i}" value="${it.value ? escapeAttr(String(it.value)) : ''}" placeholder="0"><button type="button" class="pp-opt-val-del" data-val-del="${i}" title="Remove">&times;</button></div>`).join('');
    const state = !hours ? '' : alloc > hours + 0.01 ? 'pp-opt-val-over' : alloc < hours - 0.01 ? 'pp-opt-val-under' : 'pp-opt-val-ok';
    const msg = !hours ? 'Enter the project value to get the hours.' : alloc > hours + 0.01 ? `Over by ${fmtHrs(alloc - hours)} h — lower a casting's budget.` : alloc < hours - 0.01 ? `${fmtHrs(left)} h still to put on castings.` : 'Every hour is on a casting.';
    box.innerHTML = `<div class="pp-opt-val-head"><strong>Project value &rarr; Optimizer hours</strong><span class="pp-opt-val-hint">value &divide; $${REVENUE_PER_HOUR}/h</span></div>
        <div class="pp-opt-val-rows">${rows || '<div class="pp-opt-val-empty">No value entered yet.</div>'}</div>
        <button type="button" class="pp-opt-val-add" data-val-add>+ Add value (change order, extra)</button>
        <div class="pp-opt-val-totals"><span>Total value <strong>${money0(total)}</strong></span><span>Optimizer hours <strong>${fmtHrs(hours)} h</strong></span><span class="pp-opt-val-alloc ${state}">On castings <strong>${fmtHrs(alloc)} h</strong> · ${escapeHtml(msg)}</span></div>`;
}
/** Re-draw only the totals line while a PM is typing a value (keeps the caret in the box). */
function renderOptValueTotalsOnly() {
    const box = document.getElementById('pp-opt-value'); if (!box) return;
    const tmp = document.createElement('div'); const keep = box.innerHTML; renderOptValue(); tmp.innerHTML = box.innerHTML; box.innerHTML = keep;
    const fresh = tmp.querySelector('.pp-opt-val-totals'), cur = box.querySelector('.pp-opt-val-totals');
    if (fresh && cur) cur.replaceWith(fresh);
    document.querySelectorAll('#pp-opt-columns .pp-opt-budget').forEach(el => { const id = el.querySelector('input')?.dataset.castingId; if (id) el.outerHTML = optBudgetHtml(id); });
}
function fmtHrs(n) { const v = Math.round((Number(n) || 0) * 10) / 10; return Number.isInteger(v) ? String(v) : v.toFixed(1); }
function scheduleOptValueSave() {
    const key = `value:${currentProjectNumber}`;
    const prev = optValueSaveTimers.get(key); if (prev) clearTimeout(prev);
    optValueSaveTimers.set(key, setTimeout(async () => {
        optValueSaveTimers.delete(key);
        try { await setSettingRow(key, { items: optValueItems }); } catch (err) { showToast('Could not save the project value: ' + (err.message || err), 'error'); }
    }, 500));
}
/** Percent of the casting's budget each staged day gets; the hours follow (whole hours, the first day takes the rounding). */
function optPctOf(castingId, dept, day) { const p = optPcts.get(castingId) || {}; const v = p[`${dept}|${day}`]; return v == null || v === '' ? null : Number(v) || 0; }
function optPctTotal(castingId) { return Object.values(optPcts.get(castingId) || {}).reduce((n, v) => n + (Number(v) || 0), 0); }
function optHoursFromPcts(casting) {
    const b = optBudgets.get(casting.id);
    if (b == null) return null;
    const castNum = String(casting.casting_number || '');
    const cells = optStagedCells(castNum).map(c => ({ ...c, pct: optPctOf(casting.id, c.department, c.day) }));
    const withPct = cells.filter(c => c.pct != null);
    if (!withPct.length) return null;
    const out = new Map();
    let sum = 0;
    for (const c of withPct) { const h = Math.floor(b * c.pct / 100); out.set(`${c.department}|${c.day}`, h); sum += h; }
    // when the percentages reach 100 the hours must reach the budget exactly: the first day takes the rounding
    if (Math.abs(optPctTotal(casting.id) - 100) < 0.01 && withPct.length) { const k = `${withPct[0].department}|${withPct[0].day}`; out.set(k, Math.round(((out.get(k) || 0) + (b - sum)) * 10) / 10); }
    return out;
}
async function handleStagedPct(castingId, dept, day, raw) {
    const c = currentCastings.find(x => x.id === castingId);
    if (!c) return;
    const val = raw === '' ? null : Math.max(0, Math.min(100, Number(raw) || 0));
    const map = { ...(optPcts.get(castingId) || {}) };
    const key = `${dept}|${day}`;
    const others = Object.entries(map).filter(([k]) => k !== key).reduce((n, [, v]) => n + (Number(v) || 0), 0);
    if (val != null && others + val > 100.01) {
        showToast(`That makes ${fmtHrs(others + val)}% — the casting's tasks can only add up to 100%. Most this task can take: ${fmtHrs(100 - others)}%.`, 'error');
        renderOptimizer();
        return;
    }
    if (val == null) delete map[key]; else map[key] = val;
    optPcts.set(castingId, map);
    // the hours follow the percentages
    const hours = optHoursFromPcts(c) || new Map();
    const castNum = String(c.casting_number || '');
    for (const cell of optStagedCells(castNum)) {
        const k = `${cell.department}|${cell.day}`;
        const want = hours.has(k) ? hours.get(k) : (optPctOf(castingId, cell.department, cell.day) == null ? cell.hours : null);
        if ((want == null ? null : Number(want)) !== (cell.hours == null ? null : Number(cell.hours))) scheduleOptHoursSave(castNum, cell.department, cell.day, want == null ? '' : String(want));
    }
    renderOptimizer();
    const skey = `pct:${castingId}`;
    const prev = optValueSaveTimers.get(skey); if (prev) clearTimeout(prev);
    optValueSaveTimers.set(skey, setTimeout(async () => { optValueSaveTimers.delete(skey); try { await setSettingRow(skey, map); } catch (err) { showToast('Could not save the percentages: ' + (err.message || err), 'error'); } }, 500));
}

function optBudgetHtml(castingId) {
    const b = optBudgets.get(castingId);
    const c = currentCastings.find(x => x.id === castingId);
    const entered = c ? optHoursOf(c) : 0;
    const over = b != null && entered > b + 0.01;
    return `<div class="pp-opt-budget${over ? ' pp-opt-budget-over' : ''}" title="Hours this casting gets out of the job's Optimizer hours; the hours entered on its days should not exceed it">
        <span class="pp-opt-budget-label">Budget</span><input type="number" min="0" step="0.5" data-action="casting-budget" data-casting-id="${escapeAttr(castingId)}" value="${b == null ? '' : escapeAttr(fmtHrs(b))}" placeholder="0"><span class="pp-opt-budget-unit">h</span>
        <span class="pp-opt-budget-entered">entered ${fmtHrs(entered)} h${over ? ' &#9888;' : ''}</span></div>${b == null ? '' : optPctLineHtml(castingId)}`;
}
function optPctLineHtml(castingId) {
    const t = Math.round(optPctTotal(castingId) * 10) / 10;
    const cls = Math.abs(t - 100) < 0.01 ? 'ok' : t > 100 ? 'over' : 'under';
    const msg = Math.abs(t - 100) < 0.01 ? 'tasks add up to 100%' : t > 100 ? `${fmtHrs(t)}% — over 100` : `${fmtHrs(t)}% assigned, ${fmtHrs(100 - t)}% left`;
    return `<div class="pp-opt-pct-line pp-opt-pct-${cls}">${msg}</div>`;
}
async function handleCastingBudget(castingId, raw) {
    if (!currentProjectNumber) return;
    const val = raw === '' ? null : Math.max(0, Number(raw) || 0);
    const hours = optJobHours();
    const others = optAllocated(getCastingsForActivePhase().filter(c => c.id !== castingId));
    if (val != null && hours > 0 && others + val > hours + 0.01) {
        showToast(`That would put ${fmtHrs(others + val)} h on castings but the job only has ${fmtHrs(hours)} h. Most you can give this casting: ${fmtHrs(hours - others)} h.`, 'error');
        renderOptimizer();
        return;
    }
    if (val == null) optBudgets.delete(castingId); else optBudgets.set(castingId, val);
    const c = currentCastings.find(x => x.id === castingId);
    if (c && optPcts.get(castingId)) {
        const hours = optHoursFromPcts(c) || new Map();
        const castNum = String(c.casting_number || '');
        for (const cell of optStagedCells(castNum)) { const k = `${cell.department}|${cell.day}`; if (hours.has(k) && Number(hours.get(k)) !== Number(cell.hours)) scheduleOptHoursSave(castNum, cell.department, cell.day, String(hours.get(k))); }
    }
    renderOptValue();
    const key = `budget:${castingId}`;
    const prev = optValueSaveTimers.get(key); if (prev) clearTimeout(prev);
    optValueSaveTimers.set(key, setTimeout(async () => {
        optValueSaveTimers.delete(key);
        try { await setSettingRow(key, val); } catch (err) { showToast('Could not save the budget: ' + (err.message || err), 'error'); }
    }, 500));
}

function renderOptReadyBar() {
    const bar = document.getElementById('pp-opt-ready-bar');
    if (!bar) return;
    const list = getCastingsForActivePhase();
    if (!list.length) { bar.innerHTML = ''; return; }
    const n = list.filter(c => optReady.has(c.id)).length;
    const pullable = list.filter(c => optStagedHours(String(c.casting_number || '')) <= 0 && getPhasesFor(c.id).some(p => Number(p.hours) > 0)).length;
    bar.innerHTML = `${pullable ? `<button type="button" class="pp-opt-pull pp-opt-pull-all" data-action="pull-legacy-all" title="Put every casting's previous task list hours onto its staged days">&#8681; Pull previous hours into ${pullable} casting${pullable === 1 ? '' : 's'}</button>` : ''}<span class="pp-opt-ready-count"><strong>${n} of ${list.length}</strong> casting${list.length === 1 ? '' : 's'} ready for scheduling</span>
        ${n < list.length ? '<button type="button" class="pp-opt-ready-all" data-action="ready-all">Mark all castings ready for scheduling</button>' : '<span class="pp-opt-ready-done">&#10003; all ready</span>'}`;
}
async function toggleReady(castingId) {
    if (!castingId || !currentProjectNumber) return;
    const on = !optReady.has(castingId);
    if (on && optCastingHours(castingId) <= 0 && !window.confirm('This casting has no Optimizer Hours yet. Mark it ready for scheduling anyway?')) return;
    try {
        await setReadyFlag(castingId, currentProjectNumber, on);
        if (on) optReady.set(castingId, { project_number: currentProjectNumber, at: new Date().toISOString() }); else optReady.delete(castingId);
        renderOptimizer();
        const c = currentCastings.find(x => x.id === castingId);
        showToast(on ? `Cast ${c?.casting_number || ''} is ready for scheduling` : `Cast ${c?.casting_number || ''} taken back from scheduling`);
    } catch (err) { showToast('Could not save: ' + (err.message || err), 'error'); }
}
async function markAllReady() {
    const list = getCastingsForActivePhase().filter(c => !optReady.has(c.id));
    if (!list.length || !currentProjectNumber) return;
    const empty = list.filter(c => optCastingHours(c.id) <= 0).length;
    if (!window.confirm(`Mark ${list.length} casting${list.length === 1 ? '' : 's'} ready for scheduling?${empty ? `\n\n${empty} of them ha${empty === 1 ? 's' : 've'} no Optimizer Hours yet.` : ''}`)) return;
    try {
        for (const c of list) { await setReadyFlag(c.id, currentProjectNumber, true); optReady.set(c.id, { project_number: currentProjectNumber, at: new Date().toISOString() }); }
        renderOptimizer();
        showToast(`${list.length} casting${list.length === 1 ? '' : 's'} ready for scheduling`);
    } catch (err) { showToast('Could not save: ' + (err.message || err), 'error'); renderOptimizer(); }
}

function optMsCellHtml(castingId) {
    if (!msOn()) return '';
    const green = msStatus(castingId, 'Final Optimizer HRS') === MS.GREEN;
    const tip = green ? 'Final Optimizer HRS: done (also green on the Releasability Board) — click to undo'
                      : 'Final Optimizer HRS: not final yet — click when the hours are final; the Releasability Board follows';
    return `<button type="button" class="pp-opt-ms ${green ? 'pp-opt-ms-green' : 'pp-opt-ms-red'}" data-action="toggle-final-hours" data-casting-id="${escapeAttr(castingId)}" title="${escapeAttr(tip)}">
        <span class="pp-opt-ms-box">${green ? '&#10003;' : '&minus;'}</span><span class="pp-opt-ms-label">Final hrs</span></button>`;
}
async function toggleFinalHours(castingId) {
    if (!castingId) return;
    const green = msStatus(castingId, 'Final Optimizer HRS') === MS.GREEN;
    await msSet(castingId, 'Final Optimizer HRS', green ? MS.RED : MS.GREEN, { note: green ? null : 'Final hours confirmed', stamp: true });
    document.querySelectorAll(`.pp-opt-ms[data-casting-id="${CSS.escape(castingId)}"]`).forEach(el => { el.outerHTML = optMsCellHtml(castingId); });
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
                ${optMsCellHtml(casting.id)}
                ${optReadyHtml(casting.id)}
                ${optBudgetHtml(casting.id)}
            </div>
            ${renderOptStagedGrid(casting)}
            ${phases.some(p => Number(p.hours) > 0) && optStagedHours(String(casting.casting_number || '')) <= 0 ? `<button type="button" class="pp-opt-pull" data-action="pull-legacy" data-casting-id="${escapeAttr(casting.id)}" title="Put the previous task list's hours onto this casting's staged days, team by team">&#8681; Pull hours from the previous task list</button>` : ''}
            ${phases.length ? `<details class="pp-opt-legacy"><summary>Previous task list (${phases.length} task${phases.length === 1 ? '' : 's'} · ${phases.reduce((s, p) => s + (typeof p.hours === 'number' ? p.hours : 0), 0)} hrs) — read only</summary>
            <div class="pp-opt-cards pp-opt-cards-legacy" data-casting-id="${escapeAttr(casting.id)}">
                ${cardsHtml}
            </div></details>` : ''}
            <div class="pp-opt-col-total">
                <span class="pp-opt-col-total-label">Total</span>
                <span class="pp-opt-col-total-value"><strong data-col-total="${escapeAttr(casting.id)}">0</strong> hrs</span>
                ${optMsCellHtml(casting.id)}
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

    // Per-column totals (visible columns only) — staged hours when any, else the previous task list
    document.querySelectorAll('[data-col-total]').forEach(el => {
        const castingId = el.getAttribute('data-col-total');
        const c = currentCastings.find(x => x.id === castingId);
        el.textContent = String(c ? optHoursOf(c) : sumPhases(getPhasesFor(castingId)));
    });
    document.querySelectorAll('[data-dept-total]').forEach(el => {
        const [castNum, dept] = el.getAttribute('data-dept-total').split('|');
        const sec = (currentStagingScaffold.get(castNum) || []).find(s => s.department === dept);
        const n = sec ? Array.from({ length: sec.days }, (_, i) => Number((currentStagingDescriptions.get(`${castNum}|${dept}|${i + 1}`) || {}).hours) || 0).reduce((a, b) => a + b, 0) : 0;
        el.textContent = `${n} hrs`;
    });

    // Grand/Phase total — for phased projects, sum only the active phase's
    // castings so the bottom total reflects the phase you're viewing.
    const grandEl = document.getElementById('pp-opt-grand-total');
    if (grandEl) {
        let grand = 0;
        for (const c of (currentPhasesEnabled ? getCastingsForActivePhase() : currentCastings)) grand += optHoursOf(c);
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
    const all = getInventoryFor(castingId);
    if (all.length === 0) return;
    const picked = invSelectedIn(castingId);
    const items = picked.length ? picked : all;          // ticked rows only, else the whole casting
    copiedComponents = items.map(inventoryClipItem);
    for (const it of items) invSelected.delete(it.id);
    const casting = currentCastings.find(c => c.id === castingId);
    const n = copiedComponents.length;
    showToast(`Copied ${n} component${n === 1 ? '' : 's'} from Cast ${casting?.casting_number || ''}. Use Paste on another casting.`);
    renderCastings();
}

/** Cut = copy to the clipboard, then remove here. Paste puts them into another casting. */
async function cutInventoryItems(castingId, items, label) {
    const casting = currentCastings.find(c => c.id === castingId);
    if (isCastingInventoryLocked(casting)) { showCastingLockedToast(casting); return; }
    if (!items.length) return;
    copiedComponents = items.map(inventoryClipItem);
    try {
        for (const it of items) {
            const t = inventorySaveTimers.get(it.id);
            if (t) { clearTimeout(t); inventorySaveTimers.delete(it.id); }
        }
        await Promise.all(items.map(it => deleteInventoryItem(it.id)));
        const gone = new Set(items.map(it => it.id));
        setInventoryFor(castingId, getInventoryFor(castingId).filter(c => !gone.has(c.id)));
        for (const id of gone) invSelected.delete(id);
        renderCastings();
        syncTrackingFromInventory();
        msInventoryChanged(castingId);
        showToast(`Cut ${label} from Cast ${casting?.casting_number || ''} — use Paste on the casting it belongs to.`);
    } catch (err) {
        logger.error('[project-portal] cut components failed:', err);
        showToast('Cut failed: ' + (err.message || err), 'error');
        renderCastings();
    }
}
function handleCutInventoryRow(castingId, itemId) {
    const item = getInventoryFor(castingId).find(it => it.id === itemId);
    if (item) cutInventoryItems(castingId, [item], `"${item.type || '(untitled)'}"`);
}
function handleCutSelected(castingId) {
    const items = invSelectedIn(castingId);
    cutInventoryItems(castingId, items, `${items.length} component${items.length === 1 ? '' : 's'}`);
}

function handleCopyInventoryRow(castingId, itemId) {
    const item = getInventoryFor(castingId).find(it => it.id === itemId);
    if (!item) return;
    copiedComponents = [{
        type: item.type,
        width: item.width,
        length: item.length,
        color: item.color,
        sealer: item.sealer,
        quantity: item.quantity,
        extras: item.extras,
        cu_ft: item.cu_ft,
        ff_sq_ft: item.ff_sq_ft
    }];
    const casting = currentCastings.find(c => c.id === castingId);
    showToast(`Copied "${item.type || '(untitled)'}" from Cast ${casting?.casting_number || ''}. Use Paste on another casting.`);
    renderCastings();
}

async function handlePasteComponents(targetCastingId) {
    if (!Array.isArray(copiedComponents) || copiedComponents.length === 0) return;
    if (!targetCastingId) return;
    const targetCasting = currentCastings.find(c => c.id === targetCastingId);
    if (isCastingInventoryLocked(targetCasting)) {
        showCastingLockedToast(targetCasting);
        return;
    }
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
        if (n) ciEntered(targetCastingId);
        syncTrackingFromInventory();
        msInventoryChanged(targetCastingId);
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

// Numeric-ish comparator for casting_number — handles "1","2","10" correctly
// while staying stable on non-numeric values ("A1","C-3") via string fallback.
function compareCastingNumber(a, b) {
    const an = parseInt(String(a ?? ''), 10);
    const bn = parseInt(String(b ?? ''), 10);
    const aNum = Number.isFinite(an);
    const bNum = Number.isFinite(bn);
    if (aNum && bNum && an !== bn) return an - bn;
    if (aNum && !bNum) return -1;
    if (!aNum && bNum) return 1;
    return String(a ?? '').localeCompare(String(b ?? ''));
}

// Inventory edits to an earlier casting can shift panel_id numbering inside
// later castings (panel_ids are assigned by a per-type running counter across
// all castings in sort order — see runTrackingSync). Once any tracking state
// (rejected / produced / crate_id) exists, a renumber would re-attach those
// marks to the wrong physical panel. To prevent silent corruption, once a
// casting has any tracking state on it, that casting AND every casting with
// a lower casting_number become inventory-read-only. Tracking operations
// (reject / produced / crate toggles) stay fully live so the user can keep
// marking production progress on locked castings.
/* ===================== Releasability milestones (2026-10-15) =====================
   The board's AUTO columns live in casting_milestones (one row per casting per column):
   red / orange / green. Prints stamp them green (orange when the inventory was not final),
   the Casting Inventory lock drives its own column, Color Log and Staging are derived. */
function msOn() { return milestonesApply(currentProjectNumber); }
function msRow(castingId, m) { return msByCasting.get(castingId)?.get(m) || null; }
function msStatus(castingId, m) { return msRow(castingId, m)?.status || MS.RED; }
function ciStatus(castingId) { return msStatus(castingId, 'Casting Inventory'); }
function ciFinal(castingId) { return ciStatus(castingId) === MS.GREEN; }
function ciLockedById(castingId) { const r = castingId ? msRow(castingId, 'Casting Inventory') : null; return !!(msOn() && r && r.status === MS.GREEN && r.locked); }
function msCastName(id) { return 'Cast ' + (currentCastings.find(c => c.id === id)?.casting_number || '?'); }
/** True once this job has any portal record at all — from then on it is on the new format (derived states included). */
function msProjectTouched() { for (const m of msByCasting.values()) if (m && m.size) return true; return false; }

async function loadMilestones() {
    msByCasting = new Map();
    if (!currentProjectNumber || !msOn()) { updateMsFloat(); return; }
    try { msByCasting = await loadMilestonesForProject(currentProjectNumber); }
    catch (err) { logger.error('[milestones] load failed', err); }
    deriveColorLogMilestones();
    updateMsFloat();
    renderClassroomMs();
}
async function msSet(castingId, milestone, status, { note = null, locked = false, stamp = false } = {}) {
    if (!msOn() || !castingId) return null;
    const prev = msRow(castingId, milestone);
    const row = { project_number: currentProjectNumber, casting_id: castingId, milestone, status, locked, note,
                  stamped_at: stamp ? new Date().toISOString() : (prev?.stamped_at ?? null) };
    if (!msByCasting.has(castingId)) msByCasting.set(castingId, new Map());
    msByCasting.get(castingId).set(milestone, row);
    updateMsFloat(); refreshInlineMs();
    const firstTouch = !prev && [...msByCasting.values()].reduce((n, m) => n + m.size, 0) === 1;
    try {
        const saved = await saveMilestone({ projectNumber: currentProjectNumber, castingId, milestone, status, locked, note, stampedAt: row.stamped_at });
        if (saved) { msByCasting.get(castingId).set(milestone, saved); updateMsFloat(); refreshInlineMs(); }
        if (firstTouch) { deriveColorLogMilestones(); deriveStagingMilestones(); }
        else if (isMilestonesMigrationPending()) showToast('Not saved: the casting_milestones table does not exist yet — run migration/casting-milestones.sql in Supabase.', 'error');
    } catch (err) {
        logger.error('[milestones] save failed', err);
        showToast('Could not save the milestone: ' + (err?.message || err), 'error');
    }
    return row;
}
/** Something was printed (or saved) for these castings: green, or orange when the inventory was not final. */
function stampPrinted(castingIds, milestone) {
    if (!msOn()) return;
    for (const id of (castingIds || []).filter(Boolean)) {
        const final = !CI_DEPENDENT.includes(milestone) || ciFinal(id);
        msSet(id, milestone, final ? MS.GREEN : MS.ORANGE, { note: final ? null : 'Printed before Casting Inventory was final', stamp: true });
    }
}
function msFlushPendingStamp() { const p = msPendingStamp; msPendingStamp = null; if (p) stampPrinted(p.ids, p.milestone); }
/** Work has started on this item (forms laid out, jig list imported…): red becomes orange; green and orange stay. */
function markWorking(castingId, milestone, note = null, onlyIfTouched = false) {
    if (!msOn() || !castingId) return;
    if (onlyIfTouched && !msProjectTouched()) return;   // looking at an old job is not touching it
    if (msStatus(castingId, milestone) === MS.RED) msSet(castingId, milestone, MS.ORANGE, { note, stamp: true });
}
/** Inline dots (Tracking tab) follow the cache. */
/* Class Rooms tab: one board cell per classroom for the whole JOB. Clicking it marks the classroom held for every
   casting in the phase (rows noted "Classroom n held"); clicking again clears them all. A per-casting change made on
   the board afterwards (e.g. cast 6 set red because it needs its own classroom) is an exception the board keeps —
   it does not move this cell. */
function classroomHeldNote(n) { return `Classroom ${n} held`; }
function classroomHeld(n) {
    const m = `Classroom #${n}`;
    return getCastingsForActivePhase().some(c => { const r = msRow(c.id, m); return r && r.status === MS.GREEN && r.note === classroomHeldNote(n); });
}
function classroomMsHtml(n) {
    const m = `Classroom #${n}`;
    const scoped = getCastingsForActivePhase();
    if (!msOn() || !scoped.length) return '';
    const held = classroomHeld(n);
    const exceptions = held ? scoped.filter(c => msStatus(c.id, m) !== MS.GREEN).length : 0;
    const s = held ? MS.GREEN : MS.RED;
    const tip = held
        ? `${m}: held for this job${exceptions ? ` (${exceptions} casting${exceptions === 1 ? '' : 's'} set differently on the Releasability Board)` : ''} — click to clear it for every casting`
        : `${m}: not held yet — click when the classroom has been held; every casting goes green on the Releasability Board`;
    return `<button type="button" class="pp-opt-ms pp-opt-ms-${s}" data-action="toggle-classroom" data-classroom="${n}" title="${escapeAttr(tip)}"><span class="pp-opt-ms-box">${held ? '&#10003;' : '&minus;'}</span><span class="pp-opt-ms-label">Board</span></button>`;
}
function renderClassroomMs() {
    document.querySelectorAll('[data-cr-ms]').forEach(el => { el.innerHTML = classroomMsHtml(el.dataset.crMs); });
}
async function toggleClassroom(n) {
    const m = `Classroom #${n}`;
    const scoped = getCastingsForActivePhase();
    if (!scoped.length) return;
    const held = classroomHeld(n);
    for (const c of scoped) {
        if (held) { if (msStatus(c.id, m) !== MS.RED) await msSet(c.id, m, MS.RED, { note: null, stamp: true }); }
        else await msSet(c.id, m, MS.GREEN, { note: classroomHeldNote(n), stamp: true });
    }
    renderClassroomMs();
}
function refreshInlineMs() {
    document.querySelectorAll('[data-ms-track]').forEach(el => { el.innerHTML = trackMsInner(el.dataset.msTrack); });
    renderClassroomMs();
    document.querySelectorAll('.pp-appr-cell[data-casting-id]').forEach(el => { el.outerHTML = apprCellHtml(el.dataset.castingId, el.dataset.milestone); });
}
function trackMsInner(castingId) {
    const one = (m, label) => { const r = msRow(castingId, m); const when = msWhen(r); const tip = `${label}: ${r?.status || 'red'}${msNote(r) ? ' — ' + msNote(r) : ''}${when ? ' (since ' + when + ')' : ''}`;
        return `<span class="pp-track-ms-item" title="${escapeAttr(tip)}">${msDot(r?.status || MS.RED)}<span>${escapeHtml(label)}</span></span>`; };
    return one('Labels', 'Labels') + one('Final Tracking', 'Tracking');
}
function trackMsHtml(castingId) { return msOn() ? `<span class="pp-track-ms" data-ms-track="${escapeAttr(castingId)}">${trackMsInner(castingId)}</span>` : ''; }
/** Where floating boxes may start: under the portal header, and under the Releasability bar when it is showing. */
function msTopOffset() { return (msFloatEl && !msFloatEl.hidden) ? msFloatEl.getBoundingClientRect().bottom + 8 : msBarTop(); }
/** The bar sits under the project row ("Back to list · 0860 · Print…") while that row is on screen, else under the header. */
function msBarTop() {
    const controls = document.querySelector('#pp-form-view .pp-form-controls');
    const cb = controls && !controls.closest('[hidden]') ? controls.getBoundingClientRect().bottom : 0;
    return Math.max(headerBottom(), cb);
}
function msArmStamp(ids, milestone) { msPendingStamp = { ids, milestone }; setTimeout(() => { if (msPendingStamp && msPendingStamp.milestone === milestone) msPendingStamp = null; }, 8000); }
/** The inventory of this casting changed: everything printed from it is out of date until reprinted. */
// ---- Inventory fingerprints (2026-10-19/20): the lock remembers what each linked print saw in the inventory
// (one short hash per print, kept at the end of the Casting Inventory milestone's note as [inv:b=…;l=…;…]).
// Each print only reacts to the fields it uses (user's matrix 2026-10-20): volume / sq ft touch Batching Sheets
// only, sizes touch the sheet-type prints, colour touches Batching Sheets only, row order never counts. An edit
// that leaves a print's fields as printed is not a change for that print: ones that went orange because of our
// own edits go back to green (their print stamp stays).
const INV_MARK_RE = /\s*\[inv:([^\]]+)\]$/;
const INV_CHANGED_NOTE = 'Casting Inventory changed after this was printed — print it again';
const INV_PRINT_FIELDS = {
    'Batching Sheets': ['cu_ft', 'ff_sq_ft', 'color_log_id', 'quantity', 'extras'],
    'Labels':          ['type', 'width', 'length', 'quantity', 'extras'],
    'Final Tracking':  ['type', 'width', 'length', 'quantity', 'extras'],
    'Casting Layout':  ['type', 'width', 'length', 'quantity', 'extras'],
    'Jig List':        ['type', 'width', 'length']
};
const INV_MARK_KEYS = { 'Batching Sheets': 'b', 'Labels': 'l', 'Final Tracking': 't', 'Casting Layout': 'c', 'Jig List': 'j' };
/** A milestone note without the hidden inventory marker. */
function msNote(r) { return String(r?.note || '').replace(INV_MARK_RE, ''); }
function invHash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36); }
/** Fingerprint of the inventory as one print sees it: the sorted set of its rows' relevant fields (row order ignored, rows added/removed counted). */
function invFingerprint(castingId, milestone) {
    const fields = INV_PRINT_FIELDS[milestone] || [];
    const rows = getInventoryFor(castingId).map(it => fields.map(k => (it[k] === null || it[k] === undefined ? '' : String(it[k]))).join('|'));
    rows.sort();
    return invHash(rows.join('\n')) + '-' + rows.length;
}
/** All per-print fingerprints as one marker body: b=…;l=…;t=…;c=…;j=… */
function invMarks(castingId) { return CI_DEPENDENT.map(m => INV_MARK_KEYS[m] + '=' + invFingerprint(castingId, m)).join(';') + ';bc=' + invColourFingerprint(castingId); }
/** The colour logs the inventory uses (rows with pieces), order ignored — stored as bc=… so a colour change is always a reprint. */
function invColourFingerprint(castingId) {
    const ids = [...new Set(getInventoryFor(castingId).filter(r => ((Number(r.quantity) || 0) + (Number(r.extras) || 0)) > 0).map(r => String(r.color_log_id || '')))].sort();
    return invHash(ids.join('|')) + '-' + ids.length;
}
/** The colour fingerprint stored at the last "ready" ('' when that lock predates it). */
function invBaselineColour(castingId) {
    const m = String(msRow(castingId, 'Casting Inventory')?.note || '').match(INV_MARK_RE);
    const part = m ? m[1].split(';').find(p => p.startsWith('bc=')) : null;
    return part ? part.slice(3) : '';
}
/** Baselines stored at lock time: milestone -> hash (empty when the lock predates per-print marks). */
function invBaselines(castingId) {
    const m = String(msRow(castingId, 'Casting Inventory')?.note || '').match(INV_MARK_RE);
    const out = {};
    if (!m || !m[1].includes('=')) return out;
    for (const part of m[1].split(';')) {
        const [k, v] = part.split('=');
        const ms = Object.keys(INV_MARK_KEYS).find(name => INV_MARK_KEYS[name] === k);
        if (ms && v) out[ms] = v;
    }
    return out;
}
function withInvMark(note, marks) { return `${note || ''} [inv:${marks}]`; }
/** The marker body already stored on the Casting Inventory row (kept as-is through an unlock). */
function invMarks0(castingId) { const m = String(msRow(castingId, 'Casting Inventory')?.note || '').match(INV_MARK_RE); return m ? m[1] : ''; }

function msInventoryChanged(castingId) {
    if (!msOn() || !castingId) return;
    const base = invBaselines(castingId);
    for (const m of CI_DEPENDENT) {
        const r = msRow(castingId, m);
        if (!r) continue;
        const asPrinted = !!base[m] && invFingerprint(castingId, m) === base[m];
        if (asPrinted) {
            if (r.status === MS.ORANGE && r.note === INV_CHANGED_NOTE) msSet(castingId, m, MS.GREEN, { note: null });   // this print's fields are back as printed; the stamp stays
        } else if (r.status === MS.GREEN && !String(r.note || '').startsWith(LAYOUT_CONDITION_PREFIX)) {
            msSet(castingId, m, MS.ORANGE, { note: INV_CHANGED_NOTE });
        }
    }
    deriveColorLogMilestones();
}
/** Color Log: red = no color on the casting, orange = color entered, green = color log printed since. */
function deriveColorLogMilestones() {
    if (!msOn() || !msProjectTouched()) return;
    for (const c of currentCastings) {
        const r = msRow(c.id, 'Color Log');
        if (r && r.status === MS.GREEN) continue;
        const hasColor = getInventoryFor(c.id).some(it => it.color_log_id);
        const want = hasColor ? MS.ORANGE : MS.RED;
        if ((r?.status || MS.RED) !== want) msSet(c.id, 'Color Log', want, { note: hasColor ? 'Color entered — print the color log' : null });
    }
}
/** Staging: red = nothing filled, orange = some, green = every staging field of the casting filled. */
function deriveStagingMilestones() {
    if (!msOn() || !currentStagingScaffold.size || !msProjectTouched()) return;
    for (const c of currentCastings) {
        const castNum = String(c.casting_number || '');
        const depts = currentStagingScaffold.get(castNum) || [];
        let total = 0, filled = 0;
        for (const d of depts) for (let day = 1; day <= d.days; day++) {
            total++;
            if ((currentStagingDescriptions.get(`${castNum}|${d.department}|${day}`)?.description || '').trim()) filled++;
        }
        const want = total && filled === total ? MS.GREEN : (filled ? MS.ORANGE : MS.RED);
        if (msStatus(c.id, 'Staging') !== want) msSet(c.id, 'Staging', want, { note: total ? `${filled} of ${total} staging fields filled` : null, stamp: want === MS.GREEN });
    }
}
let msStagingDeriveTimer = null;
function scheduleStagingDerive() { clearTimeout(msStagingDeriveTimer); msStagingDeriveTimer = setTimeout(deriveStagingMilestones, 700); }

// ---- Casting Inventory box (2026-10-20): red = nothing entered, orange = in progress (from the first entry, by
// itself), green + locked = engineering marked it ready. Two buttons: the PM's "Ready for engineering" only tells
// engineering (the board does not change); engineering's "Casting Inventory ready" makes the inventory final and
// read-only ("Make changes" undoes that, as the old unlock did).
const CI_ENTERING_NOTE = 'Being entered';
const CI_PM_NOTE = 'Ready for engineering';
const CI_READY_NOTE = 'Casting Inventory ready — final';
const CI_UNLOCKED_NOTE = 'Unlocked for changes — mark it ready again when done';
/** The PM has pressed "Ready for engineering" (or engineering already marked the inventory ready). */
function ciPmDone(castingId) { const r = msRow(castingId, 'Casting Inventory'); return !!r && (r.status === MS.GREEN || msNote(r).startsWith(CI_PM_NOTE)); }
/** A new note for the Casting Inventory row that keeps the hidden print marker when there is one. */
function ciNoteKeepMarks(castingId, note) { const m = invMarks0(castingId); return m ? withInvMark(note, m) : note; }
/** The first entry on a casting's inventory: red becomes orange by itself (it never goes back to red by itself). */
function ciEntered(castingId) { markWorking(castingId, 'Casting Inventory', CI_ENTERING_NOTE); }
async function ciPmReady(castingId) {
    if (ciStatus(castingId) === MS.GREEN) return;
    await msSet(castingId, 'Casting Inventory', MS.ORANGE, { note: ciNoteKeepMarks(castingId, CI_PM_NOTE), stamp: true });
    renderCastings();
}
async function ciAdvance(castingId) {
    if (ciStatus(castingId) !== MS.ORANGE) return;   // nothing entered yet, or already ready
    const reprint = await ciBatchReprintCheck(castingId);   // against the as-printed marks, before the new ones replace them
    await msSet(castingId, 'Casting Inventory', MS.GREEN, { locked: true, note: withInvMark(CI_READY_NOTE, invMarks(castingId)), stamp: true });
    invEdits.clear();
    ciBatchReprintReport(castingId, reprint);
    renderCastings();
}
/** Batch tickets printed from this inventory went orange because of the edits: do their numbers really change?
 *  null = nothing to say (not printed, or orange for another reason); 'same' = the tickets come out the same and the
 *  colours are as printed; 'changed' = print them again. Special batching pages (Jane Street) are not compared yet. */
async function ciBatchReprintCheck(castingId) {
    const r = msRow(castingId, 'Batching Sheets');
    if (!r || r.status !== MS.ORANGE || r.note !== INV_CHANGED_NOTE) return null;
    const bcBase = invBaselineColour(castingId);
    if (!bcBase || bcBase !== invColourFingerprint(castingId)) return 'changed';   // colour changed, or an older lock with no colour record
    if (getSpecialBatching(currentProjectNumber)) return specialReprintCheck(castingId);   // the Jane Street page compares its own tickets
    try { await ensureBatchTicketsLoaded(); } catch { return 'changed'; }
    return btReprintCheck(castingId) === 'same' ? 'same' : 'changed';
}
/** Special batching page (Jane Street): the embedded page compares its own tickets with the inventory as it is now.
 *  The frame is loaded when the tab was never opened; no answer within 15 s counts as "changed". */
let specialReprintSeq = 0;
const specialReprintWaiting = new Map();   // token -> resolve
function specialReprintCheck(castingId) {
    const frame = getSpecialBatchingFrame();
    if (!frame) return Promise.resolve('changed');
    if (!frame.getAttribute('src')) renderSpecialBatching();
    const token = 'rc' + (++specialReprintSeq);
    return new Promise(resolve => {
        const timer = setTimeout(() => { specialReprintWaiting.delete(token); resolve('changed'); }, 15000);
        specialReprintWaiting.set(token, (v) => { clearTimeout(timer); specialReprintWaiting.delete(token); resolve(v === 'same' ? 'same' : 'changed'); });
        const send = () => frame.contentWindow?.postMessage({ type: 'jsb-reprint-check', castingId, token }, location.origin);
        send();
        frame.addEventListener('load', send, { once: true });   // a page still loading has no listener yet: ask again once it is there
    });
}
/** Special page: the "inventory is being updated" banner sits above the frame (the page itself knows nothing of milestones). */
function updateSpecialUpdatingBanner() {
    const wrap = document.getElementById('pp-bt-special');
    if (!wrap) return;
    let el = document.getElementById('pp-bt-special-updating');
    if (!el) { el = document.createElement('div'); el.id = 'pp-bt-special-updating'; wrap.insertBefore(el, wrap.firstChild); }
    const id = msBatchCastingId();
    const casting = id ? currentCastings.find(c => c.id === id) : null;
    el.innerHTML = casting ? renderBatchUpdatingBanner(casting) : '';
}
function ciBatchReprintReport(castingId, verdict) {
    if (!verdict) return;
    const name = msCastName(castingId);
    if (verdict === 'same') {
        msSet(castingId, 'Batching Sheets', MS.GREEN, { note: null });   // the print stamp stays: the printed tickets are still right
        showToast(`${name}: the batch tickets come out the same — no need to print them again.`, 'success', 10000);
    } else {
        showToast(`${name}: the batch tickets change — print them again (Batching Sheets stays orange on the board until you do).`, 'warning', 10000);
    }
}
async function ciUnlock(castingId) {
    // Keep the ready inventory's fingerprint (older locks have none: the inventory as it is now becomes the baseline).
    await msSet(castingId, 'Casting Inventory', MS.ORANGE, { locked: false, note: withInvMark(CI_UNLOCKED_NOTE, Object.keys(invBaselines(castingId)).length ? invMarks0(castingId) : invMarks(castingId)), stamp: true });
    renderCastings();
}
/** The two buttons of the Casting Inventory box. attr: 'data-action' (casting card) or 'data-ms' (floating box). */
function ciActionsHtml(castingId, attr) {
    const s = ciStatus(castingId), ready = s === MS.GREEN, pmDone = ciPmDone(castingId);
    const a = (name) => attr === 'data-action' ? `data-action="${name}"` : `data-${name}="${escapeAttr(castingId)}"`;
    const pm = pmDone
        ? `<button type="button" class="pp-ms-btn pp-ms-btn-done" disabled title="The PM's fields are done — engineering enters Cu Ft and FF Sq Ft">&#10003; Ready for engineering</button>`
        : `<button type="button" class="pp-ms-btn pp-ms-btn-pm" ${a('ms-ci-pm')} title="PM: Qty, Extras, Type, Width, Length, Color and Remake Of are done — this only tells engineering (the board does not change)">Ready for engineering</button>`;
    const eng = ready
        ? `<button type="button" class="pp-ms-btn pp-ms-btn-done" disabled title="Engineering marked this inventory ready — it is final and read-only">&#10003; Casting Inventory ready</button><button type="button" class="pp-ms-btn pp-ms-btn-unlock" ${a('ms-ci-unlock')} title="Make changes — anything printed from this inventory turns orange on the board once it changes">Make changes</button>`
        : `<button type="button" class="pp-ms-btn pp-ms-btn-eng" ${a('ms-ci-advance')}${s === MS.RED ? ' disabled' : ''} title="${s === MS.RED ? 'Nothing entered yet' : 'Engineering: Cu Ft and FF Sq Ft are done — the inventory becomes final and read-only (green on the board)'}">Casting Inventory ready</button>`;
    return `<span class="pp-ms-ci-pm">${pm}</span><span class="pp-ms-ci-eng">${eng}</span>`;
}

// ---- Print gate: inventory-based printouts warn (and wait) while the inventory is not final.
async function printGate(castingIds, milestone) {
    if (!msOn() || !CI_DEPENDENT.includes(milestone)) return true;
    const notFinal = (castingIds || []).filter(id => id && !ciFinal(id));
    if (!notFinal.length) return true;
    const names = notFinal.map(id => currentCastings.find(c => c.id === id)?.casting_number || '?');
    return new Promise(resolve => {
        document.getElementById('pp-ms-gate')?.remove();
        const el = document.createElement('div');
        el.id = 'pp-ms-gate';
        el.className = 'pp-ms-gate';
        el.innerHTML = `<div class="pp-ms-gate-box" role="dialog" aria-modal="true">
            <div class="pp-ms-gate-title">&#9888; Casting Inventory is not final</div>
            <div class="pp-ms-gate-text"><b>${escapeHtml(milestone)}</b> for cast${names.length === 1 ? '' : 's'} <b>${escapeHtml(names.join(', '))}</b> would be printed from an inventory engineering has not marked ready yet.
                Finish the inventory first (Castings tab &rarr; "Casting Inventory ready"), then print.</div>
            <div class="pp-ms-gate-actions">
                <button type="button" class="pp-ms-gate-cancel" data-ms-gate-cancel>Cancel</button>
                <button type="button" class="pp-ms-gate-hold" data-ms-gate-hold title="Special cases only: hold for 5 seconds, then click to print anyway — the board shows it orange"><span class="pp-ms-gate-hold-bar"></span><span class="pp-ms-gate-hold-label">Hold 5 s to print anyway</span></button>
            </div></div>`;
        document.body.appendChild(el);
        let armed = false, t0 = 0, raf = 0, timer = 0;
        const hold = el.querySelector('[data-ms-gate-hold]');
        const bar = el.querySelector('.pp-ms-gate-hold-bar');
        const label = el.querySelector('.pp-ms-gate-hold-label');
        const done = (ok) => { clearTimeout(timer); cancelAnimationFrame(raf); el.remove(); document.removeEventListener('keydown', onKey); resolve(ok); };
        const onKey = (e) => { if (e.key === 'Escape') done(false); };
        document.addEventListener('keydown', onKey);
        el.querySelector('[data-ms-gate-cancel]').addEventListener('click', () => done(false));
        el.addEventListener('click', (e) => { if (e.target === el) done(false); });
        const reset = () => { if (armed) return; clearTimeout(timer); cancelAnimationFrame(raf); bar.style.width = '0%'; label.textContent = 'Hold 5 s to print anyway'; hold.classList.remove('pp-ms-gate-holding'); };
        const tick = () => { const p = Math.min(1, (Date.now() - t0) / 5000); bar.style.width = (p * 100).toFixed(1) + '%'; label.textContent = `Keep holding… ${Math.ceil(5 - p * 5)} s`; raf = requestAnimationFrame(tick); };
        hold.addEventListener('pointerdown', (e) => {
            if (armed) return;
            e.preventDefault();
            t0 = Date.now(); hold.classList.add('pp-ms-gate-holding'); tick();
            timer = setTimeout(() => { cancelAnimationFrame(raf); armed = true; bar.style.width = '100%'; hold.classList.add('pp-ms-gate-armed'); label.textContent = 'Click to print anyway'; }, 5000);
        });
        for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) hold.addEventListener(ev, reset);
        hold.addEventListener('click', () => { if (armed) done(true); });   // a fresh click, so the print window is allowed to open
    });
}
window.__ppMilestones = { printGate, stampPrinted, markWorking, topOffset: msTopOffset, on: msOn, setJigCasting: (id) => { msJigCastingId = id; updateMsFloat(); } };
// Read-only hooks for checking the batch-ticket comparison from the console (nothing here saves).
window.__ppBatchCheck = { reprint: btReprintCheck, signature: btPlanSignature, banner: renderBatchStaleBanner, tickets: getBatchTicketList, inventory: getInventoryFor, castings: () => currentCastings, load: ensureBatchTicketsLoaded };

// ---- The floating "Releasability Board" box (bottom right) — what the current tab drives.
function msDot(status) { return `<span class="pp-ms-dot pp-ms-${status}"${status === MS.NA ? ' title="N/A"' : ''}></span>`; }

// ---- Jig List conditions (2026-10-16): "No jigs" = N/A on the board; "No scrim" = recorded on the casting.
const JIG_COND_NOJIGS = 'No jigs', JIG_COND_NOSCRIM = 'No scrim';
function jigConditionOf(castingId) {
    const r = msRow(castingId, 'Jig List');
    if (!r) return '';
    if (r.status === MS.NA) return 'nojigs';
    if (String(r.note || '') === JIG_COND_NOSCRIM) return 'noscrim';
    return '';
}
function jigConditionHtml(castingId) {
    const cur = jigConditionOf(castingId);
    return `<label class="pp-ms-tick pp-ms-cond" title="No jigs: this casting needs no jigs at all — the board shows N/A. No scrim: the casting has no scrim layers (height-check jigs only); recorded here, the column still turns green when the jig list is printed.">Jigs
        <select data-ms-jig-cond="${escapeAttr(castingId)}" class="pp-ms-cond-select">
            <option value=""${cur ? '' : ' selected'}>— normal —</option>
            <option value="nojigs"${cur === 'nojigs' ? ' selected' : ''}>No jigs (N/A on the board)</option>
            <option value="noscrim"${cur === 'noscrim' ? ' selected' : ''}>No scrim</option>
        </select></label>`;
}
async function handleJigConditionPick(castingId, value) {
    if (!castingId) return;
    const r = msRow(castingId, 'Jig List');
    if (value === 'nojigs') {
        await msSet(castingId, 'Jig List', MS.NA, { note: JIG_COND_NOJIGS, stamp: true });
    } else if (value === 'noscrim') {
        const keep = r && r.status !== MS.NA ? r.status : MS.RED;
        await msSet(castingId, 'Jig List', keep, { note: JIG_COND_NOSCRIM, stamp: true });
    } else {
        const keep = r && r.status !== MS.NA ? r.status : MS.RED;
        await msSet(castingId, 'Jig List', keep, { note: null, stamp: keep !== MS.RED });
    }
    msFloatEl && (msFloatEl.dataset.key = '');
    updateMsFloat();
}
function msWhen(r) { return r?.stamped_at ? new Date(r.stamped_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : ''; }
function msLine(castingId, milestone, label) {
    const r = msRow(castingId, milestone);
    const s = r?.status || MS.RED, when = msWhen(r);
    const tip = (r?.note ? r.note + '. ' : '') + (when ? 'Since ' + when : 'Not done yet');
    return `<div class="pp-ms-line" title="${escapeAttr(tip)}">${msDot(s)}<span class="pp-ms-label">${escapeHtml(label || milestone)}</span>${when ? `<span class="pp-ms-when">${escapeHtml(when)}</span>` : ''}</div>`;
}
function msCiLine(castingId) { const s = ciStatus(castingId); return `<div class="pp-ms-line pp-ms-line-ci">${msDot(s)}<span class="pp-ms-label">${escapeHtml(CI_STATE[s].label)}</span></div>`; }
function msCastHead(castingId) { return `<div class="pp-ms-cast">${escapeHtml(msCastName(castingId))}</div>`; }

// ---- Special layout conditions (2026-10-16): a casting that is never laid out (e.g. Jane Street — forms cast and
// stacked on vertical curing racks) goes green by picking a named condition. Names are shared across every job.
function layoutConditionOf(castingId) {
    return parseLayoutCondition(msRow(castingId, 'Casting Layout')?.note)?.name || '';
}
/** 'A' | 'B' | null — the side the casting's special condition applies to. */
function layoutConditionSideOf(castingId) {
    return parseLayoutCondition(msRow(castingId, 'Casting Layout')?.note)?.side || null;
}
function layoutConditionHtml(castingId) {
    if (msLayoutConditions === null) {
        msLayoutConditions = [];
        loadLayoutConditions().then(list => { msLayoutConditions = list; updateMsFloat(); }).catch(() => {});
    }
    const cur = layoutConditionOf(castingId);
    const curSide = layoutConditionSideOf(castingId) || 'A';
    const names = msLayoutConditions.includes(cur) || !cur ? msLayoutConditions : [cur, ...msLayoutConditions];
    return `<label class="pp-ms-tick pp-ms-cond" title="A casting that is never laid out (vertical curing racks, etc.) goes green by naming the special condition and the side it applies to. The list of names is shared by every job; the weekly's Cast cards show it.">Special condition
        <select data-ms-layout-side="${escapeAttr(castingId)}" class="pp-ms-cond-select pp-ms-cond-side" title="Which side the condition applies to">
            <option value="A"${curSide === 'A' ? ' selected' : ''}>Side A</option>
            <option value="B"${curSide === 'B' ? ' selected' : ''}>Side B</option>
            <option value="AB"${curSide === 'AB' ? ' selected' : ''}>Both — A and B</option>
        </select>
        <select data-ms-layout-cond="${escapeAttr(castingId)}" class="pp-ms-cond-select">
            <option value=""${cur ? '' : ' selected'}>— none —</option>
            ${names.map(n => `<option value="${escapeAttr(n)}"${n === cur ? ' selected' : ''}>${escapeHtml(n)}</option>`).join('')}
            <option value="__add__">Add a condition…</option>
        </select></label>`;
}
/** The side select changed: re-save the condition (if there is one) with the new side. */
async function handleLayoutConditionSide(castingId, side) {
    const name = layoutConditionOf(castingId);
    if (!castingId || !name || !['A', 'B', 'AB'].includes(side)) return;
    await msSet(castingId, 'Casting Layout', MS.GREEN, { note: layoutConditionNote(name, side), stamp: true });
    msFloatEl && (msFloatEl.dataset.key = '');
    updateMsFloat();
    showToast(`Cast ${currentCastings.find(c => c.id === castingId)?.casting_number || ''}: special condition "${name}" now on Side ${sideWords(side)}.`);
}
async function handleLayoutConditionPick(castingId, value) {
    if (!castingId) return;
    const picked = document.querySelector(`[data-ms-layout-side="${CSS.escape(castingId)}"]`)?.value;
    const side = ['A', 'B', 'AB'].includes(picked) ? picked : 'A';
    let name = value;
    if (value === '__add__') {
        name = (window.prompt('Name the special layout condition (e.g. "vertical curing racks"). It will be offered on every job from now on.') || '').trim();
        if (!name) { updateMsFloat(); return; }
    }
    if (!name) {
        // back to the normal rule: orange when forms are laid out, red otherwise
        const laid = castingId === clSelectedCastingId && Array.isArray(clLayoutPositions) && clLayoutPositions.length > 0;
        await msSet(castingId, 'Casting Layout', laid ? MS.ORANGE : MS.RED, { note: laid ? 'Forms laid out' : null, stamp: laid });
        msFloatEl && (msFloatEl.dataset.key = '');
        updateMsFloat();
        return;
    }
    if (!msLayoutConditions.includes(name)) msLayoutConditions = [...msLayoutConditions, name].sort((a, b) => a.localeCompare(b));
    await msSet(castingId, 'Casting Layout', MS.GREEN, { note: layoutConditionNote(name, side), stamp: true });
    msFloatEl && (msFloatEl.dataset.key = '');
    updateMsFloat();
    showToast(`Cast ${currentCastings.find(c => c.id === castingId)?.casting_number || ''}: Casting Layout green — special condition "${name}" on Side ${sideWords(side)}.`);
}
/** One column for many castings: "Shop Folder Cover: ● Cast 1  ● Cast 2 …" */
function msListChips(castings, milestone) {
    return `<div class="pp-ms-cast">${escapeHtml(milestone)}</div>` + castings.map(c => {
        const r = msRow(c.id, milestone), when = msWhen(r);
        const tip = `${milestone}: ${r?.status || 'red'}${msNote(r) ? ' — ' + msNote(r) : ''}${when ? ' (since ' + when + ')' : ''}`;
        return `<span class="pp-ms-line" title="${escapeAttr(tip)}">${msDot(r?.status || MS.RED)}<span class="pp-ms-label">${escapeHtml(msCastName(c.id))}</span></span>`;
    }).join('');
}
function msBatchCastingId() {
    const frame = getSpecialBatchingFrame();
    if (frame && frame.getAttribute('src') && !frame.closest('[hidden]')) return frameCasts?.casts.find(c => c.active)?.id || null;
    return currentBatchCastingId;
}
function ciBoxHtml(castings) {
    return castings.map(c => {
        const s = ciStatus(c.id), st = CI_STATE[s], r = msRow(c.id, 'Casting Inventory');
        const action = ciActionsHtml(c.id, 'data-ms');
        return `<div class="pp-ms-ci pp-ms-ci-${s}" title="${escapeAttr(msNote(r) + (msWhen(r) ? ' · ' + msWhen(r) : ''))}">
            <div class="pp-ms-ci-head">${msDot(s)}<b>${escapeHtml(msCastName(c.id))}</b><span class="pp-ms-ci-state">${escapeHtml(st.label.replace('Casting Inventory — ', ''))}</span></div>
            <div class="pp-ms-ci-actions">${action}</div></div>`;
    }).join('');
}
function updateMsFloat() {
    const formView = document.getElementById('pp-form-view');
    const show = msOn() && !!currentProjectNumber && currentCastings.length > 0 && !!formView && !formView.hidden;
    let html = '';
    if (show) {
        const scoped = getCastingsForActivePhase();
        switch (currentTab) {
            case 'castings': html = ''; break;   // the lock controls sit in each casting card
            case 'batch-tickets': { const id = msBatchCastingId(); if (id) html = msCastHead(id) + msLine(id, 'Batching Sheets') + msCiLine(id); break; }
            case 'tracking': html = ''; break;   // shown beside each cast instead
            case 'approvals': html = ''; break;  // the grid is the status
            case 'casting-layout': if (clSelectedCastingId) html = msCastHead(clSelectedCastingId) + msLine(clSelectedCastingId, 'Casting Layout') + msCiLine(clSelectedCastingId) + layoutConditionHtml(clSelectedCastingId); break;
            case 'jig-list': if (msJigCastingId) html = msCastHead(msJigCastingId) + msLine(msJigCastingId, 'Jig List') + msCiLine(msJigCastingId) + jigConditionHtml(msJigCastingId); break;
            case 'optimizer': if (currentOptCastingId) html = msCastHead(currentOptCastingId) + msLine(currentOptCastingId, 'Final Optimizer HRS'); break;
            case 'staging': if (currentStagingCastingId) html = msCastHead(currentStagingCastingId) + msLine(currentStagingCastingId, 'Staging'); break;
            case 'color-log': html = msListChips(scoped, 'Color Log'); break;
            case 'info': html = msListChips(scoped, 'Shop Folder Cover'); break;
            default: html = '';
        }
    }
    const panel = document.querySelector(`.pp-tab-panel[data-panel="${CSS.escape(currentTab)}"]`);
    document.querySelectorAll('.pp-tab-panel[style*="padding-top"]').forEach(p => { if (p !== panel || !html) p.style.paddingTop = ''; });
    if (!html || !panel) { if (msFloatEl) msFloatEl.hidden = true; return; }
    if (!msFloatEl) {
        msFloatEl = document.createElement('div');
        msFloatEl.id = 'pp-ms-float';
        msFloatEl.className = 'pp-ms-float';
        document.body.appendChild(msFloatEl);
        msFloatEl.addEventListener('click', (e) => {
            const adv = e.target.closest('[data-ms-ci-advance]');
            if (adv) { ciAdvance(adv.dataset.msCiAdvance); return; }
            const pm = e.target.closest('[data-ms-ci-pm]');
            if (pm) { ciPmReady(pm.dataset.msCiPm); return; }
            const unl = e.target.closest('[data-ms-ci-unlock]');
            if (unl) { ciUnlock(unl.dataset.msCiUnlock); }
        });
        msFloatEl.addEventListener('change', (e) => {
            const cb = e.target.closest('[data-ms-opt-done]');
            if (cb) { msSet(cb.dataset.msOptDone, 'Final Optimizer HRS', cb.checked ? MS.GREEN : MS.RED, { note: cb.checked ? 'Final hours confirmed' : null, stamp: true }); return; }
            const sel = e.target.closest('[data-ms-layout-cond]');
            if (sel) { handleLayoutConditionPick(sel.dataset.msLayoutCond, sel.value); return; }
            const sideSel = e.target.closest('[data-ms-layout-side]');
            if (sideSel) { handleLayoutConditionSide(sideSel.dataset.msLayoutSide, sideSel.value); return; }
            const jc = e.target.closest('[data-ms-jig-cond]');
            if (jc) handleJigConditionPick(jc.dataset.msJigCond, jc.value);
        });
    }
    const pending = isMilestonesMigrationPending() ? '<div class="pp-ms-warn">Not saving yet — run migration/casting-milestones.sql in Supabase</div>' : '';
    const key = currentTab + '|' + html + pending;
    if (msFloatEl.dataset.key !== key) {
        msFloatEl.innerHTML = `<div class="pp-ms-title">Releasability Board</div><div class="pp-ms-body">${html}</div>${pending}`;
        msFloatEl.dataset.key = key;
    }
    msFloatEl.hidden = false;
    // Pinned under the portal header, as wide as the tab's content; the tab makes room for it.
    let r = panel.getBoundingClientRect();
    if (r.width < 50 && panel.parentElement) r = panel.parentElement.getBoundingClientRect();   // tab not painted yet: use the content column
    msFloatEl.style.top = Math.round(msBarTop()) + 'px';
    msFloatEl.style.left = Math.round(r.left) + 'px';
    msFloatEl.style.width = Math.round(r.width) + 'px';
    const want = (msFloatEl.offsetHeight + 8) + 'px';
    if (panel.style.paddingTop !== want) panel.style.paddingTop = want;
}

function isCastingInventoryLocked(casting) {
    if (!casting) return false;
    if (ciLockedById(casting.id)) return true;   // engineering lock (Releasability box)
    // Find the highest sort_order among castings that have any tracking state.
    // Use sort_order (database-canonical drag-order) NOT casting_number — that's
    // a user-editable display string and names like "1A Remake" parse to int 1
    // even when they're the latest casting in the project, which would lock
    // them incorrectly.
    let cap = null;
    for (const c of currentCastings) {
        const comps = currentCastingComponents.get(c.id) || [];
        const hasState = comps.some(p =>
            p.rejected === true || p.produced === true || p.crate_id != null
        );
        if (!hasState) continue;
        const ord = c.sort_order ?? -Infinity;
        if (cap === null || ord > cap) cap = ord;
    }
    if (cap === null) return false;
    return (casting.sort_order ?? -Infinity) <= cap;
}

// Shared error toast for inventory-mutation guards. The wording calls out the
// "why" (a later casting has tracking state) so the user knows it's not just
// a generic lock.
function showCastingLockedToast(casting) {
    const num = casting?.casting_number || '?';
    if (ciLockedById(casting?.id)) {
        showToast(`Casting ${num} inventory is ready (final) — press "Make changes" on the casting to edit it.`, 'error');
        return;
    }
    showToast(`Casting ${num} is locked: a later casting has rejected/produced/crated panels.`, 'error');
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

// Tracking rows have a Truck box (1–20) and a Crate # box (1–20). Together they say where THIS panel
// goes; changing either box moves only this panel. A crate number with no truck is a crate that has
// not been put on a truck yet (the Shipping tab can give it one later, or the Truck box here can).
// Picking a truck before a crate number is remembered for the row until a crate number is picked.
const pendingTruckByComp = new Map();   // componentId -> truck number chosen before any crate number

function componentById(componentId) {
    for (const list of currentCastingComponents.values()) { const f = list.find(c => c.id === componentId); if (f) return f; }
    return null;
}
function crateOfComponent(comp) { return comp?.crate_id ? currentCrates.find(c => c.id === comp.crate_id) || null : null; }

/** Move one panel into crate (truck, num) of this phase — made on the fly when it does not exist. */
async function movePanelTo(componentId, truck, num) {
    const comp = componentById(componentId);
    if (!comp) return;
    const was = comp.crate_id || null;
    const crate = await createCrateOn(Number(truck || 0), num);
    if (!crate) { renderTracking(); return; }
    pendingTruckByComp.delete(componentId);
    if (crate.id === was) { renderTracking(); return; }
    await assignComponentToCrate(componentId, crate.id);
    await tidyVacatedCrate(was);
}
/** A crate with no truck that just lost its last panel is clutter on the Shipping tab — drop it quietly. */
async function tidyVacatedCrate(crateId) {
    if (!crateId) return;
    const crate = currentCrates.find(c => c.id === crateId);
    if (!crate || crateTruck(crate) !== 0 || getComponentCount(crateId) > 0) return;
    try {
        await deleteCrate(crateId);
        currentCrates = currentCrates.filter(c => c.id !== crateId);
        if (currentTab === 'shipping') renderShipping();
    } catch (err) {
        logger.error('[project-portal] tidyVacatedCrate failed:', err);
    }
}

async function handleTrackingCrateSelect(componentId, value) {
    if (!componentId) return;
    // If the row is part of a multi-row selection, treat it as a bulk assign for every selected row.
    if (selectedComponentIds.has(componentId) && selectedComponentIds.size > 1) {
        await applyBulkCrate(!crateNumFromPick(value) ? { clear: true } : { num: crateNumFromPick(value) });
        return;
    }
    const num = crateNumFromPick(value);
    if (!num) {
        const comp = componentById(componentId);
        const was = comp?.crate_id || null;
        await assignComponentToCrate(componentId, null);
        await tidyVacatedCrate(was);
        return;
    }
    const own = crateOfComponent(componentById(componentId));
    const truck = own ? crateTruck(own) : (pendingTruckByComp.get(componentId) || 0);
    await movePanelTo(componentId, truck, num);
}
async function handleTrackingTruckSelect(componentId, value) {
    if (!componentId) return;
    if (value === '__clear__') { await handleTrackingCrateSelect(componentId, '__clear__'); return; }
    const truck = Number(value || 0);
    if (selectedComponentIds.has(componentId) && selectedComponentIds.size > 1) {
        await applyBulkCrate({ truck });
        return;
    }
    const own = crateOfComponent(componentById(componentId));
    if (own) { await movePanelTo(componentId, truck, crateNum(own)); return; }
    if (truck) pendingTruckByComp.set(componentId, truck); else pendingTruckByComp.delete(componentId);
    renderTracking();
}
function crateNumFromPick(value) {
    const v = String(value || '').trim();
    return v.startsWith('#') ? v.slice(1).trim() : '';
}

// ---- Trucks + crates (2026-10-14). PMs number crates 1, 2, 3 on each truck and trucks 1, 2 in each
// phase; the database wants ONE unique name per project, so the stored crate_number is a hidden key:
//   "<PHASE>.T<truck>.<n>"   (project without phases: "T<truck>.<n>")
// and a legacy plain "1" is crate 1 with no truck yet. Everything the user sees comes from crateParts().
function crateCodePart(s) { return String(s ?? '').trim().toUpperCase().replace(/\s+/g, ''); }
function phaseCode(phase) {
    const words = String(phase?.phase_name || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '';
    return (words.length > 1 ? words.map(w => w[0]).join('') : words[0]).toUpperCase();
}
function crateParts(crate) {
    const raw = String(crate?.crate_number || '').trim();
    const m = raw.match(/^(?:[^.]+\.)?T(\d+)\.(.+)$/i);
    if (m) return { truck: Number(m[1]), num: m[2] };
    const i = raw.lastIndexOf('.');
    return { truck: 0, num: i === -1 ? raw : raw.slice(i + 1) };   // legacy "1", or an older "P2.1.1"
}
function crateKey(truck, num) {
    // Phase prefix keeps "Truck 1 · Crate 1" of one phase apart from the next. If the phase list has not
    // loaded yet, fall back to the start of the phase id so the key still carries the phase.
    let pc = currentPhasesEnabled ? phaseCode(currentPhases.find(p => p.id === currentPhaseId)) : '';
    if (currentPhasesEnabled && !pc && currentPhaseId) pc = String(currentPhaseId).slice(0, 8).toUpperCase();
    return (pc ? pc + '.' : '') + 'T' + Number(truck || 0) + '.' + crateCodePart(num);
}
function crateNum(crate) { return crateParts(crate).num; }
function crateTruck(crate) { return crateParts(crate).truck; }
function crateDisplay(crate) { const p = crateParts(crate); return (p.truck ? `Truck ${p.truck} · ` : '') + `Crate ${p.num}`; }
function sortCrates(list) {
    const n = (s) => { const x = parseFloat(s); return Number.isFinite(x) ? x : Infinity; };
    return list.slice().sort((a, b) => {
        const pa = crateParts(a), pb = crateParts(b);
        return (pa.truck - pb.truck) || (n(pa.num) - n(pb.num)) || String(pa.num).localeCompare(String(pb.num));
    });
}
function findCrate(truck, num) {
    const want = crateCodePart(num);
    return getCratesForActivePhase().find(c => { const p = crateParts(c); return p.truck === Number(truck || 0) && crateCodePart(p.num) === want; }) || null;
}
function highestTruck() { return getCratesForActivePhase().reduce((m, c) => Math.max(m, crateTruck(c)), 0); }
function nextCrateNumberOn(truck) {
    const used = new Set(getCratesForActivePhase().filter(c => crateTruck(c) === Number(truck)).map(c => crateCodePart(crateNum(c))));
    let n = 1;
    while (used.has(String(n))) n += 1;
    return String(n);
}
async function createCrateOn(truck, num) {
    const existing = findCrate(truck, num);
    if (existing) return existing;
    try {
        const crate = await createCrate(currentProjectNumber, {
            crate_number: crateKey(truck, num),
            phase_id: currentPhasesEnabled ? currentPhaseId : null
        });
        if (crate) currentCrates.push(crate);
        return crate || null;
    } catch (err) {
        logger.error('[project-portal] createCrate failed:', err);
        const dup = /duplicate|unique/i.test(String(err?.message || err));
        showToast(dup
            ? `Crate ${num} on truck ${truck || '—'} clashes with another phase whose name shortens the same way — rename one of the phases.`
            : `Could not create the crate: ${err?.message || err}`, 'error');
        return null;
    }
}
const TRUCK_NUMBER_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1);
/** Options for the Truck boxes: 1–20 plus any higher truck already in use in this phase. */
function truckOptionsHtml(selectedTruck, { bulk = false } = {}) {
    const nums = new Set(TRUCK_NUMBER_OPTIONS);
    for (const c of getCratesForActivePhase()) if (crateTruck(c)) nums.add(crateTruck(c));
    const head = bulk
        ? ['<option value="">— Set truck —</option>', '<option value="0">No truck</option>', '<option value="__clear__">Clear assignment</option>']
        : ['<option value="0"' + (!selectedTruck ? ' selected' : '') + '>—</option>', '<option value="__clear__">Clear assignment</option>'];
    const opts = [...nums].sort((a, b) => a - b).map(t => `<option value="${t}"${!bulk && t === Number(selectedTruck) ? ' selected' : ''}>Truck ${t}</option>`);
    return head.concat(opts).join('');
}
/** Options for the Crate # boxes: 1–20 plus any other number already in use in this phase. Numbers only. */
function crateOptionsHtml(selectedId, { bulk = false } = {}) {
    const crates = getCratesForActivePhase();
    const head = bulk
        ? ['<option value="">— Set crate —</option>', '<option value="__clear__">Clear assignment</option>']
        : ['<option value="">—</option>', '<option value="__clear__">Clear assignment</option>'];
    const nums = new Set(CRATE_NUMBER_OPTIONS);
    for (const c of crates) nums.add(crateCodePart(crateNum(c)));
    const n = (s) => { const x = parseFloat(s); return Number.isFinite(x) ? x : Infinity; };
    const ordered = [...nums].sort((a, b) => (n(a) - n(b)) || a.localeCompare(b));
    const selected = selectedId ? currentCrates.find(c => c.id === selectedId) : null;
    const selNum = selected && crates.includes(selected) ? crateCodePart(crateNum(selected)) : null;
    const opts = ordered.map(num => `<option value="#${escapeAttr(num)}"${num === selNum ? ' selected' : ''}>${escapeHtml(num)}</option>`);
    if (selected && !crates.includes(selected)) {
        opts.push(`<option value="${escapeAttr(selected.id)}" selected>${escapeHtml(crateDisplay(selected))} (other phase)</option>`);
    }
    return head.concat(opts).join('');
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
    updateCastingsSummary();
    try {
        await setComponentRejected(componentId, next);
    } catch (err) {
        logger.error('[project-portal] setComponentRejected failed:', err);
        target.rejected = prev;
        renderTracking();
        updateCastingsSummary();
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

/** The Casting Layout tab's "Casting side" select shows the selected casting's own Side A/B (shared with the weekly). */
function syncClaySideSelect() {
    const casting = currentCastings.find(c => c.id === clSelectedCastingId);
    const side = ['A', 'B', 'AB'].includes(casting?.casting_side) ? casting.casting_side : '';
    clSelectedArea = side || 'B';   // the layout draws the casting's side; nothing stored = Side B, as before
    const el = document.getElementById('pp-clay-side');
    if (el) el.value = side;
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
    syncClaySideSelect();
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
        if (Array.isArray(clLayoutPositions) && clLayoutPositions.length) markWorking(clSelectedCastingId, 'Casting Layout', 'Forms laid out', true);
    } catch (e) {
        logger.error('[project-portal] loadLayoutPositions failed:', e);
        clLayoutPositions = [];
    }
}

function renderCastingLayoutTab() {
    updateMsFloat();
    const card = document.getElementById('pp-clay-card');
    const errorEl = document.getElementById('pp-clay-error');
    if (!card) return;

    const casting = currentCastings.find(c => c.id === clSelectedCastingId);
    const components = currentCastingComponents.get(clSelectedCastingId) || [];
    const title = casting
        ? `${currentProjectNumber} — ${castingLayoutLabel(casting)}`
        : 'Casting Layout';

    const handles = [];
    if (clSelectedArea === 'AB') {
        // Both sides (2026-10-23): Side B is packed first, whatever does not fit continues onto Side A.
        // Each side is its own diagram with its own saved positions, drawn one above the other.
        card.innerHTML = '';
        const cardB = document.createElement('div'); cardB.className = 'pp-clay-card-side';
        const cardA = document.createElement('div'); cardA.className = 'pp-clay-card-side';
        card.append(cardB, cardA);
        const quiet = document.createElement('div');
        const hB = renderCastingLayout({ container: cardB, errorEl: quiet, components, title: `${title} — SIDE B`, area: 'B', offsetPerSide: clOffsetPerSide, gapBetween: clGapBetween, positions: clLayoutPositions, overflowLabel: 'CONTINUE ON SIDE A', hideOverflow: true });
        const leftover = new Set((hB?.staged || []).map(r => r.componentId));
        const compsA = hB ? components.filter(c => leftover.has(c.id)) : [];
        const hA = compsA.length ? renderCastingLayout({ container: cardA, errorEl, components: compsA, title: `${title} — SIDE A`, area: 'A', offsetPerSide: clOffsetPerSide, gapBetween: clGapBetween, positions: clLayoutPositions }) : null;
        if (!compsA.length) { cardA.innerHTML = '<p class="pp-clay-empty">Side A: nothing left over — every form fits on Side B.</p>'; if (errorEl) errorEl.textContent = ''; }
        if (hB) handles.push(hB);
        if (hA) handles.push(hA);
    } else {
        const h = renderCastingLayout({
            container: card,
            errorEl,
            components,
            title,
            area: clSelectedArea,
            offsetPerSide: clOffsetPerSide,
            gapBetween: clGapBetween,
            positions: clLayoutPositions
        });
        if (h) handles.push(h);
    }
    for (const handle of handles) {
        attachLayoutDrag(handle, {
            castingId: clSelectedCastingId,
            area: handle.area,
            onCommit: commitLayoutPositions
        });
    }
    // The reset button only makes sense once a layout has been customized.
    const resetBtn = document.getElementById('pp-clay-reset-btn');
    if (resetBtn) resetBtn.hidden = !handles.some(h => h.mode === 'manual');
}

/**
 * Persist dragged mold positions, then reload and re-render. The first commit
 * for an auto-packed casting snapshots every mold, switching it to manual mode.
 */
async function commitLayoutPositions(rows) {
    if (Array.isArray(rows) && rows.length) markWorking(clSelectedCastingId, 'Casting Layout', 'Forms laid out');
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
        for (const area of (clSelectedArea === 'AB' ? ['A', 'B'] : [clSelectedArea])) await clearLayoutPositions(clSelectedCastingId, area);
        await loadLayoutPositionsForSelected();
    } catch (e) {
        logger.error('[project-portal] resetCastingLayout failed:', e);
        alert('Could not reset the layout. Please try again.');
    }
    renderCastingLayoutTab();
}

async function printCastingLayout() {
    // A casting under a special layout condition has no layout to print — offer the notice for the job folder instead.
    const cond = layoutConditionOf(clSelectedCastingId);
    if (cond) {
        const condSide = layoutConditionSideOf(clSelectedCastingId);
        if (window.confirm(`This casting has no form layout — special condition: "${cond}"${condSide ? ' (Side ' + sideWords(condSide) + ')' : ''}.

Print a SPECIAL CONDITION NOTICE for the job folder instead?`)) printLayoutConditionNotice(clSelectedCastingId, cond);
        return;
    }
    if (!document.querySelector('#pp-clay-card svg')) { alert('No layout to print yet.'); return; }
    if (!(await printGate([clSelectedCastingId], 'Casting Layout'))) return;
    if (printCastingLayoutNow() !== false) stampPrinted([clSelectedCastingId], 'Casting Layout');
}
/** One sheet for the job folder: this casting's layout step was handled by a special condition, not forgotten. */
function printLayoutConditionNotice(castingId, cond) {
    const casting = currentCastings.find(c => c.id === castingId);
    const projectName = (document.getElementById('pp-f-project_name')?.value || '').trim();
    const job = [currentProjectNumber, projectName].filter(Boolean).join(' ');
    const cast = casting?.casting_number || '';
    const today = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Casting Layout — Special Condition — ${escapeHtml(job)} — Cast ${escapeHtml(cast)}</title><style>
      @page { size: letter portrait; margin: 0.6in; }
      body { font-family: 'Segoe UI', Arial, sans-serif; color: #000; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .t { font-size: 26pt; font-weight: 800; letter-spacing: .02em; margin: 0; }
      .t span { background: #86efac; padding: 2px 10px; border-radius: 3px; }
      .sub { margin: 10pt 0 0; font-size: 12pt; font-weight: 700; letter-spacing: .06em; }
      .rule { border: 0; border-top: 4px solid #22c55e; margin: 14pt 0 24pt; }
      .meta { font-size: 14pt; line-height: 1.8; }
      .meta b { display: inline-block; min-width: 1.6in; color: #333; }
      .cond { margin: 30pt 0; padding: 22pt 24pt; border: 4px solid #000; border-radius: 10px; text-align: center; }
      .cond .lab { font-size: 12pt; font-weight: 700; letter-spacing: .14em; color: #444; }
      .cond .name { font-size: 34pt; font-weight: 900; margin-top: 8pt; }
      .note { font-size: 13pt; line-height: 1.6; }
      .foot { position: fixed; bottom: 0.4in; left: 0.6in; right: 0.6in; font-size: 10pt; color: #666; border-top: 1px solid #bbb; padding-top: 6pt; display: flex; justify-content: space-between; }
    </style></head><body>
      <h1 class="t"><span>CASTING LAYOUT</span> &mdash; SPECIAL CONDITION</h1>
      <div class="sub">NO FORM LAYOUT IS ISSUED FOR THIS CASTING &mdash; SEE THE CONDITION BELOW</div>
      <hr class="rule">
      <div class="meta"><div><b>Job</b> ${escapeHtml(job)}</div><div><b>Casting</b> ${escapeHtml(cast)}${casting?.description ? ' &mdash; ' + escapeHtml(casting.description) : ''}</div><div><b>Issued</b> ${escapeHtml(today)}</div></div>
      <div class="cond"><div class="lab">SPECIAL LAYOUT CONDITION${layoutConditionSideOf(castingId) ? ' &mdash; SIDE ' + sideWords(layoutConditionSideOf(castingId)) : ''}</div><div class="name">${escapeHtml(cond)}</div></div>
      <p class="note">The casting layout step for this casting is complete under the condition above. The forms are handled as the condition describes and are not arranged on the shop-floor tables, so there is no form layout drawing to issue. This notice goes in the job folder so the layout step is not mistaken for forgotten.</p>
      <div class="foot"><span>Casting Layout &middot; ${escapeHtml(job)}</span><span>Cast ${escapeHtml(cast)} &middot; special condition notice</span></div>
    </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { showToast('Pop-up blocked — allow pop-ups for printing', 'error'); return; }
    w.document.open();
    w.document.write(html.replace('</body>', '<script>window.addEventListener("load",()=>{setTimeout(()=>window.print(),200);});</script></body>'));
    w.document.close();
    msSet(castingId, 'Casting Layout', MS.GREEN, { note: LAYOUT_CONDITION_PREFIX + cond, stamp: true });
}
function printCastingLayoutNow() {
    const svgEls = [...document.querySelectorAll('#pp-clay-card svg')];   // one per side when the casting is on both
    if (!svgEls.length) { alert('No layout to print yet.'); return false; }
    // Print on 11x17 (tabloid) portrait so the layout scales up and stays readable; each SVG is cropped to
    // its drawn content and gets its own page.
    const pages = svgEls.map(svgEl => {
        const printSvg = svgEl.cloneNode(true);
        try {
            const bb = svgEl.getBBox();
            if (bb && bb.width > 0 && bb.height > 0) {
                const pad = 16;
                printSvg.setAttribute('viewBox', `${bb.x - pad} ${bb.y - pad} ${bb.width + pad * 2} ${bb.height + pad * 2}`);
                printSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            }
        } catch (e) { /* keep the original viewBox if getBBox is unavailable */ }
        return printSvg.outerHTML;
    });
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html>
<html><head><title>Casting Layout</title>
<style>
  @page { size: 11in 17in; margin: 0.5in; }
  html, body { margin: 0; padding: 0; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  svg { width: 10in; height: 16in; display: block; margin: 0 auto; }
</style></head>
<body>${pages.map(p => `<div class="page">${p}</div>`).join('')}</body></html>`);
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
    const options = crateOptionsHtml('', { bulk: true });
    const truckOptions = truckOptionsHtml(0, { bulk: true });
    bar.innerHTML = `
        <div class="pp-track-bulk-inner">
            <span class="pp-track-bulk-count">${count} ${count === 1 ? 'panel' : 'panels'} selected</span>
            <select id="pp-track-bulk-truck" class="pp-track-bulk-select" aria-label="Bulk truck assignment" title="Put the ticked panels on this truck (they keep their crate numbers)">${truckOptions}</select>
            <select id="pp-track-bulk-select" class="pp-track-bulk-select" aria-label="Bulk crate assignment" title="Put the ticked panels in this crate number (they keep their trucks)">${options}</select>
            <button type="button" class="pp-track-bulk-btn pp-track-bulk-btn-unassign" data-action="track-bulk-unassign" title="Take the ticked panels out of their crates (no crate, no truck)">Clear assignment</button>
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

/**
 * Bulk move for the ticked panels. { truck } changes only the truck (each panel keeps its crate number),
 * { num } changes only the crate number (each panel keeps its truck), { clear: true } unassigns them all.
 * Panels with no crate number yet just remember the truck until a number is picked.
 */
async function applyBulkCrate({ truck = null, num = null, clear = false } = {}) {
    if (selectedComponentIds.size === 0) return;
    const ids = [...selectedComponentIds];

    // Work out the target crate for every ticked panel (null = unassign, undefined = leave alone).
    const targetByComp = new Map();
    const crateByKey = new Map();
    for (const id of ids) {
        const comp = componentById(id);
        if (!comp) continue;
        if (clear) { targetByComp.set(id, null); continue; }
        const own = crateOfComponent(comp);
        const t = truck !== null ? Number(truck) : (own ? crateTruck(own) : (pendingTruckByComp.get(id) || 0));
        const n = num !== null ? num : (own ? crateNum(own) : '');
        if (!n) { if (truck !== null) { if (t) pendingTruckByComp.set(id, t); else pendingTruckByComp.delete(id); } continue; }
        const key = crateKey(t, n);
        let crate = crateByKey.get(key);
        if (!crate) { crate = await createCrateOn(t, n); if (!crate) { renderTracking(); return; } crateByKey.set(key, crate); }
        pendingTruckByComp.delete(id);
        if (crate.id !== (own?.id || null)) targetByComp.set(id, crate.id);
    }

    // Optimistic local update so the UI snaps immediately.
    const prevById = new Map();
    for (const list of currentCastingComponents.values()) {
        for (const comp of list) {
            if (targetByComp.has(comp.id)) {
                prevById.set(comp.id, comp.crate_id || null);
                comp.crate_id = targetByComp.get(comp.id);
            }
        }
    }
    // Keep the panels ticked until each one has BOTH a truck and a crate number (so the PM can set the
    // crate, then the truck, or the other way round, without ticking everything twice). Then clear.
    const done = clear || ids.every(id => { const c = crateOfComponent(componentById(id)); return c && crateTruck(c) > 0; });
    if (done) selectedComponentIds.clear();
    renderTracking();
    if (currentTab === 'shipping') renderShipping();
    if (!targetByComp.size) return;

    try {
        const groups = new Map();
        for (const [id, crateId] of targetByComp) { if (!groups.has(crateId)) groups.set(crateId, []); groups.get(crateId).push(id); }
        for (const [crateId, group] of groups) await setComponentsCrateBulk(group, crateId);
        for (const was of new Set(prevById.values())) await tidyVacatedCrate(was);
    } catch (err) {
        logger.error('[project-portal] setComponentsCrateBulk failed:', err);
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
    // Rejected panels from earlier casts re-cast here — they are in the total above (2026-10-20).
    const remakeBy = new Map();
    for (const c of components) {
        if (!c.remake_of_casting_id) continue;
        const n = currentCastings.find(x => x.id === c.remake_of_casting_id)?.casting_number || '?';
        remakeBy.set(n, (remakeBy.get(n) || 0) + 1);
    }
    const remakeBadge = remakeBy.size
        ? `<span class="pp-track-section-remakes" title="Rejected panels from earlier casts re-cast here — counted in the total">incl. ${[...remakeBy].map(([n, k], i) => `${k}${i ? '' : ` rejection${k === 1 ? '' : 's'}`} from cast ${escapeHtml(n)}`).join(', ')}</span>`
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
                <span>Truck</span>
                <span>Rejected</span>
                <span>Remake In</span>
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
                <span class="pp-track-section-counts"><span class="pp-track-section-count">${count} ${count === 1 ? 'component' : 'components'}</span>${remakeBadge}</span>
                ${rejectedBadge}
                ${trackMsHtml(casting.id)}
            </div>
            ${body}
        </div>
    `;
}

const CRATE_NUMBER_OPTIONS = Array.from({ length: 20 }, (_, i) => String(i + 1));

function renderTrackCard(comp, castingId) {
    const lockTitle = 'Synced from Castings inventory — edit there';
    const crate = comp.crate_id ? currentCrates.find(c => c.id === comp.crate_id) : null;
    const currentNum = crate ? crateNum(crate) : '';
    const crateTitle = crate ? crateDisplay(crate) : 'Assign this panel to a crate';
    const options = crateOptionsHtml(comp.crate_id || '');
    const truckNo = crate ? crateTruck(crate) : (pendingTruckByComp.get(comp.id) || 0);
    const truckTitle = crate
        ? (truckNo ? crateDisplay(crate) : 'Not on a truck yet — pick a truck here or on the Shipping tab')
        : (truckNo ? `Truck ${truckNo} — now pick a crate number` : 'Pick the truck this panel ships on');
    const truckOptions = truckOptionsHtml(truckNo);
    const isSelected = selectedComponentIds.has(comp.id);
    const isProduced = !!comp.produced;
    const isRejected = !!comp.rejected;
    const rejectTitle = isRejected
        ? 'This panel is rejected. Unchecking will prompt to confirm — make sure no remake was already scheduled.'
        : 'Mark this panel as rejected. Use Add Remake Casting to schedule the replacement.';

    // "Remake In" is now a read-only display: where (if anywhere) has this panel
    // been imported into as a remake? Derived by scanning every component in the
    // project for one whose remake_of_* fields point back at this panel.
    let remakeDestLabel = '';
    let remakeDestTitle = 'Not yet imported as a remake.';
    {
        let dest = null;
        for (const arr of currentCastingComponents.values()) {
            const hit = arr.find(c => c.remake_of_casting_id === castingId && c.remake_of_panel_id === comp.panel_id);
            if (hit) { dest = hit; break; }
        }
        if (dest) {
            const destCasting = currentCastings.find(c => c.id === dest.casting_id);
            const destNum = destCasting?.casting_number || '?';
            const destPanel = dest.panel_id || '?';
            remakeDestLabel = `${destNum}:${destPanel}`;
            remakeDestTitle = `Imported into casting ${destNum} as panel ${destPanel}.`;
        }
    }

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
                <select class="pp-track-crate-select${currentNum ? ' pp-track-crate-set' : ''}" data-action="track-crate-select" data-component-id="${escapeAttr(comp.id)}" title="${escapeAttr(crateTitle)}">${options}</select>
                <select class="pp-track-crate-select pp-track-truck-select${truckNo ? ' pp-track-truck-set' : ''}" data-action="track-truck-select" data-component-id="${escapeAttr(comp.id)}" title="${escapeAttr(truckTitle)}">${truckOptions}</select>
                <label class="pp-track-rejected-cell" title="${escapeAttr(rejectTitle)}">
                    <input type="checkbox" class="pp-track-rejected" data-action="track-rejected-toggle" data-component-id="${escapeAttr(comp.id)}" ${isRejected ? 'checked' : ''} aria-label="Mark as rejected" />
                </label>
                <span class="pp-track-remake-cell" title="${escapeAttr(remakeDestTitle)}">${escapeHtml(remakeDestLabel)}</span>
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
            // A remake row re-casts several rejected panels (one id per piece): each piece points back at its own one.
            const remakeIds = inv.remake_of_casting_id ? invRemakeIds(inv) : [];
            for (let i = 0; i < qty; i++) {
                const remakeId = remakeIds[i] || null;
                expected.push({
                    type: inv.type || null,
                    width: inv.width || null,
                    length: inv.length || null,
                    panel_id: nextPanelId(inv.type),
                    color: inv.color || null,
                    color_log_id: inv.color_log_id || null,
                    sealer: inv.sealer || null,
                    remake_of_panel_id: remakeId,
                    remake_of_casting_id: remakeId ? inv.remake_of_casting_id : null
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
                    sealer: inv.sealer || null,
                    remake_of_panel_id: null,
                    remake_of_casting_id: null
                });
            }
        }

        const current = getComponentsFor(casting.id);
        if (componentsMatchExpected(current, expected)) continue;

        // Defense in depth: if a UI guard ever lets an inventory mutation
        // through on a locked casting, refuse to wipe and rebuild its
        // components here. The handler that triggered the sync has already
        // toasted (or should have), so abort silently with a logger warning.
        if (isCastingInventoryLocked(casting)) {
            logger.warn('[project-portal] runTrackingSync: skipping locked casting', casting.casting_number || casting.id);
            continue;
        }

        // The DELETE+INSERT below replaces the casting's casting_components rows
        // from inventory data, but inventory has no concept of `rejected`,
        // `produced`, or `crate_id` — those are tracking-only fields. Snapshot
        // them by panel_id first and restore after the rebuild so a benign
        // inventory edit doesn't wipe QC/production/crate state (project 0118).
        // If the snapshot fetch fails we abort rather than silently wipe.
        let trackingStateSnapshot;
        try {
            trackingStateSnapshot = await loadTrackingStateForCasting(casting.id);
        } catch (err) {
            logger.error('[project-portal] snapshot tracking state failed for casting', casting.id, err);
            showToast('Tracking sync failed: ' + (err.message || err), 'error');
            return;
        }

        try {
            await deleteAllComponentsForCasting(casting.id);
            if (expected.length === 0) {
                setComponentsFor(casting.id, []);
            } else {
                const created = await createComponentsBulk(casting.id, expected);
                // Restore rejected/produced/crate_id onto the new rows by panel_id.
                // Panels whose panel_id no longer exists after the rebuild (e.g.
                // the inventory row was removed) are correctly dropped.
                await applyTrackingStateForCasting(casting.id, trackingStateSnapshot);
                // Re-read the rebuilt rows so the in-memory cache reflects the
                // restored tracking fields, not the post-INSERT defaults.
                const refreshed = await loadAllComponentsForProject([casting.id]);
                setComponentsFor(casting.id, refreshed.get(casting.id) || created || []);
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
function showToast(msg, kind = 'success', ms = 2500) {
    const el = document.getElementById('pp-toast');
    el.textContent = msg;
    el.className = `pp-toast pp-toast-${kind}`;
    el.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

// ---------- Live multi-user refresh (2026-10-19) ----------
// Another portal saved something: reload the tab that shows it, unless this user is in the
// middle of typing there (then wait for the field to blur). Own saves never arrive here.
const LIVE_TABLE_TABS = {
    projects: ['info'],
    project_phases: ['*'],
    project_castings: ['*'],
    casting_inventory: ['castings', 'batch-tickets', 'jig-list', 'casting-layout', 'tracking', 'color-log'],
    casting_components: ['tracking', 'shipping', 'castings', 'casting-layout'],
    project_crates: ['tracking', 'shipping'],
    batch_tickets: ['batch-tickets', 'color-log'],
    color_logs: ['color-log', 'batch-tickets', 'castings'],
    casting_phases: ['optimizer', 'actual-labor'],
    plant_schedule_settings: ['optimizer'],   // "Ready for scheduling" flags
    actual_hours: ['actual-labor'],
    task_descriptions: ['staging'],
    jig_lists: ['jig-list'],
    casting_layout_positions: ['casting-layout'],
    job_memos: ['job-memos'],
    project_classroom_tasks: ['cr-notes'],
    casting_milestones: ['approvals', 'cr-notes']
};
const LIVE_TAB_LABELS = {
    info: 'Project Info', castings: 'Castings', optimizer: 'Optimizer Hours', staging: 'Staging', approvals: 'Releasability Approvals',
    tracking: 'Tracking', shipping: 'Shipping', 'casting-layout': 'Casting Layout', 'jig-list': 'Jig List', 'color-log': 'Color Log',
    'batch-tickets': 'Batch Tickets', 'job-memos': 'Job Memos', 'cr-notes': 'Class Rooms', 'actual-labor': 'Actual Labor'
};
const liveReloadPending = new Set();   // tabs waiting for the user to stop typing
let liveReloadTimer = null;
let liveReloadRunning = false;

async function handleLiveRefresh(last, payloads) {
    const batch = (Array.isArray(payloads) && payloads.length ? payloads : [last]).filter(p => !isOwnSignal(p));
    if (!batch.length) return;
    const tables = new Set();
    let milestones = false;
    for (const p of batch) {
        const info = signalInfo(p);
        if (info.action === 'releasability_status_updated') { milestones = true; continue; }
        if (!isPortalChange(p)) continue;
        // Another job's save: skip when we can tell. Signals without a project are taken as ours.
        if (currentProjectNumber && info.project && String(info.project) !== String(currentProjectNumber)) continue;
        if (currentProjectNumber && !info.project && info.castingId && currentCastings.length && !currentCastings.some(c => c.id === info.castingId)) continue;
        tables.add(info.table);
        if (info.table === 'casting_milestones') milestones = true;
    }
    if (!tables.size && !milestones) return;

    // List view: only the project list can change.
    if (!currentProjectNumber) {
        if (tables.has('projects') || tables.has('project_phases') || tables.has('project_castings')) {
            try { await refreshList(); } catch (e) { logger.warn('[live] refreshList failed', e); }
        }
        return;
    }

    const tabs = new Set();
    for (const t of tables) for (const tab of (LIVE_TABLE_TABS[t] || [])) tabs.add(tab);
    if (milestones) tabs.add('ms');

    // Caches that would otherwise serve stale data when the tab is next opened.
    if (tabs.has('*') || tabs.has('batch-tickets')) batchTicketsLoadedFor = null;
    if (tabs.has('*') || tabs.has('color-log')) colorLogLoadedFor = null;
    if (tabs.has('*') || tabs.has('job-memos')) jobMemosLoadedFor = null;
    if (tabs.has('*') || tabs.has('tracking') || tabs.has('shipping')) cratesLoadedFor = null;
    if (tabs.has('*') || tabs.has('castings')) currentCastingInventoryLoadedFor = null;
    if (tabs.has('*')) phasesLoadedFor = null;

    const wanted = new Set();
    if (tabs.has('*')) { wanted.add('*'); }
    else {
        if (tabs.has(currentTab)) wanted.add(currentTab);
        if (tabs.has('ms')) wanted.add('ms');
        // Castings data feeds most tabs: refresh the shared state even when another tab is open.
        if (tabs.has('castings') && currentTab !== 'castings') wanted.add('castings-data');
    }
    if (!wanted.size) return;
    for (const w of wanted) liveReloadPending.add(w);
    scheduleLiveReload();
}

function liveUserBusy() {
    const form = document.getElementById('pp-form-view');
    if (!form || form.hidden) return false;
    const ae = document.activeElement;
    if (ae && form.contains(ae) && (ae.matches('input, textarea, select, [contenteditable="true"]'))) return true;
    if (invEdits.size) return true;                                           // inventory edits not yet accepted
    if (document.querySelector('.pp-modal-backdrop:not([hidden])')) return true;   // a dialog is open
    return false;
}

function scheduleLiveReload(delay = 0) {
    if (liveReloadTimer) clearTimeout(liveReloadTimer);
    liveReloadTimer = setTimeout(runLiveReload, delay);
}
function armLiveReloadRetry() { scheduleLiveReload(1500); }   // after a blur: let the debounced save land first

async function runLiveReload() {
    liveReloadTimer = null;
    if (!liveReloadPending.size || liveReloadRunning) return;
    if (!currentProjectNumber) { liveReloadPending.clear(); return; }
    if (liveUserBusy()) { scheduleLiveReload(5000); return; }   // typing — try again; focusout also retries
    const wanted = new Set(liveReloadPending);
    liveReloadPending.clear();
    liveReloadRunning = true;
    try {
        if (wanted.has('*')) {
            await liveReloadProjectAndPhases();
            await loadAndRenderCastings();
            if (currentTab !== 'castings') await liveReloadTab(currentTab);
        } else {
            if (wanted.has('castings-data')) await loadAndRenderCastings();
            if (wanted.has('ms')) {
                await loadMilestones();
                updateMsFloat(); refreshInlineMs();
                if (currentTab === 'castings' && !wanted.has('castings')) renderCastings();
                if (currentTab === 'approvals') renderApprovals();
                if (currentTab === 'cr-notes') renderClassroomMs();
                if (currentTab === 'optimizer') renderOptimizer();
            }
            if (wanted.has(currentTab)) await liveReloadTab(currentTab);
        }
        const label = wanted.has('*') ? 'this job' : (LIVE_TAB_LABELS[currentTab] || 'this tab');
        showToast(`Someone else updated ${label} — reloaded`, 'info', 4500);   // bigger + longer (see .pp-toast-info)
    } catch (err) {
        logger.warn('[live] reload failed', err);
    } finally {
        liveReloadRunning = false;
        if (liveReloadPending.size) scheduleLiveReload(500);
    }
}

async function liveReloadProjectAndPhases() {
    let project = null;
    try { project = await loadProject(currentProjectNumber); } catch (e) { /* keep what we have */ }
    if (!project) return;
    populateForm(project);
    currentPhasesEnabled = !!project.phases_enabled;
    currentMultiColorEnabled = !!project.multi_color_enabled;
    shipQtyModeGlobal = !!project.ship_qty_mode;
    if (currentPhasesEnabled) {
        try { currentPhases = await loadPhasesForProject(project.project_number); phasesLoadedFor = project.project_number; }
        catch (e) { currentPhases = []; }
    } else { currentPhases = []; phasesLoadedFor = null; }
    ensureValidCurrentPhase();
    renderPhasesSection();
    renderPhaseSwitcher();
    updateFormContext(project);
}

async function liveReloadTab(tab) {
    switch (tab) {
        case 'info':           await liveReloadProjectAndPhases(); break;
        case 'castings':       await loadAndRenderCastings(); break;
        case 'optimizer':      await activateOptimizerTab(); break;
        case 'staging':        await activateStagingTab(); break;
        case 'approvals':      await activateApprovalsTab(); break;
        case 'tracking':       await activateTrackingTab(); break;
        case 'shipping':       await activateShippingTab(); break;
        case 'casting-layout': await activateCastingLayoutTab(); break;
        case 'jig-list':       await activateJigListTabWithCtx(); break;
        case 'color-log':      await activateColorLogTab(); break;
        case 'batch-tickets':  await activateBatchTicketsTab(); break;
        case 'job-memos':      await activateJobMemosTab(); break;
        case 'actual-labor':   await activateActualLaborTab(); break;
        case 'cr-notes':       await loadAndRenderClassroomTasks(); break;
        default: break;
    }
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
        baseIngredients: [{ name: 'Sand', weight: '', unit: 'lbs', note: '' }],
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

const clIsSandItem = (item) => ((item?.name || '').trim().toLowerCase() === 'sand');

function clEnsureSandRow(log) {
    if (!log || !Array.isArray(log.baseIngredients)) return;
    const sand = log.baseIngredients.find(clIsSandItem);
    if (sand) { sand.name = 'Sand'; return; }
    log.baseIngredients.unshift({ name: 'Sand', weight: '', unit: 'lbs', note: '' });
}

function clGetSandWeightLbs(baseTableId = 'pp-cl-base-table') {
    const rows = document.querySelectorAll(`#${baseTableId} tbody tr`);
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
    tbody.innerHTML = items.map((item, i) => {
        const isSand = type === 'base' && clIsSandItem(item);
        const nameCell = isSand
            ? `<td><input type="text" value="Sand" data-cl-field="name" readonly title="Sand is required — name is locked" style="opacity:0.65;cursor:default;"></td>`
            : `<td><input type="text" value="${escapeAttr(item.name || '')}" data-cl-field="name"></td>`;
        const actionCell = isSand
            ? `<td class="pp-cl-col-action"></td>`
            : `<td class="pp-cl-col-action"><button type="button" class="pp-cl-btn-remove" data-cl-remove>&times;</button></td>`;
        return `
        <tr data-cl-type="${type}" data-cl-idx="${i}">
            ${nameCell}
            <td><input type="number" step="any" value="${item[valField] ?? item.weight ?? item.amount ?? ''}" data-cl-field="${valField}"></td>
            <td>${clUnitSelect(item.unit || 'lbs')}</td>
            <td><input type="text" value="${escapeAttr(item.note || '')}" data-cl-field="note"></td>
            ${actionCell}
        </tr>`;
    }).join('');
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

function clRenderPigmentTable(tableId, items, type, baseTableId = 'pp-cl-base-table') {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    const sandLbs = clGetSandWeightLbs(baseTableId);
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
    clEnsureSandRow(currentColorLog);
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

    // Lock the form when this project log is a snapshot of a standard color.
    clApplyLockState();
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
    if (type === 'base' && clIsSandItem(list[idx])) return;
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

function clRecomputeRowQty(tr, item, baseTableId = 'pp-cl-base-table') {
    const qtyInput = tr.querySelector('input[data-cl-field="qty"]');
    if (!qtyInput) return;
    const sandLbs = clGetSandWeightLbs(baseTableId);
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
    // Snapshot the preset's fields into the project's log, preserving id/projectNumber.
    // presetName is retained (not cleared): a non-empty presetName on a project log
    // marks it as locked to that standard color — see isColorLogLocked().
    const keepId = currentColorLog.id;
    const keepProject = currentColorLog.projectNumber;
    const standardName = preset.presetName || preset.name || '';
    currentColorLog = {
        ...preset,
        id: keepId,
        projectNumber: keepProject,
        isPreset: false,
        // Name the project's color after the standard color. Presets keep their
        // identity in presetName; the inner `name` is often blank (e.g. presets
        // made in the Standard Colors tab), which otherwise rendered "unnamed".
        name: standardName,
        presetName: standardName
    };
    renderColorLog();
    scheduleColorLogSave();
}

/**
 * A project color log is "locked" when it's a frozen snapshot of a standard
 * color — i.e. a non-preset log carrying a presetName. Locked logs render
 * read-only; the user must Clear the selection to build a custom log.
 */
function isColorLogLocked() {
    return !!(currentColorLog && !currentColorLog.isPreset && (currentColorLog.presetName || '').trim());
}

/**
 * Apply the locked/unlocked state to the color-log form: toggle the banner,
 * disable every recipe input inside the form wrap, and gate "Save as Standard
 * Color" (only meaningful for a custom, unlocked log). Toolbar controls (preset
 * picker, multi-color, pills, Clear) stay live.
 */
function clApplyLockState() {
    const locked = isColorLogLocked();
    const wrap = document.getElementById('pp-cl-wrap');
    if (wrap) {
        wrap.classList.toggle('pp-cl-locked', locked);
        wrap.querySelectorAll('input, select, textarea, button').forEach(el => { el.disabled = locked; });
    }
    const banner = document.getElementById('pp-cl-lock-banner');
    if (banner) banner.hidden = !locked;
    const nameEl = document.getElementById('pp-cl-lock-name');
    if (nameEl) nameEl.textContent = locked ? (currentColorLog.presetName || '') : '';
    const saveBtn = document.getElementById('pp-cl-save-preset-btn');
    if (saveBtn) saveBtn.disabled = locked;
}

/**
 * Clear the standard-color selection: wipe every field (including the name)
 * back to a blank log and unlock it so the user can build one from scratch.
 */
function handleClearColorLogSelection() {
    if (!currentColorLog) return;
    if (!window.confirm('Clear this color log and start from scratch?\n\nThis removes the standard color values and the name so you can build a custom color log.')) return;
    const keepId = currentColorLog.id;
    const keepProject = currentColorLog.projectNumber;
    currentColorLog = {
        ...createEmptyColorLog(),
        id: keepId,
        projectNumber: keepProject,
        isPreset: false,
        presetName: ''
    };
    clEnsureSandRow(currentColorLog);
    renderColorLog();
    scheduleColorLogSave();
}

// ============================================================================
// STANDARD COLORS (preset) MANAGEMENT TAB
// A top-level view to browse/create/edit/delete standard colors (color_logs
// where is_preset = true). Reuses the low-level color-log row renderers against
// a parallel set of pp-pcl-* table ids, editing a working copy (editingPreset)
// so the project color-log code path stays untouched.
// ============================================================================

let editingPreset = null;        // deep-cloned working copy of the preset under edit
let editingPresetIsNew = false;  // true when editingPreset is an unsaved new preset
let standardColorsFilter = '';

const PCL_TYPE_TABLE = {
    base: 'pp-pcl-base-table',
    additive: 'pp-pcl-additives-table',
    aggregate: 'pp-pcl-aggregates-table',
    pigment: 'pp-pcl-pigments-table',
    grout: 'pp-pcl-grout-table',
    fillCoat: 'pp-pcl-fillcoat-table',
};

async function showStandardColorsView() {
    // Flush any pending saves from other views first.
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
    updateMsFloat();
    const memosView = document.getElementById('pp-memos-view');
    if (memosView) memosView.hidden = true;
    const scView = document.getElementById('pp-standards-view');
    if (scView) scView.hidden = false;
    setFolderTabActive('standard-colors');

    editingPreset = null;
    editingPresetIsNew = false;
    showPresetEditor(false);
    await loadAndRenderStandardColors();
}

async function loadAndRenderStandardColors() {
    const listEl = document.getElementById('pp-sc-list');
    if (listEl) listEl.innerHTML = '<div class="pp-sc-loading">Loading…</div>';
    try {
        colorLogPresets = await loadColorLogPresets();
    } catch (err) {
        logger.error('[standard-colors] load failed', err);
        colorLogPresets = [];
        showToast('Failed to load standard colors', 'error');
    }
    renderStandardColorsList();
}

function renderStandardColorsList() {
    const listEl = document.getElementById('pp-sc-list');
    if (!listEl) return;
    const filter = (standardColorsFilter || '').trim().toLowerCase();
    const items = !filter
        ? colorLogPresets
        : colorLogPresets.filter(p => (p.presetName || p.name || '').toLowerCase().includes(filter));
    if (!items.length) {
        listEl.innerHTML = `<div class="pp-sc-list-empty">No standard colors${filter ? ' match your filter.' : ' yet.'}</div>`;
        return;
    }
    const activeId = (editingPreset && !editingPresetIsNew) ? editingPreset.id : null;
    listEl.innerHTML = items.map(p => {
        const label = escapeHtml((p.presetName || p.name || '(unnamed)').trim());
        const active = p.id === activeId ? ' is-active' : '';
        return `<button type="button" class="pp-sc-list-item${active}" data-preset-id="${escapeAttr(p.id)}">${label}</button>`;
    }).join('');
}

function showPresetEditor(show) {
    const container = document.getElementById('pp-sc-editor');
    const emptyEl = document.getElementById('pp-sc-empty');
    if (container) container.hidden = !show;
    if (emptyEl) emptyEl.hidden = show;
}

function selectPresetForEdit(id) {
    const src = colorLogPresets.find(p => p.id === id);
    if (!src) return;
    editingPreset = JSON.parse(JSON.stringify(src));
    editingPresetIsNew = false;
    clEnsureSandRow(editingPreset);
    renderPresetEditor();
    renderStandardColorsList();
}

function startNewPreset() {
    editingPreset = { ...createEmptyColorLog(), isPreset: true, presetName: '' };
    editingPresetIsNew = true;
    clEnsureSandRow(editingPreset);
    renderPresetEditor();
    renderStandardColorsList();
}

function pclRenderType(type) {
    if (!editingPreset) return;
    const tableId = PCL_TYPE_TABLE[type];
    const items = editingPreset[CL_TYPE_KEY[type]] || [];
    if (type === 'base' || type === 'additive') clRenderIngTable(tableId, items, type);
    else if (type === 'aggregate') clRenderSimpleTable(tableId, items, type);
    else if (type === 'pigment' || type === 'fillCoat') clRenderPigmentTable(tableId, items, type, 'pp-pcl-base-table');
    else if (type === 'grout') clRenderGroutTable(tableId, items, type);
}

function renderPresetEditor() {
    const container = document.getElementById('pp-sc-editor');
    if (!container) return;
    if (!editingPreset) { showPresetEditor(false); return; }
    if (!container.dataset.built) {
        container.innerHTML = presetEditorFormHtml();
        container.dataset.built = '1';
    }
    showPresetEditor(true);

    const p = editingPreset;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
    set('pp-pcl-presetname', p.presetName || '');
    set('pp-pcl-temp', p.temperature);
    set('pp-pcl-date', p.date);
    set('pp-pcl-madeby', p.madeBy);
    set('pp-pcl-finishing-notes', p.finishingNotes);
    set('pp-pcl-sealing-notes', p.sealingNotes);

    document.getElementById('pp-pcl-std-box')?.classList.toggle('checked', p.isStandard !== false);
    document.getElementById('pp-pcl-cust-box')?.classList.toggle('checked', p.isStandard === false);
    document.querySelectorAll('input[name="pp-pcl-cement"]').forEach(r => { r.checked = (r.value === (p.cementType || 'white')); });
    document.querySelectorAll('input[name="pp-pcl-cast"]').forEach(r => { r.checked = (r.value === (p.castMethod || 'sprayUp')); });

    Object.keys(CL_TYPE_KEY).forEach(pclRenderType);

    const delBtn = document.getElementById('pp-sc-delete');
    if (delBtn) delBtn.hidden = editingPresetIsNew;
    const titleEl = document.getElementById('pp-sc-editor-title');
    if (titleEl) titleEl.textContent = editingPresetIsNew ? 'New Standard Color' : 'Edit Standard Color';
}

function presetEditorFormHtml() {
    return `
    <div class="pp-sc-editor-bar">
        <span class="pp-sc-editor-title" id="pp-sc-editor-title">Edit Standard Color</span>
        <div class="pp-sc-editor-actions">
            <button type="button" id="pp-sc-save" class="pp-sc-save-btn">Save</button>
            <button type="button" id="pp-sc-delete" class="pp-sc-delete-btn">Delete</button>
            <button type="button" id="pp-sc-cancel" class="pp-sc-cancel-btn">Close</button>
        </div>
    </div>
    <div class="pp-cl-wrap">
      <div class="pp-cl-paper">
        <div class="pp-cl-header">
            <div>
                <div class="pp-cl-title">STANDARD COLOR</div>
                <div class="pp-cl-sub">Concreteworks East &mdash; master formula</div>
            </div>
            <div class="pp-cl-sample">
                <span class="pp-cl-sample-label">Name:</span>
                <input type="text" id="pp-pcl-presetname" class="pp-cl-input pp-cl-input-lg" placeholder="Standard Color Name">
            </div>
        </div>

        <div class="pp-cl-grid-2">
            <div class="pp-cl-field"><span class="pp-cl-label">Temperature:</span><input type="text" id="pp-pcl-temp" class="pp-cl-input"></div>
            <div class="pp-cl-field"><span class="pp-cl-label">Made By:</span><input type="text" id="pp-pcl-madeby" class="pp-cl-input"></div>
        </div>
        <div class="pp-cl-grid-2">
            <div class="pp-cl-field"><span class="pp-cl-label">Date:</span><input type="date" id="pp-pcl-date" class="pp-cl-input"></div>
            <div class="pp-cl-field"></div>
        </div>

        <div class="pp-cl-std-row">
            <div class="pp-cl-cb-tag">
                <span class="pp-cl-tag" data-cl-std="true">STANDARD</span>
                <span class="pp-cl-tag-box checked" id="pp-pcl-std-box" data-cl-std="true"></span>
                <span class="pp-cl-tag" data-cl-std="false" style="margin-left:30px;">CUSTOM</span>
                <span class="pp-cl-tag-box" id="pp-pcl-cust-box" data-cl-std="false"></span>
            </div>
        </div>

        <div class="pp-cl-cb-row">
            <span class="pp-cl-label" style="font-weight:700;">Cement Type:</span>
            <label class="pp-cl-cb"><input type="radio" name="pp-pcl-cement" value="white" checked><span class="pp-cl-checkbox"></span> White Portland</label>
            <label class="pp-cl-cb"><input type="radio" name="pp-pcl-cement" value="gray"><span class="pp-cl-checkbox"></span> Gray Portland</label>
            <label class="pp-cl-cb"><input type="radio" name="pp-pcl-cement" value="other"><span class="pp-cl-checkbox"></span> Other</label>
        </div>

        <div class="pp-cl-divider"></div>

        <div class="pp-cl-2col">
            <div class="pp-cl-col-left">
                <table class="pp-cl-ing-table" id="pp-pcl-base-table">
                    <thead><tr><th>Ingredient</th><th style="width:20%;">Weight</th><th style="width:22%;">Unit</th><th style="width:20%;">Note</th><th class="pp-cl-col-action"></th></tr></thead>
                    <tbody></tbody>
                </table>
                <button class="pp-cl-btn-add" type="button" data-cl-add="base">+ Add Ingredient</button>
            </div>
            <div class="pp-cl-col-right">
                <table class="pp-cl-ing-table" id="pp-pcl-additives-table">
                    <thead><tr><th>Additive</th><th style="width:20%;">Amount</th><th style="width:22%;">Unit</th><th style="width:20%;">Note</th><th class="pp-cl-col-action"></th></tr></thead>
                    <tbody></tbody>
                </table>
                <button class="pp-cl-btn-add" type="button" data-cl-add="additive">+ Add Additive</button>
            </div>
        </div>

        <div class="pp-cl-cb-row pp-cl-cb-row-bordered">
            <span class="pp-cl-label" style="font-weight:700;">Cast Method:</span>
            <label class="pp-cl-cb"><input type="radio" name="pp-pcl-cast" value="sprayUp" checked><span class="pp-cl-checkbox"></span> Spray Up</label>
            <label class="pp-cl-cb"><input type="radio" name="pp-pcl-cast" value="directCast"><span class="pp-cl-checkbox"></span> Direct Cast</label>
            <label class="pp-cl-cb"><input type="radio" name="pp-pcl-cast" value="other"><span class="pp-cl-checkbox"></span> Other</label>
        </div>

        <div class="pp-cl-2col">
            <div class="pp-cl-col-left">
                <div class="pp-cl-sect-label">Aggregates:</div>
                <table class="pp-cl-ing-table" id="pp-pcl-aggregates-table">
                    <thead><tr><th>Name</th><th style="width:30%;">Amount</th><th style="width:28%;">Unit</th><th class="pp-cl-col-action"></th></tr></thead>
                    <tbody></tbody>
                </table>
                <button class="pp-cl-btn-add" type="button" data-cl-add="aggregate">+ Add Aggregate</button>
            </div>
            <div class="pp-cl-col-right">
                <div class="pp-cl-sect-label">Pigments:</div>
                <table class="pp-cl-ing-table" id="pp-pcl-pigments-table">
                    <thead><tr><th style="width:22%;">Pigment</th><th style="width:20%;">%</th><th style="width:20%;">Weight</th><th style="width:24%;">Unit</th><th class="pp-cl-col-action"></th></tr></thead>
                    <tbody></tbody>
                </table>
                <button class="pp-cl-btn-add" type="button" data-cl-add="pigment">+ Add Pigment</button>
            </div>
        </div>

        <div class="pp-cl-2col">
            <div class="pp-cl-col-left">
                <div class="pp-cl-sect-label">Grout Type:</div>
                <table class="pp-cl-ing-table" id="pp-pcl-grout-table">
                    <thead><tr><th>Grout Name</th><th style="width:30%;">Ratio %</th><th class="pp-cl-col-action"></th></tr></thead>
                    <tbody></tbody>
                </table>
                <button class="pp-cl-btn-add" type="button" data-cl-add="grout">+ Add Grout</button>
            </div>
            <div class="pp-cl-col-right">
                <div class="pp-cl-sect-label">Fill Coat:</div>
                <table class="pp-cl-ing-table" id="pp-pcl-fillcoat-table">
                    <thead><tr><th style="width:22%;">Fill Pigment</th><th style="width:20%;">%</th><th style="width:20%;">Weight</th><th style="width:24%;">Unit</th><th class="pp-cl-col-action"></th></tr></thead>
                    <tbody></tbody>
                </table>
                <button class="pp-cl-btn-add" type="button" data-cl-add="fillCoat">+ Add Fill Pigment</button>
            </div>
        </div>

        <div class="pp-cl-divider"></div>

        <div class="pp-cl-2col">
            <div class="pp-cl-col-left">
                <div class="pp-cl-sect-label">Finishing Notes:</div>
                <textarea id="pp-pcl-finishing-notes" class="pp-cl-textarea" rows="4"></textarea>
            </div>
            <div class="pp-cl-col-right">
                <div class="pp-cl-sect-label">Sealing Notes:</div>
                <textarea id="pp-pcl-sealing-notes" class="pp-cl-textarea" rows="4"></textarea>
            </div>
        </div>
      </div>
    </div>`;
}

// ----- Standard Colors editor row handlers (operate on editingPreset) -----

function pclHandleRowInputChange(tr, input) {
    if (!editingPreset) return;
    const type = tr.dataset.clType;
    const idx = parseInt(tr.dataset.clIdx, 10);
    const field = input.dataset.clField;
    const key = CL_TYPE_KEY[type];
    if (!key || isNaN(idx)) return;
    const item = editingPreset[key]?.[idx];
    if (!item) return;
    if (field === 'name' || field === 'note') item[field] = input.value;
    else if (field === 'weight') item.weight = input.value === '' ? '' : parseFloat(input.value);
    else if (field === 'amount') item.amount = input.value === '' ? '' : parseFloat(input.value);
    else if (field === 'pct') item.pct = input.value === '' ? '' : parseFloat(input.value);
    else if (field === 'ratio') item.ratio = input.value === '' ? '' : parseFloat(input.value);
    if (type === 'base' && (field === 'name' || field === 'weight')) { pclRenderType('pigment'); pclRenderType('fillCoat'); }
    if (field === 'pct' && (type === 'pigment' || type === 'fillCoat')) clRecomputeRowQty(tr, item, 'pp-pcl-base-table');
}

function pclHandleRowUnitChange(tr, select) {
    if (!editingPreset) return;
    const type = tr.dataset.clType;
    const idx = parseInt(tr.dataset.clIdx, 10);
    const key = CL_TYPE_KEY[type];
    if (!key || isNaN(idx)) return;
    const item = editingPreset[key]?.[idx];
    if (!item) return;
    item.unit = select.value;
    if (type === 'base') { pclRenderType('pigment'); pclRenderType('fillCoat'); }
    else if (type === 'pigment' || type === 'fillCoat') pclRenderType(type);
}

function pclHandleAdd(type) {
    if (!editingPreset) return;
    const key = CL_TYPE_KEY[type];
    if (!key) return;
    const list = editingPreset[key];
    if (type === 'base') list.push({ name: '', weight: '', unit: 'lbs', note: '' });
    else if (type === 'additive') list.push({ name: '', amount: '', unit: 'oz', note: '' });
    else if (type === 'aggregate') list.push({ name: '', amount: '', unit: 'lbs' });
    else if (type === 'pigment' || type === 'fillCoat') list.push({ name: '', pct: '', qty: '', unit: 'lbs' });
    else if (type === 'grout') list.push({ name: '', ratio: '' });
    pclRenderType(type);
}

function pclHandleRemove(type, idx) {
    if (!editingPreset) return;
    const key = CL_TYPE_KEY[type];
    const list = editingPreset[key];
    if (!list || idx < 0 || idx >= list.length) return;
    if (type === 'base' && clIsSandItem(list[idx])) return;
    list.splice(idx, 1);
    pclRenderType(type);
}

async function handleSaveStandardColor() {
    if (!editingPreset) return;
    const name = (editingPreset.presetName || '').trim();
    if (!name) { showToast('Enter a standard color name first', 'error'); return; }
    try {
        let saved;
        if (editingPresetIsNew) {
            saved = await saveColorLogAsPreset(name, editingPreset);
        } else {
            saved = await updateColorLogPreset(editingPreset.id, editingPreset, name);
        }
        colorLogPresets = await loadColorLogPresets();
        const fresh = colorLogPresets.find(p => p.id === (saved?.id || editingPreset.id));
        editingPreset = fresh ? JSON.parse(JSON.stringify(fresh)) : null;
        if (editingPreset) clEnsureSandRow(editingPreset);
        editingPresetIsNew = false;
        renderStandardColorsList();
        renderPresetEditor();
        showToast('Standard color saved', 'success');
    } catch (err) {
        logger.error('[standard-colors] save failed', err);
        showToast('Failed to save standard color', 'error');
    }
}

async function handleDeleteStandardColor() {
    if (!editingPreset || editingPresetIsNew) return;
    const label = (editingPreset.presetName || editingPreset.name || 'this standard color').trim();
    if (!window.confirm(`Delete standard color "${label}"?\n\nThis cannot be undone. Projects already locked to it keep their snapshot.`)) return;
    try {
        await deleteColorLogPreset(editingPreset.id);
        editingPreset = null;
        editingPresetIsNew = false;
        showPresetEditor(false);
        colorLogPresets = await loadColorLogPresets();
        renderStandardColorsList();
        showToast('Standard color deleted', 'success');
    } catch (err) {
        logger.error('[standard-colors] delete failed', err);
        showToast('Failed to delete standard color', 'error');
    }
}

function initStandardColorsEvents() {
    const searchEl = document.getElementById('pp-sc-search');
    if (searchEl) searchEl.addEventListener('input', (e) => {
        standardColorsFilter = e.target.value;
        renderStandardColorsList();
    });

    const newBtn = document.getElementById('pp-sc-new');
    if (newBtn) newBtn.addEventListener('click', () => startNewPreset());

    const listEl = document.getElementById('pp-sc-list');
    if (listEl) listEl.addEventListener('click', (e) => {
        const item = e.target.closest('[data-preset-id]');
        if (item) selectPresetForEdit(item.dataset.presetId);
    });

    const editor = document.getElementById('pp-sc-editor');
    if (!editor) return;

    editor.addEventListener('click', (e) => {
        if (e.target.id === 'pp-sc-save')   { handleSaveStandardColor(); return; }
        if (e.target.id === 'pp-sc-delete') { handleDeleteStandardColor(); return; }
        if (e.target.id === 'pp-sc-cancel') {
            editingPreset = null; editingPresetIsNew = false;
            showPresetEditor(false); renderStandardColorsList();
            return;
        }
        const addBtn = e.target.closest('[data-cl-add]');
        if (addBtn) { pclHandleAdd(addBtn.dataset.clAdd); return; }
        const removeBtn = e.target.closest('[data-cl-remove]');
        if (removeBtn) {
            const tr = removeBtn.closest('tr');
            if (tr) pclHandleRemove(tr.dataset.clType, parseInt(tr.dataset.clIdx, 10));
            return;
        }
        const stdEl = e.target.closest('[data-cl-std]');
        if (stdEl && editingPreset) {
            editingPreset.isStandard = stdEl.dataset.clStd === 'true';
            document.getElementById('pp-pcl-std-box')?.classList.toggle('checked', editingPreset.isStandard);
            document.getElementById('pp-pcl-cust-box')?.classList.toggle('checked', !editingPreset.isStandard);
        }
    });

    editor.addEventListener('input', (e) => {
        if (!editingPreset) return;
        const t = e.target;
        if (t.id === 'pp-pcl-presetname')      { editingPreset.presetName = t.value; return; }
        if (t.id === 'pp-pcl-temp')            { editingPreset.temperature = t.value; return; }
        if (t.id === 'pp-pcl-date')            { editingPreset.date = t.value; return; }
        if (t.id === 'pp-pcl-madeby')          { editingPreset.madeBy = t.value; return; }
        if (t.id === 'pp-pcl-finishing-notes') { editingPreset.finishingNotes = t.value; return; }
        if (t.id === 'pp-pcl-sealing-notes')   { editingPreset.sealingNotes = t.value; return; }
        const tr = t.closest('tr[data-cl-type]');
        if (tr && t.matches('input[data-cl-field]')) pclHandleRowInputChange(tr, t);
    });

    editor.addEventListener('change', (e) => {
        if (!editingPreset) return;
        const t = e.target;
        if (t.name === 'pp-pcl-cement') { editingPreset.cementType = t.value; return; }
        if (t.name === 'pp-pcl-cast')   { editingPreset.castMethod = t.value; return; }
        const tr = t.closest('tr[data-cl-type]');
        if (tr && t.tagName === 'SELECT') pclHandleRowUnitChange(tr, t);
    });
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
    // No colour stored (or one that no longer exists): say so instead of letting the browser show the first log
    // as if it were chosen — that is how whole castings ended up printing "no color in the inventory" (2026-10-22).
    const placeholderOpt = !selectedId || !currentColorLogs.some(l => l.id === selectedId)
        ? `<option value="" selected>— Pick color —</option>`
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
    updateMsFloat();
    const memosView = document.getElementById('pp-memos-view');
    if (memosView) memosView.hidden = false;
    const scViewRM = document.getElementById('pp-standards-view');
    if (scViewRM) scViewRM.hidden = true;
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

    // List: print projects grouped into one column per PM (excludes shipped)
    document.getElementById('pp-print-list-btn').addEventListener('click', (e) => {
        e.preventDefault();
        handlePrintList();
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
            } else if (which === 'standard-colors') {
                showStandardColorsView();
            }
        });
    });

    // Standard Colors tab wiring (sidebar list, search, new, editor).
    initStandardColorsEvents();

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

    // Need By Date: calendar button summons the native date picker, which writes a
    // MM/DD/YYYY value into the free-text field (typing a loose value still works).
    const needByPickBtn = document.getElementById('pp-need_by_date-pick');
    const needByPicker = document.getElementById('pp-need_by_date-picker');
    const needByText = document.getElementById('pp-f-need_by_date');
    if (needByPickBtn && needByPicker && needByText) {
        needByPickBtn.addEventListener('click', () => {
            // Open the calendar on the month already typed in the field, if parseable.
            const existing = parseDate(needByText.value);
            if (existing) {
                const y = existing.getFullYear();
                const m = String(existing.getMonth() + 1).padStart(2, '0');
                const d = String(existing.getDate()).padStart(2, '0');
                needByPicker.value = `${y}-${m}-${d}`;
            }
            if (typeof needByPicker.showPicker === 'function') {
                try { needByPicker.showPicker(); return; } catch (e) { /* fall back below */ }
            }
            needByPicker.focus();
            needByPicker.click();
        });
        needByPicker.addEventListener('change', () => {
            if (!needByPicker.value) return;              // value is YYYY-MM-DD
            const [y, m, d] = needByPicker.value.split('-');
            needByText.value = `${m}/${d}/${y}`;
            // Trigger the form's debounced auto-save (listens for input/change).
            needByText.dispatchEvent(new Event('change', { bubbles: true }));
        });
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

        // Classroom board cells
        crNotesPanel.addEventListener('click', (e) => {
            const b = e.target.closest('button[data-action="toggle-classroom"]');
            if (b) toggleClassroom(b.dataset.classroom);
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
            if (printSpecialBatching()) return;
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

    // Print Label (folder labels) — Info tab.
    document.getElementById('pp-print-label-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        openPrintLabelModal();
    });

    // Print Shop Folder Cover (QC sticker cover) — Info tab.
    document.getElementById('pp-print-shop-folder-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        handlePrintShopFolderCover();
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
    // Esc on the Tracking tab = the bulk bar's "Clear selection" (2026-10-19, PM request).
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || currentTab !== 'tracking' || !selectedComponentIds.size) return;
        if (document.querySelector('.pp-modal-backdrop:not([hidden])')) return;   // a dialog owns Esc
        const ae = document.activeElement;
        if (ae && ae.matches('input, textarea, select')) ae.blur();   // leave the field first; the selection clears too
        selectedComponentIds.clear();
        renderTracking();
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
            } else if (tab === 'staging') {
                activateStagingTab();
            } else if (tab === 'approvals') {
                activateApprovalsTab();
            } else if (tab === 'tracking') {
                activateTrackingTab();
            } else if (tab === 'casting-layout') {
                activateCastingLayoutTab();
            } else if (tab === 'jig-list') {
                activateJigListTabWithCtx();
            } else if (tab === 'color-log') {
                activateColorLogTab();
            } else if (tab === 'batch-tickets') {
                activateBatchTicketsTab();
            } else if (tab === 'job-memos') {
                activateJobMemosTab();
            } else if (tab === 'actual-labor') {
                activateActualLaborTab();
            }
        });
    });

    // ----- Casting Layout: control wiring -----
    document.getElementById('pp-clay-casting')?.addEventListener('change', async (e) => {
        clSelectedCastingId = e.target.value;
        syncClaySideSelect();
        await loadLayoutPositionsForSelected();
        renderCastingLayoutTab();
    });
    document.getElementById('pp-clay-side')?.addEventListener('change', async (e) => {
        const side = ['A', 'B', 'AB'].includes(e.target.value) ? e.target.value : null;
        const casting = currentCastings.find(c => c.id === clSelectedCastingId);
        if (!casting) return;
        try {
            await updateCasting(casting.id, { casting_side: side });
            casting.casting_side = side;
            showToast(`Cast ${casting.casting_number}: ${side === 'AB' ? 'both sides (A + B)' : side ? 'Side ' + side : 'no side'} — the weekly's Cast cards follow on their next refresh.`);
        } catch (err) {
            logger.error('[project-portal] casting side save failed:', err);
            showToast(side === 'AB' ? 'Not saved — run migration/casting-side-both.sql in Supabase first' : 'Side not saved — run migration/casting-side.sql in Supabase first', 'error');
        }
        syncClaySideSelect();
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
            // Clear selection stays live even when locked — it's the unlock action.
            if (e.target.id === 'pp-cl-clear-selection') {
                handleClearColorLogSelection();
                return;
            }

            const addBtn = e.target.closest('[data-cl-add]');
            if (addBtn) {
                if (isColorLogLocked()) return;
                clHandleAdd(addBtn.dataset.clAdd);
                scheduleColorLogSave();
                return;
            }

            const removeBtn = e.target.closest('[data-cl-remove]');
            if (removeBtn) {
                if (isColorLogLocked()) return;
                const tr = removeBtn.closest('tr');
                if (!tr) return;
                clHandleRemove(tr.dataset.clType, parseInt(tr.dataset.clIdx, 10));
                scheduleColorLogSave();
                return;
            }

            const stdEl = e.target.closest('[data-cl-std]');
            if (stdEl) {
                if (isColorLogLocked()) return;
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
            if (isColorLogLocked()) return; // recipe is read-only while locked to a standard color
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

            // Recipe selects (cement/cast/units) are read-only while locked.
            if (isColorLogLocked()) return;

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

    // Releasability Approvals grid
    document.getElementById('pp-appr-table')?.addEventListener('click', async (e) => {
        const all = e.target.closest('button[data-action="appr-all"]');
        if (all) {
            const to = all.dataset.to === 'green' ? MS.GREEN : MS.RED;
            for (const c of getCastingsForActivePhase()) await toggleApproval(c.id, all.dataset.milestone, to);
            renderApprovals();
            return;
        }
        const cell = e.target.closest('button.pp-appr-cell:not([disabled])');
        if (cell) { await toggleApproval(cell.dataset.castingId, cell.dataset.milestone); renderApprovals(); }
    });

    document.getElementById('pp-opt-ready-bar')?.addEventListener('click', (e) => { if (e.target.closest('[data-action="ready-all"]')) markAllReady(); else if (e.target.closest('[data-action="pull-legacy-all"]')) handlePullLegacyHoursAll(); });

    // Optimizer: column container (event delegation across all visible columns)
    const optColumns = document.getElementById('pp-opt-columns');
    optColumns.addEventListener('input', (e) => {
        const inp = e.target.closest('input[data-action="staged-hours"]');
        if (inp) { scheduleOptHoursSave(inp.dataset.castingNumber, inp.dataset.department, parseInt(inp.dataset.day, 10), inp.value); return; }
        const bud = e.target.closest('input[data-action="casting-budget"]');
        if (bud) { handleCastingBudget(bud.dataset.castingId, bud.value); return; }
        const pct = e.target.closest('input[data-action="staged-pct"]');
        if (pct) handleStagedPct(pct.dataset.castingId, pct.dataset.department, parseInt(pct.dataset.day, 10), pct.value);
    });
    const optValue = document.getElementById('pp-opt-value');
    if (optValue) {
        optValue.addEventListener('input', (e) => {
            const n = e.target.closest('[data-val-name]'), a = e.target.closest('[data-val-amount]');
            if (n) optValueItems[Number(n.dataset.valName)].name = n.value;
            if (a) optValueItems[Number(a.dataset.valAmount)].value = Number(a.value) || 0;
            if (n || a) { scheduleOptValueSave(); const box = optValue.querySelector('.pp-opt-val-totals'); if (box) { renderOptValueTotalsOnly(); } }
        });
        optValue.addEventListener('click', async (e) => {
            if (e.target.closest('[data-val-add]')) { optValueItems.push({ name: optValueItems.length ? `Change order #${optValueItems.length}` : 'Contract value', value: 0 }); renderOptValue(); optValue.querySelector(`[data-val-amount="${optValueItems.length - 1}"]`)?.focus(); scheduleOptValueSave(); return; }
            const del = e.target.closest('[data-val-del]');
            if (del) { const it = optValueItems[Number(del.dataset.valDel)]; if (it && (it.value || it.name) && !window.confirm(`Remove "${it.name || 'this value'}" (${money0(it.value)})?`)) return; optValueItems.splice(Number(del.dataset.valDel), 1); renderOptimizer(); scheduleOptValueSave(); }
        });
    }

    optColumns.addEventListener('click', (e) => {
        const msBtn = e.target.closest('button[data-action="toggle-final-hours"]');
        if (msBtn) { toggleFinalHours(msBtn.dataset.castingId); return; }
        const readyBtn = e.target.closest('button[data-action="toggle-ready"]');
        if (readyBtn) { toggleReady(readyBtn.dataset.castingId); return; }
        if (e.target.closest('[data-action="goto-staging"]')) { setActiveTab('staging'); activateStagingTab(); return; }
        const pull = e.target.closest('button[data-action="pull-legacy"]');
        if (pull) { handlePullLegacyHours(pull.dataset.castingId); return; }
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

    // Staging: pills + prev/next nav
    const stgPills = document.getElementById('pp-stg-pills');
    if (stgPills) {
        stgPills.addEventListener('click', (e) => {
            const navBtn = e.target.closest('button[data-action]');
            if (navBtn) {
                if (navBtn.disabled) return;
                const action = navBtn.dataset.action;
                const list = getCastingsForActivePhase();
                const idx = list.findIndex(c => c.id === currentStagingCastingId);
                if (idx === -1) return;
                const newIdx = action === 'prev' ? idx - 1 : idx + 1;
                if (newIdx < 0 || newIdx >= list.length) return;
                handleSelectStgCasting(list[newIdx].id);
                return;
            }
            const pillBtn = e.target.closest('button[data-casting-id]');
            if (!pillBtn) return;
            handleSelectStgCasting(pillBtn.dataset.castingId);
        });
    }

    // Staging: column container (department × day description grid, delegated)
    const stgColumns = document.getElementById('pp-stg-columns');
    if (stgColumns) {
        stgColumns.addEventListener('click', (e) => {
            const headerBtn = e.target.closest('button[data-action="select-col"]');
            if (headerBtn) {
                handleSelectStgCasting(headerBtn.dataset.castingId);
                return;
            }
            const copyBtn = e.target.closest('button[data-action="copy-staging"]');
            if (copyBtn) {
                handleCopyStaging(copyBtn.dataset.castingNumber);
                return;
            }
            const pasteBtn = e.target.closest('button[data-action="paste-staging"]');
            if (pasteBtn) {
                if (pasteBtn.disabled) return;
                handlePasteStaging(pasteBtn.dataset.castingNumber);
                return;
            }
            const addDayBtn = e.target.closest('button[data-action="add-day"]');
            if (addDayBtn) {
                handleAddStagingDay(addDayBtn.dataset.castingNumber, addDayBtn.dataset.department);
                return;
            }
            const removeDayBtn = e.target.closest('button[data-action="remove-day"]');
            if (removeDayBtn) {
                handleRemoveStagingDay(removeDayBtn.dataset.castingNumber, removeDayBtn.dataset.department, parseInt(removeDayBtn.dataset.day, 10));
                return;
            }
            const removeDeptBtn = e.target.closest('button[data-action="remove-dept"]');
            if (removeDeptBtn) {
                handleRemoveStagingDept(removeDeptBtn.dataset.castingNumber, removeDeptBtn.dataset.department);
                return;
            }
        });
        stgColumns.addEventListener('input', (e) => {
            const ta = e.target.closest('textarea[data-action="grid-desc"]');
            if (!ta) return;
            autoGrowTextarea(ta);
            scheduleStagingGridSave(ta.dataset.castingNumber, ta.dataset.department, parseInt(ta.dataset.day, 10), ta.value);
        });
        stgColumns.addEventListener('change', (e) => {
            const task = e.target.closest('select[data-action="grid-task"]');
            if (task) { handleSaveStagingTask(task.dataset.castingNumber, task.dataset.department, parseInt(task.dataset.day, 10), task.value); return; }
            const sel = e.target.closest('select[data-action="add-dept"]');
            if (!sel) return;
            const dept = sel.value;
            sel.value = '';
            if (dept) handleAddStagingDept(sel.dataset.castingNumber, dept);
        });
    }

    // Optimizer + Staging: "go to castings" link in empty state
    document.querySelectorAll('[data-action="goto-castings"]').forEach(el => el.addEventListener('click', () => {
        setActiveTab('castings');
        if (currentProjectNumber) loadAndRenderCastings();
    }));

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
        const truckSel = e.target.closest('select[data-action="track-truck-select"]');
        if (truckSel) {
            const id = truckSel.dataset.componentId;
            if (id) handleTrackingTruckSelect(id, truckSel.value);
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
        const truckSel = e.target.closest('#pp-track-bulk-truck');
        if (truckSel && truckSel.value !== '') {
            const value = truckSel.value;
            truckSel.value = '';
            applyBulkCrate(value === '__clear__' ? { clear: true } : { truck: Number(value) });
            return;
        }
        const sel = e.target.closest('#pp-track-bulk-select');
        if (sel && sel.value) {
            const value = sel.value;
            // Reset the dropdown back to placeholder so the user can re-apply.
            sel.value = '';
            applyBulkCrate(value === '__clear__' ? { clear: true } : { num: crateNumFromPick(value) });
        }
    });
    bulkBar?.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="track-bulk-clear"]')) {
            selectedComponentIds.clear();
            renderTracking();
            return;
        }
        if (e.target.closest('[data-action="track-bulk-unassign"]')) {
            applyBulkCrate({ clear: true });
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
        const addTruck = e.target.closest('button[data-action="ship-add-truck"]');
        if (addTruck) {
            const c = await createCrateOn(highestTruck() + 1, '1');
            if (c) { currentShipExpanded.add(c.id); renderShipping(); }
            return;
        }
        const addCrate = e.target.closest('button[data-action="ship-add-crate"]');
        if (addCrate) {
            const t = Number(addCrate.dataset.truck);
            const c = await createCrateOn(t, nextCrateNumberOn(t));
            if (c) { currentShipExpanded.add(c.id); renderShipping(); }
            return;
        }
        const printTruck = e.target.closest('button[data-action="ship-print-truck"]');
        if (printTruck) {
            handlePrintTruckPackingList(Number(printTruck.dataset.truck));
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

    // Shipping: crate number / truck changes rename the hidden key (checked against the phase's other crates)
    shipList?.addEventListener('change', async (e) => {
        const target = e.target;
        const field = target?.dataset?.field;
        if (field !== 'crate_num' && field !== 'truck') return;
        const card = target.closest('.pp-ship-crate[data-crate-id]');
        const crate = card && currentCrates.find(c => c.id === card.dataset.crateId);
        if (!crate) return;
        const parts = crateParts(crate);
        const truck = field === 'truck' ? Number(target.value || 0) : parts.truck;
        const num = field === 'crate_num' ? String(target.value || '').trim() : parts.num;
        if (!num) { showToast('A crate needs a number.', 'error'); renderShipping(); return; }
        const clash = findCrate(truck, num);
        if (clash && clash.id !== crate.id) { showToast(`${crateDisplay(clash)} already exists in this phase — pick another number.`, 'error'); renderShipping(); return; }
        const key = crateKey(truck, num);
        try {
            const updated = await updateCrate(crate.id, { crate_number: key });
            Object.assign(crate, updated || { crate_number: key });
        } catch (err) {
            logger.error('[project-portal] crate rename failed:', err);
            showToast('Could not change the crate: ' + (err?.message || err), 'error');
        }
        renderShipping();
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
        if (!crateId || !field || field === 'crate_num' || field === 'truck') return;   // those two re-key the crate on change
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

    // Batch Tickets: project-wide slump targets (one input per batch type)
    const slumpPanel = document.getElementById('pp-bt-slump-targets');
    slumpPanel?.addEventListener('input', (e) => {
        const t = e.target;
        const key = t.id === 'pp-bt-slump-face' ? 'face'
            : t.id === 'pp-bt-slump-first' ? 'firstBackUp'
            : t.id === 'pp-bt-slump-final' ? 'finalBackUp'
            : null;
        if (key) handleSlumpTargetInput(key, t.value);
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
        if (target.matches('[data-bt-color-add]')) {
            const v = target.value;
            target.value = '';
            if (v) handleAddBatchColorTicket(v);
            return;
        }
    });
    btContent?.addEventListener('click', (e) => {
        if (!currentBatchCastingId) return;
        if (e.target.closest('[data-bt-color-remove]')) {
            handleRemoveBatchColorTicket();
            return;
        }
        const colorPill = e.target.closest('[data-bt-color-pill]');
        if (colorPill) {
            handleSelectBatchColor(colorPill.dataset.colorKey || '');
            return;
        }
        if (e.target.closest('[data-bt-import]')) {
            handleImportBatchFromTracking(currentBatchCastingId);
        }
        const useWeekly = e.target.closest('[data-bt-weekly-use]');
        if (useWeekly) {
            handleCastingDateChange(currentBatchCastingId, useWeekly.dataset.btWeeklyUse).then(() => renderBatchTicketsContent());
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

    // Castings: import remakes (modal close/cancel/backdrop/submit)
    document.getElementById('pp-import-remakes-close')?.addEventListener('click', closeImportRemakesModal);
    document.getElementById('pp-import-remakes-cancel')?.addEventListener('click', closeImportRemakesModal);
    document.getElementById('pp-import-remakes-submit')?.addEventListener('click', handleImportRemakesConfirm);
    document.getElementById('pp-import-remakes-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'pp-import-remakes-modal') closeImportRemakesModal();
    });

    // Project Info: print folder labels (modal close/cancel/backdrop/submit/select-all)
    document.getElementById('pp-print-label-close')?.addEventListener('click', closePrintLabelModal);
    document.getElementById('pp-print-label-cancel')?.addEventListener('click', closePrintLabelModal);
    document.getElementById('pp-print-label-submit')?.addEventListener('click', handlePrintLabelConfirm);
    document.getElementById('pp-print-label-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'pp-print-label-modal') closePrintLabelModal();
    });
    document.getElementById('pp-print-label-all')?.addEventListener('change', (e) => {
        const list = document.getElementById('pp-print-label-list');
        if (!list) return;
        list.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = e.target.checked; });
        updatePrintLabelSubmitState();
    });
    document.getElementById('pp-print-label-list')?.addEventListener('change', updatePrintLabelSubmitState);

    // Castings: summary readout expand/collapse
    document.getElementById('pp-castings-summary')?.addEventListener('click', handleCastingsSummaryToggle);

    // Castings: row actions (delegation)
    const castingsList = document.getElementById('pp-castings-list');
    // Enter jumps to the same field on the next component row (the blur saves the one you left).
    castingsList.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey) return;
        const input = e.target.closest('.pp-inv-row input[data-field], .pp-inv-row select[data-field]');
        if (!input) return;
        e.preventDefault();
        const row = input.closest('.pp-inv-row');
        const field = input.dataset.field;
        let next = row.nextElementSibling;
        while (next && !next.classList.contains('pp-inv-row')) next = next.nextElementSibling;
        const target = next?.querySelector(`[data-field="${CSS.escape(field)}"]`);
        if (target && !target.disabled) { target.focus(); if (typeof target.select === 'function') target.select(); }
        else input.blur();
    });
    castingsList.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const card = btn.closest('.pp-cast-card[data-casting-id]');
        if (!card) return;
        const castingId = card.getAttribute('data-casting-id');
        const action = btn.dataset.action;
        if (action === 'delete') {
            handleDeleteCasting(castingId);
        } else if (action === 'ms-ci-advance') {
            ciAdvance(castingId);
        } else if (action === 'ms-ci-pm') {
            ciPmReady(castingId);
        } else if (action === 'ms-ci-unlock') {
            ciUnlock(castingId);
        } else if (action === 'toggle-inventory') {
            handleToggleCastInventory(castingId);
        } else if (action === 'add-inventory') {
            handleAddInventoryItem(castingId);
        } else if (action === 'open-import-remakes') {
            if (!btn.disabled) openImportRemakesModal(castingId);
        } else if (action === 'copy-components') {
            if (!btn.disabled) handleCopyComponents(castingId);
        } else if (action === 'paste-components') {
            if (!btn.disabled) handlePasteComponents(castingId);
        } else if (action === 'delete-inventory') {
            const row = btn.closest('.pp-inv-row[data-inventory-id]');
            const itemId = row?.getAttribute('data-inventory-id');
            if (itemId) handleDeleteInventoryItem(castingId, itemId);
        } else if (action === 'copy-inventory-row') {
            const row = btn.closest('.pp-inv-row[data-inventory-id]');
            const itemId = row?.getAttribute('data-inventory-id');
            if (itemId) handleCopyInventoryRow(castingId, itemId);
        } else if (action === 'cut-inventory-row') {
            const row = btn.closest('.pp-inv-row[data-inventory-id]');
            const itemId = row?.getAttribute('data-inventory-id');
            if (itemId) handleCutInventoryRow(castingId, itemId);
        } else if (action === 'cut-selected') {
            handleCutSelected(castingId);
        }
    });
    // Tick boxes: per row, or the header box for the whole casting. Only the title block redraws.
    castingsList.addEventListener('change', (e) => {
        if (!e.target.matches('.pp-inv-row-select')) return;
        const card = e.target.closest('.pp-cast-card[data-casting-id]');
        const castingId = card?.getAttribute('data-casting-id');
        if (!castingId) return;
        if (e.target.hasAttribute('data-select-all')) {
            for (const it of getInventoryFor(castingId)) { if (e.target.checked) invSelected.add(it.id); else invSelected.delete(it.id); }
            card.querySelectorAll('.pp-inv-row[data-inventory-id]').forEach(r => {
                r.classList.toggle('pp-inv-row-selected', e.target.checked);
                const box = r.querySelector('[data-select-row]'); if (box) box.checked = e.target.checked;
            });
        } else {
            const row = e.target.closest('.pp-inv-row[data-inventory-id]');
            const id = row?.getAttribute('data-inventory-id');
            if (!id) return;
            if (e.target.checked) invSelected.add(id); else invSelected.delete(id);
            row.classList.toggle('pp-inv-row-selected', e.target.checked);
            const all = card.querySelector('[data-select-all]');
            if (all) all.checked = getInventoryFor(castingId).every(it => invSelected.has(it.id));
        }
        invRefreshTitleButtons(card, castingId);
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
    // Edit marks: what the field held when it got focus (selects also keep the option's text for the tooltip).
    castingsList.addEventListener('focusin', (e) => {
        if (!e.target.matches('.pp-inv-row[data-inventory-id] input[data-field], .pp-inv-row[data-inventory-id] select[data-field]')) return;
        e.target.dataset.before = e.target.value;
        if (e.target.tagName === 'SELECT') e.target.dataset.beforeLabel = e.target.selectedOptions[0]?.text || '';
    });
    castingsList.addEventListener('focusout', (e) => { invRecordEdit(e.target); });
    castingsList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="inv-undo"]');
        if (!btn) return;
        e.preventDefault(); e.stopPropagation();
        const el = btn.closest('.pp-inv-cell')?.querySelector('input[data-field], select[data-field]');
        if (el) invUndo(el);
    });
    castingsList.addEventListener('keydown', (e) => {
        if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || e.shiftKey) return;
        if (!e.target.matches('.pp-inv-row[data-inventory-id] [data-field]')) return;
        const row = e.target.closest('.pp-inv-row[data-inventory-id]');
        if (!invEdits.has(invEditKey(row.getAttribute('data-inventory-id'), e.target.dataset.field))) return;   // nothing of ours to undo: leave the browser's own undo alone
        e.preventDefault();
        invUndo(e.target);
    });
    castingsList.addEventListener('change', (e) => {
        if (!e.target.matches('select[data-field]')) return;
        const invRow = e.target.closest('.pp-inv-row[data-inventory-id]');
        if (!invRow) return;
        invRecordEdit(e.target);
        e.target.dataset.before = e.target.value;
        e.target.dataset.beforeLabel = e.target.selectedOptions[0]?.text || '';
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
// (list of 250/150/100 lb batches, scaled ingredient values) is
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

// Distinct color_log_ids used by a casting's components (first-appearance order,
// only ids that resolve to a loaded color log).
function getCastingComponentColorIds(castingId) {
    const comps = currentCastingComponents.get(castingId) || [];
    const ids = [];
    for (const c of comps) {
        if (!c.color_log_id || ids.includes(c.color_log_id)) continue;
        if (getColorLogByIdSync(c.color_log_id)) ids.push(c.color_log_id);
    }
    return ids;
}

// True when a ticket is unsaved and has no user-entered content — safe to drop silently.
// "Last imported" stamp (2026-10-13): when Import from Tracking is pressed, the time is kept inside
// batch_assignments as { meta: 'last-import', importedAt } — same trick the Jane page uses — so the
// printed tickets can say BATCHED ON. Real batch-type picks are the { batchLbs, type } entries.
const BT_IMPORT_META = 'last-import';
function btOverrides(t) { return (Array.isArray(t?.batchAssignments) ? t.batchAssignments : []).filter(a => a && a.type); }
function btImportStamp(t) { return (Array.isArray(t?.batchAssignments) ? t.batchAssignments : []).find(a => a && a.meta === BT_IMPORT_META) || null; }
function btSetOverrides(t, list) {
    const stamp = btImportStamp(t);
    t.batchAssignments = [...(list || []), ...(stamp ? [stamp] : [])];
}
function btStampDate(d) {
    const x = new Date(d);
    if (isNaN(x)) return '';
    return x.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + x.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function isPristineBatchTicket(t) {
    return !t.id && t.cuFt === '' && t.faceSqFt === '' && t.batchedBy === '' && t.notes === ''
        && t.cuFtPer250 === '4.28' && t.pigReduction === '50' && !t.pigReduceFirstBackup
        && !t.omitAggFinalBackup && !t.omitFibersFace && !t.cowbayFinalBackup
        && (!Array.isArray(t.batchAssignments) || t.batchAssignments.length === 0);
}

/**
 * Effective ticket list for a casting: saved tickets plus a virtual (unsaved)
 * ticket for each component-detected color that has no saved one yet. Virtual
 * tickets are materialized into the per-casting array so edits stick across
 * renders. Falls back to a single legacy NULL-color ticket when nothing else
 * exists — same as the old one-ticket-per-casting behavior.
 * Order: NULL-color first, then detected-color order, then remaining saved/added.
 */
function getBatchTicketList(castingId) {
    let arr = batchTickets.get(castingId);
    if (!arr) { arr = []; batchTickets.set(castingId, arr); }
    const detected = getCastingComponentColorIds(castingId);
    for (const id of detected) {
        if (!arr.some(t => t.colorLogId === id)) {
            const v = emptyBatchTicketForm(castingId);
            v.colorLogId = id;
            arr.push(v);
        }
    }
    // A pristine legacy placeholder from before colors were detected just clutters
    // the pill row — drop it once real colors exist.
    if (detected.length) {
        const idx = arr.findIndex(t => !t.colorLogId && isPristineBatchTicket(t));
        if (idx !== -1) arr.splice(idx, 1);
    }
    // A null-color ticket is not a valid state: it can't be pill-selected,
    // can't render a batch plan, and would double-count in Mix Day Totals.
    // If nothing color-tagged exists yet, seed an empty ticket on the project's
    // default color log so the form has something real to bind to.
    if (!arr.some(t => t.colorLogId) && currentColorLogs[0]?.id) {
        const v = emptyBatchTicketForm(castingId);
        v.colorLogId = currentColorLogs[0].id;
        arr.push(v);
    }
    if (!arr.length) arr.push(emptyBatchTicketForm(castingId));
    const rank = (t) => {
        if (!t.colorLogId) return -1;
        const i = detected.indexOf(t.colorLogId);
        return i === -1 ? detected.length : i;
    };
    // Legacy null-color rows stay in `arr` (and in the DB) but never surface —
    // no pill, no plan, no contribution to totals.
    return arr.slice().sort((a, b) => rank(a) - rank(b)).filter(t => t.colorLogId);
}

// Active ticket for a casting: the one matching the color-pill selection.
// With no explicit selection yet, prefer a real color over the legacy
// NULL-color slot — "No Color" sorts first but shouldn't mask a valid color.
function getBatchTicketFor(castingId) {
    const list = getBatchTicketList(castingId);
    if (list.length === 1) return list[0];
    const selKey = currentBatchColorSel.get(castingId);
    const selected = list.find(t => (t.colorLogId || '') === selKey);
    return selected || list.find(t => t.colorLogId) || list[0];
}

/**
 * Re-pull this project's color logs from the DB. Batch scaling reads ingredient
 * weights (sand lbs, etc.) straight off these logs, so they must be fresh: a log
 * edited elsewhere this session would otherwise leave the batch math stale.
 * Only seeds a default active log when none is selected — never clobbers an
 * in-progress Color Log tab selection.
 */
async function refreshBatchColorLogs() {
    if (!currentProjectNumber) return;
    try {
        const list = await loadColorLogsForProject(currentProjectNumber);
        currentColorLogs = list;
        if (list.length > 0 && !currentColorLog?.id) {
            currentColorLogId = list[0].id;
            currentColorLog = list[0];
        }
    } catch (err) {
        logger.error('[batch-tickets] color-log refresh failed', err);
    }
}

// ---------- Special batching projects (config/special-batching.js) ----------
// Their Batch Tickets tab shows the project's dedicated batching page, embedded, instead of the
// standard form. The page is same-origin: it reports its height, relays its toasts, and hands
// the top-bar Print button its print HTML.

function getSpecialBatchingFrame() {
    return document.getElementById('pp-bt-special-frame');
}

/** Show / hide the embedded page for the current project. Returns true when it is showing. */
function renderSpecialBatching() {
    const wrap = document.getElementById('pp-bt-special');
    const frame = getSpecialBatchingFrame();
    if (!wrap || !frame) return false;
    const special = getSpecialBatching(currentProjectNumber);
    wrap.hidden = !special;
    wrap.closest('.pp-bt-wrap')?.classList.toggle('pp-bt-wrap--special', !!special);
    if (!special) {
        if (frame.getAttribute('src')) frame.removeAttribute('src');
        return false;
    }
    const src = special.href + '?embed=1&project=' + encodeURIComponent(currentProjectNumber) + (special.version ? '&v=' + special.version : '');
    if (frame.getAttribute('src') !== src) {
        frame.setAttribute('src', src);
    } else {
        // Coming back to the tab: let the page re-pull (inventory / castings may have changed).
        frame.contentWindow?.postMessage({ type: 'jsb-activate' }, location.origin);
    }
    const popout = document.getElementById('pp-bt-special-popout');
    if (popout) popout.href = special.href + '?project=' + encodeURIComponent(currentProjectNumber);
    updateSpecialUpdatingBanner();
    return true;
}

/** Top-bar "Print Batch Tickets" for a special project: print from the embedded page. */
function printSpecialBatching() {
    if (!getSpecialBatching(currentProjectNumber)) return false;
    const id = msBatchCastingId();
    printGate(id ? [id] : [], 'Batching Sheets').then(ok => { if (ok && printSpecialBatchingNow() === 'printed') stampPrinted(id ? [id] : [], 'Batching Sheets'); });
    return true;
}
function printSpecialBatchingNow() {
    const build = getSpecialBatchingFrame()?.contentWindow?.jsbBuildPrintHtml;
    if (typeof build !== 'function') { showToast('The batching page is still loading — try again in a moment', 'error'); return true; }
    const html = build();
    if (!html) { showToast('Enter Total Cu Ft to generate tickets', 'error'); return true; }
    const w = window.open('', '_blank');
    if (!w) { showToast('Pop-up blocked — allow pop-ups for printing', 'error'); return true; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    return 'printed';
}

window.addEventListener('message', (e) => {
    const frame = getSpecialBatchingFrame();
    if (e.origin !== location.origin || !frame || e.source !== frame.contentWindow) return;
    if (e.data?.type === 'jsb-height' && Number(e.data.height) > 0) {
        frame.style.height = Math.ceil(Number(e.data.height)) + 'px';
    } else if (e.data?.type === 'jsb-toast' && e.data.message) {
        showToast(String(e.data.message), e.data.isError ? 'error' : 'success');
    } else if (e.data?.type === 'jsb-print-request') {
        // The special page wants to print: run the inventory gate here, then tell it yes / no.
        const ids = Array.isArray(e.data.ids) ? e.data.ids : [];
        printGate(ids, 'Batching Sheets').then(ok => frame.contentWindow?.postMessage({ type: ok ? 'jsb-print-ok' : 'jsb-print-no', token: e.data.token }, location.origin));
    } else if (e.data?.type === 'jsb-printed') {
        stampPrinted(Array.isArray(e.data.ids) ? e.data.ids : [], 'Batching Sheets');
    } else if (e.data?.type === 'jsb-reprint-verdict') {
        specialReprintWaiting.get(e.data.token)?.(e.data.verdict);
    } else if (e.data?.type === 'jsb-stale') {
        // The special page's own out-of-date warning: where it sits (relative to the frame) and what it says.
        frameStale = Array.isArray(e.data.diffs) ? { diffs: e.data.diffs, fresh: !!e.data.fresh, info: e.data.info || null, top: Number(e.data.top) || 0, height: Number(e.data.height) || 0 } : null;
        frameCasts = Array.isArray(e.data.casts) ? { casts: e.data.casts, top: Number(e.data.pillsTop) || 0, height: Number(e.data.pillsHeight) || 0 } : null;
        updateFloats();
        updateSpecialUpdatingBanner();
    }
});

let btJigLists = new Map();      // castingId -> jig-list state (for the scrim line under Mix Day Totals)
let btJigListsFor = null;        // project number the map belongs to
async function ensureJigListsForScrim() {
    const pn = String(currentProjectNumber || '').trim();
    if (!pn) return;   // re-read on every open (2026-10-27): a jig list saved after the tab was first opened must show
    try {
        const res = await loadJigListsForScrim(pn);
        btJigLists = res?.byCasting || new Map();
        btJigListsFor = pn;
    } catch (err) {
        logger.error('[project-portal] jig lists for scrim failed (non-fatal):', err);
        btJigLists = new Map();
        btJigListsFor = pn;
    }
}
/** The scrim line for a casting: face sq ft from the Casting Inventory × scrim layers from the Jig List cross-section. */
function scrimLineHtml(casting) {
    if (!casting) return '';
    const rows = getInventoryFor(casting.id);
    if (!rows.length) return '';
    const { text, detail, warn } = scrimForInventory(rows, btJigLists.get(casting.id));
    if (!text) return '';
    return `<div class="pp-bt-totals-scrim${warn ? ' pp-bt-totals-scrim-warn' : ''}" title="${escapeAttr(detail || '')}">${escapeHtml(text)}</div>`;
}
async function activateBatchTicketsTab() {
    if (currentProjectNumber) syncCastDatesWithWeekly();   // runs alongside; redraws when the weekly answers
    await ensureJigListsForScrim();
    const needsSave    = document.getElementById('pp-bt-needs-save');
    const needsCL      = document.getElementById('pp-bt-needs-color-log');
    const noCastings   = document.getElementById('pp-bt-no-castings');
    const pills        = document.getElementById('pp-bt-pills');
    const content      = document.getElementById('pp-bt-content');
    const slumpPanel   = document.getElementById('pp-bt-slump-targets');

    // Special batching project: the dedicated page replaces everything below.
    if (renderSpecialBatching()) {
        for (const el of [needsSave, needsCL, noCastings, slumpPanel]) if (el) el.hidden = true;
        if (pills) pills.innerHTML = '';
        if (content) content.innerHTML = '';
        return;
    }

    if (!content) return;
    // Project-wide slump panel: hidden by default; revealed only on the success path.
    if (slumpPanel) slumpPanel.hidden = true;

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

    // Always re-pull color logs — they drive batch scaling and may have been
    // edited (sand weight, ingredients) since we last loaded. Don't set
    // colorLogLoadedFor — leave that to activateColorLogTab so its first
    // activation still triggers renderColorLog + refreshPresetPicker.
    await refreshBatchColorLogs();

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
            currentBatchColorSel.clear();
            for (const c of currentCastings) {
                batchTickets.set(c.id, map.get(c.id) || []);
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

    // Reveal + populate the project-wide slump targets now that tickets will render.
    if (slumpPanel) {
        const fFace  = document.getElementById('pp-bt-slump-face');
        const fFirst = document.getElementById('pp-bt-slump-first');
        const fFinal = document.getElementById('pp-bt-slump-final');
        if (fFace)  fFace.value  = currentSlumpTargets.face;
        if (fFirst) fFirst.value = currentSlumpTargets.firstBackUp;
        if (fFinal) fFinal.value = currentSlumpTargets.finalBackUp;
        slumpPanel.hidden = false;
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

// ---------- Is the ticket still in step with the Casting Inventory? ----------
/** Inventory totals exactly as Import from Tracking computes them (value × (quantity + extras)), for this ticket's rows. */
function batchInventoryTotals(castingId, ticket) {
    let rows = getInventoryFor(castingId);
    if (getBatchTicketList(castingId).length > 1) {
        rows = rows.filter(r => ticket.colorLogId ? r.color_log_id === ticket.colorLogId : !r.color_log_id);
    }
    if (!rows.length) return null;
    const has = (v) => v !== null && v !== undefined && v !== '';
    let cuFt = 0, ff = 0;
    for (const r of rows) {
        const units = (Number(r.quantity) || 0) + (Number(r.extras) || 0);
        cuFt += (Number(r.cu_ft) || 0) * units;
        ff += (Number(r.ff_sq_ft) || 0) * units;
    }
    return { cuFt: roundSig(cuFt, 2), ff: roundSig(ff, 2), cuFtComplete: rows.every(r => has(r.cu_ft)), ffComplete: rows.every(r => has(r.ff_sq_ft)) };
}

let batchInventoryLoading = false;
/**
 * Big red warning when the ticket's Total Cu Ft / Face Sq Ft no longer match what the Casting
 * Inventory totals to today — i.e. someone changed the inventory after this batching was made.
 * Blank ticket fields never warn (nothing was batched yet); a field the inventory can't total
 * (a row with no value) is not compared.
 */
function renderBatchStaleBanner(casting, ticket) {
    if (currentCastingInventoryLoadedFor !== currentProjectNumber) {
        // Inventory loads lazily (Castings tab / import) — fetch it once, then redraw this tab.
        if (!batchInventoryLoading) {
            batchInventoryLoading = true;
            loadAllInventoryForCurrentProject().finally(() => {
                batchInventoryLoading = false;
                if (currentBatchCastingId === casting.id) renderBatchTicketsContent();
            });
        }
        return '';
    }
    const t = batchInventoryTotals(casting.id, ticket);
    if (!t) return '';
    const differs = (val, now, complete) => complete && val !== null && val !== undefined && String(val).trim() !== ''
        && roundSig(parseFloat(val) || 0, 2) !== now;
    const diffs = [];
    if (differs(ticket.cuFt, t.cuFt, t.cuFtComplete)) diffs.push(['Total Cu Ft', ticket.cuFt, t.cuFt]);
    if (differs(ticket.faceSqFt, t.ff, t.ffComplete)) diffs.push(['Face Sq Ft', ticket.faceSqFt, t.ff]);
    if (diffs.length && t.cuFtComplete && t.ffComplete && btTicketSameAsInventory(casting, ticket, t)) {
        return `<div class="pp-bt-stale pp-bt-fresh" role="status" data-fresh="1">
            <div class="pp-bt-stale-title">&#10003; TICKETS STILL RIGHT &mdash; THE BATCHES DO NOT CHANGE</div>
            <div class="pp-bt-stale-text">The Casting Inventory totals moved (${escapeHtml(diffs.map(([label, was, now]) => `${label} ${was} → ${now}`).join(' · '))}) but these tickets come out the same. No reprint needed. <button type="button" class="pp-bt-stale-link" data-bt-import>Import the new totals anyway</button></div>
        </div>`;
    }
    if (!diffs.length) {
        // Nothing differs: say so in green (same spot, same floating copy) — but only when something was compared.
        const typed = (v) => v !== null && v !== undefined && String(v).trim() !== '';
        const compared = [];
        if (t.cuFtComplete && typed(ticket.cuFt)) compared.push(`Total Cu Ft ${t.cuFt}`);
        if (t.ffComplete && typed(ticket.faceSqFt)) compared.push(`Face Sq Ft ${t.ff}`);
        if (!compared.length) return '';
        const blanks = (!t.cuFtComplete || !t.ffComplete) ? ' · some inventory rows are blank, so not everything could be compared' : '';
        return `<div class="pp-bt-stale pp-bt-fresh" role="status" data-fresh="1">
            <div class="pp-bt-stale-title">&#10003; MATCHES CURRENT CASTING INVENTORY</div>
            <div class="pp-bt-stale-text">${escapeHtml(compared.join(' · ') + blanks)}</div>
        </div>`;
    }
    return `<div class="pp-bt-stale" role="alert" data-diffs="${escapeAttr(JSON.stringify(diffs))}">
        <div class="pp-bt-stale-title">&#9888; BATCHING IS OUT OF DATE</div>
        <div class="pp-bt-stale-text">The Casting Inventory for this casting no longer matches the numbers this batching was made from. These tickets, the mix totals and the weekly board count are based on the OLD numbers.</div>
        <table class="pp-bt-stale-table"><tr><th></th><th>Batching uses</th><th>Casting Inventory now</th></tr>
            ${diffs.map(([label, was, now]) => `<tr><td>${label}</td><td>${escapeHtml(String(was))}</td><td><strong>${now}</strong></td></tr>`).join('')}
        </table>
        <button type="button" class="pp-bt-stale-btn" data-bt-import>Import from Tracking now</button>
        <div class="pp-bt-stale-note">Importing replaces Total Cu Ft and Face Sq Ft only (hand-picked batch types go back to automatic). Everything else on the ticket stays.</div>
    </div>`;
}

// ---- Do the tickets change? (2026-10-20) The printed batches depend on Total Cu Ft / Face Sq Ft through the batch
// plan; comparing the plan the ticket was made from with the plan the inventory gives now tells whether a reprint is
// needed, even when the totals moved a little.
function btPlanSignature(casting, ticket, cuFt, faceSqFt) {
    const totalCuFt = parseFloat(cuFt);
    if (!totalCuFt || totalCuFt <= 0) return 'none';
    const activeLog = getActiveBatchColorLog(casting, ticket);
    const sandLbs = getColorLogSandLbs(activeLog);
    if (!sandLbs) return 'none';
    const plan = buildBatchPlan({
        totalCuFt,
        faceSqFt: parseFloat(faceSqFt) || 0,
        cuFtPer250: parseFloat(ticket.cuFtPer250) || 4.28,
        castMethod: activeLog?.castMethod || 'sprayUp',
        colorLogSandLbs: sandLbs,
        manualOverrides: btOverrides(ticket)
    });
    return JSON.stringify([Math.round((plan.faceCuFt || 0) * 1000) / 1000, plan.batches.map(b => [b.batchSandLbs, b.type, Math.round(b.cuFt * 1000) / 1000])]);
}
/** One ticket: would it print the same batches from the inventory as it is now? */
function btTicketSameAsInventory(casting, ticket, totals) {
    const was = btPlanSignature(casting, ticket, ticket.cuFt, ticket.faceSqFt);
    return was !== 'none' && was === btPlanSignature(casting, ticket, totals.cuFt, totals.ff);
}
/** Every batched ticket of the casting: 'same', 'changed', or 'none' (nothing batched / inventory cannot be totalled). */
function btReprintCheck(castingId) {
    const casting = currentCastings.find(c => c.id === castingId);
    if (!casting) return 'none';
    let seen = false;
    for (const ticket of getBatchTicketList(castingId)) {
        if (ticket.cuFt === null || ticket.cuFt === undefined || String(ticket.cuFt).trim() === '') continue;
        const t = batchInventoryTotals(castingId, ticket);
        if (!t) return 'changed';   // this ticket's colour has no inventory rows any more
        if (!t.cuFtComplete || !t.ffComplete) return 'none';
        seen = true;
        if (!btTicketSameAsInventory(casting, ticket, t)) return 'changed';
    }
    return seen ? 'same' : 'none';
}
async function ensureBatchTicketsLoaded() {
    if (batchTicketsLoadedFor === currentProjectNumber) return;
    const map = await loadBatchTicketsForCastings(currentCastings.map(c => c.id));
    batchTickets.clear();
    currentBatchColorSel.clear();
    for (const c of currentCastings) batchTickets.set(c.id, map.get(c.id) || []);
    batchTicketsLoadedFor = currentProjectNumber;
}
/** While the inventory is being changed (or was never marked ready) and tickets were printed from it: wait. */
function renderBatchUpdatingBanner(casting) {
    if (!msOn() || ciFinal(casting.id) || !msRow(casting.id, 'Batching Sheets')) return '';
    const note = msNote(msRow(casting.id, 'Casting Inventory'));
    const changing = note.startsWith('Unlocked for changes') || note.startsWith(CI_PM_NOTE) || note.startsWith(CI_ENTERING_NOTE);
    return `<div class="pp-bt-updating" role="status">
        <div class="pp-bt-updating-title">&#9888; CASTING INVENTORY ${changing ? 'IS BEING UPDATED' : 'IS NOT READY YET'}</div>
        <div class="pp-bt-updating-text">Wait until engineering marks it ready (Castings tab). The portal then says whether these tickets need to be printed again.</div>
    </div>`;
}

// ---------- Floating copy of the out-of-date warning: stays on screen once the inline one scrolls away ----------
let staleFloatEl = null;
let frameStale = null;   // what the embedded special page last reported: { diffs, top, height } or null

function headerBottom() { return document.querySelector('.pp-header')?.getBoundingClientRect().bottom || 0; }

// ---- Quick info (cast, date, color, volume, face area) shown at the top of the floating box, and the
// floating casting pills under it (2026-10-13). The special page posts both for its frame.
let frameCasts = null;   // { casts: [{ id, number, date, active }], top, height } relative to the frame
let castsFloatEl = null;

function longDay(iso) { const d = new Date(String(iso) + 'T00:00:00'); return isNaN(d) ? String(iso) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
function batchQuickInfo() {
    const casting = currentCastings.find(c => c.id === currentBatchCastingId);
    if (!casting) return null;
    const ticket = getBatchTicketFor(casting.id);
    const log = getActiveBatchColorLog(casting, ticket);
    return { cast: casting.casting_number || '', castDate: casting.casting_date || '', cuFt: ticket?.cuFt ?? '', faceSqFt: ticket?.faceSqFt ?? '', color: log?.name || '' };
}
function quickInfoHtml(info) {
    if (!info) return '';
    const num = (v) => (v === '' || v === null || v === undefined) ? '—' : String(roundSig(parseFloat(v) || 0, 2));
    const bits = [];
    if (info.color) bits.push(info.color);
    bits.push(`${num(info.cuFt)} cu ft`, `${num(info.faceSqFt)} face sq ft`);
    return `<div class="pp-bt-float-head"><span class="pp-bt-float-cast">CAST ${escapeHtml(String(info.cast))}</span><span class="pp-bt-float-date">${info.castDate ? escapeHtml(longDay(info.castDate)) : 'no cast date'}</span></div>
        <div class="pp-bt-float-meta">${escapeHtml(bits.join(' · '))}</div>`;
}

/** The casting pills: where they sit on screen and what they hold, or null. */
function castsAnchor() {
    if (formViewHidden()) return null;   // Back to list: the castings box must go with the form
    if (currentTab !== 'batch-tickets') return null;
    const frame = getSpecialBatchingFrame();
    if (frame && frame.getAttribute('src') && !frame.closest('[hidden]')) {
        if (!frameCasts || !frameCasts.casts.length) return null;
        const r = frame.getBoundingClientRect();
        return { bottom: r.top + frameCasts.top + frameCasts.height, casts: frameCasts.casts, source: 'frame' };
    }
    const pills = document.getElementById('pp-bt-pills');
    if (!pills || !pills.children.length) return null;
    const casts = [...pills.querySelectorAll('[data-casting-id]')].map(b => ({
        id: b.dataset.castingId,
        number: (b.firstChild && b.firstChild.nodeType === 3) ? b.firstChild.textContent.trim() : b.textContent.trim(),
        date: b.querySelector('.pp-bt-pill-date')?.textContent || '',
        active: b.classList.contains('pp-bt-pill-active')
    }));
    // A casting with more than one color ticket also gets its color pills in the floating box (2026-10-15).
    const casting = currentCastings.find(c => c.id === currentBatchCastingId);
    const list = casting ? getBatchTicketList(casting.id) : [];
    const activeTicket = casting ? getBatchTicketFor(casting.id) : null;
    const colors = list.length > 1
        ? list.map(t => ({ key: t.colorLogId || '', label: batchTicketColorLabel(t), active: t === activeTicket }))
        : [];
    return { bottom: pills.getBoundingClientRect().bottom, casts, colors, source: 'tab' };
}

/** Floating casting pills, right under the quick info box, once the real pills have scrolled away. */
function updateCastsFloat() {
    const a = castsAnchor();
    const show = !!a && a.bottom < headerBottom() + 4;
    if (!show) { if (castsFloatEl) castsFloatEl.hidden = true; return; }
    if (!castsFloatEl) {
        castsFloatEl = document.createElement('div');
        castsFloatEl.id = 'pp-bt-casts-float';
        castsFloatEl.className = 'pp-bt-casts-float';
        document.body.appendChild(castsFloatEl);
        castsFloatEl.addEventListener('click', (e) => {
            const col = e.target.closest('[data-float-color]');
            if (col) { handleSelectBatchColor(col.dataset.floatColor || ''); return; }
            const b = e.target.closest('[data-float-cast]');
            if (!b) return;
            if (b.dataset.source === 'frame') getSpecialBatchingFrame()?.contentWindow?.postMessage({ type: 'jsb-cast', id: b.dataset.floatCast }, location.origin);
            else document.querySelector(`#pp-bt-pills [data-casting-id="${CSS.escape(b.dataset.floatCast)}"]`)?.click();
        });
    }
    const colors = a.colors || [];
    const key = a.source + JSON.stringify(a.casts) + JSON.stringify(colors);
    if (castsFloatEl.dataset.key !== key) {
        const colorRow = colors.length
            ? `<div class="pp-bt-casts-float-title pp-bt-casts-float-sub">Colors</div><div class="pp-bt-casts-float-list">${colors.map(c =>
                `<button type="button" class="pp-bt-pill pp-bt-color-pill${c.active ? ' pp-bt-pill-active' : ''}" data-float-color="${escapeAttr(c.key)}">${escapeHtml(String(c.label))}</button>`).join('')}</div>`
            : '';
        castsFloatEl.innerHTML = `<div class="pp-bt-casts-float-title">Castings</div><div class="pp-bt-casts-float-list">${a.casts.map(c =>
            `<button type="button" class="pp-bt-pill${c.active ? ' pp-bt-pill-active' : ''}" data-float-cast="${escapeAttr(c.id)}" data-source="${a.source}">${escapeHtml(String(c.number))}${c.date ? `<span class="pp-bt-pill-date">${escapeHtml(String(c.date))}</span>` : ''}</button>`).join('')}</div>${colorRow}`;
        castsFloatEl.dataset.key = key;
    }
    const below = (staleFloatEl && !staleFloatEl.hidden) ? staleFloatEl.getBoundingClientRect().bottom + 8 : msTopOffset() + 12;
    castsFloatEl.style.top = Math.round(below) + 'px';
    castsFloatEl.hidden = false;
}
function updateFloats() { updateStaleFloat(); updateCastsFloat(); updateMsFloat(); }

/** Where the inline warning sits on screen (and what it says), or null when none is showing. */
function formViewHidden() { const fv = document.getElementById('pp-form-view'); return !fv || fv.hidden; }
function staleAnchor() {
    if (currentTab !== 'batch-tickets' || formViewHidden()) return null;   // nothing to float over on the project list
    const frame = getSpecialBatchingFrame();
    if (frame && frame.getAttribute('src') && !frame.closest('[hidden]')) {
        // Special page in its frame: it reported its own warning's position (relative to the frame).
        if (!frameStale || (!frameStale.diffs.length && !frameStale.fresh)) return null;
        const r = frame.getBoundingClientRect();
        const top = r.top + frameStale.top;
        return { bottom: top + frameStale.height, diffs: frameStale.diffs, fresh: !!frameStale.fresh, info: frameStale.info || null, source: 'frame',
                 scrollTo: () => window.scrollTo({ top: window.scrollY + top - headerBottom() - 12, behavior: 'smooth' }) };
    }
    const el = document.querySelector('#pp-bt-content .pp-bt-stale');
    if (!el) return null;
    let diffs = [];
    try { diffs = JSON.parse(el.dataset.diffs || '[]'); } catch { /* ignore */ }
    return { bottom: el.getBoundingClientRect().bottom, diffs, fresh: el.hasAttribute('data-fresh'), info: batchQuickInfo(), source: 'tab',
             scrollTo: () => window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - headerBottom() - 12, behavior: 'smooth' }) };
}

function staleFloatHtml(diffs, source, fresh = false, info = null) {
    if (fresh) {
        return `${quickInfoHtml(info)}<div class="pp-bt-stale-float-title">&#10003; MATCHES CURRENT CASTING INVENTORY</div>
        <div class="pp-bt-stale-float-text">This casting's batching is in step with the Casting Inventory.</div>
        <div class="pp-bt-stale-float-actions"><button type="button" class="pp-bt-stale-link" data-stale-float-show>Show me</button></div>`;
    }
    return `${quickInfoHtml(info)}<div class="pp-bt-stale-float-title">&#9888; BATCHING IS OUT OF DATE</div>
        <div class="pp-bt-stale-float-text">This casting's batching no longer matches the Casting Inventory.</div>
        <table class="pp-bt-stale-table">${diffs.map(([label, was, now]) =>
            `<tr><td>${escapeHtml(String(label))}</td><td>${escapeHtml(String(was))}</td><td>&rarr; <strong>${escapeHtml(String(now))}</strong></td></tr>`).join('')}</table>
        <div class="pp-bt-stale-float-actions">
            <button type="button" class="pp-bt-stale-btn" data-stale-float-import="${source}">Import from Tracking now</button>
            <button type="button" class="pp-bt-stale-link" data-stale-float-show>Show me</button>
        </div>`;
}

/** Show the floating copy only while the inline warning is scrolled out above the header. */
function updateStaleFloat() {
    const a = staleAnchor();
    const show = !!a && a.bottom < headerBottom() + 4;
    if (!show) { if (staleFloatEl) staleFloatEl.hidden = true; return; }
    if (!staleFloatEl) {
        staleFloatEl = document.createElement('div');
        staleFloatEl.id = 'pp-bt-stale-float';
        staleFloatEl.className = 'pp-bt-stale pp-bt-stale-float';
        staleFloatEl.setAttribute('role', 'alert');
        document.body.appendChild(staleFloatEl);
        staleFloatEl.addEventListener('click', (e) => {
            const imp = e.target.closest('[data-stale-float-import]');
            if (imp) {
                if (imp.dataset.staleFloatImport === 'frame') getSpecialBatchingFrame()?.contentWindow?.postMessage({ type: 'jsb-import' }, location.origin);
                else handleImportBatchFromTracking(currentBatchCastingId);
                return;
            }
            if (e.target.closest('[data-stale-float-show]')) staleAnchor()?.scrollTo();
        });
    }
    const key = a.source + (a.fresh ? ':fresh' : '') + JSON.stringify(a.diffs) + JSON.stringify(a.info || null);
    if (staleFloatEl.dataset.key !== key) { staleFloatEl.innerHTML = staleFloatHtml(a.diffs, a.source, a.fresh, a.info); staleFloatEl.dataset.key = key; }
    staleFloatEl.classList.toggle('pp-bt-fresh', !!a.fresh);
    staleFloatEl.style.top = Math.round(msTopOffset() + 12) + 'px';
    staleFloatEl.hidden = false;
}
window.addEventListener('scroll', updateFloats, { passive: true });
window.addEventListener('resize', updateFloats, { passive: true });

function renderBatchTicketsContent() {
    const content = document.getElementById('pp-bt-content');
    if (!content) return;
    const casting = currentCastings.find(c => c.id === currentBatchCastingId);
    if (!casting) { content.innerHTML = ''; return; }
    const list = getBatchTicketList(casting.id);
    const ticket = getBatchTicketFor(casting.id);
    // Show the color pill row for real multi-ticket castings, and also for a
    // single ticket when more color tickets could be added — the "+ Color"
    // select is the only way to split an untagged/one-color casting manually.
    const canAddColor = currentMultiColorEnabled
        && currentColorLogs.some(l => !list.some(t => t.colorLogId === l.id));
    const showColorPills = list.length > 1 || canAddColor;
    const colorPills = showColorPills ? renderBatchColorPills(list, ticket) : '';
    content.innerHTML = `<div data-casting-id="${escapeAttr(casting.id)}">${colorPills}${renderBatchTicketBody(casting, ticket, showColorPills)}</div>`;
    updateFloats();
}

// Label for a ticket's color pill / static color display.
function batchTicketColorLabel(ticket) {
    if (!ticket.colorLogId) return 'No Color';
    return getColorLogByIdSync(ticket.colorLogId)?.name || '(unnamed)';
}

// Second pill row (under the casting pills) — one pill per color ticket, plus
// a "+ Color" select for project color logs that don't have a ticket yet.
function renderBatchColorPills(list, activeTicket) {
    const pills = list.map(t => {
        const isActive = t === activeTicket;
        const remove = isActive && list.length > 1
            ? `<span class="pp-bt-color-pill-x" data-bt-color-remove title="Remove this color ticket">&times;</span>`
            : '';
        return `<button type="button" class="pp-bt-pill pp-bt-color-pill${isActive ? ' pp-bt-pill-active' : ''}" data-bt-color-pill data-color-key="${escapeAttr(t.colorLogId || '')}">${escapeHtml(batchTicketColorLabel(t))}${remove}</button>`;
    }).join('');
    let addSel = '';
    if (currentMultiColorEnabled) {
        const usedIds = new Set(list.map(t => t.colorLogId).filter(Boolean));
        const avail = currentColorLogs.filter(l => !usedIds.has(l.id));
        if (avail.length) {
            addSel = `<select class="pp-bt-color-add" data-bt-color-add title="Add a batch ticket for another color log">
                <option value="" selected disabled>+ Color</option>
                ${avail.map(l => `<option value="${escapeAttr(l.id)}">${escapeHtml(l.name || '(unnamed)')}</option>`).join('')}
            </select>`;
        }
    }
    return `<div class="pp-bt-color-pills" data-bt-color-pills>${pills}${addSel}</div>`;
}

function renderBatchTicketBody(casting, ticket, multi = false) {
    const activeLog = getActiveBatchColorLog(casting, ticket);
    // When the color pill row is shown the pills own the ticket's color — show
    // it as static text so the form select can't fight the pill labels.
    // No pill row: keep the editable Color Log select (today's behavior).
    const colorLogPicker = multi
        ? `<div class="pp-bt-context-colorlog-group">
                <span class="pp-bt-context-date-label">Color Log</span>
                <span class="pp-bt-context-colorlog-static">${escapeHtml(batchTicketColorLabel(ticket))}</span>
            </div>`
        : (currentMultiColorEnabled && currentColorLogs.length > 0
            ? `<div class="pp-bt-context-colorlog-group">
                <label class="pp-bt-context-date-label" for="pp-bt-color-${escapeAttr(casting.id)}">Color Log</label>
                <select id="pp-bt-color-${escapeAttr(casting.id)}" class="pp-bt-context-colorlog" data-bt-field="colorLogId">
                    ${currentColorLogs.map(l =>
                        `<option value="${escapeAttr(l.id)}"${l.id === activeLog?.id ? ' selected' : ''}>${escapeHtml(l.name || '(unnamed)')}</option>`
                    ).join('')}
                </select>
            </div>`
            : (activeLog
                ? `<div class="pp-bt-context-colorlog-group">
                        <span class="pp-bt-context-date-label">Color Log</span>
                        <span class="pp-bt-context-colorlog-static">${escapeHtml(activeLog.name || '(unnamed)')}</span>
                    </div>`
                : ''));
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
                    ${weeklyDateHintHtml(casting)}
                </div>
            </div>

            <div data-bt-stale-wrap>${renderBatchUpdatingBanner(casting)}${renderBatchStaleBanner(casting, ticket)}</div>
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
                <details class="pp-bt-advanced"${(ticket.omitAggFinalBackup || ticket.omitFibersFace || ticket.cowbayFinalBackup) ? ' open' : ''}>
                    <summary>Direct Cast Options</summary>
                    <div class="pp-bt-advanced-body">
                        <div class="pp-bt-field pp-bt-omitagg">
                            <label class="pp-bt-checkbox">
                                <input type="checkbox" data-bt-field="omitAggFinalBackup"${ticket.omitAggFinalBackup ? ' checked' : ''}>
                                Omit Aggregate from Final Back Up
                            </label>
                            <span class="pp-bt-field-hint">For Direct Cast mixes — leaves aggregate out of the FINAL Back Up batch (ticket and Mix Day Totals), while keeping it in the Face Mix.</span>
                        </div>
                        <div class="pp-bt-field pp-bt-omitfibers">
                            <label class="pp-bt-checkbox">
                                <input type="checkbox" data-bt-field="omitFibersFace"${ticket.omitFibersFace ? ' checked' : ''}>
                                Omit Fibers from Face Mix
                            </label>
                            <span class="pp-bt-field-hint">For Direct Cast mixes — leaves fibers out of the Face Mix batch (ticket and Mix Day Totals). Back Up mixes keep their fibers.</span>
                        </div>
                        <div class="pp-bt-field pp-bt-cowbayfinal">
                            <label class="pp-bt-checkbox">
                                <input type="checkbox" data-bt-field="cowbayFinalBackup"${ticket.cowbayFinalBackup ? ' checked' : ''}>
                                Switch to Cowbay for Final Back Up
                            </label>
                            <span class="pp-bt-field-hint">For Direct Cast mixes — overrides the FINAL Back Up sand to Bulk Sand (Cowbay) on the ticket and Mix Day Totals. The Face Mix keeps the color-log sand.</span>
                        </div>
                    </div>
                </details>
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
        manualOverrides: btOverrides(ticket)
    });

    if (!plan.batches.length) return '';

    const sectionHeader = renderBatchSectionHeader(plan);
    const assign = renderBatchAssignTable(plan);
    // Day totals combine every color ticket on this casting, not just the one being viewed.
    const totalsPanel = renderBatchTotals(buildBatchTotalsEntries(casting), casting);
    const tickets = renderBatchTicketCards(casting, ticket, plan);

    return `
        ${sectionHeader}
        ${assign}
        ${totalsPanel}
        <div class="pp-bt-tickets">${tickets}</div>
        <div class="pp-bt-print-hint">Use <strong>Print Batch Tickets</strong> in the top bar to print these.</div>
    `;
}

/**
 * One totals entry per color ticket on the casting that has a usable plan
 * (cu ft entered and a color log with a sand weight). Feeds renderBatchTotals
 * so the Mix Day Totals panel spans all colors, not just the active ticket.
 */
function buildBatchTotalsEntries(casting) {
    const entries = [];
    for (const t of getBatchTicketList(casting.id)) {
        const totalCuFt = parseFloat(t.cuFt);
        if (!totalCuFt || totalCuFt <= 0) continue;
        const log = getActiveBatchColorLog(casting, t);
        const sandLbs = getColorLogSandLbs(log);
        if (!sandLbs) continue;
        const plan = buildBatchPlan({
            totalCuFt,
            faceSqFt: parseFloat(t.faceSqFt) || 0,
            cuFtPer250: parseFloat(t.cuFtPer250) || 4.28,
            castMethod: log?.castMethod || 'sprayUp',
            colorLogSandLbs: sandLbs,
            manualOverrides: btOverrides(t)
        });
        if (!plan.batches.length) continue;
        entries.push({
            plan,
            log,
            pigReductionPct: parsePigReduction(t.pigReduction),
            reduceFirstBackup: !!t.pigReduceFirstBackup,
            omitAggFinalBackup: !!t.omitAggFinalBackup,
            omitFibersFace: !!t.omitFibersFace,
            cowbayFinalBackup: !!t.cowbayFinalBackup
        });
    }
    return entries;
}

function renderBatchSectionHeader(plan) {
    const { summary } = plan;
    const parts = [];
    if (summary.count250) parts.push(`${summary.count250} × 250 lb`);
    if (summary.count150) parts.push(`${summary.count150} × 150 lb`);
    if (summary.count100) parts.push(`${summary.count100} × 100 lb`);
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
 * Authored value of a color-log additive row. The Color Log UI writes additive
 * quantities to `amount` (base ingredients use `weight`), so prefer `amount` and
 * fall back to `weight` only for legacy rows that predate that change. Returns the
 * first numerically-valid value, or null when the row has no usable quantity.
 * Without this, an edit to `amount` would be ignored whenever a stale `weight`
 * lingered on the row — the ticket would keep showing the old number.
 */
function additiveAmount(item) {
    for (const v of [item?.amount, item?.weight]) {
        if (v !== '' && v != null && !isNaN(Number(v))) return Number(v);
    }
    return null;
}

/**
 * Mix Day Totals — sums every ingredient across all batches in the plan,
 * applying the same per-batch overrides used on the tickets:
 *   - Sand split into "Sand - Bulk (Cowbay)" for Spray Up FINAL Back Up only
 *   - Fibers replaced by Cemfill for Spray Up backup batches and ALL Direct Cast batches
 *   - Pigments multiplied by (1 - reduction%) on FINAL Back Up batches
 * Matches the totals table from Batchin Calc/index.html.
 */
function renderBatchTotals(entries, casting = null) {
    entries = (entries || []).filter(e => e?.plan?.batches?.length && e.log);
    if (!entries.length) return '';

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

    // Accumulate every color ticket's plan into one shared totals map — same-name
    // materials (Portland, Sand, Water…) merge across colors, color-specific
    // pigments/additives get their own rows.
    for (const { plan, log, pigReductionPct = FINAL_BACKUP_PIG_REDUCTION_PCT, reduceFirstBackup = false, omitAggFinalBackup = false, omitFibersFace = false, cowbayFinalBackup = false } of entries) {
        const isDirectCast = log?.castMethod === 'directCast';
        // FINAL Back Up sand goes to Bulk Sand (Cowbay) for Spray Up, or when a
        // Direct Cast ticket opts in via "Switch to Cowbay for Final Back Up".
        const finalUsesCowbay = !isDirectCast || cowbayFinalBackup;

        // Pre-seed base ingredient ordering, inserting bulk sand right after sand.
        const hasBulkSand = finalUsesCowbay && plan.batches.some(b => b.type === 'finalBackUp');
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

            // Base ingredients — split sand into Bulk Sand for the FINAL Back Up
            // (Spray Up, or Direct Cast opting in). Other batches keep color-log sand.
            for (const ing of (log?.baseIngredients || [])) {
                if (!ing?.weight || !ing?.name) continue;
                const w = Number(ing.weight) * scaleFactor;
                if ((ing.name || '').trim().toLowerCase() === 'sand' && finalUsesCowbay && batchType === 'finalBackUp') {
                    addTotal('Sand_bulk', 'Sand - Bulk (Cowbay)', roundSig(w, 4), ing.unit || 'lbs', 'dry');
                } else {
                    addTotal(ing.name, ing.name + (ing.note ? ' (' + ing.note + ')' : ''), roundSig(w, 4), ing.unit || 'lbs', 'dry');
                }
            }

            // Aggregates — printed under DRY BATCH on every ticket card, so total them
            // the same way. Skipped for the FINAL Back Up when the ticket opts out.
            const omitAggHere = omitAggFinalBackup && batchType === 'finalBackUp';
            if (!omitAggHere) {
                for (const agg of (log?.aggregates || [])) {
                    if (!agg?.name || !agg.amount) continue;
                    addTotal('agg_' + agg.name, agg.name, roundSig(Number(agg.amount) * scaleFactor, 4), agg.unit || 'lbs', 'dry');
                }
            }

            // Fibers override:
            //   - Spray Up backup batches → Cemfill 18 lbs/250 lbs sand
            //   - Direct Cast (all batches) → Cemfill 18 lbs/250 lbs sand
            // Skipped entirely for the Face Mix when the ticket opts out of fibers.
            const omitFibersHere = omitFibersFace && batchType === 'face';
            const cemfillOverride = isBackup || (isDirectCast && batchType === 'face');
            if (omitFibersHere) {
                // no fibers on this batch
            } else if (cemfillOverride) {
                const fibersLbs = 18 * (batchSandLbs / 250);
                addTotal('Fibers_override', 'Fibers - Cemfill', roundSig(fibersLbs, 4), 'lbs', 'dry');
            } else {
                const fib = (log?.additives || []).find(a => /fiber|fibre/i.test(a?.name || ''));
                const fibAmt = additiveAmount(fib);
                if (fib && fibAmt != null) {
                    addTotal('Fibers', 'Fibers' + (fib.note ? ' (' + fib.note + ')' : ''), roundSig(fibAmt * scaleFactor, 4), fib.unit || 'g', 'additive');
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
                const amt = additiveAmount(add);
                if (amt == null) continue;
                const a = amt * scaleFactor;
                addTotal(add.name, add.name + (add.note ? ' (' + add.note + ')' : ''), roundSig(a, 4), add.unit || 'oz', 'additive');
            }
        });
    }

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

    const title = entries.length > 1 ? 'Mix Day Totals — All Colors & Batches' : 'Mix Day Totals — All Batches';
    // Color Log finishing / sealing notes under the totals (2026-10-26): one pair per colour log on the casting,
    // so the mix-day sheet carries what the finishing and sealing crews need to know.
    const logs = [];
    for (const e of entries) if (e.log && !logs.some(l => l.id === e.log.id)) logs.push(e.log);
    const noteBlock = (label, text) => `<div class="pp-bt-totals-note"><div class="pp-bt-totals-note-title">${escapeHtml(label)}</div><div class="pp-bt-totals-note-body${text ? '' : ' pp-bt-totals-note-empty'}">${text ? escapeHtml(text) : 'none on the color log'}</div></div>`;
    const notesHtml = logs.map(log => {
        const suffix = logs.length > 1 && log.name ? ` — ${log.name}` : '';
        return `<div class="pp-bt-totals-notes">${noteBlock('Color Log finishing notes' + suffix, String(log.finishingNotes || '').trim())}${noteBlock('Color Log sealing notes' + suffix, String(log.sealingNotes || '').trim())}</div>`;
    }).join('');
    return `
        <div class="pp-bt-totals-panel">
            <div class="pp-bt-totals-title">${title}</div>
            <table class="pp-bt-totals-table">
                <thead><tr><th>Material</th><th class="pp-bt-totals-num">Total Qty</th><th>Unit</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            ${notesHtml}
            ${scrimLineHtml(casting)}
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
    const omitAggFinalBackup = !!ticket.omitAggFinalBackup;
    const omitFibersFace = !!ticket.omitFibersFace;
    const cowbayFinalBackup = !!ticket.cowbayFinalBackup;

    return plan.batches.map(b =>
        renderBatchTicketCard({
            colorLog: activeLog,
            batch: b,
            project: projectName,
            sampleName,
            castMethod,
            castNumber,
            castDate,
            colorName: ticket.colorLogId ? (activeLog?.name || '') : '',
            batchedBy: ticket.batchedBy,
            notes: ticket.notes,
            pigReductionPct,
            reduceFirstBackup,
            omitAggFinalBackup,
            omitFibersFace,
            cowbayFinalBackup,
            // Project-wide slump target for this batch's type (in inches).
            targetSlump: clampSlumpTarget(currentSlumpTargets[b.type])
        })
    ).join('');
}

/**
 * Build a single batch ticket card HTML. Pure (DOM-free).
 * Mirrors Batchin Calc's renderBatchTicket().
 */
// Normalize a slump target to a usable number of inches. Falls back to the given
// default (5" historically; 6" for face — see SLUMP_TARGET_DEFAULTS) for
// blank/invalid input; caps at 10" (the graphic's outer ring).
function clampSlumpTarget(v, fallback = 5) {
    const n = Number(v);
    if (!isFinite(n) || n <= 0) return fallback;
    return Math.min(10, n);
}

// Display form of a slump target: whole numbers without a decimal, else up to 2 places.
function formatSlumpLabel(v) {
    const n = clampSlumpTarget(v);
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

// A project-wide slump target changed in the Batch Tickets panel. Update state, refresh
// the live preview so every ticket's graphic reflects it, then debounce-persist to the
// project (applies to all castings' tickets).
function handleSlumpTargetInput(key, value) {
    if (!(key in currentSlumpTargets)) return;
    currentSlumpTargets[key] = clampSlumpTarget(value, SLUMP_TARGET_DEFAULTS[key]);
    renderBatchTicketsContent();
    if (!currentProjectNumber) return;
    if (slumpTargetSaveTimer) clearTimeout(slumpTargetSaveTimer);
    slumpTargetSaveTimer = setTimeout(async () => {
        try {
            await setProjectSlumpTargets(currentProjectNumber, currentSlumpTargets);
        } catch (err) {
            logger.error('[batch-tickets] save slump targets failed:', err);
            showToast('Could not save slump targets — check connection.', 'error');
        }
    }, 600);
}

// Slump-test target board: concentric rings from 1" to 10" diameter with the target
// ring highlighted and a translucent disc filling the target diameter. The target is the
// project-wide value for this card's batch type (see currentSlumpTargets); the highlighted
// ring appears when the target lands on a whole inch, while the disc scales continuously.
function renderSlumpGraphic(targetIn = 5) {
    const cx = 100, cy = 100, step = 9; // radius px per 1" of diameter (10" → r 90 in a 200 viewBox)
    // Translucent disc fills the target diameter so the goal zone reads at a glance,
    // drawn first so the inner ring lines stay visible on top of it.
    const targetDisc = `<circle cx="${cx}" cy="${cy}" r="${targetIn * step}" fill="#ea580c" fill-opacity="0.12"/>`;
    let rings = '';
    let labels = '';
    for (let d = 1; d <= 10; d++) {
        const r = d * step;
        const target = d === targetIn;
        rings += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${target ? '#ea580c' : '#cbd5e1'}" stroke-width="${target ? 3 : 1}"/>`;
        // White mask + number at the top of each ring so the diameter scale reads cleanly.
        // Mask kept tight so an inner label never clips the digit on the next ring out.
        const ly = cy - r;
        labels += `<rect x="${cx - 6}" y="${ly - 5}" width="12" height="9" fill="#fff"/>`
            + `<text x="${cx}" y="${ly + 3}" text-anchor="middle" font-size="9.5" font-weight="${target ? 800 : 600}" fill="${target ? '#ea580c' : '#475569'}">${d}</text>`;
    }
    const cross = `<line x1="${cx - 6}" y1="${cy}" x2="${cx + 6}" y2="${cy}" stroke="#94a3b8" stroke-width="1.5"/>`
        + `<line x1="${cx}" y1="${cy - 6}" x2="${cx}" y2="${cy + 6}" stroke="#94a3b8" stroke-width="1.5"/>`;
    return `<svg class="bt-slump-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Slump target ${targetIn} inch spread">${targetDisc}${rings}${cross}${labels}</svg>`;
}

function renderBatchTicketCard({
    colorLog, batch, project, sampleName, castMethod, castNumber, castDate,
    colorName = '', batchedBy, notes, pigReductionPct = FINAL_BACKUP_PIG_REDUCTION_PCT, reduceFirstBackup = false,
    omitAggFinalBackup = false, omitFibersFace = false, cowbayFinalBackup = false,
    targetSlump = 5,
    printedOn = null, batchedOn = null   // print only: PRINTED ON (red) + BATCHED ON (green, last Import from Tracking)
}) {
    const slumpTarget = clampSlumpTarget(targetSlump);
    const { batchSandLbs, scaleFactor, num, total, type: batchType } = batch;
    const applyPigReduction = batchType === 'finalBackUp' || (batchType === 'firstBackUp' && reduceFirstBackup);
    const pigMultiplier = applyPigReduction ? (1 - pigReductionPct / 100) : 1;
    const cb = (checked) => `<span class="bt-cb-box ${checked ? 'checked' : ''}"></span>`;

    const findBase = (name) => (colorLog?.baseIngredients || []).find(i => (i.name || '').toLowerCase() === name.toLowerCase());
    // Additives in the color log usually carry the full product name ("ADVA Flex",
    // "Forton VF-774", "Eclipse 4500"), so an exact match against the slot key would
    // miss them and leave the ticket showing a stale "-". Match exact first, then fall
    // back to a contains match on the key — same tolerance as the fiber lookup below.
    const findAdd  = (name) => {
        const list = colorLog?.additives || [];
        const key = name.toLowerCase();
        return list.find(i => (i.name || '').toLowerCase() === key)
            || list.find(i => (i.name || '').toLowerCase().includes(key));
    };

    const scaleBase = (name) => {
        const f = findBase(name);
        if (!f || !f.weight) return { qty: '-', unit: f?.unit || 'lbs', type: f?.note || '' };
        return { qty: roundSig(Number(f.weight) * scaleFactor, 2), unit: f.unit || 'lbs', type: f.note || '' };
    };
    const scaleAdd = (name) => {
        const f = findAdd(name);
        const amt = additiveAmount(f);
        if (!f || amt == null) {
            return { qty: '-', unit: f?.unit || 'oz', type: f?.note || '' };
        }
        return { qty: roundSig(amt * scaleFactor, 2), unit: f.unit || 'oz', type: f.note || '' };
    };

    const portland = scaleBase('Portland');
    const sand     = scaleBase('Sand');
    const pozzo    = scaleBase('Pozzotive');

    // Aggregate is omitted from the FINAL Back Up when the ticket opts out
    // (e.g. Direct Cast jobs that only want aggregate in the Face Mix).
    const omitAggHere = omitAggFinalBackup && batchType === 'finalBackUp';
    let aggRows = '';
    const aggs = omitAggHere ? [] : (colorLog?.aggregates || []).filter(a => a && a.name);
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
    const fiberAmt = additiveAmount(fiberSrc);
    let fibers;
    if (fiberSrc && fiberAmt != null) {
        fibers = { qty: roundSig(fiberAmt * scaleFactor, 2), unit: fiberSrc.unit || 'oz', type: fiberSrc.note || '' };
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
    // Omit fibers from the Face Mix entirely when the ticket opts out
    // (e.g. Direct Cast jobs that don't want fibers in the face coat).
    if (omitFibersFace && batchType === 'face') {
        fibers = { qty: '-', unit: 'lbs', type: '' };
    }

    // ADDITIVES — fully dynamic. The color log stores Water + Forton as base
    // ingredients and ADVA / Eclipse / Fibers (+ any custom) as additives, but the
    // ticket lists every wet admixture here. Lead with Water, then every additive in
    // its color-log order (fibers excluded — they print under DRY BATCH), then
    // Forton. De-duped by name so a material entered in either list appears once,
    // and rows with no value are skipped (matching the Mix Day Totals panel).
    const admixtures = [];
    const seenAdmix = new Set();
    const addAdmix = (name, note, scaled) => {
        const key = (name || '').trim().toLowerCase();
        if (!key || seenAdmix.has(key) || scaled.qty === '-') return;
        seenAdmix.add(key);
        const label = name + (note ? ' (' + note + ')' : '');
        admixtures.push({ label, qty: scaled.qty, unit: scaled.unit });
    };

    // 1. Water — base preferred, additive fallback.
    const waterBase = scaleBase('Water');
    const waterSrc = findBase('Water') || findAdd('Water');
    addAdmix(waterSrc?.name || 'Water', waterSrc?.note, waterBase.qty !== '-' ? waterBase : scaleAdd('Water'));

    // 2. Every additive in order, scaled (skip fibers — shown under DRY BATCH).
    for (const add of (colorLog?.additives || [])) {
        if (!add || !add.name || /fiber|fibre/i.test(add.name)) continue;
        const amt = additiveAmount(add);
        if (amt == null) continue;
        addAdmix(add.name, add.note, { qty: roundSig(amt * scaleFactor, 2), unit: add.unit || 'oz' });
    }

    // 3. Forton — base preferred, additive fallback (deduped if already listed).
    const fortonBase = scaleBase('Forton');
    const fortonSrc = findBase('Forton') || findAdd('Forton');
    addAdmix(fortonSrc?.name || 'Forton', fortonSrc?.note, fortonBase.qty !== '-' ? fortonBase : scaleAdd('Forton'));

    const additiveRowsHtml = admixtures.length
        ? admixtures.map((a, i) =>
            `<tr><td class="bt-label">Additive #${i + 1}:</td><td class="bt-type">TYPE: ${escapeHtml(a.label)}</td><td class="bt-qty-label">QTY:</td><td class="bt-qty">${a.qty}</td><td class="bt-unit">${escapeHtml(a.unit)}</td></tr>`
          ).join('')
        : `<tr><td class="bt-label">Additive #1:</td><td class="bt-type">TYPE:</td><td class="bt-qty-label">QTY:</td><td class="bt-qty"></td><td class="bt-unit"></td></tr>`;

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
    // Sand type by batch:
    //   - Face Mix & First Back Up → the color-log sand (e.g. Qrok)
    //   - FINAL Back Up → Bulk Sand (Cowbay) for Spray Up, or when a Direct
    //     Cast ticket opts in via "Switch to Cowbay for Final Back Up".
    const useCowbayFinal = (!isDirectCast || cowbayFinalBackup) && batchType === 'finalBackUp';
    const sandTypeDisplay = useCowbayFinal
        ? 'Bulk Sand (Cowbay)'
        : escapeHtml(sand.type || '');

    return `
    <div class="batch-ticket bt-${batchType}">
        <div class="bt-title-row">
            <div class="bt-title">BATCHING TICKET</div>
            ${printedOn ? `<div class="bt-stamps">
                <div class="bt-stamp-printed">PRINTED ON ${escapeHtml(btStampDate(printedOn))}</div>
                <div class="bt-stamp-batched">${batchedOn ? 'BATCHED ON ' + escapeHtml(btStampDate(batchedOn)) : 'BATCHED ON: NOT IMPORTED FROM TRACKING'}</div>
            </div>` : ''}
        </div>
        <div class="bt-type-banner">${bannerLabel}</div>

        <div class="bt-header-grid">
            <div class="bt-hrow"><span class="bt-hlabel">PROJECT:</span><span class="bt-hval">${escapeHtml(project || '')}</span></div>
            <div class="bt-hrow"><span class="bt-hlabel">Batched by:</span><span class="bt-hval">${escapeHtml(batchedBy || '')}</span></div>
            <div class="bt-hrow"><span class="bt-hlabel">Sample #:</span><span class="bt-hval">${escapeHtml(sampleName || '')}</span></div>
            ${colorName ? `<div class="bt-hrow"><span class="bt-hlabel">Color:</span><span class="bt-hval">${escapeHtml(colorName)}</span></div>` : ''}
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
        <table class="bt-table">${additiveRowsHtml}</table>

        <div class="bt-footer">
            <div class="bt-footer-col bt-footer-left">
                <div class="bt-section-label">MIX CONDITIONS</div>
                <div class="bt-cond-row"><span class="bt-cond-label">AIR Temp</span><span class="bt-cond-line"></span><span class="bt-cond-unit">&deg;F</span></div>
                <div class="bt-cond-row"><span class="bt-cond-label">WATER Temp</span><span class="bt-cond-line"></span><span class="bt-cond-unit">&deg;F</span></div>
                <div class="bt-cond-row"><span class="bt-cond-label">ICE / WATER</span><span class="bt-cond-line bt-cond-line-sm"></span><span class="bt-cond-unit">LB</span><span class="bt-cond-slash">/</span><span class="bt-cond-line bt-cond-line-sm"></span><span class="bt-cond-unit">LB</span></div>
            </div>
            <div class="bt-footer-col bt-footer-right">
                <div class="bt-section-label">SLUMP TEST</div>
                <div class="bt-slump-wrap">
                    ${renderSlumpGraphic(slumpTarget)}
                    <div class="bt-slump-side">
                        <div class="bt-slump-readout">
                            <div class="bt-readout">
                                <span class="bt-readout-label">Target</span>
                                <span class="bt-readout-val">${formatSlumpLabel(slumpTarget)}&Prime;</span>
                            </div>
                            <div class="bt-readout">
                                <span class="bt-readout-label">Actual</span>
                                <span class="bt-readout-val bt-readout-actual"><span class="bt-readout-blank"></span>&Prime;</span>
                            </div>
                        </div>
                        <div class="bt-passfail">
                            <span class="bt-pf"><span class="bt-pf-text">PASS</span>${cb(false)}</span>
                            <span class="bt-pf"><span class="bt-pf-text">FAIL</span>${cb(false)}</span>
                        </div>
                        <div class="bt-slump-fields">
                            <div class="bt-slump-field"><span class="bt-slump-field-label">Time</span><span class="bt-time-input"><span class="bt-time-blank"></span><span class="bt-time-colon">:</span><span class="bt-time-blank"></span></span></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        ${notes ? '<div class="bt-notes-title">NOTES:</div><div class="bt-notes">' + escapeHtml(notes) + '</div>' : ''}
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

function scheduleBatchTicketSave(castingId, ticket) {
    if (!currentProjectNumber || !ticket) return;
    const existing = batchTicketSaveTimers.get(ticket);
    if (existing) clearTimeout(existing.timer);
    setBatchTicketStatus(castingId, 'saving');
    const timer = setTimeout(() => saveBatchTicketNow(castingId, ticket), 700);
    batchTicketSaveTimers.set(ticket, { castingId, timer });
}

async function saveBatchTicketNow(castingId, ticket) {
    if (!ticket) return;
    batchTicketSaveTimers.delete(ticket);
    try {
        const saved = await saveBatchTicketForCasting(castingId, ticket);
        if (saved) ticket.id = saved.id;
        setBatchTicketStatus(castingId, 'saved');
        setTimeout(() => setBatchTicketStatus(castingId, ''), 1500);
    } catch (err) {
        logger.error('[batch-tickets] save failed', err);
        setBatchTicketStatus(castingId, 'error');
        if (err?.code === '23505') {
            alert('Batch ticket save failed: the database still allows only one ticket per casting.\n\nRun migration/batch-tickets-multi-color.sql in the Supabase SQL editor to enable multi-color batch tickets.');
        }
    }
}

async function flushAllBatchTicketSaves() {
    const pending = Array.from(batchTicketSaveTimers.entries());
    if (!pending.length) return;
    for (const [, p] of pending) clearTimeout(p.timer);
    batchTicketSaveTimers.clear();
    await Promise.all(pending.map(([ticket, p]) => saveBatchTicketNow(p.castingId, ticket).catch(() => {})));
}

async function handleSelectBatchCasting(castingId) {
    if (castingId === currentBatchCastingId) return;
    // Flush any pending saves on the casting we're leaving so its DB state matches the form.
    const prev = currentBatchCastingId;
    if (prev) {
        const pending = Array.from(batchTicketSaveTimers.entries()).filter(([, p]) => p.castingId === prev);
        for (const [ticket, p] of pending) {
            clearTimeout(p.timer);
            batchTicketSaveTimers.delete(ticket);
            try { await saveBatchTicketNow(prev, ticket); } catch (e) { /* logged */ }
        }
    }
    currentBatchCastingId = castingId;
    // Re-pull color logs first so the recalc reflects any edits made since the
    // tab opened — selecting a casting always recomputes from fresh data.
    await refreshBatchColorLogs();
    renderBatchTickets();
}

function handleSelectBatchColor(colorKey) {
    const castingId = currentBatchCastingId;
    if (!castingId) return;
    // Compare against the stored key only — with no selection stored yet the
    // default pill is a real color, so a first click on "No Color" ('') must
    // not be mistaken for a no-op.
    if (currentBatchColorSel.get(castingId) === colorKey) return;
    // Pending saves hold their ticket object, so no flush needed — the debounce
    // fires against the right ticket even after switching pills.
    currentBatchColorSel.set(castingId, colorKey);
    renderBatchTicketsContent();
}

function handleAddBatchColorTicket(colorLogId) {
    const castingId = currentBatchCastingId;
    if (!castingId || !colorLogId) return;
    let arr = batchTickets.get(castingId);
    if (!arr) { arr = []; batchTickets.set(castingId, arr); }
    if (!arr.some(t => t.colorLogId === colorLogId)) {
        const v = emptyBatchTicketForm(castingId);
        v.colorLogId = colorLogId;
        arr.push(v);
    }
    currentBatchColorSel.set(castingId, colorLogId);
    renderBatchTicketsContent();
}

async function handleRemoveBatchColorTicket() {
    const castingId = currentBatchCastingId;
    if (!castingId) return;
    const list = getBatchTicketList(castingId);
    if (list.length <= 1) return;
    const ticket = getBatchTicketFor(castingId);
    if (ticket.id) {
        if (!confirm(`Delete the "${batchTicketColorLabel(ticket)}" batch ticket? Its saved batch plan will be removed.`)) return;
        try {
            await deleteBatchTicket(ticket.id);
        } catch (err) {
            logger.error('[batch-tickets] delete failed', err);
            showToast('Failed to delete batch ticket', 'error');
            return;
        }
    }
    const pending = batchTicketSaveTimers.get(ticket);
    if (pending) { clearTimeout(pending.timer); batchTicketSaveTimers.delete(ticket); }
    const arr = batchTickets.get(castingId) || [];
    const idx = arr.indexOf(ticket);
    if (idx !== -1) arr.splice(idx, 1);
    currentBatchColorSel.delete(castingId);
    renderBatchTicketsContent();
}

function handleBatchFieldInput(castingId, field, value) {
    const ticket = getBatchTicketFor(castingId);
    if (!(field in ticket)) return;
    ticket[field] = value;
    // Inputs that affect the visible preview: re-render it so summary/tickets stay in sync.
    const previewAffectingFields = ['cuFt', 'faceSqFt', 'cuFtPer250', 'pigReduction', 'pigReduceFirstBackup', 'omitAggFinalBackup', 'omitFibersFace', 'cowbayFinalBackup', 'batchedBy', 'notes', 'colorLogId'];
    if (previewAffectingFields.includes(field)) {
        // If the batch count would change, drop manual overrides so they don't desync.
        const casting = currentCastings.find(c => c.id === castingId);
        const activeLog = getActiveBatchColorLog(casting, ticket);
        const sandLbs = getColorLogSandLbs(activeLog);
        if (sandLbs && btOverrides(ticket).length) {
            const newPlan = buildBatchPlan({
                totalCuFt: parseFloat(ticket.cuFt) || 0,
                faceSqFt: parseFloat(ticket.faceSqFt) || 0,
                cuFtPer250: parseFloat(ticket.cuFtPer250) || 4.28,
                castMethod: activeLog?.castMethod || 'sprayUp',
                colorLogSandLbs: sandLbs,
                manualOverrides: null
            });
            if (newPlan.batches.length !== btOverrides(ticket).length) {
                btSetOverrides(ticket, []);
            }
        }
        rerenderBatchPreview(castingId);
        if (field === 'cuFt' || field === 'faceSqFt') {
            // The out-of-date warning compares these two with the Casting Inventory — keep it current while typing.
            const wrap = document.querySelector('#pp-bt-content [data-bt-stale-wrap]');
            const casting2 = currentCastings.find(c => c.id === castingId);
            if (wrap && casting2) { wrap.innerHTML = renderBatchUpdatingBanner(casting2) + renderBatchStaleBanner(casting2, ticket); updateFloats(); }
        }
    }
    scheduleBatchTicketSave(castingId, ticket);
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
        manualOverrides: btOverrides(ticket)
    });
    // Materialize current assignments (auto + any prior overrides), then update one.
    const assignments = plan.batches.map(b => ({ batchLbs: b.batchSandLbs, type: b.type }));
    if (idx >= 0 && idx < assignments.length) assignments[idx].type = type;
    btSetOverrides(ticket, assignments);
    rerenderBatchPreview(castingId);
    scheduleBatchTicketSave(castingId, ticket);
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

    let rows = getInventoryFor(castingId);
    if (!rows.length) {
        showToast('No inventory components for this casting', 'error');
        return;
    }

    // Multi-color: only total the rows belonging to the active ticket's color
    // (NULL-color ticket matches rows without a color_log_id). Single-ticket
    // mode keeps today's behavior and sums everything.
    const ticket = getBatchTicketFor(castingId);
    if (getBatchTicketList(castingId).length > 1) {
        rows = rows.filter(r => ticket.colorLogId ? r.color_log_id === ticket.colorLogId : !r.color_log_id);
        if (!rows.length) {
            showToast(`No inventory rows for ${batchTicketColorLabel(ticket)}`, 'error');
            return;
        }
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

    const applied = [];
    if (cuFtComplete) { ticket.cuFt = String(roundSig(totalCuFt, 2)); applied.push('Total Cu Ft'); }
    if (ffComplete)   { ticket.faceSqFt = String(roundSig(totalFf, 2)); applied.push('Face Sq Ft'); }

    if (!applied.length) {
        showToast('Import blocked — inventory rows are missing Cu Ft and FF Sq Ft values', 'error');
        return;
    }

    // Plan inputs changed — drop manual batch-type overrides so they can't desync — and stamp the import time.
    ticket.batchAssignments = [{ meta: BT_IMPORT_META, importedAt: new Date().toISOString() }];
    renderBatchTicketsContent();
    scheduleBatchTicketSave(castingId, ticket);

    const skipped = [];
    if (!cuFtComplete) skipped.push('Cu Ft');
    if (!ffComplete)   skipped.push('FF Sq Ft');
    if (skipped.length) {
        showToast(`Imported ${applied.join(' & ')}. Skipped ${skipped.join(' & ')} — some inventory rows are blank.`, 'error');
    } else {
        showToast(`Imported ${applied.join(' & ')} from inventory`, 'success');
    }
}

// ---------- Cast Date from the weekly board (2026-10-13) ----------
// The weekly's Cast tasks carry a project number + casting number (never the name), so a casting's
// cast date can come from there: a BLANK Cast Date is filled with the first Cast day automatically;
// a date that is already set is never overwritten — the hint next to it offers the weekly's date
// with one click; no Cast task on the weekly → "casting not yet scheduled".
let weeklyCastDates = null;      // Map casting_number (trimmed) -> 'YYYY-MM-DD' (first Cast day)
let weeklyCastDatesFor = null;   // project number the map belongs to

function isoDay(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function shortDay(iso) { const d = new Date(iso + 'T00:00:00'); return isNaN(d) ? iso : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }

async function loadWeeklyCastDates(projectNumber) {
    const pn = String(projectNumber || '').trim();
    const map = new Map();
    if (!pn) return map;
    try {
        const all = await fetchAllTasks();
        for (const t of (all || [])) {
            if (t.department !== 'Cast') continue;
            if (String(t.projectNumber || '').trim() !== pn) continue;
            const cn = String(t.castingNumber || '').trim();
            if (!cn) continue;
            const d = parseDate(t.date);
            if (!d) continue;
            const iso = isoDay(d);
            if (!map.has(cn) || iso < map.get(cn)) map.set(cn, iso);
        }
    } catch (err) {
        logger.error('[batch-tickets] weekly cast dates failed:', err);
    }
    if (String(currentProjectNumber || '').trim() === pn) { weeklyCastDates = map; weeklyCastDatesFor = pn; }
    return map;
}

/** Fill every BLANK Cast Date of the current project from the weekly; returns how many were filled. */
async function autoFillCastDatesFromWeekly() {
    const pn = String(currentProjectNumber || '').trim();
    const map = await loadWeeklyCastDates(pn);
    let filled = 0;
    for (const c of currentCastings) {
        if (c.casting_date) continue;
        const iso = map.get(String(c.casting_number || '').trim());
        if (!iso) continue;
        try {
            await updateCasting(c.id, { casting_date: iso });
            c.casting_date = iso;
            filled++;
        } catch (err) {
            logger.error('[batch-tickets] auto cast date from weekly failed', err);
        }
    }
    return filled;
}

function weeklyDateHintHtml(casting) {
    if (!weeklyCastDates || weeklyCastDatesFor !== String(currentProjectNumber || '').trim()) {
        return `<span class="pp-bt-weekly-hint pp-bt-weekly-loading" data-bt-weekly-hint>checking the weekly&hellip;</span>`;
    }
    const iso = weeklyCastDates.get(String(casting.casting_number || '').trim());
    if (!iso) return `<span class="pp-bt-weekly-hint pp-bt-weekly-none" data-bt-weekly-hint title="The weekly board has no Cast task for this casting">casting not yet scheduled</span>`;
    if (casting.casting_date === iso) return `<span class="pp-bt-weekly-hint pp-bt-weekly-ok" data-bt-weekly-hint title="Matches the weekly board">&#10003; matches the weekly</span>`;
    return `<span class="pp-bt-weekly-hint pp-bt-weekly-diff" data-bt-weekly-hint title="The weekly board has this casting on ${escapeAttr(shortDay(iso))}">Weekly: ${escapeHtml(shortDay(iso))} <button type="button" class="pp-bt-weekly-use" data-bt-weekly-use="${escapeAttr(iso)}">Use it</button></span>`;
}
function renderWeeklyDateHints() {
    const casting = currentCastings.find(c => c.id === currentBatchCastingId);
    if (!casting) return;
    document.querySelectorAll('#pp-bt-content [data-bt-weekly-hint]').forEach(el => { el.outerHTML = weeklyDateHintHtml(casting); });
}

/** Called when the Batch Tickets tab opens: fill blanks, then refresh what is on screen. */
function syncCastDatesWithWeekly() {
    autoFillCastDatesFromWeekly().then(n => {
        if (currentTab !== 'batch-tickets') return;
        if (n) {
            showToast(`Cast date filled from the weekly board for ${n} casting${n === 1 ? '' : 's'}`, 'success');
            renderBatchTicketsPills();
            renderBatchTicketsContent();
            // The embedded special page shows the casting's date too — have it re-pull.
            const frame = getSpecialBatchingFrame();
            if (frame && frame.getAttribute('src') && !frame.closest('[hidden]')) frame.contentWindow?.postMessage({ type: 'jsb-activate' }, location.origin);
        } else {
            renderWeeklyDateHints();
        }
    }).catch(err => logger.error('[batch-tickets] weekly cast date sync failed', err));
}

async function handleCastingDateChange(castingId, value) {
    try {
        await updateCasting(castingId, { casting_date: value || null });
        const c = currentCastings.find(x => x.id === castingId);
        if (c) c.casting_date = value || null;
        // Refresh both pills (date label) and content if this is the active casting.
        renderBatchTicketsPills();
        renderWeeklyDateHints();
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
    if (!casting) return;
    const ticket = getBatchTicketFor(castingId);
    if (!ticket) return;
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
    } else if (currentTab === 'staging') {
        const phaseScoped = getCastingsForActivePhase();
        if (!currentStagingCastingId || !phaseScoped.some(c => c.id === currentStagingCastingId)) {
            currentStagingCastingId = phaseScoped[0]?.id || null;
        }
        renderStaging();
    } else if (currentTab === 'batch-tickets') {
        const phaseScoped = getCastingsForActivePhase();
        if (!currentBatchCastingId || !phaseScoped.some(c => c.id === currentBatchCastingId)) {
            currentBatchCastingId = phaseScoped[0]?.id || null;
        }
        renderBatchTickets();
    } else if (currentTab === 'jig-list') {
        // Re-activate with the newly scoped castings; the module keeps the
        // selected casting when it's still in scope.
        activateJigListTabWithCtx();
    } else if (currentTab === 'approvals') {
        renderApprovals();
    } else if (currentTab === 'cr-notes') {
        renderClassroomMs();
    }
    // The Releasability bar lists the castings of the phase in view — rebuild it for the new phase.
    if (msFloatEl) msFloatEl.dataset.key = '';
    updateMsFloat();
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
        const taken = new Set(currentPhases.map(p => String(p.phase_name || '').trim().toLowerCase()));
        let n = currentPhases.length + 1;
        while (taken.has(`phase${n}`)) n += 1;
        const newPhase = await createPhase(currentProjectNumber, { phase_name: `phase${n}` });
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

/** Phase names are one word — letters and numbers only (t5, a, 1, cast1 pass; "cast 1", "first cast" fail). */
function isValidPhaseName(name) { return /^[A-Za-z0-9]+$/.test(String(name || '').trim()); }
const PHASE_NAME_RULE = 'Phase names must be one word — letters and numbers only, no spaces (e.g. P2, North, cast1).';

function scheduleProjectPhaseRename(phaseId, name) {
    if (!phaseId) return;
    if (String(name || '').trim() && !isValidPhaseName(name)) { showToast(PHASE_NAME_RULE, 'error'); return; }
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

    const visibleCrates = sortCrates(getCratesForActivePhase());
    const toolbar = `<div class="pp-ship-toolbar">
        <button type="button" class="pp-ship-add-btn" data-action="ship-add-truck">+ Add truck</button>
        <span class="pp-ship-toolbar-hint">Trucks and crates are picked per panel on the Tracking tab. Here you can move or renumber a whole crate. Crate numbers can repeat from truck to truck.</span>
    </div>`;
    if (visibleCrates.length === 0) {
        list.innerHTML = toolbar + `<div class="pp-ship-empty">No crates yet. Pick a truck and crate number on the <strong>Tracking</strong> tab, or add a truck here.</div>`;
        return;
    }

    // crateId -> ordered components (across all visible castings)
    const visibleCastings = getCastingsForActivePhase();
    const membersByCrate = new Map();
    for (const crate of visibleCrates) membersByCrate.set(crate.id, []);
    for (const casting of visibleCastings) {
        for (const comp of getComponentsFor(casting.id)) {
            if (comp.crate_id && membersByCrate.has(comp.crate_id)) membersByCrate.get(comp.crate_id).push({ comp, casting });
        }
    }

    // group by truck; numbered trucks first, "No truck yet" last
    const trucks = new Map();
    for (const crate of visibleCrates) { const t = crateTruck(crate); if (!trucks.has(t)) trucks.set(t, []); trucks.get(t).push(crate); }
    const truckNums = [...trucks.keys()].sort((a, b) => ((a === 0) - (b === 0)) || (a - b));
    const numbered = truckNums.filter(t => t > 0);

    list.innerHTML = toolbar + truckNums.map(t => {
        const crates = trucks.get(t);
        const panels = crates.reduce((n, c) => n + (membersByCrate.get(c.id) || []).length, 0);
        const actions = t
            ? `<button type="button" class="pp-ship-add-btn" data-action="ship-add-crate" data-truck="${t}">+ Add crate</button>
               <button type="button" class="pp-ship-print-btn" data-action="ship-print-truck" data-truck="${t}" ${panels === 0 ? 'disabled' : ''} title="${panels === 0 ? 'Assign panels first' : 'Print one packing list for the whole truck'}"><span>Truck packing list</span></button>`
            : `<span class="pp-ship-truck-hint">Crates with no truck yet — use the Truck box on a crate to put it on one.</span>
               <button type="button" class="pp-ship-add-btn" data-action="ship-add-crate" data-truck="0">+ Add crate</button>`;
        return `<section class="pp-ship-truck${t ? '' : ' pp-ship-truck-none'}" data-truck="${t}">
            <div class="pp-ship-truck-header">
                <h3 class="pp-ship-truck-title">${t ? `Truck ${t}` : 'Not on a truck yet'}</h3>
                <span class="pp-ship-truck-count">${crates.length} ${crates.length === 1 ? 'crate' : 'crates'} · ${panels} ${panels === 1 ? 'panel' : 'panels'}</span>
                <div class="pp-ship-truck-actions">${actions}</div>
            </div>
            ${crates.map(crate => renderCrateCard(crate, membersByCrate.get(crate.id) || [], numbered)).join('')}
        </section>`;
    }).join('');
}

function renderCrateCard(crate, members, truckNums = []) {
    const isOpen = currentShipExpanded.has(crate.id);
    const memberCount = members.length;
    const parts = crateParts(crate);
    const nextTruck = (truckNums.length ? Math.max(...truckNums) : 0) + 1;
    const truckOptions = ['<option value="0"' + (parts.truck === 0 ? ' selected' : '') + '>—</option>']
        .concat(truckNums.map(t => `<option value="${t}"${t === parts.truck ? ' selected' : ''}>Truck ${t}</option>`))
        .concat([`<option value="${nextTruck}">New truck ${nextTruck}</option>`]).join('');

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
                <input type="text" class="pp-ship-crate-num" data-field="crate_num" value="${escapeAttr(parts.num)}" title="Crate number on this truck (numbers start again on each truck)" />
                <label class="pp-ship-crate-truck">Truck <select data-field="truck" title="Which truck this crate rides on">${truckOptions}</select></label>
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
        ? `Delete ${crateDisplay(crate)}?`
        : `Delete ${crateDisplay(crate)}? ${memberCount} ${memberCount === 1 ? 'panel' : 'panels'} will be unassigned.`;
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
    LOAD: 'Crate #'
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

    // ---------- LOAD/CRATE # leads the table ----------
    // The LOAD column (printed as "LOAD/CRATE #") is pulled out of the phase grid
    // and rendered as the FIRST column, to the LEFT of Panel ID, rather than at the
    // far right where its TRACKING_PHASES order would otherwise place it. It keeps
    // its workflow sequence badge (LOAD is always the final step). When LOAD isn't a
    // selected phase there's no leading column at all.
    const loadSelected = selectedPhases.includes('LOAD');
    const loadSeq = selectedPhases.length;                 // LOAD sorts last in TRACKING_PHASES
    const gridPhases = loadSelected ? selectedPhases.filter(p => p !== 'LOAD') : selectedPhases;
    const loadHeaderCell = loadSelected
        ? `<th class="tp-col-load" style="width:${phasePct}%;">${escapeHtml(TRACK_PRINT_PHASE_LABELS.LOAD)}<span class="tp-seq">${loadSeq}</span></th>`
        : '';
    const loadBodyCell = loadSelected ? `<td class="tp-col-load"></td>` : '';

    // ---------- Header cells (single <thead>; browser repeats it per print page) ----------
    const headerCells = [
        loadHeaderCell,
        `<th class="tp-col-panel" style="width:${panelIdPct}%;">Panel ID</th>`,
        `<th class="tp-col-color" style="width:${colorPct}%;">Color</th>`,
        ...gridPhases.map((p, i) => {
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
    const exampleCells = gridPhases.map((p, i) => {
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
            ${loadBodyCell}
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

            const phaseCells = gridPhases.map(p => {
                const isFinal = p === 'FINAL';
                const cls = isFinal ? 'tp-hold' : 'tp-col-phase';
                return `<td class="${cls}"></td>`;
            }).join('');

            return `
                <tr${rowClass}>
                    ${loadBodyCell}
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
        `<span><b>Date</b>&nbsp;${escapeHtml(dateLabel)}</span>`,
        `<span><b>Total&nbsp;Panels</b>&nbsp;${components.length}</span>`
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

async function handlePrintTracking(castingId) {
    if (!castingId) return;
    if (!(await printGate([castingId], 'Final Tracking'))) return;
    msArmStamp([castingId], 'Final Tracking');
    handlePrintTrackingNow(castingId);
}
function handlePrintTrackingNow(castingId) {
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
            msFlushPendingStamp();
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
    if (!(await printGate([castingId], 'Labels'))) return;
    msArmStamp([castingId], 'Labels');
    return handlePrintStickersNow(castingId);
}
async function handlePrintStickersNow(castingId) {
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
            msFlushPendingStamp();
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
.cv-folder { width: 3.8in; margin-top: 12pt; }
.cv-folder-title { background: #e5e7eb; color: #000; padding: 3pt 8pt; font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3pt; margin-bottom: 5pt; }
.cv-check { list-style: none; }
.cv-check li { position: relative; padding-left: 14pt; margin-bottom: 2pt; font-size: 8pt; line-height: 1.25; }
.cv-check li::before { content: ''; position: absolute; left: 0; top: 1.5pt; width: 8pt; height: 8pt; border: 1px solid #000; }
.cv-check-top { margin-bottom: 6pt; }
.cv-check-top li { font-weight: 700; font-size: 8.5pt; }
.cv-folder-tabs { display: flex; flex-direction: column; gap: 4pt; }
.cv-tab { break-inside: avoid; }
.cv-tab-head { font-size: 8pt; font-weight: 700; text-decoration: underline; margin-bottom: 1.5pt; }
.cv-note { display: block; font-size: 7.5pt; font-style: italic; color: #374151; line-height: 1.2; }
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

        <div class="cv-folder">
            <div class="cv-folder-title">Folder Standard Contents</div>
            <ol class="cv-check cv-check-top">
                <li>Cover Sheet Printed and Applied</li>
                <li>Sticker Printed and Applied</li>
            </ol>
            <div class="cv-folder-tabs">
                <div class="cv-tab">
                    <div class="cv-tab-head">1st Tab — Left Hand / Inside Cover</div>
                    <ul class="cv-check">
                        <li>Shop Drawing / Tickets<span class="cv-note">To contain all dimensional information about concrete components</span></li>
                    </ul>
                </div>
                <div class="cv-tab">
                    <div class="cv-tab-head">1st Tab — Right Hand</div>
                    <ul class="cv-check">
                        <li>Tracking Sheet</li>
                        <li>Stickers Stapled Behind Tracking Sheet</li>
                    </ul>
                </div>
                <div class="cv-tab">
                    <div class="cv-tab-head">2nd Tab — Left Hand</div>
                    <ul class="cv-check">
                        <li>Formwork 3D Drawings</li>
                        <li>Jig List</li>
                    </ul>
                </div>
                <div class="cv-tab">
                    <div class="cv-tab-head">2nd Tab — Right Hand</div>
                    <ul class="cv-check">
                        <li>Sales Order</li>
                        <li>Formout Instructions if Needed</li>
                    </ul>
                </div>
                <div class="cv-tab">
                    <div class="cv-tab-head">3rd Tab — Left Hand</div>
                    <ul class="cv-check">
                        <li>Casting Layout</li>
                        <li>Casting Instructions</li>
                    </ul>
                </div>
                <div class="cv-tab">
                    <div class="cv-tab-head">3rd Tab — Right Hand</div>
                    <ul class="cv-check">
                        <li>Batching Ticket</li>
                        <li>Color Log</li>
                    </ul>
                </div>
                <div class="cv-tab">
                    <div class="cv-tab-head">4th Tab — Left Hand</div>
                    <ul class="cv-check">
                        <li>Build Crate Ticket</li>
                    </ul>
                </div>
                <div class="cv-tab">
                    <div class="cv-tab-head">4th Tab — Right Hand</div>
                    <ul class="cv-check">
                        <li>Optimizer Hours</li>
                    </ul>
                </div>
            </div>
        </div>
    </body></html>`;
}

function handlePrintCoverPage() {
    if (!currentProjectNumber) {
        showToast('Save the project first', 'error');
        return;
    }
    // Step 1 of the shop folder: the cover. "Shop Folder Cover" goes orange for the castings in view
    // (green comes with step 2, Print Shop Folder Cover). Never downgrades a green.
    const coverCastings = getCastingsForActivePhase().map(c => c.id);
    for (const id of coverCastings) markWorking(id, 'Shop Folder Cover', 'Cover printed — shop folder cover still to print');
    msArmStamp(coverCastings, 'Shop Folder Built');   // a printed cover goes on a physical folder: Shop Folder Built
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
            msFlushPendingStamp();
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

// ---------- Print Shop Folder Cover (QC sticker cover) ----------
// Letter portrait. Same header as the project cover, then a grid of 1"
// circles — one per active tracking-sheet column — for placing 1" round QC
// stickers. Each circle is labelled "Post <column>" (e.g. Post Mill), in the
// same order and active set as the project's Tracking tab.

const SHOP_FOLDER_PHASE_LABELS = {
    MILL: 'Mill', FO: 'FO', 'POST FO QA': 'FO QA', CAST: 'Cast', DEMOLD: 'Demold', FINISH: 'Finish',   // sticker reads "Post FO QA"
    EPOXY: 'Epoxy', SEAL: 'Seal', STRIPS: 'Strips', DRILL: 'Drill',
    'DRY FIT': 'Dry Fit', CRATE: 'Crate', FINAL: 'Final', LOAD: 'Load'
};

function shopFolderPhaseLabel(phase) {
    return SHOP_FOLDER_PHASE_LABELS[phase]
        || String(phase || '').toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase());
}

// Fixed QC circles shown on every project's cover, regardless of tracking
// columns. Keyed by the tracking phase they should appear immediately BEFORE,
// so they slot into the workflow sequence (e.g. Batch Check right before Cast).
// Any whose anchor phase isn't active fall back to the end of the grid.
const SHOP_FOLDER_FIXED_BEFORE = { CAST: ['Batch Check'] };

const SHOP_FOLDER_CEMENT_LABELS = { white: 'White Portland', gray: 'Gray Portland', other: 'Other' };
const SHOP_FOLDER_CAST_LABELS = { sprayUp: 'Spray Up', directCast: 'Direct Cast', other: 'Other' };

/** Approved Color Information block(s) built from the project's color log(s). */
function shopFolderColorInfoHtml(colorLogs) {
    const logs = (colorLogs || []).filter(Boolean);
    if (!logs.length) {
        return `<div class="sf-color-empty">No color log is linked to this project yet.</div>`;
    }
    return logs.map(cl => {
        const cement = SHOP_FOLDER_CEMENT_LABELS[cl.cementType] || (cl.cementType || '—');
        const cast = SHOP_FOLDER_CAST_LABELS[cl.castMethod] || (cl.castMethod || '—');
        const stdCustom = cl.isStandard !== false ? 'Standard' : 'Custom';
        const finishing = (cl.finishingNotes || '').trim();
        const sealing = (cl.sealingNotes || '').trim();
        return `<div class="sf-color">
            <div class="sf-color-head">${escapeHtml((cl.name || '').trim() || '(unnamed color)')}</div>
            <div class="sf-color-row">
                <span><b>Cement Type:</b> ${escapeHtml(cement)}</span>
                <span><b>Cast Method:</b> ${escapeHtml(cast)}</span>
                <span><b>Designation:</b> ${escapeHtml(stdCustom)}</span>
            </div>
            <div class="sf-notes">
                <div><b>Finishing Notes:</b> ${finishing ? escapeHtml(finishing) : '—'}</div>
                <div><b>Sealing Notes:</b> ${sealing ? escapeHtml(sealing) : '—'}</div>
            </div>
        </div>`;
    }).join('');
}

const SHOP_FOLDER_COVER_CSS = `
@page { size: letter portrait; margin: 0.5in; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; color: #000; font-size: 10pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; line-height: 1.35; }
.cv-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14pt; }
.cv-status { display: inline-block; padding: 4pt 14pt; border-radius: 999px; font-size: 10pt; font-weight: 700; letter-spacing: 0.3pt; background: #b91c1c; color: #fff; }
.cv-status.cv-status-kicked-off  { background: #1e40af; }
.cv-status.cv-status-releasability { background: #b45309; }
.cv-status.cv-status-approved      { background: #166534; }
.cv-status.cv-status-in-production { background: #5b21b6; }
.cv-status.cv-status-shipped       { background: #0f766e; }
.cv-status.cv-status-closed-out    { background: #475569; }
.cv-brand { font-size: 22pt; font-weight: 800; letter-spacing: 1pt; }
.cv-meta { display: flex; gap: 24pt; margin-bottom: 10pt; }
.cv-meta-col { flex: 1; display: grid; grid-template-columns: 10em 1fr; row-gap: 3pt; column-gap: 6pt; }
.cv-meta-col .cv-value { font-weight: 700; }
.cv-meta-col .cv-value.cv-multiline { white-space: pre-wrap; }
.sf-section-bar { background: #e5e7eb; color: #000; padding: 4pt 8pt; font-size: 11pt; font-weight: 700; letter-spacing: 0.3pt; text-transform: uppercase; margin: 6pt 0 6pt 0; }
.sf-colors { display: flex; flex-direction: column; gap: 8pt; margin-bottom: 8pt; }
.sf-color { border: 0.75pt solid #cbd5e1; border-radius: 3pt; padding: 6pt 9pt; break-inside: avoid; }
.sf-color-head { font-size: 12pt; font-weight: 700; margin-bottom: 3pt; }
.sf-color-row { display: flex; flex-wrap: wrap; gap: 4pt 20pt; font-size: 10pt; margin-bottom: 4pt; }
.sf-notes { font-size: 9.5pt; }
.sf-notes > div { margin-top: 2pt; white-space: pre-wrap; }
.sf-color-empty { font-size: 10pt; color: #6b7280; font-style: italic; margin-bottom: 6pt; }
.sf-title { background: #111827; color: #fff; text-align: center; padding: 6pt 8pt; font-size: 13pt; font-weight: 700; letter-spacing: 0.4pt; text-transform: uppercase; margin: 8pt 0 4pt 0; }
.sf-sub { text-align: center; font-size: 9pt; color: #374151; margin-bottom: 18pt; }
.sf-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.45in 0.2in; justify-items: center; margin-top: 8pt; }
.sf-cell { display: flex; flex-direction: column; align-items: center; gap: 8pt; break-inside: avoid; }
.sf-label { font-size: 11pt; font-weight: 700; text-align: center; max-width: 1.4in; line-height: 1.2; }
.sf-circle { width: 1in; height: 1in; border: 1.5pt solid #000; border-radius: 50%; }
.sf-empty { text-align: center; color: #6b7280; font-style: italic; margin-top: 24pt; }
`;

function buildShopFolderCoverHtml(f, phases, colorLogs) {
    const statusCls = f.status ? `cv-status-${statusSlug(f.status)}` : '';
    const statusText = f.status || 'No Status';
    const projectAddrLines = f.project_address ? escapeHtml(f.project_address).replace(/\n/g, '<br>') : '';

    // Tracking-column circles ("Post <column>") with fixed circles slotted in
    // before their anchor phase; unanchored/leftover fixed circles go at the end.
    const circleLabels = [];
    const placedFixed = new Set();
    for (const p of phases) {
        (SHOP_FOLDER_FIXED_BEFORE[p] || []).forEach(label => {
            circleLabels.push(label);
            placedFixed.add(label);
        });
        circleLabels.push(`Post ${shopFolderPhaseLabel(p)}`);
    }
    Object.values(SHOP_FOLDER_FIXED_BEFORE).flat().forEach(label => {
        if (!placedFixed.has(label)) circleLabels.push(label);
    });
    const circles = `<div class="sf-grid">${circleLabels.map(label => `
            <div class="sf-cell">
                <div class="sf-label">${escapeHtml(label)}</div>
                <div class="sf-circle"></div>
            </div>`).join('')}</div>`;

    return `<!doctype html><html><head><meta charset="utf-8"><title>Shop Folder Cover — ${escapeHtml(f.project_number || '')} ${escapeHtml(f.project_name || '')}</title><style>${SHOP_FOLDER_COVER_CSS}</style></head><body>
        <div class="cv-header">
            <span class="cv-status ${statusCls}">${escapeHtml(statusText)}</span>
            <span class="cv-brand">CWE</span>
        </div>
        <div class="cv-meta">
            <div class="cv-meta-col">
                <span class="cv-label">Project Name:</span><span class="cv-value">${escapeHtml(f.project_name)}</span>
                <span class="cv-label">Project #:</span><span class="cv-value">${escapeHtml(f.project_number)}</span>
                <span class="cv-label">PM:</span><span class="cv-value">${escapeHtml(f.pm)}</span>
            </div>
            <div class="cv-meta-col">
                <span class="cv-label">Date:</span><span class="cv-value">${escapeHtml(f.project_date)}</span>
                <span class="cv-label">Project Address:</span><span class="cv-value cv-multiline">${projectAddrLines}</span>
            </div>
        </div>
        <div class="sf-section-bar">Approved Color Information</div>
        <div class="sf-colors">${shopFolderColorInfoHtml(colorLogs)}</div>

        <div class="sf-title">Quality Control &mdash; Sticker Cover</div>
        <div class="sf-sub">Place a 1&quot; round QC sticker in each circle as its step is completed.</div>
        ${circles}
    </body></html>`;
}

/** Print a full HTML document via a hidden iframe (leaves the page untouched). */
function printHtmlInIframe(html, frameId, errLabel = 'print') {
    const prior = document.getElementById(frameId);
    if (prior) prior.remove();

    const iframe = document.createElement('iframe');
    iframe.id = frameId;
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(iframe);

    let cleaned = false;
    const cleanup = () => { if (cleaned) return; cleaned = true; setTimeout(() => iframe.remove(), 500); };

    iframe.addEventListener('load', () => {
        try {
            const win = iframe.contentWindow;
            win.addEventListener('afterprint', cleanup);
            win.focus();
            msFlushPendingStamp();
            win.print();
        } catch (err) {
            logger.error(`[project-portal] ${errLabel} failed:`, err);
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

async function handlePrintShopFolderCover() {
    if (!currentProjectNumber) {
        showToast('Save the project first', 'error');
        return;
    }
    if (!currentCastings.length) { try { currentCastings = await loadCastings(currentProjectNumber); } catch { /* ignore */ } }
    // One cover per casting: pick which castings get a folder now; the board's "Shop Folder Cover" goes green for them.
    const scoped = getCastingsForActivePhase();
    let ids = [];
    if (scoped.length) {
        ids = await openCastingPicker({
            title: 'Print Shop Folder Cover',
            hint: 'One cover prints per ticked casting. Those castings\' "Shop Folder Cover" turns green on the Releasability Board.',
            rows: scoped.map(c => ({ id: c.id, label: formatStickerCasting(c.casting_number), sub: (c.description || '').trim(), checked: msStatus(c.id, 'Shop Folder Cover') !== MS.GREEN || !msOn() })),
            confirmLabel: 'Print covers'
        });
        if (!ids) return;
    }
    const copies = Math.max(1, ids.length);
    // Ensure the project's color log(s) are loaded for the Approved Color section.
    try { await ensureColorLogsLoaded(); } catch (err) { logger.error('[project-portal] shop folder cover: color log load failed', err); }
    const fields = readCoverFields();
    const phases = TRACKING_PHASES.filter(p => currentTrackingPhases.has(p));
    const colorLogs = Array.isArray(currentColorLogs) ? currentColorLogs : [];
    let html = buildShopFolderCoverHtml(fields, phases, colorLogs);
    if (copies > 1) {
        const a = html.indexOf('<body>') + 6, b = html.lastIndexOf('</body>');
        const inner = html.slice(a, b);
        html = html.slice(0, a) + Array.from({ length: copies }, (_, i) => `<div style="${i < copies - 1 ? 'page-break-after:always' : ''}">${inner}</div>`).join('') + html.slice(b);
    }
    msArmStamp(ids, 'Shop Folder Cover');
    printHtmlInIframe(html, 'pp-shop-folder-print-frame', 'print shop folder cover');
    showToast(`Printing ${copies} cover${copies === 1 ? '' : 's'}.`);
}

// ---------- Print PM List (project list view) ----------
// Prints active projects — excluding shipped and closed-out jobs, and projects
// with no PM assigned — arranged into one column per project manager on an
// 11x17 portrait sheet. Uses the same hidden-iframe pattern as the cover-page
// print so the on-screen page is untouched.
const LIST_PRINT_EXCLUDED_STATUSES = new Set(['shipped', 'closed out']);

const LIST_PRINT_CSS = `
@page { size: 11in 17in; margin: 0.5in; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; color: #000; font-size: 15pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; line-height: 1.35; }
.pl-header { margin-bottom: 16pt; border-bottom: 2pt solid #1d4ed8; padding-bottom: 6pt; }
.pl-header h1 { font-size: 24pt; font-weight: 700; color: #1d4ed8; }
.pl-meta { font-size: 11pt; color: #555; margin-top: 3pt; }
.pl-grid { display: grid; gap: 0.35in; align-items: start; }
.pl-col { break-inside: avoid; }
.pl-col-head { font-size: 17pt; font-weight: 700; color: #fff; background: #1d4ed8; padding: 6pt 10pt; border-radius: 4pt; margin-bottom: 8pt; }
.pl-count { font-weight: 500; font-size: 13pt; opacity: 0.85; }
.pl-list { list-style: none; }
.pl-proj { padding: 6pt 1pt; border-bottom: 0.5pt solid #e2e8f0; break-inside: avoid; font-size: 19pt; font-weight: 600; }
`;

function buildListPrintHtml(rows) {
    // Group by PM (rows are pre-filtered to those with a PM assigned).
    const groups = new Map();
    rows.forEach(r => {
        const pm = (r.pm || '').trim();
        if (!groups.has(pm)) groups.set(pm, []);
        groups.get(pm).push(r);
    });

    // PM columns alphabetical.
    const pmNames = Array.from(groups.keys()).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' }));

    // Within a column, order by portal creation order (earliest first). ISO
    // created_at strings sort chronologically as plain strings. Rows missing a
    // created_at sort to the end, tie-broken by project number.
    pmNames.forEach(pm => {
        groups.get(pm).sort((a, b) => {
            const at = a.created_at || '';
            const bt = b.created_at || '';
            if (at && bt) {
                if (at < bt) return -1;
                if (at > bt) return 1;
            } else if (at !== bt) {
                return at ? -1 : 1;
            }
            return (a.project_number || '').localeCompare(
                b.project_number || '', undefined, { numeric: true, sensitivity: 'base' });
        });
    });

    const columnsHtml = pmNames.map(pm => {
        const list = groups.get(pm);
        const items = list.map(r => `
                <li class="pl-proj">${escapeHtml(r.project_name || '')}</li>`).join('');
        return `
            <div class="pl-col">
                <div class="pl-col-head">${escapeHtml(pm)} <span class="pl-count">(${list.length})</span></div>
                <ul class="pl-list">${items}</ul>
            </div>`;
    }).join('');

    const printedOn = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Projects by PM</title>
<style>${LIST_PRINT_CSS}</style>
</head>
<body>
    <div class="pl-header">
        <h1>Active Projects by PM</h1>
        <div class="pl-meta">Excludes shipped &amp; closed out &middot; ${rows.length} project(s) &middot; ${escapeHtml(printedOn)}</div>
    </div>
    <div class="pl-grid" style="grid-template-columns: repeat(${pmNames.length}, 1fr);">
        ${columnsHtml}
    </div>
</body>
</html>`;
}

function handlePrintList() {
    const rows = allProjectRows.filter(r =>
        (r.pm || '').trim() &&
        !LIST_PRINT_EXCLUDED_STATUSES.has((r.status || '').toLowerCase()));

    if (rows.length === 0) {
        showToast('No projects to print', 'error');
        return;
    }

    const html = buildListPrintHtml(rows);

    const prior = document.getElementById('pp-list-print-frame');
    if (prior) prior.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'pp-list-print-frame';
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
            msFlushPendingStamp();
            win.print();
        } catch (err) {
            logger.error('[project-portal] print list failed:', err);
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

// ---------- Print Folder Labels (Project Info) ----------
// One adhesive label per selected casting for the project folder. Same label
// stock as the tracking stickers (4in x 0.75in): project name + casting # on
// top, color log name below.

const FOLDER_LABEL_CSS = `
@page { size: 4in 0.75in; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; color: #000; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.fl-label {
    width: 4in;
    height: 0.75in;
    overflow: hidden;
    page-break-after: always;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    /* Top padding keeps the first line clear of printer clipping at the label edge */
    padding: 0.08in 0.1in 0;
    text-align: center;
}
.fl-label:last-child { page-break-after: auto; }
.fl-head { font-weight: bold; font-size: 12pt; letter-spacing: 0.01em; line-height: 1.1; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fl-color { font-size: 13pt; line-height: 1.1; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 0.03in; }
.fl-color.fl-empty { color: #666; font-style: italic; font-size: 10pt; }
.fl-count { font-size: 10pt; font-weight: normal; font-style: normal; color: #333; }
`;

// Single color-log name to print for a casting: the most-common color log among
// its components, else the project's active log (see getActiveBatchColorLog).
function folderLabelColorName(casting) {
    const log = getActiveBatchColorLog(casting, null);
    return (log?.name || '').trim();
}

function buildFolderLabelHtml(castings, projectName) {
    const cleanProject = (projectName || '').trim().replace(/\s*\n\s*/g, ' ') || 'PROJECT NAME';
    const labels = castings.map(c => {
        const castLabel = formatStickerCasting(c.casting_number);
        const colorName = folderLabelColorName(c);
        const compCount = (currentCastingComponents.get(c.id) || []).length;
        const countHtml = compCount > 0 ? ` <span class="fl-count">(${compCount} Pcs)</span>` : '';
        const colorHtml = colorName
            ? `<div class="fl-color">${escapeHtml(colorName)}${countHtml}</div>`
            : `<div class="fl-color fl-empty">No color log${countHtml}</div>`;
        return `
            <div class="fl-label">
                <div class="fl-head">${escapeHtml(cleanProject)} : ${escapeHtml(castLabel)}</div>
                ${colorHtml}
            </div>
        `;
    }).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><title>Folder Labels — ${escapeHtml(cleanProject)}</title><style>${FOLDER_LABEL_CSS}</style></head><body>
        ${labels}
    </body></html>`;
}

async function openPrintLabelModal() {
    if (!currentProjectNumber) {
        showToast('Save the project first', 'error');
        return;
    }
    const modal = document.getElementById('pp-print-label-modal');
    const list  = document.getElementById('pp-print-label-list');
    const allCb = document.getElementById('pp-print-label-all');
    if (!modal || !list) return;

    // The user can open this straight from the Info tab, so make sure the data
    // the labels need is loaded + fresh: color logs (names may have changed) and
    // each casting's components (drive the per-casting color resolution).
    try {
        await refreshBatchColorLogs();
        if (!currentCastings || currentCastings.length === 0) {
            currentCastings = await loadCastings(currentProjectNumber);
        }
        const ids = (currentCastings || []).map(c => c.id);
        if (ids.length > 0) {
            currentCastingComponents = await loadAllComponentsForProject(ids);
        }
    } catch (err) {
        logger.error('[project-portal] print-label preload failed:', err);
    }

    const castings = currentCastings || [];
    if (castings.length === 0) {
        list.innerHTML = '<p class="pp-import-remakes-empty">No castings yet — add castings first.</p>';
    } else {
        list.innerHTML = castings.map(c => {
            const castLabel = formatStickerCasting(c.casting_number);
            const desc = (c.description || '').trim();
            const colorName = folderLabelColorName(c);
            return `<label class="pp-print-label-row">
                    <input type="checkbox" value="${escapeAttr(c.id)}" checked>
                    <span class="pp-pl-cast">${escapeHtml(castLabel)}${desc ? ` <span class="pp-pl-desc">${escapeHtml(desc)}</span>` : ''}</span>
                    <span class="pp-pl-color${colorName ? '' : ' pp-pl-color-empty'}">${escapeHtml(colorName || 'No color log')}</span>
                </label>`;
        }).join('');
    }
    if (allCb) allCb.checked = castings.length > 0;
    updatePrintLabelSubmitState();
    modal.hidden = false;
}

/**
 * Generic casting picker (2026-10-15): resolves with the ticked casting ids, or null on cancel.
 * rows: [{ id, label, sub, checked, disabled }]
 */
function openCastingPicker({ title = 'Pick castings', hint = '', rows = [], confirmLabel = 'Print' } = {}) {
    const modal = document.getElementById('pp-cast-pick-modal');
    const list = document.getElementById('pp-cast-pick-list');
    const allCb = document.getElementById('pp-cast-pick-all');
    const submit = document.getElementById('pp-cast-pick-submit');
    if (!modal || !list) return Promise.resolve(null);
    document.getElementById('pp-cast-pick-title').textContent = title;
    document.getElementById('pp-cast-pick-hint').textContent = hint;
    list.innerHTML = rows.length ? rows.map(r => `<label class="pp-print-label-row${r.disabled ? ' pp-print-label-row-off' : ''}">
            <input type="checkbox" value="${escapeAttr(r.id)}" ${r.checked && !r.disabled ? 'checked' : ''} ${r.disabled ? 'disabled' : ''}>
            <span class="pp-pl-cast">${escapeHtml(r.label)}</span>
            <span class="pp-pl-color${r.sub ? '' : ' pp-pl-color-empty'}">${escapeHtml(r.sub || '')}</span>
        </label>`).join('') : '<p class="pp-import-remakes-empty">No castings yet — add castings first.</p>';
    const boxes = () => [...list.querySelectorAll('input[type="checkbox"]:not(:disabled)')];
    const refresh = () => {
        const n = boxes().filter(b => b.checked).length;
        submit.disabled = n === 0;
        submit.textContent = n ? `${confirmLabel} (${n})` : confirmLabel;
        if (allCb) { const all = boxes(); allCb.checked = all.length > 0 && all.every(b => b.checked); allCb.disabled = all.length === 0; }
    };
    return new Promise(resolve => {
        const done = (v) => { modal.hidden = true; cleanup(); resolve(v); };
        const onList = () => refresh();
        const onAll = () => { boxes().forEach(b => { b.checked = allCb.checked; }); refresh(); };
        const onSubmit = () => done(boxes().filter(b => b.checked).map(b => b.value));
        const onCancel = () => done(null);
        const onBackdrop = (e) => { if (e.target === modal) done(null); };
        const onKey = (e) => { if (e.key === 'Escape') done(null); };
        const cleanup = () => {
            list.removeEventListener('change', onList); allCb?.removeEventListener('change', onAll);
            submit.removeEventListener('click', onSubmit); modal.removeEventListener('click', onBackdrop); document.removeEventListener('keydown', onKey);
            document.getElementById('pp-cast-pick-cancel')?.removeEventListener('click', onCancel);
            document.getElementById('pp-cast-pick-close')?.removeEventListener('click', onCancel);
        };
        list.addEventListener('change', onList); allCb?.addEventListener('change', onAll);
        submit.addEventListener('click', onSubmit); modal.addEventListener('click', onBackdrop); document.addEventListener('keydown', onKey);
        document.getElementById('pp-cast-pick-cancel')?.addEventListener('click', onCancel);
        document.getElementById('pp-cast-pick-close')?.addEventListener('click', onCancel);
        refresh();
        modal.hidden = false;
    });
}

function closePrintLabelModal() {
    const modal = document.getElementById('pp-print-label-modal');
    if (modal) modal.hidden = true;
}

function updatePrintLabelSubmitState() {
    const list   = document.getElementById('pp-print-label-list');
    const submit = document.getElementById('pp-print-label-submit');
    const allCb  = document.getElementById('pp-print-label-all');
    if (!list || !submit) return;
    const boxes = Array.from(list.querySelectorAll('input[type="checkbox"]'));
    const checked = boxes.filter(b => b.checked);
    submit.disabled = checked.length === 0;
    if (allCb) allCb.checked = boxes.length > 0 && checked.length === boxes.length;
}

async function handlePrintLabelConfirm() {
    const list = document.getElementById('pp-print-label-list');
    if (!list) return;
    const ids = Array.from(list.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
    if (ids.length === 0) return;
    if (!(await printGate(ids, 'Labels'))) return;
    msArmStamp(ids, 'Labels');
    const castings = ids
        .map(id => (currentCastings || []).find(c => c.id === id))
        .filter(Boolean);
    if (castings.length === 0) return;

    const projectName = (document.getElementById('pp-f-project_name')?.value || '').trim();
    const html = buildFolderLabelHtml(castings, projectName);
    closePrintLabelModal();

    const prior = document.getElementById('pp-folder-label-frame');
    if (prior) prior.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'pp-folder-label-frame';
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
            msFlushPendingStamp();
            win.print();
        } catch (err) {
            logger.error('[project-portal] print folder labels failed:', err);
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

    const truckNo = crateTruck(crate);
    return `<!doctype html><html><head><meta charset="utf-8"><title>Packing List — ${escapeHtml(crateDisplay(crate))} — ${escapeHtml(proj.project_number || '')}</title><style>${PACKING_PRINT_CSS}</style></head><body>
        <div class="pk-header">
            <div class="pk-title">PACKING LIST</div>
            <div class="pk-crate-num">${truckNo ? `TRUCK ${truckNo} · ` : ''}CRATE #${escapeHtml(crateNum(crate) || '—')}</div>
        </div>

        <div class="pk-meta">
            <div class="pk-meta-row"><span class="pk-label">Project #:</span><span class="pk-value">${escapeHtml(proj.project_number || '')}</span></div>
            <div class="pk-meta-row"><span class="pk-label">Project Name:</span><span class="pk-value">${escapeHtml(proj.project_name || '')}</span></div>
            ${phaseName ? `<div class="pk-meta-row"><span class="pk-label">Phase:</span><span class="pk-value">${escapeHtml(phaseName)}</span></div>` : ''}
            ${truckNo ? `<div class="pk-meta-row"><span class="pk-label">Truck:</span><span class="pk-value">${truckNo}</span></div>` : ''}
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

        <div class="pk-footer">${escapeHtml(crateDisplay(crate))} · Project ${escapeHtml(proj.project_number || '')} · ${memberCount} ${memberCount === 1 ? 'panel' : 'panels'}</div>
    </body></html>`;
}

function formatPackingDate(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return '';
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

/** Rows for one crate on a packing list (same columns as the crate sheet). */
function packingRowsHtml(members, qtyMode) {
    const memberColor = (comp) => resolveComponentColorName(comp);
    if (!members.length) return `<tr><td colspan="${qtyMode ? 4 : 6}" style="text-align:center;color:#94a3b8;padding:8pt;">No panels assigned to this crate.</td></tr>`;
    if (qtyMode) {
        const buckets = new Map();
        for (const { comp } of members) {
            const colorName = memberColor(comp);
            const key = [comp.type || '', comp.width || '', comp.length || '', colorName].join('||');
            if (!buckets.has(key)) buckets.set(key, { type: comp.type || '', width: comp.width || '', length: comp.length || '', color: colorName, count: 0 });
            buckets.get(key).count++;
        }
        return [...buckets.values()].sort((a, b) => (a.type || '').localeCompare(b.type || '') || (a.length || '').localeCompare(b.length || '') || (a.width || '').localeCompare(b.width || ''))
            .map((r, i) => `<tr><td class="pk-num">${i + 1}</td><td><strong>${escapeHtml(r.type)}</strong></td><td>${escapeHtml(r.color)}</td><td class="pk-num">${r.count}</td></tr>`).join('');
    }
    return members.map(({ comp, casting }, i) => `<tr><td class="pk-num">${i + 1}</td><td><strong>${escapeHtml(comp.panel_id || '')}</strong></td><td>${escapeHtml(casting?.casting_number ? `Cast ${casting.casting_number}` : '')}</td><td>${escapeHtml(comp.type || '')}</td><td>${escapeHtml(memberColor(comp))}</td><td class="pk-checkbox">☐</td></tr>`).join('');
}

function buildTruckPackingListHtml(truck, crates, membersByCrate, project) {
    const proj = project || {};
    const qtyMode = shipQtyModeGlobal;
    const phaseName = currentPhasesEnabled ? (currentPhases.find(p => p.id === currentPhaseId)?.phase_name || '') : '';
    const totalPanels = crates.reduce((n, c) => n + (membersByCrate.get(c.id) || []).length, 0);
    const thead = qtyMode
        ? `<tr><th style="width:0.4in;">#</th><th>Type</th><th>Color</th><th style="width:0.6in;text-align:center;">Qty</th></tr>`
        : `<tr><th style="width:0.4in;">#</th><th>Panel ID</th><th>Cast</th><th>Type</th><th>Color</th><th style="width:0.5in;text-align:center;">✓</th></tr>`;
    const sections = crates.map(crate => {
        const members = membersByCrate.get(crate.id) || [];
        const extras = [crate.weight ? `Weight ${crate.weight}` : '', crate.dimensions ? `Dimensions ${crate.dimensions}` : ''].filter(Boolean).join(' · ');
        return `<div class="pk-section-bar">CRATE #${escapeHtml(crateNum(crate))} — ${members.length} ${members.length === 1 ? 'panel' : 'panels'}${extras ? ' — ' + escapeHtml(extras) : ''}</div>
            <table class="pk-table"><thead>${thead}</thead><tbody>${packingRowsHtml(members, qtyMode)}</tbody></table>
            ${crate.notes ? `<div class="pk-notes-box">${escapeHtml(crate.notes)}</div>` : ''}`;
    }).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><title>Packing List — Truck ${truck} — ${escapeHtml(proj.project_number || '')}</title><style>${PACKING_PRINT_CSS}</style></head><body>
        <div class="pk-header">
            <div class="pk-title">PACKING LIST</div>
            <div class="pk-crate-num">TRUCK ${truck}</div>
        </div>
        <div class="pk-meta">
            <div class="pk-meta-row"><span class="pk-label">Project #:</span><span class="pk-value">${escapeHtml(proj.project_number || '')}</span></div>
            <div class="pk-meta-row"><span class="pk-label">Project Name:</span><span class="pk-value">${escapeHtml(proj.project_name || '')}</span></div>
            ${phaseName ? `<div class="pk-meta-row"><span class="pk-label">Phase:</span><span class="pk-value">${escapeHtml(phaseName)}</span></div>` : ''}
            <div class="pk-meta-row"><span class="pk-label">Crates:</span><span class="pk-value">${crates.map(c => '#' + crateNum(c)).join(', ')}</span></div>
            <div class="pk-meta-row"><span class="pk-label">Panel Count:</span><span class="pk-value">${totalPanels}</span></div>
            <div class="pk-meta-row"><span class="pk-label">Delivery Address:</span><span class="pk-value">${proj.delivery_address ? escapeHtml(proj.delivery_address).replace(/\n/g, '<br>') : ''}</span></div>
            <div class="pk-meta-row"><span class="pk-label">Date:</span><span class="pk-value">${escapeHtml(formatPackingDate(new Date()))}</span></div>
        </div>
        ${sections}
        <div class="pk-footer">Truck ${truck} · Project ${escapeHtml(proj.project_number || '')} · ${crates.length} ${crates.length === 1 ? 'crate' : 'crates'} · ${totalPanels} ${totalPanels === 1 ? 'panel' : 'panels'}</div>
    </body></html>`;
}

async function handlePrintTruckPackingList(truck) {
    if (!currentProjectNumber) { showToast('Save the project first', 'error'); return; }
    const crates = sortCrates(getCratesForActivePhase().filter(c => crateTruck(c) === Number(truck)));
    if (!crates.length) return;
    if (!currentColorLog) {
        try { currentColorLog = (await loadColorLogForProject(currentProjectNumber)) || createEmptyColorLog(); }
        catch (err) { logger.error('[project-portal] color-log load failed for truck packing list:', err); currentColorLog = createEmptyColorLog(); }
    }
    const membersByCrate = new Map(crates.map(c => [c.id, []]));
    for (const casting of currentCastings) {
        for (const comp of getComponentsFor(casting.id)) if (comp.crate_id && membersByCrate.has(comp.crate_id)) membersByCrate.get(comp.crate_id).push({ comp, casting });
    }
    let project = null;
    try { project = await loadProject(currentProjectNumber); } catch (err) { logger.warn('[project-portal] loadProject for truck packing list failed:', err); }
    if (!project) project = { project_number: currentProjectNumber };
    printHtmlInIframe(buildTruckPackingListHtml(truck, crates, membersByCrate, project), 'pp-packing-print-frame', 'truck packing list');
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
            msFlushPendingStamp();
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

    const stagedCells = optStagedCells(String(num)).filter(c => c.hours != null || c.taskName);
    if (stagedCells.some(c => Number(c.hours) > 0)) {
        phases = stagedCells.map(c => ({ phase_name: `${c.department} · Day ${c.day}${c.taskName ? ' · ' + c.taskName.toLowerCase() : ''}`, hours: Number(c.hours) || 0, description: c.description }));
    }
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
            msFlushPendingStamp();
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
/* Fixed pt min-height (NOT vh) so each ticket fills the printable area exactly without
   the cross-page rendering bugs that vh+flex caused. Letter portrait minus 0.3in
   margins = ~748pt printable; we use 745pt for a touch of safety against rounding.
   min-height (not height) so an unusually tall ticket grows the colored border with
   its content instead of letting the footer paint over the bottom border. */
.bt-page {
    page-break-after: always;
    page-break-inside: avoid;
    break-after: page;
    break-inside: avoid;
    padding: 12pt 14pt;
    border: 6pt solid #ccc;
    min-height: 745pt;
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
.bt-title-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12pt; }
.bt-stamps { text-align: right; flex: 0 0 auto; }
.bt-stamp-printed { font-size: 18pt; font-weight: 900; color: #dc2626; letter-spacing: 0.5pt; line-height: 1.1; }
.bt-stamp-batched { font-size: 13pt; font-weight: 800; color: #15803d; letter-spacing: 0.5pt; }
.bt-type-banner { font-size: 11pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5pt; margin-bottom: 6pt; }
.batch-ticket.bt-face .bt-type-banner { color: #f97316; }
.batch-ticket.bt-firstBackUp .bt-type-banner { color: #3b82f6; }
.batch-ticket.bt-finalBackUp .bt-type-banner { color: #ca8a04; }
.bt-header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin-bottom: 4pt; }
.bt-hrow { display: flex; align-items: baseline; padding: 2pt 0; border-bottom: 0.75pt solid #000; }
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
.bt-section-label { font-weight: 700; font-size: 9.5pt; text-transform: uppercase; letter-spacing: 0.8pt; padding: 3pt 0 1.5pt; border-bottom: 1pt solid #000; margin-top: 2pt; }
.bt-table { width: 100%; border-collapse: collapse; margin-bottom: 2pt; }
.bt-table td { font-size: 10pt; padding: 2pt 4pt; border-bottom: 0.5pt solid #d4d4d4; vertical-align: baseline; }
.bt-table .bt-label { font-weight: 700; width: 22%; white-space: nowrap; }
.bt-table .bt-type { width: 40%; }
.bt-table .bt-qty-label { font-weight: 700; width: 8%; text-align: right; }
.bt-table .bt-qty { width: 18%; text-align: right; font-style: italic; }
.bt-table .bt-unit { width: 12%; padding-left: 4pt; }
.bt-notes-title { font-size: 9.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5pt; margin-top: 6pt; margin-bottom: 2pt; }
.bt-notes { border: 1pt solid #000; padding: 6pt 8pt; flex: 0 0 auto; min-height: 28pt; font-size: 10pt; line-height: 1.4; white-space: pre-wrap; }
/* Footer: handwrite mix conditions (left) + slump test (right). flex: 1 lets it
   absorb leftover vertical space so each ticket still fills its fixed-height page. */
.bt-footer { display: grid; grid-template-columns: 1fr auto; gap: 10pt; margin-top: 8pt; padding-right: 10pt; align-items: start; flex: 1 1 auto; }
.bt-cond-row { display: flex; align-items: baseline; gap: 8pt; padding: 12pt 0 5pt; }
.bt-cond-label { font-size: 10pt; font-weight: 700; white-space: nowrap; min-width: 66pt; }
.bt-cond-line { flex: 0 0 100pt; border-bottom: 1pt solid #000; height: 14pt; }
.bt-cond-line-sm { flex: 0 0 34pt; }
.bt-cond-unit { font-size: 9pt; font-weight: 700; }
.bt-cond-slash { font-size: 11pt; font-weight: 700; }
.bt-footer-right { text-align: center; }
.bt-slump-wrap { display: flex; align-items: center; justify-content: center; gap: 10pt; }
.bt-slump-svg { width: 1.7in; height: 1.7in; display: block; flex: 0 0 auto; }
.bt-slump-side { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 12pt; }
.bt-slump-readout { display: flex; gap: 18pt; align-items: flex-start; }
.bt-readout { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.05; }
.bt-readout-label { font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1pt; }
.bt-readout-val { font-size: 34pt; font-weight: 800; color: #ea580c; line-height: 1; display: flex; align-items: flex-end; gap: 3pt; }
.bt-readout-actual { color: #000; font-weight: 700; }
.bt-readout-blank { width: 44pt; height: 30pt; border-bottom: 1.5pt solid #000; }
.bt-passfail { display: flex; flex-direction: column; gap: 10pt; }
.bt-pf { display: flex; align-items: center; gap: 12pt; font-size: 13pt; font-weight: 700; }
.bt-pf-text { min-width: 42pt; }
.bt-slump-fields { display: flex; flex-direction: column; gap: 12pt; }
.bt-slump-field { display: flex; align-items: baseline; gap: 8pt; }
.bt-slump-field-label { font-size: 10.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5pt; min-width: 34pt; }
.bt-time-input { display: inline-flex; align-items: baseline; gap: 4pt; }
.bt-time-blank { width: 26pt; border-bottom: 1pt solid #000; height: 16pt; }
.bt-time-colon { font-size: 15pt; font-weight: 800; }
`;

async function handlePrintBatchTickets(castingId) {
    if (!currentCastings.find(c => c.id === castingId)) return;
    if (!(await printGate([castingId], 'Batching Sheets'))) return;
    if (handlePrintBatchTicketsNow(castingId) !== false) stampPrinted([castingId], 'Batching Sheets');
}
function handlePrintBatchTicketsNow(castingId) {
    const casting = currentCastings.find(c => c.id === castingId);
    if (!casting) return false;
    const list = getBatchTicketList(castingId);

    // Print every color ticket that yields batches; each plan restarts numbering.
    const printable = [];
    for (const ticket of list) {
        const activeLog = getActiveBatchColorLog(casting, ticket);
        const sandLbs = getColorLogSandLbs(activeLog);
        if (!sandLbs) continue;
        const plan = buildBatchPlan({
            totalCuFt: parseFloat(ticket.cuFt) || 0,
            faceSqFt: parseFloat(ticket.faceSqFt) || 0,
            cuFtPer250: parseFloat(ticket.cuFtPer250) || 4.28,
            castMethod: activeLog?.castMethod || 'sprayUp',
            colorLogSandLbs: sandLbs,
            manualOverrides: btOverrides(ticket)
        });
        if (!plan.batches.length) continue;
        printable.push({ ticket, activeLog, plan });
    }

    if (!printable.length) {
        // Keep the single-ticket error behavior, judged against the active ticket.
        const ticket = getBatchTicketFor(castingId);
        const activeLog = getActiveBatchColorLog(casting, ticket);
        if (!getColorLogSandLbs(activeLog)) {
            showToast('Add a sand entry to the color log first', 'error');
        } else {
            showToast('Enter Total Cu Ft to generate tickets', 'error');
        }
        return false;
    }

    const projectName = document.getElementById('pp-f-project_name')?.value || '';

    const pages = printable.map(({ ticket, activeLog, plan }) => {
        const sampleName = activeLog?.name || '';
        const castMethod = activeLog?.castMethod || '';
        // Pigment reduction (final backup, and optionally first backup) — without
        // these, renderBatchTicketCard() falls back to its defaults and the
        // printed tickets show un-reduced pigment values even though the on-screen
        // preview applies the reduction.
        const pigReductionPct = parsePigReduction(ticket.pigReduction);
        const reduceFirstBackup = !!ticket.pigReduceFirstBackup;
        const omitAggFinalBackup = !!ticket.omitAggFinalBackup;
        const omitFibersFace = !!ticket.omitFibersFace;
        const cowbayFinalBackup = !!ticket.cowbayFinalBackup;

        const printedOn = new Date();
        const batchedOn = btImportStamp(ticket)?.importedAt || null;
        return plan.batches.map(b => `
        <div class="bt-page bt-${b.type}">
            ${renderBatchTicketCard({
                printedOn, batchedOn,
                colorLog: activeLog,
                batch: b,
                project: projectName,
                sampleName,
                castMethod,
                castNumber: casting.casting_number || '',
                castDate: casting.casting_date || '',
                colorName: ticket.colorLogId ? (activeLog?.name || '') : '',
                batchedBy: ticket.batchedBy,
                notes: ticket.notes,
                pigReductionPct,
                reduceFirstBackup,
                omitAggFinalBackup,
                omitFibersFace,
                cowbayFinalBackup,
                // Project-wide slump target for this batch's type — mirror the on-screen
                // preview (renderBatchTicketCards) so print isn't stuck on the 5" default.
                targetSlump: clampSlumpTarget(currentSlumpTargets[b.type])
            })}
        </div>
    `).join('');
    }).join('');

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

/** The color logs a casting uses, from its Casting Inventory rows (in row order, no repeats). */
function castingColorLogs(castingId) {
    const out = [];
    for (const it of getInventoryFor(castingId)) {
        if (!it.color_log_id || out.some(l => l.id === it.color_log_id)) continue;
        const log = getColorLogByIdSync(it.color_log_id);
        if (log) out.push(log);
    }
    return out;
}
async function handlePrintColorLog() {
    if (!currentColorLog) {
        showToast('No color log to print', 'error');
        return;
    }
    if (!currentCastings.length && currentProjectNumber) { try { currentCastings = await loadCastings(currentProjectNumber); } catch { /* ignore */ } }
    if (currentCastingInventoryLoadedFor !== currentProjectNumber) { try { await loadAllInventoryForCurrentProject(); } catch { /* ignore */ } }
    const projectNumber = currentProjectNumber || '';
    const projectName = document.getElementById('pp-f-project_name')?.value || '';
    const scoped = getCastingsForActivePhase();
    const withLogs = scoped.map(c => ({ c, logs: castingColorLogs(c.id) }));
    const anyColor = withLogs.some(x => x.logs.length);

    // Pick the castings: each prints its own color log(s) as read from the Casting Inventory, one copy per casting
    // and color; the board's "Color Log" turns green for the printed castings.
    let pages = [], ids = [], copies = 0;
    if (anyColor) {
        const picked = await openCastingPicker({
            title: 'Print Color Log',
            hint: 'One color log prints per ticked casting (two for a two-color casting), taken from each casting\'s inventory. Those castings\' "Color Log" turns green on the Releasability Board.',
            rows: withLogs.map(x => ({ id: x.c.id, label: formatStickerCasting(x.c.casting_number), sub: x.logs.length ? x.logs.map(l => l.name || '(unnamed)').join(' + ') : 'no color in the inventory',
                                        checked: x.logs.length > 0 && (!msOn() || msStatus(x.c.id, 'Color Log') !== MS.GREEN), disabled: !x.logs.length })),
            confirmLabel: 'Print color logs'
        });
        if (!picked) return;
        for (const x of withLogs) {
            if (!picked.includes(x.c.id)) continue;
            for (const log of x.logs) {
                pages.push(buildColorLogPrintHtml(log, projectNumber, `${getCurrentProjectDisplay()} — Cast ${x.c.casting_number || ''}`));
                copies += 1;
            }
            ids.push(x.c.id);
        }
        if (!pages.length) { showToast('Nothing to print — the ticked castings have no color in their inventory.', 'error'); return; }
    } else {
        // No casting has a color yet: print the log on screen once, as before (nothing to mark on the board).
        pages = [buildColorLogPrintHtml(currentColorLog, projectNumber, getCurrentProjectDisplay())];
        copies = 1;
    }
    const titleParts = ['Color Log', anyColor ? `${copies} ${copies === 1 ? 'copy' : 'copies'}` : (currentColorLog.name || ''), projectName || projectNumber].filter(Boolean).join(' — ');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(titleParts)}</title><style>${COLOR_LOG_PRINT_CSS}</style></head><body>${pages.join('')}<script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),200);});<\/script></body></html>`;

    const w = window.open('', '_blank');
    if (!w) {
        showToast('Pop-up blocked — allow pop-ups for printing', 'error');
        return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    if (ids.length) stampPrinted(ids, 'Color Log');
    if (anyColor) showToast(`Printing ${copies} color log${copies === 1 ? '' : 's'} for ${ids.length} casting${ids.length === 1 ? '' : 's'}.`);
}

// ---------- Bootstrap ----------

async function init() {
    wireEvents();
    registerRefreshHandler(handleLiveRefresh);
    document.addEventListener('focusout', () => { if (liveReloadPending.size) armLiveReloadRetry(); });
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
