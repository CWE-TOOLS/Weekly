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
 * Casting Area A — placeholder layout. Until the real Area A table dimensions
 * are supplied, Area A reuses Area B's table arrangement so the tab is usable.
 * Replace this array with Area A's actual tables when available.
 */
const AREA_A_TABLES = AREA_B_TABLES.map(t => ({ ...t }));

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
 * Pack molds onto the casting tables. Molds are sorted widest-first; each is
 * tried on every table in both orientations until one fits.
 * @param {Array<{outerW:number, outerL:number}>} molds
 * @param {Array<Object>} tableDefs
 * @param {number} [gapBetween] - inches of clearance left between adjacent molds
 * @returns {{tables:Array<Object>, unplaced:Array<Object>}}
 */
function placeMoldsOnTables(molds, tableDefs, gapBetween = 0) {
  const tables = tableDefs.map(t => ({ ...t, usedLength: 0, placedMolds: [] }));
  const unplaced = [];
  const sorted = [...molds].sort((a, b) => b.outerW - a.outerW);

  for (const mold of sorted) {
    const oW = mold.outerW;
    const oL = mold.outerL;
    let placed = false;

    const orientations = [
      { across: oL, along: oW },
      { across: oW, along: oL }
    ];

    for (const table of tables) {
      for (const { across, along } of orientations) {
        if (across > table.narrow) continue;
        const gap = table.placedMolds.length > 0 ? gapBetween : 0;
        if (table.usedLength + gap + along > table.long) continue;

        const offset = table.usedLength + gap;
        let mx, my, mw, mh;
        if (table.packAxis === 'x') {
          mx = table.x + offset;
          my = table.y + (table.narrow - across) / 2;
          mw = along; mh = across;
        } else {
          mx = table.x + (table.narrow - across) / 2;
          my = table.y + offset;
          mw = across; mh = along;
        }

        table.placedMolds.push({ mold, sx: mx, sy: my, sw: mw, sh: mh });
        table.usedLength = offset + along;
        placed = true;
        break;
      }
      if (placed) break;
    }

    if (!placed) unplaced.push(mold);
  }

  return { tables, unplaced };
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
// RENDERING
// ============================================================================

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
 */
export function renderCastingLayout({ container, errorEl, components, title, area = 'B', offsetPerSide = 4, gapBetween = 0 }) {
  if (!container) return;
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
    return;
  }

  const { tables, unplaced } = placeMoldsOnTables(molds, tableDefs, gapBetween);

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
  for (const t of tables) {
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

  // Draw molds on tables
  for (const t of tables) {
    for (const pm of t.placedMolds) {
      const mx = tx(pm.sx), my = ty(pm.sy), mw = ts(pm.sw), mh = ts(pm.sh);
      svg.appendChild(svgRect(NS, mx, my, mw, mh, pm.mold.color, '#333', 0.4));
      svg.appendChild(svgText(NS, mx + mw / 2, my + mh / 2 - fontSize * 0.4, pm.mold.label, fontSize * 0.85, '#222', 'bold'));
      svg.appendChild(svgText(NS, mx + mw / 2, my + mh / 2 + fontSize * 0.4, `${frac(pm.mold.outerW)} x ${frac(pm.mold.outerL)}`, fontSize * 0.65, '#444', 'normal'));
    }
  }

  // Draw unplaced (overflow) molds
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
      svg.appendChild(svgText(NS, ux + drawW / 2, oy + drawH / 2 - fontSize * 0.2, mold.label, fontSize * 0.75, '#dc2626', 'bold'));
      svg.appendChild(svgText(NS, ux + drawW / 2, oy + drawH / 2 + fontSize * 0.5, `${frac(mold.outerW)} x ${frac(mold.outerL)}`, fontSize * 0.6, '#dc2626', 'normal'));
      ux += drawW + 8;
    }
  }

  // Title + summary
  const totalMolds = molds.length;
  const placedCount = totalMolds - unplaced.length;
  const summaryStr = `${totalMolds} molds — ${placedCount} on tables`
    + (unplaced.length > 0 ? ` — ${unplaced.length} overflow` : '')
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
}
