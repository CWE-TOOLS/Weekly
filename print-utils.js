/**
 * Print Utilities - Centralized print functionality for the Weekly Schedule Viewer
 * Handles print report generation, page breaks, and layout management
 * 
 * This file now serves as a bridge to the modular print system
 */

// Print configuration constants
const PRINT_UTILS = {
    PAGE_WIDTH_INCHES: 10.5,
    PAGE_HEIGHT_INCHES: 8.0, // Approximate for landscape letter
    DEPARTMENT_ORDER: [
        'Special Events',
        'Mill',
        'Form Out',
        'Cast',
        'Batch',
        'Demold',
        'Layout',
        'Finish',
        'Seal',
        'Special',
        'Crating',
        'Load',
        'Ship'
    ]
};

/**
 * Generate department color mapping
 */
function getDepartmentColorMapping() {
    return {
        'mill': { bg: '#06B6D4', text: '#FFFFFF' },
        'form-out': { bg: '#3B82F6', text: '#FFFFFF' },
        'cast': { bg: '#EF4444', text: '#FFFFFF' },
        'batch': { bg: '#800000', text: '#FFFFFF' },
        'layout': { bg: '#A16207', text: '#FFFFFF' },
        'demold': { bg: '#F97316', text: '#FFFFFF' },
        'finish': { bg: '#8B5CF6', text: '#FFFFFF' },
        'seal': { bg: '#6B7280', text: '#FFFFFF' },
        'special': { bg: '#EC4899', text: '#FFFFFF' },
        'crating': { bg: '#A16207', text: '#FFFFFF' },
        'load': { bg: '#F59E0B', text: '#FFFFFF' },
        'ship': { bg: '#22C55E', text: '#FFFFFF' }
    };
}

/**
 * Parse date from various formats (MM/DD/YYYY, YYYY-MM-DD, Date object)
 */
function parseDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;

    // Handle MM/DD/YYYY format
    const slashParts = dateStr.split('/');
    if (slashParts.length === 3) {
        const [month, day, year] = slashParts.map(Number);
        const date = new Date(year, month - 1, day);
        return isNaN(date.getTime()) ? null : date;
    }

    // Handle YYYY-MM-DD format
    const dashParts = dateStr.split('-');
    if (dashParts.length === 3) {
        const [year, month, day] = dashParts.map(Number);
        const date = new Date(year, month - 1, day);
        return isNaN(date.getTime()) ? null : date;
    }

    // Try standard date parsing
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
}

/**
 * Normalize department class name for CSS
 */
function normalizeDepartmentClass(dept) {
    if (!dept) return '';
    return dept.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

/**
 * Calculate maximum number of tasks for a department across given dates
 */
function getMaxTasksForDept(dept, tasks, dates, printType) {
    if (dept === 'Batch' || dept === 'Layout') return 1;

    let max = 0;
    if (printType === 'week') {
        dates.forEach(date => {
            const dateString = date.toDateString();
            const count = tasks.filter(t => {
                const taskDate = parseDate(t.date);
                return taskDate && taskDate.toDateString() === dateString;
            }).length;
            if (count > max) max = count;
        });
    } else {
        const dateString = dates[0].toDateString();
        const count = tasks.filter(t => {
            const taskDate = parseDate(t.date);
            return taskDate && taskDate.toDateString() === dateString;
        }).length;
        max = count;
    }
    return max;
}

/**
 * Generate complete print content for selected departments
 * This now delegates to the modular print renderer
 */
function generatePrintContent(printType, selectedDepts, weekDates, allTasks) {
    // Check if modular system is loaded
    if (!window.PrintRenderer || !window.PrintLayout) {
        console.error('Print modules not loaded. Falling back to legacy system.');
        return generatePrintContentLegacy(printType, selectedDepts, weekDates, allTasks);
    }
    
    // Use the new modular renderer
    return window.PrintRenderer.generatePrintContent(printType, selectedDepts, weekDates, allTasks);
}

/**
 * Execute print with proper setup and cleanup
 * This now delegates to the modular print renderer
 */
function executePrint(printContent, printType = 'week') {
    // Check if modular system is loaded
    if (!window.PrintRenderer) {
        console.error('Print renderer not loaded. Falling back to legacy system.');
        return executePrintLegacy(printContent, printType);
    }
    
    // Use the new modular renderer
    window.PrintRenderer.executePrint(printContent, printType);
}

/**
 * Legacy fallback: Generate print content (old system)
 * Kept for backward compatibility
 */
function generatePrintContentLegacy(printType, selectedDepts, weekDates, allTasks) {
    console.warn('Using legacy print system');
    const printContainer = document.createElement('div');
    printContainer.className = 'print-preview-content';
    printContainer.innerHTML = '<p>Legacy print system - please ensure print modules are loaded</p>';
    return printContainer;
}

/**
 * Legacy fallback: Execute print (old system)
 * Kept for backward compatibility
 */
function executePrintLegacy(printContent, printType = 'week') {
    console.warn('Using legacy print execution');
    
    let dynamicStyle = null;
    if (printType === 'day') {
        dynamicStyle = document.createElement('style');
        dynamicStyle.textContent = '@page { size: letter portrait; margin: 0.5in; }';
        document.head.appendChild(dynamicStyle);
    }
    
    const blankPageFix = document.createElement('style');
    blankPageFix.textContent = `
        @media print {
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            .print-page {
                page-break-after: avoid !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                margin-bottom: 0 !important;
            }
            .print-page:last-child {
                page-break-after: avoid !important;
                margin-bottom: 0 !important;
            }
        }
    `;
    document.head.appendChild(blankPageFix);
    
    document.body.appendChild(printContent);
    
    setTimeout(() => {
        window.print();
        if (dynamicStyle) {
            document.head.removeChild(dynamicStyle);
        }
        document.head.removeChild(blankPageFix);
        document.body.removeChild(printContent);
    }, 1500);
}

// Export functions for global use
window.PrintUtils = {
    generatePrintContent,
    executePrint,
    getDepartmentColorMapping,
    normalizeDepartmentClass,
    parseDate,
    getMaxTasksForDept,
    PRINT_UTILS
};