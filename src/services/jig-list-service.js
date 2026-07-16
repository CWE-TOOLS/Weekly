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
