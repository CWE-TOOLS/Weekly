# Task Descriptions Migration Guide

## Overview

This guide walks you through migrating task descriptions from Google Sheets "Staging - Project Details" to Supabase, while keeping all other project data in Google Sheets.

---

## What's Changing

### Before Migration
- **Read**: Task descriptions from Google Sheets "Primary Live List 2" Column J
- **Write**: Task descriptions to Google Sheets "Staging - Project Details"
- **Storage**: Google Sheets only

### After Migration
- **Read**: Task descriptions from Supabase `task_descriptions` table
- **Write**: Task descriptions to Supabase `task_descriptions` table
- **Storage**: Supabase database

### What's NOT Changing
- All other project data still comes from Google Sheets (project name, date, department, hours, etc.)
- Releasability board is NOT affected (it doesn't use task descriptions)
- UI and user experience remain the same

---

## Migration Steps

### Step 1: Create Supabase Table

1. Open your Supabase dashboard
2. Go to the SQL Editor
3. Run the SQL script from `migration/task-descriptions-schema.sql`:

```sql
-- Task Descriptions Table
-- Stores task descriptions migrated from Google Sheets "Staging - Project Details"
-- This replaces the staging sheet as the source of truth for task descriptions

CREATE TABLE IF NOT EXISTS task_descriptions (
    -- Composite key fields (project, department, day_number uniquely identify a task)
    project TEXT NOT NULL,           -- Exact project name from Google Sheets (NO trimming)
    department TEXT NOT NULL,        -- Department name (e.g., "Mill 1", "Form Out 2")
    day_number TEXT NOT NULL,        -- Day number as text (e.g., "1", "2", "3")

    -- Task description data
    description TEXT,                -- The actual task description (can be NULL/empty)

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Primary key constraint
    PRIMARY KEY (project, department, day_number)
);

-- Index for faster lookups by project (common query pattern)
CREATE INDEX IF NOT EXISTS idx_task_descriptions_project
    ON task_descriptions(project);

-- Index for faster lookups by project and department
CREATE INDEX IF NOT EXISTS idx_task_descriptions_project_dept
    ON task_descriptions(project, department);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_task_descriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function before updates
DROP TRIGGER IF EXISTS task_descriptions_updated_at ON task_descriptions;
CREATE TRIGGER task_descriptions_updated_at
    BEFORE UPDATE ON task_descriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_task_descriptions_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE task_descriptions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for anonymous users (internal tool)
-- Adjust this policy based on your security requirements
DROP POLICY IF EXISTS "Allow all operations on task_descriptions" ON task_descriptions;
CREATE POLICY "Allow all operations on task_descriptions"
    ON task_descriptions
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE task_descriptions IS 'Stores task descriptions for weekly schedule tasks. Migrated from Google Sheets "Staging - Project Details".';
COMMENT ON COLUMN task_descriptions.project IS 'Project name - MUST match exactly from Google Sheets (no trimming/normalization)';
COMMENT ON COLUMN task_descriptions.department IS 'Department name (e.g., Mill 1, Form Out 2, Batch, Layout)';
COMMENT ON COLUMN task_descriptions.day_number IS 'Day number within the project timeline (stored as text)';
COMMENT ON COLUMN task_descriptions.description IS 'Task description text. Can contain HTML for Batch/Layout departments.';
```

4. Verify the table was created:
   - Go to "Table Editor" in Supabase dashboard
   - You should see a new table called `task_descriptions`

---

### Step 2: Import Existing Data

Run the migration script to import all existing task descriptions from Google Sheets:

```bash
node migration/migrate-staging-to-supabase.js
```

**Expected Output:**
```
🚀 Starting migration from Google Sheets to Supabase...

📥 Fetching staging data from Google Sheets...
📊 Found 25 project columns
✅ Parsed 150 task descriptions
📤 Inserting 150 descriptions into Supabase...
✅ Inserted batch 1 (100 records)
✅ Inserted batch 2 (50 records)

📋 Migration Summary:
   ✅ Successfully inserted: 150
   ❌ Errors: 0
   📊 Total processed: 150

🎉 Migration completed successfully!
```

**Troubleshooting:**
- If you see errors, check that your Supabase credentials are correct in `src/config/api-config.js`
- Make sure the `task_descriptions` table exists in Supabase
- Check that the Google Sheets API key has access to the staging sheet

---

### Step 3: Verify Data in Supabase

1. Go to Supabase dashboard → Table Editor → `task_descriptions`
2. Browse the data and verify:
   - Project names match exactly (no trimming)
   - Departments are correct
   - Day numbers are correct
   - Descriptions are present

Example query to check data:
```sql
SELECT project, department, day_number, LEFT(description, 50) as description_preview
FROM task_descriptions
LIMIT 10;
```

---

### Step 4: Test the Application

The code changes have already been applied. Now test the application:

1. **Start the application** (if not already running)
   ```bash
   # Your usual start command
   ```

2. **Check Console Logs**
   - Open browser DevTools (F12)
   - Look for these logs:
     ```
     📥 Fetching task descriptions from Supabase...
     ✅ Loaded 150 task descriptions from Supabase
     📝 Description merge complete: 145 matched, 10 manual tasks skipped, 5 not found
     ```

3. **Verify Task Descriptions Display**
   - Check that task cards show descriptions correctly
   - Look for any "Staging Missing" indicators (red text)
   - If you see "Staging Missing", check the console logs to see which tasks are missing descriptions

4. **Test Editing Descriptions**
   - Click on a task card to edit the description
   - Save the changes
   - Refresh the page and verify the changes persisted
   - Check Supabase dashboard to confirm the data was written

5. **Test Project Modal**
   - Click on a project name to open the project modal
   - Verify all task descriptions display correctly
   - Enter edit mode and modify some descriptions
   - Save and verify changes persisted

---

### Step 5: Monitor Performance

The migration should improve performance:

- **Before**: 2-3 Google Sheets API calls per page load
- **After**: 1 Google Sheets API call + 1 Supabase query (much faster)

Check console logs for timing metrics:
```
✅ Parallel data fetch complete in 1234ms
   Sheets: 500 tasks, Supabase: 10 tasks, Descriptions: 150 entries
```

---

## Code Changes Summary

### Files Modified

1. **`src/services/supabase-service.js`**
   - Added `fetchTaskDescriptions()` - Reads all descriptions from Supabase
   - Added `saveTaskDescriptions()` - Writes descriptions to Supabase

2. **`src/services/data-service.js`**
   - Updated `fetchAllTasks()` - Fetches descriptions in parallel with other data
   - Added `mergeTaskDescriptions()` - Merges Supabase descriptions into task objects

3. **`src/services/sheets-service.js`**
   - Updated `saveToStaging()` - Now writes to Supabase instead of Google Sheets

### Files Created

1. **`migration/task-descriptions-schema.sql`** - SQL to create the Supabase table
2. **`migration/migrate-staging-to-supabase.js`** - Migration script to import data
3. **`migration/MIGRATION_GUIDE.md`** - This guide

---

## Rollback Plan

If you need to rollback the migration:

1. **Revert Code Changes**
   ```bash
   git checkout HEAD~1 -- src/services/supabase-service.js
   git checkout HEAD~1 -- src/services/data-service.js
   git checkout HEAD~1 -- src/services/sheets-service.js
   ```

2. **Keep Supabase Table**
   - Don't delete the `task_descriptions` table
   - You can re-run the migration later

3. **Restart Application**
   - The app will revert to using Google Sheets for task descriptions

---

## Important Notes

### Project Name Handling
- **NO TRIMMING** - Project names are preserved exactly as they appear in Google Sheets
- This ensures compatibility with the releasability board and other systems
- Matching is done using exact string comparison

### Releasability Board
- **NOT AFFECTED** - The releasability board doesn't use task descriptions
- It only uses: project name, date, and department
- No changes needed to releasability board code

### Manual Tasks
- Manual tasks (created via "Add Task" button) already store descriptions in Supabase `weekly_tasks` table
- They continue to work as before
- The migration only affects tasks imported from Google Sheets

### Cache Invalidation
- Cache invalidation still works (clears both 'tasks' and 'staging' caches)
- Refresh signals are sent to all connected clients after saves
- Smart rendering updates only changed task cards

### Data Consistency
- The Google Sheets "Staging - Project Details" sheet is no longer used for reads/writes
- You can keep it for archival purposes or delete it
- All new writes go to Supabase

---

## Troubleshooting

### Issue: "Staging Missing" appears for many tasks

**Cause**: Descriptions weren't migrated or matching failed

**Solution**:
1. Check console logs for "not found" tasks
2. Verify the migration script ran successfully
3. Check that project names in Supabase match Google Sheets exactly (no trimming)
4. Run this query to check for missing descriptions:
   ```sql
   SELECT DISTINCT project
   FROM task_descriptions
   ORDER BY project;
   ```

### Issue: Edits don't save

**Cause**: Supabase write permissions or network issue

**Solution**:
1. Check browser console for error messages
2. Verify Row Level Security policies in Supabase dashboard
3. Check that the anon key has write permissions
4. Test the connection:
   ```javascript
   const { data, error } = await supabase.from('task_descriptions').select('*').limit(1);
   console.log(data, error);
   ```

### Issue: Slow performance

**Cause**: Network latency to Supabase

**Solution**:
1. Check your internet connection
2. Verify Supabase region (should be geographically close)
3. Check console logs for fetch timing metrics
4. Consider enabling Supabase caching if available

---

## Success Criteria

✅ The migration is successful when:

1. Supabase `task_descriptions` table contains all existing descriptions
2. Task cards display descriptions correctly (no "Staging Missing" errors)
3. Editing descriptions works (inline and project modal)
4. Changes persist after page refresh
5. Console logs show successful Supabase fetches
6. Performance is equal or better than before
7. Releasability board continues to work without issues

---

## Questions?

If you encounter any issues during migration:

1. Check the console logs for detailed error messages
2. Verify all migration steps were completed
3. Review the troubleshooting section above
4. Check Supabase dashboard for data integrity

**Migration completed**: [Date to be filled in after successful migration]
