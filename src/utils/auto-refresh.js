/* ============================================================
   Auto-refresh + data-freshness helpers (shared)
   ------------------------------------------------------------
   Keeps a page's data fresh while it sits idle and gives the
   user visible feedback on how old the data is.

   - startVisiblePolling(fn, intervalMs): re-run `fn` on an
     interval, but ONLY while the tab is visible (so a backgrounded
     tab costs nothing). Reads go through the Supabase sheets_cache,
     so this does not hammer Google Sheets — Sheets is re-fetched at
     most once per cache TTL, shared across all clients.
   - markDataUpdated(): call after every successful data load so the
     freshness chip resets to "just now".
   - initFreshnessLabel(el): attach the chip element; its relative
     label ("Updated 3m ago") re-renders on a timer.

   Both the weekly schedule and the releasability board use this so
   the UX is identical on both pages.
   ============================================================ */

// Default poll cadence. Matches the 5-minute sheets_cache TTL so each
// poll lines up with roughly one real refresh cycle.
export const DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000;

// Freshness colour thresholds (minutes since last successful load).
const AGING_AFTER_MIN = 6;   // green -> amber
const STALE_AFTER_MIN = 16;  // amber -> red

let lastUpdated = null;       // epoch ms of last successful load
let labelEl = null;           // the chip element, if attached
let labelTimer = null;        // interval that re-renders the relative label
let pollTimer = null;         // the visible-tab poll interval
let visibilityHandler = null; // visibilitychange listener for tab-return catch-up
let lastVisibilityRefresh = 0;// epoch ms of last tab-return refresh (flicker dedup)

/**
 * Record that data just loaded successfully. Resets the freshness chip.
 */
export function markDataUpdated() {
  lastUpdated = Date.now();
  renderLabel();
}

/**
 * Attach a chip element whose text reflects how stale the data is.
 * Re-renders every 30s so "Updated Xm ago" stays accurate without a reload.
 * @param {HTMLElement} el
 */
export function initFreshnessLabel(el) {
  labelEl = el || null;
  renderLabel();
  if (labelTimer) clearInterval(labelTimer);
  // Tick often enough that the minute count and colour stay current.
  labelTimer = setInterval(renderLabel, 30 * 1000);
}

function renderLabel() {
  if (!labelEl) return;

  if (lastUpdated == null) {
    labelEl.textContent = 'Updating…';
    labelEl.className = 'data-freshness';
    labelEl.removeAttribute('title');
    return;
  }

  const mins = Math.floor((Date.now() - lastUpdated) / 60000);
  let text;
  if (mins < 1) text = 'Updated just now';
  else if (mins === 1) text = 'Updated 1m ago';
  else text = `Updated ${mins}m ago`;

  let state = 'fresh';
  if (mins >= STALE_AFTER_MIN) state = 'stale';
  else if (mins >= AGING_AFTER_MIN) state = 'aging';

  labelEl.textContent = text;
  labelEl.className = 'data-freshness ' + state;
  labelEl.title = 'Last updated ' + new Date(lastUpdated).toLocaleTimeString();
}

/**
 * Run `refreshFn` every `intervalMs`, but only while the tab is visible.
 * Safe to call once per page; replaces any prior poller.
 * @param {() => (void|Promise<any>)} refreshFn
 * @param {number} [intervalMs]
 */
export function startVisiblePolling(refreshFn, intervalMs = DEFAULT_POLL_INTERVAL_MS) {
  if (typeof refreshFn !== 'function') return;

  // Visible-tab poll: re-run on an interval, but never while hidden — a
  // backgrounded tab should cost nothing, and the tab-return listener below
  // handles catch-up the instant the user comes back.
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    if (document.hidden) return;
    safeRun(refreshFn);
  }, intervalMs);

  // Tab-return catch-up. Browsers throttle (and eventually freeze) timers in
  // background tabs, so the poll above pauses while hidden and the data — plus
  // the freshness chip — drifts stale (e.g. "Updated 55m ago"). The moment the
  // tab becomes visible again, refresh immediately and resync the chip. This is
  // self-contained here so it works on EVERY page that polls, with no reliance
  // on the global-listeners / event-bus chain being initialized (the
  // releasability board never initializes it, so its old PAGE_VISIBLE hook was
  // dead).
  if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
  visibilityHandler = () => {
    if (document.hidden) return;
    // The chip's own re-render timer was frozen while hidden, so the displayed
    // age can be far behind reality — correct it the instant we're back.
    renderLabel();
    // Collapse the rapid hidden→visible→hidden flicker some window managers emit
    // so a single return triggers at most one refresh.
    const now = Date.now();
    if (now - lastVisibilityRefresh < 3000) return;
    lastVisibilityRefresh = now;
    safeRun(refreshFn);
  };
  document.addEventListener('visibilitychange', visibilityHandler);
}

/** Run a refresh fn defensively — never let a rejection or throw escape. */
function safeRun(refreshFn) {
  try {
    Promise.resolve(refreshFn()).catch(() => { /* swallow — silent refresh */ });
  } catch (_) { /* ignore */ }
}

/** Stop the poller, the label timer, and the tab-return listener (teardown). */
export function stopAutoRefresh() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  if (labelTimer) { clearInterval(labelTimer); labelTimer = null; }
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
}
