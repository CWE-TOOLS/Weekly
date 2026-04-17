/**
 * Revenue Summary Modal
 * Displays monthly revenue breakdown by week and department.
 *
 * @module components/modals/revenue-modal
 */

import { getAllTasks } from '../../core/state.js';
import { normalizeDepartment, normalizeDepartmentClass, DEPARTMENT_COLORS } from '../../config/department-config.js';
import { parseDate, getWeekMonth, getMonday } from '../../utils/date-utils.js';
import { logger } from '../../utils/logger.js';

// ============================================================================
// Constants
// ============================================================================

const RATE = 135;

const REVENUE_DEPARTMENTS = [
    { department: 'Mill', displayName: 'Mill', colorKey: 'mill' },
    { department: 'Form Out', displayName: 'FO', colorKey: 'form-out' },
    { department: 'Cast', displayName: 'Cast', colorKey: 'cast' },
    { department: 'Demold', displayName: 'Demold', colorKey: 'demold' },
    { department: 'Finish', displayName: 'Finish', colorKey: 'finish' },
    { department: 'Seal', displayName: 'Seal', colorKey: 'seal' },
    { department: 'Crating', displayName: 'Crate', colorKey: 'crating' },
    { department: 'Load', displayName: 'Load', colorKey: 'load' },
    { department: 'Final Insp.', displayName: 'Final Insp.', colorKey: 'final-insp' },
    { department: 'Special', displayName: 'SPECIALITY', colorKey: 'special' },
    { department: 'Ship', displayName: 'Ship', colorKey: 'ship' }
];

/** Departments that get summed into the "Crate Total" subtotal row */
const CRATE_GROUP = ['Crating', 'Load', 'Final Insp.'];

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// ============================================================================
// State
// ============================================================================

let modalEl = null;
let currentYear = 2026;
let currentMonth = 3; // 0-indexed (April = 3)

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format a dollar amount with commas and 2 decimal places.
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
    return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/**
 * Format a date as "Mon, Apr 06".
 * @param {Date} date
 * @returns {string}
 */
function formatWeekDate(date) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(date.getDate()).padStart(2, '0');
    return `${dayNames[date.getDay()]}, ${monthAbbr[date.getMonth()]} ${day}`;
}

/**
 * Calculate all Mon-Sat weeks that belong to a given month,
 * using the majority-weekday rule (Mon-Fri) from the main schedule system.
 * @param {number} year
 * @param {number} month - 0-indexed
 * @returns {Array<{ monday: Date, days: Date[] }>}
 */
function getWeeksInMonth(year, month) {
    const weeks = [];

    // Start from the Monday of the week containing the 1st of the month
    const firstOfMonth = new Date(year, month, 1);
    let monday = getMonday(firstOfMonth);

    // Scan enough weeks to cover the month (go back 1 week early to catch edge cases)
    monday.setDate(monday.getDate() - 7);

    for (let i = 0; i < 8; i++) {
        // Use the system's majority-weekday rule to determine which month this week belongs to
        if (getWeekMonth(monday) === month && monday.getFullYear() === year) {
            const days = [];
            for (let d = 0; d < 6; d++) { // Mon through Sat
                const day = new Date(monday);
                day.setDate(monday.getDate() + d);
                days.push(day);
            }
            weeks.push({ monday: new Date(monday), days });
        }

        // Advance to next Monday
        monday = new Date(monday);
        monday.setDate(monday.getDate() + 7);
    }

    return weeks;
}

/**
 * Build a date string "YYYY-MM-DD" from a Date object.
 * @param {Date} d
 * @returns {string}
 */
function toDateKey(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * Build a lookup: dateKey -> department -> total hours
 * @returns {Object}
 */
function buildTaskLookup() {
    const tasks = getAllTasks();
    const lookup = {};

    for (const task of tasks) {
        if (!task.date || !task.department) continue;
        if (task.isManual) continue; // Skip manually added tasks
        const hours = parseFloat(task.hours) || 0;
        if (hours === 0) continue;

        const dept = normalizeDepartment(task.department);

        // Parse date (handles M/D/YYYY and YYYY-MM-DD formats)
        const parsed = parseDate(task.date);
        if (!parsed) continue;
        const dateKey = toDateKey(parsed);

        if (!lookup[dateKey]) lookup[dateKey] = {};
        if (!lookup[dateKey][dept]) lookup[dateKey][dept] = 0;
        lookup[dateKey][dept] += hours;
    }

    return lookup;
}

// ============================================================================
// CSS Injection
// ============================================================================

function injectStyles() {
    if (document.getElementById('revenue-modal-styles')) return;

    const style = document.createElement('style');
    style.id = 'revenue-modal-styles';
    style.textContent = `
        .revenue-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        }

        .revenue-modal.show {
            display: flex;
        }

        .revenue-content {
            background: #fff;
            border-radius: 8px;
            width: 95%;
            max-width: 1200px;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .revenue-header {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 16px;
            padding: 16px 24px;
            border-bottom: 2px solid #e5e7eb;
            position: relative;
            flex-shrink: 0;
        }

        .revenue-header h2 {
            margin: 0;
            font-size: 20px;
            font-weight: 700;
            color: #1f2937;
        }

        .revenue-nav-btn {
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            padding: 6px 14px;
            font-size: 18px;
            cursor: pointer;
            color: #374151;
            transition: background 0.15s;
        }

        .revenue-nav-btn:hover {
            background: #e5e7eb;
        }

        .revenue-close {
            position: absolute;
            right: 16px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #6b7280;
            padding: 4px 8px;
            line-height: 1;
        }

        .revenue-close:hover {
            color: #1f2937;
        }

        .revenue-body {
            overflow-y: auto;
            padding: 16px 24px;
            flex: 1;
        }

        .revenue-week-section {
            margin-bottom: 24px;
        }

        .revenue-week-header {
            display: grid;
            grid-template-columns: 140px repeat(6, 1fr) 120px;
            background: #333;
            color: #fff;
            font-weight: 700;
            font-size: 12px;
            border-radius: 4px 4px 0 0;
        }

        .revenue-week-header > div {
            padding: 8px 6px;
            text-align: center;
        }

        .revenue-week-header > div:first-child {
            text-align: left;
            font-size: 14px;
        }

        .revenue-fab-row,
        .revenue-dept-row,
        .revenue-net-row {
            display: grid;
            grid-template-columns: 140px repeat(6, 1fr) 120px;
            font-size: 12px;
            border-bottom: 1px solid #e5e7eb;
        }

        .revenue-fab-row > div,
        .revenue-dept-row > div,
        .revenue-net-row > div {
            padding: 6px 6px;
            text-align: right;
        }

        .revenue-fab-row > div:first-child,
        .revenue-dept-row > div:first-child,
        .revenue-net-row > div:first-child {
            text-align: left;
            font-weight: 600;
        }

        .revenue-fab-row {
            background: #E8F5E9;
            font-weight: 600;
        }

        .revenue-net-row {
            background: #C8E6C9;
            font-weight: 700;
        }

        .revenue-dept-row > div:first-child {
            color: #fff;
            border-radius: 2px;
        }

        .revenue-crate-child {
            font-size: 11px;
            opacity: 0.8;
            display: none;
        }

        .revenue-crate-child.expanded {
            display: grid;
        }

        .revenue-crate-child > div:first-child {
            padding-left: 16px !important;
            font-size: 11px;
        }

        .revenue-subtotal-row {
            cursor: pointer;
            user-select: none;
        }

        .revenue-subtotal-row:hover {
            filter: brightness(0.97);
        }

        .revenue-subtotal-row .crate-toggle {
            display: inline-block;
            width: 14px;
            font-size: 8px;
            margin-right: 2px;
            transition: transform 0.15s;
            opacity: 0.6;
        }

        .revenue-subtotal-row.open .crate-toggle {
            transform: rotate(90deg);
        }

        .revenue-monthly-total {
            text-align: center;
            padding: 20px;
            font-size: 24px;
            font-weight: 700;
            color: #1f2937;
            border-top: 3px solid #333;
            margin-top: 8px;
        }
    `;
    document.head.appendChild(style);
}

// ============================================================================
// Rendering
// ============================================================================

function render() {
    if (!modalEl) return;

    const lookup = buildTaskLookup();
    const weeks = getWeeksInMonth(currentYear, currentMonth);
    const monthTitle = `${MONTH_NAMES[currentMonth]} ${currentYear}`;

    // Header
    const header = modalEl.querySelector('.revenue-header');
    header.querySelector('h2').textContent = `Revenue Summary - ${monthTitle}`;

    // Body
    const body = modalEl.querySelector('.revenue-body');
    body.innerHTML = '';

    let monthlyTotal = 0;

    weeks.forEach((week, weekIndex) => {
        const section = document.createElement('div');
        section.className = 'revenue-week-section';

        // Week header row
        const headerRow = document.createElement('div');
        headerRow.className = 'revenue-week-header';

        const weekLabel = document.createElement('div');
        weekLabel.textContent = `WEEK ${weekIndex + 1}`;
        headerRow.appendChild(weekLabel);

        week.days.forEach(day => {
            const cell = document.createElement('div');
            cell.textContent = formatWeekDate(day);
            headerRow.appendChild(cell);
        });

        const totalHeader = document.createElement('div');
        totalHeader.textContent = 'WEEK TOTAL';
        headerRow.appendChild(totalHeader);

        section.appendChild(headerRow);

        // Calculate daily totals across all departments
        const dailyTotals = week.days.map(() => 0);
        const deptDailyRevenue = [];

        for (const deptConfig of REVENUE_DEPARTMENTS) {
            const dailyValues = week.days.map((day, i) => {
                const dateKey = toDateKey(day);
                const hours = (lookup[dateKey] && lookup[dateKey][deptConfig.department]) || 0;
                const revenue = hours * RATE;
                dailyTotals[i] += revenue;
                return revenue;
            });
            deptDailyRevenue.push(dailyValues);
        }

        const weekTotal = dailyTotals.reduce((a, b) => a + b, 0);
        monthlyTotal += weekTotal;

        // Department rows
        // Pre-calculate Crate group subtotals
        const crateGroupDaily = week.days.map(() => 0);
        const crateChildRows = [];

        REVENUE_DEPARTMENTS.forEach((deptConfig, deptIdx) => {
            if (CRATE_GROUP.includes(deptConfig.department)) {
                deptDailyRevenue[deptIdx].forEach((val, dayIdx) => {
                    crateGroupDaily[dayIdx] += val;
                });
            }
        });

        REVENUE_DEPARTMENTS.forEach((deptConfig, deptIdx) => {
            const isCrateChild = CRATE_GROUP.includes(deptConfig.department);

            // Build the row
            const row = document.createElement('div');
            row.className = 'revenue-dept-row' + (isCrateChild ? ' revenue-crate-child' : '');

            const label = document.createElement('div');
            label.textContent = deptConfig.displayName;
            const colors = DEPARTMENT_COLORS[deptConfig.colorKey];
            if (colors) {
                label.style.backgroundColor = colors.background;
                label.style.color = colors.text;
                // Subtle row tint using the department color
                row.style.backgroundColor = colors.background + '30';
            }
            row.appendChild(label);

            let rowTotal = 0;
            deptDailyRevenue[deptIdx].forEach((val) => {
                const cell = document.createElement('div');
                cell.textContent = formatCurrency(val);
                row.appendChild(cell);
                rowTotal += val;
            });

            const totalCell = document.createElement('div');
            totalCell.textContent = formatCurrency(rowTotal);
            totalCell.style.fontWeight = '600';
            row.appendChild(totalCell);

            if (isCrateChild) {
                // Collect crate children — we'll insert them after the subtotal row
                crateChildRows.push(row);

                // When we've collected all 3, insert subtotal row + children
                if (crateChildRows.length === CRATE_GROUP.length) {
                    // Build Crate Total subtotal row (clickable, styled like a normal dept row)
                    const subtotalRow = document.createElement('div');
                    subtotalRow.className = 'revenue-dept-row revenue-subtotal-row';
                    const crateColors = DEPARTMENT_COLORS['crating'];
                    if (crateColors) {
                        subtotalRow.style.backgroundColor = crateColors.background + '30';
                    }

                    const subtotalLabel = document.createElement('div');
                    subtotalLabel.innerHTML = '<span class="crate-toggle">&#9654;</span> Crate Total';
                    if (crateColors) {
                        subtotalLabel.style.backgroundColor = crateColors.background;
                        subtotalLabel.style.color = crateColors.text;
                    }
                    subtotalRow.appendChild(subtotalLabel);

                    let subtotalRowTotal = 0;
                    crateGroupDaily.forEach(val => {
                        const cell = document.createElement('div');
                        cell.textContent = formatCurrency(val);
                        subtotalRow.appendChild(cell);
                        subtotalRowTotal += val;
                    });

                    const subtotalTotalCell = document.createElement('div');
                    subtotalTotalCell.textContent = formatCurrency(subtotalRowTotal);
                    subtotalRow.appendChild(subtotalTotalCell);

                    section.appendChild(subtotalRow);

                    // Append the child rows (hidden by default via CSS)
                    crateChildRows.forEach(childRow => section.appendChild(childRow));

                    // Toggle expand/collapse on click
                    subtotalRow.addEventListener('click', () => {
                        const isOpen = subtotalRow.classList.toggle('open');
                        crateChildRows.forEach(r => r.classList.toggle('expanded', isOpen));
                    });
                }
            } else {
                section.appendChild(row);
            }
        });

        // NET REVENUE row
        const netRow = document.createElement('div');
        netRow.className = 'revenue-net-row';

        const netLabel = document.createElement('div');
        netLabel.textContent = 'NET REVENUE';
        netRow.appendChild(netLabel);

        dailyTotals.forEach(val => {
            const cell = document.createElement('div');
            cell.textContent = formatCurrency(val);
            netRow.appendChild(cell);
        });

        const netTotal = document.createElement('div');
        netTotal.textContent = formatCurrency(weekTotal);
        netRow.appendChild(netTotal);

        section.appendChild(netRow);
        body.appendChild(section);
    });

    // Monthly total
    const monthlyTotalEl = document.createElement('div');
    monthlyTotalEl.className = 'revenue-monthly-total';
    monthlyTotalEl.textContent = `MONTHLY TOTAL: ${formatCurrency(monthlyTotal)}`;
    body.appendChild(monthlyTotalEl);
}

// ============================================================================
// Navigation
// ============================================================================

function prevMonth() {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    render();
}

function nextMonth() {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    render();
}

// ============================================================================
// Modal lifecycle
// ============================================================================

/**
 * Create the modal DOM element and attach event listeners.
 */
export function initializeRevenueModal() {
    injectStyles();

    modalEl = document.createElement('div');
    modalEl.className = 'revenue-modal';
    modalEl.innerHTML = `
        <div class="revenue-content">
            <div class="revenue-header">
                <button class="revenue-nav-btn" data-dir="prev">&larr;</button>
                <h2></h2>
                <button class="revenue-nav-btn" data-dir="next">&rarr;</button>
                <button class="revenue-close">&times;</button>
            </div>
            <div class="revenue-body"></div>
        </div>
    `;

    // Event: backdrop click
    modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) {
            hideRevenueModal();
        }
    });

    // Event: close button
    modalEl.querySelector('.revenue-close').addEventListener('click', hideRevenueModal);

    // Event: nav buttons
    modalEl.querySelector('[data-dir="prev"]').addEventListener('click', prevMonth);
    modalEl.querySelector('[data-dir="next"]').addEventListener('click', nextMonth);

    // Event: escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalEl.classList.contains('show')) {
            hideRevenueModal();
        }
    });

    document.body.appendChild(modalEl);
    logger.info('Revenue modal initialized');
}

/**
 * Show the revenue modal, defaulting to the month of the currently viewed week.
 */
export function showRevenueModal() {
    if (!modalEl) {
        initializeRevenueModal();
    }

    // Default to current date's month
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();

    render();
    modalEl.classList.add('show');
    logger.info(`Revenue modal opened for ${MONTH_NAMES[currentMonth]} ${currentYear}`);
}

/**
 * Hide the revenue modal.
 */
export function hideRevenueModal() {
    if (modalEl) {
        modalEl.classList.remove('show');
        logger.info('Revenue modal closed');
    }
}
