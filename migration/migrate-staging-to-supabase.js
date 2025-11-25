/**
 * Migration Script: Import Task Descriptions from Google Sheets to Supabase
 *
 * This script reads all task descriptions from the "Staging - Project Details"
 * Google Sheet and imports them into the Supabase task_descriptions table.
 *
 * Run with: node migration/migrate-staging-to-supabase.js
 */

import { departmentDayMapping } from '../src/services/sheets-service.js';
import { GOOGLE_SHEETS, SUPABASE } from '../src/config/api-config.js';
import { createClient } from '@supabase/supabase-js';

const SPREADSHEET_ID = GOOGLE_SHEETS.SPREADSHEET_ID;
const STAGING_SHEET_NAME = GOOGLE_SHEETS.STAGING_SHEET_NAME;
const GOOGLE_API_KEY = GOOGLE_SHEETS.API_KEY;

// Initialize Supabase client for Node.js
const supabase = createClient(SUPABASE.URL, SUPABASE.ANON_KEY);

// Reverse mapping: row number -> department + day
const rowToDepartmentDay = {};
Object.entries(departmentDayMapping).forEach(([deptDay, rowNum]) => {
    rowToDepartmentDay[rowNum] = deptDay;
});

/**
 * Fetches all data from the Staging sheet
 */
async function fetchStagingData() {
    const range = `${STAGING_SHEET_NAME}!A1:ZZ`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${GOOGLE_API_KEY}`;

    console.log('📥 Fetching staging data from Google Sheets...');
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch staging data: ${response.statusText}`);
    }

    const data = await response.json();
    return data.values || [];
}

/**
 * Parses staging sheet data into task description records
 */
function parseStagingData(rows) {
    if (!rows || rows.length === 0) {
        console.log('⚠️  No data found in staging sheet');
        return [];
    }

    const descriptions = [];
    const headerRow = rows[0];

    // Find project columns (starting from column D, index 3)
    const projectColumns = [];
    for (let colIndex = 3; colIndex < headerRow.length; colIndex++) {
        const projectName = headerRow[colIndex];
        if (projectName && projectName.trim()) {
            projectColumns.push({
                index: colIndex,
                name: projectName  // DO NOT TRIM - preserve exact name
            });
        }
    }

    console.log(`📊 Found ${projectColumns.length} project columns`);

    // Process each row
    for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        const rowNumber = rowIndex + 1; // Excel row numbers start at 1

        // Check if this row corresponds to a department/day combination
        const deptDay = rowToDepartmentDay[rowNumber];
        if (!deptDay) {
            continue; // Skip rows that aren't in the mapping
        }

        // Parse department and day from "Department DayNumber" format
        const parts = deptDay.split(' ');
        const dayNumber = parts[parts.length - 1];
        const department = parts.slice(0, -1).join(' ');

        // Process each project column
        for (const project of projectColumns) {
            const description = row[project.index];

            // Only add if description exists and is not empty
            if (description && description.trim()) {
                descriptions.push({
                    project: project.name,  // Exact project name, no trimming
                    department: department,
                    day_number: dayNumber,
                    description: description.trim()  // Trim description content only
                });
            }
        }
    }

    console.log(`✅ Parsed ${descriptions.length} task descriptions`);
    return descriptions;
}

/**
 * Inserts task descriptions into Supabase
 */
async function insertDescriptions(descriptions) {
    if (descriptions.length === 0) {
        console.log('⚠️  No descriptions to insert');
        return { success: 0, errors: 0 };
    }
    console.log(`📤 Inserting ${descriptions.length} descriptions into Supabase...`);

    // Batch insert with upsert (in case of duplicates)
    const BATCH_SIZE = 100;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < descriptions.length; i += BATCH_SIZE) {
        const batch = descriptions.slice(i, i + BATCH_SIZE);

        const { data, error } = await supabase
            .from('task_descriptions')
            .upsert(batch, {
                onConflict: 'project,department,day_number'
            });

        if (error) {
            console.error(`❌ Error inserting batch ${i / BATCH_SIZE + 1}:`, error);
            errorCount += batch.length;
        } else {
            successCount += batch.length;
            console.log(`✅ Inserted batch ${i / BATCH_SIZE + 1} (${batch.length} records)`);
        }
    }

    return { success: successCount, errors: errorCount };
}

/**
 * Main migration function
 */
async function migrate() {
    console.log('🚀 Starting migration from Google Sheets to Supabase...\n');

    try {
        // Step 1: Fetch data from Google Sheets
        const rows = await fetchStagingData();

        // Step 2: Parse into task description records
        const descriptions = parseStagingData(rows);

        // Step 3: Insert into Supabase
        const result = await insertDescriptions(descriptions);

        // Summary
        console.log('\n📋 Migration Summary:');
        console.log(`   ✅ Successfully inserted: ${result.success}`);
        console.log(`   ❌ Errors: ${result.errors}`);
        console.log(`   📊 Total processed: ${descriptions.length}`);

        if (result.errors > 0) {
            console.log('\n⚠️  Migration completed with errors. Please review the logs above.');
            process.exit(1);
        } else {
            console.log('\n🎉 Migration completed successfully!');
            process.exit(0);
        }

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run migration
migrate();
