/**
 * Project Modal Module
 *
 * Manages the project view modal that displays all tasks for a specific project.
 * Includes functionality for:
 * - Showing/hiding the project modal
 * - Displaying project tasks grouped by department
 * - Inline editing of task descriptions
 * - Saving changes to staging
 * - Project search functionality
 */

import { allTasks, currentProjectName, DEPARTMENT_ORDER } from '../../core/state.js';
import { parseDate, stripHtml, normalizeDepartmentClass } from '../../utils/date-utils.js';
import { saveToStaging } from '../../services/staging-service.js';
import { equalizeProjectCardHeights } from '../ui/layout.js';

/**
 * Calculate project summaries for all projects
 * @returns {Object} Project summaries with total hours and tasks
 */
export function getProjectSummaries() {
    const projectSummaries = {};
    allTasks.forEach(task => {
        if (!task.project) return;
        if (!projectSummaries[task.project]) {
            projectSummaries[task.project] = { totalHours: 0, tasks: [] };
        }
        const hours = parseFloat(task.hours);
        if (!isNaN(hours)) {
            projectSummaries[task.project].totalHours += hours;
        }
        projectSummaries[task.project].tasks.push(task);
    });
    return projectSummaries;
}

/**
 * Search for projects by name
 * @param {string} query - Search query
 */
export function performSearch(query) {
    const trimmedQuery = query.trim().toLowerCase();
    const results = document.getElementById('search-results');
    results.innerHTML = '';
    results.style.display = 'none';

    if (!trimmedQuery) return;

    const summaries = getProjectSummaries();
    const matches = [];

    Object.entries(summaries).forEach(([projectName, summary]) => {
        if (projectName.toLowerCase().includes(trimmedQuery)) {
            matches.push({
                project: projectName,
                totalHours: summary.totalHours,
                tasks: summary.tasks
            });
        }
    });

    if (matches.length > 0) {
        matches.forEach(match => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.innerHTML = `
                <div class="search-result-title">${match.project}</div>
                <div class="search-result-hours">Total Hours: ${Math.round(match.totalHours)}</div>
            `;
            item.addEventListener('click', () => {
                showProjectView(match.project);
                document.getElementById('project-search').value = '';
                results.style.display = 'none';
            });
            results.appendChild(item);
        });
        results.style.display = 'block';
    }
}

/**
 * Show the project view modal for a specific project
 * @param {string} projectName - Name of the project to display
 */
export function showProjectView(projectName) {
    currentProjectName.value = projectName;
    const projectTasks = allTasks.filter(task => task.project === projectName);

    // Calculate total hours
    let totalHours = 0;
    projectTasks.forEach(task => {
        const hours = parseFloat(task.hours);
        if (!isNaN(hours)) {
            totalHours += hours;
        }
    });

    const modal = document.getElementById('project-modal');
    const title = document.getElementById('project-title');
    const grid = document.getElementById('project-schedule-grid');

    title.textContent = `Build Plan: ${projectName} - Total Hours: ${Math.round(totalHours)}`;
    grid.innerHTML = '';

    // Group tasks by department
    const tasksByDept = {};
    projectTasks.forEach(task => {
        const dept = task.department || 'Other';
        if (!tasksByDept[dept]) tasksByDept[dept] = [];
        tasksByDept[dept].push(task);
    });

    // Sort departments in the same order as main view
    const sortedDepts = DEPARTMENT_ORDER.filter(dept => tasksByDept[dept]);
    if (tasksByDept['Other']) sortedDepts.push('Other');

    // Create a simple list layout instead of complex grid
    sortedDepts.forEach(dept => {
        const deptTasks = tasksByDept[dept].sort((a, b) => {
            // Sort by date, then by day number
            const dateA = parseDate(a.date);
            const dateB = parseDate(b.date);
            if (dateA && dateB) {
                const dateDiff = dateA - dateB;
                if (dateDiff !== 0) return dateDiff;
            }
            return parseInt(a.dayNumber || 0) - parseInt(b.dayNumber || 0);
        });

        // Add department section
        const deptSection = document.createElement('div');
        deptSection.className = 'project-dept-section';
        const deptText = dept === 'Special Events' ? 'Special<br>Events' : dept;
        deptSection.innerHTML = `
            <div class="project-dept-header department-label department-${normalizeDepartmentClass(dept)}">
                ${deptText}
            </div>
            <div class="project-cards-container">
                ${deptTasks.map((task, index) => {
                    const taskDate = parseDate(task.date);
                    const formattedDate = task.missingDate ? 'No date' : (taskDate ? taskDate.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    }) : 'No date');

                    return `
                        <div class="project-task-card task-card department-${normalizeDepartmentClass(task.department)}" style="animation-delay: ${index * 0.1}s" data-task-id="${task.id}" title="Click for options">
                            <div class="task-title">${task.project}</div>
                            <div class="project-description">${task.projectDescription || ''}</div>
                            <div class="task-day-counter">${task.dayCounter || ''}</div>
                            <div class="task-description">${task.description && task.description.trim() ? task.description : '<span class="missing-description">Staging Missing</span>'}</div>
                            <div class="task-details">
                                <strong>Date:</strong> ${formattedDate}<br>
                                <strong>Hours:</strong> ${task.hours}<br>
                                <strong>Code:</strong> ${task.value}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        grid.appendChild(deptSection);
    });

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';

    // Equalize card heights in project view after a short delay
    setTimeout(() => {
        equalizeProjectCardHeights();
    }, 100);

    // Initialize edit mode
    initializeEditMode();
}

/**
 * Hide the project view modal
 */
export function hideProjectView() {
    // Cancel edit mode if active when exiting
    const textareas = document.querySelectorAll('#project-schedule-grid .edit-description');
    if (textareas.length > 0) {
        textareas.forEach(textarea => {
            const taskCard = textarea.closest('.project-task-card');
            const taskId = taskCard.dataset.taskId;
            const task = allTasks.find(t => t.id === taskId);
            const descDiv = document.createElement('div');
            descDiv.className = 'task-description';
            descDiv.innerHTML = task && task.description ? task.description : '<span class="missing-description">Staging Missing</span>';
            textarea.replaceWith(descDiv);
        });
        // Reset buttons to non-edit state
        document.getElementById('edit-plan-btn').style.display = 'inline-block';
        document.getElementById('save-changes-btn').style.display = 'none';
        document.getElementById('cancel-changes-btn').style.display = 'none';
    }

    const modal = document.getElementById('project-modal');
    modal.classList.remove('show');
    document.body.style.overflow = '';
}

/**
 * Initialize edit mode for the project modal
 * Sets up event listeners for editing, saving, and locking functionality
 */
export function initializeEditMode() {
    const unlockBtn = document.getElementById('unlock-editing-btn');
    const editBtn = document.getElementById('edit-plan-btn');
    const lockBtn = document.getElementById('lock-editing-btn');
    const saveBtn = document.getElementById('save-changes-btn');
    const cancelBtn = document.getElementById('cancel-changes-btn');
    let originalDescriptions = new Map();
    let isEditingUnlocked = localStorage.getItem('editingUnlocked') === 'true';

    // Check unlock status and update UI
    if (isEditingUnlocked) {
        unlockBtn.style.display = 'none';
        editBtn.style.display = 'inline-block';
        lockBtn.style.display = 'inline-block';
    }

    unlockBtn.addEventListener('click', () => {
        // Import showPasswordModal dynamically to avoid circular dependency
        import('./password-modal.js').then(module => {
            module.showPasswordModal();
        });
    });

    editBtn.addEventListener('click', () => {
        if (!isEditingUnlocked) return;
        enterEditMode();
    });

    saveBtn.addEventListener('click', async () => {
        await saveChanges();
    });

    cancelBtn.addEventListener('click', () => {
        cancelEditMode();
    });

    lockBtn.addEventListener('click', () => {
        isEditingUnlocked = false;
        localStorage.setItem('editingUnlocked', 'false');
        unlockBtn.style.display = 'inline-block';
        editBtn.style.display = 'none';
        lockBtn.style.display = 'none';
        // If currently in edit mode, cancel it
        if (saveBtn.style.display !== 'none') {
            cancelEditMode();
        }
        // Disable add card indicators when locking editing
        import('../edit/edit-handler.js').then(module => {
            module.enableAddCardIndicators();
        });
        // Update main editing button
        import('../ui/main-edit-button.js').then(module => {
            module.updateMainEditingBtn();
        });
    });

    function enterEditMode() {
        editBtn.style.display = 'none';
        lockBtn.style.display = 'none';
        saveBtn.style.display = 'inline-block';
        cancelBtn.style.display = 'inline-block';

        const descriptions = document.querySelectorAll('#project-schedule-grid .task-description');
        descriptions.forEach(desc => {
            const taskId = desc.closest('.project-task-card').dataset.taskId;
            const originalText = desc.innerHTML;
            originalDescriptions.set(taskId, originalText);

            const textarea = document.createElement('textarea');
            textarea.className = 'edit-description';
            textarea.value = desc.textContent.trim() === 'Staging Missing' ? '' : desc.textContent.trim();
            desc.replaceWith(textarea);
        });
    }

    async function saveChanges() {
        // Set loading state (minimal UI feedback)
        saveBtn.disabled = true;
        cancelBtn.disabled = true;
        saveBtn.innerHTML = '<div class="save-loading-spinner"></div>Saving...';
        saveBtn.style.background = 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)';
        saveBtn.style.cursor = 'not-allowed';

        try {
            const textareas = document.querySelectorAll('#project-schedule-grid .edit-description');
            const changedTasks = [];
            textareas.forEach(textarea => {
                const taskId = textarea.closest('.project-task-card').dataset.taskId;
                const originalText = originalDescriptions.get(taskId);
                const originalStripped = stripHtml(originalText).trim();
                const newText = textarea.value.trim();

                // Update the task
                const task = allTasks.find(t => t.id === taskId);
                if (task) {
                    task.description = newText;
                    // Temp update weekly view cards
                    const weeklyCard = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
                    if (weeklyCard) {
                        const descElement = weeklyCard.querySelector('.task-description');
                        if (descElement) {
                            descElement.innerHTML = newText || '<span class="missing-description">Staging Missing</span>';
                        }
                    }
                }

                // Replace textarea
                const descDiv = document.createElement('div');
                descDiv.className = 'task-description';
                descDiv.innerHTML = newText || '<span class="missing-description">Staging Missing</span>';
                textarea.replaceWith(descDiv);

                // Check if changed
                if (newText !== originalStripped) {
                    changedTasks.push({task, newText});
                }
            });

            // Save to staging
            let syncSuccess = true;
            if (changedTasks.length > 0) {
                try {
                    await saveToStaging(currentProjectName.value, changedTasks);
                } catch (error) {
                    syncSuccess = false;
                    console.error('Staging sync failed:', error);
                    // Continue with local save - user can retry
                }
            }

            // Local data is already updated, modal will show changes automatically
            exitEditMode();

            // Show success notification
            const successNotif = document.getElementById('project-success-notification');
            const syncStatus = syncSuccess ? '✅ Changes saved and synced!' : '✅ Changes saved locally. Sync to backend failed - please try again.';
            successNotif.textContent = syncStatus;
            successNotif.style.display = 'block';
            setTimeout(() => {
                successNotif.style.display = 'none';
            }, syncSuccess ? 2500 : 5000);

        } catch (error) {
            console.error('Save failed:', error);
            // Show error feedback
            saveBtn.innerHTML = '❌ Save Failed';
            saveBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
            setTimeout(() => {
                restoreSaveButton();
            }, 2000);
        } finally {
            if (!saveBtn.innerHTML.includes('Failed')) {
                restoreSaveButton();
            }
        }
    }

    function restoreSaveButton() {
        saveBtn.disabled = false;
        cancelBtn.disabled = false;
        saveBtn.innerHTML = '💾 Save Changes';
        saveBtn.style.background = 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)';
        saveBtn.style.cursor = 'pointer';
    }

    function cancelEditMode() {
        const textareas = document.querySelectorAll('#project-schedule-grid .edit-description');
        textareas.forEach(textarea => {
            const taskId = textarea.closest('.project-task-card').dataset.taskId;
            const originalText = originalDescriptions.get(taskId);

            const descDiv = document.createElement('div');
            descDiv.className = 'task-description';
            descDiv.innerHTML = originalText;
            textarea.replaceWith(descDiv);
        });

        exitEditMode();
    }

    function exitEditMode() {
        editBtn.style.display = 'inline-block';
        if (isEditingUnlocked) {
            lockBtn.style.display = 'inline-block';
        }
        saveBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
        originalDescriptions.clear();
    }
}

/**
 * Initialize project modal event listeners
 */
export function initProjectModal() {
    document.getElementById('project-close').addEventListener('click', hideProjectView);
    document.getElementById('project-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('project-modal')) {
            hideProjectView();
        }
    });

    // Search functionality
    const searchInput = document.getElementById('project-search');
    const searchResults = document.getElementById('search-results');

    searchInput.addEventListener('input', (e) => {
        performSearch(e.target.value);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.value = '';
            searchResults.style.display = 'none';
        }
    });

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });
}
