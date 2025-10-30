/**
 * Print Modal Component
 * Handles print configuration and print execution
 * @module components/modals/print-modal
 */

// Imports
import { getAllTasks, getAllWeekStartDates, getCurrentViewedWeekIndex } from '../../core/state.js';
import { emit, EVENTS } from '../../core/event-bus.js';
import { normalizeDepartmentClass } from '../../utils/ui-utils.js';
import { getMonday, getWeekMonth, getWeekOfMonth } from '../../utils/date-utils.js';
import { DEPARTMENT_ORDER } from '../../config/department-config.js';

// Private state
let modalElement = null;
let closeButton = null;
let cancelButton = null;
let executeButton = null;
let weekSelectElement = null;
let dateSelectElement = null;
let weekSectionElement = null;
let daySectionElement = null;
let departmentsGridElement = null;
let checkAllButton = null;
let uncheckAllButton = null;

let currentPrintWeekDates = [];
let allDepartmentsForPrint = [];
let currentPrintType = 'week';

/**
 * Initialize print modal
 * Sets up event listeners and references to DOM elements
 */
export function initializePrintModal() {
    // Get modal elements
    modalElement = document.getElementById('print-modal');
    closeButton = document.getElementById('print-close');
    cancelButton = document.getElementById('print-cancel-btn');
    executeButton = document.getElementById('print-execute-btn');
    weekSelectElement = document.getElementById('print-week-select');
    dateSelectElement = document.getElementById('print-date-select');
    weekSectionElement = document.getElementById('week-select-section');
    daySectionElement = document.getElementById('day-select-section');
    departmentsGridElement = document.querySelector('.departments-grid');
    checkAllButton = document.getElementById('check-all-depts');
    uncheckAllButton = document.getElementById('uncheck-all-depts');

    if (!modalElement) {
        console.error('Print modal elements not found in DOM');
        return;
    }

    // Set up event listeners
    closeButton.addEventListener('click', hidePrintModal);
    cancelButton.addEventListener('click', hidePrintModal);
    executeButton.addEventListener('click', handlePrintExecute);

    // Close modal on background click
    modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) {
            hidePrintModal();
        }
    });

    // Print type radio buttons
    document.querySelectorAll('input[name="print-type"]').forEach(radio => {
        radio.addEventListener('change', updatePrintTypeDisplay);
    });

    // Week select change
    if (weekSelectElement) {
        weekSelectElement.addEventListener('change', updateWeekDates);
    }

    // Department check all/uncheck all
    if (checkAllButton) {
        checkAllButton.addEventListener('click', () => {
            document.querySelectorAll('.departments-grid input[type="checkbox"]').forEach(cb => cb.checked = true);
            saveDepartmentSelection();
        });
    }

    if (uncheckAllButton) {
        uncheckAllButton.addEventListener('click', () => {
            document.querySelectorAll('.departments-grid input[type="checkbox"]').forEach(cb => cb.checked = false);
            saveDepartmentSelection();
        });
    }

    console.log('Print modal initialized');
}

/**
 * Open print configuration modal
 */
export function openPrintModal() {
    _showPrintModal();
}

/**
 * Show print modal
 * @private
 */
function _showPrintModal() {
    const allTasks = getAllTasks();

    if (allTasks.length === 0) {
        alert('Data is still loading. Please wait for the schedule to load before printing.');
        return;
    }

    if (!modalElement) {
        console.error('Print modal not initialized');
        return;
    }

    modalElement.classList.add('show');
    document.body.style.overflow = 'hidden';

    // Populate print options
    populatePrintOptions();

    // Emit event
    emit(EVENTS.MODAL_OPENED, { modalName: 'print-modal' });
}

/**
 * Close print modal
 */
export function closePrintModal() {
    hidePrintModal();
}

/**
 * Hide print modal
 * @private
 */
function hidePrintModal() {
    if (!modalElement) return;

    // Save current department selection before hiding
    saveDepartmentSelection();

    modalElement.classList.remove('show');
    document.body.style.overflow = '';

    // Emit event
    emit(EVENTS.MODAL_CLOSED, { modalName: 'print-modal' });
}

/**
 * Populate print options (weeks, departments)
 * @private
 */
function populatePrintOptions() {
    const allWeekStartDates = getAllWeekStartDates();
    const allTasks = getAllTasks();
    const currentViewedWeekIndex = getCurrentViewedWeekIndex();

    // Populate week select
    if (weekSelectElement) {
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

    // Set date input to tomorrow
    if (dateSelectElement) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowString = tomorrow.toISOString().split('T')[0];
        dateSelectElement.value = tomorrowString;
    }

    // Get all departments, filter out invalid ones and synthetic departments (Batch, Layout)
    // Batch and Layout are synthetic departments that are automatically included with Cast and Demold
    // Special Events is excluded as it will never be sent to print layout
    allDepartmentsForPrint = [...new Set(allTasks.map(task => task.department).filter(dept =>
        dept && dept.toLowerCase() !== 'department' &&
        !dept.toLowerCase().includes('link') &&
        !dept.toLowerCase().includes('live') &&
        dept !== 'Batch' &&
        dept !== 'Layout' &&
        dept !== 'Special Events'
    ))];

    // Sort departments
    allDepartmentsForPrint.sort((a, b) => {
        const aIndex = DEPARTMENT_ORDER.indexOf(a);
        const bIndex = DEPARTMENT_ORDER.indexOf(b);
        if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
    });

    // Populate departments grid
    if (departmentsGridElement) {
        departmentsGridElement.innerHTML = '';

        // Restore saved print department selections
        const savedPrintDepartments = localStorage.getItem('printSelectedDepartments')
            ? JSON.parse(localStorage.getItem('printSelectedDepartments'))
            : null;
        const defaultSelectedDepts = savedPrintDepartments !== null ? savedPrintDepartments : allDepartmentsForPrint;

        allDepartmentsForPrint.forEach(dept => {
            const checkboxDiv = document.createElement('div');
            checkboxDiv.className = 'department-checkbox';
            checkboxDiv.innerHTML = `
                <input type="checkbox" id="print-dept-${normalizeDepartmentClass(dept)}" value="${dept}" ${defaultSelectedDepts.includes(dept) ? 'checked' : ''}>
                <label for="print-dept-${normalizeDepartmentClass(dept)}">${dept}</label>
            `;
            departmentsGridElement.appendChild(checkboxDiv);

            // Add event listener to save selection when changed
            const checkbox = checkboxDiv.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', saveDepartmentSelection);
        });
    }

    updatePrintTypeDisplay();
}

/**
 * Update print type display (week vs day)
 * @private
 */
function updatePrintTypeDisplay() {
    const checkedRadio = document.querySelector('input[name="print-type"]:checked');
    currentPrintType = (checkedRadio && checkedRadio.value) || 'week';

    if (weekSectionElement && daySectionElement) {
        if (currentPrintType === 'week') {
            weekSectionElement.style.display = 'block';
            daySectionElement.style.display = 'none';
        } else {
            weekSectionElement.style.display = 'none';
            daySectionElement.style.display = 'block';
        }
    }
}

/**
 * Update week dates based on selected week
 * @private
 */
function updateWeekDates() {
    const allWeekStartDates = getAllWeekStartDates();
    const selectedIndex = parseInt(weekSelectElement.value);
    const selectedWeekStart = allWeekStartDates[selectedIndex];

    if (!selectedWeekStart) {
        console.error('Invalid week start date');
        currentPrintWeekDates = [];
        return;
    }

    currentPrintWeekDates = Array.from({ length: 6 }).map((_, i) => {
        const date = new Date(selectedWeekStart);
        date.setDate(selectedWeekStart.getDate() + i);
        return date;
    });
}

/**
 * Save department selection to localStorage
 * @private
 */
function saveDepartmentSelection() {
    const selectedDepts = Array.from(document.querySelectorAll('.departments-grid input[type="checkbox"]:checked'))
        .map(cb => cb.value);
    localStorage.setItem('printSelectedDepartments', JSON.stringify(selectedDepts));
}

/**
 * Handle print execution
 * @private
 */
function handlePrintExecute() {
    const checkedRadio = document.querySelector('input[name="print-type"]:checked');
    const printType = (checkedRadio && checkedRadio.value) || 'week';
    const selectedDepts = Array.from(document.querySelectorAll('.departments-grid input[type="checkbox"]:checked'))
        .map(cb => cb.value);

    if (selectedDepts.length === 0) {
        alert('Please select at least one department.');
        return;
    }

    // Update dates based on print type
    if (printType === 'week') {
        updateWeekDates();
    } else if (printType === 'day') {
        const value = dateSelectElement.value;
        if (!value) {
            alert('Please select a date.');
            return;
        }
        const [year, month, day] = value.split('-').map(Number);
        const selectedDate = new Date(year, month - 1, day);
        currentPrintWeekDates = [selectedDate];
    }

    // Generate print content using external utilities
    const allTasks = getAllTasks();
    if (window.PrintUtils && window.PrintUtils.generatePrintContent) {
        const printContent = window.PrintUtils.generatePrintContent(printType, selectedDepts, currentPrintWeekDates, allTasks);

        if (printContent) {
            window.PrintUtils.executePrint(printContent, printType);
        }
    } else {
        console.error('Print utilities not available');
        alert('Print system not available. Please refresh the page.');
    }
}

/**
 * Show print modal (for backward compatibility)
 */
export function showPrintModal() {
    _showPrintModal();
}

// Expose to window for backward compatibility
if (typeof window !== 'undefined') {
    window.showPrintModal = showPrintModal;
}
