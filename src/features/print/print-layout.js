/**
 * Print Layout Components - Modular layout system for print reports
 * Handles component creation and layout management
 */

// ============================================
// LAYOUT COMPONENT CREATORS
// ============================================

/**
 * Create a department header component
 */
function createDepartmentHeader(dept, printType, colors) {
    const header = document.createElement('div');
    header.className = `print-department-header department-${normalizeDepartmentClass(dept)}`;

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
 * Create a department summary component
 */
function createDepartmentSummary(dept, totalHours, revenue) {
    const summary = document.createElement('div');
    summary.className = 'print-dept-summary';
    summary.textContent = `${dept} - Total Hours: ${Math.round(totalHours)}, Revenue: $${revenue.toLocaleString()}`;
    return summary;
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
    revenueRow.style.fontSize = '0.85em';
    revenueRow.style.background = '#e8e8e8';

    dates.forEach(date => {
        if (!date) return;
        const dateString = date.toDateString();
        const dayTasks = tasks.filter(t => {
            const taskDate = parseDate(t.date);
            return taskDate && taskDate.toDateString() === dateString;
        });

        let dayHours = 0;
        dayTasks.forEach(task => {
            const hours = parseFloat(task.hours);
            if (!isNaN(hours)) dayHours += hours;
        });
        const dayRevenue = Math.round(dayHours * 135);

        const revenueCell = document.createElement('td');
        revenueCell.innerHTML = `<strong>Daily Total</strong><br>$${dayRevenue.toLocaleString()}`;
        revenueCell.style.fontWeight = 'bold';
        revenueCell.style.textAlign = 'center';
        revenueCell.style.padding = '0.4em';
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
    
    const colors = getDepartmentColorMapping()[departmentClass] || { bg: '#333', text: '#FFFFFF' };
    
    // Calculate revenue based on hours
    const hours = parseFloat(task.hours || 0);
    const revenue = hours * 135;
    
    card.innerHTML = `
        <div class="print-task-title" style="background-color: ${colors.bg} !important; color: ${colors.text} !important;">
            ${task.project || 'Unknown Project'}
        </div>
        <div class="print-project-description">
            ${task.projectDescription || ''}
        </div>
        <div class="print-task-day-counter">
            ${task.dayCounter || ''}
        </div>
        <div class="print-task-description">
            ${task.description && task.description.trim() ? task.description : '<span class="print-missing-description">Staging Missing</span>'}
        </div>
        <div class="print-task-details">
            ${task.missingDate ? '<strong>Date:</strong> Missing<br>' : ''}
            <strong>Hours:</strong> ${hours.toFixed(1)} | <strong>Revenue:</strong> $${revenue.toLocaleString()}
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
            const dateA = parseDate(a.date);
            const dateB = parseDate(b.date);
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
                const taskDate = parseDate(t.date);
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
                    const departmentClass = normalizeDepartmentClass(task.department);
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
            const taskDate = parseDate(t.date);
            return taskDate && taskDate.toDateString() === dateString;
        }).sort((a, b) => (a.project + a.description).localeCompare(b.project + b.description)); // Sort for consistency

        for (let row = 0; row < maxTasks; row++) {
            const tr = document.createElement('tr');
            const task = dayTasks[row];

            // Task cell
            const taskCell = document.createElement('td');
            taskCell.className = 'print-grid-cell';
            taskCell.style.width = '60%';
            if (task) {
                const departmentClass = normalizeDepartmentClass(task.department);
                const card = createPrintTaskCard(task, departmentClass);
                card.style.margin = '0 auto';
                card.style.maxWidth = '180px';
                taskCell.appendChild(card);
            }
            tr.appendChild(taskCell);

            // Revenue cell
            const revenueCell = document.createElement('td');
            revenueCell.className = 'print-grid-cell';
            revenueCell.style.textAlign = 'center';
            revenueCell.style.fontSize = '0.5rem';
            revenueCell.style.fontWeight = 'bold';
            revenueCell.style.width = '13.33%';
            if (task && task.hours) {
                const hours = parseFloat(task.hours);
                const revenue = isNaN(hours) ? 0 : Math.round(Math.round(hours) * 135);
                revenueCell.textContent = `$${revenue.toLocaleString()}`;
            } else {
                revenueCell.textContent = '';
            }
            tr.appendChild(revenueCell);

            // Mid-Day cell (blank)
            const midDayCell = document.createElement('td');
            midDayCell.className = 'print-grid-cell';
            midDayCell.style.textAlign = 'center';
            midDayCell.style.width = '13.33%';
            midDayCell.textContent = '';
            tr.appendChild(midDayCell);

            // End of Day cell (blank)
            const endOfDayCell = document.createElement('td');
            endOfDayCell.className = 'print-grid-cell';
            endOfDayCell.style.textAlign = 'center';
            endOfDayCell.style.width = '13.33%';
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
function createDepartmentTable(dept, tasks, dates, printType, isCompact) {
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
            const taskDate = parseDate(t.date);
            return taskDate && taskDate.toDateString() === dateString;
        }).length;
    } else {
        // Weekly view: find max tasks for any single day
        dates.forEach(date => {
            if (!date) return;
            const dateString = date.toDateString();
            const count = tasks.filter(t => {
                const taskDate = parseDate(t.date);
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

    // Add footer (week view only)
    const tfoot = createTableFooter(dates, tasks, printType);
    if (tfoot) {
        table.appendChild(tfoot);
    }

    return table;
}

// Export layout components
window.PrintLayout = {
    createDepartmentHeader,
    createDepartmentSummary,
    createTableHeader,
    createTableFooter,
    createPrintTaskCard,
    createTableBody,
    createDepartmentTable
};