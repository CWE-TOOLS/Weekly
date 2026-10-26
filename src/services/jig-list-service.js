/**
 * Jig List Service
 * Per-casting state blob for the Jig List tab (ported GFRC Scrim Jig
 * Generator). One row per casting.
 *
 * Schema: jig_lists (see migration/jig-lists-per-casting.sql)
 *   - id UUID PK
 *   - casting_id UUID UNIQUE FK -> project_castings (CASCADE on delete);
 *     NULL on legacy rows saved before the per-casting migration for
 *     projects that had no castings — kept as a seed blob.
 *   - project_number TEXT FK -> projects (CASCADE on delete), indexed for
 *     the per-project bulk load
 *   - data JSONB (the tool's full state object, same shape as its
 *     .jigs.json export files)
 *   - created_at / updated_at TIMESTAMPTZ
 *
 * @module services/jig-list-service
 */

import { initializeSupabase, getSupabaseClient } from './supabase-service.js';
import { logger } from '../utils/logger.js';

const TABLE = 'jig_lists';

async function getClient() {
    let client = getSupabaseClient();
    if (!client) client = await initializeSupabase();
    return client;
}

/* Pre-migration guard: jig_lists.casting_id doesn't exist until
   migration/jig-lists-per-casting.sql is run. Detect the missing-column
   error (Postgres 42703) and warn once instead of spamming the console. */
let warnedPendingMigration = false;

function isMissingCastingColumn(error) {
    return !!error && (
        error.code === '42703' ||
        /casting_id.*(does not exist|could not find)/i.test(error.message || '') ||
        /column\s+.*casting_id/i.test(error.message || '')
    );
}

function warnPendingMigration() {
    if (warnedPendingMigration) return;
    warnedPendingMigration = true;
    console.warn('[jig-list] jig_lists has no casting_id column yet — run ' +
        'migration/jig-lists-per-casting.sql in the Supabase SQL editor. ' +
        'Until then the Jig List tab works in memory only: per-casting ' +
        'loads fall back to the legacy project row and saves are skipped.');
}

function pendingMigrationError() {
    const err = new Error('jig_lists.casting_id missing — pending migration');
    err.pendingMigration = true;
    return err;
}

/**
 * Load every saved jig list for a project in one query.
 * @param {string} projectNumber
 * @returns {Promise<{byCasting: Map<string, Object>, legacy: Object|null}>}
 *   byCasting — casting_id -> state object (rows with a casting link);
 *   legacy — the state of a pre-migration NULL-casting row, if any (used as
 *   a seed fallback for projects whose rows weren't backfilled).
 */
export async function loadJigListsForProject(projectNumber) {
    const result = { byCasting: new Map(), legacy: null };
    if (!projectNumber) return result;
    const client = await getClient();
    if (!client) return result;

    const { data, error } = await client
        .from(TABLE)
        .select('casting_id, data')
        .eq('project_number', projectNumber);

    if (error) {
        if (isMissingCastingColumn(error)) {
            // Migration not applied yet — fall back to the legacy one-row-
            // per-project shape so existing data still seeds the tab.
            warnPendingMigration();
            const { data: legacyRow, error: legacyErr } = await client
                .from(TABLE)
                .select('data')
                .eq('project_number', projectNumber)
                .maybeSingle();
            if (legacyErr) {
                logger.error('[jig-list] legacy load error:', legacyErr);
                throw legacyErr;
            }
            result.legacy = legacyRow ? legacyRow.data : null;
            return result;
        }
        logger.error('[jig-list] loadJigListsForProject error:', error);
        throw error;
    }

    for (const row of data || []) {
        if (row.casting_id) result.byCasting.set(row.casting_id, row.data);
        else result.legacy = row.data;
    }
    return result;
}

/**
 * Save (insert-or-update, keyed on casting_id) the jig list for a casting.
 * @param {string} projectNumber
 * @param {string} castingId
 * @param {Object} state the tool's full state object
 * @returns {Promise<boolean>}
 * @throws {Error} err.pendingMigration=true when the casting_id column is
 *   missing (migration not applied) — callers should degrade quietly.
 */
export async function saveJigListForCasting(projectNumber, castingId, state) {
    if (!projectNumber) throw new Error('projectNumber required');
    if (!castingId) throw new Error('castingId required');
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const { data: existing, error: selErr } = await client
        .from(TABLE)
        .select('id')
        .eq('casting_id', castingId)
        .maybeSingle();

    if (selErr) {
        if (isMissingCastingColumn(selErr)) {
            warnPendingMigration();
            throw pendingMigrationError();
        }
        logger.error('[jig-list] saveJigListForCasting select error:', selErr);
        throw selErr;
    }

    if (existing) {
        const { error } = await client
            .from(TABLE)
            .update({
                data: state || {},
                updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);
        if (error) {
            logger.error('[jig-list] saveJigListForCasting update error:', error);
            throw error;
        }
    } else {
        const { error } = await client
            .from(TABLE)
            .insert({
                project_number: projectNumber,
                casting_id: castingId,
                data: state || {},
                updated_at: new Date().toISOString()
            });
        if (error) {
            logger.error('[jig-list] saveJigListForCasting insert error:', error);
            throw error;
        }
    }
    return true;
}


// ---------------------------------------------------------------------------
// Scrim (2026-10-26) — the takeoff rule (Material_Takeoff_Workflow_Rules.md §8): total sq ft = finished-face sq ft
// × scrim layers × pieces; a roll is 300 ft × 3.3 ft = 990 sq ft; rolls = total / 990 (two decimals, never rounded
// to quarters); linear feet of roll = total / 3.3 (one decimal). Layers come from the casting's jig-list
// cross-section; never assumed when they are not set.
// ---------------------------------------------------------------------------
export const SCRIM_ROLL_SQ_FT = 990;
export const SCRIM_ROLL_WIDTH_FT = 3.3;

/** Scrim layer count(s) from a saved jig-list state: { layers, perThickness:[{thickness, layers}] } or null when no cross-section is set. */
export function scrimLayersFromJigData(data) {
    if (!data || typeof data !== 'object') return null;
    const sections = Array.isArray(data.sections) && data.sections.length ? data.sections : (data.xsec && Array.isArray(data.xsec.heights) ? [data.xsec] : []);
    const perThickness = sections.map(sec => {
        const heights = Array.isArray(sec.heights) ? sec.heights : [];
        const checks = Array.isArray(sec.kinds) ? sec.kinds.filter(k => k === 'check').length : 0;
        // "No scrim" ticked on the Jig List tab (2026-10-26): every layer is a height check, no scrim at all.
        return { thickness: String(sec.thickness || '').trim(), layers: sec.noScrim ? 0 : Math.max(0, heights.length - checks) };
    });
    if (!perThickness.length) return null;
    const distinct = [...new Set(perThickness.map(p => p.layers))];
    return { layers: distinct.length === 1 ? distinct[0] : null, perThickness };
}

/** Scrim layers for one inventory type when a casting has several thicknesses: the jig-list panel whose label is the
 *  type (or starts with it — labels carry the size when a type comes in several sizes) names its thickness section. */
function layersForType(type, data, perThickness) {
    const t = String(type || '').trim().toLowerCase();
    if (!t) return null;
    const panels = Array.isArray(data?.panels) ? data.panels : [];
    const p = panels.find(x => String(x.label || '').trim().toLowerCase() === t) || panels.find(x => String(x.label || '').trim().toLowerCase().startsWith(t + ' '));
    if (!p) return null;
    const sec = perThickness[p.sec || 0] || perThickness[0];
    return sec ? sec.layers : null;
}

/** Scrim figures for a casting's inventory rows (quantity, extras, ff_sq_ft, type): { text, detail, warn }.
 *  text = the short line (linear feet of roll); detail = the full arithmetic for a hover; warn = something to check.
 *  One layer count for the whole casting when its thicknesses agree; per type via the jig-list panels when they differ. */
export function scrimForInventory(rows, data) {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return { text: '', detail: '', warn: false };
    const has = (v) => v !== null && v !== undefined && v !== '';
    const units = (r) => (parseInt(r.quantity, 10) || 0) + (parseInt(r.extras, 10) || 0);
    const partial = !list.every(r => has(r.ff_sq_ft));
    const face = list.reduce((sum, r) => sum + (Number(r.ff_sq_ft) || 0) * units(r), 0);
    const info = scrimLayersFromJigData(data);
    if (!info) return { text: 'Scrim: layers not set — add the cross-section on the Jig List tab (never assumed).', detail: SCRIM_RULE, warn: true };
    if (info.layers != null) return scrimSummary(face, !partial, info);
    // thicknesses disagree: layers per type
    let total = 0; const unmapped = new Set(); const lines = [];
    for (const r of list) {
        const L = layersForType(r.type, data, info.perThickness);
        if (L == null) { unmapped.add(String(r.type || '').trim() || '(no type)'); continue; }
        const sq = (Number(r.ff_sq_ft) || 0) * units(r) * L;
        total += sq;
        lines.push(`${String(r.type || '').trim() || '(no type)'}: ${f2(Number(r.ff_sq_ft) || 0)} ff sq ft × ${units(r)} × ${L} ${L === 1 ? 'layer' : 'layers'} = ${f2(sq)} sq ft`);
    }
    const per = info.perThickness.map(p => `${p.thickness || '?'}″: ${p.layers}`).join(', ');
    const rolls = total / SCRIM_ROLL_SQ_FT, linFt = total / SCRIM_ROLL_WIDTH_FT;
    let text = total > 0
        ? `Scrim: ${f1(linFt)} lin ft of roll (layers per thickness — ${per})`
        : `Scrim: none (layers per thickness — ${per})`;
    if (unmapped.size) text += ` — not counted, type not on the Jig List: ${[...unmapped].join(', ')}`;
    if (partial) text += ' (some inventory rows have no ff sq ft — partial)';
    const detail = [...lines, `Total ${f2(total)} sq ft = ${f2(rolls)} ${rolls === 1 ? 'roll' : 'rolls'} = ${f1(linFt)} lin ft`, SCRIM_RULE].join('\n');
    return { text, detail, warn: unmapped.size > 0 || partial };
}

const SCRIM_RULE = 'Takeoff rule: ff sq ft × layers = sq ft; a roll is 300 ft × 3.3 ft = 990 sq ft; lin ft = sq ft ÷ 3.3';
const f2 = (v) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f1 = (v) => v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** One line of scrim figures for a casting: { text, detail, warn } — warn = true when the layers are not known. */
export function scrimSummary(faceSqFt, ffComplete, layerInfo) {
    const face = Number(faceSqFt) || 0;
    if (!layerInfo) return { text: 'Scrim: layers not set — add the cross-section on the Jig List tab (never assumed).', detail: SCRIM_RULE, warn: true };
    if (layerInfo.layers == null) {
        const parts = layerInfo.perThickness.map(p => `${p.thickness || '?'}″: ${p.layers}`).join(', ');
        return { text: `Scrim: layers differ per thickness (${parts}) — not computed; set the same count or ask engineering.`, detail: SCRIM_RULE, warn: true };
    }
    const layers = layerInfo.layers;
    const total = face * layers;
    const rolls = total / SCRIM_ROLL_SQ_FT;
    const linFt = total / SCRIM_ROLL_WIDTH_FT;
    const partial = ffComplete === false ? ' (some inventory rows have no ff sq ft — partial)' : '';
    if (layers === 0) return { text: 'Scrim: none (no scrim layers on the Jig List cross-section).', detail: SCRIM_RULE, warn: false };
    const text = `Scrim: ${f1(linFt)} lin ft of roll (${layers} ${layers === 1 ? 'layer' : 'layers'})${partial}`;
    const detail = `${f2(face)} ff sq ft × ${layers} = ${f2(total)} sq ft = ${f2(rolls)} ${rolls === 1 ? 'roll' : 'rolls'} = ${f1(linFt)} lin ft\n${SCRIM_RULE}`;
    return { text, detail, warn: ffComplete === false };
}
