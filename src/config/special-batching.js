/**
 * Special Batching Projects
 *
 * Projects whose batching follows job-specific rules the standard planner doesn't cover.
 * For these project numbers:
 *   - the Project Portal's Batch Tickets tab shows the project's dedicated batching page
 *     (embedded in the tab) instead of the standard batching form, and the top-bar
 *     "Print Batch Tickets" button prints from that page;
 *   - batch counts shown elsewhere (weekly board task cards, task modal, printed schedule)
 *     are planned with the project's `sizing`, so they match the dedicated page.
 *
 * `sizing` feeds planBatches()/buildBatchPlan() in utils/batch-calc.js:
 *   face / backup — largest batch (lbs of sand) for the Face Mix / the Back Up layers
 *                   (100, 200 or 250; 250 = the standard 250/150/100 set)
 *   firstBackUp   — false: everything behind the face is ONE back up layer (no three-layer split)
 *   backupType    — which type that single back up layer is: 'firstBackUp' or 'finalBackUp'
 *                   (labels only; batch counts are the same either way)
 *
 * The dedicated page reads its defaults from here too, so this is the single place to change them.
 *
 * @module config/special-batching
 */

export const SPECIAL_BATCHING = {
    '0860': {
        href: 'jane-street-batching.html',
        label: 'Jane Street Batching',
        version: '20260923-1',   // bumped whenever jane-street-batching.html changes, so the tab's frame skips the old cached copy
        sizing: { face: 100, backup: 200, firstBackUp: false, backupType: 'firstBackUp' }
    }
};

/** @returns {{href:string,label:string,sizing:{face:number,backup:number,firstBackUp:boolean}}|null} */
export function getSpecialBatching(projectNumber) {
    return SPECIAL_BATCHING[String(projectNumber ?? '').trim()] || null;
}
