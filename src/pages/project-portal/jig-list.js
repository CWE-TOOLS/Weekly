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
 *     project's legacy pre-migration blob, then to the defaults.
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
 *
 * Screen styles live in src/styles/project-portal.css scoped under
 * `.pp-tab-panel[data-panel="jig-list"]`; the print iframe carries its own
 * copy of the page CSS (PRINT_DOC_CSS below).
 *
 * @module pages/project-portal/jig-list
 */

import { loadJigListsForProject, saveJigListForCasting } from '../../services/jig-list-service.js';
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

/* ============================ state ============================ */

function todayISO(){ const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function defaultState(){
  return {
    project:'New Project', date:todayISO(),
    overhang:'4', clearance:'1', handleH:'1-1/2',
    depths:[ {d:'1/4', label:'First Scrim'}, {d:'1/2', label:'Second Scrim'} ],
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
function defaultXsec(){ return { thickness:'3/4', heights:['1/4','1/2'] }; }
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
  const panels = src.map((p,i)=>({ label:(p.label||'').trim(), W:p.W, qty:p.qty, w16:parseInches(p.W), idx:i }))
                    .filter(p => p.w16 != null && p.w16 > 0);
  // duplicate-width detection
  const byW = {};
  panels.forEach(p => { (byW[p.w16] = byW[p.w16] || []).push(p.label || '?'); });
  const jigs = []; let n = 0;
  panels.forEach((p, pi) => {
    const others = [...new Set(byW[p.w16])].filter(l => l !== (p.label || '?'));
    const note = others.length ? 'same as ' + others.join(', ') : '';
    const foot = p.w16 - clr, handle = p.w16 + over;
    S.depths.forEach(dp => {
      n++;
      const d16 = parseInches(dp.d) || 0;
      jigs.push({
        n, pi, label: p.label || ('Panel ' + (pi+1)), qty: p.qty,
        W: fmt16(p.w16), foot: fmt16(foot), handle: fmt16(handle),
        depth: fmt16(d16), depth16: d16, depthLabel: (dp.label||'').trim(), note
      });
    });
  });
  return { jigs, over, clr };
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
       <td class="b">${esc(j.label)}${j.depthLabel ? ' · ' + esc(j.depthLabel) : ''}</td>
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
  return ` &nbsp;·&nbsp; <b>Conc</b> ${fmt16(T)}″${h16 != null ? ` · <b>Scrim</b> ${fmt16(h16)}″ up from face` : ''}`;
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
  // validate the active group still exists
  const groups = activeGroups();
  if (currentGroup && !groups.includes(currentGroup)) currentGroup = null;
  buildPrintSetBar(groups);

  const { jigs, over, clr } = buildJigs();
  const out = document.getElementById('jig-output');
  if (!out) return;

  if (!jigs.length){
    out.innerHTML = `<div class="emptyhint">Add at least one panel with a valid width to generate jigs.</div>`;
    return;
  }

  const widths = new Set(jigs.map(j => j.W)).size;
  const summaryBase = currentGroup ? `${esc(currentGroup)} · ${widths} widths · ${jigs.length} jigs`
                                   : `${widths} widths · ${jigs.length} jigs`;
  const legend = `<p class="listnote">
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
function printViaIframe(title, bodyHTML){
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>`
    + `<style>${PRINT_DOC_CSS}</style></head><body>${MARKER_DEFS}${bodyHTML}</body></html>`;

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

  // depths
  document.getElementById('jig-depth-wrap').innerHTML = `<table class="edit"><thead><tr>
      <th class="row-n">#</th><th style="width:30%">Depth</th><th>Label</th><th class="del"></th></tr></thead><tbody>`
    + S.depths.map((d,i)=>`<tr>
        <td class="row-n">${i+1}</td>
        <td><input data-sec="depth" data-idx="${i}" data-field="d" value="${esc(d.d)}" placeholder="1/4"></td>
        <td><input data-sec="depth" data-idx="${i}" data-field="label" value="${esc(d.label)}" placeholder="First Scrim"></td>
        <td class="del"><button type="button" data-act="del-depth" data-idx="${i}" title="Remove">×</button></td>
      </tr>`).join('') + `</tbody></table>`;

  // panels
  document.getElementById('jig-panel-wrap').innerHTML = `<table class="edit"><thead><tr>
      <th class="row-n">#</th><th style="width:30%">Label / type</th><th style="width:20%">Width</th>
      <th style="width:14%">Qty</th><th style="width:22%">Group <span style="font-weight:400;color:#999">(optional)</span></th><th class="del"></th></tr></thead><tbody>`
    + S.panels.map((p,i)=>`<tr>
        <td class="row-n">${i+1}</td>
        <td><input data-sec="panel" data-idx="${i}" data-field="label" value="${esc(p.label)}" placeholder="e.g. A·1"></td>
        <td><input data-sec="panel" data-idx="${i}" data-field="W" value="${esc(p.W)}" placeholder="44-1/8"></td>
        <td><input data-sec="panel" data-idx="${i}" data-field="qty" value="${esc(p.qty)}" placeholder="0"></td>
        <td><input data-sec="panel" data-idx="${i}" data-field="group" value="${esc(p.group)}" placeholder="Casting 1"></td>
        <td class="del"><button type="button" data-act="del-panel" data-idx="${i}" title="Remove">×</button></td>
      </tr>`).join('') + `</tbody></table>`;

  refreshWarnings();
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
    if (el.dataset.field === 'thickness'){ S.xsec.thickness = el.value; }
    else if (el.dataset.field === 'count'){
      const n = Math.max(0, Math.min(10, parseInt(el.value, 10) || 0));
      while (S.xsec.heights.length < n) S.xsec.heights.push('');
      if (S.xsec.heights.length > n) S.xsec.heights.length = n;
      buildXsecHeights();
    }
    else if (el.dataset.field === 'h'){ S.xsec.heights[+el.dataset.idx] = el.value; }
    scheduleSave(); renderXsec();
    if (el.dataset.field === 'thickness') liveUpdate();   // jig cards show the concrete depth
    return;
  }
  if (sec === 'settings'){ S[el.dataset.field] = el.value; }
  else if (sec === 'depth'){ S.depths[+el.dataset.idx][el.dataset.field] = el.value; }
  else if (sec === 'panel'){ S.panels[+el.dataset.idx][el.dataset.field] = el.value;
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
  else if (act === 'del-depth'){ S.depths.splice(idx,1); if(!S.depths.length) S.depths.push({d:'1/4',label:'First Scrim'}); }
  else if (act === 'print-xsec'){ printXsec(); return; }
  else if (act === 'example'){ if(confirm('Replace the current project with the example?')){ S = exampleState(); afterLoad(); } return; }
  else if (act === 'clear'){ if(confirm('Clear all panels, depths and settings?')){ S = freshState(); afterLoad(); } return; }
  else return;
  scheduleSave(); buildEditor(); renderOutput();
}

function afterLoad(){
  fixXsec(); currentGroup = null;
  // The printed title always mirrors the portal project record (Info tab).
  if (currentProjectName) S.project = currentProjectName;
  // example/clear replaced the state object — keep the per-casting map in sync.
  if (currentCastingId) stateByCasting.set(currentCastingId, S);
  // Immediate save (not debounced) — example/clear should persist now.
  if (currentProjectNumber && currentCastingId) doSave(currentProjectNumber, currentCastingId, S);
  buildEditor(); renderOutput();
}

/* ===================== example project ==================== */
function exampleState(){
  return {
    project:'Example — 2 castings', date: todayISO(),
    overhang:'4', clearance:'1', handleH:'1-1/2',
    depths:[ {d:'1/4', label:'First Scrim'}, {d:'1/2', label:'Second Scrim'} ],
    panels:[
      {label:'A·1', W:'38',     qty:'2', group:'Casting 1'},
      {label:'A·2', W:'42-3/16',qty:'2', group:'Casting 1'},
      {label:'B·1', W:'46-7/8', qty:'4', group:'Casting 1'},
      {label:'B·2', W:'38',     qty:'2', group:'Casting 1'},
      {label:'C·1', W:'44-1/8', qty:'7', group:'Casting 2'},
      {label:'C·2', W:'35-1/8', qty:'3', group:'Casting 2'},
      {label:'C·3', W:'32-3/8', qty:'2', group:'Casting 2'}
    ],
    xsec:{ thickness:'3/4', heights:['1/4','1/2'] }
  };
}

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
    <button type="button" id="jig-btn-print-jigs">Print Jigs</button>
    <button type="button" id="jig-btn-print-xsec">Print Cross-Section</button>
  </span>
</div>
<div class="vbar" id="jig-vbar" style="display:none"></div>

<div class="doc" id="jig-doc">

  <!-- ====================== EDITOR (screen only) ====================== -->
  <section class="editor" id="jig-editor">

    <h2>Panel cross-section <span style="font-weight:400;text-transform:none;color:#888;font-size:12px">— scrim placement diagram</span></h2>
    <p class="hint">Enter the total concrete thickness, the number of scrims, and each scrim’s height measured from the <b>bottom (face) of the panel</b>. Dimensions accept <b>3/4</b>, <b>1-1/2</b> or <b>0.75</b>.</p>
    <div class="fields" id="jig-xsec-fields"></div>
    <div class="fields" id="jig-xsec-heights" style="margin-top:10px"></div>
    <div class="xsec-wrap" id="jig-xsec-preview"></div>
    <div class="warn" id="jig-xsec-warn"></div>
    <div class="toolrow"><button type="button" data-act="print-xsec">🖨 Print cross-section</button></div>

    <h2 style="margin-top:22px">Project</h2>
    <div class="fields" id="jig-proj-fields"></div>

    <h2 style="margin-top:20px">Geometry &amp; depths</h2>
    <p class="hint">Each jig is one plywood T. <b>Handle</b> = panel width + overhang (rides on the form walls). <b>Foot</b> = panel width − clearance (drops into the cavity); its <b>depth</b> = how deep the scrim is pressed. One jig is made per panel width × per depth below.</p>
    <div class="fields" id="jig-geo-fields"></div>

    <h2 style="margin-top:20px">Foot depths <span style="font-weight:400;text-transform:none;color:#888;font-size:12px">— one jig per depth, per width</span></h2>
    <div id="jig-depth-wrap"></div>
    <button type="button" class="addbtn" data-act="add-depth">+ Add depth</button>

    <h2 style="margin-top:22px">Panels</h2>
    <p class="hint">Enter each panel’s width and quantity. Widths accept <b>44</b>, <b>44-1/8</b>, <b>44 1/8</b> or <b>44.125</b>. <b>Group</b> is optional — fill it to get per-group print buttons (like castings); leave blank for one flat list.</p>
    <div id="jig-panel-wrap"></div>
    <button type="button" class="addbtn" data-act="add-panel">+ Add panel</button>
    <div class="warn" id="jig-panel-warn"></div>

    <h2 style="margin-top:22px">Project file</h2>
    <div class="toolrow">
      <button type="button" data-act="example">Load example</button>
      <button type="button" class="danger" data-act="clear">Clear all</button>
    </div>
    <p class="hint" style="margin-top:8px">Work auto-saves to the selected casting.</p>
  </section>

  <!-- ====================== GENERATED OUTPUT ====================== -->
  <div id="jig-output"></div>

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
}
