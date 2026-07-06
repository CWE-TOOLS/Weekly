/**
 * Print Configuration Manager
 * Handles print configuration state, settings persistence, and validation
 * @module components/modals/print-config-manager
 */

import { getAllTasks, getAllWeekStartDates, getCurrentViewedWeekIndex } from '../../core/state.js';
import { normalizeDepartmentClass } from '../../utils/ui-utils.js';
import { getMonday, getLocalDateString, getWeekMonth, getWeekOfMonth, DAYS_IN_WORK_WEEK } from '../../utils/date-utils.js';
import { DEPARTMENT_ORDER, SYNTHETIC_DEPARTMENT_NAMES, DEPARTMENT_COLORS } from '../../config/department-config.js';

import { logger } from '../../utils/logger.js';
// Configuration state
let currentPrintWeekDates = [];
let allDepartmentsForPrint = [];
let currentPrintType = 'week';
let currentOrientation = 'landscape';
// Board Schedule (11×17) only — defaults to ON so the Saturday page is
// produced and Mon Cast's Layout lands on Sat. Toggle OFF for the
// original Mon-Fri-only behavior (weekend work collapsed onto Friday).
let includeBoardSaturday = true;

// Which "kind" of department list the picker is currently showing. The buy-in
// print type uses a different fixed list (includes Batch+Layout, excludes
// Facilities) AND a different localStorage key so it doesn't trample the
// regular Print Week selection — and vice versa. Default = the legacy list.
let currentDeptListKind = 'default';

// Department list shown when the Buy-In Sheets print type is selected. The
// renderer iterates these in this same order. Excludes Special Events and
// Facilities per product spec; includes the two synthetic crews (Batch,
// Layout) so the manager can issue them their own form.
//
// The shipping crew uses a single combined "Crate / Ship" entry rather than
// the three underlying departments (Crating, Load, Ship). Production runs one
// combined buy-in sheet for that group with split CRATE / SHIPPING columns
// (Crate = Crating + Load summed, Ship = Ship alone). See
// BUY_IN_CRATE_SHIP_LABEL in print-renderer.js for the renderer-side handling.
export const BUY_IN_CRATE_SHIP = 'Crate / Ship';
export const BUY_IN_DEPARTMENTS = [
    'Mill', 'Form Out', 'Cast', 'Batch', 'Samples', 'Demold', 'Layout',
    'Finish', 'Seal', 'Final Insp.', 'Special', BUY_IN_CRATE_SHIP
];

/**
 * Set which department list kind the picker should render. Either 'default'
 * (the dynamic getFilteredDepartments() list used by Print Week / Print Day /
 * Phase Start) or 'buy-in' (the fixed BUY_IN_DEPARTMENTS list).
 */
export function setCurrentDeptListKind(kind) {
    currentDeptListKind = (kind === 'buy-in') ? 'buy-in' : 'default';
}

/**
 * @returns {string} 'default' | 'buy-in'
 */
export function getCurrentDeptListKind() {
    return currentDeptListKind;
}

function _deptStorageKey() {
    return currentDeptListKind === 'buy-in'
        ? 'printSelectedDepartments_buyIn'
        : 'printSelectedDepartments';
}

function _deptListForCurrentKind() {
    return currentDeptListKind === 'buy-in'
        ? BUY_IN_DEPARTMENTS.slice()
        : getFilteredDepartments();
}

/**
 * Get current print type
 * @returns {string} Current print type ('week' or 'day')
 */
export function getCurrentPrintType() {
    return currentPrintType;
}

/**
 * Set current print type
 * @param {string} type - Print type ('week' or 'day')
 */
export function setCurrentPrintType(type) {
    currentPrintType = type;
}

/**
 * Get current page orientation
 * @returns {string} Current orientation ('portrait' or 'landscape')
 */
export function getCurrentOrientation() {
    return currentOrientation;
}

/**
 * Set current page orientation
 * @param {string} orientation - Page orientation ('portrait' or 'landscape')
 */
export function setCurrentOrientation(orientation) {
    currentOrientation = orientation;
}

/**
 * Get whether the Board Schedule (11×17) print should include Saturday.
 * @returns {boolean}
 */
export function getIncludeBoardSaturday() {
    return includeBoardSaturday;
}

/**
 * Set whether the Board Schedule (11×17) print should include Saturday.
 * @param {boolean} value
 */
export function setIncludeBoardSaturday(value) {
    includeBoardSaturday = !!value;
}

/**
 * Get current print week dates
 * @returns {Date[]} Array of dates for the current print week
 */
export function getCurrentPrintWeekDates() {
    return currentPrintWeekDates;
}

/**
 * Set current print week dates
 * @param {Date[]} dates - Array of dates for the print week
 */
export function setCurrentPrintWeekDates(dates) {
    currentPrintWeekDates = dates;
}

/**
 * Get all departments available for printing
 * @returns {string[]} Array of department names
 */
export function getAllDepartmentsForPrint() {
    return allDepartmentsForPrint;
}

/**
 * Populate week select dropdown
 * Generates options for all available weeks with formatted labels
 * @param {HTMLSelectElement} weekSelectElement - Week select dropdown element
 */
export function populateWeekSelect(weekSelectElement) {
    if (!weekSelectElement) return;

    const allWeekStartDates = getAllWeekStartDates();
    const currentViewedWeekIndex = getCurrentViewedWeekIndex();

    weekSelectElement.innerHTML = '';
    allWeekStartDates.forEach((date, index) => {
        const option = document.createElement('option');
        option.value = index.toString();
        const weekStart = new Date(date);
        const weekEnd = new Date(date);
        weekEnd.setDate(date.getDate() + 5);
        const monday = getMonday(date);
        const month = getWeekMonth(monday);
        const weekNum = getWeekOfMonth(monday, month);
        const monthName = new Date(monday.getFullYear(), month, 1).toLocaleDateString('en-US', { month: 'short' });
        option.textContent = `${monthName} Week ${weekNum}: ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        if (index === currentViewedWeekIndex) option.selected = true;
        weekSelectElement.appendChild(option);
    });
}

/**
 * Preselect the week AFTER the current calendar week in the week dropdown.
 * Buy-in sheets are hand-fill planning forms printed ahead of time, so they
 * default to next week rather than the currently viewed week. Matches by
 * date (current Monday + 7 days) — if that week isn't in the schedule, the
 * existing selection (current viewed week) is left untouched.
 * @param {HTMLSelectElement} weekSelectElement - Week select dropdown element
 */
export function selectNextCalendarWeek(weekSelectElement) {
    if (!weekSelectElement) return;

    const nextMonday = getMonday(new Date());
    nextMonday.setDate(nextMonday.getDate() + 7);
    const nextMondayKey = getLocalDateString(nextMonday);

    const nextWeekIndex = getAllWeekStartDates().findIndex(
        date => getLocalDateString(getMonday(date)) === nextMondayKey
    );
    if (nextWeekIndex !== -1) {
        weekSelectElement.value = nextWeekIndex.toString();
    }
}

/**
 * Set date input to tomorrow
 * @param {HTMLInputElement} dateSelectElement - Date input element
 */
export function setDefaultDate(dateSelectElement) {
    if (!dateSelectElement) return;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = tomorrow.toISOString().split('T')[0];
    dateSelectElement.value = tomorrowString;
}

/**
 * Get and filter departments for printing
 * Filters out invalid and synthetic departments (Batch, Layout, Special Events)
 * @returns {string[]} Sorted array of valid department names
 */
export function getFilteredDepartments() {
    const allTasks = getAllTasks();

    // Get all departments, filter out invalid ones and synthetic departments (Batch, Layout)
    // Batch and Layout are synthetic departments that are automatically included with Cast and Demold
    // Special Events is excluded as it will never be sent to print layout
    const departments = [...new Set(allTasks.map(task => task.department).filter(dept =>
        dept && dept.toLowerCase() !== 'department' &&
        !dept.toLowerCase().includes('link') &&
        !dept.toLowerCase().includes('live') &&
        !SYNTHETIC_DEPARTMENT_NAMES.has(dept) &&
        dept !== 'Special Events' &&
        dept !== 'Sample' && dept !== 'Custom'
    ))];

    // Sort departments, keeping Samples and Facilities at the very end
    const endDepts = ['Samples', 'Facilities'];
    departments.sort((a, b) => {
        const aEnd = endDepts.indexOf(a);
        const bEnd = endDepts.indexOf(b);
        if (aEnd !== -1 && bEnd !== -1) return aEnd - bEnd;
        if (aEnd !== -1) return 1;
        if (bEnd !== -1) return -1;
        const aIndex = DEPARTMENT_ORDER.indexOf(a);
        const bIndex = DEPARTMENT_ORDER.indexOf(b);
        if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
    });

    allDepartmentsForPrint = departments;
    return departments;
}

/**
 * Populate departments grid with checkboxes
 * Restores saved selections from localStorage
 * @param {HTMLElement} departmentsGridElement - Grid container element
 * @param {Function} onChangeCallback - Callback function for checkbox changes
 */
export function populateDepartmentsGrid(departmentsGridElement, onChangeCallback) {
    if (!departmentsGridElement) return;

    // Department list + saved-selection key are both keyed off the current
    // dept-list kind (set via setCurrentDeptListKind). Buy-in has its own
    // fixed list and its own localStorage key so the two print types don't
    // overwrite each other's pick state.
    const departments = _deptListForCurrentKind();
    departmentsGridElement.innerHTML = '';

    const storageKey = _deptStorageKey();
    const savedPrintDepartments = localStorage.getItem(storageKey)
        ? JSON.parse(localStorage.getItem(storageKey))
        : null;
    const defaultSelectedDepts = savedPrintDepartments !== null ? savedPrintDepartments : departments;

    departments.forEach(dept => {
        const deptKey = normalizeDepartmentClass(dept);
        const color = DEPARTMENT_COLORS[deptKey]?.background || '#6B7280';
        const isSelected = defaultSelectedDepts.includes(dept);

        const chip = document.createElement('label');
        chip.className = `dept-chip${isSelected ? ' selected' : ''}`;
        chip.style.setProperty('--dept-color', color);
        chip.innerHTML = `
            <input type="checkbox" value="${dept}" ${isSelected ? 'checked' : ''}>
            <span class="dept-chip-check">✓</span>
            <span class="dept-chip-name">${dept}</span>
        `;
        departmentsGridElement.appendChild(chip);

        const checkbox = chip.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', () => {
            chip.classList.toggle('selected', checkbox.checked);
            if (onChangeCallback) onChangeCallback();
        });
    });
}

/**
 * Save department selection to localStorage
 * Stores selected departments for persistence across sessions
 */
export function saveDepartmentSelection() {
    const selectedDepts = Array.from(document.querySelectorAll('.departments-grid input[type="checkbox"]:checked'))
        .map(cb => cb.value);
    localStorage.setItem(_deptStorageKey(), JSON.stringify(selectedDepts));
}

/**
 * Get selected departments from checkboxes
 * @returns {string[]} Array of selected department names
 */
export function getSelectedDepartments() {
    return Array.from(document.querySelectorAll('.departments-grid input[type="checkbox"]:checked'))
        .map(cb => cb.value);
}

/**
 * Update week dates based on selected week
 * Calculates date range for the selected week (6 days: Mon-Sat)
 * @param {HTMLSelectElement} weekSelectElement - Week select dropdown element
 */
export function updateWeekDates(weekSelectElement) {
    if (!weekSelectElement) return;

    const allWeekStartDates = getAllWeekStartDates();
    const selectedIndex = parseInt(weekSelectElement.value);
    const selectedWeekStart = allWeekStartDates[selectedIndex];

    if (!selectedWeekStart) {
        logger.error('Invalid week start date');
        currentPrintWeekDates = [];
        return;
    }

    currentPrintWeekDates = Array.from({ length: DAYS_IN_WORK_WEEK }).map((_, i) => {
        const date = new Date(selectedWeekStart);
        date.setDate(selectedWeekStart.getDate() + i);
        return date;
    });
}

/**
 * Get date from date input element
 * @param {HTMLInputElement} dateSelectElement - Date input element
 * @returns {Date|null} Selected date or null if invalid
 */
export function getSelectedDate(dateSelectElement) {
    if (!dateSelectElement || !dateSelectElement.value) return null;

    const value = dateSelectElement.value;
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
}

/**
 * Validate print configuration
 * Checks if required fields are properly configured
 * @param {string} printType - Print type ('week' or 'day')
 * @param {string[]} selectedDepts - Array of selected departments
 * @param {HTMLInputElement} dateSelectElement - Date input element (for day type)
 * @returns {{valid: boolean, error: string|null}} Validation result
 */
export function validatePrintConfig(printType, selectedDepts, dateSelectElement) {
    if (selectedDepts.length === 0) {
        return { valid: false, error: 'Please select at least one department.' };
    }

    if (printType === 'day') {
        const selectedDate = getSelectedDate(dateSelectElement);
        if (!selectedDate) {
            return { valid: false, error: 'Please select a date.' };
        }
    }

    return { valid: true, error: null };
}

/**
 * Prepare print dates based on print type
 * Sets up the date range for printing
 * @param {string} printType - Print type ('week', 'day', or 'phase-start')
 * @param {HTMLSelectElement} weekSelectElement - Week select dropdown element
 * @param {HTMLInputElement} dateSelectElement - Date input element
 * @returns {Date[]} Array of dates for printing
 */
export function preparePrintDates(printType, weekSelectElement, dateSelectElement) {
    if (printType === 'week' || printType === 'phase-start') {
        updateWeekDates(weekSelectElement);
        return currentPrintWeekDates;
    } else if (printType === 'day') {
        const selectedDate = getSelectedDate(dateSelectElement);
        if (selectedDate) {
            currentPrintWeekDates = [selectedDate];
            return currentPrintWeekDates;
        }
    }
    return [];
}
