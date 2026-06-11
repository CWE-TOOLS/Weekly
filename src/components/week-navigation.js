/**
 * Week Navigation Component
 * Handles week navigation and header display
 * @module components/week-navigation
 */

import {
    getAllWeekStartDates,
    getCurrentViewedWeekIndex,
    setCurrentViewedWeekIndex
} from '../core/state.js';
import { emit, on, EVENTS } from '../core/event-bus.js';
import { getMonday, getWeekMonth, getWeekOfMonth } from '../utils/date-utils.js';

import { logger } from '../utils/logger.js';
import { RENDER_DELAY } from '../config/timing-constants.js';
/**
 * Update the week display header with current week information
 * @param {Date} date - A date within the week to display
 */
export function updateWeekHeader(date) {
    if (!date) return;

    const weekDisplay = document.getElementById('week-display');
    if (!weekDisplay) return;

    const monday = getMonday(date);
    const month = getWeekMonth(monday);
    const weekNum = getWeekOfMonth(monday, month);

    const weekStart = new Date(monday);
    const weekEnd = new Date(monday);
    weekEnd.setDate(monday.getDate() + 5); // Friday

    const weekStartStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const weekEndStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    weekDisplay.textContent = `Week ${weekNum}: ${weekStartStr} - ${weekEndStr}`;
}

/**
 * Show next week by scrolling
 */
function showNextWeek() {
    const wrapper = document.getElementById('schedule-wrapper');
    if (wrapper) {
        wrapper.scrollBy({ left: wrapper.offsetWidth, behavior: 'smooth' });
    }
}

/**
 * Show previous week by scrolling
 */
function showPreviousWeek() {
    const wrapper = document.getElementById('schedule-wrapper');
    if (wrapper) {
        wrapper.scrollBy({ left: -wrapper.offsetWidth, behavior: 'smooth' });
    }
}

/**
 * Find current week from scroll position using actual grid positions
 * @param {NodeList} grids - List of grid elements
 * @returns {number} Index of the current week
 */
function findCurrentWeekFromScroll(grids) {
    const wrapper = document.getElementById('schedule-wrapper');
    if (!wrapper) return 0;

    const scrollLeft = wrapper.scrollLeft;
    const scrollCenter = scrollLeft + (wrapper.offsetWidth / 2);

    // Find which grid's center is closest to viewport center
    let closestIndex = 0;
    let minDistance = Infinity;

    grids.forEach((grid, index) => {
        const gridCenter = grid.offsetLeft + (grid.offsetWidth / 2);
        const distance = Math.abs(scrollCenter - gridCenter);
        if (distance < minDistance) {
            minDistance = distance;
            closestIndex = index;
        }
    });

    return closestIndex;
}

/**
 * Setup scroll listener to detect current week and update header
 */
function setupScrollListener() {
    const wrapper = document.getElementById('schedule-wrapper');
    const container = document.getElementById('schedule-container');
    if (!wrapper || !container) return;

    let scrollTimeout;

    wrapper.addEventListener('scroll', () => {
        // Clear previous timeout
        if (scrollTimeout) clearTimeout(scrollTimeout);

        // Debounce scroll handling
        scrollTimeout = setTimeout(() => {
            const grids = container.querySelectorAll('.schedule-grid');
            const weekIndex = findCurrentWeekFromScroll(grids);

            const allWeekStartDates = getAllWeekStartDates();
            if (weekIndex >= 0 && weekIndex < allWeekStartDates.length) {
                const currentIndex = getCurrentViewedWeekIndex();

                // Only update if week changed
                if (weekIndex !== currentIndex) {
                    setCurrentViewedWeekIndex(weekIndex);
                    emit(EVENTS.WEEK_CHANGED, { weekIndex, weekDate: allWeekStartDates[weekIndex] });
                }
            }
        }, RENDER_DELAY.WEEK_NAV_UPDATE);
    });
}

/**
 * Initialize week navigation
 */
export function initializeWeekNavigation() {
    // Setup button listeners
    const prevBtn = document.getElementById('prev-week-btn');
    const nextBtn = document.getElementById('next-week-btn');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            showPreviousWeek();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            showNextWeek();
        });
    }

    // Setup scroll listener
    setupScrollListener();

    // Listen for week changes to update header
    on(EVENTS.WEEK_CHANGED, ({ weekDate }) => {
        updateWeekHeader(weekDate);
    });

    // Listen for schedule rendered to update initial header
    on(EVENTS.SCHEDULE_RENDERED, () => {
        const allWeekStartDates = getAllWeekStartDates();
        const currentIndex = getCurrentViewedWeekIndex();
        if (currentIndex >= 0 && currentIndex < allWeekStartDates.length) {
            updateWeekHeader(allWeekStartDates[currentIndex]);
        }
    });

    // Update header on initialization if data is available
    const allWeekStartDates = getAllWeekStartDates();
    const currentIndex = getCurrentViewedWeekIndex();
    if (allWeekStartDates.length > 0 && currentIndex >= 0 && currentIndex < allWeekStartDates.length) {
        updateWeekHeader(allWeekStartDates[currentIndex]);
    }
}
