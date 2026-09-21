/**
 * Jig List — GFRC Scrim Jig Generator (Project Portal tab)
 *
 * Mechanical port of the standalone `jig list tool.html` (S:\!CWE - Tools\
 * Custom Tools\Jig Making). Generates the plywood scrim-jig cut list,
 * per-jig profile drawings and the panel cross-section diagram for a project.
 *
 * Portal adaptations (behavior otherwise preserved verbatim):
 *   - localStorage autosave replaced with a debounced per-casting Supabase
 *     save via jig-list-service (same JSON state shape as the standalone
 *     tool used, so old exports could be seeded into the table if needed).
 *   - One jig list per casting: a casting pill row (same look as the Batch
 *     Tickets tab) selects which casting's list is being edited. A casting
 *     with no saved list yet is seeded by deep-copying the most recent
 *     casting that has one (date reset to today) — falling back to the
 *     project's legacy pre-migration blob, then to the defaults. A toolbar
 *     "Copy to Casting…" button does the same copy explicitly: it pushes the
 *     active casting's list/cross-section onto chosen castings, replacing
 *     whatever they had.
 *   - The JSON export/import buttons and the editable project-name field are
 *     removed: Supabase is the source of truth and the printed title always
 *     mirrors the portal project record (Info tab).
 *   - Both print paths (Print Jigs, Print Cross-Section) go through a hidden
 *     print iframe instead of `window.print()`, so only the tool's pages
 *     print — not the whole portal.
 *   - The fixed dark toolbars render as normal in-panel bars; the editor and
 *     generated pages scroll with the tab panel.
 *   - Every element id is prefixed `jig-` (including the SVG arrow marker,
 *     `jig-ar`) to avoid collisions with the rest of the portal.
 *   - "Import from Casting Inventory" (portal-only): fills the Panels table
 *     from the active casting's inventory. Each distinct part (type + size)
 *     gets a choice — jig across the short side (default), the long side, a
 *     custom table-saw jig or a custom CNC jig. Chosen widths within the
 *     share tolerance (default 1″) become ONE row: W = the narrowest width,
 *     Wmax = the widest (handle is sized from Wmax), label = every part it
 *     fits. Choices live in S.inv.choices keyed by type|size, so they survive
 *     a re-import and carry over when a list is copied to the next casting.
 *     Rows created by the import carry src:'inv' and are rebuilt on every
 *     import (their Qty is kept per width); hand-added rows are never touched.
 *   - Foot depths can be typed "Height check jig" (dp.kind === 'check'): the
 *     label is then generated — "Height Check Jig · <thickness − depth>″".
 *   - The cross-section drives the scrim foot depths: every scrim layer owns
 *     one depth row (dp.scrim = its index, depth = thickness − height), kept
 *     in step whenever the cross-section is edited. Rows without dp.scrim are
 *     hand-added extras (e.g. a height check jig between two scrim layers).
 *   - Operator cut maps (portal-only): nests the jig blanks (handle width ×
 *     handle height + foot depth) on the chosen sheet, table-saw style — rip
 *     strips first, then crosscut, 1/8″ kerf — and prints a takeoff cover,
 *     parts list, maps and strip schedules following the shop's Material
 *     Takeoff Workflow rules (page titles / colours, 1/4-sheet rounding).
 *
 * Screen styles live in src/styles/project-portal.css scoped under
 * `.pp-tab-panel[data-panel="jig-list"]`; the print iframe carries its own
 * copy of the page CSS (PRINT_DOC_CSS below).
 *
 * @module pages/project-portal/jig-list
 */

import { loadJigListsForProject, saveJigListForCasting } from '../../services/jig-list-service.js';
import { loadCastingInventory } from '../../services/inventory-service.js';
import { logger } from '../../utils/logger.js';

/* ============================ module state ============================ */

let S = null;                    // the ACTIVE casting's state (see defaultState())
let currentGroup = null;         // null = All
let measDiv = null;              // hidden measuring div for list pagination
let currentProjectNumber = null;
let currentProjectName = '';
let currentCastings = [];        // phase-scoped, sort-ordered castings from the portal
let currentCastingId = null;     // active casting (owner of S)
let stateByCasting = new Map();  // castingId -> state object (loaded + seeded)
let savedCastingIds = new Set(); // castings known to have a persisted jig_lists row
let legacyState = null;          // pre-migration project-level blob (seed fallback)
let uiBuilt = false;
let activationToken = 0;         // guards against overlapping activations

let saveTimer = null;            // debounced Supabase save
let pendingSave = null;          // {pn, castingId, state} captured by scheduleSave
let renderTimer = null;          // debounced output re-render
let statusTimer = null;          // transient save-status clear

const SAVE_DEBOUNCE_MS = 800;

/* ============================ public API ============================ */

/**
 * Activate the Jig List tab. Renders the UI on first call; every activation
 * reloads the project's per-casting jig lists in one query so newly added
 * castings (and their seeded copies) always appear fresh. Safe to call
 * repeatedly.
 * @param {{projectNumber:string, projectName:string, castings:Array}} project
 *   `castings` is the phase-scoped, sort-ordered casting array from the
 *   portal (same source the Batch Tickets tab uses).
 */
export async function activateJigListTab(project) {
  const root = document.getElementById('jig-list-root');
  if (!root) return;

  const projectNumber = project && project.projectNumber ? String(project.projectNumber) : null;
  const projectName = project && project.projectName ? String(project.projectName) : '';
  const castings = (project && Array.isArray(project.castings)) ? project.castings : [];

  if (!uiBuilt) { buildShell(root); uiBuilt = true; }

  // Flush any pending save for the casting being left before reloading.
  flushPendingSave();

  const token = ++activationToken;
  const prevCastingId = (projectNumber === currentProjectNumber) ? currentCastingId : null;
  currentProjectNumber = projectNumber;
  currentProjectName = projectName;
  currentCastings = castings;
  currentCastingId = null;
  S = null;
  stateByCasting = new Map();
  savedCastingIds = new Set();
  legacyState = null;

  let loaded = { byCasting: new Map(), legacy: null };
  try {
    if (projectNumber) loaded = await loadJigListsForProject(projectNumber);
  } catch (err) {
    logger.error('[jig-list] load failed:', err);
  }
  if (token !== activationToken) return;   // superseded by a newer activation

  for (const [castingId, data] of loaded.byCasting) {
    // Merge over defaults; a row with an unreadable blob counts as absent so
    // seeding can rebuild it.
    savedCastingIds.add(castingId);
    if (data && Array.isArray(data.depths)) {
      stateByCasting.set(castingId, Object.assign(defaultState(), data));
    }
  }
  legacyState = (loaded.legacy && Array.isArray(loaded.legacy.depths)) ? loaded.legacy : null;

  // No castings in scope → hint instead of the editor (Batch Tickets pattern).
  if (!currentCastings.length) {
    setNoCastingsHint(true);
    renderCastingPills();
    return;
  }
  setNoCastingsHint(false);

  // Keep the previously selected casting if still in scope, else first.
  const keep = prevCastingId && currentCastings.some(c => c.id === prevCastingId);
  selectCasting(keep ? prevCastingId : currentCastings[0].id);
}

/* ================== casting selection + seeding ================== */

function setNoCastingsHint(show) {
  const hint = document.getElementById('jig-no-castings');
  const doc = document.getElementById('jig-doc');
  const bar = document.getElementById('jig-topbar');
  const vbar = document.getElementById('jig-vbar');
  if (hint) hint.hidden = !show;
  if (doc) doc.hidden = show;
  // .bar is display:flex in CSS, which beats the hidden attribute.
  if (bar) bar.style.display = show ? 'none' : '';
  if (show && vbar) { vbar.style.display = 'none'; vbar.innerHTML = ''; }
}

/** The casting row for the active casting (label for printed titles). */
function activeCasting() {
  return currentCastings.find(c => c.id === currentCastingId) || null;
}

/**
 * Make a casting active: use its loaded state, or seed one by copying the
 * most recent casting that has a jig list (date reset to today), falling
 * back to the legacy project-level blob, then to the defaults. Seeded
 * copies are persisted immediately.
 */
function selectCasting(castingId) {
  currentCastingId = castingId;
  let st = stateByCasting.get(castingId);
  let persistSeed = false;
  if (!st) {
    const seed = buildSeedState(castingId);
    st = seed.state;
    persistSeed = seed.fromCopy;
    stateByCasting.set(castingId, st);
  }
  S = st;
  fixXsec();
  // S.xsec.auto: the scrim heights follow the thickness (even split) until one is typed by hand.
  if (S.xsec.auto == null) S.xsec.auto = xsecIsEvenSplit();
  syncDepthsFromXsec(true);
  // The printed title always mirrors the portal project record (Info tab),
  // even for states saved under an older project name.
  if (currentProjectName) S.project = currentProjectName;
  currentGroup = null;
  renderCastingPills();
  buildEditor();
  renderOutput();
  // Persist a seeded-from-copy state right away so the copy survives.
  if (persistSeed) scheduleSave();
}

/**
 * Build the initial state for a casting with no saved jig list.
 * @returns {{state:Object, fromCopy:boolean}} fromCopy=true when the state
 *   was copied from another casting / the legacy blob (should be persisted).
 */
function buildSeedState(castingId) {
  // Most recent casting WITH a jig list = highest sort_order = last in the
  // sorted array (excluding the casting being seeded).
  for (let i = currentCastings.length - 1; i >= 0; i--) {
    const c = currentCastings[i];
    if (c.id === castingId) continue;
    const src = stateByCasting.get(c.id);
    if (src) {
      const st = structuredClone(src);
      st.date = todayISO();
      return { state: st, fromCopy: true };
    }
  }
  if (legacyState) {
    const st = structuredClone(Object.assign(defaultState(), legacyState));
    st.date = todayISO();
    return { state: st, fromCopy: true };
  }
  return { state: freshState(), fromCopy: false };
}

/* ===================== casting pill row ===================== */

function renderCastingPills() {
  const copyBtn = document.getElementById('jig-btn-copy');
  if (copyBtn) copyBtn.disabled = currentCastings.length < 2;
  const pills = document.getElementById('jig-casting-pills');
  if (!pills) return;
  // .pp-bt-pills is display:flex in CSS, which beats the hidden attribute.
  if (!currentCastings.length) { pills.innerHTML = ''; pills.style.display = 'none'; return; }
  pills.style.display = '';
  pills.innerHTML = currentCastings.map(c => {
    const active = c.id === currentCastingId ? ' pp-bt-pill-active' : '';
    const date = c.casting_date ? `<span class="pp-bt-pill-date">${esc(c.casting_date)}</span>` : '';
    return `<button type="button" class="pp-bt-pill${active}" data-jig-pill data-casting-id="${esc(c.id)}">${esc(c.casting_number || '')}${date}</button>`;
  }).join('');
}

function handleSelectCasting(castingId) {
  if (!castingId || castingId === currentCastingId) return;
  // Flush the pending save for the casting we're leaving so its DB state
  // matches the editor before switching.
  flushPendingSave();
  selectCasting(castingId);
}

/* ================== copy to another casting ================== */

/** Open the copy modal listing every OTHER casting in scope as a target. */
function openCopyModal() {
  if (!S || !currentCastingId) return;
  const targets = currentCastings.filter(c => c.id !== currentCastingId);
  if (!targets.length) return;
  const src = activeCasting();
  document.getElementById('jig-copy-hint').innerHTML =
    `Copy casting <b>${esc((src && src.casting_number) || '')}</b>’s jig list and cross-section onto the selected castings. Targets that already have a jig list are <b>replaced</b>.`;
  document.getElementById('jig-copy-list').innerHTML = targets.map(c => {
    const date = c.casting_date ? ` <span class="pp-pl-desc">${esc(c.casting_date)}</span>` : '';
    const status = savedCastingIds.has(c.id)
      ? '<span class="pp-pl-color">has a jig list — will be replaced</span>'
      : '<span class="pp-pl-color pp-pl-color-empty">no jig list yet</span>';
    return `<label class="pp-print-label-row"><input type="checkbox" value="${esc(c.id)}"><span class="pp-pl-cast">${esc(c.casting_number || '')}</span>${date}${status}</label>`;
  }).join('');
  document.getElementById('jig-copy-all').checked = false;
  updateCopyConfirmState();
  document.getElementById('jig-copy-modal').hidden = false;
}

function closeCopyModal() {
  document.getElementById('jig-copy-modal').hidden = true;
}

function updateCopyConfirmState() {
  const any = !!document.querySelector('#jig-copy-list input:checked');
  document.getElementById('jig-copy-confirm').disabled = !any;
}

/**
 * Copy the active casting's state onto every checked target (deep clone,
 * date reset to today — same rules as seeding) and persist each copy
 * immediately so it survives without the target ever being opened.
 */
async function confirmCopy() {
  const ids = [...document.querySelectorAll('#jig-copy-list input:checked')].map(cb => cb.value);
  if (!ids.length || !S || !currentProjectNumber) return;
  closeCopyModal();
  setSaveStatus('Copying…', false);
  let failed = 0;
  for (const targetId of ids) {
    const clone = structuredClone(S);
    clone.date = todayISO();
    stateByCasting.set(targetId, clone);
    try {
      await saveJigListForCasting(currentProjectNumber, targetId, clone);
      savedCastingIds.add(targetId);
    } catch (err) {
      if (err && err.pendingMigration) {
        setSaveStatus('Not saved — DB migration pending', false, true);
        return;
      }
      failed++;
      logger.error('[jig-list] copy failed:', err);
    }
  }
  if (failed) setSaveStatus(`Copy failed for ${failed} casting${failed === 1 ? '' : 's'}`, true, true);
  else setSaveStatus(`Copied to ${ids.length} casting${ids.length === 1 ? '' : 's'}`, true);
}

/* ============================ state ============================ */

function todayISO(){ const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function defaultState(){
  return {
    project:'New Project', date:todayISO(),
    overhang:'4', clearance:'1', handleH:'1-1/2',
    depths:[ {d:'1/2', label:'First Scrim', scrim:0}, {d:'1/4', label:'Second Scrim', scrim:1} ],
    panels:[ {label:'', W:'', qty:'', group:''} ],
    xsec: defaultXsec()
  };
}
/** defaultState() with the project name prefilled from the portal project. */
function freshState(){
  const st = defaultState();
  if (currentProjectName) st.project = currentProjectName;
  return st;
}
function defaultXsec(){ return { thickness:'3/4', heights:['1/4','1/2'], auto:true }; }
/* Legacy projects have no cross-section: derive one from the foot depths
   (scrim depth from top → height from bottom = thickness − depth).
   Total thickness isn't in legacy data, so it falls back to the 3/4″ default. */
function fixXsec(){
  if (S.xsec && Array.isArray(S.xsec.heights)) return;
  const T = parseInches(defaultXsec().thickness);
  const heights = (S.depths || [])
    .map(dp => parseInches(dp.d))
    .filter(v => v != null && v > 0 && v < T)
    .map(v => fmt16(T - v));
  S.xsec = { thickness: defaultXsec().thickness, heights: heights.length ? heights : defaultXsec().heights };
}

/* =================== persistence (Supabase) =================== */

function scheduleSave(){
  if (!currentProjectNumber || !currentCastingId || !S) return;
  clearTimeout(saveTimer);
  pendingSave = { pn: currentProjectNumber, castingId: currentCastingId, state: S };
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const p = pendingSave; pendingSave = null;
    if (p) doSave(p.pn, p.castingId, p.state);
  }, SAVE_DEBOUNCE_MS);
}
/** Fire a pending debounced save immediately (casting/project switch). */
function flushPendingSave(){
  if (!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  const p = pendingSave; pendingSave = null;
  if (p) doSave(p.pn, p.castingId, p.state);
}
async function doSave(projectNumber, castingId, state){
  if (!projectNumber || !castingId || !state) return;
  setSaveStatus('Saving…', false);
  try {
    await saveJigListForCasting(projectNumber, castingId, state);
    savedCastingIds.add(castingId);
    setSaveStatus('Saved', true);
  } catch (err) {
    if (err && err.pendingMigration) {
      // DB not migrated yet — the service already warned once; keep the
      // status visible without spamming errors.
      setSaveStatus('Not saved — DB migration pending', false, true);
      return;
    }
    logger.error('[jig-list] save failed:', err);
    setSaveStatus('Save failed', true, true);
  }
}
function setSaveStatus(text, transient, isErr){
  const el = document.getElementById('jig-save-status');
  if (!el) return;
  el.textContent = text;
  el.style.color = isErr ? '#b91c1c' : '';
  clearTimeout(statusTimer);
  if (transient) statusTimer = setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 2000);
}

/* ===================== inch ⇄ sixteenths ====================== */
function parseInches(s){
  if (s == null) return null;
  s = String(s).trim().replace(/["″]/g,'').replace(/\s+/g,' ');
  if (!s) return null;
  let m = s.match(/^(\d+)[\s-](\d+)\/(\d+)$/);            // 44-1/8 or 44 1/8
  if (m) return (+m[1])*16 + Math.round((+m[2])*16/(+m[3]));
  m = s.match(/^(\d+)\/(\d+)$/);                          // 1/8
  if (m) return Math.round((+m[1])*16/(+m[2]));
  m = s.match(/^\d*\.?\d+$/);                             // 44 or 44.125
  if (m) return Math.round(parseFloat(s)*16);
  return null;
}
function fmt16(v){
  if (v == null) return '?';
  const neg = v < 0; v = Math.abs(v);
  let whole = Math.trunc(v/16), r = v - whole*16;
  let out;
  if (r === 0) out = '' + whole;
  else { const g = (a,b)=> b? g(b,a%b): a; const k = g(r,16); out = (whole? whole+'-':'') + (r/k) + '/' + (16/k); }
  return (neg? '-':'') + out;
}

/* ============================ jigs ============================ */
function activeGroups(){
  const seen = []; S.panels.forEach(p=>{ const g=(p.group||'').trim(); if(g && !seen.includes(g)) seen.push(g); });
  return seen;
}
function buildJigs(){
  const over = parseInches(S.overhang) || 0;
  const clr  = parseInches(S.clearance) || 0;
  let src = S.panels;
  if (currentGroup) src = src.filter(p => (p.group||'').trim() === currentGroup);
  // Custom jigs with no width (CNC / table saw) are not drawn — listed as reminders.
  const customs = src.filter(p => p.custom && !(parseInches(p.W) > 0))
                     .map(p => ({ label:(p.label||'').trim() || '?', kind:p.custom, qty:(p.qty||'').trim() }));
  const panels = src.map((p,i)=>({ label:(p.label||'').trim(), W:p.W, qty:p.qty, w16:parseInches(p.W),
                                   max16:parseInches(p.Wmax), custom:p.custom || '', idx:i }))
                    .filter(p => p.w16 != null && p.w16 > 0);
  // duplicate-width detection
  const byW = {};
  panels.forEach(p => { (byW[p.w16] = byW[p.w16] || []).push(p.label || '?'); });
  const jigs = []; let n = 0;
  panels.forEach((p, pi) => {
    const others = [...new Set(byW[p.w16])].filter(l => l !== (p.label || '?'));
    // A shared jig (import) spans widths W…Wmax: foot from the narrowest, handle from the widest.
    const hi16 = (p.max16 != null && p.max16 > p.w16) ? p.max16 : p.w16;
    const notes = [];
    if (hi16 > p.w16) notes.push(`fits W ${fmt16(p.w16)}″–${fmt16(hi16)}″ (handle from widest)`);
    if (p.custom) notes.push('custom — ' + customLabel(p.custom));
    if (others.length) notes.push('same as ' + others.join(', '));
    const note = notes.join(' · ');
    const foot = p.w16 - clr, handle = hi16 + over;
    S.depths.forEach(dp => {
      if (dp.scrim != null && parseInches(dp.d) == null) return;   // that scrim's height isn't filled in yet
      n++;
      const d16 = parseInches(dp.d) || 0;
      jigs.push({
        n, pi, label: p.label || ('Panel ' + (pi+1)), qty: p.qty,
        W: fmt16(p.w16), foot: fmt16(foot), handle: fmt16(handle), foot16: foot, handle16: handle,
        depth: fmt16(d16), depth16: d16, depthLabel: depthLabelOf(dp), kind: dp.kind || '', note
      });
    });
  });
  return { jigs, over, clr, customs };
}
function customLabel(kind){ return kind === 'cnc' ? 'CNC' : 'custom'; }
/** Label of a foot depth. "Height check jig" depths get a generated label
    carrying the concrete height the jig checks (thickness − foot depth). */
function depthLabelOf(dp){
  if (!dp || dp.kind !== 'check') return ((dp && dp.label) || '').trim();
  const T = parseInches(S.xsec && S.xsec.thickness), d = parseInches(dp.d);
  if (T != null && d != null && d >= 0 && d < T) return `Height Check Jig · ${fmt16(T - d)}″`;
  return 'Height Check Jig';
}

/* ===================== output page builders ==================== */

/**
 * Title line for generated/printed pages: the project name plus the active
 * casting (e.g. "Project Name — Casting 2") so per-casting printouts are
 * distinguishable. The casting suffix is display-only — S.project itself
 * stays the bare portal project name in the saved state.
 */
function projTitle(){
  const c = activeCasting();
  const num = c ? String(c.casting_number || '').trim() : '';
  if (!num) return S.project;
  const label = /^cast/i.test(num) ? num : ('Casting ' + num);
  return S.project + ' — ' + label;
}
/* Retained from the source tool for parity — the source defines it but
   renderOutput() never calls it (output starts straight at the jig list). */
function instrPage(over, clr){
  const overStr = fmt16(over), clrStr = fmt16(clr);
  const overHalf = fmt16(Math.round(over/2)), clrHalf = fmt16(Math.round(clr/2));
  const depthList = S.depths.map(d => `<b>${fmt16(parseInches(d.d)||0)}″</b> ${d.label||''}`).join(' &nbsp;·&nbsp; ');
  return `<section class="page">
    <div class="titlerow"><h1>Scrim Jigs — How They Work</h1>
      <div class="meta">${esc(projTitle())}<br>${esc(S.date)}</div></div>
    <p class="rules" style="margin-top:0">Each jig is <b>one piece of plywood</b> cut to a T-outline. It spans the panel width and
      <b>rides on top of the two form side walls</b>; the foot drops into the cavity and sets the depth the scrim is pressed to.</p>
    <svg class="instr-svg" viewBox="0 0 700 350" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Scrim jig profile">
      <rect class="wl" x="190" y="170" width="40" height="75"/>
      <rect class="wl" x="470" y="170" width="40" height="75"/>
      <polygon class="pl" points="190,90 510,90 510,170 455,170 455,210 245,210 245,170 190,170"/>
      <text class="rlbl" x="350" y="138" text-anchor="middle">HANDLE</text>
      <text class="rlbl" x="350" y="197" text-anchor="middle">FOOT</text>
      <line class="scr" x1="230" y1="210" x2="470" y2="210"/>
      <text class="il" x="350" y="228" text-anchor="middle" style="fill:#555;font-style:normal;font-size:12px">scrim is pressed to this depth</text>
      <line class="de" x1="190" y1="86" x2="190" y2="62"/><line class="de" x1="510" y1="86" x2="510" y2="62"/>
      <line class="dl" x1="190" y1="68" x2="510" y2="68" marker-start="url(#jig-ar)" marker-end="url(#jig-ar)"/>
      <text class="dnum" x="350" y="58" text-anchor="middle">HANDLE WIDTH = panel width + ${overStr}″  (${overHalf}″ overhang each side)</text>
      <line class="de" x1="186" y1="90" x2="158" y2="90"/><line class="de" x1="186" y1="170" x2="158" y2="170"/>
      <line class="dl" x1="164" y1="90" x2="164" y2="170" marker-start="url(#jig-ar)" marker-end="url(#jig-ar)"/>
      <text class="dnum" x="152" y="134" text-anchor="end">${esc(S.handleH)}″</text>
      <line class="de" x1="514" y1="170" x2="552" y2="170"/><line class="de" x1="514" y1="210" x2="552" y2="210"/>
      <line class="dl" x1="546" y1="170" x2="546" y2="210" marker-start="url(#jig-ar)" marker-end="url(#jig-ar)"/>
      <text class="dnum" x="556" y="178" text-anchor="start">FOOT DEPTH</text>
      <text class="dnum" x="556" y="194" text-anchor="start" style="font-size:11px">= scrim depth</text>
      <line class="de" x1="245" y1="214" x2="245" y2="266"/><line class="de" x1="455" y1="214" x2="455" y2="266"/>
      <line class="dl" x1="245" y1="262" x2="455" y2="262" marker-start="url(#jig-ar)" marker-end="url(#jig-ar)"/>
      <text class="dnum" x="350" y="256" text-anchor="middle">FOOT WIDTH = panel width − ${clrStr}″</text>
      <line class="de" x1="230" y1="249" x2="230" y2="292"/><line class="de" x1="470" y1="249" x2="470" y2="292"/>
      <line class="dl" x1="230" y1="286" x2="470" y2="286" marker-start="url(#jig-ar)" marker-end="url(#jig-ar)"/>
      <text class="dnum" x="350" y="307" text-anchor="middle">PANEL WIDTH (W)</text>
      <rect class="pl" x="40" y="306" width="16" height="12" style="stroke-width:1"/>
      <text class="rlbl" x="62" y="316" style="font-weight:400;font-size:12px">Plywood jig — one piece</text>
      <rect class="wl" x="40" y="326" width="16" height="12"/>
      <text class="rlbl" x="62" y="336" style="font-weight:400;font-size:12px">Form side wall</text>
    </svg>
    <ul class="rules">
      <li><b>Handle</b> — width = panel width <b>+ ${overStr}″</b> (${overHalf}″ overhang each side); height <b>${esc(S.handleH)}″</b>.</li>
      <li><b>Foot</b> — width = panel width <b>− ${clrStr}″</b> (${clrHalf}″ clearance each side); height = the scrim depth.</li>
      <li><b>Depths this project:</b> ${depthList}. One jig is cut per panel width for <b>each</b> depth.</li>
      <li>Profile drawings are schematic — height exaggerated. Widths are the real cut dimensions.</li>
    </ul>
    <div class="pfoot"><span>Scrim Jigs · ${esc(projTitle())}</span><span>Page 1 — Instructions</span></div>
  </section>`;
}

function rowHTML(j){
  return `<tr class="${j.pi % 2 ? 'w1' : ''}">
       <td class="c">${j.n}</td>
       <td class="b"${j.label.length > 14 ? ' style="white-space:normal"' : ''}>${esc(j.label)}${j.depthLabel ? ' · ' + esc(j.depthLabel) : ''}</td>
       <td class="c">${j.depth}″</td>
       <td>${j.foot}″</td>
       <td>${j.handle}″</td>
       <td class="c">${esc(S.handleH)}″</td>
       <td style="color:#b23">${esc(j.note)}</td>
     </tr>`;
}
function listHeadHTML(over, clr){
  return `<thead><tr>
    <th style="width:5%" class="c">#</th>
    <th style="width:19%">Jig</th>
    <th style="width:10%" class="c">Foot depth</th>
    <th style="width:16%">Foot width<br><span style="font-weight:400;color:#666">(W − ${fmt16(clr)}″)</span></th>
    <th style="width:16%">Handle width<br><span style="font-weight:400;color:#666">(W + ${fmt16(over)}″)</span></th>
    <th style="width:12%" class="c">Handle height</th>
    <th style="width:22%">Notes</th>
  </tr></thead>`;
}

function measurer(){
  if (!measDiv){ measDiv = document.createElement('div');
    measDiv.style.cssText = 'position:absolute;left:-10000px;top:0;width:7.5in;visibility:hidden';
    const root = document.getElementById('jig-list-root');
    (root || document.body).appendChild(measDiv); }
  return measDiv;
}
const PRINT_CONTENT_PX = 950;     // usable height inside the 10.9in print box

function buildListPages(jigs, opt){
  const d = measurer();
  const rows = jigs.map(rowHTML);
  d.innerHTML = `<div class="titlerow"><h1>${opt.title}</h1><div class="meta">${opt.summary?opt.summary+'<br>':''}x<br>x</div></div>`
    + `<table class="list">${opt.listHead}<tbody>${rows.join('')}</tbody></table>` + opt.legend;
  const rect = el => el.getBoundingClientRect().height;
  const titleH  = rect(d.querySelector('.titlerow')) + 16;
  const theadH  = rect(d.querySelector('thead'));
  const rowH    = [...d.querySelectorAll('tbody tr')].map(rect);
  const legendH = rect(d.querySelector('.listnote')) + 12;
  const avail = PRINT_CONTENT_PX - titleH - theadH - 6;

  const pages = []; let cur = [], h = 0;
  for (let i = 0; i < rowH.length; i++){
    if (cur.length && h + rowH[i] > avail){ pages.push(cur); cur = []; h = 0; }
    cur.push(i); h += rowH[i];
  }
  if (cur.length) pages.push(cur);

  let legendPage = pages.length - 1;
  const lastH = pages[legendPage].reduce((s,i)=> s + rowH[i], 0);
  if (lastH + legendH > avail){
    const prev = pages[pages.length - 1]; const moved = []; let mh = legendH;
    while (prev.length > 1){
      const idx = prev[prev.length - 1];
      if (mh + rowH[idx] > avail) break;
      const prevH = prev.reduce((s,i)=> s + rowH[i], 0);
      if (prevH <= mh + rowH[idx]) break;
      prev.pop(); moved.unshift(idx); mh += rowH[idx];
    }
    pages.push(moved); legendPage = pages.length - 1;
  }

  let html = '';
  pages.forEach((grp, pi) => {
    const pageNo = opt.page0 + pi;
    const body = grp.map(i => rows[i]).join('');
    const range = grp.length ? `${grp[0]+1}–${grp[grp.length-1]+1}` : 'notes';
    const meta = grp.length ? `Jigs ${range} of ${jigs.length}` : 'Notes';
    html += `<section class="page">
      <div class="titlerow"><h1>${opt.title}</h1>
        <div class="meta"><b style="font-size:13px;color:#333">${esc(projTitle())}</b><br>${opt.summary?opt.summary+'<br>':''}${meta}<br>${esc(S.date)}</div></div>
      ${grp.length ? `<table class="list">${opt.listHead}<tbody>${body}</tbody></table>` : ''}
      ${pi === legendPage ? opt.legend : ''}
      <div class="pfoot"><span>Scrim Jigs · ${esc(projTitle())}</span><span>Page ${pageNo} — Jig List (${range})</span></div>
    </section>`;
  });
  return { html, n: pages.length };
}

function cardSVG(j){
  const T = parseInches(S.xsec && S.xsec.thickness);
  const hasT = T != null && T > 0;
  const h16 = (hasT && j.depth16 > 0 && j.depth16 < T) ? T - j.depth16 : null;
  // concrete depth (left) and scrim height from face (right); schematic like the rest of the profile
  let dims = '';
  if (hasT){
    dims += `<line class="de" x1="46" y1="205" x2="30" y2="205"/>
    <line class="dl" x1="36" y1="130" x2="36" y2="205" marker-start="url(#jig-ar)" marker-end="url(#jig-ar)"/>
    <text class="dnum" x="28" y="163" text-anchor="end">${fmt16(T)}″</text>
    <text class="dnum" x="28" y="176" text-anchor="end" style="font-size:9px;fill:#666">conc</text>`;
  }
  if (h16 != null){
    dims += `<line class="de" x1="314" y1="205" x2="340" y2="205"/>
    <line class="dl" x1="334" y1="165" x2="334" y2="205" marker-start="url(#jig-ar)" marker-end="url(#jig-ar)"/>
    <text class="dnum" x="337" y="186" text-anchor="start">${fmt16(h16)}″</text>
    <text class="dnum" x="337" y="198" text-anchor="start" style="font-size:9px;fill:#666">to face</text>`;
  }
  return `<svg class="cardsvg" viewBox="-30 0 420 250" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" role="img">
    <rect x="75" y="130" width="210" height="75" style="fill:#d6d6d6;stroke:#8a8a8a;stroke-width:.7"/>
    <rect class="wl" x="50" y="130" width="25" height="75"/><rect class="wl" x="285" y="130" width="25" height="75"/>
    <polygon class="pl" points="50,65 310,65 310,130 275,130 275,165 85,165 85,130 50,130"/>
    <line class="scr" x1="75" y1="165" x2="285" y2="165"/>
    <text class="rlbl" x="180" y="103" text-anchor="middle">HANDLE</text>
    <text class="rlbl" x="180" y="152" text-anchor="middle">FOOT</text>
    <text class="il" x="180" y="190" text-anchor="middle" style="font-size:9px;fill:#555">concrete</text>
    <line class="de" x1="50" y1="61" x2="50" y2="44"/><line class="de" x1="310" y1="61" x2="310" y2="44"/>
    <line class="dl" x1="50" y1="50" x2="310" y2="50" marker-start="url(#jig-ar)" marker-end="url(#jig-ar)"/>
    <text class="dnum" x="180" y="40" text-anchor="middle">Handle ${j.handle}″</text>
    <line class="de" x1="46" y1="65" x2="30" y2="65"/><line class="de" x1="46" y1="130" x2="30" y2="130"/>
    <line class="dl" x1="36" y1="65" x2="36" y2="130" marker-start="url(#jig-ar)" marker-end="url(#jig-ar)"/>
    <text class="dnum" x="28" y="101" text-anchor="end">${esc(S.handleH)}″</text>
    <line class="de" x1="314" y1="130" x2="340" y2="130"/><line class="de" x1="314" y1="165" x2="340" y2="165"/>
    <line class="dl" x1="334" y1="130" x2="334" y2="165" marker-start="url(#jig-ar)" marker-end="url(#jig-ar)"/>
    <text class="dnum" x="337" y="151" text-anchor="start">${j.depth}″</text>
    ${dims}
    <line class="de" x1="85" y1="169" x2="85" y2="228"/><line class="de" x1="275" y1="169" x2="275" y2="228"/>
    <line class="dl" x1="85" y1="224" x2="275" y2="224" marker-start="url(#jig-ar)" marker-end="url(#jig-ar)"/>
    <text class="dnum" x="180" y="241" text-anchor="middle">Foot ${j.foot}″</text>
  </svg>`;
}
function cardConc(j){
  const T = parseInches(S.xsec && S.xsec.thickness);
  if (T == null || T <= 0) return '';
  const h16 = (j.depth16 > 0 && j.depth16 < T) ? T - j.depth16 : null;
  return ` &nbsp;·&nbsp; <b>Conc</b> ${fmt16(T)}″${h16 != null ? ` · <b>${j.kind === 'check' ? 'Height' : 'Scrim'}</b> ${fmt16(h16)}″ up from face` : ''}`;
}
function card(j){
  return `<div class="card">
    <div class="card-h"><span class="jno">JIG ${esc(j.label)}</span><span class="jid">${esc(j.depthLabel)}</span></div>
    ${j.qty ? `<div class="qtybig"><span class="num">${esc(j.qty)}</span><span class="lab">QTY</span></div>` : ''}
    ${cardSVG(j)}
    <div class="card-f"><b>Jig ${j.n}</b> &nbsp;·&nbsp; <b>Handle</b> ${j.handle}″ × ${esc(S.handleH)}″ &nbsp;·&nbsp; <b>Foot</b> ${j.foot}″ × ${j.depth}″ &nbsp;·&nbsp; from W ${j.W}″${cardConc(j)}${j.note?` &nbsp;·&nbsp; <span style="color:#b23">${esc(j.note)}</span>`:''}</div>
  </div>`;
}
function drawingPages(jigs, opt){
  let html = ''; const T = jigs.length, PER = 4;
  for (let i = 0; i < T; i += PER){
    const group = jigs.slice(i, i+PER);
    const a = i+1, b = Math.min(i+PER, T);
    const pageNo = opt.page0 + i/PER;
    html += `<section class="page">
      <div class="titlerow"><h1>${opt.title}</h1>
        <div class="meta"><b style="font-size:13px;color:#333">${esc(projTitle())}</b><br>${opt.summary?opt.summary+'<br>':''}Jigs ${a}–${b} of ${T}<br>${esc(S.date)}</div></div>
      <div class="grid">${group.map(card).join('')}</div>
      <div class="pfoot"><span>Scrim Jigs · ${esc(projTitle())}</span><span>Page ${pageNo} — Drawings ${a}–${b}</span></div>
    </section>`;
  }
  return html;
}

/* ===================== render the document ==================== */
function renderOutput(){
  if (!S) return;
  renderCutSummary();
  // validate the active group still exists
  const groups = activeGroups();
  if (currentGroup && !groups.includes(currentGroup)) currentGroup = null;
  buildPrintSetBar(groups);

  const { jigs, over, clr, customs } = buildJigs();
  const out = document.getElementById('jig-output');
  if (!out) return;

  if (!jigs.length){
    out.innerHTML = `<div class="emptyhint">Add at least one panel with a valid width — and at least one foot depth — to generate jigs.</div>`;
    return;
  }

  const widths = new Set(jigs.map(j => j.W)).size;
  const summaryBase = currentGroup ? `${esc(currentGroup)} · ${widths} widths · ${jigs.length} jigs`
                                   : `${widths} widths · ${jigs.length} jigs`;
  const customNote = customs.length
    ? `<b style="color:#b23">Custom jigs — not drawn here:</b> ${customs.map(c =>
        `${esc(c.label)} — ${customLabel(c.kind)}${c.qty ? ' ×' + esc(c.qty) : ''}`).join('; ')}<br>`
    : '';
  const legend = `<p class="listnote">${customNote}
      <b>Foot depth</b> = how deep the scrim is pressed; one jig per depth listed.
      Cut each jig from <b>one piece of plywood</b>: the foot is ${fmt16(Math.round(clr/2))}″ narrower per side so it drops into the form, and the handle overhangs ${fmt16(Math.round(over/2))}″ per side to ride on the form walls.<br>
      <b style="color:#b23">“same as …”</b> = another panel shares this width — cut the jig once and reuse it.</p>`;
  const listHead = listHeadHTML(over, clr);

  let html = '', page0list = 1;   // no explanatory page — start straight at the jig list

  const title = currentGroup ? `${esc(currentGroup)} — Jig List` : `Jig List — ${jigs.length} Jigs`;
  const L = buildListPages(jigs, { title, summary: currentGroup ? summaryBase : '', legend, page0: page0list, listHead });
  html += L.html;
  html += drawingPages(jigs, { title: currentGroup ? `${esc(currentGroup)} — Jig Drawings` : 'Individual Jig Drawings',
                               summary: currentGroup ? summaryBase : '', page0: page0list + L.n });
  out.innerHTML = html;
}

/* ===================== print-set bar ==================== */
function buildPrintSetBar(groups){
  const bar = document.getElementById('jig-vbar');
  if (!bar) return;
  if (!groups.length){ bar.style.display = 'none'; bar.innerHTML = ''; return; }
  bar.style.display = 'flex';
  let html = '<span class="vlab">Print set:</span>'
    + `<button type="button" data-g="" class="${currentGroup?'':'active'}">All</button>`;
  groups.forEach(g => html += `<button type="button" data-g="${esc(g)}" class="${currentGroup===g?'active':''}">${esc(g)}</button>`);
  bar.innerHTML = html;
  bar.querySelectorAll('button').forEach(btn => btn.onclick = () => {
    currentGroup = btn.dataset.g || null;
    renderOutput();
    // Portal adaptation: the panel scrolls, not the window — bring the
    // regenerated output into view (source scrolled past the editor).
    const out = document.getElementById('jig-output');
    if (out) out.scrollIntoView({ block: 'start' });
  });
}

/* ============================ editor ========================== */
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* ==================== cross-section designer =================== */
function buildXsecFields(){
  document.getElementById('jig-xsec-fields').innerHTML =
    `<div class="fld"><label>Total concrete thickness</label>
       <input data-sec="xsec" data-field="thickness" value="${esc(S.xsec.thickness)}" style="width:140px" placeholder="3/4">
       <span class="u">inches</span></div>
     <div class="fld"><label># of scrims</label>
       <input type="number" min="0" max="10" data-sec="xsec" data-field="count" value="${S.xsec.heights.length}" style="width:80px">
       <span class="u">layers</span></div>`;
  buildXsecHeights();
}
function buildXsecHeights(){
  document.getElementById('jig-xsec-heights').innerHTML = S.xsec.heights.map((h,i)=>
    `<div class="fld"><label>Scrim ${i+1} height</label>
       <input data-sec="xsec" data-field="h" data-idx="${i}" value="${esc(h)}" style="width:110px" placeholder="1/4">
       <span class="u">from bottom</span></div>`).join('');
}

/** Scrim heights that split the concrete thickness evenly (n scrims -> n+1 equal layers), to the 1/16″. */
function evenScrimHeights(n){
  const T = parseInches(S.xsec.thickness);
  if (T == null || T <= 0 || n < 1) return null;
  return Array.from({ length: n }, (_, i) => fmt16(Math.round(T * (i + 1) / (n + 1))));
}
/** True when the current heights are empty or exactly the even split of the current thickness. */
function xsecIsEvenSplit(){
  const hs = S.xsec.heights;
  if (hs.every(h => !(h || '').trim())) return true;
  const even = evenScrimHeights(hs.length);
  return !!even && hs.every((h, i) => parseInches(h) === parseInches(even[i]));
}
function xsecScrims(T){
  return S.xsec.heights
    .map((h,i)=>({ n:i+1, v:parseInches(h) }))
    .filter(o => o.v != null && o.v > 0 && (T == null || o.v < T))
    .sort((a,b)=> a.v - b.v);
}
function xsecSVG(){
  const T = parseInches(S.xsec.thickness);
  if (T == null || T <= 0) return null;
  const scr = xsecScrims(T);
  const top = 46, bot = 316, H = bot - top, x1 = 150, x2 = 400;
  const vbW = x2 + 60 + Math.max(1, scr.length) * 58;
  const y = v => bot - (v / T) * H;
  let s = `<svg viewBox="0 0 ${vbW} 366" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Concrete panel cross-section with scrim layers">`;
  // concrete slab
  s += `<rect class="conc" x="${x1}" y="${top}" width="${x2-x1}" height="${H}"/>`;
  s += `<text class="il" x="${(x1+x2)/2}" y="${bot+20}" text-anchor="middle">bottom of panel (face) — scrim heights measured from here</text>`;
  // overall thickness dimension (left)
  s += `<line class="de" x1="${x1-4}" y1="${top}" x2="${x1-40}" y2="${top}"/>`;
  s += `<line class="de" x1="${x1-4}" y1="${bot}" x2="${x1-40}" y2="${bot}"/>`;
  s += `<line class="dl" x1="${x1-32}" y1="${top}" x2="${x1-32}" y2="${bot}" marker-start="url(#jig-ar)" marker-end="url(#jig-ar)"/>`;
  s += `<text class="dnum" x="${x1-40}" y="${(top+bot)/2-3}" text-anchor="end">${fmt16(T)}″</text>`;
  s += `<text class="dnum" x="${x1-40}" y="${(top+bot)/2+13}" text-anchor="end" style="font-size:10px;fill:#666">overall</text>`;
  // scrim lines + stacked height dimensions (right)
  scr.forEach((o,k)=>{
    const yy = y(o.v), dx = x2 + 36 + k*58;
    s += `<line class="scr" x1="${x1-6}" y1="${yy}" x2="${x2+6}" y2="${yy}" style="stroke-width:1.4"/>`;
    s += `<text class="rlbl" x="${x1+8}" y="${yy-5}" text-anchor="start" style="font-size:10px">SCRIM ${o.n}</text>`;
    s += `<line class="de" x1="${x2+8}" y1="${yy}" x2="${dx+8}" y2="${yy}"/>`;
    s += `<line class="de" x1="${x2+8}" y1="${bot}" x2="${dx+8}" y2="${bot}"/>`;
    s += `<line class="dl" x1="${dx}" y1="${yy}" x2="${dx}" y2="${bot}" marker-start="url(#jig-ar)" marker-end="url(#jig-ar)"/>`;
    s += `<text class="dnum" x="${dx}" y="${yy-8}" text-anchor="middle">${fmt16(o.v)}″</text>`;
  });
  return s + '</svg>';
}
function renderXsec(){
  const svg = xsecSVG();
  document.getElementById('jig-xsec-preview').innerHTML =
    svg || '<p class="hint" style="margin:8px 0">Enter a total thickness to draw the section.</p>';
  const T = parseInches(S.xsec.thickness);
  const bad = [];
  S.xsec.heights.forEach((h,i)=>{
    const v = parseInches(h);
    if ((h||'').trim() && v == null) bad.push(`Scrim ${i+1} height is unreadable`);
    else if (v != null && T != null && v >= T) bad.push(`Scrim ${i+1} (${fmt16(v)}″) is at or above the total thickness`);
  });
  document.getElementById('jig-xsec-warn').textContent = bad.join(' · ');
}
/** Inner HTML of the cross-section print page (goes inside a `.page`). */
function xsecPrintHTML(){
  const T = parseInches(S.xsec.thickness);
  const svg = xsecSVG();
  const rows = xsecScrims(T).map(o =>
    `<tr><td class="c b">Scrim ${o.n}</td><td>${fmt16(o.v)}″ from bottom</td><td>${fmt16(T - o.v)}″ from top</td></tr>`).join('');
  return `
    <div class="titlerow"><h1>Panel Cross-Section — Scrim Placement</h1>
      <div class="meta"><b style="font-size:13px;color:#333">${esc(projTitle())}</b><br>${esc(S.date)}</div></div>
    <div class="xsec-wrap" style="margin-top:0.35in">${svg || '<p>No section — enter a total concrete thickness.</p>'}</div>
    ${rows ? `<table class="list" style="margin-top:0.35in"><thead><tr>
      <th style="width:20%" class="c">Scrim</th><th style="width:40%">Height from bottom</th><th style="width:40%">Depth from top</th>
    </tr></thead><tbody>${rows}</tbody></table>` : ''}
    <p class="listnote">Total concrete thickness <b>${T != null ? fmt16(T) : '?'}″</b>.
      Grey = concrete; dashed lines = scrim layers. Heights are measured from the bottom (face) of the panel;
      “depth from top” matches the jig foot depth pressed from the top of the pour.</p>
    <div class="pfoot"><span>Scrim Jigs · ${esc(projTitle())}</span><span>Panel Cross-Section</span></div>`;
}
function printXsec(){
  if (!S) return;
  printViaIframe('Panel Cross-Section — ' + projTitle(),
    `<section class="page">${xsecPrintHTML()}</section>`);
}
function printJigs(){
  if (!S) return;
  const out = document.getElementById('jig-output');
  const pages = out ? out.querySelectorAll('.page') : [];
  if (!pages.length){ alert('Add at least one panel with a valid width to generate jigs.'); return; }
  printViaIframe('Jig List — ' + projTitle(), [...pages].map(p => p.outerHTML).join(''));
}

/* ===================== hidden print iframe ==================== */

/** Reusable arrow-marker defs — referenced by every dimension line. */
const MARKER_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <marker id="jig-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M2 1L8 5L2 9" fill="none" stroke="#1f3a93" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
  </marker>
</defs></svg>`;

/* The print iframe gets its own document, so it carries the tool's page CSS
   un-prefixed (verbatim from the source tool, with the print-mode page
   sizing applied unconditionally). */
const PRINT_DOC_CSS = `
  :root{
    --ink:#1a1a1a; --sub:#555; --line:#111; --blue:#1f3a93;
    --tan:#efe2c2; --wall:#d9d9d9; --hdr:#eaeaea; --rowb:#f6f1e6;
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:var(--ink);background:#fff;
       -webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{size:letter portrait;margin:0}
  .page{width:8.5in;height:10.9in;overflow:hidden;background:#fff;margin:0;padding:0.5in;
        position:relative;page-break-after:always}
  .page:last-child{page-break-after:auto}
  h1{font-size:22px;font-weight:700;margin:0}
  .titlerow{display:flex;justify-content:space-between;align-items:flex-end;
            border-bottom:1.5px solid var(--line);padding-bottom:8px;margin-bottom:16px}
  .titlerow .meta{text-align:right;font-size:12px;color:var(--sub);line-height:1.5}
  .pfoot{position:absolute;left:0.5in;right:0.5in;bottom:0.3in;
         border-top:.5px solid #bbb;padding-top:4px;font-size:10px;color:#888;
         display:flex;justify-content:space-between}
  .rules{font-size:12.5px;line-height:1.7;margin:14px 0 0}
  .rules li{margin-bottom:5px}
  .rules b{color:#000}
  .instr-svg{display:block;width:100%;max-width:6.6in;margin:6px auto 0}

  table.list{border-collapse:collapse;width:100%;font-size:13px;margin-top:6px}
  table.list thead th{background:var(--hdr);border:1px solid var(--line);padding:7px 8px;
           text-align:left;font-size:12px;letter-spacing:.3px}
  table.list tbody td{border:1px solid #cfcfcf;padding:6px 8px}
  table.list td.c{text-align:center}
  table.list td.b{font-weight:700;white-space:nowrap}
  table.list tr.w1{background:var(--rowb)}
  .listnote{font-size:12px;color:#333;margin-top:12px;line-height:1.6}

  .grid{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;
        gap:0.28in;margin-top:10px;height:8.7in}
  .card{border:1px solid #222;border-radius:6px;padding:8px 10px 6px;
        display:flex;flex-direction:column;break-inside:avoid;position:relative}
  .card-h{display:flex;align-items:baseline;gap:10px;border-bottom:.5px solid #ccc;
          padding-bottom:5px;margin-bottom:2px}
  .qtybig{position:absolute;top:38px;right:14px;text-align:center;line-height:.85;
          color:var(--blue);pointer-events:none;background:rgba(255,255,255,.86);
          border-radius:9px;padding:3px 10px 5px}
  .qtybig .num{font-size:46px;font-weight:800;display:block}
  .qtybig .lab{font-size:10px;font-weight:700;letter-spacing:2px;color:#888}
  .card-h .jno{font-size:15px;font-weight:800;letter-spacing:.5px}
  .card-h .jid{font-size:13px;font-weight:600;color:#333}
  .cardsvg{flex:1;width:100%;min-height:0}
  .card-f{font-size:11px;color:#333;border-top:.5px solid #ccc;padding-top:5px;margin-top:2px}
  .card-f b{color:#000}

  .pl{fill:var(--tan);stroke:var(--line);stroke-width:1.6;stroke-linejoin:round}
  .wl{fill:var(--wall);stroke:var(--line);stroke-width:.8}
  .scr{stroke:var(--line);stroke-width:.8;stroke-dasharray:5 3}
  .rlbl{font-size:11px;font-weight:700;letter-spacing:.5px;fill:var(--ink)}
  .dnum{font-size:13px;font-weight:700;fill:var(--blue)}
  .dl{stroke:var(--blue);stroke-width:1;fill:none}
  .de{stroke:var(--blue);stroke-width:.7;stroke-dasharray:3 2;fill:none}
  .il{font-style:italic;font-size:11px;fill:#777}

  .conc{fill:#c9c9c9;stroke:var(--line);stroke-width:1.5}
  .xsec-wrap{margin:12px auto 2px;text-align:center}
  .xsec-wrap svg{max-width:100%;height:auto}
`;

/**
 * Print via a hidden iframe (portal pattern) — build a complete document,
 * write it in, print it, remove the iframe.
 */
function printViaIframe(title, bodyHTML, css){
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>`
    + `<style>${css || PRINT_DOC_CSS}</style></head><body>${MARKER_DEFS}${bodyHTML}</body></html>`;

  // Remove any leftover iframe from a prior print attempt.
  const prior = document.getElementById('jig-print-frame');
  if (prior) prior.remove();

  // Hidden iframe — kept off-screen rather than display:none so browsers
  // reliably layout & print the contents.
  const iframe = document.createElement('iframe');
  iframe.id = 'jig-print-frame';
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
      logger.error('[jig-list] print failed:', err);
      cleanup();
    }
    // Safety net: clean up after 60s even if afterprint never fires.
    setTimeout(cleanup, 60000);
  }, { once: true });

  const doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
  if (!doc) { iframe.remove(); return; }
  doc.open();
  doc.write(html);
  doc.close();
}

/* ============================ editor build ========================== */

function buildEditor(){
  if (!S) return;
  // cross-section designer
  buildXsecFields(); renderXsec();

  // project fields — the title comes from the portal project record (Info tab)
  document.getElementById('jig-proj-fields').innerHTML =
    `<div class="fld"><label>Date</label>
       <input data-sec="settings" data-field="date" value="${esc(S.date)}" style="width:160px" placeholder="${todayISO()}"></div>`;

  // geometry fields
  document.getElementById('jig-geo-fields').innerHTML = [
    geoFld('overhang', 'Handle overhang (total)', S.overhang, 'W + this'),
    geoFld('clearance','Foot clearance (total)',  S.clearance,'W − this'),
    geoFld('handleH',  'Handle height',           S.handleH,  'label only')
  ].join('');

  buildDepthTable();

  // panels
  document.getElementById('jig-panel-wrap').innerHTML = `<table class="edit"><thead><tr>
      <th class="row-n">#</th><th style="width:30%">Label / type</th><th style="width:18%">Width</th>
      <th style="width:10%">Qty</th><th style="width:18%">Group <span style="font-weight:400;color:#999">(optional)</span></th>
      <th style="width:14%">Source</th><th class="del"></th></tr></thead><tbody>`
    + S.panels.map((p,i)=>`<tr>
        <td class="row-n">${i+1}</td>
        <td><input data-sec="panel" data-idx="${i}" data-field="label" value="${esc(p.label)}" placeholder="e.g. A·1"></td>
        <td><input data-sec="panel" data-idx="${i}" data-field="W" value="${esc(p.W)}" placeholder="${p.custom ? 'custom — no width' : '44-1/8'}"></td>
        <td><input data-sec="panel" data-idx="${i}" data-field="qty" value="${esc(p.qty)}" placeholder="0"></td>
        <td><input data-sec="panel" data-idx="${i}" data-field="group" value="${esc(p.group)}" placeholder="Casting 1"></td>
        <td class="src">${panelSourceTag(p)}</td>
        <td class="del"><button type="button" data-act="del-panel" data-idx="${i}" title="Remove">×</button></td>
      </tr>`).join('') + `</tbody></table>`;

  refreshWarnings();
  refreshImportStamp();
  buildCutFields();
}
function buildDepthTable(){
  document.getElementById('jig-depth-wrap').innerHTML = `<table class="edit"><thead><tr>
      <th class="row-n">#</th><th style="width:22%">Depth</th><th style="width:26%">Type</th><th>Label</th><th class="del"></th></tr></thead><tbody>`
    + S.depths.map((d,i)=>{
        const linked = d.scrim != null;
        const depthCell = linked
          ? `<input value="${esc(d.d)}" disabled title="Comes from the cross-section: total thickness − Scrim ${d.scrim+1} height">`
          : `<input data-sec="depth" data-idx="${i}" data-field="d" value="${esc(d.d)}" placeholder="1/4">`;
        const typeCell = linked
          ? `<span class="jig-linked">Scrim ${d.scrim+1} · from cross-section</span>`
          : `<select data-sec="depth" data-idx="${i}" data-field="kind">
              <option value=""${d.kind === 'check' ? '' : ' selected'}>Extra (type your label)</option>
              <option value="check"${d.kind === 'check' ? ' selected' : ''}>Height check jig</option></select>`;
        const labelCell = (!linked && d.kind === 'check')
          ? `<input data-auto-label="${i}" value="${esc(depthLabelOf(d))}" disabled title="Generated: total concrete thickness − this depth">`
          : `<input data-sec="depth" data-idx="${i}" data-field="label" value="${esc(d.label)}" placeholder="First Scrim">`;
        const delCell = linked ? '' : `<button type="button" data-act="del-depth" data-idx="${i}" title="Remove">×</button>`;
        return `<tr><td class="row-n">${i+1}</td><td>${depthCell}</td><td>${typeCell}</td><td>${labelCell}</td><td class="del">${delCell}</td></tr>`;
      }).join('') + `</tbody></table>`;
}
const SCRIM_ORDINALS = ['First','Second','Third','Fourth','Fifth','Sixth','Seventh','Eighth','Ninth','Tenth'];
/**
 * Keep one foot depth per cross-section scrim (depth = thickness − height).
 * A scrim with no row yet first adopts an unlinked depth that already has the
 * right value (lists saved before the link existed); otherwise a row is added.
 * Hand-added rows are never changed. Runs only when the cross-section is edited.
 */
function syncDepthsFromXsec(adoptOnly){
  const T = parseInches(S.xsec.thickness);
  const n = S.xsec.heights.length;
  if (!adoptOnly) S.depths = S.depths.filter(dp => dp.scrim == null || dp.scrim < n);
  for (let i = 0; i < n; i++){
    const h = parseInches(S.xsec.heights[i]);
    const ok = T != null && h != null && h > 0 && h < T;
    let dp = S.depths.find(x => x.scrim === i);
    if (!dp && ok){
      dp = S.depths.find(x => x.scrim == null && x.kind !== 'check' && parseInches(x.d) === T - h);
      if (dp) dp.scrim = i;
    }
    if (adoptOnly) continue;   // on load: only recognise what is already there, change nothing
    if (!dp){ dp = { d:'', label: (SCRIM_ORDINALS[i] || ('#' + (i+1))) + ' Scrim', scrim: i }; S.depths.push(dp); }
    dp.d = ok ? fmt16(T - h) : '';
  }
  if (adoptOnly) return;
  S.depths = S.depths.filter(x => x.scrim != null).sort((a,b) => a.scrim - b.scrim)
    .concat(S.depths.filter(x => x.scrim == null));
}
function panelSourceTag(p){
  const tags = [];
  if (p.src === 'inv') tags.push('<span class="jig-tag">inventory</span>');
  if (p.custom) tags.push(`<span class="jig-tag jig-tag-c">${customLabel(p.custom)}</span>`);
  const w = parseInches(p.W), m = parseInches(p.Wmax);
  if (w != null && m != null && m > w) tags.push(`<span class="jig-tag-fit">fits to ${fmt16(m)}″</span>`);
  return tags.join(' ');
}
/** Generated "Height Check Jig" labels follow the depth / thickness as they are typed. */
function refreshDepthLabels(){
  document.querySelectorAll('#jig-depth-wrap [data-auto-label]').forEach(el => {
    const dp = S.depths[+el.dataset.autoLabel];
    if (dp) el.value = depthLabelOf(dp);
  });
}
function geoFld(field, label, val, unit){
  return `<div class="fld"><label>${label}</label>
    <input data-sec="settings" data-field="${field}" value="${esc(val)}" style="width:140px">
    <span class="u">${unit}</span></div>`;
}
function refreshWarnings(){
  const bad = S.panels.filter(p => (p.W||'').trim() && parseInches(p.W) == null).length;
  document.getElementById('jig-panel-warn').textContent =
    bad ? `${bad} panel${bad>1?'s have':' has'} an unreadable width and ${bad>1?'were':'was'} skipped.` : '';
}

function liveUpdate(){ scheduleSave(); refreshWarnings(); clearTimeout(renderTimer); renderTimer = setTimeout(renderOutput, 160); }

function onEditorInput(e){
  if (!S) return;
  const el = e.target; const sec = el.dataset.sec;
  if (sec === 'xsec'){
    if (el.dataset.field === 'thickness'){
      // Heights that were an even split (or still empty) follow the new thickness;
      // heights somebody typed by hand are left alone.
      S.xsec.thickness = el.value;
      const even = S.xsec.auto ? evenScrimHeights(S.xsec.heights.length) : null;
      if (even){ S.xsec.heights = even; buildXsecHeights(); }
    }
    else if (el.dataset.field === 'count'){
      const n = Math.max(0, Math.min(10, parseInt(el.value, 10) || 0));
      while (S.xsec.heights.length < n) S.xsec.heights.push('');
      if (S.xsec.heights.length > n) S.xsec.heights.length = n;
      // A new layer count re-splits the thickness evenly between the scrims.
      const even = evenScrimHeights(n);
      if (even) S.xsec.heights = even;
      S.xsec.auto = true;
      buildXsecHeights();
    }
    else if (el.dataset.field === 'h'){ S.xsec.heights[+el.dataset.idx] = el.value; S.xsec.auto = false; }   // typed by hand — stop following
    // The cross-section owns the scrim foot depths — keep them in step.
    syncDepthsFromXsec(); buildDepthTable();
    renderXsec(); liveUpdate();
    return;
  }
  if (sec === 'cut'){
    const c = cutState();
    c[el.dataset.field] = el.value;
    // Stock follows the material unless the user then picks otherwise.
    if (el.dataset.field === 'material'){ c.sheet = el.value === 'bb' ? '5x12' : '4x8'; buildCutFields(); }
    scheduleSave(); renderCutSummary(); return;
  }
  if (sec === 'settings'){ S[el.dataset.field] = el.value; }
  else if (sec === 'depth'){
    const dp = S.depths[+el.dataset.idx];
    if (el.dataset.field === 'kind'){
      if (el.value) dp.kind = el.value; else delete dp.kind;
      scheduleSave(); buildEditor(); renderOutput(); return;
    }
    dp[el.dataset.field] = el.value;
    if (el.dataset.field === 'd') refreshDepthLabels();
  }
  else if (sec === 'panel'){ S.panels[+el.dataset.idx][el.dataset.field] = el.value;
    // A hand-typed width replaces the imported "fits up to" range.
    if (el.dataset.field === 'W') delete S.panels[+el.dataset.idx].Wmax;
    if (el.dataset.field === 'group'){ scheduleSave(); buildPrintSetBar(activeGroups()); } }
  liveUpdate();
}
function onEditorClick(e){
  if (!S) return;
  const act = e.target.dataset.act; if (!act) return;
  const idx = +e.target.dataset.idx;
  if (act === 'add-panel'){ S.panels.push({label:'',W:'',qty:'',group: currentGroup||''}); }
  else if (act === 'del-panel'){ S.panels.splice(idx,1); if(!S.panels.length) S.panels.push({label:'',W:'',qty:'',group:''}); }
  else if (act === 'add-depth'){ S.depths.push({d:'',label:''}); }
  else if (act === 'del-depth'){ S.depths.splice(idx,1); }
  else if (act === 'print-xsec'){ printXsec(); return; }
  else if (act === 'even-xsec'){
    const even = evenScrimHeights(S.xsec.heights.length);
    if (!even){ alert('Enter the total concrete thickness and at least one scrim first.'); return; }
    S.xsec.heights = even; S.xsec.auto = true;
    syncDepthsFromXsec();
  }
  else if (act === 'import-inv'){ openImportModal(); return; }
  else if (act === 'print-cut'){ printCutMaps(); return; }
  else if (act === 'clear'){ if(confirm('Clear all panels, depths and settings for THIS casting? Other castings are not touched.')){ S = freshState(); afterLoad(); } return; }
  else return;
  scheduleSave(); buildEditor(); renderOutput();
}

function afterLoad(){
  fixXsec(); currentGroup = null;
  // The printed title always mirrors the portal project record (Info tab).
  if (currentProjectName) S.project = currentProjectName;
  // Clear all replaced the state object — keep the per-casting map in sync.
  if (currentCastingId) stateByCasting.set(currentCastingId, S);
  // Immediate save (not debounced) — a clear should persist now.
  if (currentProjectNumber && currentCastingId) doSave(currentProjectNumber, currentCastingId, S);
  buildEditor(); renderOutput();
}

/* ================= import from casting inventory ================= */

const IMPORT_DEFAULTS = { tol: '1', jigQty: '2', clearance: '3' };
let impParts = [];     // distinct parts (type + size) of the active casting's inventory
let impDraft = null;   // working copy of S.inv while the modal is open

/** S.inv = { tol, jigQty, choices:{partKey:{mode,W}}, importedAt } — created on demand. */
function invState(){
  if (!S.inv || typeof S.inv !== 'object') S.inv = {};
  if (!S.inv.choices || typeof S.inv.choices !== 'object') S.inv.choices = {};
  if (S.inv.tol == null) S.inv.tol = IMPORT_DEFAULTS.tol;
  if (S.inv.jigQty == null) S.inv.jigQty = IMPORT_DEFAULTS.jigQty;
  return S.inv;
}

/** Inventory rows -> one entry per distinct part (same type + same two sizes). */
function collapseInventory(rows){
  const map = new Map();
  for (const r of rows || []){
    const type = String(r.type || '').trim();
    const dims = [parseInches(r.width), parseInches(r.length)].filter(v => v != null && v > 0).sort((a,b) => a - b);
    const key = type.toLowerCase() + '|' + (dims.length ? dims.join('x') : String(r.width || '') + 'x' + String(r.length || ''));
    let p = map.get(key);
    if (!p){
      p = { key, type, sizeTxt: [r.width, r.length].map(v => String(v || '').trim() || '?').join(' × '),
            short16: dims.length ? dims[0] : null, long16: dims.length > 1 ? dims[1] : null, qty: 0 };
      map.set(key, p);
    }
    p.qty += (parseInt(r.quantity, 10) || 0);
  }
  const parts = [...map.values()];
  // A type cast in more than one size needs the size in its label to stay unambiguous.
  const perType = {};
  parts.forEach(p => { const t = p.type.toLowerCase(); perType[t] = (perType[t] || 0) + 1; });
  parts.forEach(p => {
    const size = p.short16 != null ? ` (${fmt16(p.short16)}${p.long16 != null ? '×' + fmt16(p.long16) : ''})` : '';
    p.label = (p.type || '?') + (perType[p.type.toLowerCase()] > 1 ? size : '');
  });
  return parts;
}

function choiceOf(inv, p){
  const c = inv.choices[p.key];
  return (c && c.mode) ? c : { mode: 'short', W: '' };
}

/**
 * Turn parts + choices into jig rows. Standard widths (short / long side) are
 * sorted and swept from the narrowest: every width within `tol` of a group's
 * narrowest joins that group. Custom jigs never share.
 */
function planImport(parts, inv){
  const tolParsed = parseInches(inv.tol);
  const tol16 = tolParsed == null ? 16 : Math.max(0, tolParsed);
  const sized = [], custom = [], unreadable = [], missing = [];
  for (const p of parts){
    const c = choiceOf(inv, p);
    if (c.mode === 'cnc'){ custom.push({ p, kind: 'cnc' }); continue; }
    let w;
    if (c.mode === 'saw'){                       // custom width — a normal table-saw jig, width required
      w = parseInches(c.W);
      if (w == null || w <= 0){ missing.push(p); continue; }
    } else {
      w = c.mode === 'long' ? (p.long16 != null ? p.long16 : p.short16) : p.short16;
      if (w == null){ unreadable.push(p); continue; }
    }
    sized.push({ p, w });
  }
  sized.sort((a,b) => a.w - b.w);
  const groups = [];
  for (const s of sized){
    const g = groups[groups.length - 1];
    if (g && s.w - g.lo <= tol16){ g.items.push(s); g.hi = Math.max(g.hi, s.w); }
    else groups.push({ lo: s.w, hi: s.w, items: [s] });
  }
  groups.forEach(g => { g.label = [...new Set(g.items.map(s => s.p.label))].join(', '); });
  return { groups, custom, unreadable, missing };
}

async function openImportModal(){
  if (!S || !currentCastingId) return;
  const c = activeCasting();
  const castingId = currentCastingId;
  impDraft = structuredClone(invState());
  // First import on this list proposes the shop's shared-jig clearance; after that the
  // Geometry setting is the truth.
  impDraft.clearance = S.inv.importedAt ? S.clearance : IMPORT_DEFAULTS.clearance;
  impParts = [];
  document.getElementById('jig-imp-hint').innerHTML =
    `Casting <b>${esc((c && c.casting_number) || '')}</b> — pick which side each part’s jig runs across. `
    + `The <b>short side</b> is pre-selected; your picks are remembered for the next import. `
    + `Rows made by an earlier import are rebuilt (their Qty is kept); rows you added by hand are not touched.`;
  document.getElementById('jig-imp-opts').innerHTML = '';
  document.getElementById('jig-imp-parts').innerHTML = '<div class="jig-imp-empty">Loading inventory…</div>';
  document.getElementById('jig-imp-preview').innerHTML = '';
  document.getElementById('jig-imp-confirm').disabled = true;
  document.getElementById('jig-imp-modal').hidden = false;
  let rows = [];
  try { rows = await loadCastingInventory(castingId); }
  catch (err) {
    logger.error('[jig-list] inventory load failed:', err);
    document.getElementById('jig-imp-parts').innerHTML = '<div class="jig-imp-empty jig-imp-err">Could not load the casting inventory.</div>';
    return;
  }
  if (castingId !== currentCastingId || !impDraft) return;   // switched / closed meanwhile
  impParts = collapseInventory(rows);
  renderImportModal();
}

function closeImportModal(){
  document.getElementById('jig-imp-modal').hidden = true;
  impDraft = null; impParts = [];
}

function renderImportModal(){
  if (!impDraft) return;
  if (!impParts.length){
    document.getElementById('jig-imp-parts').innerHTML =
      '<div class="jig-imp-empty">This casting has no inventory yet — fill in the Casting Inventory first.</div>';
    return;
  }
  document.getElementById('jig-imp-opts').innerHTML = `
    <label>Widths within <input data-imp-opt="tol" value="${esc(impDraft.tol)}">″ share one jig</label>
    <label>Foot = narrowest width − <input data-imp-opt="clearance" value="${esc(impDraft.clearance)}">″</label>
    <label>Jigs per width <input data-imp-opt="jigQty" value="${esc(impDraft.jigQty)}"></label>`;
  document.getElementById('jig-imp-parts').innerHTML = `<table class="jig-imp-table"><thead><tr>
      <th>Part</th><th>Size (inventory)</th><th class="c">Qty</th><th>Jig runs across</th></tr></thead><tbody>`
    + impParts.map(p => {
        const c = choiceOf(impDraft, p);
        const square = p.long16 == null || p.long16 === p.short16;
        const seg = (mode, text, disabled) =>
          `<button type="button" data-imp-mode="${mode}" class="${c.mode === mode ? 'on' : ''}"${disabled ? ' disabled' : ''}>${text}</button>`;
        return `<tr data-imp-key="${esc(p.key)}">
          <td class="b">${esc(p.label)}</td><td>${esc(p.sizeTxt)}</td><td class="c">${p.qty || ''}</td>
          <td><div class="jig-imp-seg">
            ${seg('short', p.short16 != null ? `${fmt16(p.short16)}″ ${square ? '' : 'short side'}` : 'no readable size', p.short16 == null)}
            ${square ? '' : seg('long', `${fmt16(p.long16)}″ long side`, false)}
            ${seg('saw', 'Custom width', false)}
            ${seg('cnc', 'Custom CNC', false)}
            ${c.mode === 'saw' ? `<input data-imp-saw value="${esc(c.W || '')}" placeholder="width — required">
              <span class="jig-imp-note" data-imp-note></span>` : ''}
          </div></td></tr>`;
      }).join('') + `</tbody></table>`;
  renderImportPreview();
}

function renderImportPreview(){
  if (!impDraft) return;
  const plan = planImport(impParts, impDraft);
  const clr = parseInches(impDraft.clearance) || 0;
  const qty = esc(String(impDraft.jigQty || '').trim());
  document.querySelectorAll('#jig-imp-parts [data-imp-note]').forEach(el => {
    el.textContent = `Enter the width being screeded — ${fmt16(clr)}″ is subtracted from it for the jig foot, like every other jig.`;
  });
  const lines = plan.groups.map(g =>
    `<li><b>${fmt16(g.lo)}″</b> → foot <b>${fmt16(g.lo - clr)}″</b>${g.hi > g.lo ? ` <span class="fit">fits ${fmt16(g.lo)}″–${fmt16(g.hi)}″</span>` : ''}`
    + ` — ${esc(g.label)}${qty ? ` <span class="q">×${qty}</span>` : ''}</li>`);
  plan.custom.forEach(k => lines.push(
    `<li class="cus"><b>Custom CNC</b> (reminder only — not drawn, not on the cut maps) — ${esc(k.p.label)}</li>`));
  let bad = '';
  if (plan.missing.length) bad += `<div class="jig-imp-err">Enter a custom width for: ${plan.missing.map(p => esc(p.label)).join(', ')}</div>`;
  if (plan.unreadable.length) bad += `<div class="jig-imp-err">No readable size in the inventory — set these to Custom width or Custom CNC: ${plan.unreadable.map(p => esc(p.label)).join(', ')}</div>`;
  const n = plan.groups.length + plan.custom.length;
  document.getElementById('jig-imp-preview').innerHTML =
    `<h3>Jig rows this will create <span>(${n}) — each one is cut once per foot depth</span></h3><ul>${lines.join('')}</ul>${bad}`;
  document.getElementById('jig-imp-confirm').disabled = !n || plan.missing.length > 0 || plan.unreadable.length > 0;
}

function setImportMode(key, mode){
  if (!impDraft) return;
  const prev = impDraft.choices[key] || {};
  if (mode === 'short') delete impDraft.choices[key];          // default — nothing to remember
  else impDraft.choices[key] = { mode, W: mode === 'saw' ? (prev.W || '') : '' };
  renderImportModal();
}

function onImportInput(e){
  if (!impDraft) return;
  const el = e.target;
  if (el.dataset.impOpt){ impDraft[el.dataset.impOpt] = el.value; renderImportPreview(); return; }
  if (el.dataset.impSaw !== undefined){
    const key = el.closest('[data-imp-key]').dataset.impKey;
    impDraft.choices[key] = { mode: 'saw', W: el.value };
    renderImportPreview();
  }
}

/** Rebuild the imported rows from the draft; keep hand-added rows and per-width Qty edits. */
function confirmImport(){
  if (!S || !impDraft) return;
  const plan = planImport(impParts, impDraft);
  const keptQty = new Map();
  S.panels.forEach(p => { if (p.src === 'inv' && (p.qty || '').trim()) keptQty.set(importRowKey(p), p.qty); });
  const defQty = String(impDraft.jigQty || '').trim();
  const made = [];
  plan.groups.forEach(g => {
    const row = { label: g.label, W: fmt16(g.lo), qty: defQty, group: '', src: 'inv' };
    if (g.hi > g.lo) row.Wmax = fmt16(g.hi);
    made.push(row);
  });
  plan.custom.forEach(k => made.push(
    { label: k.p.label, W: '', qty: defQty, group: '', src: 'inv', custom: k.kind }));
  made.forEach(r => { const q = keptQty.get(importRowKey(r)); if (q) r.qty = q; });
  const manual = S.panels.filter(p => p.src !== 'inv' && ((p.label || '').trim() || (p.W || '').trim()));
  S.panels = made.concat(manual);
  if (!S.panels.length) S.panels.push({ label:'', W:'', qty:'', group:'' });

  const { clearance, ...inv } = impDraft;
  S.inv = inv;
  S.inv.importedAt = new Date().toISOString();
  if (parseInches(clearance) != null) S.clearance = String(clearance).trim();
  closeImportModal();
  scheduleSave(); buildEditor(); renderOutput();
}
/** Identity of an imported row for keeping its Qty: custom rows by label, the rest by width. */
function importRowKey(r){
  return r.custom ? 'c:' + r.custom + ':' + (r.label || '') : 'w:' + parseInches(r.W);
}

function refreshImportStamp(){
  const el = document.getElementById('jig-imp-stamp');
  if (!el) return;
  const iso = S && S.inv && S.inv.importedAt;
  const d = iso ? new Date(iso) : null;
  el.innerHTML = 'Last imported: <b>' + ((d && !isNaN(d))
    ? esc(d.toLocaleDateString(undefined, { weekday:'short', year:'numeric', month:'short', day:'numeric' })
        + ' at ' + d.toLocaleTimeString(undefined, { hour:'numeric', minute:'2-digit' }))
    : 'never') + '</b>';
}

/* ===================== operator cut maps ===================== */

const KERF16 = 2;   // 1/8″ on all table-saw work
const CUT_SVG_ML = 13, CUT_SVG_MR = 3.5;   // map drawing margins (inches at sheet scale): strip labels / width dimension
const CUT_SHEETS = { '4x8': { L: 96, W: 48 }, '5x9': { L: 108, W: 60 }, '5x12': { L: 144, W: 60 } };
const CUT_MATERIALS = { hdo: 'HDO', bb: 'Black Board', other: 'Other' };

/** S.cut = { material, other, thickness, sheet } — created / repaired on demand. */
function cutState(){
  if (!S.cut || typeof S.cut !== 'object') S.cut = {};
  const c = S.cut;
  if (!CUT_MATERIALS[c.material]) c.material = 'hdo';
  if (c.other == null) c.other = '';
  if (c.thickness !== '1/2' && c.thickness !== '3/4') c.thickness = '3/4';
  if (!CUT_SHEETS[c.sheet]) c.sheet = c.material === 'bb' ? '5x12' : '4x8';
  return c;
}
function cutMaterialName(c){
  return c.material === 'other' ? ((c.other || '').trim() || 'Other material') : CUT_MATERIALS[c.material];
}
function cutStockName(c){ const s = CUT_SHEETS[c.sheet]; return `${c.sheet} (${s.L}″ × ${s.W}″)`; }

function buildCutFields(){
  const el = document.getElementById('jig-cut-fields');
  if (!el || !S) return;
  const c = cutState();
  const opt = (v, text, cur) => `<option value="${v}"${v === cur ? ' selected' : ''}>${text}</option>`;
  el.innerHTML = `
    <div class="fld"><label>Material</label>
      <select data-sec="cut" data-field="material">${Object.keys(CUT_MATERIALS).map(k => opt(k, CUT_MATERIALS[k], c.material)).join('')}</select></div>
    ${c.material === 'other' ? `<div class="fld"><label>Material name</label>
      <input data-sec="cut" data-field="other" value="${esc(c.other)}" style="width:180px" placeholder="type the material"></div>` : ''}
    <div class="fld"><label>Thickness</label>
      <select data-sec="cut" data-field="thickness">${['1/2','3/4'].map(t => opt(t, t + '″', c.thickness)).join('')}</select></div>
    <div class="fld"><label>Sheet size</label>
      <select data-sec="cut" data-field="sheet">${Object.keys(CUT_SHEETS).map(k => opt(k, k, c.sheet)).join('')}</select></div>`;
}

/**
 * Nest the jig blanks. Table-saw logic: blanks of one height share strips
 * (first-fit, longest first, kerf after every crosscut); strips are then
 * stacked across the sheet (tallest first, kerf after every rip). Jigs with
 * identical cut dimensions are made once. Identical sheets become one map.
 */
function buildCutPlan(){
  const c = cutState();
  const SL = CUT_SHEETS[c.sheet].L * 16, SW = CUT_SHEETS[c.sheet].W * 16;
  const { jigs, customs } = buildJigs();
  const hH = parseInches(S.handleH);
  const handleH16 = (hH != null && hH > 0) ? hH : 24;

  const blanks = [], seen = new Map();
  jigs.forEach(j => {
    const key = j.handle16 + '|' + j.foot16 + '|' + j.depth16;
    const qty = Math.max(1, parseInt(j.qty, 10) || 1);
    const ex = seen.get(key);
    if (ex){ if (!ex.names.includes(j.label)) ex.names.push(j.label); ex.qty = Math.max(ex.qty, qty); return; }
    const b = { n: j.n, names: [j.label], depthLabel: j.depthLabel, L: j.handle16, H: handleH16 + j.depth16,
                foot16: j.foot16, depth16: j.depth16, qty, maps: [] };
    seen.set(key, b); blanks.push(b);
  });
  const tooBig = blanks.filter(b => b.L > SL || b.H > SW || b.L <= 0 || b.foot16 <= 0);
  const ok = blanks.filter(b => !tooBig.includes(b));

  // Strips: fill the long edge first. Each strip is opened by the tallest (then longest) blank
  // still waiting and ripped at that height; it is then filled along the sheet length with the
  // combination of waiting blanks that leaves the shortest tail — same-height blanks first, then
  // lower ones (those get ripped down to their own height after the crosscut).
  const waiting = [];
  ok.forEach(b => { for (let i = 0; i < b.qty; i++) waiting.push(b); });
  waiting.sort((a,b) => b.H - a.H || b.L - a.L || a.n - b.n);
  const strips = [];
  while (waiting.length){
    const first = waiting.shift();
    const st = { H: first.H, used: first.L + KERF16, pieces: [first] };
    [p => p.H === st.H, () => true].forEach(allowed => {
      const pool = waiting.filter(allowed);
      cutBestFill(pool, SL + KERF16 - st.used).forEach(b => {
        waiting.splice(waiting.indexOf(b), 1);
        st.pieces.push(b); st.used += b.L + KERF16;
      });
    });
    st.pieces.sort((a,b) => b.H - a.H || b.L - a.L || a.n - b.n);
    let x = 0;
    st.pieces = st.pieces.map(b => { const p = { b, x }; x += b.L + KERF16; return p; });
    strips.push(st);
  }
  // sheets
  const sheets = [];
  strips.forEach(st => {
    let sh = sheets.find(x => x.used + st.H <= SW);
    if (!sh){ sh = { used: 0, strips: [] }; sheets.push(sh); }
    sh.strips.push({ ...st, y: sh.used });
    sh.used += st.H + KERF16;
  });
  // identical sheets -> one map with a QTY
  const maps = [];
  sheets.forEach(sh => {
    const sig = sh.strips.map(s => s.H + ':' + s.pieces.map(p => p.b.n).join(',')).join(';');
    const m = maps.find(x => x.sig === sig);
    if (m) m.qty++; else maps.push({ sig, qty: 1, sheet: sh });
  });
  maps.forEach((m, i) => {
    m.no = i + 1;
    const frac = Math.min(1, Math.max(0, m.sheet.used - KERF16) / SW);
    m.frac = frac;
    m.consumption = frac >= 0.8 ? 1 : Math.ceil(frac * 4) / 4;   // 1/4-sheet rounding, 80% = full sheet
    m.sheet.strips.forEach(s => s.pieces.forEach(p => { if (!p.b.maps.includes(m.no)) p.b.maps.push(m.no); }));
  });
  return { c, SL, SW, blanks, ok, tooBig, customs, maps,
           pieceCount: ok.reduce((t,b) => t + b.qty, 0),
           physical: maps.reduce((t,m) => t + m.qty, 0),
           consumption: maps.reduce((t,m) => t + m.consumption * m.qty, 0) };
}

let lastCutDoc = '';   // what the live frame currently shows — skip rewrites when nothing changed

/** Live cut-map pages under the jig drawings. They are the printout's own pages, shown in a frame
    so they keep their own (landscape) stylesheet. */
/** The blanks from `pool` whose lengths (+ kerf each) best fill `room` sixteenths — subset-sum. */
function cutBestFill(pool, room){
  if (room <= 0 || !pool.length) return [];
  const reach = new Array(room + 1).fill(-1);   // reach[w] = index of the last blank used to total w
  const prev = new Array(room + 1).fill(-1);
  reach[0] = -2;
  pool.forEach((b, i) => {
    const w = b.L + KERF16;
    for (let t = room; t >= w; t--){
      if (reach[t] === -1 && reach[t - w] !== -1 && reach[t - w] !== i){ reach[t] = i; prev[t] = t - w; }
    }
  });
  let best = room; while (best > 0 && reach[best] === -1) best--;
  const picked = [];
  for (let t = best; t > 0; t = prev[t]) picked.push(pool[reach[t]]);
  return picked;
}

function renderCutLive(plan){
  const host = document.getElementById('jig-cut-output');
  if (!host) return;
  const show = plan.blanks.length && !plan.tooBig.length;
  const docHtml = show
    ? `<!doctype html><html><head><meta charset="utf-8"><style>${CUT_DOC_CSS}
        html,body{background:transparent}
        .page{margin:0 auto 18px;background:#fff;border:1px solid #e2e8f0;box-shadow:0 1px 4px rgba(15,23,42,.10)}
       </style></head><body>${buildCutPages(plan)}</body></html>`
    : '';
  if (docHtml === lastCutDoc && host.childElementCount) return;
  lastCutDoc = docHtml;
  if (!show){
    host.innerHTML = plan.tooBig.length
      ? `<div class="emptyhint" style="color:#b91c1c">Cut maps are on hold — a jig is longer than the chosen sheet. Pick a longer sheet size in “Operator cut maps”.</div>` : '';
    return;
  }
  let frame = host.querySelector('iframe');
  if (!frame){
    host.innerHTML = '<iframe class="jig-cut-frame" title="Operator cut maps" scrolling="no"></iframe>';
    frame = host.querySelector('iframe');
  }
  // Landscape pages are 11in wide — shrink the whole frame document to the room there is.
  const fit = () => { try {
    const FULL = 11.2 * 96, root = frame.contentDocument.documentElement;
    const z = Math.min(1, Math.max(0.4, (host.clientWidth - 4) / FULL));
    root.style.zoom = z;
    frame.style.width = Math.round(FULL * z) + 'px';
    const pages = frame.contentDocument.querySelectorAll('.page');
    const last = pages[pages.length - 1];
    frame.style.height = Math.ceil(last ? last.getBoundingClientRect().bottom + 24 : root.scrollHeight) + 'px';
  } catch (e) { /* frame gone */ } };
  // Written straight into the frame (not srcdoc): a frame navigation can be held back or
  // coalesced while the tab is in the background, which left stale maps on screen.
  const d = frame.contentDocument;
  d.open(); d.write(docHtml); d.close();
  fit();
  setTimeout(fit, 250);   // once more after fonts / layout settle
}

function renderCutSummary(){
  const el = document.getElementById('jig-cut-summary');
  if (!el || !S) return;
  const plan = buildCutPlan();
  renderCutLive(plan);
  if (!plan.blanks.length){ el.innerHTML = '<span class="muted">No jigs yet — nothing to nest.</span>'; return; }
  const c = plan.c;
  let html = `<b>${plan.pieceCount}</b> blank${plan.pieceCount === 1 ? '' : 's'} → <b>${plan.physical}</b> sheet${plan.physical === 1 ? '' : 's'} of `
    + `<b>${esc(cutMaterialName(c))} ${c.thickness}″ — ${esc(c.sheet)}</b> at the saw · consumption <b>${plan.consumption}</b> sheet${plan.consumption === 1 ? '' : 's'} · `
    + `${plan.maps.length} cut map${plan.maps.length === 1 ? '' : 's'}`;
  if (plan.tooBig.length) html += `<div class="bad">Cannot be cut from a ${esc(c.sheet)} sheet — pick a longer sheet (printing is blocked until this clears): `
    + plan.tooBig.map(b => `Jig ${b.n} ${esc(b.names.join(', '))} (${fmt16(b.L)}″)`).join('; ') + `</div>`;
  if (c.material === 'bb' && c.sheet !== '5x12') html += `<div class="note">Black Board is stocked as 5x12 only.</div>`;
  if (c.material === 'other' && !(c.other || '').trim()) html += `<div class="note">Type the material name so it prints on the maps.</div>`;
  el.innerHTML = html;
}

function cutTitle(kind){
  const cst = activeCasting();
  const num = cst ? String(cst.casting_number || '').trim() : '';
  const cast = num ? ' — ' + (/^cast/i.test(num) ? num : 'CAST ' + num) : '';
  const job = ((currentProjectNumber ? currentProjectNumber + ' ' : '') + (S.project || '')).trim();
  return `${job} — ${kind}${cast}${currentGroup ? ' — ' + currentGroup : ''}`.toUpperCase();
}
function cutPageHead(kind, color, strap, right){
  return `<div class="thead hl-${color}"><h1><span>${esc(cutTitle(kind))}</span></h1>
      <div class="meta">${right || ''}</div></div>
    <div class="strap">${esc(strap)}</div>`;
}
function cutFoot(label, pageNo, pageCount){
  return `<div class="pfoot"><span>Jig blanks · ${esc(projTitle())} · ${esc(S.date)}</span><span>${esc(label)} — page ${pageNo} of ${pageCount}</span></div>`;
}

function cutMapSVG(plan, m){
  const SLi = plan.SL / 16, SWi = plan.SW / 16, ML = CUT_SVG_ML, MT = 3.2, MB = 1;
  const vbW = SLi + ML + CUT_SVG_MR;
  const usedIn = Math.min(SWi, Math.max(0, m.sheet.used - KERF16) / 16), rest = SWi - usedIn;
  // The sheet is drawn true to scale in both directions — what you see is proportional.
  const k = 1, restBand = rest;
  const bodyH = usedIn * k + restBand, vbH = bodyH + MT + MB;
  let s = `<svg class="cutsvg" viewBox="0 0 ${vbW} ${vbH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cut map ${m.no}">`;
  s += `<text class="cdim" x="${ML + SLi/2}" y="${MT - 1.1}" text-anchor="middle">${fmt16(plan.SL)}″</text>`;
  s += `<text class="cdim" x="${ML + SLi + 1}" y="${MT + bodyH/2}" text-anchor="middle" transform="rotate(90 ${ML + SLi + 1} ${MT + bodyH/2})">${fmt16(plan.SW)}″</text>`;
  s += `<rect class="csheet" x="${ML}" y="${MT}" width="${SLi}" height="${bodyH}"/>`;
  m.sheet.strips.forEach((st, si) => {
    const y = MT + st.y / 16 * k, h = st.H / 16 * k, fs = Math.min(1.9, h * 0.6);
    s += `<text class="cstrip" x="${ML - 0.5}" y="${y + h/2 + fs*0.35}" text-anchor="end" style="font-size:${Math.min(fs, 1.5)}px">S${si+1} · rip ${fmt16(st.H)}″</text>`;
    st.pieces.forEach(p => {
      const x = ML + p.x / 16, w = p.b.L / 16, ph = p.b.H / 16 * k, low = p.b.H < st.H;
      if (low) s += `<rect class="cspare" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
      s += `<rect class="cpiece" x="${x}" y="${y}" width="${w}" height="${ph}"/>`;
      const trim = low ? ` · rip to ${fmt16(p.b.H)}″` : '';
      const full = `JIG ${p.b.n} · ${p.b.names.join(', ')} · ${fmt16(p.b.L)}″${trim}`;
      const short = `JIG ${p.b.n} · ${fmt16(p.b.L)}″${trim}`;
      // Full label if it fits; else "JIG n · length", shrunk as far as half size so a short blank still shows its length.
      const fits = (t, f) => t.length * f * 0.56 <= w - 0.6;
      let txt = '', f = fs;
      if (fits(full, fs)) txt = full;
      else {
        f = Math.min(fs, (w - 0.6) / (short.length * 0.56));
        if (f >= fs * 0.5) txt = short; else { f = fs; txt = fits('' + p.b.n, fs) ? '' + p.b.n : ''; }
      }
      if (txt) s += `<text class="cname" x="${x + 0.35}" y="${y + h/2 + f*0.35}" style="font-size:${f}px">${esc(txt)}</text>`;
    });
    const tail = SLi - Math.min(SLi, st.used / 16);
    if (tail > 0.05) s += `<rect class="cspare" x="${ML + SLi - tail}" y="${y}" width="${tail}" height="${h}"/>`;
  });
  if (rest > 0.05){
    const y0 = MT + usedIn * k;
    s += `<rect class="cspare" x="${ML}" y="${y0}" width="${SLi}" height="${restBand}"/>`;
    if (rest >= 2.5 && restBand >= 2.4) s += `<text class="ckeep" x="${ML + SLi/2}" y="${y0 + restBand/2 + 0.6}" text-anchor="middle">KEEP — ${fmt16(plan.SL)}″ × ${fmt16(Math.round(rest*16))}″ OFFCUT · BACK TO THE RACK</text>`;
  }
  return s + '</svg>';
}

/** Full print document: the takeoff cover, then one map per sheet layout. */
function buildCutPages(plan){
  const c = plan.c, mat = `${cutMaterialName(c)} ${c.thickness}″`, stock = cutStockName(c);
  const pages = [];   // {label, html}

  // ---- cover
  const ripSummary = {};
  plan.maps.forEach(m => m.sheet.strips.forEach(s => { ripSummary[s.H] = (ripSummary[s.H] || 0) + m.qty; }));
  pages.push({ label: 'Material Takeoff', html: `
    ${cutPageHead('MATERIAL TAKEOFF', 'yellow', 'SCRIM / HEIGHT-CHECK JIG BLANKS — TABLE SAW — ONE DOCUMENT PER CAST', `Issued ${esc(S.date)}`)}
    <h2>Sheet Count Summary</h2>
    <table class="list"><thead><tr><th>Material</th><th>Stock size</th><th>Process</th><th class="c">Consumption</th><th class="c">Physical sheets at the saw</th></tr></thead>
      <tbody><tr><td class="b">${esc(mat)}</td><td>${esc(stock)}</td><td>Table saw — ${plan.physical} sheet${plan.physical === 1 ? '' : 's'}</td>
        <td class="c b">${plan.consumption}</td><td class="c b">${plan.physical}</td></tr></tbody></table>
    <p class="fine">Consumption is rounded up to the nearest 1/4 sheet per map; a map using 80% or more of a sheet counts as a full sheet. Physical sheets are what gets handled at the saw.</p>
    <h2>Cut Maps</h2>
    <table class="list"><thead><tr><th class="c">Map</th><th class="c">QTY sheets</th><th class="c">Strips</th><th class="c">Blanks per sheet</th><th>Sheet used</th><th>Full-length offcut to keep</th></tr></thead><tbody>
      ${plan.maps.map(m => { const rest = plan.SW - Math.min(plan.SW, m.sheet.used);
        return `<tr><td class="c b">${m.no}</td><td class="c">${m.qty}</td><td class="c">${m.sheet.strips.length}</td>
          <td class="c">${m.sheet.strips.reduce((t,s) => t + s.pieces.length, 0)}</td><td>${Math.round(m.frac*100)}% of the width → counts as ${m.consumption}</td>
          <td>${rest >= 40 ? `${fmt16(plan.SL)}″ × ${fmt16(rest)}″` : '—'}</td></tr>`; }).join('')}
    </tbody></table>
    <h2>Jigs</h2>
    <p class="body"><b>${plan.pieceCount}</b> blanks for <b>${plan.ok.length}</b> different jigs · foot depths: ${S.depths.filter(d => parseInches(d.d) != null).map(d => `<b>${fmt16(parseInches(d.d))}″</b> ${esc(depthLabelOf(d))}`).join(' · ') || '—'}
      · handle height <b>${esc(S.handleH)}″</b> · rips: ${Object.keys(ripSummary).sort((a,b) => b - a).map(H => `${ripSummary[H]} × ${fmt16(+H)}″`).join(', ')}</p>
    <h2>Standing Rules</h2>
    <ul class="body">
      <li>Kerf is <b>1/8″</b> on every cut and is included in the maps.</li>
      <li><b>Rip the strips first, then crosscut</b> each strip left to right to the lengths printed on the blanks. Strips are filled along the long edge first; a lower blank riding in a taller strip is marked <b>rip to …</b>.</li>
      <li>Blanks are <b>square-cut rectangles</b>: handle width × (handle height + foot depth). <b>Notch the foot afterwards</b> from the jig drawings — the maps do not show the notch.</li>
      <li>Jigs with identical cut sizes are made once and shared. The <b>jig list printout</b> is the parts list — it shows every part each jig fits.</li>
    </ul>` });

  // ---- maps (the jig list printout is the parts list; lengths are printed on the blanks)
  plan.maps.forEach(m => {
    const head = `MAP ${m.no} OF ${plan.maps.length} — <u>${esc(mat)}</u> — ${esc(stock)} — QTY ${m.qty} SHEET${m.qty === 1 ? '' : 'S'}`;
    const rips = {}; m.sheet.strips.forEach(s => { rips[s.H] = (rips[s.H] || 0) + 1; });
    const ripTxt = Object.keys(rips).sort((a,b) => b - a).map(H => `${rips[H]} strip${rips[H] === 1 ? '' : 's'} at ${fmt16(+H)}″`).join(', ');
    const vbW = plan.SL / 16 + CUT_SVG_ML + CUT_SVG_MR;
    pages.push({ label: `Cut Map ${m.no}`, html: `
      ${cutPageHead('OPERATOR CUT MAPS', 'blue', 'WHAT TO CUT — SEE THE JIG DRAWINGS FOR THE FOOT NOTCH', `Map ${m.no} of ${plan.maps.length}`)}
      <div class="maphead">${head}</div>
      ${cutMapSVG(plan, m)}
      <div class="legend"><span class="sw sw-p"></span> <u>${esc(mat)}</u> jig blank &nbsp;&nbsp; <span class="sw sw-s"></span> Gray = spare / offcut &nbsp;&nbsp; Drawn to scale: 1″ on paper = ${(vbW / 10).toFixed(1)}″ on the sheet</div>
      <p class="fine"><b>Cut sequence:</b> sheet long edge against the fence. Rip top to bottom as drawn — ${ripTxt} — 1/8″ kerf each rip. Then crosscut each strip left to right to the length printed on each blank. A blank marked <b>rip to …</b> is lower than its strip — rip it down to that height after the crosscut. Cut to the printed numbers, not by scaling this drawing. Notch the foot afterwards from the jig drawings.</p>` });
  });

  return pages.map((p, i) => `<section class="page">${p.html}${cutFoot(p.label, i + 1, pages.length)}</section>`).join('');
}

function printCutMaps(){
  if (!S) return;
  const plan = buildCutPlan();
  if (!plan.blanks.length){ alert('Add at least one panel width and one foot depth first — there are no jigs to nest.'); return; }
  if (plan.tooBig.length){
    alert('These jigs cannot be cut from a ' + plan.c.sheet + ' sheet:\n\n'
      + plan.tooBig.map(b => `Jig ${b.n} — ${b.names.join(', ')} (${fmt16(b.L)}″ long)`).join('\n')
      + '\n\nPick a longer sheet size, then print again.');
    return;
  }
  if (plan.c.material === 'other' && !(plan.c.other || '').trim()){ alert('Type the material name first — it prints on every map.'); return; }
  printViaIframe('Jig Cut Maps — ' + projTitle(), buildCutPages(plan), CUT_DOC_CSS);
}

/* Landscape letter; page titles highlighted per the Material Takeoff Workflow rules
   (takeoff yellow, parts orange, cut maps blue). */
const CUT_DOC_CSS = `
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#1a1a1a;background:#fff;
       -webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{size:letter landscape;margin:0}
  .page{width:11in;height:8.4in;overflow:hidden;padding:0.45in 0.5in;position:relative;page-break-after:always}
  .page:last-child{page-break-after:auto}
  .thead{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:6px;border-bottom:4px solid #999}
  .thead h1{font-size:21px;font-weight:800;margin:0;letter-spacing:.3px}
  .thead h1 span{padding:2px 8px;border-radius:2px}
  .thead .meta{font-size:12px;color:#444;text-align:right;white-space:nowrap;padding-left:16px}
  .hl-yellow{border-color:#facc15}.hl-yellow h1 span{background:#fde047}
  .hl-orange{border-color:#fb923c}.hl-orange h1 span{background:#fdba74}
  .hl-blue{border-color:#60a5fa}.hl-blue h1 span{background:#93c5fd}
  .strap{font-size:12.5px;font-weight:700;letter-spacing:.6px;margin:6px 0 12px;color:#222}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:.8px;margin:16px 0 6px;color:#333}
  table.list{border-collapse:collapse;width:100%;font-size:12.5px}
  table.list thead th{background:#eaeaea;border:1px solid #111;padding:6px 8px;text-align:left;font-size:11.5px}
  table.list tbody td{border:1px solid #bbb;padding:5px 8px;vertical-align:top}
  table.list .c{text-align:center}
  table.list .b{font-weight:700}
  table.list td.wrap{white-space:normal;line-height:1.7}
  .pc{display:inline-block;border:1px solid #999;border-radius:3px;padding:0 6px;margin:1px 3px 1px 0;background:#f4ead0;white-space:nowrap}
  .body{font-size:13px;line-height:1.65;margin:4px 0}
  ul.body{padding-left:20px}
  .fine{font-size:11.5px;color:#333;line-height:1.55;margin:8px 0 0}
  .maphead{font-size:15px;font-weight:800;margin:0 0 6px}
  .legend{font-size:14px;font-weight:700;margin-top:6px}
  .sw{display:inline-block;width:22px;height:12px;border:1px solid #111;vertical-align:-1px}
  .sw-p{background:#efe2c2}.sw-s{background:#cfcfcf}
  .cutsvg{display:block;width:10in;max-height:5.3in;margin:0 auto}
  .csheet{fill:#fff;stroke:#111;stroke-width:.25}
  .cpiece{fill:#efe2c2;stroke:#111;stroke-width:.09}
  .cspare{fill:#cfcfcf;stroke:#777;stroke-width:.06}
  .cname{font-weight:700;fill:#111}
  .cstrip{fill:#1f3a93;font-weight:700}
  .cdim{font-size:1.9px;font-weight:700;fill:#1f3a93}
  .ckeep{font-size:1.7px;font-weight:800;fill:#333;letter-spacing:.05px}
  .pfoot{position:absolute;left:0.5in;right:0.5in;bottom:0.25in;border-top:.5px solid #bbb;padding-top:4px;
         font-size:10px;color:#777;display:flex;justify-content:space-between}
`;

/* ============================ shell ============================ */

/** Build the static UI skeleton once and wire the (delegated) events. */
function buildShell(root){
  root.innerHTML = `
${MARKER_DEFS}
<div class="pp-bt-pills" id="jig-casting-pills" style="display:none"></div>
<div class="pp-castings-hint" id="jig-no-castings" hidden>
  No castings yet. Add a casting first — each casting gets its own jig list.
</div>
<div class="bar" id="jig-topbar">
  <b>Scrim Jig Generator</b>
  <span class="savestat" id="jig-save-status" aria-live="polite"></span>
  <span class="sp"></span>
  <span class="actions">
    <button type="button" id="jig-btn-copy" class="ghost">Copy to Casting…</button>
    <button type="button" id="jig-btn-print-jigs">Print Jigs</button>
    <button type="button" id="jig-btn-print-cut">Print Cut Maps</button>
    <button type="button" id="jig-btn-print-xsec">Print Cross-Section</button>
  </span>
</div>
<div class="vbar" id="jig-vbar" style="display:none"></div>

<div class="doc" id="jig-doc">

  <!-- ====================== EDITOR (screen only) ====================== -->
  <section class="editor" id="jig-editor">

    <h2>Panel cross-section <span style="font-weight:400;text-transform:none;color:#888;font-size:12px">— scrim placement diagram</span></h2>
    <p class="hint">Enter the total concrete thickness and the number of scrims — the scrim heights are filled in so the layers <b>split the thickness evenly</b> (measured from the <b>bottom / face of the panel</b>). Type over any height for a special case; <b>Split scrims evenly</b> puts them back. Dimensions accept <b>3/4</b>, <b>1-1/2</b> or <b>0.75</b>.</p>
    <div class="fields" id="jig-xsec-fields"></div>
    <div class="fields" id="jig-xsec-heights" style="margin-top:10px"></div>
    <div class="xsec-wrap" id="jig-xsec-preview"></div>
    <div class="warn" id="jig-xsec-warn"></div>
    <div class="toolrow"><button type="button" data-act="even-xsec" title="Space the scrim layers evenly through the concrete thickness">↕ Split scrims evenly</button>
      <button type="button" data-act="print-xsec">🖨 Print cross-section</button></div>

    <h2 style="margin-top:22px">Project</h2>
    <div class="fields" id="jig-proj-fields"></div>

    <h2 style="margin-top:20px">Geometry &amp; depths</h2>
    <p class="hint">Each jig is one plywood T. <b>Handle</b> = panel width + overhang (rides on the form walls). <b>Foot</b> = panel width − clearance (drops into the cavity); its <b>depth</b> = how deep the scrim is pressed. One jig is made per panel width × per depth below.</p>
    <div class="fields" id="jig-geo-fields"></div>

    <h2 style="margin-top:20px">Foot depths <span style="font-weight:400;text-transform:none;color:#888;font-size:12px">— one jig per depth, per width</span></h2>
    <p class="hint">Every scrim layer in the cross-section above gets its foot depth here automatically (thickness − scrim height). Use <b>+ Add extra depth</b> for anything else — e.g. a <b>height check jig</b> between two scrim layers, or for parts that get no scrim at all (set # of scrims to 0).</p>
    <div id="jig-depth-wrap"></div>
    <button type="button" class="addbtn" data-act="add-depth">+ Add extra depth</button>

    <h2 style="margin-top:22px">Panels</h2>
    <p class="hint">Enter each panel’s width and quantity. Widths accept <b>44</b>, <b>44-1/8</b>, <b>44 1/8</b> or <b>44.125</b>. <b>Group</b> is optional — fill it to get per-group print buttons (like castings); leave blank for one flat list.</p>
    <div class="jig-imp-row">
      <button type="button" class="jig-imp-btn" data-act="import-inv">⭳ Import from Casting Inventory…</button>
      <span class="jig-imp-stamp" id="jig-imp-stamp"></span>
    </div>
    <div id="jig-panel-wrap"></div>
    <button type="button" class="addbtn" data-act="add-panel">+ Add panel</button>
    <div class="warn" id="jig-panel-warn"></div>

    <h2 style="margin-top:22px">Operator cut maps <span style="font-weight:400;text-transform:none;color:#888;font-size:12px">— jig blanks nested for the table saw</span></h2>
    <p class="hint">Each jig is cut from one rectangular blank: <b>handle width × (handle height + foot depth)</b>. Blanks are nested rip-first with a <b>1/8″ kerf</b>; the printout has a takeoff cover with the sheet count, the parts list, a map per sheet and a strip schedule for the saw.</p>
    <div class="fields" id="jig-cut-fields"></div>
    <div class="jig-cut-summary" id="jig-cut-summary"></div>
    <div class="toolrow"><button type="button" data-act="print-cut">🖨 Print cut maps &amp; summary</button></div>

    <h2 style="margin-top:22px">Start over</h2>
    <div class="toolrow">
      <button type="button" class="danger" data-act="clear">Clear all</button>
    </div>
    <p class="hint" style="margin-top:8px">Work auto-saves to the selected casting.</p>
  </section>

  <!-- ====================== GENERATED OUTPUT ====================== -->
  <div id="jig-output"></div>

  <!-- ============ LIVE OPERATOR CUT MAPS (own document in a frame — same pages as the printout) ============ -->
  <div id="jig-cut-output"></div>

</div>

<!-- Copy-to-casting modal (portal pp-modal classes, jig-copy-* ids) -->
<div class="pp-modal-backdrop" id="jig-copy-modal" role="dialog" aria-modal="true" aria-labelledby="jig-copy-title" hidden>
  <div class="pp-modal">
    <div class="pp-modal-header">
      <h2 id="jig-copy-title">Copy Jig List / Cross-Section</h2>
      <button type="button" class="pp-modal-close" id="jig-copy-close" aria-label="Close">&times;</button>
    </div>
    <div class="pp-modal-body">
      <p class="pp-modal-hint" id="jig-copy-hint"></p>
      <label class="pp-print-label-all"><input type="checkbox" id="jig-copy-all"> Select all</label>
      <div class="pp-print-label-list" id="jig-copy-list"></div>
    </div>
    <div class="pp-modal-actions">
      <button type="button" class="pp-secondary-btn" id="jig-copy-cancel">Cancel</button>
      <button type="button" class="pp-primary-btn" id="jig-copy-confirm" disabled>Copy</button>
    </div>
  </div>
</div>

<!-- Import-from-inventory modal (jig-imp-* ids) -->
<div class="pp-modal-backdrop" id="jig-imp-modal" role="dialog" aria-modal="true" aria-labelledby="jig-imp-title" hidden>
  <div class="pp-modal jig-imp-modal">
    <div class="pp-modal-header">
      <h2 id="jig-imp-title">Import from Casting Inventory</h2>
      <button type="button" class="pp-modal-close" id="jig-imp-close" aria-label="Close">&times;</button>
    </div>
    <div class="pp-modal-body">
      <p class="pp-modal-hint" id="jig-imp-hint"></p>
      <div class="jig-imp-opts" id="jig-imp-opts"></div>
      <div class="jig-imp-parts" id="jig-imp-parts"></div>
      <div class="jig-imp-preview" id="jig-imp-preview"></div>
    </div>
    <div class="pp-modal-actions">
      <button type="button" class="pp-secondary-btn" id="jig-imp-cancel">Cancel</button>
      <button type="button" class="pp-primary-btn" id="jig-imp-confirm" disabled>Update jig list</button>
    </div>
  </div>
</div>`;

  const editor = document.getElementById('jig-editor');
  editor.addEventListener('input', onEditorInput);
  editor.addEventListener('click', onEditorClick);

  // Casting pill row (delegated — pills re-render on every casting switch).
  document.getElementById('jig-casting-pills').addEventListener('click', (e) => {
    const pill = e.target.closest('[data-jig-pill]');
    if (!pill) return;
    handleSelectCasting(pill.dataset.castingId);
  });

  document.getElementById('jig-btn-print-jigs').onclick = printJigs;
  document.getElementById('jig-btn-print-xsec').onclick = printXsec;
  document.getElementById('jig-btn-print-cut').onclick = printCutMaps;

  // Copy-to-casting modal.
  document.getElementById('jig-btn-copy').onclick = openCopyModal;
  document.getElementById('jig-copy-close').onclick = closeCopyModal;
  document.getElementById('jig-copy-cancel').onclick = closeCopyModal;
  document.getElementById('jig-copy-confirm').onclick = confirmCopy;
  const copyModal = document.getElementById('jig-copy-modal');
  copyModal.addEventListener('click', (e) => { if (e.target === copyModal) closeCopyModal(); });
  document.getElementById('jig-copy-list').addEventListener('change', updateCopyConfirmState);
  document.getElementById('jig-copy-all').addEventListener('change', (e) => {
    document.querySelectorAll('#jig-copy-list input[type="checkbox"]')
      .forEach(cb => { cb.checked = e.target.checked; });
    updateCopyConfirmState();
  });

  // Import-from-inventory modal.
  document.getElementById('jig-imp-close').onclick = closeImportModal;
  document.getElementById('jig-imp-cancel').onclick = closeImportModal;
  document.getElementById('jig-imp-confirm').onclick = confirmImport;
  const impModal = document.getElementById('jig-imp-modal');
  impModal.addEventListener('click', (e) => {
    if (e.target === impModal) { closeImportModal(); return; }
    const btn = e.target.closest('[data-imp-mode]');
    if (btn) setImportMode(btn.closest('[data-imp-key]').dataset.impKey, btn.dataset.impMode);
  });
  impModal.addEventListener('input', onImportInput);
}
