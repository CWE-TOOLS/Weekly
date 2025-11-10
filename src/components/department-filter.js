/**
 * Department Filter Component
 * Handles department multi-select dropdown and task filtering
 * @module components/department-filter
 */

import { getAllTasks, setFilteredTasks } from '../core/state.js';
import { emit, on, EVENTS } from '../core/event-bus.js';
import { saveState, loadState } from '../core/storage.js';
import { DEPARTMENT_ORDER } from '../config/department-config.js';

import { logger } from '../utils/logger.js';
/**
 * Normalize department name to CSS class format
 * @param {string} dept - Department name
 * @returns {string} Normalized class name
 */
function normalizeDepartmentClass(dept) {
    if (!dept) return '';
    return dept.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

/**
 * Get currently selected departments from checkboxes
 * @returns {string[]} Array of selected department names
 */
export function getSelectedDepartments() {
    const selected = [];
    document.querySelectorAll('#department-list input[type="checkbox"]:checked').forEach(checkbox => {
        selected.push(checkbox.value);
    });
    return selected;
}

/**
 * Update the multi-select dropdown label based on selections
 */
export function updateMultiSelectLabel() {
    const selectedCount = getSelectedDepartments().length;
    const totalCount = document.querySelectorAll('#department-list input[type="checkbox"]').length;
    const label = document.getElementById('multi-select-label');

    if (!label) return;

    if (selectedCount === 0) {
        label.textContent = 'None Selected';
    } else if (selectedCount === totalCount) {
        label.textContent = 'All Departments';
    } else if (selectedCount === 1) {
        label.textContent = getSelectedDepartments()[0];
    } else {
        label.textContent = `${selectedCount} Departments Selected`;
    }
}

/**
 * Filter tasks by selected departments and update state
 * Note: Batch and Layout are synthetic departments that are always included
 */
export function filterTasks(silent = false) {
    const selectedDepartments = getSelectedDepartments();
    const allTasks = getAllTasks();

    // Save selection to localStorage
    saveState('selectedDepartments', selectedDepartments);

    let filtered = [];
    if (selectedDepartments.length === 0) {
        filtered = [];
    } else {
        const allDeptsSelected = selectedDepartments.length === [...new Set(allTasks.map(task => task.department))].filter(dept => dept).length;
        if (allDeptsSelected) {
            filtered = [...allTasks];
        } else {
            // Filter tasks normally, but synthetic departments (Batch/Layout) are handled separately
            // They will always be rendered regardless of filter state
            filtered = allTasks.filter(task => selectedDepartments.includes(task.department));
        }
    }

    // Update state
    setFilteredTasks(filtered);

    // Update label
    updateMultiSelectLabel();

    // Emit filter event (unless silent mode for initial load)
    if (!silent) {
        emit(EVENTS.DEPARTMENT_FILTERED, { departments: selectedDepartments, tasks: filtered });
    }
}

/**
 * Populate department checkboxes from available departments
 */
export function populateDepartmentCheckboxes() {
    const allTasks = getAllTasks();
    const departments = DEPARTMENT_ORDER;
    const list = document.getElementById('department-list');

    if (!list) {
        logger.warn('Department list element not found');
        return;
    }

    list.innerHTML = ''; // Clear previous list

    // Load saved selections, default to all departments
    let savedDepartments = loadState('selectedDepartments', departments);

    // IMPORTANT: Always ensure Batch and Layout synthetic departments are included
    // These are special departments that should always be selected by default
    // If they're missing from saved state (e.g., user saved before they were added),
    // we need to add them automatically
    if (!savedDepartments.includes('Batch')) {
        savedDepartments = [...savedDepartments, 'Batch'];
    }
    if (!savedDepartments.includes('Layout')) {
        savedDepartments = [...savedDepartments, 'Layout'];
    }

    departments.forEach(dept => {
        const listItem = document.createElement('li');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `dept-${normalizeDepartmentClass(dept)}`;
        checkbox.value = dept;
        checkbox.checked = savedDepartments.includes(dept);

        const label = document.createElement('label');
        label.htmlFor = `dept-${normalizeDepartmentClass(dept)}`;
        label.textContent = dept;

        listItem.appendChild(checkbox);
        listItem.appendChild(label);
        list.appendChild(listItem);

        // Add event listener to filter tasks when a checkbox is changed
        listItem.addEventListener('click', (e) => {
            if (e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
            }
            filterTasks();
        });
    });

    updateMultiSelectLabel();
}

/**
 * Initialize department filter component
 */
export function initializeDepartmentFilter() {
    let isInitialLoad = true;

    // Populate checkboxes on initialization
    populateDepartmentCheckboxes();

    // Get dropdown elements
    const dropdown = document.getElementById('multi-select-dropdown');
    const button = document.getElementById('multi-select-btn');
    const selectAllBtn = document.getElementById('select-all-btn');
    const selectNoneBtn = document.getElementById('select-none-btn');

    // Event listener to toggle dropdown open/closed
    if (button && dropdown) {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdown.classList.toggle('open');
            button.setAttribute('aria-expanded', isOpen);
        });
    }

    // Event listener to check all department checkboxes
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const checkboxes = document.querySelectorAll('#department-list input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = true;
            });
            filterTasks();
        });
    }

    // Event listener to uncheck all department checkboxes
    if (selectNoneBtn) {
        selectNoneBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const checkboxes = document.querySelectorAll('#department-list input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            filterTasks();
        });
    }

    // Click outside listener to close dropdown
    document.addEventListener('click', (e) => {
        if (dropdown && button) {
            // Check if click is outside the dropdown
            if (!dropdown.contains(e.target) && !button.contains(e.target)) {
                dropdown.classList.remove('open');
                button.setAttribute('aria-expanded', 'false');
            }
        }
    });

    // Listen for tasks loaded event to re-populate if needed
    on(EVENTS.TASKS_LOADED, () => {
        populateDepartmentCheckboxes();

        // Call filterTasks in silent mode on initial load to prevent duplicate render
        // The render is already handled by component-events.js responding to TASKS_LOADED
        filterTasks(isInitialLoad);
        isInitialLoad = false;
    });

    // Perform initial filter (silent mode since no tasks loaded yet)
    filterTasks(true);
}

/**
 * Toggle dropdown visibility (for backward compatibility)
 */
export function toggleDepartmentDropdown() {
    const dropdown = document.getElementById('department-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}
