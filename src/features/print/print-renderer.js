/**
 * Print Renderer - Modular rendering system for print reports
 * Handles page assembly and print execution with proper page break management
 */

import { logger } from '../../utils/logger.js';
import { REVENUE } from '../../config/business-constants.js';
import { PRINT_LAYOUT, CONTENT_LIMITS } from '../../config/layout-constants.js';
import { RENDER_DELAY } from '../../config/timing-constants.js';

import { parseDate } from '../../utils/date-utils.js';
import * as PrintLayout from './print-layout.js';
import * as DepartmentUtils from '../../utils/department-utils.js';
import { generateBatchTasks, generateLayoutTasks } from '../../utils/schedule-utils.js';

// ============================================
// PAGE ASSEMBLY
// ============================================

/**
 * Create a single department page with proper structure
 * Can optionally include a synthetic department (Batch for Cast, Layout for Demold)
 */

function createDepartmentPage(dept, tasks, dates, printType, isCompact, colors, syntheticTasks = null, syntheticDeptName = null) {
    const pageDiv = document.createElement('div');
    pageDiv.className = `print-page ${printType === 'day' ? 'print-page-day' : ''}`;
    // Removed inline styles - let CSS handle layout and sizing

    // Calculate totals for main department
    let totalHours = 0;
    tasks.forEach(task => {
        const hours = parseFloat(task.hours);
        if (!isNaN(hours)) {
            totalHours += hours;
        }
    });
    const revenue = Math.round(totalHours * REVENUE.HOURLY_RATE);

    // Create components for main department
    const deptHeader = PrintLayout.createDepartmentHeader(dept, printType, colors);
    const table = PrintLayout.createDepartmentTable(dept, tasks, dates, printType, isCompact, totalHours, revenue);

    // Create components for synthetic department if provided
    let syntheticHeader = null;
    let syntheticTable = null;
    if (syntheticTasks && syntheticTasks.length > 0 && syntheticDeptName) {
        const syntheticColors = window.PrintUtils.getDepartmentColorMapping()[window.PrintUtils.normalizeDepartmentClass(syntheticDeptName)] || { bg: '#333', text: '#FFFFFF' };
        syntheticHeader = PrintLayout.createDepartmentHeader(syntheticDeptName, printType, syntheticColors);
        syntheticTable = PrintLayout.createDepartmentTable(syntheticDeptName, syntheticTasks, dates, printType, isCompact, 0, 0); // Summary not needed for synthetic
    }

    if (printType === 'day') {
        // Day layout: vertical stack
        deptHeader.style.width = '100%';
        deptHeader.style.textAlign = 'center';
        deptHeader.style.writingMode = 'horizontal-tb';
        deptHeader.style.textOrientation = 'mixed';
        deptHeader.style.maxWidth = '800px';
        deptHeader.style.margin = '0 auto';
        table.style.width = '100%';
        table.style.maxWidth = '800px';
        table.style.margin = '0 auto';

        pageDiv.appendChild(deptHeader);
        pageDiv.appendChild(table);

        // Add synthetic department section if present
        if (syntheticHeader && syntheticTable) {
            syntheticHeader.style.width = '100%';
            syntheticHeader.style.textAlign = 'center';
            syntheticHeader.style.writingMode = 'horizontal-tb';
            syntheticHeader.style.textOrientation = 'mixed';
            syntheticHeader.style.maxWidth = '800px';
            syntheticHeader.style.margin = '1rem auto 0 auto';
            syntheticTable.style.width = '100%';
            syntheticTable.style.maxWidth = '800px';
            syntheticTable.style.margin = '0 auto';

            pageDiv.appendChild(syntheticHeader);
            pageDiv.appendChild(syntheticTable);
        }
    } else {
        // Week layout: sidebar with header, table
        const mainContentDiv = document.createElement('div');
        mainContentDiv.style.display = 'flex';
        mainContentDiv.style.alignItems = 'stretch';
        mainContentDiv.style.justifyContent = 'flex-start';

        mainContentDiv.appendChild(deptHeader);
        mainContentDiv.appendChild(table);

        pageDiv.appendChild(mainContentDiv);

        // Add synthetic department section if present
        if (syntheticHeader && syntheticTable) {
            const syntheticContentDiv = document.createElement('div');
            syntheticContentDiv.style.display = 'flex';
            syntheticContentDiv.style.alignItems = 'stretch';
            syntheticContentDiv.style.justifyContent = 'flex-start';
            syntheticContentDiv.style.marginTop = '1rem';

            syntheticContentDiv.appendChild(syntheticHeader);
            syntheticContentDiv.appendChild(syntheticTable);

            pageDiv.appendChild(syntheticContentDiv);
        }
    }

    return pageDiv;
}

/**
 * Calculate task density and apply appropriate CSS class
 * This helps the CSS apply appropriate sizing for different task counts
 */
function applyDensityClass(page, taskCount, printType) {
    // Remove any existing density classes
    page.classList.remove('few-tasks', 'normal-tasks', 'many-tasks', 'very-many-tasks');

    // Apply density class based on task count
    if (printType === 'week') {
        if (taskCount <= 3) {
            page.classList.add('few-tasks');
        } else if (taskCount <= 6) {
            page.classList.add('normal-tasks');
        } else if (taskCount <= 10) {
            page.classList.add('many-tasks');
        } else {
            page.classList.add('very-many-tasks');
        }
    } else {
        // Daily view has more vertical space
        if (taskCount <= 5) {
            page.classList.add('few-tasks');
        } else if (taskCount <= 10) {
            page.classList.add('normal-tasks');
        } else if (taskCount <= 15) {
            page.classList.add('many-tasks');
        } else {
            page.classList.add('very-many-tasks');
        }
    }
}

/**
 * Create an optimized department page for departments with many tasks
 * Applies aggressive scaling to fit content on a single letter-sized landscape page
 */
function createOptimizedDepartmentPage(dept, tasks, dates, printType, colors, syntheticTasks = null, syntheticDeptName = null, totalTasks = 0) {
    const pageDiv = document.createElement('div');
    pageDiv.className = `print-page print-page-optimized ${printType === 'day' ? 'print-page-day' : ''}`;
    pageDiv.style.cssText = `
        width: 100% !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
        background: white !important;
        page-break-after: auto !important;
        page-break-inside: avoid !important;
    `;

    // Calculate totals for main department
    let totalHours = 0;
    tasks.forEach(task => {
        const hours = parseFloat(task.hours);
        if (!isNaN(hours)) {
            totalHours += hours;
        }
    });
    const revenue = Math.round(totalHours * REVENUE.HOURLY_RATE);

    // Apply ultra-compact styling for large departments
    const fontSize = totalTasks > 12 ?
        PRINT_LAYOUT.DEPARTMENT_PER_PAGE.ULTRA_COMPACT_FONT_SIZE_PT :
        PRINT_LAYOUT.DEPARTMENT_PER_PAGE.COMPACT_FONT_SIZE_PT;

    const spacingReduction = PRINT_LAYOUT.DEPARTMENT_PER_PAGE.SPACING_REDUCTION;
    
    // Create compact header
    const deptHeader = PrintLayout.createDepartmentHeader(dept, printType, colors);
    deptHeader.style.cssText = `
        font-size: ${fontSize + 2}pt !important;
        padding: ${0.3 * spacingReduction.HEADER_PADDING_MULTIPLIER}em ${0.2 * spacingReduction.HEADER_PADDING_MULTIPLIER}em !important;
        margin: 0 !important;
        border: 1px solid #666 !important;
        writing-mode: ${printType === 'day' ? 'horizontal-tb' : 'vertical-rl'} !important;
        text-orientation: mixed !important;
        width: ${printType === 'day' ? '100%' : '2em'} !important;
        min-height: ${printType === 'day' ? '0' : '8em'} !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        background-color: ${colors.bg} !important;
        color: ${colors.text} !important;
        print-color-adjust: exact !important;
        -webkit-print-color-adjust: exact !important;
    `;

    // Create compact table with optimized spacing
    const table = PrintLayout.createDepartmentTable(dept, tasks, dates, printType, true, totalHours, revenue); // Force compact mode
    table.style.cssText = `
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        font-size: ${fontSize}pt !important;
        border-collapse: collapse !important;
        table-layout: fixed !important;
    `;

    // Apply compact styling to table elements
    const tableCells = table.querySelectorAll('td, th');
    tableCells.forEach(cell => {
        cell.style.cssText = `
            border: 1px solid #666 !important;
            padding: ${0.2 * spacingReduction.CELL_PADDING_MULTIPLIER}em !important;
            text-align: center !important;
            vertical-align: top !important;
            font-size: ${fontSize}pt !important;
            font-weight: 500 !important;
        `;
    });

    // Apply compact styling to task cards
    const taskCards = table.querySelectorAll('.print-task-card');
    taskCards.forEach(card => {
        card.style.cssText = `
            font-size: ${fontSize}pt !important;
            padding: ${0.15 * spacingReduction.CARD_MARGIN_MULTIPLIER}em !important;
            margin: ${0.05 * spacingReduction.CARD_MARGIN_MULTIPLIER}em 0 !important;
            border: 1px solid #ccc !important;
            border-radius: 0.1em !important;
            box-shadow: none !important;
            background: white !important;
        `;
    });

    // Layout assembly with minimal spacing
    if (printType === 'day') {
        // Day layout: vertical stack with minimal gaps
        pageDiv.appendChild(deptHeader);
        pageDiv.appendChild(table);

        // Add synthetic department if present
        if (syntheticTasks && syntheticTasks.length > 0 && syntheticDeptName) {
            const syntheticColors = window.PrintUtils.getDepartmentColorMapping()[window.PrintUtils.normalizeDepartmentClass(syntheticDeptName)] || { bg: '#333', text: '#FFFFFF' };
            const syntheticHeader = PrintLayout.createDepartmentHeader(syntheticDeptName, printType, syntheticColors);
            const syntheticTable = PrintLayout.createDepartmentTable(syntheticDeptName, syntheticTasks, dates, printType, true, 0, 0);
            
            syntheticHeader.style.cssText = deptHeader.style.cssText;
            syntheticTable.style.cssText = table.style.cssText;
            
            // Apply same compact styling to synthetic elements
            const syntheticCells = syntheticTable.querySelectorAll('td, th');
            syntheticCells.forEach(cell => {
                cell.style.cssText = cell.style.cssText;
            });
            
            const syntheticCards = syntheticTable.querySelectorAll('.print-task-card');
            syntheticCards.forEach(card => {
                card.style.cssText = card.style.cssText;
            });

            pageDiv.appendChild(syntheticHeader);
            pageDiv.appendChild(syntheticTable);
        }
    } else {
        // Week layout: compact sidebar with minimal spacing
        const mainContentDiv = document.createElement('div');
        mainContentDiv.style.cssText = `
            display: flex !important;
            align-items: stretch !important;
            justify-content: flex-start !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
        `;

        mainContentDiv.appendChild(deptHeader);
        mainContentDiv.appendChild(table);

        pageDiv.appendChild(mainContentDiv);

        // Add synthetic department if present
        if (syntheticTasks && syntheticTasks.length > 0 && syntheticDeptName) {
            const syntheticColors = window.PrintUtils.getDepartmentColorMapping()[window.PrintUtils.normalizeDepartmentClass(syntheticDeptName)] || { bg: '#333', text: '#FFFFFF' };
            const syntheticHeader = PrintLayout.createDepartmentHeader(syntheticDeptName, printType, syntheticColors);
            const syntheticTable = PrintLayout.createDepartmentTable(syntheticDeptName, syntheticTasks, dates, printType, true, 0, 0);
            
            syntheticHeader.style.cssText = deptHeader.style.cssText;
            syntheticTable.style.cssText = table.style.cssText;
            
            const syntheticContentDiv = document.createElement('div');
            syntheticContentDiv.style.cssText = `
                display: flex !important;
                align-items: stretch !important;
                justify-content: flex-start !important;
                margin-top: ${0.5 * spacingReduction.SECTION_MARGIN_MULTIPLIER}em !important;
                width: 100% !important;
            `;
            
            syntheticContentDiv.appendChild(syntheticHeader);
            syntheticContentDiv.appendChild(syntheticTable);
            pageDiv.appendChild(syntheticContentDiv);
        }
    }

    return pageDiv;
}

/**
 * Simplified page break management - CSS handles most of the work now
 */
function applyPageBreakRules(pages) {
    if (!pages || pages.length === 0) return;

    // CSS now handles page breaks, but we ensure inline styles don't interfere
    pages.forEach((page) => {
        page.style.margin = '0';
        page.style.padding = '0';
    });
}

/**
 * Generate frozen daily report content for next business day
 */
function generateFrozenDailyContent(targetDate, allTasks) {
    const printContainer = document.createElement('div');
    printContainer.className = 'print-preview-content frozen-daily-report';

    // Create the page
    const page = document.createElement('div');
    page.className = 'print-page frozen-daily-page';

    // Add header
    const header = PrintLayout.createFrozenDailyHeader(targetDate);
    page.appendChild(header);

    // Filter tasks for target date
    const targetDateString = targetDate.toDateString();
    const dayTasks = allTasks.filter(task => {
        const taskDate = parseDate(task.date);
        return taskDate && taskDate.toDateString() === targetDateString;
    });

    // Group tasks by department
    const { groupTasksByDepartment, sortDepartments } = DepartmentUtils;

    // Generate synthetic tasks for the target date
    const monday = new Date(targetDate);
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
    monday.setDate(diff);

    const batchTasks = generateBatchTasks([targetDate], monday, () => allTasks);
    const layoutTasks = generateLayoutTasks([targetDate], monday, () => allTasks);

    const tasksByDept = groupTasksByDepartment(dayTasks, batchTasks, layoutTasks);
    const sortedDepts = sortDepartments(Object.keys(tasksByDept));

    // Calculate revenue for each department
    const departmentSummaries = [];
    let crateRevenue = 0;
    let loadRevenue = 0;
    let hasCrate = false;
    let hasLoad = false;

    sortedDepts.forEach(dept => {
        const deptData = tasksByDept[dept];
        if (!deptData) return;

        const deptTasks = (deptData.tasks || []).filter(task => {
            const taskDate = parseDate(task.date);
            return taskDate && taskDate.toDateString() === targetDateString;
        });

        const syntheticTasks = (deptData.syntheticTasks || []).filter(task => {
            const taskDate = parseDate(task.date);
            return taskDate && taskDate.toDateString() === targetDateString;
        });

        // Combine regular and synthetic tasks
        const allDeptTasks = [...deptTasks, ...syntheticTasks];

        if (allDeptTasks.length === 0) return;

        // Calculate total revenue for this department
        let totalHours = 0;
        allDeptTasks.forEach(task => {
            const hours = parseFloat(task.hours || 0);
            if (!isNaN(hours)) {
                totalHours += hours;
            }
        });

        const targetRevenue = Math.round(totalHours * REVENUE.HOURLY_RATE);

        // Special handling for Crating and Load - combine into one line
        if (dept === 'Crating') {
            crateRevenue = targetRevenue;
            hasCrate = true;
            return; // Don't add to summaries yet
        } else if (dept === 'Load') {
            loadRevenue = targetRevenue;
            hasLoad = true;
            return; // Don't add to summaries yet
        }

        departmentSummaries.push({
            department: dept,
            targetRevenue: targetRevenue
        });
    });

    // Add combined Crating + Load entry if both exist
    if (hasCrate || hasLoad) {
        const combinedTotal = crateRevenue + loadRevenue;
        departmentSummaries.push({
            department: 'Crating + Load',
            targetRevenue: combinedTotal,
            breakdown: {
                crate: crateRevenue,
                load: loadRevenue
            }
        });
    }

    // Create summary table
    const summaryTable = PrintLayout.createFrozenDailySummaryTable(departmentSummaries);
    page.appendChild(summaryTable);

    // Add notes section
    const notesSection = PrintLayout.createFrozenDailyNotesSection();
    page.appendChild(notesSection);

    printContainer.appendChild(page);
    return printContainer;
}

/**
 * Generate complete print content for selected departments with department-per-page scaling
 */
function generatePrintContent(printType, selectedDepts, weekDates, allTasks) {
    // Handle frozen daily print type
    if (printType === 'frozen-daily') {
        // Use the first date as the target date (should be next business day)
        const targetDate = weekDates && weekDates.length > 0 ? weekDates[0] : new Date();
        return generateFrozenDailyContent(targetDate, allTasks);
    }
    const printContainer = document.createElement('div');
    printContainer.className = 'print-preview-content';

    // 1. Generate all task types
    let monday = (weekDates && weekDates[0]) ? new Date(weekDates[0]) : null;
    if (monday) {
        // Adjust to the Monday of that week
        const day = monday.getDay();
        const diff = monday.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        monday = new Date(monday.setDate(diff));
    }
    const batchTasks = monday ? generateBatchTasks(weekDates, monday, () => allTasks) : [];
    const layoutTasks = monday ? generateLayoutTasks(weekDates, monday, () => allTasks) : [];

    // 2. Group tasks using the centralized utility
    const { groupTasksByDepartment, sortDepartments } = DepartmentUtils;
    const tasksByDept = groupTasksByDepartment(allTasks, batchTasks, layoutTasks);
    const sortedDepts = sortDepartments(Object.keys(tasksByDept));

    // 3. Calculate layout compactness
    const isCompact = selectedDepts.length > CONTENT_LIMITS.COMPACT_LAYOUT_DEPT_THRESHOLD || printType === 'day';

    const pages = [];

    // 4. Iterate over sorted, selected departments to generate pages
    sortedDepts.forEach((dept) => {
        if (!selectedDepts.includes(dept)) return;

        const deptData = tasksByDept[dept];
        if (!deptData) return;

        // Filter tasks by the selected date range
        const filterByDate = (task) => {
            const taskDate = parseDate(task.date);
            if (!taskDate) return false;
            if (printType === 'week') {
                return weekDates.some(d => d && d.toDateString() === taskDate.toDateString());
            }
            return weekDates[0] && taskDate.toDateString() === weekDates[0].toDateString();
        };

        const deptTasks = (deptData.tasks || []).filter(filterByDate);
        const syntheticTasks = (deptData.syntheticTasks || []).filter(filterByDate);
        const syntheticDeptName = deptData.syntheticDeptName;

        if (deptTasks.length === 0 && syntheticTasks.length === 0) return;

        const colors = window.PrintUtils.getDepartmentColorMapping()[window.PrintUtils.normalizeDepartmentClass(dept)] || { bg: '#333', text: '#FFFFFF' };
        
        // 4.1. Handle department-per-page scaling for large departments
        const maxTaskCount = window.PrintUtils.getMaxTasksForDept(dept, deptTasks, weekDates, printType);
        const totalTasks = maxTaskCount + (syntheticTasks ? syntheticTasks.filter(filterByDate).length : 0);
        
        if (PRINT_LAYOUT.DEPARTMENT_PER_PAGE.ENABLED && totalTasks > PRINT_LAYOUT.DEPARTMENT_PER_PAGE.MAX_TASKS_BEFORE_SPLIT) {
            // Create optimized department page with aggressive scaling
            const optimizedPage = createOptimizedDepartmentPage(dept, deptTasks, weekDates, printType, colors, syntheticTasks, syntheticDeptName, totalTasks);
            pages.push(optimizedPage);
            printContainer.appendChild(optimizedPage);
        } else {
            // Create standard department page
            const page = createDepartmentPage(dept, deptTasks, weekDates, printType, isCompact, colors, syntheticTasks, syntheticDeptName);
            applyDensityClass(page, maxTaskCount, printType);
            pages.push(page);
            printContainer.appendChild(page);
        }
    });

    applyPageBreakRules(pages);
    return printContainer;
}

/**
 * Apply robust auto-scaling to fit content within page bounds
 * Measures actual rendered dimensions and applies CSS transform scaling
 */
function applyPrintScaling(printContent, printType) {
    // Delegate scaling to the centralized utility
    window.PrintUtils.applyScaling(printContent, printType, false);
}

/**
 * Execute print with proper setup and cleanup
 */
function executePrint(printContent, printType = 'week') {
    // Create dynamic print styles for portrait orientation (daily view)
    let dynamicStyle = null;
    if (printType === 'day') {
        dynamicStyle = document.createElement('style');
        dynamicStyle.textContent = '@page { size: letter portrait; margin: 0.5in; }';
        document.head.appendChild(dynamicStyle);
    }

    // Add print color preservation
    const colorFix = document.createElement('style');
    colorFix.textContent = `
        @media print {
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
        }
    `;
    document.head.appendChild(colorFix);

    document.body.appendChild(printContent);

    // Apply scaling if needed
    applyPrintScaling(printContent, printType);

    // Execute print after scaling completes
    setTimeout(() => {
        window.print();

        // Cleanup
        if (dynamicStyle) {
            document.head.removeChild(dynamicStyle);
        }
        document.head.removeChild(colorFix);
        document.body.removeChild(printContent);
    }, RENDER_DELAY.PRINT_EXEC);
}

// Export rendering functions
export {
    createDepartmentPage,
    createOptimizedDepartmentPage,
    applyDensityClass,
    applyPageBreakRules,
    generatePrintContent,
    generateFrozenDailyContent,
    applyPrintScaling,
    executePrint
};