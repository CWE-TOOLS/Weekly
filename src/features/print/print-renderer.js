/**
 * Print Renderer - Modular rendering system for print reports
 * Handles page assembly and print execution with proper page break management
 */

import { logger } from '../../utils/logger.js';
import { REVENUE } from '../../config/business-constants.js';
import { PRINT_LAYOUT, CONTENT_LIMITS } from '../../config/layout-constants.js';
import { RENDER_DELAY } from '../../config/timing-constants.js';

import { parseDate, getWeekMonth, getWeekOfMonth } from '../../utils/date-utils.js';
import * as PrintLayout from './print-layout.js';
import * as DepartmentUtils from '../../utils/department-utils.js';
import { generateAllSyntheticTasks } from '../../utils/schedule-utils.js';
import { DEPARTMENT_COLORS, normalizeDepartmentClass } from '../../config/department-config.js';

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

    const syntheticTasksByDept = generateAllSyntheticTasks([targetDate], monday, () => allTasks);

    const tasksByDept = groupTasksByDepartment(dayTasks, syntheticTasksByDept);
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
        const manualSyntheticTasks = (deptData.manualSyntheticTasks || []).filter(task => {
            const taskDate = parseDate(task.date);
            return taskDate && taskDate.toDateString() === targetDateString;
        });

        // Combine regular, synthetic, and manual synthetic tasks
        const allDeptTasks = [...deptTasks, ...syntheticTasks, ...manualSyntheticTasks];

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

    // Add remarks section below Wins and Losses
    const remarksSection = PrintLayout.createFrozenDailyRemarksSection();
    page.appendChild(remarksSection);

    printContainer.appendChild(page);
    return printContainer;
}

/**
 * Generate phase start report content for a selected week
 * Shows projects that are beginning a new department phase
 * @param {Date} weekStartDate - The Monday of the selected week
 */
function generatePhaseStartContent(weekStartDate, selectedDepts, allTasks) {
    const printContainer = document.createElement('div');
    printContainer.className = 'print-preview-content phase-start-report';

    // Create the page
    const page = document.createElement('div');
    page.className = 'print-page phase-start-page';

    // Add header with week range
    const header = document.createElement('div');
    header.className = 'phase-start-header';

    // weekStartDate is already a Date object - ensure it's the Monday of the week
    let weekStart = weekStartDate instanceof Date ? weekStartDate : parseDate(weekStartDate);
    if (!weekStart) {
        logger.error('Invalid week date for phase start report');
        return printContainer;
    }

    // Ensure weekStart is actually Monday (day 1)
    const dayOfWeek = weekStart.getDay();
    if (dayOfWeek !== 1) {
        // Adjust to get the Monday of this week
        const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday is 0, Monday is 1
        weekStart = new Date(weekStart);
        weekStart.setDate(weekStart.getDate() - daysToSubtract);
    }

    // Normalize to midnight for accurate date comparisons
    weekStart.setHours(0, 0, 0, 0);

    // Week ends on Saturday (6 days from Monday) at end of day
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 5); // Mon-Sat
    weekEnd.setHours(23, 59, 59, 999); // End of Saturday

    const formatDate = (date) => {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    header.innerHTML = `
        <h1>PHASE START REPORT</h1>
        <p class="week-range">${formatDate(weekStart)} - ${formatDate(weekEnd)}, ${weekStart.getFullYear()}</p>
    `;
    page.appendChild(header);

    // Filter tasks for selected week (exclude manual tasks)
    const weekTasks = allTasks.filter(task => {
        if (task.isManual) return false; // Exclude manual tasks
        const taskDate = parseDate(task.date);
        return taskDate && taskDate >= weekStart && taskDate <= weekEnd;
    });

    // Filter all tasks to exclude manual tasks for phase detection
    const nonManualTasks = allTasks.filter(task => !task.isManual);

    // Detect phase starts - pass week dates explicitly
    const phaseStarts = window.PrintUtils.detectPhaseStarts(weekTasks, nonManualTasks, weekStart, weekEnd);

    // Get department order and filter
    const departmentOrder = window.PrintUtils.PRINT_UTILS.DEPARTMENT_ORDER;
    const sortedDepts = departmentOrder.filter(dept =>
        phaseStarts.has(dept) &&
        (selectedDepts.length === 0 || selectedDepts.includes(dept))
    );

    // Handle empty results
    if (sortedDepts.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'phase-start-empty';
        emptyMsg.textContent = 'No phase starts found for the selected week.';
        page.appendChild(emptyMsg);
    } else {
        // Two-column layout: By Department (left) | By Project (right)
        const columnsContainer = document.createElement('div');
        columnsContainer.className = 'phase-start-columns';

        // LEFT COLUMN: By Department
        const deptColumn = document.createElement('div');
        deptColumn.className = 'phase-start-column';

        const deptColumnHeader = document.createElement('h2');
        deptColumnHeader.className = 'phase-start-section-title';
        deptColumnHeader.textContent = 'By Department';
        deptColumn.appendChild(deptColumnHeader);

        sortedDepts.forEach(dept => {
            const projects = phaseStarts.get(dept);
            if (!projects || projects.length === 0) return;

            projects.sort((a, b) => a.project.localeCompare(b.project));

            const block = document.createElement('div');
            block.className = 'phase-start-block';

            const colors = window.PrintUtils.getDepartmentColorMapping()[window.PrintUtils.normalizeDepartmentClass(dept)] || { bg: '#333', text: '#FFFFFF' };
            const deptHeader = document.createElement('div');
            deptHeader.className = 'phase-start-dept-header';
            deptHeader.style.backgroundColor = colors.bg;
            deptHeader.style.color = colors.text;
            deptHeader.textContent = dept.toUpperCase();
            block.appendChild(deptHeader);

            const table = document.createElement('table');
            table.className = 'phase-start-table';

            projects.forEach(({ project, date }) => {
                const row = document.createElement('tr');
                const projectDate = parseDate(date);
                const dateStr = projectDate ? formatDate(projectDate) : date;
                const dayStr = projectDate ? projectDate.toLocaleDateString('en-US', { weekday: 'short' }) : '';

                row.innerHTML = `
                    <td class="ps-cell-name">${project}</td>
                    <td class="ps-cell-date">${dayStr} ${dateStr}</td>
                `;
                table.appendChild(row);
            });

            block.appendChild(table);
            deptColumn.appendChild(block);
        });

        // RIGHT COLUMN: By Project
        const projectColumn = document.createElement('div');
        projectColumn.className = 'phase-start-column';

        const projectColumnHeader = document.createElement('h2');
        projectColumnHeader.className = 'phase-start-section-title';
        projectColumnHeader.textContent = 'By Project';
        projectColumn.appendChild(projectColumnHeader);

        // Invert the data structure: project -> departments
        const projectMap = new Map();
        sortedDepts.forEach(dept => {
            const projects = phaseStarts.get(dept);
            if (!projects) return;

            projects.forEach(({ project, date }) => {
                if (!projectMap.has(project)) {
                    projectMap.set(project, []);
                }
                projectMap.get(project).push({ department: dept, date });
            });
        });

        const sortedProjects = Array.from(projectMap.keys()).sort((a, b) => a.localeCompare(b));

        sortedProjects.forEach(project => {
            const departments = projectMap.get(project);

            const block = document.createElement('div');
            block.className = 'phase-start-block';

            const projectHeader = document.createElement('div');
            projectHeader.className = 'phase-start-project-header';
            projectHeader.textContent = project;
            block.appendChild(projectHeader);

            const table = document.createElement('table');
            table.className = 'phase-start-table';

            departments.forEach(({ department, date }) => {
                const row = document.createElement('tr');
                const projectDate = parseDate(date);
                const dateStr = projectDate ? formatDate(projectDate) : date;
                const dayStr = projectDate ? projectDate.toLocaleDateString('en-US', { weekday: 'short' }) : '';

                const colors = window.PrintUtils.getDepartmentColorMapping()[window.PrintUtils.normalizeDepartmentClass(department)] || { bg: '#333', text: '#FFFFFF' };

                row.innerHTML = `
                    <td class="ps-cell-name"><span class="ps-dept-color" style="background-color: ${colors.bg};"></span>${department}</td>
                    <td class="ps-cell-date">${dayStr} ${dateStr}</td>
                `;
                table.appendChild(row);
            });

            block.appendChild(table);
            projectColumn.appendChild(block);
        });

        columnsContainer.appendChild(deptColumn);
        columnsContainer.appendChild(projectColumn);
        page.appendChild(columnsContainer);
    }

    printContainer.appendChild(page);
    return printContainer;
}

/**
 * Generate complete print content for selected departments with department-per-page scaling
 */
function generatePrintContent(printType, selectedDepts, weekDates, allTasks, options) {
    // Handle frozen daily print type
    if (printType === 'frozen-daily') {
        // Use the first date as the target date (should be next business day)
        const targetDate = weekDates && weekDates.length > 0 ? weekDates[0] : new Date();
        return generateFrozenDailyContent(targetDate, allTasks);
    }

    // Handle phase start report type
    if (printType === 'phase-start') {
        // Use the first date as the week start (Monday)
        const weekStart = weekDates && weekDates.length > 0 ? weekDates[0] : new Date();
        return generatePhaseStartContent(weekStart, selectedDepts, allTasks);
    }

    // Handle board-schedule 11x17 (Mon-Fri[-Sat] × Side B | Side A grid for
    // the shop whiteboard). Always uses Layout/Cast/Demold; ignores
    // selectedDepts. The "Include Saturday" toggle from the modal arrives
    // here via options.includeBoardSaturday (defaults to true).
    if (printType === 'board-11x17') {
        return generateBoardScheduleContent(weekDates, allTasks, options);
    }

    // Handle buy-in sheets — one hand-fill manager form per production crew.
    // The picker constrains selectedDepts to BUY_IN_DEPARTMENTS (set up in
    // print-config-manager), so the renderer just iterates whichever subset
    // the user checked.
    if (printType === 'buy-in') {
        return generateBuyInContent(weekDates, allTasks, selectedDepts);
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
    const syntheticTasksByDept = monday ? generateAllSyntheticTasks(weekDates, monday, () => allTasks) : {};

    // 2. Group tasks using the centralized utility
    const { groupTasksByDepartment, sortDepartments } = DepartmentUtils;
    const tasksByDept = groupTasksByDepartment(allTasks, syntheticTasksByDept);
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
        const syntheticTasks = [...(deptData.syntheticTasks || []), ...(deptData.manualSyntheticTasks || [])].filter(filterByDate);
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
    // Board schedule is a fixed 11×17 layout - no scaling
    if (printType === 'board-11x17') return;
    // Buy-in sheets are a fixed letter-portrait form with hand-fill blanks —
    // shrinking the type to "fit" defeats the purpose of having writable lines.
    if (printType === 'buy-in') return;
    // Delegate scaling to the centralized utility
    window.PrintUtils.applyScaling(printContent, printType, false);
}

// ============================================
// BOARD SCHEDULE (11×17) RENDERER
// ============================================

const BOARD_ACTIVITIES = ['LAYOUT', 'CAST', 'DEMOLD'];
const BOARD_DAYS_MON_FRI = [
    { key: 'mon', label: 'MON',   offset: 0 },
    { key: 'tue', label: 'TUES.', offset: 1 },
    { key: 'wed', label: 'WED',   offset: 2 },
    { key: 'thu', label: 'THURS.', offset: 3 },
    { key: 'fri', label: 'FRI',   offset: 4 }
];
const BOARD_DAYS_MON_SAT = [
    ...BOARD_DAYS_MON_FRI,
    { key: 'sat', label: 'SAT',   offset: 5 }
];
// Full superset — used by helpers that just need to label-lookup a day key
// without caring which mode the user picked.
const BOARD_DAYS = BOARD_DAYS_MON_SAT;

function _boardSideKey(task) {
    // Side-resolution key for Cast tasks. Falls back to project name if
    // project number is missing so Sheets-only rows still match.
    const proj = (task.projectNumber && task.projectNumber.trim()) || (task.project || '').trim();
    const cast = (task.castingNumber || '').toString().trim();
    if (!proj || !cast) return null;
    return `${proj.toLowerCase()}|${cast.toLowerCase()}`;
}

function _boardLabel(task) {
    const proj = (task.project || '').trim() || '(no project)';
    const cast = (task.castingNumber || '').toString().trim();
    if (!cast) return proj;
    // Most project names already embed the cast number (e.g. "Hancock
    // Whitney FE - Cast #2" or "7 Fairfield Cast 16"). If so, return the
    // project name as-is to avoid the duplicated "Cast #N" tail we were
    // appending before. Only append when the cast token is genuinely missing.
    const projLower = proj.toLowerCase();
    const castLower = cast.toLowerCase();
    if (projLower.includes(castLower)) return proj;
    return `${proj} Cast #${cast}`;
}

// The "layout day" for a Cast is the previous workday.
//
// includeSaturday=true (default, Mon-Sat shop):
//   Mon → Sat (skip Sun), Tue → Mon, ..., Sat → Fri.
// includeSaturday=false (original Mon-Fri behavior):
//   Mon → Fri (skip Sat/Sun), Tue → Mon, ..., Sat → Fri.
function _workdayBefore(date, includeSaturday) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const dow = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    if (includeSaturday) {
        if (dow === 1) d.setDate(d.getDate() - 2);      // Mon → Sat (skip Sun)
        else if (dow === 0) d.setDate(d.getDate() - 1); // Sun → Sat (safety)
        else d.setDate(d.getDate() - 1);                // Tue-Sat → prior day
    } else {
        if (dow === 1) d.setDate(d.getDate() - 3);      // Mon → Fri (skip weekend)
        else if (dow === 0) d.setDate(d.getDate() - 2); // Sun → Fri (safety)
        else d.setDate(d.getDate() - 1);                // Tue-Sat → prior day
    }
    return d;
}

function generateBoardScheduleContent(weekDates, allTasks, options) {
    const printContainer = document.createElement('div');
    printContainer.className = 'print-preview-content board-11x17-preview';

    if (!Array.isArray(weekDates) || weekDates.length === 0) {
        logger.warn('Board schedule: no week dates supplied');
        return printContainer;
    }

    // "Include Saturday" toggle from the modal. Default true: Mon-Sat work
    // week, Sat gets its own page, Mon Cast's Layout lands on Sat. Set
    // false to restore the original Mon-Fri behavior (no Sat page; Mon
    // Cast's Layout collapses onto Fri).
    const includeSaturday = !options || options.includeBoardSaturday !== false;
    const boardDays = includeSaturday ? BOARD_DAYS_MON_SAT : BOARD_DAYS_MON_FRI;

    // Anchor on the Monday of the supplied week.
    const first = weekDates[0] ? new Date(weekDates[0]) : new Date();
    const dow = first.getDay();
    const mondayOffset = first.getDate() - dow + (dow === 0 ? -6 : 1);
    const monday = new Date(first);
    monday.setDate(mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const dayDates = boardDays.map(d => {
        const dt = new Date(monday);
        dt.setDate(monday.getDate() + d.offset);
        return dt;
    });
    const dayKeyByISO = {};
    dayDates.forEach((dt, idx) => {
        const k = dt.toDateString();
        dayKeyByISO[k] = boardDays[idx].key;
    });

    // 1. Build the side-resolution map from every Cast task in the dataset
    //    (not just this week) so Layouts that lead a Cast in the following
    //    week and Demolds that trail a Cast from the prior week still resolve.
    const sideByKey = new Map();
    (allTasks || []).forEach(t => {
        if (t.department !== 'Cast') return;
        const side = (t.castingSide === 'A' || t.castingSide === 'B') ? t.castingSide : null;
        if (!side) return;
        const k = _boardSideKey(t);
        if (k && !sideByKey.has(k)) sideByKey.set(k, side);
    });

    // 2. Bucket activities into cells[day][side].
    //
    //    Layout is ALWAYS synthetic in this app — its in-memory row has no
    //    projectNumber/castingNumber/castingSide, so we can't look up its
    //    side directly. Instead we derive each LAYOUT entry from the Cast
    //    it precedes: same project + cast number + side, placed one workday
    //    before the Cast date. This keeps Layout on the same side as the
    //    Cast it serves.
    //
    //    Cast and Demold are real tasks from the sheet, so we read their
    //    side from the task (Cast: castingSide; Demold: lookup via the
    //    sideByKey map built in step 1).
    const cells = {};
    boardDays.forEach(d => {
        cells[d.key] = { A: [], B: [] };
    });

    const unresolved = [];

    const placeEntry = (dayKey, side, activity, task) => {
        const entry = { activity, label: _boardLabel(task), task };
        if (side === 'A' || side === 'B') {
            cells[dayKey][side].push(entry);
        } else {
            unresolved.push({ day: dayKey, ...entry });
        }
    };

    (allTasks || []).forEach(t => {
        const td = parseDate(t.date);
        if (!td) return;

        if (t.department === 'Cast') {
            const side = (t.castingSide === 'A' || t.castingSide === 'B') ? t.castingSide : null;

            // CAST entry on its own day, if in this week.
            const castDayKey = dayKeyByISO[td.toDateString()];
            if (castDayKey) placeEntry(castDayKey, side, 'CAST', t);

            // LAYOUT entry on the previous workday (same side), if that
            // day falls in this week. Toggle-dependent:
            //   includeSaturday=true  → Mon→Sat, Tue→Mon, ..., Sat→Fri
            //   includeSaturday=false → Mon→Fri (skip weekend), Tue→Mon, ...
            const layoutDate = _workdayBefore(td, includeSaturday);
            const layoutDayKey = dayKeyByISO[layoutDate.toDateString()];
            if (layoutDayKey) placeEntry(layoutDayKey, side, 'LAYOUT', t);
            return;
        }

        if (t.department === 'Demold') {
            const dayKey = dayKeyByISO[td.toDateString()];
            if (!dayKey) return;
            // Prefer an explicit side on the Demold row, then fall back to
            // the matching Cast's side via projectNumber + castingNumber.
            let side = (t.castingSide === 'A' || t.castingSide === 'B') ? t.castingSide : null;
            if (!side) {
                const k = _boardSideKey(t);
                if (k) side = sideByKey.get(k) || null;
            }
            placeEntry(dayKey, side, 'DEMOLD', t);
            return;
        }

        // Ignore real or synthetic Layout rows from the task list — LAYOUT
        // entries are derived from Cast above. Any other department is not
        // part of this board.
    });

    // 3. Render one page per (day, side) that has activity. 11×17 landscape,
    //    content top-justified so the user can fold the sheet in half and
    //    pin the printed top-half as a ~17"×5.5" strip. Order is day-grouped
    //    (Mon-B, Mon-A, Tue-B, Tue-A, ...). Empty (day, side) combos are
    //    skipped — no blank sheets in the output.
    let pageCount = 0;
    boardDays.forEach((d, idx) => {
        const dt = dayDates[idx];
        if (cells[d.key].B.length > 0) {
            printContainer.appendChild(_buildBoardSidePage(d, dt, 'B', cells[d.key].B, monday, dayDates[4]));
            pageCount++;
        }
        if (cells[d.key].A.length > 0) {
            printContainer.appendChild(_buildBoardSidePage(d, dt, 'A', cells[d.key].A, monday, dayDates[4]));
            pageCount++;
        }
    });

    // 4. Unresolved-side bucket goes on its own page at the end so nothing
    //    gets silently dropped. User pencils them onto the correct side.
    if (unresolved.length > 0) {
        printContainer.appendChild(_buildBoardUnresolvedPage(unresolved));
    }

    logger.info('Board schedule rendered', {
        sheetsRendered: pageCount,
        unresolvedCount: unresolved.length,
        weekStart: monday.toDateString()
    });

    return printContainer;
}

function _buildBoardSidePage(day, dayDate, sideLetter, entries, weekMonday, weekFriday) {
    const page = document.createElement('div');
    page.className = `print-page board-11x17-page board-side-page board-side-page-${sideLetter.toLowerCase()}`;

    const dateLabel = dayDate.toLocaleDateString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
    const weekLabel = `Week of ${weekMonday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${weekFriday.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;

    // ---- TOP HALF: header + side strip. This is what shows after folding.
    const topHalf = document.createElement('div');
    topHalf.className = 'board-side-page-top';

    const header = document.createElement('div');
    header.className = 'board-day-header';
    header.innerHTML = `
        <div class="board-day-header-left">
            <div class="board-day-big">${day.label.replace('.', '')}</div>
            <div class="board-day-fulldate">${dateLabel}</div>
            <div class="board-day-side-tag">SIDE ${sideLetter}</div>
        </div>
        <div class="board-day-header-right">${weekLabel}</div>
    `;
    topHalf.appendChild(header);
    topHalf.appendChild(_buildBoardStrip(sideLetter, entries));
    page.appendChild(topHalf);

    // ---- FOLD line at the vertical midpoint
    const fold = document.createElement('div');
    fold.className = 'board-fold-line';
    fold.innerHTML = '<span>fold here — printed side goes outward</span>';
    page.appendChild(fold);

    // ---- BOTTOM HALF: intentionally blank (back of the folded strip)
    const bottomHalf = document.createElement('div');
    bottomHalf.className = 'board-side-page-bottom';
    page.appendChild(bottomHalf);

    return page;
}

function _buildBoardStrip(sideLetter, entries) {
    const strip = document.createElement('div');
    strip.className = `board-strip board-strip-${sideLetter.toLowerCase()}`;

    const sideLabel = document.createElement('div');
    sideLabel.className = `board-strip-side-label board-strip-side-${sideLetter.toLowerCase()}`;
    sideLabel.innerHTML = `<div class="board-strip-side-letter">${sideLetter}</div><div class="board-strip-side-word">SIDE</div>`;
    strip.appendChild(sideLabel);

    const content = document.createElement('div');
    content.className = 'board-strip-content';
    if (!entries || entries.length === 0) {
        content.classList.add('board-strip-empty');
        content.innerHTML = '<div class="board-strip-empty-note">— no activity —</div>';
    } else {
        // Tag the strip with its activity count so CSS can shrink the type
        // when there are 3+ activities (otherwise long names wrap to two
        // lines and the strip blows past the fold line).
        const count = Math.min(entries.length, 4);
        strip.classList.add(`board-strip-count-${count}`);
        const ordered = [...entries].sort((a, b) =>
            BOARD_ACTIVITIES.indexOf(a.activity) - BOARD_ACTIVITIES.indexOf(b.activity));
        ordered.forEach(e => {
            const line = document.createElement('div');
            line.className = 'board-activity';
            const chip = document.createElement('span');
            chip.className = `board-chip board-chip-${e.activity}`;
            chip.textContent = e.activity;
            const lbl = document.createElement('span');
            lbl.className = 'board-activity-label';
            lbl.textContent = e.label;
            line.appendChild(chip);
            line.appendChild(lbl);
            content.appendChild(line);
        });
    }
    strip.appendChild(content);

    return strip;
}

function _buildBoardUnresolvedPage(unresolved) {
    const page = document.createElement('div');
    page.className = 'print-page board-11x17-page board-unresolved-page';
    const lines = unresolved.map(u => {
        const dayLabel = BOARD_DAYS.find(d => d.key === u.day).label;
        return `<li><span class="board-chip board-chip-${u.activity}">${u.activity}</span> <span class="board-activity-label">${u.label}</span> <span class="board-unresolved-day">(${dayLabel})</span></li>`;
    }).join('');
    page.innerHTML = `
        <div class="board-unresolved-title">Unresolved side — assign on the board by hand:</div>
        <ul class="board-unresolved-list">${lines}</ul>
        <div class="board-unresolved-note">Tip: set the side on the matching Cast task so future prints resolve automatically.</div>
    `;
    return page;
}

// ============================================
// BUY-IN SHEETS RENDERER
// ============================================
//
// One hand-fill manager form per production crew (Mill, Form Out, Cast, Batch,
// Samples, Demold, Layout, Finish, Seal, Final Insp., Special, Crating, Load,
// Ship). Special Events and Facilities are intentionally excluded — they
// aren't tracked as production crews. The "Expected Value" column is
// autopopulated from sum(task.hours) * REVENUE.HOURLY_RATE per dept per day;
// every other column (Actual, Delta, %) is left blank for the crew leader
// to fill in by hand. Layout is letter landscape to match the source PDF.

// MUST stay in sync with BUY_IN_DEPARTMENTS exported from
// components/modals/print-config-manager.js — that one drives the picker, this
// one drives the iteration order in the renderer.
const BUY_IN_DEPARTMENTS = [
    'Mill', 'Form Out', 'Cast', 'Batch', 'Samples', 'Demold', 'Layout',
    'Finish', 'Seal', 'Final Insp.', 'Special', 'Crate / Ship'
];

// Special combined-sheet name: rendered with split CRATE/SHIPPING columns
// rather than the standard single-value buy-in layout. Crate = Crating + Load
// hours summed; Ship = Ship hours alone.
const BUY_IN_CRATE_SHIP = 'Crate / Ship';

const BUY_IN_DAYS = [
    { label: 'Monday',    offset: 0 },
    { label: 'Tuesday',   offset: 1 },
    { label: 'Wednesday', offset: 2 },
    { label: 'Thursday',  offset: 3 },
    { label: 'Friday',    offset: 4 },
    { label: 'Saturday',  offset: 5 }
];

// Synthetic departments draw their hours from generateAllSyntheticTasks rather
// than the raw task list (they have no real rows in the sheet).
const SYNTHETIC_BUY_IN_DEPTS = new Set(['Batch', 'Layout']);

function _buyInFormatMoney(amount) {
    if (!amount || amount === 0) return '';
    return amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function _buyInWeekRange(weekDates) {
    if (!weekDates || weekDates.length === 0) return '';
    const first = weekDates[0];
    const last = weekDates[weekDates.length - 1];
    if (!first || !last) return '';
    const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(first)} – ${fmt(last)}, ${first.getFullYear()}`;
}

// Build the "June Week 3" label for the DAY column subtitle. Uses the same
// week-of-month calculation the Print Week selector dropdown uses (so the
// label here matches what the user picked in the modal).
function _buyInWeekOfMonthLabel(monday) {
    if (!monday) return '';
    const month = getWeekMonth(monday);
    const weekNum = getWeekOfMonth(monday, month);
    const monthName = new Date(monday.getFullYear(), month, 1)
        .toLocaleDateString('en-US', { month: 'long' });
    return `${monthName} Week ${weekNum}`;
}

function _calculateBuyInExpectedForDay(dept, dayDate, allTasks, syntheticTasksByDept) {
    if (!dayDate) return 0;
    const dayStr = dayDate.toDateString();

    const sourceTasks = SYNTHETIC_BUY_IN_DEPTS.has(dept)
        ? (syntheticTasksByDept[dept] || [])
        : (allTasks || []).filter(t => t.department === dept);

    let totalHours = 0;
    sourceTasks.forEach(task => {
        const taskDate = parseDate(task.date);
        if (!taskDate || taskDate.toDateString() !== dayStr) return;
        const hours = parseFloat(task.hours);
        if (!isNaN(hours)) totalHours += hours;
    });

    return Math.round(totalHours * REVENUE.HOURLY_RATE);
}

function _buildBuyInPage(dept, weekDates, allTasks, syntheticTasksByDept, dateRangeLabel, weekOfMonthLabel) {
    const page = document.createElement('div');
    page.className = 'print-page buy-in-page';

    // Company banner (right-aligned, matches the source PDF)
    const company = document.createElement('div');
    company.className = 'buy-in-company';
    company.textContent = 'CONCRETEWORKS EAST';
    page.appendChild(company);

    // "Percent ___% Delta $___" header row — both blanks for hand-fill
    const summary = document.createElement('div');
    summary.className = 'buy-in-summary';
    summary.innerHTML = `
        <span class="buy-in-summary-item">
            <span class="buy-in-label">Percent</span>
            <span class="buy-in-fill"></span>
            <span class="buy-in-unit">%</span>
        </span>
        <span class="buy-in-summary-item">
            <span class="buy-in-label">Delta</span>
            <span class="buy-in-currency">$</span>
            <span class="buy-in-fill"></span>
        </span>
    `;
    page.appendChild(summary);

    // Crew + Date row (Crew = department name as a dept-colored chip, Date =
    // week range). The chip uses the canonical DEPARTMENT_COLORS mapping so
    // every sheet picks up the same color the rest of the app uses for that
    // dept — gives the manager an at-a-glance way to tell pages apart when
    // flipping through the printed stack.
    const deptColors = DEPARTMENT_COLORS[normalizeDepartmentClass(dept)] || { background: '#374151', text: '#FFFFFF' };
    const meta = document.createElement('div');
    meta.className = 'buy-in-meta';
    meta.innerHTML = `
        <div class="buy-in-meta-row">
            <span class="buy-in-label">Crew:</span>
            <span class="buy-in-value buy-in-crew-chip" style="background-color: ${deptColors.background}; color: ${deptColors.text};">${dept}</span>
        </div>
        <div class="buy-in-meta-row">
            <span class="buy-in-label">Date:</span>
            <span class="buy-in-value">${dateRangeLabel}</span>
        </div>
    `;
    page.appendChild(meta);

    // Members: long blank line for hand-fill
    const members = document.createElement('div');
    members.className = 'buy-in-members';
    members.innerHTML = `
        <span class="buy-in-label">Members:</span>
        <span class="buy-in-fill buy-in-fill-wide"></span>
    `;
    page.appendChild(members);

    // Day × value table (Expected autopopulated; Actual/Delta/% blank)
    const table = document.createElement('table');
    table.className = 'buy-in-table';

    const thead = document.createElement('thead');
    // Two-line DAY header: "DAY" on top, the week-of-month subtitle below
    // (e.g. "June Week 3"). Other columns keep their single-line label.
    thead.innerHTML = `
        <tr>
            <th class="buy-in-th-day">
                <span class="buy-in-th-day-main">DAY</span>
                <span class="buy-in-th-day-week">${weekOfMonthLabel}</span>
            </th>
            <th class="buy-in-th-expected">EXPECTED VALUE</th>
            <th class="buy-in-th-actual">ACTUAL VALUE</th>
            <th class="buy-in-th-delta">DELTA</th>
            <th class="buy-in-th-percent">% COMPLETED</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    let weeklyExpected = 0;

    BUY_IN_DAYS.forEach(d => {
        const dayDate = weekDates[d.offset];
        const expected = _calculateBuyInExpectedForDay(dept, dayDate, allTasks, syntheticTasksByDept);
        weeklyExpected += expected;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="buy-in-cell-day">${d.label}</td>
            <td class="buy-in-cell-expected"><span class="buy-in-currency">$</span><span class="buy-in-amount">${_buyInFormatMoney(expected)}</span></td>
            <td class="buy-in-cell-actual"><span class="buy-in-currency">$</span><span class="buy-in-amount"></span></td>
            <td class="buy-in-cell-delta"><span class="buy-in-currency">$</span><span class="buy-in-amount"></span></td>
            <td class="buy-in-cell-percent"><span class="buy-in-amount"></span><span class="buy-in-unit">%</span></td>
        `;
        tbody.appendChild(row);
    });

    table.appendChild(tbody);

    const tfoot = document.createElement('tfoot');
    tfoot.innerHTML = `
        <tr class="buy-in-total-row">
            <td class="buy-in-cell-day">WEEKLY TOTAL:</td>
            <td class="buy-in-cell-expected"><span class="buy-in-currency">$</span><span class="buy-in-amount">${_buyInFormatMoney(weeklyExpected)}</span></td>
            <td class="buy-in-cell-actual"><span class="buy-in-currency">$</span><span class="buy-in-amount"></span></td>
            <td class="buy-in-cell-delta"><span class="buy-in-currency">$</span><span class="buy-in-amount"></span></td>
            <td class="buy-in-cell-percent"><span class="buy-in-amount"></span><span class="buy-in-unit">%</span></td>
        </tr>
    `;
    table.appendChild(tfoot);

    page.appendChild(table);

    return page;
}

// Sum hours across multiple real departments for one day. Used by the
// combined Crate/Ship sheet (Crate = Crating + Load).
function _calculateBuyInExpectedForDeptsOnDay(deptList, dayDate, allTasks) {
    if (!dayDate) return 0;
    const dayStr = dayDate.toDateString();
    const set = new Set(deptList);

    let totalHours = 0;
    (allTasks || []).forEach(task => {
        if (!set.has(task.department)) return;
        const taskDate = parseDate(task.date);
        if (!taskDate || taskDate.toDateString() !== dayStr) return;
        const hours = parseFloat(task.hours);
        if (!isNaN(hours)) totalHours += hours;
    });

    return Math.round(totalHours * REVENUE.HOURLY_RATE);
}

/**
 * Combined Crate/Ship buy-in page. Same overall shape as the regular sheet,
 * but every value column is split with a "/" divider — Crate (= Crating +
 * Load summed) on the left, Ship on the right. Header sub-label CRATE /
 * SHIPPING under each column makes the split self-documenting. The WEEKLY
 * TOTAL row collapses the dollar columns to one combined sum (Crate + Ship)
 * but keeps the % column split since percentages don't add.
 */
function _buildBuyInCombinedCrateShipPage(weekDates, allTasks, dateRangeLabel, weekOfMonthLabel) {
    const page = document.createElement('div');
    page.className = 'print-page buy-in-page buy-in-page-combined';

    // Company banner
    const company = document.createElement('div');
    company.className = 'buy-in-company';
    company.textContent = 'CONCRETEWORKS EAST';
    page.appendChild(company);

    // Percent / Delta hand-fill header line
    const summary = document.createElement('div');
    summary.className = 'buy-in-summary';
    summary.innerHTML = `
        <span class="buy-in-summary-item">
            <span class="buy-in-label">Percent</span>
            <span class="buy-in-fill"></span>
            <span class="buy-in-unit">%</span>
        </span>
        <span class="buy-in-summary-item">
            <span class="buy-in-label">Delta</span>
            <span class="buy-in-currency">$</span>
            <span class="buy-in-fill"></span>
        </span>
    `;
    page.appendChild(summary);

    // Crew chip: use Crating's amber + Ship's green as a visual gradient hint.
    // Keep it a single solid color (Crating amber) so the chip stays readable
    // and matches the existing print-color-adjust pattern.
    const crateColors = DEPARTMENT_COLORS[normalizeDepartmentClass('Crating')] || { background: '#A16207', text: '#FFFFFF' };
    const meta = document.createElement('div');
    meta.className = 'buy-in-meta';
    meta.innerHTML = `
        <div class="buy-in-meta-row">
            <span class="buy-in-label">Crew:</span>
            <span class="buy-in-value buy-in-crew-chip" style="background-color: ${crateColors.background}; color: ${crateColors.text};">Crate / Ship</span>
        </div>
        <div class="buy-in-meta-row">
            <span class="buy-in-label">Date:</span>
            <span class="buy-in-value">${dateRangeLabel}</span>
        </div>
    `;
    page.appendChild(meta);

    // Members blank line
    const members = document.createElement('div');
    members.className = 'buy-in-members';
    members.innerHTML = `
        <span class="buy-in-label">Members:</span>
        <span class="buy-in-fill buy-in-fill-wide"></span>
    `;
    page.appendChild(members);

    // Table — every value column gets a CRATE / SHIPPING sub-label so the
    // split is self-documenting even without the column legend.
    const table = document.createElement('table');
    table.className = 'buy-in-table buy-in-table-combined';

    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th class="buy-in-th-day" rowspan="2">
                <span class="buy-in-th-day-main">DAY</span>
                <span class="buy-in-th-day-week">${weekOfMonthLabel}</span>
            </th>
            <th class="buy-in-th-expected">EXPECTED VALUE</th>
            <th class="buy-in-th-actual">ACTUAL VALUE</th>
            <th class="buy-in-th-delta">DELTA</th>
            <th class="buy-in-th-percent">% COMPLETED</th>
        </tr>
        <tr class="buy-in-subhead">
            <th class="buy-in-th-expected buy-in-th-sub">CRATE&nbsp;&nbsp;/&nbsp;&nbsp;SHIPPING</th>
            <th class="buy-in-th-actual buy-in-th-sub">CRATE&nbsp;&nbsp;/&nbsp;&nbsp;SHIPPING</th>
            <th class="buy-in-th-delta buy-in-th-sub">CRATE&nbsp;&nbsp;/&nbsp;&nbsp;SHIPPING</th>
            <th class="buy-in-th-percent buy-in-th-sub">CRATE&nbsp;&nbsp;/&nbsp;&nbsp;SHIPPING</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    let weeklyCrate = 0;
    let weeklyShip = 0;

    BUY_IN_DAYS.forEach(d => {
        const dayDate = weekDates[d.offset];
        const crateExpected = _calculateBuyInExpectedForDeptsOnDay(['Crating', 'Load'], dayDate, allTasks);
        const shipExpected = _calculateBuyInExpectedForDeptsOnDay(['Ship'], dayDate, allTasks);
        weeklyCrate += crateExpected;
        weeklyShip += shipExpected;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="buy-in-cell-day">${d.label}</td>
            <td class="buy-in-cell-expected buy-in-cell-split">
                <span class="buy-in-split-half">
                    <span class="buy-in-currency">$</span><span class="buy-in-amount">${_buyInFormatMoney(crateExpected)}</span>
                </span>
                <span class="buy-in-split-sep">/</span>
                <span class="buy-in-split-half">
                    <span class="buy-in-currency">$</span><span class="buy-in-amount">${_buyInFormatMoney(shipExpected)}</span>
                </span>
            </td>
            <td class="buy-in-cell-actual buy-in-cell-split">
                <span class="buy-in-split-half"><span class="buy-in-currency">$</span><span class="buy-in-amount"></span></span>
                <span class="buy-in-split-sep">/</span>
                <span class="buy-in-split-half"><span class="buy-in-currency">$</span><span class="buy-in-amount"></span></span>
            </td>
            <td class="buy-in-cell-delta buy-in-cell-split">
                <span class="buy-in-split-half"><span class="buy-in-currency">$</span><span class="buy-in-amount"></span></span>
                <span class="buy-in-split-sep">/</span>
                <span class="buy-in-split-half"><span class="buy-in-currency">$</span><span class="buy-in-amount"></span></span>
            </td>
            <td class="buy-in-cell-percent buy-in-cell-split">
                <span class="buy-in-split-half"><span class="buy-in-amount"></span><span class="buy-in-unit">%</span></span>
                <span class="buy-in-split-sep">/</span>
                <span class="buy-in-split-half"><span class="buy-in-amount"></span><span class="buy-in-unit">%</span></span>
            </td>
        `;
        tbody.appendChild(row);
    });

    table.appendChild(tbody);

    // WEEKLY TOTAL row — every value column stays split (Crate / Ship) to
    // match the day rows above. EXPECTED shows the two summed totals;
    // ACTUAL, DELTA, % stay blank for hand-fill but keep the split.
    const tfoot = document.createElement('tfoot');
    tfoot.innerHTML = `
        <tr class="buy-in-total-row buy-in-total-row-combined">
            <td class="buy-in-cell-day">WEEKLY TOTAL:</td>
            <td class="buy-in-cell-expected buy-in-cell-split">
                <span class="buy-in-split-half">
                    <span class="buy-in-currency">$</span><span class="buy-in-amount">${_buyInFormatMoney(weeklyCrate)}</span>
                </span>
                <span class="buy-in-split-sep">/</span>
                <span class="buy-in-split-half">
                    <span class="buy-in-currency">$</span><span class="buy-in-amount">${_buyInFormatMoney(weeklyShip)}</span>
                </span>
            </td>
            <td class="buy-in-cell-actual buy-in-cell-split">
                <span class="buy-in-split-half"><span class="buy-in-currency">$</span><span class="buy-in-amount"></span></span>
                <span class="buy-in-split-sep">/</span>
                <span class="buy-in-split-half"><span class="buy-in-currency">$</span><span class="buy-in-amount"></span></span>
            </td>
            <td class="buy-in-cell-delta buy-in-cell-split">
                <span class="buy-in-split-half"><span class="buy-in-currency">$</span><span class="buy-in-amount"></span></span>
                <span class="buy-in-split-sep">/</span>
                <span class="buy-in-split-half"><span class="buy-in-currency">$</span><span class="buy-in-amount"></span></span>
            </td>
            <td class="buy-in-cell-percent buy-in-cell-split">
                <span class="buy-in-split-half"><span class="buy-in-amount"></span><span class="buy-in-unit">%</span></span>
                <span class="buy-in-split-sep">/</span>
                <span class="buy-in-split-half"><span class="buy-in-amount"></span><span class="buy-in-unit">%</span></span>
            </td>
        </tr>
    `;
    table.appendChild(tfoot);

    page.appendChild(table);

    return page;
}

function generateBuyInContent(weekDates, allTasks, selectedDepts) {
    const printContainer = document.createElement('div');
    printContainer.className = 'print-preview-content buy-in-report';

    // Anchor on Monday so the synthetic task generator (Batch / Layout) gets
    // the right week start. weekDates is expected to be a 6-day Mon-Sat range
    // already, but we normalize defensively here.
    let monday = (weekDates && weekDates[0]) ? new Date(weekDates[0]) : new Date();
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
    monday = new Date(monday.setDate(diff));
    monday.setHours(0, 0, 0, 0);

    const syntheticTasksByDept = generateAllSyntheticTasks(weekDates, monday, () => allTasks);
    const dateRangeLabel = _buyInWeekRange(weekDates);
    const weekOfMonthLabel = _buyInWeekOfMonthLabel(monday);

    // Filter BUY_IN_DEPARTMENTS by the user's picker selection (falling back to
    // the full list if nothing was passed in, so calling code that hasn't been
    // updated still works). Preserve BUY_IN_DEPARTMENTS order regardless of
    // checkbox toggle order.
    const selectedSet = (Array.isArray(selectedDepts) && selectedDepts.length > 0)
        ? new Set(selectedDepts)
        : null;
    const deptsToRender = selectedSet
        ? BUY_IN_DEPARTMENTS.filter(d => selectedSet.has(d))
        : BUY_IN_DEPARTMENTS;

    deptsToRender.forEach(dept => {
        const page = (dept === BUY_IN_CRATE_SHIP)
            ? _buildBuyInCombinedCrateShipPage(weekDates, allTasks, dateRangeLabel, weekOfMonthLabel)
            : _buildBuyInPage(dept, weekDates, allTasks, syntheticTasksByDept, dateRangeLabel, weekOfMonthLabel);
        printContainer.appendChild(page);
    });

    logger.info('Buy-in sheets rendered', {
        departmentsRequested: selectedSet ? selectedDepts.length : BUY_IN_DEPARTMENTS.length,
        departmentsRendered: deptsToRender.length,
        weekStart: monday.toDateString(),
        weekOfMonth: weekOfMonthLabel
    });

    return printContainer;
}

/**
 * Execute print with proper setup and cleanup
 */
function executePrint(printContent, printType = 'week', orientation = null) {
    // Determine orientation: use passed orientation for 'day' type, or default based on print type
    let pageOrientation;
    if (printType === 'day' && orientation) {
        // For day print type, use the user-selected orientation
        pageOrientation = orientation;
    } else if (printType === 'board-11x17') {
        // Board schedule is locked to 11×17 landscape (tabloid landscape)
        pageOrientation = 'landscape';
    } else if (printType === 'buy-in') {
        // Buy-in sheet is a fixed letter-landscape form to match the source PDF.
        pageOrientation = 'landscape';
    } else {
        // Default orientation based on print type for other types
        pageOrientation = (printType === 'phase-start') ? 'portrait' : 'landscape';
    }

    // Debug logging
    console.log('Print execution:', {
        printType,
        receivedOrientation: orientation,
        finalOrientation: pageOrientation
    });

    // Create dynamic print styles for the selected orientation
    // Note: We remove the static @page rule and add our dynamic one
    let dynamicStyle = null;
    dynamicStyle = document.createElement('style');
    dynamicStyle.id = 'dynamic-page-orientation';
    if (printType === 'board-11x17') {
        // 17in × 11in tabloid landscape. Top margin is 0 so the content
        // sits flush against the top edge of the sheet (user folds the
        // sheet in half — they want zero whitespace above the strip).
        // Sides and bottom keep a thin margin for printer hardware-margin
        // safety.
        dynamicStyle.textContent = `
            @page {
                size: 17in 11in;
                margin: 0 0.25in 0.25in 0.25in;
            }
        `;
    } else {
        dynamicStyle.textContent = `
            @page {
                size: letter ${pageOrientation};
                margin: 0.5in;
            }
        `;
    }
    document.head.appendChild(dynamicStyle);

    // Debug: log the style content
    console.log('Applied @page style:', dynamicStyle.textContent);

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
        document.head.removeChild(dynamicStyle);
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
    generateBoardScheduleContent,
    generateBuyInContent,
    applyPrintScaling,
    executePrint
};