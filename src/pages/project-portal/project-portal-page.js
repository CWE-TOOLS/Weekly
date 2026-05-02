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
    createEmptyProject
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
    setCastingPhaseOrder,
    replaceCastingPhases,
    seedDefaultPhasesForCasting
} from '../../services/optimizer-hours-service.js';
import {
    loadAllComponentsForProject,
    createComponent,
    updateComponent,
    deleteComponent,
    setComponentsOrder
} from '../../services/tracking-service.js';
import {
    loadColorLogForProject,
    saveColorLogForProject,
    loadPresets as loadColorLogPresets,
    saveAsPreset as saveColorLogAsPreset
} from '../../services/color-log-service.js';
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

const STATUS_SORT_ORDER = {
    'not approved': 0,
    'pending': 1,
    'approved': 2,
    'on hold': 3,
    'closed': 4
};

const FORM_FIELDS = [
    'project_number', 'project_name', 'status', 'pm', 'project_date', 'project_address',
    'estimator', 'architect',
    'contact_name', 'contact_phone', 'contact_company', 'contact_email',
    'site_contact', 'site_phone', 'delivery_address', 'site_restrictions',
    'need_by_date', 'production_start_date',
    'scope_of_work', 'imperative_information'
];

let allProjectRows = [];           // From Supabase
let currentProjectNumber = null;     // null = list view; string = form view
let listSort = { column: 'updated_at', direction: 'desc' };
let currentTab = 'info';             // 'info' | 'castings' | 'optimizer' | 'tracking'
let currentCastings = [];            // loaded for current project
let currentOptCastingId = null;            // active casting in optimizer tab
let currentCastingPhases = new Map();      // castingId -> Array<phase row>
let copiedPhases = null;                   // Array<{phase_name, hours, sort_order}> from a copy action
let currentTrackExpanded = new Set();      // castingIds whose tracking sections are open
let currentCastingComponents = new Map();  // castingId -> Array<component row>
let currentColorLog = null;                // form-shaped record (id null = unsaved)
let colorLogPresets = [];                  // cached preset rows
let colorLogSaveTimer = null;              // debounce timer
let colorLogLoadedFor = null;              // project_number we last loaded for
let batchTickets = new Map();              // castingId -> form-shaped batch ticket record
let batchTicketsLoadedFor = null;          // project_number we last bulk-loaded for
let currentBatchCastingId = null;          // active casting in batch tickets tab
let batchTicketSaveTimers = new Map();     // castingId -> debounce handle

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

async function showListView() {
    // Flush any pending color-log save before leaving the form view.
    if (colorLogSaveTimer) {
        clearTimeout(colorLogSaveTimer);
        colorLogSaveTimer = null;
        try { await saveColorLogNow(); } catch (e) { /* error already logged */ }
    }
    // Flush all pending batch-ticket saves.
    await flushAllBatchTicketSaves();
    currentProjectNumber = null;
    document.getElementById('pp-list-view').hidden = false;
    document.getElementById('pp-form-view').hidden = true;
    setProjectInUrl(null);
    colorLogLoadedFor = null;
    currentColorLog = null;
    batchTicketsLoadedFor = null;
    batchTickets.clear();
    currentBatchCastingId = null;
    await refreshList();
}

async function showFormView(projectNumber, draftOverrides = null) {
    currentProjectNumber = projectNumber || null;
    document.getElementById('pp-list-view').hidden = true;
    document.getElementById('pp-form-view').hidden = false;
    setProjectInUrl(projectNumber);

    // Invalidate color-log cache so we reload for the new project on next tab activation.
    colorLogLoadedFor = null;
    currentColorLog = null;
    if (colorLogSaveTimer) { clearTimeout(colorLogSaveTimer); colorLogSaveTimer = null; }

    // Invalidate batch-ticket cache.
    batchTicketsLoadedFor = null;
    batchTickets.clear();
    currentBatchCastingId = null;
    for (const t of batchTicketSaveTimers.values()) clearTimeout(t);
    batchTicketSaveTimers.clear();

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

    document.getElementById('pp-f-project_number').readOnly = isExisting;
    document.getElementById('pp-delete-btn').hidden = !isExisting;

    updateFormContext(project);
    setActiveTab(currentTab);

    if (projectNumber) {
        await loadAndRenderCastings();
    } else {
        currentCastings = [];
        renderCastings();
    }

    // If the user is already on the Color Log tab, refresh it for the new project.
    if (currentTab === 'color-log') {
        activateColorLogTab();
    }
    if (currentTab === 'batch-tickets') {
        activateBatchTicketsTab();
    }
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
    currentTab = tab;
    document.querySelectorAll('.pp-tab-btn').forEach(btn => {
        btn.classList.toggle('pp-tab-active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.pp-tab-panel').forEach(panel => {
        const isActive = panel.dataset.panel === tab;
        panel.classList.toggle('pp-tab-panel-active', isActive);
        panel.hidden = !isActive;
    });
    const printBtn = document.getElementById('pp-print-btn');
    if (printBtn) printBtn.textContent = (tab === 'batch-tickets') ? 'Print Batch Tickets' : 'Print';
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
    allProjectRows = projects.map(p => ({
        ...p,
        opt_ship_date: shipDateByProject.get(String(p.project_number || '').trim()) || ''
    }));
}

function buildShipDateMap(tasks) {
    const out = new Map();
    if (!Array.isArray(tasks)) return out;
    for (const t of tasks) {
        const num = String(t?.projectNumber || '').trim();
        if (!num) continue;
        const dept = String(t?.department || '').trim().toLowerCase();
        if (!dept.startsWith('ship')) continue;
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

async function refreshList() {
    const tbody = document.getElementById('pp-list-tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="pp-empty">Loading projects...</td></tr>';

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
        tbody.innerHTML = '<tr><td colspan="7" class="pp-empty">No projects yet. Click "+ New Project" to get started.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(row => {
        const status = row.status ? `<span class="pp-status-pill pp-status-${slug(row.status)}">${escapeHtml(row.status)}</span>` : '';
        return `
            <tr class="pp-row-clickable" data-project-number="${escapeAttr(row.project_number)}">
                <td class="pp-cell-num"><strong>${escapeHtml(row.project_number)}</strong></td>
                <td>${escapeHtml(row.project_name || '')}</td>
                <td>${escapeHtml(row.pm || '')}</td>
                <td>${status}</td>
                <td>${escapeHtml(row.estimator || '')}</td>
                <td>${escapeHtml(row.need_by_date || '')}</td>
                <td>${escapeHtml(row.opt_ship_date || '')}</td>
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
}

function applyStatusColor() {
    const sel = document.getElementById('pp-f-status');
    if (!sel) return;
    const states = ['pp-status-approved', 'pp-status-not-approved', 'pp-status-pending', 'pp-status-on-hold', 'pp-status-closed'];
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
    return out;
}

async function handleSave() {
    const record = readForm();
    if (!record.project_number) {
        showToast('Project # is required.', 'error');
        return;
    }
    try {
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
        showToast('Saved.');
    } catch (err) {
        logger.error('[project-portal] save failed:', err);
        showToast('Save failed: ' + (err.message || err), 'error');
    }
}

async function handleDelete() {
    if (!currentProjectNumber) return;
    if (!confirm(`Delete project ${currentProjectNumber}? This cannot be undone.`)) return;
    try {
        await deleteProject(currentProjectNumber);
        showToast('Deleted.');
        await showListView();
    } catch (err) {
        logger.error('[project-portal] delete failed:', err);
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
        renderCastings();
        return;
    }
    try {
        currentCastings = await loadCastings(currentProjectNumber);
    } catch (err) {
        logger.error('[project-portal] loadCastings failed:', err);
        currentCastings = [];
    }
    renderCastings();
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

    if (currentCastings.length === 0) {
        list.hidden = true;
        empty.hidden = false;
        list.innerHTML = '';
        return;
    }

    list.hidden = false;
    empty.hidden = true;
    list.innerHTML = currentCastings.map(c => `
        <div class="pp-cast-card" data-casting-id="${escapeAttr(c.id)}">
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
            <div class="pp-cast-card-actions">
                <button class="pp-row-btn pp-row-btn-save" data-action="save" type="button">Save</button>
                <button class="pp-row-btn pp-row-btn-delete" data-action="delete" type="button" aria-label="Delete casting" title="Delete casting">&times;</button>
            </div>
        </div>
    `).join('');

    ensureCastingsSortable();
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

function handleAddCastingClick() {
    if (!currentProjectNumber) return;
    const list = document.getElementById('pp-castings-list');
    const empty = document.getElementById('pp-castings-empty');
    if (!list) return;

    // Cancel any existing draft
    list.querySelector('.pp-cast-card[data-draft="true"]')?.remove();

    list.hidden = false;
    empty.hidden = true;

    const card = document.createElement('div');
    card.className = 'pp-cast-card pp-cast-card-draft';
    card.dataset.draft = 'true';
    card.innerHTML = `
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
    `;
    list.appendChild(card);

    const numInput = card.querySelector('input[data-field="casting_number"]');
    const descInput = card.querySelector('input[data-field="description"]');

    const suggested = suggestNextCastingNumber(currentCastings);
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
        if (currentCastings.some(c => (c.casting_number || '').toLowerCase() === num.toLowerCase())) {
            showToast('That casting # already exists for this project.', 'error');
            numInput.focus();
            return;
        }
        try {
            const created = await createCasting({
                project_number: currentProjectNumber,
                casting_number: num,
                description: desc
            });
            if (created) currentCastings.push(created);
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

async function handleSaveCasting(id) {
    const card = document.querySelector(`.pp-cast-card[data-casting-id="${id}"]`);
    if (!card) return;
    const numInput = card.querySelector('input[data-field="casting_number"]');
    const descInput = card.querySelector('input[data-field="description"]');
    const num = numInput.value.trim();
    const desc = descInput.value.trim();
    if (!num) {
        showToast('Casting # cannot be empty.', 'error');
        numInput.focus();
        return;
    }
    try {
        const updated = await updateCasting(id, { casting_number: num, description: desc });
        if (updated) {
            const idx = currentCastings.findIndex(c => c.id === id);
            if (idx !== -1) currentCastings[idx] = updated;
        }
        showToast('Casting saved.');
    } catch (err) {
        logger.error('[project-portal] save casting failed:', err);
        const msg = (err.code === '23505') ? 'That casting # already exists.' : (err.message || 'Save failed');
        showToast(msg, 'error');
    }
}

async function handleDeleteCasting(id) {
    const c = currentCastings.find(x => x.id === id);
    if (!c) return;
    if (!confirm(`Delete casting ${c.casting_number}?`)) return;
    try {
        await deleteCasting(id);
        currentCastings = currentCastings.filter(x => x.id !== id);
        if (currentOptCastingId === id) {
            currentOptCastingId = currentCastings[0]?.id || null;
            currentOptHours = new Map();
        }
        renderCastings();
        showToast('Casting deleted.');
    } catch (err) {
        logger.error('[project-portal] delete casting failed:', err);
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

    if (currentCastings.length === 0) {
        noCastings.hidden = false;
        editor.hidden = true;
        return;
    }
    noCastings.hidden = true;
    editor.hidden = false;

    if (!currentOptCastingId || !currentCastings.find(c => c.id === currentOptCastingId)) {
        currentOptCastingId = currentCastings[0].id;
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
}

function renderOptimizer() {
    renderOptPills();
    renderOptColumns();
    renderOptTotals();
    ensurePhaseSortable();
}

function getVisibleCastings() {
    const total = currentCastings.length;
    if (total === 0) return [];
    const activeIdx = currentCastings.findIndex(c => c.id === currentOptCastingId);
    if (total <= 3) return currentCastings.slice();
    if (activeIdx <= 0) return currentCastings.slice(0, 3);
    if (activeIdx >= total - 1) return currentCastings.slice(total - 3);
    return currentCastings.slice(activeIdx - 1, activeIdx + 2);
}

function renderOptPills() {
    const wrap = document.getElementById('pp-opt-pills');
    if (!wrap) return;

    const total = currentCastings.length;
    if (total === 0) { wrap.innerHTML = ''; return; }

    const activeIdx = currentCastings.findIndex(c => c.id === currentOptCastingId);
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
            const value = (p.hours === undefined || p.hours === null) ? '' : String(p.hours);
            const grip = isActive ? `
                <div class="pp-opt-card-grip" aria-hidden="true" title="Drag to reorder">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/>
                        <circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>
                    </svg>
                </div>` : '';
            const nameField = isActive
                ? `<input type="text" class="pp-opt-card-name" data-action="rename" value="${escapeAttr(p.phase_name)}" />`
                : `<span class="pp-opt-card-name pp-opt-card-name-readonly">${escapeHtml(p.phase_name)}</span>`;
            const deleteBtn = isActive
                ? `<button class="pp-opt-card-delete" type="button" data-action="delete-phase" aria-label="Delete task" title="Delete task">&times;</button>`
                : '';
            return `
                <div class="pp-opt-card" data-phase-id="${escapeAttr(p.id)}" data-casting-id="${escapeAttr(casting.id)}">
                    ${grip}
                    <div class="pp-opt-card-left">${nameField}</div>
                    <div class="pp-opt-card-right">
                        <input type="number" min="0" step="1" class="pp-opt-card-hours" data-action="hours" value="${escapeAttr(value)}" placeholder="0" />
                        <span class="pp-opt-card-hours-label">hrs</span>
                        ${deleteBtn}
                    </div>
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

    // Grand total — sum across ALL castings (not just visible)
    const grandEl = document.getElementById('pp-opt-grand-total');
    if (grandEl) {
        let grand = 0;
        for (const phases of currentCastingPhases.values()) {
            grand += sumPhases(phases);
        }
        grandEl.textContent = String(grand);
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
        sort_order: p.sort_order
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
        return;
    }
    needsSave.hidden = true;

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

    await loadAllComponentsForCurrentProject();
    renderTracking();
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

function renderTracking() {
    const list = document.getElementById('pp-track-list');
    if (!list) return;
    list.innerHTML = currentCastings.map(c => renderTrackSection(c)).join('');
    ensureComponentSortables();
}

function renderTrackSection(casting) {
    const isOpen = currentTrackExpanded.has(casting.id);
    const components = getComponentsFor(casting.id);
    const count = components.length;
    const desc = casting.description ? `<span class="pp-track-section-desc">${escapeHtml(casting.description)}</span>` : '';

    const cardsHtml = count === 0
        ? `<div class="pp-opt-cards-empty">No components yet. Add one below.</div>`
        : components.map(comp => renderTrackCard(comp, casting.id)).join('');

    const headerRow = `
        <div class="pp-track-header-row" aria-hidden="true">
            <div class="pp-track-header-grip-spacer"></div>
            <div class="pp-track-header-fields">
                <span>Type</span>
                <span>Width</span>
                <span>Length</span>
                <span>Panel ID</span>
                <span>Color</span>
                <span>Sealer</span>
            </div>
            <div class="pp-track-header-delete-spacer"></div>
        </div>
    `;

    const body = isOpen ? `
        <div class="pp-track-section-body">
            ${headerRow}
            <div class="pp-track-cards" data-casting-id="${escapeAttr(casting.id)}">
                ${cardsHtml}
            </div>
            <button type="button" class="pp-add-btn pp-track-add" data-action="add-component" data-casting-id="${escapeAttr(casting.id)}">+ Add Component</button>
        </div>
    ` : '';

    return `
        <div class="pp-track-section${isOpen ? ' pp-track-section-open' : ''}" data-casting-id="${escapeAttr(casting.id)}">
            <button type="button" class="pp-track-section-header" data-action="toggle-section" aria-expanded="${isOpen}">
                <span class="pp-track-chevron" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"/>
                    </svg>
                </span>
                <span class="pp-track-section-label">Cast</span>
                <span class="pp-track-section-num">${escapeHtml(casting.casting_number || '')}</span>
                ${desc}
                <span class="pp-track-section-count">${count} ${count === 1 ? 'component' : 'components'}</span>
            </button>
            ${body}
        </div>
    `;
}

function renderTrackCard(comp, castingId) {
    return `
        <div class="pp-track-card" data-component-id="${escapeAttr(comp.id)}" data-casting-id="${escapeAttr(castingId)}">
            <div class="pp-track-card-grip" aria-hidden="true" title="Drag to reorder">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/>
                    <circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>
                </svg>
            </div>
            <div class="pp-track-card-fields">
                <input type="text" class="pp-track-input" data-field="type" placeholder="Type" value="${escapeAttr(comp.type || '')}" />
                <input type="text" class="pp-track-input" data-field="width" placeholder="Width" value="${escapeAttr(comp.width || '')}" />
                <input type="text" class="pp-track-input" data-field="length" placeholder="Length" value="${escapeAttr(comp.length || '')}" />
                <input type="text" class="pp-track-input" data-field="panel_id" placeholder="Panel ID" value="${escapeAttr(comp.panel_id || '')}" />
                <input type="text" class="pp-track-input" data-field="color" placeholder="Color" value="${escapeAttr(comp.color || '')}" />
                <input type="text" class="pp-track-input" data-field="sealer" placeholder="Sealer" value="${escapeAttr(comp.sealer || '')}" />
            </div>
            <button class="pp-track-card-delete" type="button" data-action="delete-component" aria-label="Delete component" title="Delete component">&times;</button>
        </div>
    `;
}

function handleToggleTrackSection(castingId) {
    if (currentTrackExpanded.has(castingId)) currentTrackExpanded.delete(castingId);
    else currentTrackExpanded.add(castingId);
    renderTracking();
}

async function handleAddComponentClick(castingId) {
    if (!currentProjectNumber || !castingId) return;
    if (!currentTrackExpanded.has(castingId)) currentTrackExpanded.add(castingId);
    try {
        const created = await createComponent(castingId, {});
        if (created) {
            const list = getComponentsFor(castingId).slice();
            list.push(created);
            setComponentsFor(castingId, list);
        }
        renderTracking();
        // Focus the first input on the newest card in this section
        const section = document.querySelector(`.pp-track-section[data-casting-id="${castingId}"]`);
        const last = section?.querySelector('.pp-track-card:last-of-type input[data-field="type"]');
        last?.focus();
    } catch (err) {
        logger.error('[project-portal] add component failed:', err);
        showToast('Add component failed: ' + (err.message || err), 'error');
    }
}

async function handleUpdateComponent(componentId, castingId, field, value) {
    const list = getComponentsFor(castingId);
    const comp = list.find(c => c.id === componentId);
    if (!comp) return;
    const cleaned = (value || '').trim() === '' ? null : value.trim();
    if ((comp[field] || null) === cleaned) return; // no change
    try {
        const updated = await updateComponent(componentId, { [field]: cleaned });
        if (updated) Object.assign(comp, updated);
        else comp[field] = cleaned;
    } catch (err) {
        logger.error('[project-portal] updateComponent failed:', err);
        showToast('Save failed: ' + (err.message || err), 'error');
    }
}

async function handleDeleteComponent(castingId, componentId) {
    try {
        await deleteComponent(componentId);
        const list = getComponentsFor(castingId).filter(c => c.id !== componentId);
        setComponentsFor(castingId, list);
        renderTracking();
    } catch (err) {
        logger.error('[project-portal] deleteComponent failed:', err);
        showToast('Delete failed: ' + (err.message || err), 'error');
    }
}

// One SortableJS instance per expanded section
let trackSortables = [];

function ensureComponentSortables() {
    trackSortables.forEach(s => { try { s.destroy(); } catch {} });
    trackSortables = [];
    if (typeof window.Sortable === 'undefined') return;

    document.querySelectorAll('#pp-track-list .pp-track-section-body .pp-track-cards').forEach(el => {
        const castingId = el.dataset.castingId;
        if (!castingId) return;
        const s = window.Sortable.create(el, {
            animation: 180,
            easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
            handle: '.pp-track-card-grip',
            draggable: '.pp-track-card',
            ghostClass: 'pp-track-card-ghost',
            chosenClass: 'pp-track-card-chosen',
            dragClass: 'pp-track-card-drag',
            forceFallback: true,
            fallbackTolerance: 4,
            scroll: true,
            scrollSensitivity: 60,
            scrollSpeed: 14,
            onEnd: async (evt) => {
                const oldIdx = evt.oldIndex;
                const newIdx = evt.newIndex;
                if (oldIdx === newIdx || oldIdx === undefined || newIdx === undefined) return;
                const list = getComponentsFor(castingId).slice();
                const [moved] = list.splice(oldIdx, 1);
                list.splice(newIdx, 0, moved);
                list.forEach((c, idx) => { c.sort_order = idx; });
                setComponentsFor(castingId, list);
                try {
                    await setComponentsOrder(list.map(c => c.id));
                } catch (err) {
                    logger.error('[project-portal] setComponentsOrder failed:', err);
                    showToast('Reorder save failed: ' + (err.message || err), 'error');
                    renderTracking();
                }
            }
        });
        trackSortables.push(s);
    });
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
    tbody.innerHTML = items.map((item, i) => `
        <tr data-cl-type="${type}" data-cl-idx="${i}">
            <td><input type="text" value="${escapeAttr(item.name || '')}" data-cl-field="name"></td>
            <td><input type="number" step="any" value="${item.weight ?? item.amount ?? ''}" data-cl-field="weight"></td>
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

function renderColorLog() {
    if (!currentColorLog) currentColorLog = createEmptyColorLog();
    const log = currentColorLog;

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

    if (colorLogLoadedFor !== currentProjectNumber) {
        try {
            const existing = await loadColorLogForProject(currentProjectNumber);
            currentColorLog = existing || createEmptyColorLog();
        } catch (err) {
            logger.error('[color-log] load failed', err);
            currentColorLog = createEmptyColorLog();
            showToast('Failed to load color log', 'error');
        }
        colorLogLoadedFor = currentProjectNumber;
        renderColorLog();
        await refreshPresetPicker();
    }
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
            currentColorLog.id = saved.id;
        }
        setColorLogStatus('saved');
        setTimeout(() => setColorLogStatus(''), 1500);
    } catch (err) {
        logger.error('[color-log] save failed', err);
        setColorLogStatus('error');
    }
}

async function handleSaveAsPresetClick() {
    if (!currentColorLog) return;
    const defaultName = currentColorLog.name || 'New Standard Color';
    const presetName = window.prompt('Standard color name:', defaultName);
    if (!presetName || !presetName.trim()) return;
    try {
        await saveColorLogAsPreset(presetName, currentColorLog);
        showToast('Standard color saved', 'success');
        await refreshPresetPicker();
    } catch (err) {
        logger.error('[color-log] saveAsPreset failed', err);
        showToast('Failed to save standard color', 'error');
    }
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

    // Form: back to list
    document.getElementById('pp-back-list-btn').addEventListener('click', () => {
        showListView();
    });

    // Form: save
    document.getElementById('pp-save-btn').addEventListener('click', (e) => {
        e.preventDefault();
        handleSave();
    });

    // Form: delete
    document.getElementById('pp-delete-btn').addEventListener('click', (e) => {
        e.preventDefault();
        handleDelete();
    });

    // Form: print — on Batch Tickets tab, this prints the active casting's tickets instead.
    document.getElementById('pp-print-btn').addEventListener('click', (e) => {
        e.preventDefault();
        if (currentTab === 'batch-tickets') {
            if (currentBatchCastingId) handlePrintBatchTickets(currentBatchCastingId);
            else showToast('Select a casting first', 'error');
            return;
        }
        handlePrint();
    });

    // Prevent enter-key submit
    document.getElementById('pp-form').addEventListener('submit', (e) => {
        e.preventDefault();
        handleSave();
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
            } else if (tab === 'color-log') {
                activateColorLogTab();
            } else if (tab === 'batch-tickets') {
                activateBatchTicketsTab();
            }
        });
    });

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

            if (e.target.id === 'pp-cl-save-preset-btn') {
                handleSaveAsPresetClick();
                return;
            }
        });

        clPanel.addEventListener('input', (e) => {
            const target = e.target;
            if (!currentColorLog) return;
            let touched = false;

            // Top-level fields
            if (target.id === 'pp-cl-name')           { currentColorLog.name = target.value; touched = true; }
            else if (target.id === 'pp-cl-temp')      { currentColorLog.temperature = target.value; touched = true; }
            else if (target.id === 'pp-cl-project')   { currentColorLog.project = target.value; touched = true; }
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

    // Optimizer: pills + prev/next nav
    document.getElementById('pp-opt-pills').addEventListener('click', (e) => {
        const navBtn = e.target.closest('button[data-action]');
        if (navBtn) {
            if (navBtn.disabled) return;
            const action = navBtn.dataset.action;
            const idx = currentCastings.findIndex(c => c.id === currentOptCastingId);
            if (idx === -1) return;
            const newIdx = action === 'prev' ? idx - 1 : idx + 1;
            if (newIdx < 0 || newIdx >= currentCastings.length) return;
            handleSelectOptCasting(currentCastings[newIdx].id);
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
        const btn = e.target.closest('button[data-action="delete-phase"]');
        if (!btn) return;
        const card = btn.closest('.pp-opt-card[data-phase-id]');
        if (!card) return;
        handleDeletePhase(card.dataset.castingId, card.dataset.phaseId);
    });
    optColumns.addEventListener('change', (e) => {
        const card = e.target.closest('.pp-opt-card[data-phase-id]');
        if (!card) return;
        const phaseId = card.dataset.phaseId;
        const castingId = card.dataset.castingId;
        if (e.target.matches('input[data-action="hours"]')) {
            handleSetHours(castingId, phaseId, e.target.value);
        } else if (e.target.matches('input[data-action="rename"]')) {
            handleRenamePhase(castingId, phaseId, e.target.value);
        }
    });
    optColumns.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const input = e.target;
        if (input.matches('input[data-action="rename"]') || input.matches('input[data-action="hours"]')) {
            e.preventDefault();
            input.blur(); // triggers change
        }
    });

    // Optimizer: "go to castings" link in empty state
    document.querySelector('[data-action="goto-castings"]')?.addEventListener('click', () => {
        setActiveTab('castings');
        if (currentProjectNumber) loadAndRenderCastings();
    });

    // Tracking: accordion list (delegation)
    const trackList = document.getElementById('pp-track-list');
    trackList?.addEventListener('click', (e) => {
        const headerBtn = e.target.closest('button[data-action="toggle-section"]');
        if (headerBtn) {
            const section = headerBtn.closest('.pp-track-section[data-casting-id]');
            if (section) handleToggleTrackSection(section.dataset.castingId);
            return;
        }
        const addBtn = e.target.closest('button[data-action="add-component"]');
        if (addBtn) {
            handleAddComponentClick(addBtn.dataset.castingId);
            return;
        }
        const delBtn = e.target.closest('button[data-action="delete-component"]');
        if (delBtn) {
            const card = delBtn.closest('.pp-track-card[data-component-id]');
            if (!card) return;
            handleDeleteComponent(card.dataset.castingId, card.dataset.componentId);
        }
    });
    trackList?.addEventListener('change', (e) => {
        const card = e.target.closest('.pp-track-card[data-component-id]');
        if (!card) return;
        if (!e.target.matches('input[data-field]')) return;
        handleUpdateComponent(
            card.dataset.componentId,
            card.dataset.castingId,
            e.target.dataset.field,
            e.target.value
        );
    });
    trackList?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.matches('input[data-field]')) {
            e.preventDefault();
            e.target.blur();
        }
    });

    // Tracking: "go to castings" link in empty state
    document.querySelector('[data-action="goto-castings-from-tracking"]')?.addEventListener('click', () => {
        setActiveTab('castings');
        if (currentProjectNumber) loadAndRenderCastings();
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
            handleBatchFieldInput(currentBatchCastingId, target.dataset.btField, target.value);
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

    // Castings: add
    document.getElementById('pp-cast-add-btn').addEventListener('click', handleAddCastingClick);

    // Castings: row actions (delegation)
    document.getElementById('pp-castings-list').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const card = btn.closest('.pp-cast-card[data-casting-id]');
        if (!card) return;
        const id = card.getAttribute('data-casting-id');
        const action = btn.dataset.action;
        if (action === 'save') handleSaveCasting(id);
        else if (action === 'delete') handleDeleteCasting(id);
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

// Pigment reduction applied to FINAL Backup batches (hardcoded — not user-editable).
const FINAL_BACKUP_PIG_REDUCTION_PCT = 50;

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

    // Make sure color log is loaded — we need its ingredients to scale.
    // Don't set colorLogLoadedFor — leave that to activateColorLogTab so its
    // first activation still triggers renderColorLog + refreshPresetPicker.
    if (!currentColorLog) {
        try {
            const existing = await loadColorLogForProject(currentProjectNumber);
            currentColorLog = existing || createEmptyColorLog();
        } catch (err) {
            logger.error('[batch-tickets] color-log load failed', err);
            currentColorLog = createEmptyColorLog();
        }
    }

    // No color log yet → block until they create one.
    if (!currentColorLog || !currentColorLog.id) {
        if (needsCL) needsCL.hidden = false;
        if (noCastings) noCastings.hidden = true;
        if (pills) pills.innerHTML = '';
        content.innerHTML = '';
        return;
    }
    if (needsCL) needsCL.hidden = true;

    // No castings → tell them to add one.
    if (!currentCastings || currentCastings.length === 0) {
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

    // Default active casting: the first one if not already chosen, or fall back if the previous active is gone.
    if (!currentBatchCastingId || !currentCastings.some(c => c.id === currentBatchCastingId)) {
        currentBatchCastingId = currentCastings[0]?.id || null;
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
    if (!currentCastings.length) { pills.innerHTML = ''; return; }
    pills.innerHTML = currentCastings.map(c => {
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
    return `
        <div class="pp-bt-form">
            <div class="pp-bt-context">
                <div class="pp-bt-context-cast">
                    <span class="pp-bt-context-cast-label">Casting</span>${escapeHtml(casting.casting_number || '')}
                </div>
                <span class="pp-bt-save-status" data-bt-status></span>
                <div class="pp-bt-context-date-group">
                    <label class="pp-bt-context-date-label" for="pp-bt-castdate-${escapeAttr(casting.id)}">Cast Date</label>
                    <input type="date" id="pp-bt-castdate-${escapeAttr(casting.id)}" class="pp-bt-context-date" data-bt-casting-date value="${escapeAttr(casting.casting_date || '')}">
                </div>
            </div>

            <div class="pp-bt-card">
                <h3 class="pp-bt-card-title">Batch Plan</h3>
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

    const sandLbs = getColorLogSandLbs(currentColorLog);
    if (!sandLbs) {
        return `<div class="pp-bt-no-color-log">No sand weight in this project's color log base ingredients. Add a sand entry to the color log to enable scaling.</div>`;
    }

    const plan = buildBatchPlan({
        totalCuFt,
        faceSqFt: parseFloat(ticket.faceSqFt) || 0,
        cuFtPer250: parseFloat(ticket.cuFtPer250) || 4.28,
        castMethod: currentColorLog?.castMethod || 'sprayUp',
        colorLogSandLbs: sandLbs,
        manualOverrides: ticket.batchAssignments
    });

    if (!plan.batches.length) return '';

    const sectionHeader = renderBatchSectionHeader(plan);
    const assign = renderBatchAssignTable(plan);
    const tickets = renderBatchTicketCards(casting, ticket, plan);

    return `
        ${sectionHeader}
        ${assign}
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

function renderBatchTicketCards(casting, ticket, plan) {
    const projectName = document.getElementById('pp-f-project_name')?.value || '';
    const sampleName = currentColorLog?.name || '';
    const castMethod = currentColorLog?.castMethod || '';
    const castNumber = casting.casting_number || '';
    const castDate = casting.casting_date || '';

    return plan.batches.map(b =>
        renderBatchTicketCard({
            colorLog: currentColorLog,
            batch: b,
            project: projectName,
            sampleName,
            castMethod,
            castNumber,
            castDate,
            batchedBy: ticket.batchedBy,
            notes: ticket.notes
        })
    ).join('');
}

/**
 * Build a single batch ticket card HTML. Pure (DOM-free).
 * Mirrors Batchin Calc's renderBatchTicket().
 */
function renderBatchTicketCard({
    colorLog, batch, project, sampleName, castMethod, castNumber, castDate,
    batchedBy, notes
}) {
    const { batchSandLbs, scaleFactor, num, total, type: batchType } = batch;
    const pigReductionPct = FINAL_BACKUP_PIG_REDUCTION_PCT;
    const pigMultiplier = batchType === 'finalBackUp' ? (1 - pigReductionPct / 100) : 1;
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
        if (!f || !f.amount) return { qty: '-', unit: f?.unit || 'oz', type: f?.note || '' };
        return { qty: roundSig(Number(f.amount) * scaleFactor, 2), unit: f.unit || 'oz', type: f.note || '' };
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

    let fibers = scaleAdd('Fibers');
    if (batchType === 'firstBackUp' || batchType === 'finalBackUp') {
        // Backup batches: 18 lbs fibers per 250 lbs sand (Cemfill).
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
    const reducedLabel = (batchType === 'finalBackUp' && pigReductionPct > 0) ? ` (${pigReductionPct}% reduced)` : '';
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
    const previewAffectingFields = ['cuFt', 'faceSqFt', 'cuFtPer250', 'batchedBy', 'notes'];
    if (previewAffectingFields.includes(field)) {
        // If the batch count would change, drop manual overrides so they don't desync.
        const sandLbs = getColorLogSandLbs(currentColorLog);
        if (sandLbs && Array.isArray(ticket.batchAssignments) && ticket.batchAssignments.length) {
            const newPlan = buildBatchPlan({
                totalCuFt: parseFloat(ticket.cuFt) || 0,
                faceSqFt: parseFloat(ticket.faceSqFt) || 0,
                cuFtPer250: parseFloat(ticket.cuFtPer250) || 4.28,
                castMethod: currentColorLog?.castMethod || 'sprayUp',
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
    const sandLbs = getColorLogSandLbs(currentColorLog);
    if (!sandLbs) return;
    const plan = buildBatchPlan({
        totalCuFt: parseFloat(ticket.cuFt) || 0,
        faceSqFt: parseFloat(ticket.faceSqFt) || 0,
        cuFtPer250: parseFloat(ticket.cuFtPer250) || 4.28,
        castMethod: currentColorLog?.castMethod || 'sprayUp',
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
    const sandLbs = getColorLogSandLbs(currentColorLog);
    if (!sandLbs) {
        showToast('Add a sand entry to the color log first', 'error');
        return;
    }
    const plan = buildBatchPlan({
        totalCuFt: parseFloat(ticket.cuFt) || 0,
        faceSqFt: parseFloat(ticket.faceSqFt) || 0,
        cuFtPer250: parseFloat(ticket.cuFtPer250) || 4.28,
        castMethod: currentColorLog?.castMethod || 'sprayUp',
        colorLogSandLbs: sandLbs,
        manualOverrides: ticket.batchAssignments
    });
    if (!plan.batches.length) {
        showToast('Enter Total Cu Ft to generate tickets', 'error');
        return;
    }

    const projectName = document.getElementById('pp-f-project_name')?.value || '';
    const sampleName = currentColorLog?.name || '';
    const castMethod = currentColorLog?.castMethod || '';

    const pages = plan.batches.map(b => `
        <div class="bt-page bt-${b.type}">
            ${renderBatchTicketCard({
                colorLog: currentColorLog,
                batch: b,
                project: projectName,
                sampleName,
                castMethod,
                castNumber: casting.casting_number || '',
                castDate: casting.casting_date || '',
                batchedBy: ticket.batchedBy,
                notes: ticket.notes
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

// ---------- Bootstrap ----------

async function init() {
    wireEvents();
    const urlProject = getProjectFromUrl();
    if (urlProject !== null) {
        // form view, but still load list data in background for completeness
        loadAllData().catch(err => logger.warn(err));
        await showFormView(urlProject);
    } else {
        await showListView();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
