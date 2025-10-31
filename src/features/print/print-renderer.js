/**
 * Print Renderer - Modular rendering system for print reports
 * Handles page assembly and print execution with proper page break management
 */

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
    const revenue = Math.round(totalHours * 135);

    // Create components for main department
    const deptHeader = window.PrintLayout.createDepartmentHeader(dept, printType, colors);
    const table = window.PrintLayout.createDepartmentTable(dept, tasks, dates, printType, isCompact);
    const summary = window.PrintLayout.createDepartmentSummary(dept, totalHours, revenue);

    // Create components for synthetic department if provided
    let syntheticHeader = null;
    let syntheticTable = null;
    if (syntheticTasks && syntheticTasks.length > 0 && syntheticDeptName) {
        const syntheticColors = getDepartmentColorMapping()[normalizeDepartmentClass(syntheticDeptName)] || { bg: '#333', text: '#FFFFFF' };
        syntheticHeader = window.PrintLayout.createDepartmentHeader(syntheticDeptName, printType, syntheticColors);
        syntheticTable = window.PrintLayout.createDepartmentTable(syntheticDeptName, syntheticTasks, dates, printType, isCompact);
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
        summary.style.width = '100%';
        summary.style.maxWidth = '800px';
        summary.style.margin = '0 auto';

        pageDiv.appendChild(deptHeader);
        pageDiv.appendChild(table);
        pageDiv.appendChild(summary);

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
        // Week layout: sidebar with header, table, summary
        const mainContentDiv = document.createElement('div');
        mainContentDiv.style.display = 'flex';
        mainContentDiv.style.alignItems = 'stretch';
        mainContentDiv.style.justifyContent = 'flex-start';

        mainContentDiv.appendChild(deptHeader);
        mainContentDiv.appendChild(table);

        // Create a wrapper for mainContent and summary to keep them together
        const contentWrapper = document.createElement('div');
        contentWrapper.style.display = 'flex';
        contentWrapper.style.flexDirection = 'column';
        contentWrapper.style.width = 'fit-content';

        contentWrapper.appendChild(mainContentDiv);

        // Make summary match the width of mainContentDiv
        summary.style.width = '100%';
        summary.style.boxSizing = 'border-box';
        contentWrapper.appendChild(summary);

        // Add synthetic department section if present
        if (syntheticHeader && syntheticTable) {
            const syntheticContentDiv = document.createElement('div');
            syntheticContentDiv.style.display = 'flex';
            syntheticContentDiv.style.alignItems = 'stretch';
            syntheticContentDiv.style.justifyContent = 'flex-start';
            syntheticContentDiv.style.marginTop = '1rem';

            syntheticContentDiv.appendChild(syntheticHeader);
            syntheticContentDiv.appendChild(syntheticTable);

            contentWrapper.appendChild(syntheticContentDiv);
        }

        pageDiv.appendChild(contentWrapper);
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
 * Generate complete print content for selected departments
 */
function generatePrintContent(printType, selectedDepts, weekDates, allTasks) {
    const printContainer = document.createElement('div');
    printContainer.className = 'print-preview-content';

    // Always generate synthetic Batch and Layout tasks
    // These are automatically merged with Cast and Demold respectively
    const generateBatchTasks = window.PrintUtils.generateBatchTasks;
    const generateLayoutTasks = window.PrintUtils.generateLayoutTasks;

    const batchTasks = generateBatchTasks(weekDates, allTasks);
    const layoutTasks = generateLayoutTasks(weekDates, allTasks);

    // Filter out batch and layout as they are synthetic departments
    const displayDepts = selectedDepts.filter(dept => dept !== 'Batch' && dept !== 'Layout');

    // Calculate if layout should be compact
    const totalTasks = displayDepts.reduce((sum, dept) => {
        const deptTasks = allTasks.filter(task => task.department === dept);
        return sum + getMaxTasksForDept(dept, deptTasks, weekDates, printType);
    }, 0);
    const isCompact = displayDepts.length > 4 || printType === 'day' || totalTasks > 20;

    const pages = [];

    displayDepts.forEach((dept) => {
        // Start with tasks for this department only (exclude synthetic tasks)
        let deptTasks = allTasks.filter(task => task.department === dept);

        // Filter by date range
        if (printType === 'week') {
            deptTasks = deptTasks.filter(task => {
                const taskDate = parseDate(task.date);
                return taskDate && weekDates.some(date => date && date.toDateString() === taskDate.toDateString());
            });
        } else if (weekDates && weekDates.length > 0 && weekDates[0]) {
            const dateString = weekDates[0].toDateString();
            deptTasks = deptTasks.filter(task => {
                const taskDate = parseDate(task.date);
                return taskDate && taskDate.toDateString() === dateString;
            });
        }

        // Prepare synthetic department tasks if applicable
        let syntheticTasks = null;
        let syntheticDeptName = null;

        // Check for Batch tasks (paired with Cast)
        if (dept === 'Cast') {
            // Filter batch tasks by date range
            const filteredBatchTasks = batchTasks.filter(task => {
                const taskDate = parseDate(task.date);
                if (!taskDate) return false;

                if (printType === 'week') {
                    return weekDates.some(date => date && date.toDateString() === taskDate.toDateString());
                } else if (weekDates && weekDates.length > 0 && weekDates[0]) {
                    return taskDate.toDateString() === weekDates[0].toDateString();
                }
                return false;
            });

            if (filteredBatchTasks.length > 0) {
                syntheticTasks = filteredBatchTasks;
                syntheticDeptName = 'Batch';
            }
        }

        // Check for Layout tasks (paired with Demold)
        if (dept === 'Demold') {
            // Filter layout tasks by date range
            const filteredLayoutTasks = layoutTasks.filter(task => {
                const taskDate = parseDate(task.date);
                if (!taskDate) return false;

                if (printType === 'week') {
                    return weekDates.some(date => date && date.toDateString() === taskDate.toDateString());
                } else if (weekDates && weekDates.length > 0 && weekDates[0]) {
                    return taskDate.toDateString() === weekDates[0].toDateString();
                }
                return false;
            });

            if (filteredLayoutTasks.length > 0) {
                syntheticTasks = filteredLayoutTasks;
                syntheticDeptName = 'Layout';
            }
        }

        // Skip if no tasks in main department and no synthetic tasks
        if (deptTasks.length === 0 && !syntheticTasks) return;

        // Get department colors
        const colors = getDepartmentColorMapping()[normalizeDepartmentClass(dept)] || { bg: '#333', text: '#FFFFFF' };

        // Create page for this department with optional synthetic department
        const page = createDepartmentPage(dept, deptTasks, weekDates, printType, isCompact, colors, syntheticTasks, syntheticDeptName);

        // Calculate max tasks for density class
        const maxTaskCount = getMaxTasksForDept(dept, deptTasks, weekDates, printType);
        applyDensityClass(page, maxTaskCount, printType);

        pages.push(page);
        printContainer.appendChild(page);
    });

    // Apply simplified page break rules
    applyPageBreakRules(pages);

    return printContainer;
}

/**
 * Apply robust auto-scaling to fit content within page bounds
 * Measures actual rendered dimensions and applies CSS transform scaling
 */
function applyPrintScaling(printContent, printType) {
    const pages = printContent.querySelectorAll('.print-page');

    // Define page dimensions in pixels (96 DPI standard)
    // Letter landscape: 11" x 8.5" minus 0.25" margins = 10.5" x 8" usable
    const pageMaxWidthPx = 10.5 * 96;   // ~1008px
    const pageMaxHeightPx = printType === 'day' ? 10 * 96 : 8 * 96; // ~768px for landscape, ~960px for day

    // Minimum scale to maintain readability (don't go below 50% scale)
    const MIN_SCALE = 0.5;

    // Base font size for scaling calculations (7pt is about 9.33px at 96 DPI)
    const BASE_FONT_SIZE = 7; // in points

    requestAnimationFrame(() => {
        setTimeout(() => {
            pages.forEach(page => {
                // Force layout recalculation
                page.offsetHeight;

                // Measure actual content dimensions
                const contentWidth = page.scrollWidth;
                const contentHeight = page.scrollHeight;

                // Calculate scale factors for both dimensions
                const widthScale = contentWidth > 0 ? pageMaxWidthPx / contentWidth : 1;
                const heightScale = contentHeight > 0 ? pageMaxHeightPx / contentHeight : 1;

                // Use the smaller scale to ensure everything fits
                // Never scale up (max 1.0), always scale down if needed
                let scale = Math.min(widthScale, heightScale, 1.0);

                // Apply minimum scale threshold
                scale = Math.max(scale, MIN_SCALE);

                // Only apply scaling if we need to shrink content
                if (scale < 1.0) {
                    // Calculate the scaled font size for the base
                    const scaledFontSize = BASE_FONT_SIZE * scale;

                    // Apply transform scaling to the page container
                    page.style.transform = `scale(${scale})`;
                    page.style.transformOrigin = 'top center';

                    // Set base font size on the page to work with em units
                    page.style.fontSize = `${scaledFontSize}pt`;

                    // Adjust container to account for scaling
                    page.style.width = `${100 / scale}%`;
                    page.style.height = 'auto';

                    console.log(`Print scaling applied: ${(scale * 100).toFixed(1)}% (${contentWidth}x${contentHeight}px -> ${pageMaxWidthPx}x${pageMaxHeightPx}px)`);
                } else {
                    // No scaling needed - content fits naturally
                    page.style.fontSize = `${BASE_FONT_SIZE}pt`;
                    console.log(`Print scaling: No scaling needed (content fits within page bounds)`);
                }
            });
        }, 100); // Small delay to ensure DOM is fully rendered
    });
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
    }, 1500);
}

// Export rendering functions
window.PrintRenderer = {
    createDepartmentPage,
    applyDensityClass,
    applyPageBreakRules,
    generatePrintContent,
    applyPrintScaling,
    executePrint
};