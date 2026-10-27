/**
 * Milestones (2026-10-15): which Releasability Board columns the portal drives by itself.
 *
 * MANUAL columns are clicked by a person on the board, as always.
 * AUTO columns are coloured from the portal's `casting_milestones` rows — a print, a tick,
 * the Casting Inventory lock, or a derived state (Color Log entered, Staging filled).
 *
 * @module config/milestones-config
 */

export const MANUAL_MILESTONES = [
    'Classroom #1', 'Classroom #2', 'Classroom #3',
    'Rebar/Drilling Layout', 'Mitti QC Template', 'Inflow Sales Ticket',
    '3D Drawings/Parts List', 'Toolpath Program', 'Green Sticker'
];

export const AUTO_MILESTONES = [
    'Color Log', 'Casting Inventory', 'Labels', 'Final Tracking',
    'Batching Sheets', 'Casting Layout', 'Shop Folder Built', 'Shop Folder Cover', 'Jig List', 'Staging'
];

/** The portal's "Releasability Approvals" tab: one row per casting, these P. MANUAL columns.
 *  (Shop Folder Built is not here — Print INITIAL Cover on Project Info sets it.) */
export const APPROVALS_TAB_ITEMS = ['Approved SDs', 'Sample Approval'];

/** P. MANUAL: a person ticks it, but it can be ticked in the portal (a board-style cell on the tab) as well as on
 *  the board. Both write the same casting_milestones row, so they never disagree. */
export const PORTAL_MANUAL_MILESTONES = ['Final Optimizer HRS', 'Approved SDs', 'Sample Approval', 'Classroom #1', 'Classroom #2', 'Classroom #3'];

/** Board header tag to show instead of the kind's default (the Classrooms stay labelled MANUAL on the board
 *  although they can also be ticked on the portal's Class Rooms tab). */
export const BOARD_TAG_OVERRIDE = { 'Classroom #1': 'MANUAL', 'Classroom #2': 'MANUAL', 'Classroom #3': 'MANUAL' };

/** One plain sentence per board column saying what sets it — shown on hover over the header and the cells (2026-10-26). */
export const MILESTONE_HOW = {
    'Classroom #1': 'Click the cell here for one casting, or use the Class Rooms tab in the portal to mark the classroom held for every casting in the phase (green = all held, orange = some).',
    'Classroom #2': 'Click the cell here for one casting, or use the Class Rooms tab in the portal to mark the classroom held for every casting in the phase (green = all held, orange = some).',
    'Classroom #3': 'Click the cell here for one casting, or use the Class Rooms tab in the portal to mark the classroom held for every casting in the phase (green = all held, orange = some).',
    'Shop Folder Built': 'Goes green the moment Print INITIAL Cover (Project Info tab) is printed for the castings in view: a printed cover means a physical folder exists.',
    'Approved SDs': "Click the cell here, or tick it on the portal's Releasability Approvals tab; both write the same record.",
    'Sample Approval': "Click the cell here, or tick it on the portal's Releasability Approvals tab; both write the same record.",
    'Color Log': 'Orange once a colour is picked on any Casting Inventory row of the casting; green when Print Color Log is printed for it.',
    'Final Optimizer HRS': "Click the cell here, or the FINAL HRS cell on the portal's Optimizer Hours tab, when the hours are final.",
    'Rebar/Drilling Layout': 'Click the cell to change it (nothing in the portal sets it yet).',
    'Casting Inventory': 'Red = nothing entered. Orange = being entered, or the PM pressed Ready for engineering. Green = engineering pressed Casting Inventory ready (the inventory is locked). Make changes reopens it and it goes orange again. Casting Inventory ready also settles anything printed through the hold before: still as printed → green, changed since → stays orange with a note.',
    'Labels': "Green when the labels are printed from the Tracking tab. Orange if they were printed before the inventory was final, or the inventory's types, sizes or quantities changed after: print them again.",
    'Final Tracking': 'Green when the Final Tracking sheet is printed from the Tracking tab. Orange if it was printed before the inventory was final, or the inventory changed after: print it again.',
    'Batching Sheets': 'Green when the batch tickets are printed (Batch Tickets tab or the Jane Street page). Orange while the inventory is being changed, or if it changed after printing. When engineering marks the inventory ready, the portal checks whether the tickets really change and turns this back to green if they do not.',
    'Casting Layout': 'Orange once forms are laid out on the Casting Layout tab. Green when the layout is printed, or when a special condition is set for the casting.',
    'Shop Folder Cover': 'Orange when Print INITIAL Cover is printed (step 1). Green when Print FINAL Cover is printed for that casting (step 2).',
    'Mitti QC Template': 'Click the cell to change it (nothing in the portal sets it yet).',
    'Inflow Sales Ticket': 'Click the cell to change it (nothing in the portal sets it yet).',
    '3D Drawings/Parts List': 'Click the cell to change it (nothing in the portal sets it yet).',
    'Toolpath Program': 'Click the cell to change it (nothing in the portal sets it yet).',
    'Jig List': 'Orange when the jig list is imported from the Casting Inventory on the Jig List tab. Green when it is printed. Grey N/A when the casting has no jigs (condition set on the tab).',
    'Staging': 'Red = no staging notes. Orange = some days have a note. Green = every day of every department has a note, entered on the Staging tab or on the weekly cards.',
    'Green Sticker': 'Board only: the DOP clicks it at final folder QC.'
};

/** Printouts built from the Casting Inventory: warned/blocked until the inventory is final, and
 *  knocked back to orange whenever the inventory changes after they were printed. */
export const CI_DEPENDENT = ['Batching Sheets', 'Labels', 'Final Tracking', 'Casting Layout', 'Jig List'];

export const MS = { RED: 'red', ORANGE: 'orange', GREEN: 'green', NA: 'na' };

/** Board status for a milestone colour (na = the board's grey N/A; needs migration/casting-milestones-na.sql). */
export const MS_TO_BOARD = { red: 'incomplete', orange: 'in_progress', green: 'complete', na: 'not_applicable' };

/**
 * Release rule (2026-10-16, "touched follows the new format"): there is NO cut-off. A board cell with a
 * portal record behind it is driven by the portal; a cell without one keeps the hand-set colour it has
 * today and is clicked the old way. The derived states (Color Log, Staging, jig-list imported, forms laid
 * out) only start writing once the job has its first real record, so merely opening an old job changes
 * nothing on the board. MILESTONES_FROM is kept as an emergency switch only (both null = on everywhere).
 */
export const MILESTONES_FROM = { project: null, date: null };

/** True when the automatic milestones apply to this project. */
export function milestonesApply(projectNumber, createdAt = null) {
    const p = String(projectNumber || '').trim();
    if (!p) return false;
    if (MILESTONES_FROM.project) {
        const a = p.replace(/\D/g, ''), b = String(MILESTONES_FROM.project).replace(/\D/g, '');
        if (a && b) return Number(a) >= Number(b);
        return p >= String(MILESTONES_FROM.project);
    }
    if (MILESTONES_FROM.date) {
        if (!createdAt) return false;
        return String(createdAt).slice(0, 10) >= MILESTONES_FROM.date;
    }
    return true;
}

/** Wording for the Casting Inventory box (PM: "Ready for engineering", engineering: "Casting Inventory ready"). */
export const CI_STATE = {
    red:    { label: 'Casting Inventory — nothing entered yet', next: 'Ready for engineering' },
    orange: { label: 'Casting Inventory — in progress', next: 'Casting Inventory ready' },
    green:  { label: 'Casting Inventory — ready (final)', next: null }
};
