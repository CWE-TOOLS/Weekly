/**
 * Where the weekly board's schedule comes from (2026-10-28).
 *
 * Two sources exist for the task cards on the weekly (and the projects of the Releasability Board):
 *   'sheet'     — the Google Sheet chain (Optimizers → monthly tabs → "Primary Live List 2"), read through
 *                 sheets-service / sheets-cache-service as always;
 *   'scheduler' — the Plant Scheduler's own rows (plant_schedule), converted into the same task shape by
 *                 scheduler-tasks-service.
 *
 * The choice is one shared setting (plant_schedule_settings key "weekly_source"), switched on the Plant
 * Scheduler's Settings panel. Missing or unreadable setting = 'sheet', so publishing this code changes
 * nothing until somebody flips the switch. For a side-by-side check a page can be opened with
 * ?source=scheduler or ?source=sheet, which overrides the setting for that page only.
 *
 * @module services/weekly-source-service
 */

import { initializeSupabase, getSupabaseClient } from './supabase-service.js';
import { logger } from '../utils/logger.js';

export const WEEKLY_SOURCE_KEY = 'weekly_source';
export const SOURCE_SHEET = 'sheet';
export const SOURCE_SCHEDULER = 'scheduler';
const SETTINGS_TABLE = 'plant_schedule_settings';
const MEMO_MS = 10 * 1000;        // one read per page per 10 s; a settings broadcast clears it

let memo = null;                  // { source, at }
function remember(source) {
    memo = { source, at: Date.now() };
    try { window.__weeklySource = source; } catch (_) { /* no window */ }
}
try { window.__resetWeeklySourceMemo = () => { memo = null; }; } catch (_) { /* no window */ }

function normalize(v) {
    const s = String((v && typeof v === 'object') ? v.source : v || '').trim().toLowerCase();
    return s === SOURCE_SCHEDULER ? SOURCE_SCHEDULER : SOURCE_SHEET;
}

/** ?source=… on the page URL (a per-page override for checking both sources against each other). */
export function urlSourceOverride() {
    try {
        const v = new URLSearchParams(window.location.search).get('source');
        return v ? normalize(v) : null;
    } catch (_) { return null; }
}

/** Forget the memoised value (called when a plant_schedule_settings change is broadcast). */
export function resetWeeklySourceMemo() { memo = null; }

/**
 * The source the weekly should read right now. Never throws: any failure means 'sheet'.
 * @param {{fresh?: boolean}} [opts] fresh: skip the 10 s memo
 * @returns {Promise<'sheet'|'scheduler'>}
 */
export async function getWeeklySource(opts = {}) {
    const override = urlSourceOverride();
    if (override) { try { window.__weeklySource = override; } catch (_) { /* no window */ } return override; }
    if (!opts.fresh && memo && Date.now() - memo.at < MEMO_MS) return memo.source;
    let source = SOURCE_SHEET;
    try {
        if (!getSupabaseClient()) await initializeSupabase();
        const client = getSupabaseClient();
        if (client) {
            const { data, error } = await client.from(SETTINGS_TABLE).select('value').eq('key', WEEKLY_SOURCE_KEY).maybeSingle();
            if (error) logger.warn('[weekly-source] setting not readable, using the Google Sheet:', error.message || error);
            else source = normalize(data && data.value);
        }
    } catch (err) {
        logger.warn('[weekly-source] lookup failed, using the Google Sheet:', err);
    }
    remember(source);
    return source;
}

/** The last value getWeeklySource() resolved on this page (null before the first call). */
export function currentWeeklySource() { return urlSourceOverride() || (memo ? memo.source : null); }

/**
 * Switch the source for everyone. The write goes through the shared client, so every open weekly and board
 * receives portal_changed:plant_schedule_settings and reloads its tasks from the new source.
 * @param {'sheet'|'scheduler'} source
 */
export async function setWeeklySource(source) {
    const value = { source: normalize(source), at: new Date().toISOString() };
    if (!getSupabaseClient()) await initializeSupabase();
    const client = getSupabaseClient();
    if (!client) throw new Error('No database connection');
    const { error } = await client.from(SETTINGS_TABLE).upsert({ key: WEEKLY_SOURCE_KEY, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
    remember(value.source);
    return value.source;
}

export function sourceLabel(source) {
    return normalize(source) === SOURCE_SCHEDULER ? 'Plant Scheduler' : 'Google Sheet Optimizers';
}

/**
 * Show the source on the page: a chip with id "schedule-source" (the weekly's header carries one).
 * Does nothing on pages without the element.
 */
export function updateSourceBadge(source) {
    const el = typeof document !== 'undefined' && document.getElementById('schedule-source');
    if (!el) return;
    const sch = normalize(source) === SOURCE_SCHEDULER;
    const override = urlSourceOverride();
    el.textContent = sch ? 'Schedule: Plant Scheduler' : 'Schedule: Google Sheet';
    el.title = (sch
        ? 'The task cards come from the Plant Scheduler (scheduler.html). Changes made there show here within seconds.'
        : 'The task cards come from the Google Sheet Optimizers (Primary Live List 2). Switch to the Plant Scheduler on its Settings panel.')
        + (override ? ' — overridden for this page by ?source=' + override : '');
    el.classList.toggle('schedule-source-scheduler', sch);
    el.classList.toggle('schedule-source-override', !!override);
    el.hidden = false;
}
