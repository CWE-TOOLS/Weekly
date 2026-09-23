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
 * The portal opens `href` with `?project=NNNN`, so one page can serve several projects.
 *
 * @module config/special-batching
 */

/** Jane Street: 100 lb face mixes, 200 lb back ups, one back up layer typed First Back Up, no Cowbay. */
const JANE_STREET = {
    href: 'jane-street-batching.html',
    label: 'Jane Street Batching',
    version: '20260923-4',   // bumped whenever jane-street-batching.html changes, so the tab's frame skips the old cached copy
    sizing: { face: 100, backup: 200, firstBackUp: false, backupType: 'firstBackUp' }
};

export const SPECIAL_BATCHING = {
    '0860': JANE_STREET,   // Jane Street 11th & 12th Floor
    '0892': JANE_STREET    // Jane St. 14th Floor Tile (Full Scope) — same rules, added 2026-09-23
};

/** @returns {{href:string,label:string,sizing:{face:number,backup:number,firstBackUp:boolean}}|null} */
export function getSpecialBatching(projectNumber) {
    return SPECIAL_BATCHING[String(projectNumber ?? '').trim()] || null;
}
