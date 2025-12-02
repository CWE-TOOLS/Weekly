/**
 * Grid Layout Manager Module
 * Handles layout management, height equalization, and scroll positioning for schedule grids
 * @module utils/grid-layout-manager
 *
 * @claude-context
 * @purpose Manage grid layout, height equalization, and scroll position for consistent rendering
 * @dependencies None (pure DOM manipulation)
 * @used-by schedule-grid.js (main coordinator)
 * @exports equalizeAllCardHeights, setGridWidths, scrollToWeek
 * @modifies DOM (grid cell heights, scroll positions)
 * @key-functions
 *   - equalizeAllCardHeights() - Equalize row heights across all weeks
 *   - setGridWidths() - Set consistent widths for all grids
 *   - scrollToWeek() - Scroll to specific week with position management
 * @layout-logic
 *   Height Equalization:
 *   1. Collect all row classes from all grids
 *   2. For each row class, find maximum height (batched reads)
 *   3. Apply max height to all rows with that class (batched writes)
 *
 *   OPTIMIZATION: Uses batched DOM operations to prevent layout thrashing.
 *   All reads complete before any writes, reducing browser reflows from O(n) to O(1).
 */

/**
 * Equalize card heights across all weeks for consistent layout
 *
 * This function ensures that corresponding rows across different weeks
 * have the same height, creating a uniform grid appearance.
 *
 * PERFORMANCE OPTIMIZATION: This function uses batched DOM operations to prevent
 * layout thrashing. All height reads (offsetHeight) are performed first and cached,
 * then all height writes (minHeight) are applied in a second pass. This reduces
 * browser reflows from O(n) to O(1), where n is the number of row classes.
 *
 * Before optimization: READ class1 → WRITE class1 → READ class2 → WRITE class2 → ...
 * After optimization:  READ all classes → WRITE all classes
 *
 * @modifies DOM - Sets minHeight on all grid rows
 */
export function equalizeAllCardHeights() {
    const container = document.getElementById('schedule-container');
    if (!container) return;

    const allRowClasses = new Set();

    // Collect all row classes from all grids
    container.querySelectorAll('.schedule-grid').forEach(grid => {
        const rowClasses = grid.dataset.rowClasses || '';
        rowClasses.split(',').forEach(cls => {
            if (cls) allRowClasses.add(cls);
        });
    });

    // PHASE 0: Clear all existing minHeight values first
    // This allows rows to return to their natural height at the current width
    allRowClasses.forEach(rowClass => {
        const rows = container.querySelectorAll(`.${rowClass}`);
        rows.forEach(row => {
            row.style.minHeight = '';  // Clear minHeight
        });
    });

    // Force a reflow so the browser recalculates natural heights
    // This is necessary for offsetHeight to reflect the cleared minHeight
    container.offsetHeight;

    // PHASE 1: Batch all DOM reads first (prevents layout thrashing)
    // Store row references and their max heights for later application
    const rowHeights = new Map();

    allRowClasses.forEach(rowClass => {
        const rows = container.querySelectorAll(`.${rowClass}`);
        if (rows.length === 0) return;

        // Read all heights without any writes
        let maxHeight = 0;
        rows.forEach(row => {
            const height = row.offsetHeight;  // DOM READ only
            if (height > maxHeight) maxHeight = height;
        });

        // Cache the data for the write phase
        if (maxHeight > 0) {
            rowHeights.set(rowClass, { rows, maxHeight });
        }
    });

    // PHASE 2: Batch all DOM writes after all reads complete
    // This ensures the browser only needs to reflow once after all changes
    rowHeights.forEach(({ rows, maxHeight }) => {
        rows.forEach(row => {
            row.style.minHeight = `${maxHeight}px`;  // DOM WRITE only
        });
    });
}

/**
 * Set consistent widths for all grid elements
 * @param {HTMLElement} container - Schedule container element
 * @param {HTMLElement} wrapper - Schedule wrapper element
 */
export function setGridWidths(container, wrapper) {
    const wrapperWidth = wrapper.clientWidth;
    const grids = container.querySelectorAll('.schedule-grid');

    grids.forEach(grid => {
        grid.style.width = `${wrapperWidth}px`;
    });
}

/**
 * Calculate scroll position for a given week index
 * @param {HTMLElement} wrapper - Schedule wrapper element
 * @param {NodeList} grids - List of grid elements
 * @param {number} weekIndex - Target week index
 * @returns {number} Calculated scroll position
 */
export function calculateScrollPosition(wrapper, grids, weekIndex) {
    if (!grids[weekIndex]) return 0;
    return grids[weekIndex].offsetLeft;
}

/**
 * Scroll to a specific week
 * @param {HTMLElement} wrapper - Schedule wrapper element
 * @param {HTMLElement} container - Schedule container element
 * @param {number} weekIndex - Week index to scroll to
 * @returns {number} Final scroll position
 */
export function scrollToWeek(wrapper, container, weekIndex) {
    const grids = container.querySelectorAll('.schedule-grid');
    const targetScrollLeft = calculateScrollPosition(wrapper, grids, weekIndex);
    wrapper.scrollLeft = targetScrollLeft;
    return targetScrollLeft;
}
