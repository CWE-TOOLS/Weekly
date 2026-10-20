/**
 * Plant Scheduler configuration (2026-10-19).
 *
 * The scheduler replaces the hand-typed Google-Sheet "Optimizer" grid. It reads each casting's
 * phase list and hours from the portal's Optimizer Hours tab (casting_phases) and spreads them
 * over working days. Nothing here feeds the weekly board yet — the scheduler is standalone until
 * it is finalized.
 *
 * Decisions from the user (2026-10-19):
 *   - the Mill column is split into CNC and Parts (2026-10-19); a "mill" task is Parts only (2026-10-20)
 *   - task codes: CNC, PARTS, FO, CAST, DM, G/F, GOF, ACID, WASH, TU, SEAL, AZEK, STRIP, BUILD, RACK,
 *     DRY, DRILL, PAN, SHIP  (+ MILL and LOAD for the default "Mill" / "Load Crate" phases)
 *   - TU is done by both the Finish and the Seal team (before the Seal phase -> F, after -> Seal)
 *   - AZEK and STRIP belong to the Special team
 *   - BUILD and RACK are Crate-team tasks; RACK can also be done by the Special team
 *   - workers available: skipped for now; default spread comes from the Optimizer Hours tasks
 *   - weekends only with an alert and a manual "allow" per day; holidays never
 *
 * @module config/scheduler-config
 */

/** The day columns, in the Optimizer's order. Mill was split into CNC and Parts on 2026-10-19 (both are the weekly's Mill). */
export const DEPARTMENTS = [
    { key: 'CNC',   label: 'CNC',   weekly: 'Mill' },
    { key: 'Parts', label: 'Parts', weekly: 'Mill' },
    { key: 'FO',    label: 'FO',    weekly: 'Form Out' },
    { key: 'Cast',  label: 'Cast',  weekly: 'Cast' },
    { key: 'DM',    label: 'DM',    weekly: 'Demold' },
    { key: 'F',     label: 'F',     weekly: 'Finish' },
    { key: 'Seal',  label: 'Seal',  weekly: 'Seal' },
    { key: 'Crate', label: 'Crate', weekly: 'Crating' },
    { key: 'Spec',  label: 'Spec',  weekly: 'Special' },
    { key: 'Ship',  label: 'Ship',  weekly: 'Ship' }
];
export const DEPT_KEYS = DEPARTMENTS.map(d => d.key);

/**
 * Task code -> the teams that may do it (first = default). The user's list (2026-10-20), nothing else is allowed:
 *   CNC = CNC · Parts = PARTS, PARTS/FO · FO = FO · Cast = CAST · DM = DM · F = G/F, GOF, WASH, ACID, TU
 *   Seal = SEAL, TU, PAINT · Crate = BUILD, LOAD, RACK · Spec = AZEK, STRIP, TU, RACK, DRY/RACK, DRILL, LOAD, BUILD
 *   Ship = SHIP (not in the list; kept as the Ship team's only task)
 */
export const TASKS = {
    CNC:        ['CNC'],
    PARTS:      ['Parts'],
    'PARTS/FO': ['Parts'],
    FO:         ['FO'],
    CAST:       ['Cast'],
    DM:         ['DM'],
    'G/F':      ['F'],
    GOF:        ['F'],
    WASH:       ['F'],
    ACID:       ['F'],
    TU:         ['F', 'Seal', 'Spec'],
    SEAL:       ['Seal'],
    PAINT:      ['Seal'],
    BUILD:      ['Crate', 'Spec'],
    LOAD:       ['Crate', 'Spec'],
    RACK:       ['Crate', 'Spec'],
    AZEK:       ['Spec'],
    STRIP:      ['Spec'],
    'DRY/RACK': ['Spec'],
    DRILL:      ['Spec'],
    SHIP:       ['Ship']
};
export const TASK_CODES = Object.keys(TASKS);

/** Task codes a department column accepts. */
export function tasksForDept(dept) {
    return TASK_CODES.filter(code => TASKS[code].includes(dept));
}

/**
 * Optimizer Hours phase name -> task code. Phase names are free text ("Seal Coat 1 & 2", "Strips
 * Remove Azek", "wash 2"), so this is keyword matching, first rule wins. Unknown names land in
 * Special and are flagged so the user can fix them on the page.
 */
const PHASE_RULES = [
    [/cnc/i, 'CNC'],
    [/parts?\s*\/\s*f\.?o\b|parts?\s*&\s*f\.?o\b|\bm\/f\b/i, 'PARTS/FO'],
    [/part|mill/i, 'PARTS'],                       // "mill" is Parts-team work (user 2026-10-20)
    [/form\s*out|^fo$|\bf\/o\b|\brb\b|rebuild|rebar|form/i, 'FO'],
    [/cast/i, 'CAST'],
    [/^dm$|demold|de-mold/i, 'DM'],
    [/g\s*\/\s*f|g\s*&\s*f|grind.*fill|fill/i, 'G/F'],
    [/gof|grind/i, 'GOF'],
    [/acid/i, 'ACID'],
    [/wash/i, 'WASH'],
    [/\btu\b|touch/i, 'TU'],
    [/paint/i, 'PAINT'],
    [/seal|epoxy/i, 'SEAL'],
    [/azek/i, 'AZEK'],
    [/strip/i, 'STRIP'],
    [/dry/i, 'DRY/RACK'],
    [/build/i, 'BUILD'],
    [/rack/i, 'RACK'],
    [/drill/i, 'DRILL'],
    [/ship/i, 'SHIP'],
    [/load/i, 'LOAD']
];

/**
 * @param {string} phaseName
 * @param {{afterSeal?: boolean}} [ctx] afterSeal: the phase sits after the casting's Seal phase (TU -> Seal team)
 * @returns {{code: string, dept: string, unmapped: boolean}}
 */
export function taskForPhase(phaseName, ctx = {}) {
    const name = String(phaseName || '').trim();
    for (const [re, code] of PHASE_RULES) {
        if (re.test(name)) {
            let dept = TASKS[code][0];
            if (code === 'TU' && (ctx.afterSeal || /seal/i.test(name))) dept = 'Seal';
            return { code, dept, unmapped: false };
        }
    }
    return { code: name.toUpperCase().slice(0, 10) || '?', dept: 'Spec', unmapped: true };
}

/** Hours one department can absorb in a day — only used to decide how many days a phase spreads over. Editable on the page. */
export const DEFAULT_DAY_HOURS = { CNC: 16, Parts: 16, FO: 16, Cast: 40, DM: 16, F: 24, Seal: 16, Crate: 16, Spec: 16, Ship: 8 };

/** Plant holidays (never scheduled). Editable on the page; these are the seed. */
export const DEFAULT_HOLIDAYS = [
    '2026-11-26', '2026-11-27', '2026-12-24', '2026-12-25', '2027-01-01',
    '2027-05-31', '2027-07-05', '2027-09-06', '2027-11-25', '2027-11-26', '2027-12-24'
];

/** Most castings a team takes on one day before the day header turns red (user rule 2026-10-20). Teams not listed: no limit. */
export const TEAM_DAY_LIMITS = { Parts: 1, FO: 1, Cast: 1, DM: 1, F: 5, Seal: 5, Spec: 5 };

/** Revenue per labor hour (the Optimizer's Rev tab). */
export const REVENUE_PER_HOUR = 135;

/** Projects in these statuses are offered for scheduling. */
export const SCHEDULABLE_STATUSES = ['Kicked Off', 'Approved', 'In Production', 'Releasability'];

export const SETTINGS_DEFAULTS = {
    dayHours: DEFAULT_DAY_HOURS,
    holidays: DEFAULT_HOLIDAYS,
    weeks: 4,
    showWeekends: false
};
