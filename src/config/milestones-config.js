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
 *  (Shop Folder Built is not here — Print Cover on Project Info sets it.) */
export const APPROVALS_TAB_ITEMS = ['Approved SDs', 'Sample Approval'];

/** P. MANUAL: a person ticks it, but it can be ticked in the portal (a board-style cell on the tab) as well as on
 *  the board. Both write the same casting_milestones row, so they never disagree. */
export const PORTAL_MANUAL_MILESTONES = ['Final Optimizer HRS', 'Approved SDs', 'Sample Approval', 'Classroom #1', 'Classroom #2', 'Classroom #3'];

/** Board header tag to show instead of the kind's default (the Classrooms stay labelled MANUAL on the board
 *  although they can also be ticked on the portal's Class Rooms tab). */
export const BOARD_TAG_OVERRIDE = { 'Classroom #1': 'MANUAL', 'Classroom #2': 'MANUAL', 'Classroom #3': 'MANUAL' };

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
