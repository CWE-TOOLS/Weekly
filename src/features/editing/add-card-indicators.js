/**
 * Add Card Indicators Module
 * Handles visual indicators on empty cells for adding tasks
 * @module features/editing/add-card-indicators
 */

import { on, EVENTS } from '../../core/event-bus.js';
import { openAddTaskModal } from '../../components/modals/add-task-modal.js';
import { getIsEditingUnlocked } from '../../core/state.js';

/**
 * Enable add card indicators on empty cells
 * Only shows indicators when editing is unlocked
 */
export function enableAddCardIndicators() {
    const isEditingUnlocked = getIsEditingUnlocked();

    if (!isEditingUnlocked) {
        console.log('Editing not unlocked, skipping add card indicators');
        // Remove add-enabled class if editing is locked
        const placeholders = document.querySelectorAll('.task-card-placeholder.add-enabled');
        placeholders.forEach(placeholder => {
            placeholder.classList.remove('add-enabled');
        });
        return;
    }

    const placeholders = document.querySelectorAll('.task-card-placeholder');
    placeholders.forEach(placeholder => {
        placeholder.classList.add('add-enabled');
    });

    console.log('Add card indicators enabled');
}

/**
 * Disable add card indicators
 */
export function disableAddCardIndicators() {
    const placeholders = document.querySelectorAll('.task-card-placeholder.add-enabled');
    placeholders.forEach(placeholder => {
        placeholder.classList.remove('add-enabled');
    });

    console.log('Add card indicators disabled');
}

/**
 * Handle clicking on empty cell placeholder
 * @param {HTMLElement} placeholder - Clicked placeholder element
 * @private
 */
function handlePlaceholderClick(placeholder) {
    // Check if editing is unlocked
    const isEditingUnlocked = getIsEditingUnlocked();
    if (!isEditingUnlocked) {
        return; // Do not show modal if editing is not unlocked
    }

    // Get context from data attributes on the placeholder
    const department = placeholder.dataset.department;
    const dateStr = placeholder.dataset.date;
    const weekText = placeholder.dataset.week;

    console.log('Clicked placeholder with data:', { department, dateStr, weekText });

    if (department && dateStr && weekText) {
        openAddTaskModal({ department, date: dateStr, week: weekText });
    } else {
        console.log('Missing data attributes, showing modal with empty context');
        // Fallback: show modal with empty context
        openAddTaskModal({});
    }
}

/**
 * Handle clicks on placeholder elements
 * @param {MouseEvent} e - Click event
 * @private
 */
function handleClick(e) {
    if (!(e.target instanceof Element)) return;

    const placeholder = e.target.closest('.task-card-placeholder.add-enabled');
    if (placeholder) {
        e.preventDefault();
        handlePlaceholderClick(placeholder);
    }
}

/**
 * Initialize add card indicators
 * Sets up event listeners for empty cell clicks
 */
export function initializeAddCardIndicators() {
    console.log('Initializing add card indicators...');

    // Click handler for placeholders
    document.addEventListener('click', handleClick);

    // Listen for editing unlock/lock events
    on(EVENTS.EDITING_UNLOCKED, () => {
        console.log('Editing unlocked - enabling add card indicators');
        enableAddCardIndicators();
    });

    on(EVENTS.EDITING_LOCKED, () => {
        console.log('Editing locked - disabling add card indicators');
        disableAddCardIndicators();
    });

    // Listen for schedule rendered event to update indicators
    on(EVENTS.SCHEDULE_RENDERED, () => {
        const isEditingUnlocked = getIsEditingUnlocked();
        if (isEditingUnlocked) {
            enableAddCardIndicators();
        }
    });

    // Initial state
    const isEditingUnlocked = getIsEditingUnlocked();
    if (isEditingUnlocked) {
        enableAddCardIndicators();
    }

    console.log('Add card indicators initialized');
}
