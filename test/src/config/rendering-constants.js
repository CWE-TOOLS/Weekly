/**
 * Shared constants for all rendering paths (screen, print, smart)
 * @module config/rendering-constants
 */

import { SYNTHETIC_DEPARTMENT_NAMES, isSyntheticDepartment } from './department-config.js';

export const RENDERING = {
    /**
     * Number of days shown in a week view (Mon-Sat)
     */
    WEEK_DAYS: 6,

    /**
     * Special synthetic departments that don't follow standard task rendering rules
     * Derived from SYNTHETIC_DEPARTMENT_CONFIG in department-config.js
     */
    SPECIAL_DEPARTMENTS: [...SYNTHETIC_DEPARTMENT_NAMES],

    /**
     * Determines if a department should show hours in task cards
     * @param {string} dept - Department name
     * @returns {boolean} True if hours should be displayed
     */
    shouldShowHours(dept) {
        return !isSyntheticDepartment(dept);
    },

    /**
     * Determines if a department should use HTML in description
     * Special departments (Batch, Layout) use HTML for line breaks
     * @param {string} dept - Department name
     * @returns {boolean} True if HTML should be used in description
     */
    shouldUseHtmlDescription(dept) {
        return isSyntheticDepartment(dept);
    },

    /**
     * Checks if a department is a special synthetic department
     * @param {string} dept - Department name
     * @returns {boolean} True if department is synthetic (Batch or Layout)
     */
    isSpecialDepartment(dept) {
        return isSyntheticDepartment(dept);
    }
};
