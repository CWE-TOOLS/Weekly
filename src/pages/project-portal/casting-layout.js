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
const AREA_A_TABLES = [
  { id: 1, name: 'Table 1', narrow: 60, long: 1170, x: 144, y: 0,   packAxis: 'y' }, // right side
  { id: 2, name: 'Table 2', narrow: 72, long: 351,  x: 0,   y: 564, packAxis: 'y' }, // left upper
  { id: 3, name: 'Table 3', narrow: 60, long: 255,  x: 0,   y: 915, packAxis: 'y' }, // left lower
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
 * @returns {{tables:Array<Object>, unplaced:Array<Object>}}
 */
function placeMoldsOnTables(molds, tableDefs, gapBetween = 0) {
  const tables = tableDefs.map(t => ({
    ...t,
    longUsed: 0,     // long-axis inches consumed by rows so far
    shelves: [],     // rows packed onto this table
    placedMolds: [], // {mold, sx, sy, sw, sh} screen rectangles for rendering
  }));
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
    const g = table.shelves.length > 0 ? gap : 0;
    const rowStart = table.longUsed + g;
    for (const { across, depth } of byAcross) {
      if (across > table.narrow) continue;
      if (rowStart + depth > table.long) continue;
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
function buildMolds(components, offsetPerSide) {
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
    molds.push({
      componentId: c.id || null,
      label: (c.panel_id || c.type || `Panel ${i + 1}`).trim(),
      color: colorByType.get(typeKey),
      concreteW: w,
      concreteL: l,
      outerW: w + offsetPerSide * 2,
      outerL: l + offsetPerSide * 2
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
function layoutAuto(molds, tableDefs, gapBetween) {
  const { tables, unplaced } = placeMoldsOnTables(molds, tableDefs, gapBetween);
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
  return { placed, unplaced };
}

/**
 * Manual layout — place each mold at its saved position. A mold with no saved
 * position (a component added after the layout was customized) is cascaded at
 * the first table's corner so it stays visible and draggable.
 */
function layoutManual(molds, posForArea, tableDefs) {
  const byComponent = new Map();
  for (const p of posForArea) byComponent.set(p.component_id, p);

  const origin = tableDefs[0] ? getTableScreenRect(tableDefs[0]) : { x: 0, y: 0 };
  const placed = [];
  let cascade = 0;

  for (const mold of molds) {
    const pos = byComponent.get(mold.componentId);
    let sx, sy, rotation;
    if (pos) {
      sx = Number(pos.pos_x) || 0;
      sy = Number(pos.pos_y) || 0;
      rotation = Number(pos.rotation) === 90 ? 90 : 0;
    } else {
      sx = origin.x + cascade * 6;
      sy = origin.y + cascade * 6;
      rotation = 0;
      cascade++;
    }
    const { sw, sh } = moldScreenSize(mold, rotation);
    placed.push({
      componentId: mold.componentId,
      mold, sx, sy, sw, sh, rotation,
      isNew: !pos,
    });
  }
  return { placed, unplaced: [] };
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
function buildMoldGroup(NS, rec, tx, ty, ts, fontSize, offsetPerSide) {
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', rec.isNew ? 'clay-mold clay-mold-new' : 'clay-mold');
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

  g.appendChild(svgText(NS, mx + mw / 2, my + mh / 2 - fontSize * 0.4, rec.mold.label, fontSize * 0.85, '#222', 'bold'));
  g.appendChild(svgText(NS, mx + mw / 2, my + mh / 2 + fontSize * 0.4, `${frac(rec.mold.concreteW)} x ${frac(rec.mold.concreteL)}`, fontSize * 0.65, '#444', 'normal'));
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
export function renderCastingLayout({ container, errorEl, components, title, area = 'B', offsetPerSide = 4, gapBetween = 0, positions = null }) {
  if (!container) return null;
  container.innerHTML = '';
  if (errorEl) errorEl.textContent = '';

  const tableDefs = (CASTING_AREAS[area] || CASTING_AREAS.B).tables;
  const { molds, skipped } = buildMolds(components, offsetPerSide);

  if (molds.length === 0) {
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
  const { placed, unplaced } = mode === 'manual'
    ? layoutManual(molds, posForArea, tableDefs)
    : layoutAuto(molds, tableDefs, gapBetween);

  const pageW = 750;
  const pageH = 1000;
  const headerH = 60;

  let contentMaxX = 0, contentMaxY = 0;
  for (const t of tableDefs) {
    const r = getTableScreenRect(t);
    contentMaxX = Math.max(contentMaxX, r.x + r.w);
    contentMaxY = Math.max(contentMaxY, r.y + r.h);
  }

  const availW = pageW - 40;
  const availH = pageH - headerH - 40;
  const scale = Math.min(availW / contentMaxX, availH / contentMaxY);
  const offsetX = (pageW - contentMaxX * scale) / 2;
  const offsetY = headerH + (availH - contentMaxY * scale) / 2;
  const overflowY = offsetY + contentMaxY * scale + 20;

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${pageW} ${pageH}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const fontSize = 9;
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

  // Draw molds — each as a <g class="clay-mold"> so the drag layer can grab it.
  for (const rec of placed) {
    svg.appendChild(buildMoldGroup(NS, rec, tx, ty, ts, fontSize, offsetPerSide));
  }

  // Draw unplaced (overflow) molds — auto mode only.
  if (unplaced.length > 0) {
    svg.appendChild(svgText(NS, pageW / 2, overflowY, 'OVERFLOW — Does not fit on tables', fontSize * 1.1, '#dc2626', 'bold'));

    let totalOW = 0;
    for (const mold of unplaced) totalOW += mold.outerW + 10;
    const oScale = Math.min(scale, (pageW - 40) / totalOW);
    let ux = 20;

    for (const mold of unplaced) {
      const drawW = mold.outerW * oScale;
      const drawH = mold.outerL * oScale;
      const oy = overflowY + fontSize;

      const mr = svgRect(NS, ux, oy, drawW, drawH, mold.color, '#dc2626', 0.6);
      mr.setAttribute('stroke-dasharray', '3,2');
      svg.appendChild(mr);

      // Inner concrete rectangle — same convention as the on-table molds.
      const oInset = offsetPerSide * oScale;
      if (oInset > 0 && drawW > oInset * 2 && drawH > oInset * 2) {
        const innerR = svgRect(NS, ux + oInset, oy + oInset, drawW - oInset * 2, drawH - oInset * 2, 'none', '#dc2626', 0.3);
        innerR.setAttribute('stroke-dasharray', '2 2');
        svg.appendChild(innerR);
      }

      svg.appendChild(svgText(NS, ux + drawW / 2, oy + drawH / 2 - fontSize * 0.2, mold.label, fontSize * 0.75, '#dc2626', 'bold'));
      svg.appendChild(svgText(NS, ux + drawW / 2, oy + drawH / 2 + fontSize * 0.5, `${frac(mold.concreteW)} x ${frac(mold.concreteL)}`, fontSize * 0.6, '#dc2626', 'normal'));
      ux += drawW + 8;
    }
  }

  // Title + summary
  const totalMolds = molds.length;
  const summaryStr = (mode === 'manual'
      ? `${totalMolds} molds — manual layout`
      : `${totalMolds} molds — ${totalMolds - unplaced.length} on tables`
        + (unplaced.length > 0 ? ` — ${unplaced.length} overflow` : ''))
    + ` — +${frac(offsetPerSide)}/side mold offset`;
  svg.appendChild(svgText(NS, pageW / 2, 18, title || 'Casting Layout', fontSize * 1.5, '#222', 'bold'));
  svg.appendChild(svgText(NS, pageW / 2, 38, summaryStr, fontSize, unplaced.length > 0 ? '#dc2626' : '#555', 'normal'));

  container.appendChild(svg);

  // Status line
  if (errorEl) {
    const parts = [];
    if (unplaced.length > 0) parts.push(`${unplaced.length} mold(s) do not fit on the casting tables.`);
    if (skipped.length > 0) parts.push(`${skipped.length} panel(s) skipped — missing or unreadable dimensions.`);
    errorEl.textContent = parts.join(' ');
  }

  return { mode, area, svg, transform: { scale, offsetX, offsetY }, tableDefs, placed, unplaced };
}
