/**
 * Department Filter Component
 * Handles department multi-select dropdown and task filtering
 * @module components/department-filter
 */

import { getAllTasks, setFilteredTasks } from '../core/state.js';
import { emit, on, EVENTS } from '../core/event-bus.js';
import { saveState, loadState } from '../core/storage.js';
import { DEPARTMENT_ORDER } from '../config/department-config.js';

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
 */
export function filterTasks() {
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
            filtered = allTasks.filter(task => selectedDepartments.includes(task.department));
        }
    }

    // Update state
    setFilteredTasks(filtered);

    // Update label
    updateMultiSelectLabel();

    // Emit filter event
    emit(EVENTS.DEPARTMENT_FILTERED, { departments: selectedDepartments, tasks: filtered });
}

/**
 * Populate department checkboxes from available departments
 */
export function populateDepartmentCheckboxes() {
    const allTasks = getAllTasks();
    const departments = DEPARTMENT_ORDER;
    const list = document.getElementById('department-list');

    if (!list) {
        console.warn('Department list element not found');
        return;
    }

    list.innerHTML = ''; // Clear previous list

    // Load saved selections, default to all departments
    const savedDepartments = loadState('selectedDepartments', departments);

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
    // Populate checkboxes on initialization
    populateDepartmentCheckboxes();

    // Listen for tasks loaded event to re-populate if needed
    on(EVENTS.TASKS_LOADED, () => {
        populateDepartmentCheckboxes();
        filterTasks();
    });

    // Perform initial filter
    filterTasks();
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
