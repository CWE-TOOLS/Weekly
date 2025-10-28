/**
 * Print Renderer - Modular rendering system for print reports
 * Handles page assembly and print execution with proper page break management
 */

// ============================================
// PAGE ASSEMBLY
// ============================================

/**
 * Create a single department page with proper structure
 */
function createDepartmentPage(dept, tasks, dates, printType, isCompact, colors) {
    const pageDiv = document.createElement('div');
    pageDiv.className = `print-page ${printType === 'day' ? 'print-page-day' : ''}`;
    pageDiv.style.display = 'flex';
    pageDiv.style.flexDirection = 'column';
    pageDiv.style.justifyContent = 'center';
    pageDiv.style.alignItems = 'center';
    pageDiv.style.minHeight = printType === 'day' ? '10in' : '7.5in';
    
    // Calculate totals
    let totalHours = 0;
    tasks.forEach(task => {
        const hours = parseFloat(task.hours);
        if (!isNaN(hours)) {
            totalHours += hours;
        }
    });
    const revenue = Math.round(totalHours * 135);
    
    // Create components
    const deptHeader = window.PrintLayout.createDepartmentHeader(dept, printType, colors);
    const table = window.PrintLayout.createDepartmentTable(dept, tasks, dates, printType, isCompact);
    const summary = window.PrintLayout.createDepartmentSummary(dept, totalHours, revenue);
    
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
        
        pageDiv.appendChild(contentWrapper);
    }
    
    return pageDiv;
}

/**
 * Apply page break rules to prevent blank pages
 * CRITICAL: This ensures page breaks between departments while preventing blank pages
 */
function applyPageBreakRules(pages) {
    if (!pages || pages.length === 0) return;
    
    pages.forEach((page, index) => {
        // Remove all page break styles first
        page.style.pageBreakAfter = 'auto';
        page.style.pageBreakBefore = 'auto';
        page.style.pageBreakInside = 'avoid';
        page.style.breakAfter = 'auto';
        page.style.breakBefore = 'auto';
        page.style.breakInside = 'avoid';
        
        // Critical: Ensure no margins/padding that could push content to next page
        page.style.margin = '0';
        page.style.padding = '0';
        page.style.marginBottom = '0';
        page.style.paddingBottom = '0';
        
        // Prevent orphans and widows
        page.style.orphans = '999';
        page.style.widows = '999';
        
        // CRITICAL: Add page break after each department page except the last one
        // This ensures each department prints on its own page when multiple departments are selected
        if (index < pages.length - 1) {
            // Force page break between departments
            page.style.pageBreakAfter = 'always';
            page.style.breakAfter = 'page';
            // Ensure the break is respected
            page.style.pageBreakInside = 'avoid';
            page.style.breakInside = 'avoid';
        } else {
            // Last page: explicitly prevent page break to avoid blank pages
            page.style.pageBreakAfter = 'avoid';
            page.style.breakAfter = 'avoid';
            page.style.pageBreakBefore = 'auto';
            page.style.breakBefore = 'auto';
        }
    });
}

/**
 * Generate complete print content for selected departments
 */
function generatePrintContent(printType, selectedDepts, weekDates, allTasks) {
    const printContainer = document.createElement('div');
    printContainer.className = 'print-preview-content';
    
    // Filter out batch and layout as they are handled separately
    const displayDepts = selectedDepts.filter(dept => dept !== 'Batch' && dept !== 'Layout');
    
    // Calculate if layout should be compact
    const totalTasks = displayDepts.reduce((sum, dept) => {
        const deptTasks = allTasks.filter(task => task.department === dept);
        return sum + getMaxTasksForDept(dept, deptTasks, weekDates, printType);
    }, 0);
    const isCompact = displayDepts.length > 4 || printType === 'day' || totalTasks > 20;
    
    const pages = [];
    
    displayDepts.forEach((dept) => {
        // Filter tasks for this department and date range
        let deptTasks = allTasks.filter(task => task.department === dept);
        if (printType === 'week') {
            deptTasks = deptTasks.filter(task => {
                const taskDate = parseDate(task.date);
                return taskDate && weekDates.some(date => date.toDateString() === taskDate.toDateString());
            });
        } else {
            const dateString = weekDates[0].toDateString();
            deptTasks = deptTasks.filter(task => {
                const taskDate = parseDate(task.date);
                return taskDate && taskDate.toDateString() === dateString;
            });
        }
        
        // Skip if no tasks
        if (deptTasks.length === 0) return;
        
        // Get department colors
        const colors = getDepartmentColorMapping()[normalizeDepartmentClass(dept)] || { bg: '#333', text: '#FFFFFF' };
        
        // Create page for this department
        const page = createDepartmentPage(dept, deptTasks, weekDates, printType, isCompact, colors);
        pages.push(page);
        printContainer.appendChild(page);
    });
    
    // Apply page break rules to prevent blank pages
    applyPageBreakRules(pages);
    
    return printContainer;
}

/**
 * Apply intelligent scaling to fit content within page bounds
 */
function applyPrintScaling(printContent, printType) {
    const pages = printContent.querySelectorAll('.print-page');
    const pageMaxHeightPx = printType === 'day' ? 7 * 96 : 6 * 96; // Convert inches to pixels
    
    requestAnimationFrame(() => {
        setTimeout(() => {
            pages.forEach(page => {
                page.offsetHeight; // Force layout recalculation
                const height = page.offsetHeight;
                if (height > pageMaxHeightPx) {
                    const scale = pageMaxHeightPx / height;
                    page.style.zoom = scale;
                }
            });
        }, 100);
    });
}

/**
 * Execute print with proper setup and cleanup
 */
function executePrint(printContent, printType = 'week') {
    // Create dynamic print styles
    let dynamicStyle = null;
    if (printType === 'day') {
        dynamicStyle = document.createElement('style');
        dynamicStyle.textContent = '@page { size: letter portrait; margin: 0.5in; }';
        document.head.appendChild(dynamicStyle);
    }
    
    // Add comprehensive print-specific CSS to ensure page breaks between departments
    const blankPageFix = document.createElement('style');
    blankPageFix.textContent = `
        @media print {
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            
            /* Critical: Prevent blank pages while allowing department page breaks */
            html, body {
                margin: 0 !important;
                padding: 0 !important;
                height: auto !important;
            }
            
            /* Each department page should be kept together and break to new page */
            .print-page {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                margin: 0 !important;
                padding: 0 !important;
                orphans: 999 !important;
                widows: 999 !important;
            }
            
            /* Ensure page breaks between departments (except after last) */
            .print-page:not(:last-child) {
                page-break-after: always !important;
                break-after: page !important;
            }
            
            /* Last page should never force a page break to prevent blank pages */
            .print-page:last-child,
            .print-page:only-child {
                page-break-after: avoid !important;
                break-after: avoid !important;
                margin-bottom: 0 !important;
                padding-bottom: 0 !important;
            }
            
            /* Prevent table row breaks but preserve table structure */
            .print-table {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            
            /* Ensure no forced breaks on container */
            .print-preview-content {
                margin: 0 !important;
                padding: 0 !important;
            }
            
            /* Override any page breaks on last elements to prevent blank pages */
            .print-preview-content > :last-child {
                page-break-after: avoid !important;
                break-after: avoid !important;
                margin-bottom: 0 !important;
                padding-bottom: 0 !important;
            }
        }
    `;
    document.head.appendChild(blankPageFix);
    
    document.body.appendChild(printContent);
    
    // Apply scaling if needed
    applyPrintScaling(printContent, printType);
    
    // Execute print after scaling
    setTimeout(() => {
        window.print();
        
        // Cleanup
        if (dynamicStyle) {
            document.head.removeChild(dynamicStyle);
        }
        document.head.removeChild(blankPageFix);
        document.body.removeChild(printContent);
    }, 1500);
}

// Export rendering functions
window.PrintRenderer = {
    createDepartmentPage,
    applyPageBreakRules,
    generatePrintContent,
    applyPrintScaling,
    executePrint
};