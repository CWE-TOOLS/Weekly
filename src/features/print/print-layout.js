/**
 * Print Layout Components - Modular layout system for print reports
 * Handles component creation and layout management
 */

import { REVENUE } from '../../config/business-constants.js';
import { PRINT_LAYOUT } from '../../config/layout-constants.js';


// ============================================
// LAYOUT COMPONENT CREATORS
// ============================================

/**
 * Create a department header component
 */
function createDepartmentHeader(dept, printType, colors) {
    const header = document.createElement('div');
    header.className = `print-department-header department-${window.PrintUtils.normalizeDepartmentClass(dept)}`;

    if (printType === 'day') {
        header.classList.add('print-department-header-day');
    }

    // Apply department colors directly to the header
    header.style.backgroundColor = colors.bg;
    header.style.color = colors.text;

    const deptText = dept === 'Special Events' ? dept.replace(' ', '<br>') : dept;
    header.textContent = deptText;

    return header;
}

/**
 * Create a department summary row for the table footer
 */
function createDepartmentSummaryRow(dept, totalHours, revenue, dates, printType) {
    const summaryRow = document.createElement('tr');
    const summaryCell = document.createElement('td');
    summaryCell.colSpan = printType === 'week' ? dates.length : 4;
    summaryCell.className = 'print-dept-summary';
    summaryCell.textContent = `${dept} - Total Hours: ${Math.round(totalHours)}, Revenue: $${revenue.toLocaleString()}`;
    summaryRow.appendChild(summaryCell);
    return summaryRow;
}

/**
 * Create table header row
 */
function createTableHeader(dates, printType) {
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    if (printType === 'week') {
        dates.forEach(date => {
            if (!date) return;
            const th = document.createElement('th');
            th.innerHTML = `${date.toLocaleDateString('en-US', { weekday: 'short' })}<br>${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
            headerRow.appendChild(th);
        });
    } else if (dates && dates.length > 0) {
        // Daily print headers
        const singleDate = Array.isArray(dates) ? dates[0] : dates;
        const headers = [
            singleDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }),
            'Revenue', 'Mid-Day', 'End of Day'
        ];
        headers.forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            headerRow.appendChild(th);
        });
    }

    thead.appendChild(headerRow);
    return thead;
}

/**
 * Create table footer with daily totals
 */
function createTableFooter(dates, tasks, printType) {
    if (printType !== 'week') return null;

    const tfoot = document.createElement('tfoot');
    const revenueRow = document.createElement('tr');
    revenueRow.style.borderTop = '2px solid #666';
    revenueRow.style.fontSize = `${PRINT_LAYOUT.REVENUE_ROW_FONT_SIZE_EM}em`;
    revenueRow.style.background = '#e8e8e8';

    dates.forEach(date => {
        if (!date) return;
        const dateString = date.toDateString();
        const dayTasks = tasks.filter(t => {
            const taskDate = window.PrintUtils.parseDate(t.date);
            return taskDate && taskDate.toDateString() === dateString;
        });

        let dayHours = 0;
        dayTasks.forEach(task => {
            const hours = parseFloat(task.hours);
            if (!isNaN(hours)) dayHours += hours;
        });
        const dayRevenue = Math.round(dayHours * REVENUE.HOURLY_RATE);

        const revenueCell = document.createElement('td');
        revenueCell.innerHTML = `<strong>Daily Total</strong><br>$${dayRevenue.toLocaleString()}`;
        revenueCell.style.fontWeight = 'bold';
        revenueCell.style.textAlign = 'center';
        revenueCell.style.padding = `${PRINT_LAYOUT.REVENUE_CELL_PADDING_EM}em`;
        revenueRow.appendChild(revenueCell);
    });

    tfoot.appendChild(revenueRow);
    return tfoot;
}

/**
 * Create a task card for printing
 */
function createPrintTaskCard(task, departmentClass) {
    const card = document.createElement('div');
    card.className = `print-task-card department-${departmentClass}`;
    
    const colors = window.PrintUtils.getDepartmentColorMapping()[departmentClass] || { bg: '#333', text: '#FFFFFF' };
    
    // Calculate revenue based on hours
    const hours = parseFloat(task.hours || 0);
    const revenue = hours * REVENUE.HOURLY_RATE;
    
    card.innerHTML = `
        <div class="print-task-title" style="background-color: ${colors.bg} !important; color: ${colors.text} !important;">
            ${task.project || 'Unknown Project'}
        </div>
        <div class="print-task-day-counter">
            ${task.dayCounter || ''}
        </div>
        <div class="print-task-description">
            ${task.description && task.description.trim() ? task.description : '<span class="print-missing-description">Staging Missing</span>'}
        </div>
        <div class="print-task-details">
            ${task.missingDate ? '<strong>Date:</strong> Missing<br>' : ''}
            <strong>hrs:</strong> ${Math.round(hours)} | <strong>Revenue:</strong> $${revenue.toLocaleString()}
        </div>
    `;
    
    return card;
}

/**
 * Create table body with task rows
 */
function createTableBody(dates, tasks, maxTasks, printType) {
    const tbody = document.createElement('tbody');

    if (printType === 'week') {
        // Sort tasks by date and then by some consistent ordering
        const sortedTasks = [...tasks].sort((a, b) => {
            const dateA = window.PrintUtils.parseDate(a.date);
            const dateB = window.PrintUtils.parseDate(b.date);
            if (dateA && dateB) {
                const dateDiff = dateA - dateB;
                if (dateDiff !== 0) return dateDiff;
            }
            // If dates are the same, sort by some stable criteria (e.g., project name + description)
            return (a.project + a.description).localeCompare(b.project + b.description);
        });

        // Group tasks by date
        const tasksByDate = {};
        dates.forEach(date => {
            if (!date) return;
            const dateString = date.toDateString();
            tasksByDate[dateString] = sortedTasks.filter(t => {
                const taskDate = window.PrintUtils.parseDate(t.date);
                return taskDate && taskDate.toDateString() === dateString;
            });
        });

        for (let row = 0; row < maxTasks; row++) {
            const tr = document.createElement('tr');

            dates.forEach(date => {
                if (!date) return;
                const dateString = date.toDateString();
                const dayTasks = tasksByDate[dateString];

                const td = document.createElement('td');
                td.className = 'print-grid-cell';

                if (dayTasks && dayTasks[row]) {
                    const task = dayTasks[row];
                    const departmentClass = window.PrintUtils.normalizeDepartmentClass(task.department);
                    const card = createPrintTaskCard(task, departmentClass);
                    td.appendChild(card);
                }

                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        }
    } else if (dates && dates.length > 0) {
        // Daily print layout
        const singleDate = Array.isArray(dates) ? dates[0] : dates;
        const dateString = singleDate.toDateString();
        const dayTasks = tasks.filter(t => {
            const taskDate = window.PrintUtils.parseDate(t.date);
            return taskDate && taskDate.toDateString() === dateString;
        }).sort((a, b) => (a.project + a.description).localeCompare(b.project + b.description)); // Sort for consistency

        for (let row = 0; row < maxTasks; row++) {
            const tr = document.createElement('tr');
            const task = dayTasks[row];

            // Task cell
            const taskCell = document.createElement('td');
            taskCell.className = 'print-grid-cell';
            taskCell.style.width = `${PRINT_LAYOUT.TASK_CELL_WIDTH_PERCENT}%`;
            if (task) {
                const departmentClass = window.PrintUtils.normalizeDepartmentClass(task.department);
                const card = createPrintTaskCard(task, departmentClass);
                card.style.margin = '0 auto';
                card.style.maxWidth = `${PRINT_LAYOUT.CARD_MAX_WIDTH_PX}px`;
                taskCell.appendChild(card);
            }
            tr.appendChild(taskCell);

            // Revenue cell
            const revenueCell = document.createElement('td');
            revenueCell.className = 'print-grid-cell';
            revenueCell.style.textAlign = 'center';
            revenueCell.style.fontSize = `${PRINT_LAYOUT.REVENUE_FONT_SIZE_REM * 3}rem`;
            revenueCell.style.fontWeight = 'bold';
            revenueCell.style.width = `${PRINT_LAYOUT.PERIOD_CELL_WIDTH_PERCENT}%`;
            if (task && task.hours) {
                const hours = parseFloat(task.hours);
                const revenue = isNaN(hours) ? 0 : Math.round(Math.round(hours) * REVENUE.HOURLY_RATE);
                revenueCell.textContent = `$${revenue.toLocaleString()}`;
            } else {
                revenueCell.textContent = '';
            }
            tr.appendChild(revenueCell);

            // Mid-Day cell (blank)
            const midDayCell = document.createElement('td');
            midDayCell.className = 'print-grid-cell';
            midDayCell.style.textAlign = 'center';
            midDayCell.style.width = `${PRINT_LAYOUT.PERIOD_CELL_WIDTH_PERCENT}%`;
            midDayCell.textContent = '';
            tr.appendChild(midDayCell);

            // End of Day cell (blank)
            const endOfDayCell = document.createElement('td');
            endOfDayCell.className = 'print-grid-cell';
            endOfDayCell.style.textAlign = 'center';
            endOfDayCell.style.width = `${PRINT_LAYOUT.PERIOD_CELL_WIDTH_PERCENT}%`;
            endOfDayCell.textContent = '';
            tr.appendChild(endOfDayCell);

            tbody.appendChild(tr);
        }
    }

    return tbody;
}

/**
 * Create a complete table for a department
 */
function createDepartmentTable(dept, tasks, dates, printType, isCompact, totalHours, revenue) {
    const table = document.createElement('table');
    table.className = `print-table ${printType === 'day' ? 'print-table-day daily-print' : ''} ${isCompact ? 'compact' : ''}`;

    // Add header
    const thead = createTableHeader(dates, printType);
    table.appendChild(thead);

    // Calculate max tasks from the already-filtered task list (includes merged Batch/Layout tasks)
    let maxTasks = 0;
    if (printType === 'day') {
        const dailyDate = Array.isArray(dates) ? dates[0] : dates;
        const dateString = dailyDate.toDateString();
        maxTasks = tasks.filter(t => {
            const taskDate = window.PrintUtils.parseDate(t.date);
            return taskDate && taskDate.toDateString() === dateString;
        }).length;
    } else {
        // Weekly view: find max tasks for any single day
        dates.forEach(date => {
            if (!date) return;
            const dateString = date.toDateString();
            const count = tasks.filter(t => {
                const taskDate = window.PrintUtils.parseDate(t.date);
                return taskDate && taskDate.toDateString() === dateString;
            }).length;
            if (count > maxTasks) maxTasks = count;
        });
    }

    // Add body
    if (printType === 'day') {
        const dailyDate = Array.isArray(dates) ? dates[0] : dates;
        const tbody = createTableBody([dailyDate], tasks, maxTasks, 'day');
        table.appendChild(tbody);
    } else {
        // Weekly view uses the full dates array
        const tbody = createTableBody(dates, tasks, maxTasks, 'week');
        table.appendChild(tbody);
    }

    // Add footer
    let tfoot = createTableFooter(dates, tasks, printType);
    if (!tfoot) {
        tfoot = document.createElement('tfoot');
    }
    
    const summaryRow = createDepartmentSummaryRow(dept, totalHours, revenue, dates, printType);
    tfoot.appendChild(summaryRow);
    table.appendChild(tfoot);

    return table;
}

// ============================================
// FROZEN DAILY LAYOUT COMPONENTS
// ============================================

/**
 * Create frozen daily report header
 */
function createFrozenDailyHeader(date) {
    const header = document.createElement('div');
    header.className = 'frozen-daily-header';

    const dateStr = date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    header.innerHTML = `
        <h1>FROZEN DAILY - ${dateStr}</h1>
        <p class="frozen-subtitle">Next Business Day Revenue Targets</p>
    `;

    return header;
}

/**
 * Create frozen daily summary table (one line per department)
 */
function createFrozenDailySummaryTable(departmentSummaries) {
    const table = document.createElement('table');
    table.className = 'frozen-summary-table';

    // Create header
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th class="dept-col">Department</th>
            <th class="revenue-col">Target Revenue</th>
            <th class="actual-col">Actual</th>
            <th class="overtime-col">Overtime</th>
        </tr>
    `;
    table.appendChild(thead);

    // Create body with department rows
    const tbody = document.createElement('tbody');
    let grandTotal = 0;

    // Get color mapping
    const colorMapping = window.PrintUtils.getDepartmentColorMapping();

    departmentSummaries.forEach(summary => {
        const row = document.createElement('tr');
        // Use Crating color for combined Crating + Load department
        let deptClass = window.PrintUtils.normalizeDepartmentClass(summary.department);
        if (summary.department === 'Crating + Load') {
            deptClass = window.PrintUtils.normalizeDepartmentClass('Crating');
        }
        const colors = colorMapping[deptClass] || { bg: '#666', text: '#FFFFFF' };

        // Create department name cell with color
        const deptCell = document.createElement('td');
        deptCell.className = 'dept-name';
        deptCell.textContent = summary.department;
        deptCell.style.backgroundColor = colors.bg;
        deptCell.style.color = colors.text;
        row.appendChild(deptCell);

        // Create revenue cell with breakdown if applicable
        const revenueCell = document.createElement('td');
        revenueCell.className = 'target-revenue';

        if (summary.breakdown) {
            // Show breakdown for combined departments (Crating + Load)
            // Format: Line 1: Crating: $X
            //         Line 2: + Load: $Y
            //         Line 3: = $Total
            let html = '';

            if (summary.breakdown.crate > 0) {
                html += `Crating: $${summary.breakdown.crate.toLocaleString()}`;
            }

            if (summary.breakdown.load > 0) {
                if (html) html += '<br>';
                html += `+ Load: $${summary.breakdown.load.toLocaleString()}`;
            }

            if (html) html += '<br>';
            html += `<strong>= $${summary.targetRevenue.toLocaleString()}</strong>`;

            revenueCell.innerHTML = html;
        } else {
            revenueCell.textContent = `$${summary.targetRevenue.toLocaleString()}`;
        }

        row.appendChild(revenueCell);

        // Create actual cell
        const actualCell = document.createElement('td');
        actualCell.className = 'actual-blank';
        actualCell.textContent = '____________';
        row.appendChild(actualCell);

        // Create overtime cell
        const overtimeCell = document.createElement('td');
        overtimeCell.className = 'overtime-blank';
        overtimeCell.textContent = '____________';
        row.appendChild(overtimeCell);

        tbody.appendChild(row);
        grandTotal += summary.targetRevenue;
    });

    table.appendChild(tbody);

    // Create footer with grand total
    const tfoot = document.createElement('tfoot');
    tfoot.innerHTML = `
        <tr class="grand-total-row">
            <td class="total-label">TOTAL</td>
            <td class="total-revenue">$${grandTotal.toLocaleString()}</td>
            <td class="total-actual">____________</td>
            <td class="total-overtime">____________</td>
        </tr>
    `;
    table.appendChild(tfoot);

    return table;
}

/**
 * Create notes section for Wins and Losses
 */
function createFrozenDailyNotesSection() {
    const notesSection = document.createElement('div');
    notesSection.className = 'frozen-notes-section';

    notesSection.innerHTML = `
        <div class="frozen-notes-column">
            <div class="frozen-notes-header">WINS</div>
            <div class="frozen-notes-lines">
                <div class="frozen-note-line">_______________________________________________________________________________</div>
                <div class="frozen-note-line">_______________________________________________________________________________</div>
                <div class="frozen-note-line">_______________________________________________________________________________</div>
                <div class="frozen-note-line">_______________________________________________________________________________</div>
                <div class="frozen-note-line">_______________________________________________________________________________</div>
            </div>
        </div>
        <div class="frozen-notes-column">
            <div class="frozen-notes-header">LOSSES</div>
            <div class="frozen-notes-lines">
                <div class="frozen-note-line">_______________________________________________________________________________</div>
                <div class="frozen-note-line">_______________________________________________________________________________</div>
                <div class="frozen-note-line">_______________________________________________________________________________</div>
                <div class="frozen-note-line">_______________________________________________________________________________</div>
                <div class="frozen-note-line">_______________________________________________________________________________</div>
            </div>
        </div>
    `;

    return notesSection;
}

// Export layout components
export {
    createDepartmentHeader,
    createDepartmentSummaryRow,
    createTableHeader,
    createTableFooter,
    createPrintTaskCard,
    createTableBody,
    createDepartmentTable,
    createFrozenDailyHeader,
    createFrozenDailySummaryTable,
    createFrozenDailyNotesSection
};