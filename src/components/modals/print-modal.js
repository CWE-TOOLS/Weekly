/**
 * Print Modal Component
 * Handles print configuration and print execution
 * @module components/modals/print-modal
 */

// Imports
import { getAllTasks } from '../../core/state.js';
import { emit, EVENTS } from '../../core/event-bus.js';
import { logger } from '../../utils/logger.js';

// Import print utilities to ensure they're loaded and exposed globally
import '../../features/print/print-utils.js';

import {
    getCurrentPrintType,
    setCurrentPrintType,
    getCurrentOrientation,
    setCurrentOrientation,
    getIncludeBoardSaturday,
    setIncludeBoardSaturday,
    getCurrentPrintWeekDates,
    populateWeekSelect,
    selectNextCalendarWeek,
    setDefaultDate,
    populateDepartmentsGrid,
    saveDepartmentSelection,
    getSelectedDepartments,
    updateWeekDates,
    validatePrintConfig,
    preparePrintDates,
    setCurrentDeptListKind
} from './print-config-manager.js';

// Private state
let modalElement = null;
let closeButton = null;
let cancelButton = null;
let executeButton = null;
let weekSelectElement = null;
let dateSelectElement = null;
let frozenDailyDateSelectElement = null;
let weekSectionElement = null;
let daySectionElement = null;
let frozenDailySectionElement = null;
let departmentsSectionElement = null;
let orientationSectionElement = null;
let boardSaturdaySectionElement = null;
let boardSaturdayCheckbox = null;
let departmentsGridElement = null;
let checkAllButton = null;
let uncheckAllButton = null;

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
    frozenDailyDateSelectElement = document.getElementById('frozen-daily-date-select');
    weekSectionElement = document.getElementById('week-select-section');
    daySectionElement = document.getElementById('day-select-section');
    frozenDailySectionElement = document.getElementById('frozen-daily-select-section');
    departmentsSectionElement = document.getElementById('departments-section');
    orientationSectionElement = document.getElementById('orientation-section');
    boardSaturdaySectionElement = document.getElementById('board-saturday-section');
    boardSaturdayCheckbox = document.getElementById('print-board-saturday');
    departmentsGridElement = document.querySelector('.departments-grid');
    checkAllButton = document.getElementById('check-all-depts');
    uncheckAllButton = document.getElementById('uncheck-all-depts');

    if (!modalElement) {
        logger.error('Print modal elements not found in DOM');
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

    // Orientation radio buttons
    document.querySelectorAll('input[name="print-orientation"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            console.log('Orientation changed to:', e.target.value);
            setCurrentOrientation(e.target.value);
        });
    });

    // Board schedule: Include Saturday checkbox
    if (boardSaturdayCheckbox) {
        // Sync DOM → state on init (HTML default is checked).
        setIncludeBoardSaturday(boardSaturdayCheckbox.checked);
        boardSaturdayCheckbox.addEventListener('change', (e) => {
            setIncludeBoardSaturday(e.target.checked);
        });
    }

    // Week select change
    if (weekSelectElement) {
        weekSelectElement.addEventListener('change', () => updateWeekDates(weekSelectElement));
    }

    // Department check all/uncheck all
    if (checkAllButton) {
        checkAllButton.addEventListener('click', () => {
            document.querySelectorAll('.departments-grid input[type="checkbox"]').forEach(cb => cb.checked = true);
            document.querySelectorAll('.departments-grid .dept-chip').forEach(chip => chip.classList.add('selected'));
            saveDepartmentSelection();
        });
    }

    if (uncheckAllButton) {
        uncheckAllButton.addEventListener('click', () => {
            document.querySelectorAll('.departments-grid input[type="checkbox"]').forEach(cb => cb.checked = false);
            document.querySelectorAll('.departments-grid .dept-chip').forEach(chip => chip.classList.remove('selected'));
            saveDepartmentSelection();
        });
    }

    logger.info('Print modal initialized');
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
        logger.error('Print modal not initialized');
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
    // Populate week select
    populateWeekSelect(weekSelectElement);

    // Set date input to tomorrow
    setDefaultDate(dateSelectElement);

    // Populate departments grid
    populateDepartmentsGrid(departmentsGridElement, saveDepartmentSelection);

    updatePrintTypeDisplay();
}

/**
 * Update print type display (week vs day vs frozen-daily vs phase-start)
 * @private
 */
function updatePrintTypeDisplay() {
    const checkedRadio = document.querySelector('input[name="print-type"]:checked');
    const printType = (checkedRadio && checkedRadio.value) || 'week';
    setCurrentPrintType(printType);

    // Swap the department-list kind based on the print type. Buy-in has its
    // own fixed list (BUY_IN_DEPARTMENTS, includes Batch+Layout) and its own
    // saved selection — every other print type shares the legacy list. The
    // re-populate below picks up whichever kind is now active so the user
    // sees the correct chips when they flip between print types.
    setCurrentDeptListKind(printType === 'buy-in' ? 'buy-in' : 'default');
    if (departmentsGridElement) {
        populateDepartmentsGrid(departmentsGridElement, saveDepartmentSelection);
    }

    if (weekSectionElement && daySectionElement && frozenDailySectionElement && departmentsSectionElement && orientationSectionElement) {
        // Default: hide the board-only "Include Saturday" toggle. The
        // board-11x17 branch below switches it back on.
        if (boardSaturdaySectionElement) boardSaturdaySectionElement.style.display = 'none';

        if (printType === 'week' || printType === 'phase-start') {
            // Both week and phase-start use week selector and departments
            weekSectionElement.style.display = 'block';
            daySectionElement.style.display = 'none';
            frozenDailySectionElement.style.display = 'none';
            departmentsSectionElement.style.display = 'block';
            orientationSectionElement.style.display = 'none';
        } else if (printType === 'board-11x17') {
            // Board schedule uses week selector only; departments are fixed
            // (Layout/Cast/Demold) and page size is locked to 11×17 landscape.
            weekSectionElement.style.display = 'block';
            daySectionElement.style.display = 'none';
            frozenDailySectionElement.style.display = 'none';
            departmentsSectionElement.style.display = 'none';
            orientationSectionElement.style.display = 'none';
            if (boardSaturdaySectionElement) boardSaturdaySectionElement.style.display = 'block';
        } else if (printType === 'buy-in') {
            // Buy-in sheets use the week selector and the (buy-in-specific)
            // department picker. Default list is the 14 production crews
            // (Special Events + Facilities excluded; Batch + Layout included).
            // Page size locked to letter landscape to match the source form.
            weekSectionElement.style.display = 'block';
            daySectionElement.style.display = 'none';
            frozenDailySectionElement.style.display = 'none';
            departmentsSectionElement.style.display = 'block';
            orientationSectionElement.style.display = 'none';

            // Buy-in sheets are filled out ahead of time — default the week
            // selector to next calendar week (falls back to the standard
            // viewed-week default if that week isn't in the schedule).
            selectNextCalendarWeek(weekSelectElement);
        } else if (printType === 'day') {
            weekSectionElement.style.display = 'none';
            daySectionElement.style.display = 'block';
            frozenDailySectionElement.style.display = 'none';
            departmentsSectionElement.style.display = 'block';
            orientationSectionElement.style.display = 'block';
        } else if (printType === 'frozen-daily') {
            // Frozen daily uses date selector, no department selection
            weekSectionElement.style.display = 'none';
            daySectionElement.style.display = 'none';
            frozenDailySectionElement.style.display = 'block';
            departmentsSectionElement.style.display = 'none';
            orientationSectionElement.style.display = 'none';

            // Set default date to next business day
            if (frozenDailyDateSelectElement && window.PrintUtils && window.PrintUtils.getNextBusinessDay) {
                const nextBusinessDay = window.PrintUtils.getNextBusinessDay();
                const year = nextBusinessDay.getFullYear();
                const month = String(nextBusinessDay.getMonth() + 1).padStart(2, '0');
                const day = String(nextBusinessDay.getDate()).padStart(2, '0');
                frozenDailyDateSelectElement.value = `${year}-${month}-${day}`;
            }
        }
    }
}

/**
 * Handle print execution
 * @private
 */
function handlePrintExecute() {
    const printType = getCurrentPrintType();

    let printDates;
    let selectedDepts;

    // Board schedule: fixed departments (Layout/Cast/Demold), week selector only.
    if (printType === 'board-11x17') {
        selectedDepts = []; // renderer ignores this and uses its own fixed set
        printDates = preparePrintDates('week', weekSelectElement, null);
        if (!printDates || printDates.length === 0) {
            alert('Please select a week for the board schedule.');
            return;
        }
        logger.info('Board schedule print: week prepared', {
            firstDay: printDates[0] && printDates[0].toDateString(),
            dayCount: printDates.length
        });
    }
    // Buy-in sheets: user picks which crew sheets to print from a dedicated
    // dept list (Mill, Form Out, Cast, Batch, Samples, Demold, Layout, Finish,
    // Seal, Final Insp., Special, Crate / Ship — Special Events and Facilities
    // are excluded at the picker level; Crating + Load + Ship collapse into a
    // single combined "Crate / Ship" sheet with split CRATE / SHIPPING columns).
    // One page per checked dept.
    else if (printType === 'buy-in') {
        selectedDepts = getSelectedDepartments();
        if (selectedDepts.length === 0) {
            alert('Please select at least one department for the buy-in sheets.');
            return;
        }
        printDates = preparePrintDates('week', weekSelectElement, null);
        if (!printDates || printDates.length === 0) {
            alert('Please select a week for the buy-in sheets.');
            return;
        }
    }
    // Handle frozen-daily separately
    else if (printType === 'frozen-daily') {
        // Frozen daily doesn't need department selection - includes all departments
        // Use selected date from frozen-daily date selector
        if (frozenDailyDateSelectElement && frozenDailyDateSelectElement.value) {
            const selectedDate = new Date(frozenDailyDateSelectElement.value + 'T00:00:00');
            printDates = [selectedDate];
            selectedDepts = []; // Empty means all departments

            logger.info('Frozen daily print: Using selected date', {
                date: selectedDate.toDateString()
            });
        } else {
            alert('Please select a date for the frozen daily report.');
            return;
        }
    } else {
        // Normal week/day print - get selected departments
        selectedDepts = getSelectedDepartments();

        // Validate configuration
        const validation = validatePrintConfig(printType, selectedDepts, dateSelectElement);
        if (!validation.valid) {
            alert(validation.error);
            return;
        }

        // Prepare print dates
        printDates = preparePrintDates(printType, weekSelectElement, dateSelectElement);
    }

// Generate print content using external utilities
    const allTasks = getAllTasks();
    
    // Debug logging to help troubleshoot print issues
    logger.info('Print execution started', {
        printType,
        selectedDepartments: selectedDepts,
        totalTasks: allTasks.length,
        printUtilsAvailable: !!window.PrintUtils,
        generatePrintContentAvailable: !!(window.PrintUtils && window.PrintUtils.generatePrintContent)
    });
    
    if (window.PrintUtils && window.PrintUtils.generatePrintContent) {
        const printOptions = {
            includeBoardSaturday: getIncludeBoardSaturday()
        };
        const printContent = window.PrintUtils.generatePrintContent(printType, selectedDepts, printDates, allTasks, printOptions);

        if (printContent) {
            logger.info('Print content generated successfully', {
                pagesCreated: printContent.querySelectorAll('.print-page').length,
                hasTables: printContent.querySelectorAll('table').length > 0,
                hasHeaders: printContent.querySelectorAll('.print-department-header').length > 0
            });
            const orientation = getCurrentOrientation();
            console.log('Passing orientation to executePrint:', orientation, 'for printType:', printType);
            window.PrintUtils.executePrint(printContent, printType, orientation);
        } else {
            logger.error('Failed to generate print content');
            alert('Failed to generate print content. Please try again.');
        }
    } else {
        logger.error('Print utilities not available', {
            windowPrintUtils: !!window.PrintUtils,
            availableFunctions: window.PrintUtils ? Object.keys(window.PrintUtils) : 'none'
        });
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
