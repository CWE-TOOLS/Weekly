# Releasability Board - Phase 1 Setup Instructions

## Overview
Phase 1 of the Releasability Board has been successfully copied from the `releasabiltyboarddev/` folder to the main codebase. This document contains the final setup steps.

## Files Copied

All Phase 1 files have been copied to the main codebase:

### Configuration & State
- ✅ `src/config/releasability-config.js` - Configuration for tracking items and statuses
- ✅ `src/pages/releasability/releasability-state.js` - State management

### UI Components
- ✅ `src/styles/releasability.css` - Styles for the board
- ✅ `releasability.html` - Main HTML page
- ✅ `src/pages/releasability/releasability-grid.js` - Grid renderer
- ✅ `src/pages/releasability/releasability-page.js` - Page controller

### Services
- ✅ `src/services/releasability-data-service.js` - Data service

## Database Setup Required

You need to create the Supabase table for storing releasability tracking data.

### Step 1: Access Supabase SQL Editor

1. Go to your Supabase dashboard: https://nrrkxlovhxgwwgzoihiu.supabase.co
2. Navigate to the SQL Editor
3. Create a new query

### Step 2: Run the SQL Script

Copy and paste the following SQL into the editor and execute it:

```sql
-- Releasability Board - Supabase Table Setup
-- This creates the releasability_tracking table for storing project tracking statuses

-- Create releasability_tracking table
CREATE TABLE IF NOT EXISTS releasability_tracking (
    project TEXT NOT NULL,
    week_monday DATE NOT NULL,
    tracking_status JSONB NOT NULL DEFAULT '{}'::jsonb,
    department TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Composite primary key (project + week combination must be unique)
    PRIMARY KEY (project, week_monday)
);

-- Create index on updated_at for efficient sorting
CREATE INDEX IF NOT EXISTS idx_releasability_tracking_updated_at
    ON releasability_tracking(updated_at DESC);

-- Create index on week_monday for efficient weekly queries
CREATE INDEX IF NOT EXISTS idx_releasability_tracking_week_monday
    ON releasability_tracking(week_monday);

-- Create index on department for filtering
CREATE INDEX IF NOT EXISTS idx_releasability_tracking_department
    ON releasability_tracking(department);

-- Enable Row Level Security
ALTER TABLE releasability_tracking ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations
-- Adjust based on your auth requirements
CREATE POLICY "Allow all operations on releasability_tracking"
    ON releasability_tracking
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON releasability_tracking TO anon;
GRANT ALL ON releasability_tracking TO authenticated;

-- Add comments
COMMENT ON TABLE releasability_tracking IS
    'Stores tracking status data for the Releasability Board. Each row represents a project in a specific week with its tracking status for 20 milestones.';

COMMENT ON COLUMN releasability_tracking.project IS 'Project name (e.g., "Alpha Project")';
COMMENT ON COLUMN releasability_tracking.week_monday IS 'Monday date of the week (YYYY-MM-DD)';
COMMENT ON COLUMN releasability_tracking.tracking_status IS 'JSON object containing status for each of the 20 tracking items';
COMMENT ON COLUMN releasability_tracking.department IS 'Department associated with the project (optional)';
COMMENT ON COLUMN releasability_tracking.source IS 'Source of the project: "sheets" or "manual"';
COMMENT ON COLUMN releasability_tracking.updated_at IS 'Timestamp of last update';
COMMENT ON COLUMN releasability_tracking.created_at IS 'Timestamp of creation';

-- Create manual_weeks table for user-added week dividers
CREATE TABLE IF NOT EXISTS releasability_manual_weeks (
    week_monday DATE NOT NULL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_releasability_manual_weeks_monday
    ON releasability_manual_weeks(week_monday);

-- Enable Row Level Security
ALTER TABLE releasability_manual_weeks ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations
CREATE POLICY "Allow all operations on releasability_manual_weeks"
    ON releasability_manual_weeks
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON releasability_manual_weeks TO anon;
GRANT ALL ON releasability_manual_weeks TO authenticated;

-- Add comments
COMMENT ON TABLE releasability_manual_weeks IS
    'Stores manually added week dividers for the Releasability Board.';
COMMENT ON COLUMN releasability_manual_weeks.week_monday IS 'Monday date of the manually added week (YYYY-MM-DD)';
```

### Step 3: Update api-config.js (Optional)

If needed, add the releasability table name to `src/config/api-config.js`:

```javascript
export const SUPABASE = {
    URL: 'https://nrrkxlovhxgwwgzoihiu.supabase.co',
    ANON_KEY: '...',
    TASKS_TABLE: 'weekly_tasks',
    RELEASABILITY_TABLE: 'releasability_tracking',  // Add this line
    CDN_URL: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
};
```

## Testing the Implementation

### Step 1: Start Your Development Server

```bash
# If using a local server
python -m http.server 8000
# or
npx http-server
```

### Step 2: Access the Releasability Board

Navigate to: `http://localhost:8000/releasability.html`

### Step 3: Test Basic Functionality

1. **Page Load**: Verify the page loads without errors
2. **Add Project**: Click "Add Project" button and add a test project
3. **Status Cycling**: Click on status cells to cycle through colors (Red → Yellow → Green → Red)
4. **Project Controls**: Hover over project names to see move/delete controls
5. **Console Check**: Open browser console and check for errors

### Expected Behavior

- ✅ Grid displays with 20 tracking item columns
- ✅ Week headers show properly
- ✅ Status cells are clickable and change colors
- ✅ Project controls (▲ ▼ ✕) appear on hover
- ✅ Add project modal opens and works
- ✅ Status legend shows at the top

## Phase 1 Features Implemented

### ✅ Core Functionality
- Configuration system with 20 tracking items
- State management with event-bus integration
- Grid rendering with sticky headers
- Status cell cycling (incomplete → in_progress → complete)
- Manual project management (add/move/delete)

### ✅ UI Components
- Responsive grid layout
- Status color coding (Red/Yellow/Green)
- Week-based organization
- Project controls on hover
- Empty state display
- Loading states

### ⏳ Not Yet Implemented (Future Phases)
- Google Sheets data integration
- Week navigation (prev/next/current)
- Search and filter functionality
- Data persistence to Supabase
- Real-time multi-user sync
- Print functionality

## Verification Checklist

Run through this checklist to verify Phase 1 is working:

- [ ] Database table created successfully in Supabase
- [ ] Page loads at `/releasability.html`
- [ ] No console errors on page load
- [ ] Can add a new project via modal
- [ ] Status cells cycle through colors when clicked
- [ ] Project controls appear on hover
- [ ] Can move projects between weeks (▲ ▼)
- [ ] Can delete projects (✕)
- [ ] Status legend displays correctly
- [ ] Grid layout is responsive

## Known Limitations (Phase 1)

1. **No Data Persistence**: Changes are stored in memory only (lost on refresh)
2. **No Google Sheets Integration**: Must manually add projects
3. **No Filters**: Search and department filters are UI-only
4. **No Week Navigation**: Navigation buttons are placeholders
5. **No Real-time Sync**: Changes not shared across browser tabs

These will be addressed in future phases.

## Troubleshooting

### Issue: Page doesn't load
- Check that you're serving from the correct directory
- Verify all files were copied successfully
- Check browser console for module loading errors

### Issue: Can't add projects
- Open browser console and check for errors
- Verify modal HTML is present in releasability.html
- Check that releasability-state.js is loaded

### Issue: Status cells don't change
- Check console for event handler errors
- Verify click handlers are attached in releasability-page.js
- Test with browser dev tools to see if click events fire

### Issue: Database errors
- Verify Supabase table was created successfully
- Check that table name matches in data service
- Verify permissions are set correctly

## Next Steps

Once Phase 1 is verified:

1. **Phase 2**: Implement Google Sheets data integration
2. **Phase 3**: Add Supabase persistence for status changes
3. **Phase 4**: Implement week navigation and filters
4. **Phase 5**: Add print functionality and advanced features

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify all files are in correct locations
3. Ensure Supabase table is created properly
4. Review PROGRESS.md in releasabiltyboarddev/ for implementation notes
