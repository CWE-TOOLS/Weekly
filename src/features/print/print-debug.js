/**
 * Print Debug Utilities
 * Helps diagnose blank page issues in print reports
 */

window.PrintDebug = {
    /**
     * Enable debug mode - adds visual indicators and console logging
     */
    enableDebugMode() {
        console.log('🔍 Print Debug Mode Enabled');
        window.PRINT_DEBUG_MODE = true;
    },

    /**
     * Disable debug mode
     */
    disableDebugMode() {
        console.log('🔍 Print Debug Mode Disabled');
        window.PRINT_DEBUG_MODE = false;
    },

    /**
     * Analyze print content before printing
     */
    analyzePrintContent(printContent) {
        console.log('📊 === PRINT CONTENT ANALYSIS ===');
        
        const pages = printContent.querySelectorAll('.print-page');
        console.log(`📄 Total pages: ${pages.length}`);
        
        pages.forEach((page, index) => {
            console.log(`\n📄 Page ${index + 1}:`);
            console.log(`  Height: ${page.offsetHeight}px`);
            console.log(`  Width: ${page.offsetWidth}px`);
            console.log(`  Margin Bottom: ${getComputedStyle(page).marginBottom}`);
            console.log(`  Padding Bottom: ${getComputedStyle(page).paddingBottom}`);
            console.log(`  Page Break After: ${getComputedStyle(page).pageBreakAfter}`);
            console.log(`  Break After: ${getComputedStyle(page).breakAfter}`);
            
            // Check for overflow
            if (page.scrollHeight > page.offsetHeight) {
                console.warn(`  ⚠️ Content overflow detected! ScrollHeight: ${page.scrollHeight}px`);
            }
            
            // Check for invisible content
            const allElements = page.querySelectorAll('*');
            let invisibleCount = 0;
            allElements.forEach(el => {
                const style = getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                    invisibleCount++;
                }
            });
            if (invisibleCount > 0) {
                console.warn(`  ⚠️ ${invisibleCount} invisible elements found`);
            }
        });
        
        console.log('\n📊 === END ANALYSIS ===\n');
    },

    /**
     * Add visual debug markers to print content
     */
    addVisualDebugMarkers(printContent) {
        const pages = printContent.querySelectorAll('.print-page');
        
        pages.forEach((page, index) => {
            // Add page number indicator
            const indicator = document.createElement('div');
            indicator.style.cssText = `
                position: absolute;
                top: 5px;
                right: 5px;
                background: red;
                color: white;
                padding: 5px 10px;
                font-weight: bold;
                font-size: 14px;
                z-index: 9999;
                border: 2px solid black;
            `;
            indicator.textContent = `PAGE ${index + 1}`;
            page.style.position = 'relative';
            page.appendChild(indicator);
            
            // Add border to page
            page.style.border = '3px solid red';
            page.style.boxSizing = 'border-box';
            
            // Highlight last page
            if (index === pages.length - 1) {
                page.style.backgroundColor = '#ffffcc';
                indicator.style.background = 'green';
                indicator.textContent = `LAST PAGE (${index + 1})`;
            }
        });
        
        console.log('✅ Visual debug markers added');
    },

    /**
     * Check for common blank page causes
     */
    checkBlankPageCauses(printContent) {
        console.log('🔍 === CHECKING BLANK PAGE CAUSES ===');
        
        const issues = [];
        const pages = printContent.querySelectorAll('.print-page');
        
        // Check 1: Empty pages
        pages.forEach((page, index) => {
            const textContent = page.textContent.trim();
            if (!textContent || textContent.length < 10) {
                issues.push(`Page ${index + 1}: Appears to be empty or has minimal content`);
            }
        });
        
        // Check 2: Page break issues
        pages.forEach((page, index) => {
            const style = getComputedStyle(page);
            if (index === pages.length - 1) {
                if (style.pageBreakAfter !== 'auto' && style.pageBreakAfter !== 'avoid') {
                    issues.push(`Last page (${index + 1}): Has page-break-after: ${style.pageBreakAfter} (should be 'avoid' or 'auto')`);
                }
            }
        });
        
        // Check 3: Excessive margins/padding
        pages.forEach((page, index) => {
            const style = getComputedStyle(page);
            const marginBottom = parseInt(style.marginBottom);
            const paddingBottom = parseInt(style.paddingBottom);
            
            if (marginBottom > 50) {
                issues.push(`Page ${index + 1}: Large margin-bottom: ${marginBottom}px`);
            }
            if (paddingBottom > 50) {
                issues.push(`Page ${index + 1}: Large padding-bottom: ${paddingBottom}px`);
            }
        });
        
        // Check 4: Floating elements
        pages.forEach((page, index) => {
            const floatingElements = page.querySelectorAll('[style*="float"]');
            if (floatingElements.length > 0) {
                issues.push(`Page ${index + 1}: Contains ${floatingElements.length} floating elements`);
            }
        });
        
        // Check 5: Absolute positioned elements
        pages.forEach((page, index) => {
            const absoluteElements = Array.from(page.querySelectorAll('*')).filter(el => {
                return getComputedStyle(el).position === 'absolute';
            });
            if (absoluteElements.length > 0) {
                issues.push(`Page ${index + 1}: Contains ${absoluteElements.length} absolutely positioned elements`);
            }
        });
        
        if (issues.length === 0) {
            console.log('✅ No obvious issues found');
        } else {
            console.log('⚠️ Potential issues found:');
            issues.forEach(issue => console.log(`  - ${issue}`));
        }
        
        console.log('🔍 === END CHECK ===\n');
        
        return issues;
    },

    /**
     * Generate a detailed debug report
     */
    generateDebugReport(printContent, printType, selectedDepts) {
        console.log('📋 === GENERATING DEBUG REPORT ===');
        
        const report = {
            timestamp: new Date().toISOString(),
            printType: printType,
            selectedDepartments: selectedDepts,
            totalPages: printContent.querySelectorAll('.print-page').length,
            pages: [],
            issues: []
        };
        
        const pages = printContent.querySelectorAll('.print-page');
        pages.forEach((page, index) => {
            const style = getComputedStyle(page);
            const pageInfo = {
                pageNumber: index + 1,
                isLastPage: index === pages.length - 1,
                dimensions: {
                    height: page.offsetHeight,
                    width: page.offsetWidth,
                    scrollHeight: page.scrollHeight,
                    scrollWidth: page.scrollWidth
                },
                styles: {
                    marginBottom: style.marginBottom,
                    paddingBottom: style.paddingBottom,
                    pageBreakAfter: style.pageBreakAfter,
                    pageBreakBefore: style.pageBreakBefore,
                    breakAfter: style.breakAfter,
                    breakBefore: style.breakBefore
                },
                contentLength: page.textContent.trim().length,
                hasOverflow: page.scrollHeight > page.offsetHeight
            };
            report.pages.push(pageInfo);
        });
        
        report.issues = this.checkBlankPageCauses(printContent);
        
        console.log('📋 Debug Report:', report);
        console.log('📋 === END REPORT ===\n');
        
        return report;
    },

    /**
     * Test print with debug mode
     */
    testPrint(printType, selectedDepts, weekDates, allTasks) {
        console.log('🧪 === STARTING DEBUG PRINT TEST ===');
        console.log(`Print Type: ${printType}`);
        console.log(`Selected Departments: ${selectedDepts.join(', ')}`);
        
        // Generate content
        const printContent = window.PrintUtils.generatePrintContent(
            printType,
            selectedDepts,
            weekDates,
            allTasks
        );
        
        // Analyze content
        this.analyzePrintContent(printContent);
        
        // Check for issues
        const issues = this.checkBlankPageCauses(printContent);
        
        // Add visual markers
        this.addVisualDebugMarkers(printContent);
        
        // Generate report
        const report = this.generateDebugReport(printContent, printType, selectedDepts);
        
        // Add to DOM for inspection
        document.body.appendChild(printContent);
        printContent.style.display = 'block';
        printContent.style.position = 'relative';
        printContent.style.zIndex = '10000';
        printContent.style.background = 'white';
        printContent.style.padding = '20px';
        
        console.log('✅ Debug print content added to page. Inspect it before printing.');
        console.log('💡 To remove: document.querySelector(".print-preview-content").remove()');
        console.log('🧪 === END DEBUG TEST ===\n');
        
        return { printContent, report, issues };
    },

    /**
     * Quick fix: Force remove all page breaks from last page
     */
    forceFixLastPage(printContent) {
        const pages = printContent.querySelectorAll('.print-page');
        if (pages.length === 0) return;
        
        const lastPage = pages[pages.length - 1];
        
        // Nuclear option: remove ALL page break properties
        lastPage.style.pageBreakAfter = 'avoid !important';
        lastPage.style.pageBreakBefore = 'avoid !important';
        lastPage.style.pageBreakInside = 'avoid !important';
        lastPage.style.breakAfter = 'avoid !important';
        lastPage.style.breakBefore = 'avoid !important';
        lastPage.style.breakInside = 'avoid !important';
        lastPage.style.marginBottom = '0 !important';
        lastPage.style.paddingBottom = '0 !important';
        lastPage.style.marginTop = '0 !important';
        lastPage.style.paddingTop = '0 !important';
        
        // Also apply to all children
        const allElements = lastPage.querySelectorAll('*');
        allElements.forEach(el => {
            el.style.pageBreakAfter = 'avoid !important';
            el.style.breakAfter = 'avoid !important';
            el.style.marginBottom = '0 !important';
            el.style.paddingBottom = '0 !important';
        });
        
        console.log('✅ Force-fixed last page');
    }
};

// Auto-enable debug mode if URL contains ?debug
if (window.location.search.includes('debug')) {
    window.PrintDebug.enableDebugMode();
    console.log('🔍 Debug mode auto-enabled via URL parameter');
}