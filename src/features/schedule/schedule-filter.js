/**
 * Schedule Filter Module
 * Handles department filtering functionality
 *
 * Dependencies:
 * - core/state.js (allTasks, filteredTasks)
 * - config/constants.js (DEPARTMENT_ORDER)
 * - utils/department-utils.js (normalizeDepartmentClass)
 * - schedule-renderer.js (renderAllWeeks)
 */

import { renderAllWeeks } from './schedule-renderer.js';

// State references (will be set by state.js)
let allTasks = [];
let filteredTasks = [];

/**
 * Populate department checkboxes based on available tasks
 */
export function populateDepartmentCheckboxes() {
    const departments = window.DEPARTMENT_ORDER;
    const list = document.getElementById('department-list');
    list.innerHTML = ''; // Clear previous list

    const savedDepartments = JSON.parse(localStorage.getItem('selectedDepartments')) || departments;

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
            // Save department selection state
            const selectedDepts = getSelectedDepartments();
            localStorage.setItem('selectedDepartments', JSON.stringify(selectedDepts));
        });
    });
    updateMultiSelectLabel();
}

/**
 * Get the list of currently selected departments
 *
 * @returns {Array<string>} Array of selected department names
 */
export function getSelectedDepartments() {
    const selected = [];
    document.querySelectorAll('#department-list input[type="checkbox"]:checked').forEach(checkbox => {
        selected.push(checkbox.value);
    });
    return selected;
}

/**
 * Update the multi-select dropdown label based on selected departments
 */
export function updateMultiSelectLabel() {
    const selectedCount = getSelectedDepartments().length;
    const totalCount = document.querySelectorAll('#department-list input[type="checkbox"]').length;
    const label = document.getElementById('multi-select-label');

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
 * Filter tasks based on selected departments and re-render schedule
 */
export function filterTasks() {
    const selectedDepartments = getSelectedDepartments();
    localStorage.setItem('selectedDepartments', JSON.stringify(selectedDepartments));

    if (selectedDepartments.length === 0) {
        filteredTasks.length = 0; // Clear the array
    } else {
        const allDeptsSelected = selectedDepartments.length === [...new Set(allTasks.map(task => task.department))].filter(dept => dept).length;
        if (allDeptsSelected) {
            filteredTasks.length = 0;
            filteredTasks.push(...allTasks);
        } else {
            const filtered = allTasks.filter(task => selectedDepartments.includes(task.department));
            filteredTasks.length = 0;
            filteredTasks.push(...filtered);
        }
    }
    updateMultiSelectLabel();
    renderAllWeeks();
}

/**
 * Set state references (called from state.js initialization)
 */
export function setStateReferences(refs) {
    allTasks = refs.allTasks;
    filteredTasks = refs.filteredTasks;
}

// Helper function - should be imported from utils
function normalizeDepartmentClass(dept) {
    if (!dept) return '';
    return dept.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}
