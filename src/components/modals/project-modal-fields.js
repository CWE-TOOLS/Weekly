/**
 * Project Modal Field Rendering Module
 * Handles rendering of form fields, task cards, and project information displays
 * @module components/modals/project-modal-fields
 */

import { normalizeDepartmentClass } from '../../utils/ui-utils.js';
import { parseDate } from '../../utils/date-utils.js';
import { ANIMATION_CONFIG } from '../../config/visual-constants.js';
import { escapeHtml, sanitizeDescription } from '../../utils/security-utils.js';

/**
 * Render department section with task cards
 * @param {string} dept - Department name
 * @param {Array} deptTasks - Array of tasks for this department
 * @returns {HTMLElement} Department section element
 */
export function renderDepartmentSection(dept, deptTasks) {
    const deptSection = document.createElement('div');
    deptSection.className = 'project-dept-section';
    const deptText = dept === 'Special Events' ? 'Special<br>Events' : dept;

    deptSection.innerHTML = `
        <div class="project-dept-header department-label department-${normalizeDepartmentClass(dept)}">
            ${deptText}
        </div>
        <div class="project-cards-container">
            ${deptTasks.map((task, index) => renderTaskCard(task, index)).join('')}
        </div>
    `;

    return deptSection;
}

/**
 * Render a single task card
 * @param {Object} task - Task object
 * @param {number} index - Card index for animation delay
 * @returns {string} HTML string for task card
 */
export function renderTaskCard(task, index) {
    const taskDate = parseDate(task.date);
    const formattedDate = task.missingDate ? 'No date' : (taskDate ? taskDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }) : 'No date');

    return `
        <div class="project-task-card task-card department-${normalizeDepartmentClass(task.department)}"
             style="animation-delay: ${index * ANIMATION_CONFIG.CARD_DELAY_STEP_S}s"
             data-task-id="${escapeHtml(task.id)}"
             title="Click for options">
            <div class="task-title">${escapeHtml(task.project)}</div>
            <div class="project-description">${escapeHtml(task.projectDescription || '')}</div>
            <div class="task-day-counter">${escapeHtml(task.dayCounter || '')}</div>
            <div class="task-description">${task.description && task.description.trim() ? sanitizeDescription(task.description) : '<span class="missing-description">Staging Missing</span>'}</div>
            <div class="task-details">
                <strong>Date:</strong> ${escapeHtml(formattedDate)}<br>
                <strong>Hours:</strong> ${escapeHtml(task.hours || '')}<br>
                <strong>Code:</strong> ${escapeHtml(task.value || '')}
            </div>
        </div>
    `;
}

/**
 * Create editable textarea from description div
 * @param {HTMLElement} descDiv - Description div element
 * @returns {HTMLTextAreaElement} Textarea element
 */
export function createEditableDescriptionField(descDiv) {
    const textarea = document.createElement('textarea');
    textarea.className = 'edit-description';
    textarea.value = descDiv.textContent.trim() === 'Staging Missing' ? '' : descDiv.textContent.trim();
    return textarea;
}

/**
 * Create read-only description div from textarea
 * @param {string} text - Description text
 * @returns {HTMLElement} Description div element
 */
export function createReadOnlyDescriptionField(text) {
    const descDiv = document.createElement('div');
    descDiv.className = 'task-description';
    descDiv.innerHTML = sanitizeDescription(text) || '<span class="missing-description">Staging Missing</span>';
    return descDiv;
}

/**
 * Update task card description in the weekly view
 * @param {string} taskId - Task ID
 * @param {string} newText - New description text
 */
export function updateWeeklyViewCard(taskId, newText) {
    const weeklyCard = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
    if (weeklyCard) {
        const descElement = weeklyCard.querySelector('.task-description');
        if (descElement) {
            descElement.innerHTML = sanitizeDescription(newText) || '<span class="missing-description">Staging Missing</span>';
        }
    }
}

/**
 * Equalize card heights in project view
 * Ensures all cards in a department section have the same height
 */
export function equalizeProjectCardHeights() {
    const projectSections = document.querySelectorAll('.project-dept-section');

    projectSections.forEach(section => {
        const cards = section.querySelectorAll('.project-task-card');
        if (cards.length === 0) return;

        // Find max height
        let maxHeight = 0;
        cards.forEach(card => {
            const originalHeight = card.style.minHeight;
            card.style.minHeight = 'auto';
            const currentHeight = card.offsetHeight;
            if (currentHeight > maxHeight) maxHeight = currentHeight;
            card.style.minHeight = originalHeight;
        });

        // Apply max height to all cards in this section
        if (maxHeight > 0) {
            cards.forEach(card => {
                card.style.minHeight = `${maxHeight}px`;
            });
        }
    });
}

/**
 * Calculate total hours for project
 * @param {Array} projectTasks - Array of tasks for the project
 * @returns {number} Total hours
 */
export function calculateTotalHours(projectTasks) {
    let totalHours = 0;
    projectTasks.forEach(task => {
        const hours = parseFloat(task.hours);
        if (!isNaN(hours)) {
            totalHours += hours;
        }
    });
    return totalHours;
}

/**
 * Format project title with total hours
 * @param {string} projectName - Project name
 * @param {number} totalHours - Total hours
 * @returns {string} Formatted title
 */
export function formatProjectTitle(projectName, totalHours) {
    return `Build Plan: ${projectName} - Total Hours: ${Math.round(totalHours)}`;
}
