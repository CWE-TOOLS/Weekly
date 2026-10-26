/**
 * Project Map dummies — saved what-if schedules (migration/project-map-dummies.sql).
 * A dummy = { id, name, final, chain, created_by } + moves: one row per moved weekly day
 * (project_number, casting_number, department, orig_date -> new_date). Nothing real changes when a dummy is saved.
 */
import { initializeSupabase, getSupabaseClient } from './supabase-service.js';
import { logger } from '../utils/logger.js';

const T = 'project_map_dummies';
const M = 'project_map_dummy_moves';
let migrationPending = false;

export function isDummyMigrationPending() { return migrationPending; }

async function client() { return getSupabaseClient() || await initializeSupabase(); }

function missing(error) {
    return !!error && (error.code === '42P01' || error.code === 'PGRST205' || /relation .* does not exist|schema cache/i.test(error.message || ''));
}

/** All saved dummies, newest first, with their move counts. */
export async function listDummies() {
    const sb = await client();
    if (!sb) return [];
    const { data, error } = await sb.from(T).select('id, name, final, chain, created_by, created_at, updated_at').order('updated_at', { ascending: false });
    if (error) { if (missing(error)) { migrationPending = true; return []; } throw error; }
    migrationPending = false;
    const { data: counts } = await sb.from(M).select('dummy_id');
    const n = new Map();
    for (const r of counts || []) n.set(r.dummy_id, (n.get(r.dummy_id) || 0) + 1);
    return (data || []).map(d => ({ ...d, moves: n.get(d.id) || 0 }));
}

/** The moves of one dummy as a Map `${pn}|${cn}|${dept}|${orig}` -> new ('YYYY-MM-DD'). */
export async function loadDummyMoves(id) {
    const sb = await client();
    const out = new Map();
    if (!sb) return out;
    const { data, error } = await sb.from(M).select('project_number, casting_number, department, orig_date, new_date').eq('dummy_id', id).limit(10000);
    if (error) throw error;
    for (const r of data || []) out.set(`${r.project_number}|${r.casting_number}|${r.department}|${r.orig_date}`, r.new_date);
    return out;
}

/** Create or update a dummy and replace its moves. Returns the id. */
export async function saveDummy({ id = null, name, final = false, chain = true, createdBy = null }, moves) {
    const sb = await client();
    if (!sb) throw new Error('No database connection');
    const row = { name: String(name).trim(), final: !!final, chain: !!chain, updated_at: new Date().toISOString() };
    if (!id) row.created_by = createdBy || null;
    let dummyId = id;
    if (id) {
        const { error } = await sb.from(T).update(row).eq('id', id);
        if (error) throw error;
    } else {
        const { data, error } = await sb.from(T).insert(row).select('id').single();
        if (error) throw error;
        dummyId = data.id;
    }
    const { error: delErr } = await sb.from(M).delete().eq('dummy_id', dummyId);
    if (delErr) throw delErr;
    const rows = [];
    for (const [key, newDate] of moves) {
        const [project_number, casting_number, department, orig_date] = key.split('|');
        if (newDate && newDate !== orig_date) rows.push({ dummy_id: dummyId, project_number, casting_number, department, orig_date, new_date: newDate });
    }
    for (let i = 0; i < rows.length; i += 500) {
        const { error } = await sb.from(M).insert(rows.slice(i, i + 500));
        if (error) throw error;
    }
    logger.info(`[dummy] saved "${row.name}" with ${rows.length} moves`);
    return dummyId;
}

export async function deleteDummy(id) {
    const sb = await client();
    if (!sb) throw new Error('No database connection');
    const { error } = await sb.from(T).delete().eq('id', id);
    if (error) throw error;
}
