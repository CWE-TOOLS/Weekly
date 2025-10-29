/**
 * Search Bar Component
 * Handles project search functionality
 * @module components/search-bar
 */

import { getAllTasks } from '../core/state.js';
import { emit, EVENTS } from '../core/event-bus.js';

/**
 * Get project summaries with total hours
 * @returns {Object} Object mapping project names to summary data
 */
function getProjectSummaries() {
    const allTasks = getAllTasks();
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
 * Perform search and display results
 * @param {string} query - Search query
 */
export function performSearch(query) {
    const trimmedQuery = query.trim().toLowerCase();
    const results = document.getElementById('search-results');

    if (!results) return;

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
        // Sort by project name
        matches.sort((a, b) => a.project.localeCompare(b.project));

        matches.forEach(match => {
            const item = document.createElement('div');
            item.className = 'search-result-item';

            const titleDiv = document.createElement('div');
            titleDiv.className = 'search-result-title';
            titleDiv.textContent = match.project;

            const hoursDiv = document.createElement('div');
            hoursDiv.className = 'search-result-hours';
            hoursDiv.textContent = `Total Hours: ${Math.round(match.totalHours)}`;

            item.appendChild(titleDiv);
            item.appendChild(hoursDiv);

            item.addEventListener('click', () => {
                // Emit event for project view (to be handled by modal component in Phase 6)
                emit(EVENTS.PROJECT_SELECTED, { projectName: match.project, tasks: match.tasks });

                // Clear search
                const searchInput = document.getElementById('project-search');
                if (searchInput) searchInput.value = '';
                results.style.display = 'none';
            });

            results.appendChild(item);
        });

        results.style.display = 'block';
    } else {
        // Show "no results" message
        const noResults = document.createElement('div');
        noResults.className = 'search-result-item';
        noResults.style.color = '#999';
        noResults.textContent = 'No projects found';
        results.appendChild(noResults);
        results.style.display = 'block';
    }
}

/**
 * Clear search results
 */
export function clearSearch() {
    const searchInput = document.getElementById('project-search');
    const searchResults = document.getElementById('search-results');

    if (searchInput) searchInput.value = '';
    if (searchResults) searchResults.style.display = 'none';
}

/**
 * Initialize search bar
 */
export function initializeSearch() {
    const searchInput = document.getElementById('project-search');
    const searchResults = document.getElementById('search-results');

    if (!searchInput) {
        console.warn('Search input element not found');
        return;
    }

    // Search on input
    searchInput.addEventListener('input', (e) => {
        performSearch(e.target.value);
    });

    // Clear on Escape key
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            clearSearch();
        }
    });

    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
        if (searchResults && !searchResults.contains(e.target) && e.target !== searchInput) {
            searchResults.style.display = 'none';
        }
    });

    // Prevent search results from closing when clicking inside
    if (searchResults) {
        searchResults.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
}
