/**
 * Project Map — read-only view of the weekly by department: which castings are in which department on a day, or
 * during a week. Nothing is moved by hand here (the Finishing Map is the one with moves).
 */

/** Department columns in process order (Special sits before Finish — user, 2026-10-22). */
export const MAP_DEPARTMENTS = [
    'CNC', 'Parts', 'Mill', 'Form Out', 'Cast', 'Demold', 'Special', 'Finish', 'Seal', 'Crating', 'Load', 'Ship'
];

/** Columns that stay on screen even when empty; the others (Mill, kept for old castings) show only when used. */
export const ALWAYS_SHOWN = new Set(['CNC', 'Parts', 'Form Out', 'Cast', 'Demold', 'Special', 'Finish', 'Seal', 'Crating', 'Load', 'Ship']);

/** Weekly departments whose last day in the past means "shipped". */
export const SHIPPING_DEPARTMENTS = ['Ship'];

/** Project statuses that also count as shipped. */
export const SHIPPED_STATUSES = ['Shipped', 'Closed Out'];

/** The shipped pop-up shows castings shipped within this many days. */
export const SHIPPED_WINDOW_DAYS = 60;

/** The Scheduled column lists castings whose first weekly day is within this many days ahead of the view. */
export const SCHEDULED_LOOKAHEAD_DAYS = 60;
