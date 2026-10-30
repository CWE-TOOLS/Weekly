/**
 * Week batch print (user 2026-10-30): every batch ticket of the castings that cast in one week, in one document,
 * followed by the materials rolled up per cast day and for the whole week.
 *
 * Opened from the weekly ("Batch tickets (week)" button) as week-batch-print.html?week=<Monday ISO>. The weekly leaves
 * the week's Cast cards in sessionStorage (weekBatchPrint:<Monday>); without that the page reads the Plant Scheduler's
 * Cast rows for the week itself, so the link can be shared.
 *
 * Standard jobs render through services/batch-ticket-render.js — the very code the Project Portal prints with.
 * Special jobs (special-batching.js: Jane Street) render through their own page, loaded hidden, which exposes
 * window.jsbWeekTickets(). Printing stamps "Batching Sheets" on the Releasability Board exactly as the portal does:
 * green, or orange with the inventory marker when the Casting Inventory was not final.
 *
 * @module pages/week-batch/week-batch-page
 */
import { initializeSupabase, getSupabaseClient } from '../../services/supabase-service.js';
import { loadProject } from '../../services/projects-service.js';
import { loadCastings } from '../../services/castings-service.js';
import { loadColorLogsForProject } from '../../services/color-log-service.js';
import { loadBatchTicketsForCastings } from '../../services/batch-ticket-service.js';
import { loadAllComponentsForProject } from '../../services/tracking-service.js';
import { loadAllInventoryForProject } from '../../services/inventory-service.js';
import { loadMilestonesForProjects, saveMilestone } from '../../services/milestones-service.js';
import { MS, milestonesApply } from '../../config/milestones-config.js';
import { getSpecialBatching } from '../../config/special-batching.js';
import { buildTicketPages, batchTotalsRows, sumTotalsRows, renderTotalsTable, BATCH_PRINT_CSS, SLUMP_TARGET_DEFAULTS, clampSlumpTarget } from '../../services/batch-ticket-render.js';
import { EARLY_PRINT_NOTE, invEarlyMarksRows, withInvMark } from '../../services/inventory-marks.js';
import { escapeHtml } from '../../utils/security-utils.js';
import { logger } from '../../utils/logger.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const WEEK = (params.get('week') || '').slice(0, 10);          // Monday, YYYY-MM-DD

const S = { items: [], projects: new Map(), frames: new Map(), printedOn: null, stamped: false };

// ---- dates ------------------------------------------------------------------------------------------------------
function isoToMdy(iso) { const [y, m, d] = iso.split('-').map(Number); return `${m}/${d}/${y}`; }
function mdyToIso(mdy) { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(mdy || '').trim()); return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : ''; }
function addDays(iso, n) { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function longDay(iso) { return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }); }
function shortDay(iso) { return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }); }
function weekLabel() { return `${longDay(WEEK)} – ${longDay(addDays(WEEK, 5))}, ${WEEK.slice(0, 4)}`; }

// ---- which castings cast this week ------------------------------------------------------------------------------
function readHandoff() {
    try { const raw = sessionStorage.getItem('weekBatchPrint:' + WEEK); return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
}
/** Fallback: the Plant Scheduler's Cast rows for the week (project + casting number + first cast day). */
async function fromScheduler() {
    if (!getSupabaseClient()) await initializeSupabase();
    const client = getSupabaseClient();
    const { data, error } = await client.from('plant_schedule').select('project_number, casting_id, date, task')
        .eq('department', 'Cast').gte('date', WEEK).lte('date', addDays(WEEK, 6)).order('date');
    if (error) throw error;
    const ids = [...new Set((data || []).map(r => r.casting_id))];
    const casts = ids.length ? (await client.from('project_castings').select('id, project_number, casting_number').in('id', ids)).data || [] : [];
    const byId = new Map(casts.map(c => [c.id, c]));
    const out = [];
    for (const r of data || []) {
        const c = byId.get(r.casting_id);
        if (!c) continue;
        if (out.some(o => o.projectNumber === String(c.project_number) && o.castingNumber === String(c.casting_number))) continue;
        out.push({ projectNumber: String(c.project_number).trim(), castingNumber: String(c.casting_number).trim(), date: isoToMdy(String(r.date).slice(0, 10)) });
    }
    return out;
}

// ---- one project's data -------------------------------------------------------------------------------------------
async function loadProjectData(pn) {
    const [project, castings, logs] = await Promise.all([loadProject(pn), loadCastings(pn), loadColorLogsForProject(pn)]);
    const ids = (castings || []).map(c => c.id);
    const [tickets, comps, inv] = await Promise.all([
        loadBatchTicketsForCastings(ids),
        loadAllComponentsForProject(ids).catch(() => new Map()),
        loadAllInventoryForProject(ids).catch(() => new Map())
    ]);
    const slump = {
        face: clampSlumpTarget(project?.target_slump_face, SLUMP_TARGET_DEFAULTS.face),
        firstBackUp: clampSlumpTarget(project?.target_slump_first_backup, SLUMP_TARGET_DEFAULTS.firstBackUp),
        finalBackUp: clampSlumpTarget(project?.target_slump_final_backup, SLUMP_TARGET_DEFAULTS.finalBackUp)
    };
    return { pn, project, castings: castings || [], logs: logs || [], tickets: tickets || new Map(), comps: comps || new Map(), inv: inv || new Map(), slump, special: getSpecialBatching(pn) };
}

/** The special job's own batching page, loaded hidden; resolves with its window once jsbWeekTickets exists. */
function specialFrame(pn, href) {
    if (S.frames.has(pn)) return S.frames.get(pn);
    const p = new Promise((resolve, reject) => {
        const f = document.createElement('iframe');
        f.className = 'wb-hidden-frame';
        f.src = `${href}?project=${encodeURIComponent(pn)}`;
        document.body.appendChild(f);
        const t0 = Date.now();
        const poll = () => {
            try { if (f.contentWindow && typeof f.contentWindow.jsbWeekTickets === 'function') return resolve(f.contentWindow); } catch (_) { /* not ready */ }
            if (Date.now() - t0 > 90000) return reject(new Error(`${href} did not load for ${pn}`));
            setTimeout(poll, 250);
        };
        poll();
    });
    S.frames.set(pn, p);
    return p;
}

// ---- build ----------------------------------------------------------------------------------------------------------
async function build() {
    const status = $('wb-status');
    status.textContent = 'Reading the week…';
    let items = readHandoff();
    if (!items) items = await fromScheduler();
    items = (items || []).filter(i => i.projectNumber && i.castingNumber);
    items.sort((a, b) => (mdyToIso(a.date) || '').localeCompare(mdyToIso(b.date) || '') || a.projectNumber.localeCompare(b.projectNumber) || String(a.castingNumber).localeCompare(String(b.castingNumber), undefined, { numeric: true }));
    S.items = items;
    $('wb-title').textContent = `Batch tickets — week of ${weekLabel()}`;
    if (!items.length) { status.textContent = 'No castings are scheduled to cast this week.'; return; }

    const pns = [...new Set(items.map(i => i.projectNumber))];
    status.textContent = `Loading ${pns.length} job${pns.length === 1 ? '' : 's'}…`;
    const datas = await Promise.all(pns.map(pn => loadProjectData(pn).catch(err => { logger.error('[week-batch] load failed', pn, err); return { pn, error: err }; })));
    for (const d of datas) S.projects.set(d.pn, d);
    const ms = await loadMilestonesForProjects(pns).catch(() => ({ byCasting: new Map(), touched: new Set() }));

    S.printedOn = new Date();
    const results = [];
    for (const it of items) {
        const d = S.projects.get(it.projectNumber);
        const r = { ...it, pages: '', rows: [], batches: 0, reason: null, casting: null, projectName: d?.project?.project_name || it.projectName || '' };
        results.push(r);
        if (!d || d.error) { r.reason = 'job could not be loaded'; continue; }
        const casting = d.castings.find(c => String(c.casting_number).trim() === String(it.castingNumber).trim());
        if (!casting) { r.reason = 'casting not in the portal'; continue; }
        r.casting = casting;
        r.onBoard = milestonesApply(it.projectNumber);
        r.ciFinal = (ms.byCasting.get(casting.id)?.get('Casting Inventory')?.status || MS.RED) === MS.GREEN;
        r.invRows = d.inv.get(casting.id) || [];
        if (d.special) {
            try {
                const w = await specialFrame(it.projectNumber, d.special.href);
                const [res] = await w.jsbWeekTickets([casting.id], S.printedOn, { [casting.id]: it.date });
                r.pages = res?.pages || ''; r.rows = res?.rows || []; r.batches = res?.batches || 0; r.reason = res?.reason || (r.pages ? null : 'no batch ticket');
            } catch (err) { logger.error('[week-batch] special page failed', err); r.reason = 'the ' + d.special.label + ' page could not build the tickets'; }
        } else {
            const out = buildTicketPages({
                casting, projectName: r.projectName, tickets: d.tickets.get(casting.id) || [], logs: d.logs, components: d.comps.get(casting.id) || [],
                slumpTargets: d.slump, printedOn: S.printedOn, castDate: it.date
            });
            r.pages = out.pages; r.rows = batchTotalsRows(out.entries); r.batches = out.batches; r.reason = out.reason;
        }
    }
    S.results = results;
    render(results);
    status.textContent = '';
}

function coverHtml(results) {
    const printable = results.filter(r => r.pages);
    const rows = results.map(r => `<tr class="${r.pages ? '' : 'wb-miss'}"><td>${escapeHtml(r.date || '')}</td><td>${escapeHtml(r.projectNumber)} · ${escapeHtml(r.projectName)}</td><td>Cast ${escapeHtml(r.castingNumber)}</td><td class="wb-num">${r.batches || ''}</td><td>${r.pages ? (r.onBoard && !r.ciFinal ? '<span class="wb-warn">inventory not final</span>' : 'tickets') : '<span class="wb-warn">no tickets — ' + escapeHtml(r.reason || '') + '</span>'}</td></tr>`).join('');
    const totalBatches = printable.reduce((n, r) => n + r.batches, 0);
    return `<div class="bt-page wb-cover">
        <h1>Batch tickets — week of ${escapeHtml(weekLabel())}</h1>
        <div class="wb-sub">Printed ${escapeHtml(S.printedOn.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }))} · ${printable.length} casting${printable.length === 1 ? '' : 's'} · ${totalBatches} batch${totalBatches === 1 ? '' : 'es'}</div>
        <table class="wb-list"><thead><tr><th>Cast day</th><th>Job</th><th>Casting</th><th class="wb-num">Batches</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
        <div class="wb-hint">Each casting's tickets follow in cast-day order. The materials for each cast day and for the whole week are on the last pages.</div>
    </div>`;
}

function totalsHtml(results) {
    const printable = results.filter(r => r.pages && r.rows.length);
    if (!printable.length) return '';
    const days = [...new Set(printable.map(r => mdyToIso(r.date)).filter(Boolean))].sort();
    let html = '';
    for (const day of days) {
        const list = printable.filter(r => mdyToIso(r.date) === day);
        const dayRows = sumTotalsRows(list.map(r => r.rows));
        const who = list.map(r => r.projectNumber + ' cast ' + r.castingNumber).join(', ');
        const table = renderTotalsTable(dayRows, `Mix Day Totals — ${longDay(day)} · ${who} — all materials`);
        if (table) html += `<div class="bt-page wb-totals">${keyMaterialsHtml(dayRows, `Key materials — ${longDay(day)} · ${who}`)}${table}</div>`;
    }
    const weekRows = sumTotalsRows(printable.map(r => r.rows));
    const week = renderTotalsTable(weekRows, `All materials for the week — ${printable.length} casting${printable.length === 1 ? '' : 's'}`);
    if (week) html += `<div class="bt-page wb-totals wb-week">${keyMaterialsHtml(weekRows, `Key materials for the week — ${weekLabel()}`)}${week}</div>`;
    return html;
}

/** The five materials the plant orders by (user 2026-10-30): Q-Rok sand, Cowbay (bulk sand), Pozzotive, Portland and
 *  Cemfil fibers — each summed across every spelling the colour logs use. Plain "Sand" is NOT Q-Rok: it is listed
 *  on its own line underneath so nothing is hidden. */
// bucket = the weight of one bucket of that material (user 2026-10-30): the plant stages whole buckets before the week
const KEY_MATERIALS = [
    { key: 'qrok',      label: 'Q-Rok sand',     bucket: 50, test: (n) => /q[\s\-_]*roc?k/i.test(n) },
    { key: 'cowbay',    label: 'Cowbay (bulk sand)', bucket: 50, test: (n) => /cowbay/i.test(n) },
    { key: 'pozzotive', label: 'Pozzotive',      bucket: 25, test: (n) => /pozz/i.test(n) },
    { key: 'portland',  label: 'Portland',       bucket: 45, test: (n) => /portland/i.test(n) && !/reducer/i.test(n) },
    { key: 'cemfil',    label: 'Cemfil fibers',  bucket: 18, test: (n) => /cemfil/i.test(n) }
];
function keyMaterialsHtml(rows, title) {
    const sums = KEY_MATERIALS.map(m => ({ ...m, total: 0, unit: '', parts: [] }));
    const otherSand = { total: 0, unit: '', parts: [] };
    for (const r of rows || []) {
        if (!r || !(r.total > 0)) continue;
        const name = String(r.name || '');
        const hit = sums.find(m => m.test(name));
        if (hit) { hit.total += Number(r.total) || 0; hit.unit = hit.unit || r.unit; if (!hit.parts.includes(name)) hit.parts.push(name); continue; }
        if (/^sand\b/i.test(name)) { otherSand.total += Number(r.total) || 0; otherSand.unit = otherSand.unit || r.unit; if (!otherSand.parts.includes(name)) otherSand.parts.push(name); }
    }
    const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString('en-US');
    // buckets: whole buckets, always rounded up — a part bucket is still a bucket to stage
    const buckets = (m) => (m.bucket && m.total > 0) ? Math.ceil(m.total / m.bucket - 1e-9) : null;
    const line = (label, m, cls = '') => `<tr class="${cls}"><td>${escapeHtml(label)}${m.parts.length ? ` <span class="wb-parts">(${escapeHtml(m.parts.join(' + '))})</span>` : ''}</td><td class="pp-bt-totals-num wb-buckets">${buckets(m) != null ? buckets(m).toLocaleString('en-US') : '—'}</td><td class="wb-bucket-size">${m.bucket ? m.bucket + ' lb each' : ''}</td><td class="pp-bt-totals-num">${m.total > 0 ? fmt(m.total) : '—'}</td><td>${escapeHtml(m.unit || 'lbs')}</td></tr>`;
    let body = sums.map(m => line(m.label, m)).join('');
    if (otherSand.total > 0) body += line('Other sand (not Q-Rok)', otherSand, 'wb-key-other');
    return `<div class="pp-bt-totals-panel wb-key"><div class="pp-bt-totals-title">${escapeHtml(title)}</div>
        <table class="pp-bt-totals-table wb-key-table"><thead><tr><th>Material</th><th class="pp-bt-totals-num">Buckets</th><th>Bucket</th><th class="pp-bt-totals-num">Total Qty</th><th>Unit</th></tr></thead><tbody>${body}</tbody></table>
        <div class="wb-hint">Buckets are rounded up to whole buckets. Bucket weights: Q-Rok 50 lb, Cowbay 50 lb, Pozzotive 25 lb, Portland 45 lb, Cemfil 18 lb.</div></div>`;
}

function render(results) {
    const printable = results.filter(r => r.pages);
    $('wb-doc').innerHTML = coverHtml(results) + printable.map(r => r.pages).join('') + totalsHtml(results);
    const notFinal = printable.filter(r => r.onBoard && !r.ciFinal);
    const missing = results.filter(r => !r.pages);
    $('wb-summary').innerHTML = `${printable.length} casting${printable.length === 1 ? '' : 's'} with tickets`
        + (missing.length ? ` · <span class="wb-warn">${missing.length} without tickets</span>` : '')
        + (notFinal.length ? ` · <span class="wb-warn">${notFinal.length} printed before the Casting Inventory is final (orange on the board)</span>` : '');
    $('wb-print').disabled = !printable.length;
}

// ---- print + stamps ----------------------------------------------------------------------------------------------
async function stampPrinted() {
    if (S.stamped) return;
    S.stamped = true;
    const now = new Date().toISOString();
    let n = 0;
    for (const r of (S.results || []).filter(r => r.pages && r.casting && r.onBoard)) {
        try {
            await saveMilestone({
                projectNumber: r.projectNumber, castingId: r.casting.id, milestone: 'Batching Sheets',
                status: r.ciFinal ? MS.GREEN : MS.ORANGE, locked: false,
                note: r.ciFinal ? null : withInvMark(EARLY_PRINT_NOTE, invEarlyMarksRows(r.invRows, 'Batching Sheets')),
                stampedAt: now
            });
            n++;
        } catch (err) { logger.error('[week-batch] stamp failed', r.projectNumber, r.castingNumber, err); }
    }
    $('wb-status').textContent = n ? `Printed — "Batching Sheets" stamped on the board for ${n} casting${n === 1 ? '' : 's'}.` : 'Printed.';
}

function wire() {
    $('wb-print').addEventListener('click', () => {
        const notFinal = (S.results || []).filter(r => r.pages && r.onBoard && !r.ciFinal);
        if (notFinal.length && !window.confirm(`Casting Inventory is not final for: ${notFinal.map(r => r.projectNumber + ' cast ' + r.castingNumber).join(', ')}.\n\nThese tickets would be printed from an inventory engineering has not marked ready. They go ORANGE on the Releasability Board until it is.\n\nOK = print anyway.   Cancel = go back.`)) return;
        S.stamped = false;
        window.print();
    });
    window.addEventListener('afterprint', () => { stampPrinted(); });
}

(async function init() {
    document.title = `Batch tickets — week of ${WEEK || '?'}`;
    const style = document.createElement('style');
    style.textContent = BATCH_PRINT_CSS;
    document.head.appendChild(style);
    wire();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(WEEK)) { $('wb-status').textContent = 'No week given. Open this page from the weekly.'; return; }
    try { await build(); }
    catch (err) { logger.error('[week-batch] build failed', err); $('wb-status').textContent = 'Could not build the tickets: ' + (err?.message || err); }
})();
