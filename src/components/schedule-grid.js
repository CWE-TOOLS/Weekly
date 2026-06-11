/**
 * Schedule Grid Component - Main Coordinator
 * Orchestrates rendering, navigation, and layout management for the weekly schedule grid
 * @module components/schedule-grid
 *
 * @claude-context
 * @purpose Main coordinator for schedule grid - handles rendering orchestration, week navigation, and layout
 * @dependencies state.js, event-bus.js, storage.js, date-utils.js, week-renderer.js, grid-layout-manager.js
 * @used-by app-controller.js (initialization), print system
 * @exports renderAllWeeks, navigateToWeek, equalizeAllCardHeights
 * @modifies DOM (#schedule-container), state (currentViewedWeekIndex)
 * @events-emitted weeks-rendered, week-navigated
 * @events-listened tasks:loaded, week:changed, department-filter:changed, search:changed
 * @key-functions
 *   - renderAllWeeks() - Main rendering orchestrator
 *   - navigateToWeek(index) - Navigate to specific week
 *   - equalizeAllCardHeights() - Balance row heights for consistent layout (delegates to layout manager)
 * @architecture-notes
 *   Refactored in Phase 3 to separate concerns:
 *   - week-renderer.js: Rendering logic (week grids, headers, task cards)
 *   - grid-layout-manager.js: Layout and height management utilities
 *   - schedule-grid.js: Coordination and orchestration
 */

import {
    getAllWeekStartDates,
    setCurrentViewedWeekIndex
} from '../core/state.js';
import { emit, EVENTS } from '../core/event-bus.js';
import {
    equalizeAllCardHeights as equalizeHeights,
    scrollToWeek
} from '../utils/grid-layout-manager.js';

/**
 * Equalize card heights across all weeks for consistent layout
 * Delegates to grid-layout-manager.js
 */
export function equalizeAllCardHeights() {
    equalizeHeights();
}

/**
 * Navigate to a specific week by index
 * @param {number} weekIndex - Week index to navigate to
 */
export function navigateToWeek(weekIndex) {
    const wrapper = document.getElementById('schedule-wrapper');
    const container = document.getElementById('schedule-container');
    const allWeekStartDates = getAllWeekStartDates();

    if (!wrapper || !container || weekIndex < 0 || weekIndex >= allWeekStartDates.length) return;

    setCurrentViewedWeekIndex(weekIndex);

    // Use layout manager to scroll to week
    scrollToWeek(wrapper, container, weekIndex);

    emit(EVENTS.WEEK_CHANGED, { weekIndex, weekDate: allWeekStartDates[weekIndex] });
}
