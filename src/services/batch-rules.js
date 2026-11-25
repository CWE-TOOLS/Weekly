/**
 * Job batching rules (2026-11-25) — a job's own batching conditions, typed on the regular Batch Tickets tab.
 *
 * Until now a job whose casting crew wanted anything but the typical plan needed its own page (Jane Street:
 * config/special-batching.js). These are the same conditions as inputs, one set per job:
 *   faceSizes / backupSizes — batch sizes allowed for the Face Mix / the Back Up layers, lb of sand, largest first
 *                             (typical: 250, 150, 100). "150" = every batch 150 lb; "150, 100" = 150 lb batches and
 *                             a 100 lb one when that covers what is left.
 *   faceThicknessIn         — how thick the Face Mix is planned over the Face Sq Ft (typical 3/16")
 *   backupLayers            — 'first' | 'final': ONE back-up layer of that type behind the face
 *                             (typical: First Back Up as thick as the face, then FINAL Back Up)
 *   pigReduction            — ONE back-up pigment reduction for every casting of the job, instead of each casting's
 *                             own cell (typical: per casting, 50 % unless changed there)
 *   backupAdvaOz            — ADVA on every back-up batch, oz per color-log batch, instead of the color log's amount
 *   noCowbay                — never switch the FINAL Back Up sand to Bulk Sand (Cowbay)
 *   omitAggBackups          — aggregate left out of every back-up batch (First and FINAL)
 * A job with no row, or a row with nothing but typical values, is batched exactly as before (rules = null).
 *
 * Stored in plant_schedule_settings as "batch_rules:<project number>". A test copy of the portal (local test server,
 * the Weekly-test site) keeps its own "batch_rules_test:" rows, so trying this out never changes a real job.
 * The Color Logs are never touched: the rules only change the batching math.
 *
 * PRESETS (2026-11-25, user: "i'd also like to save presets ... give it a name ... another job requires the same
 * condition i could just pull it up by the name ... i would like to have the jane preset to exist"): a named set of
 * conditions. Saved ones live in ONE shared settings row, "batch_rule_presets" ("batch_rule_presets_test" on a test
 * copy); Jane Street is built in. Picking a preset COPIES its conditions into the job: a job never follows a preset
 * afterwards, so changing or deleting a preset cannot change tickets that were already printed. A job shows a
 * preset's name whenever its conditions are exactly that preset's. Names are on screen only, never on a printout.
 *
 * @module services/batch-rules
 */
import { loadSettingRows, setSettingRow } from './schedule-service.js';

export const TYPICAL_SIZES = [250, 150, 100];
export const TYPICAL_FACE_IN = 3 / 16;

function isTestCopy() {
    if (typeof window === 'undefined') return false;
    try {
        if (window.__BATCH_RULES_TEST || window.__TYPE_MASTER_PREFIX) return true;
        return /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname) || /\/Weekly-test\//i.test(location.pathname);
    } catch { return false; }
}
export function batchRulesKey(pn) { return (isTestCopy() ? 'batch_rules_test:' : 'batch_rules:') + String(pn ?? '').trim(); }

// ---------------------------------------------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------------------------------------------

const sameList = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);

/** "150, 100" / "150 lb" / "150/100" → { sizes: [150, 100] }; '' → { sizes: null } (typical); else { error }. */
export function parseSizes(text) {
    const raw = String(text ?? '').replace(/lbs?\.?/gi, ' ').trim();
    if (!raw) return { sizes: null, error: null };
    const parts = raw.split(/[\s,;/+]+/).filter(Boolean);
    const nums = parts.map(Number);
    if (nums.some(n => !Number.isFinite(n))) return { sizes: null, error: 'Numbers only, for example 150 or 150, 100' };
    if (nums.some(n => n < 25 || n > 1000 || Math.round(n) !== n)) return { sizes: null, error: 'Whole pounds of sand between 25 and 1000' };
    const sizes = [...new Set(nums)].sort((a, b) => b - a);
    if (sizes.length > 4) return { sizes: null, error: 'Four sizes at most' };
    return { sizes: sameList(sizes, TYPICAL_SIZES) ? null : sizes, error: null };
}
export function formatSizes(list) { return Array.isArray(list) && list.length ? list.join(', ') : ''; }

/** '1/4', '3/16"', '0.25', '1 1/2' → inches; '' → null (typical); NaN when it cannot be read. */
export function parseInches(text) {
    const raw = String(text ?? '').replace(/["″]|in\.?|inch(es)?/gi, ' ').trim();
    if (!raw) return null;
    const m = raw.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/);
    const n = m ? (Number(m[1] || 0) + Number(m[2]) / Number(m[3])) : Number(raw);
    return Number.isFinite(n) && n > 0 && n <= 3 ? n : NaN;
}
export function formatInches(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return '';
    for (const d of [2, 4, 8, 16, 32]) {
        const num = v * d;
        if (Math.abs(num - Math.round(num)) < 1e-6) {
            const whole = Math.floor(Math.round(num) / d), rest = Math.round(num) - whole * d;
            if (!rest) return String(whole);
            return (whole ? whole + ' ' : '') + rest + '/' + d;
        }
    }
    return String(Math.round(v * 1000) / 1000);
}

/** A stored / typed rules object → only its non-typical conditions; null when the job batches the typical way. */
export function normBatchRules(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const out = {};
    for (const k of ['faceSizes', 'backupSizes']) {
        const p = Array.isArray(raw[k]) ? parseSizes(raw[k].join(',')) : { sizes: null };
        if (p.sizes) out[k] = p.sizes;
    }
    const th = Number(raw.faceThicknessIn);
    if (Number.isFinite(th) && th > 0 && th <= 3 && Math.abs(th - TYPICAL_FACE_IN) > 1e-6) out.faceThicknessIn = th;
    if (raw.backupLayers === 'first' || raw.backupLayers === 'final') out.backupLayers = raw.backupLayers;
    if (raw.pigReduction !== '' && raw.pigReduction != null) {
        const pr = Number(raw.pigReduction);
        if (Number.isFinite(pr) && pr >= 0 && pr <= 100) out.pigReduction = pr;
    }
    if (raw.backupAdvaOz !== '' && raw.backupAdvaOz != null) {
        const adva = Number(raw.backupAdvaOz);
        if (Number.isFinite(adva) && adva >= 0 && adva <= 100) out.backupAdvaOz = adva;
    }
    if (raw.noCowbay === true) out.noCowbay = true;
    if (raw.omitAggBackups === true) out.omitAggBackups = true;
    return Object.keys(out).length ? out : null;
}

/** The planner's `sizing` (utils/batch-calc.js) for a job's rules; null = the standard plan. */
export function rulesSizing(rules) {
    if (!rules || (!rules.faceSizes && !rules.backupSizes && !rules.faceThicknessIn && !rules.backupLayers)) return null;
    const face = rules.faceSizes || TYPICAL_SIZES, backup = rules.backupSizes || TYPICAL_SIZES;
    return {
        face: face[0], backup: backup[0], faceSizes: face.slice(), backupSizes: backup.slice(),
        firstBackUp: !rules.backupLayers,
        backupType: rules.backupLayers === 'first' ? 'firstBackUp' : 'finalBackUp',
        faceThicknessIn: rules.faceThicknessIn || TYPICAL_FACE_IN
    };
}

/** The job-wide back-up pigment reduction (%), or null when each casting keeps its own. */
export function rulesPigReduction(rules) {
    return rules && rules.pigReduction != null ? Number(rules.pigReduction) : null;
}

const sizesText = (list) => (list.length === 1 ? `${list[0]} lb` : `${list[0]} lb (then ${list.slice(1).join(' / ')} lb for what is left)`);

/** What is special about the job, one short line each: [{ label, text }]. Empty = typical. */
export function batchRulesLines(rules) {
    const lines = [];
    if (!rules) return lines;
    if (rules.faceSizes) lines.push({ label: 'Face Mix batches', text: sizesText(rules.faceSizes) });
    if (rules.backupSizes) lines.push({ label: 'Back Up batches', text: sizesText(rules.backupSizes) });
    if (rules.faceThicknessIn) lines.push({ label: 'Face Mix thickness', text: formatInches(rules.faceThicknessIn) + '″' });
    if (rules.backupLayers) lines.push({ label: 'Back-up layers', text: rules.backupLayers === 'first' ? 'one layer, First Back Up' : 'one layer, FINAL Back Up' });
    if (rules.pigReduction != null) lines.push({ label: 'Back-up pigment reduction', text: rules.pigReduction + '% on every casting' });
    if (rules.backupAdvaOz != null) lines.push({ label: 'Back-up ADVA', text: rules.backupAdvaOz + ' oz per color-log batch' });
    if (rules.noCowbay) lines.push({ label: 'Sand', text: 'no Cowbay, the color log’s sand throughout' });
    if (rules.omitAggBackups) lines.push({ label: 'Aggregate', text: 'left out of every back-up mix' });
    return lines;
}

// ---------------------------------------------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------------------------------------------

/** One job's rules (null = typical). strict: throws when the row could not be read. */
export async function loadBatchRules(pn, opts = {}) {
    const key = batchRulesKey(pn);
    const rows = await loadSettingRows([key], opts);
    return normBatchRules(rows.get(key));
}
/** Map(project number -> rules) for the jobs that have any. */
export async function loadBatchRulesMap(pns) {
    const list = [...new Set((pns || []).map(p => String(p ?? '').trim()).filter(Boolean))];
    const out = new Map();
    if (!list.length) return out;
    const rows = await loadSettingRows(list.map(batchRulesKey));
    for (const pn of list) { const r = normBatchRules(rows.get(batchRulesKey(pn))); if (r) out.set(pn, r); }
    return out;
}
export async function saveBatchRules(pn, rules) {
    const clean = normBatchRules(rules);
    await setSettingRow(batchRulesKey(pn), clean ? { ...clean, v: 1 } : null);
    return clean;
}

// ---------------------------------------------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------------------------------------------

/** Built in: always there, cannot be deleted or replaced. Jane Street = the conditions of jane-street-batching.html
 *  (100 lb face mixes at 1/4", 200 lb back ups, one back-up layer typed First Back Up, back-up ADVA 0.5 oz, no pigment
 *  reduction, no aggregate in the back ups, no Cowbay). */
export const BUILTIN_PRESETS = [
    { name: 'Jane Street', builtin: true, rules: { faceSizes: [100], backupSizes: [200, 100], faceThicknessIn: 1 / 4, backupLayers: 'first', pigReduction: 0, backupAdvaOz: 0.5, noCowbay: true, omitAggBackups: true } }
];
export function batchPresetsKey() { return isTestCopy() ? 'batch_rule_presets_test' : 'batch_rule_presets'; }
const sameName = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
const cleanName = (name) => String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);

/** One text per set of conditions, whatever order its keys came in ('' = typical). */
export function rulesSignature(rules) {
    const r = normBatchRules(rules);
    return r ? JSON.stringify(Object.keys(r).sort().map(k => [k, r[k]])) : '';
}
/** The stored row -> [{ name, rules }]: named, not typical, no name twice, never a built-in's name. */
function normPresets(raw) {
    const out = [];
    for (const p of (Array.isArray(raw?.presets) ? raw.presets : [])) {
        const name = cleanName(p?.name), rules = normBatchRules(p?.rules);
        if (!name || !rules) continue;
        if (BUILTIN_PRESETS.some(b => sameName(b.name, name)) || out.some(o => sameName(o.name, name))) continue;
        out.push({ name, rules });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}
const withBuiltins = (saved) => [...BUILTIN_PRESETS.map(b => ({ name: b.name, builtin: true, rules: normBatchRules(b.rules) })), ...saved];
async function readSavedPresets(opts) {
    const key = batchPresetsKey();
    const rows = await loadSettingRows([key], opts);
    return normPresets(rows.get(key));
}
/** Every preset, built-in ones first. Not strict: when the row cannot be read, the built-in ones still come back. */
export async function loadBatchPresets(opts = {}) {
    try { return withBuiltins(await readSavedPresets(opts)); }
    catch (err) { if (opts.strict) throw err; return withBuiltins([]); }
}
/** Add a preset, or replace the one of that name. The row is read again first, so a preset someone else just saved stays. */
export async function saveBatchPreset(name, rules) {
    const nm = cleanName(name), clean = normBatchRules(rules);
    if (!nm || !clean) throw new Error('A preset needs a name and at least one special condition');
    if (BUILTIN_PRESETS.some(b => sameName(b.name, nm))) throw new Error('That name belongs to a built-in preset');
    const saved = (await readSavedPresets({ strict: true })).filter(p => !sameName(p.name, nm));
    saved.push({ name: nm, rules: clean });
    const next = normPresets({ presets: saved });
    await setSettingRow(batchPresetsKey(), { presets: next, v: 1 });
    return withBuiltins(next);
}
export async function deleteBatchPreset(name) {
    const saved = (await readSavedPresets({ strict: true })).filter(p => !sameName(p.name, name));
    await setSettingRow(batchPresetsKey(), saved.length ? { presets: saved, v: 1 } : null);
    return withBuiltins(saved);
}
/** The preset whose conditions are exactly these, or null. */
export function matchBatchPreset(presets, rules) {
    const sig = rulesSignature(rules);
    return sig ? ((presets || []).find(p => rulesSignature(p.rules) === sig) || null) : null;
}

// ---------------------------------------------------------------------------------------------------------------
// The panel on the Batch Tickets tab + its floating copy
// ---------------------------------------------------------------------------------------------------------------

const CSS = `
.pp-btr { margin: 0 0 14px; padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; }
.pp-btr.pp-btr-special { border: 2px solid #d97706; background: #fffbeb; }
.pp-btr-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px 12px; margin-bottom: 8px; }
.pp-btr-title { font-size: 13px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: #0f172a; }
.pp-btr-sub { font-size: 12px; color: #64748b; }
.pp-btr-badge { margin-left: auto; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: 0.05em; background: #e2e8f0; color: #475569; white-space: nowrap; }
.pp-btr-special .pp-btr-badge { background: #d97706; color: #fff; }
.pp-btr-status { font-size: 11px; color: #64748b; min-width: 70px; text-align: right; }
.pp-btr-status.pp-btr-err { color: #b91c1c; font-weight: 700; }
.pp-btr-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px 16px; }
.pp-btr-field { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.pp-btr-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; }
.pp-btr-field input, .pp-btr-field select { font: inherit; font-size: 13px; padding: 6px 8px; border: 1px solid #94a3b8; border-radius: 6px; background: #fff; color: #0f172a; width: 100%; box-sizing: border-box; }
.pp-btr-field input::placeholder { color: #94a3b8; font-style: italic; }
.pp-btr-field .pp-btr-set { border-color: #d97706; background: #fef3c7; font-weight: 700; }
.pp-btr-field .pp-btr-bad { border-color: #dc2626; background: #fef2f2; }
.pp-btr-hint { font-size: 11px; color: #64748b; line-height: 1.3; }
.pp-btr-hint b { color: #334155; }
.pp-btr-msg { font-size: 11px; color: #b91c1c; font-weight: 700; }
.pp-btr-more { margin-top: 10px; }
.pp-btr-more > summary { cursor: pointer; font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 8px; }
.pp-btr-foot { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 14px; margin-top: 10px; font-size: 11.5px; color: #64748b; }
.pp-btr-reset { font: inherit; font-size: 12px; font-weight: 700; padding: 4px 10px; border: 1px solid #94a3b8; border-radius: 6px; background: #fff; color: #334155; cursor: pointer; }
.pp-btr-reset:hover { background: #f1f5f9; }
.pp-btr-presets { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; }
.pp-btr-special .pp-btr-presets { border-bottom-color: #fcd34d; }
.pp-btr-presets select, .pp-btr-preset-new input { font: inherit; font-size: 13px; padding: 6px 8px; border: 1px solid #94a3b8; border-radius: 6px; background: #fff; color: #0f172a; box-sizing: border-box; max-width: 100%; }
.pp-btr-presets select { min-width: 250px; }
.pp-btr-presets select.pp-btr-set { border-color: #d97706; background: #fef3c7; font-weight: 700; }
.pp-btr-preset-new { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.pp-btr-preset-new[hidden] { display: none; }
.pp-btr-preset-new input { width: 230px; }
.pp-btr-preset-new input.pp-btr-bad { border-color: #dc2626; background: #fef2f2; }
.pp-btr-float .pp-btr-presets { gap: 3px 8px; margin-bottom: 8px; padding-bottom: 8px; }
.pp-btr-float .pp-btr-presets select { width: 100%; min-width: 0; padding: 4px 7px; }
.pp-btr-show { font: inherit; font-size: 12px; font-weight: 700; padding: 0; border: none; background: none; color: #334155; text-decoration: underline; cursor: pointer; }
.pp-btr-special .pp-btr-show { color: #92400e; }
/* the floating copy: right column, under the out-of-date box and the Castings box (same 320 px bubble) */
.pp-btr-float { position: fixed; right: 16px; width: 320px; max-width: calc(100vw - 32px); z-index: 60; margin: 0; padding: 10px 12px; border: 2px solid #cbd5e1; border-radius: 8px; box-sizing: border-box; overflow: auto; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18); }
.pp-btr-float.pp-btr-special { box-shadow: 0 10px 30px rgba(180, 83, 9, 0.35); }
.pp-btr-float[hidden] { display: none; }
.pp-btr-float .pp-btr-head { margin-bottom: 6px; }
.pp-btr-float .pp-btr-sub, .pp-btr-float .pp-btr-hint, .pp-btr-float .pp-btr-foot-text { display: none; }
.pp-btr-float .pp-btr-title { font-size: 11px; letter-spacing: 0.06em; color: #64748b; }
.pp-btr-float.pp-btr-special .pp-btr-title { color: #b45309; }
.pp-btr-float .pp-btr-status { min-width: 0; }
.pp-btr-float .pp-btr-grid { grid-template-columns: 1fr; gap: 7px; }
.pp-btr-float .pp-btr-label { font-size: 10.5px; }
.pp-btr-float .pp-btr-field input, .pp-btr-float .pp-btr-field select { padding: 4px 7px; }
.pp-btr-float .pp-btr-more { margin-top: 8px; }
.pp-btr-float .pp-btr-more > summary { font-size: 11.5px; margin-bottom: 6px; }
.pp-btr-float .pp-btr-foot { margin-top: 8px; }
@media print { .pp-btr, .pp-btr-float { display: none !important; } }
`;
function ensureCss() {
    if (typeof document === 'undefined' || document.getElementById('pp-btr-css')) return;
    const st = document.createElement('style');
    st.id = 'pp-btr-css';
    st.textContent = CSS;
    document.head.appendChild(st);
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const badgeText = (rules, opts) => { const m = matchBatchPreset(opts?.presets, rules); return rules ? 'SPECIAL BATCHING' + (m ? ' · ' + m.name : '') : 'TYPICAL BATCHING'; };

/** The Preset row: the picker, and (full panel only) Save as preset / Delete this preset. */
function presetRowHtml(rules, opts = {}) {
    const presets = opts.presets || [];
    const match = matchBatchPreset(presets, rules);
    const o = (v, t, on, extra = '') => `<option value="${esc(v)}"${on ? ' selected' : ''}${extra}>${esc(t)}</option>`;
    const options = o('', 'Typical batching (no preset)', !rules)
        + (rules && !match ? o('__custom', 'Custom: not saved as a preset', true, ' disabled') : '')
        + presets.map(p => o('p:' + p.name, p.name + (p.builtin ? ' (built in)' : ''), match === p)).join('');
    const canEdit = !opts.compact && typeof opts.onSavePreset === 'function';
    const edit = canEdit ? `
        <button type="button" class="pp-btr-reset" data-btr-preset-save${rules && !match ? '' : ' hidden'} title="Keep these settings under a name, to pick on another job">Save as preset…</button>
        <button type="button" class="pp-btr-reset" data-btr-preset-del${match && !match.builtin ? '' : ' hidden'} title="Remove this preset from the list. Jobs that use it keep their settings.">Delete this preset</button>
        <span class="pp-btr-preset-new" hidden>
            <input type="text" maxlength="60" data-btr-preset-name placeholder="Name for this preset">
            <button type="button" class="pp-btr-reset" data-btr-preset-ok>Save</button>
            <button type="button" class="pp-btr-reset" data-btr-preset-cancel>Cancel</button>
            <span class="pp-btr-msg" data-btr-preset-msg hidden></span>
        </span>` : '';
    return `<span class="pp-btr-label">Preset</span>
        <select data-btr-preset${rules ? ' class="pp-btr-set"' : ''} title="A preset fills in every cell below. The job keeps its own copy: changing a preset later does not change this job.">${options}</select>${edit}`;
}
/** After a cell changed: the Preset row and the badge follow, without redrawing the cells. */
function syncPresetRow(el, rules) {
    const row = el.querySelector('.pp-btr-presets');
    if (row) row.innerHTML = presetRowHtml(rules, el.__btrOpts);
    const badge = el.querySelector('.pp-btr-badge');
    if (badge) badge.textContent = badgeText(rules, el.__btrOpts);
}
/** Save as preset: check the name, ask before replacing, hand over to the page. */
function savePresetFromPanel(el) {
    const opts = el.__btrOpts || {}, input = el.querySelector('[data-btr-preset-name]'), msg = el.querySelector('[data-btr-preset-msg]');
    const say = (t) => { if (msg) { msg.textContent = t || ''; msg.hidden = !t; } if (input) input.classList.toggle('pp-btr-bad', !!t); };
    const name = cleanName(input?.value);
    const { rules, errors } = readPanel(el);
    if (errors) return say('Fix the red cell first');
    if (!rules) return say('Nothing special is set, so there is nothing to save');
    if (!name) return say('Give the preset a name');
    const presets = opts.presets || [];
    if (presets.some(p => p.builtin && sameName(p.name, name))) return say('That name belongs to a built-in preset');
    const same = presets.find(p => sameName(p.name, name));
    if (same && !window.confirm(`A preset named "${same.name}" already exists.\n\nReplace it with these settings? Jobs that already use it keep what they have.`)) return;
    say('');
    opts.onSavePreset?.(same ? same.name : name, rules);
}

function panelHtml(rules, { compact = false, open = false, presets = [], onSavePreset = null } = {}) {
    const r = rules || {};
    const set = (on) => (on ? ' class="pp-btr-set"' : '');
    // the hint is also the hover text: the floating copy has no room to print it
    const field = (label, control, hint) => `<label class="pp-btr-field" title="${esc(String(hint).replace(/<[^>]+>/g, ''))}"><span class="pp-btr-label">${label}</span>${control}<span class="pp-btr-msg" hidden></span><span class="pp-btr-hint">${hint}</span></label>`;
    const sel = (key, value, options) => `<select data-btr="${key}"${set(!!value)}>${options.map(([v, t]) => `<option value="${v}"${v === (value || '') ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
    const more = open || !!(r.faceThicknessIn || r.backupLayers || r.pigReduction != null || r.backupAdvaOz != null || r.noCowbay || r.omitAggBackups);
    return `
        <div class="pp-btr-head">
            <span class="pp-btr-title">Job Batching</span>
            <span class="pp-btr-sub">project-wide · batch sizes are pounds of sand · an empty cell = the typical value shown in it</span>
            <span class="pp-btr-badge">${esc(badgeText(rules, { presets }))}</span>
            <span class="pp-btr-status" data-btr-status></span>
        </div>
        <div class="pp-btr-presets">${presetRowHtml(rules, { compact, presets, onSavePreset })}</div>
        <div class="pp-btr-grid">
            ${field('Face Mix batch sizes (lb)', `<input type="text" inputmode="numeric" data-btr="faceSizes" value="${esc(formatSizes(r.faceSizes))}" placeholder="250, 150, 100"${set(!!r.faceSizes)}>`,
                'Typical: <b>250, 150, 100</b>. Largest first. <b>150</b> = every batch 150 lb; <b>150, 100</b> = 150 lb batches and a 100 lb one when that covers what is left.')}
            ${field('Back Up batch sizes (lb)', `<input type="text" inputmode="numeric" data-btr="backupSizes" value="${esc(formatSizes(r.backupSizes))}" placeholder="250, 150, 100"${set(!!r.backupSizes)}>`,
                'Typical: <b>250, 150, 100</b>. First and FINAL Back Up batches.')}
        </div>
        <details class="pp-btr-more"${more ? ' open' : ''}>
            <summary>${compact ? 'More job conditions' : 'More job conditions (face thickness, layers, pigment, ADVA, Cowbay, aggregate)'}</summary>
            <div class="pp-btr-grid">
                ${field('Face Mix thickness (in)', `<input type="text" data-btr="faceThicknessIn" value="${esc(r.faceThicknessIn ? formatInches(r.faceThicknessIn) : '')}" placeholder="3/16"${set(!!r.faceThicknessIn)}>`,
                    'Typical: <b>3/16</b>. How thick the Face Mix is planned over the Face Sq Ft. Fractions or decimals.')}
                ${field('Back-up layers', sel('backupLayers', r.backupLayers, [['', 'First Back Up + FINAL Back Up (typical)'], ['first', 'One layer: First Back Up'], ['final', 'One layer: FINAL Back Up']]),
                    'Typical: a First Back Up as thick as the face, then the FINAL Back Up. One layer = everything behind the face is that one type.')}
                ${field('Back-up pigment reduction (%)', `<input type="number" min="0" max="100" step="1" data-btr="pigReduction" value="${r.pigReduction != null ? esc(r.pigReduction) : ''}" placeholder="per casting (50)"${set(r.pigReduction != null)}>`,
                    'Typical: <b>set on each casting</b> (50 unless changed there). A number here is used on every casting of the job instead, and the casting\u2019s own cell is locked.')}
                ${field('Back-up ADVA (oz per color-log batch)', `<input type="number" min="0" max="100" step="0.05" data-btr="backupAdvaOz" value="${r.backupAdvaOz != null ? esc(r.backupAdvaOz) : ''}" placeholder="the color log's amount"${set(r.backupAdvaOz != null)}>`,
                    'Typical: <b>the color log’s amount</b>. A number here replaces it on every back-up batch. The color log is not changed.')}
                ${field('Sand in the FINAL Back Up', sel('noCowbay', r.noCowbay ? '1' : '', [['', 'Bulk Sand (Cowbay) on spray-up (typical)'], ['1', 'No Cowbay: the color log’s sand']]),
                    'Typical: spray-up FINAL Back Up batches use Bulk Sand (Cowbay).')}
                ${field('Aggregate in back-up mixes', sel('omitAggBackups', r.omitAggBackups ? '1' : '', [['', 'As ticked on each casting (typical)'], ['1', 'Left out of every back-up mix']]),
                    'Typical: aggregate in every mix unless a casting ticks “Omit Aggregate from Final Back Up”.')}
            </div>
        </details>
        <div class="pp-btr-foot">
            <button type="button" class="pp-btr-reset" data-btr-reset${rules ? '' : ' hidden'}>Back to typical batching</button>
            ${compact ? '<button type="button" class="pp-btr-show" data-btr-show>Show me</button>' : ''}
            <span class="pp-btr-foot-text">Applies to every casting of this job: the tickets here, the batch counts on the weekly and the week batch print.</span>
        </div>`;
}

/** Read the panel's cells. { rules, errors: n }; cells that cannot be read are marked and left out. */
function readPanel(el) {
    const raw = {};
    let errors = 0;
    const mark = (input, msg) => {
        const m = input.closest('.pp-btr-field')?.querySelector('.pp-btr-msg');
        input.classList.toggle('pp-btr-bad', !!msg);
        if (m) { m.textContent = msg || ''; m.hidden = !msg; }
        if (msg) errors++;
    };
    for (const input of el.querySelectorAll('[data-btr]')) {
        const key = input.dataset.btr, v = String(input.value ?? '').trim();
        if (key === 'faceSizes' || key === 'backupSizes') {
            const p = parseSizes(v);
            mark(input, p.error);
            if (p.sizes) raw[key] = p.sizes;
        } else if (key === 'faceThicknessIn') {
            const n = parseInches(v);
            mark(input, Number.isNaN(n) ? 'A thickness in inches, for example 1/4 or 0.25' : '');
            if (n && !Number.isNaN(n)) raw[key] = n;
        } else if (key === 'pigReduction' || key === 'backupAdvaOz') {
            const n = v === '' ? null : Number(v);
            const bad = n != null && (!Number.isFinite(n) || n < 0 || n > 100);
            mark(input, bad ? 'A number from 0 to 100' : '');
            if (n != null && !bad) raw[key] = n;
        } else if (key === 'backupLayers') {
            if (v) raw[key] = v;
        } else if (v) raw[key] = true;
    }
    return { rules: normBatchRules(raw), errors };
}

/**
 * Draw the Job Batching panel into `el` and keep it wired.
 * @param {HTMLElement} el
 * @param {Object|null} rules - the job's rules as loaded
 * @param {(rules: Object|null) => void} onChange - a cell changed and every cell reads fine (the caller saves + redraws)
 * @param {{compact?: boolean, presets?: Array, onSavePreset?: Function, onDeletePreset?: Function}} [opts] - compact:
 *        the floating copy (no printed hints, a Show me link); presets: the list for the Preset picker;
 *        onSavePreset(name, rules) / onDeletePreset(name): the page saves and redraws
 */
export function drawBatchRulesPanel(el, rules, onChange, opts = {}) {
    if (!el) return;
    ensureCss();
    el.classList.add('pp-btr');
    el.classList.toggle('pp-btr-special', !!rules);
    const open = !!el.querySelector('.pp-btr-more')?.open;   // a fold someone opened stays open across a redraw
    el.innerHTML = panelHtml(rules, { ...opts, compact: !!opts.compact, open });
    el.__btrOpts = opts;
    el.__btrChange = onChange;
    if (el.dataset.btrWired) return;
    el.dataset.btrWired = '1';
    const changed = () => {
        const { rules: next, errors } = readPanel(el);
        if (errors) { setBatchRulesStatus(el, 'Not saved: check the red cell', true); return; }
        el.classList.toggle('pp-btr-special', !!next);
        syncPresetRow(el, next);
        const reset = el.querySelector('[data-btr-reset]');
        if (reset) reset.hidden = !next;
        for (const input of el.querySelectorAll('[data-btr]')) {
            const k = input.dataset.btr;
            input.classList.toggle('pp-btr-set', !!next && next[k] != null && next[k] !== false);
        }
        el.__btrChange?.(next);
    };
    el.addEventListener('change', (e) => {
        const pick = e.target.closest('[data-btr-preset]');
        if (pick) {
            // a preset: every cell takes its value (a copy; the job does not follow the preset afterwards)
            const v = pick.value;
            const p = v.startsWith('p:') ? (el.__btrOpts?.presets || []).find(x => x.name === v.slice(2)) : null;
            if (v !== '' && !p) return;
            const next = p ? normBatchRules(p.rules) : null;
            drawBatchRulesPanel(el, next, el.__btrChange, el.__btrOpts);
            el.__btrChange?.(next);
            return;
        }
        if (e.target.closest('[data-btr]')) changed();
    });
    el.addEventListener('click', (e) => {
        if (e.target.closest('[data-btr-reset]')) {
            for (const input of el.querySelectorAll('[data-btr]')) input.value = '';
            changed();
            return;
        }
        const box = el.querySelector('.pp-btr-preset-new');
        if (e.target.closest('[data-btr-preset-save]')) { if (box) { box.hidden = false; box.querySelector('input')?.focus(); } return; }
        if (e.target.closest('[data-btr-preset-cancel]')) { if (box) box.hidden = true; return; }
        if (e.target.closest('[data-btr-preset-ok]')) { savePresetFromPanel(el); return; }
        if (e.target.closest('[data-btr-preset-del]')) {
            const m = matchBatchPreset(el.__btrOpts?.presets, readPanel(el).rules);
            if (m && !m.builtin && window.confirm(`Delete the preset "${m.name}"?\n\nIt goes from the list for every job. Jobs that already use it keep their settings.`)) el.__btrOpts?.onDeletePreset?.(m.name);
        }
    });
    el.addEventListener('keydown', (e) => {
        if (!e.target.closest('[data-btr-preset-name]')) return;
        if (e.key === 'Enter') { e.preventDefault(); savePresetFromPanel(el); }
        else if (e.key === 'Escape') { const box = el.querySelector('.pp-btr-preset-new'); if (box) box.hidden = true; }
    });
}
export function setBatchRulesStatus(el, text, isError = false) {
    const s = el?.querySelector('[data-btr-status]');
    if (!s) return;
    s.textContent = text || '';
    s.classList.toggle('pp-btr-err', !!isError);
}

let floatEl = null;
/**
 * The floating copy of the Job Batching panel (2026-11-25, user: "make this whole section a floating bubble when
 * scrolling, just like the other bubbles, under the ones that are already there"). Same cells, same saving: the page
 * shows it while the real panel is scrolled out of sight.
 * @param {{show: boolean, rules?: Object|null, presets?: Array, top?: number, onChange?: Function, onShow?: Function}} o
 * @returns {boolean} whether the box is showing
 */
export function updateBatchRulesFloat({ show, rules = null, presets = [], top = 0, onChange, onShow } = {}) {
    if (!show) { if (floatEl) floatEl.hidden = true; return false; }
    ensureCss();
    if (!floatEl) {
        floatEl = document.createElement('div');
        floatEl.id = 'pp-btr-float';
        floatEl.className = 'pp-btr-float';
        document.body.appendChild(floatEl);
        floatEl.addEventListener('click', (e) => { if (e.target.closest('[data-btr-show]')) floatEl.__show?.(); });
    }
    floatEl.__show = onShow;
    const key = JSON.stringify(rules || null) + '|' + presets.map(p => p.name + rulesSignature(p.rules)).join(';');
    // never redraw under someone's hands: a cell in it has the cursor, or the mouse is on it (a click about to land)
    const busy = !floatEl.hidden && floatEl.dataset.key !== undefined && (floatEl.contains(document.activeElement) || floatEl.matches(':hover'));
    if (floatEl.dataset.key !== key && !busy) {
        drawBatchRulesPanel(floatEl, rules, onChange, { compact: true, presets });
        floatEl.dataset.key = key;
    } else { floatEl.__btrChange = onChange; floatEl.__btrOpts = { compact: true, presets }; }
    floatEl.style.top = Math.round(top) + 'px';
    floatEl.style.maxHeight = `calc(100vh - ${Math.round(top) + 12}px)`;
    floatEl.hidden = false;
    return true;
}
