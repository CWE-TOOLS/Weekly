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

const FORM_FIELDS = [
    'project_number', 'project_name', 'status', 'project_date', 'project_address',
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
    currentProjectNumber = null;
    document.getElementById('pp-list-view').hidden = false;
    document.getElementById('pp-form-view').hidden = true;
    setProjectInUrl(null);
    await refreshList();
}

async function showFormView(projectNumber) {
    currentProjectNumber = projectNumber || null;
    document.getElementById('pp-list-view').hidden = true;
    document.getElementById('pp-form-view').hidden = false;
    setProjectInUrl(projectNumber);

    let project = null;
    if (projectNumber) {
        project = await loadProject(projectNumber);
    }
    if (!project) {
        project = createEmptyProject(projectNumber || '');
    }
    populateForm(project);

    document.getElementById('pp-f-project_number').readOnly = !!projectNumber;
    document.getElementById('pp-delete-btn').hidden = !projectNumber;

    updateFormContext(project);
    setActiveTab(currentTab);

    if (projectNumber) {
        await loadAndRenderCastings();
    } else {
        currentCastings = [];
        renderCastings();
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
}

// ---------- Data ----------

async function loadAllData() {
    allProjectRows = await loadAllProjects();
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
        const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
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
        tbody.innerHTML = '<tr><td colspan="6" class="pp-empty">No projects yet. Click "+ New Project" to get started.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(row => {
        const status = row.status ? `<span class="pp-status-pill pp-status-${slug(row.status)}">${escapeHtml(row.status)}</span>` : '';
        return `
            <tr class="pp-row-clickable" data-project-number="${escapeAttr(row.project_number)}">
                <td class="pp-cell-num"><strong>${escapeHtml(row.project_number)}</strong></td>
                <td>${escapeHtml(row.project_name || '')}</td>
                <td>${status}</td>
                <td>${escapeHtml(row.estimator || '')}</td>
                <td>${escapeHtml(row.architect || '')}</td>
                <td>${escapeHtml(row.need_by_date || '')}</td>
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

// ---------- Wire up ----------

function wireEvents() {
    // List: search
    document.getElementById('pp-search').addEventListener('input', (e) => {
        renderList(e.target.value);
    });

    // List: new project
    document.getElementById('pp-new-btn').addEventListener('click', () => {
        showFormView('');
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

    // Form: print
    document.getElementById('pp-print-btn').addEventListener('click', (e) => {
        e.preventDefault();
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
            }
        });
    });

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
