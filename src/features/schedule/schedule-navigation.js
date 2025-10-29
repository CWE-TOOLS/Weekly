/**
 * Schedule Navigation Module
 * Handles week-to-week navigation in the schedule view
 *
 * Dependencies:
 * - None (pure DOM manipulation)
 */

/**
 * Navigate to the next week
 * Smoothly scrolls the schedule wrapper to show the next week
 */
export function showNextWeek() {
    const wrapper = document.getElementById('schedule-wrapper');
    wrapper.scrollBy({ left: wrapper.offsetWidth, behavior: 'smooth' });
}

/**
 * Navigate to the previous week
 * Smoothly scrolls the schedule wrapper to show the previous week
 */
export function showPreviousWeek() {
    const wrapper = document.getElementById('schedule-wrapper');
    wrapper.scrollBy({ left: -wrapper.offsetWidth, behavior: 'smooth' });
}

/**
 * Initialize navigation event listeners
 * Should be called during app initialization
 */
export function initializeNavigation() {
    document.getElementById('prev-week-btn').addEventListener('click', showPreviousWeek);
    document.getElementById('next-week-btn').addEventListener('click', showNextWeek);
}
