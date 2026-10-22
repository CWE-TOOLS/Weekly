/**
 * Finishing Map — where each casting physically sits once it reaches finishing.
 *
 * Reads the weekly (fetchAllTasks: Google Sheet + manual tasks + inventory summary) and the finishing_map table:
 *   - a casting enters the QUEUE on its first Finish day (FINISHING_DEPARTMENTS) that is today or earlier,
 *     or as soon as it has a placement row (so it survives the month rolling off the sheet);
 *   - it LEAVES the map when its last Ship day is past, the job is Shipped / Closed Out, or someone presses "Shipped";
 *     it then sits in the Shipped drawer for SHIPPED_WINDOW_DAYS.
 * Moves: drag a card onto an area (or the queue), or tap the card and then tap the area. Every move is written to
 * finishing_map and announced to the other open pages, which reload.
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
const SHIPPED_OPEN_KEY = 'finishingMapShippedOpen';

const S = {
    castings: new Map(),     // key -> casting summary built from the weekly
    placements: new Map(),   // key -> finishing_map row
    projects: new Map(),     // project_number -> { project_name, status, pm }
    selectedKey: null,       // tap-to-move: the card waiting for an area
    search: '',
    loading: false,
    log: [],
    logSearch: ''
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
    // The sheet name usually ends with "Cast #N" / "- Cast N": strip it so the card reads "Job" + "Cast N".
    return (c.sheetName || c.projectNumber).replace(/\s*[-–]?\s*cast\s*#?\s*[\w.]+\s*$/i, '').trim() || c.sheetName;
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
    if (S.placements.has(c.key)) return true;                       // seen before: stays until shipped
    return !!(c.firstFinish && c.firstFinish <= today());
}

/** Castings on the map (queue + areas) and the ones in the shipped drawer. */
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
    // Placement rows whose casting is no longer on the weekly at all (month rolled off): keep them on the map until shipped.
    for (const [key, row] of S.placements) {
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

function matchesSearch(c) {
    if (!S.search) return true;
    const hay = `${jobName(c)} ${c.sheetName} ${c.projectNumber} cast ${c.castingNumber} ${(projectOf(c.projectNumber) || {}).pm || ''}`.toLowerCase();
    return hay.includes(S.search);
}

// ---------------------------------------------------------------- render

function cardHtml(c, { inDrawer = false, shippedOnDate = null } = {}) {
    const row = S.placements.get(c.key);
    const p = projectOf(c.projectNumber);
    const inv = c.inv ? `${c.inv.types} types · ${c.inv.pcs} pcs` : '';
    const finish = c.finishDays ? `Finish day ${Math.min(c.finishDaysDone, c.finishDays) || 1} of ${c.finishDays}` : (c.offSheet ? 'No longer on the weekly' : '');
    const next = c.next ? `Next: ${c.next.department} ${fmtDate(c.next.date)}` : (c.lastShip ? `Ship ${fmtDate(c.lastShip)}` : '');
    const moved = row && row.moved_at ? `${row.moved_by ? escapeHtml(row.moved_by) + ' · ' : ''}${new Date(row.moved_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}` : '';
    const selected = S.selectedKey === c.key ? ' fm-card-selected' : '';
    const dim = matchesSearch(c) ? '' : ' fm-card-dim';
    const stale = !inDrawer && (c.offSheet || (c.lastDate && c.lastDate < daysAgo(STALE_AFTER_DAYS)));
    const staleNote = stale ? (c.lastDate ? `No weekly days since ${fmtDate(c.lastDate)} — shipped?` : 'Not on the weekly any more — shipped?') : '';
    return `<div class="fm-card${selected}${dim}${stale ? ' fm-card-stale' : ''}" draggable="${inDrawer ? 'false' : 'true'}" data-key="${escapeHtml(c.key)}" title="${escapeHtml(c.sheetName || jobName(c))}">
        <div class="fm-card-job">${escapeHtml(jobName(c))}</div>
        <div class="fm-card-cast">Cast ${escapeHtml(c.castingNumber)}<span class="fm-card-pn">${escapeHtml(c.projectNumber)}</span></div>
        ${p && p.pm ? `<div class="fm-card-meta">${escapeHtml(p.pm)}</div>` : ''}
        ${inv ? `<div class="fm-card-meta">${escapeHtml(inv)}</div>` : ''}
        ${finish ? `<div class="fm-card-meta fm-card-finish">${escapeHtml(finish)}</div>` : ''}
        ${next ? `<div class="fm-card-meta">${escapeHtml(next)}</div>` : ''}
        ${staleNote ? `<div class="fm-card-meta fm-card-stale-note">${escapeHtml(staleNote)}</div>` : ''}
        ${inDrawer
            ? `<div class="fm-card-foot">Shipped ${fmtDate(shippedOnDate)} <button type="button" class="fm-mini-btn" data-action="unship" data-key="${escapeHtml(c.key)}">Put back</button></div>`
            : `<div class="fm-card-foot">${moved ? `<span class="fm-card-moved">${moved}</span>` : '<span></span>'}<button type="button" class="fm-mini-btn" data-action="ship" data-key="${escapeHtml(c.key)}" title="Mark this casting as shipped">Shipped</button></div>`}
    </div>`;
}

function renderMap() {
    const map = $('fm-map');
    if (!map.children.length) {
        const groups = new Map();
        map.innerHTML = FINISHING_AREAS.map(a => `<section class="fm-area${a.group ? ' fm-area-coop' : ''}" data-area="${a.id}" style="grid-area:${a.grid}">
            <div class="fm-area-head"><span class="fm-area-label">${escapeHtml(a.label)}</span><span class="fm-area-count" data-count="${a.id}">0</span></div>
            <div class="fm-cards" data-cards="${a.id}"></div>
        </section>`).join('');
        for (const a of FINISHING_AREAS) if (a.group && !groups.has(a.group)) { groups.set(a.group, true); }
        for (const g of groups.keys()) {
            const label = document.createElement('div');
            label.className = 'fm-group-label';
            label.style.gridArea = 'cooplabel';
            label.textContent = g;
            map.appendChild(label);
        }
    }
    const { onMap, shipped } = partition();
    const byArea = new Map(FINISHING_AREAS.map(a => [a.id, []]));
    const queue = [];
    for (const c of onMap) {
        const area = S.placements.get(c.key)?.area;
        if (area && byArea.has(area)) byArea.get(area).push(c); else queue.push(c);
    }
    $('fm-queue-cards').innerHTML = queue.map(c => cardHtml(c)).join('') || '<div class="fm-empty">Nothing waiting.</div>';
    $('fm-queue-count').textContent = String(queue.length);
    for (const [id, list] of byArea) {
        const box = map.querySelector(`[data-cards="${id}"]`);
        if (box) box.innerHTML = list.map(c => cardHtml(c)).join('');
        const n = map.querySelector(`[data-count="${id}"]`);
        if (n) n.textContent = String(list.length);
    }
    $('fm-shipped-count').textContent = String(shipped.length);
    $('fm-shipped-body').innerHTML = shipped.length
        ? `<div class="fm-cards fm-cards-drawer">${shipped.map(({ c, shippedOn }) => cardHtml(c, { inDrawer: true, shippedOnDate: shippedOn })).join('')}</div>`
        : '<div class="fm-empty">Nothing shipped in the last 60 days.</div>';
    document.body.classList.toggle('fm-selecting', !!S.selectedKey);
}

function renderLog() {
    const body = $('fm-log-body');
    const q = S.logSearch;
    const rows = S.log.filter(r => {
        if (!q) return true;
        const c = castingByKey(placementKey(r.project_number, r.casting_number));
        const hay = `${c ? jobName(c) : ''} ${r.project_number} cast ${r.casting_number} ${areaLabel(r.from_area)} ${areaLabel(r.to_area)} ${r.moved_by || ''}`.toLowerCase();
        return hay.includes(q);
    });
    if (!rows.length) { body.innerHTML = `<div class="fm-empty">${S.log.length ? 'No moves match.' : 'No moves logged yet.'}</div>`; return; }
    let lastDay = '';
    const parts = [];
    for (const r of rows) {
        const when = new Date(r.moved_at);
        const day = when.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', year: 'numeric' });
        if (day !== lastDay) { parts.push(`<div class="fm-log-day">${escapeHtml(day)}</div>`); lastDay = day; }
        const c = castingByKey(placementKey(r.project_number, r.casting_number));
        const name = c ? jobName(c) : r.project_number;
        const what = r.kind === 'shipped' ? `<span class="fm-log-ship">Shipped</span>${r.from_area ? ` from ${escapeHtml(areaLabel(r.from_area))}` : ''}`
            : r.kind === 'put_back' ? `<span class="fm-log-ship">Put back</span> on the map`
            : `${escapeHtml(areaLabel(r.from_area))} <span class="fm-log-arrow">&rarr;</span> <strong>${escapeHtml(areaLabel(r.to_area))}</strong>`;
        parts.push(`<div class="fm-log-row"><span class="fm-log-time">${when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span><span class="fm-log-job">${escapeHtml(name)} <b>Cast ${escapeHtml(r.casting_number)}</b></span><span class="fm-log-what">${what}</span><span class="fm-log-who">${escapeHtml(r.moved_by || '')}</span></div>`);
    }
    body.innerHTML = parts.join('');
}

async function refreshLog() {
    if (isFinishingMapMigrationPending()) { S.log = []; renderLog(); return; }
    S.log = await loadLog(LOG_WINDOW_DAYS);
    renderLog();
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
        // Castings that just reached finishing get a row so they stay on the map when their weeks roll off the sheet.
        const fresh = [...S.castings.values()].filter(c => !S.placements.has(c.key) && inFinishing(c) && !shippedOn(c));
        if (fresh.length && !isFinishingMapMigrationPending()) {
            try { await ensurePlacements(fresh); S.placements = await loadPlacements(); }
            catch (err) { logger.warn('[finishing-map] could not record new castings', err); }
        }
        // A placed casting whose last Ship day has passed is shipped: record the date so the drawer keeps it after the sheet forgets.
        const now = today();
        for (const c of S.castings.values()) {
            const row = S.placements.get(c.key);
            if (row && !row.shipped_on && c.lastShip && c.lastShip <= now && !isFinishingMapMigrationPending()) {
                try { await setShipped(c.projectNumber, c.castingNumber, c.lastShip, 'weekly'); row.shipped_on = c.lastShip; await logMove({ projectNumber: c.projectNumber, castingNumber: c.castingNumber, kind: 'shipped', fromArea: row.area || null, movedBy: 'weekly (Ship day passed)' }); }
                catch (err) { logger.warn('[finishing-map] could not stamp shipped', err); }
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

function castingByKey(key) {
    const c = S.castings.get(key);
    if (c) return c;
    const row = S.placements.get(key);
    return row ? { key, projectNumber: row.project_number, castingNumber: row.casting_number } : null;
}

async function moveTo(key, areaId) {
    const c = castingByKey(key);
    if (!c) return;
    const current = S.placements.get(key)?.area || null;
    if ((areaId || null) === current) { S.selectedKey = null; renderMap(); return; }
    // Optimistic: show it there now, write, reload on failure.
    const prev = S.placements.get(key);
    S.placements.set(key, { ...(prev || { project_number: c.projectNumber, casting_number: c.castingNumber }), area: areaId || null, moved_by: who() || null, moved_at: new Date().toISOString() });
    S.selectedKey = null;
    renderMap();
    try {
        await setArea(c.projectNumber, c.castingNumber, areaId || null, who());
        await logMove({ projectNumber: c.projectNumber, castingNumber: c.castingNumber, kind: 'move', fromArea: current, toArea: areaId || null, movedBy: who() });
        await refreshLog();
    }
    catch (err) { logger.error('[finishing-map] move failed', err); notice('The move was not saved: ' + (err.message || err), 'error'); await reloadPlacementsOnly(); }
}

async function ship(key, undo = false) {
    const c = castingByKey(key);
    if (!c) return;
    const label = `${jobName(c)} — Cast ${c.castingNumber}`;
    if (!undo && !window.confirm(`Mark ${label} as shipped? It leaves the map and sits in the Shipped drawer for ${SHIPPED_WINDOW_DAYS} days.`)) return;
    const prev = S.placements.get(key) || { project_number: c.projectNumber, casting_number: c.castingNumber, area: null };
    S.placements.set(key, { ...prev, shipped_on: undo ? null : today() });
    renderMap();
    try {
        await setShipped(c.projectNumber, c.castingNumber, undo ? null : today(), who());
        await logMove({ projectNumber: c.projectNumber, castingNumber: c.castingNumber, kind: undo ? 'put_back' : 'shipped', fromArea: prev.area || null, movedBy: who() });
        await refreshLog();
    }
    catch (err) { logger.error('[finishing-map] ship failed', err); notice('Not saved: ' + (err.message || err), 'error'); await reloadPlacementsOnly(); }
}

function wireEvents() {
    const app = $('fm-app');

    // Drag and drop (mouse / pen / most tablets)
    app.addEventListener('dragstart', (e) => {
        const card = e.target.closest('.fm-card[draggable="true"]');
        if (!card) return;
        e.dataTransfer.setData('text/plain', card.dataset.key);
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('fm-card-dragging');
    });
    app.addEventListener('dragend', (e) => { e.target.closest?.('.fm-card')?.classList.remove('fm-card-dragging'); });
    app.addEventListener('dragover', (e) => {
        const zone = e.target.closest('[data-area]');
        if (!zone) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        zone.classList.add('fm-drop-hover');
    });
    app.addEventListener('dragleave', (e) => { e.target.closest?.('[data-area]')?.classList.remove('fm-drop-hover'); });
    app.addEventListener('drop', (e) => {
        const zone = e.target.closest('[data-area]');
        if (!zone) return;
        e.preventDefault();
        zone.classList.remove('fm-drop-hover');
        const key = e.dataTransfer.getData('text/plain');
        if (key) moveTo(key, zone.dataset.area || null);
    });

    // Tap to move: tap a card, then tap an area (or the queue). Buttons on the card do their own thing.
    app.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (btn) {
            if (btn.dataset.action === 'ship') ship(btn.dataset.key);
            if (btn.dataset.action === 'unship') ship(btn.dataset.key, true);
            return;
        }
        const card = e.target.closest('.fm-card[draggable="true"]');
        if (card) {
            S.selectedKey = S.selectedKey === card.dataset.key ? null : card.dataset.key;
            renderMap();
            return;
        }
        const zone = e.target.closest('[data-area]');
        if (zone && S.selectedKey) { moveTo(S.selectedKey, zone.dataset.area || null); return; }
        if (S.selectedKey && !e.target.closest('.fm-header')) { S.selectedKey = null; renderMap(); }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.selectedKey) { S.selectedKey = null; renderMap(); } });

    $('fm-search').addEventListener('input', (e) => { S.search = e.target.value.trim().toLowerCase(); renderMap(); });
    $('fm-refresh').addEventListener('click', () => loadAll());

    const whoInput = $('fm-who');
    try { whoInput.value = localStorage.getItem(WHO_KEY) || ''; } catch { /* storage blocked */ }
    whoInput.addEventListener('change', () => { try { localStorage.setItem(WHO_KEY, whoInput.value.trim()); } catch { /* ignore */ } });

    const logPanel = $('fm-log');
    const logBtn = $('fm-log-btn');
    const setLogOpen = (open) => { logPanel.hidden = !open; logBtn.setAttribute('aria-expanded', String(open)); if (open) refreshLog(); };
    logBtn.addEventListener('click', () => setLogOpen(logPanel.hidden));
    $('fm-log-close').addEventListener('click', () => setLogOpen(false));
    $('fm-log-search').addEventListener('input', (e) => { S.logSearch = e.target.value.trim().toLowerCase(); renderLog(); });

    const toggle = $('fm-shipped-toggle');
    const body = $('fm-shipped-body');
    const setOpen = (open) => { body.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); try { localStorage.setItem(SHIPPED_OPEN_KEY, open ? '1' : ''); } catch { /* ignore */ } };
    toggle.addEventListener('click', () => setOpen(body.hidden));
    try { if (localStorage.getItem(SHIPPED_OPEN_KEY)) setOpen(true); } catch { /* ignore */ }

    // Other pages' saves (portal / weekly / another map): the finishing_map table reloads alone, anything else reloads all.
    registerRefreshHandler(async (payload, payloads) => {
        const batch = Array.isArray(payloads) && payloads.length ? payloads : [payload];
        const tables = new Set(batch.filter(isPortalChange).map(p => signalInfo(p).table));
        if (batch.every(isPortalChange) && tables.size === 1 && tables.has('finishing_map')) await reloadPlacementsOnly();
        else await loadAll({ silent: true });
    });
}

// ---------------------------------------------------------------- boot

(async function boot() {
    wireEvents();
    renderMap();
    try { await initializeSupabase(); } catch (err) { logger.warn('[finishing-map] supabase init failed', err); }
    await loadAll();
})();

// Console hook for checks on the test copy.
window.__finishingMap = { state: S, partition, reload: loadAll };
