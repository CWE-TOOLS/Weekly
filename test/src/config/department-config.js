/**
 * Department Configuration
 * Contains department order, colors, and day mappings
 */

// Department order for sorting
export const DEPARTMENT_ORDER = [
    'Special Events',
    'CNC',
    'Parts',
    'Mill',
    'Form Out',
    'Cast',
    'Batch',
    'Samples',
    'Demold',
    'Layout',
    'Finish',
    'Seal',
    'Final Insp.',
    'Special',
    'Crating',
    'Load',
    'Ship',
    'Facilities',
    // Cranbury building: always a block below every Dunhams department
    'Crating (Cranbury)',
    'Seal (Cranbury)',
    'Special (Cranbury)',
    'Ship (Cranbury)'
];

// ---------------------------------------------------------------------------
// Buildings: Dunhams (every existing department) and Cranbury.
// A Cranbury task keeps its normal Dunhams name in Sheet column E; the marker is a
// "-C" suffix on the task code (Sheet column F, task.value), e.g. "build-C", "Seal - C".
// ---------------------------------------------------------------------------
export const BUILDING_DUNHAMS = 'Dunhams';
export const BUILDING_CRANBURY = 'Cranbury';

/** The Cranbury departments, in display order. Cranbury has one crate department (Build + Load). */
export const CRANBURY_DEPARTMENTS = [
    'Crating (Cranbury)',
    'Seal (Cranbury)',
    'Special (Cranbury)',
    'Ship (Cranbury)'
];

/** Cranbury department -> its Dunhams counterpart (same colours, same code prefix) */
const CRANBURY_TO_DUNHAMS = {
    'Crating (Cranbury)': 'Crating',
    'Seal (Cranbury)': 'Seal',
    'Special (Cranbury)': 'Special',
    'Ship (Cranbury)': 'Ship'
};

/** Dunhams department -> the Cranbury department a "-C" task of it becomes */
const DUNHAMS_TO_CRANBURY = {
    'Crating': 'Crating (Cranbury)',
    'Load': 'Crating (Cranbury)',
    'Seal': 'Seal (Cranbury)',
    'Special': 'Special (Cranbury)',
    'Ship': 'Ship (Cranbury)'
};

/** Task-code suffix that marks a Cranbury task: "-C", "- C", " -C" ... at the end, any case */
export const CRANBURY_CODE_SUFFIX = /-\s*C\s*$/i;

/** True for a Cranbury department name */
export function isCranbury(dept) {
    return Object.prototype.hasOwnProperty.call(CRANBURY_TO_DUNHAMS, dept);
}

/** 'Cranbury' or 'Dunhams' */
export function buildingOf(dept) {
    return isCranbury(dept) ? BUILDING_CRANBURY : BUILDING_DUNHAMS;
}

/** Dunhams counterpart of a Cranbury department ('Seal (Cranbury)' -> 'Seal'); any other department unchanged */
export function dunhamsCounterpart(dept) {
    return CRANBURY_TO_DUNHAMS[dept] || dept;
}

/** True when a task code carries the Cranbury "-C" suffix */
export function isCranburyTaskCode(taskCode) {
    return CRANBURY_CODE_SUFFIX.test(String(taskCode == null ? '' : taskCode));
}

/**
 * The Cranbury department for a (normalized) department + task code, or null when the task is not
 * a Cranbury task (no "-C" suffix, or a department Cranbury does not have).
 * @param {string} department - normalized department (e.g. 'Crating', 'Load', 'Seal')
 * @param {string} taskCode - Sheet column F / plant_schedule task code
 * @returns {string|null}
 */
export function cranburyDepartmentFor(department, taskCode) {
    if (isCranbury(department)) return department;
    if (!isCranburyTaskCode(taskCode)) return null;
    return DUNHAMS_TO_CRANBURY[department] || null;
}

/**
 * A department typed directly as Cranbury ('Seal (Cranbury)', 'Seal-C', 'seal - c', 'Crate-C', 'Cranbury Ship')
 * -> its canonical Cranbury name, else null.
 */
export function normalizeCranburyDepartment(dept) {
    if (!dept) return null;
    const s = String(dept).toLowerCase().trim();
    let base = null;
    let m;
    if ((m = /^(.*?)\s*\(\s*cranbury\s*\)$/.exec(s))) base = m[1];
    else if ((m = /^(.*?)\s*-\s*c$/.exec(s))) base = m[1];
    else if ((m = /^(.*?)\s*-?\s*cranbury$/.exec(s))) base = m[1];
    else if ((m = /^cranbury\s*-?\s*(.*)$/.exec(s))) base = m[1];
    if (base == null) return null;
    base = base.trim();
    if (['crate', 'crating', 'load', 'build', 'crate / load', 'crate/load'].includes(base)) return 'Crating (Cranbury)';
    if (base === 'seal') return 'Seal (Cranbury)';
    if (base === 'special' || base === 'speciality' || base === 'specialty') return 'Special (Cranbury)';
    if (base === 'ship') return 'Ship (Cranbury)';
    return null;
}

/**
 * Move a loaded task to its building. Call after task.department is normalized.
 * - keeps the original department as task.sheetDepartment;
 * - a "-C" task of Crating/Load/Seal/Special/Ship gets the Cranbury department;
 * - a Cranbury task keeps its staging-note key (task.stagingDepartment) on the original department, so existing
 *   task_descriptions rows still match and the live page sees the same notes;
 * - sets task.building.
 * The displayed task code (task.value) is never changed.
 * @param {Object} task
 * @param {string} [taskCode=task.value] - the task code to test for the "-C" suffix
 * @returns {Object} the same task
 */
export function applyBuilding(task, taskCode) {
    if (!task) return task;
    const code = taskCode === undefined ? task.value : taskCode;
    const original = task.department || '';
    if (task.sheetDepartment === undefined) task.sheetDepartment = original;
    const cranbury = cranburyDepartmentFor(original, code);
    if (cranbury && cranbury !== original) {
        task.department = cranbury;
        if (!task.stagingDepartment) task.stagingDepartment = original;
    }
    task.building = buildingOf(task.department);
    return task;
}

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
    cnc: {
        background: '#607D8B',
        text: '#FFFFFF'
    },
    parts: {
        background: '#4FC3F7',
        text: '#0F172A'
    },
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
    'final-insp': {
        background: '#0D9488',
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
    },
    sample: {
        background: '#047857',
        text: '#FFFFFF'
    },
    samples: {
        background: '#047857',
        text: '#FFFFFF'
    },
    facilities: {
        background: '#9CA3AF',
        text: '#FFFFFF'
    }
};
// Cranbury departments use the colours of their Dunhams counterpart (class form of 'Seal (Cranbury)' is 'seal-cranbury')
DEPARTMENT_COLORS['crating-cranbury'] = DEPARTMENT_COLORS.crating;
DEPARTMENT_COLORS['seal-cranbury'] = DEPARTMENT_COLORS.seal;
DEPARTMENT_COLORS['special-cranbury'] = DEPARTMENT_COLORS.special;
DEPARTMENT_COLORS['ship-cranbury'] = DEPARTMENT_COLORS.ship;

/**
 * Normalize department name to standard format
 * @param {string} dept - Department name to normalize
 * @returns {string} - Normalized department name
 */
export function normalizeDepartment(dept) {
    if (!dept) return '';
    const cranbury = normalizeCranburyDepartment(dept);   // 'Seal (Cranbury)', 'Seal-C', 'Crate-C' ...
    if (cranbury) return cranbury;
    const normalized = dept.toLowerCase().trim();

    // Handle case-insensitive matching for department names
    if (normalized === 'special events') return 'Special Events';
    if (normalized === 'cnc') return 'CNC';
    if (normalized === 'parts') return 'Parts';
    if (normalized === 'mill') return 'Mill';
    if (normalized === 'formout' || normalized === 'form out') return 'Form Out';
    if (normalized === 'cast') return 'Cast';
    if (normalized === 'batch') return 'Batch';
    if (normalized === 'demold') return 'Demold';
    if (normalized === 'layout') return 'Layout';
    if (normalized === 'finish') return 'Finish';
    if (normalized === 'seal') return 'Seal';
    if (normalized === 'final' || normalized === 'final insp' || normalized === 'final insp.' || normalized === 'final inspection') return 'Final Insp.';
    if (normalized === 'special') return 'Special';
    if (normalized === 'crating') return 'Crating';
    if (normalized === 'load') return 'Load';
    if (normalized === 'ship') return 'Ship';
    if (normalized === 'sample' || normalized === 'custom' || normalized === 'samples') return 'Samples';
    if (normalized === 'facilities' || normalized === 'facility') return 'Facilities';

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

/**
 * Configuration for synthetic departments that are paired with primary departments
 * @property {string} synthetic - The name of the synthetic department (e.g., 'Batch')
 * @property {string} label - The display label for the synthetic department
 */
export const SYNTHETIC_DEPARTMENT_CONFIG = {
    'Cast': { synthetic: 'Batch', label: 'Batch' },
    'Demold': { synthetic: 'Layout', label: 'Layout' }
};

/**
 * Set of all synthetic department names, derived from SYNTHETIC_DEPARTMENT_CONFIG.
 * Use this for membership checks instead of hardcoding 'Batch'/'Layout'.
 */
export const SYNTHETIC_DEPARTMENT_NAMES = new Set(
    Object.values(SYNTHETIC_DEPARTMENT_CONFIG).map(c => c.synthetic)
);

/**
 * Check if a department is a synthetic department
 * @param {string} dept - Department name
 * @returns {boolean} True if the department is synthetic (e.g., Batch, Layout)
 */
export function isSyntheticDepartment(dept) {
    return SYNTHETIC_DEPARTMENT_NAMES.has(dept);
}