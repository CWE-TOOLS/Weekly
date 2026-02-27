/**
 * Smart Renderer Utility
 *
 * Performs intelligent DOM diffing and incremental updates to eliminate
 * flickering during data refreshes.
 *
 * Pattern: DOM diffing with minimal updates
 * - Compares old vs new task data
 * - Updates only changed elements
 * - Preserves scroll position and editing state
 * - Silently integrates changes without visual disruption
 */

import { logger } from './logger.js';
import { createTaskCard, createTaskCardPlaceholder } from '../components/task-card.js';
import { getEditingCardId } from '../core/refresh-queue.js';
import { getIsEditingUnlocked } from '../core/state.js';
import { debug } from './debug.js';
import { RENDERING } from '../config/rendering-constants.js';
import { sanitizeDescription } from './security-utils.js';

/**
 * Create a task map for quick lookups
 * @param {Object[]} tasks - Array of tasks
 * @returns {Map<string, Object>} Map of task ID to task object
 */
function createTaskMap(tasks) {
    const map = new Map();
    tasks.forEach(task => {
        if (task && task.id) {
            map.set(task.id, task);
        }
    });
    return map;
}

/**
 * Compare two task objects to detect changes
 * @param {Object} oldTask - Previous task data
 * @param {Object} newTask - New task data
 * @returns {boolean} True if tasks differ
 */
function hasTaskChanged(oldTask, newTask) {
    if (!oldTask || !newTask) return true;

    // Check all relevant fields
    const fields = [
        'project',
        'projectDescription',
        'description',
        'department',
        'dayCounter',
        'hours',
        'date',
        'isManual',
        'missingDate'
    ];

    return fields.some(field => oldTask[field] !== newTask[field]);
}

/**
 * Update a single task card DOM element with new data
 * @param {HTMLElement} cardElement - Existing card element
 * @param {Object} newTask - New task data
 * @param {string} rowClass - Row class for the card
 */
function updateTaskCard(cardElement, newTask, rowClass) {
    // Update title
    const titleDiv = cardElement.querySelector('.task-title');
    if (titleDiv && titleDiv.textContent !== newTask.project) {
        titleDiv.textContent = newTask.project;
    }

    // Update project description
    const projectDescDiv = cardElement.querySelector('.project-description');
    if (projectDescDiv) {
        const newDesc = newTask.projectDescription || '';
        if (projectDescDiv.textContent !== newDesc) {
            projectDescDiv.textContent = newDesc;
        }
    }

    // Update day counter
    const dayCounterDiv = cardElement.querySelector('.task-day-counter');
    if (dayCounterDiv) {
        const newCounter = newTask.dayCounter || '';
        if (dayCounterDiv.textContent !== newCounter) {
            dayCounterDiv.textContent = newCounter;
        }
    }

    // Update description
    const descDiv = cardElement.querySelector('.task-description');
    if (descDiv) {
        const hasDescription = newTask.description && newTask.description.trim();
        if (hasDescription) {
            // Use innerHTML for Batch and Layout to support <br> tags
            if (RENDERING.shouldUseHtmlDescription(newTask.department)) {
                const sanitized = sanitizeDescription(newTask.description);
                if (descDiv.innerHTML !== sanitized) {
                    descDiv.innerHTML = sanitized;
                }
            } else {
                if (descDiv.textContent !== newTask.description) {
                    descDiv.textContent = newTask.description;
                }
            }
        } else {
            const missingHtml = '<span class="missing-description">Staging Missing</span>';
            if (descDiv.innerHTML !== missingHtml) {
                descDiv.innerHTML = missingHtml;
            }
        }
    }

    // Update hours (if present)
    const detailsDiv = cardElement.querySelector('.task-details');
    if (detailsDiv && RENDERING.shouldShowHours(newTask.department)) {
        let detailsHTML = '';
        if (newTask.missingDate) {
            detailsHTML += '<strong>Date:</strong> Missing<br>';
        }
        detailsHTML += `<strong>Hours:</strong> ${newTask.hours}`;

        if (detailsDiv.innerHTML !== detailsHTML) {
            detailsDiv.innerHTML = detailsHTML;
        }
    }

    logger.debug('SmartRenderer: Updated card', { taskId: newTask.id });
}

/**
 * Remove a task card from its cell and replace with a placeholder
 * @param {HTMLElement} cardElement - Card element to remove
 * @param {Object} stats - Stats object to update
 */
function removeCard(cardElement, stats) {
    const parentCell = cardElement.parentElement;
    if (parentCell && parentCell.classList.contains('grid-cell')) {
        // Replace card with placeholder
        const rowClass = cardElement.dataset.row || '';
        const dept = cardElement.dataset.department || '';
        const dateStr = cardElement.dataset.date || '';
        const weekStr = cardElement.dataset.week || '';

        // Extract from card's classes or data attributes
        const placeholder = createTaskCardPlaceholder(dept, dateStr, weekStr, rowClass);
        parentCell.replaceChild(placeholder, cardElement);
        stats.removed++;
        logger.debug('SmartRenderer: Removed card', { taskId: cardElement.dataset.taskId });
    }
}

/**
 * Move a task card to a new cell when its date or week changed
 * @param {HTMLElement} cardElement - Card element to move
 * @param {HTMLElement} container - Schedule container element
 * @param {Object} oldTask - Previous task data
 * @param {Object} newTask - New task data
 * @param {string} rowClass - Row class for the card
 * @param {Object} stats - Stats object to update
 * @returns {boolean} True if move succeeded, false if full re-render is needed
 */
function moveCard(cardElement, container, oldTask, newTask, rowClass, stats) {
    debug.log('=== SMART RENDERER: Moving card to new date ===', {
        taskId: newTask.id,
        oldDate: oldTask.date,
        newDate: newTask.date
    });

    // Find the new target cell using correct selector (date + department)
    // Use YYYY-MM-DD format to match DOM data attributes
    const newDateStr = newTask.date || '';
    const newDept = newTask.department;

    // Find all cells for this date + department
    const candidateCells = container.querySelectorAll(`.grid-cell[data-date="${newDateStr}"][data-department="${newDept}"]`);

    debug.log('=== SMART RENDERER: Searching for target cell ===', {
        selector: `.grid-cell[data-date="${newDateStr}"][data-department="${newDept}"]`,
        candidateCellsFound: candidateCells.length,
        rowClass: rowClass
    });

    // Log what's in each candidate cell
    if (candidateCells.length > 0) {
        candidateCells.forEach((cell, idx) => {
            const placeholders = cell.querySelectorAll('.task-card-placeholder');
            const placeholderClasses = Array.from(placeholders).map(p => Array.from(p.classList).join(' '));
            debug.log(`  Candidate cell ${idx}:`, {
                date: cell.dataset.date,
                dept: cell.dataset.department,
                placeholders: placeholderClasses
            });
        });
    }

    // Find the cell that contains a placeholder with matching row class
    let newTargetCell = null;
    for (const cell of candidateCells) {
        const placeholder = cell.querySelector(`.task-card-placeholder.${rowClass}`);
        if (placeholder) {
            newTargetCell = cell;
            break;
        }
    }

    if (newTargetCell) {
        // Get the old cell to add a placeholder back
        const oldCell = cardElement.parentElement;

        // Find and remove the placeholder from the new cell
        const placeholder = newTargetCell.querySelector('.task-card-placeholder');
        if (placeholder) {
            placeholder.remove();
        }

        // Remove card from old cell
        cardElement.remove();

        // Add card to new cell
        newTargetCell.appendChild(cardElement);

        // Update card content with new task data
        updateTaskCard(cardElement, newTask, rowClass);

        // Add placeholder back to old cell
        if (oldCell && oldCell.classList.contains('grid-cell')) {
            const oldDept = oldCell.dataset.department;
            const oldDate = oldTask.date ? oldTask.date.split('-').join('-') : '';
            const oldWeek = oldTask.week || '';

            const newPlaceholder = document.createElement('div');
            newPlaceholder.className = `task-card-placeholder ${rowClass}`;
            const editingUnlocked = getIsEditingUnlocked();
            if (editingUnlocked) {
                newPlaceholder.classList.add('add-enabled');
            }
            newPlaceholder.dataset.department = oldDept;
            newPlaceholder.dataset.date = oldDate;
            newPlaceholder.dataset.week = oldWeek;
            oldCell.appendChild(newPlaceholder);
        }

        stats.updated++;
        logger.debug('SmartRenderer: Moved card to new cell', { taskId: newTask.id, newDate: newTask.date });
        return true;
    } else {
        // Can't find new cell, need full re-render
        logger.warn('SmartRenderer: Could not find target cell, will force full re-render', {
            taskId: newTask.id,
            newDate: newTask.date,
            dateStr: newDateStr,
            dept: newDept,
            rowClass: rowClass
        });
        return false;
    }
}

/**
 * Update a card's content in place when only non-positional fields changed
 * @param {HTMLElement} cardElement - Card element to update
 * @param {Object} newTask - New task data
 * @param {Object} stats - Stats object to update
 */
function updateCardContent(cardElement, newTask, stats) {
    const rowClass = cardElement.classList.contains('dept-row-')
        ? Array.from(cardElement.classList).find(c => c.startsWith('dept-row-'))
        : '';
    updateTaskCard(cardElement, newTask, rowClass);
    stats.updated++;
}

/**
 * Smart update schedule grid with minimal DOM changes
 * @param {HTMLElement} container - Schedule container element
 * @param {Object[]} oldTasks - Previous task array
 * @param {Object[]} newTasks - New task array
 * @returns {Object} Update statistics
 */
export function smartUpdateSchedule(container, oldTasks, newTasks) {
    const startTime = performance.now();
    const stats = {
        added: 0,
        removed: 0,
        updated: 0,
        unchanged: 0,
        skippedEditing: 0
    };

    // Flag to track if full re-render is needed
    let needsFullRender = false;

    // Create task maps for efficient lookup
    const oldTaskMap = createTaskMap(oldTasks);
    const newTaskMap = createTaskMap(newTasks);
    const editingCardId = getEditingCardId();

    // Get all existing task cards in DOM
    const existingCards = container.querySelectorAll('.task-card[data-task-id]');

    logger.info('SmartRenderer: Starting smart update', {
        oldCount: oldTasks.length,
        newCount: newTasks.length,
        existingCardsInDOM: existingCards.length,
        editingCardId
    });

    // Phase 1: Update or remove existing cards
    existingCards.forEach(cardElement => {
        const taskId = cardElement.dataset.taskId;

        // Skip card being edited
        if (taskId === editingCardId) {
            stats.skippedEditing++;
            logger.debug('SmartRenderer: Skipping card being edited', { taskId });
            return;
        }

        const oldTask = oldTaskMap.get(taskId);
        const newTask = newTaskMap.get(taskId);

        if (!newTask) {
            // Task was removed - remove card and replace with placeholder
            removeCard(cardElement, stats);
        } else if (!oldTask) {
            // Task exists in DOM but not in old data — can't diff, update content in place
            updateCardContent(cardElement, newTask, stats);
        } else if (hasTaskChanged(oldTask, newTask)) {
            // Log what we're comparing for manual tasks
            if (newTask.isManual) {
                debug.log('=== SMART RENDERER: Checking manual task ===', {
                    taskId: newTask.id,
                    oldDate: oldTask.date,
                    newDate: newTask.date,
                    oldWeek: oldTask.week,
                    newWeek: newTask.week,
                    dateChanged: oldTask.date !== newTask.date,
                    weekChanged: oldTask.week !== newTask.week,
                    sameObject: oldTask === newTask
                });
            }

            // Check if date or week changed - need to move card to new cell
            if (oldTask.date !== newTask.date || oldTask.week !== newTask.week) {
                const rowClass = Array.from(cardElement.classList).find(c => c.startsWith('dept-row-')) || '';
                const moveSucceeded = moveCard(cardElement, container, oldTask, newTask, rowClass, stats);
                if (!moveSucceeded) {
                    needsFullRender = true;
                }
            } else {
                // Only content changed, update in place
                updateCardContent(cardElement, newTask, stats);
            }
        } else {
            // Task unchanged
            stats.unchanged++;
        }
    });

    // Check if full re-render is needed (from card movement failures)
    if (needsFullRender) {
        logger.warn('SmartRenderer: Full re-render needed due to card movement failure');
        return null;
    }

    // Phase 2: Add new cards by finding the correct cell and replacing a placeholder
    const addedTaskIds = Array.from(newTaskMap.keys()).filter(id => !oldTaskMap.has(id));

    for (const taskId of addedTaskIds) {
        const newTask = newTaskMap.get(taskId);
        const dateStr = newTask.date || '';
        const dept = newTask.department;

        // Find all cells for this date + department (same pattern as moveCard)
        const candidateCells = container.querySelectorAll(`.grid-cell[data-date="${dateStr}"][data-department="${dept}"]`);

        if (candidateCells.length === 0) {
            // Target cell doesn't exist in DOM (task belongs to a week grid not rendered)
            logger.warn('SmartRenderer: No cell found for new task, need full re-render', {
                taskId, date: dateStr, dept
            });
            return null;
        }

        // Find a placeholder in one of the candidate cells to replace
        let inserted = false;
        for (const cell of candidateCells) {
            const placeholder = cell.querySelector('.task-card-placeholder');
            if (placeholder) {
                // Determine row class from the placeholder
                const rowClass = Array.from(placeholder.classList).find(c => c.startsWith('dept-row-')) || '';
                const card = createTaskCard(newTask, rowClass);
                cell.replaceChild(card, placeholder);
                stats.added++;
                inserted = true;
                logger.debug('SmartRenderer: Inserted new card', { taskId, date: dateStr, dept });
                break;
            }
        }

        if (!inserted) {
            // No placeholder available in any matching cell - fall back to full re-render
            logger.warn('SmartRenderer: No placeholder for new task, need full re-render', {
                taskId, date: dateStr, dept
            });
            return null;
        }
    }

    const duration = performance.now() - startTime;
    logger.info('SmartRenderer: Smart update complete', { ...stats, duration: `${duration.toFixed(2)}ms` });

    return stats;
}

/**
 * Preserve scroll position during updates
 * @param {HTMLElement} container - Scrollable container
 * @returns {Function} Restore function
 */
export function preserveScrollPosition(container) {
    const scrollTop = container.scrollTop;
    const scrollLeft = container.scrollLeft;

    // Get reference element for relative positioning
    const viewportTop = scrollTop;
    const firstVisibleCard = Array.from(container.querySelectorAll('.task-card'))
        .find(card => {
            const rect = card.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            return rect.top >= containerRect.top;
        });

    const referenceOffset = firstVisibleCard
        ? firstVisibleCard.offsetTop - viewportTop
        : 0;

    logger.debug('SmartRenderer: Preserved scroll position', {
        scrollTop,
        scrollLeft,
        referenceOffset
    });

    // Return restore function
    return () => {
        if (firstVisibleCard) {
            // Try to find the same card by ID
            const taskId = firstVisibleCard.dataset.taskId;
            if (taskId) {
                const newCard = container.querySelector(`[data-task-id="${taskId}"]`);
                if (newCard) {
                    const newScrollTop = newCard.offsetTop - referenceOffset;
                    container.scrollTop = newScrollTop;
                    container.scrollLeft = scrollLeft;
                    logger.debug('SmartRenderer: Restored scroll via reference card', { taskId });
                    return;
                }
            }
        }

        // Fallback: restore absolute position
        container.scrollTop = scrollTop;
        container.scrollLeft = scrollLeft;
        logger.debug('SmartRenderer: Restored scroll via absolute position');
    };
}

/**
 * Check if smart update is possible
 * @param {HTMLElement} container - Schedule container
 * @param {Object[]} oldTasks - Previous tasks
 * @param {Object[]} newTasks - New tasks
 * @returns {boolean} True if smart update can be used
 */
export function canUseSmartUpdate(container, oldTasks, newTasks) {
    // Can't use smart update if container is empty
    if (!container || container.children.length === 0) {
        return false;
    }

    // Can't use smart update if we have no old tasks to compare
    if (!oldTasks || oldTasks.length === 0) {
        return false;
    }

    // Can't use smart update if structure would change dramatically
    // (e.g., different departments visible)
    const oldDepts = new Set(oldTasks.map(t => t.department));
    const newDepts = new Set(newTasks.map(t => t.department));

    const deptsAdded = [...newDepts].filter(d => !oldDepts.has(d));
    const deptsRemoved = [...oldDepts].filter(d => !newDepts.has(d));

    if (deptsAdded.length > 0 || deptsRemoved.length > 0) {
        logger.debug('SmartRenderer: Department structure changed, cannot use smart update', {
            added: deptsAdded,
            removed: deptsRemoved
        });
        return false;
    }

    return true;
}

// Export for debugging
if (typeof window !== 'undefined') {
    window.smartRenderer = {
        canUseSmartUpdate,
        smartUpdateSchedule,
        preserveScrollPosition
    };
}
