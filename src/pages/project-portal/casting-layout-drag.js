/**
 * Casting Layout — drag interaction
 *
 * Makes the molds on a rendered casting-layout SVG draggable and rotatable.
 * The first change to an auto-packed layout "snapshots" every mold into saved
 * positions (switching that casting+area to manual mode); afterwards each
 * change moves or rotates a single mold.
 *
 *  - Drag a mold to move it.
 *  - Double-click a mold, or hover it and press R, to rotate it 90°.
 *  - While a mold is being dragged, press R to rotate it in place — the move
 *    and the rotation are validated together when you drop it.
 *
 * Bounds and overlap are only checked on drop (and for a static rotate): a
 * mold mid-drag may pass through invalid space, exactly like a plain drag. A
 * drop that lands off-table or on another mold is rejected — the mold reverts
 * to where (and how) it started and flashes red.
 *
 * @module pages/project-portal/casting-layout-drag
 */

import { rectsOverlap, isRectInsideTables } from './casting-layout.js?v=20260701-01';

/** Pixels the pointer must travel before a press counts as a drag. */
const DRAG_THRESHOLD = 3;

/**
 * Live context for the most recently rendered layout. The document-level
 * keyboard shortcut reads this so "R" always targets the current SVG.
 */
let activeContext = null;
/** The drag in progress, or null. Shared so the "R" shortcut can reach it. */
let activeDrag = null;
/** Last pointer position (viewport coords), so "R" can hit-test the form under the cursor. */
let lastPointer = { x: 0, y: 0 };
let globalListenersBound = false;

/** Briefly flash a mold group red to signal a rejected change. */
function flashInvalid(g) {
  g.classList.add('clay-mold-invalid');
  setTimeout(() => g.classList.remove('clay-mold-invalid'), 450);
}

/** Convert a pointer event's client coords into SVG user units. */
function toUserPoint(svg, evt) {
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const u = pt.matrixTransform(ctm.inverse());
  return { x: u.x, y: u.y };
}

/** Build a persistable position row from a placed-mold record. */
function toRow(ctx, r) {
  return {
    component_id: r.componentId,
    casting_id: ctx.castingId,
    area: ctx.area,
    pos_x: r.sx,
    pos_y: r.sy,
    rotation: r.rotation || 0,
  };
}

/** True if `rect` clears every other mold and sits on a table. */
function isValidPlacement(ctx, rect, movedRec) {
  if (!isRectInsideTables(rect, ctx.tableDefs)) return false;
  return !ctx.placed.some(other => other !== movedRec && rectsOverlap(rect, other));
}

/** Persist a change — the whole layout the first time, one mold thereafter. */
function commit(ctx, movedRec) {
  const rows = (ctx.mode === 'manual' ? [movedRec] : ctx.placed).map(r => toRow(ctx, r));
  if (typeof ctx.onCommit === 'function') ctx.onCommit(rows);
}

/** Rotate a placed-mold record 90° about its own centre, in inch space. */
function rotateRecInPlace(rec) {
  const cx = rec.sx + rec.sw / 2;
  const cy = rec.sy + rec.sh / 2;
  const newW = rec.sh;
  const newH = rec.sw;
  rec.sx = cx - newW / 2;
  rec.sy = cy - newH / 2;
  rec.sw = newW;
  rec.sh = newH;
  rec.rotation = rec.rotation === 90 ? 0 : 90;
}

/**
 * Rotate a mold that is NOT being dragged (hover-R or double-click): the
 * rotated footprint is bounds/overlap-checked at its current spot, then saved.
 */
function rotateStatic(ctx, rec, g) {
  const cx = rec.sx + rec.sw / 2;
  const cy = rec.sy + rec.sh / 2;
  const newRect = { sx: cx - rec.sh / 2, sy: cy - rec.sw / 2, sw: rec.sh, sh: rec.sw };
  if (!isValidPlacement(ctx, newRect, rec)) {
    flashInvalid(g);
    return;
  }
  rotateRecInPlace(rec);
  commit(ctx, rec);
}

/** Apply the in-progress drag's transform: a translate plus an optional flip. */
function applyDragTransform(d) {
  const dx = d.lastUser.x - d.startUser.x;
  const dy = d.lastUser.y - d.startUser.y;
  let t = `translate(${dx} ${dy})`;
  if (d.netRotated) t += ` rotate(90 ${d.pivot.x} ${d.pivot.y})`;
  d.g.setAttribute('transform', t);
}

/**
 * Rotate the form currently being dragged. No bounds check here — like the
 * drag itself, validity is decided when the mold is dropped.
 */
function rotateDuringDrag(d) {
  rotateRecInPlace(d.rec);
  d.netRotated = !d.netRotated;
  d.moved = true; // a rotation is a change, so the drop will commit it
  applyDragTransform(d);
}

/** Bind the document-level pointer tracking and "R to rotate" shortcut once. */
function bindGlobalListeners() {
  if (globalListenersBound) return;
  globalListenersBound = true;

  document.addEventListener('pointermove', (evt) => {
    lastPointer = { x: evt.clientX, y: evt.clientY };
  });

  document.addEventListener('keydown', (evt) => {
    if (evt.ctrlKey || evt.metaKey || evt.altKey) return;     // leave Ctrl/Cmd+R alone
    if (!evt.key || evt.key.toLowerCase() !== 'r') return;

    const t = evt.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'
        || t.tagName === 'SELECT' || t.isContentEditable)) return;

    // While a mold is being dragged, R rotates that mold in place.
    if (activeDrag) {
      evt.preventDefault();
      rotateDuringDrag(activeDrag);
      return;
    }

    // Otherwise R rotates the mold under the cursor.
    if (!activeContext) return;
    const el = document.elementFromPoint(lastPointer.x, lastPointer.y);
    const g = el && el.closest ? el.closest('g.clay-mold') : null;
    if (!g) return;
    const id = g.getAttribute('data-component-id');
    const rec = id ? activeContext.recById.get(id) : null;
    if (!rec) return;

    evt.preventDefault();
    rotateStatic(activeContext, rec, g);
  });
}

/** Wire drag + double-click-rotate handlers onto one mold group. */
function attachMoldHandlers(ctx, g, rec) {
  function onPointerDown(evt) {
    if (evt.button !== 0) return;
    const u = toUserPoint(ctx.svg, evt);
    activeDrag = {
      ctx, g, rec,
      startUser: u,
      lastUser: u,
      moved: false,
      netRotated: false,
      original: { sx: rec.sx, sy: rec.sy, sw: rec.sw, sh: rec.sh, rotation: rec.rotation },
      pivot: {
        x: ctx.offsetX + (rec.sx + rec.sw / 2) * ctx.scale,
        y: ctx.offsetY + (rec.sy + rec.sh / 2) * ctx.scale,
      },
    };
    g.classList.add('clay-mold-dragging');
    ctx.svg.appendChild(g); // raise above its neighbours while dragging
    try { g.setPointerCapture(evt.pointerId); } catch (_) { /* noop */ }
  }

  function onPointerMove(evt) {
    const d = activeDrag;
    if (!d || d.g !== g) return;
    d.lastUser = toUserPoint(ctx.svg, evt);
    if (!d.moved) {
      const dx = d.lastUser.x - d.startUser.x;
      const dy = d.lastUser.y - d.startUser.y;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      d.moved = true;
    }
    applyDragTransform(d);
  }

  function onPointerUp(evt) {
    const d = activeDrag;
    if (!d || d.g !== g) return;
    activeDrag = null;
    g.classList.remove('clay-mold-dragging');
    try { g.releasePointerCapture(evt.pointerId); } catch (_) { /* noop */ }

    if (!d.moved) { g.removeAttribute('transform'); return; }

    d.lastUser = toUserPoint(ctx.svg, evt);
    const dxIn = (d.lastUser.x - d.startUser.x) / ctx.scale;
    const dyIn = (d.lastUser.y - d.startUser.y) / ctx.scale;
    const finalRect = { sx: rec.sx + dxIn, sy: rec.sy + dyIn, sw: rec.sw, sh: rec.sh };

    if (!isValidPlacement(ctx, finalRect, rec)) {
      Object.assign(rec, d.original); // revert position AND rotation
      g.removeAttribute('transform');
      flashInvalid(g);
      return;
    }

    // Valid — leave the transform applied so the mold holds its new spot
    // until the caller re-renders.
    rec.sx = finalRect.sx;
    rec.sy = finalRect.sy;

    // A mold dragged out of the overflow strip onto a table becomes a placed
    // mold: move it into the on-table set (so it's saved, counts for future
    // overlap checks, and is snapshotted with the rest) and drop its overflow
    // styling. The molds left in the strip stay staged.
    if (rec.staged) {
      rec.staged = false;
      const i = ctx.staged.indexOf(rec);
      if (i >= 0) ctx.staged.splice(i, 1);
      ctx.placed.push(rec);
      g.classList.remove('clay-mold-overflow');
    }

    commit(ctx, rec);
  }

  function onPointerCancel(evt) {
    const d = activeDrag;
    if (!d || d.g !== g) return;
    activeDrag = null;
    g.classList.remove('clay-mold-dragging');
    try { g.releasePointerCapture(evt.pointerId); } catch (_) { /* noop */ }
    Object.assign(rec, d.original);
    g.removeAttribute('transform');
  }

  g.addEventListener('pointerdown', onPointerDown);
  g.addEventListener('pointermove', onPointerMove);
  g.addEventListener('pointerup', onPointerUp);
  g.addEventListener('pointercancel', onPointerCancel);
  g.addEventListener('dblclick', () => rotateStatic(ctx, rec, g));
}

/**
 * Attach drag + rotate behaviour to a freshly-rendered casting layout. Call
 * this once per render — the per-mold handlers live on the SVG the handle
 * points at, and the document-level "R" shortcut is bound once and retargeted.
 *
 * @param {Object} handle - the object returned by renderCastingLayout()
 * @param {Object} opts
 * @param {string} opts.castingId - the casting these molds belong to
 * @param {string} opts.area - 'A' or 'B'
 * @param {(rows:Array<Object>) => void} opts.onCommit - called after a valid
 *        change with the position rows to persist: the full snapshot while the
 *        layout is still auto-packed, or just the changed mold once manual.
 */
export function attachLayoutDrag(handle, opts) {
  if (!handle || !handle.svg || !Array.isArray(handle.placed)) return;

  const staged = Array.isArray(handle.staged) ? handle.staged : [];
  const recById = new Map();
  for (const rec of handle.placed) {
    if (rec.componentId) recById.set(rec.componentId, rec);
  }
  for (const rec of staged) {
    if (rec.componentId) recById.set(rec.componentId, rec);
  }

  const transform = handle.transform || {};
  const ctx = {
    svg: handle.svg,
    placed: handle.placed,   // on-table molds: the overlap set and the auto-mode snapshot
    staged,                  // overflow molds waiting to be dragged onto a table
    tableDefs: handle.tableDefs,
    scale: transform.scale || 1,
    offsetX: transform.offsetX || 0,
    offsetY: transform.offsetY || 0,
    mode: handle.mode,
    castingId: opts && opts.castingId,
    area: opts && opts.area,
    onCommit: opts && opts.onCommit,
    recById,
  };
  activeContext = ctx;
  activeDrag = null;
  bindGlobalListeners();

  ctx.svg.querySelectorAll('g.clay-mold').forEach((g) => {
    const id = g.getAttribute('data-component-id');
    const rec = id ? recById.get(id) : null;
    if (rec) attachMoldHandlers(ctx, g, rec);
  });
}
