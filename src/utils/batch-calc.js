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

export const BATCH_SIZES = [250, 150, 50];

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
 * Greedy: break required cu ft into 250 / 150 / 50 lb batches, then consolidate
 * weight-equivalent combos (150+50+50→250, 50+50+50→150) so total sand is
 * preserved but batch count is minimized. Pure.
 */
export function fillBatches(cuFtNeeded, cuFtPer250 = 4.28) {
    const batches = [];
    let remaining = cuFtNeeded;
    for (const size of BATCH_SIZES) {
        const cuFt = cuFtFor(size, cuFtPer250);
        const count = Math.floor(remaining / cuFt);
        for (let i = 0; i < count; i++) batches.push(size);
        remaining -= count * cuFt;
    }
    // Cover any sub-batch remainder with a 50 lb (smallest available).
    if (remaining > 0.01) {
        for (let i = BATCH_SIZES.length - 1; i >= 0; i--) {
            if (cuFtFor(BATCH_SIZES[i], cuFtPer250) >= remaining || i === BATCH_SIZES.length - 1) {
                batches.push(BATCH_SIZES[i]);
                break;
            }
        }
    }
    return consolidateBatches(batches);
}

/** Roll up weight-equivalent combos (150+50+50→250, 50+50+50→150). Pure. */
export function consolidateBatches(batches) {
    const result = batches.slice();
    const countSize = (size) => result.filter(b => b === size).length;
    const removeOne = (size) => {
        const i = result.indexOf(size);
        if (i !== -1) result.splice(i, 1);
    };
    let changed = true;
    while (changed) {
        changed = false;
        if (countSize(150) >= 1 && countSize(50) >= 2) {
            removeOne(150); removeOne(50); removeOne(50);
            result.push(250);
            changed = true;
            continue;
        }
        if (countSize(50) >= 3) {
            removeOne(50); removeOne(50); removeOne(50);
            result.push(150);
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
export function planBatches({ totalCuFt, faceSqFt = 0, cuFtPer250 = 4.28, castMethod = 'sprayUp' }) {
    const directCast = castMethod === 'directCast';
    const faceCuFt = faceSqFt > 0 ? (faceSqFt * (3 / 16) / 12) : 0;
    let batches = [];
    let types = [];

    if (!totalCuFt || totalCuFt <= 0) return { batches, types, faceCuFt };

    if (directCast) {
        const halfCuFt = totalCuFt / 2;
        const faceBatches = fillBatches(halfCuFt, cuFtPer250);
        const faceTotal = faceBatches.reduce((s, b) => s + cuFtFor(b, cuFtPer250), 0);
        batches.push(...faceBatches);
        types.push(...faceBatches.map(() => 'face'));
        const finalNeeded = totalCuFt - faceTotal;
        if (finalNeeded > 0.01) {
            const finalBatches = fillBatches(finalNeeded, cuFtPer250);
            batches.push(...finalBatches);
            types.push(...finalBatches.map(() => 'finalBackUp'));
        }
    } else if (faceSqFt > 0) {
        const faceBatches = fillBatches(Math.min(faceCuFt, totalCuFt), cuFtPer250);
        const faceTotal = faceBatches.reduce((s, b) => s + cuFtFor(b, cuFtPer250), 0);
        batches.push(...faceBatches);
        types.push(...faceBatches.map(() => 'face'));

        let used = faceTotal;
        const backupNeeded = Math.min(faceCuFt, totalCuFt - used);
        if (backupNeeded > 0.01) {
            const backupBatches = fillBatches(backupNeeded, cuFtPer250);
            const backupTotal = backupBatches.reduce((s, b) => s + cuFtFor(b, cuFtPer250), 0);
            batches.push(...backupBatches);
            types.push(...backupBatches.map(() => 'firstBackUp'));
            used += backupTotal;
        }
        const finalNeeded = totalCuFt - used;
        if (finalNeeded > 0.01) {
            const finalBatches = fillBatches(finalNeeded, cuFtPer250);
            batches.push(...finalBatches);
            types.push(...finalBatches.map(() => 'finalBackUp'));
        }
    } else {
        batches = fillBatches(totalCuFt, cuFtPer250);
        types = batches.map((_size, idx) => {
            if (idx === 0) return 'face';
            if (idx === batches.length - 1 && batches.length > 1) return 'finalBackUp';
            return 'firstBackUp';
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
 * @returns {{
 *   batches: Array<{batchSandLbs:number, scaleFactor:number, cuFt:number, num:number, total:number, type:string}>,
 *   summary: {count250:number,count150:number,count50:number,actualCuFt:number,total:number},
 *   faceCuFt: number
 * }}
 */
export function buildBatchPlan({
    totalCuFt,
    faceSqFt = 0,
    cuFtPer250 = 4.28,
    castMethod = 'sprayUp',
    colorLogSandLbs,
    manualOverrides
}) {
    const { batches, types: autoTypes, faceCuFt } = planBatches({ totalCuFt, faceSqFt, cuFtPer250, castMethod });

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
        count150: batches.filter(b => b === 150).length,
        count50:  batches.filter(b => b === 50).length,
        actualCuFt: result.reduce((s, b) => s + b.cuFt, 0),
        total: result.length
    };

    return { batches: result, summary, faceCuFt };
}
