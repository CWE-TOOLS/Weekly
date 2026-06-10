/**
 * Labor Popover Triggers
 *
 * Wires clicks on weekly-grid date headers and the week-range pill (`#week-display`)
 * to the labor popover. Event delegation — handlers survive re-renders.
 *
 * @module features/labor-popover-triggers
 */

import { openLaborPopover } from '../components/popovers/labor-popover.js';
import { getAllWeekStartDates, getCurrentViewedWeekIndex } from '../core/state.js';
import { getLocalDateString, DAYS_IN_WORK_WEEK } from '../utils/date-utils.js';
import { logger } from '../utils/logger.js';

function fmtDateLong(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function currentWeekRange() {
    try {
        const dates = getAllWeekStartDates();
        const idx = getCurrentViewedWeekIndex();
        if (!dates?.length || idx == null || idx < 0 || idx >= dates.length) return null;
        const monday = dates[idx];
        if (!(monday instanceof Date)) return null;
        const saturday = new Date(monday);
        saturday.setDate(monday.getDate() + (DAYS_IN_WORK_WEEK - 1));
        return {
            startIso: getLocalDateString(monday),
            endIso: getLocalDateString(saturday),
            startDate: monday,
            endDate: saturday
        };
    } catch (err) {
        logger.warn('[labor-popover-triggers] could not resolve current week range:', err);
        return null;
    }
}

export function initializeLaborPopoverTriggers() {
    document.addEventListener('click', (e) => {
        const dayEl = e.target.closest('.date-container[data-date]');
        if (dayEl) {
            const iso = dayEl.dataset.date;
            if (!iso) return;
            const title = `${fmtDateLong(iso)} — Actual Labor`;
            openLaborPopover(dayEl, iso, iso, title);
            return;
        }

        const weekEl = e.target.closest('#week-display');
        if (weekEl) {
            const range = currentWeekRange();
            if (!range) return;
            const title = `Week of ${fmtDateLong(range.startIso)} — Actual Labor`;
            openLaborPopover(weekEl, range.startIso, range.endIso, title);
        }
    });

    logger.debug('Labor popover triggers initialized');
}
