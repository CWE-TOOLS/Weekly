/**
 * Multi-Color Service
 * Project-level opt-in toggle that lets a project carry more than one
 * color log. Today every project has exactly one non-preset color_log
 * row (see migration/color-logs-schema.sql). The schema migration
 * multi-color-schema.sql backfills color_log_id on every existing
 * component / inventory item / batch ticket so the FK is populated
 * everywhere from day one. This service handles the per-project flip.
 *
 * Mirrors phases-service.js / enablePhasesForProject:
 *   - one-way switch (once on, stays on)
 *   - flag flip is the LAST step so retries are safe
 *
 * Schema:
 *   projects.multi_color_enabled BOOLEAN
 *   color_logs (one or many per project after toggle)
 *   casting_components.color_log_id, casting_inventory.color_log_id,
 *   batch_tickets.color_log_id (nullable FKs)
 *
 * @module services/multi-color-service
 */

import { initializeSupabase, getSupabaseClient } from './supabase-service.js';
import { logger } from '../utils/logger.js';

const PROJECTS_TABLE = 'projects';
const COLOR_LOGS_TABLE = 'color_logs';
const COMPONENTS_TABLE = 'casting_components';
const INVENTORY_TABLE = 'casting_inventory';
const BATCH_TICKETS_TABLE = 'batch_tickets';
const CASTINGS_TABLE = 'project_castings';

async function getClient() {
    let client = getSupabaseClient();
    if (!client) {
        client = await initializeSupabase();
    }
    return client;
}

/**
 * Enable multi-color for a project atomically:
 *   - safety-backfills color_log_id on any existing component / inventory /
 *     batch ticket row that's missing one (the bulk backfill in the schema
 *     migration covers historical rows; this catches anything added since)
 *   - flips projects.multi_color_enabled to TRUE
 *
 * Idempotent: if multi-color is already enabled, returns immediately.
 *
 * @param {string} projectNumber
 * @returns {Promise<{enabled: boolean}>}
 */
export async function enableMultiColorForProject(projectNumber) {
    if (!projectNumber) throw new Error('projectNumber required');
    const client = await getClient();
    if (!client) throw new Error('Supabase client unavailable');

    const projNum = String(projectNumber);

    // Already enabled? Return current state.
    const { data: project, error: projErr } = await client
        .from(PROJECTS_TABLE)
        .select('project_number, multi_color_enabled')
        .eq('project_number', projNum)
        .maybeSingle();
    if (projErr) {
        logger.error('[multi-color] enable project lookup error:', projErr);
        throw projErr;
    }
    if (project?.multi_color_enabled) {
        return { enabled: true };
    }

    // Find the project's existing non-preset color log (if any). New
    // projects may not have one yet — that's fine, the user will add
    // logs after toggling.
    const { data: logs, error: logsErr } = await client
        .from(COLOR_LOGS_TABLE)
        .select('id')
        .eq('project_number', projNum)
        .eq('is_preset', false)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(1);
    if (logsErr) {
        logger.error('[multi-color] enable log lookup error:', logsErr);
        throw logsErr;
    }
    const defaultLogId = logs?.[0]?.id || null;

    if (defaultLogId) {
        // Backfill any rows that the schema-time backfill missed (e.g.
        // components added between the migration and this toggle). Scope
        // by joining through project_castings using a subquery.
        const { data: castings, error: castErr } = await client
            .from(CASTINGS_TABLE)
            .select('id')
            .eq('project_number', projNum);
        if (castErr) {
            logger.error('[multi-color] enable castings lookup error:', castErr);
            throw castErr;
        }
        const castingIds = (castings || []).map(c => c.id);

        if (castingIds.length > 0) {
            const { error: compErr } = await client
                .from(COMPONENTS_TABLE)
                .update({ color_log_id: defaultLogId })
                .in('casting_id', castingIds)
                .is('color_log_id', null);
            if (compErr) {
                logger.error('[multi-color] enable components backfill error:', compErr);
                throw compErr;
            }

            const { error: invErr } = await client
                .from(INVENTORY_TABLE)
                .update({ color_log_id: defaultLogId })
                .in('casting_id', castingIds)
                .is('color_log_id', null);
            if (invErr) {
                logger.error('[multi-color] enable inventory backfill error:', invErr);
                throw invErr;
            }

            const { error: btErr } = await client
                .from(BATCH_TICKETS_TABLE)
                .update({ color_log_id: defaultLogId })
                .in('casting_id', castingIds)
                .is('color_log_id', null);
            if (btErr) {
                logger.error('[multi-color] enable batch tickets backfill error:', btErr);
                throw btErr;
            }
        }
    }

    // Flip the flag last — if any of the above failed we want to retry.
    const { error: flagErr } = await client
        .from(PROJECTS_TABLE)
        .update({ multi_color_enabled: true })
        .eq('project_number', projNum);
    if (flagErr) {
        logger.error('[multi-color] enable flag flip error:', flagErr);
        throw flagErr;
    }

    return { enabled: true };
}
