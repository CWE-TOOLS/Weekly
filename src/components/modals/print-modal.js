/**
 * Print Modal Component
 * Handles print configuration and print execution
 * @module components/modals/print-modal
 */

// Imports
import { getAllTasks } from '../../core/state.js';
import { emit, EVENTS } from '../../core/event-bus.js';
import { logger } from '../../utils/logger.js';
import {
    getCurrentPrintType,
    setCurrentPrintType,
    getCurrentPrintWeekDates,
    populateWeekSelect,
    setDefaultDate,
    populateDepartmentsGrid,
    saveDepartmentSelection,
    getSelectedDepartments,
    updateWeekDates,
    validatePrintConfig,
    preparePrintDates
} from './print-config-manager.js';
import {
    initializePreviewElements,
    setupPreviewCloseHandler,
    setupPreviewKeyHandler,
    showPreviewModal,
    hidePreviewModal
} from './print-preview-renderer.js';

// Private state
let modalElement = null;
let closeButton = null;
let cancelButton = null;
let executeButton = null;
let previewButton = null;
let weekSelectElement = null;
let dateSelectElement = null;
let weekSectionElement = null;
let daySectionElement = null;
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
    previewButton = document.getElementById('print-preview-btn');
    weekSelectElement = document.getElementById('print-week-select');
    dateSelectElement = document.getElementById('print-date-select');
    weekSectionElement = document.getElementById('week-select-section');
    daySectionElement = document.getElementById('day-select-section');
    departmentsGridElement = document.querySelector('.departments-grid');
    checkAllButton = document.getElementById('check-all-depts');
    uncheckAllButton = document.getElementById('uncheck-all-depts');

    // Initialize preview modal elements
    initializePreviewElements();

    if (!modalElement) {
        logger.error('Print modal elements not found in DOM');
        return;
    }

    // Set up event listeners
    closeButton.addEventListener('click', hidePrintModal);
    cancelButton.addEventListener('click', hidePrintModal);
    executeButton.addEventListener('click', handlePrintExecute);

    if (previewButton) {
        previewButton.addEventListener('click', handlePrintPreview);
    }

    // Setup preview modal handlers
    setupPreviewCloseHandler(hidePreviewModal);
    setupPreviewKeyHandler(hidePreviewModal);

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
        weekSelectElement.addEventListener('change', () => updateWeekDates(weekSelectElement));
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
 * Update print type display (week vs day)
 * @private
 */
function updatePrintTypeDisplay() {
    const checkedRadio = document.querySelector('input[name="print-type"]:checked');
    const printType = (checkedRadio && checkedRadio.value) || 'week';
    setCurrentPrintType(printType);

    if (weekSectionElement && daySectionElement) {
        if (printType === 'week') {
            weekSectionElement.style.display = 'block';
            daySectionElement.style.display = 'none';
        } else {
            weekSectionElement.style.display = 'none';
            daySectionElement.style.display = 'block';
        }
    }
}

/**
 * Handle print execution
 * @private
 */
function handlePrintExecute() {
    const printType = getCurrentPrintType();
    const selectedDepts = getSelectedDepartments();

    // Validate configuration
    const validation = validatePrintConfig(printType, selectedDepts, dateSelectElement);
    if (!validation.valid) {
        alert(validation.error);
        return;
    }

    // Prepare print dates
    const printDates = preparePrintDates(printType, weekSelectElement, dateSelectElement);

    // Generate print content using external utilities
    const allTasks = getAllTasks();
    if (window.PrintUtils && window.PrintUtils.generatePrintContent) {
        const printContent = window.PrintUtils.generatePrintContent(printType, selectedDepts, printDates, allTasks);

        if (printContent) {
            window.PrintUtils.executePrint(printContent, printType);
        }
    } else {
        logger.error('Print utilities not available');
        alert('Print system not available. Please refresh the page.');
    }
}

/**
 * Handle print preview
 * @private
 */
function handlePrintPreview() {
    const printType = getCurrentPrintType();
    const selectedDepts = getSelectedDepartments();

    // Validate configuration
    const validation = validatePrintConfig(printType, selectedDepts, dateSelectElement);
    if (!validation.valid) {
        alert(validation.error);
        return;
    }

    // Prepare print dates
    const printDates = preparePrintDates(printType, weekSelectElement, dateSelectElement);

    // Generate print content using external utilities
    const allTasks = getAllTasks();
    if (window.PrintUtils && window.PrintUtils.generatePrintContent) {
        const printContent = window.PrintUtils.generatePrintContent(printType, selectedDepts, printDates, allTasks);

        if (printContent) {
            showPreviewModal(printContent, printType, modalElement);
        }
    } else {
        logger.error('Print utilities not available');
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
