/**
 * Unified Card Renderer
 * Consolidates card rendering logic for screen, print, and smart update paths
 * @module renderers/card-renderer
 * 
 * Phase 2 of Rendering Consolidation: ~30% reduction in card-related duplication
 */

import { RENDERING } from '../config/rendering-constants.js';
import { normalizeDepartmentClass } from '../utils/ui-utils.js';
import { getIsEditingUnlocked } from '../core/state.js';

/**
 * Unified card renderer supporting multiple render modes
 */
export class CardRenderer {
    /**
     * @param {string} mode - Render mode: 'screen' or 'print'
     * @param {Object} config - Configuration object for the render mode
     */
    constructor(mode = 'screen', config = null) {
        this.mode = mode;
        this.config = config || this.getDefaultConfig();
    }

    /**
     * Get default configuration based on render mode
     */
    getDefaultConfig() {
        if (this.mode === 'print') {
            return {
                cardElement: 'div',
                cardClass: 'print-task-card',
                titleClass: 'print-task-title',
                projectDescClass: 'print-project-description',
                dayCounterClass: 'print-task-day-counter',
                descriptionClass: 'print-task-description',
                detailsClass: 'print-task-details',
                missingDescClass: 'print-missing-description',
                showRevenue: true,
                showEditButtons: false,
                showDeleteButton: false,
                applyInlineStyles: true
            };
        }
        
        // Default screen config
        return {
            cardElement: 'div',
            cardClass: 'task-card',
            titleClass: 'task-title',
            projectDescClass: 'project-description',
            dayCounterClass: 'task-day-counter',
            descriptionClass: 'task-description',
            detailsClass: 'task-details',
            missingDescClass: 'missing-description',
            showRevenue: false,
            showEditButtons: true,
            showDeleteButton: true,
            applyInlineStyles: false
        };
    }

    /**
     * Create a complete task card
     * @param {Object} task - Task data object
     * @param {string} rowClass - CSS class for row alignment
     * @param {Object} options - Additional options
     * @returns {HTMLElement} Task card element
     */
    create(task, rowClass, options = {}) {
        const config = this.config;
        const card = document.createElement(config.cardElement);
        
        // Apply classes
        card.className = this.getCardClass(task, rowClass);
        card.dataset.taskId = task.id;

        // Apply draggable properties (screen mode only)
        if (this.mode === 'screen') {
            this.applyDraggableProperties(card, task);
        }

        // Build card content
        this.addTitle(card, task);
        this.addProjectDescription(card, task);
        this.addDayCounter(card, task);
        this.addDescription(card, task);
        
        if (this.shouldShowHours(task)) {
            this.addDetails(card, task);
        }

        // Add interactive elements (screen mode only)
        if (this.mode === 'screen' && config.showEditButtons && getIsEditingUnlocked()) {
            this.addEditButtons(card, task);
        }

        return card;
    }

    /**
     * Update an existing card element with new task data
     * Used by smart renderer for efficient DOM updates
     * @param {HTMLElement} cardElement - Existing card element
     * @param {Object} newTask - New task data
     * @param {string} rowClass - Row class for the card
     */
    update(cardElement, newTask, rowClass) {
        // Update title
        const titleDiv = cardElement.querySelector(`.${this.config.titleClass}`);
        if (titleDiv && titleDiv.textContent !== newTask.project) {
            titleDiv.textContent = newTask.project;
        }

        // Update project description
        const projectDescDiv = cardElement.querySelector(`.${this.config.projectDescClass}`);
        if (projectDescDiv) {
            const newDesc = newTask.projectDescription || '';
            if (projectDescDiv.textContent !== newDesc) {
                projectDescDiv.textContent = newDesc;
            }
        }

        // Update day counter
        const dayCounterDiv = cardElement.querySelector(`.${this.config.dayCounterClass}`);
        if (dayCounterDiv) {
            const newCounter = newTask.dayCounter || '';
            if (dayCounterDiv.textContent !== newCounter) {
                dayCounterDiv.textContent = newCounter;
            }
        }

        // Update description
        this.updateDescription(cardElement, newTask);

        // Update details (hours/revenue)
        if (this.shouldShowHours(newTask)) {
            this.updateDetails(cardElement, newTask);
        }
    }

    /**
     * Get complete card class string
     */
    getCardClass(task, rowClass) {
        const config = this.config;
        const deptClass = normalizeDepartmentClass(task.department);
        let classes = `${config.cardClass} ${rowClass} department-${deptClass}`;
        
        if (this.mode === 'screen') {
            const isDraggable = task.isManual && getIsEditingUnlocked();
            if (!isDraggable) {
                classes += ' not-draggable';
            }
        }
        
        return classes;
    }

    /**
     * Apply draggable properties for screen mode
     */
    applyDraggableProperties(card, task) {
        const isDraggable = task.isManual && getIsEditingUnlocked();
        
        if (isDraggable) {
            card.draggable = true;
            card.title = 'Drag to move to different date';
        } else {
            card.title = 'Click for options';
        }
    }

    /**
     * Add title element
     */
    addTitle(card, task) {
        const titleDiv = document.createElement('div');
        titleDiv.className = this.config.titleClass;
        titleDiv.textContent = task.project;
        
        // Apply inline styles for print mode
        if (this.config.applyInlineStyles && this.mode === 'print') {
            const colors = this.getDepartmentColors(task.department);
            titleDiv.style.setProperty('background-color', colors.bg, 'important');
            titleDiv.style.setProperty('color', colors.text, 'important');
        }
        
        card.appendChild(titleDiv);
    }

    /**
     * Add project description element
     */
    addProjectDescription(card, task) {
        const projectDescDiv = document.createElement('div');
        projectDescDiv.className = this.config.projectDescClass;
        projectDescDiv.textContent = task.projectDescription || '';
        card.appendChild(projectDescDiv);
    }

    /**
     * Add day counter element
     */
    addDayCounter(card, task) {
        const dayCounterDiv = document.createElement('div');
        dayCounterDiv.className = this.config.dayCounterClass;
        dayCounterDiv.textContent = task.dayCounter || '';
        card.appendChild(dayCounterDiv);
    }

    /**
     * Add description element
     */
    addDescription(card, task) {
        const descDiv = document.createElement('div');
        descDiv.className = this.config.descriptionClass;
        
        const hasDescription = task.description && task.description.trim();
        
        if (hasDescription) {
            // Use innerHTML for special departments (Batch, Layout) to support <br> tags
            if (RENDERING.shouldUseHtmlDescription(task.department)) {
                descDiv.innerHTML = task.description;
            } else {
                descDiv.textContent = task.description;
            }
        } else {
            descDiv.innerHTML = `<span class="${this.config.missingDescClass}">Staging Missing</span>`;
        }
        
        card.appendChild(descDiv);
    }

    /**
     * Update description element (for smart updates)
     */
    updateDescription(cardElement, newTask) {
        const descDiv = cardElement.querySelector(`.${this.config.descriptionClass}`);
        if (!descDiv) return;

        const hasDescription = newTask.description && newTask.description.trim();
        
        if (hasDescription) {
            if (RENDERING.shouldUseHtmlDescription(newTask.department)) {
                if (descDiv.innerHTML !== newTask.description) {
                    descDiv.innerHTML = newTask.description;
                }
            } else {
                if (descDiv.textContent !== newTask.description) {
                    descDiv.textContent = newTask.description;
                }
            }
        } else {
            const missingHtml = `<span class="${this.config.missingDescClass}">Staging Missing</span>`;
            if (descDiv.innerHTML !== missingHtml) {
                descDiv.innerHTML = missingHtml;
            }
        }
    }

    /**
     * Build details HTML string for a task (hours and/or revenue)
     */
    buildDetailsHTML(task) {
        let html = '';
        if (task.missingDate) {
            html += '<strong>Date:</strong> Missing<br>';
        }
        const hours = parseFloat(task.hours || 0);
        html += `<strong>Hours:</strong> ${hours.toFixed(1)}`;
        if (this.config.showRevenue) {
            const revenue = this.calculateRevenue(hours);
            html += ` | <strong>Revenue:</strong> $${revenue.toLocaleString()}`;
        }
        return html;
    }

    /**
     * Add details element (hours and/or revenue)
     */
    addDetails(card, task) {
        const detailsDiv = document.createElement('div');
        detailsDiv.className = this.config.detailsClass;
        detailsDiv.innerHTML = this.buildDetailsHTML(task);
        card.appendChild(detailsDiv);
    }

    /**
     * Update details element (for smart updates)
     */
    updateDetails(cardElement, newTask) {
        const detailsDiv = cardElement.querySelector(`.${this.config.detailsClass}`);
        if (!detailsDiv) return;
        const detailsHTML = this.buildDetailsHTML(newTask);
        if (detailsDiv.innerHTML !== detailsHTML) {
            detailsDiv.innerHTML = detailsHTML;
        }
    }

    /**
     * Add edit buttons (screen mode only)
     */
    addEditButtons(card, task) {
        const planBtn = document.createElement('button');
        planBtn.className = 'task-plan-btn';
        planBtn.dataset.taskId = task.id;
        planBtn.textContent = 'Plan';
        card.appendChild(planBtn);

        const editBtn = document.createElement('button');
        editBtn.className = 'task-edit-btn';
        editBtn.dataset.taskId = task.id;
        editBtn.textContent = 'Edit';
        card.appendChild(editBtn);

        // Delete button (only for manual tasks)
        if (task.isManual && this.config.showDeleteButton) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'task-delete-btn';
            deleteBtn.dataset.taskId = task.id;
            deleteBtn.title = 'Delete this manual task';
            deleteBtn.textContent = '🗑️';
            card.appendChild(deleteBtn);
        }
    }

    /**
     * Determine if hours should be shown for this task
     */
    shouldShowHours(task) {
        return RENDERING.shouldShowHours(task.department);
    }

    /**
     * Calculate revenue from hours
     */
    calculateRevenue(hours) {
        // Import REVENUE constant dynamically to avoid circular dependency
        const HOURLY_RATE = 90; // Default, should match REVENUE.HOURLY_RATE
        return Math.round(hours * HOURLY_RATE);
    }

    /**
     * Get department colors (for print mode)
     */
    getDepartmentColors(department) {
        // This will be accessed from window.PrintUtils in print mode
        if (typeof window !== 'undefined' && window.PrintUtils) {
            const deptClass = normalizeDepartmentClass(department);
            const colorMapping = window.PrintUtils.getDepartmentColorMapping();
            return colorMapping[deptClass] || { bg: '#333', text: '#FFFFFF' };
        }
        
        return { bg: '#333', text: '#FFFFFF' };
    }
}

/**
 * Factory function for creating screen card renderer
 */
export function createScreenCardRenderer() {
    return new CardRenderer('screen');
}

/**
 * Factory function for creating print card renderer
 */
export function createPrintCardRenderer() {
    return new CardRenderer('print');
}

// Export for window access (for backward compatibility during migration)
if (typeof window !== 'undefined') {
    window.CardRenderer = CardRenderer;
    window.createScreenCardRenderer = createScreenCardRenderer;
    window.createPrintCardRenderer = createPrintCardRenderer;
}