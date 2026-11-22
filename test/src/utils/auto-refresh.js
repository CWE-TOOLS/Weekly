/* ============================================================
   Auto-refresh + data-freshness helpers (shared)
   ------------------------------------------------------------
   Keeps a page's data fresh while it sits idle and gives the
   user visible feedback on how old the data is.

   - startVisiblePolling(fn, intervalMs): staleness-driven refresh
     engine. A cheap heartbeat checks the data's age every 30s and
     re-runs `fn` whenever the age crosses `intervalMs` — the same
     effective cadence as a plain interval, but it self-heals: after
     a system sleep or tab freeze the first tick sees the huge age
     and catches up immediately, and a FAILED attempt is retried on
     the next tick instead of silently waiting out a full interval.
     Wake signals (tab visible again, window focus, network back,
     bfcache restore) trigger an immediate catch-up so the board is
     fresh the moment someone sits back down. Reads go through the
     Supabase sheets_cache, so none of this hammers Google Sheets —
     Sheets is re-fetched at most once per cache TTL, shared across
     all clients.
   - markDataUpdated(): call after every successful data load so the
     freshness chip resets to "just now". The engine also uses this
     timestamp as its staleness gate.
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

// Refresh-engine tuning.
const HEARTBEAT_MS = 30 * 1000;            // how often to check whether data is due
const WAKE_STALE_MS = 60 * 1000;           // wake signal refreshes if data older than this
const MIN_ATTEMPT_GAP_MS = 20 * 1000;      // floor between attempts so failures can't hammer
const INFLIGHT_GIVE_UP_MS = 2 * 60 * 1000; // a refresh stuck longer than this is presumed dead

let lastUpdated = null;       // epoch ms of last successful load
let labelEl = null;           // the chip element, if attached
let labelTimer = null;        // interval that re-renders the relative label

let refreshFnRef = null;      // the page's refresh function
let pollIntervalMs = DEFAULT_POLL_INTERVAL_MS;
let heartbeatTimer = null;    // the 30s staleness check
let inFlightSince = 0;        // epoch ms the running attempt started; 0 = idle
let lastAttemptAt = 0;        // epoch ms of the last attempt (rate limiting)
let lastAttemptFailed = false;// last attempt rejected — chip shows "retrying"
let wakeHandlers = null;      // bound wake listeners, for teardown

/**
 * Record that data just loaded successfully. Resets the freshness chip.
 */
export function markDataUpdated() {
  lastUpdated = Date.now();
  lastAttemptFailed = false;
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

  // A failed sync shouldn't be invisible: keep the honest age but tell the
  // user the page is on it.
  if (lastAttemptFailed) text += ' · retrying';

  let state = 'fresh';
  if (mins >= STALE_AFTER_MIN) state = 'stale';
  else if (mins >= AGING_AFTER_MIN) state = 'aging';

  labelEl.textContent = text;
  labelEl.className = 'data-freshness ' + state;
  labelEl.title = 'Last updated ' + new Date(lastUpdated).toLocaleTimeString();
}

/** Age of the data in ms — Infinity until the first successful load. */
function dataAgeMs() {
  return lastUpdated == null ? Infinity : (Date.now() - lastUpdated);
}

/**
 * Refresh now if the data is older than `staleAfterMs`. Every trigger —
 * heartbeat tick, tab return, window focus, network back — funnels through
 * this single gate. Guards: never while hidden, never two attempts at once,
 * and never more often than MIN_ATTEMPT_GAP_MS.
 */
function maybeRefresh(staleAfterMs) {
  if (!refreshFnRef || document.hidden) return;
  if (dataAgeMs() < staleAfterMs) return;

  const now = Date.now();
  if (inFlightSince && (now - inFlightSince) < INFLIGHT_GIVE_UP_MS) return;
  if (now - lastAttemptAt < MIN_ATTEMPT_GAP_MS) return;
  lastAttemptAt = now;
  inFlightSince = now;

  Promise.resolve()
    .then(() => refreshFnRef())
    .then(() => {
      // Success is recorded by the page's own markDataUpdated() call (which
      // also clears the failure flag); nothing more to do here. A refreshFn
      // that resolves without loading data just means "nothing to retry".
      if (lastAttemptFailed) { lastAttemptFailed = false; renderLabel(); }
    })
    .catch(() => {
      // Keep the current data; the next heartbeat tick retries. This is what
      // recovers the "woke from sleep before the network was back" race.
      lastAttemptFailed = true;
      renderLabel();
    })
    .finally(() => { inFlightSince = 0; });
}

/**
 * A wake signal: the user (or the machine) just came back. Resync the chip —
 * its re-render timer was frozen while idle — and catch up if the data is
 * older than a minute.
 */
function onWake() {
  renderLabel();
  maybeRefresh(WAKE_STALE_MS);
}

function bindWakeListeners() {
  if (wakeHandlers) return;
  const onVisibility = () => { if (!document.hidden) onWake(); };
  wakeHandlers = { onVisibility, onWake };

  // Background tab brought back to the front.
  document.addEventListener('visibilitychange', onVisibility);
  // Window regains OS focus — covers system-sleep / monitor-off wakes where
  // the tab was frontmost the whole time and visibilitychange never fires.
  window.addEventListener('focus', onWake);
  // Connectivity restored — the wake-time attempt often races the network
  // stack reconnecting and fails; this fires the moment it's actually back.
  window.addEventListener('online', onWake);
  // Page restored from the back/forward cache.
  window.addEventListener('pageshow', onWake);
}

/**
 * Start the refresh engine: keep the page's data no older than `intervalMs`
 * while the tab is visible, and catch up immediately on any wake signal.
 * Safe to call once per page; replaces any prior engine.
 *
 * @param {() => (void|Promise<any>)} refreshFn - should RETURN its fetch
 *        promise (rejecting on failure) so failed attempts get retried and
 *        surfaced on the freshness chip; a fire-and-forget fn still works
 *        but downgrades those two behaviours.
 * @param {number} [intervalMs]
 */
export function startVisiblePolling(refreshFn, intervalMs = DEFAULT_POLL_INTERVAL_MS) {
  if (typeof refreshFn !== 'function') return;
  refreshFnRef = refreshFn;
  pollIntervalMs = intervalMs;

  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => maybeRefresh(pollIntervalMs), HEARTBEAT_MS);

  bindWakeListeners();
}

/** Stop the engine, the label timer, and the wake listeners (teardown). */
export function stopAutoRefresh() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  if (labelTimer) { clearInterval(labelTimer); labelTimer = null; }
  refreshFnRef = null;
  if (wakeHandlers) {
    document.removeEventListener('visibilitychange', wakeHandlers.onVisibility);
    window.removeEventListener('focus', wakeHandlers.onWake);
    window.removeEventListener('online', wakeHandlers.onWake);
    window.removeEventListener('pageshow', wakeHandlers.onWake);
    wakeHandlers = null;
  }
}
