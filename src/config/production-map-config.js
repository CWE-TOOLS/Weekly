/**
 * Production Map — read-only view of where every casting is in the plant, straight from the weekly.
 *
 * Columns are weekly departments in process order. A casting sits in the department of its latest weekly day that is
 * today or earlier (ties on the same day go to the department further along). Nothing is moved by hand here.
 */
export const PRODUCTION_DEPARTMENTS = [
    'CNC', 'Parts', 'Mill', 'Form Out', 'Cast', 'Demold', 'Finish', 'Seal', 'Special', 'Crating', 'Load', 'Ship'
];

/** Columns that stay on screen even when empty; the others (e.g. Mill, kept for old castings) show only when used. */
export const ALWAYS_SHOWN = new Set(['CNC', 'Parts', 'Form Out', 'Cast', 'Demold', 'Finish', 'Seal', 'Special', 'Crating', 'Load', 'Ship']);

/** Weekly departments whose last day in the past means "shipped" (the card leaves the map). */
export const SHIPPING_DEPARTMENTS = ['Ship'];

/** Project statuses that also count as shipped. */
export const SHIPPED_STATUSES = ['Shipped', 'Closed Out'];

/** The shipped pop-up shows castings shipped within this many days. */
export const SHIPPED_WINDOW_DAYS = 60;

/** A card goes grey when the casting has had no day on the weekly for this many days (probably gone, never shipped on the weekly). */
export const STALE_AFTER_DAYS = 30;
