/**
 * Department Configuration
 * Contains department order, colors, and day mappings
 */

// Department order for sorting
export const DEPARTMENT_ORDER = [
    'Special Events',
    'Mill',
    'Form Out',
    'Cast',
    'Batch',
    'Demold',
    'Layout',
    'Finish',
    'Seal',
    'Special',
    'Crating',
    'Load',
    'Ship'
];

// Department to day column mapping (for Google Sheets)
export const DEPARTMENT_DAY_MAPPING = {
    "Mill 1": 5,
    "Mill 2": 8,
    "Mill 3": 11,
    "Mill 4": 14,
    "Form Out 1": 17,
    "Form Out 2": 20,
    "Form Out 3": 23,
    "Form Out 4": 26,
    "Cast 1": 29,
    "Cast 2": 32,
    "Demold 1": 37,
    "Demold 2": 40,
    "Demold 3": 43,
    "Crating 1": 49,
    "Crating 2": 52,
    "Finish 1": 61,
    "Finish 2": 64,
    "Finish 3": 67,
    "Finish 4": 70,
    "Finish 5": 73,
    "Seal 1": 76,
    "Seal 2": 79,
    "Seal 3": 82,
    "Seal 4": 85,
    "Special 1": 88,
    "Special 2": 91,
    "Special 3": 94,
    "Special 4": 96,
    "Special 5": 100,
    "Ship 1": 102,
    "Ship 2": 105,
    "Load 1": 55,
    "Load 2": 58
};

// Department colors (CSS custom properties)
export const DEPARTMENT_COLORS = {
    mill: {
        background: '#06B6D4',
        text: '#FFFFFF'
    },
    'form-out': {
        background: '#3B82F6',
        text: '#FFFFFF'
    },
    cast: {
        background: '#EF4444',
        text: '#FFFFFF'
    },
    batch: {
        background: '#800000',
        text: '#FFFFFF'
    },
    layout: {
        background: '#A16207',
        text: '#FFFFFF'
    },
    demold: {
        background: '#F97316',
        text: '#FFFFFF'
    },
    finish: {
        background: '#8B5CF6',
        text: '#FFFFFF'
    },
    seal: {
        background: '#6B7280',
        text: '#FFFFFF'
    },
    special: {
        background: '#EC4899',
        text: '#FFFFFF'
    },
    'special-events': {
        background: '#EF4444',
        text: '#FFFFFF'
    },
    crating: {
        background: '#A16207',
        text: '#FFFFFF'
    },
    load: {
        background: '#F59E0B',
        text: '#FFFFFF'
    },
    ship: {
        background: '#22C55E',
        text: '#FFFFFF'
    }
};

/**
 * Normalize department name to standard format
 * @param {string} dept - Department name to normalize
 * @returns {string} - Normalized department name
 */
export function normalizeDepartment(dept) {
    if (!dept) return '';
    const normalized = dept.toLowerCase().trim();

    // Handle case-insensitive matching for department names
    if (normalized === 'special events') return 'Special Events';
    if (normalized === 'mill') return 'Mill';
    if (normalized === 'formout' || normalized === 'form out') return 'Form Out';
    if (normalized === 'cast') return 'Cast';
    if (normalized === 'batch') return 'Batch';
    if (normalized === 'demold') return 'Demold';
    if (normalized === 'layout') return 'Layout';
    if (normalized === 'finish') return 'Finish';
    if (normalized === 'seal') return 'Seal';
    if (normalized === 'special') return 'Special';
    if (normalized === 'crating') return 'Crating';
    if (normalized === 'load') return 'Load';
    if (normalized === 'ship') return 'Ship';

    return dept;
}

/**
 * Convert department name to CSS class format
 * @param {string} dept - Department name
 * @returns {string} - CSS class-friendly department name
 */
export function normalizeDepartmentClass(dept) {
    if (!dept) return '';
    return dept.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}
