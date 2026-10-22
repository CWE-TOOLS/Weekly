/**
 * Finishing Map — the areas of the plant a casting can sit in once it reaches finishing,
 * copied from the magnet board (Tent #1, Wet Room, Black Top, Large Storage, Tent #2, Coop #1-#6).
 *
 * `grid` is the CSS grid-area name used by finishing-map.css to place the box on the page.
 * Add, rename or reorder areas here; a casting placed in an area that no longer exists is shown in the queue.
 */
export const FINISHING_AREAS = [
    { id: 'tent1',   label: 'Tent #1',       grid: 'tent1' },
    { id: 'wetroom', label: 'Wet Room',      grid: 'wetroom' },
    { id: 'blacktop', label: 'Black Top',    grid: 'blacktop' },
    { id: 'large',   label: 'Large Storage', grid: 'large' },
    { id: 'tent2',   label: 'Tent #2',       grid: 'tent2' },
    { id: 'outside', label: 'Outside',       grid: 'outside' },
    { id: 'coop1',   label: '#1', group: 'Coop.', grid: 'coop1' },
    { id: 'coop2',   label: '#2', group: 'Coop.', grid: 'coop2' },
    { id: 'coop3',   label: '#3', group: 'Coop.', grid: 'coop3' },
    { id: 'coop4',   label: '#4', group: 'Coop.', grid: 'coop4' },
    { id: 'coop5',   label: '#5', group: 'Coop.', grid: 'coop5' },
    { id: 'coop6',   label: '#6', group: 'Coop.', grid: 'coop6' }
];

/** Weekly departments that mean "the casting has reached finishing" (first such day in the past = in the queue). */
export const FINISHING_DEPARTMENTS = ['Finish'];

/** Weekly departments whose last day in the past means "shipped" (the card leaves the map). */
export const SHIPPING_DEPARTMENTS = ['Ship'];

/** Project statuses that also count as shipped. */
export const SHIPPED_STATUSES = ['Shipped', 'Closed Out'];

/** The shipped drawer shows castings shipped within this many days. */
export const SHIPPED_WINDOW_DAYS = 60;

/** A card goes grey when the casting has had no day on the weekly for this many days (probably gone, never marked shipped). */
export const STALE_AFTER_DAYS = 30;

/** The move log panel shows this many days back. */
export const LOG_WINDOW_DAYS = 60;

/** Area label for the log and tooltips ("Coop. #3", "Tent #1", "Queue"). */
export function areaLabel(id) {
    if (!id) return 'Queue';
    const a = FINISHING_AREAS.find(x => x.id === id);
    return a ? (a.group ? `${a.group} ${a.label}` : a.label) : id;
}
