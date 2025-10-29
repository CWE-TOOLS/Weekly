# Task Card Creation Documentation

This document extracts and documents the code responsible for creating task cards in the Weekly Schedule Viewer application, with particular focus on how department colors are handled. This allows for recreation of the card functionality in other programs or frameworks.

## Overview

Task cards are visual representations of scheduled tasks in a weekly grid layout. Each card displays project information, day counters, descriptions, and department-specific colors. The system supports multiple departments with predefined color schemes.

## Department Color System

### Color Variables (CSS)

The application uses CSS custom properties to define department colors. Each department has a background color and text color:

```css
:root {
    /* Department/Task Colors - Harmonized Palette */
    --color-mill: #06B6D4; --color-mill-text: #FFFFFF;       /* Cyan */
    --color-form-out: #3B82F6; --color-form-out-text: #FFFFFF; /* Blue */
    --color-cast: #EF4444; --color-cast-text: #FFFFFF;       /* Red */
    --color-batch: #800000; --color-batch-text: #FFFFFF;     /* Maroon */
    --color-demold: #F97316; --color-demold-text: #FFFFFF;    /* Orange */
    --color-finish: #8B5CF6; --color-finish-text: #c78989ff;    /* Violet */
    --color-seal: #6B7280; --color-seal-text: #FFFFFF;       /* Medium Grey */
    --color-special: #EC4899; --color-special-text: #FFFFFF;   /* Pink */
    --color-crating: #A16207; --color-crating-text: #FFFFFF;  /* Brown */
    --color-load: #F59E0B; --color-load-text: #FFFFFF;       /* Amber */
    --color-ship: #22C55E; --color-ship-text: #FFFFFF;       /* Green */
}
```

### Department Name Normalization (JavaScript)

Department names are normalized to CSS-compatible class names:

```javascript
function normalizeDepartmentClass(dept) {
    if (!dept) return '';
    return dept.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}
```

**Examples:**
- "Form Out" → "form-out"
- "Mill 1" → "mill-1"
- "Special Projects" → "special-projects"

### CSS Class Application

Task cards and department labels use the normalized department name as CSS classes:

```css
/* Department colors for task cards */
.task-card.department-mill { background-color: var(--color-mill); color: var(--color-mill-text); }
.task-card.department-form-out { background-color: var(--color-form-out); color: var(--color-form-out-text); }
.task-card.department-cast { background-color: var(--color-cast); color: var(--color-cast-text); }
.task-card.department-batch { background-color: var(--color-batch); color: var(--color-batch-text); }
.task-card.department-demold { background-color: var(--color-demold); color: var(--color-demold-text); }
.task-card.department-finish { background-color: var(--color-finish); color: var(--color-finish-text); }
.task-card.department-seal { background-color: var(--color-seal); color: var(--color-seal-text); }
.task-card.department-special { background-color: var(--color-special); color: var(--color-special-text); }
.task-card.department-crating { background-color: var(--color-crating); color: var(--color-crating-text); }
.task-card.department-load { background-color: var(--color-load); color: var(--color-load-text); }
.task-card.department-ship { background-color: var(--color-ship); color: var(--color-ship-text); }

/* Department accent colors for labels */
.department-label.department-mill { background-color: var(--color-mill); color: var(--color-mill-text); }
.department-label.department-form-out { background-color: var(--color-form-out); color: var(--color-form-out-text); }
.department-label.department-cast { background-color: var(--color-cast); color: var(--color-cast-text); }
.department-label.department-batch { background-color: var(--color-batch); color: var(--color-batch-text); }
.department-label.department-demold { background-color: var(--color-demold); color: var(--color-demold-text); }
.department-label.department-finish { background-color: var(--color-finish); color: var(--color-finish-text); }
.department-label.department-seal { background-color: var(--color-seal); color: var(--color-seal-text); }
.department-label.department-special { background-color: var(--color-special); color: var(--color-special-text); }
.department-label.department-crating { background-color: var(--color-crating); color: var(--color-crating-text); }
.department-label.department-load { background-color: var(--color-load); color: var(--color-load-text); }
.department-label.department-ship { background-color: var(--color-ship); color: var(--color-ship-text); }
```

## Task Card HTML Structure

### Basic Card Structure

```html
<div class="task-card department-[normalized-dept]" data-task-id="[task.id]" title="Click for options">
    <div class="task-title">[task.project]</div>
    <div class="task-day-counter">[task.dayCounter || '']</div>
    <div class="task-description">[task.description || '<span class="missing-description">Staging Missing</span>']</div>
    <div class="task-details">
        [conditional: if task.missingDate] <strong>Date:</strong> Missing<br>
        <strong>Hours:</strong> [task.hours]
    </div>
</div>
```

### Card Creation Logic (JavaScript)

The cards are generated dynamically in the `renderWeekGrid` function:

```javascript
if (task) {
    const showDetails = task.department !== 'Batch';
    dayCell.innerHTML = `
        <div class="task-card ${rowClass} department-${normalizeDepartmentClass(task.department)}" data-task-id="${task.id}" title="Click for options">
            <div class="task-title">${task.project}</div>
            <div class="task-day-counter">
               ${task.dayCounter || ''}
            </div>
            <div class="task-description">${task.description && task.description.trim() ? task.description : '<span class="missing-description">Staging Missing</span>'}</div>
            ${showDetails ? `<div class="task-details">
                  ${task.missingDate ? '<strong>Date:</strong> Missing<br>' : ''}
                  <strong>Hours:</strong> ${task.hours}
              </div>` : ''}
        </div>
    `;
} else {
    dayCell.innerHTML = `<div class="task-card-placeholder ${rowClass}"></div>`;
}
```

## Task Data Structure

Each task object contains the following properties:

```javascript
{
    id: `task-${index}`,
    week: weekString,
    project: row[1] || '',
    description: row[9] || '',
    date: row[3] || '',
    department: normalizeDepartment(row[4] || ''),
    value: row[5] || '',
    hours: row[6] || '',
    dayNumber: row[7] || '',
    totalDays: row[8] || '',
    dayCounter: 'Day X of Y', // Calculated from dayNumber and totalDays
    missingDate: boolean // True if date is invalid
}
```

## Department Order

Tasks are sorted by department using this predefined order:

```javascript
const DEPARTMENT_ORDER = [
    'Mill',
    'Form Out',
    'Cast',
    'Batch',
    'Demold',
    'Finish',
    'Seal',
    'Special',
    'Crating',
    'Load',
    'Ship'
];
```

## Recreating in Other Programs

### 1. HTML/CSS Implementation
- Include the CSS variables and classes as shown above
- Use the HTML structure with dynamic class assignment
- Implement the normalization function in your target language

### 2. React/Vue/Angular Components
```javascript
// Example React component
const TaskCard = ({ task }) => {
    const normalizedDept = normalizeDepartmentClass(task.department);
    return (
        <div className={`task-card department-${normalizedDept}`} data-task-id={task.id}>
            <div className="task-title">{task.project}</div>
            <div className="task-day-counter">{task.dayCounter || ''}</div>
            <div className="task-description">
                {task.description ? task.description : <span className="missing-description">Staging Missing</span>}
            </div>
            {task.department !== 'Batch' && (
                <div className="task-details">
                    {task.missingDate && <><strong>Date:</strong> Missing<br/></>}
                    <strong>Hours:</strong> {task.hours}
                </div>
            )}
        </div>
    );
};
```

### 3. Python (Tkinter/PyQt/Web Frameworks)
```python
def normalize_department_class(dept):
    if not dept:
        return ''
    return dept.lower().replace(' ', '-').replace('[^a-z0-9-]', '')

def create_task_card(parent, task):
    normalized_dept = normalize_department_class(task['department'])
    card_frame = ttk.Frame(parent, style=f'TaskCard.{normalized_dept}')
    # Add child widgets for title, description, etc.
    return card_frame
```

### 4. Color Customization
- Modify the CSS variables to change department colors
- Add new departments by extending the DEPARTMENT_ORDER array and adding corresponding CSS variables
- Ensure text colors provide sufficient contrast (typically white on colored backgrounds)

### 5. Data Integration
- Parse your data source to match the task object structure
- Implement date parsing and day counter calculation
- Apply department normalization consistently

## Key Features Preserved
- Department-specific color coding
- Day counters for multi-day tasks
- Conditional details display (Batch tasks show limited info)
- Missing data indicators
- Responsive design considerations
- Accessibility with proper ARIA attributes