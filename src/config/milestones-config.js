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
    'Shop Folder Built', 'Approved SDs', 'Sample Approval',
    'Rebar/Drilling Layout', 'Mitti QC Template', 'Inflow Sales Ticket',
    '3D Drawings/Parts List', 'Toolpath Program', 'Green Sticker'
];

export const AUTO_MILESTONES = [
    'Color Log', 'Final Optimizer HRS', 'Casting Inventory', 'Labels', 'Final Tracking',
    'Batching Sheets', 'Casting Layout', 'Shop Folder Cover', 'Jig List', 'Staging'
];

/** Printouts built from the Casting Inventory: warned/blocked until the inventory is final, and
 *  knocked back to orange whenever the inventory changes after they were printed. */
export const CI_DEPENDENT = ['Batching Sheets', 'Labels', 'Final Tracking', 'Casting Layout', 'Jig List'];

export const MS = { RED: 'red', ORANGE: 'orange', GREEN: 'green' };

/** Board status for a milestone colour. */
export const MS_TO_BOARD = { red: 'incomplete', orange: 'in_progress', green: 'complete' };

/**
 * Cut-off: the new rules apply only to projects at/after this. Both null = every project
 * (the test copy). Set ONE of them before publishing so older jobs keep their hand-set board.
 *   project: the first project number that gets the new rules (compared as text, e.g. '0900')
 *   date:    'YYYY-MM-DD' — projects created on/after this date get the new rules
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

/** Wording for the Casting Inventory lock box. */
export const CI_STATE = {
    red:    { label: 'Casting Inventory — being entered', next: 'Ready for engineering' },
    orange: { label: 'Casting Inventory — with engineering', next: 'Engineering done — lock it' },
    green:  { label: 'Casting Inventory — final & locked', next: null }
};
