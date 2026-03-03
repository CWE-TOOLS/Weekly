/**
 * Print Configuration Manager
 * Handles print configuration state, settings persistence, and validation
 * @module components/modals/print-config-manager
 */

import { getAllTasks, getAllWeekStartDates, getCurrentViewedWeekIndex } from '../../core/state.js';
import { normalizeDepartmentClass } from '../../utils/ui-utils.js';
import { getMonday, getWeekMonth, getWeekOfMonth, DAYS_IN_WORK_WEEK } from '../../utils/date-utils.js';
import { DEPARTMENT_ORDER, SYNTHETIC_DEPARTMENT_NAMES, DEPARTMENT_COLORS } from '../../config/department-config.js';

import { logger } from '../../utils/logger.js';
// Configuration state
let currentPrintWeekDates = [];
let allDepartmentsForPrint = [];
let currentPrintType = 'week';
let currentOrientation = 'landscape';

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

    // Sort departments, keeping Samples at the very end
    departments.sort((a, b) => {
        if (a === 'Samples') return 1;
        if (b === 'Samples') return -1;
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

    const departments = getFilteredDepartments();
    departmentsGridElement.innerHTML = '';

    // Restore saved print department selections
    const savedPrintDepartments = localStorage.getItem('printSelectedDepartments')
        ? JSON.parse(localStorage.getItem('printSelectedDepartments'))
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
    localStorage.setItem('printSelectedDepartments', JSON.stringify(selectedDepts));
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
