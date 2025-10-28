# Agent Testing Protocol

## Testing Responsibilities

The user will perform all testing of the application.

# Modular Print System Documentation

## Overview

The print system has been completely modularized to fix the blank page issue and improve maintainability. The system is now split into three main modules:

1. **print-layout.js** - Layout component creators
2. **print-renderer.js** - Page assembly and rendering
3. **print-utils.js** - Utility functions and bridge to modular system

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        index.html                            │
│  (Loads modules in order: layout → renderer → utils)        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     print-utils.js                           │
│  • Entry point for print operations                          │
│  • Delegates to modular system                               │
│  • Provides backward compatibility                           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────┬──────────────────────────────────────┐
│   print-layout.js    │        print-renderer.js             │
│  • Component creators│  • Page assembly                     │
│  • Headers           │  • Page break management             │
│  • Tables            │  • Print execution                   │
│  • Task cards        │  • Scaling logic                     │
│  • Summaries         │  • Cleanup                           │
└──────────────────────┴──────────────────────────────────────┘
```

## Module Details

### 1. print-layout.js

**Purpose**: Creates individual layout components for print reports.

**Key Functions**:

- `createDepartmentHeader(dept, printType, colors)` - Creates department header with proper styling
- `createDepartmentSummary(dept, totalHours, revenue)` - Creates summary footer
- `createTableHeader(dates, printType)` - Creates table header row
- `createTableFooter(dates, tasks, printType)` - Creates footer with daily totals
- `createPrintTaskCard(task, departmentClass)` - Creates individual task cards
- `createTableBody(dates, tasks, maxTasks, printType)` - Creates table body with all rows
- `createDepartmentTable(dept, tasks, dates, printType, isCompact)` - Assembles complete table

**Exports**: `window.PrintLayout`

### 2. print-renderer.js

**Purpose**: Assembles pages and manages the print process.

**Key Functions**:

- `createDepartmentPage(dept, tasks, dates, printType, isCompact, colors)` - Creates a complete page for one department
- `applyPageBreakRules(pages)` - **CRITICAL** - Applies page break rules to prevent blank pages
- `generatePrintContent(printType, selectedDepts, weekDates, allTasks)` - Main entry point for content generation
- `applyPrintScaling(printContent, printType)` - Scales content to fit page
- `executePrint(printContent, printType)` - Executes print with proper setup/cleanup

**Exports**: `window.PrintRenderer`

### 3. print-utils.js

**Purpose**: Provides utility functions and bridges to the modular system.

**Key Functions**:

- `getDepartmentColorMapping()` - Returns department color scheme
- `parseDate(dateStr)` - Parses dates from various formats
- `normalizeDepartmentClass(dept)` - Normalizes department names for CSS
- `getMaxTasksForDept(dept, tasks, dates, printType)` - Calculates max tasks per day
- `generatePrintContent(...)` - Delegates to `PrintRenderer.generatePrintContent()`
- `executePrint(...)` - Delegates to `PrintRenderer.executePrint()`

**Exports**: `window.PrintUtils`

## Page Break Management

The print system ensures proper page breaks between departments while preventing blank pages. The implementation involves:

### 1. Page Break Rules (in `applyPageBreakRules`)

```javascript
// Remove all page break styles first
page.style.pageBreakAfter = 'auto';
page.style.pageBreakBefore = 'auto';
page.style.pageBreakInside = 'avoid';

// Critical: Ensure no margins that could push content to next page
page.style.marginBottom = '0';
page.style.paddingBottom = '0';

// CRITICAL: Add page break after each department page except the last one
// This ensures each department prints on its own page when multiple departments are selected
if (index < pages.length - 1) {
    // Force page break between departments
    page.style.pageBreakAfter = 'always';
    page.style.breakAfter = 'page';
} else {
    // Last page: explicitly prevent page break to avoid blank pages
    page.style.pageBreakAfter = 'avoid';
    page.style.breakAfter = 'avoid';
}
```

### 2. Print CSS (in `executePrint`)

```css
/* Each department page should be kept together and break to new page */
.print-page {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
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

/* Override any page breaks on last elements to prevent blank pages */
.print-preview-content > :last-child {
    page-break-after: avoid !important;
    break-after: avoid !important;
}
```

### 3. Key Principles

1. **Always add page breaks between departments** - Each department gets its own page
2. **Never add page breaks after the last page** - Prevents blank pages at the end
3. **Remove all margins/padding that could push content** - Ensures clean page boundaries
4. **Use `page-break-inside: avoid` to keep content together** - Prevents department content from splitting
5. **Apply rules to both modern (`break-*`) and legacy (`page-break-*`) properties** - Maximum browser compatibility

### 4. Behavior

- **Single Department**: Prints on one page with no page break after
- **Multiple Departments**: Each department prints on its own page with page breaks between them
- **Weekly Print**: Each department gets a landscape page
- **Daily Print**: Each department gets a portrait page

## Usage

### Basic Usage

```javascript
// Generate print content
const printContent = window.PrintUtils.generatePrintContent(
    'week',              // printType: 'week' or 'day'
    ['Mill', 'Cast'],    // selectedDepts: array of department names
    weekDates,           // weekDates: array of Date objects
    allTasks             // allTasks: array of task objects
);

// Execute print
window.PrintUtils.executePrint(printContent, 'week');
```

### Direct Module Usage

```javascript
// Use layout components directly
const header = window.PrintLayout.createDepartmentHeader('Mill', 'week', colors);
const table = window.PrintLayout.createDepartmentTable('Mill', tasks, dates, 'week', false);

// Use renderer directly
const page = window.PrintRenderer.createDepartmentPage('Mill', tasks, dates, 'week', false, colors);
window.PrintRenderer.executePrint(printContent, 'week');
```

## Testing

### Single Department Test

1. Open the application
2. Click the print button
3. Select **only one department** (e.g., "Mill")
4. Choose "Print Week" or "Print Day"
5. Click "Print Selected"
6. **Verify**: Only one page should be generated with no blank pages

### Multiple Departments Test

1. Select 2-3 departments (e.g., "Mill", "Cast", "Finish")
2. Print the report (either weekly or daily)
3. **Verify**: Each department gets its own page with a page break between them
4. **Verify**: No blank page after the last department
5. **Verify**: Content doesn't overflow or get cut off

### Weekly vs Daily Print Test

1. Test with multiple departments in **Weekly Print** mode
   - **Verify**: Landscape orientation with page breaks between departments
2. Test with multiple departments in **Daily Print** mode
   - **Verify**: Portrait orientation with page breaks between departments

## Troubleshooting

### Issue: Blank pages still appearing

**Check**:
1. Ensure all three modules are loaded in correct order in [`index.html`](index.html:8)
2. Verify `applyPageBreakRules` is being called
3. Check browser console for errors
4. Ensure print CSS is being applied

### Issue: Content overflowing page

**Check**:
1. Verify `applyPrintScaling` is working
2. Check `pageMaxHeightPx` calculation
3. Adjust scaling factor if needed

### Issue: Page breaks in wrong places

**Check**:
1. Verify `page-break-inside: avoid` is applied to all content
2. Check table row break prevention CSS
3. Ensure no conflicting CSS from other sources

## Maintenance

### Adding New Components

1. Add component creator to [`print-layout.js`](print-layout.js:1)
2. Export via `window.PrintLayout`
3. Use in [`print-renderer.js`](print-renderer.js:1) page assembly

### Modifying Page Breaks

1. Edit `applyPageBreakRules` in [`print-renderer.js`](print-renderer.js:60)
2. Update print CSS in `executePrint` if needed
3. Test with single and multiple departments

### Changing Styles

1. Department colors: Edit `getDepartmentColorMapping` in [`print-utils.js`](print-utils.js:24)
2. Layout styles: Edit component creators in [`print-layout.js`](print-layout.js:1)
3. Print-specific CSS: Edit `executePrint` in [`print-renderer.js`](print-renderer.js:150)

## Benefits of Modular System

1. **Separation of Concerns**: Layout, rendering, and utilities are separate
2. **Easier Testing**: Each module can be tested independently
3. **Better Maintainability**: Changes are localized to specific modules
4. **Reusability**: Components can be reused across different print types
5. **Debugging**: Easier to identify and fix issues in specific modules
6. **Extensibility**: New features can be added without affecting existing code

## Migration Notes

The old monolithic print system in [`index.html`](index.html:3111) has been replaced. The new system:

- Maintains backward compatibility through [`print-utils.js`](print-utils.js:1)
- Uses the same public API (`window.PrintUtils`)
- Provides fallback to legacy system if modules fail to load
- Fixes the blank page issue that occurred with single department prints

## Performance

The modular system has similar performance to the old system:

- **Load time**: Slightly increased due to three files vs one inline
- **Execution time**: Same or better due to optimized page break logic
- **Memory usage**: Similar, with better cleanup
- **Print quality**: Improved due to better page break management

## Future Enhancements

Potential improvements:

1. Add print preview functionality
2. Support for custom page sizes
3. Export to PDF functionality
4. Batch printing multiple weeks
5. Print templates for different report types
6. Advanced scaling options