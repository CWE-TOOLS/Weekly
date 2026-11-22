/**
 * Casting Layout
 *
 * Auto-arranges a casting's panels onto the fixed shop-floor casting tables and
 * draws the result as an SVG diagram. Ported from the standalone
 * `table-layout.html` tool and adapted to read live portal data.
 *
 * Panel `width`/`length` in the portal are the *concrete* dimensions, stored as
 * free text (e.g. `3 5/16"`). The mold base is larger than the concrete, so a
 * per-side offset is added to every panel to get the mold's outer footprint —
 * that footprint is what actually consumes table space.
 *
 * @module pages/project-portal/casting-layout
 */

// ============================================================================
// CASTING TABLES (fixed shop-floor layout, units: inches)
// ============================================================================

/** Casting Area B — the seven physical casting tables. */
const AREA_B_TABLES = [
  { id: 5, name: 'Table 5', narrow: 60, long: 402, x: 10,  y: 0,   packAxis: 'x' },
  { id: 1, name: 'Table 1', narrow: 61, long: 194, x: 0,   y: 90,  packAxis: 'y' },
  { id: 2, name: 'Table 2', narrow: 60, long: 192, x: 91,  y: 90,  packAxis: 'y' },
  { id: 3, name: 'Table 3', narrow: 60, long: 192, x: 181, y: 90,  packAxis: 'y' },
  { id: 4, name: 'Table 4', narrow: 60, long: 192, x: 271, y: 90,  packAxis: 'y' },
  { id: 6, name: 'Table 6', narrow: 60, long: 132, x: 80,  y: 312, packAxis: 'x' },
  { id: 7, name: 'Table 7', narrow: 60, long: 132, x: 222, y: 312, packAxis: 'x' },
];

/**
 * Casting Area A — three casting tables, all oriented long-side vertical.
 *
 * Right side: one large 60" × 1170" table.
 * Left side: an L-shape modeled as two stacked tables with their left edges
 * aligned — a 72" × 351" upper section and a 60" × 255" lower section (the
 * right edge steps in by 12" at the 351" mark). The two left tables are
 * bottom-aligned with the right table, so the left stack starts 564" down.
 *
 * Source: "Casting Layout 2026-04-13-CAST #1.pdf" (SIDE A).
 */
// 2026-11-06 (user): Table 2 removed from the floor; Table 3 cut down to 8 ft (96"), still bottom-aligned with Table 1.
const AREA_A_TABLES = [
  { id: 1, name: 'Table 1', narrow: 60, long: 1170, x: 144, y: 0,    packAxis: 'y' }, // right side
  { id: 3, name: 'Table 3', narrow: 60, long: 96,   x: 0,   y: 1074, packAxis: 'y' }, // left, bottom-aligned
];

/** Selectable casting areas, keyed by the value used in the area <select>. */
export const CASTING_AREAS = {
  A: { label: 'Casting Area A', tables: AREA_A_TABLES },
  B: { label: 'Casting Area B', tables: AREA_B_TABLES },
};

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Format a decimal-inch value as a shop-friendly fraction string (16ths).
 * @param {number} val
 * @returns {string} e.g. `3-5/16"`
 */
function frac(val) {
  const neg = val < 0;
  val = Math.abs(val);
  const sixteenths = Math.round(val * 16);
  const whole = Math.floor(sixteenths / 16);
  let rem = sixteenths % 16;
  if (rem === 0) return (neg ? '-' : '') + whole + '"';
  let num = rem, den = 16;
  while (num % 2 === 0) { num /= 2; den /= 2; }
  if (whole === 0) return (neg ? '-' : '') + num + '/' + den + '"';
  return (neg ? '-' : '') + whole + '-' + num + '/' + den + '"';
}

/**
 * Parse a free-text dimension into decimal inches. Handles whole numbers,
 * decimals, fractions, and mixed numbers — with or without an inch mark.
 * Examples: `60`, `60.5`, `60 1/2`, `60-1/2`, `5"`, `3 5/16"`, `1/2`.
 * @param {string|number|null|undefined} raw
 * @returns {number|null} decimal inches, or null if it can't be parsed
 */
export function parseDimension(raw) {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (!s) return null;
  // Strip inch/foot marks and unicode prime characters.
  s = s.replace(/["'′″]/g, '').trim();
  if (!s) return null;

  // Mixed number or bare fraction: optional whole part, then num/den.
  const m = s.match(/^(\d+(?:\.\d+)?)?\s*[-\s]?\s*(\d+)\s*\/\s*(\d+)$/);
  if (m) {
    const whole = m[1] ? parseFloat(m[1]) : 0;
    const num = parseInt(m[2], 10);
    const den = parseInt(m[3], 10);
    if (!den) return null;
    return whole + num / den;
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function getTableScreenRect(t) {
  if (t.packAxis === 'x') return { x: t.x, y: t.y, w: t.long, h: t.narrow };
  return { x: t.x, y: t.y, w: t.narrow, h: t.long };
}

/** Whole tables of one side as blocked rectangles (table inches): the tables a special condition uses (2026-11-12). */
export function tableBlockRects(area, tableIds) {
  const want = new Set((tableIds || []).map(Number));
  return ((CASTING_AREAS[area] || CASTING_AREAS.B).tables).filter(t => want.has(Number(t.id))).map(t => {
    const r = getTableScreenRect(t);
    return { sx: r.x, sy: r.y, sw: r.w, sh: r.h, tableId: t.id, tableName: t.name };
  });
}

function svgRect(ns, x, y, w, h, fill, stroke, strokeW) {
  const r = document.createElementNS(ns, 'rect');
  r.setAttribute('x', x); r.setAttribute('y', y);
  r.setAttribute('width', w); r.setAttribute('height', h);
  r.setAttribute('fill', fill); r.setAttribute('stroke', stroke);
  r.setAttribute('stroke-width', strokeW);
  return r;
}

function svgText(ns, x, y, content, fontSize, fill, weight) {
  const t = document.createElementNS(ns, 'text');
  t.setAttribute('x', x); t.setAttribute('y', y);
  t.setAttribute('text-anchor', 'middle');
  t.setAttribute('dominant-baseline', 'middle');
  t.setAttribute('font-size', fontSize);
  t.setAttribute('fill', fill);
  t.setAttribute('font-weight', weight);
  t.setAttribute('font-family', 'sans-serif');
  t.textContent = content;
  return t;
}

// ============================================================================
// PLACEMENT LOGIC
// ============================================================================

/**
 * Pack molds onto the casting tables using shelf (row) packing.
 *
 * Each table is filled with straight rows that run across the table's narrow
 * axis. Molds are laid side-by-side within a row; when a row has no more room
 * across, a new row is opened further along the table's long axis — so a table
 * fills in *both* directions instead of as a single end-to-end strip.
 *
 * Molds are sorted longest-side-first so the deepest rows are created first,
 * letting shorter molds tuck into the rows behind them. Both 90° orientations
 * of every mold are tried, so molds rotate whenever that yields a fit.
 *
 * @param {Array<{outerW:number, outerL:number}>} molds
 * @param {Array<Object>} tableDefs
 * @param {number} [gapBetween] - inches of clearance left between adjacent molds and rows
 * @param {boolean} [bottomJustify] - shift each table's molds along its long axis so the
 *        last packed row sits flush with the table's far end (used for Casting Area A so
 *        the right-side Table 1 visually bottom-aligns with the L-shape on the left).
 * @returns {{tables:Array<Object>, unplaced:Array<Object>}}
 */
function placeMoldsOnTables(molds, tableDefs, gapBetween = 0, bottomJustify = false, blocked = []) {
  const tables = tableDefs.map(t => {
    // Another casting's forms on this side (same cast day) block part of the table: pack into the largest
    // free stretch of its long axis (2026-11-06).
    const win = freeWindow(t, blocked, gapBetween);
    return {
      ...t,
      longUsed: win.start,   // long-axis inches consumed by rows so far (starts past the blocked stretch)
      longEnd: win.end,      // where this casting's rows must stop
      afterBlocked: win.start > 0,
      shelves: [],           // rows packed onto this table
      placedMolds: [],       // {mold, sx, sy, sw, sh} screen rectangles for rendering
    };
  });
  const unplaced = [];

  // Longest-side-first: the molds that need the deepest rows go down first.
  const sorted = [...molds].sort((a, b) =>
    Math.max(b.outerW, b.outerL) - Math.max(a.outerW, a.outerL));

  for (const mold of sorted) {
    if (!placeOneMold(mold, tables, gapBetween)) unplaced.push(mold);
  }

  // Centre each finished row across the table's narrow axis so a partly-filled
  // row sits balanced rather than jammed against one edge.
  for (const table of tables) {
    for (const shelf of table.shelves) {
      const shift = (table.narrow - shelf.narrowUsed) / 2;
      if (shift <= 0) continue;
      for (const rec of shelf.recs) {
        if (table.packAxis === 'x') rec.sy += shift;
        else rec.sx += shift;
      }
    }
  }

  // Bottom-justify (long-axis) — push every mold on a partly-filled table down
  // its long axis so the trailing edge of the last row meets the table's end.
  // Used only for areas where bottom-alignment is the desired reading (Area A).
  if (bottomJustify) {
    for (const table of tables) {
      const slack = table.longEnd - table.longUsed;
      if (slack <= 0) continue;
      for (const rec of table.placedMolds) {
        if (table.packAxis === 'x') rec.sx += slack;
        else rec.sy += slack;
      }
    }
  }

  return { tables, unplaced };
}

/**
 * Place a single mold: first into any existing row that still has room,
 * otherwise into a new row on the first table that can fit one.
 * @returns {boolean} true if the mold was placed
 */
function placeOneMold(mold, tables, gap) {
  // Both 90° orientations — `across` spans the narrow axis, `depth` the long axis.
  const orientations = [
    { across: mold.outerW, depth: mold.outerL },
    { across: mold.outerL, depth: mold.outerW },
  ];

  // 1) Try to slot the mold into an existing row.
  for (const table of tables) {
    for (const shelf of table.shelves) {
      for (const { across, depth } of orientations) {
        if (depth > shelf.depth) continue;          // a row's depth is fixed
        if (across > table.narrow) continue;
        const g = shelf.recs.length > 0 ? gap : 0;
        if (shelf.narrowUsed + g + across > table.narrow) continue;
        addMoldToShelf(table, shelf, mold, across, depth, g);
        return true;
      }
    }
  }

  // 2) No existing row fits — open a new one. Prefer the orientation with the
  //    smaller `across` span, which leaves more room for molds beside it.
  const byAcross = [...orientations].sort((a, b) => a.across - b.across);
  for (const table of tables) {
    const g = (table.shelves.length > 0 || table.afterBlocked) ? gap : 0;
    const rowStart = table.longUsed + g;
    for (const { across, depth } of byAcross) {
      if (across > table.narrow) continue;
      if (rowStart + depth > table.longEnd) continue;
      const shelf = { longStart: rowStart, depth, narrowUsed: 0, recs: [] };
      table.shelves.push(shelf);
      table.longUsed = rowStart + depth;
      addMoldToShelf(table, shelf, mold, across, depth, 0);
      return true;
    }
  }

  return false;
}

/**
 * The largest stretch of a table's long axis not covered by another casting's forms (blocked rects in table
 * inches, same space as the placed molds), with the gap kept clear on both sides of them (2026-11-06).
 * @returns {{start:number, end:number}} inches along the long axis, from the table's start
 */
function freeWindow(t, blocked, gap) {
  const r = getTableScreenRect(t);
  const tableRect = { sx: r.x, sy: r.y, sw: r.w, sh: r.h };
  const spans = [];
  for (const b of blocked || []) {
    if (!rectsOverlap(b, tableRect)) continue;
    const lo = t.packAxis === 'x' ? b.sx - r.x : b.sy - r.y;
    const hi = lo + (t.packAxis === 'x' ? b.sw : b.sh);
    spans.push([Math.max(0, lo - gap), Math.min(t.long, hi + gap)]);
  }
  if (!spans.length) return { start: 0, end: t.long };
  spans.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const sp of spans) {
    const m = merged[merged.length - 1];
    if (m && sp[0] <= m[1]) m[1] = Math.max(m[1], sp[1]);
    else merged.push([sp[0], sp[1]]);
  }
  let best = { start: 0, end: 0 }, cur = 0;
  for (const [lo, hi] of merged) {
    if (lo - cur > best.end - best.start) best = { start: cur, end: lo };
    cur = Math.max(cur, hi);
  }
  if (t.long - cur > best.end - best.start) best = { start: cur, end: t.long };
  return best;
}

/**
 * Append a mold to a row: compute its screen rectangle, store it for rendering,
 * and advance the row's narrow-axis cursor.
 */
function addMoldToShelf(table, shelf, mold, across, depth, gap) {
  const narrowPos = shelf.narrowUsed + gap;
  const longPos = shelf.longStart;
  let sx, sy, sw, sh;
  if (table.packAxis === 'x') {
    // long axis → screen x, narrow axis → screen y
    sx = table.x + longPos;
    sy = table.y + narrowPos;
    sw = depth;
    sh = across;
  } else {
    // long axis → screen y, narrow axis → screen x
    sx = table.x + narrowPos;
    sy = table.y + longPos;
    sw = across;
    sh = depth;
  }
  const rec = { mold, sx, sy, sw, sh };
  table.placedMolds.push(rec);
  shelf.recs.push(rec);
  shelf.narrowUsed = narrowPos + across;
}

// ============================================================================
// MOLD BUILDING
// ============================================================================

const MOLD_COLORS = ['#93c5fd', '#86efac', '#fcd34d', '#fca5a5', '#c4b5fd', '#fdba74', '#67e8f9', '#f9a8d4', '#a3e635'];

/**
 * Convert portal casting components into molds with outer (mold base) sizes.
 * @param {Array<Object>} components - casting_components rows
 * @param {number} offsetPerSide - inches the mold base extends past concrete, per edge
 * @returns {{molds:Array<Object>, skipped:Array<Object>}}
 */
/**
 * @param {Object<string,{w:number,l:number}>} [bases] - real mold BASE sizes by type (inches), set by the user when the
 *        base is not inventory size + offset (2026-11-06); a type with an entry uses it as its outer size, offset ignored
 */
function buildMolds(components, offsetPerSide, bases = null) {
  const molds = [];
  const skipped = [];
  const colorByType = new Map();

  (components || []).forEach((c, i) => {
    const w = parseDimension(c.width);
    const l = parseDimension(c.length);
    if (w === null || l === null || w <= 0 || l <= 0) {
      skipped.push(c);
      return;
    }
    const typeKey = (c.type || c.panel_id || `#${i + 1}`).trim();
    if (!colorByType.has(typeKey)) {
      colorByType.set(typeKey, MOLD_COLORS[colorByType.size % MOLD_COLORS.length]);
    }
    const base = bases && bases[(c.type || '').trim() || typeKey];
    const baseSet = !!(base && base.w > 0 && base.l > 0);
    molds.push({
      componentId: c.id || null,
      type: (c.type || '').trim(),
      label: (c.panel_id || c.type || `Panel ${i + 1}`).trim(),
      color: colorByType.get(typeKey),
      concreteW: w,
      concreteL: l,
      outerW: baseSet ? base.w : w + offsetPerSide * 2,
      outerL: baseSet ? base.l : l + offsetPerSide * 2,
      baseSet
    });
  });

  return { molds, skipped };
}

// ============================================================================
// LAYOUT GEOMETRY HELPERS
// ============================================================================

/**
 * Footprint a mold occupies on the diagram for a given rotation, in inches.
 * Rotation 0 keeps the mold's natural orientation (outerW along x); rotation
 * 90 swaps the axes.
 * @param {{outerW:number, outerL:number}} mold
 * @param {number} rotation - 0 or 90
 * @returns {{sw:number, sh:number}}
 */
export function moldScreenSize(mold, rotation) {
  return Number(rotation) === 90
    ? { sw: mold.outerL, sh: mold.outerW }
    : { sw: mold.outerW, sh: mold.outerL };
}

/**
 * True if two inch-space rectangles overlap. Rectangles that merely share an
 * edge do not count as overlapping.
 * @param {{sx:number,sy:number,sw:number,sh:number}} a
 * @param {{sx:number,sy:number,sw:number,sh:number}} b
 * @returns {boolean}
 */
export function rectsOverlap(a, b) {
  return a.sx < b.sx + b.sw && a.sx + a.sw > b.sx
      && a.sy < b.sy + b.sh && a.sy + a.sh > b.sy;
}

/**
 * True if an inch-space rectangle sits entirely within a single casting table.
 * @param {{sx:number,sy:number,sw:number,sh:number}} rect
 * @param {Array<Object>} tableDefs
 * @returns {boolean}
 */
/** True if `rect` overlaps any table at all (an oversize form hangs past an edge but still sits on a table; 2026-11-06). */
export function rectTouchesTables(rect, tableDefs) {
  for (const t of tableDefs) {
    const r = getTableScreenRect(t);
    if (rectsOverlap(rect, { sx: r.x, sy: r.y, sw: r.w, sh: r.h })) return true;
  }
  return false;
}

export function isRectInsideTables(rect, tableDefs) {
  const EPS = 0.01;
  for (const t of tableDefs) {
    const r = getTableScreenRect(t);
    if (rect.sx >= r.x - EPS && rect.sy >= r.y - EPS
        && rect.sx + rect.sw <= r.x + r.w + EPS
        && rect.sy + rect.sh <= r.y + r.h + EPS) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// LAYOUT MODES
// ============================================================================

/**
 * Auto layout — run the shelf packer and flatten the result into one flat list
 * of placed molds (inch-space rects + the rotation each ended up at).
 */
function layoutAuto(molds, tableDefs, gapBetween, bottomJustify = false, blocked = []) {
  const { tables, unplaced } = placeMoldsOnTables(molds, tableDefs, gapBetween, bottomJustify, blocked);
  const placed = [];
  for (const t of tables) {
    for (const rec of t.placedMolds) {
      const rotation =
        Math.abs(rec.sw - rec.mold.outerW) <= Math.abs(rec.sw - rec.mold.outerL) ? 0 : 90;
      placed.push({
        componentId: rec.mold.componentId,
        mold: rec.mold,
        sx: rec.sx, sy: rec.sy, sw: rec.sw, sh: rec.sh,
        rotation,
      });
    }
  }
  // Molds the packer couldn't fit become "staged" records — no on-table
  // position yet; the render lays them into the overflow strip and they can be
  // dragged straight onto a table.
  const staged = unplaced.map(mold => makeStagedRec(mold));
  return { placed, staged };
}

/**
 * Manual layout — place each mold at its saved position. A mold with no saved
 * position (a component added after the layout was customized, or one that was
 * left in overflow) is staged into the overflow strip so it stays visible and
 * can be dragged onto a table.
 */
function layoutManual(molds, posForArea, tableDefs) {
  const byComponent = new Map();
  for (const p of posForArea) byComponent.set(p.component_id, p);

  const placed = [];
  const staged = [];

  for (const mold of molds) {
    const pos = byComponent.get(mold.componentId);
    if (pos) {
      const rotation = Number(pos.rotation) === 90 ? 90 : 0;
      const { sw, sh } = moldScreenSize(mold, rotation);
      placed.push({
        componentId: mold.componentId,
        mold,
        sx: Number(pos.pos_x) || 0,
        sy: Number(pos.pos_y) || 0,
        sw, sh, rotation,
      });
    } else {
      staged.push(makeStagedRec(mold));
    }
  }
  return { placed, staged };
}

/** A mold that isn't on a table yet. Position is filled in by layoutStaging(). */
function makeStagedRec(mold) {
  return {
    componentId: mold.componentId,
    mold,
    sx: 0, sy: 0, sw: mold.outerW, sh: mold.outerL,
    rotation: 0,
    staged: true,
  };
}

/**
 * Lay staged molds into an inch-space strip below the tables. Molds flow
 * left-to-right and wrap to a new row when they run past `maxWidth`, so they
 * share the tables' coordinate space (and thus the drag math) at 1:1 scale.
 * @returns {number} the largest y reached, so the caller can size the diagram.
 */
function layoutStaging(staged, maxWidth, startY, gapBetween = 0) {
  const pad = Math.max(gapBetween, 6);
  let x = 0, y = startY, rowH = 0;
  for (const rec of staged) {
    const w = rec.mold.outerW;
    const h = rec.mold.outerL;
    if (x > 0 && x + w > maxWidth) { // wrap to the next row
      x = 0;
      y += rowH + pad;
      rowH = 0;
    }
    rec.sx = x;
    rec.sy = y;
    rec.sw = w;
    rec.sh = h;
    rec.rotation = 0;
    x += w + pad;
    rowH = Math.max(rowH, h);
  }
  return y + rowH;
}

// ============================================================================
// RENDERING
// ============================================================================

/**
 * Build the SVG group for one mold. The group carries `data-component-id` so
 * the drag layer can identify which component it represents.
 *
 * Draws two nested rectangles: the outer one is the mold form footprint
 * (concrete + offsetPerSide on each edge), the inner dashed one is the
 * concrete panel itself. The dimension label shows the concrete dims —
 * the mold offset is constant and reported once in the summary text.
 */
// ---- Labels that fit (2026-10-23) ----
// A label is drawn horizontally when it fits, turned along the mold's long side when that is the only way,
// shrunk down to LABEL_MIN_FONT when it still does not fit, and replaced by a small index number (with a
// legend under the tables) when even that is too big. Narrow Fairfield-style pieces used to overprint each other.
const LABEL_MIN_FONT = 5.5;
const LABEL_CHAR_W = 0.62;   // average glyph width as a fraction of the font size (bold sans)
const LABEL_PAD = 2;

/** Decide how the label of a placed mold is drawn: { mode: 'h' | 'v' | 'n', font } */
function labelModeFor(rec, ts, fontSize) {
  const mw = ts(rec.sw), mh = ts(rec.sh);
  const chars = Math.max(1, String(rec.mold.label || '').length);
  const need = (f) => chars * f * 0.85 * LABEL_CHAR_W;     // width of the label line at font f
  const lines = (f) => f * 1.15;                            // one line: the label only (dims were dropped 2026-10-23)
  if (need(fontSize) <= mw - LABEL_PAD && lines(fontSize) <= mh) return { mode: 'h', font: fontSize };
  if (need(fontSize) <= mh - LABEL_PAD && lines(fontSize) <= mw) return { mode: 'v', font: fontSize };
  const horizontal = mw >= mh;
  const along = horizontal ? mw : mh, across = horizontal ? mh : mw;
  const f = Math.min(fontSize, (along - LABEL_PAD) / (chars * 0.85 * LABEL_CHAR_W), across / 1.15);
  if (f >= LABEL_MIN_FONT) return { mode: horizontal ? 'h' : 'v', font: f };
  return { mode: 'n', font: Math.max(4, Math.min(fontSize, across * 0.8, (along - LABEL_PAD) / 0.7)) };
}

function buildMoldGroup(NS, rec, tx, ty, ts, fontSize, offsetPerSide) {
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', rec.staged ? 'clay-mold clay-mold-overflow' : 'clay-mold');
  if (rec.componentId) g.setAttribute('data-component-id', rec.componentId);
  const mx = tx(rec.sx), my = ty(rec.sy), mw = ts(rec.sw), mh = ts(rec.sh);
  g.appendChild(svgRect(NS, mx, my, mw, mh, rec.mold.color, '#333', 0.4));

  // Inner rectangle = the concrete panel, inset by the mold offset on every side.
  // Only drawn when the inset leaves a visible rectangle.
  const inset = ts(offsetPerSide);
  if (inset > 0 && mw > inset * 2 && mh > inset * 2) {
    const innerRect = svgRect(NS, mx + inset, my + inset, mw - inset * 2, mh - inset * 2, 'none', '#333', 0.3);
    innerRect.setAttribute('stroke-dasharray', '2 2');
    g.appendChild(innerRect);
  }

  const lm = rec.labelMode || labelModeFor(rec, ts, fontSize);
  const cx = mx + mw / 2, cy = my + mh / 2;
  const dims = `${frac(rec.mold.concreteW)} x ${frac(rec.mold.concreteL)}`;
  if (lm.mode === 'n') {
    // too small for text: the label sits in the margin on the end of a thin leader line (drawn by the caller)
    const title = document.createElementNS(NS, 'title');
    title.textContent = `${rec.mold.label} — ${dims}`;
    g.appendChild(title);
    return g;
  }
  const f = lm.font;
  // Label only — the size is on the inventory and in the legend; it only cluttered the molds (user, 2026-10-23).
  const t1 = svgText(NS, cx, cy, rec.mold.label, f * 0.85, '#222', 'bold');
  if (lm.mode === 'v') t1.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
  const title = document.createElementNS(NS, 'title');
  title.textContent = `${rec.mold.label} — ${dims}`;
  g.appendChild(title);
  g.appendChild(t1);
  return g;
}


/**
 * Render a casting layout diagram into a container.
 * @param {Object} opts
 * @param {HTMLElement} opts.container - element the SVG is drawn into (cleared first)
 * @param {HTMLElement} [opts.errorEl] - element for status/warning text
 * @param {Array<Object>} opts.components - casting_components rows for one casting
 * @param {string} [opts.title] - heading drawn on the diagram
 * @param {string} [opts.area] - 'A' or 'B'
 * @param {number} [opts.offsetPerSide] - mold-base offset per edge, in inches
 * @param {number} [opts.gapBetween] - clearance between adjacent molds, in inches
 * @param {Array<Object>} [opts.positions] - saved manual positions; when any
 *        exist for `area` the layout is rendered manually instead of auto-packed
 * @returns {Object|null} layout handle {mode, area, svg, transform, tableDefs,
 *        placed, unplaced}, or null when there is nothing to draw
 */
/**
 * Where a casting's forms land on one side, without drawing — used for the OTHER castings of the same cast day,
 * whose forms block the tables for this one (2026-11-06). Saved positions win; otherwise the auto-pack.
 * @returns {{placed:Array<Object>, staged:Array<Object>}} rects in table inches
 */
export function computeLayoutRects({ components, area = 'B', offsetPerSide = 4, gapBetween = 0, positions = null, blocked = [], bases = null }) {
  const tableDefs = (CASTING_AREAS[area] || CASTING_AREAS.B).tables;
  const { molds } = buildMolds(components, offsetPerSide, bases);
  if (!molds.length) return { placed: [], staged: [] };
  const posForArea = (positions || []).filter(p => (p.area === 'A' ? 'A' : 'B') === area);
  return posForArea.length > 0
    ? layoutManual(molds, posForArea, tableDefs)
    : layoutAuto(molds, tableDefs, gapBetween, area === 'A', blocked);
}

/** A blocked rectangle's label as stacked lines on a pale plate, turned along the long side when that is the only
 *  way it fits, shrunk until it does (a whole table taken by a special condition; 2026-11-12). */
function drawBlockLines(NS, g, b, tx, ty, ts, fontSize, colors) {
  const lines = (b.lines || []).map(String).filter(Boolean);
  if (!lines.length) return;
  const w = ts(b.sw), h = ts(b.sh), cx = tx(b.sx + b.sw / 2), cy = ty(b.sy + b.sh / 2);
  const longest = Math.max(1, ...lines.map(l => l.length));
  for (let f = fontSize; f >= 4; f -= 0.5) {
    const needW = longest * f * LABEL_CHAR_W + 6, needH = lines.length * f * 1.25 + 4;
    const horiz = needW <= w && needH <= h, vert = !horiz && needW <= h && needH <= w;
    if (!horiz && !vert) continue;
    const plate = svgRect(NS, cx - (horiz ? needW : needH) / 2, cy - (horiz ? needH : needW) / 2, horiz ? needW : needH, horiz ? needH : needW, '#fff', 'none', 0);
    plate.setAttribute('opacity', 0.88); plate.setAttribute('rx', 1.5);
    g.appendChild(plate);
    lines.forEach((l, i) => {
      const off = (i - (lines.length - 1) / 2) * f * 1.25;
      const t = svgText(NS, cx, cy + off, l, f, colors[Math.min(i, colors.length - 1)], 'bold');
      if (vert) t.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
      g.appendChild(t);
    });
    return;
  }
}

/**
 * @param {Array<Object>} [opts.blocked] - another casting's forms on this side the same cast day, in table inches
 *        ({sx, sy, sw, sh, label}); drawn hatched grey, the auto-pack goes around them, a saved layout that
 *        overlaps them is flagged (2026-11-06)
 */
/** @param {string} [opts.sideLabel] - "SIDE A" / "SIDE B …": its own centred line at the very top of the page (2026-11-06) */
/** @param {string} [opts.emptySummary] - the summary line when no form of this casting is drawn on this side (2026-11-12) */
export function renderCastingLayout({ container, errorEl, components, title, area = 'B', offsetPerSide = 4, gapBetween = 0, positions = null, overflowLabel = null, hideOverflow = false, blocked = [], allowEmpty = false, sideLabel = '', bases = null, emptySummary = '' }) {
  if (!container) return null;
  container.innerHTML = '';
  if (errorEl) errorEl.textContent = '';

  const tableDefs = (CASTING_AREAS[area] || CASTING_AREAS.B).tables;
  const { molds, skipped } = buildMolds(components, offsetPerSide, bases);

  // allowEmpty (2026-11-06): the side this casting is NOT on still draws — the tables and the other jobs' forms.
  if (molds.length === 0 && !allowEmpty) {
    const msg = document.createElement('p');
    msg.className = 'pp-clay-empty';
    msg.textContent = (components && components.length > 0)
      ? 'This casting has no panels with usable width/length dimensions.'
      : 'This casting has no panels yet. Add components on the Casting Inventory tab.';
    container.appendChild(msg);
    if (errorEl && skipped.length > 0) {
      errorEl.textContent = `${skipped.length} panel(s) skipped — missing or unreadable dimensions.`;
    }
    return null;
  }

  // Manual mode whenever saved positions exist for this area; otherwise auto-pack.
  const posForArea = (positions || []).filter(p => (p.area === 'A' ? 'A' : 'B') === area);
  const mode = posForArea.length > 0 ? 'manual' : 'auto';
  const { placed, staged } = molds.length === 0 ? { placed: [], staged: [] } : mode === 'manual'
    ? layoutManual(molds, posForArea, tableDefs)
    : layoutAuto(molds, tableDefs, gapBetween, area === 'A', blocked);
  // A saved (manual) layout can sit on top of the other job's forms: those molds get a red outline.
  const clashes = blocked.length ? placed.filter(r => blocked.some(b => rectsOverlap(r, b))) : [];
  // Forms placed past a table edge on purpose (confirmed oversize placement, 2026-11-06): dashed orange outline.
  const oversize = placed.filter(r => !isRectInsideTables(r, tableDefs));

  const pageW = 750;
  const pageH = 1000;
  const headerH = 60;

  let contentMaxX = 0, contentMaxY = 0;
  for (const t of tableDefs) {
    const r = getTableScreenRect(t);
    contentMaxX = Math.max(contentMaxX, r.x + r.w);
    contentMaxY = Math.max(contentMaxY, r.y + r.h);
  }

  // Lay any overflow molds into an inch-space strip below the tables, then grow
  // the diagram bounds to include them so everything scales to fit the page.
  const stagingLabelY = contentMaxY + 16;
  const stagingStartY = contentMaxY + 34;
  let overallMaxX = contentMaxX;
  let overallMaxY = contentMaxY;
  if (staged.length > 0 && !hideOverflow) {
    overallMaxY = layoutStaging(staged, contentMaxX, stagingStartY, gapBetween);
    for (const rec of staged) overallMaxX = Math.max(overallMaxX, rec.sx + rec.sw);
  } else if (staged.length > 0) {
    overallMaxY = stagingStartY;   // just the "continues on the other side" line below the tables
  }

  const availW = pageW - 40;
  const fontSize = 9;
  // Molds too small for a label get a callout: a thin leader line to the panel id in the left or right margin
  // (whichever is nearer), like a shop drawing. The margins take room from the width, which changes the scale,
  // which changes which labels fit — so settle it in a couple of passes.
  const allRecs = [...placed, ...staged];
  const CALLOUT_ROW_H = fontSize * 1.05;
  const gutterFor = (recs) => Math.min(150, Math.max(0, ...recs.map(r => String(r.mold.label || '').length)) * fontSize * 0.85 * LABEL_CHAR_W + 16);
  let gutterL = 0, gutterR = 0, scale = 1, callouts = [];
  for (let pass = 0; pass < 4; pass++) {
    const availWp = pageW - 40 - gutterL - gutterR;
    const availH = pageH - headerH - 40;
    scale = Math.min(availWp / overallMaxX, availH / overallMaxY);
    const tsP = (v) => v * scale;
    for (const rec of allRecs) rec.labelMode = labelModeFor(rec, tsP, fontSize);
    callouts = allRecs.filter(r => r.labelMode.mode === 'n');
    const left = callouts.filter(r => (r.sx + r.sw / 2) < overallMaxX / 2), right = callouts.filter(r => (r.sx + r.sw / 2) >= overallMaxX / 2);
    const wantL = left.length ? gutterFor(left) : 0, wantR = right.length ? gutterFor(right) : 0;
    if (wantL === gutterL && wantR === gutterR) break;
    gutterL = wantL; gutterR = wantR;
  }
  const availH = pageH - headerH - 40;
  const availWp = pageW - 40 - gutterL - gutterR;
  const offsetX = 20 + gutterL + (availWp - overallMaxX * scale) / 2;
  const offsetY = headerH + (availH - overallMaxY * scale) / 2;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${pageW} ${pageH}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const tableColor = '#e5e7eb';
  const tableBorder = '#9ca3af';

  const tx = (x) => offsetX + x * scale;
  const ty = (y) => offsetY + y * scale;
  const ts = (v) => v * scale;

  // Draw tables
  for (const t of tableDefs) {
    const r = getTableScreenRect(t);
    const tableRect = svgRect(NS, tx(r.x), ty(r.y), ts(r.w), ts(r.h), tableColor, tableBorder, 0.5);
    tableRect.setAttribute('rx', 1);
    svg.appendChild(tableRect);

    svg.appendChild(svgText(NS, tx(r.x) + ts(r.w) / 2, ty(r.y) + ts(r.h) / 2, t.name, fontSize * 1.1, '#9ca3af', 'bold'));

    const dimStr = t.packAxis === 'x'
      ? `${frac(t.long)} x ${frac(t.narrow)}`
      : `${frac(t.narrow)} x ${frac(t.long)}`;
    svg.appendChild(svgText(NS, tx(r.x) + ts(r.w) / 2, ty(r.y) + ts(r.h) + fontSize * 1.2, dimStr, fontSize * 0.7, '#888', 'normal'));
  }

  // The other job's forms on this side (same cast day): hatched grey, labelled with job · cast (2026-11-06).
  if (blocked.length) {
    const defs = document.createElementNS(NS, 'defs');
    const patId = `clay-hatch-${area}-${Math.random().toString(36).slice(2, 7)}`;
    const pat = document.createElementNS(NS, 'pattern');
    pat.setAttribute('id', patId); pat.setAttribute('patternUnits', 'userSpaceOnUse');
    pat.setAttribute('width', 6); pat.setAttribute('height', 6); pat.setAttribute('patternTransform', 'rotate(45)');
    const stripe = document.createElementNS(NS, 'rect');
    stripe.setAttribute('width', 2); stripe.setAttribute('height', 6); stripe.setAttribute('fill', '#9ca3af');
    pat.appendChild(stripe); defs.appendChild(pat);
    // Tables a special condition uses (kind 'cond', 2026-11-12): the whole table, hatched purple.
    const condPatId = patId + '-c';
    if (blocked.some(b => b.kind === 'cond')) {
      const patC = pat.cloneNode(false);
      patC.setAttribute('id', condPatId);
      const stripeC = stripe.cloneNode(false);
      stripeC.setAttribute('fill', '#a78bfa');
      patC.appendChild(stripeC); defs.appendChild(patC);
    }
    svg.appendChild(defs);
    for (const b of blocked) {
      const isCond = b.kind === 'cond';
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', isCond ? 'clay-blocked clay-blocked-cond' : 'clay-blocked');
      g.appendChild(svgRect(NS, tx(b.sx), ty(b.sy), ts(b.sw), ts(b.sh), isCond ? '#f5f3ff' : '#e5e7eb', isCond ? '#6d28d9' : '#6b7280', isCond ? 1 : 0.5));
      g.appendChild(svgRect(NS, tx(b.sx), ty(b.sy), ts(b.sw), ts(b.sh), `url(#${isCond ? condPatId : patId})`, 'none', 0));
      if (Array.isArray(b.lines) && b.lines.length) {
        drawBlockLines(NS, g, b, tx, ty, ts, fontSize, isCond ? ['#4c1d95', '#6d28d9'] : ['#374151']);
      } else if (ts(b.sw) > fontSize * 2.4 && ts(b.sh) > fontSize * 1.1) {
        g.appendChild(svgText(NS, tx(b.sx + b.sw / 2), ty(b.sy + b.sh / 2), b.label || '', Math.min(fontSize * 0.8, ts(b.sh) * 0.6), '#374151', 'bold'));
      }
      const tt = document.createElementNS(NS, 'title');
      tt.textContent = b.tip || `${b.label || 'Another casting'} — on this side the same cast day`;
      g.appendChild(tt);
      svg.appendChild(g);
    }
  }

  // Draw placed molds — each as a <g class="clay-mold"> so the drag layer can grab it.
  for (const rec of placed) {
    const g = buildMoldGroup(NS, rec, tx, ty, ts, fontSize, offsetPerSide);
    if (clashes.includes(rec)) g.classList.add('clay-mold-clash');
    if (oversize.includes(rec)) g.classList.add('clay-mold-oversize');
    svg.appendChild(g);
  }

  // Draw the overflow staging strip: a label plus each unplaced mold as a
  // draggable clay-mold in the same coordinate space as the tables. Drag one
  // onto a table to place it.
  if (staged.length > 0) {
    svg.appendChild(svgText(NS, tx(overallMaxX / 2), ty(stagingLabelY), (overflowLabel ? `${staged.length} ${staged.length === 1 ? 'FORM' : 'FORMS'} — ${overflowLabel}` : 'OVERFLOW — drag a form onto a table to place it'), fontSize * 1.05, overflowLabel ? '#1d4ed8' : '#dc2626', 'bold'));
    if (!hideOverflow) for (const rec of staged) {
      svg.appendChild(buildMoldGroup(NS, rec, tx, ty, ts, fontSize, offsetPerSide));
    }
  }

  // Title + summary
  if (callouts.length) {
    // Leader lines: each small mold gets a label in the nearer margin; labels are stacked in mold order (top to
    // bottom) and spread apart so they never overlap, then a thin line joins the mold's centre to the label.
    const mid = tx(overallMaxX / 2);
    const place = (recs, side) => {
      recs.sort((a, b) => (a.sy + a.sh / 2) - (b.sy + b.sh / 2));
      const minY = headerH + 6, maxY = pageH - 10;
      const ys = recs.map(r => ty(r.sy + r.sh / 2));
      for (let i = 1; i < ys.length; i++) if (ys[i] < ys[i - 1] + CALLOUT_ROW_H) ys[i] = ys[i - 1] + CALLOUT_ROW_H;   // push down
      for (let i = ys.length - 1; i >= 0; i--) {                                                                   // then pull back up from the bottom
        const cap = i === ys.length - 1 ? maxY : ys[i + 1] - CALLOUT_ROW_H;
        if (ys[i] > cap) ys[i] = cap;
      }
      for (let i = 0; i < ys.length; i++) if (ys[i] < minY) ys[i] = minY;
      recs.forEach((rec, i) => {
        const cx = tx(rec.sx + rec.sw / 2), cy = ty(rec.sy + rec.sh / 2), ly = ys[i];
        const lx = side === 'left' ? 20 + gutterL - 6 : pageW - 20 - gutterR + 6;
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', cx); line.setAttribute('y1', cy); line.setAttribute('x2', lx); line.setAttribute('y2', ly);
        line.setAttribute('stroke', '#111'); line.setAttribute('stroke-width', 0.45);
        svg.appendChild(line);
        const dot = document.createElementNS(NS, 'circle');
        dot.setAttribute('cx', cx); dot.setAttribute('cy', cy); dot.setAttribute('r', 0.9); dot.setAttribute('fill', '#111');
        svg.appendChild(dot);
        const t = svgText(NS, side === 'left' ? lx - 3 : lx + 3, ly, rec.mold.label, fontSize * 0.85, '#111', 'bold');
        t.setAttribute('text-anchor', side === 'left' ? 'end' : 'start');
        svg.appendChild(t);
      });
    };
    place(callouts.filter(r => tx(r.sx + r.sw / 2) < mid), 'left');
    place(callouts.filter(r => tx(r.sx + r.sw / 2) >= mid), 'right');
  }
  const totalMolds = molds.length;
  const summaryStr = totalMolds === 0
    ? emptySummary || (blocked.length ? `No forms of this casting on this side — ${[...new Set(blocked.map(b => b.label).filter(Boolean))].join(', ')} (hatched)` : 'Nothing on this side that day')
    : ((mode === 'manual'
      ? `${totalMolds} molds — manual layout`
        + (staged.length > 0 ? ` — ${staged.length} not placed` : '')
      : `${totalMolds} molds — ${totalMolds - staged.length} on tables`
        + (staged.length > 0 ? (hideOverflow ? ` — ${staged.length} continue on the other side` : ` — ${staged.length} overflow`) : ''))
    + ` — +${frac(offsetPerSide)}/side mold offset`
    + (blocked.length ? ` — SHARED WITH ${[...new Set(blocked.map(b => b.label).filter(Boolean))].join(', ')} (hatched)` : '')
    + (clashes.length ? ` — ${clashes.length} OVERLAP` : '')
    + (oversize.length ? ` — ${oversize.length} OVERSIZE` : ''));
  const summaryColor = (totalMolds === 0 && emptySummary) ? '#6d28d9' : (staged.length > 0 || clashes.length > 0) ? '#dc2626' : (blocked.length ? '#b45309' : (totalMolds === 0 ? '#9ca3af' : '#555'));
  if (sideLabel) {
    // SIDE A / SIDE B first, on its own line, then the usual title and summary.
    svg.appendChild(svgText(NS, pageW / 2, 14, sideLabel, fontSize * 1.9, '#111', 'bold'));
    svg.appendChild(svgText(NS, pageW / 2, 34, title || 'Casting Layout', fontSize * 1.3, '#222', 'bold'));
    svg.appendChild(svgText(NS, pageW / 2, 50, summaryStr, fontSize * 0.95, summaryColor, 'normal'));
  } else {
    svg.appendChild(svgText(NS, pageW / 2, 18, title || 'Casting Layout', fontSize * 1.5, '#222', 'bold'));
    svg.appendChild(svgText(NS, pageW / 2, 38, summaryStr, fontSize, summaryColor, 'normal'));
  }

  container.appendChild(svg);

  // Status line
  if (errorEl) {
    const parts = [];
    if (staged.length > 0) parts.push(`${staged.length} mold(s) not on a table — drag them from the overflow strip onto a table, or click one to set its real base size.`);
    const basesUsed = molds.filter(m => m.baseSet).length;
    if (basesUsed > 0) parts.push(`${basesUsed} form(s) drawn at a custom base size.`);
    if (clashes.length > 0) parts.push(`${clashes.length} form(s) sit on top of the other job's forms (red outline) — move them, or pick the other side.`);
    if (oversize.length > 0) parts.push(`${oversize.length} form(s) hang past a table edge (dashed orange) — oversize placement, confirmed on the drag.`);
    if (skipped.length > 0) parts.push(`${skipped.length} panel(s) skipped — missing or unreadable dimensions.`);
    errorEl.textContent = parts.join(' ');
  }

  return { mode, area, svg, transform: { scale, offsetX, offsetY }, tableDefs, placed, staged, unplaced: staged, blocked, clashes, oversize, own: totalMolds > 0 };
}
