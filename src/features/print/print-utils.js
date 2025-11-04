/**
 * Print Utilities - Centralized print functionality for the Weekly Schedule Viewer
 * Handles print report generation, page breaks, and layout management
 *
 * This file now serves as a bridge to the modular print system
 */

import { generateBatchTasks, generateLayoutTasks } from '../../utils/schedule-utils.js';
import { DATE_BOUNDARIES, PRINT_LAYOUT } from '../../config/layout-constants.js';
import { RENDER_DELAY } from '../../config/timing-constants.js';
import { logger } from '../../utils/logger.js';
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
        'Ship',
        'Samples'
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
 * Parse date from various formats (MM/DD/YYYY, YYYY-MM-DD, Date object, etc.)
 */
function parseDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;

    // Trim whitespace
    const trimmed = dateStr.toString().trim();

    // Handle slash-separated formats: MM/DD/YYYY, DD/MM/YYYY, MM/DD/YY, DD/MM/YY
    const slashParts = trimmed.split('/');
    if (slashParts.length === 3) {
        let [part1, part2, part3] = slashParts.map(s => s.trim());
        let month, day, year;

        // Determine if it's MM/DD/YYYY or DD/MM/YYYY based on first part
        const num1 = Number(part1);
        const num2 = Number(part2);
        let num3 = Number(part3);

        // Handle 2-digit years
        if (num3 < 100) {
            num3 += num3 < DATE_BOUNDARIES.YEAR_BOUNDARY_THRESHOLD ? DATE_BOUNDARIES.CENTURY_2000 : DATE_BOUNDARIES.CENTURY_1900; // Assume 1950-2049 range
        }

        if (num1 > 12) {
            // Must be DD/MM/YYYY format
            day = num1;
            month = num2;
            year = num3;
        } else if (num2 > 12) {
            // Must be MM/DD/YYYY format
            month = num1;
            day = num2;
            year = num3;
        } else {
            // Ambiguous, assume MM/DD/YYYY (US format)
            month = num1;
            day = num2;
            year = num3;
        }

        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) return date;
    }

    // Handle dash-separated formats: YYYY-MM-DD, DD-MM-YYYY, MM-DD-YYYY
    const dashParts = trimmed.split('-');
    if (dashParts.length === 3) {
        let [part1, part2, part3] = dashParts.map(s => s.trim());
        let year, month, day;

        const num1 = Number(part1);
        const num2 = Number(part2);
        const num3 = Number(part3);

        if (num1 > 31) {
            // YYYY-MM-DD format
            year = num1;
            month = num2;
            day = num3;
        } else if (num2 > 12) {
            // DD-MM-YYYY format
            day = num1;
            month = num2;
            year = num3;
        } else {
            // Assume MM-DD-YYYY or DD-MM-YYYY, try both
            // First try MM-DD-YYYY
            let date = new Date(num3, num1 - 1, num2);
            if (!isNaN(date.getTime())) return date;

            // Then try DD-MM-YYYY
            date = new Date(num3, num2 - 1, num1);
            if (!isNaN(date.getTime())) return date;
        }

        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) return date;
    }

    // Handle dot-separated formats: DD.MM.YYYY, MM.DD.YYYY
    const dotParts = trimmed.split('.');
    if (dotParts.length === 3) {
        let [part1, part2, part3] = dotParts.map(s => s.trim());
        let month, day, year;

        const num1 = Number(part1);
        const num2 = Number(part2);
        const num3 = Number(part3);

        // Assume DD.MM.YYYY (common European format)
        if (num1 > 12) {
            day = num1;
            month = num2;
        } else {
            // Could be ambiguous, assume DD.MM.YYYY
            day = num1;
            month = num2;
        }
        year = num3;
        if (year < 100) year += year < DATE_BOUNDARIES.YEAR_BOUNDARY_THRESHOLD ? DATE_BOUNDARIES.CENTURY_2000 : DATE_BOUNDARIES.CENTURY_1900;

        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) return date;
    }

    // Try standard date parsing as fallback
    const date = new Date(trimmed);
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

    const deptTasks = tasks.filter(t => t.department === dept);

    if (printType === 'week') {
        if (!dates || dates.length === 0) return 0;
        let max = 0;
        dates.forEach(date => {
            if (!date) return;
            const dateString = date.toDateString();
            const count = deptTasks.filter(t => {
                const taskDate = parseDate(t.date);
                return taskDate && taskDate.toDateString() === dateString;
            }).length;
            if (count > max) max = count;
        });
        return max;
    } else {
        // For daily print, count all tasks for the specific day
        if (!dates || dates.length === 0) return 0;
        const dateString = dates[0].toDateString();
        return deptTasks.filter(t => {
            const taskDate = parseDate(t.date);
            return taskDate && taskDate.toDateString() === dateString;
        }).length;
    }
}

/**
 * Generate complete print content for selected departments
 * This delegates to the modular print renderer
 */
import * as PrintRenderer from './print-renderer.js';

function generatePrintContent(printType, selectedDepts, weekDates, allTasks) {
    // Use the modular renderer
    return PrintRenderer.generatePrintContent(printType, selectedDepts, weekDates, allTasks);
}

/**
 * Execute print with proper setup and cleanup
 * This delegates to the modular print renderer
 */
function executePrint(printContent, printType = 'week') {
    // Use the modular renderer
    PrintRenderer.executePrint(printContent, printType);
}

/**
 * Apply intelligent auto-scaling with department-per-page optimization
 * Enhanced scaling that respects department boundaries and prevents content overflow
 */
function applyScaling(printContent, printType, isPreview = false) {
    const pages = printContent.querySelectorAll('.print-page');
    if (!pages.length) return;

    // Define the printable area, accounting for 0.25" margins on a standard letter page
    const printableWidth = (printType === 'day' ? 8.0 : 10.5) * 96; // 8.5" - 0.5" margins
    const printableHeight = (printType === 'day' ? 10.5 : 8.0) * 96; // 11" - 0.5" margins

    // Use configuration constants for scaling parameters
    const BASE_FONT_SIZE = PRINT_LAYOUT.BASE_FONT_SIZE_PT;
    const MIN_FONT_SIZE = PRINT_LAYOUT.DEPARTMENT_PER_PAGE.MIN_FONT_SIZE_PT;
    const MAX_FONT_SIZE = PRINT_LAYOUT.DEPARTMENT_PER_PAGE.MAX_FONT_SIZE_PT;

    requestAnimationFrame(() => {
        setTimeout(() => {
            pages.forEach((page, index) => {
                // Reset styles for accurate measurement
                page.style.transform = 'none';
                page.style.width = 'auto'; // Let content determine width
                page.style.height = 'auto';
                
                // For non-optimized pages, we do font-size reduction first
                if (!page.classList.contains('print-page-optimized')) {
                    page.style.fontSize = `${BASE_FONT_SIZE}pt`;
                    page.offsetHeight; // Force reflow

                    let currentFontSize = Math.min(BASE_FONT_SIZE, MAX_FONT_SIZE);
                    const FONT_STEP = 0.5;

                    // Iteratively shrink font size until the content fits height
                    while (page.scrollHeight > printableHeight && currentFontSize > MIN_FONT_SIZE) {
                        currentFontSize -= FONT_STEP;
                        page.style.fontSize = `${currentFontSize}pt`;
                        page.offsetHeight; // Re-measure
                    }
                }

                page.offsetHeight; // reflow to get final dimensions

                const contentWidth = page.scrollWidth;
                const contentHeight = page.scrollHeight;

                const widthScale = contentWidth > 0 ? printableWidth / contentWidth : 1;
                const heightScale = contentHeight > 0 ? printableHeight / contentHeight : 1;

                let finalScale = Math.min(widthScale, heightScale, 1.0);

                // Apply additional 5% reduction for margins
                finalScale *= 0.95;

                page.style.width = `${printableWidth}px`; // Set fixed width for transform
                page.style.transform = `scale(${finalScale})`;
                page.style.transformOrigin = 'top left'; // Use top left for consistency with margins

                logger.info(`Page ${index + 1} scaling applied: ${(finalScale * 100).toFixed(1)}%`);
            });
        }, RENDER_DELAY.PRINT_RENDER);
    });
}


// Export functions for global use
window.PrintUtils = {
    generatePrintContent,
    executePrint,
    getDepartmentColorMapping,
    normalizeDepartmentClass,
    parseDate,
    getMaxTasksForDept,
    generateBatchTasks,  // Re-export from schedule-utils.js
    generateLayoutTasks,  // Re-export from schedule-utils.js
    applyScaling,
    PRINT_UTILS
};