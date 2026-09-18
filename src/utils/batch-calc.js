/**
 * Batch Calculation Utilities
 *
 * Pure functions ported from the Batchin Calc project. Given a color log
 * + batch parameters (cu ft, face sq ft, cu ft per 250lb, cast method),
 * produces a list of batches with sand weights, scale factors, cu ft,
 * and auto-assigned types (face / firstBackUp / finalBackUp).
 *
 * No DOM access. Caller renders.
 *
 * @module utils/batch-calc
 */

export const BATCH_SIZES = [250, 150, 100];

// Allowed batch sizes per "largest batch" choice, for projects with job-specific sizing
// (see config/special-batching.js). 250 is the standard set above.
export const SIZE_SETS = { 100: [100], 200: [200, 100], 250: BATCH_SIZES };
export function sizesFor(maxSize) {
    return SIZE_SETS[maxSize] || BATCH_SIZES;
}

// Multiplier to convert weight in lbs INTO the target unit.
//   weightInUnit = weightInLbs * FROM_LBS[unit]
export const FROM_LBS = {
    lbs: 1,
    oz: 16,
    g: 453.592,
    kg: 1 / 2.20462,
    ml: 453.592,
    'fl oz': 16,
    gal: 1 / 8.345
};

// Multiplier to convert weight in given unit INTO lbs.
export const TO_LBS = {
    lbs: 1,
    oz: 1 / 16,
    g: 1 / 453.592,
    kg: 2.20462,
    ml: 1 / 453.592,
    'fl oz': 1 / 16,
    gal: 8.345
};

export function roundSig(num, decimals) {
    if (!Number.isFinite(num)) return 0;
    const f = Math.pow(10, decimals);
    return Math.round(num * f) / f;
}

/** Cubic feet produced by a batch of given sand weight, given the per-250lb ratio. */
export function cuFtFor(sandLbs, cuFtPer250 = 4.28) {
    return cuFtPer250 * (sandLbs / 250);
}

/**
 * Greedy: break required cu ft into 250 / 150 / 100 lb batches, then consolidate
 * weight-equivalent combos (150+100→250) so total sand is preserved but batch
 * count is minimized. Pure.
 *
 * `sizes` (largest first) defaults to the standard set; special projects pass a
 * smaller set, e.g. [100] or [200, 100].
 */
export function fillBatches(cuFtNeeded, cuFtPer250 = 4.28, sizes = BATCH_SIZES) {
    const batches = [];
    let remaining = cuFtNeeded;
    for (const size of sizes) {
        const cuFt = cuFtFor(size, cuFtPer250);
        const count = Math.floor(remaining / cuFt);
        for (let i = 0; i < count; i++) batches.push(size);
        remaining -= count * cuFt;
    }
    // Cover any sub-batch remainder with a 100 lb (smallest available).
    if (remaining > 0.01) {
        for (let i = sizes.length - 1; i >= 0; i--) {
            if (cuFtFor(sizes[i], cuFtPer250) >= remaining || i === sizes.length - 1) {
                batches.push(sizes[i]);
                break;
            }
        }
    }
    return consolidateBatches(batches, sizes);
}

/** Roll up weight-equivalent combos (150+100→250; 100+100→200 for the 200 lb set). Pure. */
export function consolidateBatches(batches, sizes = BATCH_SIZES) {
    const result = batches.slice();
    const countSize = (size) => result.filter(b => b === size).length;
    const removeOne = (size) => {
        const i = result.indexOf(size);
        if (i !== -1) result.splice(i, 1);
    };
    let changed = true;
    while (changed) {
        changed = false;
        if (sizes.includes(250) && countSize(150) >= 1 && countSize(100) >= 1) {
            removeOne(150); removeOne(100);
            result.push(250);
            changed = true;
        }
        if (sizes[0] === 200 && countSize(100) >= 2) {
            removeOne(100); removeOne(100);
            result.push(200);
            changed = true;
        }
    }
    result.sort((a, b) => b - a);
    return result;
}

/**
 * Plan the batch sequence + auto-assigned types.
 *
 *   directCast  → 50/50 face/finalBackUp split (no firstBackUp)
 *   sprayUp + faceSqFt > 0 → face cu ft = faceSqFt × 3/16" thick;
 *                            firstBackUp = same; remainder = finalBackUp
 *   no faceSqFt → first batch=face, last=finalBackUp, middle=firstBackUp
 *
 * @returns {{ batches: number[], types: string[], faceCuFt: number }}
 */
export function planBatches({ totalCuFt, faceSqFt = 0, cuFtPer250 = 4.28, castMethod = 'sprayUp', sizing = null }) {
    // Job-specific sizing (config/special-batching.js): Face Mix and Back Up layers can have their
    // own largest batch, and the First Back Up layer can be dropped (everything behind the face is
    // FINAL Back Up). Without `sizing` this is the standard plan, unchanged.
    const faceSizes = sizing ? sizesFor(sizing.face) : BATCH_SIZES;
    const backupSizes = sizing ? sizesFor(sizing.backup) : BATCH_SIZES;
    const useFirstBackUp = sizing ? !!sizing.firstBackUp : true;

    const directCast = castMethod === 'directCast';
    const faceCuFt = faceSqFt > 0 ? (faceSqFt * (3 / 16) / 12) : 0;
    let batches = [];
    let types = [];
    const sumCuFt = (arr) => arr.reduce((s, b) => s + cuFtFor(b, cuFtPer250), 0);

    if (!totalCuFt || totalCuFt <= 0) return { batches, types, faceCuFt };

    if (directCast) {
        const faceBatches = fillBatches(totalCuFt / 2, cuFtPer250, faceSizes);
        batches.push(...faceBatches);
        types.push(...faceBatches.map(() => 'face'));
        const finalNeeded = totalCuFt - sumCuFt(faceBatches);
        if (finalNeeded > 0.01) {
            const finalBatches = fillBatches(finalNeeded, cuFtPer250, backupSizes);
            batches.push(...finalBatches);
            types.push(...finalBatches.map(() => 'finalBackUp'));
        }
    } else if (faceSqFt > 0) {
        const faceBatches = fillBatches(Math.min(faceCuFt, totalCuFt), cuFtPer250, faceSizes);
        batches.push(...faceBatches);
        types.push(...faceBatches.map(() => 'face'));

        let used = sumCuFt(faceBatches);
        const backupNeeded = useFirstBackUp ? Math.min(faceCuFt, totalCuFt - used) : 0;
        if (backupNeeded > 0.01) {
            const backupBatches = fillBatches(backupNeeded, cuFtPer250, backupSizes);
            batches.push(...backupBatches);
            types.push(...backupBatches.map(() => 'firstBackUp'));
            used += sumCuFt(backupBatches);
        }
        const finalNeeded = totalCuFt - used;
        if (finalNeeded > 0.01) {
            const finalBatches = fillBatches(finalNeeded, cuFtPer250, backupSizes);
            batches.push(...finalBatches);
            types.push(...finalBatches.map(() => 'finalBackUp'));
        }
    } else {
        if (faceSizes[0] === backupSizes[0]) {
            batches = fillBatches(totalCuFt, cuFtPer250, faceSizes);
        } else {
            // One face batch (largest face size, or less if the whole pour is smaller), rest at back up sizes.
            batches = fillBatches(Math.min(totalCuFt, cuFtFor(faceSizes[0], cuFtPer250)), cuFtPer250, faceSizes).slice(0, 1);
            const rest = totalCuFt - sumCuFt(batches);
            if (rest > 0.01) batches.push(...fillBatches(rest, cuFtPer250, backupSizes));
        }
        types = batches.map((_size, idx) => {
            if (idx === 0) return 'face';
            if (idx === batches.length - 1 && batches.length > 1) return 'finalBackUp';
            return useFirstBackUp ? 'firstBackUp' : 'finalBackUp';
        });
    }
    return { batches, types, faceCuFt };
}

/**
 * Sand weight (lbs) recorded in a color log's base ingredients, or null if missing.
 */
export function getColorLogSandLbs(colorLog) {
    const sand = (colorLog?.baseIngredients || []).find(
        i => (i?.name || '').trim().toLowerCase() === 'sand'
    );
    if (!sand || !sand.weight || Number(sand.weight) <= 0) return null;
    const unit = sand.unit || 'lbs';
    return Number(sand.weight) * (TO_LBS[unit] || 1);
}

/**
 * Build per-batch records for ticket rendering.
 * @param {Object} opts
 * @param {number} opts.totalCuFt
 * @param {number} [opts.faceSqFt=0]
 * @param {number} [opts.cuFtPer250=4.28]
 * @param {string} [opts.castMethod='sprayUp']
 * @param {number} opts.colorLogSandLbs
 * @param {Array<{batchLbs:number,type:string}>} [opts.manualOverrides] — if its length === batches.length, replaces auto types
 * @param {{face:number,backup:number,firstBackUp:boolean}|null} [opts.sizing] — job-specific sizing (config/special-batching.js); omit for the standard plan
 * @returns {{
 *   batches: Array<{batchSandLbs:number, scaleFactor:number, cuFt:number, num:number, total:number, type:string}>,
 *   summary: {count250:number,count150:number,count100:number,actualCuFt:number,total:number},
 *   faceCuFt: number
 * }}
 */
export function buildBatchPlan({
    totalCuFt,
    faceSqFt = 0,
    cuFtPer250 = 4.28,
    castMethod = 'sprayUp',
    colorLogSandLbs,
    manualOverrides,
    sizing = null
}) {
    const { batches, types: autoTypes, faceCuFt } = planBatches({ totalCuFt, faceSqFt, cuFtPer250, castMethod, sizing });

    let types = autoTypes;
    if (Array.isArray(manualOverrides) && manualOverrides.length === batches.length) {
        types = manualOverrides.map((o, i) => o?.type || autoTypes[i]);
    }

    const result = batches.map((batchSandLbs, idx) => ({
        batchSandLbs,
        scaleFactor: colorLogSandLbs ? batchSandLbs / colorLogSandLbs : 0,
        cuFt: cuFtFor(batchSandLbs, cuFtPer250),
        num: idx + 1,
        total: batches.length,
        type: types[idx] || 'firstBackUp'
    }));

    const summary = {
        count250: batches.filter(b => b === 250).length,
        count200: batches.filter(b => b === 200).length,
        count150: batches.filter(b => b === 150).length,
        count100: batches.filter(b => b === 100).length,
        actualCuFt: result.reduce((s, b) => s + b.cuFt, 0),
        total: result.length
    };

    return { batches: result, summary, faceCuFt };
}
