/**
 * Search Handler Module
 * Handles project search functionality and result display
 *
 * Dependencies:
 * - services/data-service.js (getProjectSummaries)
 * - core/state.js (allTasks)
 * - modals/project-modal.js (showProjectView - if available)
 */

import { getProjectSummaries } from '../../services/data-service.js';

// State reference (will be set by state.js)
let allTasks = [];

/**
 * Perform search based on query string
 * Searches project names and displays matching results
 *
 * @param {string} query - The search query
 */
export function performSearch(query) {
    const trimmedQuery = query.trim().toLowerCase();
    const results = document.getElementById('search-results');
    results.innerHTML = '';
    results.style.display = 'none';

    if (!trimmedQuery) return;

    const summaries = getProjectSummaries(allTasks);
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
                // Call showProjectView if it exists (from project-modal module)
                if (typeof window.showProjectView === 'function') {
                    window.showProjectView(match.project);
                }
                document.getElementById('project-search').value = '';
                results.style.display = 'none';
            });
            results.appendChild(item);
        });
        results.style.display = 'block';
    }
}

/**
 * Initialize search event listeners
 * Should be called during app initialization
 */
export function initializeSearchHandlers() {
    const searchInput = document.getElementById('project-search');
    const searchResults = document.getElementById('search-results');

    // Handle input changes
    searchInput.addEventListener('input', (e) => {
        performSearch(e.target.value);
    });

    // Handle Escape key to clear search
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.value = '';
            searchResults.style.display = 'none';
        }
    });

    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });
}

/**
 * Clear search input and results
 */
export function clearSearch() {
    const searchInput = document.getElementById('project-search');
    const searchResults = document.getElementById('search-results');
    searchInput.value = '';
    searchResults.innerHTML = '';
    searchResults.style.display = 'none';
}

/**
 * Set state references (called from state.js initialization)
 */
export function setStateReferences(refs) {
    allTasks = refs.allTasks;
}
