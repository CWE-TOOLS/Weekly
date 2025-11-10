/**
 * Shared constants for all rendering paths (screen, print, smart)
 * @module config/rendering-constants
 */

export const RENDERING = {
    /**
     * Number of days shown in a week view (Mon-Sat)
     */
    WEEK_DAYS: 6,

    /**
     * Special synthetic departments that don't follow standard task rendering rules
     */
    SPECIAL_DEPARTMENTS: ['Batch', 'Layout'],

    /**
     * Determines if a department should show hours in task cards
     * @param {string} dept - Department name
     * @returns {boolean} True if hours should be displayed
     */
    shouldShowHours(dept) {
        return dept !== 'Batch' && dept !== 'Layout';
    },

    /**
     * Determines if a department should use HTML in description
     * Special departments (Batch, Layout) use HTML for line breaks
     * @param {string} dept - Department name
     * @returns {boolean} True if HTML should be used in description
     */
    shouldUseHtmlDescription(dept) {
        return dept === 'Batch' || dept === 'Layout';
    },

    /**
     * Checks if a department is a special synthetic department
     * @param {string} dept - Department name
     * @returns {boolean} True if department is synthetic (Batch or Layout)
     */
    isSpecialDepartment(dept) {
        return this.SPECIAL_DEPARTMENTS.includes(dept);
    }
};
