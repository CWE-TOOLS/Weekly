/**
 * Date utility functions for the Weekly Schedule Viewer
 * @module date-utils
 */

/**
 * Parse a date string in multiple formats (MM/DD/YYYY, YYYY-MM-DD, or ISO)
 * @param {string} dateStr - The date string to parse
 * @returns {Date|null} Parsed date or null if invalid
 */
export function parseDate(dateStr) {
    if (!dateStr) return null;

    // Try MM/DD/YYYY format
    const slashParts = dateStr.split("/");
    if (slashParts.length === 3) {
        const [month, day, year] = slashParts.map(Number);
        const date = new Date(year, month - 1, day);
        return isNaN(date) ? null : date;
    }

    // Try YYYY-MM-DD format
    const dashParts = dateStr.split("-");
    if (dashParts.length === 3) {
        const [year, month, day] = dashParts.map(Number);
        const date = new Date(year, month - 1, day);
        return isNaN(date) ? null : date;
    }

    // Try native parsing
    return isNaN(new Date(dateStr)) ? null : new Date(dateStr);
}

/**
 * Convert a Date object to YYYY-MM-DD format
 * @param {Date} date - The date to format
 * @returns {string} Date in YYYY-MM-DD format
 */
export function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Convert a Date object to MM/DD/YYYY format
 * @param {Date} date - The date to format
 * @returns {string} Date in MM/DD/YYYY format
 */
export function formatDateToMMDDYYYY(date) {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
}

/**
 * Get the Monday of the week containing the given date
 * @param {Date} date - Any date in the week
 * @returns {Date} The Monday of that week (at midnight)
 */
export function getMonday(date) {
    date = new Date(date);
    const dayOfWeek = date.getDay() || 7; // Sunday = 7
    if (dayOfWeek !== 1) {
        date.setHours(-24 * (dayOfWeek - 1));
    }
    date.setHours(0, 0, 0, 0);
    return date;
}

/**
 * Determine which month a week primarily belongs to (based on Mon-Fri)
 * @param {Date} monday - The Monday of the week
 * @returns {number} Month index (0-11) that week primarily belongs to
 */
export function getWeekMonth(monday) {
    const daysInEachMonth = {};
    for (let i = 0; i < 5; i++) { // Mon to Fri
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        const month = date.getMonth();
        daysInEachMonth[month] = (daysInEachMonth[month] || 0) + 1;
    }
    let maxDays = 0;
    let majorMonth = monday.getMonth();
    for (const m in daysInEachMonth) {
        if (daysInEachMonth[m] > maxDays) {
            maxDays = daysInEachMonth[m];
            majorMonth = parseInt(m);
        }
    }
    return majorMonth;
}

/**
 * Get the week number within a month for the given Monday
 * @param {Date} monday - The Monday of the week
 * @param {number} month - Month index (0-11)
 * @returns {number} Week number within the month (1-based)
 */
export function getWeekOfMonth(monday, month) {
    const year = monday.getFullYear();
    let startOfWeek1 = getMonday(new Date(year, month, 1));
    // Find the first Monday whose week has majority days in the month
    while (getWeekMonth(startOfWeek1) !== month) {
        startOfWeek1 = new Date(startOfWeek1.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    const diffMs = monday - startOfWeek1;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const weekNum = 1 + Math.floor(diffDays / 7);
    return Math.max(1, weekNum);
}
