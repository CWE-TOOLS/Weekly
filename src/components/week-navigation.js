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
import { saveScrollPosition, saveWeekIndex } from '../core/storage.js';
import { getMonday, getWeekMonth, getWeekOfMonth } from '../utils/date-utils.js';
import { navigateToWeek } from './schedule-grid.js';

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
 * Navigate to the previous week
 */
export function navigateToPreviousWeek() {
    const currentIndex = getCurrentViewedWeekIndex();
    const allWeekStartDates = getAllWeekStartDates();

    if (currentIndex > 0) {
        const newIndex = currentIndex - 1;
        navigateToWeek(newIndex);
    } else {
        // Already at first week
        console.log('Already at the first week');
    }
}

/**
 * Navigate to the next week
 */
export function navigateToNextWeek() {
    const currentIndex = getCurrentViewedWeekIndex();
    const allWeekStartDates = getAllWeekStartDates();

    if (currentIndex < allWeekStartDates.length - 1) {
        const newIndex = currentIndex + 1;
        navigateToWeek(newIndex);
    } else {
        // Already at last week
        console.log('Already at the last week');
    }
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
 * Setup scroll listener to detect current week and update header
 */
function setupScrollListener() {
    const wrapper = document.getElementById('schedule-wrapper');
    if (!wrapper) return;

    let scrollTimeout;

    wrapper.addEventListener('scroll', () => {
        // Clear previous timeout
        if (scrollTimeout) clearTimeout(scrollTimeout);

        // Debounce scroll handling
        scrollTimeout = setTimeout(() => {
            const scrollLeft = wrapper.scrollLeft;
            const wrapperWidth = wrapper.offsetWidth;
            const weekIndex = Math.round(scrollLeft / wrapperWidth);

            const allWeekStartDates = getAllWeekStartDates();
            if (weekIndex >= 0 && weekIndex < allWeekStartDates.length) {
                const currentIndex = getCurrentViewedWeekIndex();

                // Only update if week changed
                if (weekIndex !== currentIndex) {
                    setCurrentViewedWeekIndex(weekIndex);
                    saveWeekIndex(weekIndex);
                    emit(EVENTS.WEEK_CHANGED, { weekIndex, weekDate: allWeekStartDates[weekIndex] });
                }
            }

            // Save scroll position
            saveScrollPosition(scrollLeft);
        }, 100);
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
