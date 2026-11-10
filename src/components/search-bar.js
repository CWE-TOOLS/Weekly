/**
 * Search Bar Component
 * Handles project search functionality
 * @module components/search-bar
 */

import { getAllTasks } from '../core/state.js';
import { emit, EVENTS } from '../core/event-bus.js';
import { cardNameOf } from '../utils/card-name.js';

import { logger } from '../utils/logger.js';
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

    // Results are named like the weekly cards (2026-11-10): the portal project name with the cast number, not the
    // raw Optimizer text. The search looks in both, so the old way of typing a job ("popmart") still finds it.
    const squash = (v) => String(v || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const needle = squash(trimmedQuery);
    Object.entries(summaries).forEach(([projectName, summary]) => {
        const card = cardNameOf(summary.tasks);
        const haystack = squash(`${card.full} ${card.description} | ${projectName}`);
        if (haystack.includes(needle)) {
            matches.push({
                project: projectName,
                card,
                totalHours: summary.totalHours,
                tasks: summary.tasks
            });
        }
    });

    if (matches.length > 0) {
        // Sort by the card name, then the cast number (Cast 2 before Cast 10)
        const byText = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        matches.sort((a, b) => byText(a.card.name, b.card.name) || byText(a.card.cast, b.card.cast) || byText(a.project, b.project));
        // Two schedule entries can share one card name (15th and 16th floor of one job): those also show their own text.
        const sameName = new Map();
        matches.forEach(m => sameName.set(m.card.full, (sameName.get(m.card.full) || 0) + 1));

        matches.forEach(match => {
            const item = document.createElement('div');
            item.className = 'search-result-item';

            const titleDiv = document.createElement('div');
            titleDiv.className = 'search-result-title';
            titleDiv.textContent = match.card.name;
            item.appendChild(titleDiv);

            if (match.card.cast) {
                const castDiv = document.createElement('div');
                castDiv.className = 'search-result-cast';
                castDiv.textContent = `Cast ${match.card.cast}` + (match.card.description ? ` \u00b7 ${match.card.description}` : '');
                item.appendChild(castDiv);
            }
            if (sameName.get(match.card.full) > 1 && squash(match.project) !== squash(match.card.full)) {
                const sheetDiv = document.createElement('div');
                sheetDiv.className = 'search-result-sheet';
                sheetDiv.textContent = match.project.replace(/\s+/g, ' ').trim();
                sheetDiv.title = 'The name of this entry in the schedule: two entries show the same name on their cards';
                item.appendChild(sheetDiv);
            }

            const hoursDiv = document.createElement('div');
            hoursDiv.className = 'search-result-hours';
            hoursDiv.textContent = `Total Hours: ${Math.round(match.totalHours)}`;

            item.appendChild(hoursDiv);

            item.addEventListener('click', async () => {
                // Directly call the lazy-loaded showProjectView function
                if (typeof window.showProjectView === 'function') {
                    await window.showProjectView(match.project);
                }

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
        logger.warn('Search input element not found');
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
