/**
 * Batch ticket rendering — the pure pieces of the Project Portal's Batch Tickets tab, moved here (2026-10-30) so the
 * weekly's "Print batch tickets for the week" prints the very same tickets and sums the very same materials.
 * Nothing here touches the DOM or the database: give it the casting, its tickets, the project's colour logs and the
 * casting's components, get HTML back.
 *
 * @module services/batch-ticket-render
 */
import { escapeHtml } from '../utils/security-utils.js';
import { roundSig, FROM_LBS, buildBatchPlan, getColorLogSandLbs } from '../utils/batch-calc.js';

export const SLUMP_TARGET_DEFAULTS = { face: 6, firstBackUp: 5, finalBackUp: 5 }; // starting slump targets (in), by batch type

export const FINAL_BACKUP_PIG_REDUCTION_PCT = 50;

export function parsePigReduction(raw) {
    const n = parseFloat(raw);
    if (isNaN(n)) return FINAL_BACKUP_PIG_REDUCTION_PCT;
    return Math.min(100, Math.max(0, n));
}

export const BT_IMPORT_META = 'last-import';

export function btOverrides(t) { return (Array.isArray(t?.batchAssignments) ? t.batchAssignments : []).filter(a => a && a.type); }

export function btImportStamp(t) { return (Array.isArray(t?.batchAssignments) ? t.batchAssignments : []).find(a => a && a.meta === BT_IMPORT_META) || null; }

export function btStampDate(d) {
    const x = new Date(d);
    if (isNaN(x)) return '';
    return x.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + x.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function additiveAmount(item) {
    for (const v of [item?.amount, item?.weight]) {
        if (v !== '' && v != null && !isNaN(Number(v))) return Number(v);
    }
    return null;
}

export function clampSlumpTarget(v, fallback = 5) {
    const n = Number(v);
    if (!isFinite(n) || n <= 0) return fallback;
    return Math.min(10, n);
}

export function formatSlumpLabel(v) {
    const n = clampSlumpTarget(v);
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

export function renderSlumpGraphic(targetIn = 5) {
    const cx = 100, cy = 100, step = 9; // radius px per 1" of diameter (10" → r 90 in a 200 viewBox)
    // Translucent disc fills the target diameter so the goal zone reads at a glance,
    // drawn first so the inner ring lines stay visible on top of it.
    const targetDisc = `<circle cx="${cx}" cy="${cy}" r="${targetIn * step}" fill="#ea580c" fill-opacity="0.12"/>`;
    let rings = '';
    let labels = '';
    for (let d = 1; d <= 10; d++) {
        const r = d * step;
        const target = d === targetIn;
        rings += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${target ? '#ea580c' : '#cbd5e1'}" stroke-width="${target ? 3 : 1}"/>`;
        // White mask + number at the top of each ring so the diameter scale reads cleanly.
        // Mask kept tight so an inner label never clips the digit on the next ring out.
        const ly = cy - r;
        labels += `<rect x="${cx - 6}" y="${ly - 5}" width="12" height="9" fill="#fff"/>`
            + `<text x="${cx}" y="${ly + 3}" text-anchor="middle" font-size="9.5" font-weight="${target ? 800 : 600}" fill="${target ? '#ea580c' : '#475569'}">${d}</text>`;
    }
    const cross = `<line x1="${cx - 6}" y1="${cy}" x2="${cx + 6}" y2="${cy}" stroke="#94a3b8" stroke-width="1.5"/>`
        + `<line x1="${cx}" y1="${cy - 6}" x2="${cx}" y2="${cy + 6}" stroke="#94a3b8" stroke-width="1.5"/>`;
    return `<svg class="bt-slump-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Slump target ${targetIn} inch spread">${targetDisc}${rings}${cross}${labels}</svg>`;
}

export function renderBatchTicketCard({
    colorLog, batch, project, sampleName, castMethod, castNumber, castDate,
    colorName = '', batchedBy, notes, pigReductionPct = FINAL_BACKUP_PIG_REDUCTION_PCT, reduceFirstBackup = false,
    omitAggFinalBackup = false, omitFibersFace = false, cowbayFinalBackup = false,
    targetSlump = 5,
    printedOn = null, batchedOn = null   // print only: PRINTED ON (red) + BATCHED ON (green, last Import from Tracking)
}) {
    const slumpTarget = clampSlumpTarget(targetSlump);
    const { batchSandLbs, scaleFactor, num, total, type: batchType } = batch;
    const applyPigReduction = batchType === 'finalBackUp' || (batchType === 'firstBackUp' && reduceFirstBackup);
    const pigMultiplier = applyPigReduction ? (1 - pigReductionPct / 100) : 1;
    const cb = (checked) => `<span class="bt-cb-box ${checked ? 'checked' : ''}"></span>`;

    const findBase = (name) => (colorLog?.baseIngredients || []).find(i => (i.name || '').toLowerCase() === name.toLowerCase());
    // Additives in the color log usually carry the full product name ("ADVA Flex",
    // "Forton VF-774", "Eclipse 4500"), so an exact match against the slot key would
    // miss them and leave the ticket showing a stale "-". Match exact first, then fall
    // back to a contains match on the key — same tolerance as the fiber lookup below.
    const findAdd  = (name) => {
        const list = colorLog?.additives || [];
        const key = name.toLowerCase();
        return list.find(i => (i.name || '').toLowerCase() === key)
            || list.find(i => (i.name || '').toLowerCase().includes(key));
    };

    const scaleBase = (name) => {
        const f = findBase(name);
        if (!f || !f.weight) return { qty: '-', unit: f?.unit || 'lbs', type: f?.note || '' };
        return { qty: roundSig(Number(f.weight) * scaleFactor, 2), unit: f.unit || 'lbs', type: f.note || '' };
    };
    const scaleAdd = (name) => {
        const f = findAdd(name);
        const amt = additiveAmount(f);
        if (!f || amt == null) {
            return { qty: '-', unit: f?.unit || 'oz', type: f?.note || '' };
        }
        return { qty: roundSig(amt * scaleFactor, 2), unit: f.unit || 'oz', type: f.note || '' };
    };

    const portland = scaleBase('Portland');
    const sand     = scaleBase('Sand');
    const pozzo    = scaleBase('Pozzotive');

    // Aggregate is omitted from the FINAL Back Up when the ticket opts out
    // (e.g. Direct Cast jobs that only want aggregate in the Face Mix).
    const omitAggHere = omitAggFinalBackup && batchType === 'finalBackUp';
    let aggRows = '';
    const aggs = omitAggHere ? [] : (colorLog?.aggregates || []).filter(a => a && a.name);
    if (aggs.length) {
        aggRows = aggs.map(agg => {
            const qty = agg.amount ? roundSig(Number(agg.amount) * scaleFactor, 2) : '-';
            const unit = agg.unit || 'lbs';
            return `<tr><td class="bt-label">Aggregate:</td><td class="bt-type">TYPE: ${escapeHtml(agg.name)}</td><td class="bt-qty-label">QTY:</td><td class="bt-qty">${qty}</td><td class="bt-unit">${escapeHtml(unit)}</td></tr>`;
        }).join('');
    } else {
        aggRows = `<tr><td class="bt-label">Aggregate:</td><td class="bt-type">TYPE:</td><td class="bt-qty-label">QTY:</td><td class="bt-qty">-</td><td class="bt-unit">lbs</td></tr>`;
    }

    // Tolerant lookup so "Fiber" / "Fibers" / "fibre" all match.
    const fiberSrc = (colorLog?.additives || []).find(i => /fiber|fibre/i.test(i?.name || ''));
    const fiberAmt = additiveAmount(fiberSrc);
    let fibers;
    if (fiberSrc && fiberAmt != null) {
        fibers = { qty: roundSig(fiberAmt * scaleFactor, 2), unit: fiberSrc.unit || 'oz', type: fiberSrc.note || '' };
    } else {
        fibers = { qty: '-', unit: fiberSrc?.unit || 'oz', type: fiberSrc?.note || '' };
    }
    // Cemfill override:
    //   - Spray Up: First Back Up & FINAL Back Up
    //   - Direct Cast: ALL batches (Face Mix + FINAL Back Up)
    const overrideToCemfill = (batchType === 'firstBackUp' || batchType === 'finalBackUp')
        || (castMethod === 'directCast' && batchType === 'face');
    if (overrideToCemfill) {
        fibers = { qty: roundSig(18 * (batchSandLbs / 250), 2), unit: 'lbs', type: 'Cemfill' };
    }
    // Omit fibers from the Face Mix entirely when the ticket opts out
    // (e.g. Direct Cast jobs that don't want fibers in the face coat).
    if (omitFibersFace && batchType === 'face') {
        fibers = { qty: '-', unit: 'lbs', type: '' };
    }

    // ADDITIVES — fully dynamic. The color log stores Water + Forton as base
    // ingredients and ADVA / Eclipse / Fibers (+ any custom) as additives, but the
    // ticket lists every wet admixture here. Lead with Water, then every additive in
    // its color-log order (fibers excluded — they print under DRY BATCH), then
    // Forton. De-duped by name so a material entered in either list appears once,
    // and rows with no value are skipped (matching the Mix Day Totals panel).
    const admixtures = [];
    const seenAdmix = new Set();
    const addAdmix = (name, note, scaled) => {
        const key = (name || '').trim().toLowerCase();
        if (!key || seenAdmix.has(key) || scaled.qty === '-') return;
        seenAdmix.add(key);
        const label = name + (note ? ' (' + note + ')' : '');
        admixtures.push({ label, qty: scaled.qty, unit: scaled.unit });
    };

    // 1. Water — base preferred, additive fallback.
    const waterBase = scaleBase('Water');
    const waterSrc = findBase('Water') || findAdd('Water');
    addAdmix(waterSrc?.name || 'Water', waterSrc?.note, waterBase.qty !== '-' ? waterBase : scaleAdd('Water'));

    // 2. Every additive in order, scaled (skip fibers — shown under DRY BATCH).
    for (const add of (colorLog?.additives || [])) {
        if (!add || !add.name || /fiber|fibre/i.test(add.name)) continue;
        const amt = additiveAmount(add);
        if (amt == null) continue;
        addAdmix(add.name, add.note, { qty: roundSig(amt * scaleFactor, 2), unit: add.unit || 'oz' });
    }

    // 3. Forton — base preferred, additive fallback (deduped if already listed).
    const fortonBase = scaleBase('Forton');
    const fortonSrc = findBase('Forton') || findAdd('Forton');
    addAdmix(fortonSrc?.name || 'Forton', fortonSrc?.note, fortonBase.qty !== '-' ? fortonBase : scaleAdd('Forton'));

    const additiveRowsHtml = admixtures.length
        ? admixtures.map((a, i) =>
            `<tr><td class="bt-label">Additive #${i + 1}:</td><td class="bt-type">TYPE: ${escapeHtml(a.label)}</td><td class="bt-qty-label">QTY:</td><td class="bt-qty">${a.qty}</td><td class="bt-unit">${escapeHtml(a.unit)}</td></tr>`
          ).join('')
        : `<tr><td class="bt-label">Additive #1:</td><td class="bt-type">TYPE:</td><td class="bt-qty-label">QTY:</td><td class="bt-qty"></td><td class="bt-unit"></td></tr>`;

    // Pigments (4 slots)
    const reducedLabel = (applyPigReduction && pigReductionPct > 0) ? ` (${pigReductionPct}% reduced)` : '';
    let pigRows = '';
    for (let i = 0; i < 4; i++) {
        const p = (colorLog?.pigments || [])[i];
        if (p && p.pct !== '' && p.pct != null && p.pct !== undefined) {
            const effectivePct = Number(p.pct) * pigMultiplier;
            const weightLbs = batchSandLbs * effectivePct / 100;
            const unit = p.unit || 'lbs';
            const converted = roundSig(weightLbs * (FROM_LBS[unit] || 1), 2);
            const pctDisplay = pigMultiplier < 1 ? `${roundSig(effectivePct, 4)}%` : `${p.pct}%`;
            pigRows += `<tr><td class="bt-label">Pigment #${i+1}:</td><td class="bt-type">COLOR: ${escapeHtml(p.name || '')} ${pctDisplay}${reducedLabel}</td><td class="bt-qty-label">QTY:</td><td class="bt-qty">${converted}</td><td class="bt-unit">${escapeHtml(unit)}</td></tr>`;
        } else {
            pigRows += `<tr><td class="bt-label">Pigment #${i+1}:</td><td class="bt-type">COLOR:</td><td class="bt-qty-label">QTY:</td><td class="bt-qty"></td><td class="bt-unit"></td></tr>`;
        }
    }

    const bannerLabel = batchType === 'face' ? 'Face Mix'
        : batchType === 'firstBackUp' ? 'First Back Up'
        : batchType === 'finalBackUp' ? 'FINAL Back Up'
        : '';

    const isDirectCast = castMethod === 'directCast';
    // Sand type by batch:
    //   - Face Mix & First Back Up → the color-log sand (e.g. Qrok)
    //   - FINAL Back Up → Bulk Sand (Cowbay) for Spray Up, or when a Direct
    //     Cast ticket opts in via "Switch to Cowbay for Final Back Up".
    const useCowbayFinal = (!isDirectCast || cowbayFinalBackup) && batchType === 'finalBackUp';
    const sandTypeDisplay = useCowbayFinal
        ? 'Bulk Sand (Cowbay)'
        : escapeHtml(sand.type || '');

    return `
    <div class="batch-ticket bt-${batchType}">
        <div class="bt-title-row">
            <div class="bt-title">BATCHING TICKET</div>
            ${printedOn ? `<div class="bt-stamps">
                <div class="bt-stamp-printed">PRINTED ON ${escapeHtml(btStampDate(printedOn))}</div>
                <div class="bt-stamp-batched">${batchedOn ? 'BATCHED ON ' + escapeHtml(btStampDate(batchedOn)) : 'BATCHED ON: NOT IMPORTED FROM TRACKING'}</div>
            </div>` : ''}
        </div>
        <div class="bt-type-banner">${bannerLabel}</div>

        <div class="bt-header-grid">
            <div class="bt-hrow"><span class="bt-hlabel">PROJECT:</span><span class="bt-hval">${escapeHtml(project || '')}</span></div>
            <div class="bt-hrow"><span class="bt-hlabel">Batched by:</span><span class="bt-hval">${escapeHtml(batchedBy || '')}</span></div>
            <div class="bt-hrow"><span class="bt-hlabel">Sample #:</span><span class="bt-hval">${escapeHtml(sampleName || '')}</span></div>
            ${colorName ? `<div class="bt-hrow"><span class="bt-hlabel">Color:</span><span class="bt-hval">${escapeHtml(colorName)}</span></div>` : ''}
            <div class="bt-hrow"><span class="bt-hlabel">Cast #:</span><span class="bt-hval">${escapeHtml(castNumber || '')}</span></div>
            <div class="bt-hrow"><span class="bt-hlabel">Cast Date:</span><span class="bt-hval">${escapeHtml(castDate || '')}</span></div>
            <div class="bt-hrow"><span class="bt-hlabel">Batch:</span><span class="bt-hval">${num} of ${total}</span></div>
        </div>

        <div class="bt-mix-box">
            <div class="bt-mix-label">MIX DESIGN</div>
            <div class="bt-cb-row">
                <span class="bt-cb">${cb(castMethod === 'sprayUp')} GFRC Spray</span>
                <span class="bt-cb">${cb(castMethod === 'directCast')} GFRC Direct</span>
                <span class="bt-cb">${cb(false)} Regular Concrete</span>
                <span class="bt-cb">${cb(castMethod === 'other')} Other</span>
            </div>
        </div>
        <div class="bt-cb-row">
            <span class="bt-cb"><strong>Face Mix:</strong> ${cb(batchType === 'face')}</span>
            <span class="bt-cb"><strong>First Back Up:</strong> ${cb(batchType === 'firstBackUp')}</span>
            <span class="bt-cb"><strong>FINAL Back Up:</strong> ${cb(batchType === 'finalBackUp')}</span>
        </div>

        <div class="bt-section-label">DRY BATCH</div>
        <table class="bt-table">
            <tr><td class="bt-label">Portland:</td><td class="bt-type">TYPE: ${escapeHtml(portland.type || 'Portland')}</td><td class="bt-qty-label">QTY:</td><td class="bt-qty">${portland.qty}</td><td class="bt-unit">${escapeHtml(portland.unit)}</td></tr>
            <tr><td class="bt-label">Sand:</td><td class="bt-type">TYPE: ${sandTypeDisplay}</td><td class="bt-qty-label">QTY:</td><td class="bt-qty">${sand.qty}</td><td class="bt-unit">${escapeHtml(sand.unit)}</td></tr>
            <tr><td class="bt-label">Portland Reducer:</td><td class="bt-type">TYPE: ${escapeHtml(pozzo.type || 'Pozzotive')}</td><td class="bt-qty-label">QTY:</td><td class="bt-qty">${pozzo.qty}</td><td class="bt-unit">${escapeHtml(pozzo.unit)}</td></tr>
            ${aggRows}
            <tr><td class="bt-label">Fibers:</td><td class="bt-type">TYPE: ${escapeHtml(fibers.type || '')}</td><td class="bt-qty-label">QTY:</td><td class="bt-qty">${fibers.qty}</td><td class="bt-unit">${escapeHtml(fibers.unit)}</td></tr>
        </table>

        <div class="bt-section-label">PIGMENTS</div>
        <table class="bt-table">${pigRows}</table>

        <div class="bt-section-label">ADDITIVES</div>
        <table class="bt-table">${additiveRowsHtml}</table>

        <div class="bt-footer">
            <div class="bt-footer-col bt-footer-left">
                <div class="bt-section-label">MIX CONDITIONS</div>
                <div class="bt-cond-row"><span class="bt-cond-label">AIR Temp</span><span class="bt-cond-line"></span><span class="bt-cond-unit">&deg;F</span></div>
                <div class="bt-cond-row"><span class="bt-cond-label">WATER Temp</span><span class="bt-cond-line"></span><span class="bt-cond-unit">&deg;F</span></div>
                <div class="bt-cond-row"><span class="bt-cond-label">ICE / WATER</span><span class="bt-cond-line bt-cond-line-sm"></span><span class="bt-cond-unit">LB</span><span class="bt-cond-slash">/</span><span class="bt-cond-line bt-cond-line-sm"></span><span class="bt-cond-unit">LB</span></div>
            </div>
            <div class="bt-footer-col bt-footer-right">
                <div class="bt-section-label">SLUMP TEST</div>
                <div class="bt-slump-wrap">
                    ${renderSlumpGraphic(slumpTarget)}
                    <div class="bt-slump-side">
                        <div class="bt-slump-readout">
                            <div class="bt-readout">
                                <span class="bt-readout-label">Target</span>
                                <span class="bt-readout-val">${formatSlumpLabel(slumpTarget)}&Prime;</span>
                            </div>
                            <div class="bt-readout">
                                <span class="bt-readout-label">Actual</span>
                                <span class="bt-readout-val bt-readout-actual"><span class="bt-readout-blank"></span>&Prime;</span>
                            </div>
                        </div>
                        <div class="bt-passfail">
                            <span class="bt-pf"><span class="bt-pf-text">PASS</span>${cb(false)}</span>
                            <span class="bt-pf"><span class="bt-pf-text">FAIL</span>${cb(false)}</span>
                        </div>
                        <div class="bt-slump-fields">
                            <div class="bt-slump-field"><span class="bt-slump-field-label">Time</span><span class="bt-time-input"><span class="bt-time-blank"></span><span class="bt-time-colon">:</span><span class="bt-time-blank"></span></span></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        ${notes ? '<div class="bt-notes-title">NOTES:</div><div class="bt-notes">' + escapeHtml(notes) + '</div>' : ''}
    </div>`;
}

export function batchTotalsRows(entries) {
    entries = (entries || []).filter(e => e?.plan?.batches?.length && e.log);
    if (!entries.length) return [];

    const totals = {};
    const orderKeys = [];
    const addTotal = (key, name, qty, unit, category) => {
        if (qty === '-' || qty === '' || qty == null || isNaN(qty)) return;
        const k = key + '__' + unit;
        if (!totals[k]) {
            totals[k] = { name, total: 0, unit, category };
            orderKeys.push(k);
        }
        totals[k].total += parseFloat(qty);
    };

    // Accumulate every color ticket's plan into one shared totals map — same-name
    // materials (Portland, Sand, Water…) merge across colors, color-specific
    // pigments/additives get their own rows.
    for (const { plan, log, pigReductionPct = FINAL_BACKUP_PIG_REDUCTION_PCT, reduceFirstBackup = false, omitAggFinalBackup = false, omitFibersFace = false, cowbayFinalBackup = false } of entries) {
        const isDirectCast = log?.castMethod === 'directCast';
        // FINAL Back Up sand goes to Bulk Sand (Cowbay) for Spray Up, or when a
        // Direct Cast ticket opts in via "Switch to Cowbay for Final Back Up".
        const finalUsesCowbay = !isDirectCast || cowbayFinalBackup;

        // Pre-seed base ingredient ordering, inserting bulk sand right after sand.
        const hasBulkSand = finalUsesCowbay && plan.batches.some(b => b.type === 'finalBackUp');
        for (const ing of (log?.baseIngredients || [])) {
            if (!ing?.name) continue;
            const unit = ing.unit || 'lbs';
            const k = ing.name + '__' + unit;
            if (!totals[k]) {
                totals[k] = { name: ing.name + (ing.note ? ' (' + ing.note + ')' : ''), total: 0, unit, category: 'dry' };
                orderKeys.push(k);
            }
            if ((ing.name || '').trim().toLowerCase() === 'sand' && hasBulkSand) {
                const bk = 'Sand_bulk__' + unit;
                if (!totals[bk]) {
                    totals[bk] = { name: 'Sand - Bulk (Cowbay)', total: 0, unit, category: 'dry' };
                    orderKeys.push(bk);
                }
            }
        }

        plan.batches.forEach(b => {
            const { batchSandLbs, scaleFactor, type: batchType } = b;
            const applyPigReduction = batchType === 'finalBackUp' || (batchType === 'firstBackUp' && reduceFirstBackup);
            const pigMultiplier = applyPigReduction ? (1 - pigReductionPct / 100) : 1;
            const isBackup = batchType === 'firstBackUp' || batchType === 'finalBackUp';

            // Base ingredients — split sand into Bulk Sand for the FINAL Back Up
            // (Spray Up, or Direct Cast opting in). Other batches keep color-log sand.
            for (const ing of (log?.baseIngredients || [])) {
                if (!ing?.weight || !ing?.name) continue;
                const w = Number(ing.weight) * scaleFactor;
                if ((ing.name || '').trim().toLowerCase() === 'sand' && finalUsesCowbay && batchType === 'finalBackUp') {
                    addTotal('Sand_bulk', 'Sand - Bulk (Cowbay)', roundSig(w, 4), ing.unit || 'lbs', 'dry');
                } else {
                    addTotal(ing.name, ing.name + (ing.note ? ' (' + ing.note + ')' : ''), roundSig(w, 4), ing.unit || 'lbs', 'dry');
                }
            }

            // Aggregates — printed under DRY BATCH on every ticket card, so total them
            // the same way. Skipped for the FINAL Back Up when the ticket opts out.
            const omitAggHere = omitAggFinalBackup && batchType === 'finalBackUp';
            if (!omitAggHere) {
                for (const agg of (log?.aggregates || [])) {
                    if (!agg?.name || !agg.amount) continue;
                    addTotal('agg_' + agg.name, agg.name, roundSig(Number(agg.amount) * scaleFactor, 4), agg.unit || 'lbs', 'dry');
                }
            }

            // Fibers override:
            //   - Spray Up backup batches → Cemfill 18 lbs/250 lbs sand
            //   - Direct Cast (all batches) → Cemfill 18 lbs/250 lbs sand
            // Skipped entirely for the Face Mix when the ticket opts out of fibers.
            const omitFibersHere = omitFibersFace && batchType === 'face';
            const cemfillOverride = isBackup || (isDirectCast && batchType === 'face');
            if (omitFibersHere) {
                // no fibers on this batch
            } else if (cemfillOverride) {
                const fibersLbs = 18 * (batchSandLbs / 250);
                addTotal('Fibers_override', 'Fibers - Cemfill', roundSig(fibersLbs, 4), 'lbs', 'dry');
            } else {
                const fib = (log?.additives || []).find(a => /fiber|fibre/i.test(a?.name || ''));
                const fibAmt = additiveAmount(fib);
                if (fib && fibAmt != null) {
                    addTotal('Fibers', 'Fibers' + (fib.note ? ' (' + fib.note + ')' : ''), roundSig(fibAmt * scaleFactor, 4), fib.unit || 'g', 'additive');
                }
            }

            // Pigments
            (log?.pigments || []).forEach(pig => {
                if (!pig || pig.pct === '' || pig.pct == null) return;
                const effectivePct = Number(pig.pct) * pigMultiplier;
                const weightLbs = batchSandLbs * effectivePct / 100;
                const unit = pig.unit || 'lbs';
                const converted = weightLbs * (FROM_LBS[unit] || 1);
                const label = (pig.name || '') + ' (' + roundSig(effectivePct, 2) + '%)';
                addTotal('pig_' + (pig.name || '_'), label, roundSig(converted, 4), unit, 'pigment');
            });

            // Additives (skip fibers — handled above)
            for (const add of (log?.additives || [])) {
                if (!add?.name) continue;
                if (/fiber|fibre/i.test(add.name)) continue;
                const amt = additiveAmount(add);
                if (amt == null) continue;
                const a = amt * scaleFactor;
                addTotal(add.name, add.name + (add.note ? ' (' + add.note + ')' : ''), roundSig(a, 4), add.unit || 'oz', 'additive');
            }
        });
    }
    return orderKeys.map(k => totals[k]);
}

export function renderBatchTotals(entries, casting = null, { scrimHtml = '' } = {}) {
    entries = (entries || []).filter(e => e?.plan?.batches?.length && e.log);
    if (!entries.length) return '';
    const all = batchTotalsRows(entries);
    const categories = [
        { key: 'dry', label: 'Dry Batch' },
        { key: 'pigment', label: 'Pigments' },
        { key: 'additive', label: 'Additives' },
    ];

    let rows = '';
    for (const cat of categories) {
        const items = all.filter(t => t && t.category === cat.key && t.total > 0);
        if (items.length === 0) continue;
        rows += `<tr class="pp-bt-totals-cat-row"><td colspan="3">${escapeHtml(cat.label)}</td></tr>`;
        for (const item of items) {
            rows += `<tr><td>${escapeHtml(item.name)}</td><td class="pp-bt-totals-num">${roundSig(item.total, 2)}</td><td>${escapeHtml(item.unit)}</td></tr>`;
        }
    }

    if (!rows) return '';

    const title = entries.length > 1 ? 'Mix Day Totals — All Colors & Batches' : 'Mix Day Totals — All Batches';
    // Color Log finishing / sealing notes under the totals (2026-10-26): one pair per colour log on the casting,
    // so the mix-day sheet carries what the finishing and sealing crews need to know.
    const logs = [];
    for (const e of entries) if (e.log && !logs.some(l => l.id === e.log.id)) logs.push(e.log);
    const noteBlock = (label, text) => `<div class="pp-bt-totals-note"><div class="pp-bt-totals-note-title">${escapeHtml(label)}</div><div class="pp-bt-totals-note-body${text ? '' : ' pp-bt-totals-note-empty'}">${text ? escapeHtml(text) : 'none on the color log'}</div></div>`;
    const notesHtml = logs.map(log => {
        const suffix = logs.length > 1 && log.name ? ` — ${log.name}` : '';
        return `<div class="pp-bt-totals-notes">${noteBlock('Color Log finishing notes' + suffix, String(log.finishingNotes || '').trim())}${noteBlock('Color Log sealing notes' + suffix, String(log.sealingNotes || '').trim())}</div>`;
    }).join('');
    return `
        <div class="pp-bt-totals-panel">
            <div class="pp-bt-totals-title">${title}</div>
            <table class="pp-bt-totals-table">
                <thead><tr><th>Material</th><th class="pp-bt-totals-num">Total Qty</th><th>Unit</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            ${notesHtml}
            ${scrimHtml}
        </div>
    `;
}

export const BATCH_PRINT_CSS = `
/* Letter portrait: printable area with our 0.3in × 0.4in @page margin = 7.7in × 10.4in (~554pt × 748pt).
   Goal: each ticket fits on a single page. Sizes are tuned so total content height + padding + border
   stays under 748pt, leaving the notes block to soak up the rest. */
@page { size: letter portrait; margin: 0.3in 0.4in; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; color:#000; font-size:11pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
/* Fixed pt min-height (NOT vh) so each ticket fills the printable area exactly without
   the cross-page rendering bugs that vh+flex caused. Letter portrait minus 0.3in
   margins = ~748pt printable; we use 745pt for a touch of safety against rounding.
   min-height (not height) so an unusually tall ticket grows the colored border with
   its content instead of letting the footer paint over the bottom border. */
.bt-page {
    page-break-after: always;
    page-break-inside: avoid;
    break-after: page;
    break-inside: avoid;
    padding: 12pt 14pt;
    border: 6pt solid #ccc;
    min-height: 745pt;
    display: flex;
    flex-direction: column;
}
.bt-page:last-child { page-break-after: auto; break-after: auto; }
.bt-page.bt-face { border-color: #f97316; }
.bt-page.bt-firstBackUp { border-color: #3b82f6; }
.bt-page.bt-finalBackUp { border-color: #eab308; }
.batch-ticket {
    border: none !important;
    padding: 0 !important;
    box-shadow: none !important;
    max-width: none !important;
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
}
.bt-title { font-size: 18pt; font-weight: 900; color: #000; margin-bottom: 2pt; letter-spacing: 0.5pt; }
.bt-title-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12pt; }
.bt-stamps { text-align: right; flex: 0 0 auto; }
.bt-stamp-printed { font-size: 18pt; font-weight: 900; color: #dc2626; letter-spacing: 0.5pt; line-height: 1.1; }
.bt-stamp-batched { font-size: 13pt; font-weight: 800; color: #15803d; letter-spacing: 0.5pt; }
.bt-type-banner { font-size: 11pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5pt; margin-bottom: 6pt; }
.batch-ticket.bt-face .bt-type-banner { color: #f97316; }
.batch-ticket.bt-firstBackUp .bt-type-banner { color: #3b82f6; }
.batch-ticket.bt-finalBackUp .bt-type-banner { color: #ca8a04; }
.bt-header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin-bottom: 4pt; }
.bt-hrow { display: flex; align-items: baseline; padding: 2pt 0; border-bottom: 0.75pt solid #000; }
.bt-hrow:nth-child(odd) { padding-right: 12pt; }
.bt-hrow:nth-child(even) { padding-left: 12pt; }
.bt-hlabel { font-size: 9.5pt; font-weight: 700; min-width: 78pt; margin-right: 6pt; }
.bt-hval { flex: 1; font-size: 10.5pt; font-style: italic; min-height: 12pt; }
.bt-mix-box { border: 1.5pt solid #000; padding: 6pt 10pt; margin: 4pt 0; background: #fff; color: #000; }
.batch-ticket.bt-face .bt-mix-box { background: #f97316; border-color: #f97316; color: #fff; }
.batch-ticket.bt-firstBackUp .bt-mix-box { background: #3b82f6; border-color: #3b82f6; color: #fff; }
.batch-ticket.bt-finalBackUp .bt-mix-box { background: #eab308; border-color: #eab308; }
.bt-mix-label { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8pt; margin-bottom: 3pt; }
.bt-cb-row { display: flex; justify-content: space-between; align-items: center; padding: 2pt 0; gap: 8pt; flex-wrap: wrap; }
.bt-cb { display: flex; align-items: center; gap: 5pt; font-size: 10pt; }
.bt-cb-box { width: 14pt; height: 14pt; border: 1.5pt solid #000; display: inline-flex; align-items: center; justify-content: center; font-size: 11pt; font-weight: 900; background: #fff; color: #000; }
.bt-cb-box.checked::after { content: '\\2713'; }
.bt-section-label { font-weight: 700; font-size: 9.5pt; text-transform: uppercase; letter-spacing: 0.8pt; padding: 3pt 0 1.5pt; border-bottom: 1pt solid #000; margin-top: 2pt; }
.bt-table { width: 100%; border-collapse: collapse; margin-bottom: 2pt; }
.bt-table td { font-size: 10pt; padding: 2pt 4pt; border-bottom: 0.5pt solid #d4d4d4; vertical-align: baseline; }
.bt-table .bt-label { font-weight: 700; width: 22%; white-space: nowrap; }
.bt-table .bt-type { width: 40%; }
.bt-table .bt-qty-label { font-weight: 700; width: 8%; text-align: right; }
.bt-table .bt-qty { width: 18%; text-align: right; font-style: italic; }
.bt-table .bt-unit { width: 12%; padding-left: 4pt; }
.bt-notes-title { font-size: 9.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5pt; margin-top: 6pt; margin-bottom: 2pt; }
.bt-notes { border: 1pt solid #000; padding: 6pt 8pt; flex: 0 0 auto; min-height: 28pt; font-size: 10pt; line-height: 1.4; white-space: pre-wrap; }
/* Footer: handwrite mix conditions (left) + slump test (right). flex: 1 lets it
   absorb leftover vertical space so each ticket still fills its fixed-height page. */
.bt-footer { display: grid; grid-template-columns: 1fr auto; gap: 10pt; margin-top: 8pt; padding-right: 10pt; align-items: start; flex: 1 1 auto; }
.bt-cond-row { display: flex; align-items: baseline; gap: 8pt; padding: 12pt 0 5pt; }
.bt-cond-label { font-size: 10pt; font-weight: 700; white-space: nowrap; min-width: 66pt; }
.bt-cond-line { flex: 0 0 100pt; border-bottom: 1pt solid #000; height: 14pt; }
.bt-cond-line-sm { flex: 0 0 34pt; }
.bt-cond-unit { font-size: 9pt; font-weight: 700; }
.bt-cond-slash { font-size: 11pt; font-weight: 700; }
.bt-footer-right { text-align: center; }
.bt-slump-wrap { display: flex; align-items: center; justify-content: center; gap: 10pt; }
.bt-slump-svg { width: 1.7in; height: 1.7in; display: block; flex: 0 0 auto; }
.bt-slump-side { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 12pt; }
.bt-slump-readout { display: flex; gap: 18pt; align-items: flex-start; }
.bt-readout { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.05; }
.bt-readout-label { font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1pt; }
.bt-readout-val { font-size: 34pt; font-weight: 800; color: #ea580c; line-height: 1; display: flex; align-items: flex-end; gap: 3pt; }
.bt-readout-actual { color: #000; font-weight: 700; }
.bt-readout-blank { width: 44pt; height: 30pt; border-bottom: 1.5pt solid #000; }
.bt-passfail { display: flex; flex-direction: column; gap: 10pt; }
.bt-pf { display: flex; align-items: center; gap: 12pt; font-size: 13pt; font-weight: 700; }
.bt-pf-text { min-width: 42pt; }
.bt-slump-fields { display: flex; flex-direction: column; gap: 12pt; }
.bt-slump-field { display: flex; align-items: baseline; gap: 8pt; }
.bt-slump-field-label { font-size: 10.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5pt; min-width: 34pt; }
.bt-time-input { display: inline-flex; align-items: baseline; gap: 4pt; }
.bt-time-blank { width: 26pt; border-bottom: 1pt solid #000; height: 16pt; }
.bt-time-colon { font-size: 15pt; font-weight: 800; }
`;

// ---------------------------------------------------------------------------------------------------------------
// Used by the weekly's week print (the portal page keeps its own state-bound versions of these two).
// ---------------------------------------------------------------------------------------------------------------

/** The colour log a ticket batches with: the ticket's own pick, else the most common colour among the casting's
 *  components, else the project's first log. Same rule as the portal's getActiveBatchColorLog(). */
export function activeColorLogFor({ ticket, components = [], logs = [] }) {
    const byId = (id) => logs.find(l => l && l.id === id) || null;
    if (ticket?.colorLogId) { const hit = byId(ticket.colorLogId); if (hit) return hit; }
    const counts = new Map();
    for (const c of components || []) { if (c?.color_log_id) counts.set(c.color_log_id, (counts.get(c.color_log_id) || 0) + 1); }
    let bestId = null, bestN = -1;
    for (const [id, n] of counts) if (n > bestN) { bestId = id; bestN = n; }
    if (bestId) { const hit = byId(bestId); if (hit) return hit; }
    return logs[0] || null;
}

/**
 * Every printable batch ticket of a casting as print pages, plus the totals entries behind them.
 * Mirrors the portal's handlePrintBatchTicketsNow() + buildBatchTotalsEntries().
 * @returns {{ pages: string, entries: Array<Object>, batches: number, reason: string|null }}
 */
export function buildTicketPages({ casting, projectName = '', tickets = [], logs = [], components = [], slumpTargets = SLUMP_TARGET_DEFAULTS, printedOn = new Date(), castDate = null }) {
    const printable = [];
    let reason = null;
    for (const ticket of tickets || []) {
        const activeLog = activeColorLogFor({ ticket, components, logs });
        const sandLbs = getColorLogSandLbs(activeLog);
        if (!sandLbs) { reason = reason || 'no sand entry on the color log'; continue; }
        const totalCuFt = parseFloat(ticket.cuFt) || 0;
        if (!totalCuFt) { reason = reason || 'no Total Cu Ft on the batch ticket'; continue; }
        const plan = buildBatchPlan({
            totalCuFt,
            faceSqFt: parseFloat(ticket.faceSqFt) || 0,
            cuFtPer250: parseFloat(ticket.cuFtPer250) || 4.28,
            castMethod: activeLog?.castMethod || 'sprayUp',
            colorLogSandLbs: sandLbs,
            manualOverrides: btOverrides(ticket)
        });
        if (!plan.batches.length) continue;
        printable.push({ ticket, activeLog, plan });
    }
    if (!printable.length) return { pages: '', entries: [], batches: 0, reason: reason || 'no batch tickets' };
    const entries = [];
    const pages = printable.map(({ ticket, activeLog, plan }) => {
        const pigReductionPct = parsePigReduction(ticket.pigReduction);
        const reduceFirstBackup = !!ticket.pigReduceFirstBackup;
        const omitAggFinalBackup = !!ticket.omitAggFinalBackup;
        const omitFibersFace = !!ticket.omitFibersFace;
        const cowbayFinalBackup = !!ticket.cowbayFinalBackup;
        entries.push({ plan, log: activeLog, pigReductionPct, reduceFirstBackup, omitAggFinalBackup, omitFibersFace, cowbayFinalBackup });
        const batchedOn = btImportStamp(ticket)?.importedAt || null;
        return plan.batches.map(b => `<div class="bt-page bt-${b.type}">${renderBatchTicketCard({
            printedOn, batchedOn,
            colorLog: activeLog,
            batch: b,
            project: projectName,
            sampleName: activeLog?.name || '',
            castMethod: activeLog?.castMethod || '',
            castNumber: casting.casting_number || '',
            castDate: castDate || casting.casting_date || '',
            colorName: ticket.colorLogId ? (activeLog?.name || '') : '',
            batchedBy: ticket.batchedBy,
            notes: ticket.notes,
            pigReductionPct, reduceFirstBackup, omitAggFinalBackup, omitFibersFace, cowbayFinalBackup,
            targetSlump: clampSlumpTarget(slumpTargets?.[b.type], SLUMP_TARGET_DEFAULTS[b.type])
        })}</div>`).join('');
    }).join('');
    return { pages, entries, batches: printable.reduce((n, p) => n + p.plan.batches.length, 0), reason: null };
}

/** Material rows summed across several castings' totals rows (same name + unit merge). */
export function sumTotalsRows(rowLists) {
    const totals = new Map();
    for (const rows of rowLists || []) for (const r of rows || []) {
        if (!r || !(r.total > 0)) continue;
        const k = `${r.name}__${r.unit}`;
        if (!totals.has(k)) totals.set(k, { name: r.name, unit: r.unit, category: r.category, total: 0 });
        totals.get(k).total += Number(r.total) || 0;
    }
    return [...totals.values()];
}

/** The Mix Day Totals table for a set of summed rows (same look as the portal's panel). */
export function renderTotalsTable(rows, title) {
    const categories = [{ key: 'dry', label: 'Dry Batch' }, { key: 'pigment', label: 'Pigments' }, { key: 'additive', label: 'Additives' }];
    let html = '';
    for (const cat of categories) {
        const items = (rows || []).filter(t => t && t.category === cat.key && t.total > 0);
        if (!items.length) continue;
        html += `<tr class="pp-bt-totals-cat-row"><td colspan="3">${escapeHtml(cat.label)}</td></tr>`;
        for (const item of items) html += `<tr><td>${escapeHtml(item.name)}</td><td class="pp-bt-totals-num">${roundSig(item.total, 2)}</td><td>${escapeHtml(item.unit)}</td></tr>`;
    }
    if (!html) return '';
    return `<div class="pp-bt-totals-panel"><div class="pp-bt-totals-title">${escapeHtml(title)}</div>
        <table class="pp-bt-totals-table"><thead><tr><th>Material</th><th class="pp-bt-totals-num">Total Qty</th><th>Unit</th></tr></thead><tbody>${html}</tbody></table></div>`;
}
