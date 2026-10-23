/**
 * Auto-update: every open page reloads itself after a publish, once nobody is using it.
 *
 * version.json at the site root carries a stamp that every publish bumps. This module remembers the stamp it saw
 * when the page loaded, re-reads it every CHECK_EVERY_MS, and when it changes:
 *   - a hidden page (other tab, screen off) reloads straight away;
 *   - a visible page shows a small notice with "Refresh now" and reloads by itself after IDLE_MS without any
 *     mouse, keyboard or touch activity — never while a text box is focused, and the browser's own "unsaved
 *     changes" prompt still applies where a page has one.
 * It reloads at most once per stamp (sessionStorage), so a slow cache cannot cause a reload loop.
 */
const CHECK_EVERY_MS = 3 * 60 * 1000;   // how often to look for a new stamp
const IDLE_MS = 60 * 1000;              // how long the page must be untouched before it reloads itself
const KEY = 'portalAutoUpdateReloadedFor';

let seen = null;        // the stamp this page was loaded with
let pending = null;     // a newer stamp waiting for an idle moment
let lastActivity = Date.now();
let idleTimer = null;

async function readStamp() {
    try {
        const r = await fetch(`version.json?cb=${Date.now()}`, { cache: 'no-store' });
        if (!r.ok) return null;
        const j = await r.json();
        return j && j.version ? String(j.version) : null;
    } catch { return null; }
}

function typing() {
    const el = document.activeElement;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

function reloadNow(stamp) {
    try { sessionStorage.setItem(KEY, stamp); } catch { /* ignore */ }
    location.reload();
}

function notice(stamp) {
    if (document.getElementById('portal-update-notice')) return;
    const box = document.createElement('div');
    box.id = 'portal-update-notice';
    box.style.cssText = 'position:fixed;left:50%;bottom:3.2rem;transform:translateX(-50%);z-index:100000;background:#1e3a8a;color:#fff;' +
        'font:600 13px/1.3 Inter,Segoe UI,system-ui,sans-serif;padding:0.55rem 0.9rem;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.35);' +
        'display:flex;align-items:center;gap:0.7rem;max-width:calc(100vw - 2rem)';
    box.innerHTML = '<span>Portal update ready &mdash; this page refreshes itself when idle.</span>' +
        '<button type="button" style="font:700 12px Inter,Segoe UI,system-ui,sans-serif;padding:0.25rem 0.7rem;border:none;border-radius:999px;background:#fff;color:#1e3a8a;cursor:pointer">Refresh now</button>';
    box.querySelector('button').addEventListener('click', () => reloadNow(stamp));
    document.body.appendChild(box);
}

function armIdle() {
    clearTimeout(idleTimer);
    if (!pending) return;
    const wait = Math.max(0, IDLE_MS - (Date.now() - lastActivity));
    idleTimer = setTimeout(() => {
        if (!pending) return;
        if (typing() || Date.now() - lastActivity < IDLE_MS) { armIdle(); return; }
        reloadNow(pending);
    }, wait + 50);
}

async function check() {
    const now = await readStamp();
    if (!now) return;
    if (seen === null) { seen = now; return; }
    if (now === seen || pending === now) return;
    let already = null;
    try { already = sessionStorage.getItem(KEY); } catch { /* ignore */ }
    if (already === now) return;                 // this page already reloaded for that stamp (cache still catching up)
    pending = now;
    if (document.hidden) { reloadNow(now); return; }
    notice(now);
    armIdle();
}

function touch() { lastActivity = Date.now(); if (pending) armIdle(); }

export function startAutoUpdate() {
    for (const ev of ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel', 'scroll']) {
        window.addEventListener(ev, touch, { passive: true, capture: true });
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden && pending) reloadNow(pending); });
    check();
    setInterval(check, CHECK_EVERY_MS);
    window.__autoUpdate = { check, get seen() { return seen; }, get pending() { return pending; } };
}

startAutoUpdate();
