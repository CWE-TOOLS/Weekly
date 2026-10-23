/**
 * Finishing Map — where each casting physically sits once it reaches finishing. Fits one screen.
 *
 * Reads the weekly (fetchAllTasks: Google Sheet + manual tasks + inventory summary) and the finishing_map table:
 *   - a casting enters the QUEUE on its first Finish day (FINISHING_DEPARTMENTS) that is today or earlier,
 *     or as soon as it has a placement row (so it survives the month rolling off the sheet);
 *   - it LEAVES the map when its last Ship day is past, the job is Shipped / Closed Out, or someone presses "Shipped";
 *     it then sits in the Shipped pop-up for SHIPPED_WINDOW_DAYS.
 * Queue cards carry the detail; cards inside an area are collapsed to job, cast, job number and pieces.
 * Moves: drag a card onto an area (or the queue), tap the card then tap the area, or open a full area (click its
 * title) and use the Move dropdown there. Every move is written to finishing_map + finishing_map_log and announced
 * to the other open pages, which reload.
 */
import { fetchAllTasks } from '../../services/data-service.js';
import { loadAllProjects } from '../../services/projects-service.js';
import { initializeSupabase, registerRefreshHandler, isPortalChange, signalInfo } from '../../services/supabase-service.js';
import { loadPlacements, ensurePlacements, setArea, setShipped, placementKey, isFinishingMapMigrationPending, logMove, loadLog } from '../../services/finishing-map-service.js';
import { FINISHING_AREAS, FINISHING_DEPARTMENTS, SHIPPING_DEPARTMENTS, SHIPPED_STATUSES, SHIPPED_WINDOW_DAYS, STALE_AFTER_DAYS, LOG_WINDOW_DAYS, areaLabel } from '../../config/finishing-map-config.js';
import { parseDate, getLocalDateString } from '../../utils/date-utils.js';
import { escapeHtml } from '../../utils/security-utils.js';
import { logger } from '../../utils/logger.js';

const WHO_KEY = 'finishingMapMovedBy';

const S = {
    castings: new Map(),     // key -> casting summary built from the weekly
    placements: new Map(),   // key -> finishing_map row
    projects: new Map(),     // project_number -> { project_name, status, pm }
    selectedKey: null,       // tap-to-move: the card waiting for an area
    expandedKey: null,       // a card inside an area opened to its full size
    search: '',
    loading: false,
    log: [],
    modal: null,             // { kind: 'area'|'shipped'|'log', areaId?, filter }
};

const $ = (id) => document.getElementById(id);
const today = () => getLocalDateString(new Date());
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return getLocalDateString(d); };
const fmtDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${Number(m)}/${Number(d)}/${y}`; };
const who = () => ($('fm-who')?.value || '').trim();

// ---------------------------------------------------------------- data

/** Collapse the weekly's rows into one summary per casting. */
function summariseCastings(tasks) {
    const out = new Map();
    const now = today();
    for (const t of tasks || []) {
        const pn = String(t.projectNumber || '').trim();
        const cn = String(t.castingNumber || '').trim();
        if (!pn || !cn || t.isSynthetic) continue;
        const d = parseDate(t.date);
        if (!d) continue;
        const iso = getLocalDateString(d);
        const key = placementKey(pn, cn);
        let c = out.get(key);
        if (!c) {
            c = { key, projectNumber: pn, castingNumber: cn, sheetName: String(t.project || '').trim(), firstFinish: null, finishDays: 0, finishDaysDone: 0, lastShip: null, next: null, inv: null, lastDate: null };
            out.set(key, c);
        }
        if (t.invSummary && !c.inv) c.inv = t.invSummary;
        if (FINISHING_DEPARTMENTS.includes(t.department)) {
            c.finishDays++;
            if (iso <= now) c.finishDaysDone++;
            if (!c.firstFinish || iso < c.firstFinish) c.firstFinish = iso;
        }
        if (SHIPPING_DEPARTMENTS.includes(t.department) && (!c.lastShip || iso > c.lastShip)) c.lastShip = iso;
        if (iso >= now && (!c.next || iso < c.next.date)) c.next = { date: iso, department: t.department };
        if (!c.lastDate || iso > c.lastDate) c.lastDate = iso;
    }
    return out;
}

function projectOf(pn) { return S.projects.get(pn) || null; }

function jobName(c) {
    const p = projectOf(c.projectNumber);
    if (p && p.project_name) return p.project_name;
    return (c.sheetName || c.projectNumber).replace(/\s*[-–]?\s*cast\s*#?\s*[\w.]+\s*$/i, '').trim() || c.sheetName || c.projectNumber;
}

function shippedOn(c) {
    const row = S.placements.get(c.key);
    if (row && row.shipped_on) return row.shipped_on;
    const now = today();
    if (c.lastShip && c.lastShip <= now) return c.lastShip;
    const p = projectOf(c.projectNumber);
    if (p && SHIPPED_STATUSES.includes(p.status)) return c.lastDate && c.lastDate <= now ? c.lastDate : now;
    return null;
}

function inFinishing(c) {
    if (S.placements.has(c.key)) return true;
    return !!(c.firstFinish && c.firstFinish <= today());
}

function isStale(c) {
    return !!(c.offSheet || (c.lastDate && c.lastDate < daysAgo(STALE_AFTER_DAYS)));
}

/** Castings on the map (queue + areas) and the ones in the shipped list. */
function partition() {
    const onMap = [], shipped = [];
    const cutoff = daysAgo(SHIPPED_WINDOW_DAYS);
    const seen = new Set();
    for (const c of S.castings.values()) {
        seen.add(c.key);
        if (!inFinishing(c)) continue;
        const s = shippedOn(c);
        if (s) { if (s >= cutoff) shipped.push({ c, shippedOn: s }); }
        else onMap.push(c);
    }
    for (const [key, row] of S.placements) {          // rows whose casting is no longer on the weekly at all
        if (seen.has(key)) continue;
        const c = { key, projectNumber: row.project_number, castingNumber: row.casting_number, sheetName: '', firstFinish: null, finishDays: 0, finishDaysDone: 0, lastShip: null, next: null, inv: null, lastDate: null, offSheet: true };
        if (row.shipped_on) { if (row.shipped_on >= cutoff) shipped.push({ c, shippedOn: row.shipped_on }); }
        else onMap.push(c);
    }
    const byName = (a, b) => jobName(a).localeCompare(jobName(b)) || String(a.castingNumber).localeCompare(String(b.castingNumber), undefined, { numeric: true });
    onMap.sort(byName);
    shipped.sort((a, b) => b.shippedOn.localeCompare(a.shippedOn) || byName(a.c, b.c));
    return { onMap, shipped };
}

function castingByKey(key) {
    const c = S.castings.get(key);
    if (c) return c;
    const row = S.placements.get(key);
    return row ? { key, projectNumber: row.project_number, castingNumber: row.casting_number, sheetName: '', offSheet: true } : null;
}

function searchText(c) {
    return `${jobName(c)} ${c.sheetName || ''} ${c.projectNumber} cast ${c.castingNumber} ${(projectOf(c.projectNumber) || {}).pm || ''}`.toLowerCase();
}
function matchesSearch(c, q = S.search) { return !q || searchText(c).includes(q); }

// ---------------------------------------------------------------- cards

/** The lines every full card shows (queue card, expanded chip, expanded pop-up row). */
function cardBodyHtml(c) {
    const p = projectOf(c.projectNumber);
    const inv = c.inv ? `${c.inv.types} types · ${c.inv.pcs} pcs` : '';
    const finish = c.finishDays ? `Finish day ${Math.min(c.finishDaysDone, c.finishDays) || 1} of ${c.finishDays}` : '';
    const next = c.next ? `Next: ${c.next.department} ${fmtDate(c.next.date)}` : (c.lastShip ? `Ship ${fmtDate(c.lastShip)}` : '');
    const staleNote = isStale(c) ? (c.lastDate ? `No weekly days since ${fmtDate(c.lastDate)} — shipped?` : 'Not on the weekly any more — shipped?') : '';
    return `<div class="fm-card-job">${escapeHtml(jobName(c))}</div>
        <div class="fm-card-cast">Cast ${escapeHtml(c.castingNumber)}<span class="fm-card-pn">${escapeHtml(c.projectNumber)}</span></div>
        ${p && p.pm ? `<div class="fm-card-meta">${escapeHtml(p.pm)}</div>` : ''}
        ${inv ? `<div class="fm-card-meta">${escapeHtml(inv)}</div>` : ''}
        ${finish ? `<div class="fm-card-meta fm-card-finish">${escapeHtml(finish)}</div>` : ''}
        ${next ? `<div class="fm-card-meta">${escapeHtml(next)}</div>` : ''}
        ${staleNote ? `<div class="fm-card-meta fm-card-stale-note">${escapeHtml(staleNote)}</div>` : ''}`;
}

function movedLine(c) {
    const row = S.placements.get(c.key);
    return row && row.moved_at ? `${row.moved_by ? escapeHtml(row.moved_by) + ' · ' : ''}${new Date(row.moved_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}` : '';
}

function moveSelectHtml(c, currentArea) {
    const options = [`<option value="">Move to…</option>`, `<option value="__queue">Queue (not placed)</option>`]
        .concat(FINISHING_AREAS.filter(a => a.id !== currentArea).map(a => `<option value="${a.id}">${escapeHtml(areaLabel(a.id))}</option>`))
        .join('');
    return `<select class="fm-move-select" data-move-one="${escapeHtml(c.key)}" title="Move this casting">${options}</select>`;
}

/** Full card: the queue. */
function queueCardHtml(c) {
    const moved = movedLine(c);
    const cls = ['fm-card', S.selectedKey === c.key ? 'fm-card-selected' : '', matchesSearch(c) ? '' : 'fm-card-dim', isStale(c) ? 'fm-card-stale' : ''].filter(Boolean).join(' ');
    return `<div class="${cls}" draggable="true" data-key="${escapeHtml(c.key)}" title="${escapeHtml(c.sheetName || jobName(c))}">
        ${cardBodyHtml(c)}
        <div class="fm-card-foot">${moved ? `<span class="fm-card-moved">${moved}</span>` : '<span></span>'}<button type="button" class="fm-mini-btn" data-action="ship" data-key="${escapeHtml(c.key)}" title="Mark this casting as shipped">Shipped</button></div>
    </div>`;
}

/** Collapsed card: inside an area (job, cast, job number, pieces). Click = open to the full card. */
function chipHtml(c) {
    const pcs = c.inv && c.inv.pcs != null ? `${c.inv.pcs} pcs` : '';
    const stale = isStale(c);
    const cls = ['fm-chip', S.expandedKey === c.key ? 'fm-chip-open' : '', matchesSearch(c) ? '' : 'fm-card-dim', stale ? 'fm-card-stale' : ''].filter(Boolean).join(' ');
    return `<div class="${cls}" draggable="true" data-key="${escapeHtml(c.key)}" title="${escapeHtml(c.sheetName || jobName(c))}${stale ? ' — no weekly days for a while, shipped?' : ''}">
        <span class="fm-chip-job">${escapeHtml(jobName(c))}</span>
        <span class="fm-chip-line"><b>Cast ${escapeHtml(c.castingNumber)}</b><span>${escapeHtml(c.projectNumber)}</span><span>${escapeHtml(pcs)}</span></span>
    </div>`;
}

/** Row in the area pop-up: tick box + collapsed info + Shipped. Moves happen from the bar above the list. */
function modalRowHtml(c) {
    const pcs = c.inv && c.inv.pcs != null ? `${c.inv.pcs} pcs` : '';
    const stale = isStale(c);
    const checked = S.modal && S.modal.selected && S.modal.selected.has(c.key);
    const open = S.modal && S.modal.expandedKey === c.key;
    return `<div class="fm-mrow${stale ? ' fm-card-stale' : ''}${checked ? ' fm-mrow-checked' : ''}${open ? ' fm-mrow-open' : ''}" data-key="${escapeHtml(c.key)}" data-mrow="${escapeHtml(c.key)}">
        <input type="checkbox" class="fm-mrow-check" data-check="${escapeHtml(c.key)}"${checked ? ' checked' : ''}>
        <div class="fm-mrow-text" data-expand="${escapeHtml(c.key)}" title="${open ? 'Click to close' : 'Click for the full card'}">
            ${open ? cardBodyHtml(c) : `<div class="fm-card-job">${escapeHtml(jobName(c))} <b>Cast ${escapeHtml(c.castingNumber)}</b> <span class="fm-card-pn">${escapeHtml(c.projectNumber)}</span> <span class="fm-card-meta">${escapeHtml(pcs)}</span></div>`}
        </div>
        <button type="button" class="fm-mini-btn" data-action="ship" data-key="${escapeHtml(c.key)}">Shipped</button>
    </div>`;
}

/** The bar above an area's list: select all, how many are ticked, where to move them. */
function bulkBarHtml(currentArea, visibleKeys) {
    const n = S.modal.selected.size;
    const allChecked = visibleKeys.length > 0 && visibleKeys.every(k => S.modal.selected.has(k));
    const options = [`<option value="">Choose an area…</option>`, `<option value="__queue">Queue (not placed)</option>`]
        .concat(FINISHING_AREAS.filter(a => a.id !== currentArea).map(a => `<option value="${a.id}">${escapeHtml(areaLabel(a.id))}</option>`))
        .join('');
    return `<div class="fm-bulk">
        <label class="fm-bulk-all"><input type="checkbox" id="fm-sel-all"${allChecked ? ' checked' : ''}> Select all</label>
        <span class="fm-bulk-count">${n ? `${n} selected` : 'Tick the jobs to move'}</span>
        <select id="fm-bulk-area"${n ? '' : ' disabled'}>${options}</select>
        <button type="button" class="fm-mini-btn fm-bulk-go" id="fm-bulk-move"${n ? '' : ' disabled'}>Move selected</button>
    </div>`;
}

// ---------------------------------------------------------------- render

function ensureAreaBoxes() {
    const map = $('fm-map');
    if (map.children.length) return;
    map.innerHTML = FINISHING_AREAS.map(a => `<section class="fm-area${a.group ? ' fm-area-coop' : ''}" data-area="${a.id}" style="grid-area:${a.grid}">
        <button type="button" class="fm-area-head" data-open-area="${a.id}" title="See every job in ${escapeHtml(areaLabel(a.id))}">
            <span class="fm-area-label">${escapeHtml(a.label)}</span>
            <span class="fm-area-more" data-more="${a.id}"></span>
            <span class="fm-area-count" data-count="${a.id}">0</span>
        </button>
        <div class="fm-cards" data-cards="${a.id}"></div>
    </section>`).join('');
    const groups = [...new Set(FINISHING_AREAS.filter(a => a.group).map(a => a.group))];
    for (const g of groups) {
        const label = document.createElement('div');
        label.className = 'fm-group-label';
        label.style.gridArea = 'cooplabel';
        label.textContent = g;
        map.appendChild(label);
    }
}

function renderMap() {
    ensureAreaBoxes();
    const map = $('fm-map');
    const { onMap, shipped } = partition();
    const byArea = new Map(FINISHING_AREAS.map(a => [a.id, []]));
    const queue = [];
    for (const c of onMap) {
        const area = S.placements.get(c.key)?.area;
        if (area && byArea.has(area)) byArea.get(area).push(c); else queue.push(c);
    }
    $('fm-queue-cards').innerHTML = queue.map(queueCardHtml).join('') || '<div class="fm-empty">Nothing waiting.</div>';
    $('fm-queue-count').textContent = String(queue.length);
    for (const [id, list] of byArea) {
        const box = map.querySelector(`[data-cards="${id}"]`);
        if (box) box.innerHTML = list.map(chipHtml).join('');
        const n = map.querySelector(`[data-count="${id}"]`);
        if (n) n.textContent = String(list.length);
    }
    $('fm-shipped-count').textContent = String(shipped.length);
    document.body.classList.toggle('fm-selecting', !!S.selectedKey);
    markOverflow();
    renderPopover();
    if (S.modal) renderModalBody();
}

/** The full card of the clicked chip, drawn over the chip's own corner so it opens under the cursor. */
function renderPopover() {
    let pop = $('fm-popover');
    const key = S.expandedKey;
    const chip = key ? $('fm-map').querySelector(`.fm-chip[data-key="${CSS.escape(key)}"]`) : null;
    const c = key ? castingByKey(key) : null;
    if (!chip || !c) { if (pop) pop.remove(); if (key) S.expandedKey = null; return; }
    if (!pop) { pop = document.createElement('div'); pop.id = 'fm-popover'; $('fm-app').appendChild(pop); }
    const moved = movedLine(c);
    pop.innerHTML = `<div class="fm-card fm-chip-expanded${isStale(c) ? ' fm-card-stale' : ''}" draggable="true" data-key="${escapeHtml(key)}" data-expanded="1" title="Click the name to close">
        ${cardBodyHtml(c)}
        <div class="fm-card-foot">${moved ? `<span class="fm-card-moved">${moved}</span>` : '<span></span>'}${moveSelectHtml(c, S.placements.get(key)?.area || null)}<button type="button" class="fm-mini-btn" data-action="ship" data-key="${escapeHtml(key)}" title="Mark this casting as shipped">Shipped</button></div>
    </div>`;
    const r = chip.getBoundingClientRect();
    pop.style.left = '0px'; pop.style.top = '0px';
    const w = Math.max(pop.offsetWidth, r.width);
    const h = pop.offsetHeight;
    const left = Math.max(4, Math.min(r.left, window.innerWidth - w - 8));
    const top = Math.max(4, Math.min(r.top, window.innerHeight - h - 8));
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
    pop.style.minWidth = r.width + 'px';
    pop.onmouseleave = () => { if (S.expandedKey === key) { S.expandedKey = null; renderMap(); } };
}

function armRowCollapse() {
    const openRow = document.querySelector('#fm-modal .fm-mrow-open');
    if (openRow) openRow.addEventListener('mouseleave', () => { if (S.modal && S.modal.expandedKey === openRow.dataset.mrow) { S.modal.expandedKey = null; renderModalBody(); } }, { once: true });
}

/** A full cell: the title says how many are out of sight and that clicking shows them all. */
function markOverflow() {
    for (const area of document.querySelectorAll('.fm-area')) {
        const box = area.querySelector('.fm-cards');
        const more = area.querySelector('.fm-area-more');
        if (!box || !more) continue;
        const bottom = box.getBoundingClientRect().bottom;
        let hidden = 0;
        for (const chip of box.children) if (chip.getBoundingClientRect().bottom > bottom + 2) hidden++;
        area.classList.toggle('fm-area-overflow', hidden > 0);
        more.textContent = hidden > 0 ? `+${hidden} more — expand to see all` : '';
    }
}

// ---------------------------------------------------------------- pop-ups

function openModal(kind, extra = {}) {
    S.modal = { kind, filter: '', selected: new Set(), ...extra };
    const search = $('fm-modal-search');
    search.value = '';
    search.hidden = false;
    search.placeholder = kind === 'log' ? 'Filter by job, cast, area or name' : 'Filter by job, cast or PM';
    $('fm-modal').hidden = false;
    renderModalBody();
    if (kind === 'log') refreshLog();
}
function closeModal() { S.modal = null; $('fm-modal').hidden = true; }

function renderModalBody() {
    if (!S.modal) return;
    const title = $('fm-modal-title');
    const body = $('fm-modal-body');
    const q = S.modal.filter;
    if (S.modal.kind === 'area') {
        const id = S.modal.areaId;
        const list = partition().onMap.filter(c => (S.placements.get(c.key)?.area || null) === id);
        title.textContent = `${areaLabel(id)} — ${list.length} ${list.length === 1 ? 'job' : 'jobs'}`;
        const rows = list.filter(c => matchesSearch(c, q));
        const keep = new Set(list.map(c => c.key));
        for (const k of [...S.modal.selected]) if (!keep.has(k)) S.modal.selected.delete(k);   // moved away or shipped: drop it
        body.innerHTML = bulkBarHtml(id, rows.map(c => c.key)) + (rows.length ? rows.map(c => modalRowHtml(c)).join('') : `<div class="fm-empty">${list.length ? 'No jobs match.' : 'Nothing here.'}</div>`);
        armRowCollapse();
    } else if (S.modal.kind === 'shipped') {
        const { shipped } = partition();
        title.textContent = `Shipped — last ${SHIPPED_WINDOW_DAYS} days (${shipped.length})`;
        const rows = shipped.filter(({ c }) => matchesSearch(c, q));
        body.innerHTML = rows.length ? rows.map(({ c, shippedOn }) => `<div class="fm-mrow" data-key="${escapeHtml(c.key)}">
            <div class="fm-mrow-text">
                <div class="fm-card-job">${escapeHtml(jobName(c))} <b>Cast ${escapeHtml(c.castingNumber)}</b> <span class="fm-card-pn">${escapeHtml(c.projectNumber)}</span></div>
                <div class="fm-card-meta">Shipped ${fmtDate(shippedOn)}${S.placements.get(c.key)?.moved_by ? ' · ' + escapeHtml(S.placements.get(c.key).moved_by) : ''}</div>
            </div>
            <button type="button" class="fm-mini-btn" data-action="unship" data-key="${escapeHtml(c.key)}">Put back on the map</button>
        </div>`).join('') : `<div class="fm-empty">${shipped.length ? 'No jobs match.' : `Nothing shipped in the last ${SHIPPED_WINDOW_DAYS} days.`}</div>`;
    } else if (S.modal.kind === 'log') {
        title.textContent = `Move log — last ${LOG_WINDOW_DAYS} days`;
        // One line per job (casting), newest activity first; click a line to see that job's moves.
        const groups = new Map();
        for (const r of S.log) {
            const key = placementKey(r.project_number, r.casting_number);
            if (!groups.has(key)) groups.set(key, { key, pn: r.project_number, cn: r.casting_number, rows: [] });
            groups.get(key).rows.push(r);
        }
        const describe = (r) => r.kind === 'shipped' ? `Shipped${r.from_area ? ' from ' + areaLabel(r.from_area) : ''}`
            : r.kind === 'put_back' ? 'Put back on the map'
            : `${areaLabel(r.from_area)} → ${areaLabel(r.to_area)}`;
        const when = (iso) => { const d = new Date(iso); return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };
        // Jobs sitting in the queue are not listed; a job that is in an area (or shipped) keeps its full history,
        // including the line that shows when it left the queue.
        let list = [...groups.values()].filter(g => { const row = S.placements.get(g.key); return !!(row && (row.area || row.shipped_on)); });
        if (q) list = list.filter(g => { const c = castingByKey(g.key); return `${c ? jobName(c) : ''} ${g.pn} cast ${g.cn} ${g.rows.map(r => describe(r) + ' ' + (r.moved_by || '')).join(' ')}`.toLowerCase().includes(q); });
        list.sort((a, b) => b.rows[0].moved_at.localeCompare(a.rows[0].moved_at));
        if (!list.length) { body.innerHTML = `<div class="fm-empty">${S.log.length ? (q ? 'No jobs match.' : 'No job is in an area right now.') : 'No moves logged yet.'}</div>`; return; }
        body.innerHTML = `<div class="fm-log-head-row"><span>Job</span><span>Where now</span><span>Last activity</span><span>Moves</span></div>` + list.map(g => {
            const c = castingByKey(g.key);
            const name = c ? jobName(c) : g.pn;
            const row = S.placements.get(g.key);
            const now = row && row.shipped_on ? `Shipped ${fmtDate(row.shipped_on)}` : (row && row.area ? areaLabel(row.area) : 'Queue');
            const last = g.rows[0];
            const open = S.modal.openKey === g.key;
            const detail = open ? `<div class="fm-log-detail">${g.rows.map(r => `<div class="fm-log-row"><span class="fm-log-time">${escapeHtml(when(r.moved_at))}</span><span class="fm-log-what">${escapeHtml(describe(r))}</span><span class="fm-log-who">${escapeHtml(r.moved_by || '')}</span></div>`).join('')}</div>` : '';
            return `<div class="fm-log-job-row${open ? ' fm-log-open' : ''}" data-log-key="${escapeHtml(g.key)}">
                <span class="fm-log-job"><span class="fm-log-caret">${open ? '&#9662;' : '&#9656;'}</span> ${escapeHtml(name)} <b>Cast ${escapeHtml(g.cn)}</b> <span class="fm-card-pn">${escapeHtml(g.pn)}</span></span>
                <span class="fm-log-now">${escapeHtml(now)}</span>
                <span class="fm-log-last">${escapeHtml(when(last.moved_at))} · ${escapeHtml(describe(last))}${last.moved_by ? ' · ' + escapeHtml(last.moved_by) : ''}</span>
                <span class="fm-log-n">${g.rows.length}</span>
            </div>${detail}`;
        }).join('');
    }
}

async function refreshLog() {
    if (isFinishingMapMigrationPending()) { S.log = []; if (S.modal?.kind === 'log') renderModalBody(); return; }
    S.log = await loadLog(LOG_WINDOW_DAYS);
    if (S.modal?.kind === 'log') renderModalBody();
}

function notice(text, kind = 'info') {
    const el = $('fm-notice');
    el.hidden = !text;
    el.textContent = text || '';
    el.className = `fm-notice fm-notice-${kind}`;
}

// ---------------------------------------------------------------- loading

async function loadAll({ silent = false } = {}) {
    if (S.loading) return;
    S.loading = true;
    if (!silent) notice('Loading the weekly…');
    try {
        const [tasks, projects, placements] = await Promise.all([
            fetchAllTasks(true),
            loadAllProjects().catch(err => { logger.warn('[finishing-map] projects failed', err); return []; }),
            loadPlacements()
        ]);
        S.projects = new Map((projects || []).map(p => [String(p.project_number || '').trim(), p]));
        S.castings = summariseCastings(tasks);
        S.placements = placements;
        const fresh = [...S.castings.values()].filter(c => !S.placements.has(c.key) && inFinishing(c) && !shippedOn(c));
        if (fresh.length && !isFinishingMapMigrationPending()) {
            try { await ensurePlacements(fresh); S.placements = await loadPlacements(); }
            catch (err) { logger.warn('[finishing-map] could not record new castings', err); }
        }
        const now = today();
        for (const c of S.castings.values()) {
            const row = S.placements.get(c.key);
            if (row && !row.shipped_on && c.lastShip && c.lastShip <= now && !isFinishingMapMigrationPending()) {
                try {
                    await setShipped(c.projectNumber, c.castingNumber, c.lastShip, 'weekly');
                    row.shipped_on = c.lastShip;
                    await logMove({ projectNumber: c.projectNumber, castingNumber: c.castingNumber, kind: 'shipped', fromArea: row.area || null, movedBy: 'weekly (Ship day passed)' });
                } catch (err) { logger.warn('[finishing-map] could not stamp shipped', err); }
            }
        }
        notice(isFinishingMapMigrationPending() ? 'The finishing_map table is not in the database yet — run migration/finishing-map.sql. Moves will not be saved until then.' : '', 'warn');
        renderMap();
        await refreshLog();
        $('fm-updated').textContent = 'Updated ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch (err) {
        logger.error('[finishing-map] load failed', err);
        notice('Could not load: ' + (err && err.message ? err.message : err), 'error');
    } finally {
        S.loading = false;
    }
}

async function reloadPlacementsOnly() {
    try { S.placements = await loadPlacements(); renderMap(); await refreshLog(); }
    catch (err) { logger.warn('[finishing-map] placements reload failed', err); }
}

// ---------------------------------------------------------------- moves

async function moveTo(key, areaId) {
    const c = castingByKey(key);
    if (!c) return;
    const current = S.placements.get(key)?.area || null;
    if ((areaId || null) === current) { S.selectedKey = null; renderMap(); return; }
    const prev = S.placements.get(key);
    S.placements.set(key, { ...(prev || { project_number: c.projectNumber, casting_number: c.castingNumber }), area: areaId || null, moved_by: who() || null, moved_at: new Date().toISOString() });
    S.selectedKey = null;
    renderMap();
    try {
        await setArea(c.projectNumber, c.castingNumber, areaId || null, who());
        await logMove({ projectNumber: c.projectNumber, castingNumber: c.castingNumber, kind: 'move', fromArea: current, toArea: areaId || null, movedBy: who() });
        await refreshLog();
    } catch (err) {
        logger.error('[finishing-map] move failed', err);
        notice('The move was not saved: ' + (err.message || err), 'error');
        await reloadPlacementsOnly();
    }
}

/** Redraw only the bar above the list (count, dropdown, button) after a tick. */
function refreshBulkBar() {
    const bar = document.querySelector('#fm-modal .fm-bulk');
    if (!bar || !S.modal || S.modal.kind !== 'area') return;
    const visible = [...document.querySelectorAll('#fm-modal input[data-check]')].map(b => b.dataset.check);
    const chosen = document.getElementById('fm-bulk-area')?.value || '';
    bar.outerHTML = bulkBarHtml(S.modal.areaId, visible);
    const sel = document.getElementById('fm-bulk-area');
    if (sel && chosen) sel.value = chosen;
}

/** Move several castings to one area, one write each; the pop-up stays open. */
async function moveMany(keys, areaId) {
    for (const key of keys) await moveTo(key, areaId);
    if (S.modal) { S.modal.selected.clear(); renderModalBody(); }
}

async function ship(key, undo = false) {
    const c = castingByKey(key);
    if (!c) return;
    const label = `${jobName(c)} — Cast ${c.castingNumber}`;
    if (!undo && !window.confirm(`Mark ${label} as shipped? It leaves the map and stays in the Shipped list for ${SHIPPED_WINDOW_DAYS} days.`)) return;
    const prev = S.placements.get(key) || { project_number: c.projectNumber, casting_number: c.castingNumber, area: null };
    S.placements.set(key, { ...prev, shipped_on: undo ? null : today() });
    renderMap();
    try {
        await setShipped(c.projectNumber, c.castingNumber, undo ? null : today(), who());
        await logMove({ projectNumber: c.projectNumber, castingNumber: c.castingNumber, kind: undo ? 'put_back' : 'shipped', fromArea: prev.area || null, movedBy: who() });
        await refreshLog();
    } catch (err) {
        logger.error('[finishing-map] ship failed', err);
        notice('Not saved: ' + (err.message || err), 'error');
        await reloadPlacementsOnly();
    }
}

function wireEvents() {
    const app = $('fm-app');

    // Drag and drop
    app.addEventListener('dragstart', (e) => {
        const card = e.target.closest('[draggable="true"][data-key]');
        if (!card) return;
        e.dataTransfer.setData('text/plain', card.dataset.key);
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('fm-card-dragging');
    });
    app.addEventListener('dragend', (e) => { e.target.closest?.('[data-key]')?.classList.remove('fm-card-dragging'); });
    app.addEventListener('dragover', (e) => {
        const zone = e.target.closest('[data-area]');
        if (!zone) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        zone.classList.add('fm-drop-hover');
    });
    app.addEventListener('dragleave', (e) => { e.target.closest?.('[data-area]')?.classList.remove('fm-drop-hover'); });
    app.addEventListener('change', (e) => {
        const sel = e.target.closest('select[data-move-one]');
        if (sel && sel.value) { const v = sel.value; S.expandedKey = null; moveTo(sel.dataset.moveOne, v === '__queue' ? null : v); }
    });
    app.addEventListener('drop', (e) => {
        const zone = e.target.closest('[data-area]');
        if (!zone) return;
        e.preventDefault();
        zone.classList.remove('fm-drop-hover');
        const key = e.dataTransfer.getData('text/plain');
        if (key) moveTo(key, zone.dataset.area || null);
    });

    // Clicks on the map: card buttons, area titles, tap-to-move
    app.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (btn) {
            if (btn.dataset.action === 'ship') ship(btn.dataset.key);
            if (btn.dataset.action === 'unship') ship(btn.dataset.key, true);
            return;
        }
        const head = e.target.closest('[data-open-area]');
        if (head) { S.selectedKey = null; renderMap(); openModal('area', { areaId: head.dataset.openArea }); return; }
        if (e.target.closest('select')) return;
        const card = e.target.closest('[draggable="true"][data-key]');
        if (card) {
            if (card.classList.contains('fm-chip') || card.dataset.expanded) {        // inside an area: open / close the full card
                S.expandedKey = S.expandedKey === card.dataset.key ? null : card.dataset.key;
                S.selectedKey = null;
            } else {                                                                   // queue card: tap, then tap an area
                S.selectedKey = S.selectedKey === card.dataset.key ? null : card.dataset.key;
            }
            renderMap();
            return;
        }
        const zone = e.target.closest('[data-area]');
        if (zone && S.selectedKey) { moveTo(S.selectedKey, zone.dataset.area || null); return; }
        if (S.selectedKey && !e.target.closest('.fm-header')) { S.selectedKey = null; renderMap(); return; }
        if (S.expandedKey && !e.target.closest('#fm-popover')) { S.expandedKey = null; renderMap(); }   // tap anywhere else closes the open card (touch screens)
    });

    // Pop-up: Move dropdown, Shipped / Put back, close
    const modal = $('fm-modal');
    modal.addEventListener('change', (e) => {
        if (!S.modal) return;
        const box = e.target.closest('input[data-check]');
        if (box) {
            if (box.checked) S.modal.selected.add(box.dataset.check); else S.modal.selected.delete(box.dataset.check);
            box.closest('.fm-mrow')?.classList.toggle('fm-mrow-checked', box.checked);
            refreshBulkBar();
            return;
        }
        if (e.target.id === 'fm-sel-all') {
            for (const b of modal.querySelectorAll('input[data-check]')) {
                b.checked = e.target.checked;
                if (b.checked) S.modal.selected.add(b.dataset.check); else S.modal.selected.delete(b.dataset.check);
                b.closest('.fm-mrow')?.classList.toggle('fm-mrow-checked', b.checked);
            }
            refreshBulkBar();
        }
    });
    modal.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (btn) {
            e.preventDefault();
            if (btn.dataset.action === 'ship') ship(btn.dataset.key);
            if (btn.dataset.action === 'unship') ship(btn.dataset.key, true);
            return;
        }
        const txt = e.target.closest('[data-expand]');
        if (txt && S.modal && S.modal.kind === 'area') {
            S.modal.expandedKey = S.modal.expandedKey === txt.dataset.expand ? null : txt.dataset.expand;
            renderModalBody();
            return;
        }
        const jobRow = e.target.closest('[data-log-key]');
        if (jobRow && S.modal && S.modal.kind === 'log') {
            S.modal.openKey = S.modal.openKey === jobRow.dataset.logKey ? null : jobRow.dataset.logKey;
            renderModalBody();
            return;
        }
        if (e.target.closest('#fm-bulk-move')) {
            const area = $('fm-bulk-area').value;
            if (!area) { $('fm-bulk-area').focus(); return; }
            moveMany([...S.modal.selected], area === '__queue' ? null : area);
            return;
        }
        if (e.target === modal || e.target.closest('#fm-modal-close')) closeModal();
    });
    $('fm-modal-search').addEventListener('input', (e) => { if (S.modal) { S.modal.filter = e.target.value.trim().toLowerCase(); renderModalBody(); } });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (S.modal) closeModal();
        else if (S.selectedKey) { S.selectedKey = null; renderMap(); }
    });

    $('fm-search').addEventListener('input', (e) => { S.search = e.target.value.trim().toLowerCase(); renderMap(); });
    $('fm-refresh').addEventListener('click', () => loadAll());
    $('fm-shipped-btn').addEventListener('click', () => openModal('shipped'));
    $('fm-log-btn').addEventListener('click', () => openModal('log'));

    const whoInput = $('fm-who');
    try { whoInput.value = localStorage.getItem(WHO_KEY) || ''; } catch { /* storage blocked */ }
    whoInput.addEventListener('change', () => { try { localStorage.setItem(WHO_KEY, whoInput.value.trim()); } catch { /* ignore */ } });

    window.addEventListener('resize', markOverflow);

    // Other pages' saves: the finishing_map tables reload alone, anything else reloads all.
    registerRefreshHandler(async (payload, payloads) => {
        const batch = Array.isArray(payloads) && payloads.length ? payloads : [payload];
        const tables = new Set(batch.filter(isPortalChange).map(p => signalInfo(p).table));
        const onlyOurs = batch.every(isPortalChange) && [...tables].every(t => t === 'finishing_map' || t === 'finishing_map_log');
        if (onlyOurs) await reloadPlacementsOnly();
        else await loadAll({ silent: true });
    });
}

// ---------------------------------------------------------------- boot

(async function boot() {
    if (document.getElementById('ro-test-count') || document.querySelector('[style*="99999"]')) document.body.classList.add('fm-has-test-bar');
    wireEvents();
    renderMap();
    try { await initializeSupabase(); } catch (err) { logger.warn('[finishing-map] supabase init failed', err); }
    await loadAll();
    if (document.getElementById('ro-test-count')) document.body.classList.add('fm-has-test-bar');
})();

// Console hook for checks on the test copy.
window.__finishingMap = { state: S, partition, reload: loadAll, openModal };
